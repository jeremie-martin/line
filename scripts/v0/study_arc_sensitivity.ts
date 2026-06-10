/**
 * Arc → next-state sensitivity study (read-only diagnostic).
 *
 * Question: is the map from "small controlled arc modification" to "rider
 * state at the next gap" smooth and predictable enough to INVERT — i.e. can
 * generation move from sample-and-hope to aiming? For each committed gap-k
 * arc of a compiled track we apply three perturbation families, re-simulate
 * the prefix (arcs ≤ k only, matching what generation sees), and read the
 * full rider state at gap k+1's frame:
 *
 *   - CoM kinematics: position, velocity, speed, velocity angle
 *   - INTERNAL ROTATION: sled pose angle (TAIL→NOSE vector) — not in
 *     targetState today, readable from the engine per frame
 *   - validity: SLED_INTACT / RIDER_MOUNTED flags
 *
 * Families (all preserve arc chain continuity by construction):
 *   exit_pitch  rotate the last ~third of segments about their first point
 *   arc_rotate  rotate the whole arc about its entry point
 *   arc_extend  lengthen/shorten the final segment along its direction
 *
 * Per (gap, family, outcome) we measure: control authority (outcome range
 * over the sweep), local-linearity (midpoint-prediction error from the two
 * neighbors — the "secant test"), monotonicity, and survival. The verdict
 * ratio is interp-error / range: << 1 means a 2-sample local linear model
 * can aim within the sweep's reach.
 *
 *   LR_ENGINE=wasm node --expose-gc --import tsx scripts/v0/study_arc_sensitivity.ts \
 *     [--specs=a,b] [--seeds=0,1] [--budget=300000] [--out=path.jsonl] [--max-gaps=N]
 *
 * Read-only: production compile paths untouched; perturbed tracks are never
 * scored or written back.
 */
import { writeFileSync } from "node:fs";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { getRiderMetered, getSledPointPositionsMetered } from "../lib/detector.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { FPS } from "./types.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const DEFAULT_SPECS = "dense_echo_climb,cold_start,climb_terrace,rolling_drop,verse_chorus,drums_dropout";
const specNames = (argValue("specs") ?? DEFAULT_SPECS).split(",") as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0,1").split(",").map(Number);
const budget = Number(argValue("budget") ?? "300000");
const outPath = argValue("out");
const maxGapsPerTrack = Number(argValue("max-gaps") ?? "0") || Infinity;
for (const s of specNames) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(s)) {
    console.error(`unknown spec "${s}"`);
    process.exit(1);
  }
}

const DEG = 180 / Math.PI;
type Line = {
  id: number; type: number; x1: number; y1: number; x2: number; y2: number;
  flipped?: boolean; leftExtended?: boolean; rightExtended?: boolean;
};
type TrackJson = {
  startPosition?: { x: number; y: number };
  riders?: { startVelocity?: { x: number; y: number } }[];
  lines?: Line[];
};

// ─────────── arc grouping (same chain rule as analysis/geometry.ts, but
// keeping the lines themselves so we can perturb them) ───────────

