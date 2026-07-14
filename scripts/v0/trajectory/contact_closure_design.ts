/**
 * Fixed local-contact coverage screen.
 *
 * This is not an optimizer family. It maps a small, symmetric contact basin
 * on frozen prefixes before any outgoing support is attached. Every row is
 * defined in target-frame units and is independent of case identity, duration,
 * legacy geometry, or a prior study result.
 */
import { IMPACT, impactToRedirArcPx, type AxisValues } from "../types.ts";
import type { ContactClosureControl } from "./contact_closure.ts";
import type { TargetFrame } from "./target_frame.ts";

export type ContactClosureHypothesis =
  | "neutral"
  | "entry_turn_negative"
  | "entry_turn_positive"
  | "collision_turn_negative"
  | "collision_turn_positive";

export type ContactClosurePlacement = {
  label: "center" | "tangent_minus_half" | "tangent_plus_half" | "normal_minus_half" | "normal_plus_half";
  targetTangentOffsetFrames: number;
  targetNormalOffsetSledSpans: number;
};

export type ContactClosureDesignEntry = {
  label: string;
  hypothesis: ContactClosureHypothesis;
  placement: ContactClosurePlacement;
  /** A target-frame physical scale, not a fitted or selected turn. */
  turnMagnitudeDeg: number;
  control: ContactClosureControl;
};

const PLACEMENTS: readonly ContactClosurePlacement[] = [
  { label: "center", targetTangentOffsetFrames: 0, targetNormalOffsetSledSpans: 0 },
  { label: "tangent_minus_half", targetTangentOffsetFrames: -0.5, targetNormalOffsetSledSpans: 0 },
  { label: "tangent_plus_half", targetTangentOffsetFrames: 0.5, targetNormalOffsetSledSpans: 0 },
  { label: "normal_minus_half", targetTangentOffsetFrames: 0, targetNormalOffsetSledSpans: -0.5 },
  { label: "normal_plus_half", targetTangentOffsetFrames: 0, targetNormalOffsetSledSpans: 0.5 },
];

/**
 * Derive a symmetric screen magnitude from the authored impact requirement.
 * It is the physically catchable angular redirection at the measured incoming
 * speed, with no speed-target gate or empirical share. The screen tests both
 * signs, so this magnitude does not encode a preferred terrain orientation.
 */
export function contactTurnScreenMagnitudeDeg(
  frame: TargetFrame,
  currentTargets: AxisValues,
): number {
  const impact = currentTargets.impact;
  if (impact === undefined) throw new Error("local contact-closure screen requires an authored current impact target");
  const speed = positive("frame.speedPxPerFrame", frame.speedPxPerFrame);
  const radians = Math.min(
    impactToRedirArcPx(impact) / speed,
    Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION),
  );
  const degrees = radians * 180 / Math.PI;
  if (!(degrees > 0) || !Number.isFinite(degrees)) {
    throw new Error("local contact-closure screen requires a positive finite impact turn magnitude");
  }
  return degrees;
}

/**
 * Five named turn allocations crossed with five one-factor target-frame
 * placements. The controls are unique by construction and intentionally make
 * no claim about which row should win.
 */
export function makeLocalContactClosureScreen(input: {
  turnMagnitudeDeg: number;
}): ContactClosureDesignEntry[] {
  const magnitude = positive("turnMagnitudeDeg", input.turnMagnitudeDeg);
  const hypotheses: Array<{
    hypothesis: ContactClosureHypothesis;
    entryAngleRelativeDeg: number;
    collisionTurnDeg: number;
  }> = [
    { hypothesis: "neutral", entryAngleRelativeDeg: 0, collisionTurnDeg: 0 },
    { hypothesis: "entry_turn_negative", entryAngleRelativeDeg: -magnitude, collisionTurnDeg: 0 },
    { hypothesis: "entry_turn_positive", entryAngleRelativeDeg: magnitude, collisionTurnDeg: 0 },
    { hypothesis: "collision_turn_negative", entryAngleRelativeDeg: 0, collisionTurnDeg: -magnitude },
    { hypothesis: "collision_turn_positive", entryAngleRelativeDeg: 0, collisionTurnDeg: magnitude },
  ];
  const entries = hypotheses.flatMap((center) => PLACEMENTS.map((placement) => ({
    label: `${center.hypothesis}_${placement.label}`,
    hypothesis: center.hypothesis,
    placement,
    turnMagnitudeDeg: magnitude,
    control: {
      targetTangentOffsetFrames: placement.targetTangentOffsetFrames,
      targetNormalOffsetSledSpans: placement.targetNormalOffsetSledSpans,
      entryAngleRelativeDeg: center.entryAngleRelativeDeg,
      preReachFrames: 2,
      collisionTurnDeg: center.collisionTurnDeg,
      localContinuationFrames: 2,
    },
  })));
  const identities = new Set(entries.map((entry) => JSON.stringify(entry.control)));
  if (identities.size !== entries.length) throw new Error("local contact-closure screen must contain unique controls");
  return entries;
}

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
}
