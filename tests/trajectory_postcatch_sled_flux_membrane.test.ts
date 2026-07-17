import { describe, expect, test } from "vitest";
import { realizePostcatchSledFluxMembrane } from "../scripts/v0/trajectory/postcatch_sled_flux_membrane.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";

function state(): PlanningState {
  return {
    frame: 101, position: { x: 0, y: 0 }, velocity: { x: 8, y: 0 }, speed: 8, velocityAngleDeg: 0,
    reference: { x: -6, y: 4 }, referencePointName: "TAIL", referenceVelocity: { x: 8, y: 0 },
    sledPoseDeg: 0, sledPoseRateDegPerFrame: 2,
    points: {
      PEG: point(0, -3), TAIL: point(-6, 4), NOSE: point(6, 4), STRING: point(0, 2),
    },
    phase: { contactNow: true, groundedAgeFrames: 1, airborneAgeFrames: 0 },
  };
}

function point(x: number, y: number) {
  return { position: { x, y }, velocity: { x: 8, y: 0 }, relativePosition: { x, y }, relativeVelocity: { x: 0, y: 0 } };
}

describe("post-catch sled flux membrane", () => {
  test("uses the complete configuration to make one finite collective-flow-facing membrane", () => {
    const result = realizePostcatchSledFluxMembrane(state(), 13);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.sourcePointIds).toEqual(["PEG", "TAIL", "NOSE", "STRING"]);
    expect(result.activeFace).toBe("collective-flow");
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ id: 13, flipped: false, x1: 6, y1: 5.75, x2: 6, y2: -1.25 });
  });

  test("fails closed when the configuration is incomplete", () => {
    const missing = state();
    delete missing.points.STRING;
    expect(realizePostcatchSledFluxMembrane(missing, 1)).toEqual({ status: "unavailable", reason: "missing_full_sled_state" });
  });
});
