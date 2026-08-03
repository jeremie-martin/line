/**
 * Fit and validate the policy-neutral remaining-work estimator artifact.
 *
 * Input is one or more JSON reports emitted by analyze_budget_telemetry.ts.
 * Source-family groups are held out together, and every attempt has total
 * weight one so a dense trace cannot dominate a sparse one.
 *
 * A corpus spanning at least three distinct policy budgets also fits the budget
 * law `cost * (B / 750,000)^alpha` — one exponent on the whole difficulty
 * scalar, anchored at the reference budget. See docs/budget-law-study.md.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import {
  BUDGET_ESTIMATOR_MODEL_SCHEMA_V1,
  BUDGET_ESTIMATOR_MODEL_SCHEMA_V2,
  estimateRemainingBudgetWork,
  parseBudgetEstimatorModel,
  type BudgetEstimatorAttemptKind,
  type BudgetEstimatorBaseMode,
  type BudgetEstimatorModelArtifact,
  type BudgetEstimatorPaceSchedule,
  type BudgetEstimatorPathClaim,
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
type StructuralCoefficients = {
  interceptFrames: number;
  contactFrames: number;
  durationFrameScale: number;
};
/** Coefficients plus the shared budget exponent; zero means a v1-shaped model. */
type StructuralFit = StructuralCoefficients & { budgetExponent: number };
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

/**
 * The budget the law's reference coefficients are anchored at.
 *
 * A scale-free law needs exactly one anchor and no other budget-keyed constant.
 * 750k is the artifact's historical calibration point and the study's, so the
 * reference coefficients stay comparable to every number already published.
 */
const LAW_REFERENCE_BUDGET_FRAMES = 750_000;
/**
 * Distinct policy budgets required before an exponent is fitted at all.
 *
 * Two points determine an exponent exactly and therefore measure nothing about
 * it; three is the smallest corpus that can disagree with a power law. Below
 * this the fit is the historical budget-independent one, bit for bit.
 */
const MIN_LAW_BUDGETS = 3;
/** Exponent search range. Cost that FALLS with a larger budget is not a shape. */
const LAW_EXPONENT_RANGE = { min: 0, max: 2 } as const;
/**
 * Expected observations per interval tail before a stratum is fitted on its own.
 *
 * Derived from the requested coverage rather than picked: at four expected
 * observations in each tail the percentile is still an order statistic, but not
 * the single most extreme one, so it cannot encode one attempt's luck as a
 * coverage promise. A thinner stratum falls back to its event.
 */
const MIN_TAIL_OBSERVATIONS = 4;

const args = process.argv.slice(2);
const inputPaths = args.filter((value) => !value.startsWith("--"));
if (inputPaths.length === 0) {
  throw new Error("usage: calibrate_budget_estimator.ts <analysis.json>... [--out=model.json] [--report=report.json] [--folds=5] [--coverage=0.95] [--freeze-point-model=artifact.json] [--refit-intervals] [--pace-schedule=none|linear_progress|sqrt_progress|smoothstep_progress|search]");
}
const valueOf = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length);
};
const outputPath = resolve(valueOf("out") ?? "generated/analysis/budget-estimator-model.json");
const reportPath = resolve(valueOf("report") ?? "generated/analysis/budget-estimator-calibration.json");
/*
 * Extend an existing artifact's CLAIM without re-deriving its point estimate.
 *
 * An applicability domain is a statement about validated behaviour, not about
 * which rows entered a sum of squares, so widening one does not require
 * refitting the model it qualifies — and refitting is not free. Since the
 * margin's structural base became the artifact (`deadline.ts`), the
 * coefficients, base mode and correction factors are LIVE POLICY: moving them
 * changes what the compiler searches, which makes a domain extension a
 * promotion-class change instead of a telemetry one. Freezing the point model
 * separates the two questions cleanly. It is also the stricter validation:
 * every prediction is out of sample by construction rather than out of fold,
 * so the frozen mode never needs the fold machinery to keep the point estimate
 * honest — only the interval percentiles are fitted here, and the unseen-seed
 * replay is what validates those, exactly as in the fitting mode.
 */
const freezePointModelPath = valueOf("freeze-point-model");
const frozenPointModel = freezePointModelPath === undefined ? null : parseBudgetEstimatorModel(
  JSON.parse(readFileSync(resolve(freezePointModelPath), "utf8")),
);
if (
  frozenPointModel !== null &&
  (frozenPointModel.structural.referenceBudgetFrames ?? LAW_REFERENCE_BUDGET_FRAMES) !==
    LAW_REFERENCE_BUDGET_FRAMES
) {
  throw new Error(
    `--freeze-point-model anchors its law at ${frozenPointModel.structural.referenceBudgetFrames} ` +
      `frames; this calibrator anchors at ${LAW_REFERENCE_BUDGET_FRAMES}`,
  );
}
/*
 * The pace schedule is the one point-estimate component that carries no fitted
 * constant: the coefficients, the exponent and the two correction factors are
 * the numbers a fit produces, and a schedule is a fixed shape read off
 * `progressFraction`. Re-selecting it under a frozen model therefore re-reads
 * the model rather than re-deriving it, which is why it is the only override
 * this mode offers. `search` scores all four and takes the best under the same
 * comparator the fitting mode uses; every schedule's numbers land in the
 * report either way, so the choice is visible rather than asserted.
 */
const paceScheduleArgument = valueOf("pace-schedule");
if (paceScheduleArgument !== undefined && frozenPointModel === null) {
  throw new Error("--pace-schedule requires --freeze-point-model; a fitting run selects its own");
}
/*
 * Keep the incumbent's fitted bands and make the new budget earn its coverage
 * WITH them, rather than refitting the percentiles over the wider corpus.
 *
 * One band serves the whole domain, so refitting is not free: adding a budget
 * moves the pooled percentile and every other budget pays. Measured on the
 * 2026-08-03 corpus, refitting to admit 250k cost 0.3-0.5pp of coverage at 300k,
 * 750k and 1.5M and bought 1.1pp in one 250k sub-stratum — the incumbent's
 * weakest cell, path-free at 1.5M, is the one that pays, and it is already the
 * thinnest margin in the artifact. Freezing the bands makes the extension
 * exactly what it claims to be: the same intervals, now validated over a wider
 * range. It is also the stronger evidence, since the new budget's residuals
 * were never in the percentile they are scored against.
 *
 * The refitting arm stays available (`--refit-intervals`) because "the band
 * should describe the domain it claims" is a real argument; which one wins is a
 * measurement, and both are reported per budget per stratum.
 *
 * Freezing is what `--freeze-point-model` MEANS, so it is implied rather than
 * opt-in: the band is live compiler policy, not telemetry. `interval` resolves
 * `start.{withPath,withoutPath}.upperRatio`, which `estCostUpperOf`
 * (optimizer/handoff.ts) turns into every repair restart's frame ceiling — and
 * with it which gap a restart runs from and whether an upstream anchor is
 * skipped. A run documented as a telemetry-only domain extension must not move
 * those by omitting a flag. Refitting is a promotion-class change and takes the
 * 48-seed benchmark, not a calibration report.
 */
