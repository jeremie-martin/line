/**
 * Canonical factor semantics for one readiness artifact.
 *
 * Production and offline evaluation both call this function. Model loading,
 * study ablations, and corpus construction live outside this boundary.
 */

import type { NextArcReadinessInput } from "./readiness_features.ts";
import {
  READINESS_FEATURE_NAMES,
  READINESS_FEATURE_TRANSFORM_ID,
  readinessFeatureVector,
} from "./readiness_features.ts";
import {
  type ReadinessModelArtifact,
  predictReadinessComponent,
} from "./readiness_model_artifact.ts";
import {
  PRODUCTION_ARC_PROPOSAL_POLICY_ID,
} from "./arc_proposal.ts";

export type ReadinessStudyAblation =
  | "normal"
  | "neutral"
  | "without-catchability"
  | "without-speed"
  | "without-air"
  | "without-impact"
  | "without-elevation";

export type ReadinessScore = {
  readiness: number;
  catchability: number;
  speedFit: number;
  impactFeasibility: number;
  airFit: number;
  elevationFit: number;
};

/**
 * Binds the model outputs to their labels. In particular, impact feasibility
 * is expected scorer-compatible impact fit conditional on viability; it is
 * not a one-sided "impact >= ask" classifier.
 */
export const READINESS_TARGET_SEMANTICS_ID =
  "next-arc-readiness-targets-v2-scorer-fit";

let catchabilityObserver: ((value: number) => void) | null = null;

/** Study-only observer; production leaves it null. */
export function setReadinessCatchabilityObserver(
  observer: ((value: number) => void) | null,
): void {
  catchabilityObserver = observer;
}

export function scoreReadinessWithArtifact(
  input: NextArcReadinessInput,
  artifact: ReadinessModelArtifact,
  ablation: ReadinessStudyAblation = "normal",
): ReadinessScore {
  assertCompatibleReadinessArtifact(artifact);
  const features = readinessFeatureVector(input);
  const impossibleBinding =
    input.incomingBoundary.incoming.riderMounted === false ||
    input.incomingBoundary.incoming.sledIntact === false;
  const catchability = impossibleBinding
    ? 0
    : infer(artifact, "catchability", features);
  catchabilityObserver?.(catchability);
  const impactTarget = input.incomingGap.scorerTargets.impact;
  const impactFeasibility =
    impactTarget === undefined
      ? 1
      : infer(artifact, "impactFeasibility", features);
  const speedFit =
    input.outgoingGap?.scorerTargets.speed === undefined
      ? 1
      : infer(artifact, "speedFit", features);
  const airFit =
    input.outgoingGap?.scorerTargets.air === undefined
      ? 1
      : infer(artifact, "airFit", features);
  /*
   * The current V2 corpus has no authored elevation population. Keep the
   * factor exactly neutral until a component is trained and exported.
   */
  const elevationFit = 1;
  const readiness = applyReadinessStudyAblation({
    catchability,
    speedFit,
    airFit,
    impactFeasibility,
    elevationFit,
  }, ablation);
  return {
    readiness,
    catchability,
    speedFit,
    impactFeasibility,
    airFit,
    elevationFit,
  };
}

export function assertCompatibleReadinessArtifact(
  artifact: ReadinessModelArtifact,
): void {
  if (
    artifact.generatorPolicyId !==
      PRODUCTION_ARC_PROPOSAL_POLICY_ID
  ) {
    throw new Error(
      `readiness model represents ${artifact.generatorPolicyId}, ` +
        `not ${PRODUCTION_ARC_PROPOSAL_POLICY_ID}`,
    );
  }
  if (artifact.featureTransformId !== READINESS_FEATURE_TRANSFORM_ID) {
    throw new Error(
      `readiness model feature transform is stale: ` +
        `${artifact.featureTransformId}`,
    );
  }
  if (artifact.targetSemanticsId !== READINESS_TARGET_SEMANTICS_ID) {
    throw new Error(
      `readiness model target semantics are stale: ` +
        `${artifact.targetSemanticsId}`,
    );
  }
  if (
    artifact.featureNames.length !== READINESS_FEATURE_NAMES.length ||
    artifact.featureNames.some(
      (name, index) => name !== READINESS_FEATURE_NAMES[index],
    )
  ) {
    throw new Error(
      `readiness model feature schema does not match the production extractor`,
    );
  }
  for (
    const component of [
      "catchability",
      "impactFeasibility",
      "speedFit",
      "airFit",
    ] as const
  ) {
    if (artifact.components[component] === undefined) {
      throw new Error(`readiness model is missing ${component}`);
    }
  }
}

export function applyReadinessStudyAblation(
  factors: Omit<ReadinessScore, "readiness">,
  ablation: ReadinessStudyAblation = "normal",
): number {
  if (ablation === "neutral") return 1;
  return (
    ablatedFactor(
      ablation,
      "without-catchability",
      factors.catchability,
    ) *
    ablatedFactor(ablation, "without-speed", factors.speedFit) *
    ablatedFactor(ablation, "without-air", factors.airFit) *
    ablatedFactor(
      ablation,
      "without-impact",
      factors.impactFeasibility,
    ) *
    ablatedFactor(
      ablation,
      "without-elevation",
      factors.elevationFit,
    )
  );
}

function infer(
  artifact: ReadinessModelArtifact,
  component: "catchability" | "impactFeasibility" | "speedFit" | "airFit",
  features: readonly number[],
): number {
  return predictReadinessComponent(artifact, component, features);
}

function ablatedFactor(
  active: ReadinessStudyAblation,
  factor: Exclude<ReadinessStudyAblation, "normal" | "neutral">,
  value: number,
): number {
  return active === factor ? 1 : value;
}
