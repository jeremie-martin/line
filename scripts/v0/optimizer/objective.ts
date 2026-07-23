import { axisQualityForTargets } from "../score.ts";
import { K_BOUNCE_LANDING } from "../../lib/detector.ts";
import {
  authoredSpeedToPx,
  impactToRedirArcPx,
  IMPACT,
  netDyToElevation,
  type AxisValues,
  type Gap,
} from "../types.ts";
import type { GapFit } from "../core/substrate.ts";
import {
  propagateBallisticArrivalState,
  type RiderArrivalState,
} from "./arc_model.ts";
import { constraintStateFromReleaseArrival } from "../core/ballistic_micro_sim.ts";
import {
  isValidArrivalState,
  readinessCatchState,
  type ReadinessArrivalState,
} from "./readiness.ts";

/** E-fold tolerance for next-gap mean-flight speed readiness, in px/frame. */
export const OBJECTIVE_SPEED_SCALE_PXF = 0.75;
/** Too-fast mean-speed residuals are cheaper than too-slow residuals. */
export const OBJECTIVE_SPEED_OVERSHOOT_PENALTY_WEIGHT = 0.5;
export const OBJECTIVE_IMPACT_ASK_RAMP_START = 0.2;
export const OBJECTIVE_IMPACT_ASK_RAMP_SPAN = 0.2;
export const OBJECTIVE_IMPACT_TARGETED_ASK =
  OBJECTIVE_IMPACT_ASK_RAMP_START + OBJECTIVE_IMPACT_ASK_RAMP_SPAN / 2;
/** Air-fit exp scale, in airborne-fraction units (air ∈ [0,1]). */
export const OBJECTIVE_AIR_SCALE = 0.25;
/** Inert band around the (floor-clamped) air ask: prediction noise on the
 *  release frame / next-arc entry timing lives here; the term must not react
 *  to it (blast-radius discipline — inert where it has nothing to fix). */
export const OBJECTIVE_AIR_DEADBAND = 0.05;
/** Undershoot half-weight (mirror of speedFit's asymmetry, opposite side):
 *  overshoot is the recoverable selection lottery — full weight; predicted
 *  undershoot (already floor-clamped) is a real miss too, but the predicted
 *  air is an optimistic upper bound so the fast side of the error distribution
 *  is inflated — half weight. */
export const OBJECTIVE_AIR_UNDERSHOOT_WEIGHT = 0.5;

function objectiveEnvNum(name: string, fallback: number): number {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.[name];
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(4, Math.max(0.25, n)) : fallback;
}

const OBJECTIVE_CURRENT_QUALITY_POWER_ENV = objectiveEnvNum("LR_M64_OBJECTIVE_CURRENT_POWER", 1);
const OBJECTIVE_READINESS_POWER_ENV = objectiveEnvNum("LR_M75_OBJECTIVE_READINESS_POWER", 1);
let objectiveCurrentQualityPower = OBJECTIVE_CURRENT_QUALITY_POWER_ENV;
let objectiveReadinessPower = OBJECTIVE_READINESS_POWER_ENV;
let objectiveElevationReadiness = false;

type ObjectiveBlendPowerConfig = {
  currentQualityPower?: number;
  readinessPower?: number;
  elevationReadiness?: boolean;
};

export function setObjectiveBlendPowers(config: ObjectiveBlendPowerConfig = {}): void {
  objectiveCurrentQualityPower = normalizeObjectivePower(
    config.currentQualityPower ?? OBJECTIVE_CURRENT_QUALITY_POWER_ENV,
  );
  objectiveReadinessPower = normalizeObjectivePower(
    config.readinessPower ?? OBJECTIVE_READINESS_POWER_ENV,
  );
  objectiveElevationReadiness = config.elevationReadiness === true;
}

function normalizeObjectivePower(power: number): number {
  return Number.isFinite(power) && power > 0 ? Math.min(4, Math.max(0.25, power)) : 1;
}

export type ObjectiveArrivalState =
  & Pick<ReadinessArrivalState, "speed" | "comAngleDeg">
  & Partial<ReadinessArrivalState>
  // Mean speed over the predicted flight to the next contact (trapezoidal of launch+arrival).
  // The authored speed target is a mean-of-flight; this is the apples-to-apples statistic for
  // speedFit. Absent on call sites built from a single catch-instant state (they fall back).
  & {
    meanSpeed?: number;
    /** Predicted airborne-frame fraction over the NEXT contact gap (the
     *  statistic core/measure.ts measureAir scores), derived from the release
     *  frame and the next gap's window — zero extra sim. Absent on call sites
     *  without release timing (they fall back to airFit = 1). */
    nextAir?: number;
    /** Next contact gap frame count (endFrame − startFrame + 1), for the
     *  detector-floor clamp on the air ask. Present iff `nextAir` is. */
    nextGapFrames?: number;
    /** Predicted next-gap elevation from the ballistic release suffix. */
    nextElevation?: number;
  };