const refitIntervals = args.includes("--refit-intervals");
if (args.includes("--freeze-intervals") && frozenPointModel === null) {
  throw new Error("--freeze-intervals requires --freeze-point-model");
}
if (refitIntervals && frozenPointModel === null) {
  throw new Error("--refit-intervals requires --freeze-point-model; a fitting run fits its own bands");
}
if (refitIntervals && args.includes("--freeze-intervals")) {
  throw new Error("--refit-intervals contradicts --freeze-intervals; pass at most one");
}
const freezeIntervals = frozenPointModel !== null && !refitIntervals;
if (refitIntervals) {
  console.warn(
    "\n!!! --refit-intervals: PROMOTION-CLASS CHANGE !!!\n" +
      "The interval band is live compiler policy: handoff.ts estCostUpperOf sizes every\n" +
      "repair restart ceiling from interval.byEventAndPath.start.*.upperRatio, which also\n" +
      "selects the restart gap and the upstream-anchor skip. Refitting it moves search\n" +
      "behaviour on every repair-bearing compile. Take the emitted artifact through the\n" +
      "48-seed benchmark; do not ship it as a telemetry-only domain extension.\n",
  );
}
const frozenIntervals = freezeIntervals ? frozenPointModel!.interval : null;
if (
  paceScheduleArgument !== undefined && paceScheduleArgument !== "search" &&
  !isPaceSchedule(paceScheduleArgument)
) throw new Error(`--pace-schedule must be search or a valid schedule, got ${paceScheduleArgument}`);
const requestedFolds = positiveInteger(valueOf("folds") ?? "5", "folds");
const nominalCoverage = probability(valueOf("coverage") ?? "0.95", "coverage");
// A frozen band's coverage promise is the one it was fitted to; re-labelling it
// with a different `--coverage` would restate a claim without re-earning it.
if (frozenIntervals !== null && frozenIntervals.nominalCoverage !== nominalCoverage) {
  throw new Error(
    `the frozen band carries nominalCoverage ${frozenIntervals.nominalCoverage}; ` +
      `pass --coverage=${frozenIntervals.nominalCoverage} or refit the bands ` +
      "with --refit-intervals",
  );
}
const tailProbability = (1 - nominalCoverage) / 2;
const MIN_STRATUM_SAMPLES = Math.ceil(MIN_TAIL_OBSERVATIONS / tailProbability);
const portableInputPaths = inputPaths.map((path) => relative(process.cwd(), resolve(path)));
const analyses = inputPaths.map((path) => {
  const analysis = JSON.parse(readFileSync(resolve(path), "utf8"));
  if (analysis.schema !== "line.compile-budget-telemetry-analysis.v1") {
    throw new Error(`${path}: expected line.compile-budget-telemetry-analysis.v1, got ${String(analysis.schema)}`);
  }
  return analysis;
});
// One corpus, however many analyses produced it. Each analysis already
// validated its own payloads; pooling them here is what lets one fit see more
// than one policy budget.
const parsedSamples = analyses.flatMap((analysis, index) => {
  const samples = parseSamples(analysis.calibration_samples, portableInputPaths[index]);
  if (samples.length === 0) throw new Error(`${inputPaths[index]}: no calibration samples`);
  return samples;
});
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

/*
 * Whether this corpus can carry a budget law at all.
 *
 * Decided once over the WHOLE corpus rather than per fold: the fitted form must
 * not change between folds, or the held-out numbers would describe a mixture of
 * two models. Family x seed blocking keeps every budget in every training set,
 * so this is also the form each fold actually fits.
 */
const distinctBudgets = [...new Set(weighted.map((sample) => sample.policyBudgetFrames))]
  .sort((a, b) => a - b);
const fitsBudgetLaw = frozenPointModel === null
  ? distinctBudgets.length >= MIN_LAW_BUDGETS
  : (frozenPointModel.structural.budgetExponent ?? 0) !== 0;
/**
 * Whether a budget can be held out and the rest still identify an exponent.
 * Needs one more budget than the fit itself does. A frozen point model fits
 * nothing, so there is no fit to hold a budget out of.
 */
const transferable = frozenPointModel === null && distinctBudgets.length > MIN_LAW_BUDGETS;
/** One structural fit per held-out cell, shared by every candidate. */
const structuralByCell = new Map<string, StructuralFit>();
/** `exponent:budget` -> scale; see `budgetScale`. */
const budgetScaleCache = new Map<string, number>();

const PACE_SCHEDULES = [
  "none",
  "linear_progress",
  "sqrt_progress",
  "smoothstep_progress",
] as const;
const candidates: Candidate[] = [];
for (const baseMode of [
  "structural",
  "path_if_available",
  "geometric_structural_path",
] as const) {
  for (const paceSchedule of PACE_SCHEDULES) candidates.push({ baseMode, paceSchedule });
}

const staticCandidate: Candidate = { baseMode: "structural", paceSchedule: "none" };
const unitCorrection = { withoutPath: 1, withPath: 1 };
// Evaluate the exact static model we will emit if no candidate clears the
// acceptance gates. sample.structural belongs to the artifact that recorded
// the input telemetry and may have different coefficients.
const staticFit: StructuralFit = { ...TRAVERSAL_BUDGET_MODEL_V1, budgetExponent: 0 };
const staticPredictions = weighted.map((sample) => ({
  sample,
  predicted: predict(sample, staticFit, staticCandidate, unitCorrection),
}));
const staticMetrics = metrics(staticPredictions);
/** Coefficients, exponent, base mode and corrections of the model being scored. */
const frozenStructural: StructuralFit | null = frozenPointModel === null ? null : {
  interceptFrames: frozenPointModel.structural.interceptFrames,
  contactFrames: frozenPointModel.structural.contactFrames,
  durationFrameScale: frozenPointModel.structural.durationFrameScale,
  budgetExponent: frozenPointModel.structural.budgetExponent ?? 0,
};
const frozenCorrection = frozenPointModel === null ? null : {
  withoutPath: frozenPointModel.combination.correctionWithoutPathFactor,
  withPath: frozenPointModel.combination.correctionWithPathFactor,
};
/*
 * Frozen mode scores the artifact directly on every sample; fitting mode scores
 * each sample by the fit that withheld both its family and its seed. Nothing is
 * estimated from the corpus in the frozen case, so there is no in-sample
 * residual to hold out and the two paths answer the same question.
 */
