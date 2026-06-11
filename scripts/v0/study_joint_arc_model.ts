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
 *     [--probe-design=grid9|cross5] [--eval-design=grid|random] \
 *     [--eval-samples=200] [--max-gaps=N] [--details=0] \
 *     [--loss-model=best|linear|additive_quadratic|joint_quadratic|surface|hybrid] \
 *     [--out=path.jsonl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import {
  axisLookaheadEndFrame,
  setCandidateCompileBudgetFrames,
} from "./core/candidate.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import {
  AXES,
  FPS,
  type AxisValues,
  type Gap,
  type TrackLine,
} from "./types.ts";
import {
  ARC_RESPONSE_MODEL_NAMES,
  arcKnobGrid,
  arcKnobKey,
  arcProbeDesign,
  dedupeArcKnobs,
  fitJointArcResponseModel,
  isArcAngleOutput,
  normalizeAngleDeg,
  parseArcProbeDesignName,
  predictJointArcOutputs,
  unwrapAngleAround,
  type ArcKnobs,
  type JointArcProbeRow,
  type JointArcResponseContext,
} from "./optimizer/arc_model.ts";
import { evaluateJointArcKnobs } from "./optimizer/arc_probe.ts";
import { compileHandoff } from "./optimizer/handoff.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const DEFAULT_SPECS = "dense_echo_climb,cold_start,climb_terrace,rolling_drop,verse_chorus,drums_dropout";
const specNames = (argValue("specs") ?? DEFAULT_SPECS).split(",").filter(Boolean) as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0,1").split(",").filter(Boolean).map(Number);
const budget = Number(argValue("budget") ?? "300000");
const probeDesignName = parseArcProbeDesignName(argValue("probe-design") ?? "grid9");
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
  The response model is canonical: suffix-state/prefix-summary latents are fit
  and reduced through the same final-output reducer production uses.
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
  latentOutputs?: Record<string, number>;
  truthOutputs?: Record<string, number>;
  truthGate?: Gate;
  horizonFrame: number;
  suffixFrame: number | null;
  cleanAirborneSuffix: boolean | null;
  modelContext: JointArcResponseContext;
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
  normScale: number;
  nmae: number;
  np90: number;
  rangeNmae: number;
  rangeNp90: number;
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

const MODEL_SPECS = ARC_RESPONSE_MODEL_NAMES;

function evalDesign(name: string, groupKey: string, probeKeys: Set<string>): ArcKnobs[] {
  let out: ArcKnobs[];
  switch (name) {
    case "grid":
      out = arcKnobGrid([-10, -8, -6, -4, -2, -1, 0, 1, 2, 4, 6, 8, 10], [-3, -2, -1, 0, 1, 2, 3]);
      break;
    case "random":
      out = randomKnobs(groupKey, Math.max(0, evalSamples), 10, 3);
      break;
    default:
      throw new Error(`unknown --eval-design=${name}`);
  }
  return dedupeArcKnobs(out).filter((k) => !probeKeys.has(arcKnobKey(k)));
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
  const engine = mkEngine(track, before);
  const probe = evaluateJointArcKnobs(
    engine,
    arc,
    knobs,
    gap,
    contactFrames,
    axisMeasureEnd,
    nextFrame,
    { includeTruth: true },
  );

  return {
    spec,
    seed,
    gapIndex: gap.index,
    split,
    pitchDeg: knobs.pitchDeg,
    rotateDeg: knobs.rotateDeg,
    gate: probe.gate,
    outputs: probe.outputs,
    ...(probe.latentOutputs === undefined ? {} : { latentOutputs: probe.latentOutputs }),
    ...(probe.truth === undefined ? {} : {
      truthOutputs: probe.truth.outputs,
      truthGate: probe.truth.gate,
    }),
    horizonFrame: probe.horizonFrame,
    suffixFrame: probe.suffixFrame,
    cleanAirborneSuffix: probe.cleanAirborneSuffix,
    modelContext: { gap, axisMeasureEnd, nextFrame },
  };
}

