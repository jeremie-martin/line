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
 *     [--out=FILE] [--reference=FILE] [--detail]
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
};
type TradeChoice = {
  impactGain: number;
  speedCost: number;
  airCost: number | null;
  elevationCost: number | null;
  handoffCost: number;
  readinessDelta: number | null;
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
};

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: npm run impact-probe [-- --out=FILE] [-- --reference=FILE] [-- --detail]\n" +
    "Runs the fixed 6-case × 2-seed impact-frontier discovery panel. It is descriptive only; V2 is the promotion gate.\n",
  );
  process.exit(0);
}
const value = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const outPath = value("out");
const referencePath = value("reference");
const detail = argv.includes("--detail");
const unknown = argv.filter((arg) => arg !== "--detail" && !arg.startsWith("--out=") && !arg.startsWith("--reference="));
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);

let active = CASES[0];
let activeSeed = SEEDS[0];
const poolRows: PoolRow[] = [];
setHandoffPoolProbeHook((record) => observePool(record));

const runs: RunRow[] = [];
try {
  for (const definition of CASES) {
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
};
if (referencePath !== undefined) output.comparison = compareToReference(output, referencePath);

const json = `${JSON.stringify(output, null, 2)}\n`;
if (outPath === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);
  process.stdout.write(`${JSON.stringify({
    schema: output.schema,
    output: outPath,
    summary: output.summary,
    comparison: output.comparison,
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