function chainArcGroups(lines: Line[]): Line[][] {
  const groups: Line[][] = [];
  let current: Line[] = [];
  for (const line of lines) {
    const prev = current[current.length - 1];
    if (prev !== undefined && line.x1 === prev.x2 && line.y1 === prev.y2) {
      current.push(line);
    } else {
      if (current.length > 0) groups.push(current);
      current = [line];
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

// ─────────── perturbations ───────────

function rotateLines(lines: Line[], pivot: { x: number; y: number }, deg: number): Line[] {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const rot = (x: number, y: number): [number, number] => {
    const dx = x - pivot.x;
    const dy = y - pivot.y;
    return [pivot.x + dx * c - dy * s, pivot.y + dx * s + dy * c];
  };
  return lines.map((l) => {
    const [x1, y1] = rot(l.x1, l.y1);
    const [x2, y2] = rot(l.x2, l.y2);
    return { ...l, x1, y1, x2, y2 };
  });
}

/** Rotate the last ~third of segments about that suffix's first point.
 *  Positive deg pitches the exit DOWNWARD (screen +y is down). */
function perturbExitPitch(arc: Line[], deg: number): Line[] | null {
  const m = Math.max(1, Math.ceil(arc.length / 3));
  const head = arc.slice(0, arc.length - m);
  const tail = arc.slice(arc.length - m);
  const pivot = { x: tail[0].x1, y: tail[0].y1 };
  return [...head, ...rotateLines(tail, pivot, deg)];
}

/** Rotate the whole arc about its entry point. */
function perturbArcRotate(arc: Line[], deg: number): Line[] | null {
  return rotateLines(arc, { x: arc[0].x1, y: arc[0].y1 }, deg);
}

/** Extend (+) / shorten (−) the final segment along its own direction. */
function perturbArcExtend(arc: Line[], px: number): Line[] | null {
  const last = arc[arc.length - 1];
  const len = Math.hypot(last.x2 - last.x1, last.y2 - last.y1);
  if (len < 1e-6 || len + px < 2) return null;
  const ux = (last.x2 - last.x1) / len;
  const uy = (last.y2 - last.y1) / len;
  const moved = { ...last, x2: last.x2 + ux * px, y2: last.y2 + uy * px };
  return [...arc.slice(0, -1), moved];
}

type Family = {
  name: "exit_pitch" | "arc_rotate" | "arc_extend";
  deltas: number[];
  apply: (arc: Line[], delta: number) => Line[] | null;
  unit: string;
};
const FAMILIES: Family[] = [
  { name: "exit_pitch", deltas: [-10, -8, -6, -4, -2, 2, 4, 6, 8, 10], apply: perturbExitPitch, unit: "deg" },
  { name: "arc_rotate", deltas: [-4, -3, -2, -1, 1, 2, 3, 4], apply: perturbArcRotate, unit: "deg" },
  { name: "arc_extend", deltas: [-40, -20, 20, 40, 60], apply: perturbArcExtend, unit: "px" },
];

// ─────────── simulation ───────────

type Outcome = {
  ok: boolean;
  broken: boolean;
  ejected: boolean;
  x: number; y: number;
  vx: number; vy: number;
  speed: number;
  comAngleDeg: number;
  sledAngleDeg: number | null;
};

function measure(track: TrackJson, lines: Line[], frame: number): Outcome {
  let engine = new LineRiderEngine();
  engine = engine.setStart(
    track.startPosition ?? { x: 0, y: 0 },
    track.riders?.[0]?.startVelocity ?? { x: 0.4, y: 0 },
  );
  const converted = lines.map(createLineFromJson);
  if (converted.length > 0) engine = engine.addLine(converted);

  const rider = getRiderMetered(engine, frame);
  const pos = rider.position ?? { x: NaN, y: NaN };
  const vel = rider.velocity ?? { x: 0, y: 0 };
  const speed = Math.hypot(vel.x, vel.y);

  let broken = false;
  let ejected = false;
  try {
    broken = rider.get?.("SLED_INTACT")?.isBinded?.() === false;
    ejected = rider.get?.("RIDER_MOUNTED")?.isBinded?.() === false;
  } catch { /* treat as intact */ }

  // Sled pose: TAIL→NOSE vector (point order PEG, TAIL, NOSE, STRING).
  let sledAngleDeg: number | null = null;
  const pts = getSledPointPositionsMetered(engine, frame);
  if (pts.length >= 6) {
    const dx = pts[4] - pts[2];
    const dy = pts[5] - pts[3];
    if (dx !== 0 || dy !== 0) sledAngleDeg = Math.atan2(dy, dx) * DEG;
  }

  return {
    ok: !broken && !ejected && Number.isFinite(pos.x) && Number.isFinite(pos.y),
    broken, ejected,
    x: pos.x, y: pos.y,
    vx: vel.x, vy: vel.y,
    speed,
    comAngleDeg: speed > 0 ? Math.atan2(vel.y, vel.x) * DEG : 0,
    sledAngleDeg,
  };
}

type Row = {
  spec: string; seed: number; gapIndex: number;
  family: string; delta: number;
} & Outcome;

// ─────────── main ───────────

const rows: Row[] = [];
let sims = 0;
const yieldMaybe = async (): Promise<void> => {
  if (sims % 25 === 0) {
    (globalThis as { gc?: () => void }).gc?.();
    await new Promise((r) => setImmediate(r));
  }
};

for (const specName of specNames) {
  const spec = await loadGoldenSpec(specName, "base");
  for (const seed of seeds) {
    const t0 = Date.now();
    const checkpoint = compileHandoff(spec, seed, { budget });
    const track = checkpoint.track as TrackJson;
    const report = checkpoint.report;
    const lines = track.lines ?? [];
    const groups = chainArcGroups(lines);

    // Same pairing rule as analysis/geometry.ts: a group starting at/before
    // startPosition.x is the start support; require a confident count match.
    const nContacts = report.contacts.length;
    const startX = track.startPosition?.x ?? 0;
    const hasStartArc = groups.length > 0 && groups[0][0].x1 <= startX;
    const offset = hasStartArc ? 1 : 0;
    const confident = groups.length === nContacts + offset;
    if (!confident) {
      console.error(`  ${specName}/s${seed}: arc pairing not confident (${groups.length} arcs vs ${nContacts} contacts) — skipped`);
      continue;
    }

    const frameOfGap = new Map<number, number>();
    for (const g of report.gaps) {
      if (g.t_end !== undefined && g.t_end !== null) frameOfGap.set(g.gap_index, Math.round(g.t_end * FPS));
    }

    let gapsDone = 0;
    for (let k = 0; k + 1 < nContacts && gapsDone < maxGapsPerTrack; k++) {
      const nextFrame = frameOfGap.get(k + 1);
      if (nextFrame === undefined) continue;
      const arcK = groups[offset + k];
      // Generation fidelity: when gap k's arc is chosen, later arcs do not
      // exist — the prefix is everything up to and including arc k.
      const before = groups.slice(0, offset + k).flat();

      const baseline = measure(track, [...before, ...arcK], nextFrame);
      sims++;
      await yieldMaybe();
      if (!baseline.ok) continue; // truncated prefix doesn't survive to k+1: not a usable study point
      rows.push({ spec: specName, seed, gapIndex: k, family: "baseline", delta: 0, ...baseline });

      for (const fam of FAMILIES) {
        for (const delta of fam.deltas) {
          const perturbed = fam.apply(arcK, delta);
          if (perturbed === null) continue;
          const out = measure(track, [...before, ...perturbed], nextFrame);
          sims++;
          rows.push({ spec: specName, seed, gapIndex: k, family: fam.name, delta, ...out });
          await yieldMaybe();
        }
      }
      gapsDone++;
    }
    console.error(
      `  ${specName}/s${seed}: ${gapsDone} gaps, ${sims} sims total, ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  }
}

// ─────────── analysis ───────────

const median = (xs: number[]): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const f2 = (x: number): string => (Number.isFinite(x) ? x.toFixed(2) : "n/a");
const pct = (x: number): string => (Number.isFinite(x) ? `${(100 * x).toFixed(0)}%` : "n/a");

type OutcomeKey = "comAngleDeg" | "speed" | "sledAngleDeg" | "y";
const OUTCOMES: OutcomeKey[] = ["comAngleDeg", "speed", "sledAngleDeg", "y"];

console.log(`\n=== arc→next-state sensitivity (budget ${budget}, ${specNames.length} specs × seeds ${seeds.join(",")}) ===`);
console.log(`rows: ${rows.length} (${sims} simulations)\n`);

const gapKey = (r: Row): string => `${r.spec}|${r.seed}|${r.gapIndex}`;
const baselines = new Map<string, Row>();
for (const r of rows) if (r.family === "baseline") baselines.set(gapKey(r), r);

for (const fam of FAMILIES) {
  console.log(`family ${fam.name} (sweep ±${Math.max(...fam.deltas.map(Math.abs))}${fam.unit}):`);
  const byGap = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.family !== fam.name) continue;
    const arr = byGap.get(gapKey(r)) ?? [];
    arr.push(r);
    byGap.set(gapKey(r), arr);
  }

  // survival across the whole sweep
  const survRates: number[] = [];
  for (const rs of byGap.values()) survRates.push(rs.filter((r) => r.ok).length / rs.length);
  console.log(`  gaps swept ${byGap.size} · median sweep survival ${pct(median(survRates))}`);

  console.log("  outcome        range(med)  interpErr(med)  err/range  monotonic  sens/unit(med)");
  for (const key of OUTCOMES) {
    const ranges: number[] = [];
    const interpErrs: number[] = [];
    const monoFracs: number[] = [];
    const sensitivities: number[] = [];
    for (const [gk, rs] of byGap.entries()) {
      const base = baselines.get(gk);
      if (base === undefined) continue;
      const points = [...rs, { ...base, delta: 0 }]
        .filter((r) => r.ok && r[key] !== null && Number.isFinite(r[key] as number))
        .map((r) => ({ d: r.delta, v: r[key] as number }))
        .sort((a, b) => a.d - b.d);
      if (points.length < 3) continue;
      const vals = points.map((p) => p.v);
      ranges.push(Math.max(...vals) - Math.min(...vals));
      // secant test: predict each interior point from its two neighbors
      for (let i = 1; i + 1 < points.length; i++) {
        const lo = points[i - 1];
        const hi = points[i + 1];
        const t = (points[i].d - lo.d) / (hi.d - lo.d);
        interpErrs.push(Math.abs(lo.v + t * (hi.v - lo.v) - points[i].v));
      }
      // monotonicity: majority sign agreement of consecutive diffs
      const signs = [];
      for (let i = 1; i < points.length; i++) signs.push(Math.sign(points[i].v - points[i - 1].v));
      const pos = signs.filter((s) => s > 0).length;
      const neg = signs.filter((s) => s < 0).length;
      monoFracs.push(signs.length > 0 ? Math.max(pos, neg) / signs.length : NaN);
      // sensitivity near 0: smallest |delta| vs baseline
      const baseV = base[key];
      if (baseV !== null && Number.isFinite(baseV as number)) {
        const nearest = points.filter((p) => p.d !== 0).sort((a, b) => Math.abs(a.d) - Math.abs(b.d))[0];
        if (nearest !== undefined) sensitivities.push((nearest.v - (baseV as number)) / nearest.d);
      }
    }
    const r = median(ranges);
    const e = median(interpErrs);
    console.log(
      `  ${key.padEnd(13)} ${f2(r).padStart(9)} ${f2(e).padStart(13)} ${f2(e / r).padStart(10)} ` +
        `${pct(median(monoFracs)).padStart(9)} ${f2(median(sensitivities)).padStart(13)}`,
    );
  }
  console.log();
}

if (outPath !== undefined) {
  writeFileSync(outPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`per-variant rows → ${outPath}`);
}
