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
  predictReadinessHistogramCheckpoints,
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
  "next-arc-readiness-targets-v3-contacted-frame-impulse";

/**
 * A scorer-bound refresh has to collect contexts with the model that currently
 * drives production before it can train the replacement. These are legal only
 * as collection-time context selectors; production compatibility remains
 * strict and never consults this list.
 */
export const READINESS_CONTEXT_BOOTSTRAP_TARGET_SEMANTICS_IDS = [
  "next-arc-readiness-targets-v2-scorer-fit",
] as const;

export type ReadinessArtifactCompatibility = {
  allowTargetSemanticsIds?: readonly string[];
  /** Offline evaluation may score a disabled component without multiplying it
   * into the shipped readiness product. Production leaves this false. */
  inferDisabledComponents?: boolean;
  /** Specialized consumers may load a component-only artifact. Production
   *  readiness leaves this unset and still requires the complete product. */
  requiredComponents?: readonly (
    | "catchability"
    | "impactFeasibility"
    | "speedFit"
    | "airFit"
  )[];
};

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

/** Built once. This check runs on every readiness call - the compiler's hottest
 *  path - so it must not allocate. */
const KNOWN_FEATURE_NAMES: ReadonlySet<string> = new Set(READINESS_FEATURE_NAMES);

/*
 * `assertCompatibleReadinessArtifact` is called per scoring call but its answer
 * depends only on the artifact, which is a module-level singleton in production.
 * Validate each artifact once and remember it; a rejected artifact throws every
 * time, since only success is recorded.
 */
const validatedArtifacts = new WeakSet<ReadinessModelArtifact>();
const validatedImpactOnlyArtifacts = new WeakSet<ReadinessModelArtifact>();

function assertCompatibleReadinessArtifactOnce(
  artifact: ReadinessModelArtifact,
): void {
  if (validatedArtifacts.has(artifact)) return;
  assertCompatibleReadinessArtifact(artifact);
  validatedArtifacts.add(artifact);
}

