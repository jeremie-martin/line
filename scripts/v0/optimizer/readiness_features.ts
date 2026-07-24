/**
 * Canonical causal features for readiness of one unbuilt arc.
 *
 * The incoming boundary is at the contact where that arc would be placed.
 * The incoming scorer gap owns the entry-contact impact ask; the outgoing
 * scorer gap owns speed, air, and elevation asks after the unbuilt arc.
 */

import type {
  BallisticState,
  IncomingContactBoundary,
} from "../core/ballistic_projection.ts";
import {
  ballisticArticulationFeatures,
} from "../core/ballistic_projection.ts";
import type { AxisValues, Gap } from "../types.ts";
import {
  READINESS_BASE_FEATURE_NAMES,
  readinessBaseFeatureVector,
  type ReadinessBoundaryState,
} from "./readiness_base_features.ts";
import {
  composeArcProposalTargets,
  PRODUCTION_ARC_PROPOSAL_POLICY_ID,
} from "./arc_proposal.ts";

export type ReadinessScorerGapContext = {
  startFrame: number;
  endFrame: number;
  frameCount: number;
  endsWithContact: boolean;
  scorerTargets: AxisValues;
  proposalTargets: AxisValues;
  nextImpact?: number;
};

export type NextArcReadinessInput = {
  incomingBoundary: IncomingContactBoundary;
  incomingGap: ReadinessScorerGapContext;
  outgoingGap: ReadinessScorerGapContext | null;
  generatorPolicyId: string;
};

/**
 * Binds exported coefficients/trees to feature meaning, not merely vector
 * length and labels. Increment this whenever any feature formula, frame owner,
 * normalization, or target composition changes.
 */
export const READINESS_FEATURE_TRANSFORM_ID =
  "next-arc-readiness-features-v2-contact-owned";

export function readinessScorerGapContext(
  gap: Gap,
  scorerTargets: AxisValues = gap.targets,
): ReadinessScorerGapContext {
  return {
    startFrame: gap.startFrame,
    endFrame: gap.endFrame,
    frameCount: gap.endFrame - gap.startFrame + 1,
    endsWithContact: gap.endsWithContact,
    scorerTargets,
    proposalTargets: gap.targets,
    ...(gap.nextImpact === undefined
      ? {}
      : { nextImpact: gap.nextImpact }),
  };
}

export const READINESS_FEATURE_NAMES = [
  ...READINESS_BASE_FEATURE_NAMES.slice(1),
  "out:duration",
  "out:duration2",
  "out:next_impact",
  "out:next_impact_missing",
  "out:target_air",
  "out:missing_air",
  "out:target_speed",
  "out:missing_speed",
  "out:target_impact",
  "out:missing_impact",
  "out:target_elevation",
  "out:missing_elevation",
  "out:target_amplitude",
  "out:missing_amplitude",
  "out:target_grain",
  "out:missing_grain",
  "articulation:relative_x",
  "articulation:relative_y",
  "articulation:relative_vx",
  "articulation:relative_vy",
  "articulation:body_pose_relative",
  "articulation:sled_length",
  "articulation:body_length",
  "articulation:missing",
  "interaction:out_speed_x_entry_speed",
  "interaction:out_speed_x_state_speed",
  "interaction:out_speed_x_state_angle",
  "interaction:out_speed_x_duration",
  "interaction:out_air_x_entry_air",
  "interaction:out_air_x_state_angle",
  "interaction:out_air_x_duration",
  "interaction:entry_air_x_duration",
  "interaction:entry_speed_x_state_speed",
] as const;

export function readinessFeatureVector(
  input: NextArcReadinessInput,
): number[] {
  validateInput(input);
  const incoming = catchabilityState(input.incomingBoundary);
  const outgoing = input.outgoingGap;
  const entryTargets = entryProposalTargets(input.incomingGap, outgoing);
  const entryModelContext = {
    nextGapTargets: entryTargets,
    nextGapFrameCount: input.incomingGap.frameCount,
    generatorPolicyId: input.generatorPolicyId,
  };
  const base = readinessBaseFeatureVector(
    incoming,
    {
      proposalTargets: entryModelContext.nextGapTargets,
      incomingGapFrameCount: entryModelContext.nextGapFrameCount,
    },
  ).slice(1);
  const outgoingTargets = outgoing?.scorerTargets ?? {};
  const outgoingDuration = clamp(
    Math.log(Math.max(1, outgoing?.frameCount ?? 32) / 32),
    -2,
    2,
  );
  const nextImpact = centeredTarget(input.incomingGap.nextImpact);
  const targetAir = targetPair(outgoingTargets.air);
  const targetSpeed = targetPair(outgoingTargets.speed);
  const targetImpact = targetPair(outgoingTargets.impact);
  const targetElevation = targetPair(outgoingTargets.elevation);
  const targetAmplitude = targetPair(outgoingTargets.amplitude);
  const targetGrain = targetPair(outgoingTargets.grain);
  const articulation = articulationFeatures(
    input.incomingBoundary.projectedContact,
  );
  const entryAir = centeredTarget(entryTargets.air);
  const entrySpeed = centeredTarget(entryTargets.speed);
  const stateSpeed = clamp((incoming.speed - 9) / 3, -3, 3);
  const stateAngle = clamp(
    ((incoming.comAngleDeg ?? 0) - 10) / 20,
    -3,
    3,
  );
  const features = [
    ...base,
    outgoingDuration,
    outgoingDuration * outgoingDuration,
    nextImpact,
    input.incomingGap.nextImpact === undefined ? 1 : 0,
    ...targetAir,
    ...targetSpeed,
    ...targetImpact,
    ...targetElevation,
    ...targetAmplitude,
    ...targetGrain,
    ...articulation,
    targetSpeed[0] * entrySpeed,
    targetSpeed[0] * stateSpeed,
    targetSpeed[0] * stateAngle,
    targetSpeed[0] * outgoingDuration,
    targetAir[0] * entryAir,
    targetAir[0] * stateAngle,
    targetAir[0] * outgoingDuration,
    entryAir * outgoingDuration,
    entrySpeed * stateSpeed,
  ];
  if (
    features.length !== READINESS_FEATURE_NAMES.length ||
    features.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(`invalid readiness feature vector`);
  }
  return features;
}

