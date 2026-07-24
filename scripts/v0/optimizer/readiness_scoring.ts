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
  /** The value actually multiplied into `readiness`. The product identity
   *  `readiness = catchability * speedFit * airFit * impactFeasibility *
   *  elevationFit` always holds over these fields. */
  airFit: number;
  elevationFit: number;
  /** What the air component predicted, whether or not it was used. Telemetry
   *  and the readiness benchmark read this; it is deliberately NOT part of the
   *  product identity above. */
  airFitPredicted: number;
};

/**
 * Binds the model outputs to their labels. In particular, impact feasibility
 * is expected scorer-compatible impact fit conditional on viability; it is
 * not a one-sided "impact >= ask" classifier.
 */
export const READINESS_TARGET_SEMANTICS_ID =
  "next-arc-readiness-targets-v2-scorer-fit";

function readinessAirFitEnabled(): boolean {
  return (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.LR_READINESS_AIR_FIT === "1";
}

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
  /*
   * The next-arc air factor is EXCLUDED FROM THE PRODUCT, deliberately.
   *
   * It is not informative about anything the incoming boundary can change.
   * Measured on the frozen corpus two independent ways: a lookup keyed on
   * nothing but the authored asks and the two gap durations — no rider state at
   * all — scores 0.01228 against the trained component's 0.01022, and a lookup
   * on the predicted boundary ALONE scores 0.03843 against a global-mean
   * 0.03925, i.e. the boundary carries essentially no air signal. That is the
   * honest structure of the problem rather than a modelling failure: air over
   * the unbuilt arc's outgoing gap is set by how long THAT arc holds the rider
   * before releasing, which is a property of an arc that does not exist yet.
   *
   * So the component mostly re-encodes the authored ask, which the generator
   * and `projectedOutgoingQuality` already act on. Multiplying it into the
   * product double-counts authored air and adds variance without signal, which
   * dilutes the factors that do carry information.
   *
   * Removing it is better on BOTH strata (5 dense + 3 healthy at 250k): dense
   * land 34.3 -> 35.0, viable 27.7 -> 28.5, healthy land 75.1 -> 76.5, and it
   * was the only readiness ablation to produce a completion the others did not.
   *
   * The component stays in the artifact and keeps being scored on its own terms
   * by the readiness benchmark, where it is a legitimate question. It is only
   * the PRODUCT that must not multiply by noise. The predicted value is still
   * reported as `airFitPredicted`, so nothing observable is lost.
   * `LR_READINESS_AIR_FIT=1` restores it to the product for A/B.
   */
  const airFitPredicted =
    input.outgoingGap?.scorerTargets.air === undefined
      ? 1
      : infer(artifact, "airFit", features);
  const airFit = readinessAirFitEnabled() ? airFitPredicted : 1;
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
    airFitPredicted,
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
