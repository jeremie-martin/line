import { describe, expect, test } from "vitest";
import { characterizePrecontactMulticontactHistory } from "../scripts/v0/trajectory/precontact_multicontact_history.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";

function state(frame: number, velocity: { x: number; y: number }): PlanningState {
  const positions = {
    PEG: { x: -2, y: -1 }, TAIL: { x: -2, y: 1 }, NOSE: { x: 2, y: -1 }, STRING: { x: 2, y: 1 },
  } as const;
  return {
    frame, position: { x: 0, y: 0 }, velocity, speed: Math.hypot(velocity.x, velocity.y), velocityAngleDeg: 0,
    reference: positions.TAIL, referencePointName: "TAIL", referenceVelocity: velocity,
    sledPoseDeg: 0, sledPoseRateDegPerFrame: 0,
    points: Object.fromEntries(Object.entries(positions).map(([name, position]) => [name, {
      position, velocity, relativePosition: position, relativeVelocity: { x: 0, y: 0 },
    }])) as PlanningState["points"],
    phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: frame },
  };
}

describe("pre-contact full-sled history", () => {
  test("separates literal gravity from a candidate-independent articulated transition", () => {
    const result = characterizePrecontactMulticontactHistory([
      state(10, { x: 4, y: 0 }), state(16, { x: 4, y: 1.2 }),
    ], .2);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.frameCount).toBe(7);
    expect(result.collectiveTurnDeg).toBeGreaterThan(0);
    expect(result.accelerationResidualFromGravityPxPerFrame2).toBeCloseTo(0);
    expect(result.rmsPairDistanceChangePx).toBeCloseTo(0);
    expect(result.rmsRelativeVelocityChangePxPerFrame).toBeCloseTo(0);
  });

  test("fails closed when a complete multi-contact state is absent", () => {
    const incomplete = state(10, { x: 4, y: 0 });
    delete incomplete.points.STRING;
    expect(characterizePrecontactMulticontactHistory([incomplete, state(16, { x: 4, y: 1.2 })], .2))
      .toEqual({ status: "unavailable", reason: "missing_full_sled_state" });
  });
});
