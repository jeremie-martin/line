import { describe, expect, test } from "vitest";
import {
  realizeContactPhaseCarrier,
  resolveContactPhaseCarrier,
} from "../scripts/v0/trajectory/contact_phase_carrier.ts";
import { makeContactPhaseCarrierScreen } from "../scripts/v0/trajectory/contact_phase_carrier_design.ts";
import type { TargetFrame } from "../scripts/v0/trajectory/target_frame.ts";

const frame: TargetFrame = {
  reference: { x: 100, y: 200 },
  headingDeg: 0,
  speedPxPerFrame: 10,
  sledSpanPx: 20,
  anchorPoint: "NOSE",
  headingSource: "reference_point_velocity",
};

describe("contact phase carrier", () => {
  test("makes the target contact the start of a finite carrier rather than a terrain kink", () => {
    const resolved = resolveContactPhaseCarrier(frame, {
      targetTangentOffsetFrames: 0,
      targetNormalOffsetSledSpans: 0,
      entryAngleRelativeDeg: -20,
      approachFrames: 1.5,
      carrierFrames: 2,
      tailTurnDeg: -5,
      tailFrames: 1,
    });
    const realized = realizeContactPhaseCarrier(resolved, 7);
    expect(realized.lines).toHaveLength(3);
    expect(realized.lines[0]).toMatchObject({ id: 7, x2: 100, y2: 200 });
    expect(realized.lines[1]).toMatchObject({ id: 8, x1: 100, y1: 200 });
    expect(realized.lineRoles).toEqual({ approach: 7, carrier: 8, tail: 9 });
    expect(realized.carrierLineIds).toEqual([8]);
    expect(realized.entryAngleDeg).toBe(-20);
    expect(realized.tailAngleDeg).toBe(-25);
  });

  test("uses a fixed structural phase and a unique symmetric coverage screen", () => {
    const rows = makeContactPhaseCarrierScreen({ turnMagnitudeDeg: 18 });
    expect(rows).toHaveLength(25);
    expect(new Set(rows.map((row) => JSON.stringify(row.control))).size).toBe(25);
    expect(rows.every((row) =>
      row.control.approachFrames === 1.5 && row.control.carrierFrames === 2 && row.control.tailFrames === 1,
    )).toBe(true);
    expect(rows.filter((row) => row.hypothesis === "entry_turn_negative")
      .every((row) => row.control.entryAngleRelativeDeg === -18 && row.control.tailTurnDeg === 0)).toBe(true);
    expect(rows.filter((row) => row.hypothesis === "tail_turn_positive")
      .every((row) => row.control.entryAngleRelativeDeg === 0 && row.control.tailTurnDeg === 18)).toBe(true);
  });
});
