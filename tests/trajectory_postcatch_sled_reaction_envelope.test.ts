import { describe, expect, test } from "vitest";
import { realizePostcatchSledReactionEnvelope } from "../scripts/v0/trajectory/postcatch_sled_reaction_envelope.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";

function state(rate = 2): PlanningState {
  return {
    frame: 101, position: { x: 0, y: 0 }, velocity: { x: 8, y: 0 }, speed: 8, velocityAngleDeg: 0,
    reference: { x: -6, y: 4 }, referencePointName: "TAIL", referenceVelocity: { x: 8, y: 0 },
    sledPoseDeg: 0, sledPoseRateDegPerFrame: rate,
    points: {
      PEG: point(0, -3), TAIL: point(-6, 4), NOSE: point(6, 4), STRING: point(0, 2),
    },
    phase: { contactNow: true, groundedAgeFrames: 1, airborneAgeFrames: 0 },
  };
}

function point(x: number, y: number) {
  return { position: { x, y }, velocity: { x: 8, y: 0 }, relativePosition: { x, y }, relativeVelocity: { x: 0, y: 0 } };
}

describe("post-catch sled reaction envelope", () => {
  test("realizes a deterministic finite full-sled configuration contour after the observed state", () => {
    const first = realizePostcatchSledReactionEnvelope(state(), 40);
    const second = realizePostcatchSledReactionEnvelope(state(), 40);
    expect(first).toEqual(second);
    expect(first.status).toBe("ready");
    if (first.status !== "ready") return;
    expect(first.startFrame).toBe(101);
    expect(first.sourcePointIds).toEqual(["PEG", "TAIL", "NOSE", "STRING"]);
    expect(first.nodeCount).toBe(6);
    expect(first.lines).toHaveLength(5);
    expect(first.lines.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite) && Math.hypot(line.x2 - line.x1, line.y2 - line.y1) > 0)).toBe(true);
  });

  test("allows a physically stationary angular configuration but fails closed on missing full state", () => {
    expect(realizePostcatchSledReactionEnvelope(state(0), 1).status).toBe("ready");
    const missing = state();
    delete missing.points.STRING;
    expect(realizePostcatchSledReactionEnvelope(missing, 1)).toEqual({ status: "unavailable", reason: "missing_full_sled_state" });
  });
});
