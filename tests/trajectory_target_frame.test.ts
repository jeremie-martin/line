import { describe, expect, test } from "vitest";
import { targetFrameFromPlanningState } from "../scripts/v0/trajectory/target_frame.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";

const state: PlanningState = {
  frame: 12,
  position: { x: 100, y: 200 },
  velocity: { x: 10, y: 0 },
  speed: 10,
  velocityAngleDeg: 0,
  reference: { x: 106, y: 208 },
  referencePointName: "NOSE",
  referenceVelocity: { x: 8, y: 6 },
  sledPoseDeg: 0,
  sledPoseRateDegPerFrame: 0,
  points: {
    NOSE: {
      position: { x: 106, y: 208 },
      velocity: { x: 8, y: 6 },
      relativePosition: { x: 6, y: 8 },
      relativeVelocity: { x: -2, y: 6 },
    },
    TAIL: {
      position: { x: 94, y: 208 },
      velocity: { x: 8, y: 6 },
      relativePosition: { x: -6, y: 8 },
      relativeVelocity: { x: -2, y: 6 },
    },
  },
  phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: 4 },
};

describe("trajectory target frame", () => {
  test("uses the contact-point velocity for the default target tangent", () => {
    const frame = targetFrameFromPlanningState(state);
    expect(frame.reference).toEqual(state.reference);
    expect(frame.anchorPoint).toBe("NOSE");
    expect(frame.headingSource).toBe("reference_point_velocity");
    expect(frame.headingDeg).toBeCloseTo(36.8698976458, 8);
    expect(frame.speedPxPerFrame).toBeCloseTo(10, 12);
    expect(frame.sledSpanPx).toBeCloseTo(12, 12);
  });

  test("labels COM heading as an explicit diagnostic alternate", () => {
    const frame = targetFrameFromPlanningState(state, { heading: "rider_com" });
    expect(frame.reference).toEqual(state.reference);
    expect(frame.headingSource).toBe("rider_com_velocity");
    expect(frame.headingDeg).toBe(0);
  });

  test("falls back to COM velocity only when point velocity is unavailable", () => {
    const frame = targetFrameFromPlanningState({ ...state, referenceVelocity: null });
    expect(frame.headingSource).toBe("rider_com_velocity");
    expect(frame.headingDeg).toBe(0);
  });
});