const probeKnobs = arcProbeDesign(probeDesignName, {
  pitchSpan: probePitchSpanOverride,
  rotateSpan: probeRotateSpanOverride,
});
const probeKeys = new Set(probeKnobs.map(arcKnobKey));
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
  for (const row of rows) {
    for (const key of Object.keys(row.outputs)) keys.add(key);
    for (const key of Object.keys(row.truthOutputs ?? {})) keys.add(key);
  }
  return [...keys].sort();
}

function actualOutputs(row: SampleRow): Record<string, number> {
  return row.split === "eval" ? row.truthOutputs ?? row.outputs : row.outputs;
}

function actualOutput(row: SampleRow, output: string): number {
  return actualOutputs(row)[output];
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

function outputScaleFloor(output: string): number {
  if (output === "current.cost") return 3;
  if (output.startsWith("current.error.")) return 3;
  if (output === "next.x" || output === "next.y") return 1000;
  if (output === "next.vx" || output === "next.vy" || output === "next.speed") return 20;
  if (output === "next.comAngleDeg" || output === "next.sledPoseDeg") return 360;
  if (output === "next.sledPoseRateDegPerFrame") return 60;
  return 0;
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
  const outputStats = new Map<string, { ref: number; range: number }>();
  for (const output of keys) {
    const angle = isArcAngleOutput(output);
    const finiteRows = groupRows.filter((r) => Number.isFinite(actualOutput(r, output)));
    if (finiteRows.length === 0) continue;
    const ref = baseline === undefined || !Number.isFinite(actualOutput(baseline, output))
      ? actualOutput(finiteRows[0], output)
      : actualOutput(baseline, output);
    const values = finiteRows.map((r) => {
      const actual = actualOutput(r, output);
      return angle ? unwrapAngleAround(actual, ref) : actual;
    });
    const range = Math.max(...values) - Math.min(...values);
    for (const row of finiteRows) {
      const actual = actualOutput(row, output);
      addOutputActual(row.split, output, angle ? unwrapAngleAround(actual, ref) : actual);
    }
    outputStats.set(output, { ref, range });
  }

  const probeRows = groupRows
    .filter((r) => r.split === "probe")
    .map((r): JointArcProbeRow => ({
      knobs: { pitchDeg: r.pitchDeg, rotateDeg: r.rotateDeg },
      outputs: r.outputs,
      ...(r.latentOutputs === undefined ? {} : { latentOutputs: r.latentOutputs }),
    }));
  if (probeRows.length === 0) continue;
  const context = groupRows[0].modelContext;

  for (const modelName of MODEL_SPECS) {
    const model = fitJointArcResponseModel(probeRows, probeDesignName, modelName, { context });
    const predictions = new Map<SampleRow, Record<string, number>>();
    for (const row of groupRows) {
      predictions.set(row, predictJointArcOutputs(model, { pitchDeg: row.pitchDeg, rotateDeg: row.rotateDeg }));
    }

    for (const output of keys) {
      const stats = outputStats.get(output);
      if (stats === undefined) continue;
      const cov = coverageFor(modelName, output);
      cov.groupsWithOutput++;
      cov.groupsWithProbeRows++;
      let coveredEvalRows = 0;
      let fitted = false;
      const angle = isArcAngleOutput(output);
      for (const row of groupRows) {
        const actualRaw = actualOutput(row, output);
        if (!Number.isFinite(actualRaw)) continue;
        const pred = predictions.get(row)?.[output];
        if (typeof pred !== "number" || !Number.isFinite(pred)) continue;
        fitted = true;
        if (row.split === "eval") coveredEvalRows++;
        const actual = angle ? unwrapAngleAround(actualRaw, stats.ref) : actualRaw;
        const signed = angle ? normalizeAngleDeg(pred - actual) : pred - actual;
        addError(modelName, row.split, output, signed, stats.range);
      }
      if (fitted) cov.groupsFitted++;
      cov.evalRowsCovered += coveredEvalRows;
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
    const normScale = Math.max(range, outputScaleFloor(output));
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
      normScale,
      nmae: normScale > 1e-9 ? mean(abs) / normScale : 0,
      np90: normScale > 1e-9 ? pctl(abs, 0.9) / normScale : 0,
      rangeNmae: range > 1e-9 ? mean(abs) / range : 0,
      rangeNp90: range > 1e-9 ? pctl(abs, 0.9) / range : 0,
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

const NEXT_STATE_SUMMARY_OUTPUTS = [
  "next.x",
  "next.y",
  "next.vx",
  "next.vy",
  "next.speed",
  "next.comAngleDeg",
  "next.sledPoseDeg",
  "next.sledPoseRateDegPerFrame",
] as const;

function outputUnit(output: string): string {
  if (output === "next.x" || output === "next.y") return "px";
  if (output === "next.vx" || output === "next.vy") return "px/f";
  if (output === "next.speed") return "px/f";
  if (output === "next.comAngleDeg" || output === "next.sledPoseDeg") return "deg";
  if (output === "next.sledPoseRateDegPerFrame") return "deg/f";
  if (output.startsWith("current.axis.")) return "axis units";
  if (output.startsWith("current.error.")) return "axis units";
  if (output === "current.cost") return "cost";
  return "";
}

function selectedSummaryOutputs(metrics: MetricRow[], model: string): string[] {
  const available = new Set(
    metrics
      .filter((m) => m.split === "eval" && m.model === model)
      .map((m) => m.output),
  );
  return summaryOutputsForAvailable(available);
}

function summaryOutputsForAvailable(available: ReadonlySet<string>): string[] {
  const currentAxes = AXES.map((axis) => `current.axis.${axis}`);
  const currentErrors = AXES
    .map((axis) => `current.error.${axis}`)
    .filter((output) => available.has(output));
  return [
    ...currentAxes,
    ...currentErrors,
    "current.cost",
    ...NEXT_STATE_SUMMARY_OUTPUTS,
  ];
}

function printSelectedOutputSummary(metrics: MetricRow[], losses: LossRow[], requested: string): void {
  const selected = selectLoss(losses, requested);
  if (selected === null) return;

  console.log("\nSelected model output summary (held-out eval)");
  console.log("output group                           MAE        p90        unit");
  for (const output of selectedSummaryOutputs(metrics, selected.model)) {
    const metric = metrics.find((m) => m.split === "eval" && m.model === selected.model && m.output === output);
    console.log(
      `${output.padEnd(35)} ${fmt(metric?.mae ?? NaN).padStart(8)}` +
        ` ${fmt(metric?.p90 ?? NaN).padStart(10)}       ${outputUnit(output)}`,
    );
  }
}

type TruthBucket = "all" | "clean_suffix";
type TruthMetricRow = {
  bucket: TruthBucket;
  output: string;
  n: number;
  mae: number;
  p90: number;
};

function shortTruthMetricRows(sampleRows: SampleRow[]): TruthMetricRow[] {
  const samples = new Map<string, number[]>();
  const add = (bucket: TruthBucket, output: string, abs: number): void => {
    const key = `${bucket}\0${output}`;
    const xs = samples.get(key) ?? [];
    xs.push(abs);
    samples.set(key, xs);
  };

  for (const row of sampleRows) {
    if (row.split !== "eval" || row.truthOutputs === undefined) continue;
    const available = new Set([...Object.keys(row.outputs), ...Object.keys(row.truthOutputs)]);
    for (const output of summaryOutputsForAvailable(available)) {
      const pred = row.outputs[output];
      const actual = row.truthOutputs[output];
      if (!Number.isFinite(pred) || !Number.isFinite(actual)) continue;
      const signed = isArcAngleOutput(output) ? normalizeAngleDeg(pred - actual) : pred - actual;
      const abs = Math.abs(signed);
      add("all", output, abs);
      if (row.cleanAirborneSuffix === true) add("clean_suffix", output, abs);
    }
  }

  return [...samples.entries()]
    .map(([key, abs]) => {
      const [bucket, output] = key.split("\0") as [TruthBucket, string];
      return {
        bucket,
        output,
        n: abs.length,
        mae: mean(abs),
        p90: pctl(abs, 0.9),
      };
    })
    .sort((a, b) =>
      a.output.localeCompare(b.output) || a.bucket.localeCompare(b.bucket)
    );
}

function printShortTruthSummary(sampleRows: SampleRow[]): void {
  const evalRows = sampleRows.filter((row) => row.split === "eval" && row.truthOutputs !== undefined);
  const cleanRows = evalRows.filter((row) => row.cleanAirborneSuffix === true);
  const horizonFrames = evalRows.map((row) => row.horizonFrame);
  const suffixFrames = evalRows
    .map((row) => row.suffixFrame)
    .filter((frame): frame is number => frame !== null);
  const metrics = shortTruthMetricRows(sampleRows);
  console.log("\nShort-probe output vs full-sim truth (held-out eval)");
  console.log(
    `eval truth rows=${evalRows.length} clean_suffix=${cleanRows.length}` +
      ` mean_horizon=${fmt(mean(horizonFrames))}f mean_suffix=${fmt(mean(suffixFrames))}f`,
  );
  console.log("output group                        all MAE    all p90  clean MAE  clean p90  unit");
  const available = new Set(metrics.map((m) => m.output));
  for (const output of summaryOutputsForAvailable(available)) {
    const all = metrics.find((m) => m.bucket === "all" && m.output === output);
    const clean = metrics.find((m) => m.bucket === "clean_suffix" && m.output === output);
    console.log(
      `${output.padEnd(35)} ${fmt(all?.mae ?? NaN).padStart(7)}` +
        ` ${fmt(all?.p90 ?? NaN).padStart(10)}` +
        ` ${fmt(clean?.mae ?? NaN).padStart(10)}` +
        ` ${fmt(clean?.p90 ?? NaN).padStart(10)}  ${outputUnit(output)}`,
    );
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
console.log(
  `probe=${probeDesignName} (${probeKnobs.length} rows/gap)` +
    ` eval=${evalDesignName}${evalDesignName === "random" ? `(${evalSamples})` : ""}`,
);
console.log(`rows=${rows.length} sims=${sims} groups=${groups.size}`);
console.log(`skipped: pairing=${skippedPairing} no_targets=${skippedNoTargets} no_next=${skippedNoNext}`);
console.log("\nGate coverage");
for (const line of gateSummary(rows)) console.log(line);
console.log("\nModel error (held-out eval rows are the main read; nMAE/nP90 use max(held-out output range, output scale floor); range_nMAE/range_nP90 and local_nMAE/local_nP90 remain diagnostics)");
printLoss(losses, lossModelName);
printSelectedOutputSummary(metrics, losses, lossModelName);
printShortTruthSummary(rows);
printModelComparison(metrics);
printFitCoverageGaps();
if (showDetails) {
  console.log("output                              split model                  n      MAE     RMSE      p50      p90      p99    scale      nMAE    nP90 range_nMAE range_nP90 local_nMAE local_nP90");
  for (const m of metrics) {
    if (m.split !== "eval") continue;
    console.log(
      `${m.output.padEnd(35)} ${m.split.padEnd(5)} ${m.model.padEnd(18)} ${String(m.n).padStart(6)}` +
        ` ${fmt(m.mae).padStart(8)} ${fmt(m.rmse).padStart(8)} ${fmt(m.p50).padStart(8)}` +
        ` ${fmt(m.p90).padStart(8)} ${fmt(m.p99).padStart(8)} ${fmt(m.normScale).padStart(8)}` +
        ` ${fmt(m.nmae).padStart(8)} ${fmt(m.np90).padStart(8)}` +
        ` ${fmt(m.rangeNmae).padStart(10)} ${fmt(m.rangeNp90).padStart(10)}` +
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
