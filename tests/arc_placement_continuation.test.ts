import { describe, expect, test } from "vitest";
import { smoothContinuationCarrier } from "../scripts/v0/arc_placement.ts";
import type { TrackLine } from "../scripts/v0/types.ts";

function line(id: number, x1: number, y1: number, x2: number, y2: number): TrackLine {
  return { id, type: 0, x1, y1, x2, y2, flipped: false, leftExtended: false, rightExtended: false };
}

function length(lines: readonly TrackLine[]): number {
  return lines.reduce((sum, value) => sum + Math.hypot(value.x2 - value.x1, value.y2 - value.y1), 0);
}

describe("smooth continuation carrier", () => {
  test("preserves the response prefix while rebuilding a contiguous equal-length tail", () => {
    const source = [
      line(7, 0, 0, 3, 0),
      line(8, 3, 0, 6, 0),
      line(9, 6, 0, 9, 1),
      line(10, 9, 1, 11, 3),
      line(11, 11, 3, 12, 6),
    ];
    // Entry speed 1 reserves six response pixels, exactly the first two lines.
    const realized = smoothContinuationCarrier(source, 1);

    expect(realized).toHaveLength(source.length);
    expect(realized.slice(0, 2)).toEqual(source.slice(0, 2));
    expect(realized.map((value) => value.id)).toEqual(source.map((value) => value.id));
    expect(length(realized.slice(2))).toBeCloseTo(length(source.slice(2)), 12);
    for (let index = 1; index < realized.length; index++) {
      expect(realized[index]!.x1).toBeCloseTo(realized[index - 1]!.x2, 12);
      expect(realized[index]!.y1).toBeCloseTo(realized[index - 1]!.y2, 12);
    }
  });

  test("leaves carriers without a distinct continuation untouched", () => {
    const short = [line(1, 0, 0, 2, 0), line(2, 2, 0, 4, 1), line(3, 4, 1, 5, 3)];
    expect(smoothContinuationCarrier(short, 5)).toBe(short);
  });
});
