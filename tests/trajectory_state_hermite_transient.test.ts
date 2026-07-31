import { describe, expect, test } from "vitest";
import { realizeStateHermiteTransient } from "../scripts/v0/trajectory/state_hermite_transient.ts";
import type { ContactKinematicFrame } from "../scripts/v0/trajectory/contact_kinematic_frame.ts";

function frame(): ContactKinematicFrame {
  return {
    anchor: { reference: { x: 0, y: 0 }, headingDeg: 0, speedPxPerFrame: 8, sledSpanPx: 12, anchorPoint: "TAIL", headingSource: "reference_point_velocity" },
    com: { headingDeg: 0, speedPxPerFrame: 8 },
    impact: { target: .5, requestedRawImpactPx: 5, requestedTurnDeg: 35, catchableTurnDeg: 20 },
  };
}

describe("gravity-debiased endpoint-state Hermite transient", () => {
  test("binds a finite multi-contact curve to the exact terminal state", () => {
    const result = realizeStateHermiteTransient(frame(), {
      reference: { x: 100, y: -10 }, referenceVelocity: { x: 7, y: -2 }, velocity: { x: 7, y: -2 },
    }, 12, 30);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.lines).toHaveLength(5);
    expect(result.lines.map((line) => line.id)).toEqual([30, 31, 32, 33, 34]);
    expect(result.lines.at(-1)).toMatchObject({ x2: 100, y2: -10 });
    expect(result.terminal.velocity).toEqual({ x: 7, y: -2 });
  });

  test("fails closed without an impact or a finite terminal state", () => {
    expect(realizeStateHermiteTransient({ ...frame(), impact: null }, {
      reference: { x: 1, y: 2 }, referenceVelocity: null, velocity: { x: 1, y: 2 },
    }, 8, 1)).toEqual({ status: "unavailable", reason: "missing_impact" });
    expect(realizeStateHermiteTransient(frame(), {
      reference: { x: Number.NaN, y: 2 }, referenceVelocity: null, velocity: { x: 1, y: 2 },
    }, 8, 1)).toEqual({ status: "unavailable", reason: "missing_terminal_velocity" });
  });
});
