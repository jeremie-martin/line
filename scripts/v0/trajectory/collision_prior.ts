/**
 * Analytic collision-orientation priors for study-only transition geometry.
 *
 * This module deliberately derives a named physical hypothesis from authored
 * current-contact speed/impact and the incoming target frame. It does not read
 * arc-placement code, case IDs, attempt indices, or historical geometry.
 */
import {
  IMPACT,
  authoredSpeedToPx,
  impactToRedirArcPx,
  type AxisValues,
} from "../types.ts";
import type { IncomingTargetFrame } from "./envelope/model.ts";

/** Portion of an impact's required turn assigned to the incoming terrain angle. */
export const BRAKING_IMPACT_ENTRY_TURN_SHARE = 0.75;

export type CollisionEntryPrior = {
  kind: "target-neutral" | "one-frame-lag-neutral" | "braking-impact";
  targetTangentOffsetFrames: number;
  entryAngleRelativeDeg: number;
  diagnostics: {
    targetSpeedPxPerFrame: number | null;
    brakingSpeedDeficitPxPerFrame: number | null;
    impact: number | null;
    requiredRedirectionTurnDeg: number | null;
    entryTurnShare: number | null;
  };
};

/**
 * Default contact placement is the target reference itself. A target state is
 * already the predicted contact-frame sled state; adding an unexplained
 * speed-frame lag is not a neutral physical coordinate.
 */
export function targetNeutralEntryPrior(): CollisionEntryPrior {
  return {
    kind: "target-neutral",
    targetTangentOffsetFrames: 0,
    entryAngleRelativeDeg: 0,
    diagnostics: {
      targetSpeedPxPerFrame: null,
      brakingSpeedDeficitPxPerFrame: null,
      impact: null,
      requiredRedirectionTurnDeg: null,
      entryTurnShare: null,
    },
  };
}

/** Historical comparator only; it preserves the first study's arbitrary lag. */
export function oneFrameLagNeutralEntryPrior(): CollisionEntryPrior {
  return {
    ...targetNeutralEntryPrior(),
    kind: "one-frame-lag-neutral",
    targetTangentOffsetFrames: -1,
  };
}

/**
 * If the current authored mean speed asks the incoming rider to brake and the
 * current contact asks for impact, incline the incoming surface against the
 * motion by a bounded share of the required redirection. The remaining turn is
 * deliberately left to collision-local and post-contact dynamics. When either
 * axis is absent, or the contact is not a brake, this reduces exactly to the
 * target-neutral prior rather than inventing a sign.
 */
export function brakingImpactEntryPrior(
  frame: IncomingTargetFrame,
  currentTargets: AxisValues,
): CollisionEntryPrior {
  const neutral = targetNeutralEntryPrior();
  const speedTarget = currentTargets.speed;
  const impact = currentTargets.impact;
  if (speedTarget === undefined || impact === undefined) return neutral;
  const targetSpeedPxPerFrame = authoredSpeedToPx(speedTarget);
  const incomingSpeed = requirePositive("frame.speedPxPerFrame", frame.speedPxPerFrame);
  const brakingSpeedDeficitPxPerFrame = incomingSpeed - targetSpeedPxPerFrame;
  // `redirArc` is speed times an angular deflection. Invert it in radians,
  // then apply the physical catchability ceiling in that same angular unit.
  // Applying `asin` to the raw ratio would be dimensionally wrong and would
  // overstate small deflections while saturating them prematurely.
  const requiredRedirectionTurnDeg = Math.min(
    impactToRedirArcPx(impact) / incomingSpeed,
    Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION),
  ) * 180 / Math.PI;
  if (!(brakingSpeedDeficitPxPerFrame > 0) || !(requiredRedirectionTurnDeg > 0)) {
    return {
      ...neutral,
      kind: "braking-impact",
      diagnostics: {
        targetSpeedPxPerFrame,
        brakingSpeedDeficitPxPerFrame,
        impact,
        requiredRedirectionTurnDeg,
        entryTurnShare: BRAKING_IMPACT_ENTRY_TURN_SHARE,
      },
    };
  }
  return {
    kind: "braking-impact",
    targetTangentOffsetFrames: 0,
    entryAngleRelativeDeg: -BRAKING_IMPACT_ENTRY_TURN_SHARE * requiredRedirectionTurnDeg,
    diagnostics: {
      targetSpeedPxPerFrame,
      brakingSpeedDeficitPxPerFrame,
      impact,
      requiredRedirectionTurnDeg,
      entryTurnShare: BRAKING_IMPACT_ENTRY_TURN_SHARE,
    },
  };
}

function requirePositive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
}