const evaluated = (frozenPointModel === null ? candidates : PACE_SCHEDULES
  .filter((schedule) =>
    paceScheduleArgument === "search" ||
    schedule === (paceScheduleArgument ?? frozenPointModel.combination.paceSchedule)
  )
  .map((paceSchedule) => ({ baseMode: frozenPointModel.combination.baseMode, paceSchedule })))
  .map((candidate) => {
    const predictions = frozenPointModel === null
      ? crossValidatedPredictions(weighted, foldCount, seedFoldCount, candidate)
      : weighted.map((sample) => ({
        sample,
        predicted: predict(sample, frozenStructural!, candidate, frozenCorrection!),
      }));
    return { candidate, metrics: metrics(predictions), predictions };
  }).sort(compareCandidateResults);
const best = evaluated[0];
/*
 * A frozen artifact was already accepted when it was fitted; this run
 * re-validates it on a wider corpus rather than re-deciding it. The gate still
 * runs, because a frozen model that cannot beat V1 on the corpus it is being
 * claimed over is not a model this corpus supports — but the failure is a
 * refusal, not a silent fall back to V1, which would throw away a shipped
 * artifact on the strength of an out-of-domain panel.
 */
const clearsStaticGates =
  best.metrics.weightedMedianAbsoluteLogError <=
    staticMetrics.weightedMedianAbsoluteLogError * 0.95 &&
  best.metrics.weightedP90ActualOverPrediction <=
    staticMetrics.weightedP90ActualOverPrediction * 1.05;
if (frozenPointModel !== null && !clearsStaticGates) {
  throw new Error(
    `--freeze-point-model ${freezePointModelPath} does not clear the static gates on this corpus ` +
      `(median |log ratio| ${best.metrics.weightedMedianAbsoluteLogError.toFixed(4)} against V1's ` +
      `${staticMetrics.weightedMedianAbsoluteLogError.toFixed(4)}); its claim cannot be widened here`,
  );
}
const accepted = frozenPointModel !== null || clearsStaticGates;
const selectedCandidate: Candidate = accepted ? best.candidate : staticCandidate;
const selectedOof = accepted ? best.predictions : staticPredictions;
const structural: StructuralFit = frozenStructural ??
  (accepted ? fitStructuralModel(weighted) : staticFit);
const correctionFactors = frozenCorrection ??
  (accepted ? fitCorrection(weighted, structural, selectedCandidate) : { withoutPath: 1, withPath: 1 });
const carriesBudgetLaw = accepted && structural.budgetExponent !== 0;
/**
 * The path claim this calibrator emits, and whether that alone makes the
 * artifact schema v2.
 *
 * "No evidence, no claim" is the rule `structuralAttemptKinds` already applies
 * to attempt kinds; this applies it to the policy budget for path-backed
 * estimates too. The four-budget panel is why: path-backed estimates are
 * unbiased at 300k-1.5M (median actual/predicted 0.99-1.01) and 19% biased at
 * 150k, where the incumbent handed to repair came out of a search that barely
 * completed, so a fit above 150k cannot vouch for them there.
 */
