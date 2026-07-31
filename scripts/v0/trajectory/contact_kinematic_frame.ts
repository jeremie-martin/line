/**
 * Explicitly separate the point used to place terrain from the CoM state that
 * the impact score measures.  A sled point is the correct geometric anchor;
 * the scored redirection is explicitly a CoM-velocity quantity.  Keeping both
 * in one labelled value prevents a contact proposal from silently using one
 * convention for placement and another for response.
 */
import {
  IMPACT,
  impactToRawPx,
  type AxisValues,
} from "../types.ts";
import type { PlanningState } from "./state.ts";
import type { TargetFrame } from "./target_frame.ts";

export type ContactKinematicFrame = {
  /** Physical point and local scale used to anchor proposed terrain. */
  anchor: TargetFrame;
  /** CoM state used by the scored redirection metric. */
  com: {
    headingDeg: number;
    speedPxPerFrame: number;
  };
  /** Null only when the contact did not author an impact requirement. */
  impact: {
    target: number;
    requestedRawImpactPx: number;
    requestedTurnDeg: number;
    catchableTurnDeg: number;
  } | null;
};

export type SurfaceIncidence = {
  /** Signed CoM-to-forward-surface heading difference. */
  signedIncidenceDeg: number;
  /** Positive magnitude of the normal velocity that a straight surface sees. */
  normalClosingSpeedPxPerFrame: number;
};

export function contactKinematicFrameFromPlanningState(
  state: PlanningState,
  anchor: TargetFrame,
  currentTargets: Pick<AxisValues, "impact">,
): ContactKinematicFrame {
  const speed = positive("state.speed", state.speed);
  const headingDeg = finite("state.velocityAngleDeg", state.velocityAngleDeg);
  const impact = currentTargets.impact;
  if (impact === undefined) {
    return { anchor, com: { headingDeg, speedPxPerFrame: speed }, impact: null };
  }
  const target = bounded("currentTargets.impact", impact, 0, 1);
  const requestedRawImpactPx = impactToRawPx(target);
  const requestedTurnDeg = degrees(requestedRawImpactPx / speed);
  const catchableTurnDeg = degrees(Math.min(
    requestedRawImpactPx / speed,
    Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION),
  ));
  return {
    anchor,
    com: { headingDeg, speedPxPerFrame: speed },
    impact: { target, requestedRawImpactPx, requestedTurnDeg, catchableTurnDeg },
  };
}

/**
 * Report the local collision incidence of a forward-oriented surface.  This is
 * descriptive only: the engine's multi-point collision response remains the
 * authority on achieved redirection.
 */
export function surfaceIncidence(
  frame: ContactKinematicFrame,
  surfaceAngleDeg: number,
): SurfaceIncidence {
  const signedIncidenceDeg = normalizeAngleDeg(
    frame.com.headingDeg - finite("surfaceAngleDeg", surfaceAngleDeg),
  );
  const normalClosingSpeedPxPerFrame = Math.abs(
    frame.com.speedPxPerFrame * Math.sin(radians(signedIncidenceDeg)),
  );
  return { signedIncidenceDeg, normalClosingSpeedPxPerFrame };
}

export function normalizeContactAngleDeg(value: number): number {
  return normalizeAngleDeg(value);
}

function degrees(radiansValue: number): number {
  return radiansValue * 180 / Math.PI;
}

function radians(degreesValue: number): number {
  return degreesValue * Math.PI / 180;
}

function normalizeAngleDeg(value: number): number {
  let out = value % 360;
  if (out > 180) out -= 360;
  if (out <= -180) out += 360;
  return out;
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
}

function bounded(name: string, value: number, lower: number, upper: number): number {
  if (!Number.isFinite(value) || value < lower || value > upper) {
    throw new Error(`${name} must be in [${lower}, ${upper}]`);
  }
  return value;
}