export type NextGapReadinessScore = {
  readiness: number;
  catchability: number;
  speedFit: number;
  impactFeasibility: number;
  airFit: number;
  elevationFit: number;
};

export type GapObjectiveScore = NextGapReadinessScore & {
  currentQuality: number;
  value: number;
};

export function scoreCurrentTargetQuality(targets: AxisValues, achieved: AxisValues): number {
  return axisQualityForTargets(targets, achieved).axis_quality;
}

export function scoreNextTargetReadiness(
  arrival: ObjectiveArrivalState,
  nextTargets: AxisValues,
): NextGapReadinessScore | null {
  if (!isValidArrivalState(arrival.speed, arrival.comAngleDeg)) {
    return null;
  }
  const catchability = readinessCatchState(arrival);
  const speedFit = speedFitFactor(arrival.meanSpeed ?? arrival.speed, nextTargets);
  const impactFeasibility = impactFeasibilityFactor(arrival, nextTargets);
  const airFit = airFitFactor(arrival, nextTargets);
  const elevationFit = elevationFitFactor(arrival, nextTargets);
  return {
    readiness: catchability * speedFit * impactFeasibility * airFit * elevationFit,
    catchability,
    speedFit,
    impactFeasibility,
    airFit,
    elevationFit,
  };
}

export function scoreGapObjectiveForTargets(
  currentTargets: AxisValues,
  currentAxes: AxisValues,
  arrival: ObjectiveArrivalState,
  nextTargets: AxisValues,
): GapObjectiveScore | null {
  const currentQuality = scoreCurrentTargetQuality(currentTargets, currentAxes);
  return scoreGapObjectiveWithCurrentQuality(currentQuality, arrival, nextTargets);
}

export function scoreGapObjectiveWithCurrentQuality(
  currentQuality: number,
  arrival: ObjectiveArrivalState,
  nextTargets: AxisValues,
): GapObjectiveScore | null {
  const readiness = scoreNextTargetReadiness(arrival, nextTargets);
  if (readiness === null) return null;
  return {
    ...readiness,
    currentQuality,
    value: objectiveBlendValue(currentQuality, readiness.readiness),
  };
}

function objectiveBlendValue(currentQuality: number, readiness: number): number {
  return objectivePower(currentQuality, objectiveCurrentQualityPower) *
    objectivePower(readiness, objectiveReadinessPower);
}

function objectivePower(value: number, power: number): number {
  if (power === 1) return value;
  return Math.max(0, Math.min(1, value)) ** power;
}

export function nextContactGap(gap: Gap, gaps: readonly Gap[]): Gap | null {
  return nextContactGapFromIndex(gaps, gap.index + 1);
}

export function nextContactGapFromIndex(gaps: readonly Gap[], from: number): Gap | null {
  const index = nextContactGapIndex(gaps, from);
  return index < 0 ? null : gaps[index];
}

export function nextContactGapIndex(gaps: readonly Gap[], from: number): number {
  for (let i = Math.max(0, from | 0); i < gaps.length; i++) {
    if (gaps[i].endsWithContact) return i;
  }
  return -1;
}

export function frontierReadinessFromFit(
  fit: GapFit,
  nextGap: Gap,
): NextGapReadinessScore | null {
  const arrival = predictArrivalAtNextContact(fit, nextGap);
  return arrival === null ? null : scoreNextTargetReadiness(arrival, nextGap.targets);
}