export function scoreReadinessWithArtifact(
  input: NextArcReadinessInput,
  artifact: ReadinessModelArtifact,
  ablation: ReadinessStudyAblation = "normal",
  compatibility?: ReadinessArtifactCompatibility,
): ReadinessScore {
  if (compatibility === undefined) {
    assertCompatibleReadinessArtifactOnce(artifact);
  } else {
    // A relaxed collection-time check must never populate the production
    // validation cache: the same artifact must still fail under strict use.
    assertCompatibleReadinessArtifact(artifact, compatibility);
  }
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
   * UNREPRODUCED LEAD (2026-07-25, exact-kernel ballistic default): removing it
   * measured better on BOTH strata (5 dense + 3 healthy at 250k) — dense land
   * 34.3 -> 35.0, viable 27.7 -> 28.5, healthy land 75.1 -> 76.5, and it was the
   * only readiness ablation to produce a completion the others did not. Not
   * re-measured since the closed form became the default. The information
   * argument above stands on its own; the deltas are a lead. See
   * docs/BALLISTIC_READINESS_DECISIONS.md §9.
   *
   * The component stays in the artifact and keeps being scored on its own terms
   * by the readiness benchmark, which reads the artifact directly rather than
   * this function. It is only the PRODUCT that must not multiply by noise.
   * `LR_READINESS_AIR_FIT=1` restores it to the product for A/B.
   *
   * With the flag off the component is NOT INFERRED AT ALL, and
   * `airFitPredicted` reports the neutral 1 that was multiplied in. That is one
   * of four 200-tree inferences per readiness call — the compiler's second
   * largest JavaScript cost — spent on a number no caller reads: production
   * reads `airFit`, and no study reads `airFitPredicted`. With the flag on it is
   * inferred and reported exactly as before, so the A/B arm is intact.
   */
  const airFitEnabled = readinessAirFitEnabled();
  const inferAirFit = airFitEnabled ||
    compatibility?.inferDisabledComponents === true;
  const airFitPredicted = !inferAirFit ||
      input.outgoingGap?.scorerTargets.air === undefined
    ? 1
    : infer(artifact, "airFit", features);
  const airFit = airFitEnabled ? airFitPredicted : 1;
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

/** Score only the impact component when a controller needs that one factor.
 * This preserves the canonical artifact, feature transform, and component
 * semantics without paying to infer unrelated readiness components. */
export function scoreImpactFeasibilityWithArtifact(
  input: NextArcReadinessInput,
  artifact: ReadinessModelArtifact,
): number {
  if (!validatedImpactOnlyArtifacts.has(artifact)) {
    assertCompatibleReadinessArtifact(artifact, {
      requiredComponents: ["impactFeasibility"],
    });
    validatedImpactOnlyArtifacts.add(artifact);
  }
  if (input.incomingGap.scorerTargets.impact === undefined) return 1;
  return infer(artifact, "impactFeasibility", readinessFeatureVector(input));
}

/** Score an append-only impact residual and its incumbent prefix together.
 * The caller owns and verifies the artifact's prefix identity. */
export function scoreImpactFeasibilityCheckpointsWithArtifact(
  input: NextArcReadinessInput,
  artifact: ReadinessModelArtifact,
  incumbentTreeCount: number,
): { incumbent: number; residualAdjusted: number } {
  if (!validatedImpactOnlyArtifacts.has(artifact)) {
    assertCompatibleReadinessArtifact(artifact, {
      requiredComponents: ["impactFeasibility"],
    });
    validatedImpactOnlyArtifacts.add(artifact);
  }
  if (input.incomingGap.scorerTargets.impact === undefined) {
    return { incumbent: 1, residualAdjusted: 1 };
  }
  const prediction = inferHistogramCheckpoints(
    artifact,
    "impactFeasibility",
    readinessFeatureVector(input),
    incumbentTreeCount,
  );
  return {
    incumbent: prediction.prefix,
    residualAdjusted: prediction.complete,
  };
}

export function assertCompatibleReadinessArtifact(
  artifact: ReadinessModelArtifact,
  compatibility: ReadinessArtifactCompatibility = {},
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
  if (
    artifact.targetSemanticsId !== READINESS_TARGET_SEMANTICS_ID &&
    !compatibility.allowTargetSemanticsIds?.includes(
      artifact.targetSemanticsId,
    )
  ) {
    throw new Error(
      `readiness model target semantics are stale: ` +
        `${artifact.targetSemanticsId}`,
    );
  }
  /*
   * The extractor and the model are deliberately NOT the same list.
   *
   * `READINESS_FEATURE_NAMES` says what the compiler can OBSERVE; an artifact's
   * `featureNames` say what it USES. Requiring them to be identical made those
   * two questions one, and that had a nasty consequence: choosing to drop a
   * feature from the model meant editing the extractor, which is fingerprinted
   * by the readiness corpus guard, which invalidated the corpus - and a corpus
   * can only be recollected by running the compiler, which needs a model that
   * matches the extractor. Feature selection was therefore impossible without
   * either a hand-written bootstrap artifact or weakening the guard.
   *
   * Requiring only that every column the artifact uses EXISTS in the extractor
   * dissolves that: the corpus keeps recording the full vector, models declare
   * their own subset, and `infer` projects. Feature-selection experiments cost
   * a retrain and nothing else.
   *
   * This is not weaker where it matters: an unknown column is rejected here,
   * duplicates are already rejected by the artifact parser
   * (`readiness_model_artifact.ts`), and `featureTransformId` still binds the
   * MEANING of a column, which is what changes silently and dangerously.
   *
   * What it does give up is a mechanical tripwire: appending or reordering
   * `READINESS_FEATURE_NAMES` no longer invalidates an old artifact by itself,
   * because the columns it names still exist and are still projected correctly.
   * That is the intended trade - it is exactly what makes a subset legal - and
   * the transform id is what must be bumped when a column's meaning moves.
   */
  for (const name of artifact.featureNames) {
    if (!KNOWN_FEATURE_NAMES.has(name)) {
      throw new Error(
        `readiness model feature schema does not match the production ` +
          `extractor: unknown feature ${name}`,
      );
    }
  }
  for (
    const component of compatibility.requiredComponents ?? [
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
  factors: Omit<ReadinessScore, "readiness" | "airFitPredicted">,
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

/** Column indices into the production vector for the subset an artifact uses,
 *  plus a reusable buffer. `null` means it uses the whole vector in order, in
 *  which case the vector is passed straight through and nothing is copied. */
type FeatureProjection = { indices: number[]; buffer: number[] } | null;
const featureProjections = new WeakMap<
  ReadinessModelArtifact,
  FeatureProjection
>();

function featureProjection(artifact: ReadinessModelArtifact): FeatureProjection {
  const cached = featureProjections.get(artifact);
  if (cached !== undefined) return cached;
  const identity = artifact.featureNames.length ===
      READINESS_FEATURE_NAMES.length &&
    artifact.featureNames.every(
      (name, index) => name === READINESS_FEATURE_NAMES[index],
    );
  const projection: FeatureProjection = identity ? null : {
    indices: artifact.featureNames.map((name) =>
      READINESS_FEATURE_NAMES.indexOf(
        name as (typeof READINESS_FEATURE_NAMES)[number],
      )
    ),
    buffer: new Array<number>(artifact.featureNames.length).fill(0),
  };
  featureProjections.set(artifact, projection);
  return projection;
}

function infer(
  artifact: ReadinessModelArtifact,
  component: "catchability" | "impactFeasibility" | "speedFit" | "airFit",
  features: readonly number[],
): number {
  const projection = featureProjection(artifact);
  if (projection === null) {
    return predictReadinessComponent(artifact, component, features);
  }
  for (let i = 0; i < projection.indices.length; i++) {
    projection.buffer[i] = features[projection.indices[i]];
  }
  return predictReadinessComponent(artifact, component, projection.buffer);
}

function inferHistogramCheckpoints(
  artifact: ReadinessModelArtifact,
  component: "impactFeasibility",
  features: readonly number[],
  prefixTreeCount: number,
): { prefix: number; complete: number } {
  const projection = featureProjection(artifact);
  if (projection === null) {
    return predictReadinessHistogramCheckpoints(
      artifact,
      component,
      features,
      prefixTreeCount,
    );
  }
  for (let i = 0; i < projection.indices.length; i++) {
    projection.buffer[i] = features[projection.indices[i]];
  }
  return predictReadinessHistogramCheckpoints(
    artifact,
    component,
    projection.buffer,
    prefixTreeCount,
  );
}

function ablatedFactor(
  active: ReadinessStudyAblation,
  factor: Exclude<ReadinessStudyAblation, "normal" | "neutral">,
  value: number,
): number {
  return active === factor ? 1 : value;
}
