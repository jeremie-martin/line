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
