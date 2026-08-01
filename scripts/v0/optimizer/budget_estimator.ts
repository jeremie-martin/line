/** Runtime for the frozen, policy-neutral remaining-work estimator artifact. */

import { createHash } from "node:crypto";
import modelJson from "./budget_estimator_model.json" with { type: "json" };
import type { TraversalBudgetModel } from "./budget_model.ts";

/**
 * Schema v1: structural remaining work is `intercept + contact*C + duration*D`,
 * fitted at one policy budget and read at any.
 */
export const BUDGET_ESTIMATOR_MODEL_SCHEMA_V1 =
  "line.compile-budget-estimator-model.v1" as const;
/**
 * Schema v2: the same shape multiplied by `(B / referenceBudgetFrames)^budgetExponent`.
 *
 * The version exists so a reader that only knows v1 semantics FAILS on a law
 * artifact instead of silently dropping the exponent — which away from the
 * reference budget is a 2-3x error, the exact mistake the measurement of
 * `docs/budget-law-study.md` documents. An artifact with no exponent needs only
 * v1 semantics, so the calibrator still stamps it `v1`: the version advertises a
 * capability actually in use rather than a global era.
 */
export const BUDGET_ESTIMATOR_MODEL_SCHEMA_V2 =
  "line.compile-budget-estimator-model.v2" as const;
export const BUDGET_ESTIMATOR_MODEL_SCHEMAS = [
  BUDGET_ESTIMATOR_MODEL_SCHEMA_V1,
  BUDGET_ESTIMATOR_MODEL_SCHEMA_V2,
] as const;
export type BudgetEstimatorModelSchema = typeof BUDGET_ESTIMATOR_MODEL_SCHEMAS[number];

export type BudgetEstimatorBaseMode =
  | "structural"
  | "path_if_available"
  | "geometric_structural_path";
export type BudgetEstimatorPaceSchedule =
  | "none"
  | "linear_progress"
  | "sqrt_progress"
  | "smoothstep_progress";
export type BudgetEstimatorEvent = "start" | "high_water" | "spend" | "terminal" | "end";
export type BudgetEstimatorApplicability =
  | "calibrated"
  | "extrapolated_policy_budget"
  | "unvalidated_attempt_kind";
export type BudgetEstimatorAttemptKind = "initial" | "snapshot" | "repair" | "resumed";

/**
 * The artifact's structural block: V1's three coefficients plus the optional
 * budget law.
 *
 * Both law fields are optional and an absent or zero `budgetExponent` makes the
 * scale exactly `1`, so a v1 artifact and a v2 artifact without an exponent
 * predict identically through the same arithmetic. There is no second code
 * path and no migration step.
 */
/**
 * How far a path-backed estimate's calibration claim reaches.
 *
 * `calibrated_when_available` is the original rule: an incumbent path is a
 * measurement of the incumbent's own suffix, so it was held to need no policy
 * budget qualifier at all.
 *
 * `calibrated_when_available_in_domain` (schema v2) subjects it to the same
 * policy-budget domain as the structural estimate. The four-budget panel is why
 * the option exists: path-backed estimates are unbiased at 300k, 750k and 1.5M
 * (median actual/predicted 0.99-1.01) and **19% biased at 150k**, where the
 * incumbent handed to repair came out of a search that barely completed. That
 * is a point-estimate failure no interval width can honestly absorb, so an
 * artifact fitted above 150k must not call such an estimate calibrated there.
 * The rule lives in the artifact rather than in this function so that payloads
 * recorded under the original rule keep re-deriving exactly.
 */
export type BudgetEstimatorPathClaim =
  | "calibrated_when_available"
  | "calibrated_when_available_in_domain";

/** A multiplicative empirical interval around a point estimate. */
export type BudgetEstimatorIntervalRatios = { lowerRatio: number; upperRatio: number };

export type BudgetEstimatorStructuralModel = TraversalBudgetModel & {
  /** Budget the coefficients are anchored at; required with a nonzero exponent. */
  referenceBudgetFrames?: number;
  /** `alpha` in `(policy budget / referenceBudgetFrames)^alpha`; absent means 0. */
  budgetExponent?: number;
};

