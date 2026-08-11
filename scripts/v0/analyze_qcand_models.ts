/**
 * Offline model comparison for quality-ncand characterization panels.
 *
 * This complements the narrower anchor analyzer with standard holdout checks:
 * in-sample, leave-one-spec-out, leave-one-budget-out, and leave-one-seed-out.
 * It is intentionally read-only: it mines study JSON rows and writes an
 * analysis artifact, but does not change compiler behavior.
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
  first_completion_frame: number | null;
  actual_candidate_samples: number;
  repair_frames_spent: number;
  fwd_eval_frames_charged?: number;
};

type Sample = StudyRow & {
  first: number;
  current_d: number;
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

type ModelResult = {
  model: string;
  family: string;
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

type ResidualGroup = {
  key: string;
  n: number;
  mae: number;
  bias: number;
  actual_mean: number;
  predicted_mean: number;
};

type ModelSpec = {
  name: string;
  family: string;
  fit: (rows: Sample[]) => FittedModel | null;
};

type FittedModel = {
  predict: (row: Sample) => number;
};

type PairedResponse = {
  group: string;
  q: number;
  pairs: number;
  score_delta_mean: number;
  first_ratio_mean: number;
  candidate_ratio_mean: number;
  repair_delta_mean: number;
};

const argv = process.argv.slice(2);
const inputPaths = inputList();
if (inputPaths.length === 0) {
  throw new Error("usage: --inputs=a.json,b.json or --dir=generated/studies/panel/shards [--out=analysis.json]");
}
const outPath = arg("out");
const loadedStudies = inputPaths.map((path) => ({ path, study: readStudyMaybe(path) }));
const studies = loadedStudies
  .filter((item): item is { path: string; study: StudyFile } => item.study !== null)
  .map((item) => item.study);
const usedInputPaths = loadedStudies
  .filter((item) => item.study !== null)
  .map((item) => item.path);
if (studies.length === 0) {
  throw new Error("no study JSON files found");
}
const baselineQ = studies[0]?.config.baseline_value ?? 32;
for (const study of studies) {
  if (study.config.study_knob !== "quality_ncand") {
    throw new Error(`unsupported study knob ${study.config.study_knob}`);
  }
  if (study.config.baseline_value !== baselineQ) {
    throw new Error(`mixed baseline q values: ${baselineQ} and ${study.config.baseline_value}`);
  }
}

const rows = studies.flatMap((study) => study.rows)
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

const specFeatures = new Map<string, SpecFeatures>();
for (const specName of [...new Set(rows.map((row) => row.spec))].sort()) {
  specFeatures.set(specName, featuresForSpec(await loadGoldenSpec(specName as GoldenSpecName, "base")));
}

const modelSpecs = buildModelSpecs();
const modelResults = modelSpecs
  .map((model) => evaluateModel(model, rows))
  .filter((result): result is ModelResult => result !== null)
  .sort((a, b) =>
    (a.leave_one_spec_out?.mae ?? Number.POSITIVE_INFINITY) -
      (b.leave_one_spec_out?.mae ?? Number.POSITIVE_INFINITY)
  );
const pairedResponses = [
  ...pairedResponse(rows, (row) => "all"),
  ...pairedResponse(rows, (row) => String(row.budget)),
];

const output = {
  config: {
    inputs: usedInputPaths,
    skipped_inputs: inputPaths.length - usedInputPaths.length,
    rows: rows.length,
    budgets: [...new Set(rows.map((row) => row.budget))].sort((a, b) => a - b),
    specs: [...new Set(rows.map((row) => row.spec))].sort(),
    seeds: [...new Set(rows.map((row) => row.seed))].sort((a, b) => a - b),
    q_values: [...new Set(rows.map((row) => row.quality_ncand))].sort((a, b) => a - b),
    baseline_q: baselineQ,
  },
  model_results: modelResults,
  paired_response: pairedResponses,
};

if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
}

printSummary(output);
if (outPath !== undefined) console.log(`wrote ${outPath}`);

function buildModelSpecs(): ModelSpec[] {
  const x = (row: Sample) => row.quality_ncand / baselineQ - 1;
  return [
    {
      name: "current_D_identity",
      family: "current_d",
      fit: () => ({ predict: (row) => row.current_d }),
    },
    {
      name: "current_D_scale",
      family: "current_d",
      fit: (train) => {
        const scale = mean(train.map((row) => row.first / row.current_d));
        return { predict: (row) => row.current_d * scale };
      },
    },
    {
      name: "current_D_q_linear",
      family: "current_d_q",
      fit: (train) => fitRatioModel(train, [x]),
    },
    {
      name: "current_D_q_quadratic",
      family: "current_d_q",
      fit: (train) => fitRatioModel(train, [x, (row) => x(row) ** 2]),
    },
    {
      name: "current_D_log_q_linear",
      family: "current_d_q",
      fit: (train) => fitLogRatioModel(train, [x]),
    },
    {
      name: "features_contacts_duration_q",
      family: "spec_features",
      fit: (train) => fitDirectModel(train, [
        feature("contact_count"),
        feature("duration_frames"),
        x,
      ]),
    },
    {
      name: "features_contacts_duration_spacing_q",
      family: "spec_features",
      fit: (train) => fitDirectModel(train, [
        feature("contact_count"),
        feature("duration_frames"),
        feature("inverse_gap_sum"),
        x,
      ]),
    },
    {
      name: "features_log_contacts_duration_q",
      family: "spec_features_log",
      fit: (train) => fitLogDirectModel(train, [
        (row) => Math.log1p(feature("contact_count")(row)),
        (row) => Math.log1p(feature("duration_frames")(row)),
        x,
      ]),
    },
  ];
}

function evaluateModel(model: ModelSpec, samples: Sample[]): ModelResult | null {
  const fitted = model.fit(samples);
  if (fitted === null) return null;
  const actual = samples.map((row) => row.first);
  const predicted = samples.map((row) => fitted.predict(row));
  return {
    model: model.name,
    family: model.family,
    train: metric(actual, predicted),
    leave_one_spec_out: crossValidate(model, samples, (row) => row.spec),
    leave_one_budget_out: crossValidate(model, samples, (row) => String(row.budget)),
    leave_one_seed_out: crossValidate(model, samples, (row) => String(row.seed)),
    residuals: {
      by_budget: residualGroups(samples, predicted, (row) => String(row.budget)),
      by_q: residualGroups(samples, predicted, (row) => String(row.quality_ncand)),
      worst_specs: residualGroups(samples, predicted, (row) => row.spec)
        .sort((a, b) => b.mae - a.mae)
        .slice(0, 12),
    },
  };
}

function crossValidate(
  model: ModelSpec,
  samples: Sample[],
  keyOf: (row: Sample) => string,
): Metrics | null {
  const keys = [...new Set(samples.map(keyOf))].sort();
  if (keys.length < 2) return null;
  const actual: number[] = [];
  const predicted: number[] = [];
  for (const key of keys) {
    const train = samples.filter((row) => keyOf(row) !== key);
    const test = samples.filter((row) => keyOf(row) === key);
    if (train.length === 0 || test.length === 0) continue;
    const fitted = model.fit(train);
    if (fitted === null) continue;
    for (const row of test) {
      actual.push(row.first);
      predicted.push(fitted.predict(row));
    }
  }
  return actual.length > 0 ? metric(actual, predicted) : null;
}

function fitRatioModel(
  train: Sample[],
  features: ((row: Sample) => number)[],
): FittedModel | null {
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
): FittedModel | null {
  const ys = train.map((row) => Math.log(Math.max(1e-9, row.first / row.current_d)));
  const model = fitOls(train, features, ys);
  if (model === null) return null;
  return {
    predict: (row) => row.current_d * Math.exp(model.predict(row)),
  };
}

function fitDirectModel(
  train: Sample[],
  features: ((row: Sample) => number)[],
): FittedModel | null {
  const ys = train.map((row) => row.first);
  return fitOls(train, features, ys);
}

function fitLogDirectModel(
  train: Sample[],
  features: ((row: Sample) => number)[],
): FittedModel | null {
  const ys = train.map((row) => Math.log(Math.max(1, row.first)));
  const model = fitOls(train, features, ys);
  if (model === null) return null;
  return {
    predict: (row) => Math.exp(model.predict(row)),
  };
}

function fitOls(
  rowsIn: Sample[],
  features: ((row: Sample) => number)[],
  ys: number[],
): FittedModel | null {
  if (rowsIn.length <= features.length + 1) return null;
  const means = features.map((fn) => mean(rowsIn.map(fn)));
  const stds = features.map((fn, index) => {
    const sd = stddev(rowsIn.map(fn));
    return sd > 1e-12 ? sd : 1 + index * 0;
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

function pairedResponse(rowsIn: Sample[], groupOf: (row: Sample) => string): PairedResponse[] {
  const baseline = new Map<string, Sample>();
  for (const row of rowsIn) {
    if (row.quality_ncand === baselineQ) baseline.set(pairKey(row), row);
  }
  const groups = new Map<string, {
    score: number;
    firstRatio: number;
    candidateRatio: number;
    repair: number;
  }[]>();
  for (const row of rowsIn) {
    if (row.quality_ncand === baselineQ) continue;
    const base = baseline.get(pairKey(row));
    if (base === undefined || base.first <= 0 || base.actual_candidate_samples <= 0) continue;
    const key = `${groupOf(row)}|${row.quality_ncand}`;
    groups.set(key, [...(groups.get(key) ?? []), {
      score: row.score - base.score,
      firstRatio: row.first / base.first,
      candidateRatio: row.actual_candidate_samples / base.actual_candidate_samples,
      repair: row.repair_frames_spent - base.repair_frames_spent,
    }]);
  }
  return [...groups.entries()]
    .map(([key, values]) => {
      const [group, qRaw] = key.split("|");
      return {
        group,
        q: Number(qRaw),
        pairs: values.length,
        score_delta_mean: round(mean(values.map((value) => value.score)), 3),
        first_ratio_mean: round(mean(values.map((value) => value.firstRatio)), 4),
        candidate_ratio_mean: round(mean(values.map((value) => value.candidateRatio)), 4),
        repair_delta_mean: round(mean(values.map((value) => value.repair)), 1),
      };
    })
    .sort((a, b) => compareGroup(a.group, b.group) || a.q - b.q);
}

function residualGroups(
  samples: Sample[],
  predicted: number[],
  keyOf: (row: Sample) => string,
): ResidualGroup[] {
  const groups = new Map<string, { actual: number; predicted: number }[]>();
  for (let i = 0; i < samples.length; i++) {
    const key = keyOf(samples[i]);
    groups.set(key, [...(groups.get(key) ?? []), { actual: samples[i].first, predicted: predicted[i] }]);
  }
  return [...groups.entries()]
    .map(([key, values]) => {
      const errors = values.map((value) => value.actual - value.predicted);
      return {
        key,
        n: values.length,
        mae: round(mean(errors.map(Math.abs)), 1),
        bias: round(mean(errors), 1),
        actual_mean: round(mean(values.map((value) => value.actual)), 1),
        predicted_mean: round(mean(values.map((value) => value.predicted)), 1),
      };
    })
    .sort((a, b) => compareGroup(a.key, b.key));
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

function feature(name: keyof SpecFeatures): (row: Sample) => number {
  return (row) => specFeatures.get(row.spec)?.[name] ?? 0;
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

function pairKey(row: Pick<StudyRow, "budget" | "spec" | "seed">): string {
  return `${row.budget}|${row.spec}|${row.seed}`;
}

function compareGroup(a: string, b: string): number {
  const an = Number(a);
  const bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return a.localeCompare(b);
}

function metric(actual: number[], predicted: number[]): Metrics {
  const errors = actual.map((value, index) => value - predicted[index]);
  return {
    n: actual.length,
    r2: round(r2(actual, predicted), 4),
    mae: round(mean(errors.map(Math.abs)), 1),
    rmse: round(Math.sqrt(mean(errors.map((error) => error * error))), 1),
    mape: round(mean(errors.map((error, index) => Math.abs(error) / Math.max(1, actual[index]))), 4),
    bias: round(mean(errors), 1),
  };
}

function r2(actual: number[], predicted: number[]): number {
  const yMean = mean(actual);
  const sst = actual.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const sse = actual.reduce((sum, value, index) => sum + (value - predicted[index]) ** 2, 0);
  return 1 - sse / Math.max(1e-12, sst);
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
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = (sorted.length - 1) / 2;
  const lo = Math.floor(middle);
  const hi = Math.ceil(middle);
  if (lo === hi) return sorted[lo];
  const frac = middle - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function stddev(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
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
    `qcand-models: rows=${result.config.rows} budgets=${result.config.budgets.join(",")} ` +
      `specs=${result.config.specs.length} seeds=${result.config.seeds.length} q=${result.config.q_values.join(",")}`,
  );
  console.log("first-completion model ranking by leave-one-spec-out MAE:");
  for (const model of result.model_results) {
    console.log(
      `  ${model.model} train=${fmt(model.train.mae)}f ` +
        `loso=${fmt(model.leave_one_spec_out?.mae)}f ` +
        `lobo=${fmt(model.leave_one_budget_out?.mae)}f ` +
        `loseed=${fmt(model.leave_one_seed_out?.mae)}f ` +
        `r2=${fmt(model.leave_one_spec_out?.r2, 3)}`,
    );
  }
  const all = result.paired_response.filter((row) => row.group === "all");
  console.log("paired all-budget q response:");
  for (const row of all) {
    console.log(
      `  q=${row.q} pairs=${row.pairs} dScore=${row.score_delta_mean.toFixed(2)} ` +
        `firstRatio=${row.first_ratio_mean.toFixed(3)} candRatio=${row.candidate_ratio_mean.toFixed(3)}`,
    );
  }
}
