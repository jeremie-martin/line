import { describe, expect, test, vi } from "vitest";
import {
  gravityCorrectedLaunchAverage,
  LAUNCH_READ_FRAMES,
  LAUNCH_VY_OFFSET_PX,
} from "../scripts/v0/core/launch_read.ts";

describe("gravityCorrectedLaunchAverage", () => {
  test("removes discrete gravity before averaging the read window", () => {
    const g = 0.175;
    const result = gravityCorrectedLaunchAverage(
      { x: 3, y: -2 },
      g,
      () => true,
      (k) => ({ x: 3 + k, y: -2 + g * k }),
    );

    expect(result.n).toBe(LAUNCH_READ_FRAMES);
    expect(result.vx).toBeCloseTo(4.5);
    expect(result.vy).toBeCloseTo(-2 + LAUNCH_VY_OFFSET_PX);
  });

  test("checks the airborne/horizon gate before reading another frame", () => {
    const readVelocity = vi.fn(() => ({ x: 99, y: 99 }));
    const result = gravityCorrectedLaunchAverage(
      { x: 1, y: 2 },
      0.175,
      (k) => k < 2,
      readVelocity,
    );

    expect(result).toEqual({
      vx: 50,
      vy: (2 + 99 - 0.175) / 2 + LAUNCH_VY_OFFSET_PX,
      n: 2,
    });
    expect(readVelocity).toHaveBeenCalledTimes(1);
    expect(readVelocity).toHaveBeenCalledWith(1);
  });

  test("stops at the first missing or non-finite velocity", () => {
    const result = gravityCorrectedLaunchAverage(
      { x: 1, y: 2 },
      0.175,
      () => true,
      (k) => k === 1 ? { x: 3, y: 4 } : { x: Number.NaN, y: 5 },
    );

    expect(result.n).toBe(2);
    expect(result.vx).toBe(2);
    expect(result.vy).toBeCloseTo((2 + 4 - 0.175) / 2 + LAUNCH_VY_OFFSET_PX);
  });
});
