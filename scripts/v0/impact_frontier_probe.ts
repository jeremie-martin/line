/**
 * Fixed, observation-only impact-frontier discovery probe.
 *
 * This is deliberately smaller than the V2 scope panel: six cross-regime
 * sources, two fixed seeds, V2 jolt, and the normal 500k budget.  It pairs an
 * end-to-end outcome with exact in-search pool observations.  The latter
 * answers a question the scalar score cannot: for an impact improvement at a
 * frozen prefix, how much speed, air, other-axis, or continuation cost does it
 * actually require in the CURRENT compiler?
 *
 * The case mix and seeds are constants, not command-line knobs.  This keeps
 * the command a repeatable discovery screen rather than a means of selecting
 * a favourable subset.  It is not a V2 evaluation and cannot promote a
 * change.
 *
 *   npm run impact-probe
 *   npm run impact-probe -- --out=generated/impact-probe/experiment.json
 *   LR_ENGINE=wasm node --import tsx scripts/v0/impact_frontier_probe.ts \
 *     [--out=FILE] [--reference=FILE] [--detail] [--batch=0|1|2|--aggregate]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import lowAir from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import countercurrent from "../../benchmark/v2/cases/normative/representative/countercurrent.ts";
import denseDialogueImpact from "../../benchmark/v2/cases/variants/representative/dense_dialogue_impact_contrast_10.ts";
import offgrid from "../../benchmark/v2/cases/normative/representative/offgrid_conversation.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { scoreDriftReport } from "./score.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import {
  compileHandoff,
  setHandoffPoolProbeHook,
  type HandoffPoolProbeCandidate,
  type HandoffPoolProbeRecord,
} from "./optimizer/handoff.ts";
import { FPS, type AxisName, type AxisValues, type Spec } from "./types.ts";

const BUDGET = 500_000;
const SEEDS = [28, 29] as const;
const SPEED_ALLOWANCES = [0, 0.025, 0.05, 0.1, 0.2] as const;
const AXIS_ORDER: readonly AxisName[] = ["impact", "speed", "air", "elevation"];

const CASES = [
  // Impact-demanding sources span the dense, representative, capability, and
  // development-music regimes.  The latter two prevent an apparent gain from
  // being only a short representative-score artifact.
  { id: "frontier_dense_recovery", role: "impact", regime: "capability_dense", spec: dense },
  { id: "dense_dialogue_impact_contrast_10", role: "impact", regime: "representative_dense", spec: denseDialogueImpact },
  { id: "countercurrent", role: "impact", regime: "representative", spec: countercurrent },
  { id: "believer_56_6s", role: "impact", regime: "development_music", spec: believer },
  // These remain deliberately ordinary guard cases: an impact experiment must
  // not buy its result by breaking difficult non-impact traversal demands.
  { id: "frontier_low_air_endurance_4s", role: "guard", regime: "capability_low_air", spec: lowAir },
  { id: "offgrid_conversation", role: "guard", regime: "representative_pickup", spec: offgrid },
] as const satisfies readonly { id: string; role: "impact" | "guard"; regime: string; spec: Spec }[];

const FIXED_CONFIG = {
  budget: BUDGET,
  seeds: [...SEEDS],
  joltMs: benchmarkPolicy.transform.joltMs,
  cases: CASES.map(({ id, role, regime }) => ({ id, role, regime })),
  speedErrorAllowances: [...SPEED_ALLOWANCES],
  poolPopulation: "exact forward-scored candidates at every impact+speed-authored prefix",
  selection: "minimum exact handoff score; no probe result changes compiler selection",
} as const;

type Role = typeof CASES[number]["role"];
type AxisErrors = Partial<Record<AxisName, number>>;
type CandidatePoint = {
  errors: AxisErrors;
  handoffScore: number;
  readiness: number | null;
  currentQuality: number;
  transition: TransitionState;
};
type TransitionState = {
  releaseVx: number | null;
  releaseVy: number | null;
  releaseSpeed: number | null;
  releaseGrounded: number | null;
  releaseAirborne: boolean | null;
  arrivalSpeed: number | null;
  arrivalAngleDeg: number | null;
  arrivalAir: number | null;
};
type TransitionDelta = {
  releaseVx: number | null;
  releaseVy: number | null;
  releaseSpeed: number | null;
  releaseGrounded: number | null;
  releaseAirborne: number | null;
  arrivalSpeed: number | null;
  arrivalAngleDeg: number | null;
  arrivalAir: number | null;
};
type TradeChoice = {
  impactGain: number;
  speedCost: number;
  airCost: number | null;
  elevationCost: number | null;
  handoffCost: number;
  readinessDelta: number | null;
  /** Exact repair-minus-selected kinematic states; observational only. */
  transition: TransitionDelta;
};
type PoolRow = {
  id: string;
  role: Role;
  regime: string;
  seed: number;
  gapIndex: number;
  authoredAxes: AxisName[];
  scoredCandidates: number;
  axisParetoCandidates: number;
  selectedOnAxisPareto: boolean;
  choices: Record<string, TradeChoice | null>;
};
type RunRow = {
  id: string;
  role: Role;
  regime: string;
  seed: number;
  valid: boolean;
  score: number;
  axis: Record<string, { n: number; rms: number; meanSigned: number }>;
  simFrames: number;
  elapsedMs: number;
};
type Aggregate = {
  runs: number;
  validRuns: number;
  scoreMean: number;
  axes: Record<string, { n: number; rms: number; meanSigned: number }>;
};
type FrontierAggregate = {
  pools: number;
  scoredCandidates: number;
  axisParetoCandidatesMean: number;
  selectedOnAxisParetoRate: number;
  speedAllowance: Record<string, {
    available: number;
    materialImpactRepairs: number;
    materialImpactRepairRate: number;
    impactGainMean: number;
    speedCostMean: number;
    airCostMean: number | null;
    elevationCostMean: number | null;
    handoffCostMean: number;
    readinessDeltaMean: number | null;
    transition: {
      samples: number;
      releaseVxDeltaMean: number | null;
      releaseVyDeltaMean: number | null;
      releaseSpeedDeltaMean: number | null;
      releaseGroundedDeltaMean: number | null;
      releaseAirborneDeltaMean: number | null;
      arrivalSpeedDeltaMean: number | null;
      arrivalAngleDegDeltaMean: number | null;
      arrivalAirDeltaMean: number | null;
    };
  }>;
};
type ProbeOutput = {
  schema: "line.impact-frontier-probe.v1";
  purpose: string;
  fixedConfig: typeof FIXED_CONFIG;
  execution: { compilerCandidateFingerprint: string; compilerSourceFingerprint: string; engine: string };
  runs: RunRow[];
  /** Per-prefix rows are intentionally opt-in: a complete panel has thousands. */
  pools?: PoolRow[];
  summary: { overall: Aggregate; impact: Aggregate; guard: Aggregate; frontier: FrontierAggregate };
  comparison?: unknown;
  batch?: { index: number; cases: string[] };
};

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: npm run impact-probe [-- --out=FILE] [-- --reference=FILE] [-- --detail] [-- --batch=0|1|2|--aggregate]\n" +
    "Runs the fixed 6-case × 2-seed impact-frontier discovery panel. --batch splits it into three immutable two-case batches; --aggregate verifies and combines those artifacts. It is descriptive only; V2 is the promotion gate.\n",
  );
  process.exit(0);
}
const value = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const outPath = value("out");
const referencePath = value("reference");
const detail = argv.includes("--detail");
const aggregateOnly = argv.includes("--aggregate");
const batchArgument = value("batch");
const unknown = argv.filter((arg) =>
  arg !== "--detail" && arg !== "--aggregate" && !arg.startsWith("--out=") && !arg.startsWith("--reference=") && !arg.startsWith("--batch=")
);
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);
if (aggregateOnly && batchArgument !== undefined) throw new Error("--aggregate cannot combine with --batch");
const BATCH_COUNT = 3;
const BATCH_CASE_COUNT = CASES.length / BATCH_COUNT;
const DEFAULT_BATCH_DIRECTORY = "generated/studies/impact-frontier-probe/v1";
if (!Number.isInteger(BATCH_CASE_COUNT)) throw new Error("fixed impact probe case count is not divisible into batches");
const batch = batchArgument === undefined ? undefined : Number(batchArgument);
if (batch !== undefined && (!Number.isSafeInteger(batch) || batch < 0 || batch >= BATCH_COUNT)) {
  throw new Error(`--batch must be an integer in 0..${BATCH_COUNT - 1}`);
}
if (aggregateOnly && detail) throw new Error("--aggregate reads the detail mode from its sealed batch artifacts; do not pass --detail");
if (aggregateOnly) {
  aggregateBatchArtifacts(outPath, referencePath);
  process.exit(0);
}
const ACTIVE_CASES = batch === undefined
  ? CASES
  : CASES.slice(batch * BATCH_CASE_COUNT, (batch + 1) * BATCH_CASE_COUNT);
