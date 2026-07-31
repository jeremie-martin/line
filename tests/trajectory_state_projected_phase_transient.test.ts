import { describe, expect, test } from "vitest";
import { realizeStateProjectedPhaseTransient } from "../scripts/v0/trajectory/state_projected_phase_transient.ts";
import type { ContactKinematicFrame } from "../scripts/v0/trajectory/contact_kinematic_frame.ts";

function frame(): ContactKinematicFrame {
  return {
    anchor: { reference: { x: 0, y: 0 }, headingDeg: 0, speedPxPerFrame: 8, sledSpanPx: 12, anchorPoint: "TAIL", headingSource: "reference_point_velocity" },
    com: { headingDeg: 0, speedPxPerFrame: 8 },
    impact: { target: .5, requestedRawImpactPx: 5, requestedTurnDeg: 35, catchableTurnDeg: 20 },
  };
}

describe("state-projected capture-phase transient", () => {
  test("derives one legal current-frame phase from the full future state", () => {
    const result = realizeStateProjectedPhaseTransient(frame(), {
      reference: { x: 100, y: -10 }, referenceVelocity: { x: 8, y: -2 }, velocity: { x: 8, y: -2 },
    }, 12, 30);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.capture.phase).toBeGreaterThanOrEqual(0);
    expect(result.capture.phase).toBeLessThanOrEqual(1);
    expect(result.lines.map((line) => line.id)).toEqual([30, 31, 32, 33]);
    expect(result.terminal.reference).toEqual({ x: 100, y: -10 });
  });

  test("fails closed when the endpoint state is non-finite", () => {
    expect(realizeStateProjectedPhaseTransient(frame(), {
      reference: { x: Number.NaN, y: 0 }, referenceVelocity: null, velocity: { x: 1, y: 1 },
    }, 3, 1)).toEqual({ status: "unavailable", reason: "missing_terminal_state" });
  });
});
