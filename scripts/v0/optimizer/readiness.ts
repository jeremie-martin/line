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
} from "./readiness_model_artifact.ts";
import {
  applyReadinessStudyAblation,
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

const READINESS_MODEL = parseReadinessModelArtifact(modelJson);
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
  );
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
