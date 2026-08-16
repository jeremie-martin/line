/**
 * Canonical readiness for one unbuilt arc.
 *
 * readiness =
 *   catchability
 *   × speed fit
 *   × air fit
 *   × impact feasibility
 *   × elevation fit
 *
 * Every factor is inferred from the causal boundary and authored context for
 * the unbuilt arc. Projected physical aggregates of the preceding arc never
 * enter this layer as realized next-arc outcomes.
 */

import modelJson from "./readiness_model.json" with { type: "json" };
import aimImpactModelJson from "./aim_impact_model.json" with { type: "json" };
import aimImpactPoolValueModelJson from "./aim_impact_pool_value_model.json" with {
  type: "json",
};
import aimImpactRequestedPoolValueModelJson from
  "./aim_impact_requested_pool_value_model.json" with { type: "json" };
import type { NextArcReadinessInput } from "./readiness_features.ts";
import {
  parseReadinessModelArtifact,
  type ReadinessModelArtifact,
} from "./readiness_model_artifact.ts";
import {
  applyReadinessStudyAblation,
  READINESS_CONTEXT_BOOTSTRAP_TARGET_SEMANTICS_IDS,
  type ReadinessScore,
  type ReadinessStudyAblation,
  scoreImpactFeasibilityWithArtifact,
  scoreReadinessWithArtifact,
} from "./readiness_scoring.ts";

export {
  applyReadinessStudyAblation,
  type ReadinessScore,
  type ReadinessStudyAblation,
} from "./readiness_scoring.ts";

const READINESS_STUDY_ABLATION = parseReadinessStudyAblation(
  (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.LR_READINESS_STUDY_ABLATION,
);

const READINESS_CONTEXT_BOOTSTRAP = (() => {
  const env = (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env;
  const collection = env?.LR_READINESS_COLLECTION === "1";
  const allowPrevious =
    env?.LR_READINESS_ALLOW_PREVIOUS_TARGET_CONTEXT === "1";
  if (collection !== allowPrevious) {
    throw new Error(
      "readiness context bootstrap requires both collection guards",
    );
  }
  return collection && allowPrevious;
})();

let READINESS_MODEL = parseReadinessModelArtifact(modelJson);
const AIM_IMPACT_MODEL = parseReadinessModelArtifact(aimImpactModelJson);
const AIM_IMPACT_POOL_VALUE_MODEL = parseReadinessModelArtifact(
  aimImpactPoolValueModelJson,
);
const AIM_IMPACT_REQUESTED_POOL_VALUE_MODEL = parseReadinessModelArtifact(
  aimImpactRequestedPoolValueModelJson,
);
const AIM_IMPACT_DISTILLED_VALIDATION_MAE = (() => {
  const value = (aimImpactModelJson as {
    distillation?: { validation?: { mae?: unknown } };
  }).distillation?.validation?.mae;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`aim impact artifact is missing a finite validation MAE`);
  }
  return value;
})();
if (
  READINESS_MODEL.trainingCorpus.schema === "bootstrap-untrained" &&
  (globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }).process?.env?.LR_READINESS_ALLOW_BOOTSTRAP !== "1"
) {
  throw new Error(
    `the temporary readiness bootstrap model is not legal in production`,
  );
}

export function scoreReadiness(
  input: NextArcReadinessInput,
): ReadinessScore {
  return scoreReadinessWithArtifact(
    input,
    READINESS_MODEL,
    READINESS_STUDY_ABLATION,
    READINESS_CONTEXT_BOOTSTRAP
      ? {
        allowTargetSemanticsIds:
          READINESS_CONTEXT_BOOTSTRAP_TARGET_SEMANTICS_IDS,
      }
      : undefined,
  );
}

/** Canonical learned impact-feasibility component without inferring the other
 * readiness factors. */
export function scoreImpactFeasibility(
  input: NextArcReadinessInput,
): number {
  return scoreImpactFeasibilityWithArtifact(input, READINESS_MODEL);
}

/** Aim-specific cost surrogate distilled from the shipped impact component
 * under its explicit missing-articulation input contract. */
export function scoreDistilledAimImpactFeasibility(
  input: NextArcReadinessInput,
): number {
  return scoreImpactFeasibilityWithArtifact(input, AIM_IMPACT_MODEL);
}

/** Study arm: value an incoming state by the robust useful head of the
 * repeatedly sampled next-candidate pool. The artifact preserves the deployed
 * distilled model as an exact 32-tree prefix and appends one frozen residual. */
export function scoreAimImpactPoolValue(
  input: NextArcReadinessInput,
): number {
  return scoreImpactFeasibilityWithArtifact(
    input,
    AIM_IMPACT_POOL_VALUE_MODEL,
  );
}

/** Study arm: useful next-pool head with failed or unmeasured candidate
 * requests retained as zero-valued outcomes. Legal only for the exploration
 * proposal slot; the deployed distilled model continues to own exploitation. */
export function scoreAimImpactRequestedPoolValue(
  input: NextArcReadinessInput,
): number {
  return scoreImpactFeasibilityWithArtifact(
    input,
    AIM_IMPACT_REQUESTED_POOL_VALUE_MODEL,
  );
}

/** Held-out absolute-error resolution of the shipped distilled impact model.
 * This is artifact evidence, not a compiler-tuned constant. */
export function distilledAimImpactValidationMae(): number {
  return AIM_IMPACT_DISTILLED_VALIDATION_MAE;
}

/** Install the explicit context-selector artifact for a governed corpus
 * collection worker. The paired environment guards make this unreachable from
 * ordinary compiler execution. */
export function setReadinessCollectionModel(
  artifact: ReadinessModelArtifact,
): void {
  if (!READINESS_CONTEXT_BOOTSTRAP) {
    throw new Error(
      "a readiness context-selector override is legal only during collection",
    );
  }
  READINESS_MODEL = artifact;
}

function parseReadinessStudyAblation(
  value: string | undefined,
): ReadinessStudyAblation {
  if (value === undefined || value === "" || value === "normal") {
    return "normal";
  }
  if (
    value === "neutral" ||
    value === "without-catchability" ||
    value === "without-speed" ||
    value === "without-air" ||
    value === "without-impact" ||
    value === "without-elevation"
  ) return value;
  throw new Error(
    `invalid LR_READINESS_STUDY_ABLATION ${JSON.stringify(value)}`,
  );
}
