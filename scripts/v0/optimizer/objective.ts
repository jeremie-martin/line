import { axisQualityForTargets, axisQualityFromErrors } from "../score.ts";
import {
  speedPxToAuthored,
  type AxisValues,
  type Gap,
} from "../types.ts";
import type { GapFit } from "../core/substrate.ts";
import {
  airFractionWithTerminalOccupancy,
  ballisticLaunchOf,
  projectBallisticGap,
  type BallisticFitFields,
  type BallisticGapProjection,
  type BallisticLaunchObservation,
} from "../core/ballistic_projection.ts";
import {
  nextContactGapAfter,
  PRODUCTION_ARC_PROPOSAL_POLICY_ID,
  successorScorerGapAfter,
} from "./arc_proposal.ts";
import {
  readinessScorerGapContext,
  type ReadinessScorerGapContext,
} from "./readiness_features.ts";
import { airDeliverabilityAsk } from "./air_policy.ts";
import {
  scoreReadiness,
  type ReadinessScore,
} from "./readiness.ts";

function objectiveEnvNum(name: string, fallback: number): number {
  const raw = (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.[name];
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0
    ? Math.min(4, Math.max(0.25, n))
    : fallback;
}

const OBJECTIVE_SETTLED_POWER_ENV = objectiveEnvNum(
  "LR_OBJECTIVE_SETTLED_POWER",
  1,
);
const OBJECTIVE_FUTURE_POWER_ENV = objectiveEnvNum(
  "LR_OBJECTIVE_FUTURE_POWER",
  1,
);
let objectiveSettledPower = OBJECTIVE_SETTLED_POWER_ENV;
let objectiveFuturePower = OBJECTIVE_FUTURE_POWER_ENV;

type ProposalUtilityPowerConfig = {
  settledIncomingQualityPower?: number;
  futureQualityPower?: number;
};

export function setProposalUtilityPowers(
  config: ProposalUtilityPowerConfig = {},
): void {
  objectiveSettledPower = normalizeObjectivePower(
    config.settledIncomingQualityPower ?? OBJECTIVE_SETTLED_POWER_ENV,
  );
  objectiveFuturePower = normalizeObjectivePower(
    config.futureQualityPower ?? OBJECTIVE_FUTURE_POWER_ENV,
  );
}

function normalizeObjectivePower(power: number): number {
  return Number.isFinite(power) && power > 0
    ? Math.min(4, Math.max(0.25, power))
    : 1;
}

export type ProjectedOutgoingGapScore = {
  projection: BallisticGapProjection;
  achieved: AxisValues;
  quality: number;
  scoredAxisCount: number;
};

export type GapObjectiveScore = ReadinessScore & {
  settledIncomingQuality: number;
  projectedOutgoingQuality: number;
  value: number;
};

/**
 * Projection is deterministic for one immutable launch packet, target frame,
 * and enabled output set. All compiler consumers share this memo.
 */
const outgoingProjectionCache = new WeakMap<
  BallisticLaunchObservation,
  Map<string, BallisticGapProjection | null>
>();

/** Exact incoming-gap axes on the scorer-owned interval. */
export function settledIncomingAxes(
  fit: Pick<GapFit, "achieved">,
): AxisValues {
  return fit.achieved;
}

export function scoreSettledIncomingQuality(
  targets: AxisValues,
  achieved: AxisValues,
): number {
  return axisQualityForTargets(targets, achieved).axis_quality;
}

/**
 * How recoverable an error on this axis is, by SIDE.
 *
 * The scorer is symmetric because it measures. A RANKER chooses, and the two
 * sides of a target are not equally recoverable by the arc that comes next:
 *
 *  - speed: arriving too FAST can be bled off by the following catch, arriving
 *    too slow cannot be manufactured. Half-weight the fast side.
 *  - air: predicted air ABOVE the ask is the recoverable selection lottery —
 *    the pool usually contains a shorter ride-out. Predicted air below the ask
 *    is a real miss, but the projection is an optimistic upper bound, so the
 *    slow side of that distribution is inflated. Half-weight the under side.
 *
 * This is the asymmetry the pre-refactor readiness carried on exactly these two
 * axes, in the same directions and for the same stated reasons, and it is what
 * damps the alternating good/bad-catch oscillation the dense specs exhibit.
 * Both compilers meet that oscillation; the one with this term damps it, the
 * one without amplifies it until the track cannot continue.
 *
 * `LR_PROJECTED_RECOVERABILITY=0` restores symmetric scoring.
 */
const RECOVERABLE_SIDE_WEIGHT = 0.5;

function recoverabilityWeightedError(
  axis: string,
  error: number,
): number {
  if (!projectedRecoverabilityEnabled()) return error;
  if (axis === "speed" && error > 0) return RECOVERABLE_SIDE_WEIGHT * error;
  if (axis === "air" && error < 0) return RECOVERABLE_SIDE_WEIGHT * error;
  return error;
}

function projectedRecoverabilityEnabled(): boolean {
  return (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.LR_PROJECTED_RECOVERABILITY !== "0";
}

export function scoreProjectedOutgoingAxes(
  targets: AxisValues,
  achieved: AxisValues,
): { quality: number; scoredAxisCount: number } {
  const errors: number[] = [];
  for (const [axis, target] of Object.entries(targets)) {
    if (target === undefined) continue;
    const value = (achieved as Record<string, number | undefined>)[axis];
    if (value === undefined) continue;
    errors.push(recoverabilityWeightedError(axis, value - target));
  }
  if (errors.length === 0) {
    const summary = axisQualityForTargets(targets, achieved);
    return { quality: summary.axis_quality, scoredAxisCount: summary.axis_count };
  }
  return {
    quality: axisQualityFromErrors(errors).axis_quality,
    scoredAxisCount: errors.length,
  };
}

export function scoreProjectedOutgoingSurrogate(
  settledIncomingQuality: number,
  outgoingTargets: AxisValues,
  aggregate: {
    meanSpeedPx: number;
    airFraction: number;
    elevation?: number;
  },
): { projectedOutgoingQuality: number; value: number } | null {
  const achieved: AxisValues = {};
  if (outgoingTargets.speed !== undefined) {
    if (!Number.isFinite(aggregate.meanSpeedPx)) return null;
    achieved.speed = speedPxToAuthored(aggregate.meanSpeedPx);
  }
  if (outgoingTargets.air !== undefined) {
    if (!Number.isFinite(aggregate.airFraction)) return null;
    achieved.air = aggregate.airFraction;
  }
  if (outgoingTargets.elevation !== undefined) {
    if (
      aggregate.elevation === undefined ||
      !Number.isFinite(aggregate.elevation)
    ) return null;
    achieved.elevation = aggregate.elevation;
  }
  const projectedOutgoingQuality = scoreProjectedOutgoingAxes(
    outgoingTargets,
    achieved,
  ).quality;
  return {
    projectedOutgoingQuality,
    value: proposalUtility(
      settledIncomingQuality,
      projectedOutgoingQuality,
      { readiness: 1 },
    ),
  };
}

export function scorerTargetsForGap(
  gap: Gap,
  gapAxisTargets?: readonly AxisValues[],
): AxisValues {
  return gapAxisTargets?.[gap.index] ?? gap.targets;
}

export function scorerGapContext(
  gap: Gap,
  gapAxisTargets?: readonly AxisValues[],
): ReadinessScorerGapContext {
  return readinessScorerGapContext(
    gap,
    scorerTargetsForGap(gap, gapAxisTargets),
  );
}

/**
 * Complete the scorer-compatible outgoing gap of one already proposed arc.
 * This is not readiness: it scores the gap shaped by that arc.
 */
export function projectOutgoingScorerGap(
  fit: GapFit | BallisticFitFields,
  outgoingGap: Gap,
  gapAxisTargets?: readonly AxisValues[],
): ProjectedOutgoingGapScore | null {
  const launch = ballisticLaunchOf(fit);
  if (
    launch === undefined ||
    launch.gapStartFrame !== outgoingGap.startFrame
  ) return null;
  const targets = scorerTargetsForGap(outgoingGap, gapAxisTargets);
  const includeElevation = targets.elevation !== undefined;
  const includeAmplitude = targets.amplitude !== undefined;
  const cacheKey = [
    outgoingGap.endFrame,
    outgoingGap.endsWithContact ? 1 : 0,
    includeElevation ? 1 : 0,
    includeAmplitude ? 1 : 0,
  ].join(":");
  let launchCache = outgoingProjectionCache.get(launch);
  if (launchCache === undefined) {
    launchCache = new Map();
    outgoingProjectionCache.set(launch, launchCache);
  }
  let projection = launchCache.get(cacheKey);
  if (projection === undefined) {
    projection = projectBallisticGap(launch, outgoingGap.endFrame, {
      includeElevation,
      includeAmplitude,
    });
    launchCache.set(cacheKey, projection);
  }
  if (projection === null) return null;
  if (
    (targets.elevation !== undefined && projection.elevation === null) ||
    (targets.amplitude !== undefined && projection.amplitude === null)
  ) return null;
  const achieved: AxisValues = {
    speed: speedPxToAuthored(projection.meanSpeedPx),
    /*
     * The unbuilt terminal catch is not part of the physical projection.
     * Search uses the explicit exact-authored-contact convention as its causal
     * scorer proxy; actual accepted catches may occur at target -1/0/+1 and
     * remain authoritative in exact evaluation.
     */
    air: airFractionWithTerminalOccupancy(
      projection,
      !outgoingGap.endsWithContact,
    ),
    ...(projection.elevation === null
      ? {}
      : { elevation: projection.elevation }),
    ...(projection.amplitude === null
      ? {}
      : { amplitude: projection.amplitude }),
  };
  const quality = scoreProjectedOutgoingAxes(
    projectedOutgoingTargets(targets, projection.frameCount),
    achieved,
  );
  return {
    projection,
    achieved,
    quality: quality.quality,
    scoredAxisCount: quality.scoredAxisCount,
  };
}

/**
 * Targets the projected outgoing gap is scored against.
 *
 * The scorer will grade the realized air fraction against the raw authored ask,
 * so scoring the projection against that ask is the faithful thing to do. But a
 * landing needs `K_BOUNCE_LANDING` airborne frames, so on a short gap every
 * air fraction below `K / frameCount` is PHYSICALLY UNDELIVERABLE, and asking
 * for one makes the air term saturate for every candidate at once. Because
 * `axisQualityForTargets` pools axes through one RMS, a saturated air error
 * swamps the speed and impact differences — the ranking goes blind to the axes
 * it could still act on, exactly on the dense specs where gaps are shortest.
 *
 * This is the constraint the pre-refactor readiness air-fit encoded as
 * `effectiveAirAsk`, whose comment was explicit: "this clamp is what keeps the
 * air-fit from fighting catchability on short gaps". The same formula survives
 * as `airDeliverabilityAsk` and is already applied by the generation lanes; it
 * was simply never applied where ranking scores air.
 *
 * `LR_PROJECTED_AIR_DELIVERABLE=0` restores the raw ask for A/B.
 */
function projectedOutgoingTargets(
  targets: AxisValues,
  frameCount: number,
): AxisValues {
  if (targets.air === undefined || !projectedAirDeliverableEnabled()) return targets;
  return { ...targets, air: airDeliverabilityAsk(targets.air, frameCount) };
}

function projectedAirDeliverableEnabled(): boolean {
  return (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.LR_PROJECTED_AIR_DELIVERABLE !== "0";
}

/**
 * Readiness starts at the outgoing projection's terminal contact and predicts
 * the unbuilt arc there. `readinessOutgoingGap` belongs to that future arc.
 */
export function scoreNextArcReadiness(
  outgoingProjection: BallisticGapProjection,
  incomingGap: Gap,
  readinessOutgoingGap: Gap | null,
  gapAxisTargets?: readonly AxisValues[],
): ReadinessScore {
  if (!incomingGap.endsWithContact) {
    throw new Error(
      `next-arc readiness requires an incoming gap ending at a contact`,
    );
  }
  return scoreReadiness({
    incomingBoundary: outgoingProjection.boundary,
    incomingGap: scorerGapContext(incomingGap, gapAxisTargets),
    outgoingGap: readinessOutgoingGap === null
      ? null
      : scorerGapContext(readinessOutgoingGap, gapAxisTargets),
    generatorPolicyId: PRODUCTION_ARC_PROPOSAL_POLICY_ID,
  });
}

/**
 * Canonical candidate objective. Each temporal layer appears exactly once.
 */
export function scoreCandidateProposal(
  fit: GapFit & BallisticFitFields,
  incomingGap: Gap,
  gaps: readonly Gap[],
  gapAxisTargets?: readonly AxisValues[],
): GapObjectiveScore | null {
  if (!incomingGap.endsWithContact) return null;
  const outgoingGap = successorScorerGapAfter(incomingGap, gaps);
  if (outgoingGap === null) return null;
  const settledIncomingQuality = scoreSettledIncomingQuality(
    scorerTargetsForGap(incomingGap, gapAxisTargets),
    settledIncomingAxes(fit),
  );
  const projectedOutgoing = projectOutgoingScorerGap(
    fit,
    outgoingGap,
    gapAxisTargets,
  );
  if (projectedOutgoing === null) return null;
  const readiness = outgoingGap.endsWithContact
    ? scoreNextArcReadiness(
      projectedOutgoing.projection,
      outgoingGap,
      successorScorerGapAfter(outgoingGap, gaps),
      gapAxisTargets,
    )
    : neutralReadinessScore();
  return {
    ...readiness,
    settledIncomingQuality,
    projectedOutgoingQuality: projectedOutgoing.quality,
    value: proposalUtility(
      settledIncomingQuality,
      projectedOutgoing.quality,
      readiness,
    ),
  };
}

function neutralReadinessScore(): ReadinessScore {
  return {
    readiness: 1,
    catchability: 1,
    speedFit: 1,
    impactFeasibility: 1,
    airFit: 1,
    elevationFit: 1,
    airFitPredicted: 1,
  };
}

/** Search-policy value; deliberately separate from physical/model semantics. */
export function proposalUtility(
  settledIncomingQuality: number,
  projectedOutgoingQuality: number,
  readiness: Pick<ReadinessScore, "readiness">,
): number {
  return (
    objectivePower(settledIncomingQuality, objectiveSettledPower) *
    objectivePower(projectedOutgoingQuality, objectiveFuturePower) *
    objectivePower(readiness.readiness, objectiveFuturePower)
  );
}

function objectivePower(value: number, power: number): number {
  if (power === 1) return value;
  return Math.max(0, Math.min(1, value)) ** power;
}

export function nextContactGap(
  gap: Gap,
  gaps: readonly Gap[],
): Gap | null {
  return nextContactGapAfter(gap, gaps);
}

export function nextContactGapFromIndex(
  gaps: readonly Gap[],
  from: number,
): Gap | null {
  const index = nextContactGapIndex(gaps, from);
  return index < 0 ? null : gaps[index];
}

export function nextContactGapIndex(
  gaps: readonly Gap[],
  from: number,
): number {
  for (let i = Math.max(0, from | 0); i < gaps.length; i++) {
    if (gaps[i].endsWithContact) return i;
  }
  return -1;
}

/** Inclusive frame count of one scorer gap. */
export function scorerGapFrameCount(
  gap: Pick<Gap, "startFrame" | "endFrame">,
): number {
  return Math.max(1, gap.endFrame - gap.startFrame + 1);
}