export function predictArrivalAtNextContact(
  fit: Pick<GapFit, "releaseArrivalState">,
  nextGap: Pick<Gap, "startFrame" | "endFrame">,
): ObjectiveArrivalState | null {
  const rel = fit.releaseArrivalState;
  if (rel === undefined || !rel.airborne) return null;
  const dt = nextGap.endFrame - rel.frame;
  if (dt <= 0) return null;
  const constraintState = constraintStateFromReleaseArrival(rel);
  const launch: RiderArrivalState = {
    x: rel.x,
    y: rel.y,
    vx: rel.vx,
    vy: rel.vy,
    speed: Math.hypot(rel.vx, rel.vy),
    comAngleDeg: null,
    sledPoseDeg: rel.sledPoseDeg,
    sledPoseRateDegPerFrame: rel.sledPoseRateDegPerFrame,
    ...(constraintState === undefined
      ? {}
      : { constraintState }),
  };
  const arrived = propagateBallisticArrivalState(launch, dt);
  const nextElevation = predictedNextGapElevation(launch, rel.frame, nextGap);
  return {
    speed: arrived.speed,
    comAngleDeg: arrived.comAngleDeg,
    meanSpeed: (launch.speed + arrived.speed) / 2,
    nextAir: predictedNextGapAir(rel.frame, nextGap),
    nextGapFrames: nextGapFrameCount(nextGap),
    ...(nextElevation === null ? {} : { nextElevation }),
  };
}

function predictedNextGapElevation(
  launch: RiderArrivalState,
  releaseFrame: number,
  nextGap: Pick<Gap, "startFrame" | "endFrame">,
): number | null {
  const startFrame = Math.max(nextGap.startFrame, releaseFrame);
  const startDt = startFrame - releaseFrame;
  const endDt = nextGap.endFrame - releaseFrame;
  if (endDt <= startDt) return null;
  const start = propagateBallisticArrivalState(launch, startDt);
  const end = propagateBallisticArrivalState(launch, endDt);
  return netDyToElevation(end.y - start.y, start.speed, nextGap.endFrame - startFrame);
}

/** Frame count of a gap window — the denominator of measureAir's
 *  airborne-fraction statistic ([startFrame, endFrame] inclusive). */
export function nextGapFrameCount(nextGap: Pick<Gap, "startFrame" | "endFrame">): number {
  return Math.max(1, nextGap.endFrame - nextGap.startFrame + 1);
}

/** Predicted airborne-frame fraction over the next contact gap, given the
 *  release (geometric arc exit) frame: the rider rides the current arc until
 *  `releaseFrame`, is ballistic from there to the next contact at
 *  `nextGap.endFrame` (minimal-simulation rule — no sim). This is an optimistic
 *  upper bound: the next gap's own terminal-arc entry shaves a few tail frames,
 *  which the deadband absorbs. */
export function predictedNextGapAir(
  releaseFrame: number,
  nextGap: Pick<Gap, "startFrame" | "endFrame">,
): number {
  const frames = nextGapFrameCount(nextGap);
  const air = (nextGap.endFrame - Math.max(nextGap.startFrame, releaseFrame)) / frames;
  return Math.max(0, Math.min(1, air));
}

/** Detector-floor clamp on an air ask: a landing needs ≥ K_BOUNCE_LANDING
 *  airborne frames, so air fractions below K/gapFrames are physically
 *  undeliverable — never demand the impossible (this clamp is what keeps the
 *  air-fit from fighting catchability on short gaps). */
export function effectiveAirAsk(ask: number, nextGapFrames: number): number {
  return Math.max(ask, Math.min(1, K_BOUNCE_LANDING / Math.max(1, nextGapFrames)));
}

function speedFitFactor(speed: number, nextTargets: AxisValues): number {
  const target = nextTargets.speed;
  if (target === undefined) return 1;
  // `speed` is the predicted MEAN-of-flight where available (the statistic the target authors),
  // else the catch-instant fallback. Asymmetric: too-fast is half-penalized — any residual
  // overshoot bias inflates the apparent fast side, and excess speed can be bled; too-slow full.
  // NOTE: this is the forward-looking READINESS speed fit, NOT a reproduction of the scorer's
  // speed axis. It is intentionally asymmetric and on a tighter scale (OBJECTIVE_SPEED_SCALE_PXF)
  // than the scorer's symmetric AXIS_QUALITY_TOLERANCE — it ranks a candidate's fitness to FLY
  // INTO the next gap, not its scored speed error. The two surfaces are meant to differ.
  const d = speed - authoredSpeedToPx(target);
  const penalty = d > 0 ? d * OBJECTIVE_SPEED_OVERSHOOT_PENALTY_WEIGHT : -d;
  return Math.exp(-penalty / OBJECTIVE_SPEED_SCALE_PXF);
}

