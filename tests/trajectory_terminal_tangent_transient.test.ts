import { describe, expect, test } from "vitest";
import { realizeTerminalTangentTransient } from "../scripts/v0/trajectory/terminal_tangent_transient.ts";
import type { ContactKinematicFrame } from "../scripts/v0/trajectory/contact_kinematic_frame.ts";

function frame(): ContactKinematicFrame {
  return {
    anchor: { reference: { x: 0, y: 0 }, headingDeg: 0, speedPxPerFrame: 8, sledSpanPx: 12, anchorPoint: "TAIL", headingSource: "reference_point_velocity" },
    com: { headingDeg: 0, speedPxPerFrame: 8 },
    impact: { target: .5, requestedRawImpactPx: 5, requestedTurnDeg: 35, catchableTurnDeg: 20 },
  };
}

describe("gravity-debiased terminal-tangent transient", () => {
  test("derives one finite capture response from terminal velocity", () => {
    const result = realizeTerminalTangentTransient(frame(), {
      referenceVelocity: { x: 8, y: -2 }, velocity: { x: 8, y: -2 },
    }, 12, 30);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.lines.map((line) => line.id)).toEqual([30, 31, 32, 33]);
    expect(result.terminal.gravityDebiasedLaunchVelocity.y).toBeLessThan(-2);
    expect(result.lines.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite))).toBe(true);
  });

  test("fails closed without impact or a terminal velocity", () => {
    expect(realizeTerminalTangentTransient({ ...frame(), impact: null }, {
      referenceVelocity: null, velocity: { x: 1, y: 1 },
    }, 4, 1)).toEqual({ status: "unavailable", reason: "missing_impact" });
    expect(realizeTerminalTangentTransient(frame(), {
      referenceVelocity: null, velocity: { x: Number.NaN, y: 1 },
    }, 4, 1)).toEqual({ status: "unavailable", reason: "missing_terminal_velocity" });
  });
});
