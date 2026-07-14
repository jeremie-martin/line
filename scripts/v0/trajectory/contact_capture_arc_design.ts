/**
 * Small predeclared calibration screen for the C1 capture-arc topology.
 *
 * The entries allocate the same impact-derived response between capture
 * incidence and continuous post-contact curvature. They are not source
 * defaults: this calibration screen exists only to falsify the representation
 * before a future V3 validation cohort is declared.
 */
import type { ContactKinematicFrame } from "./contact_kinematic_frame.ts";
import type { ContactCaptureArcControl } from "./contact_capture_arc.ts";

export type CaptureArcAllocation = "distributed" | "balanced" | "entry_loaded" | "entry_only";
export type CaptureArcPlacement = "at_target" | "half_frame_forward" | "one_frame_forward";
export type CaptureArcTurnOrientation = -1 | 1;

export type ContactCaptureArcDesignEntry = {
  label: string;
  hypothesis: CaptureArcAllocation;
  placement: { label: CaptureArcPlacement; targetPhaseOffsetFrames: number };
  turnOrientation: CaptureArcTurnOrientation;
  turnMagnitudeDeg: number;
  control: ContactCaptureArcControl;
};

const ALLOCATIONS: ReadonlyArray<{ hypothesis: CaptureArcAllocation; entryTurnShare: number }> = [
  { hypothesis: "distributed", entryTurnShare: 0 },
  { hypothesis: "balanced", entryTurnShare: 0.5 },
  // This row is descriptive of the closed calibration topology, not a source
  // choice. It must be validated on a future frozen cohort before promotion.
  { hypothesis: "entry_loaded", entryTurnShare: 0.75 },
  { hypothesis: "entry_only", entryTurnShare: 1 },
];

const PLACEMENTS: ReadonlyArray<{ label: CaptureArcPlacement; targetPhaseOffsetFrames: number }> = [
  { label: "at_target", targetPhaseOffsetFrames: 0 },
  { label: "half_frame_forward", targetPhaseOffsetFrames: 0.5 },
  { label: "one_frame_forward", targetPhaseOffsetFrames: 1 },
];

/**
 * The two structural durations are explicitly named instead of inferred from
 * a gap class: one local runway and a two-frame approach frame the six-frame
 * scorer horizon implemented by the primitive. The realized response is an
 * adaptive polyline approximation; only the capture boundary is C1.
 */
const APPROACH_FRAMES = 2;
const RUNWAY_FRAMES = 1;

export function makeContactCaptureArcScreen(
  frame: ContactKinematicFrame,
): ContactCaptureArcDesignEntry[] {
  return makeCaptureArcScreen(frame, [-1]);
}

/**
 * A new, fixed mirrored representation screen. It deliberately doubles the
 * historic one-sided 12-row menu rather than inferring bend sign from impact
 * magnitude. This is still a calibration/feasibility menu, never a source
 * selection policy.
 */
export function makeMirroredContactCaptureArcScreen(
  frame: ContactKinematicFrame,
): ContactCaptureArcDesignEntry[] {
  return makeCaptureArcScreen(frame, [-1, 1]);
}

function makeCaptureArcScreen(
  frame: ContactKinematicFrame,
  orientations: readonly CaptureArcTurnOrientation[],
): ContactCaptureArcDesignEntry[] {
  if (frame.impact === null) {
    throw new Error("contact capture-arc screen requires an authored impact target");
  }
  const turnMagnitudeDeg = positiveImpactTurn(frame.impact.catchableTurnDeg);
  const entries = orientations.flatMap((turnOrientation) => ALLOCATIONS.flatMap((allocation) =>
    PLACEMENTS.map((placement) => ({
      label: `${turnOrientation === -1 ? "negative" : "positive"}_${allocation.hypothesis}_${placement.label}`,
      hypothesis: allocation.hypothesis,
      placement,
      turnOrientation,
      turnMagnitudeDeg,
      control: {
        turnOrientation,
        targetPhaseOffsetFrames: placement.targetPhaseOffsetFrames,
        entryTurnShare: allocation.entryTurnShare,
        approachFrames: APPROACH_FRAMES,
        runwayFrames: RUNWAY_FRAMES,
      },
    })),
  ));
  if (new Set(entries.map((entry) => JSON.stringify(entry.control))).size !== entries.length) {
    throw new Error("capture-arc screen must contain unique controls");
  }
  return entries;
}

function positiveImpactTurn(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("frame.impact.catchableTurnDeg must be finite and non-negative");
  }
  if (value === 0) {
    throw new Error(
      "capture-arc screen currently scopes to authored impact > 0; zero-impact contact needs a separately predeclared neutral-incidence study",
    );
  }
  return value;
}
