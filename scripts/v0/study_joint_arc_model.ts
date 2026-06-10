/**
 * Joint arc-knob local-regression study (read-only).
 *
 * For each committed current-gap arc, simulate a configurable probe design over
 * arc knobs, fit local regressions from knobs -> measured output vector, then
 * evaluate the fitted model on held-out simulated knob samples.
 *
 * Output vector:
 *   - current gap: targeted achieved axes, targeted axis errors, local cost,
 *     plus release diagnostics when measurable
 *   - next gap: rider arrival state at the next contact frame
 *
 * This studies the local model-construction problem only. It does not change
 * production search/ranking.
 *
 * Run both probe designs on the broader suite, with all confidently paired
 * gaps and 1000 held-out random samples:
 *
 *   npm run study:joint-arc -- \
 *     --specs=dense_echo_climb,cold_start,climb_terrace,rolling_drop,verse_chorus,drums_dropout \
 *     --seeds=0,1 --budget=300000 --max-gaps=0 \
 *     --probe-design=grid9 --eval-design=random --eval-samples=1000 --details=0
 *
 * Optimize: acceptance_loss = max(primary_loss_cross5, primary_loss_grid9).
 * Target <0.01, aspirational <0.005. Gate coverage and fit coverage gaps are
 * hard diagnostics; do not hide failures to improve the scalar.
 *
 * Full form:
 *
 *   npm run study:joint-arc -- \
 *     [--specs=a,b] [--seeds=0,1] [--budget=300000] \
 *     [--probe-design=grid9|cross5|grid15] [--eval-design=grid|random] \
 *     [--eval-samples=200] [--max-gaps=N] [--details=0] \
 *     [--loss-model=best|linear|additive_quadratic|joint_quadratic] \
 *     [--out=path.jsonl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import {
  detect,
  extractRawTrajectory,
  getRiderMetered,
  sledPoseDegFromRider,
} from "../lib/detector.ts";
import {
  axisCost,
  axisLookaheadEndFrame,
  countOffBeatLandings,
  releaseStateFrame,
  setCandidateCompileBudgetFrames,
} from "./core/candidate.ts";
import { measureGapAxes } from "./core/measure.ts";
import { contactLineIdsAt, speedAt, velocityAt } from "./core/substrate.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import {
  AXES,
  FPS,
  type AxisValues,
  type Gap,
  type TrackLine,
} from "./types.ts";
import {
  additiveQuadraticFeatures,
  applyArcKnobs,
  biquadraticFeatures,
  fitKnobSurfaceModel,
  fitLinearLeastSquares,
  jointQuadraticFeatures,
  predictKnobSurfaceModel,
  predictLinearModel,
  type ArcKnobs,
  type RiderArrivalState,
} from "./optimizer/arc_model.ts";
import { compileHandoff } from "./optimizer/handoff.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const DEFAULT_SPECS = "dense_echo_climb,cold_start,climb_terrace,rolling_drop,verse_chorus,drums_dropout";
const specNames = (argValue("specs") ?? DEFAULT_SPECS).split(",").filter(Boolean) as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0,1").split(",").filter(Boolean).map(Number);
const budget = Number(argValue("budget") ?? "300000");
const probeDesignName = argValue("probe-design") ?? "grid9";
const evalDesignName = argValue("eval-design") ?? "grid";
const evalSamples = Number(argValue("eval-samples") ?? "200");
const probePitchSpanOverride = argValue("probe-pitch-span") === undefined ? undefined : Number(argValue("probe-pitch-span"));
const probeRotateSpanOverride = argValue("probe-rotate-span") === undefined ? undefined : Number(argValue("probe-rotate-span"));
const maxGapsPerTrack = Number(argValue("max-gaps") ?? "0") || Infinity;
const showDetails = argValue("details") !== "0";
const lossModelName = argValue("loss-model") ?? "best";
const outPath = argValue("out");

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(`Joint arc local-regression study

Run both probe designs:
  npm run study:joint-arc -- --specs=dense_echo_climb,cold_start,climb_terrace,rolling_drop,verse_chorus,drums_dropout --seeds=0,1 --budget=300000 --max-gaps=0 --probe-design=cross5 --eval-design=random --eval-samples=1000 --details=0
  npm run study:joint-arc -- --specs=dense_echo_climb,cold_start,climb_terrace,rolling_drop,verse_chorus,drums_dropout --seeds=0,1 --budget=300000 --max-gaps=0 --probe-design=grid9  --eval-design=random --eval-samples=1000 --details=0

Single acceptance target:
  acceptance_loss = max(primary_loss_cross5, primary_loss_grid9)
  primary_loss = weighted held-out eval nMAE over current errors/cost and next rider state,
  plus missing-priority-output coverage penalty. Lower is better.
  Aim for acceptance_loss < 0.01; aspirational < 0.005.

Notes:
  --max-gaps limits gaps per compiled track; 0 means all confidently paired gaps.
  Gate coverage and fit coverage gaps are hard diagnostics, not successes to hide.
  Commit validated improvements that lower acceptance_loss without those regressions.`);
  process.exit(0);
}

for (const s of specNames) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(s)) {
    console.error(`unknown spec "${s}"`);
    process.exit(1);
  }
}
if (!Number.isFinite(budget) || budget <= 0) throw new Error(`invalid --budget=${budget}`);
if (!Number.isFinite(evalSamples) || evalSamples < 0) throw new Error(`invalid --eval-samples=${evalSamples}`);
if (probePitchSpanOverride !== undefined && (!Number.isFinite(probePitchSpanOverride) || probePitchSpanOverride <= 0)) {
  throw new Error(`invalid --probe-pitch-span=${probePitchSpanOverride}`);
}
if (probeRotateSpanOverride !== undefined && (!Number.isFinite(probeRotateSpanOverride) || probeRotateSpanOverride <= 0)) {
  throw new Error(`invalid --probe-rotate-span=${probeRotateSpanOverride}`);
}

setCandidateCompileBudgetFrames(budget);

type TrackJson = {
  duration?: number;
  startPosition?: { x: number; y: number };
  riders?: { startVelocity?: { x: number; y: number } }[];
  lines?: TrackLine[];
};

type Split = "probe" | "eval";
type Gate = {
  currentOk: boolean;
  survivedCurrent: boolean;
  landingOk: boolean;
  offBeatLandings: number;
  nextStateOk: boolean;
  terminusFrame: number;
  terminusReason: string;
};
type SampleRow = {
  spec: string;
  seed: number;
  gapIndex: number;
  split: Split;
  pitchDeg: number;
  rotateDeg: number;
  gate: Gate;
  outputs: Record<string, number>;
};
type MetricRow = {
  model: string;
  split: Split;
  output: string;
  n: number;
  bias: number;
  mae: number;
  rmse: number;
  p50: number;
  p90: number;
  p99: number;
  max: number;
  nmae: number;
  np90: number;
  localNmae: number;
  localNp90: number;
};
type LossRow = {
  model: string;
  rawNmae: number;
  coverage: number;
  missingPenalty: number;
  primaryLoss: number;
  outputs: number;
};

type FittedStudyModel = {
  predict(knobs: ArcKnobs): number;
};
type StudyModelSpec = {
  name: string;
  fit(rows: Array<{ knobs: ArcKnobs; value: number }>, output: string): FittedStudyModel | null;
};

function linearStudyModel(name: string, features: (k: ArcKnobs) => number[]): StudyModelSpec {
  return {
    name,
    fit(rows) {
      const model = fitLinearLeastSquares(rows.map((row) => ({ features: features(row.knobs), value: row.value })));
      return model === null ? null : {
        predict: (knobs) => predictLinearModel(model, features(knobs)),
      };
    },
  };
}

const surfaceMinRows = probeDesignName === "grid9" ? 6 : 5;
const MODEL_SPECS: StudyModelSpec[] = [
  linearStudyModel("linear", (k) => [1, k.pitchDeg, k.rotateDeg]),
  linearStudyModel("additive_quadratic", additiveQuadraticFeatures),
  linearStudyModel("joint_quadratic", jointQuadraticFeatures),
  {
    name: "surface",
    fit(rows) {
      const model = fitKnobSurfaceModel(rows, surfaceMinRows);
      return model === null ? null : {
        predict: (knobs) => predictKnobSurfaceModel(model, knobs),
      };
    },
  },
  {
    name: "hybrid",
    fit(rows, output) {
      return fitHybridModel(rows, output);
    },
  },
];

function fitHybridModel(rows: Array<{ knobs: ArcKnobs; value: number }>, output: string): FittedStudyModel | null {
  if (hybridUsesSurface(output)) {
    const model = fitKnobSurfaceModel(rows, surfaceMinRows);
    return model === null ? null : {
      predict: (knobs) => predictKnobSurfaceModel(model, knobs),
    };
  }
  const features = hybridUsesBiquadratic(output) ? biquadraticFeatures :
    probeDesignName === "grid9" ? jointQuadraticFeatures : additiveQuadraticFeatures;
  const model = fitLinearLeastSquares(rows.map((row) => ({ features: features(row.knobs), value: row.value })));
  return model === null ? null : {
    predict: (knobs) => predictLinearModel(model, features(knobs)),
  };
}

function hybridUsesBiquadratic(output: string): boolean {
  return probeDesignName === "grid9" &&
    output.startsWith("next.") &&
    output !== "next.sledPoseDeg" &&
    output !== "next.sledPoseRateDegPerFrame";
}

function hybridUsesSurface(output: string): boolean {
  if (probeDesignName === "cross5") {
    return output === "current.error.air" ||
      output === "current.axis.air" ||
      output === "current.error.elevation" ||
      output === "current.axis.elevation" ||
      output === "current.error.impact" ||
      output === "current.axis.impact";
  }
  if (probeDesignName === "grid9") {
    return output === "current.error.air" ||
      output === "current.axis.air" ||
      output === "current.error.amplitude" ||
      output === "current.axis.amplitude" ||
      output === "current.error.elevation" ||
      output === "current.axis.elevation" ||
      output === "current.error.impact" ||
      output === "current.axis.impact" ||
      output === "next.sledPoseDeg" ||
      output === "next.sledPoseRateDegPerFrame";
  }
  return false;
}

function probeDesign(name: string): ArcKnobs[] {
  switch (name) {
    case "cross5": {
      const pitchSpan = probePitchSpanOverride ?? 8.5;
      const rotateSpan = probeRotateSpanOverride ?? 2.5;
      return [
        { pitchDeg: 0, rotateDeg: 0 },
        { pitchDeg: -pitchSpan, rotateDeg: 0 },
        { pitchDeg: pitchSpan, rotateDeg: 0 },
        { pitchDeg: 0, rotateDeg: -rotateSpan },
        { pitchDeg: 0, rotateDeg: rotateSpan },
      ];
    }
    case "grid9": {
      const pitchSpan = probePitchSpanOverride ?? 9;
      const rotateSpan = probeRotateSpanOverride ?? 3;
      return grid([-pitchSpan, 0, pitchSpan], [-rotateSpan, 0, rotateSpan]);
    }
    case "grid15":
      return grid([-6, -3, 0, 3, 6], [-3, 0, 3]);
    default:
      throw new Error(`unknown --probe-design=${name}`);
  }
}

function evalDesign(name: string, groupKey: string, probeKeys: Set<string>): ArcKnobs[] {
  let out: ArcKnobs[];
  switch (name) {
    case "grid":
      out = grid([-10, -8, -6, -4, -2, -1, 0, 1, 2, 4, 6, 8, 10], [-3, -2, -1, 0, 1, 2, 3]);
      break;
    case "random":
      out = randomKnobs(groupKey, Math.max(0, evalSamples), 10, 3);
      break;
    default:
      throw new Error(`unknown --eval-design=${name}`);
  }
  return dedupeKnobs(out).filter((k) => !probeKeys.has(knobKey(k)));
}

function grid(pitches: number[], rotates: number[]): ArcKnobs[] {
  const out: ArcKnobs[] = [];
  for (const pitchDeg of pitches) {
    for (const rotateDeg of rotates) out.push({ pitchDeg, rotateDeg });
  }
  return out;
}

function dedupeKnobs(knobs: ArcKnobs[]): ArcKnobs[] {
  const seen = new Set<string>();
  const out: ArcKnobs[] = [];
  for (const k of knobs) {
    const key = knobKey(k);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
}

function knobKey(k: ArcKnobs): string {
  return `${roundKey(k.pitchDeg)},${roundKey(k.rotateDeg)}`;
}

function roundKey(n: number): string {
  return n.toFixed(6);
}

function randomKnobs(key: string, count: number, pitchSpan: number, rotateSpan: number): ArcKnobs[] {
  const rand = mulberry32(hashString(key));
  const out: ArcKnobs[] = [{ pitchDeg: 0, rotateDeg: 0 }];
  for (let i = 0; i < count; i++) {
    out.push({
      pitchDeg: (rand() * 2 - 1) * pitchSpan,
      rotateDeg: (rand() * 2 - 1) * rotateSpan,
    });
  }
  return out;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chainArcGroups(lines: TrackLine[]): TrackLine[][] {
  const groups: TrackLine[][] = [];
  let current: TrackLine[] = [];
  for (const line of lines) {
    const prev = current[current.length - 1];
    if (prev !== undefined && line.x1 === prev.x2 && line.y1 === prev.y2) current.push(line);
    else {
      if (current.length > 0) groups.push(current);
      current = [line];
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function targetsFromGapReport(gapReport: { axes?: Record<string, { target?: number }> } | undefined): AxisValues {
  const targets: AxisValues = {};
  if (gapReport === undefined) return targets;
  for (const axis of AXES) {
    const target = gapReport.axes?.[axis]?.target;
    if (target !== undefined && Number.isFinite(target)) targets[axis] = target;
  }
  return targets;
}

function mkEngine(track: TrackJson, lines: TrackLine[]): any {
  let engine = new LineRiderEngine();
  engine = engine.setStart(
    track.startPosition ?? { x: 0, y: 0 },
    track.riders?.[0]?.startVelocity ?? { x: 0.4, y: 0 },
  );
  if (lines.length > 0) engine = engine.addLine(lines.map(createLineFromJson));
  return engine;
}

function riderUsable(rider: any): boolean {
  try {
    if (rider.get?.("SLED_INTACT")?.isBinded?.() === false) return false;
    if (rider.get?.("RIDER_MOUNTED")?.isBinded?.() === false) return false;
  } catch {
    // Treat unreadable flags as usable; this matches the existing probes.
  }
  return true;
}

function readArrivalState(engine: any, frame: number): RiderArrivalState | null {
  const rider = getRiderMetered(engine, frame);
  if (!riderUsable(rider)) return null;
  const pos = rider.position ?? { x: NaN, y: NaN };
  const v = rider.velocity ?? { x: NaN, y: NaN };
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(v.x) || !Number.isFinite(v.y)) {
    return null;
  }
  const speed = Math.hypot(v.x, v.y);
  const pose = sledPoseDegFromRider(rider);
  let poseRate: number | null = null;
  if (frame > 0 && pose !== null) {
    const prevPose = sledPoseDegFromRider(getRiderMetered(engine, frame - 1));
    if (prevPose !== null) poseRate = normalizeAngleDeg(pose - prevPose);
  }
  return {
    x: pos.x,
    y: pos.y,
    vx: v.x,
    vy: v.y,
    speed,
    comAngleDeg: speed > 0 ? Math.atan2(v.y, v.x) * 180 / Math.PI : null,
    sledPoseDeg: pose,
    sledPoseRateDegPerFrame: poseRate,
  };
}

function addFinite(outputs: Record<string, number>, key: string, value: number | null | undefined): void {
  if (value !== null && value !== undefined && Number.isFinite(value)) outputs[key] = value;
}

function stateOutputs(outputs: Record<string, number>, state: RiderArrivalState): void {
  addFinite(outputs, "next.x", state.x);
  addFinite(outputs, "next.y", state.y);
  addFinite(outputs, "next.vx", state.vx);
  addFinite(outputs, "next.vy", state.vy);
  addFinite(outputs, "next.speed", state.speed);
  addFinite(outputs, "next.comAngleDeg", state.comAngleDeg);
  addFinite(outputs, "next.sledPoseDeg", state.sledPoseDeg);
  addFinite(outputs, "next.sledPoseRateDegPerFrame", state.sledPoseRateDegPerFrame);
}

function evaluateKnobs(
  track: TrackJson,
  before: TrackLine[],
  arc: TrackLine[],
  gap: Gap,
  contactFrames: number[],
  axisMeasureEnd: number,
  nextFrame: number,
  split: Split,
  spec: string,
  seed: number,
  knobs: ArcKnobs,
): SampleRow {
  const modified = applyArcKnobs(arc, knobs);
  const engine = mkEngine(track, [...before, ...modified]);
  const horizon = Math.max(gap.endFrame + 20, axisMeasureEnd + 20, nextFrame + 2);
  const det = detect(extractRawTrajectory(engine, horizon));

  const minSurvival = Math.max(gap.endFrame + 16, axisMeasureEnd);
  const survivedCurrent = det.terminus.frame >= minSurvival || det.terminus.reason === "endOfSpec";
  const owned = new Set(modified.map((l) => l.id));
  const landingOk = det.events.some((e) =>
    e.type === "landing" &&
    Math.abs(e.frame - gap.endFrame) <= 1 &&
    contactLineIdsAt(det, e.frame).some((id) => owned.has(id))
  );
  const offBeatLandings = countOffBeatLandings(det.events, gap.startFrame, axisMeasureEnd, contactFrames);
  const currentOk = survivedCurrent && landingOk && offBeatLandings === 0;
  const nextStateOk = det.terminus.frame >= nextFrame || det.terminus.reason === "endOfSpec";

  const outputs: Record<string, number> = {};
  if (currentOk) {
    const achieved = measureGapAxes(det, gap, modified, axisMeasureEnd);
    addFinite(outputs, "current.cost", axisCost(gap.targets, achieved));
    for (const axis of AXES) {
      const target = gap.targets[axis];
      const actual = achieved[axis];
      if (target === undefined || actual === undefined) continue;
      addFinite(outputs, `current.axis.${axis}`, actual);
      addFinite(outputs, `current.error.${axis}`, actual - target);
    }

    const releaseFrame = releaseStateFrame(gap, contactFrames);
    addFinite(outputs, "current.releaseSpeedPx", speedAt(det, releaseFrame));
    addFinite(outputs, "current.releaseVy", velocityAt(det, releaseFrame)?.y);
  }

  if (nextStateOk) {
    const state = readArrivalState(engine, nextFrame);
    if (state !== null) stateOutputs(outputs, state);
  }

  return {
    spec,
    seed,
    gapIndex: gap.index,
    split,
    pitchDeg: knobs.pitchDeg,
    rotateDeg: knobs.rotateDeg,
    gate: {
      currentOk,
      survivedCurrent,
      landingOk,
      offBeatLandings,
      nextStateOk,
      terminusFrame: det.terminus.frame,
      terminusReason: det.terminus.reason,
    },
    outputs,
  };
}

const probeKnobs = dedupeKnobs(probeDesign(probeDesignName));
const probeKeys = new Set(probeKnobs.map(knobKey));
const rows: SampleRow[] = [];
let sims = 0;
let skippedPairing = 0;
let skippedNoTargets = 0;
let skippedNoNext = 0;

async function yieldMaybe(): Promise<void> {
  sims++;
  if (sims % 50 === 0) {
    (globalThis as { gc?: () => void }).gc?.();
    await new Promise((res) => setImmediate(res));
  }
}

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
    const hasStartArc = groups.length > 0 && groups[0][0].x1 <= startX;
    const offset = hasStartArc ? 1 : 0;
    if (groups.length !== nContacts + offset) {
      skippedPairing++;
      console.error(
        `  ${specName}/s${seed}: arc pairing not confident (${groups.length} arcs vs ${nContacts} contacts) - skipped`,
      );
      continue;
    }

    const gapReports = new Map<number, { t_end: number; axes?: Record<string, { target?: number }> }>();
    for (const g of report.gaps) gapReports.set(g.gap_index, g);
    const frameOfGap = new Map<number, number>();
    for (const g of report.gaps) frameOfGap.set(g.gap_index, Math.round(g.t_end * FPS));
    const contactFrames = [...frameOfGap.values()].sort((a, b) => a - b);

    let gapsDone = 0;
    for (let k = 0; k + 1 < nContacts && gapsDone < maxGapsPerTrack; k++) {
      const currentFrame = frameOfGap.get(k);
      const nextFrame = frameOfGap.get(k + 1);
      if (currentFrame === undefined || nextFrame === undefined) {
        skippedNoNext++;
        continue;
      }
      const targets = targetsFromGapReport(gapReports.get(k));
      if (Object.keys(targets).length === 0) {
        skippedNoTargets++;
        continue;
      }
      const gap: Gap = {
        index: k,
        startFrame: frameOfGap.get(k - 1) ?? 0,
        endFrame: currentFrame,
        endsWithContact: true,
        targets,
      };
      const arc = groups[offset + k];
      const before = groups.slice(0, offset + k).flat();
      const axisMeasureEnd = axisLookaheadEndFrame(gap, contactFrames);
      const groupKey = `${specName}/s${seed}/g${k}`;
      const evalKnobs = evalDesign(evalDesignName, groupKey, probeKeys);

      for (const knobs of probeKnobs) {
        rows.push(evaluateKnobs(track, before, arc, gap, contactFrames, axisMeasureEnd, nextFrame, "probe", specName, seed, knobs));
        await yieldMaybe();
      }
      for (const knobs of evalKnobs) {
        rows.push(evaluateKnobs(track, before, arc, gap, contactFrames, axisMeasureEnd, nextFrame, "eval", specName, seed, knobs));
        await yieldMaybe();
      }
      gapsDone++;
    }
    console.error(
      `  ${specName}/s${seed} done: ${gapsDone} gaps, ${Date.now() - t0} ms, ${rows.length} rows total`,
    );
  }
}

function groupKey(row: SampleRow): string {
  return `${row.spec}\0${row.seed}\0${row.gapIndex}`;
}

function outputKeys(rows: SampleRow[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row.outputs)) keys.add(key);
  return [...keys].sort();
}

function isAngleOutput(key: string): boolean {
  return key === "next.comAngleDeg" || key === "next.sledPoseDeg";
}

function normalizeAngleDeg(x: number): number {
  let y = ((x + 180) % 360 + 360) % 360 - 180;
  if (y === -180) y = 180;
  return y;
}

function unwrapAround(value: number, ref: number): number {
  return ref + normalizeAngleDeg(value - ref);
}

type ErrorSample = { signed: number; abs: number; localNormalizedAbs: number };
type FitCoverage = {
  groupsWithOutput: number;
  groupsWithProbeRows: number;
  groupsFitted: number;
  evalRowsCovered: number;
};
const errorSamples = new Map<string, ErrorSample[]>();
const fitCoverage = new Map<string, FitCoverage>();
const outputActualSamples = new Map<string, number[]>();

function addError(model: string, split: Split, output: string, signed: number, range: number): void {
  const key = `${model}\0${split}\0${output}`;
  const xs = errorSamples.get(key) ?? [];
  const abs = Math.abs(signed);
  xs.push({ signed, abs, localNormalizedAbs: range > 1e-9 ? abs / range : 0 });
  errorSamples.set(key, xs);
}

function addOutputActual(split: Split, output: string, value: number): void {
  const key = `${split}\0${output}`;
  const xs = outputActualSamples.get(key) ?? [];
  xs.push(value);
  outputActualSamples.set(key, xs);
}

function outputRange(split: Split, output: string): number {
  const values = outputActualSamples.get(`${split}\0${output}`) ?? [];
  return values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
}

function coverageFor(model: string, output: string): FitCoverage {
  const key = `${model}\0${output}`;
  let cov = fitCoverage.get(key);
  if (cov === undefined) {
    cov = { groupsWithOutput: 0, groupsWithProbeRows: 0, groupsFitted: 0, evalRowsCovered: 0 };
    fitCoverage.set(key, cov);
  }
  return cov;
}

const groups = new Map<string, SampleRow[]>();
for (const row of rows) {
  const key = groupKey(row);
  const xs = groups.get(key) ?? [];
  xs.push(row);
  groups.set(key, xs);
}

for (const groupRows of groups.values()) {
  const keys = outputKeys(groupRows);
  const baseline = groupRows.find((r) => r.pitchDeg === 0 && r.rotateDeg === 0);
  for (const output of keys) {
    const angle = isAngleOutput(output);
    const finiteRows = groupRows.filter((r) => Number.isFinite(r.outputs[output]));
    if (finiteRows.length === 0) continue;
    const ref = baseline?.outputs[output] ?? finiteRows[0].outputs[output];
    const values = finiteRows.map((r) => angle ? unwrapAround(r.outputs[output], ref) : r.outputs[output]);
    const range = Math.max(...values) - Math.min(...values);
    for (const row of finiteRows) {
      addOutputActual(row.split, output, angle ? unwrapAround(row.outputs[output], ref) : row.outputs[output]);
    }

    const probeRows = groupRows
      .filter((r) => r.split === "probe" && Number.isFinite(r.outputs[output]))
      .map((r) => ({
        knobs: { pitchDeg: r.pitchDeg, rotateDeg: r.rotateDeg },
        value: angle ? unwrapAround(r.outputs[output], ref) : r.outputs[output],
      }));
    if (probeRows.length === 0) continue;
    const evalRowsForOutput = groupRows
      .filter((r) => r.split === "eval" && Number.isFinite(r.outputs[output]))
      .length;

    for (const modelSpec of MODEL_SPECS) {
      const cov = coverageFor(modelSpec.name, output);
      cov.groupsWithOutput++;
      cov.groupsWithProbeRows++;
      const fit = modelSpec.fit(probeRows, output);
      if (fit === null) continue;
      cov.groupsFitted++;
      cov.evalRowsCovered += evalRowsForOutput;
      for (const row of groupRows) {
        const actualRaw = row.outputs[output];
        if (!Number.isFinite(actualRaw)) continue;
        const actual = angle ? unwrapAround(actualRaw, ref) : actualRaw;
        const pred = fit.predict({ pitchDeg: row.pitchDeg, rotateDeg: row.rotateDeg });
        const signed = angle ? normalizeAngleDeg(pred - actual) : pred - actual;
        addError(modelSpec.name, row.split, output, signed, range);
      }
    }
  }
}

function pctl(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

function mean(xs: number[]): number {
  return xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function metricRows(): MetricRow[] {
  const metrics: MetricRow[] = [];
  for (const [key, xs] of errorSamples) {
    const [model, split, output] = key.split("\0") as [string, Split, string];
    const signed = xs.map((x) => x.signed);
    const abs = xs.map((x) => x.abs);
    const localNabs = xs.map((x) => x.localNormalizedAbs);
    const range = outputRange(split, output);
    metrics.push({
      model,
      split,
      output,
      n: xs.length,
      bias: mean(signed),
      mae: mean(abs),
      rmse: Math.sqrt(mean(xs.map((x) => x.signed * x.signed))),
      p50: pctl(abs, 0.5),
      p90: pctl(abs, 0.9),
      p99: pctl(abs, 0.99),
      max: Math.max(...abs),
      nmae: range > 1e-9 ? mean(abs) / range : 0,
      np90: range > 1e-9 ? pctl(abs, 0.9) / range : 0,
      localNmae: mean(localNabs),
      localNp90: pctl(localNabs, 0.9),
    });
  }
  return metrics.sort((a, b) =>
    a.output.localeCompare(b.output) || a.split.localeCompare(b.split) || a.model.localeCompare(b.model)
  );
}

function priorityWeight(output: string): number {
  if (output === "current.cost") return 2;
  if (output.startsWith("current.error.")) return output === "current.error.impact" ? 2 : 1;
  if (output.startsWith("next.")) return 1;
  return 0;
}

function lossRows(metrics: MetricRow[]): LossRow[] {
  const evalMetrics = metrics.filter((m) => m.split === "eval" && m.n > 0 && priorityWeight(m.output) > 0);
  const priorityOutputs = new Set(evalMetrics.map((m) => m.output));
  const totalWeight = [...priorityOutputs].reduce((sum, output) => sum + priorityWeight(output), 0);
  const byModel = new Map<string, MetricRow[]>();
  for (const m of evalMetrics) {
    const xs = byModel.get(m.model) ?? [];
    xs.push(m);
    byModel.set(m.model, xs);
  }
  const rows: LossRow[] = [];
  for (const [model, xs] of byModel) {
    let weighted = 0;
    let weight = 0;
    for (const m of xs) {
      const w = priorityWeight(m.output);
      weighted += w * m.nmae;
      weight += w;
    }
    const coverage = totalWeight > 0 ? weight / totalWeight : 0;
    const rawNmae = weight > 0 ? weighted / weight : Infinity;
    const missingPenalty = 1 - coverage;
    rows.push({
      model,
      rawNmae,
      coverage,
      missingPenalty,
      primaryLoss: rawNmae + missingPenalty,
      outputs: xs.length,
    });
  }
  return rows.sort((a, b) => a.primaryLoss - b.primaryLoss || a.model.localeCompare(b.model));
}

function selectLoss(losses: LossRow[], requested: string): LossRow | null {
  if (requested === "best") return losses[0] ?? null;
  return losses.find((row) => row.model === requested) ?? null;
}

function printLoss(losses: LossRow[], requested: string): void {
  const selected = selectLoss(losses, requested);
  console.log("\nPrimary loss target (lower is better)");
  console.log("model                  primary_loss  raw_nMAE  coverage  missing_penalty outputs");
  for (const row of losses) {
    const mark = selected !== null && row.model === selected.model ? "*" : " ";
    console.log(
      `${mark} ${row.model.padEnd(20)} ${fmt(row.primaryLoss).padStart(12)}` +
        ` ${fmt(row.rawNmae).padStart(9)} ${(100 * row.coverage).toFixed(1).padStart(8)}%` +
        ` ${fmt(row.missingPenalty).padStart(16)} ${String(row.outputs).padStart(7)}`,
    );
  }
  if (selected === null) {
    console.log(`requested --loss-model=${requested} has no fitted eval metrics`);
  } else {
    console.log(`selected primary_loss=${fmt(selected.primaryLoss)} model=${selected.model} (--loss-model=${requested})`);
  }
}

function printModelComparison(metrics: MetricRow[]): void {
  const evalMetrics = metrics.filter((m) => m.split === "eval" && m.n > 0);
  const byOutput = new Map<string, MetricRow[]>();
  for (const m of evalMetrics) {
    const xs = byOutput.get(m.output) ?? [];
    xs.push(m);
    byOutput.set(m.output, xs);
  }

  const wins = new Map<string, number>();
  for (const xs of byOutput.values()) {
    const best = [...xs].sort((a, b) => a.nmae - b.nmae || a.mae - b.mae)[0];
    wins.set(best.model, (wins.get(best.model) ?? 0) + 1);
  }
  const winText = [...wins.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([model, n]) => `${model}:${n}`)
    .join("  ");
  console.log(`\nEval model wins by lowest nMAE: ${winText || "none"}`);

  const deltas: Array<{ output: string; delta: number; add: MetricRow; joint: MetricRow }> = [];
  for (const [output, xs] of byOutput) {
    const add = xs.find((m) => m.model === "additive_quadratic");
    const joint = xs.find((m) => m.model === "joint_quadratic");
    if (add !== undefined && joint !== undefined) {
      deltas.push({ output, delta: add.nmae - joint.nmae, add, joint });
    }
  }
  deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (deltas.length > 0) {
    console.log("Largest joint-vs-additive nMAE deltas (positive = joint better)");
    for (const d of deltas.slice(0, 10)) {
      console.log(
        `  ${d.output.padEnd(35)} ${fmt(d.delta).padStart(8)} ` +
          `(add ${fmt(d.add.nmae)}, joint ${fmt(d.joint.nmae)})`,
      );
    }
  }
}

function printFitCoverageGaps(): void {
  const gaps = [...fitCoverage.entries()]
    .map(([key, cov]) => {
      const [model, output] = key.split("\0") as [string, string];
      return { model, output, ...cov };
    })
    .filter((c) => c.groupsFitted < c.groupsWithProbeRows)
    .sort((a, b) =>
      a.output.localeCompare(b.output) || a.model.localeCompare(b.model)
    );
  if (gaps.length === 0) return;
  console.log("\nFit coverage gaps (usually too few finite probe rows after gates)");
  console.log("output                              model              groups fitted/probed  eval rows covered");
  for (const g of gaps.slice(0, 30)) {
    console.log(
      `${g.output.padEnd(35)} ${g.model.padEnd(18)} ` +
        `${String(g.groupsFitted).padStart(3)}/${String(g.groupsWithProbeRows).padEnd(3)}` +
        `              ${String(g.evalRowsCovered).padStart(6)}`,
    );
  }
  if (gaps.length > 30) console.log(`  ... ${gaps.length - 30} more`);
}

function gateSummary(rows: SampleRow[]): string[] {
  const bySplit = new Map<Split, SampleRow[]>();
  for (const row of rows) {
    const xs = bySplit.get(row.split) ?? [];
    xs.push(row);
    bySplit.set(row.split, xs);
  }
  const lines: string[] = [];
  for (const split of ["probe", "eval"] as const) {
    const xs = bySplit.get(split) ?? [];
    const n = xs.length;
    const pct = (m: number): string => n === 0 ? "n/a" : `${(100 * m / n).toFixed(1)}%`;
    lines.push(
      `${split.padEnd(5)} rows ${String(n).padStart(6)}  current_ok ${pct(xs.filter((r) => r.gate.currentOk).length).padStart(6)}` +
        `  next_state_ok ${pct(xs.filter((r) => r.gate.nextStateOk).length).padStart(6)}`,
    );
  }
  return lines;
}

function fmt(x: number): string {
  if (!Number.isFinite(x)) return "n/a";
  const ax = Math.abs(x);
  if (ax >= 1000) return x.toFixed(1);
  if (ax >= 100) return x.toFixed(2);
  return x.toFixed(3);
}

const metrics = metricRows();
const losses = lossRows(metrics);

console.log(`\n=== joint arc local-regression study ===`);
console.log(`specs=${specNames.join(",")} seeds=${seeds.join(",")} budget=${budget}`);
console.log(`probe=${probeDesignName} (${probeKnobs.length} rows/gap) eval=${evalDesignName}${evalDesignName === "random" ? `(${evalSamples})` : ""}`);
console.log(`rows=${rows.length} sims=${sims} groups=${groups.size}`);
console.log(`skipped: pairing=${skippedPairing} no_targets=${skippedNoTargets} no_next=${skippedNoNext}`);
console.log("\nGate coverage");
for (const line of gateSummary(rows)) console.log(line);
console.log("\nModel error (held-out eval rows are the main read; nMAE/nP90 are normalized by held-out output range, local_nMAE/local_nP90 by each gap/output's knob-response range)");
printLoss(losses, lossModelName);
printModelComparison(metrics);
printFitCoverageGaps();
if (showDetails) {
  console.log("output                              split model                  n      MAE     RMSE      p50      p90      p99      nMAE    nP90 local_nMAE local_nP90");
  for (const m of metrics) {
    if (m.split !== "eval") continue;
    console.log(
      `${m.output.padEnd(35)} ${m.split.padEnd(5)} ${m.model.padEnd(18)} ${String(m.n).padStart(6)}` +
        ` ${fmt(m.mae).padStart(8)} ${fmt(m.rmse).padStart(8)} ${fmt(m.p50).padStart(8)}` +
        ` ${fmt(m.p90).padStart(8)} ${fmt(m.p99).padStart(8)} ${fmt(m.nmae).padStart(8)} ${fmt(m.np90).padStart(8)}` +
        ` ${fmt(m.localNmae).padStart(10)} ${fmt(m.localNp90).padStart(10)}`,
    );
  }
} else {
  console.log("details suppressed (--details=0); use --out for full metric rows");
}

if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  const lines = [
    JSON.stringify({
      kind: "config",
      specs: specNames,
      seeds,
      budget,
      probeDesign: probeDesignName,
      probeKnobs,
      evalDesign: evalDesignName,
      evalSamples,
      details: showDetails,
      lossModel: lossModelName,
      maxGapsPerTrack: Number.isFinite(maxGapsPerTrack) ? maxGapsPerTrack : null,
    }),
    ...rows.map((row) => JSON.stringify({ kind: "sample", ...row })),
    ...metrics.map((metric) => JSON.stringify({ kind: "metric", ...metric })),
    ...losses.map((loss) => JSON.stringify({ kind: "loss", ...loss })),
  ];
  writeFileSync(outPath, `${lines.join("\n")}\n`);
  console.log(`\nwrote ${outPath}`);
}