if (referencePath !== undefined && batch !== undefined) {
  throw new Error("--reference is accepted only for the full fixed panel or --aggregate, never a partial batch");
}

let active: typeof CASES[number] = CASES[0];
let activeSeed: typeof SEEDS[number] = SEEDS[0];
const poolRows: PoolRow[] = [];
setHandoffPoolProbeHook((record) => observePool(record));

const runs: RunRow[] = [];
try {
  for (const definition of ACTIVE_CASES) {
    for (const seed of SEEDS) {
      active = definition;
      activeSeed = seed;
      const spec = applyJolt(definition.spec, benchmarkPolicy.transform.joltMs);
      const started = performance.now();
      const checkpoint = compileHandoff(spec, seed, { budget: BUDGET });
      const elapsedMs = Math.round(performance.now() - started);
      const score = scoreDriftReport(checkpoint.report, { totalFrames: Math.round(spec.duration * FPS) });
      const axis = summarizeAxes(checkpoint.report.gaps.map((gap) => gap.axes));
      runs.push({
        id: definition.id,
        role: definition.role,
        regime: definition.regime,
        seed,
        valid: score.contract_passed,
        score: round(score.score),
        axis,
        simFrames: checkpoint.stats.sim_frames,
        elapsedMs,
      });
      process.stderr.write(
        `${definition.id}/s${seed}: score=${round(score.score)} valid=${score.contract_passed} ` +
        `impactRms=${axis.impact?.rms ?? "-"} (${(elapsedMs / 1000).toFixed(1)}s)\n`,
      );
      (globalThis as { gc?: () => void }).gc?.();
    }
  }
} finally {
  setHandoffPoolProbeHook(null);
}

