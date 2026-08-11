import { describe, expect, test } from "vitest";
import {
  characterizeNativeCatchHistory,
  nativeCatchReferenceFrame,
  type NativeCatchSledPoint,
} from "../scripts/v0/trajectory/native_catch_history.ts";
import {
  dampNativeCatchCurveBias,
  nativeCatchFrameMode,
  nativeCatchFrameShiftDeg,
} from "../scripts/v0/arc_placement.ts";
import { nativeCatchHistoryMode } from "../scripts/v0/optimizer/sample.ts";

function points(frame: number): NativeCatchSledPoint[] {
  return [
    { x: frame, y: 0, vx: 1, vy: 1.05 },
    { x: frame - 1, y: 1, vx: 1, vy: 1.05 },
    { x: frame + 1, y: 1, vx: 1, vy: 1.05 },
    { x: frame, y: 2, vx: 1, vy: 1.05 },
  ];
}

describe("native-catch precontact history", () => {
  test("uses the existing H-2 trace and exact H state without a replay", () => {
    const trace: number[] = [];
    for (let frame = 0; frame <= 8; frame++) {
      for (const point of points(frame)) trace.push(point.x, point.y);
    }
    const result = characterizeNativeCatchHistory(trace, 0, 10, points(10));
    expect(result?.status).toBe("ready");
    expect(result?.frameCount).toBe(7);
    expect(result?.collectiveTurnDeg).toBeCloseTo(46.4, 1);
    expect(result?.rmsPairDistanceChangePx).toBeCloseTo(0, 12);
    expect(result?.rmsRelativeVelocityChangePxPerFrame).toBeCloseTo(0, 12);
  });

  test("fails closed when the six-frame trace is unavailable", () => {
    expect(characterizeNativeCatchHistory([], 0, 10, points(10))).toBeNull();
  });

  test("uses the velocity of the same lowest point as the placement anchor", () => {
    const sled = points(10);
    sled[3] = { ...sled[3]!, vx: 0, vy: 2 };
    const reference = nativeCatchReferenceFrame(sled, 10, 0);
    expect(reference?.point).toBe("STRING");
    expect(reference?.x).toBe(10);
    expect(reference?.y).toBe(2);
    expect(reference?.angleDeg).toBeCloseTo(90, 12);
    expect(nativeCatchReferenceFrame(sled, 10, 3)).toBeNull();
  });

  test("validates the default-off experiment mode", () => {
    expect(nativeCatchHistoryMode({})).toBeNull();
    expect(nativeCatchHistoryMode({ LR_NATIVE_CATCH_HISTORY: "off" })).toBeNull();
    expect(nativeCatchHistoryMode({ LR_NATIVE_CATCH_HISTORY: "damp" })).toBe("damp");
    expect(nativeCatchHistoryMode({ LR_NATIVE_CATCH_HISTORY: "damp-strong" }))
      .toBe("damp-strong");
    expect(nativeCatchHistoryMode({ LR_NATIVE_CATCH_HISTORY: "damp-coherent" }))
      .toBe("damp-coherent");
    expect(nativeCatchHistoryMode({ LR_NATIVE_CATCH_HISTORY: "damp-detector" }))
      .toBe("damp-detector");
    expect(() => nativeCatchHistoryMode({ LR_NATIVE_CATCH_HISTORY: "tune" })).toThrow();
  });

  test("validates and bounds the default-off contact-frame alignment", () => {
    expect(nativeCatchFrameMode({})).toBeNull();
    expect(nativeCatchFrameMode({ LR_NATIVE_CATCH_FRAME: "off" })).toBeNull();
    expect(nativeCatchFrameMode({ LR_NATIVE_CATCH_FRAME: "reference-half" }))
      .toBe("reference-half");
    expect(nativeCatchFrameMode({ LR_NATIVE_CATCH_FRAME: "reference-full" }))
      .toBe("reference-full");
    expect(() => nativeCatchFrameMode({ LR_NATIVE_CATCH_FRAME: "point" })).toThrow();

    const target = {
      sledX: 0,
      sledY: 0,
      velocity: { x: 10, y: 0 },
      speed: 10,
      angleDeg: 0,
    };
    const reference = {
      point: "STRING" as const,
      x: 0,
      y: 0,
      velocity: { x: 0, y: 2 },
      speed: 2,
      angleDeg: 90,
    };
    expect(nativeCatchFrameShiftDeg(target, reference, "reference-half", 1)).toBe(12.5);
    expect(nativeCatchFrameShiftDeg(target, reference, "reference-full", .4)).toBe(10);
    expect(nativeCatchFrameShiftDeg(target, reference, null, 1)).toBe(0);
  });

  test("damps front-loading only under impact and observed excitation", () => {
    const history = characterizeNativeCatchHistory(
      Array.from({ length: 9 }, (_, frame) => points(frame))
        .flatMap((frame) => frame.flatMap((point) => [point.x, point.y])),
      0,
      10,
      points(10),
    )!;
    const excited = { ...history, poseTurnDeg: 20 };
    expect(dampNativeCatchCurveBias(-1.6, 1, excited, "damp")).toBeCloseTo(-.8, 12);
    expect(dampNativeCatchCurveBias(-1.6, 1, excited, "damp-strong")).toBeCloseTo(0, 12);
    expect(dampNativeCatchCurveBias(
      -1.6,
      1,
      { ...excited, collectiveTurnDeg: 18 },
      "damp-coherent",
    )).toBeCloseTo(0, 12);
    expect(dampNativeCatchCurveBias(
      -1.6,
      1,
      { ...excited, collectiveTurnDeg: 4 },
      "damp-coherent",
    )).toBe(-1.6);
    expect(dampNativeCatchCurveBias(
      -1.6,
      1,
      { ...excited, collectiveTurnDeg: 18 },
      "damp-detector",
      12,
    )).toBeCloseTo(0, 12);
    expect(dampNativeCatchCurveBias(
      -1.6,
      1,
      { ...excited, collectiveTurnDeg: 18 },
      "damp-detector",
      13,
    )).toBe(-1.6);
    expect(dampNativeCatchCurveBias(-1.6, 0, excited, "damp-strong")).toBe(-1.6);
    expect(dampNativeCatchCurveBias(-1.6, 1, null, "damp-strong")).toBe(-1.6);
  });
});
