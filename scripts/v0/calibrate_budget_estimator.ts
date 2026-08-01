/**
 * Fit and validate the policy-neutral remaining-work estimator artifact.
 *
 * Input is the JSON emitted by analyze_budget_telemetry.ts. Source-family
 * groups are held out together, and every attempt has total weight one so a
 * dense trace cannot dominate a sparse one.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import {
  BUDGET_ESTIMATOR_MODEL_SCHEMA,
  estimateRemainingBudgetWork,
  type BudgetEstimatorBaseMode,
  type BudgetEstimatorModelArtifact,
  type BudgetEstimatorPaceSchedule,
} from "./optimizer/budget_estimator.ts";
import { TRAVERSAL_BUDGET_MODEL_V1 } from "./optimizer/budget_model.ts";

type Sample = {
  source: string;
  context: string;
  group: string;
  attemptKind: "initial" | "snapshot" | "repair";
  attemptId: number;
  event: "start" | "high_water" | "spend" | "terminal" | "end";
  actual: number;
  structural: number;
  path: number | null;
  pace: number | null;
  remainingContacts: number;
  remainingDurationFrames: number;
  startupIncluded: boolean;
  progressFraction: number;
  policyBudgetFrames: number;
};

type WeightedSample = Sample & { weight: number; fold: number };
type Candidate = {
  baseMode: BudgetEstimatorBaseMode;
  paceSchedule: BudgetEstimatorPaceSchedule;
};
type Prediction = { sample: WeightedSample; predicted: number };
type Metrics = {
  n: number;
  weightedMedianAbsoluteLogError: number;
  weightedMeanAbsoluteLogError: number;
  weightedP90ActualOverPrediction: number;
  weightedBiasLogRatio: number;
};

const args = process.argv.slice(2);
const inputPath = args.find((value) => !value.startsWith("--"));
if (inputPath === undefined) {
  throw new Error("usage: calibrate_budget_estimator.ts <analysis.json> [--out=model.json] [--report=report.json] [--folds=5] [--coverage=0.95]");
}
const valueOf = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length);
};
const outputPath = resolve(valueOf("out") ?? "generated/analysis/budget-estimator-model.json");
const reportPath = resolve(valueOf("report") ?? "generated/analysis/budget-estimator-calibration.json");
const requestedFolds = positiveInteger(valueOf("folds") ?? "5", "folds");
const nominalCoverage = probability(valueOf("coverage") ?? "0.95", "coverage");
const tailProbability = (1 - nominalCoverage) / 2;
const analysis = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
const portableInputPath = relative(process.cwd(), resolve(inputPath));
if (analysis.schema !== "line.compile-budget-telemetry-analysis.v1") {
  throw new Error(`expected line.compile-budget-telemetry-analysis.v1, got ${String(analysis.schema)}`);
}
const rawSamples = parseSamples(analysis.calibration_samples);
const groups = [...new Set(rawSamples.map((sample) => sample.group))].sort();
if (groups.length < 2) throw new Error("calibration requires at least two source-family groups");
const foldCount = Math.min(requestedFolds, groups.length);
const foldByGroup = assignFolds(groups, foldCount);
const weighted = weightSamples(rawSamples).map((sample) => ({
  ...sample,
  fold: foldByGroup.get(sample.group)!,
}));

const candidates: Candidate[] = [];
for (const baseMode of [
  "structural",
  "path_if_available",
  "geometric_structural_path",
] as const) {
  for (const paceSchedule of [
    "none",
    "linear_progress",
    "sqrt_progress",
    "smoothstep_progress",
  ] as const) candidates.push({ baseMode, paceSchedule });
}

const staticPredictions = weighted.map((sample) => ({
  sample,
  predicted: Math.max(1, sample.structural),
}));
const staticMetrics = metrics(staticPredictions);
const evaluated = candidates.map((candidate) => {
  const predictions = crossValidatedPredictions(weighted, foldCount, candidate);
  return { candidate, metrics: metrics(predictions), predictions };
}).sort(compareCandidateResults);
const best = evaluated[0];
const accepted =
  best.metrics.weightedMedianAbsoluteLogError <=
    staticMetrics.weightedMedianAbsoluteLogError * 0.95 &&
  best.metrics.weightedP90ActualOverPrediction <=
    staticMetrics.weightedP90ActualOverPrediction * 1.05;
const selectedCandidate: Candidate = accepted
  ? best.candidate
  : { baseMode: "structural", paceSchedule: "none" };
const selectedOof = accepted ? best.predictions : staticPredictions;
const structural = accepted ? fitStructural(weighted) : { ...TRAVERSAL_BUDGET_MODEL_V1 };
const correctionFactors = accepted
  ? fitCorrection(weighted, structural, selectedCandidate)
  : { withoutPath: 1, withPath: 1 };
const ratios = selectedOof.map(({ sample, predicted }) => ({
  value: sample.actual / Math.max(1, predicted),
  weight: sample.weight,
}));
const intervalStrata = [...new Set(selectedOof.map(({ sample }) => sample.event))]
  .map((event) => {
    const predictions = selectedOof.filter(({ sample }) => sample.event === event);
    const eventRatios = predictions.map(({ sample, predicted }) => ({
      value: sample.actual / Math.max(1, predicted),
      weight: sample.weight,
    }));
    return {
      event,
      n: predictions.length,
      lowerRatio: weightedPercentile(eventRatios, tailProbability),
      upperRatio: weightedPercentile(eventRatios, 1 - tailProbability),
    };
  });
const lowerRatio = Math.min(1, ...intervalStrata.map((stratum) => stratum.lowerRatio));
const upperRatio = Math.max(1, ...intervalStrata.map((stratum) => stratum.upperRatio));
const intervalByEvent = Object.fromEntries(intervalStrata.map((stratum) => [
  stratum.event,
  { lowerRatio: stratum.lowerRatio, upperRatio: stratum.upperRatio },
]));
const intervalCoverage = weightedEventCoverage(selectedOof, intervalByEvent);
const datasetFingerprint = createHash("sha256")
  .update(JSON.stringify(rawSamples))
  .digest("hex");
const selectedMetrics = metrics(selectedOof);
const candidateLabel = `${selectedCandidate.baseMode}+${selectedCandidate.paceSchedule}`;
const model: BudgetEstimatorModelArtifact = {
  schema: BUDGET_ESTIMATOR_MODEL_SCHEMA,
  modelId: `${accepted ? "calibrated" : "static"}-${candidateLabel}-${datasetFingerprint.slice(0, 12)}`,
  calibrated: true,
  generatedAt: new Date().toISOString(),
  provenance: {
    generator: "scripts/v0/calibrate_budget_estimator.ts",
    analysisSchema: analysis.schema,
    datasetFingerprint,
    inputs: Array.isArray(analysis.inputs) ? analysis.inputs : [portableInputPath],
    groups: groups.length,
    samples: weighted.length,
    folds: foldCount,
    acceptance: accepted
      ? "accepted: >=5% weighted median log-error improvement and <=5% p90 underprediction regression"
      : "retained static: candidate did not satisfy acceptance gates",
  },
  structural: {
    name: accepted
      ? `budget-telemetry-nnls/${datasetFingerprint.slice(0, 12)}`
      : TRAVERSAL_BUDGET_MODEL_V1.name,
    source: accepted
      ? `${portableInputPath}; grouped ${foldCount}-fold validation`
      : TRAVERSAL_BUDGET_MODEL_V1.source,
    interceptFrames: round(structural.interceptFrames),
    contactFrames: round(structural.contactFrames),
    durationFrameScale: round(structural.durationFrameScale),
  },
  combination: {
    ...selectedCandidate,
    correctionWithoutPathFactor: round(correctionFactors.withoutPath),
    correctionWithPathFactor: round(correctionFactors.withPath),
  },
  interval: {
    lowerRatio: round(lowerRatio),
    upperRatio: round(upperRatio),
    nominalCoverage,
    byEvent: Object.fromEntries(Object.entries(intervalByEvent).map(([event, interval]) => [
      event,
      { lowerRatio: round(interval.lowerRatio), upperRatio: round(interval.upperRatio) },
    ])),
  },
  applicability: {
    structuralPolicyBudgetFrames: {
      min: Math.min(...weighted.map((sample) => sample.policyBudgetFrames)),
      max: Math.max(...weighted.map((sample) => sample.policyBudgetFrames)),
    },
    structuralAttemptKinds: [...new Set(weighted
      .filter((sample) => sample.path === null)
      .map((sample) => sample.attemptKind))].sort(),
    pathEstimate: "calibrated_when_available",
  },
  metrics: {
    validationMedianAbsoluteLogError: round(selectedMetrics.weightedMedianAbsoluteLogError),
    validationP90UnderpredictionRatio: round(selectedMetrics.weightedP90ActualOverPrediction),
    validationIntervalCoverage: round(intervalCoverage),
    staticMedianAbsoluteLogError: round(staticMetrics.weightedMedianAbsoluteLogError),
    acceptedAgainstStatic: accepted,
  },
};

const report = {
  schema: "line.compile-budget-estimator-calibration.v1",
  generatedAt: model.generatedAt,
  input: portableInputPath,
  datasetFingerprint,
  samples: weighted.length,
  groups,
  foldCount,
  weighting: "each completed attempt has total weight one",
  staticMetrics,
  acceptance: {
    accepted,
    selectedCandidate,
    selectedMetrics,
    medianLogErrorImprovement: 1 -
      selectedMetrics.weightedMedianAbsoluteLogError /
        Math.max(Number.EPSILON, staticMetrics.weightedMedianAbsoluteLogError),
  },
  interval: {
    nominalCoverage,
    lowerRatio,
    upperRatio,
    coverage: intervalCoverage,
    strata: intervalStrata,
  },
  candidates: evaluated.map(({ candidate, metrics: candidateMetrics }) => ({
    candidate,
    metrics: candidateMetrics,
  })),
  model,
};
mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(model, null, 2)}\n`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`budget estimator ${accepted ? "accepted" : "retained static"}: ${candidateLabel}`);
console.log(`  samples ${weighted.length}; groups ${groups.length}; folds ${foldCount}`);
console.log(
  `  median |log ratio| ${selectedMetrics.weightedMedianAbsoluteLogError.toFixed(4)} ` +
  `(static ${staticMetrics.weightedMedianAbsoluteLogError.toFixed(4)})`,
);
console.log(
  `  p90 actual/predicted ${selectedMetrics.weightedP90ActualOverPrediction.toFixed(3)}; ` +
  `interval ${(100 * intervalCoverage).toFixed(1)}% [${lowerRatio.toFixed(3)}, ${upperRatio.toFixed(3)}]`,
);
console.log(`  model ${outputPath}`);
console.log(`  report ${reportPath}`);

function parseSamples(value: unknown): Sample[] {
  if (!Array.isArray(value)) throw new Error("analysis calibration_samples must be an array");
  return value.map((row, index) => {
    if (typeof row !== "object" || row === null) throw new Error(`sample ${index} must be an object`);
    const sample = row as Sample;
    for (const name of [
      "actual",
      "structural",
      "remainingContacts",
      "remainingDurationFrames",
      "progressFraction",
    ] as const) {
      if (!Number.isFinite(sample[name])) throw new Error(`sample ${index} ${name} must be finite`);
    }
    if (!(sample.actual > 0)) throw new Error(`sample ${index} actual must be positive`);
    if (typeof sample.group !== "string" || sample.group.length === 0) throw new Error(`sample ${index} group is required`);
    return {
      ...sample,
      startupIncluded: sample.startupIncluded ??
        (sample.attemptKind === "initial" && sample.progressFraction === 0),
    };
  });
}

function weightSamples(samples: Sample[]): Array<Sample & { weight: number }> {
  const counts = new Map<string, number>();
  for (const sample of samples) {
    const key = attemptKey(sample);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return samples.map((sample) => ({
    ...sample,
    weight: 1 / counts.get(attemptKey(sample))!,
  }));
}

function attemptKey(sample: Sample): string {
  return `${sample.source}\u0000${sample.context}\u0000${sample.attemptKind}\u0000${sample.attemptId}`;
}

function assignFolds(groups: string[], folds: number): Map<string, number> {
  const ordered = [...groups].sort((a, b) => groupHash(a).localeCompare(groupHash(b)) || a.localeCompare(b));
  return new Map(ordered.map((group, index) => [group, index % folds]));
}

function groupHash(group: string): string {
  return createHash("sha256").update(group).digest("hex");
}

function crossValidatedPredictions(
  samples: WeightedSample[],
  folds: number,
  candidate: Candidate,
): Prediction[] {
  const predictions: Prediction[] = [];
  for (let fold = 0; fold < folds; fold++) {
    const train = samples.filter((sample) => sample.fold !== fold);
    const test = samples.filter((sample) => sample.fold === fold);
    const structural = fitStructural(train);
    const correction = fitCorrection(train, structural, candidate);
    for (const sample of test) {
      predictions.push({
        sample,
        predicted: predict(sample, structural, candidate, correction),
      });
    }
  }
  return predictions;
}

function fitCorrection(
  samples: Array<Sample & { weight: number }>,
  structural: { interceptFrames: number; contactFrames: number; durationFrameScale: number },
  candidate: Candidate,
): { withoutPath: number; withPath: number } {
  const allLogs = samples.map((sample) => ({
    sample,
    value: Math.log(sample.actual / Math.max(1, predict(
      sample,
      structural,
      candidate,
      { withoutPath: 1, withPath: 1 },
    ))),
    weight: sample.weight,
  }));
  const correction = (withPath: boolean): number => {
    const subset = allLogs.filter(({ sample }) =>
      (candidate.baseMode !== "structural" && sample.path !== null) === withPath
    );
    const values = subset.length > 0 ? subset : allLogs;
    return Math.exp(weightedPercentile(values, 0.5));
  };
  return { withoutPath: correction(false), withPath: correction(true) };
}

function predict(
  sample: Sample,
  structural: { interceptFrames: number; contactFrames: number; durationFrameScale: number },
  candidate: Candidate,
  correctionFactors: { withoutPath: number; withPath: number },
): number {
  const structuralPrediction =
    (sample.startupIncluded ? structural.interceptFrames : 0) +
    structural.contactFrames * sample.remainingContacts +
    structural.durationFrameScale * sample.remainingDurationFrames;
  return Math.max(1, estimateRemainingBudgetWork({
    structural: structuralPrediction,
    path: sample.path,
    pace: sample.pace,
    progressFraction: sample.progressFraction,
  }, artifactForPrediction(structural, candidate, correctionFactors)));
}

function artifactForPrediction(
  structural: { interceptFrames: number; contactFrames: number; durationFrameScale: number },
  candidate: Candidate,
  correctionFactors: { withoutPath: number; withPath: number },
): BudgetEstimatorModelArtifact {
  return {
    schema: BUDGET_ESTIMATOR_MODEL_SCHEMA,
    modelId: "calibration-evaluation",
    calibrated: false,
    generatedAt: "",
    provenance: {
      generator: "calibration",
      analysisSchema: "line.compile-budget-telemetry-analysis.v1",
      datasetFingerprint: null,
      inputs: [],
      groups: 0,
      samples: 0,
      folds: 0,
      acceptance: "evaluation",
    },
    structural: { name: "evaluation", source: "calibration", ...structural },
    combination: {
      ...candidate,
      correctionWithoutPathFactor: correctionFactors.withoutPath,
      correctionWithPathFactor: correctionFactors.withPath,
    },
    interval: { lowerRatio: 1, upperRatio: 1, nominalCoverage: 0, byEvent: {} },
    applicability: {
      structuralPolicyBudgetFrames: { min: 0, max: Number.MAX_SAFE_INTEGER },
      structuralAttemptKinds: ["initial", "snapshot", "repair"],
      pathEstimate: "calibrated_when_available",
    },
    metrics: {
      validationMedianAbsoluteLogError: null,
      validationP90UnderpredictionRatio: null,
      validationIntervalCoverage: null,
      staticMedianAbsoluteLogError: null,
      acceptedAgainstStatic: false,
    },
  };
}

function fitStructural(samples: Array<Sample & { weight: number }>): {
  interceptFrames: number;
  contactFrames: number;
  durationFrameScale: number;
} {
  let best = { coefficients: [0, 0, 0], error: Infinity };
  for (let mask = 1; mask < 8; mask++) {
    const indexes = [0, 1, 2].filter((index) => (mask & (1 << index)) !== 0);
    const matrix = indexes.map(() => indexes.map(() => 0));
    const vector = indexes.map(() => 0);
    for (const sample of samples) {
      const features = [sample.startupIncluded ? 1 : 0, sample.remainingContacts, sample.remainingDurationFrames];
      for (let row = 0; row < indexes.length; row++) {
        vector[row] += sample.weight * features[indexes[row]] * sample.actual;
        for (let column = 0; column < indexes.length; column++) {
          matrix[row][column] += sample.weight * features[indexes[row]] * features[indexes[column]];
        }
      }
    }
    const active = solveLinearSystem(matrix, vector);
    if (active === null || active.some((coefficient) => coefficient < 0 || !Number.isFinite(coefficient))) continue;
    const coefficients = [0, 0, 0];
    indexes.forEach((index, position) => { coefficients[index] = active[position]; });
    const error = samples.reduce((sum, sample) => {
      const predicted = (sample.startupIncluded ? coefficients[0] : 0) +
        coefficients[1] * sample.remainingContacts +
        coefficients[2] * sample.remainingDurationFrames;
      return sum + sample.weight * (predicted - sample.actual) ** 2;
    }, 0);
    if (error < best.error) best = { coefficients, error };
  }
  if (!Number.isFinite(best.error)) return { ...TRAVERSAL_BUDGET_MODEL_V1 };
  return {
    interceptFrames: best.coefficients[0],
    contactFrames: best.coefficients[1],
    durationFrameScale: best.coefficients[2],
  };
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-12) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const scale = augmented[column][column];
    for (let entry = column; entry <= n; entry++) augmented[column][entry] /= scale;
    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let entry = column; entry <= n; entry++) {
        augmented[row][entry] -= factor * augmented[column][entry];
      }
    }
  }
  return augmented.map((row) => row[n]);
}

function metrics(predictions: Prediction[]): Metrics {
  const logs = predictions.map(({ sample, predicted }) => ({
    value: Math.log(Math.max(1, predicted) / sample.actual),
    weight: sample.weight,
  }));
  return {
    n: predictions.length,
    weightedMedianAbsoluteLogError: weightedPercentile(
      logs.map((entry) => ({ ...entry, value: Math.abs(entry.value) })),
      0.5,
    ),
    weightedMeanAbsoluteLogError: weightedMean(
      logs.map((entry) => ({ ...entry, value: Math.abs(entry.value) })),
    ),
    weightedP90ActualOverPrediction: weightedPercentile(
      predictions.map(({ sample, predicted }) => ({
        value: sample.actual / Math.max(1, predicted),
        weight: sample.weight,
      })),
      0.9,
    ),
    weightedBiasLogRatio: weightedMean(logs),
  };
}

function compareCandidateResults(
  a: { candidate: Candidate; metrics: Metrics },
  b: { candidate: Candidate; metrics: Metrics },
): number {
  return a.metrics.weightedMedianAbsoluteLogError - b.metrics.weightedMedianAbsoluteLogError ||
    a.metrics.weightedP90ActualOverPrediction - b.metrics.weightedP90ActualOverPrediction ||
    candidateComplexity(a.candidate) - candidateComplexity(b.candidate);
}

function candidateComplexity(candidate: Candidate): number {
  return (candidate.baseMode === "structural" ? 0 : 1) +
    (candidate.paceSchedule === "none" ? 0 : 1);
}

function weightedCoverage(predictions: Prediction[], lower: number, upper: number): number {
  const total = predictions.reduce((sum, { sample }) => sum + sample.weight, 0);
  const covered = predictions.reduce((sum, { sample, predicted }) =>
    sum + (sample.actual >= predicted * lower && sample.actual <= predicted * upper ? sample.weight : 0), 0);
  return total > 0 ? covered / total : 0;
}

function weightedEventCoverage(
  predictions: Prediction[],
  intervals: Record<string, { lowerRatio: number; upperRatio: number }>,
): number {
  const total = predictions.reduce((sum, { sample }) => sum + sample.weight, 0);
  const covered = predictions.reduce((sum, { sample, predicted }) => {
    const interval = intervals[sample.event];
    return sum + (
      interval !== undefined &&
      sample.actual >= predicted * interval.lowerRatio &&
      sample.actual <= predicted * interval.upperRatio
        ? sample.weight
        : 0
    );
  }, 0);
  return total > 0 ? covered / total : 0;
}

function weightedMean(values: Array<{ value: number; weight: number }>): number {
  const total = values.reduce((sum, entry) => sum + entry.weight, 0);
  return values.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / Math.max(Number.EPSILON, total);
}

function weightedPercentile(
  values: Array<{ value: number; weight: number }>,
  probability: number,
): number {
  if (values.length === 0) throw new Error("weighted percentile requires values");
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const target = clamp01(probability) * sorted.reduce((sum, entry) => sum + entry.weight, 0);
  let cumulative = 0;
  for (const entry of sorted) {
    cumulative += entry.weight;
    if (cumulative >= target) return entry.value;
  }
  return sorted.at(-1)!.value;
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive integer`);
  return parsed;
}

function probability(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) {
    throw new Error(`--${name} must be between zero and one`);
  }
  return parsed;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
