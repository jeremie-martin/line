import { describe, expect, it } from "vitest";
import { interruptSupport } from "../scripts/benchmark/impact_support_gap.ts";

describe("rider-scaled support interruption", () => {
  const carrier = Array.from({ length: 4 }, (_, i) => ({ id: 20 + i, type: 0 as const,
    x1: i * 10, y1: 0, x2: (i + 1) * 10, y2: 0, flipped: true, leftExtended: true, rightExtended: true }));
  it("creates exactly the projected body span plus one speed frame of open support", () => {
    const result = interruptSupport(carrier, [12, 16, 20, 24].map(x => ({ x, y: -5 })), 4);
    expect(result.available).toBe(true);
    expect(result.width).toBe(16);
    expect(result.low).toBe(10);
    expect(result.high).toBe(26);
    expect(result.lines.map((l: any) => [l.x1, l.x2])).toEqual([[0, 10], [26, 30], [30, 40]]);
    expect(result.lines.map((l: any) => l.id)).toEqual([20, 21, 22]);
    expect(result.lines[0].rightExtended).toBe(false);
    expect(result.lines[1].leftExtended).toBe(false);
    expect(result.lines[2].rightExtended).toBe(true);
    expect(result.lines.every((l: any) => l.flipped && l.type === 0)).toBe(true);
  });
  it("preserves both outside pieces when the interval cuts a single segment", () => {
    const result = interruptSupport(carrier, [14, 14, 16, 16].map(x => ({ x, y: 0 })), 2);
    expect(result.lines.map((l: any) => [l.x1, l.x2])).toEqual([[0, 10], [10, 13], [17, 20], [20, 30], [30, 40]]);
    expect(result.origins.filter((p: any) => p.originalId === 21).map((p: any) => p.side)).toEqual(["before", "after"]);
  });
  it("rejects a cut that would replace the initial or terminal carrier boundary", () => {
    const result = interruptSupport(carrier, [0, 1, 2, 3].map(x => ({ x, y: 0 })), 6);
    expect(result).toMatchObject({ available: false, reason: "cut_outside_carrier" });
  });
});
