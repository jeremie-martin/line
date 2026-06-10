/**
 * V2 score-smoothness study (docs/ARC_STATE_CONTROL.md roadmap) — read-only.
 *
 * V0/V1 established that next-gap STATE is smooth in arc perturbations and
 * aimable with 3 probes. V2 asks: are the SCORES smooth too? Per gap k we
 * sweep exit_pitch on the committed arc and, per variant, run the PRODUCTION
 * axis measurement on gap k itself:
 *
 *   achieved = measureGapAxes(det, gap, arcLines, axisLookaheadEndFrame(...))
 *   cost     = axisCost(targets, achieved)
 *
 * (real registry from core/measure.ts; gap = {startFrame, endFrame, targets}
 * with targets taken from the compile report — the same values the compiler
 * chased). Outcomes: each targeted axis's achieved value + the local cost,
 * analyzed exactly like V0 (secant local-linearity, monotonicity, 3-probe
 * held-out error, controllable range).
 *
 * If achieved axes are probe-predictable, aiming can target score directly —
 * which generalizes the aimer beyond impact to every axis.
 *
 *   LR_ENGINE=wasm node --expose-gc --no-warnings=ExperimentalWarning --import tsx \
 *     scripts/v0/study_score_smoothness.ts [--specs=..] [--seeds=0,1] \
 *     [--budget=300000] [--out=path.jsonl]
 */
import { writeFileSync } from "node:fs";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { detect, extractRawTrajectory } from "../lib/detector.ts";
import { axisCost, axisLookaheadEndFrame } from "./core/candidate.ts";
import { measureGapAxes } from "./core/measure.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { FPS, type AxisValues, type Gap, type TrackLine } from "./types.ts";

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

const SWEEP = [-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10];

type Line = {
  id: number; type: number; x1: number; y1: number; x2: number; y2: number;
  flipped?: boolean; leftExtended?: boolean; rightExtended?: boolean;
};
type TrackJson = {
  startPosition?: { x: number; y: number };
  riders?: { startVelocity?: { x: number; y: number } }[];
  lines?: Line[];
};

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
  return [
    ...head,
    ...tail.map((l) => {
      const r = (x: number, y: number): [number, number] => {
        const dx = x - pivot.x;
        const dy = y - pivot.y;
        return [pivot.x + dx * c - dy * s, pivot.y + dx * s + dy * c];
      };
      const [x1, y1] = r(l.x1, l.y1);
      const [x2, y2] = r(l.x2, l.y2);
      return { ...l, x1, y1, x2, y2 };
    }),
  ];
}

