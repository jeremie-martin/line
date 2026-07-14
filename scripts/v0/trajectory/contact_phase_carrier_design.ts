/** Fixed symmetric coverage screen for the phase-carrier local primitive. */
import type { ContactClosurePlacement } from "./contact_closure_design.ts";
import type { ContactPhaseCarrierControl } from "./contact_phase_carrier.ts";

export type ContactPhaseCarrierHypothesis =
  | "neutral"
  | "entry_turn_negative"
  | "entry_turn_positive"
  | "tail_turn_negative"
  | "tail_turn_positive";

export type ContactPhaseCarrierDesignEntry = {
  label: string;
  hypothesis: ContactPhaseCarrierHypothesis;
  placement: ContactClosurePlacement;
  turnMagnitudeDeg: number;
  control: ContactPhaseCarrierControl;
};

const PLACEMENTS: readonly ContactClosurePlacement[] = [
  { label: "center", targetTangentOffsetFrames: 0, targetNormalOffsetSledSpans: 0 },
  { label: "tangent_minus_half", targetTangentOffsetFrames: -0.5, targetNormalOffsetSledSpans: 0 },
  { label: "tangent_plus_half", targetTangentOffsetFrames: 0.5, targetNormalOffsetSledSpans: 0 },
  { label: "normal_minus_half", targetTangentOffsetFrames: 0, targetNormalOffsetSledSpans: -0.5 },
  { label: "normal_plus_half", targetTangentOffsetFrames: 0, targetNormalOffsetSledSpans: 0.5 },
];

/**
 * Keep phase lengths structural rather than duration-dependent: approach and
 * carrier are the local contact phase, while the short tail exists only to
 * separate later turning from the target contact.
 */
export function makeContactPhaseCarrierScreen(input: {
  turnMagnitudeDeg: number;
}): ContactPhaseCarrierDesignEntry[] {
  const magnitude = positive("turnMagnitudeDeg", input.turnMagnitudeDeg);
  const hypotheses: Array<{
    hypothesis: ContactPhaseCarrierHypothesis;
    entryAngleRelativeDeg: number;
    tailTurnDeg: number;
  }> = [
    { hypothesis: "neutral", entryAngleRelativeDeg: 0, tailTurnDeg: 0 },
    { hypothesis: "entry_turn_negative", entryAngleRelativeDeg: -magnitude, tailTurnDeg: 0 },
    { hypothesis: "entry_turn_positive", entryAngleRelativeDeg: magnitude, tailTurnDeg: 0 },
    { hypothesis: "tail_turn_negative", entryAngleRelativeDeg: 0, tailTurnDeg: -magnitude },
    { hypothesis: "tail_turn_positive", entryAngleRelativeDeg: 0, tailTurnDeg: magnitude },
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
      approachFrames: 1.5,
      carrierFrames: 2,
      tailTurnDeg: center.tailTurnDeg,
      tailFrames: 1,
    },
  })));
  const identities = new Set(entries.map((entry) => JSON.stringify(entry.control)));
  if (identities.size !== entries.length) throw new Error("phase-carrier screen must contain unique controls");
  return entries;
}

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
}
