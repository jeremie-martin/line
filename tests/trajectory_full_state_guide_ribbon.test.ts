import { describe, expect, test } from "vitest";
import { realizeFullStateGuideRibbon } from "../scripts/v0/trajectory/full_state_guide_ribbon.ts";
import type { ContactKinematicFrame } from "../scripts/v0/trajectory/contact_kinematic_frame.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";

const frame: ContactKinematicFrame = {
  anchor: {
    reference: { x: 0, y: 4 }, headingDeg: 0, speedPxPerFrame: 8, sledSpanPx: 12,
    anchorPoint: "TAIL", headingSource: "reference_point_velocity",
  },
  com: { headingDeg: 0, speedPxPerFrame: 8 },
  impact: { target: .6, requestedRedirArcPx: 4.8, requestedTurnDeg: 34.4, catchableTurnDeg: 18 },
};

function state(rate = 2): PlanningState {
  return {
    frame: 100, position: { x: 0, y: 0 }, velocity: { x: 8, y: 0 }, speed: 8, velocityAngleDeg: 0,
    reference: { x: -6, y: 4 }, referencePointName: "TAIL", referenceVelocity: { x: 8, y: 0 },
    sledPoseDeg: 0, sledPoseRateDegPerFrame: rate,
    points: {
      PEG: point(0, -3), TAIL: point(-6, 4), NOSE: point(6, 4), STRING: point(0, 2),
    },
    phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: 3 },
  };
}

function point(x: number, y: number) {
  return { position: { x, y }, velocity: { x: 8, y: 0 }, relativePosition: { x, y }, relativeVelocity: { x: 0, y: 0 } };
}

describe("full-state guide ribbon", () => {
  test("is deterministic and realizes one finite time-ordered path from every native sled point", () => {
    const first = realizeFullStateGuideRibbon(state(), frame, 40);
    const second = realizeFullStateGuideRibbon(state(), frame, 40);
    expect(first).toEqual(second);
    expect(first.status).toBe("ready");
    if (first.status !== "ready") return;
    expect(first.sourcePointIds).toEqual(["PEG", "TAIL", "NOSE", "STRING"]);
    expect(first.inboundFrame).toBe(-1);
    expect(first.nodeCount).toBe(8);
    expect(first.lines).toHaveLength(7);
    expect(first.lines.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite) && Math.hypot(line.x2 - line.x1, line.y2 - line.y1) > 0)).toBe(true);
  });

  test("fails closed without the declared full-state angular input", () => {
    expect(realizeFullStateGuideRibbon(state(0), frame, 1)).toEqual({ status: "unavailable", reason: "zero_angular_rate" });
    const missing = state();
    delete missing.points.STRING;
    expect(realizeFullStateGuideRibbon(missing, frame, 1)).toEqual({ status: "unavailable", reason: "missing_full_sled_state" });
  });
});
