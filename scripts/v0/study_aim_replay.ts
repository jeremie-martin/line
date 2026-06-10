/**
 * V1 aim-replay study (docs/ARC_STATE_CONTROL.md roadmap) — read-only.
 *
 * V0 showed the arc→next-state map is locally smooth (open loop). V1 closes
 * the loop offline: on committed tracks, AIM at concrete targets with the
 * 3-probe model and verify against production-faithful gate semantics.
 *
 * Per gap k of each compiled track (prefix = arcs ≤ k, generation fidelity):
 *   1. probe exit_pitch δ ∈ {−10, 0, +10}, read state at gap k+1's frame
 *   2. fit a quadratic per outcome (arrival angle, speed)
 *   3. solve δ* for each aim task:
 *        steep:  arrival angle → max(baseline+4°, 12°)   [dive-scoop precondition]
 *        speed+: arrival speed → baseline + 0.5 px/f
 *        speed−: arrival speed → baseline − 0.5 px/f
 *      (δ* clamped to ±10; "clamped" = target beyond authority)
 *   4. apply δ*, simulate, and measure:
 *        - model error   |achieved − predicted(δ*)|  (can the model aim?)
 *        - request error |achieved − requested|      (incl. authority limits)
 *        - gate compliance, production semantics: gap k landing within ±1
 *          frame of its beat (candidate.ts hard gate 2), off-beat landings
 *          via countOffBeatLandings (tol 1), survival flags at k+1
 *        - side-effects on gap k: landing frame shift, landing speed delta
 *
 *   LR_ENGINE=wasm node --expose-gc --no-warnings=ExperimentalWarning --import tsx \
 *     scripts/v0/study_aim_replay.ts [--specs=..] [--seeds=0,1] [--budget=300000] \
 *     [--out=path.jsonl]
 */
import { writeFileSync } from "node:fs";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import {
  detect,
  extractRawTrajectory,
  getRiderMetered,
  getSledPointPositionsMetered,
} from "../lib/detector.ts";
import { countOffBeatLandings } from "./core/candidate.ts";
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
for (const s of specNames) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(s)) {
    console.error(`unknown spec "${s}"`);
    process.exit(1);
  }
}

const DEG = 180 / Math.PI;
const PROBE_DELTAS = [-10, 0, 10];
const DELTA_MAX = 10;

type Line = {
  id: number; type: number; x1: number; y1: number; x2: number; y2: number;
  flipped?: boolean; leftExtended?: boolean; rightExtended?: boolean;
};
type TrackJson = {
  startPosition?: { x: number; y: number };
  riders?: { startVelocity?: { x: number; y: number } }[];
  lines?: Line[];
};

// ─────────── arc grouping + exit-pitch (as validated in study_arc_sensitivity) ───────────

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

function perturbExitPitch(arc: Line[], deg: number): Line[] {
  if (deg === 0) return arc;
  const m = Math.max(1, Math.ceil(arc.length / 3));
  const head = arc.slice(0, arc.length - m);
  const tail = arc.slice(arc.length - m);
  const pivot = { x: tail[0].x1, y: tail[0].y1 };
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const rot = (x: number, y: number): [number, number] => {
    const dx = x - pivot.x;
    const dy = y - pivot.y;
    return [pivot.x + dx * c - dy * s, pivot.y + dx * s + dy * c];
  };
  return [
    ...head,
    ...tail.map((l) => {
      const [x1, y1] = rot(l.x1, l.y1);
      const [x2, y2] = rot(l.x2, l.y2);
      return { ...l, x1, y1, x2, y2 };
    }),
  ];
}

// ─────────── simulation + production-faithful gate readout ───────────

type SimResult = {
  ok: boolean;
  speed: number;
  comAngleDeg: number;
  sledAngleDeg: number | null;
  /** Landing event nearest gap k's beat frame (null if none within ±1 — the
   *  production hard gate 2 would reject this geometry for gap k). */
  gapKLandingFrame: number | null;
  gapKLandingSpeed: number | null;
  offBeatLandings: number;
};

