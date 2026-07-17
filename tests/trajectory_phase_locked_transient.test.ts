import { describe, expect, test } from "vitest";
import { realizePhaseLockedTransient } from "../scripts/v0/trajectory/phase_locked_transient.ts";
import type { ContactKinematicFrame } from "../scripts/v0/trajectory/contact_kinematic_frame.ts";

function frame(): ContactKinematicFrame {
  return {
    anchor: { reference: { x: 0, y: 0 }, headingDeg: 0, speedPxPerFrame: 8, sledSpanPx: 12, anchorPoint: "TAIL", headingSource: "reference_point_velocity" },
    com: { headingDeg: 0, speedPxPerFrame: 8 },
    impact: { target: .5, requestedRedirArcPx: 5, requestedTurnDeg: 35, catchableTurnDeg: 20 },
  };
}

describe("phase-locked vector-intercept transient", () => {
  test("builds one finite state-derived capture-to-intercept path", () => {
    const result = realizePhaseLockedTransient(frame(), { x: 100, y: -10 }, 12, 30);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.lines).toHaveLength(4);
    expect(result.lines.map((line) => line.id)).toEqual([30, 31, 32, 33]);
    expect(result.intercept.turnOrientation).toBe(-1);
    expect(result.intercept.launchVelocity.x).toBeCloseTo((100 - result.capture.capturePoint.x) / 12, 12);
    expect(result.lines.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite))).toBe(true);
  });

  test("fails closed without an impact-defined capture or a finite intercept", () => {
    expect(realizePhaseLockedTransient({ ...frame(), impact: null }, { x: 10, y: 0 }, 8, 1))
      .toEqual({ status: "unavailable", reason: "missing_impact" });
    expect(realizePhaseLockedTransient(frame(), { x: 0, y: 0 }, 0, 1))
      .toEqual({ status: "unavailable", reason: "degenerate_intercept" });
  });
});