type Row = {
  spec: string; seed: number; gapIndex: number; delta: number;
  measured: boolean;
  achieved: AxisValues | null;
  cost: number | null;
  /** Gap k+1's achieved axes with the COMMITTED arc k+1 in place and arc k
   *  perturbed — the cross-gap score effect (this is where impact lives:
   *  exit pitch can't move gap k's own landing, but it changes the arrival
   *  into k+1's catch). */
  achievedNext: AxisValues | null;
  costNext: number | null;
};

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
    const groups = chainArcGroups(track.lines ?? []);
    const nContacts = report.contacts.length;
    const startX = track.startPosition?.x ?? 0;
    const offset = groups.length > 0 && groups[0][0].x1 <= startX ? 1 : 0;
    if (groups.length !== nContacts + offset) {
      console.error(`  ${specName}/s${seed}: arc pairing not confident — skipped`);
      continue;
    }

    const frameOfGap = new Map<number, number>();
    const targetsOfGap = new Map<number, AxisValues>();
    for (const g of report.gaps) {
      if (g.t_end !== undefined && g.t_end !== null) frameOfGap.set(g.gap_index, Math.round(g.t_end * FPS));
      const targets: AxisValues = {};
      for (const [axis, v] of Object.entries(g.axes ?? {})) {
        const t = (v as { target?: number } | undefined)?.target;
        if (t !== undefined && t !== null) (targets as Record<string, number>)[axis] = t;
      }
      targetsOfGap.set(g.gap_index, targets);
    }
    const contactFrames = [...frameOfGap.values()].sort((a, b) => a - b);

    let gapsDone = 0;
    for (let k = 0; k + 1 < nContacts; k++) {
      const beatK = frameOfGap.get(k);
      const targets = targetsOfGap.get(k);
      if (beatK === undefined || targets === undefined || Object.keys(targets).length === 0) continue;
      const startFrame = (frameOfGap.get(k - 1) ?? 0);
      // Minimal Gap view: measureGapAxes reads startFrame/endFrame/targets only.
      const pseudoGap = { index: k, startFrame, endFrame: beatK, targets } as unknown as Gap;
      const lookEnd = axisLookaheadEndFrame(pseudoGap, contactFrames);
      const arcK = groups[offset + k];
      const before = groups.slice(0, offset + k).flat();

      // Next-gap context: committed arc k+1 present (what generation at k+1
      // would measure given this arrival).
      const beatNext = frameOfGap.get(k + 1);
      const targetsNext = targetsOfGap.get(k + 1);
      const arcK1 = groups[offset + k + 1];
      const pseudoGapNext =
        beatNext !== undefined && targetsNext !== undefined && Object.keys(targetsNext).length > 0
          ? ({ index: k + 1, startFrame: beatK, endFrame: beatNext, targets: targetsNext } as unknown as Gap)
          : null;
      const lookEndNext = pseudoGapNext !== null ? axisLookaheadEndFrame(pseudoGapNext, contactFrames) : 0;

      for (const delta of SWEEP) {
        const arc = perturbExitPitch(arcK, delta);
        const mkEngine = (ls: Line[]): ReturnType<typeof LineRiderEngine.prototype.addLine> => {
          let engine = new LineRiderEngine();
          engine = engine.setStart(
            track.startPosition ?? { x: 0, y: 0 },
            track.riders?.[0]?.startVelocity ?? { x: 0.4, y: 0 },
          );
          return engine.addLine(ls.map(createLineFromJson));
        };
        sims++;
        let achieved: AxisValues | null = null;
        let cost: number | null = null;
        try {
          const det = detect(extractRawTrajectory(mkEngine([...before, ...arc]), lookEnd + 2));
          achieved = measureGapAxes(det, pseudoGap, arc as unknown as TrackLine[], lookEnd);
          cost = axisCost(targets, achieved);
        } catch { /* leave unmeasured */ }
        let achievedNext: AxisValues | null = null;
        let costNext: number | null = null;
        if (pseudoGapNext !== null && arcK1 !== undefined) {
          sims++;
          try {
            const detN = detect(extractRawTrajectory(mkEngine([...before, ...arc, ...arcK1]), lookEndNext + 2));
            achievedNext = measureGapAxes(detN, pseudoGapNext, arcK1 as unknown as TrackLine[], lookEndNext);
            costNext = axisCost(targetsNext as AxisValues, achievedNext);
          } catch { /* leave unmeasured */ }
        }
        rows.push({
          spec: specName, seed, gapIndex: k, delta,
          measured: achieved !== null, achieved, cost, achievedNext, costNext,
        });
        await yieldMaybe();
      }
      gapsDone++;
    }
    console.error(
      `  ${specName}/s${seed}: ${gapsDone} gaps swept, ${sims} sims total, ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  }
}

// ─────────── analysis (same metrics as V0, on axis-achieved + cost) ───────────

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
const f3 = (x: number): string => (Number.isFinite(x) ? x.toFixed(3) : "n/a");
const pc = (x: number): string => (Number.isFinite(x) ? `${(100 * x).toFixed(0)}%` : "n/a");

console.log(`\n=== V2 score smoothness (budget ${budget}, ${specNames.length} specs × seeds ${seeds.join(",")}) ===`);
console.log(`rows: ${rows.length} (${sims} simulations)\n`);

const byGap = new Map<string, Row[]>();
for (const r of rows) {
  const key = `${r.spec}|${r.seed}|${r.gapIndex}`;
  const arr = byGap.get(key) ?? [];
  arr.push(r);
  byGap.set(key, arr);
}

const AXIS_KEYS = [
  "air", "speed", "grain", "elevation", "amplitude", "impact", "__cost",
  "next.air", "next.speed", "next.elevation", "next.amplitude", "next.impact", "next.__cost",
];
console.log("outcome         gaps   range(med)  secantErr(med)  err/range  monotonic  3probeErr p50/p90");
for (const axis of AXIS_KEYS) {
  const ranges: number[] = [];
  const secErrs: number[] = [];
  const monos: number[] = [];
  const heldout: number[] = [];
  let nGaps = 0;
  for (const rs of byGap.values()) {
    const isNext = axis.startsWith("next.");
    const sub = isNext ? axis.slice(5) : axis;
    const pts = rs
      .filter((r) => r.measured)
      .map((r) => ({
        d: r.delta,
        v: sub === "__cost"
          ? (isNext ? r.costNext : r.cost)
          : (((isNext ? r.achievedNext : r.achieved) ?? {}) as Record<string, number | undefined>)[sub],
      }))
      .filter((p): p is { d: number; v: number } => p.v !== undefined && p.v !== null && Number.isFinite(p.v))
      .sort((a, b) => a.d - b.d);
    if (pts.length < 7) continue;
    nGaps++;
    const vals = pts.map((p) => p.v);
    const range = Math.max(...vals) - Math.min(...vals);
    ranges.push(range);
    const errs: number[] = [];
    for (let i = 1; i + 1 < pts.length; i++) {
      const t = (pts[i].d - pts[i - 1].d) / (pts[i + 1].d - pts[i - 1].d);
      errs.push(Math.abs(pts[i - 1].v + t * (pts[i + 1].v - pts[i - 1].v) - pts[i].v));
    }
    if (errs.length > 0) secErrs.push(median(errs));
    const signs: number[] = [];
    for (let i = 1; i < pts.length; i++) signs.push(Math.sign(pts[i].v - pts[i - 1].v));
    const pos = signs.filter((s) => s > 0).length;
    const neg = signs.filter((s) => s < 0).length;
    if (signs.length > 0) monos.push(Math.max(pos, neg) / signs.length);
    // 3-probe quadratic held-out (probes −10/0/+10)
    const probe = new Map(pts.map((p) => [p.d, p.v]));
    if (probe.has(-10) && probe.has(0) && probe.has(10)) {
      const [v0, v1, v2] = [probe.get(-10) as number, probe.get(0) as number, probe.get(10) as number];
      const model = (d: number) =>
        (v0 * d * (d - 10)) / 200 + (v1 * (d + 10) * (d - 10)) / -100 + (v2 * (d + 10) * d) / 200;
      for (const p of pts) {
        if (p.d === -10 || p.d === 0 || p.d === 10) continue;
        heldout.push(Math.abs(model(p.d) - p.v));
      }
    }
  }
  if (nGaps === 0) continue;
  const r = median(ranges);
  const e = median(secErrs);
  console.log(
    `${axis.padEnd(15)} ${String(nGaps).padStart(4)} ${f3(r).padStart(11)} ${f3(e).padStart(14)} ` +
      `${f3(e / r).padStart(10)} ${pc(median(monos)).padStart(9)} ${f3(median(heldout)).padStart(10)}/${f3(pctl(heldout, 0.9))}`,
  );
}
console.log("\n(axis units are normalized axis values; __cost is the local L2 candidate cost)");

if (outPath !== undefined) {
  writeFileSync(outPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`per-variant rows → ${outPath}`);
}