function simulate(
  track: TrackJson,
  lines: Line[],
  frameEnd: number,
  gapKBeat: number,
  windowStart: number,
  contactFrames: number[],
): SimResult {
  let engine = new LineRiderEngine();
  engine = engine.setStart(
    track.startPosition ?? { x: 0, y: 0 },
    track.riders?.[0]?.startVelocity ?? { x: 0.4, y: 0 },
  );
  const converted = lines.map(createLineFromJson);
  if (converted.length > 0) engine = engine.addLine(converted);

  const raw = extractRawTrajectory(engine, frameEnd + 2);
  const det = detect(raw);
  const events = det.events as { type: string; frame: number }[];
  const velocity = det.measurements.velocity as { x: number; y: number }[];

  // Hard gate 2 semantics: a landing event within ±1 frame of the beat.
  let gapKLandingFrame: number | null = null;
  for (const e of events) {
    if (e.type !== "landing") continue;
    if (Math.abs(e.frame - gapKBeat) <= 1) {
      if (gapKLandingFrame === null || Math.abs(e.frame - gapKBeat) < Math.abs(gapKLandingFrame - gapKBeat)) {
        gapKLandingFrame = e.frame;
      }
    }
  }
  const vIn = gapKLandingFrame !== null ? velocity[gapKLandingFrame - 1] ?? velocity[gapKLandingFrame] : null;

  const offBeat = countOffBeatLandings(
    // deno-lint-ignore no-explicit-any
    events as any,
    windowStart,
    frameEnd,
    contactFrames,
  );

  const rider = getRiderMetered(engine, frameEnd);
  const pos = rider.position ?? { x: NaN, y: NaN };
  const vel = rider.velocity ?? { x: 0, y: 0 };
  const speed = Math.hypot(vel.x, vel.y);
  let broken = false;
  let ejected = false;
  try {
    broken = rider.get?.("SLED_INTACT")?.isBinded?.() === false;
    ejected = rider.get?.("RIDER_MOUNTED")?.isBinded?.() === false;
  } catch { /* intact */ }
  let sledAngleDeg: number | null = null;
  const pts = getSledPointPositionsMetered(engine, frameEnd);
  if (pts.length >= 6 && (pts[4] !== pts[2] || pts[5] !== pts[3])) {
    sledAngleDeg = Math.atan2(pts[5] - pts[3], pts[4] - pts[2]) * DEG;
  }

  return {
    ok: !broken && !ejected && Number.isFinite(pos.x) && Number.isFinite(pos.y),
    speed,
    comAngleDeg: speed > 0 ? Math.atan2(vel.y, vel.x) * DEG : 0,
    sledAngleDeg,
    gapKLandingFrame,
    gapKLandingSpeed: vIn !== null && vIn !== undefined ? Math.hypot(vIn.x, vIn.y) : null,
    offBeatLandings: offBeat,
  };
}

// ─────────── quadratic model: fit 3 points, predict, invert by scan ───────────

function fitQuad(ds: number[], vs: number[]): (d: number) => number {
  // exact quadratic through 3 points (Lagrange)
  const [d0, d1, d2] = ds;
  const [v0, v1, v2] = vs;
  return (d: number) =>
    (v0 * (d - d1) * (d - d2)) / ((d0 - d1) * (d0 - d2)) +
    (v1 * (d - d0) * (d - d2)) / ((d1 - d0) * (d1 - d2)) +
    (v2 * (d - d0) * (d - d1)) / ((d2 - d0) * (d2 - d1));
}

function solveForTarget(model: (d: number) => number, target: number): { delta: number; clamped: boolean } {
  let best = -DELTA_MAX;
  let bestErr = Infinity;
  for (let d = -DELTA_MAX; d <= DELTA_MAX + 1e-9; d += 0.1) {
    const err = Math.abs(model(d) - target);
    if (err < bestErr) {
      bestErr = err;
      best = d;
    }
  }
  // clamped = the model says the target is not reachable inside the span
  const clamped = bestErr > 0.05 && (Math.abs(best) > DELTA_MAX - 0.11);
  return { delta: Math.round(best * 10) / 10, clamped };
}