const compiler = compilerCandidateIdentity(process.env.LR_ENGINE ?? "wasm");
const output: ProbeOutput = {
  schema: "line.impact-frontier-probe.v1",
  purpose: "fixed, observation-only impact discovery screen; neither a compiler selection rule nor a V2 promotion result",
  fixedConfig: FIXED_CONFIG,
  execution: {
    compilerCandidateFingerprint: compiler.candidateFingerprint,
    compilerSourceFingerprint: compiler.compilerSourceFingerprint,
    engine: process.env.LR_ENGINE ?? "wasm",
  },
  runs,
  ...(detail ? { pools: poolRows } : {}),
  summary: {
    overall: summarizeRuns(runs),
    impact: summarizeRuns(runs.filter((row) => row.role === "impact")),
    guard: summarizeRuns(runs.filter((row) => row.role === "guard")),
    frontier: summarizeFrontier(poolRows),
  },
  ...(batch === undefined ? {} : { batch: { index: batch, cases: ACTIVE_CASES.map((definition) => definition.id) } }),
};
if (referencePath !== undefined) output.comparison = compareToReference(output, referencePath);

const json = `${JSON.stringify(output, null, 2)}\n`;
const resolvedOutPath = batch === undefined
  ? outPath
  : outPath ?? defaultBatchPath(batch);
if (resolvedOutPath === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(resolvedOutPath), { recursive: true });
  writeFileSync(resolvedOutPath, json);
  process.stdout.write(`${JSON.stringify({
    schema: output.schema,
    output: resolvedOutPath,
    batch: output.batch,
    summary: output.summary,
    comparison: output.comparison,
  }, null, 2)}\n`);
}

function defaultBatchPath(index: number): string {
  return `${DEFAULT_BATCH_DIRECTORY}/batch-${index}.json`;
}

