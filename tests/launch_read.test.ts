import { describe, expect, test, vi } from "vitest";
import {
  articulatedBallisticState,
  bodyAssemblyLaunchSampleFromRider,
  gravityCorrectedLaunchAverage,
  LAUNCH_READ_FRAMES,
  LAUNCH_VY_OFFSET_PX,
  predictArticulatedBallisticArrival,
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

describe("articulated ballistic launch read", () => {
  test("reconstructs the equal-mass ten-point assembly center", () => {
    const points = new Map([
      ["PEG", { pos: { x: 16, y: 26 }, vel: { x: 6, y: 7 } }],
      ["TAIL", { pos: { x: 17, y: 27 }, vel: { x: 7, y: 8 } }],
      ["NOSE", { pos: { x: 18, y: 28 }, vel: { x: 8, y: 9 } }],
      ["STRING", { pos: { x: 19, y: 29 }, vel: { x: 9, y: 10 } }],
    ]);
    const sample = bodyAssemblyLaunchSampleFromRider({
      position: { x: 10, y: 20 },
      velocity: { x: 2, y: 3 },
      get: (id: string) => points.get(id),
    }, 42);

    expect(sample).not.toBeNull();
    expect(sample!.frame).toBe(42);
    expect(sample!.body).toEqual({ x: 10, y: 20, vx: 2, vy: 3 });
    expect(sample!.assembly).toEqual({
      x: (10 * 6 + 16 + 17 + 18 + 19) / 10,
      y: (20 * 6 + 26 + 27 + 28 + 29) / 10,
      vx: (2 * 6 + 6 + 7 + 8 + 9) / 10,
      vy: (3 * 6 + 7 + 8 + 9 + 10) / 10,
    });
  });

  test("anchors at the last sample and separates conserved from articulated motion", () => {
    const g = 0.175;
    const state = articulatedBallisticState([
      {
        frame: 10,
        assembly: { x: 4, y: 5, vx: 2, vy: 3 },
        body: { x: 5, y: 5, vx: 2, vy: 4 },
      },
      {
        frame: 11,
        assembly: { x: 6, y: 8.175, vx: 2, vy: 3 + g },
        body: { x: 6, y: 9.175, vx: 1, vy: 3 + g },
      },
    ], g);

    expect(state).not.toBeNull();
    expect(state!.frameOffset).toBe(1);
    expect(state!.assemblyX).toBe(6);
    expect(state!.assemblyY).toBeCloseTo(8.175);
    expect(state!.assemblyVx).toBe(2);
    expect(state!.assemblyVy).toBeCloseTo(3 + g);
    expect(state!.relativeX).toBe(0);
    expect(state!.relativeY).toBe(1);
    expect(state!.relativeVx).toBe(-1);
    expect(state!.relativeVy).toBe(0);
    expect(state!.angularRateRadPerFrame).toBeCloseTo(Math.PI / 2);
  });

  test("uses instantaneous relative velocity as the one-sample phase-rate fallback", () => {
    const state = articulatedBallisticState([{
      frame: 7,
      assembly: { x: 0, y: 0, vx: 2, vy: 3 },
      body: { x: 2, y: 0, vx: 2, vy: 4 },
    }], 0.175);

    expect(state!.angularRateRadPerFrame).toBeCloseTo(0.5);
  });

  test("skips a degenerate angle pair and falls back to the final instantaneous rate", () => {
    const state = articulatedBallisticState([
      {
        frame: 10,
        assembly: { x: 0, y: 0, vx: 0, vy: 0 },
        body: { x: 0, y: 0, vx: 0, vy: 0 },
      },
      {
        frame: 11,
        assembly: { x: 0, y: 0, vx: 0, vy: 0 },
        body: { x: 1, y: 0, vx: 0, vy: 2 },
      },
    ], 0);

    expect(state!.angularRateRadPerFrame).toBeCloseTo(2);
  });

  test("returns a terminal prediction without carrying a reusable stale anchor", () => {
    const g = 0.175;
    const arrived = predictArticulatedBallisticArrival({
      frameOffset: 3,
      assemblyX: 10,
      assemblyY: 20,
      assemblyVx: 2,
      assemblyVy: -1,
      relativeX: 1,
      relativeY: 0,
      relativeVx: 0,
      relativeVy: 2,
      angularRateRadPerFrame: Math.PI / 2,
    }, 4, g);

    const confidence = Math.exp(-1 / 4);
    expect(arrived).not.toBeNull();
    expect(arrived!.x).toBeCloseTo(12);
    expect(arrived!.y).toBeCloseTo(20 - 1 + g + 1);
    expect(arrived!.vx).toBeCloseTo(2 - 2 * confidence);
    expect(arrived!.vy).toBeCloseTo(-1 + g);
    expect(predictArticulatedBallisticArrival({
      frameOffset: 3,
      assemblyX: 10,
      assemblyY: 20,
      assemblyVx: 2,
      assemblyVy: -1,
      relativeX: 1,
      relativeY: 0,
      relativeVx: 0,
      relativeVy: 2,
      angularRateRadPerFrame: 0,
    }, 2, g)).toBeNull();
  });
});
