/**
 * Difficulty-model study for compileHandoff.
 *
 * Read-only by default: consumes an existing golden.json archive, joins it with
 * static spec features, and models the first terminal traversal cost recorded
 * by the handoff search (`compile_stats.first_completion_frame`, with the older
 * repair metric as an archive fallback). This is meant to
 * characterize budget slack as a smooth scalar:
 *
 *   slack = requestedBudget / predictedFirstCompletionFrames
 *
 * rather than as raw absolute budget.
 *
 * Optional live synthetic grid:
 *
 *   LR_ENGINE=wasm node --import tsx scripts/v0/study_difficulty_model.ts --synthetic
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";
import { constant } from "./core/curves.ts";
import { effectiveAxes, sliceTimeline } from "./core/substrate.ts";
import { compileHandoff, type HandoffNode, type HandoffNodeEvent } from "./optimizer/handoff.ts";
import {
  DEFAULT_BUDGETS,
  GOLDEN_SPECS,
  loadGoldenSpec,
  type GoldenSpecName,
} from "./golden_suite.ts";
import {
  FPS,
  TARGET_AXES,
  secToFrame,
  type Spec,
} from "./types.ts";

type GoldenArchive = {
  headline?: unknown;
  rows: GoldenRow[];
};

type GoldenRow = {
  name: string;
  variant: string;
  seed: number;
  checkpoints: GoldenCheckpoint[];
};

type GoldenCheckpoint = {
  budget: number;
  score: number;
  compile_stats?: {
    sim_frames?: number;
    first_completion_frame?: number;
    search_nodes_expanded?: number;
    handoff_full_evaluations?: number;
    handoff_unique_full_evaluations?: number;
    actual_candidate_samples?: number;
    viable_candidate_samples?: number;
    fwd_eval?: {
      fwd_eval_frames_charged?: number;
      start_eval_frames_charged?: number;
    };
    repair?: {
      first_completion_frame?: number;
      frames_spent?: number;
      restarts?: number;
      accepts?: number;
      reconverged?: number;
      records?: {
        worst: number;
        anchor: number;
        up: number;
        totalGaps: number;
        framesAtAnchor: number;
        framesBefore: number;
        framesSpent: number;
        estCost: number;
        predictedFeasible: boolean;
        completed: boolean;
        beforeScore: number;
        afterScore: number;
        accepted: boolean;
        inhSpeed: number | null;
        inhVy: number | null;
        inhGrounded: number | null;
      }[];
    };
  };
};

type SpecFeatures = {
  name: string;
  family: string;
  duration_seconds: number;
  duration_frames: number;
  contact_count: number;
  first_contact_frame: number;
  last_contact_frame: number;
  contact_span_frames: number;
  mean_gap_frames: number;
  median_gap_frames: number;
  min_gap_frames: number;
  p10_gap_frames: number;
  p25_gap_frames: number;
  contact_density_per_second: number;
  inverse_gap_sum: number;
  inverse_gap2_sum: number;
  tight_0_50s_fraction: number;
  tight_0_75s_fraction: number;
  active_axis_mean: number;
  active_axis_max: number;
  impact_mean: number;
  impact_max: number;
  impact_range: number;
  high_impact_fraction: number;
  spacing_pressure_by_exp: Record<string, number>;
};

type SpecStudyRow = SpecFeatures & {
  budget: number;
  seeds: number;
  first_completion_mean: number;
  first_completion_median: number;
  first_completion_p25: number;
  first_completion_p75: number;
  first_completion_min: number;
  first_completion_max: number;
  first_completion_cv: number;
  score_mean: number;
  sim_frames_mean: number;
  repair_frames_mean: number;
  repair_restarts_mean: number;
  repair_accepts_mean: number;
};

type ModelFit = {
  name: string;
  target: string;
  features: string[];
  coefficients: Record<string, number>;
  intercept: number;
  train: Metrics;
  leave_one_spec_out: Metrics;
  leave_one_family_out: Metrics;
  family_holdouts: FamilyHoldout[];
};

type Metrics = {
  r2: number;
  rmse: number;
  mae: number;
  mape: number;
};

type FamilyHoldout = {
  family: string;
  n: number;
  metrics: Metrics;
};

type BudgetTransfer = {
  train_budget: number;
  target: string;
  features: string[];
  tests: {
    budget: number;
    n: number;
    metrics: Metrics;
  }[];
};

type PairMetrics = Metrics & {
  bias: number;
  corr: number;
};

type RepairLogAnalysis = {
  source: string;
  records: number;
  completed_records: number;
  comparisons: Record<string, PairMetrics>;
  by_spec: Record<string, {
    n: number;
    repair_est_cost: PairMetrics;
    static_suffix_no_intercept: PairMetrics;
  }>;
};

const DEFAULT_GOLDEN = "generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json";
const DEFAULT_OUT = "generated/studies/difficulty-model-baseline.json";
const PRESSURE_EXPS = range(0, 3, 0.05);

const argv = process.argv.slice(2);
const goldenPath = arg("golden") ?? DEFAULT_GOLDEN;
const outPath = arg("out") ?? DEFAULT_OUT;
const repairLogPath = arg("repair-log");
const budget = intArg("budget", 250_000);
const runSynthetic = has("synthetic");
const syntheticBudget = intArg("synthetic-budget", 250_000);
const syntheticSeeds = intListArg("synthetic-seeds", [0, 1, 2]);
const syntheticCounts = intListArg("synthetic-counts", [4, 8, 16, 32, 55, 77]);
const syntheticGaps = numberListArg("synthetic-gaps", [0.32, 0.5, 0.75, 1.0, 1.25]);

type ModelTarget = {
  name: string;
  label: string;
  get: (row: SpecStudyRow) => number;
};

const FIRST_COMPLETION_TARGET: ModelTarget = {
  name: "first_completion_mean",
  label: "mean first-completion frames",
  get: (row) => row.first_completion_mean,
};

const SCORE_TARGET: ModelTarget = {
  name: "score_mean",
  label: "mean full-run score",
  get: (row) => row.score_mean,
};

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function has(name: string): boolean {
  return argv.includes(`--${name}`);
}

function intArg(name: string, fallback: number): number {
  const raw = arg(name);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function intListArg(name: string, fallback: number[]): number[] {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return fallback;
  return raw.split(",").map((x) => Number.parseInt(x, 10)).filter(Number.isFinite);
}

function numberListArg(name: string, fallback: number[]): number[] {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return fallback;
  return raw.split(",").map(Number).filter(Number.isFinite);
}

function range(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  for (let x = start; x <= end + step / 2; x += step) {
    out.push(Number(x.toFixed(4)));
  }
  return out;
}

function mean(xs: readonly number[]): number {
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

function median(xs: readonly number[]): number {
  return percentile(xs, 0.5);
}

function percentile(xs: readonly number[], p: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function stddev(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function round(value: number, digits = 3): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function fmt(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "na";
}

function specFamily(name: string): string {
  if (name.startsWith("drums_")) return "drums";
  if ([
    "climb_terrace",
    "swoop_dive",
    "rolling_hills",
    "summit_push",
    "mixed_grade",
  ].includes(name)) return "elevation";
  if ([
    "big_air_ramp",
    "pop_train",
    "soar_settle",
    "leap_cadence",
    "float_bounds",
  ].includes(name)) return "amplitude";
  if ([
    "canyon_steps",
    "ridge_pulse",
    "valley_bounce",
    "switchback_pop",
    "terrace_sprint",
    "glide_stairs",
    "dense_echo_climb",
    "rolling_drop",
    "skyline_push",
    "syncopated_lift",
  ].includes(name)) return "combined";
  return "legacy";
}

async function featuresForSpec(name: string, spec: Spec): Promise<SpecFeatures> {
  const durationFrames = secToFrame(spec.duration);
  const contactFrames = spec.contacts
    .map((contact) => secToFrame(contact.t))
    .filter((frame) => frame >= K_BOUNCE_LANDING)
    .sort((a, b) => a - b);

  const contactGaps: number[] = [];
  let cursor = 0;
  for (const frame of contactFrames) {
    contactGaps.push(Math.max(1, frame - cursor));
    cursor = frame;
  }

  const timeline = sliceTimeline(contactFrames, durationFrames);
  const contactTimeline = timeline.filter((gap) => gap.endsWithContact);
  const activeAxisCounts = contactTimeline.map((gap) => {
    const axes = effectiveAxes(gap, spec);
    let count = 0;
    for (const axis of TARGET_AXES) {
      if (axes[axis] !== undefined) count++;
    }
    if (spec.contacts.some((contact) => secToFrame(contact.t) === gap.endFrame && contact.impact !== undefined)) {
      count++;
    }
    return count;
  });
  const impacts = spec.contacts
    .filter((contact) => secToFrame(contact.t) >= K_BOUNCE_LANDING)
    .map((contact) => contact.impact ?? 0);

  const pressure: Record<string, number> = {};
  for (const exp of PRESSURE_EXPS) {
    pressure[expKey(exp)] = contactGaps.reduce(
      (sum, gapFrames) => sum + (FPS / Math.max(1, gapFrames)) ** exp,
      0,
    );
  }

  return {
    name,
    family: specFamily(name),
    duration_seconds: spec.duration,
    duration_frames: durationFrames,
    contact_count: contactFrames.length,
    first_contact_frame: contactFrames[0] ?? 0,
    last_contact_frame: contactFrames[contactFrames.length - 1] ?? 0,
    contact_span_frames: contactFrames.length > 0
      ? (contactFrames[contactFrames.length - 1] - contactFrames[0])
      : 0,
    mean_gap_frames: mean(contactGaps),
    median_gap_frames: median(contactGaps),
    min_gap_frames: Math.min(...contactGaps),
    p10_gap_frames: percentile(contactGaps, 0.10),
    p25_gap_frames: percentile(contactGaps, 0.25),
    contact_density_per_second: contactFrames.length / Math.max(1e-9, spec.duration),
    inverse_gap_sum: contactGaps.reduce((sum, gapFrames) => sum + FPS / gapFrames, 0),
    inverse_gap2_sum: contactGaps.reduce((sum, gapFrames) => sum + (FPS / gapFrames) ** 2, 0),
    tight_0_50s_fraction: contactGaps.filter((gapFrames) => gapFrames <= FPS * 0.50).length /
      Math.max(1, contactGaps.length),
    tight_0_75s_fraction: contactGaps.filter((gapFrames) => gapFrames <= FPS * 0.75).length /
      Math.max(1, contactGaps.length),
    active_axis_mean: activeAxisCounts.length > 0 ? mean(activeAxisCounts) : 0,
    active_axis_max: activeAxisCounts.length > 0 ? Math.max(...activeAxisCounts) : 0,
    impact_mean: impacts.length > 0 ? mean(impacts) : 0,
    impact_max: impacts.length > 0 ? Math.max(...impacts) : 0,
    impact_range: impacts.length > 0 ? Math.max(...impacts) - Math.min(...impacts) : 0,
    high_impact_fraction: impacts.filter((impact) => impact >= 0.65).length / Math.max(1, impacts.length),
    spacing_pressure_by_exp: pressure,
  };
}

function expKey(exp: number): string {
  return exp.toFixed(2);
}

function checkpoint(row: GoldenRow, targetBudget: number): GoldenCheckpoint | null {
  return row.checkpoints.find((cp) => cp.budget === targetBudget) ?? null;
}

async function buildCanonicalRows(archive: GoldenArchive, targetBudget: number): Promise<SpecStudyRow[]> {
  const rows: SpecStudyRow[] = [];
  for (const name of GOLDEN_SPECS) {
    const spec = await loadGoldenSpec(name, "base");
    const features = await featuresForSpec(name, spec);
    const samples = archive.rows
      .filter((row) => row.name === name && row.variant === "base")
      .map((row) => checkpoint(row, targetBudget))
      .filter((cp): cp is GoldenCheckpoint => cp !== null);
    const firstCompletions = samples
      .map((cp) => cp.compile_stats?.first_completion_frame ?? cp.compile_stats?.repair?.first_completion_frame)
      .filter((x): x is number => x !== undefined && Number.isFinite(x));
    if (firstCompletions.length === 0) continue;
    const scores = samples.map((cp) => cp.score).filter(Number.isFinite);
    const simFrames = samples
      .map((cp) => cp.compile_stats?.sim_frames)
      .filter((x): x is number => x !== undefined && Number.isFinite(x));
    const repairFrames = samples.map((cp) => cp.compile_stats?.repair?.frames_spent ?? 0);
    const repairRestarts = samples.map((cp) => cp.compile_stats?.repair?.restarts ?? 0);
    const repairAccepts = samples.map((cp) => cp.compile_stats?.repair?.accepts ?? 0);
    const fcMean = mean(firstCompletions);
    rows.push({
      ...features,
      budget: targetBudget,
      seeds: firstCompletions.length,
      first_completion_mean: fcMean,
      first_completion_median: median(firstCompletions),
      first_completion_p25: percentile(firstCompletions, 0.25),
      first_completion_p75: percentile(firstCompletions, 0.75),
      first_completion_min: Math.min(...firstCompletions),
      first_completion_max: Math.max(...firstCompletions),
      first_completion_cv: stddev(firstCompletions) / Math.max(1, fcMean),
      score_mean: mean(scores),
      sim_frames_mean: mean(simFrames),
      repair_frames_mean: mean(repairFrames),
      repair_restarts_mean: mean(repairRestarts),
      repair_accepts_mean: mean(repairAccepts),
    });
  }
  return rows;
}

function valueOf(row: Record<string, unknown>, feature: string): number {
  if (feature.startsWith("pressure:")) {
    const exp = feature.slice("pressure:".length);
    const pressure = row.spacing_pressure_by_exp as Record<string, number> | undefined;
    return pressure?.[exp] ?? 0;
  }
  const value = row[feature];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function fitModel(
  name: string,
  rows: readonly SpecStudyRow[],
  features: string[],
  target: ModelTarget,
): ModelFit {
  const model = fitOls(rows, features, target);
  const predictions = rows.map((row) => model.predict(row));
  const looPredictions = rows.map((heldOut) => {
    const train = rows.filter((row) => row !== heldOut);
    return fitOls(train, features, target).predict(heldOut);
  });
  const familyHoldout = familyHoldoutMetrics(rows, features, target);
  return {
    name,
    target: target.name,
    features,
    coefficients: Object.fromEntries(
      features.map((feature, index) => [feature, round(model.coefficients[index], 6)]),
    ),
    intercept: round(model.intercept, 6),
    train: metric(rows.map(target.get), predictions),
    leave_one_spec_out: metric(rows.map(target.get), looPredictions),
    leave_one_family_out: familyHoldout.overall,
    family_holdouts: familyHoldout.by_family,
  };
}

function fitOls(rows: readonly SpecStudyRow[], features: string[], target: ModelTarget): {
  intercept: number;
  coefficients: number[];
  predict: (row: SpecStudyRow) => number;
} {
  const n = rows.length;
  const k = features.length;
  const means = features.map((feature) => mean(rows.map((row) => valueOf(row, feature))));
  const stds = features.map((feature, index) => {
    const sd = stddev(rows.map((row) => valueOf(row, feature)));
    return sd > 1e-12 ? sd : 1;
  });

  const xtx: number[][] = Array.from({ length: k + 1 }, () => Array(k + 1).fill(0));
  const xty: number[] = Array(k + 1).fill(0);
  for (const row of rows) {
    const x = [1, ...features.map((feature, index) => (valueOf(row, feature) - means[index]) / stds[index])];
    const y = target.get(row);
    for (let i = 0; i < k + 1; i++) {
      xty[i] += x[i] * y;
      for (let j = 0; j < k + 1; j++) xtx[i][j] += x[i] * x[j];
    }
  }
  const ridge = 1e-8 * Math.max(1, n);
  for (let i = 1; i < k + 1; i++) xtx[i][i] += ridge;
  const beta = solveLinearSystem(xtx, xty);
  const coefficients = features.map((_, index) => beta[index + 1] / stds[index]);
  const intercept = beta[0] - coefficients.reduce((sum, coefficient, index) => (
    sum + coefficient * means[index]
  ), 0);
  return {
    intercept,
    coefficients,
    predict: (row) => intercept + coefficients.reduce((sum, coefficient, index) => (
      sum + coefficient * valueOf(row, features[index])
    ), 0),
  };
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

function metric(actual: readonly number[], predicted: readonly number[]): Metrics {
  const yMean = mean(actual);
  const sst = actual.reduce((sum, y) => sum + (y - yMean) ** 2, 0);
  const errors = actual.map((y, index) => y - predicted[index]);
  const sse = errors.reduce((sum, error) => sum + error ** 2, 0);
  return {
    r2: round(1 - sse / Math.max(1e-9, sst), 4),
    rmse: round(Math.sqrt(mean(errors.map((error) => error ** 2))), 1),
    mae: round(mean(errors.map(Math.abs)), 1),
    mape: round(mean(errors.map((error, index) => Math.abs(error) / Math.max(1, actual[index]))), 4),
  };
}

function correlation(xs: readonly number[], ys: readonly number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i] - mx;
    const y = ys[i] - my;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const denom = Math.sqrt(sxx * syy);
  return denom > 0 ? sxy / denom : 0;
}

function pairMetric(actual: readonly number[], predicted: readonly number[]): PairMetrics {
  const base = metric(actual, predicted);
  const errors = actual.map((y, index) => y - predicted[index]);
  return {
    ...base,
    bias: round(mean(errors), 1),
    corr: round(correlation(predicted, actual), 4),
  };
}

function familyHoldoutMetrics(
  rows: readonly SpecStudyRow[],
  features: readonly string[],
  target: ModelTarget,
): { overall: Metrics; by_family: FamilyHoldout[] } {
  const predictions: { family: string; actual: number; predicted: number }[] = [];
  const families = [...new Set(rows.map((row) => row.family))].sort();
  for (const family of families) {
    const train = rows.filter((row) => row.family !== family);
    const test = rows.filter((row) => row.family === family);
    if (train.length <= features.length || test.length === 0) continue;
    const model = fitOls(train, [...features], target);
    for (const row of test) {
      predictions.push({ family, actual: target.get(row), predicted: model.predict(row) });
    }
  }
  const byFamily = families.map((family) => {
    const familyPredictions = predictions.filter((prediction) => prediction.family === family);
    return {
      family,
      n: familyPredictions.length,
      metrics: metric(
        familyPredictions.map((prediction) => prediction.actual),
        familyPredictions.map((prediction) => prediction.predicted),
      ),
    };
  }).filter((entry) => entry.n > 0);
  return {
    overall: metric(
      predictions.map((prediction) => prediction.actual),
      predictions.map((prediction) => prediction.predicted),
    ),
    by_family: byFamily,
  };
}

function pressureFeature(exp: number): string {
  return `pressure:${expKey(exp)}`;
}

function buildModels(rows: readonly SpecStudyRow[], target: ModelTarget): {
  models: ModelFit[];
  best_pressure_model: ModelFit;
  residuals: unknown[];
} {
  const pressureModels = PRESSURE_EXPS.map((exp) =>
    fitModel(`spacing pressure p=${expKey(exp)}`, rows, [pressureFeature(exp)], target)
  );
  const bestPressure = [...pressureModels]
    .sort((a, b) => b.leave_one_spec_out.r2 - a.leave_one_spec_out.r2)[0];
  const scoreModels = target.name === SCORE_TARGET.name
    ? [
      fitModel("axes only", rows, ["active_axis_mean", "impact_mean", "impact_range"], target),
      fitModel("first-completion only", rows, ["first_completion_mean"], target),
      fitModel("first-completion + axes", rows, [
        "first_completion_mean",
        "active_axis_mean",
        "impact_mean",
        "impact_range",
      ], target),
    ]
    : [];
  const namedModels = [
    fitModel("contacts only", rows, ["contact_count"], target),
    fitModel("duration only", rows, ["duration_frames"], target),
    fitModel("median gap only", rows, ["median_gap_frames"], target),
    fitModel("density only", rows, ["contact_density_per_second"], target),
    bestPressure,
    fitModel("contacts + duration", rows, ["contact_count", "duration_frames"], target),
    fitModel("contacts + spacing", rows, ["contact_count", "inverse_gap_sum"], target),
    fitModel("contacts + axes", rows, ["contact_count", "active_axis_mean", "impact_mean"], target),
    fitModel("contacts + duration + axes", rows, [
      "contact_count",
      "duration_frames",
      "active_axis_mean",
      "impact_mean",
    ], target),
    ...scoreModels,
  ];
  const bestByLoo = [...namedModels].sort((a, b) => b.leave_one_spec_out.r2 - a.leave_one_spec_out.r2)[0];
  const bestFit = fitOls(rows, bestByLoo.features, target);
  const residuals = rows.map((row) => {
    const predicted = bestFit.predict(row);
    const actual = target.get(row);
    return {
      name: row.name,
      model: bestByLoo.name,
      actual: round(actual, 1),
      predicted: round(predicted, 1),
      residual: round(actual - predicted, 1),
      contact_count: row.contact_count,
      family: row.family,
      median_gap_frames: row.median_gap_frames,
      duration_frames: row.duration_frames,
      score_mean: round(row.score_mean, 1),
      first_completion_mean: round(row.first_completion_mean, 1),
    };
  }).sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual));
  return { models: namedModels, best_pressure_model: bestPressure, residuals };
}

function modelByName(models: readonly ModelFit[], name: string): ModelFit {
  const found = models.find((model) => model.name === name);
  if (found === undefined) throw new Error(`missing model ${name}`);
  return found;
}

function budgetTransferMetrics(
  rowsByBudget: ReadonlyMap<number, SpecStudyRow[]>,
  trainBudget: number,
  features: string[],
  target: ModelTarget,
): BudgetTransfer {
  const trainRows = rowsByBudget.get(trainBudget);
  if (trainRows === undefined) throw new Error(`missing rows for train budget ${trainBudget}`);
  const model = fitOls(trainRows, features, target);
  return {
    train_budget: trainBudget,
    target: target.name,
    features,
    tests: [...rowsByBudget.entries()]
      .sort(([a], [b]) => a - b)
      .map(([b, rows]) => ({
        budget: b,
        n: rows.length,
        metrics: metric(rows.map(target.get), rows.map((row) => model.predict(row))),
      })),
  };
}

async function analyzeRepairLog(
  path: string,
  model: ModelFit,
): Promise<RepairLogAnalysis> {
  const repairArchive = JSON.parse(readFileSync(path, "utf8")) as GoldenArchive;
  const contactCoef = model.coefficients.contact_count ?? 0;
  const durationCoef = model.coefficients.duration_frames ?? 0;
  type Row = {
    spec: string;
    completed: boolean;
    framesSpent: number;
    estCost: number;
    staticNoIntercept: number;
    staticWithIntercept: number;
  };
  const rows: Row[] = [];
  const specs = new Map<string, Spec>();

  for (const row of repairArchive.rows) {
    if (!specs.has(row.name)) {
      specs.set(row.name, await loadGoldenSpec(row.name as GoldenSpecName, "base"));
    }
  }

  for (const row of repairArchive.rows) {
    const spec = specs.get(row.name);
    if (spec === undefined) continue;
    const durationFrames = secToFrame(spec.duration);
    const contactFrames = spec.contacts
      .map((contact) => secToFrame(contact.t))
      .filter((frame) => frame >= K_BOUNCE_LANDING)
      .sort((a, b) => a - b);
    const gapStarts = [0, ...contactFrames];
    for (const checkpoint of row.checkpoints) {
      const records = checkpoint.compile_stats?.repair?.records ?? [];
      for (const record of records) {
        const anchor = record.anchor;
        const remainingContacts = Math.max(0, contactFrames.length - anchor);
        const startFrame = gapStarts[Math.min(anchor, gapStarts.length - 1)] ?? durationFrames;
        const remainingDuration = Math.max(0, durationFrames - startFrame);
        const staticNoIntercept = contactCoef * remainingContacts +
          durationCoef * remainingDuration;
        rows.push({
          spec: row.name,
          completed: record.completed,
          framesSpent: record.framesSpent,
          estCost: record.estCost,
          staticNoIntercept,
          staticWithIntercept: model.intercept + staticNoIntercept,
        });
      }
    }
  }

  const completed = rows.filter((row) => row.completed && row.framesSpent > 0 && row.estCost > 0);
  const compare = (
    key: keyof Pick<Row, "estCost" | "staticNoIntercept" | "staticWithIntercept">,
  ): PairMetrics => pairMetric(
    completed.map((row) => row.framesSpent),
    completed.map((row) => row[key]),
  );
  const bySpec: RepairLogAnalysis["by_spec"] = {};
  for (const spec of [...new Set(completed.map((row) => row.spec))].sort()) {
    const specRows = completed.filter((row) => row.spec === spec);
    bySpec[spec] = {
      n: specRows.length,
      repair_est_cost: pairMetric(
        specRows.map((row) => row.framesSpent),
        specRows.map((row) => row.estCost),
      ),
      static_suffix_no_intercept: pairMetric(
        specRows.map((row) => row.framesSpent),
        specRows.map((row) => row.staticNoIntercept),
      ),
    };
  }

  return {
    source: path,
    records: rows.length,
    completed_records: completed.length,
    comparisons: {
      repair_est_cost: compare("estCost"),
      static_suffix_no_intercept: compare("staticNoIntercept"),
      static_suffix_with_intercept: compare("staticWithIntercept"),
    },
    by_spec: bySpec,
  };
}

function summarizeBudgets(archive: GoldenArchive): unknown[] {
  const budgets = [...new Set(
    archive.rows.flatMap((row) => row.checkpoints.map((cp) => cp.budget)),
  )].sort((a, b) => a - b);
  return budgets.map((b) => {
    const checkpoints = archive.rows
      .filter((row) => row.variant === "base")
      .map((row) => checkpoint(row, b))
      .filter((cp): cp is GoldenCheckpoint => cp !== null);
    const first = checkpoints
      .map((cp) => cp.compile_stats?.first_completion_frame ?? cp.compile_stats?.repair?.first_completion_frame)
      .filter((x): x is number => x !== undefined && Number.isFinite(x));
    return {
      budget: b,
      rows: checkpoints.length,
      first_completion_rows: first.length,
      first_completion_mean: first.length > 0 ? round(mean(first), 1) : null,
      first_completion_p25: first.length > 0 ? round(percentile(first, 0.25), 1) : null,
      first_completion_p75: first.length > 0 ? round(percentile(first, 0.75), 1) : null,
      first_completion_max: first.length > 0 ? Math.max(...first) : null,
      sim_frames_mean: round(mean(checkpoints.map((cp) => cp.compile_stats?.sim_frames ?? 0)), 1),
      repair_frames_mean: round(mean(checkpoints.map((cp) => cp.compile_stats?.repair?.frames_spent ?? 0)), 1),
    };
  });
}

class FirstCompletion extends Error {
  constructor(
    readonly frame: number,
    readonly phase: string,
    readonly improved: boolean,
  ) {
    super("first completion");
  }
}

function syntheticSpec(contactCount: number, gapSeconds: number): Spec {
  const start = 0.40;
  const contacts = Array.from({ length: contactCount }, (_, index) => ({
    t: Number((start + index * gapSeconds).toFixed(3)),
    impact: index % 8 === 0 ? 0.75 : 0.40,
  }));
  const duration = Number((start + contactCount * gapSeconds + 0.80).toFixed(3));
  return {
    duration,
    contacts,
    axes: {
      air: constant(0.52),
      speed: constant(0.62),
    },
    jitter: 0.05,
    preroll: 5,
  };
}

function firstCompletionFrame(spec: Spec, seed: number, targetBudget: number): {
  frame: number | null;
  phase: string | null;
  improved: boolean | null;
} {
  const contactFrames = spec.contacts
    .map((contact) => secToFrame(contact.t))
    .filter((frame) => frame >= K_BOUNCE_LANDING)
    .sort((a, b) => a - b);
  const terminalGapIndex = sliceTimeline(contactFrames, secToFrame(spec.duration)).length;
  try {
    const checkpoint = compileHandoff(spec, seed, {
      budget: targetBudget,
      onNode: (node: HandoffNode, _key, event: HandoffNodeEvent) => {
        if (node.search.gapIndex >= terminalGapIndex) {
          throw new FirstCompletion(event.simFrames, event.phase, event.improved);
        }
      },
    });
    const fallback = checkpoint.stats.repair?.first_completion_frame;
    return {
      frame: typeof fallback === "number" ? fallback : null,
      phase: null,
      improved: null,
    };
  } catch (error) {
    if (error instanceof FirstCompletion) {
      return { frame: error.frame, phase: error.phase, improved: error.improved };
    }
    throw error;
  }
}

async function runSyntheticGrid(): Promise<{
  budget: number;
  seeds: number[];
  counts: number[];
  gaps: number[];
  samples: unknown[];
  spec_rows: SpecStudyRow[];
  models: ModelFit[];
  best_pressure_model: ModelFit;
}> {
  const samples: unknown[] = [];
  const grouped = new Map<string, {
    name: string;
    spec: Spec;
    frames: number[];
  }>();
  for (const count of syntheticCounts) {
    for (const gap of syntheticGaps) {
      const spec = syntheticSpec(count, gap);
      const name = `synthetic_c${count}_gap${gap.toFixed(2)}`;
      grouped.set(name, { name, spec, frames: [] });
      for (const seed of syntheticSeeds) {
        const result = firstCompletionFrame(spec, seed, syntheticBudget);
        samples.push({ name, count, gap, seed, ...result });
        if (result.frame !== null) grouped.get(name)?.frames.push(result.frame);
        process.stderr.write(
          `synthetic ${name} seed=${seed} first=${result.frame ?? "missing"}\n`,
        );
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
  }

  const specRows: SpecStudyRow[] = [];
  for (const group of grouped.values()) {
    if (group.frames.length === 0) continue;
    const features = await featuresForSpec(group.name, group.spec);
    const fcMean = mean(group.frames);
    specRows.push({
      ...features,
      budget: syntheticBudget,
      seeds: group.frames.length,
      first_completion_mean: fcMean,
      first_completion_median: median(group.frames),
      first_completion_p25: percentile(group.frames, 0.25),
      first_completion_p75: percentile(group.frames, 0.75),
      first_completion_min: Math.min(...group.frames),
      first_completion_max: Math.max(...group.frames),
      first_completion_cv: stddev(group.frames) / Math.max(1, fcMean),
      score_mean: 0,
      sim_frames_mean: 0,
      repair_frames_mean: 0,
      repair_restarts_mean: 0,
      repair_accepts_mean: 0,
    });
  }
  const { models, best_pressure_model } = buildModels(specRows, FIRST_COMPLETION_TARGET);
  return {
    budget: syntheticBudget,
    seeds: syntheticSeeds,
    counts: syntheticCounts,
    gaps: syntheticGaps,
    samples,
    spec_rows: specRows,
    models,
    best_pressure_model,
  };
}

function printModel(model: ModelFit): void {
  const loo = model.leave_one_spec_out;
  const family = model.leave_one_family_out;
  const train = model.train;
  console.log(
    `${model.name.padEnd(30)} train R2 ${fmt(train.r2, 3)} MAE ${fmt(train.mae, 0)}  ` +
    `LOO R2 ${fmt(loo.r2, 3)} MAE ${fmt(loo.mae, 0)}  ` +
    `family R2 ${fmt(family.r2, 3)} MAE ${fmt(family.mae, 0)}`,
  );
}

const archive = JSON.parse(readFileSync(goldenPath, "utf8")) as GoldenArchive;
const canonicalRows = await buildCanonicalRows(archive, budget);
const canonicalFirstCompletion = buildModels(canonicalRows, FIRST_COMPLETION_TARGET);
const budgets = summarizeBudgets(archive);
const budgetValues = budgets.map((entry) => (entry as { budget: number }).budget);
const scoreRowsByBudget = new Map<number, SpecStudyRow[]>();
for (const b of budgetValues) {
  scoreRowsByBudget.set(b, await buildCanonicalRows(archive, b));
}
const scoreModelsByBudget = [...scoreRowsByBudget.entries()].map(([b, rows]) => ({
  budget: b,
  ...buildModels(rows, SCORE_TARGET),
}));
const budgetWeightSum = budgetValues.reduce((sum, b) => sum + b, 0);
const weightedScoreRows = canonicalRows.map((baseRow) => {
  const weightedScore = budgetValues.reduce((sum, b) => {
    const row = scoreRowsByBudget.get(b)?.find((candidate) => candidate.name === baseRow.name);
    return sum + (b / budgetWeightSum) * (row?.score_mean ?? 0);
  }, 0);
  return { ...baseRow, score_mean: weightedScore };
});
const weightedScoreModels = buildModels(weightedScoreRows, SCORE_TARGET);
const traversalBudgetTransfer = budgetTransferMetrics(
  scoreRowsByBudget,
  budget,
  ["contact_count", "duration_frames"],
  FIRST_COMPLETION_TARGET,
);
const recommendedTraversalModel = modelByName(
  canonicalFirstCompletion.models,
  "contacts + duration",
);
const repairLogAnalysis = repairLogPath !== undefined
  ? await analyzeRepairLog(repairLogPath, recommendedTraversalModel)
  : null;
const topByCost = [...canonicalRows].sort((a, b) =>
  b.first_completion_mean - a.first_completion_mean
).slice(0, 12);
const hardestByWeightedScore = [...weightedScoreRows]
  .sort((a, b) => a.score_mean - b.score_mean)
  .slice(0, 12);
const synthetic = runSynthetic ? await runSyntheticGrid() : null;

const output = {
  source: {
    golden: goldenPath,
    budget,
    default_budgets: DEFAULT_BUDGETS,
  },
  budget_summary: budgets,
  canonical: {
    spec_rows: canonicalRows,
    first_completion: {
      target: FIRST_COMPLETION_TARGET,
      models: canonicalFirstCompletion.models,
      best_pressure_model: canonicalFirstCompletion.best_pressure_model,
      recommended_model: recommendedTraversalModel,
      budget_transfer_from_modeled_budget: traversalBudgetTransfer,
      ...(repairLogAnalysis !== null ? { repair_log_analysis: repairLogAnalysis } : {}),
      residuals_by_abs_error: canonicalFirstCompletion.residuals,
    },
    score_by_budget: scoreModelsByBudget,
    weighted_score: {
      target: SCORE_TARGET,
      spec_rows: weightedScoreRows,
      models: weightedScoreModels.models,
      best_pressure_model: weightedScoreModels.best_pressure_model,
      residuals_by_abs_error: weightedScoreModels.residuals,
    },
  },
  ...(synthetic !== null ? { synthetic } : {}),
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);

console.log("=== compileHandoff difficulty model ===");
console.log(`golden: ${goldenPath}`);
console.log(`budget modeled: ${budget}`);
console.log(`specs modeled: ${canonicalRows.length}`);
console.log("");
console.log("budget telemetry:");
for (const entry of budgets as {
  budget: number;
  first_completion_rows: number;
  first_completion_mean: number | null;
  first_completion_max: number | null;
  repair_frames_mean: number;
}[]) {
  console.log(
    `  ${entry.budget}: firstCompletion rows ${entry.first_completion_rows}/480, ` +
    `mean ${entry.first_completion_mean ?? "na"}, max ${entry.first_completion_max ?? "na"}, ` +
    `repairFrames mean ${entry.repair_frames_mean}`,
  );
}
console.log("");
console.log("canonical first-completion models:");
for (const model of canonicalFirstCompletion.models) printModel(model);
console.log("");
console.log("recommended traversal model family holdouts:");
for (const holdout of recommendedTraversalModel.family_holdouts) {
  console.log(
    `  ${holdout.family.padEnd(10)} n=${holdout.n} ` +
    `R2 ${fmt(holdout.metrics.r2, 3)} MAE ${fmt(holdout.metrics.mae, 0)} ` +
    `MAPE ${(100 * holdout.metrics.mape).toFixed(1)}%`,
  );
}
console.log("");
console.log(`recommended traversal model trained at ${budget}, evaluated across budgets:`);
for (const test of traversalBudgetTransfer.tests) {
  console.log(
    `  ${test.budget}: R2 ${fmt(test.metrics.r2, 3)} MAE ${fmt(test.metrics.mae, 0)} ` +
    `RMSE ${fmt(test.metrics.rmse, 0)}`,
  );
}
if (repairLogAnalysis !== null) {
  console.log("");
  console.log(`repair suffix comparison: ${repairLogAnalysis.source}`);
  console.log(`  completed records ${repairLogAnalysis.completed_records}/${repairLogAnalysis.records}`);
  for (const [name, metrics] of Object.entries(repairLogAnalysis.comparisons)) {
    console.log(
      `  ${name.padEnd(30)} corr ${fmt(metrics.corr, 3)} MAE ${fmt(metrics.mae, 0)} ` +
      `bias ${fmt(metrics.bias, 0)}`,
    );
  }
}
console.log("");
console.log("budget-weighted score models:");
for (const model of weightedScoreModels.models) printModel(model);
console.log("");
console.log("score models by budget:");
for (const entry of scoreModelsByBudget) {
  const best = [...entry.models].sort((a, b) => b.leave_one_spec_out.r2 - a.leave_one_spec_out.r2)[0];
  console.log(
    `  ${entry.budget}: best ${best.name}  ` +
    `LOO R2 ${fmt(best.leave_one_spec_out.r2, 3)} MAE ${fmt(best.leave_one_spec_out.mae, 1)}`,
  );
}
console.log("");
console.log("hardest specs by mean first-completion frames:");
for (const row of topByCost) {
  console.log(
    `  ${row.name.padEnd(24)} first ${fmt(row.first_completion_mean, 0).padStart(6)}  ` +
    `contacts ${String(row.contact_count).padStart(2)}  median_gap ${fmt(row.median_gap_frames, 0).padStart(2)}f  ` +
    `score ${fmt(row.score_mean, 1).padStart(5)}`,
  );
}
console.log("");
console.log("lowest specs by budget-weighted full-run score:");
for (const row of hardestByWeightedScore) {
  console.log(
    `  ${row.name.padEnd(24)} score ${fmt(row.score_mean, 1).padStart(5)}  ` +
    `first ${fmt(row.first_completion_mean, 0).padStart(6)}  contacts ${String(row.contact_count).padStart(2)}  ` +
    `median_gap ${fmt(row.median_gap_frames, 0).padStart(2)}f`,
  );
}
console.log("");
console.log("largest first-completion residuals under best model:");
for (const row of canonicalFirstCompletion.residuals.slice(0, 10) as {
  name: string;
  actual: number;
  predicted: number;
  residual: number;
  contact_count: number;
  median_gap_frames: number;
}[]) {
  console.log(
    `  ${row.name.padEnd(24)} actual ${fmt(row.actual, 0).padStart(6)}  ` +
    `pred ${fmt(row.predicted, 0).padStart(6)}  residual ${fmt(row.residual, 0).padStart(7)}  ` +
    `contacts ${String(row.contact_count).padStart(2)} median_gap ${fmt(row.median_gap_frames, 0)}f`,
  );
}
console.log("");
console.log("largest weighted-score residuals under best model:");
for (const row of weightedScoreModels.residuals.slice(0, 10) as {
  name: string;
  actual: number;
  predicted: number;
  residual: number;
  contact_count: number;
  median_gap_frames: number;
  first_completion_mean: number;
}[]) {
  console.log(
    `  ${row.name.padEnd(24)} actual ${fmt(row.actual, 1).padStart(6)}  ` +
    `pred ${fmt(row.predicted, 1).padStart(6)}  residual ${fmt(row.residual, 1).padStart(7)}  ` +
    `first ${fmt(row.first_completion_mean, 0).padStart(6)}  contacts ${String(row.contact_count).padStart(2)} ` +
    `median_gap ${fmt(row.median_gap_frames, 0)}f`,
  );
}
if (synthetic !== null) {
  console.log("");
  console.log("synthetic grid models:");
  for (const model of synthetic.models) printModel(model);
}
console.log("");
console.log(`wrote ${outPath}`);
