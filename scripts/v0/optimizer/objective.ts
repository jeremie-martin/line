import { axisQualityForTargets, axisQualityFromErrors } from "../score.ts";
import { compileScopedEnv } from "../env_flags.ts";
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

/** As `objectiveEnvNum`, but distinguishes "unset" from "set to the default".
 *  The readiness exponent needs that distinction: unset means FOLLOW the future
 *  exponent, which is not the same as pinning it to 1. */
function objectiveEnvNumOrUndefined(name: string): number | undefined {
  const raw = (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.[name];
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0
    ? Math.min(4, Math.max(0.25, n))
    : undefined;
}

const OBJECTIVE_SETTLED_POWER_ENV = objectiveEnvNum(
  "LR_OBJECTIVE_SETTLED_POWER",
  1,
);
const OBJECTIVE_FUTURE_POWER_ENV = objectiveEnvNum(
  "LR_OBJECTIVE_FUTURE_POWER",
  1,
);
/**
 * Exponent on READINESS, separately from projected outgoing quality.
 *
 * These two terms answer different questions about the same future and are not
 * equally trustworthy. Projected quality is a near-exact physical prediction —
 * the ballistic boundary measures 0.50 px of contact-position error. Readiness
 * is a learned estimate of an arc that does not exist yet, validating at MSE
 * 0.0187 / r 0.787. Sharing one exponent fixes the rate at which the search
 * trades them, and there is no reason that rate should be 1:1.
 *
 * UNSET MEANS FOLLOW `objectiveFuturePower`, which is what the compiler did
 * before this knob existed, so the default tree is bit-identical — including on
 * the five specs where `objectiveBlendReadinessPowerForSpec` resolves 0.75.
 * That fallback is the whole reason this is infrastructure rather than a change:
 * decoupling the two exponents is a MEASURED arm, not a fix (see
 * docs/BALLISTIC_READINESS_DECISIONS.md §7.2).
 *
 * This restores `f438c43`, which introduced the same knob on the same argument
 * and was removed three hours later as collateral of the `a7bdf70` role-split
 * revert, having never been swept at any value.
 */
const OBJECTIVE_READINESS_POWER_ENV = objectiveEnvNumOrUndefined(
  "LR_OBJECTIVE_READINESS_POWER",
);
let objectiveSettledPower = OBJECTIVE_SETTLED_POWER_ENV;
let objectiveFuturePower = OBJECTIVE_FUTURE_POWER_ENV;
let objectiveReadinessPower = OBJECTIVE_READINESS_POWER_ENV ??
  OBJECTIVE_FUTURE_POWER_ENV;

type ProposalUtilityPowerConfig = {
  settledIncomingQualityPower?: number;
  futureQualityPower?: number;
  /** Omitted means "follow `futureQualityPower`". */
  readinessPower?: number;
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
  /* `objectiveFuturePower` is already normalized, and `normalizeObjectivePower`
   * is idempotent on its own range, so the fallback path cannot perturb it. */
  objectiveReadinessPower = normalizeObjectivePower(
    config.readinessPower ?? OBJECTIVE_READINESS_POWER_ENV ??
      objectiveFuturePower,
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
 * UNREPRODUCED LEAD (9da13c0, 2026-07-25, exact-kernel ballistic default): the
 * justification recorded at the time was that this is the asymmetry the
 * pre-refactor readiness carried on exactly these two axes, and that it damps
 * the alternating good/bad-catch oscillation the dense specs exhibit — "the one
 * with this term damps it, the one without amplifies it until the track cannot
 * continue". That was measured before the closed-form projection became the
 * default, and has not been re-measured since. Treat the mechanism as real and
 * the conclusion as a lead. See docs/BALLISTIC_READINESS_DECISIONS.md §9.
 *
 * `LR_PROJECTED_RECOVERABILITY=0` restores symmetric scoring.
 */
const RECOVERABLE_SIDE_WEIGHT = 0.5;

/** `enabled` is read once per scoring call rather than once per axis: reading
 *  `process.env` costs ~268 ns, which at one read per axis error was 7% of a
 *  whole compile. The flag is still sampled per call, so a caller that flips it
 *  between calls sees the change exactly as before. */
function recoverabilityWeightedError(
  axis: string,
  error: number,
  enabled: boolean,
): number {
  if (!enabled) return error;
  if (axis === "speed" && error > 0) return RECOVERABLE_SIDE_WEIGHT * error;
  if (axis === "air" && error < 0) return RECOVERABLE_SIDE_WEIGHT * error;
  return error;
}

/** Sampled once per compile: this is consulted once per scored gap, ~111,000
 *  times per compile, and a raw `process.env` read costs ~268 ns. */
const readProjectedRecoverability = compileScopedEnv(
  "LR_PROJECTED_RECOVERABILITY",
);

function projectedRecoverabilityEnabled(): boolean {
  return readProjectedRecoverability() !== "0";
}

export function scoreProjectedOutgoingAxes(
  targets: AxisValues,
  achieved: AxisValues,
): { quality: number; scoredAxisCount: number } {
  const errors: number[] = [];
  const recoverability = projectedRecoverabilityEnabled();
  /* `for...in` walks the same own string keys in the same insertion order as
   * `Object.entries`, without materializing an array of [key, value] pairs per
   * call — and this runs about 111,000 times per compile. */
  const targetValues = targets as Record<string, number | undefined>;
  const achievedValues = achieved as Record<string, number | undefined>;
  for (const axis in targetValues) {
    const target = targetValues[axis];
    if (target === undefined) continue;
    const value = achievedValues[axis];
    if (value === undefined) continue;
    errors.push(recoverabilityWeightedError(axis, value - target, recoverability));
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

/**
 * The quality half of `scoreProjectedOutgoingSurrogate`, for the knob-scoring
 * path that uses only that.
 *
 * That path called the surrogate 75,530 times per compile and threw away its
 * `value`, having first packed its three scalars into an aggregate object — with
 * a conditional spread, so two shapes — which the surrogate unpacked into an
 * `achieved` object for the axis loop to read back out. This takes the scalars,
 * builds the errors directly, and does not compute a `proposalUtility` the
 * caller recomputes anyway with the real settled quality.
 *
 * Identical by construction: the same three null-returns in the same order
 * (speed, air, elevation), the same `for...in` order over the targets, the same
 * `recoverabilityWeightedError`, and the same `axisQualityFromErrors`. When no
 * axis contributes an error the old code fell back to
 * `axisQualityForTargets(targets, achieved)`, whose error list is empty for
 * exactly the same reason — so `axisQualityFromErrors([])` is that same value.
 */
export function projectedOutgoingSurrogateQuality(
  outgoingTargets: AxisValues,
  meanSpeedPx: number,
  airFraction: number,
  elevation: number | undefined,
): number | null {
  let speedValue: number | undefined;
  if (outgoingTargets.speed !== undefined) {
    if (!Number.isFinite(meanSpeedPx)) return null;
    speedValue = speedPxToAuthored(meanSpeedPx);
  }
  let airValue: number | undefined;
  if (outgoingTargets.air !== undefined) {
    if (!Number.isFinite(airFraction)) return null;
    airValue = airFraction;
  }
  let elevationValue: number | undefined;
  if (outgoingTargets.elevation !== undefined) {
    if (elevation === undefined || !Number.isFinite(elevation)) return null;
    elevationValue = elevation;
  }

  const errors: number[] = [];
  const recoverability = projectedRecoverabilityEnabled();
  const targetValues = outgoingTargets as Record<string, number | undefined>;
  for (const axis in targetValues) {
    const target = targetValues[axis];
    if (target === undefined) continue;
    let value: number | undefined;
    if (axis === "speed") value = speedValue;
    else if (axis === "air") value = airValue;
    else if (axis === "elevation") value = elevationValue;
    if (value === undefined) continue;
    errors.push(recoverabilityWeightedError(axis, value - target, recoverability));
  }
  return axisQualityFromErrors(errors).axis_quality;
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
 * UNREPRODUCED LEAD (e142a44, 2026-07-25, exact-kernel ballistic default): the
 * saturation argument above is the constraint the pre-refactor readiness air-fit
 * encoded as `effectiveAirAsk` ("this clamp is what keeps the air-fit from
 * fighting catchability on short gaps"). The same formula survives as
 * `airDeliverabilityAsk` and is already applied by the generation lanes; it was
 * simply never applied where ranking scores air. The saturation claim has not
 * been re-measured on the current default. See
 * docs/BALLISTIC_READINESS_DECISIONS.md §9.
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
  /*
   * DO NOT re-associate this expression. It is three multiplications and looks
   * like it could be grouped any way at all, but the compiler's headline is
   * chaotically sensitive to the result's last bits: regrouping it as
   * settled x (projected x the four grading factors) x catchability - the role-split form deleted in a7bdf70 is algebraically
   * identical - verified, 61% of random inputs differ, max relative difference
   * 8.0e-16, about 3.6 ulp - and cost 14 headline points at N=48 (-15.33 ->
   * -29.34), seven times the seed-block SE. Ranking ties break differently and
   * the search takes a different path.
   *
   * The corollary is worth as much as the warning: a 14-point swing can be
   * produced with ZERO semantic content, so a single N=48 delta of that size
   * carries much less meaning than its confidence interval suggests.
   *
   * The three exponents are INDEPENDENT but the readiness one still FOLLOWS the
   * future one by default, so the shipped tree is the shared-exponent compiler
   * until a sweep says otherwise. See `OBJECTIVE_READINESS_POWER_ENV` for why
   * that default is deliberate, and contract §8.2 for the open defect it leaves
   * standing: the per-spec value comes from handoff.ts
   * `objectiveBlendReadinessPowerForSpec`, a gate accepted in 2026-07 when the
   * exponent reached readiness alone.
   */
  return (
    objectivePower(settledIncomingQuality, objectiveSettledPower) *
    objectivePower(projectedOutgoingQuality, objectiveFuturePower) *
    objectivePower(readiness.readiness, objectiveReadinessPower)
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
