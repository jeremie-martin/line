/**
 * Comprehensive offline surface analysis for quality-ncand panels.
 *
 * The goal is not to pick a production policy directly. It is to mine the
 * characterization database for the surfaces a controller would need:
 *
 *   - first-completion cost models
 *   - q elasticity by spec and budget
 *   - score response
 *   - repair tradeoff
 *   - residual maps and quantiles
 *   - simple observed/offline policy simulations
 *
 * By default only fully completed budget waves are analyzed, so partial shard
 * waves do not skew q comparisons.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";
import { loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { FPS, secToFrame, type Spec } from "./types.ts";

type StudyFile = {
  config: {
    budget: number;
    specs: string[];
    seeds: number[];
    study_knob: "quality_ncand";
    knob_values: number[];
    baseline_value: number;
  };
  rows: StudyRow[];
};

type StudyRow = {
  spec: string;
  seed: number;
  budget: number;
  quality_ncand: number;
  score: number;
  contract_passed: boolean;
  predicted_first_completion_frames: number | null;
  budget_slack?: number | null;
  first_completion_frame: number | null;
  candidates_sampled: number;
  repair_frames_spent: number;
  fwd_eval_frames_charged?: number;
  sim_frames?: number;
};

type Sample = StudyRow & {
  first: number;
  current_d: number;
};

type PairSample = {
  key: string;
  budget: number;
  spec: string;
  seed: number;
  q: number;
  qx: number;
  qlog: number;
  slack: number;
  score_delta: number;
  first_delta: number;
  first_ratio: number;
  candidate_delta: number;
  candidate_ratio: number;
  repair_delta: number;
  fwd_delta: number;
  score: number;
  baseline_score: number;
};

type SpecFeatures = {
  contact_count: number;
  duration_frames: number;
  inverse_gap_sum: number;
  median_gap_frames: number;
  min_gap_frames: number;
  contact_density_per_second: number;
};

type Metrics = {
  n: number;
  r2: number;
  mae: number;
  rmse: number;
  mape: number;
  bias: number;
};

type CostModelResult = {
  model: string;
  family: string;
  target: string;
  train: Metrics;
  leave_one_spec_out: Metrics | null;
  leave_one_budget_out: Metrics | null;
  leave_one_seed_out: Metrics | null;
  residuals: {
    by_budget: ResidualGroup[];
    by_q: ResidualGroup[];
    worst_specs: ResidualGroup[];
  };
};

type ResponseModelResult = {
  model: string;
  target: string;
  train: Metrics;
  leave_one_spec_out: Metrics | null;
  leave_one_budget_out: Metrics | null;
  leave_one_seed_out: Metrics | null;
};

type ResidualGroup = {
  key: string;
  n: number;
  mae: number;
  bias: number;
  actual_mean: number;
  predicted_mean: number;
};

type QSummary = {
  q: number;
  pairs: number;
  naive_q_ratio: number;
  score_delta_mean: number;
  score_delta_p25: number;
  score_delta_p50: number;
  score_delta_p75: number;
  first_delta_mean: number;
  first_ratio_mean: number;
  first_ratio_p50: number;
  first_ratio_p75: number;
  first_ratio_p90: number;
  candidate_ratio_mean: number;
  candidate_absorption: number;
  first_absorption: number;
  fwd_delta_mean: number;
  repair_delta_mean: number;
};

type Elasticity = {
  key: string;
  n: number;
  beta: number;
  intercept: number;
  ratio_mae: number;
  score_slope: number;
  q48_score_delta_mean: number | null;
  q48_first_ratio_mean: number | null;
  contact_count?: number;
  duration_frames?: number;
  contact_density_per_second?: number;
};

type PolicyResult = {
  policy: string;
  n: number;
  score_mean: number;
  score_delta_vs_q32: number;
  first_ratio_vs_q32: number;
  candidate_ratio_vs_q32: number;
  selected_q_mean: number;
  selected_q_counts: { q: number; n: number }[];
};

type QPreferenceSummary = {
  key: string;
  best_q: number;
  best_score_mean: number;
  baseline_score_mean: number;
  score_delta_vs_q32: number;
  first_ratio_vs_q32: number;
  candidate_ratio_vs_q32: number;
  q_means: {
    q: number;
    n: number;
    score_mean: number;
    first_mean: number;
    candidate_mean: number;
  }[];
};

type ScoreStat = {
  sum: number;
  n: number;
};

type CompletenessRow = {
  budget: number;
  q: number;
  rows: number;
  expected_rows: number;
  complete: boolean;
};

type FittedModel<T> = {
  predict: (row: T) => number;
};

type ModelSpec<T> = {
  name: string;
  family: string;
  target: string;
  fit: (rows: T[]) => FittedModel<T> | null;
  actual: (row: T) => number;
};

const argv = process.argv.slice(2);
const inputPaths = inputList();
if (inputPaths.length === 0) {
  throw new Error("usage: --dir=panel-dir or --inputs=a.json,b.json [--include-partial] [--out=analysis.json]");
}

const outPath = arg("out");
const includePartial = boolArg("include-partial", false);
const loadedStudies = inputPaths.map((path) => ({ path, study: readStudyMaybe(path) }));
const studies = loadedStudies
  .filter((item): item is { path: string; study: StudyFile } => item.study !== null)
  .map((item) => item.study);
const usedInputPaths = loadedStudies
  .filter((item) => item.study !== null)
  .map((item) => item.path);
if (studies.length === 0) throw new Error("no study JSON files found");

const baselineQ = studies[0].config.baseline_value;
const configuredSpecs = [...new Set(studies.flatMap((study) => study.config.specs))].sort();
const configuredSeeds = [...new Set(studies.flatMap((study) => study.config.seeds))].sort((a, b) => a - b);
const configuredQ = [...new Set(studies.flatMap((study) => study.config.knob_values))]
  .sort((a, b) => a - b);
for (const study of studies) {
  if (study.config.study_knob !== "quality_ncand") throw new Error(`unsupported study knob ${study.config.study_knob}`);
  if (study.config.baseline_value !== baselineQ) {
    throw new Error(`mixed baseline q values: ${baselineQ} and ${study.config.baseline_value}`);
  }
}

const allRows = dedupeRows(studies.flatMap((study) => study.rows));
const allSamples = allRows
  .map((row): Sample | null => {
    if (
      row.first_completion_frame === null ||
      row.predicted_first_completion_frames === null ||
      row.predicted_first_completion_frames <= 0
    ) return null;
    return {
      ...row,
      first: row.first_completion_frame,
      current_d: row.predicted_first_completion_frames,
    };
  })
  .filter((row): row is Sample => row !== null);

const completeness = completenessMatrix(allSamples, configuredSpecs.length, configuredSeeds.length, configuredQ);
const completeBudgets = detectCompleteBudgets(completeness, configuredQ);
const analyzedBudgets = includePartial
  ? [...new Set(allSamples.map((row) => row.budget))].sort((a, b) => a - b)
  : completeBudgets;
const samples = allSamples.filter((row) => analyzedBudgets.includes(row.budget));

const specFeatures = new Map<string, SpecFeatures>();
for (const specName of [...new Set(samples.map((row) => row.spec))].sort()) {
  specFeatures.set(specName, featuresForSpec(await loadGoldenSpec(specName as GoldenSpecName, "base")));
}

const pairs = pairedSamples(samples);
const costModels = buildCostModels();
const scoreModels = buildScoreModels();
const repairModels = buildRepairModels();
const firstRatioModels = buildFirstRatioModels();
const candidateRatioModels = buildCandidateRatioModels();
const costResults = costModels.map((model) => evaluateCostModel(model, samples))
  .filter((result): result is CostModelResult => result !== null)
  .sort((a, b) => (a.leave_one_spec_out?.mae ?? Infinity) - (b.leave_one_spec_out?.mae ?? Infinity));
const scoreResults = scoreModels.map((model) => evaluateResponseModel(model, pairs))
  .filter((result): result is ResponseModelResult => result !== null)
  .sort((a, b) => (a.leave_one_spec_out?.mae ?? Infinity) - (b.leave_one_spec_out?.mae ?? Infinity));
const repairResults = repairModels.map((model) => evaluateResponseModel(model, pairs))
  .filter((result): result is ResponseModelResult => result !== null)
  .sort((a, b) => (a.leave_one_spec_out?.mae ?? Infinity) - (b.leave_one_spec_out?.mae ?? Infinity));
const firstRatioResults = firstRatioModels.map((model) => evaluateResponseModel(model, pairs))
  .filter((result): result is ResponseModelResult => result !== null)
  .sort((a, b) => (a.leave_one_spec_out?.mae ?? Infinity) - (b.leave_one_spec_out?.mae ?? Infinity));
const candidateRatioResults = candidateRatioModels.map((model) => evaluateResponseModel(model, pairs))
  .filter((result): result is ResponseModelResult => result !== null)
  .sort((a, b) => (a.leave_one_spec_out?.mae ?? Infinity) - (b.leave_one_spec_out?.mae ?? Infinity));
const qSummaries = summarizeQ(pairs);
const qByBudget = [...groupBy(pairs, (pair) => String(pair.budget)).entries()]
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([budget, group]) => ({ budget: Number(budget), q: summarizeQ(group) }));
const qBySlackBand = [...groupBy(pairs, (pair) => slackBand(pair.slack)).entries()]
  .sort(([a], [b]) => compareBand(a, b))
  .map(([slack_band, group]) => ({ slack_band, q: summarizeQ(group) }));
const qByContactBand = [...groupBy(pairs, (pair) => contactBand(feature(pair, "contact_count"))).entries()]
  .sort(([a], [b]) => compareBand(a, b))
  .map(([contact_band, group]) => ({ contact_band, q: summarizeQ(group) }));
const qByDurationBand = [...groupBy(pairs, (pair) => durationBand(feature(pair, "duration_frames"))).entries()]
  .sort(([a], [b]) => compareBand(a, b))
  .map(([duration_band, group]) => ({ duration_band, q: summarizeQ(group) }));
const qByMedianGapBand = [...groupBy(pairs, (pair) => gapBand(feature(pair, "median_gap_frames"))).entries()]
  .sort(([a], [b]) => compareBand(a, b))
  .map(([median_gap_band, group]) => ({ median_gap_band, q: summarizeQ(group) }));
const qByMinGapBand = [...groupBy(pairs, (pair) => gapBand(feature(pair, "min_gap_frames"))).entries()]
  .sort(([a], [b]) => compareBand(a, b))
  .map(([min_gap_band, group]) => ({ min_gap_band, q: summarizeQ(group) }));
const specElasticity = elasticityBy(pairs, (pair) => pair.spec)
  .map((item) => ({
    ...item,
    ...featureSummary(item.key),
  }))
  .sort((a, b) => b.beta - a.beta);
const budgetElasticity = elasticityBy(pairs, (pair) => String(pair.budget))
  .sort((a, b) => Number(a.key) - Number(b.key));
const elasticityFeatureModel = fitElasticityFeatureModel(specElasticity);
const tradeoff = tradeoffSummary(pairs);
const qPreferenceBySpec = qPreference(samples, (row) => row.spec);
const qPreferenceBySpecBudget = qPreference(samples, (row) => `${row.budget}|${row.spec}`);
const policies = simulatePolicies(samples);

const output = {
  config: {
    inputs: usedInputPaths,
    skipped_inputs: inputPaths.length - usedInputPaths.length,
    include_partial: includePartial,
    rows_available: allRows.length,
    samples_available: allSamples.length,
    rows_analyzed: samples.length,
    pairs_analyzed: pairs.length,
    duplicate_rows_removed: studies.flatMap((study) => study.rows).length - allRows.length,
    completeness,
    complete_budgets: completeBudgets,
    analyzed_budgets: analyzedBudgets,
    specs: [...new Set(samples.map((row) => row.spec))].sort(),
    seeds: [...new Set(samples.map((row) => row.seed))].sort((a, b) => a - b),
    q_values: configuredQ,
    baseline_q: baselineQ,
  },
  first_completion_models: costResults,
  first_ratio_models: firstRatioResults,
  candidate_ratio_models: candidateRatioResults,
  score_delta_models: scoreResults,
  repair_delta_models: repairResults,
  q_response: {
    all: qSummaries,
    by_budget: qByBudget,
    by_slack_band: qBySlackBand,
    by_contact_band: qByContactBand,
    by_duration_band: qByDurationBand,
    by_median_gap_band: qByMedianGapBand,
    by_min_gap_band: qByMinGapBand,
  },
  q_elasticity: {
    by_budget: budgetElasticity,
    by_spec_top_cost_sensitive: specElasticity.slice(0, 12),
    by_spec_bottom_cost_sensitive: [...specElasticity].reverse().slice(0, 12),
    feature_model: elasticityFeatureModel,
  },
  q_preference: {
    by_budget: qPreference(samples, (row) => String(row.budget)),
    by_slack_band: qPreference(samples, (row) => slackBand(row.budget / row.current_d)),
    by_contact_band: qPreference(samples, (row) => contactBand(feature(row, "contact_count"))),
    by_duration_band: qPreference(samples, (row) => durationBand(feature(row, "duration_frames"))),
    by_median_gap_band: qPreference(samples, (row) => gapBand(feature(row, "median_gap_frames"))),
    by_min_gap_band: qPreference(samples, (row) => gapBand(feature(row, "min_gap_frames"))),
    by_spec: qPreferenceBySpec,
    by_spec_budget_top: qPreferenceBySpecBudget.slice(0, 24),
    by_spec_budget_bottom: [...qPreferenceBySpecBudget].reverse().slice(0, 24),
  },
  repair_tradeoff: tradeoff,
  policy_simulation: policies,
};

if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
}

printSummary(output);
if (outPath !== undefined) console.log(`wrote ${outPath}`);

function buildCostModels(): ModelSpec<Sample>[] {
  const qx = (row: Sample) => row.quality_ncand / baselineQ - 1;
  const qlog = (row: Sample) => Math.log(row.quality_ncand / baselineQ);
  const logBudget = (row: Sample) => Math.log(row.budget);
  const logSlack = (row: Sample) => Math.log(Math.max(1e-9, row.budget / row.current_d));
  return [
    {
      name: "current_D_identity",
      family: "current_d",
      target: "first_completion_frame",
      actual: (row) => row.first,
      fit: () => ({ predict: (row) => row.current_d }),
    },
    {
      name: "current_D_q_linear",
      family: "current_d_q",
      target: "first/current_D",
      actual: (row) => row.first,
      fit: (train) => fitRatioModel(train, [qx]),
    },
    {
      name: "current_D_log_q_linear",
      family: "current_d_q",
      target: "log(first/current_D)",
      actual: (row) => row.first,
      fit: (train) => fitLogRatioModel(train, [qx]),
    },
    {
      name: "current_D_q_quadratic",
      family: "current_d_q",
      target: "first/current_D",
      actual: (row) => row.first,
      fit: (train) => fitRatioModel(train, [qx, (row) => qx(row) ** 2]),
    },
    {
      name: "current_D_q_slack_interaction",
      family: "current_d_q_slack",
      target: "log(first/current_D)",
      actual: (row) => row.first,
      fit: (train) => fitLogRatioModel(train, [
        qx,
        logSlack,
        (row) => qx(row) * logSlack(row),
      ]),
    },
    {
      name: "current_D_q_budget_interaction",
      family: "current_d_q_budget",
      target: "log(first/current_D)",
      actual: (row) => row.first,
      fit: (train) => fitLogRatioModel(train, [
        qx,
        logBudget,
        (row) => qx(row) * logBudget(row),
      ]),
    },
    {
      name: "spec_features_log_q",
      family: "spec_features",
      target: "log(first)",
      actual: (row) => row.first,
      fit: (train) => fitLogDirectModel(train, [
        (row) => Math.log1p(feature(row, "contact_count")),
        (row) => Math.log1p(feature(row, "duration_frames")),
        qlog,
      ]),
    },
    {
      name: "spec_features_spacing_log_q",
      family: "spec_features",
      target: "log(first)",
      actual: (row) => row.first,
      fit: (train) => fitLogDirectModel(train, [
        (row) => Math.log1p(feature(row, "contact_count")),
        (row) => Math.log1p(feature(row, "duration_frames")),
        (row) => Math.log1p(feature(row, "inverse_gap_sum")),
        qlog,
      ]),
    },
  ];
}

function buildScoreModels(): ModelSpec<PairSample>[] {
  return [
    {
      name: "score_q_only",
      family: "score_delta",
      target: "score_delta",
      actual: (row) => row.score_delta,
      fit: (train) => fitDirectModel(train, [(row) => row.qx], (row) => row.score_delta),
    },
    {
      name: "score_q_budget_slack",
      family: "score_delta",
      target: "score_delta",
      actual: (row) => row.score_delta,
      fit: (train) => fitDirectModel(train, [
        (row) => row.qx,
        (row) => Math.log(row.budget),
        (row) => Math.log(Math.max(1e-9, row.slack)),
        (row) => row.qx * Math.log(Math.max(1e-9, row.slack)),
      ], (row) => row.score_delta),
    },
    {
      name: "score_q_cost_repair",
      family: "score_delta",
      target: "score_delta",
      actual: (row) => row.score_delta,
      fit: (train) => fitDirectModel(train, [
        (row) => row.qx,
        (row) => row.first_ratio,
        (row) => row.repair_delta / 10000,
        (row) => row.candidate_ratio,
      ], (row) => row.score_delta),
    },
    {
      name: "score_q_spec_features",
      family: "score_delta",
      target: "score_delta",
      actual: (row) => row.score_delta,
      fit: (train) => fitDirectModel(train, [
        (row) => row.qx,
        (row) => Math.log1p(feature(row, "contact_count")),
        (row) => Math.log1p(feature(row, "duration_frames")),
        (row) => Math.log1p(feature(row, "inverse_gap_sum")),
      ], (row) => row.score_delta),
    },
  ];
}

function buildRepairModels(): ModelSpec<PairSample>[] {
  return [
    {
      name: "repair_q_only",
      family: "repair_delta",
      target: "repair_delta",
      actual: (row) => row.repair_delta,
      fit: (train) => fitDirectModel(train, [(row) => row.qx], (row) => row.repair_delta),
    },
    {
      name: "repair_q_first_delta",
      family: "repair_delta",
      target: "repair_delta",
      actual: (row) => row.repair_delta,
      fit: (train) => fitDirectModel(train, [
        (row) => row.qx,
        (row) => row.first_delta,
      ], (row) => row.repair_delta),
    },
    {
      name: "repair_q_budget_slack",
      family: "repair_delta",
      target: "repair_delta",
      actual: (row) => row.repair_delta,
      fit: (train) => fitDirectModel(train, [
        (row) => row.qx,
        (row) => Math.log(row.budget),
        (row) => Math.log(Math.max(1e-9, row.slack)),
      ], (row) => row.repair_delta),
    },
  ];
}

function buildFirstRatioModels(): ModelSpec<PairSample>[] {
  return [
    {
      name: "first_ratio_q_linear",
      family: "first_ratio",
      target: "first_ratio_vs_q32",
      actual: (row) => row.first_ratio,
      fit: (train) => fitDirectModel(train, [(row) => row.qx], (row) => row.first_ratio),
    },
    {
      name: "first_ratio_q_quadratic",
      family: "first_ratio",
      target: "first_ratio_vs_q32",
      actual: (row) => row.first_ratio,
      fit: (train) => fitDirectModel(train, [
        (row) => row.qx,
        (row) => row.qx ** 2,
      ], (row) => row.first_ratio),
    },
    {
      name: "first_ratio_q_budget_slack",
      family: "first_ratio",
      target: "first_ratio_vs_q32",
      actual: (row) => row.first_ratio,
      fit: (train) => fitDirectModel(train, [
        (row) => row.qx,
        (row) => Math.log(row.budget),
        (row) => Math.log(Math.max(1e-9, row.slack)),
        (row) => row.qx * Math.log(Math.max(1e-9, row.slack)),
      ], (row) => row.first_ratio),
    },
    {
      name: "first_ratio_q_spec_features",
      family: "first_ratio",
      target: "first_ratio_vs_q32",
      actual: (row) => row.first_ratio,
      fit: (train) => fitDirectModel(train, [
        (row) => row.qx,
        (row) => Math.log1p(feature(row, "contact_count")),
        (row) => Math.log1p(feature(row, "duration_frames")),
        (row) => Math.log1p(feature(row, "inverse_gap_sum")),
      ], (row) => row.first_ratio),
    },
  ];
}

function buildCandidateRatioModels(): ModelSpec<PairSample>[] {
  return [
    {
      name: "candidate_ratio_q_linear",
      family: "candidate_ratio",
      target: "candidate_ratio_vs_q32",
      actual: (row) => row.candidate_ratio,
      fit: (train) => fitDirectModel(train, [(row) => row.qx], (row) => row.candidate_ratio),
    },
    {
      name: "candidate_ratio_q_quadratic",
      family: "candidate_ratio",
      target: "candidate_ratio_vs_q32",
      actual: (row) => row.candidate_ratio,
      fit: (train) => fitDirectModel(train, [
        (row) => row.qx,
        (row) => row.qx ** 2,
      ], (row) => row.candidate_ratio),
    },
    {
      name: "candidate_ratio_q_budget_slack",
      family: "candidate_ratio",
      target: "candidate_ratio_vs_q32",
      actual: (row) => row.candidate_ratio,
      fit: (train) => fitDirectModel(train, [
        (row) => row.qx,
        (row) => Math.log(row.budget),
        (row) => Math.log(Math.max(1e-9, row.slack)),
        (row) => row.qx * Math.log(Math.max(1e-9, row.slack)),
      ], (row) => row.candidate_ratio),
    },
    {
      name: "candidate_ratio_q_spec_features",
      family: "candidate_ratio",
      target: "candidate_ratio_vs_q32",
      actual: (row) => row.candidate_ratio,
      fit: (train) => fitDirectModel(train, [
        (row) => row.qx,
        (row) => Math.log1p(feature(row, "contact_count")),
        (row) => Math.log1p(feature(row, "duration_frames")),
        (row) => Math.log1p(feature(row, "inverse_gap_sum")),
      ], (row) => row.candidate_ratio),
    },
  ];
}

function evaluateCostModel(model: ModelSpec<Sample>, rowsIn: Sample[]): CostModelResult | null {
  const fitted = model.fit(rowsIn);
  if (fitted === null) return null;
  const actual = rowsIn.map(model.actual);
  const predicted = rowsIn.map((row) => fitted.predict(row));
  return {
    model: model.name,
    family: model.family,
    target: model.target,
    train: metric(actual, predicted),
    leave_one_spec_out: crossValidate(model, rowsIn, (row) => row.spec),
    leave_one_budget_out: crossValidate(model, rowsIn, (row) => String(row.budget)),
    leave_one_seed_out: crossValidate(model, rowsIn, (row) => String(row.seed)),
    residuals: {
      by_budget: residualGroups(rowsIn, actual, predicted, (row) => String(row.budget)),
      by_q: residualGroups(rowsIn, actual, predicted, (row) => String(row.quality_ncand)),
      worst_specs: residualGroups(rowsIn, actual, predicted, (row) => row.spec)
        .sort((a, b) => b.mae - a.mae)
        .slice(0, 12),
    },
  };
}

function evaluateResponseModel<T>(
  model: ModelSpec<T>,
  rowsIn: T[],
): ResponseModelResult | null {
  const fitted = model.fit(rowsIn);
  if (fitted === null) return null;
  const actual = rowsIn.map(model.actual);
  const predicted = rowsIn.map((row) => fitted.predict(row));
  return {
    model: model.name,
    target: model.target,
    train: metric(actual, predicted),
    leave_one_spec_out: crossValidate(model, rowsIn, (row) => String((row as PairSample).spec)),
    leave_one_budget_out: crossValidate(model, rowsIn, (row) => String((row as PairSample).budget)),
    leave_one_seed_out: crossValidate(model, rowsIn, (row) => String((row as PairSample).seed)),
  };
}

function crossValidate<T>(
  model: ModelSpec<T>,
  rowsIn: T[],
  keyOf: (row: T) => string,
): Metrics | null {
  const keys = [...new Set(rowsIn.map(keyOf))].sort();
  if (keys.length < 2) return null;
  const actual: number[] = [];
  const predicted: number[] = [];
  for (const key of keys) {
    const train = rowsIn.filter((row) => keyOf(row) !== key);
    const test = rowsIn.filter((row) => keyOf(row) === key);
    const fitted = model.fit(train);
    if (fitted === null) continue;
    for (const row of test) {
      actual.push(model.actual(row));
      predicted.push(fitted.predict(row));
    }
  }
  return actual.length > 0 ? metric(actual, predicted) : null;
}

function fitRatioModel(
  train: Sample[],
  features: ((row: Sample) => number)[],
): FittedModel<Sample> | null {
  const ys = train.map((row) => row.first / row.current_d);
  const model = fitOls(train, features, ys);
  if (model === null) return null;
  return {
    predict: (row) => row.current_d * Math.max(0.05, model.predict(row)),
  };
}

function fitLogRatioModel(
  train: Sample[],
  features: ((row: Sample) => number)[],
): FittedModel<Sample> | null {
  const ys = train.map((row) => Math.log(Math.max(1e-9, row.first / row.current_d)));
  const model = fitOls(train, features, ys);
  if (model === null) return null;
  return {
    predict: (row) => row.current_d * Math.exp(model.predict(row)),
  };
}

function fitLogDirectModel(
  train: Sample[],
  features: ((row: Sample) => number)[],
): FittedModel<Sample> | null {
  const ys = train.map((row) => Math.log(Math.max(1, row.first)));
  const model = fitOls(train, features, ys);
  if (model === null) return null;
  return {
    predict: (row) => Math.exp(model.predict(row)),
  };
}

function fitDirectModel<T>(
  train: T[],
  features: ((row: T) => number)[],
  target: (row: T) => number,
): FittedModel<T> | null {
  const ys = train.map(target);
  return fitOls(train, features, ys);
}

function fitOls<T>(
  rowsIn: T[],
  features: ((row: T) => number)[],
  ys: number[],
): FittedModel<T> | null {
  if (rowsIn.length <= features.length + 1) return null;
  const means = features.map((fn) => mean(rowsIn.map(fn)));
  const stds = features.map((fn) => {
    const sd = stddev(rowsIn.map(fn));
    return sd > 1e-12 ? sd : 1;
  });
  const xtx = Array.from({ length: features.length + 1 }, () => Array(features.length + 1).fill(0));
  const xty = Array(features.length + 1).fill(0);
  for (let rowIndex = 0; rowIndex < rowsIn.length; rowIndex++) {
    const row = rowsIn[rowIndex];
    const x = [1, ...features.map((fn, index) => (fn(row) - means[index]) / stds[index])];
    for (let i = 0; i < x.length; i++) {
      xty[i] += x[i] * ys[rowIndex];
      for (let j = 0; j < x.length; j++) xtx[i][j] += x[i] * x[j];
    }
  }
  const ridge = 1e-8 * Math.max(1, rowsIn.length);
  for (let i = 1; i < xtx.length; i++) xtx[i][i] += ridge;
  const beta = solveLinearSystem(xtx, xty);
  const coefficients = features.map((_, index) => beta[index + 1] / stds[index]);
  const intercept = beta[0] - coefficients.reduce((sum, coefficient, index) =>
    sum + coefficient * means[index], 0);
  return {
    predict: (row) => intercept + coefficients.reduce((sum, coefficient, index) =>
      sum + coefficient * features[index](row), 0),
  };
}

function completenessMatrix(
  rowsIn: Sample[],
  specCount: number,
  seedCount: number,
  qValues: number[],
): CompletenessRow[] {
  const expectedPerQ = specCount * seedCount;
  const byBudgetQ = new Map<string, number>();
  for (const row of rowsIn) {
    const key = `${row.budget}|${row.quality_ncand}`;
    byBudgetQ.set(key, (byBudgetQ.get(key) ?? 0) + 1);
  }
  const budgets = [...new Set(rowsIn.map((row) => row.budget))].sort((a, b) => a - b);
  return budgets.flatMap((budget) =>
    qValues.map((q) => {
      const rows = byBudgetQ.get(`${budget}|${q}`) ?? 0;
      return {
        budget,
        q,
        rows,
        expected_rows: expectedPerQ,
        complete: rows === expectedPerQ,
      };
    })
  );
}

function detectCompleteBudgets(
  completenessRows: CompletenessRow[],
  qValues: number[],
): number[] {
  const byBudget = groupBy(completenessRows, (row) => String(row.budget));
  return [...byBudget.entries()]
    .filter(([, rows]) => qValues.every((q) =>
      rows.some((row) => row.q === q && row.complete)
    ))
    .map(([budget]) => Number(budget))
    .sort((a, b) => a - b);
}

function pairedSamples(rowsIn: Sample[]): PairSample[] {
  const baseline = new Map<string, Sample>();
  for (const row of rowsIn) {
    if (row.quality_ncand === baselineQ) baseline.set(pairKey(row), row);
  }
  const pairs: PairSample[] = [];
  for (const row of rowsIn) {
    if (row.quality_ncand === baselineQ) continue;
    const base = baseline.get(pairKey(row));
    if (base === undefined || base.first <= 0 || base.candidates_sampled <= 0) continue;
    const qx = row.quality_ncand / baselineQ - 1;
    pairs.push({
      key: pairKey(row),
      budget: row.budget,
      spec: row.spec,
      seed: row.seed,
      q: row.quality_ncand,
      qx,
      qlog: Math.log(row.quality_ncand / baselineQ),
      slack: row.budget / row.current_d,
      score_delta: row.score - base.score,
      first_delta: row.first - base.first,
      first_ratio: row.first / base.first,
      candidate_delta: row.candidates_sampled - base.candidates_sampled,
      candidate_ratio: row.candidates_sampled / base.candidates_sampled,
      repair_delta: row.repair_frames_spent - base.repair_frames_spent,
      fwd_delta: (row.fwd_eval_frames_charged ?? 0) - (base.fwd_eval_frames_charged ?? 0),
      score: row.score,
      baseline_score: base.score,
    });
  }
  return pairs;
}

function summarizeQ(pairsIn: PairSample[]): QSummary[] {
  return [...groupBy(pairsIn, (pair) => String(pair.q)).entries()]
    .map(([q, group]) => summarizeQGroup(Number(q), group))
    .sort((a, b) => a.q - b.q);
}

function summarizeQGroup(q: number, group: PairSample[]): QSummary {
  const naiveQRatio = q / baselineQ;
  const qDelta = naiveQRatio - 1;
  const firstRatio = mean(group.map((pair) => pair.first_ratio));
  const candidateRatio = mean(group.map((pair) => pair.candidate_ratio));
  return {
    q,
    pairs: group.length,
    naive_q_ratio: round(naiveQRatio, 4),
    score_delta_mean: round(mean(group.map((pair) => pair.score_delta)), 3),
    score_delta_p25: round(quantile(group.map((pair) => pair.score_delta), 0.25), 3),
    score_delta_p50: round(quantile(group.map((pair) => pair.score_delta), 0.5), 3),
    score_delta_p75: round(quantile(group.map((pair) => pair.score_delta), 0.75), 3),
    first_delta_mean: round(mean(group.map((pair) => pair.first_delta)), 1),
    first_ratio_mean: round(firstRatio, 4),
    first_ratio_p50: round(quantile(group.map((pair) => pair.first_ratio), 0.5), 4),
    first_ratio_p75: round(quantile(group.map((pair) => pair.first_ratio), 0.75), 4),
    first_ratio_p90: round(quantile(group.map((pair) => pair.first_ratio), 0.9), 4),
    candidate_ratio_mean: round(candidateRatio, 4),
    candidate_absorption: round(qDelta === 0 ? 0 : (candidateRatio - 1) / qDelta, 4),
    first_absorption: round(qDelta === 0 ? 0 : (firstRatio - 1) / qDelta, 4),
    fwd_delta_mean: round(mean(group.map((pair) => pair.fwd_delta)), 1),
    repair_delta_mean: round(mean(group.map((pair) => pair.repair_delta)), 1),
  };
}

function elasticityBy(pairsIn: PairSample[], keyOf: (pair: PairSample) => string): Elasticity[] {
  return [...groupBy(pairsIn, keyOf).entries()]
    .map(([key, group]) => {
      const firstLine = fitLine(group.map((pair) => pair.qx), group.map((pair) => pair.first_ratio));
      const scoreLine = fitLine(group.map((pair) => pair.qx), group.map((pair) => pair.score_delta));
      const q48 = group.filter((pair) => pair.q === 48);
      return {
        key,
        n: group.length,
        beta: round(firstLine.slope, 5),
        intercept: round(firstLine.intercept, 5),
        ratio_mae: round(mean(group.map((pair) =>
          Math.abs(pair.first_ratio - (firstLine.intercept + firstLine.slope * pair.qx))
        )), 4),
        score_slope: round(scoreLine.slope, 4),
        q48_score_delta_mean: q48.length > 0 ? round(mean(q48.map((pair) => pair.score_delta)), 3) : null,
        q48_first_ratio_mean: q48.length > 0 ? round(mean(q48.map((pair) => pair.first_ratio)), 4) : null,
      };
    });
}

function fitElasticityFeatureModel(items: Elasticity[]): {
  train: Metrics;
  leave_one_spec_out: Metrics | null;
  residuals: ResidualGroup[];
} | null {
  const usable = items.filter((item) => item.contact_count !== undefined);
  if (usable.length < 6) return null;
  type Row = Elasticity & Required<Pick<Elasticity, "contact_count" | "duration_frames" | "contact_density_per_second">>;
  const rowsIn = usable as Row[];
  const modelSpec: ModelSpec<Row> = {
    name: "elasticity_features",
    family: "elasticity",
    target: "beta",
    actual: (row) => row.beta,
    fit: (train) => fitOls(train, [
      (row) => Math.log1p(row.contact_count),
      (row) => Math.log1p(row.duration_frames),
      (row) => row.contact_density_per_second,
    ], train.map((row) => row.beta)),
  };
  const fitted = modelSpec.fit(rowsIn);
  if (fitted === null) return null;
  const actual = rowsIn.map((row) => row.beta);
  const predicted = rowsIn.map((row) => fitted.predict(row));
  return {
    train: metric(actual, predicted),
    leave_one_spec_out: crossValidate(modelSpec, rowsIn, (row) => row.key),
    residuals: residualGroups(rowsIn, actual, predicted, (row) => row.key)
      .sort((a, b) => b.mae - a.mae)
      .slice(0, 12),
  };
}

function tradeoffSummary(pairsIn: PairSample[]): {
  all: {
    corr_first_repair: number;
    corr_first_score: number;
    corr_repair_score: number;
    corr_candidate_first: number;
  };
  by_q: {
    q: number;
    n: number;
    corr_first_repair: number;
    corr_first_score: number;
    corr_repair_score: number;
    repair_per_first_slope: number;
  }[];
} {
  return {
    all: {
      corr_first_repair: round(correlation(pairsIn.map((pair) => pair.first_delta), pairsIn.map((pair) => pair.repair_delta)), 4),
      corr_first_score: round(correlation(pairsIn.map((pair) => pair.first_delta), pairsIn.map((pair) => pair.score_delta)), 4),
      corr_repair_score: round(correlation(pairsIn.map((pair) => pair.repair_delta), pairsIn.map((pair) => pair.score_delta)), 4),
      corr_candidate_first: round(correlation(pairsIn.map((pair) => pair.candidate_delta), pairsIn.map((pair) => pair.first_delta)), 4),
    },
    by_q: [...groupBy(pairsIn, (pair) => String(pair.q)).entries()]
      .map(([q, group]) => {
        const line = fitLine(group.map((pair) => pair.first_delta), group.map((pair) => pair.repair_delta));
        return {
          q: Number(q),
          n: group.length,
          corr_first_repair: round(correlation(group.map((pair) => pair.first_delta), group.map((pair) => pair.repair_delta)), 4),
          corr_first_score: round(correlation(group.map((pair) => pair.first_delta), group.map((pair) => pair.score_delta)), 4),
          corr_repair_score: round(correlation(group.map((pair) => pair.repair_delta), group.map((pair) => pair.score_delta)), 4),
          repair_per_first_slope: round(line.slope, 4),
        };
      })
      .sort((a, b) => a.q - b.q),
  };
}

function qPreference(
  rowsIn: Sample[],
  keyOf: (row: Sample) => string,
): QPreferenceSummary[] {
  const byKeyQ = new Map<string, Sample>();
  for (const row of rowsIn) byKeyQ.set(`${pairKey(row)}|${row.quality_ncand}`, row);
  return [...groupBy(rowsIn, keyOf).entries()]
    .map(([key, group]): QPreferenceSummary | null => {
      const qMeans = [...groupBy(group, (row) => String(row.quality_ncand)).entries()]
        .map(([q, qGroup]) => ({
          q: Number(q),
          n: qGroup.length,
          score_mean: round(mean(qGroup.map((row) => row.score)), 3),
          first_mean: round(mean(qGroup.map((row) => row.first)), 1),
          candidate_mean: round(mean(qGroup.map((row) => row.candidates_sampled)), 1),
        }))
        .sort((a, b) => a.q - b.q);
      const baseline = qMeans.find((item) => item.q === baselineQ);
      if (baseline === undefined || qMeans.length === 0) return null;
      const best = [...qMeans].sort((a, b) => b.score_mean - a.score_mean)[0];
      const bases = group.filter((row) => row.quality_ncand === baselineQ);
      const selected = bases
        .map((base) => {
          const row = byKeyQ.get(`${pairKey(base)}|${best.q}`);
          return row === undefined ? null : { row, base };
        })
        .filter((item): item is { row: Sample; base: Sample } => item !== null);
      return {
        key,
        best_q: best.q,
        best_score_mean: best.score_mean,
        baseline_score_mean: baseline.score_mean,
        score_delta_vs_q32: round(mean(selected.map((item) => item.row.score - item.base.score)), 3),
        first_ratio_vs_q32: round(mean(selected.map((item) => item.row.first / item.base.first)), 4),
        candidate_ratio_vs_q32: round(mean(selected.map((item) =>
          item.base.candidates_sampled > 0 ? item.row.candidates_sampled / item.base.candidates_sampled : 1
        )), 4),
        q_means: qMeans,
      };
    })
    .filter((item): item is QPreferenceSummary => item !== null)
    .sort((a, b) => b.score_delta_vs_q32 - a.score_delta_vs_q32 || compareGroup(a.key, b.key));
}

function simulatePolicies(rowsIn: Sample[]): PolicyResult[] {
  const byKeyQ = new Map<string, Sample>();
  const keys = [...new Set(rowsIn.map(pairKey))].sort();
  for (const row of rowsIn) byKeyQ.set(`${pairKey(row)}|${row.quality_ncand}`, row);
  const baselineRows = keys
    .map((key) => byKeyQ.get(`${key}|${baselineQ}`))
    .filter((row): row is Sample => row !== undefined);
  const aggregates = {
    budget: scoreAggregate(rowsIn, (row) => String(row.budget)),
    spec: scoreAggregate(rowsIn, (row) => row.spec),
    specBudget: scoreAggregate(rowsIn, (row) => `${row.budget}|${row.spec}`),
    slackBand: scoreAggregate(rowsIn, (row) => slackBand(row.budget / row.current_d)),
    contactBand: scoreAggregate(rowsIn, (row) => contactBand(feature(row, "contact_count"))),
    durationBand: scoreAggregate(rowsIn, (row) => durationBand(feature(row, "duration_frames"))),
  };
  const policies: { name: string; choose: (key: string) => number | null }[] = [];
  for (const q of configuredQ) {
    policies.push({ name: `fixed_q${q}`, choose: () => q });
  }
  policies.push({
    name: "cv_budget_best_score_q",
    choose: (key) => chooseByAggregate(byKeyQ, aggregates.budget, key, (target) => String(target.budget)),
  });
  policies.push({
    name: "cv_spec_budget_best_score_q",
    choose: (key) => chooseByAggregate(byKeyQ, aggregates.specBudget, key, (target) =>
      `${target.budget}|${target.spec}`
    ),
  });
  policies.push({
    name: "cv_spec_best_score_q",
    choose: (key) => chooseByAggregate(byKeyQ, aggregates.spec, key, (target) => target.spec),
  });
  policies.push({
    name: "cv_slack_band_best_score_q",
    choose: (key) => chooseByAggregate(byKeyQ, aggregates.slackBand, key, (target) =>
      slackBand(target.budget / target.current_d)
    ),
  });
  policies.push({
    name: "cv_contact_band_best_score_q",
    choose: (key) => chooseByAggregate(byKeyQ, aggregates.contactBand, key, (target) =>
      contactBand(feature(target, "contact_count"))
    ),
  });
  policies.push({
    name: "cv_duration_band_best_score_q",
    choose: (key) => chooseByAggregate(byKeyQ, aggregates.durationBand, key, (target) =>
      durationBand(feature(target, "duration_frames"))
    ),
  });
  policies.push({
    name: "oracle_row_best_score",
    choose: (key) => {
      const options = configuredQ.map((q) => byKeyQ.get(`${key}|${q}`)).filter((row): row is Sample => row !== undefined);
      if (options.length === 0) return null;
      return [...options].sort((a, b) => b.score - a.score)[0].quality_ncand;
    },
  });
  return policies.map((policy) => {
    const selected: { row: Sample; base: Sample }[] = [];
    for (const base of baselineRows) {
      const key = pairKey(base);
      const q = policy.choose(key);
      if (q === null) continue;
      const row = byKeyQ.get(`${key}|${q}`);
      if (row !== undefined) selected.push({ row, base });
    }
    return summarizePolicy(policy.name, selected);
  }).sort((a, b) => b.score_delta_vs_q32 - a.score_delta_vs_q32);
}

function scoreAggregate(
  rowsIn: Sample[],
  scopeOf: (row: Sample) => string,
): Map<string, Map<number, ScoreStat>> {
  const aggregate = new Map<string, Map<number, ScoreStat>>();
  for (const row of rowsIn) {
    const scope = scopeOf(row);
    let byQ = aggregate.get(scope);
    if (byQ === undefined) {
      byQ = new Map();
      aggregate.set(scope, byQ);
    }
    const stat = byQ.get(row.quality_ncand) ?? { sum: 0, n: 0 };
    stat.sum += row.score;
    stat.n++;
    byQ.set(row.quality_ncand, stat);
  }
  return aggregate;
}

function chooseByAggregate(
  byKeyQ: Map<string, Sample>,
  aggregate: Map<string, Map<number, ScoreStat>>,
  key: string,
  scopeOf: (target: Sample) => string,
): number | null {
  const target = byKeyQ.get(`${key}|${baselineQ}`);
  if (target === undefined) return null;
  const byQ = aggregate.get(scopeOf(target));
  if (byQ === undefined) return null;
  let bestQ: number | null = null;
  let bestScore = -Infinity;
  for (const q of configuredQ) {
    const stat = byQ.get(q);
    if (stat === undefined) continue;
    const own = byKeyQ.get(`${key}|${q}`);
    const scoreSum = stat.sum - (own?.score ?? 0);
    const count = stat.n - (own === undefined ? 0 : 1);
    if (count <= 0) continue;
    const score = scoreSum / count;
    if (score > bestScore) {
      bestScore = score;
      bestQ = q;
    }
  }
  return bestQ;
}

function summarizePolicy(policy: string, selected: { row: Sample; base: Sample }[]): PolicyResult {
  const qCounts = [...groupBy(selected, (item) => String(item.row.quality_ncand)).entries()]
    .map(([q, group]) => ({ q: Number(q), n: group.length }))
    .sort((a, b) => a.q - b.q);
  return {
    policy,
    n: selected.length,
    score_mean: round(mean(selected.map((item) => item.row.score)), 3),
    score_delta_vs_q32: round(mean(selected.map((item) => item.row.score - item.base.score)), 3),
    first_ratio_vs_q32: round(mean(selected.map((item) => item.row.first / item.base.first)), 4),
    candidate_ratio_vs_q32: round(mean(selected.map((item) =>
      item.base.candidates_sampled > 0 ? item.row.candidates_sampled / item.base.candidates_sampled : 1
    )), 4),
    selected_q_mean: round(mean(selected.map((item) => item.row.quality_ncand)), 2),
    selected_q_counts: qCounts,
  };
}

function residualGroups<T>(
  rowsIn: T[],
  actual: number[],
  predicted: number[],
  keyOf: (row: T) => string,
): ResidualGroup[] {
  const groups = new Map<string, { actual: number; predicted: number }[]>();
  for (let i = 0; i < rowsIn.length; i++) {
    const key = keyOf(rowsIn[i]);
    const group = groups.get(key);
    const item = { actual: actual[i], predicted: predicted[i] };
    if (group === undefined) groups.set(key, [item]);
    else group.push(item);
  }
  return [...groups.entries()]
    .map(([key, values]) => {
      const errors = values.map((value) => value.actual - value.predicted);
      return {
        key,
        n: values.length,
        mae: round(mean(errors.map(Math.abs)), 4),
        bias: round(mean(errors), 4),
        actual_mean: round(mean(values.map((value) => value.actual)), 4),
        predicted_mean: round(mean(values.map((value) => value.predicted)), 4),
      };
    })
    .sort((a, b) => compareGroup(a.key, b.key));
}

function feature(row: Pick<Sample | PairSample, "spec">, name: keyof SpecFeatures): number {
  return specFeatures.get(row.spec)?.[name] ?? 0;
}

function featureSummary(spec: string): Partial<Elasticity> {
  const features = specFeatures.get(spec);
  if (features === undefined) return {};
  return {
    contact_count: features.contact_count,
    duration_frames: features.duration_frames,
    contact_density_per_second: round(features.contact_density_per_second, 4),
  };
}

function featuresForSpec(spec: Spec): SpecFeatures {
  const durationFrames = secToFrame(spec.duration);
  const contactFrames = spec.contacts
    .map((contact) => secToFrame(contact.t))
    .filter((frame) => frame >= K_BOUNCE_LANDING)
    .sort((a, b) => a - b);
  const gaps: number[] = [];
  let cursor = 0;
  for (const frame of contactFrames) {
    gaps.push(Math.max(1, frame - cursor));
    cursor = frame;
  }
  return {
    contact_count: contactFrames.length,
    duration_frames: durationFrames,
    inverse_gap_sum: gaps.reduce((sum, gap) => sum + FPS / gap, 0),
    median_gap_frames: median(gaps),
    min_gap_frames: gaps.length > 0 ? Math.min(...gaps) : 0,
    contact_density_per_second: contactFrames.length / Math.max(1e-9, spec.duration),
  };
}

function dedupeRows(rowsIn: StudyRow[]): StudyRow[] {
  const byKey = new Map<string, StudyRow>();
  for (const row of rowsIn) byKey.set(rowKey(row), row);
  return [...byKey.values()];
}

function inputList(): string[] {
  const raw = arg("inputs");
  if (raw !== undefined && raw.trim() !== "") return raw.split(",").filter((value) => value.trim() !== "");
  const dir = arg("dir");
  if (dir !== undefined && dir.trim() !== "") return jsonFiles(dir).sort();
  return argv.filter((value) => !value.startsWith("--"));
}

function jsonFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...jsonFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      out.push(path);
    }
  }
  return out;
}

function readStudy(path: string): StudyFile {
  return JSON.parse(readFileSync(path, "utf8")) as StudyFile;
}

function readStudyMaybe(path: string): StudyFile | null {
  try {
    const parsed = readStudy(path);
    if (
      parsed.config?.study_knob === "quality_ncand" &&
      Number.isFinite(parsed.config.baseline_value) &&
      Array.isArray(parsed.rows)
    ) return parsed;
    return null;
  } catch {
    return null;
  }
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function boolArg(name: string, fallback: boolean): boolean {
  const raw = arg(name);
  if (raw === undefined) return fallback;
  if (raw === "" || raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return fallback;
}

function pairKey(row: Pick<StudyRow, "budget" | "spec" | "seed">): string {
  return `${row.budget}|${row.spec}|${row.seed}`;
}

function rowKey(row: Pick<StudyRow, "budget" | "spec" | "seed" | "quality_ncand">): string {
  return `${row.budget}|${row.spec}|${row.seed}|${row.quality_ncand}`;
}

function groupBy<T>(values: readonly T[], keyOf: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [value]);
    else group.push(value);
  }
  return groups;
}

function compareGroup(a: string, b: string): number {
  const an = Number(a);
  const bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return a.localeCompare(b);
}

function slackBand(slack: number): string {
  if (!Number.isFinite(slack)) return "na";
  if (slack < 2) return "<2";
  if (slack < 3) return "2-3";
  if (slack < 5) return "3-5";
  if (slack < 8) return "5-8";
  if (slack < 12) return "8-12";
  return ">=12";
}

function contactBand(contactCount: number): string {
  if (contactCount < 12) return "<12";
  if (contactCount < 20) return "12-19";
  if (contactCount < 32) return "20-31";
  if (contactCount < 48) return "32-47";
  return ">=48";
}

function durationBand(durationFrames: number): string {
  const seconds = durationFrames / FPS;
  if (seconds < 12) return "<12s";
  if (seconds < 18) return "12-18s";
  if (seconds < 24) return "18-24s";
  return ">=24s";
}

function gapBand(frames: number): string {
  const seconds = frames / FPS;
  if (seconds < 0.5) return "<0.5s";
  if (seconds < 0.75) return "0.5-0.75s";
  if (seconds < 1.0) return "0.75-1.0s";
  if (seconds < 1.5) return "1.0-1.5s";
  return ">=1.5s";
}

function compareBand(a: string, b: string): number {
  const order = new Map([
    ["<2", 0],
    ["2-3", 1],
    ["3-5", 2],
    ["5-8", 3],
    ["8-12", 4],
    [">=12", 5],
    ["<12", 10],
    ["12-19", 11],
    ["20-31", 12],
    ["32-47", 13],
    [">=48", 14],
    ["<12s", 20],
    ["12-18s", 21],
    ["18-24s", 22],
    [">=24s", 23],
    ["<0.5s", 30],
    ["0.5-0.75s", 31],
    ["0.75-1.0s", 32],
    ["1.0-1.5s", 33],
    [">=1.5s", 34],
    ["na", 99],
  ]);
  const ai = order.get(a);
  const bi = order.get(b);
  if (ai !== undefined && bi !== undefined) return ai - bi;
  return compareGroup(a, b);
}

function metric(actual: number[], predicted: number[]): Metrics {
  const errors = actual.map((value, index) => value - predicted[index]);
  return {
    n: actual.length,
    r2: round(r2(actual, predicted), 4),
    mae: round(mean(errors.map(Math.abs)), 4),
    rmse: round(Math.sqrt(mean(errors.map((error) => error * error))), 4),
    mape: round(mean(errors.map((error, index) => Math.abs(error) / Math.max(1, Math.abs(actual[index])))), 4),
    bias: round(mean(errors), 4),
  };
}

function r2(actual: number[], predicted: number[]): number {
  const yMean = mean(actual);
  const sst = actual.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const sse = actual.reduce((sum, value, index) => sum + (value - predicted[index]) ** 2, 0);
  return 1 - sse / Math.max(1e-12, sst);
}

function fitLine(xs: number[], ys: number[]): { intercept: number; slope: number } {
  const xMean = mean(xs);
  const yMean = mean(ys);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxx += (xs[i] - xMean) ** 2;
    sxy += (xs[i] - xMean) * (ys[i] - yMean);
  }
  const slope = sxx > 1e-12 ? sxy / sxx : 0;
  return { intercept: yMean - slope * xMean, slope };
}

function solveLinearSystem(aIn: number[][], bIn: number[]): number[] {
  const n = bIn.length;
  const a = aIn.map((row) => [...row]);
  const b = [...bIn];
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) continue;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    const div = a[col][col];
    for (let j = col; j < n; j++) a[col][j] /= div;
    b[col] /= div;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      if (factor === 0) continue;
      for (let j = col; j < n; j++) a[row][j] -= factor * a[col][j];
      b[row] -= factor * b[col];
    }
  }
  return b;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number {
  return quantile(values, 0.5);
}

function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function stddev(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function correlation(xs: readonly number[], ys: readonly number[]): number {
  if (xs.length !== ys.length || xs.length === 0) return 0;
  const xMean = mean(xs);
  const yMean = mean(ys);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  return sxy / Math.max(1e-12, Math.sqrt(sxx * syy));
}

function round(value: number, digits = 3): number {
  if (!Number.isFinite(value)) return value;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function fmt(value: number | null | undefined, digits = 0): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "na" : value.toFixed(digits);
}

function printSummary(result: typeof output): void {
  console.log(
    `qcand-surface: rows=${result.config.rows_analyzed}/${result.config.rows_available} ` +
      `budgets=${result.config.analyzed_budgets.join(",")} specs=${result.config.specs.length} ` +
      `seeds=${result.config.seeds.length} q=${result.config.q_values.join(",")}`,
  );
  console.log("first-completion model ranking:");
  for (const model of result.first_completion_models.slice(0, 8)) {
    console.log(
      `  ${model.model} train=${fmt(model.train.mae)}f ` +
        `loso=${fmt(model.leave_one_spec_out?.mae)}f ` +
        `lobo=${fmt(model.leave_one_budget_out?.mae)}f ` +
        `loseed=${fmt(model.leave_one_seed_out?.mae)}f ` +
        `r2=${fmt(model.leave_one_spec_out?.r2, 3)}`,
    );
  }
  console.log("score-delta model ranking:");
  for (const model of result.score_delta_models.slice(0, 4)) {
    console.log(
      `  ${model.model} train=${fmt(model.train.mae, 2)} ` +
        `loso=${fmt(model.leave_one_spec_out?.mae, 2)} ` +
        `lobo=${fmt(model.leave_one_budget_out?.mae, 2)} ` +
        `r2=${fmt(model.leave_one_spec_out?.r2, 3)}`,
    );
  }
  console.log("q response:");
  for (const row of result.q_response.all) {
    console.log(
      `  q=${row.q} pairs=${row.pairs} dScore=${row.score_delta_mean.toFixed(2)} ` +
        `first=${row.first_ratio_mean.toFixed(3)} p75=${row.first_ratio_p75.toFixed(3)} ` +
        `cand=${row.candidate_ratio_mean.toFixed(3)}`,
    );
  }
  console.log(
    `tradeoff: corr(first,repair)=${result.repair_tradeoff.all.corr_first_repair.toFixed(3)} ` +
      `corr(first,score)=${result.repair_tradeoff.all.corr_first_score.toFixed(3)} ` +
      `corr(repair,score)=${result.repair_tradeoff.all.corr_repair_score.toFixed(3)}`,
  );
  console.log("policy simulation:");
  for (const policy of result.policy_simulation.slice(0, 8)) {
    console.log(
      `  ${policy.policy} dScore=${policy.score_delta_vs_q32.toFixed(2)} ` +
        `first=${policy.first_ratio_vs_q32.toFixed(3)} qMean=${policy.selected_q_mean.toFixed(1)}`,
    );
  }
}