/**
 * The probe's cohort is immutable. Batching is operational only: combine
 * exactly the three fixed two-case artifacts or fail before reporting a result.
 * An interrupted process can therefore never masquerade as a shorter panel.
 */
function aggregateBatchArtifacts(requestedOutPath: string | undefined, aggregateReferencePath: string | undefined): void {
  const aggregatePath = requestedOutPath ?? `${DEFAULT_BATCH_DIRECTORY}/result.json`;
  const batchDirectory = dirname(aggregatePath);
  const documents: ProbeOutput[] = [];
  for (let index = 0; index < BATCH_COUNT; index++) {
    const path = `${batchDirectory}/batch-${index}.json`;
    const document = JSON.parse(readFileSync(path, "utf8")) as ProbeOutput;
    const expectedCases = CASES.slice(index * BATCH_CASE_COUNT, (index + 1) * BATCH_CASE_COUNT).map((definition) => definition.id);
    if (
      document.schema !== "line.impact-frontier-probe.v1" ||
      JSON.stringify(document.fixedConfig) !== JSON.stringify(FIXED_CONFIG) ||
      document.batch?.index !== index ||
      JSON.stringify(document.batch.cases) !== JSON.stringify(expectedCases)
    ) {
      throw new Error(`batch artifact ${path} does not match fixed impact-probe batch ${index}`);
    }
    const expectedRuns = expectedCases.flatMap((id) => SEEDS.map((seed) => `${id}/s${seed}`)).sort();
    const actualRuns = document.runs.map((run) => `${run.id}/s${run.seed}`).sort();
    if (JSON.stringify(actualRuns) !== JSON.stringify(expectedRuns)) {
      throw new Error(`batch artifact ${path} has an incomplete or mismatched fixed run set`);
    }
    documents.push(document);
  }
  const first = documents[0]!;
  if (!documents.every((document) =>
    document.execution.compilerCandidateFingerprint === first.execution.compilerCandidateFingerprint &&
    document.execution.compilerSourceFingerprint === first.execution.compilerSourceFingerprint &&
    document.execution.engine === first.execution.engine
  )) {
    throw new Error("impact-probe batch artifacts were produced by different compiler identities or engines");
  }
  const detailModes = documents.map((document) => document.pools !== undefined);
  if (!detailModes.every((value) => value === detailModes[0])) {
    throw new Error("impact-probe batches mix --detail and non-detail artifacts");
  }
  const runs = documents.flatMap((document) => document.runs).sort((left, right) =>
    CASES.findIndex((definition) => definition.id === left.id) - CASES.findIndex((definition) => definition.id === right.id) ||
    left.seed - right.seed,
  );
  const pools = detailModes[0] ? documents.flatMap((document) => document.pools ?? []) : undefined;
  const aggregate: ProbeOutput = {
    schema: "line.impact-frontier-probe.v1",
    purpose: "fixed impact-frontier discovery panel aggregated from three complete immutable operational batches; neither selection nor V2 promotion evidence",
    fixedConfig: FIXED_CONFIG,
    execution: first.execution,
    runs,
    ...(pools === undefined ? {} : { pools }),
    summary: {
      overall: summarizeRuns(runs),
      impact: summarizeRuns(runs.filter((run) => run.role === "impact")),
      guard: summarizeRuns(runs.filter((run) => run.role === "guard")),
      frontier: summarizeFrontier(pools ?? []),
    },
  };
  if (aggregateReferencePath !== undefined) aggregate.comparison = compareToReference(aggregate, aggregateReferencePath);
  mkdirSync(dirname(aggregatePath), { recursive: true });
  writeFileSync(aggregatePath, `${JSON.stringify(aggregate, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    schema: aggregate.schema,
    output: aggregatePath,
    batches: BATCH_COUNT,
    detail: detailModes[0],
    summary: aggregate.summary,
    comparison: aggregate.comparison,
  }, null, 2)}\n`);
}