export type BudgetEstimatorModelArtifact = {
  schema: BudgetEstimatorModelSchema;
  modelId: string;
  calibrated: boolean;
  generatedAt: string;
  provenance: {
    generator: string;
    analysisSchema: string;
    datasetFingerprint: string | null;
    inputs: string[];
    groups: number;
    samples: number;
    folds: number;
    acceptance: string;
  };
  structural: BudgetEstimatorStructuralModel;
  combination: {
    baseMode: BudgetEstimatorBaseMode;
    paceSchedule: BudgetEstimatorPaceSchedule;
    correctionWithoutPathFactor: number;
    correctionWithPathFactor: number;
  };
  interval: {
    lowerRatio: number;
    upperRatio: number;
    nominalCoverage: number;
    byEvent: Partial<Record<BudgetEstimatorEvent, BudgetEstimatorIntervalRatios>>;
    /**
     * Event intervals split again by whether the estimate is path-backed.
     *
     * A path-backed estimate is a measurement of the incumbent's own suffix and
     * a path-free one is a regression on spec structure; they are different
     * regimes with different spreads, and one pooled band under-covers whichever
     * population is noisier. Splitting on the regime generalizes; splitting on
     * the budget would only re-describe the corpus, so the intervals are
     * conditioned on this and never on the policy budget.
     *
     * Every level is optional and resolution falls back cleanly: stratum, then
     * event, then the aggregate ratios above.
     */
    byEventAndPath?: Partial<Record<BudgetEstimatorEvent, {
      withPath?: BudgetEstimatorIntervalRatios;
      withoutPath?: BudgetEstimatorIntervalRatios;
    }>>;
  };
  applicability: {
    structuralPolicyBudgetFrames: { min: number; max: number };
    structuralAttemptKinds: BudgetEstimatorAttemptKind[];
    pathEstimate: BudgetEstimatorPathClaim;
  };
  metrics: {
    validationMedianAbsoluteLogError: number | null;
    validationP90UnderpredictionRatio: number | null;
    /**
     * Held-out interval coverage under ATTEMPT weighting, the convention the
     * candidate choice and the coefficients are fitted under.
     */
    validationIntervalCoverage: number | null;
    /**
     * Held-out interval coverage counting observations, which is the convention
     * `interval.nominalCoverage` names and the one `analyze_budget_telemetry.ts`
     * publishes. The two diverge when per-attempt observation density differs
     * across prediction regimes, so both are carried rather than inferred.
     */
    validationIntervalCoverageBySample?: number | null;
    staticMedianAbsoluteLogError: number | null;
    acceptedAgainstStatic: boolean;
  };
};

export const BUDGET_ESTIMATOR_MODEL = parseBudgetEstimatorModel(modelJson);
export const BUDGET_ESTIMATOR_MODEL_FINGERPRINT = createHash("sha256")
  .update(JSON.stringify(BUDGET_ESTIMATOR_MODEL))
  .digest("hex");
export const BUDGET_ESTIMATOR_TRAVERSAL_MODEL = BUDGET_ESTIMATOR_MODEL.structural;

/**
 * Select and calibrate a remaining-work point estimate.
 *
 * The artifact chooses the structural/path base and an optional geometric
 * blend with episode pace. Separate multiplicative corrections are fitted for
 * observations with and without an incumbent path. This function does not
 * inspect available budget and does not make optimizer decisions.
 *
 * The budget law lives in `structural`, not here: callers scale the structural
 * quantity by `budgetEstimatorStructuralScale` where they compute it, so the
 * recorded `structural_work_prior_frames` and every estimate derived from it
 * carry the same number and can be re-derived from each other.
 */
export function estimateRemainingBudgetWork(input: {
  structural: number;
  path: number | null;
  pace: number | null;
  progressFraction: number;
}, model: BudgetEstimatorModelArtifact = BUDGET_ESTIMATOR_MODEL): number {
  const structural = nonNegative(input.structural);
  const path = positiveOrNull(input.path);
  const pace = positiveOrNull(input.pace);
  const base = baseEstimate(structural, path, model.combination.baseMode);
  if (!(base > 0)) return 0;
  const paceWeight = pace === null
    ? 0
    : scheduleWeight(input.progressFraction, model.combination.paceSchedule);
  const blended = pace === null
    ? base
    : geometricBlend(base, pace, paceWeight);
  const usesPath = path !== null && model.combination.baseMode !== "structural";
  const correction = usesPath
    ? model.combination.correctionWithPathFactor
    : model.combination.correctionWithoutPathFactor;
  return nonNegative(blended * correction);
}