// ─────────── main ───────────

type Row = {
  spec: string; seed: number; gapIndex: number; task: string;
  nextImpactTarget: number | null;
  baselineValue: number; requested: number; predicted: number; achieved: number | null;
  deltaStar: number; clamped: boolean;
  ok: boolean;
  gateLanding: boolean;      // gap k landing still within ±1 of beat
  gateOffBeat: boolean;      // no NEW off-beat landings vs baseline
  landingFrameShift: number | null;
  landingSpeedDelta: number | null;
};

const rows: Row[] = [];
let probeFails = 0;
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
    const groups = chainArcGroups(track.lines ?? []);
    const nContacts = report.contacts.length;
    const startX = track.startPosition?.x ?? 0;
    const offset = groups.length > 0 && groups[0][0].x1 <= startX ? 1 : 0;
    if (groups.length !== nContacts + offset) {
      console.error(`  ${specName}/s${seed}: arc pairing not confident — skipped`);
      continue;
    }

    const frameOfGap = new Map<number, number>();
    for (const g of report.gaps) {
      if (g.t_end !== undefined && g.t_end !== null) frameOfGap.set(g.gap_index, Math.round(g.t_end * FPS));
    }
    const impactTargetOfGap = new Map<number, number>();
    for (const g of report.gaps) {
      const t = g.axes?.impact?.target;
      if (t !== undefined && t !== null) impactTargetOfGap.set(g.gap_index, t);
    }
    const contactFrames = [...frameOfGap.values()].sort((a, b) => a - b);

    let gapsAimed = 0;
    for (let k = 0; k + 1 < nContacts; k++) {
      const beatK = frameOfGap.get(k);
      const frameNext = frameOfGap.get(k + 1);
      if (beatK === undefined || frameNext === undefined) continue;
      const windowStart = (frameOfGap.get(k - 1) ?? 0) + 2;
      const arcK = groups[offset + k];
      const before = groups.slice(0, offset + k).flat();
      const sim = (arc: Line[]): SimResult =>
        simulate(track, [...before, ...arc], frameNext, beatK, windowStart, contactFrames);

      // probes
      const probes: SimResult[] = [];
      let bad = false;
      for (const d of PROBE_DELTAS) {
        const r = sim(perturbExitPitch(arcK, d));
        sims++;
        await yieldMaybe();
        if (!r.ok) { bad = true; break; }
        probes.push(r);
      }
      if (bad) { probeFails++; continue; }
      const base = probes[PROBE_DELTAS.indexOf(0)];

      const angleModel = fitQuad(PROBE_DELTAS, probes.map((p) => p.comAngleDeg));
      const speedModel = fitQuad(PROBE_DELTAS, probes.map((p) => p.speed));

      const tasks: { task: string; model: (d: number) => number; baselineValue: number; requested: number; read: (r: SimResult) => number }[] = [
        {
          task: "steep",
          model: angleModel,
          baselineValue: base.comAngleDeg,
          requested: Math.max(base.comAngleDeg + 4, 12),
          read: (r) => r.comAngleDeg,
        },
        { task: "speed+", model: speedModel, baselineValue: base.speed, requested: base.speed + 0.5, read: (r) => r.speed },
        { task: "speed-", model: speedModel, baselineValue: base.speed, requested: base.speed - 0.5, read: (r) => r.speed },
      ];

      for (const t of tasks) {
        const { delta, clamped } = solveForTarget(t.model, t.requested);
        const predicted = t.model(delta);
        const out = sim(perturbExitPitch(arcK, delta));
        sims++;
        await yieldMaybe();
        rows.push({
          spec: specName, seed, gapIndex: k, task: t.task,
          nextImpactTarget: impactTargetOfGap.get(k + 1) ?? null,
          baselineValue: t.baselineValue,
          requested: t.requested,
          predicted,
          achieved: out.ok ? t.read(out) : null,
          deltaStar: delta, clamped,
          ok: out.ok,
          gateLanding: out.gapKLandingFrame !== null,
          gateOffBeat: out.offBeatLandings <= base.offBeatLandings,
          landingFrameShift:
            out.gapKLandingFrame !== null && base.gapKLandingFrame !== null
              ? out.gapKLandingFrame - base.gapKLandingFrame
              : null,
          landingSpeedDelta:
            out.gapKLandingSpeed !== null && base.gapKLandingSpeed !== null
              ? out.gapKLandingSpeed - base.gapKLandingSpeed
              : null,
        });
      }
      gapsAimed++;
    }
    console.error(
      `  ${specName}/s${seed}: ${gapsAimed} gaps aimed, ${sims} sims total, ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  }
}

// ─────────── report ───────────

const median = (xs: number[]): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const pctl = (xs: number[], p: number): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const f2 = (x: number): string => (Number.isFinite(x) ? x.toFixed(2) : "n/a");
const pc = (n: number, d: number): string => (d > 0 ? `${((100 * n) / d).toFixed(0)}%` : "n/a");

console.log(`\n=== V1 aim-replay (budget ${budget}, ${specNames.length} specs × seeds ${seeds.join(",")}) ===`);
console.log(`aimed rows: ${rows.length} · probe failures (skipped gaps): ${probeFails}\n`);

for (const task of ["steep", "speed+", "speed-"]) {
  const rs = rows.filter((r) => r.task === task);
  if (rs.length === 0) continue;
  const okRs = rs.filter((r) => r.ok && r.achieved !== null);
  const modelErr = okRs.map((r) => Math.abs((r.achieved as number) - r.predicted));
  const reqErrUnclamped = okRs.filter((r) => !r.clamped).map((r) => Math.abs((r.achieved as number) - r.requested));
  const unit = task === "steep" ? "°" : "px/f";
  console.log(`task ${task} (n=${rs.length}, clamped-by-authority ${pc(rs.filter((r) => r.clamped).length, rs.length)}):`);
  console.log(
    `  survival ${pc(okRs.length, rs.length)}` +
      ` · model err p50 ${f2(median(modelErr))}${unit} p90 ${f2(pctl(modelErr, 0.9))}${unit}` +
      ` · request err (unclamped) p50 ${f2(median(reqErrUnclamped))}${unit} p90 ${f2(pctl(reqErrUnclamped, 0.9))}${unit}`,
  );
  console.log(
    `  gates: gap-k landing ±1f ${pc(okRs.filter((r) => r.gateLanding).length, okRs.length)}` +
      ` · no new off-beat ${pc(okRs.filter((r) => r.gateOffBeat).length, okRs.length)}` +
      ` · BOTH ${pc(okRs.filter((r) => r.gateLanding && r.gateOffBeat).length, okRs.length)}`,
  );
  const shifts = okRs.map((r) => r.landingFrameShift).filter((s): s is number => s !== null).map(Math.abs);
  const dspeed = okRs.map((r) => r.landingSpeedDelta).filter((s): s is number => s !== null).map(Math.abs);
  console.log(
    `  gap-k side-effects: |landing frame shift| p90 ${f2(pctl(shifts, 0.9))}f` +
      ` · |landing speed Δ| p90 ${f2(pctl(dspeed, 0.9))}px/f`,
  );
  if (task === "steep") {
    const impactRs = okRs.filter((r) => r.nextImpactTarget !== null && r.nextImpactTarget >= 0.3);
    const hit = impactRs.filter((r) => (r.achieved as number) >= 12 && r.gateLanding && r.gateOffBeat);
    console.log(
      `  impact-ask gaps (next target ≥0.3): ${impactRs.length}` +
        ` · reach ≥12° with both gates held: ${pc(hit.length, impactRs.length)}`,
    );
  }
  console.log();
}

if (outPath !== undefined) {
  writeFileSync(outPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`per-aim rows → ${outPath}`);
}
