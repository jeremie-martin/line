/**
 * Compare unified quality-ncand first-completion models.
 *
 * Consumes one or more `study_budget_spend.ts` outputs and asks:
 *
 *   C_first(spec, q) ~= D_ref(spec) * M(q / q_ref)
 *
 * for several candidate anchors. This is characterization only; it does not
 * change compiler policy.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
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
};

type SpecFeatures = {
  spec: string;
  contact_count: number;
  duration_frames: number;
  median_gap_frames: number;
  min_gap_frames: number;
  inverse_gap_sum: number;
  contact_density_per_second: number;
};

type Sample = StudyRow & {
  first: number;
  current_d: number;
};

type Metrics = {
  n: number;
  r2: number;
  mae: number;
  rmse: number;
  mape: number;
  bias: number;
};

type MultiplierFit = {
  beta: number;
  n: number;
  ratio_mae: number;
  ratio_r2: number;
  by_q: {
    q: number;
    n: number;
    ratio_mean: number;
    predicted: number;
    ratio_mae: number;
  }[];
};

type ModelResult = {
  model: string;
  features?: string[];
  train: Metrics;
  leave_one_spec_out?: Metrics;
};

type AnchorResult = {
  anchor_q: number;
  group: string;
  rows: number;
  pairs: number;
  multiplier: MultiplierFit;
  models: ModelResult[];
};

const argv = process.argv.slice(2);
const inputPaths = inputList();
if (inputPaths.length === 0) {
  throw new Error("usage: --inputs=a.json,b.json [--anchors=24,28,32] [--out=analysis.json]");
}
const anchors = positiveIntListArg("anchors", [24, 28, 32]);
const outPath = arg("out");
const studies = inputPaths.map(readStudy);
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
  specFeatures.set(specName, featuresForSpec(specName, await loadGoldenSpec(specName as GoldenSpecName, "base")));
}

const groups = [
  { name: "all", rows },
  ...[...new Set(rows.map((row) => row.budget))]
    .sort((a, b) => a - b)
    .map((budget) => ({
      name: String(budget),
      rows: rows.filter((row) => row.budget === budget),
    })),
];

const results = groups.flatMap((group) =>
  anchors.map((anchor) => analyzeAnchor(group.name, group.rows, anchor))
    .filter((result): result is AnchorResult => result !== null)
);

const output = {
  config: {
    inputs: inputPaths,
    anchors,
    rows: rows.length,
    budgets: [...new Set(rows.map((row) => row.budget))].sort((a, b) => a - b),
    q_values: [...new Set(rows.map((row) => row.quality_ncand))].sort((a, b) => a - b),
  },
  results,
};

if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
}

printSummary(results);
if (outPath !== undefined) console.log(`wrote ${outPath}`);

function analyzeAnchor(group: string, groupRows: Sample[], anchor: number): AnchorResult | null {
  const pairs = pairedRows(groupRows, anchor);
  if (pairs.length === 0) return null;
  const multiplier = fitMultiplier(pairs, anchor);
  const beta = multiplier.beta;
  const models: ModelResult[] = [
    {
      model: "oracle_anchor_row",
      train: metric(
        pairs.map((pair) => pair.row.first),
        pairs.map((pair) => pair.anchor.first * multiplierFor(pair.row.quality_ncand, anchor, beta)),
      ),
    },
    currentDModel(groupRows, anchor),
    specAnchorModel(groupRows, anchor, ["contact_count", "duration_frames"], "spec_anchor_contacts_duration"),
    specAnchorModel(
      groupRows,
      anchor,
      ["contact_count", "duration_frames", "inverse_gap_sum"],
      "spec_anchor_contacts_duration_spacing",
    ),
  ].filter((model): model is ModelResult => model !== null);
  return {
    anchor_q: anchor,
    group,
    rows: groupRows.length,
    pairs: pairs.length,
    multiplier,
    models,
  };
}

function currentDModel(groupRows: Sample[], anchor: number): ModelResult {
  const samples = groupRows.map((row) => ({
    x: row.quality_ncand / anchor - 1,
    y: row.first / row.current_d,
    row,
  }));
  const line = fitLine(samples.map((sample) => sample.x), samples.map((sample) => sample.y));
  const predicted = samples.map((sample) => sample.row.current_d * (line.intercept + line.slope * sample.x));
  return {
    model: "current_D_q_linear",
    train: metric(samples.map((sample) => sample.row.first), predicted),
  };
}

function specAnchorModel(
  groupRows: Sample[],
  anchor: number,
  features: string[],
  modelName: string,
): ModelResult | null {
  const anchorRows = groupRows.filter((row) => row.quality_ncand === anchor);
  if (anchorRows.length <= features.length + 1) return null;
  const pairs = pairedRows(groupRows, anchor);
  if (pairs.length === 0) return null;
  const beta = fitMultiplier(pairs, anchor).beta;
  const dModel = fitOls(anchorRows, features);
  const trainPredicted = groupRows.map((row) =>
    dModel.predict(row) * multiplierFor(row.quality_ncand, anchor, beta)
  );
  const looPredicted: number[] = [];
  const looActual: number[] = [];
  for (const spec of [...new Set(groupRows.map((row) => row.spec))]) {
    const trainAnchorRows = anchorRows.filter((row) => row.spec !== spec);
    const trainRows = groupRows.filter((row) => row.spec !== spec);
    const testRows = groupRows.filter((row) => row.spec === spec);
    if (trainAnchorRows.length <= features.length + 1 || testRows.length === 0) continue;
    const trainPairs = pairedRows(trainRows, anchor);
    if (trainPairs.length === 0) continue;
    const trainBeta = fitMultiplier(trainPairs, anchor).beta;
    const model = fitOls(trainAnchorRows, features);
    for (const row of testRows) {
      looActual.push(row.first);
      looPredicted.push(model.predict(row) * multiplierFor(row.quality_ncand, anchor, trainBeta));
    }
  }
  return {
    model: modelName,
    features,
    train: metric(groupRows.map((row) => row.first), trainPredicted),
    ...(looActual.length > 0 ? { leave_one_spec_out: metric(looActual, looPredicted) } : {}),
  };
}

function pairedRows(rowsIn: Sample[], anchor: number): { row: Sample; anchor: Sample }[] {
  const anchorsByKey = new Map<string, Sample>();
  for (const row of rowsIn) {
    if (row.quality_ncand === anchor) anchorsByKey.set(pairKey(row), row);
  }
  const out: { row: Sample; anchor: Sample }[] = [];
  for (const row of rowsIn) {
    const anchorRow = anchorsByKey.get(pairKey(row));
    if (anchorRow !== undefined) out.push({ row, anchor: anchorRow });
  }
  return out;
}

function fitMultiplier(pairs: { row: Sample; anchor: Sample }[], anchor: number): MultiplierFit {
  let sxx = 0;
  let sxy = 0;
  const samples = pairs
    .filter((pair) => pair.anchor.first > 0)
    .map((pair) => ({
      q: pair.row.quality_ncand,
      x: pair.row.quality_ncand / anchor - 1,
      ratio: pair.row.first / pair.anchor.first,
    }));
  for (const sample of samples) {
    sxx += sample.x * sample.x;
    sxy += sample.x * (sample.ratio - 1);
  }
  const beta = sxx > 1e-12 ? sxy / sxx : 0;
  const predicted = samples.map((sample) => multiplierFor(sample.q, anchor, beta));
  const actual = samples.map((sample) => sample.ratio);
  const byQ = [...new Set(samples.map((sample) => sample.q))]
    .sort((a, b) => a - b)
    .map((q) => {
      const xs = samples.filter((sample) => sample.q === q);
      const pred = multiplierFor(q, anchor, beta);
      return {
        q,
        n: xs.length,
        ratio_mean: round(mean(xs.map((sample) => sample.ratio)), 4),
        predicted: round(pred, 4),
        ratio_mae: round(mean(xs.map((sample) => Math.abs(sample.ratio - pred))), 4),
      };
    });
  return {
    beta: round(beta, 6),
    n: samples.length,
    ratio_mae: round(mean(actual.map((value, index) => Math.abs(value - predicted[index]))), 4),
    ratio_r2: round(r2(actual, predicted), 4),
    by_q: byQ,
  };
}

function multiplierFor(q: number, anchor: number, beta: number): number {
  return Math.max(0.05, 1 + beta * (q / anchor - 1));
}

function fitOls(rowsIn: Sample[], features: string[]): { predict: (row: Sample) => number } {
  const k = features.length;
  const means = features.map((feature) => mean(rowsIn.map((row) => featureValue(row, feature))));
  const stds = features.map((feature, index) => {
    const sd = stddev(rowsIn.map((row) => featureValue(row, feature)));
    return sd > 1e-12 ? sd : 1;
  });
  const xtx = Array.from({ length: k + 1 }, () => Array(k + 1).fill(0));
  const xty = Array(k + 1).fill(0);
  for (const row of rowsIn) {
    const x = [1, ...features.map((feature, index) => (featureValue(row, feature) - means[index]) / stds[index])];
    for (let i = 0; i < x.length; i++) {
      xty[i] += x[i] * row.first;
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
      sum + coefficient * featureValue(row, features[index]), 0),
  };
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

function featureValue(row: Sample, feature: string): number {
  const features = specFeatures.get(row.spec);
  if (features === undefined) return 0;
  const value = features[feature as keyof SpecFeatures];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function featuresForSpec(specName: string, spec: Spec): SpecFeatures {
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
    spec: specName,
    contact_count: contactFrames.length,
    duration_frames: durationFrames,
    median_gap_frames: median(gaps),
    min_gap_frames: gaps.length > 0 ? Math.min(...gaps) : 0,
    inverse_gap_sum: gaps.reduce((sum, gap) => sum + FPS / gap, 0),
    contact_density_per_second: contactFrames.length / Math.max(1e-9, spec.duration),
  };
}

function readStudy(path: string): StudyFile {
  return JSON.parse(readFileSync(path, "utf8")) as StudyFile;
}

function inputList(): string[] {
  const raw = arg("inputs");
  if (raw !== undefined && raw.trim() !== "") return raw.split(",").filter((value) => value.trim() !== "");
  return argv.filter((value) => !value.startsWith("--"));
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function positiveIntListArg(name: string, fallback: number[]): number[] {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return fallback;
  return raw.split(",").map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function pairKey(row: Pick<StudyRow, "budget" | "spec" | "seed">): string {
  return `${row.budget}|${row.spec}|${row.seed}`;
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

function fmt(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "na";
}

function printSummary(resultsIn: AnchorResult[]): void {
  for (const result of resultsIn) {
    console.log(
      `anchor q=${result.anchor_q} group=${result.group} rows=${result.rows} pairs=${result.pairs} ` +
        `beta=${result.multiplier.beta.toFixed(3)} ratioMae=${result.multiplier.ratio_mae.toFixed(3)}`,
    );
    for (const model of result.models) {
      const loo = model.leave_one_spec_out;
      console.log(
        `  ${model.model} train: mae=${fmt(model.train.mae, 0)}f ` +
          `r2=${fmt(model.train.r2, 3)} bias=${fmt(model.train.bias, 0)}f` +
          (loo ? ` · loo: mae=${fmt(loo.mae, 0)}f r2=${fmt(loo.r2, 3)}` : ""),
      );
    }
  }
}