/**
 * The scalar structural remaining work is multiplied by at this policy budget.
 *
 * `cost(spec, B) = D(spec) * (B / referenceBudgetFrames)^budgetExponent`. One
 * exponent on the whole difficulty scalar, never one per coefficient: the
 * coefficient MIX rotates with the budget and a three-exponent fit is worse out
 * of sample at the budget it was not fitted at (docs/budget-law-study.md).
 *
 * This depends only on the budget, so callers compute it ONCE — the recorder at
 * construction, the calibrator per fit — and never per observation.
 */
export function budgetEstimatorStructuralScale(
  policyBudgetFrames: number,
  model: BudgetEstimatorModelArtifact = BUDGET_ESTIMATOR_MODEL,
): number {
  const exponent = model.structural.budgetExponent ?? 0;
  const reference = model.structural.referenceBudgetFrames ?? 0;
  // A zero exponent is the v1 artifact and returns exactly 1, not `pow(x, 0)`,
  // so the identity is visible rather than inferred. A non-positive budget or
  // reference has no ratio to raise and also leaves the estimate untouched.
  if (exponent === 0 || !(reference > 0) || !(policyBudgetFrames > 0)) return 1;
  return Math.pow(policyBudgetFrames / reference, exponent);
}

/**
 * Return the artifact's multiplicative empirical interval for an observation.
 *
 * Resolution is most specific first: the (event, path-availability) stratum,
 * then the event, then the aggregate. Every level is optional, so an artifact
 * that fits none of them still answers, and one that fits only events behaves
 * exactly as it did before strata existed.
 */
export function budgetEstimateInterval(
  estimate: number,
  input: { event?: BudgetEstimatorEvent; pathAvailable?: boolean } = {},
  model: BudgetEstimatorModelArtifact = BUDGET_ESTIMATOR_MODEL,
): { lower: number; upper: number } {
  const point = nonNegative(estimate);
  const byEvent = input.event === undefined ? undefined : model.interval.byEvent[input.event];
  const stratum = input.event === undefined || input.pathAvailable === undefined
    ? undefined
    : model.interval.byEventAndPath?.[input.event]?.[
      budgetEstimateUsesPath(input.pathAvailable, model) ? "withPath" : "withoutPath"
    ];
  const interval = stratum ?? byEvent;
  return {
    lower: point * (interval?.lowerRatio ?? model.interval.lowerRatio),
    upper: point * (interval?.upperRatio ?? model.interval.upperRatio),
  };
}

/**
 * Whether the artifact's own selector routes this observation through the path
 * base — the single definition of "path-backed" for the correction factor, the
 * interval stratum, and the calibrator's matching split.
 *
 * It is not simply "a path exists": under a `structural` base mode the selector
 * ignores the path, so such an estimate belongs in the path-free regime however
 * much measured path it had available.
 */
export function budgetEstimateUsesPath(
  pathAvailable: boolean,
  model: BudgetEstimatorModelArtifact = BUDGET_ESTIMATOR_MODEL,
): boolean {
  return pathAvailable && model.combination.baseMode !== "structural";
}

/**
 * Classify whether calibrated error bounds apply to this observation.
 *
 * A path-backed estimate skips the attempt-kind test — it is a measurement of
 * the incumbent's suffix and does not depend on how the attempt was started —
 * but whether it also skips the policy-budget test is the artifact's own
 * declaration; see `BudgetEstimatorPathClaim`. Without a path, both attempt kind
 * and policy budget must lie in the structural calibration corpus.
 */
