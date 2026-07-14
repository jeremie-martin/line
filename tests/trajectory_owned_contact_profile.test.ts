import { describe, expect, test } from "vitest";
import { profileOwnedContactLines } from "../scripts/v0/trajectory/owned_contact_profile.ts";
import type { TrackLine } from "../scripts/v0/types.ts";
import type { TargetFrame } from "../scripts/v0/trajectory/target_frame.ts";

const frame: TargetFrame = {
  reference: { x: 5, y: 2 },
  headingDeg: 0,
  speedPxPerFrame: 10,
  sledSpanPx: 20,
  anchorPoint: "NOSE",
  headingSource: "reference_point_velocity",
};

const line = (id: number, x1: number, y1: number, x2: number, y2: number): TrackLine => ({
  id,
  type: 0,
  x1,
  y1,
  x2,
  y2,
  flipped: false,
  leftExtended: false,
  rightExtended: false,
});

describe("owned contact line profile", () => {
  test("profiles the continuous closest point on detector-attributed lines", () => {
    const profile = profileOwnedContactLines(frame, [
      line(10, -10, 0, 0, 0),
      line(11, 0, 0, 10, 0),
      line(12, 10, 0, 10, 10),
    ], [11, 99]);
    expect(profile.missingLineIds).toEqual([99]);
    expect(profile.lines).toHaveLength(1);
    expect(profile.lines[0]).toMatchObject({
      id: 11,
      lineIndex: 1,
      lengthPx: 10,
      angleRelativeDeg: 0,
      closestPointToTarget: {
        fraction: 0.5,
        distancePx: 2,
        tangentOffsetPx: 0,
        normalOffsetPx: -2,
      },
      adjacentTurnsDeg: { fromPrevious: 0, toNext: 90 },
    });
  });
});
