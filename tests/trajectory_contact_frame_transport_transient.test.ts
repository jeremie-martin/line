import { describe, expect, test } from "vitest";
import {
  completeContactFrameTransport,
  realizeContactFrameTransportPrefix,
} from "../scripts/v0/trajectory/contact_frame_transport_transient.ts";
import type { ContactKinematicFrame } from "../scripts/v0/trajectory/contact_kinematic_frame.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";

function frame(): ContactKinematicFrame {
  return {
    anchor: { reference: { x: 0, y: 0 }, headingDeg: 0, speedPxPerFrame: 8, sledSpanPx: 12, anchorPoint: "TAIL", headingSource: "reference_point_velocity" },
    com: { headingDeg: 0, speedPxPerFrame: 8 },
    impact: { target: .5, requestedRedirArcPx: 5, requestedTurnDeg: 35, catchableTurnDeg: 20 },
  };
}

function state(comHeadingDeg: number, sledHeadingDeg: number): PlanningState {
  const speed = 8;
  const vector = (headingDeg: number) => ({
    x: Math.cos(headingDeg * Math.PI / 180) * speed,
    y: Math.sin(headingDeg * Math.PI / 180) * speed,
  });
  const comVelocity = vector(comHeadingDeg);
  const sledVelocity = vector(sledHeadingDeg);
  return {
    frame: 20,
    position: { x: 0, y: 0 }, velocity: comVelocity, speed,
    velocityAngleDeg: comHeadingDeg,
    reference: { x: 0, y: 1 }, referencePointName: "TAIL", referenceVelocity: sledVelocity,
    sledPoseDeg: 0, sledPoseRateDegPerFrame: 1,
    points: {
      TAIL: { position: { x: 0, y: 1 }, velocity: sledVelocity, relativePosition: { x: 0, y: 1 }, relativeVelocity: { x: 0, y: 0 } },
      NOSE: { position: { x: 8, y: 0 }, velocity: sledVelocity, relativePosition: { x: 8, y: 0 }, relativeVelocity: { x: 0, y: 0 } },
      STRING: { position: { x: 4, y: 2 }, velocity: sledVelocity, relativePosition: { x: 4, y: 2 }, relativeVelocity: { x: 0, y: 0 } },
    },
    phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: 8 },
  };
}

describe("impulse-closed contact-frame transport transient", () => {
  test("carries an exact prefix's post-impact zero-friction frame through one impact turn", () => {
    const prefix = realizeContactFrameTransportPrefix(frame(), state(0, -12), 30);
    expect(prefix.status).toBe("prefix_ready");
    if (prefix.status !== "prefix_ready") return;
    expect(prefix.prefixLines.map((line) => line.id)).toEqual([30, 31]);
    expect(prefix.incoming.turnOrientation).toBe(-1);

    const result = completeContactFrameTransport(prefix, state(-10, -16));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.lines.map((line) => line.id)).toEqual([30, 31, 32, 33, 34]);
    expect(result.postImpact.terminalTangentDeg).toBeCloseTo(-26, 10);
    expect(result.lines.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite))).toBe(true);
  });

  test("fails closed when no relative zero-friction contact frame is observable", () => {
    expect(realizeContactFrameTransportPrefix(frame(), state(0, 0), 1))
      .toEqual({ status: "unavailable", reason: "degenerate_relative_heading" });
  });
});