export function budgetEstimatorApplicability(input: {
  pathAvailable: boolean;
  policyBudgetFrames: number;
  attemptKind: BudgetEstimatorAttemptKind;
}, model: BudgetEstimatorModelArtifact = BUDGET_ESTIMATOR_MODEL): BudgetEstimatorApplicability {
  const domain = model.applicability.structuralPolicyBudgetFrames;
  const inDomain = input.policyBudgetFrames >= domain.min &&
    input.policyBudgetFrames <= domain.max;
  if (budgetEstimateUsesPath(input.pathAvailable, model)) {
    return inDomain ||
        model.applicability.pathEstimate === "calibrated_when_available"
      ? "calibrated"
      : "extrapolated_policy_budget";
  }
  if (!model.applicability.structuralAttemptKinds.includes(input.attemptKind)) {
    return "unvalidated_attempt_kind";
  }
  return inDomain ? "calibrated" : "extrapolated_policy_budget";
}

export function parseBudgetEstimatorModel(value: unknown): BudgetEstimatorModelArtifact {
  if (typeof value !== "object" || value === null) throw new Error("budget estimator model must be an object");
  const model = value as BudgetEstimatorModelArtifact;
  if (!(BUDGET_ESTIMATOR_MODEL_SCHEMAS as readonly string[]).includes(model.schema)) {
    throw new Error(`unsupported budget estimator schema ${String(model.schema)}`);
  }
  if (typeof model.modelId !== "string" || model.modelId.length === 0) throw new Error("budget estimator modelId is required");
  if (typeof model.calibrated !== "boolean") throw new Error("budget estimator calibrated must be boolean");
  if (!isBaseMode(model.combination?.baseMode)) throw new Error("invalid budget estimator baseMode");
  if (!isPaceSchedule(model.combination?.paceSchedule)) throw new Error("invalid budget estimator paceSchedule");
  for (const [name, number] of Object.entries({
    interceptFrames: model.structural?.interceptFrames,
    contactFrames: model.structural?.contactFrames,
    durationFrameScale: model.structural?.durationFrameScale,
    correctionWithoutPathFactor: model.combination?.correctionWithoutPathFactor,
    correctionWithPathFactor: model.combination?.correctionWithPathFactor,
    lowerRatio: model.interval?.lowerRatio,
    upperRatio: model.interval?.upperRatio,
    nominalCoverage: model.interval?.nominalCoverage,
    structuralPolicyBudgetMin: model.applicability?.structuralPolicyBudgetFrames?.min,
    structuralPolicyBudgetMax: model.applicability?.structuralPolicyBudgetFrames?.max,
  })) {
    if (typeof number !== "number" || !Number.isFinite(number) || number < 0) {
      throw new Error(`budget estimator ${name} must be finite and non-negative`);
    }
  }
  if (
    !(model.combination.correctionWithoutPathFactor > 0) ||
    !(model.combination.correctionWithPathFactor > 0)
  ) throw new Error("budget estimator correction factors must be positive");
  validateSchemaV2Features(model);
  if (model.interval.lowerRatio > 1 || model.interval.upperRatio < 1) {
    throw new Error("budget estimator interval must contain the point estimate");
  }
  if (typeof model.interval.byEvent !== "object" || model.interval.byEvent === null) {
    throw new Error("budget estimator interval.byEvent must be an object");
  }
  if (
    (model.applicability?.pathEstimate !== "calibrated_when_available" &&
      model.applicability?.pathEstimate !== "calibrated_when_available_in_domain") ||
    !Array.isArray(model.applicability.structuralAttemptKinds) ||
    model.applicability.structuralAttemptKinds.some((kind) =>
      kind !== "initial" && kind !== "snapshot" && kind !== "repair" && kind !== "resumed"
    ) ||
    model.applicability.structuralPolicyBudgetFrames.min >
      model.applicability.structuralPolicyBudgetFrames.max
  ) throw new Error("invalid budget estimator applicability domain");
  for (const [event, interval] of Object.entries(model.interval.byEvent)) {
    validateIntervalRatios(interval, event);
  }
  // The contain-ratio-1 invariant holds per stratum, not only per event: a
  // stratum is read on its own and an interval that excludes its own point
  // estimate is not an interval.
  for (const [event, strata] of Object.entries(model.interval.byEventAndPath ?? {})) {
    if (typeof strata !== "object" || strata === null) {
      throw new Error(`invalid budget estimator interval strata for ${event}`);
    }
    for (const [key, interval] of Object.entries(strata)) {
      if (key !== "withPath" && key !== "withoutPath") {
        throw new Error(`unknown budget estimator interval stratum ${key} for ${event}`);
      }
      if (interval !== undefined) validateIntervalRatios(interval, `${event}/${key}`);
    }
  }
  return structuredClone(model);
}