const PATH_CLAIM: BudgetEstimatorPathClaim = "calibrated_when_available_in_domain";
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
    // Under `--freeze-intervals` the band is the incumbent's and this run only
    // measures whether it holds; the percentile is not taken.
    const frozen = frozenIntervals?.byEvent[event];
    const lowerRatio = frozen?.lowerRatio ??
      Math.min(1, weightedPercentile(eventRatios, tailProbability));
    const upperRatio = frozen?.upperRatio ??
      Math.max(1, weightedPercentile(eventRatios, 1 - tailProbability));
    const inside = predictions.filter(({ sample, predicted }) =>
      sample.actual >= predicted * lowerRatio && sample.actual <= predicted * upperRatio
    );
    return {
      event,
      n: predictions.length,
      source: frozen === undefined ? ("fitted" as const) : ("frozen" as const),
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
const lowerRatio = frozenIntervals?.lowerRatio ??
  Math.min(1, ...intervalStrata.map((stratum) => stratum.lowerRatio));
const upperRatio = frozenIntervals?.upperRatio ??
  Math.max(1, ...intervalStrata.map((stratum) => stratum.upperRatio));
const intervalByEvent = Object.fromEntries(intervalStrata.map((stratum) => [
  stratum.event,
  { lowerRatio: stratum.lowerRatio, upperRatio: stratum.upperRatio },
]));
/*
 * Split each event again by whether the estimate is path-backed.
 *
 * A path-backed estimate is a measurement of the incumbent's own suffix; a
 * path-free one is a regression on spec structure. They are different regimes
 * with different spreads, so one pooled band necessarily under-covers whichever
 * is noisier and over-covers the other, and the mixture weight varies across
 * the corpus — on the four-budget panel the path-free share runs 84% at 150k
 * against 64% at 750k, which is what made a single band under-deliver at the
 * scarce budget.
 *
 * Conditioning on the REGIME is why this generalizes. Conditioning on the
 * policy budget would fit the corpus's own identity and would have nothing to
 * say at a budget between the fitted ones; a stratum knows only what the
 * runtime also knows at the moment it reads the interval.
 */
const intervalPathStrata = intervalStrata.flatMap((eventStratum) =>
  ([true, false] as const).map((withPath) => {
    const predictions = selectedOof.filter(({ sample }) =>
      sample.event === eventStratum.event && usesPath(sample) === withPath
    );
    const path = withPath ? ("withPath" as const) : ("withoutPath" as const);
    const frozen = frozenIntervals?.byEventAndPath?.[eventStratum.event]?.[path];
    // A 2.5% tail cannot be estimated from a handful of observations: below
    // four expected observations per tail the percentile IS an extreme order
    // statistic and would encode one attempt's luck as a coverage promise.
    const fitted = frozen !== undefined || predictions.length >= MIN_STRATUM_SAMPLES;
    const ratios = predictions.map(({ sample, predicted }) => ({
      value: sample.actual / Math.max(1, predicted),
      weight: 1,
    }));
    const interval = frozen ?? (fitted
      ? {
        lowerRatio: Math.min(1, weightedPercentile(ratios, tailProbability)),
        upperRatio: Math.max(1, weightedPercentile(ratios, 1 - tailProbability)),
      }
      : { lowerRatio: eventStratum.lowerRatio, upperRatio: eventStratum.upperRatio });
    const inside = predictions.filter(({ sample, predicted }) =>
      sample.actual >= predicted * interval.lowerRatio &&
      sample.actual <= predicted * interval.upperRatio
    );
    return {
      event: eventStratum.event,
      path,
      n: predictions.length,
      fitted,
      source: frozen === undefined ? ("fitted" as const) : ("frozen" as const),
      fallback: fitted ? null : "event",
      ...interval,
      coverage: weightRatio(inside, predictions),
      coverageBySample: predictions.length === 0 ? 0 : inside.length / predictions.length,
    };
  })
);
const intervalByEventAndPath: NonNullable<
  BudgetEstimatorModelArtifact["interval"]["byEventAndPath"]
> = {};
for (const stratum of intervalPathStrata) {
  if (!stratum.fitted) continue;
  const entry = intervalByEventAndPath[stratum.event] ?? {};
  entry[stratum.path] = { lowerRatio: round(stratum.lowerRatio), upperRatio: round(stratum.upperRatio) };
  intervalByEventAndPath[stratum.event] = entry;
}
const stratifiesIntervals = Object.keys(intervalByEventAndPath).length > 0;
const intervalRatiosFor = (sample: WeightedSample): { lowerRatio: number; upperRatio: number } =>
  intervalByEventAndPath[sample.event]?.[usesPath(sample) ? "withPath" : "withoutPath"] ??
    intervalByEvent[sample.event] ??
    { lowerRatio, upperRatio };
const intervalCoverage = weightedIntervalCoverage(selectedOof, intervalRatiosFor);
const intervalCoverageBySample = sampleIntervalCoverage(selectedOof, intervalRatiosFor);
const datasetFingerprint = createHash("sha256")
  .update(JSON.stringify(rawSamples))
  .digest("hex");
const selectedMetrics = metrics(selectedOof);
const candidateLabel = `${selectedCandidate.baseMode}+${selectedCandidate.paceSchedule}`;
const model: BudgetEstimatorModelArtifact = {
  // v2 is declared whenever the artifact uses a v2 feature — a budget law,
  // stratified intervals, or the domain-scoped path claim — because a reader
  // pinned to v1 semantics would silently drop any of them and answer a
  // different question. `PATH_CLAIM` alone makes that unconditional, so every
  // artifact emitted here is v2 and v1 is a read-only compatibility path.
  schema: BUDGET_ESTIMATOR_MODEL_SCHEMA_V2,
  // `revalidated` is a third provenance word beside `calibrated` and `static`:
  // the numbers are a previous fit's, the claim around them is this corpus's.
  modelId: `${
    frozenPointModel !== null ? "revalidated" : accepted ? "calibrated" : "static"
  }-${candidateLabel}-${datasetFingerprint.slice(0, 12)}`,
  // The flag means "this artifact was fitted", so a rejected candidate must not
  // claim it: the emitted coefficients are the untouched static fallback, and
  // every telemetry payload copies this flag verbatim.
  calibrated: accepted,
  generatedAt: new Date().toISOString(),
  provenance: {
    generator: "scripts/v0/calibrate_budget_estimator.ts",
    analysisSchema: analyses[0].schema,
    datasetFingerprint,
    inputs: analyses.flatMap((analysis, index) =>
      Array.isArray(analysis.inputs) ? analysis.inputs : [portableInputPaths[index]]
    ),
    groups: groups.length,
    samples: weighted.length,
    folds: foldCount,
    acceptance: frozenPointModel !== null
      ? `point model frozen from ${freezePointModelPath} (${frozenPointModel.modelId}); ` +
        (freezeIntervals
          ? "interval bands frozen with it and re-validated over this corpus, so only the " +
            "applicability domain, structural attempt kinds and metrics come from here"
          : "interval strata REFITTED on this corpus (--refit-intervals), along with the " +
            "applicability domain, structural attempt kinds and metrics; the bands size " +
            "every repair restart ceiling, so this artifact is a promotion-class change") +
        "; the frozen model re-cleared the static gates on this corpus"
      : accepted
      ? "accepted: >=5% weighted median log-error improvement and <=5% p90 underprediction regression"
      : "retained static: candidate did not satisfy acceptance gates",
  },
  // A frozen point model is re-emitted verbatim, name and provenance string
  // included, so the diff against its source artifact is confined to the claim
  // layer and that confinement is checkable byte for byte. Where the numbers
  // came from has not changed; only what is claimed about them has, and that is
  // recorded in `provenance.acceptance` and the calibration report.
  structural: frozenPointModel !== null ? { ...frozenPointModel.structural } : {
    name: accepted
      ? `budget-telemetry-nnls${carriesBudgetLaw ? "-law" : ""}/${datasetFingerprint.slice(0, 12)}`
      : TRAVERSAL_BUDGET_MODEL_V1.name,
    source: accepted
      ? `${portableInputPaths.join(" + ")}; grouped ${foldCount}-fold validation` +
        // Claim transfer validation only when the table was actually produced;
        // a three-budget corpus cannot hold one out and still identify an
        // exponent, and an artifact must not assert evidence it does not have.
        (carriesBudgetLaw ? `; budget law fitted at ${distinctBudgets.join(", ")}` : "") +
        (carriesBudgetLaw && transferable ? "; budget-transfer validated" : "") +
        (stratifiesIntervals ? "; intervals stratified by event x path availability" : "")
      : TRAVERSAL_BUDGET_MODEL_V1.source,
    interceptFrames: round(structural.interceptFrames),
    contactFrames: round(structural.contactFrames),
    durationFrameScale: round(structural.durationFrameScale),
    // Omitted entirely without a law, so a budget-independent artifact stays
    // byte-comparable with every one that came before it.
    ...(carriesBudgetLaw
      ? {
        referenceBudgetFrames: LAW_REFERENCE_BUDGET_FRAMES,
        budgetExponent: round(structural.budgetExponent),
      }
      : {}),
  },
  combination: {
    ...selectedCandidate,
    correctionWithoutPathFactor: round(correctionFactors.withoutPath),
    correctionWithPathFactor: round(correctionFactors.withPath),
  },
  // Re-emitted verbatim under `--freeze-intervals`, for the same reason the
  // frozen point model is: the diff must be confined to what this run earned.
  interval: frozenIntervals ?? {
    lowerRatio: round(lowerRatio),
    upperRatio: round(upperRatio),
    nominalCoverage,
    byEvent: Object.fromEntries(Object.entries(intervalByEvent).map(([event, interval]) => [
      event,
      { lowerRatio: round(interval.lowerRatio), upperRatio: round(interval.upperRatio) },
    ])),
    // Omitted entirely when no stratum had the samples to earn one, so an
    // artifact only claims a split it actually measured.
    ...(stratifiesIntervals ? { byEventAndPath: intervalByEventAndPath } : {}),
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
    // No evidence, no claim — the same rule `structuralAttemptKinds` already
    // applies to attempt kinds, now applied to the policy budget for path-backed
    // estimates too. The path component was long held budget-independent; the
    // four-budget panel shows it unbiased at 300k-1.5M and 19% biased at 150k,
    // so a fit cannot vouch for it at budgets it never saw either.
    pathEstimate: PATH_CLAIM,
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

/*
 * Per-budget held-out summaries.
 *
 * A corpus-wide median can hide a model that is right on average and wrong at
 * both ends of the budget range — precisely the failure the budget law exists
 * to remove — so every headline held-out statistic also gets a per-budget row.
 * `pathFree` is the artifact's actual structural domain: observations the
 * runtime would answer without an incumbent path.
 */
const perBudgetSummaries = distinctBudgets.map((budget) => {
  const predictions = selectedOof.filter(({ sample }) => sample.policyBudgetFrames === budget);
  const pathFree = predictions.filter(({ sample }) => !hasPath(sample));
  return {
    budget,
    samples: predictions.length,
    attempts: new Set(predictions.map(({ sample }) => attemptKey(sample))).size,
    selected: errorSummary(predictions),
    pathFree: errorSummary(pathFree),
    intervalCoverage: weightedIntervalCoverage(predictions, intervalRatiosFor),
    intervalCoverageBySample: sampleIntervalCoverage(predictions, intervalRatiosFor),
    // The claim the stratification makes is that conditioning on the regime,
    // not on the budget, is enough. These two rows are how that claim is
    // checked: each stratum should hold its coverage at every budget.
    byPath: ([true, false] as const).map((withPath) => {
      const selected = predictions.filter(({ sample }) => usesPath(sample) === withPath);
      return {
        path: withPath ? "withPath" : "withoutPath",
        samples: selected.length,
        share: predictions.length === 0 ? 0 : selected.length / predictions.length,
        intervalCoverageBySample: sampleIntervalCoverage(selected, intervalRatiosFor),
        error: errorSummary(selected),
      };
    }),
    byEvent: [...new Set(predictions.map(({ sample }) => sample.event))].sort().map((event) => {
      const selected = predictions.filter(({ sample }) => sample.event === event);
      const ratios = selected.map(({ sample, predicted }) => ({
        value: sample.actual / Math.max(1, predicted),
        weight: 1,
      }));
      return {
        event,
        samples: selected.length,
        intervalCoverageBySample: sampleIntervalCoverage(selected, intervalRatiosFor),
        // DIAGNOSTIC ONLY, never fitted into the artifact: the interval this
        // budget's own held-out residuals would have asked for. Comparing it to
        // the shipped ratios is what says whether the fitted strata can serve
        // the whole domain, and if not, by how much they miss and in which tail.
        residualRatiosAtThisBudget: {
          lowerRatio: Math.min(1, weightedPercentile(ratios, tailProbability)),
          upperRatio: Math.max(1, weightedPercentile(ratios, 1 - tailProbability)),
        },
      };
    }),
  };
});

/*
 * Budget-transfer validation: fit without one budget, score on it.
 *
 * This is REPORTED EVIDENCE AND DELIBERATELY NOT A GATE, for three reasons.
 * A gate needs a defined fallback, and there is none here: "the exponent did
 * not transfer" does not imply "emit the budget-independent fit", which is
 * worse at every budget in this corpus, nor "emit V1", which the acceptance
 * gate already tests. It would also gate the wrong quantity — the selected
 * estimate is path-backed at most observations, while transfer measures the
 * structural component alone. And any threshold picked today would be a
 * constant tuned to this panel's operating points, which is the shape the
 * campaign's design rule exists to forbid. The numbers below let a reviewer set
 * a bar with evidence instead.
 */
const budgetTransfer = {
  role: "reported_evidence_not_an_acceptance_gate",
  applicable: transferable,
  note: transferable
    ? "each row fits the structural model on every OTHER budget and scores this one"
    : frozenPointModel !== null
    ? "not applicable: the point model is frozen, so no structural fit is taken from " +
      "this corpus and there is nothing to hold a budget out of. The per-budget rows " +
      "above already measure the frozen model at every budget, which is the transfer " +
      "question this table exists to answer when a model IS fitted here."
    : `needs more than ${MIN_LAW_BUDGETS} distinct budgets so each held-out fit ` +
      `still spans enough to identify an exponent; this corpus has ${distinctBudgets.length}`,
  byHeldOutBudget: !transferable ? [] : distinctBudgets.map((heldOut) => {
    const train = weighted.filter((sample) => sample.policyBudgetFrames !== heldOut);
    const test = weighted.filter((sample) => sample.policyBudgetFrames === heldOut);
    const law = fitStructuralModel(train);
    // Same training rows, same NNLS, no budget term: the honest control for
    // "did the exponent earn this, or just a refreshed anchor?"
    const constant = fitStructuralModel(train, false);
    const structuralOnly = (fit: StructuralFit, rows: WeightedSample[]): Prediction[] =>
      rows.map((sample) => ({
        sample,
        predicted: predict(sample, fit, staticCandidate, unitCorrection),
      }));
    const pathFree = test.filter((sample) => !hasPath(sample));
    return {
      heldOutBudget: heldOut,
      trainedBudgets: distinctBudgets.filter((budget) => budget !== heldOut),
      testSamples: test.length,
      fittedBudgetExponent: law.budgetExponent,
      law: {
        allFitted: errorSummary(structuralOnly(law, test)),
        pathFree: errorSummary(structuralOnly(law, pathFree)),
      },
      constantPooled: {
        coefficients: {
          interceptFrames: constant.interceptFrames,
          contactFrames: constant.contactFrames,
          durationFrameScale: constant.durationFrameScale,
        },
        allFitted: errorSummary(structuralOnly(constant, test)),
        pathFree: errorSummary(structuralOnly(constant, pathFree)),
      },
      staticV1: {
        allFitted: errorSummary(structuralOnly(staticFit, test)),
        pathFree: errorSummary(structuralOnly(staticFit, pathFree)),
      },
    };
  }),
};

const report = {
  schema: "line.compile-budget-estimator-calibration.v1",
  generatedAt: model.generatedAt,
  input: portableInputPaths.join(" + "),
  inputs: portableInputPaths,
  datasetFingerprint,
  samples: weighted.length,
  groups,
  foldCount,
  weighting: "each completed attempt has total weight one",
  /*
   * Which half of the artifact this run produced.
   *
   * A fitting run derives both halves at once. A frozen run derives only the
   * claim layer, and says so here with the source artifact's identity, so a
   * reader never has to diff two files to learn whether the point estimate
   * moved.
   */
  pointModel: frozenPointModel === null
    ? { frozen: false as const, fittedFrom: "this corpus" }
    : {
      frozen: true as const,
      source: relative(process.cwd(), resolve(freezePointModelPath!)),
      modelId: frozenPointModel.modelId,
      paceScheduleFrozen: frozenPointModel.combination.paceSchedule,
      paceScheduleSelected: selectedCandidate.paceSchedule,
      paceScheduleArgument: paceScheduleArgument ?? "(inherited)",
      intervalsFrozen: freezeIntervals,
      intervalsNote: freezeIntervals
        ? "the incumbent's bands, re-emitted verbatim (the default under a frozen " +
          "point model); the per-budget rows below measure whether they hold over " +
          "the wider domain rather than refitting them to it, so the new budget's " +
          "residuals were never in the percentile they are scored against"
        : "bands refitted over this corpus under --refit-intervals; every budget's " +
          "residuals moved the pooled percentile, including the incumbent's. The " +
          "band is live repair policy (handoff.ts estCostUpperOf), so this artifact " +
          "is promotion-class and needs a 48-seed benchmark before it ships",
      note:
        "structural coefficients, budget exponent, base mode and both correction " +
        "factors are the frozen artifact's, re-emitted verbatim; only the pace " +
        "schedule may be re-selected, because it is the one component that carries " +
        "no fitted constant. Everything else in the emitted artifact — interval " +
        "ratios and strata, applicability domain, structural attempt kinds, metrics " +
        "— is this corpus's.",
      /*
       * Every schedule's numbers, not only the chosen one. With the rest of the
       * point model held fixed this is a complete and cheap enumeration, so
       * there is no reason to report a winner without its alternatives.
       */
      paceScheduleSweep: evaluated.map(({ candidate, metrics: candidateMetrics, predictions }) => ({
        paceSchedule: candidate.paceSchedule,
        selected: candidate.paceSchedule === selectedCandidate.paceSchedule,
        metrics: candidateMetrics,
        byBudget: distinctBudgets.map((budget) => ({
          budget,
          ...errorSummary(predictions.filter(({ sample }) => sample.policyBudgetFrames === budget)),
        })),
      })),
    },
  structuralForm: {
    form: carriesBudgetLaw ? "reference_shape_times_budget_scale" : "budget_independent",
    referenceBudgetFrames: LAW_REFERENCE_BUDGET_FRAMES,
    budgetExponent: structural.budgetExponent,
    budgets: distinctBudgets,
    samplesByBudget: Object.fromEntries(distinctBudgets.map((budget) => [
      budget,
      weighted.filter((sample) => sample.policyBudgetFrames === budget).length,
    ])),
    minimumBudgetsForLaw: MIN_LAW_BUDGETS,
    rationale:
      "one exponent on the whole difficulty scalar, anchored once. Per-coefficient " +
      "exponents fit this panel slightly better in sample and are worse on a " +
      "held-out budget, because the coefficient MIX rotates with the budget while " +
      "only the scalar transfers (docs/budget-law-study.md). The exponent is " +
      "fitted jointly with the coefficients under the same weighted SSE the " +
      "coefficients are fitted under; acceptance remains out-of-fold weighted " +
      "median log error.",
  },
  byBudget: perBudgetSummaries,
  budgetTransfer,
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
    rationale: frozenPointModel !== null
      ? "the point model is frozen, so every prediction is out of sample already and " +
        "the folds do not gate it; the assignment is still reported because the " +
        "interval percentiles are taken over exactly these residuals"
      : "a sample is scored only by a fit that saw neither its source family nor " +
        "its seed, so interval percentiles pay for seed variance instead of being " +
        "tuned to residuals whose seed was already in the fit",
    appliedToPredictions: frozenPointModel === null,
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
    stratification: {
      dimension: "event x path_availability",
      applied: stratifiesIntervals,
      minimumStratumSamples: MIN_STRATUM_SAMPLES,
      minimumStratumRationale:
        `${MIN_TAIL_OBSERVATIONS} expected observations per ${tailProbability} tail; ` +
        "a thinner stratum falls back to its event rather than promising coverage " +
        "from an extreme order statistic",
      pathPredicate:
        "the selected candidate routes the estimate through the path base " +
        "(base mode is not `structural` and the measured path is positive) — the " +
        "same split the correction factors use and the runtime re-derives",
      rationale:
        "path-backed and path-free estimates are different regimes with different " +
        "spreads, and their mixture weight varies across the corpus, so one pooled " +
        "band under-covers the noisier population. Conditioning on the regime " +
        "generalizes because the runtime knows it at read time; conditioning on the " +
        "policy budget would only re-describe this corpus.",
      pathStrata: intervalPathStrata,
    },
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
console.log(
  `budget estimator ${
    frozenPointModel !== null
      ? `revalidated (point model frozen from ${frozenPointModel.modelId})`
      : accepted
      ? "accepted"
      : "retained static"
  }: ${candidateLabel}`,
);
console.log(
  `  samples ${weighted.length}; groups ${groups.length}; folds ${foldCount} family` +
  (seedBlocked ? ` x ${seedFoldCount} seed (${foldCount * seedFoldCount} held-out cells)` : ` (seed blocking off)`) +
  (frozenPointModel !== null ? " — folds unused: the point model is frozen" : ""),
);
if (frozenPointModel !== null && evaluated.length > 1) {
  for (const { candidate, metrics: candidateMetrics } of evaluated) {
    console.log(
      `  pace ${candidate.paceSchedule.padEnd(19)} median |log ratio| ` +
      `${candidateMetrics.weightedMedianAbsoluteLogError.toFixed(4)}` +
      (candidate.paceSchedule === selectedCandidate.paceSchedule ? "  <- selected" : ""),
    );
  }
}
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
console.log(
  `  budgets ${distinctBudgets.join(", ")}; structural form ` +
  (carriesBudgetLaw
    ? `(B/${LAW_REFERENCE_BUDGET_FRAMES})^${structural.budgetExponent.toFixed(4)}, schema v2`
    : "budget-independent, schema v1"),
);
for (const entry of perBudgetSummaries) {
  console.log(
    `    ${String(entry.budget).padStart(9)}: n ${String(entry.samples).padStart(6)}; ` +
    `selected APE ${percent(entry.selected.medianAbsolutePercentageError)}; ` +
    `path-free APE ${percent(entry.pathFree.medianAbsolutePercentageError)} ` +
    `(n ${entry.pathFree.n}); interval ${percent(entry.intervalCoverageBySample)} per-sample ` +
    `(${entry.byPath.map((stratum) =>
      `${stratum.path} ${percent(stratum.intervalCoverageBySample)} of ${percent(stratum.share)}`
    ).join(", ")})`,
  );
}
for (const entry of budgetTransfer.byHeldOutBudget) {
  console.log(
    `    held out ${String(entry.heldOutBudget).padStart(9)}: alpha ` +
    `${entry.fittedBudgetExponent.toFixed(4)}; law APE ` +
    `${percent(entry.law.pathFree.medianAbsolutePercentageError)} path-free vs ` +
    `${percent(entry.constantPooled.pathFree.medianAbsolutePercentageError)} pooled-constant, ` +
    `${percent(entry.staticV1.pathFree.medianAbsolutePercentageError)} V1`,
  );
}
console.log(`  model ${outputPath}`);
console.log(`  report ${reportPath}`);

function parseSamples(value: unknown, input: string): Sample[] {
  if (!Array.isArray(value)) throw new Error(`${input}: analysis calibration_samples must be an array`);
  return value.map((row, position) => {
    const index = `${input} sample ${position}`;
    if (typeof row !== "object" || row === null) throw new Error(`${index} must be an object`);
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
      if (!Number.isFinite(sample[name])) throw new Error(`${index} ${name} must be finite`);
    }
    if (!(sample.actual > 0)) throw new Error(`${index} actual must be positive`);
    if (sample.policyBudgetFrames < 0) {
      throw new Error(`${index} policyBudgetFrames must be non-negative`);
    }
    if (typeof sample.group !== "string" || sample.group.length === 0) throw new Error(`${index} group is required`);
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

/**
 * Whether the SELECTED candidate routes this sample through the path base.
 *
 * The correction factor and the interval stratum must split the population the
 * same way the runtime does, and the runtime's `budgetEstimateUsesPath` ignores
 * an available path under a `structural` base mode. Splitting on `hasPath`
 * alone would put estimates that never touched a path into the path stratum.
 */
function usesPath(sample: Sample): boolean {
  return selectedCandidate.baseMode !== "structural" && hasPath(sample);
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
      // The structural fit does not depend on the candidate, so the twelve
      // candidates share one fit per cell. Pure cache: same inputs, same output.
      const cell = `${fold}:${seedFold}`;
      let structural = structuralByCell.get(cell);
      if (structural === undefined) {
        structural = fitStructuralModel(train);
        structuralByCell.set(cell, structural);
      }
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
  structural: StructuralFit,
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
  structural: StructuralFit,
  candidate: Candidate,
  correctionFactors: { withoutPath: number; withPath: number },
): number {
  const structuralPrediction = budgetScale(structural.budgetExponent, sample.policyBudgetFrames) * (
    (sample.startupIncluded ? structural.interceptFrames : 0) +
    structural.contactFrames * sample.remainingContacts +
    structural.durationFrameScale * sample.remainingDurationFrames
  );
  return Math.max(1, estimateRemainingBudgetWork({
    structural: structuralPrediction,
    path: sample.path,
    pace: sample.pace,
    progressFraction: sample.progressFraction,
  }, artifactForPrediction(structural, candidate, correctionFactors)));
}

/**
 * `(B / refB)^alpha`, memoized: a corpus holds a handful of distinct budgets and
 * this is called once per sample per fold per candidate.
 *
 * A zero exponent returns exactly `1` — not `Math.pow(x, 0)` — so a
 * single-budget corpus reproduces the pre-law arithmetic bit for bit. Must stay
 * identical to `budgetEstimatorStructuralScale`, which is what the recorder
 * applies at runtime.
 */
function budgetScale(exponent: number, policyBudgetFrames: number): number {
  if (exponent === 0 || !(policyBudgetFrames > 0)) return 1;
  const key = `${exponent}:${policyBudgetFrames}`;
  const cached = budgetScaleCache.get(key);
  if (cached !== undefined) return cached;
  const scale = Math.pow(policyBudgetFrames / LAW_REFERENCE_BUDGET_FRAMES, exponent);
  budgetScaleCache.set(key, scale);
  return scale;
}

function artifactForPrediction(
  structural: StructuralCoefficients,
  candidate: Candidate,
  correctionFactors: { withoutPath: number; withPath: number },
): BudgetEstimatorModelArtifact {
  return {
    // The scale is already inside `structural` above, so this evaluation stub
    // stays budget-independent and needs no law fields.
    schema: BUDGET_ESTIMATOR_MODEL_SCHEMA_V1,
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
    structural: {
      name: "evaluation",
      source: "calibration",
      interceptFrames: structural.interceptFrames,
      contactFrames: structural.contactFrames,
      durationFrameScale: structural.durationFrameScale,
    },
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

/**
 * Fit the structural model, with the budget law when the corpus can carry one.
 *
 * One entry point, two forms of the same equation: the exponent is zero unless
 * at least `MIN_LAW_BUDGETS` distinct policy budgets are present, and a zero
 * exponent runs the historical fit unchanged rather than a scaled emulation of
 * it, so a single-budget corpus refits bit for bit.
 */
function fitStructuralModel(
  samples: WeightedSample[],
  useLaw: boolean = fitsBudgetLaw,
): StructuralFit {
  if (!useLaw) return { ...fitStructural(samples), budgetExponent: 0 };
  return fitBudgetLaw(samples);
}

/**
 * Aggregated normal equations, one block per policy budget.
 *
 * `(B / refB)^alpha` depends only on the budget, so the weighted normal
 * equations at ANY exponent are exact sums of a handful of precomputed 3x3
 * blocks. That is what makes a fine exponent grid — and a refit inside every
 * held-out cell — cost about as much as one pass over the samples.
 */
type BudgetBlock = { scale: number; matrix: number[][]; vector: number[]; qq: number };

function budgetBlocks(samples: WeightedSample[]): BudgetBlock[] {
  const byBudget = new Map<number, BudgetBlock>();
  for (const sample of samples) {
    let block = byBudget.get(sample.policyBudgetFrames);
    if (block === undefined) {
      block = {
        scale: sample.policyBudgetFrames / LAW_REFERENCE_BUDGET_FRAMES,
        matrix: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
        vector: [0, 0, 0],
        qq: 0,
      };
      byBudget.set(sample.policyBudgetFrames, block);
    }
    const features = [
      sample.startupIncluded ? 1 : 0,
      sample.remainingContacts,
      sample.remainingDurationFrames,
    ];
    block.qq += sample.weight * sample.actual * sample.actual;
    for (let row = 0; row < 3; row++) {
      block.vector[row] += sample.weight * features[row] * sample.actual;
      for (let column = 0; column < 3; column++) {
        block.matrix[row][column] += sample.weight * features[row] * features[column];
      }
    }
  }
  return [...byBudget.entries()].sort((a, b) => a[0] - b[0]).map(([, block]) => block);
}

/** Weighted NNLS for the reference coefficients at a fixed exponent. */
function solveBudgetLawAt(
  blocks: BudgetBlock[],
  exponent: number,
): { coefficients: number[]; sse: number } {
  const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const vector = [0, 0, 0];
  let qq = 0;
  for (const block of blocks) {
    const power = Math.pow(block.scale, exponent);
    qq += block.qq;
    for (let row = 0; row < 3; row++) {
      vector[row] += power * block.vector[row];
      for (let column = 0; column < 3; column++) {
        matrix[row][column] += power * power * block.matrix[row][column];
      }
    }
  }
  // Active-set enumeration over the seven non-empty supports, exactly the
  // non-negativity the budget-independent fit enforces.
  let best = { coefficients: [0, 0, 0], sse: Infinity };
  for (let mask = 1; mask < 8; mask++) {
    const indexes = [0, 1, 2].filter((index) => (mask & (1 << index)) !== 0);
    const sub = indexes.map((row) => indexes.map((column) => matrix[row][column]));
    const solved = solveLinearSystem(sub, indexes.map((row) => vector[row]));
    if (solved === null || solved.some((entry) => entry < 0 || !Number.isFinite(entry))) continue;
    const coefficients = [0, 0, 0];
    indexes.forEach((index, position) => { coefficients[index] = solved[position]; });
    let sse = qq;
    for (let row = 0; row < 3; row++) {
      sse -= 2 * coefficients[row] * vector[row];
      for (let column = 0; column < 3; column++) {
        sse += coefficients[row] * coefficients[column] * matrix[row][column];
      }
    }
    if (sse < best.sse) best = { coefficients, sse };
  }
  return best;
}

/**
 * Reference coefficients and the shared exponent, jointly under weighted SSE.
 *
 * The exponent is searched under the SAME objective that fits the coefficients
 * it multiplies, because the NNLS coefficients are only conditionally optimal
 * given the exponent under that objective; acceptance is still decided by
 * out-of-fold weighted median log error, so the exponent is judged by the gate
 * even though it is not fitted by it.
 */
function fitBudgetLaw(samples: WeightedSample[]): StructuralFit {
  const blocks = budgetBlocks(samples);
  let best = { exponent: 0, coefficients: [0, 0, 0], sse: Infinity };
  const search = (low: number, high: number, step: number): void => {
    const steps = Math.round((high - low) / step);
    for (let index = 0; index <= steps; index++) {
      // Integer stepping: an accumulated `+= step` makes the grid depend on
      // where the refinement started, and these fits must be reproducible.
      const exponent = Math.min(
        LAW_EXPONENT_RANGE.max,
        Math.max(LAW_EXPONENT_RANGE.min, low + index * step),
      );
      const solved = solveBudgetLawAt(blocks, exponent);
      if (solved.sse < best.sse) best = { exponent, ...solved };
    }
  };
  search(LAW_EXPONENT_RANGE.min, LAW_EXPONENT_RANGE.max, 0.05);
  search(best.exponent - 0.05, best.exponent + 0.05, 0.005);
  search(best.exponent - 0.005, best.exponent + 0.005, 0.0005);
  if (!Number.isFinite(best.sse)) return { ...TRAVERSAL_BUDGET_MODEL_V1, budgetExponent: 0 };
  return {
    interceptFrames: best.coefficients[0],
    contactFrames: best.coefficients[1],
    durationFrameScale: best.coefficients[2],
    budgetExponent: best.exponent,
  };
}

function fitStructural(samples: Array<Sample & { weight: number }>): StructuralCoefficients {
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

/**
 * Percentage-error view of a prediction set, for the per-budget tables.
 *
 * `metrics()` above answers the acceptance question in log space; these are the
 * numbers the study, the docs, and the analyzer quote — median APE with its
 * signed twin, so overprediction and underprediction stay distinguishable.
 */
function errorSummary(predictions: Prediction[]): {
  n: number;
  medianAbsolutePercentageError: number | null;
  p90AbsolutePercentageError: number | null;
  medianSignedPercentageError: number | null;
  weightedMedianAbsoluteLogError: number | null;
} {
  if (predictions.length === 0) {
    return {
      n: 0,
      medianAbsolutePercentageError: null,
      p90AbsolutePercentageError: null,
      medianSignedPercentageError: null,
      weightedMedianAbsoluteLogError: null,
    };
  }
  const signed = predictions.map(({ sample, predicted }) => ({
    value: (predicted - sample.actual) / sample.actual,
    weight: 1,
  }));
  const absolute = signed.map((entry) => ({ ...entry, value: Math.abs(entry.value) }));
  return {
    n: predictions.length,
    medianAbsolutePercentageError: round(weightedPercentile(absolute, 0.5)),
    p90AbsolutePercentageError: round(weightedPercentile(absolute, 0.9)),
    medianSignedPercentageError: round(weightedPercentile(signed, 0.5)),
    weightedMedianAbsoluteLogError: round(metrics(predictions).weightedMedianAbsoluteLogError),
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
/**
 * Resolve an observation's interval the way the runtime does: most specific
 * stratum first, then its event, then the aggregate envelope.
 */
type IntervalLookup = (sample: WeightedSample) => { lowerRatio: number; upperRatio: number };

function covers(prediction: Prediction, ratios: IntervalLookup): boolean {
  const interval = ratios(prediction.sample);
  return prediction.sample.actual >= prediction.predicted * interval.lowerRatio &&
    prediction.sample.actual <= prediction.predicted * interval.upperRatio;
}

/**
 * Coverage counting raw samples rather than attempt weight.
 *
 * The fit targets this figure and `analyze_budget_telemetry.ts` publishes it,
 * while the rest of the fit is attempt-weighted; the two diverge whenever
 * per-attempt sample density differs across prediction regimes, since a dense
 * path-backed repair and a sparse structural attempt each carry weight one.
 * Emitting both stops the next reader from comparing a fitted 95% against a
 * measured 92% and concluding the artifact is broken.
 */
function sampleIntervalCoverage(predictions: Prediction[], ratios: IntervalLookup): number {
  if (predictions.length === 0) return 0;
  return predictions.filter((prediction) => covers(prediction, ratios)).length / predictions.length;
}

function weightedIntervalCoverage(predictions: Prediction[], ratios: IntervalLookup): number {
  const total = predictions.reduce((sum, { sample }) => sum + sample.weight, 0);
  const covered = predictions.reduce(
    (sum, prediction) => sum + (covers(prediction, ratios) ? prediction.sample.weight : 0),
    0,
  );
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

function isPaceSchedule(value: string): value is BudgetEstimatorPaceSchedule {
  return value === "none" || value === "linear_progress" || value === "sqrt_progress" ||
    value === "smoothstep_progress";
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

function percent(value: number | null): string {
  return value === null ? "n/a" : `${(100 * value).toFixed(1)}%`;
}
