import { describe, expect, test } from "vitest";
import {
  contactTurnScreenMagnitudeDeg,
  makeLocalContactClosureScreen,
} from "../scripts/v0/trajectory/contact_closure_design.ts";
import { IMPACT } from "../scripts/v0/types.ts";
import type { TargetFrame } from "../scripts/v0/trajectory/target_frame.ts";

const frame: TargetFrame = {
  reference: { x: 0, y: 0 },
  headingDeg: 0,
  speedPxPerFrame: 12,
  sledSpanPx: 18,
  anchorPoint: "NOSE",
  headingSource: "reference_point_velocity",
};

describe("local contact-closure screen", () => {
  test("crosses every named turn allocation with the same symmetric one-factor placement set", () => {
    const rows = makeLocalContactClosureScreen({ turnMagnitudeDeg: 18 });
    expect(rows).toHaveLength(25);
    expect(new Set(rows.map((row) => row.label)).size).toBe(25);
    expect(new Set(rows.map((row) => JSON.stringify(row.control))).size).toBe(25);
    expect(new Set(rows.map((row) => row.hypothesis))).toEqual(new Set([
      "neutral",
      "entry_turn_negative",
      "entry_turn_positive",
      "collision_turn_negative",
      "collision_turn_positive",
    ]));
    for (const hypothesis of new Set(rows.map((row) => row.hypothesis))) {
      const placements = rows.filter((row) => row.hypothesis === hypothesis).map((row) => row.placement);
      expect(placements).toHaveLength(5);
      expect(placements.map((placement) => placement.label)).toEqual([
        "center",
        "tangent_minus_half",
        "tangent_plus_half",
        "normal_minus_half",
        "normal_plus_half",
      ]);
      expect(placements.map((placement) => placement.targetTangentOffsetFrames)).toEqual([0, -0.5, 0.5, 0, 0]);
      expect(placements.map((placement) => placement.targetNormalOffsetSledSpans)).toEqual([0, 0, 0, -0.5, 0.5]);
      expect(rows.filter((row) => row.hypothesis === hypothesis)
        .every((row) => row.control.preReachFrames === 2 && row.control.localContinuationFrames === 2)).toBe(true);
    }
  });

  test("uses a positive impact-derived scale and rejects missing or invalid physical inputs", () => {
    const magnitude = contactTurnScreenMagnitudeDeg(frame, { impact: 0.8 });
    expect(magnitude).toBeGreaterThan(0);
    expect(magnitude).toBeLessThanOrEqual(Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION) * 180 / Math.PI);
    expect(() => contactTurnScreenMagnitudeDeg(frame, {})).toThrow(/impact target/);
    expect(() => makeLocalContactClosureScreen({ turnMagnitudeDeg: 0 })).toThrow(/positive and finite/);
  });
});