function validateIntervalRatios(
  interval: BudgetEstimatorIntervalRatios | undefined,
  label: string,
): void {
  if (
    interval === undefined ||
    !Number.isFinite(interval.lowerRatio) ||
    !Number.isFinite(interval.upperRatio) ||
    interval.lowerRatio < 0 ||
    interval.lowerRatio > 1 ||
    interval.upperRatio < 1
  ) throw new Error(`invalid budget estimator interval for ${label}`);
}

/**
 * v2 features are optional, but they must never be present and unreadable.
 *
 * A `v1` artifact carrying one is the dangerous case: every reader that predates
 * it parses the file happily and silently answers a different question — a
 * 2-3x error for a dropped budget exponent, a mis-stated coverage claim for
 * dropped interval strata. Reject at the door rather than trust that nothing old
 * ever loads it.
 */
function validateSchemaV2Features(model: BudgetEstimatorModelArtifact): void {
  const { budgetExponent, referenceBudgetFrames } = model.structural;
  const v2Features = [
    budgetExponent !== undefined || referenceBudgetFrames !== undefined ? "a budget law" : null,
    model.interval.byEventAndPath !== undefined ? "interval strata" : null,
    model.applicability.pathEstimate === "calibrated_when_available_in_domain"
      ? "a domain-scoped path claim"
      : null,
  ].filter((feature): feature is string => feature !== null);
  if (model.schema === BUDGET_ESTIMATOR_MODEL_SCHEMA_V1 && v2Features.length > 0) {
    throw new Error(
      `budget estimator schema ${BUDGET_ESTIMATOR_MODEL_SCHEMA_V1} cannot carry ` +
        `${v2Features.join(" or ")}; declare ${BUDGET_ESTIMATOR_MODEL_SCHEMA_V2}`,
    );
  }
  if (
    budgetExponent !== undefined &&
    (!Number.isFinite(budgetExponent) || budgetExponent < 0)
  ) throw new Error("budget estimator budgetExponent must be finite and non-negative");
  if (
    referenceBudgetFrames !== undefined &&
    (!Number.isFinite(referenceBudgetFrames) || referenceBudgetFrames <= 0)
  ) throw new Error("budget estimator referenceBudgetFrames must be finite and positive");
  if ((budgetExponent ?? 0) !== 0 && !(referenceBudgetFrames! > 0)) {
    throw new Error("budget estimator budgetExponent requires a positive referenceBudgetFrames");
  }
}

function baseEstimate(
  structural: number,
  path: number | null,
  mode: BudgetEstimatorBaseMode,
): number {
  if (path === null || mode === "structural") return structural;
  if (mode === "path_if_available") return path;
  return geometricBlend(structural, path, 0.5);
}

function scheduleWeight(progress: number, schedule: BudgetEstimatorPaceSchedule): number {
  const p = clamp01(progress);
  if (schedule === "none") return 0;
  if (schedule === "sqrt_progress") return Math.sqrt(p);
  if (schedule === "smoothstep_progress") return p * p * (3 - 2 * p);
  return p;
}

function geometricBlend(a: number, b: number, weight: number): number {
  if (!(a > 0)) return nonNegative(b);
  if (!(b > 0)) return nonNegative(a);
  const w = clamp01(weight);
  return Math.exp((1 - w) * Math.log(a) + w * Math.log(b));
}

function positiveOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isBaseMode(value: unknown): value is BudgetEstimatorBaseMode {
  return value === "structural" || value === "path_if_available" ||
    value === "geometric_structural_path";
}

function isPaceSchedule(value: unknown): value is BudgetEstimatorPaceSchedule {
  return value === "none" || value === "linear_progress" ||
    value === "sqrt_progress" || value === "smoothstep_progress";
}