export function entryProposalTargets(
  incomingGap: Pick<
    ReadinessScorerGapContext,
    "proposalTargets" | "scorerTargets"
  >,
  outgoingGap: Pick<
    ReadinessScorerGapContext,
    "proposalTargets"
  > | null = null,
): AxisValues {
  const incomingTargets = { ...incomingGap.proposalTargets };
  const scorerImpact = incomingGap.scorerTargets.impact;
  if (scorerImpact === undefined) delete incomingTargets.impact;
  else incomingTargets.impact = scorerImpact;
  return composeArcProposalTargets(
    incomingTargets,
    outgoingGap?.proposalTargets ?? null,
  );
}

function catchabilityState(
  boundary: IncomingContactBoundary,
): ReadinessBoundaryState {
  const incoming = boundary.incoming;
  return {
    ...incoming,
    ...(typeof incoming.riderMounted === "boolean"
      ? { riderMounted: incoming.riderMounted }
      : {}),
    ...(typeof incoming.sledIntact === "boolean"
      ? { sledIntact: incoming.sledIntact }
      : {}),
  };
}

function targetPair(value: number | undefined): [number, number] {
  return value === undefined ? [0, 1] : [centeredTarget(value), 0];
}

function centeredTarget(value: number | undefined): number {
  return value === undefined ? 0 : clamp((value - 0.5) * 2, -2, 2);
}

function articulationFeatures(state: BallisticState): number[] {
  const features = ballisticArticulationFeatures(state);
  return features === null
    ? [0, 0, 0, 0, 0, 0, 0, 1]
    : [...features, 0];
}

function validateInput(input: NextArcReadinessInput): void {
  if (
    input.generatorPolicyId !== PRODUCTION_ARC_PROPOSAL_POLICY_ID
  ) {
    throw new Error(
      `readiness model does not represent policy ` +
        `${input.generatorPolicyId}`,
    );
  }
  validateGap(input.incomingGap, "incoming");
  if (input.outgoingGap !== null) validateGap(input.outgoingGap, "outgoing");
  const boundary = input.incomingBoundary;
  if (
    boundary.preContactFrame !== boundary.targetFrame - 1 ||
    boundary.incomingVelocityFrame !== boundary.targetFrame ||
    boundary.projectedContactFrame !== boundary.targetFrame
  ) {
    throw new Error(`readiness incoming boundary frames are misaligned`);
  }
  if (input.incomingGap.endFrame !== boundary.targetFrame) {
    throw new Error(
      `readiness incoming gap does not terminate at its incoming boundary`,
    );
  }
  if (!input.incomingGap.endsWithContact) {
    throw new Error(
      `readiness incoming gap must end at its incoming contact`,
    );
  }
  if (
    input.outgoingGap !== null &&
    (
      input.outgoingGap.startFrame !== boundary.targetFrame ||
      input.outgoingGap.endFrame <= boundary.targetFrame
    )
  ) {
    throw new Error(
      `readiness outgoing gap is not a forward interval from its incoming boundary`,
    );
  }
}

function validateGap(
  gap: ReadinessScorerGapContext,
  name: string,
): void {
  if (
    !Number.isSafeInteger(gap.startFrame) ||
    !Number.isSafeInteger(gap.endFrame) ||
    gap.endFrame < gap.startFrame ||
    gap.frameCount !== gap.endFrame - gap.startFrame + 1
  ) {
    throw new Error(`invalid ${name} readiness scorer gap`);
  }
  if (
    [...Object.values(gap.scorerTargets),
      ...Object.values(gap.proposalTargets)].some(
        (value) => value !== undefined && !Number.isFinite(value),
      )
  ) {
    throw new Error(`invalid ${name} readiness scorer targets`);
  }
  if (
    gap.nextImpact !== undefined &&
    !Number.isFinite(gap.nextImpact)
  ) {
    throw new Error(`invalid ${name} readiness next-impact target`);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
