import { describe, expect, test } from "vitest";
import { profilePolylineInTargetFrame } from "../scripts/v0/trajectory/polyline_profile.ts";
import type { IncomingTargetFrame } from "../scripts/v0/trajectory/envelope/model.ts";

const frame: IncomingTargetFrame = {
  reference: { x: 10, y: 20 },
  headingDeg: 0,
  speedPxPerFrame: 10,
  sledSpanPx: 18,
  anchorPoint: "NOSE",
  headingSource: "reference_point_velocity",
};

describe("target-frame polyline profile", () => {
  test("describes an existing connected polyline without reconstructing it", () => {
    const profile = profilePolylineInTargetFrame(frame, [
      { id: 1, type: 0, x1: -10, y1: 20, x2: 5, y2: 23, flipped: false, leftExtended: false, rightExtended: false },
      { id: 2, type: 0, x1: 5, y1: 23, x2: 25, y2: 23, flipped: false, leftExtended: false, rightExtended: false },
    ]);
    expect(profile.connected).toBe(true);
    expect(profile.targetJunction?.vertexIndex).toBe(1);
    expect(profile.targetJunction?.distanceToTargetPx).toBeCloseTo(Math.hypot(5, 3), 12);
    expect(profile.targetJunction?.tangentOffsetPx).toBeCloseTo(-5, 12);
    expect(profile.targetJunction?.normalOffsetPx).toBeCloseTo(3, 12);
    expect(profile.entry?.lengthPx).toBeCloseTo(Math.hypot(15, 3), 12);
    expect(profile.post).toEqual([{ lengthPx: 20, angleRelativeDeg: 0 }]);
  });

  test("records a broken chain rather than hiding it", () => {
    const profile = profilePolylineInTargetFrame(frame, [
      { id: 1, type: 0, x1: 0, y1: 0, x2: 1, y2: 0, flipped: false, leftExtended: false, rightExtended: false },
      { id: 2, type: 0, x1: 2, y1: 0, x2: 3, y2: 0, flipped: false, leftExtended: false, rightExtended: false },
    ]);
    expect(profile.connected).toBe(false);
  });
});