function observePool(record: HandoffPoolProbeRecord): void {
  const authoredAxes = AXIS_ORDER.filter((axis) => finite(record.targets[axis]));
  if (!authoredAxes.includes("impact") || !authoredAxes.includes("speed")) return;
  const points = record.candidates.flatMap((candidate) => candidatePoint(candidate, record.targets, authoredAxes));
  if (points.length === 0) return;
  const selected = minBy(points, (point) => point.handoffScore);
  const axisPareto = points.filter((point) => !points.some((other) => dominates(other, point, authoredAxes)));
  const choices: Record<string, TradeChoice | null> = {};
  for (const allowance of SPEED_ALLOWANCES) {
    const pick = points
      .filter((point) => (point.errors.speed ?? Infinity) <= (selected.errors.speed ?? Infinity) + allowance + 1e-12)
      .sort((a, b) => (a.errors.impact ?? Infinity) - (b.errors.impact ?? Infinity) || a.handoffScore - b.handoffScore)[0];
    choices[String(allowance)] = pick === undefined ? null : tradeChoice(selected, pick);
  }
  poolRows.push({
    id: active.id,
    role: active.role,
    regime: active.regime,
    seed: activeSeed,
    gapIndex: record.gapIndex,
    authoredAxes,
    scoredCandidates: points.length,
    axisParetoCandidates: axisPareto.length,
    selectedOnAxisPareto: axisPareto.includes(selected),
    choices,
  });
}

function candidatePoint(
  candidate: HandoffPoolProbeCandidate,
  targets: AxisValues,
  axes: readonly AxisName[],
): CandidatePoint[] {
  if (!finite(candidate.handoffScore)) return [];
  const achieved = candidate.achievedAtEnd ?? candidate.achieved;
  const errors: AxisErrors = {};
  for (const axis of axes) {
    const target = targets[axis];
    const value = achieved[axis];
    if (!finite(target) || !finite(value)) return [];
    errors[axis] = Math.abs(value - target);
  }
  return [{
    errors,
    handoffScore: candidate.handoffScore,
    readiness: finite(candidate.readiness) ? candidate.readiness : null,
    currentQuality: candidate.currentQuality,
    transition: {
      releaseVx: finite(candidate.releaseVx) ? candidate.releaseVx : null,
      releaseVy: finite(candidate.releaseVy) ? candidate.releaseVy : null,
      releaseSpeed: finite(candidate.releaseSpeed) ? candidate.releaseSpeed : null,
      releaseGrounded: finite(candidate.releaseGrounded) ? candidate.releaseGrounded : null,
      releaseAirborne: typeof candidate.releaseAirborne === "boolean" ? candidate.releaseAirborne : null,
      arrivalSpeed: finite(candidate.arrivalSpeed) ? candidate.arrivalSpeed : null,
      arrivalAngleDeg: finite(candidate.arrivalAngleDeg) ? candidate.arrivalAngleDeg : null,
      arrivalAir: finite(candidate.arrivalAir) ? candidate.arrivalAir : null,
    },
  }];
}

function dominates(a: CandidatePoint, b: CandidatePoint, axes: readonly AxisName[]): boolean {
  let strictlyBetter = false;
  for (const axis of axes) {
    const ae = a.errors[axis] ?? Infinity;
    const be = b.errors[axis] ?? Infinity;
    if (ae > be + 1e-12) return false;
    if (ae < be - 1e-12) strictlyBetter = true;
  }
  return strictlyBetter;
}

function tradeChoice(selected: CandidatePoint, pick: CandidatePoint): TradeChoice {
  const delta = (axis: AxisName): number | null => {
    const baseline = selected.errors[axis];
    const chosen = pick.errors[axis];
    return baseline === undefined || chosen === undefined ? null : round(chosen - baseline);
  };
  return {
    impactGain: round((selected.errors.impact ?? 0) - (pick.errors.impact ?? 0)),
    speedCost: delta("speed") ?? 0,
    airCost: delta("air"),
    elevationCost: delta("elevation"),
    handoffCost: round(pick.handoffScore - selected.handoffScore),
    readinessDelta: selected.readiness === null || pick.readiness === null
      ? null
      : round(pick.readiness - selected.readiness),
    transition: transitionDelta(selected.transition, pick.transition),
  };
}

