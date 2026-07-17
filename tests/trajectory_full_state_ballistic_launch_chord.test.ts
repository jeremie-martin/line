import { describe, expect, test } from "vitest";
import { realizeFullStateBallisticLaunchChord } from "../scripts/v0/trajectory/full_state_ballistic_launch_chord.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";

function state(): PlanningState {
  return {
    frame: 100, position: { x: 0, y: 0 }, velocity: { x: 8, y: 0 }, speed: 8, velocityAngleDeg: 0,
    reference: { x: -6, y: 4 }, referencePointName: "TAIL", referenceVelocity: { x: 8, y: 0 },
    sledPoseDeg: 0, sledPoseRateDegPerFrame: 1,
    points: {
      PEG: point(0, -3), TAIL: point(-6, 4), NOSE: point(6, 4), STRING: point(0, 2),
    },
    phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: 3 },
  };
}
function point(x: number, y: number) {
  return { position: { x, y }, velocity: { x: 8, y: 0 }, relativePosition: { x, y }, relativeVelocity: { x: 0, y: 0 } };
}

describe("full-state ballistic launch chord", () => {
  test("preserves collective speed and derives one finite two-segment passive launch from every sled point", () => {
    const first = realizeFullStateBallisticLaunchChord(state(), 12, 40);
    const second = realizeFullStateBallisticLaunchChord(state(), 12, 40);
    expect(first).toEqual(second);
    expect(first.status).toBe("ready");
    if (first.status !== "ready") return;
    expect(first.sourcePointIds).toEqual(["PEG", "TAIL", "NOSE", "STRING"]);
    expect(first.launchSpeedPxPerFrame).toBeCloseTo(first.incomingSpeedPxPerFrame, 12);
    expect(first.launchVyPxPerFrame).toBeCloseTo(-1.05, 12);
    expect(first.lines).toHaveLength(2);
    expect(first.lines.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite) && Math.hypot(line.x2 - line.x1, line.y2 - line.y1) > 0)).toBe(true);
  });

  test("fails closed for incomplete full-body state or invalid interval", () => {
    expect(realizeFullStateBallisticLaunchChord(state(), 1, 1)).toEqual({ status: "unavailable", reason: "invalid_flight_interval" });
    const incomplete = state();
    delete incomplete.points.STRING;
    expect(realizeFullStateBallisticLaunchChord(incomplete, 12, 1)).toEqual({ status: "unavailable", reason: "missing_full_sled_state" });
  });
});