/** Forward-looking READINESS air fit (M4): how well does this candidate's
 *  release timing set up the NEXT gap's air ask? Like speedFit this is NOT a
 *  reproduction of the scorer's air axis — it ranks a candidate's fitness to
 *  FLY INTO the next gap. Gating (blast-radius discipline): inert (1) when the
 *  next gap has no air target or the call site carries no release timing
 *  (`nextAir` absent), inert inside the deadband, and the ask is clamped at
 *  the detector floor so the term never demands the impossible on short gaps.
 *  Asymmetric by the physics: overshoot (predicted air > ask) is the
 *  recoverable selection lottery — full weight; undershoot half (see
 *  OBJECTIVE_AIR_UNDERSHOOT_WEIGHT). Plain exp, no sigmoid (the plateau
 *  gradient is signal — falsified-shapes note in aim.ts). */
function airFitFactor(
  arrival: Pick<ObjectiveArrivalState, "nextAir" | "nextGapFrames">,
  nextTargets: AxisValues,
): number {
  const ask = nextTargets.air;
  const predicted = arrival.nextAir;
  const gapFrames = arrival.nextGapFrames;
  if (ask === undefined || predicted === undefined || gapFrames === undefined) return 1;
  const d = predicted - effectiveAirAsk(ask, gapFrames);
  const over = Math.max(0, d - OBJECTIVE_AIR_DEADBAND);
  const under = Math.max(0, -d - OBJECTIVE_AIR_DEADBAND);
  const penalty = over + OBJECTIVE_AIR_UNDERSHOOT_WEIGHT * under;
  return Math.exp(-penalty / OBJECTIVE_AIR_SCALE);
}

function elevationFitFactor(
  arrival: Pick<ObjectiveArrivalState, "nextElevation">,
  nextTargets: AxisValues,
): number {
  if (!objectiveElevationReadiness) return 1;
  const target = nextTargets.elevation;
  const predicted = arrival.nextElevation;
  if (target === undefined || predicted === undefined) return 1;
  const pressure = smoothstep01((target - 0.5) / 0.2);
  if (pressure <= 0) return 1;
  const d = predicted - target;
  const penalty = d < 0 ? -d : d * 0.5;
  const fit = Math.exp(-penalty / 0.2);
  return 1 + (fit - 1) * pressure;
}

function impactFeasibilityFactor(
  state: Pick<ObjectiveArrivalState, "speed" | "comAngleDeg">,
  nextTargets: AxisValues,
): number {
  // FEASIBILITY, not scored error: "can this arrival state deliver the next beat's
  // impact ask?", clamped to [0,1]. So OVER-delivering impact is free here (the scorer
  // penalizes overshoot separately and symmetrically). Low asks are blended in gradually:
  // tiny impact targets remain no-constraint, mid asks add partial pressure, and hard asks
  // use the full feasibility term. This intentionally diverges from the scorer's additive
  // equal-weight impact axis — it gates readiness, it does not reproduce the impact score.
  const impactAsk = nextTargets.impact;
  if (impactAsk === undefined || state.comAngleDeg === null) return 1;
  const pressure = impactAskPressure(impactAsk);
  if (pressure <= 0) return 1;
  const feasibility = impactFeasibility(state.speed, state.comAngleDeg, impactAsk);
  return 1 + (feasibility - 1) * pressure;
}

export function impactAskPressure(impactAsk: number): number {
  return smoothstep01(
    (impactAsk - OBJECTIVE_IMPACT_ASK_RAMP_START) /
      OBJECTIVE_IMPACT_ASK_RAMP_SPAN,
  );
}

/**
 * Core impact-feasibility math (shared single source of truth): can an arrival
 * at `speed` and absolute heading `comAngleDeg` (atan2(vy,vx), degrees) deliver
 * the redirArc the next beat's `impactAsk` demands, in [0,1]?
 *
 * The deliverable heading-change is bounded by the catchability cap
 * (asin(CATCHABLE_REDIR_FRACTION)) — the same ceiling impactCeiling /
 * impactFeasibilityBound apply. comAngleDeg can exceed that cap on steep dives;
 * without the clamp a near-vertical arrival over-credits feasibility toward 1
 * for a turn no catch can absorb. Callers own the min-ask gating before calling.
 */
export function impactFeasibility(speed: number, comAngleDeg: number, impactAsk: number): number {
  const maxTurnRad = Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION);
  const deliverableTurnRad = Math.min(
    (Math.max(0, comAngleDeg) * Math.PI) / 180,
    maxTurnRad,
  );
  return Math.min(
    1,
    Math.max(0, (speed * deliverableTurnRad) / impactToRedirArcPx(impactAsk)),
  );
}

function smoothstep01(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}