function transitionDelta(selected: TransitionState, repair: TransitionState): TransitionDelta {
  const difference = (before: number | null, after: number | null): number | null =>
    before === null || after === null ? null : round(after - before);
  return {
    releaseVx: difference(selected.releaseVx, repair.releaseVx),
    releaseVy: difference(selected.releaseVy, repair.releaseVy),
    releaseSpeed: difference(selected.releaseSpeed, repair.releaseSpeed),
    releaseGrounded: difference(selected.releaseGrounded, repair.releaseGrounded),
    releaseAirborne: selected.releaseAirborne === null || repair.releaseAirborne === null
      ? null
      : Number(repair.releaseAirborne) - Number(selected.releaseAirborne),
    arrivalSpeed: difference(selected.arrivalSpeed, repair.arrivalSpeed),
    arrivalAngleDeg: difference(selected.arrivalAngleDeg, repair.arrivalAngleDeg),
    arrivalAir: difference(selected.arrivalAir, repair.arrivalAir),
  };
}

function summarizeAxes(gaps: Array<Record<string, { target: number; achieved: number }>>): Aggregate["axes"] {
  const values: Record<string, number[]> = {};
  for (const axes of gaps) {
    for (const [axis, detail] of Object.entries(axes)) {
      if (!finite(detail.target) || !finite(detail.achieved)) continue;
      (values[axis] ??= []).push(detail.achieved - detail.target);
    }
  }
  return Object.fromEntries(Object.entries(values).map(([axis, errors]) => [axis, errorSummary(errors)]));
}

function summarizeRuns(rows: RunRow[]): Aggregate {
  const allAxis: Record<string, number[]> = {};
  for (const row of rows) {
    for (const [axis, detail] of Object.entries(row.axis)) {
      // Reconstructing a pooled RMS requires the raw residuals; retaining n and
      // mean/RMS is enough to combine their sum of squares and signed sum.
      const sum = detail.meanSigned * detail.n;
      const squares = detail.rms * detail.rms * detail.n;
      const bucket = allAxis[axis] ??= [];
      bucket.push(sum, squares, detail.n);
    }
  }
  const axes: Aggregate["axes"] = {};
  for (const [axis, triples] of Object.entries(allAxis)) {
    let sum = 0;
    let squares = 0;
    let n = 0;
    for (let i = 0; i < triples.length; i += 3) {
      sum += triples[i];
      squares += triples[i + 1];
      n += triples[i + 2];
    }
    axes[axis] = {
      n,
      rms: round(Math.sqrt(squares / n)),
      meanSigned: round(sum / n),
    };
  }
  return {
    runs: rows.length,
    validRuns: rows.filter((row) => row.valid).length,
    scoreMean: round(mean(rows.map((row) => row.score))),
    axes,
  };
}

function summarizeFrontier(rows: PoolRow[]): FrontierAggregate {
  const speedAllowance: FrontierAggregate["speedAllowance"] = {};
  for (const allowance of SPEED_ALLOWANCES) {
    const choices = rows.flatMap((row) => {
      const choice = row.choices[String(allowance)];
      return choice === null ? [] : [choice];
    });
    const material = choices.filter((choice) => choice.impactGain >= 0.025);
    speedAllowance[String(allowance)] = {
      available: choices.length,
      materialImpactRepairs: material.length,
      materialImpactRepairRate: ratio(material.length, choices.length),
      impactGainMean: round(mean(choices.map((choice) => choice.impactGain))),
      speedCostMean: round(mean(choices.map((choice) => choice.speedCost))),
      airCostMean: nullableMean(choices.map((choice) => choice.airCost)),
      elevationCostMean: nullableMean(choices.map((choice) => choice.elevationCost)),
      handoffCostMean: round(mean(choices.map((choice) => choice.handoffCost))),
      readinessDeltaMean: nullableMean(choices.map((choice) => choice.readinessDelta)),
      transition: summarizeTransition(material),
    };
  }
  return {
    pools: rows.length,
    scoredCandidates: rows.reduce((sum, row) => sum + row.scoredCandidates, 0),
    axisParetoCandidatesMean: round(mean(rows.map((row) => row.axisParetoCandidates))),
    selectedOnAxisParetoRate: ratio(rows.filter((row) => row.selectedOnAxisPareto).length, rows.length),
    speedAllowance,
  };
}

