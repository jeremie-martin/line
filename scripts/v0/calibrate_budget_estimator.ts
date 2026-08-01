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
  parseBudgetEstimatorModel,
  type BudgetEstimatorAttemptKind,
  type BudgetEstimatorBaseMode,
  type BudgetEstimatorModelArtifact,
  type BudgetEstimatorPaceSchedule,
} from "./optimizer/budget_estimator.ts";
import { TRAVERSAL_BUDGET_MODEL_V1 } from "./optimizer/budget_model.ts";

type Sample = {
  source: string;
  context: string;
  group: string;
  attemptKind: BudgetEstimatorAttemptKind;
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

type WeightedSample = Sample & { weight: number; fold: number; seedFold: number };
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

/**
 * The attempt kinds whose anchor semantics are exact, and therefore the only
 * ones admitted as fit evidence.
 *
 * A `resumed` attempt continues the initial attempt's own tree: it reports that
 * tree's ROOT anchor while its frontier is already deep and mixed-depth, so its
 * anchor, `structural_progress_fraction`, and `episode_pace_work_estimate_frames`
 * are documented continuation approximations rather than fresh-start
 * measurements. Its features therefore describe a search state it is not in,
 * and its remaining work is a small fraction of what they imply. Fitting such
 * samples does not merely add noise: because the no-path bucket determines
 * `structuralAttemptKinds`, it would also make the emitted artifact assert
 * `calibrated` for exactly the observations the applicability system exists to
 * mark as unvalidated. They stay in the analysis corpus as diagnostics and are
 * excluded here, with the excluded count recorded in the calibration report.
 */
const FITTED_ATTEMPT_KINDS: ReadonlySet<BudgetEstimatorAttemptKind> = new Set([
  "initial",
  "snapshot",
  "repair",
]);

/** Seed folds crossed with the family folds; 8 panel seeds give 4 pairs of 2. */
const DEFAULT_SEED_FOLDS = 4;

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
const parsedSamples = parseSamples(analysis.calibration_samples);
const rawSamples = parsedSamples.filter((sample) => FITTED_ATTEMPT_KINDS.has(sample.attemptKind));
const excludedSamples = parsedSamples.filter((sample) => !FITTED_ATTEMPT_KINDS.has(sample.attemptKind));
const excludedSamplesByKind = countByKind(excludedSamples);
if (rawSamples.length === 0) {
  throw new Error(
    `no fittable samples: all ${parsedSamples.length} belong to excluded attempt kinds ` +
      `(${[...Object.keys(excludedSamplesByKind)].sort().join(", ")})`,
  );
}
const groups = [...new Set(rawSamples.map((sample) => sample.group))].sort();
if (groups.length < 2) throw new Error("calibration requires at least two source-family groups");
const foldCount = Math.min(requestedFolds, groups.length);
const foldByGroup = assignFolds(groups, foldCount);
/*
 * Held-out evaluation blocks on BOTH source family and seed.
 *
 * Family folds alone leave every seed of a family in the fit whenever that
 * family trains, so seed-level generalization is invisible to them. That is
 * harmless while the point estimate is loose and the intervals are wide, and it
 * silently overstates coverage once the estimate sharpens: intervals fitted on
 * family-held-out-only ratios are tuned to residuals that already saw the seed.
 * Crossing the family folds with seed folds and scoring each sample only where
 * BOTH its family and its seed were withheld makes the fitted percentiles pay
 * for seed variance, which is what lets them widen to honest coverage.
 */
const seedBySample = rawSamples.map(sampleSeed);
const distinctSeeds = [...new Set(seedBySample.filter((seed): seed is number => seed !== null))]
  .sort((a, b) => a - b);
const unresolvedSeeds = seedBySample.filter((seed) => seed === null).length;
const seedBlocked = unresolvedSeeds === 0 && distinctSeeds.length >= 2;
const seedFoldCount = seedBlocked ? Math.min(DEFAULT_SEED_FOLDS, distinctSeeds.length) : 1;
const foldBySeed = assignFolds(distinctSeeds.map(String), Math.max(1, seedFoldCount));
const seedBlockingNote = seedBlocked
  ? null
  : unresolvedSeeds > 0
  ? `seed blocking DISABLED: ${unresolvedSeeds} of ${rawSamples.length} samples have no ` +
    `recoverable seed (context format not sourceId/seed/budget or name/seed=N/...), so ` +
    `held-out evaluation blocks on source family only and interval ratios may be optimistic`
  : `seed blocking DISABLED: the corpus contains ${distinctSeeds.length} distinct seed(s), ` +
    `which cannot be split into held-out seed folds; held-out evaluation blocks on source ` +
    `family only and interval ratios may be optimistic`;
if (seedBlockingNote !== null) console.error(`WARNING: ${seedBlockingNote}`);
const weighted = weightSamples(rawSamples).map((sample, index) => ({
  ...sample,
  fold: foldByGroup.get(sample.group)!,
  seedFold: seedBlocked ? foldBySeed.get(String(seedBySample[index]))! : 0,
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

const staticCandidate: Candidate = { baseMode: "structural", paceSchedule: "none" };
const unitCorrection = { withoutPath: 1, withPath: 1 };
// Evaluate the exact static model we will emit if no candidate clears the
// acceptance gates. sample.structural belongs to the artifact that recorded
// the input telemetry and may have different coefficients.
const staticPredictions = weighted.map((sample) => ({
  sample,
  predicted: predict(sample, TRAVERSAL_BUDGET_MODEL_V1, staticCandidate, unitCorrection),
}));
const staticMetrics = metrics(staticPredictions);
const evaluated = candidates.map((candidate) => {
  const predictions = crossValidatedPredictions(weighted, foldCount, seedFoldCount, candidate);
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
  : staticCandidate;
const selectedOof = accepted ? best.predictions : staticPredictions;
const structural = accepted ? fitStructural(weighted) : { ...TRAVERSAL_BUDGET_MODEL_V1 };
const correctionFactors = accepted
  ? fitCorrection(weighted, structural, selectedCandidate)
  : { withoutPath: 1, withPath: 1 };
/*
 * Interval percentiles are PER-OBSERVATION, while everything else here is
 * attempt-weighted.
 *
 * The two weightings answer different questions and the split is deliberate.
 * Attempt weighting exists so a dense trace cannot dominate the fit; that is
 * the right convention for choosing a candidate and for the coefficients,
 * which describe attempts. An interval is not a claim about attempts. It is
 * read off one observation at a time — by the analyzer's headline coverage and
 * by anything looking at a single `estimate_lower_frames`/`estimate_upper_frames`
 * pair — so `nominalCoverage` is a promise about the observation population,
 * and its percentiles must be taken over observations or the promise is
 * mislabeled. Measured on the 2026-08-01 panel the wedge is 2.6 points
 * (95.2% attempt-weighted against 92.7% per observation, in-sample), because
 * a dense path-backed repair and a sparse structural attempt each carry weight
 * one while contributing very different numbers of observations. Both figures
 * are reported below; only this one is what `nominalCoverage` names.
 */
const intervalStrata = [...new Set(selectedOof.map(({ sample }) => sample.event))]
  .map((event) => {
    const predictions = selectedOof.filter(({ sample }) => sample.event === event);
    const eventRatios = predictions.map(({ sample, predicted }) => ({
      value: sample.actual / Math.max(1, predicted),
      weight: 1,
    }));
    const lowerRatio = Math.min(1, weightedPercentile(eventRatios, tailProbability));
    const upperRatio = Math.max(1, weightedPercentile(eventRatios, 1 - tailProbability));
    const inside = predictions.filter(({ sample, predicted }) =>
      sample.actual >= predicted * lowerRatio && sample.actual <= predicted * upperRatio
    );
    return {
      event,
      n: predictions.length,
      // Runtime artifacts require every interval to contain the point estimate.
      // Keep that invariant per event, not only for the aggregate envelope.
      lowerRatio,
      upperRatio,
      // Both conventions per stratum: `coverageBySample` is what these
      // percentiles target and what the analyzer publishes; `coverage` is the
      // attempt-weighted view of the same intervals, kept so the divergence
      // stays legible instead of being rediscovered.
      coverage: weightRatio(inside, predictions),
      coverageBySample: predictions.length === 0 ? 0 : inside.length / predictions.length,
    };
  });
const lowerRatio = Math.min(1, ...intervalStrata.map((stratum) => stratum.lowerRatio));
const upperRatio = Math.max(1, ...intervalStrata.map((stratum) => stratum.upperRatio));
const intervalByEvent = Object.fromEntries(intervalStrata.map((stratum) => [
  stratum.event,
  { lowerRatio: stratum.lowerRatio, upperRatio: stratum.upperRatio },
]));
const intervalCoverage = weightedEventCoverage(selectedOof, intervalByEvent);
const intervalCoverageBySample = sampleEventCoverage(selectedOof, intervalByEvent);
const datasetFingerprint = createHash("sha256")
  .update(JSON.stringify(rawSamples))
  .digest("hex");
const selectedMetrics = metrics(selectedOof);
const candidateLabel = `${selectedCandidate.baseMode}+${selectedCandidate.paceSchedule}`;
const model: BudgetEstimatorModelArtifact = {
  schema: BUDGET_ESTIMATOR_MODEL_SCHEMA,
  modelId: `${accepted ? "calibrated" : "static"}-${candidateLabel}-${datasetFingerprint.slice(0, 12)}`,
  // The flag means "this artifact was fitted", so a rejected candidate must not
  // claim it: the emitted coefficients are the untouched static fallback, and
  // every telemetry payload copies this flag verbatim.
  calibrated: accepted,
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
    // Reduce, never spread: these arrays are one entry per sample and panels
    // already run to tens of thousands, where Math.min(...arr) throws a V8
    // argument-limit RangeError.
    structuralPolicyBudgetFrames: {
      min: extremum(weighted, "min"),
      max: extremum(weighted, "max"),
    },
    // A structural estimate is one made without a usable path, and the runtime
    // treats a non-positive path as no path at all.
    structuralAttemptKinds: [...new Set(weighted
      .filter((sample) => !hasPath(sample))
      .map((sample) => sample.attemptKind))].sort(),
    pathEstimate: "calibrated_when_available",
  },
  metrics: {
    validationMedianAbsoluteLogError: round(selectedMetrics.weightedMedianAbsoluteLogError),
    validationP90UnderpredictionRatio: round(selectedMetrics.weightedP90ActualOverPrediction),
    validationIntervalCoverage: round(intervalCoverage),
    validationIntervalCoverageBySample: round(intervalCoverageBySample),
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
  foldDesign: {
    blocking: seedBlocked ? "source_family_and_seed" : "source_family_only",
    familyFolds: foldCount,
    seedFolds: seedFoldCount,
    evaluationCells: seedBlocked ? foldCount * seedFoldCount : foldCount,
    seeds: distinctSeeds,
    seedSource: "explicit sample.seed when present, else parsed from analysis context",
    unresolvedSeedSamples: unresolvedSeeds,
    seedFoldBySeed: Object.fromEntries(distinctSeeds.map((seed) => [
      seed,
      seedBlocked ? foldBySeed.get(String(seed))! : null,
    ])),
    familyFoldByGroup: Object.fromEntries(groups.map((group) => [group, foldByGroup.get(group)!])),
    rationale:
      "a sample is scored only by a fit that saw neither its source family nor " +
      "its seed, so interval percentiles pay for seed variance instead of being " +
      "tuned to residuals whose seed was already in the fit",
    note: seedBlockingNote,
  },
  fitPopulation: {
    analysisSamples: parsedSamples.length,
    fittedSamples: rawSamples.length,
    fittedAttemptKinds: [...FITTED_ATTEMPT_KINDS].sort(),
    excludedSamples: excludedSamples.length,
    excludedSamplesByKind,
    excludedAttempts: new Set(excludedSamples.map(attemptKey)).size,
    excludedRationale:
      "resumed attempts continue an earlier search tree, so their anchor, " +
      "structural progress, and episode pace are continuation approximations " +
      "rather than fresh-start measurements; they remain analysis diagnostics " +
      "and must not become calibration evidence",
    structuralAttemptKinds: model.applicability.structuralAttemptKinds,
    structuralAttemptKindsNote:
      "attempt kinds observed WITHOUT a usable incumbent path among fitted " +
      "samples. A kind absent here has no structural calibration evidence in " +
      "this corpus, so the runtime marks its path-free estimates " +
      "unvalidated_attempt_kind.",
  },
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
    // The ratios are per-observation percentiles, so `nominalCoverage` is a
    // claim about `coverageBySample`. `coverage` is the same intervals scored
    // under the attempt weighting the rest of the fit uses.
    coverageConvention: "per_sample",
    lowerRatio,
    upperRatio,
    coverage: intervalCoverage,
    coverageBySample: intervalCoverageBySample,
    strata: intervalStrata,
  },
  candidates: evaluated.map(({ candidate, metrics: candidateMetrics }) => ({
    candidate,
    metrics: candidateMetrics,
  })),
  model,
};
// Never write an artifact the runtime would reject: budget_estimator.ts parses
// the frozen file at import time, so an invalid one turns every compile in the
// repository into an import-time throw.
parseBudgetEstimatorModel(model);
mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(model, null, 2)}\n`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`budget estimator ${accepted ? "accepted" : "retained static"}: ${candidateLabel}`);
console.log(
  `  samples ${weighted.length}; groups ${groups.length}; folds ${foldCount} family` +
  (seedBlocked ? ` x ${seedFoldCount} seed (${foldCount * seedFoldCount} held-out cells)` : ` (seed blocking off)`),
);
if (excludedSamples.length > 0) {
  console.log(
    `  excluded ${excludedSamples.length} samples of unfittable attempt kinds ` +
    `(${Object.entries(excludedSamplesByKind).map(([kind, count]) => `${kind} ${count}`).join(", ")}); ` +
    `structural kinds ${model.applicability.structuralAttemptKinds.join(", ")}`,
  );
}
console.log(
  `  median |log ratio| ${selectedMetrics.weightedMedianAbsoluteLogError.toFixed(4)} ` +
  `(static ${staticMetrics.weightedMedianAbsoluteLogError.toFixed(4)})`,
);
console.log(
  `  p90 actual/predicted ${selectedMetrics.weightedP90ActualOverPrediction.toFixed(3)}; ` +
  `interval ${(100 * intervalCoverage).toFixed(1)}% weighted / ` +
  `${(100 * intervalCoverageBySample).toFixed(1)}% per-sample ` +
  `[${lowerRatio.toFixed(3)}, ${upperRatio.toFixed(3)}]`,
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
      // Unvalidated until now, and it is the field the applicability domain is
      // built from: one missing value poisons min/max with NaN and writes an
      // artifact whose domain rejects everything.
      "policyBudgetFrames",
    ] as const) {
      if (!Number.isFinite(sample[name])) throw new Error(`sample ${index} ${name} must be finite`);
    }
    if (!(sample.actual > 0)) throw new Error(`sample ${index} actual must be positive`);
    if (sample.policyBudgetFrames < 0) {
      throw new Error(`sample ${index} policyBudgetFrames must be non-negative`);
    }
    if (typeof sample.group !== "string" || sample.group.length === 0) throw new Error(`sample ${index} group is required`);
    return {
      ...sample,
      startupIncluded: sample.startupIncluded ??
        (sample.attemptKind === "initial" && sample.progressFraction === 0),
    };
  });
}

/**
 * Whether this sample has a path the runtime would actually use. The estimator
 * discards non-positive paths, so bucketing on `path !== null` would fit the
 * with-path correction on observations that never took the path branch.
 */
function hasPath(sample: Sample): boolean {
  return sample.path !== null && Number.isFinite(sample.path) && sample.path > 0;
}

function extremum(samples: WeightedSample[], mode: "min" | "max"): number {
  const pick = mode === "min" ? Math.min : Math.max;
  return samples.reduce(
    (best, sample) => pick(best, sample.policyBudgetFrames),
    mode === "min" ? Infinity : -Infinity,
  );
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

/**
 * The seed a sample was compiled under, or null when the corpus cannot say.
 *
 * The analysis schema has no seed field, so the seed lives in the context the
 * analyzer built from whichever producer it read: `sourceId/seed/budget` for
 * scale-study and benchmark rows, `name/seed=N/budget=B` for golden archives,
 * and the bare string `sidecar` for run.ts sidecars, which genuinely carry no
 * seed. An explicit field is preferred if a future analyzer emits one. Never
 * guess: an unrecoverable seed disables seed blocking loudly rather than
 * silently collapsing every sample into one seed fold.
 */
function sampleSeed(sample: Sample): number | null {
  const explicit = (sample as { seed?: unknown }).seed;
  if (typeof explicit === "number" && Number.isSafeInteger(explicit)) return explicit;
  const parts = sample.context.split("/");
  for (const part of parts) {
    if (!part.startsWith("seed=")) continue;
    const labelled = Number(part.slice(5));
    return Number.isSafeInteger(labelled) ? labelled : null;
  }
  // Positional form: exactly sourceId/seed/budget, middle field integral.
  if (parts.length === 3) {
    const positional = Number(parts[1]);
    if (parts[1].length > 0 && Number.isSafeInteger(positional)) return positional;
  }
  return null;
}

function countByKind(samples: Sample[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const sample of samples) counts[sample.attemptKind] = (counts[sample.attemptKind] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function assignFolds(groups: string[], folds: number): Map<string, number> {
  const ordered = [...groups].sort((a, b) => groupHash(a).localeCompare(groupHash(b)) || a.localeCompare(b));
  return new Map(ordered.map((group, index) => [group, index % folds]));
}

function groupHash(group: string): string {
  return createHash("sha256").update(group).digest("hex");
}

/**
 * Predict every sample from a fit that saw neither its family nor its seed.
 *
 * Each (family fold, seed fold) cell is scored by a model trained on the
 * samples outside BOTH, so the test cells partition the corpus exactly once and
 * no residual is in-sample along either axis. With seed blocking off the seed
 * condition drops out and this is the historical family-only scheme.
 */
function crossValidatedPredictions(
  samples: WeightedSample[],
  folds: number,
  seedFolds: number,
  candidate: Candidate,
): Prediction[] {
  const predictions: Prediction[] = [];
  for (let fold = 0; fold < folds; fold++) {
    for (let seedFold = 0; seedFold < seedFolds; seedFold++) {
      const test = samples.filter((sample) =>
        sample.fold === fold && (!seedBlocked || sample.seedFold === seedFold)
      );
      if (test.length === 0) continue;
      const train = samples.filter((sample) =>
        sample.fold !== fold && (!seedBlocked || sample.seedFold !== seedFold)
      );
      if (train.length === 0) {
        throw new Error(
          `fold (family ${fold}, seed ${seedFold}) has no training samples left after ` +
            `blocking both axes`,
        );
      }
      const structural = fitStructural(train);
      const correction = fitCorrection(train, structural, candidate);
      for (const sample of test) {
        predictions.push({
          sample,
          predicted: predict(sample, structural, candidate, correction),
        });
      }
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
      (candidate.baseMode !== "structural" && hasPath(sample)) === withPath
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

function weightRatio(subset: Prediction[], all: Prediction[]): number {
  const total = all.reduce((sum, { sample }) => sum + sample.weight, 0);
  return total > 0 ? subset.reduce((sum, { sample }) => sum + sample.weight, 0) / total : 0;
}

/**
 * Coverage counting raw samples rather than attempt weight.
 *
 * The fit targets the attempt-weighted figure, but `analyze_budget_telemetry.ts`
 * publishes the per-sample one, and the two diverge whenever per-attempt sample
 * density differs across prediction regimes — a dense path-backed repair and a
 * sparse structural attempt each carry weight one. Emitting both stops the next
 * reader from comparing a fitted 95% against a measured 92% and concluding the
 * artifact is broken.
 */
function sampleEventCoverage(
  predictions: Prediction[],
  intervals: Record<string, { lowerRatio: number; upperRatio: number }>,
): number {
  if (predictions.length === 0) return 0;
  const covered = predictions.filter(({ sample, predicted }) => {
    const interval = intervals[sample.event];
    return interval !== undefined &&
      sample.actual >= predicted * interval.lowerRatio &&
      sample.actual <= predicted * interval.upperRatio;
  }).length;
  return covered / predictions.length;
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
