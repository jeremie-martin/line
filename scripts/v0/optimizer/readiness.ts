/**
 * Canonical next-gap readiness composition.
 *
 * readiness =
 *   catchability
 *   × speed fit
 *   × air fit
 *   × impact feasibility
 *   × elevation fit
 *
 * Catchability is predicted by `catchability.ts`. This module owns the other
 * factors and their product. It does not own current-gap quality or proposal
 * utility; those are search-policy concerns in `objective.ts`.
 */

import { K_BOUNCE_LANDING } from "../../lib/detector.ts";
import {
  authoredSpeedToPx,
  impactToRedirArcPx,
  IMPACT,
  type AxisValues,
} from "../types.ts";
import {
  estimateCatchability,
  isValidCatchabilityState,
  PRODUCTION_CATCHABILITY_POLICY_ID,
  type CatchabilityState,
} from "./catchability.ts";

/** E-fold tolerance for next-gap mean-flight speed readiness, px/frame. */
export const READINESS_SPEED_SCALE_PXF = 0.75;
/** Excess speed is cheaper than insufficient speed. */
export const READINESS_SPEED_OVERSHOOT_WEIGHT = 0.5;
export const READINESS_IMPACT_ASK_RAMP_START = 0.2;
export const READINESS_IMPACT_ASK_RAMP_SPAN = 0.2;
export const READINESS_IMPACT_TARGETED_ASK =
  READINESS_IMPACT_ASK_RAMP_START +
  READINESS_IMPACT_ASK_RAMP_SPAN / 2;
export const READINESS_AIR_SCALE = 0.25;
export const READINESS_AIR_DEADBAND = 0.05;
export const READINESS_AIR_UNDERSHOOT_WEIGHT = 0.5;

let elevationReadinessEnabled = false;

export function setElevationReadinessEnabled(enabled: boolean): void {
  elevationReadinessEnabled = enabled;
}

export function isElevationReadinessEnabled(): boolean {
  return elevationReadinessEnabled;
}

export type ReadinessInput = {
  incoming: CatchabilityState;
  /** Scorer-compatible mean speed over the complete next gap. */
  meanSpeedPx?: number;
  /** Scorer-compatible airborne fraction over the complete next gap. */
  airFraction?: number;
  /** Inclusive scorer-frame count for the complete next gap. */
  gapFrameCount?: number;
  elevation?: number;
};

export type ReadinessScore = {
  readiness: number;
  catchability: number;
  speedFit: number;
  impactFeasibility: number;
  airFit: number;
  elevationFit: number;
};

export function scoreReadiness(
  input: ReadinessInput,
  nextTargets: AxisValues,
): ReadinessScore | null {
  const incoming = input?.incoming;
  if (
    incoming === undefined ||
    !isValidCatchabilityState(
      incoming.speed,
      incoming.comAngleDeg,
    )
  ) return null;
  const speedFit = speedFitFactor(input.meanSpeedPx, nextTargets);
  if (speedFit === null) return null;
  const airFit = airFitFactor(
    input.airFraction,
    input.gapFrameCount,
    nextTargets,
  );
  if (airFit === null) return null;
  const elevationFit = elevationFitFactor(input.elevation, nextTargets);
  if (elevationFit === null) return null;
  const catchability = estimateCatchability(incoming, {
    nextGapTargets: nextTargets,
    ...(input.gapFrameCount === undefined
      ? {}
      : { nextGapFrameCount: input.gapFrameCount }),
    generatorPolicyId: PRODUCTION_CATCHABILITY_POLICY_ID,
  }).pViableAttempt;
  const impactFeasibility = impactFeasibilityFactor(
    incoming,
    nextTargets,
  );
  return {
    readiness:
      catchability *
      speedFit *
      airFit *
      impactFeasibility *
      elevationFit,
    catchability,
    speedFit,
    impactFeasibility,
    airFit,
    elevationFit,
  };
}

export function effectiveAirAsk(
  ask: number,
  gapFrameCount: number,
): number {
  return Math.max(
    ask,
    Math.min(1, K_BOUNCE_LANDING / Math.max(1, gapFrameCount)),
  );
}

export function impactAskPressure(impactAsk: number): number {
  return smoothstep01(
    (impactAsk - READINESS_IMPACT_ASK_RAMP_START) /
      READINESS_IMPACT_ASK_RAMP_SPAN,
  );
}

export function impactFeasibility(
  speed: number,
  comAngleDeg: number,
  impactAsk: number,
): number {
  const maxTurnRad = Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION);
  const deliverableTurnRad = Math.min(
    (Math.max(0, comAngleDeg) * Math.PI) / 180,
    maxTurnRad,
  );
  return Math.min(
    1,
    Math.max(
      0,
      (speed * deliverableTurnRad) / impactToRedirArcPx(impactAsk),
    ),
  );
}

function speedFitFactor(
  meanSpeedPx: number | undefined,
  nextTargets: AxisValues,
): number | null {
  const target = nextTargets.speed;
  if (target === undefined) return 1;
  if (meanSpeedPx === undefined || !Number.isFinite(meanSpeedPx)) return null;
  const delta = meanSpeedPx - authoredSpeedToPx(target);
  const penalty = delta > 0
    ? delta * READINESS_SPEED_OVERSHOOT_WEIGHT
    : -delta;
  return Math.exp(-penalty / READINESS_SPEED_SCALE_PXF);
}

function airFitFactor(
  airFraction: number | undefined,
  gapFrameCount: number | undefined,
  nextTargets: AxisValues,
): number | null {
  const ask = nextTargets.air;
  if (ask === undefined) return 1;
  if (
    airFraction === undefined ||
    gapFrameCount === undefined ||
    !Number.isFinite(airFraction) ||
    !Number.isFinite(gapFrameCount)
  ) return null;
  const delta = airFraction - effectiveAirAsk(ask, gapFrameCount);
  const over = Math.max(0, delta - READINESS_AIR_DEADBAND);
  const under = Math.max(0, -delta - READINESS_AIR_DEADBAND);
  return Math.exp(
    -(over + READINESS_AIR_UNDERSHOOT_WEIGHT * under) /
      READINESS_AIR_SCALE,
  );
}

function elevationFitFactor(
  elevation: number | undefined,
  nextTargets: AxisValues,
): number | null {
  if (!elevationReadinessEnabled) return 1;
  const target = nextTargets.elevation;
  if (target === undefined) return 1;
  if (elevation === undefined || !Number.isFinite(elevation)) return null;
  const pressure = smoothstep01((target - 0.5) / 0.2);
  if (pressure <= 0) return 1;
  const delta = elevation - target;
  const penalty = delta < 0 ? -delta : delta * 0.5;
  const fit = Math.exp(-penalty / 0.2);
  return 1 + (fit - 1) * pressure;
}

function impactFeasibilityFactor(
  incoming: CatchabilityState,
  nextTargets: AxisValues,
): number {
  const impactAsk = nextTargets.impact;
  if (impactAsk === undefined || incoming.comAngleDeg === null) return 1;
  const pressure = impactAskPressure(impactAsk);
  if (pressure <= 0) return 1;
  const feasibility = impactFeasibility(
    incoming.speed,
    incoming.comAngleDeg,
    impactAsk,
  );
  return 1 + (feasibility - 1) * pressure;
}

function smoothstep01(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}