function summarizeTransition(choices: readonly TradeChoice[]): FrontierAggregate["speedAllowance"][string]["transition"] {
  return {
    samples: choices.length,
    releaseVxDeltaMean: nullableMean(choices.map((choice) => choice.transition.releaseVx)),
    releaseVyDeltaMean: nullableMean(choices.map((choice) => choice.transition.releaseVy)),
    releaseSpeedDeltaMean: nullableMean(choices.map((choice) => choice.transition.releaseSpeed)),
    releaseGroundedDeltaMean: nullableMean(choices.map((choice) => choice.transition.releaseGrounded)),
    releaseAirborneDeltaMean: nullableMean(choices.map((choice) => choice.transition.releaseAirborne)),
    arrivalSpeedDeltaMean: nullableMean(choices.map((choice) => choice.transition.arrivalSpeed)),
    arrivalAngleDegDeltaMean: nullableMean(choices.map((choice) => choice.transition.arrivalAngleDeg)),
    arrivalAirDeltaMean: nullableMean(choices.map((choice) => choice.transition.arrivalAir)),
  };
}

function compareToReference(current: ProbeOutput, path: string): object {
  const reference = JSON.parse(readFileSync(path, "utf8")) as ProbeOutput;
  if (reference.schema !== current.schema) throw new Error(`reference ${path} has an incompatible schema`);
  if (JSON.stringify(reference.fixedConfig) !== JSON.stringify(current.fixedConfig)) {
    throw new Error(`reference ${path} does not use the fixed impact-frontier probe configuration`);
  }
  const comparison = (currentValue: number, referenceValue: number, direction: "higher" | "lower") => ({
    current: currentValue,
    reference: referenceValue,
    delta: round(currentValue - referenceValue),
    improvement: round(direction === "higher" ? currentValue - referenceValue : referenceValue - currentValue),
  });
  const aggregate = (now: Aggregate, base: Aggregate) => ({
    validRuns: comparison(now.validRuns, base.validRuns, "higher"),
    scoreMean: comparison(now.scoreMean, base.scoreMean, "higher"),
    impactRms: comparison(now.axes.impact?.rms ?? NaN, base.axes.impact?.rms ?? NaN, "lower"),
    speedRms: comparison(now.axes.speed?.rms ?? NaN, base.axes.speed?.rms ?? NaN, "lower"),
    airRms: comparison(now.axes.air?.rms ?? NaN, base.axes.air?.rms ?? NaN, "lower"),
  });
  const allowances: Record<string, object> = {};
  for (const allowance of SPEED_ALLOWANCES) {
    const key = String(allowance);
    const now = current.summary.frontier.speedAllowance[key];
    const base = reference.summary.frontier.speedAllowance[key];
    allowances[key] = {
      materialImpactRepairRate: comparison(now.materialImpactRepairRate, base.materialImpactRepairRate, "higher"),
      impactGainMean: comparison(now.impactGainMean, base.impactGainMean, "higher"),
      speedCostMean: comparison(now.speedCostMean, base.speedCostMean, "lower"),
      handoffCostMean: comparison(now.handoffCostMean, base.handoffCostMean, "lower"),
    };
  }
  return {
    reference: path,
    note: "Descriptive paired comparison only. Positive impact repair does not authorize a V2 attempt without broad mechanism evidence.",
    overall: aggregate(current.summary.overall, reference.summary.overall),
    impact: aggregate(current.summary.impact, reference.summary.impact),
    guard: aggregate(current.summary.guard, reference.summary.guard),
    impactSpeedFrontier: allowances,
  };
}

function errorSummary(errors: number[]): { n: number; rms: number; meanSigned: number } {
  return {
    n: errors.length,
    rms: round(Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length)),
    meanSigned: round(mean(errors)),
  };
}

function minBy<T>(values: T[], metric: (value: T) => number): T {
  return values.reduce((best, value) => metric(value) < metric(best) ? value : best);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mean(values: number[]): number {
  return values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function nullableMean(values: Array<number | null>): number | null {
  const finiteValues = values.filter(finite);
  return finiteValues.length === 0 ? null : round(mean(finiteValues));
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : round(numerator / denominator);
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
