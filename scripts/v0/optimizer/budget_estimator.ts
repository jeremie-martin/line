/** Runtime for the frozen, policy-neutral remaining-work estimator artifact. */

import { createHash } from "node:crypto";
import modelJson from "./budget_estimator_model.json" with { type: "json" };
import type { TraversalBudgetModel } from "./budget_model.ts";

export const BUDGET_ESTIMATOR_MODEL_SCHEMA =
  "line.compile-budget-estimator-model.v1" as const;

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

export type BudgetEstimatorModelArtifact = {
  schema: typeof BUDGET_ESTIMATOR_MODEL_SCHEMA;
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
  structural: TraversalBudgetModel;
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
    byEvent: Partial<Record<BudgetEstimatorEvent, {
      lowerRatio: number;
      upperRatio: number;
    }>>;
  };
  applicability: {
    structuralPolicyBudgetFrames: { min: number; max: number };
    structuralAttemptKinds: BudgetEstimatorAttemptKind[];
    pathEstimate: "calibrated_when_available";
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

/** Return the artifact's multiplicative empirical interval for an event. */
export function budgetEstimateInterval(
  estimate: number,
  event?: BudgetEstimatorEvent,
  model: BudgetEstimatorModelArtifact = BUDGET_ESTIMATOR_MODEL,
): { lower: number; upper: number } {
  const point = nonNegative(estimate);
  const interval = event === undefined ? undefined : model.interval.byEvent[event];
  return {
    lower: point * (interval?.lowerRatio ?? model.interval.lowerRatio),
    upper: point * (interval?.upperRatio ?? model.interval.upperRatio),
  };
}

/**
 * Classify whether calibrated error bounds apply to this observation.
 *
 * A selected path estimate has its own validated domain. Without one, both
 * attempt kind and policy budget must lie in the structural calibration corpus.
 */
export function budgetEstimatorApplicability(input: {
  pathAvailable: boolean;
  policyBudgetFrames: number;
  attemptKind: BudgetEstimatorAttemptKind;
}, model: BudgetEstimatorModelArtifact = BUDGET_ESTIMATOR_MODEL): BudgetEstimatorApplicability {
  if (input.pathAvailable && model.combination.baseMode !== "structural") return "calibrated";
  if (!model.applicability.structuralAttemptKinds.includes(input.attemptKind)) {
    return "unvalidated_attempt_kind";
  }
  const domain = model.applicability.structuralPolicyBudgetFrames;
  return input.policyBudgetFrames >= domain.min && input.policyBudgetFrames <= domain.max
    ? "calibrated"
    : "extrapolated_policy_budget";
}

export function parseBudgetEstimatorModel(value: unknown): BudgetEstimatorModelArtifact {
  if (typeof value !== "object" || value === null) throw new Error("budget estimator model must be an object");
  const model = value as BudgetEstimatorModelArtifact;
  if (model.schema !== BUDGET_ESTIMATOR_MODEL_SCHEMA) {
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
  if (model.interval.lowerRatio > 1 || model.interval.upperRatio < 1) {
    throw new Error("budget estimator interval must contain the point estimate");
  }
  if (typeof model.interval.byEvent !== "object" || model.interval.byEvent === null) {
    throw new Error("budget estimator interval.byEvent must be an object");
  }
  if (
    model.applicability?.pathEstimate !== "calibrated_when_available" ||
    !Array.isArray(model.applicability.structuralAttemptKinds) ||
    model.applicability.structuralAttemptKinds.some((kind) =>
      kind !== "initial" && kind !== "snapshot" && kind !== "repair" && kind !== "resumed"
    ) ||
    model.applicability.structuralPolicyBudgetFrames.min >
      model.applicability.structuralPolicyBudgetFrames.max
  ) throw new Error("invalid budget estimator applicability domain");
  for (const [event, interval] of Object.entries(model.interval.byEvent)) {
    if (
      interval === undefined ||
      !Number.isFinite(interval.lowerRatio) ||
      !Number.isFinite(interval.upperRatio) ||
      interval.lowerRatio < 0 ||
      interval.lowerRatio > 1 ||
      interval.upperRatio < 1
    ) throw new Error(`invalid budget estimator interval for ${event}`);
  }
  return structuredClone(model);
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
