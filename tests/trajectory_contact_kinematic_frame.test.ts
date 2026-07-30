import { describe, expect, test } from "vitest";
import {
  contactKinematicFrameFromPlanningState,
  surfaceIncidence,
} from "../scripts/v0/trajectory/contact_kinematic_frame.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";
import type { TargetFrame } from "../scripts/v0/trajectory/target_frame.ts";

const state: PlanningState = {
  frame: 10,
  position: { x: 0, y: 0 },
  velocity: { x: 10, y: 0 },
  speed: 10,
  velocityAngleDeg: 0,
  reference: { x: 3, y: 4 },
  referencePointName: "NOSE",
  referenceVelocity: { x: 8, y: 6 },
  sledPoseDeg: null,
  sledPoseRateDegPerFrame: null,
  points: {},
  phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: 4 },
};

const anchor: TargetFrame = {
  reference: { x: 3, y: 4 },
  headingDeg: 36.8698976458,
  speedPxPerFrame: 10,
  sledSpanPx: 20,
  anchorPoint: "NOSE",
  headingSource: "reference_point_velocity",
};

describe("contact kinematic frame", () => {
  test("keeps the sled anchor and scored CoM response conventions explicit", () => {
    const frame = contactKinematicFrameFromPlanningState(state, anchor, { impact: 0.5 });
    expect(frame.anchor).toBe(anchor);
    expect(frame.com).toEqual({ headingDeg: 0, speedPxPerFrame: 10 });
    // 0.5 × VSTRONG(7.55) = 3.775 px requested; ÷ speed 10 → 0.3775 rad = 21.629°
    expect(frame.impact?.requestedRedirArcPx).toBeCloseTo(3.775, 12);
    expect(frame.impact?.requestedTurnDeg).toBeCloseTo(21.629, 3);
    expect(frame.impact?.catchableTurnDeg).toBeCloseTo(frame.impact?.requestedTurnDeg ?? 0, 12);
  });

  test("reports geometric incidence without claiming an engine response", () => {
    const frame = contactKinematicFrameFromPlanningState(state, anchor, { impact: undefined });
    const incidence = surfaceIncidence(frame, -30);
    expect(incidence.signedIncidenceDeg).toBe(30);
    expect(incidence.normalClosingSpeedPxPerFrame).toBeCloseTo(5, 12);
    expect(frame.impact).toBeNull();
  });
});
