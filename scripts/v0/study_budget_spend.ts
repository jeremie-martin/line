/**
 * Budget-spend characterization for compileHandoff.
 *
 * This is a read-only study for the first budget-controller step. It sweeps one
 * explicit candidate-count override, records actual compute spent, and groups
 * results by structural budget slack.
 *
 *   LR_ENGINE=wasm node --import tsx scripts/v0/study_budget_spend.ts \
 *     --budget=200000 \
 *     --specs=tiny_dance,dense_echo_climb,skyline_push,drums_pendulum \
 *     --seeds=0,1 \
 *     --quality-ncand=24,32,40 \
 *     --out=generated/studies/budget-spend-qncand.json
 *
 * To study first-traversal breadth instead of quality-phase breadth:
 *
 *   LR_ENGINE=wasm node --import tsx scripts/v0/study_budget_spend.ts \
 *     --budget=200000 \
 *     --specs=tiny_dance,dense_echo_climb,skyline_push,drums_pendulum \
 *     --seeds=0,1 \
 *     --contract-ncand=8,11,14,17,20 \
 *     --out=generated/studies/budget-spend-contract-ncand.json
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { compileHandoff } from "./optimizer/handoff.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { scoreDriftReport, shiftedGeometricMean } from "./score.ts";
import { secToFrame } from "./types.ts";

const DEFAULT_SPECS = [
  "tiny_dance",
  "cold_start",
  "dense_echo_climb",
  "skyline_push",
  "drums_pendulum",
  "solo_run",
] as const satisfies readonly GoldenSpecName[];
const DEFAULT_SEEDS = [0, 1];
const DEFAULT_BUDGET = 200_000;
const DEFAULT_QUALITY_NCAND = [24, 32, 40];
const DEFAULT_BASELINE_NCAND = 32;
const DEFAULT_BASELINE_CONTRACT_NCAND = 14;

type StudyKnob = "quality_ncand" | "contract_ncand";
type StudyPolicy = "legacy" | "quality-v1";

type KnobConfig = {
  name: StudyKnob;
  values: number[];
  baseline: number;
  label: string;
  valueOf: (row: Row) => number | null;
};

type Row = {
  spec: string;
  seed: number;
  budget: number;
  handoff_policy_variant: string | null;
  quality_ncand: number;
  contract_ncand: number | null;
  score: number;
  contract_passed: boolean;
  axis_quality: number;
  sim_frames: number;
  budget_exhausted: boolean;
  predicted_first_completion_frames: number | null;
  budget_slack: number | null;
  first_completion_frame: number | null;
  candidates_sampled: number;
  candidates_viable: number;
  handoff_full_evaluations: number;
  handoff_unique_full_evaluations: number;
  fwd_eval_frames_charged: number;
  fwd_eval_calls: number;
  repair_frames_spent: number;
  repair_restarts: number;
  elapsed_ms: number;
};

type Summary = {
  key: string;
  n: number;
  valid: number;
  score_geomean: number;
  score_mean: number;
  sim_frames_mean: number;
  candidates_sampled_mean: number;
  candidates_viable_mean: number;
  first_completion_mean: number | null;
  predicted_first_completion_mean: number | null;
  budget_slack_mean: number | null;
  fwd_eval_frames_mean: number;
  repair_frames_mean: number;
  full_evaluations_mean: number;
};

type PairedDelta = {
  knob: StudyKnob;
  knob_value: number;
  baseline_value: number;
  pairs: number;
  score_delta_mean: number;
  sim_frames_delta_mean: number;
  candidates_sampled_delta_mean: number;
  first_completion_delta_mean: number | null;
  repair_frames_delta_mean: number;
};

type KnobSpendModel = {
  knob: StudyKnob;
  target: "first_completion_frame / predicted_first_completion_frames";
  feature: string;
  baseline_value: number;
  n: number;
  intercept: number;
  slope: number;
  multiplier_mae: number;
  frame_mae: number;
  r2: number;
  by_value: {
    value: number;
    n: number;
    multiplier_mean: number;
    multiplier_predicted: number;
    frame_mae: number;
  }[];
};

type KnobPairedResponseModel = {
  knob: StudyKnob;
  target: string;
  feature: string;
  baseline_value: number;
  n: number;
  intercept: number;
  slope: number;
  mae: number;
  r2: number;
  by_value: {
    value: number;
    n: number;
    response_mean: number;
    response_predicted: number;
    mae: number;
  }[];
};

type Delta = {
  score: number;
  sim: number;
  candidates: number;
  first: number | null;
  repair: number;
};

type PairedResponseSample = {
  row: Row;
  value: number;
  x: number;
  y: number;
};

const argv = process.argv.slice(2);
const budget = intArg("budget", DEFAULT_BUDGET);
const studyPolicy = policyArg("policy", "quality-v1");
const baselineNCand = intArg("baseline-ncand", DEFAULT_BASELINE_NCAND);
const baselineContractNCand = intArg("baseline-contract-ncand", DEFAULT_BASELINE_CONTRACT_NCAND);
const requestedContractNCands = positiveIntListArg("contract-ncand", []);
const studyKnob: StudyKnob = requestedContractNCands.length > 0 ? "contract_ncand" : "quality_ncand";
const qualityNCands = (studyKnob === "quality_ncand"
  ? ensureIncludes(positiveIntListArg("quality-ncand", DEFAULT_QUALITY_NCAND), baselineNCand)
  : positiveIntListArg("quality-ncand", [baselineNCand])
).sort((a, b) => a - b);
if (studyKnob === "contract_ncand" && qualityNCands.length !== 1) {
  throw new Error("--contract-ncand studies must keep --quality-ncand fixed to one value");
}
const contractNCands = (studyKnob === "contract_ncand"
  ? ensureIncludes(requestedContractNCands, baselineContractNCand)
  : [null]
).sort((a, b) => (a ?? -1) - (b ?? -1));
const knobConfig: KnobConfig = studyKnob === "quality_ncand"
  ? {
    name: "quality_ncand",
    values: qualityNCands,
    baseline: baselineNCand,
    label: "q",
    valueOf: (row) => row.quality_ncand,
  }
  : {
    name: "contract_ncand",
    values: contractNCands.filter((x): x is number => x !== null),
    baseline: baselineContractNCand,
    label: "c",
    valueOf: (row) => row.contract_ncand,
  };
const seeds = intListArg("seeds", DEFAULT_SEEDS);
const specNames = specListArg("specs", [...DEFAULT_SPECS]);
const outPath = arg("out");
const previousHandoffPolicy = process.env.LR_HANDOFF_POLICY;
const previousQualityNCand = process.env.LR_QUALITY_NCAND;
const previousContractNCand = process.env.LR_CONTRACT_NCAND;

const rows: Row[] = [];
try {
  process.env.LR_HANDOFF_POLICY = studyPolicy;
  for (const specName of specNames) {
    const spec = await loadGoldenSpec(specName, "base");
    for (const seed of seeds) {
      for (const contractNCand of contractNCands) {
        for (const qualityNCand of qualityNCands) {
          process.env.LR_QUALITY_NCAND = String(qualityNCand);
          if (contractNCand === null) {
            delete process.env.LR_CONTRACT_NCAND;
          } else {
            process.env.LR_CONTRACT_NCAND = String(contractNCand);
          }
          const t0 = Date.now();
          const checkpoint = compileHandoff(spec, seed, { budget });
          const elapsedMs = Date.now() - t0;
          const score = scoreDriftReport(checkpoint.report, {
            totalFrames: secToFrame(spec.duration),
          });
          const stats = checkpoint.stats;
          rows.push({
            spec: specName,
            seed,
            budget,
            handoff_policy_variant: stats.handoff_policy_variant ?? null,
            quality_ncand: qualityNCand,
            contract_ncand: contractNCand,
            score: round(score.score, 4),
            contract_passed: score.contract_passed,
            axis_quality: round(score.axis_quality, 6),
            sim_frames: stats.sim_frames,
            budget_exhausted: stats.budget_exhausted,
            predicted_first_completion_frames: stats.predicted_first_completion_frames ?? null,
            budget_slack: stats.budget_slack ?? null,
            first_completion_frame: stats.first_completion_frame ?? stats.repair?.first_completion_frame ?? null,
            candidates_sampled: stats.candidates_sampled,
            candidates_viable: stats.candidates_viable,
            handoff_full_evaluations: stats.handoff_full_evaluations ?? 0,
            handoff_unique_full_evaluations: stats.handoff_unique_full_evaluations ?? 0,
            fwd_eval_frames_charged: stats.fwd_eval?.fwd_eval_frames_charged ?? 0,
            fwd_eval_calls: stats.fwd_eval?.fwd_eval_calls ?? 0,
            repair_frames_spent: stats.repair?.frames_spent ?? 0,
            repair_restarts: stats.repair?.restarts ?? 0,
            elapsed_ms: elapsedMs,
          });
          console.error(
            `budget-spend spec=${specName} seed=${seed} ` +
              `policy=${stats.handoff_policy_variant ?? studyPolicy} ` +
              `q=${qualityNCand} c=${contractNCand ?? "default"} ` +
              `score=${score.score.toFixed(1)} sim=${stats.sim_frames} ` +
              `slack=${stats.budget_slack?.toFixed(2) ?? "na"}`,
          );
          await new Promise((resolve) => setImmediate(resolve));
        }
      }
    }
  }
} finally {
  if (previousHandoffPolicy === undefined) {
    delete process.env.LR_HANDOFF_POLICY;
  } else {
    process.env.LR_HANDOFF_POLICY = previousHandoffPolicy;
  }
  if (previousQualityNCand === undefined) {
    delete process.env.LR_QUALITY_NCAND;
  } else {
    process.env.LR_QUALITY_NCAND = previousQualityNCand;
  }
  if (previousContractNCand === undefined) {
    delete process.env.LR_CONTRACT_NCAND;
  } else {
    process.env.LR_CONTRACT_NCAND = previousContractNCand;
  }
}

const byKnob = summarizeGroups(
  groupRows(rows, (row) => String(knobConfig.valueOf(row))),
);
const byKnobAndSlackBand = summarizeGroups(
  groupRows(rows, (row) => `${knobConfig.valueOf(row)}:${slackBand(row.budget_slack)}`),
);
const pairedVsBaseline = pairedDeltas(rows, knobConfig);
const knobFirstCompletionModel = fitKnobSpendModel(rows, knobConfig);
const knobCandidateSampleModel = fitPairedKnobResponseModel(
  rows,
  knobConfig,
  `candidates_sampled / baseline_${knobConfig.name}_candidates_sampled`,
  (row) => row.candidates_sampled,
);
const output = {
  config: {
    budget,
    policy: studyPolicy,
    specs: specNames,
    seeds,
    study_knob: studyKnob,
    knob_values: knobConfig.values,
    baseline_value: knobConfig.baseline,
    quality_ncand: qualityNCands,
    contract_ncand: contractNCands,
    baseline_quality_ncand: baselineNCand,
    baseline_contract_ncand: baselineContractNCand,
  },
  rows,
  summary_by_knob: byKnob,
  summary_by_knob_and_slack_band: byKnobAndSlackBand,
  paired_vs_baseline: pairedVsBaseline,
  first_completion_model: knobFirstCompletionModel,
  candidate_sample_model: knobCandidateSampleModel,
};

if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
}

printSummary(byKnob, pairedVsBaseline, knobFirstCompletionModel, knobCandidateSampleModel);
if (outPath !== undefined) console.log(`wrote ${outPath}`);

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function intArg(name: string, fallback: number): number {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function intListArg(name: string, fallback: readonly number[]): number[] {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return [...fallback];
  return raw.split(",").map((x) => Number.parseInt(x, 10))
    .filter((x) => Number.isFinite(x));
}

function positiveIntListArg(name: string, fallback: readonly number[]): number[] {
  return intListArg(name, fallback).filter((x) => x > 0);
}

function policyArg(name: string, fallback: StudyPolicy): StudyPolicy {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return fallback;
  if (raw === "legacy" || raw === "quality-v1") return raw;
  throw new Error(`--${name} must be legacy or quality-v1, got ${raw}`);
}

function specListArg(name: string, fallback: readonly GoldenSpecName[]): GoldenSpecName[] {
  const raw = arg(name);
  const values = raw === undefined || raw.trim() === ""
    ? [...fallback]
    : raw === "ALL"
      ? [...GOLDEN_SPECS]
      : raw.split(",") as GoldenSpecName[];
  for (const spec of values) {
    if (!(GOLDEN_SPECS as readonly string[]).includes(spec)) {
      throw new Error(`unknown golden spec "${spec}"`);
    }
  }
  return values;
}

function ensureIncludes(xs: number[], required: number): number[] {
  return xs.includes(required) ? xs : [...xs, required];
}

function groupRows<T>(
  values: readonly T[],
  keyOf: (value: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function summarizeGroups(groups: Map<string, Row[]>): Summary[] {
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => ({
    key,
    n: group.length,
    valid: group.filter((row) => row.contract_passed).length,
    score_geomean: round(shiftedGeometricMean(group.map((row) => row.score)), 3),
    score_mean: round(mean(group.map((row) => row.score)), 3),
    sim_frames_mean: round(mean(group.map((row) => row.sim_frames)), 1),
    candidates_sampled_mean: round(mean(group.map((row) => row.candidates_sampled)), 1),
    candidates_viable_mean: round(mean(group.map((row) => row.candidates_viable)), 1),
    first_completion_mean: meanNullable(group.map((row) => row.first_completion_frame)),
    predicted_first_completion_mean: meanNullable(group.map((row) => row.predicted_first_completion_frames)),
    budget_slack_mean: meanNullable(group.map((row) => row.budget_slack)),
    fwd_eval_frames_mean: round(mean(group.map((row) => row.fwd_eval_frames_charged)), 1),
    repair_frames_mean: round(mean(group.map((row) => row.repair_frames_spent)), 1),
    full_evaluations_mean: round(mean(group.map((row) => row.handoff_full_evaluations)), 1),
  }));
}

function pairedDeltas(rows: readonly Row[], knob: KnobConfig): PairedDelta[] {
  const byKey = new Map<string, Row>();
  for (const row of rows) {
    const value = knob.valueOf(row);
    if (value !== null) byKey.set(rowKey(row, value), row);
  }
  const candidates = [...new Set(rows.map((row) => knob.valueOf(row)).filter((x): x is number => x !== null))]
    .filter((value) => value !== knob.baseline)
    .sort((a, b) => a - b);
  return candidates.map((value) => {
    const deltas = rows
      .filter((row) => knob.valueOf(row) === value)
      .map((row) => {
        const baseline = byKey.get(rowKey(row, knob.baseline));
        if (baseline === undefined) return null;
        return {
          score: row.score - baseline.score,
          sim: row.sim_frames - baseline.sim_frames,
          candidates: row.candidates_sampled - baseline.candidates_sampled,
          first: row.first_completion_frame !== null && baseline.first_completion_frame !== null
            ? row.first_completion_frame - baseline.first_completion_frame
            : null,
          repair: row.repair_frames_spent - baseline.repair_frames_spent,
        };
      })
      .filter((delta): delta is Delta => delta !== null);
    return {
      knob: knob.name,
      knob_value: value,
      baseline_value: knob.baseline,
      pairs: deltas.length,
      score_delta_mean: round(mean(deltas.map((delta) => delta.score)), 3),
      sim_frames_delta_mean: round(mean(deltas.map((delta) => delta.sim)), 1),
      candidates_sampled_delta_mean: round(mean(deltas.map((delta) => delta.candidates)), 1),
      first_completion_delta_mean: meanNullable(deltas.map((delta) => delta.first)),
      repair_frames_delta_mean: round(mean(deltas.map((delta) => delta.repair)), 1),
    };
  });
}

function fitKnobSpendModel(
  rows: readonly Row[],
  knob: KnobConfig,
): KnobSpendModel | null {
  const samples = rows
    .filter((row) =>
      knob.valueOf(row) !== null &&
      row.first_completion_frame !== null &&
      row.predicted_first_completion_frames !== null &&
      row.predicted_first_completion_frames > 0
    )
    .map((row) => ({
      row,
      value: knob.valueOf(row) as number,
      x: (knob.valueOf(row) as number) / knob.baseline - 1,
      y: (row.first_completion_frame as number) / (row.predicted_first_completion_frames as number),
    }));
  if (samples.length < 2) return null;
  const xMean = mean(samples.map((sample) => sample.x));
  const yMean = mean(samples.map((sample) => sample.y));
  const sxx = samples.reduce((sum, sample) => sum + (sample.x - xMean) ** 2, 0);
  const sxy = samples.reduce((sum, sample) => sum + (sample.x - xMean) * (sample.y - yMean), 0);
  const slope = sxx > 1e-12 ? sxy / sxx : 0;
  const intercept = yMean - slope * xMean;
  const predictions = samples.map((sample) => ({
    ...sample,
    predMultiplier: intercept + slope * sample.x,
  }));
  const yErrors = predictions.map((sample) => sample.y - sample.predMultiplier);
  const frameErrors = predictions.map((sample) =>
    (sample.row.first_completion_frame as number) -
      sample.predMultiplier * (sample.row.predicted_first_completion_frames as number)
  );
  const sst = samples.reduce((sum, sample) => sum + (sample.y - yMean) ** 2, 0);
  const sse = yErrors.reduce((sum, error) => sum + error ** 2, 0);
  const byValue = [...groupRows(predictions, (sample) => String(sample.value)).entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([value, group]) => ({
      value: Number(value),
      n: group.length,
      multiplier_mean: round(mean(group.map((sample) => sample.y)), 4),
      multiplier_predicted: round(mean(group.map((sample) => sample.predMultiplier)), 4),
      frame_mae: round(mean(group.map((sample) =>
        Math.abs(
          (sample.row.first_completion_frame as number) -
            sample.predMultiplier * (sample.row.predicted_first_completion_frames as number),
        )
      )), 1),
    }));
  return {
    knob: knob.name,
    target: "first_completion_frame / predicted_first_completion_frames",
    feature: `${knob.name} / baseline_${knob.name} - 1`,
    baseline_value: knob.baseline,
    n: samples.length,
    intercept: round(intercept, 6),
    slope: round(slope, 6),
    multiplier_mae: round(mean(yErrors.map(Math.abs)), 4),
    frame_mae: round(mean(frameErrors.map(Math.abs)), 1),
    r2: round(1 - sse / Math.max(1e-12, sst), 4),
    by_value: byValue,
  };
}

function fitPairedKnobResponseModel(
  rows: readonly Row[],
  knob: KnobConfig,
  target: string,
  valueOf: (row: Row) => number,
): KnobPairedResponseModel | null {
  const byKey = new Map<string, Row>();
  for (const row of rows) {
    const value = knob.valueOf(row);
    if (value !== null) byKey.set(rowKey(row, value), row);
  }
  const samples = rows
    .map((row) => {
      const knobValue = knob.valueOf(row);
      if (knobValue === null) return null;
      const baseline = byKey.get(rowKey(row, knob.baseline));
      const baselineValue = baseline === undefined ? NaN : valueOf(baseline);
      const value = valueOf(row);
      if (!(baselineValue > 0) || !Number.isFinite(value)) return null;
      return {
        row,
        value: knobValue,
        x: knobValue / knob.baseline - 1,
        y: value / baselineValue,
      };
    })
    .filter((sample): sample is PairedResponseSample => sample !== null);
  if (samples.length < 2) return null;
  const xMean = mean(samples.map((sample) => sample.x));
  const yMean = mean(samples.map((sample) => sample.y));
  const sxx = samples.reduce((sum, sample) => sum + (sample.x - xMean) ** 2, 0);
  const sxy = samples.reduce((sum, sample) => sum + (sample.x - xMean) * (sample.y - yMean), 0);
  const slope = sxx > 1e-12 ? sxy / sxx : 0;
  const intercept = yMean - slope * xMean;
  const predictions = samples.map((sample) => ({
    ...sample,
    predicted: intercept + slope * sample.x,
  }));
  const errors = predictions.map((sample) => sample.y - sample.predicted);
  const sst = samples.reduce((sum, sample) => sum + (sample.y - yMean) ** 2, 0);
  const sse = errors.reduce((sum, error) => sum + error ** 2, 0);
  const byValue = [...groupRows(predictions, (sample) => String(sample.value)).entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([value, group]) => ({
      value: Number(value),
      n: group.length,
      response_mean: round(mean(group.map((sample) => sample.y)), 4),
      response_predicted: round(mean(group.map((sample) => sample.predicted)), 4),
      mae: round(mean(group.map((sample) => Math.abs(sample.y - sample.predicted))), 4),
    }));
  return {
    knob: knob.name,
    target,
    feature: `${knob.name} / baseline_${knob.name} - 1`,
    baseline_value: knob.baseline,
    n: samples.length,
    intercept: round(intercept, 6),
    slope: round(slope, 6),
    mae: round(mean(errors.map(Math.abs)), 4),
    r2: round(1 - sse / Math.max(1e-12, sst), 4),
    by_value: byValue,
  };
}

function rowKey(row: Pick<Row, "spec" | "seed">, qualityNCand: number): string {
  return `${row.spec}|${row.seed}|${qualityNCand}`;
}

function slackBand(slack: number | null): string {
  if (slack === null || !Number.isFinite(slack)) return "na";
  if (slack < 2) return "<2";
  if (slack < 3) return "2-3";
  if (slack < 5) return "3-5";
  return ">=5";
}

function mean(xs: readonly number[]): number {
  return xs.length === 0 ? NaN : xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

function meanNullable(xs: readonly (number | null)[]): number | null {
  const finite = xs.filter((x): x is number => x !== null && Number.isFinite(x));
  return finite.length === 0 ? null : round(mean(finite), 3);
}

function round(value: number, digits = 3): number {
  if (!Number.isFinite(value)) return value;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function fmt(value: number | null, digits = 1): string {
  return value === null || !Number.isFinite(value) ? "na" : value.toFixed(digits);
}

function printSummary(
  summaries: Summary[],
  deltas: PairedDelta[],
  spendModel: KnobSpendModel | null,
  candidateSampleModel: KnobPairedResponseModel | null,
): void {
  console.log(
    `budget-spend: budget=${budget} specs=${specNames.length} seeds=${seeds.length} ` +
      `${knobConfig.name}=${knobConfig.values.join(",")}`,
  );
  console.log(`by ${knobConfig.name}:`);
  for (const summary of summaries) {
    console.log(
      `  ${knobConfig.label}=${summary.key.padStart(2)} n=${summary.n} valid=${summary.valid}/${summary.n} ` +
        `score_geo=${fmt(summary.score_geomean, 1)} score_mean=${fmt(summary.score_mean, 1)} ` +
        `sim=${fmt(summary.sim_frames_mean, 0)} cand=${fmt(summary.candidates_sampled_mean, 0)} ` +
        `first=${fmt(summary.first_completion_mean, 0)} slack=${fmt(summary.budget_slack_mean, 2)} ` +
        `fwd=${fmt(summary.fwd_eval_frames_mean, 0)} repair=${fmt(summary.repair_frames_mean, 0)}`,
    );
  }
  if (deltas.length > 0) {
    console.log(`paired deltas vs ${knobConfig.label}=${knobConfig.baseline}:`);
    for (const delta of deltas) {
      console.log(
        `  ${knobConfig.label}=${delta.knob_value} pairs=${delta.pairs} ` +
          `dScore=${fmt(delta.score_delta_mean, 2)} ` +
          `dSim=${fmt(delta.sim_frames_delta_mean, 0)} ` +
          `dCand=${fmt(delta.candidates_sampled_delta_mean, 0)} ` +
          `dFirst=${fmt(delta.first_completion_delta_mean, 0)} ` +
          `dRepair=${fmt(delta.repair_frames_delta_mean, 0)}`,
      );
    }
  }
  if (spendModel !== null) {
    console.log(`${spendModel.knob} first-completion multiplier model:`);
    console.log(
      `  multiplier = ${spendModel.intercept.toFixed(4)} ` +
        `+ ${spendModel.slope.toFixed(4)} * (${knobConfig.label}/${spendModel.baseline_value} - 1)  ` +
        `n=${spendModel.n} r2=${spendModel.r2.toFixed(3)} ` +
        `mae=${fmt(spendModel.frame_mae, 0)}f`,
    );
    for (const row of spendModel.by_value) {
      console.log(
        `  ${knobConfig.label}=${row.value} n=${row.n} ` +
          `mult=${row.multiplier_mean.toFixed(3)} pred=${row.multiplier_predicted.toFixed(3)} ` +
          `mae=${fmt(row.frame_mae, 0)}f`,
      );
    }
  }
  if (candidateSampleModel !== null) {
    console.log(`${candidateSampleModel.knob} candidate-sample response model:`);
    console.log(
      `  sample_ratio = ${candidateSampleModel.intercept.toFixed(4)} ` +
        `+ ${candidateSampleModel.slope.toFixed(4)} * (${knobConfig.label}/${candidateSampleModel.baseline_value} - 1)  ` +
        `n=${candidateSampleModel.n} r2=${candidateSampleModel.r2.toFixed(3)} ` +
        `mae=${candidateSampleModel.mae.toFixed(3)}`,
    );
    for (const row of candidateSampleModel.by_value) {
      console.log(
        `  ${knobConfig.label}=${row.value} n=${row.n} ` +
          `ratio=${row.response_mean.toFixed(3)} pred=${row.response_predicted.toFixed(3)} ` +
          `mae=${row.mae.toFixed(3)}`,
      );
    }
  }
}
