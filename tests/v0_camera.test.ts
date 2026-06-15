import { describe, expect, test } from "vitest";
import {
  cameraSidecarToRenderPlan,
  denseLinearZoomFromLog2Keyframes,
  normalizeSpecZoomKeyframes,
  specCameraToSidecar,
  specZoomLaneToRenderPlan,
} from "../scripts/v0/core/camera.ts";
import { constant } from "../scripts/v0/core/curves.ts";
import { validateSpec } from "../scripts/v0/core/substrate.ts";
import type { Spec, SpecZoomLane } from "../scripts/v0/types.ts";

describe("spec camera zoom", () => {
  test("normalizes to native log2 keyframes with frame 0 and duration clamps", () => {
    const lane: SpecZoomLane = {
      keyframes: [
        { t: 2, zoom: 2 },
        { t: 1, zoom: 4 },
        { t: 1.01, zoom: 8 },
      ],
    };

    const keyframes = normalizeSpecZoomKeyframes(lane, 120);

    expect(keyframes).toEqual([
      [0, 3],
      [40, 3],
      [80, 1],
      [120, 1],
    ]);
  });

  test("dense fallback interpolates in log space and returns linear zoom", () => {
    const dense = denseLinearZoomFromLog2Keyframes([[0, 1], [40, 2]], 40);

    expect(dense[0]).toBeCloseTo(2, 12);
    expect(dense[20]).toBeCloseTo(2 ** 1.5, 12);
    expect(dense[40]).toBeCloseTo(4, 12);
  });

  test("spec lane conversion carries smoothing and fallback data", () => {
    const plan = specZoomLaneToRenderPlan({
      smoothingFrames: 6,
      keyframes: [{ t: 0, zoom: 3 }, { t: 1, zoom: 6 }],
    }, 1);

    expect(plan?.zoomSmoothing).toBe(6);
    expect(plan?.zoomKeyframes).toEqual([[0, Math.log2(3)], [40, Math.log2(6)]]);
    expect(plan?.autoZoom[0]).toBeCloseTo(3, 12);
    expect(plan?.autoZoom[40]).toBeCloseTo(6, 12);
  });

  test("camera sidecar is render-only and round-trips through native keyframes", () => {
    const spec: Spec = {
      duration: 1,
      contacts: [],
      axes: { air: constant(0.5) },
      camera: {
        zoom: {
          keyframes: [{ t: 0, zoom: 2 }, { t: 1, zoom: 4 }],
        },
      },
    };

    const sidecar = specCameraToSidecar(spec);
    const plan = cameraSidecarToRenderPlan(sidecar);

    expect(sidecar?.durationFrames).toBe(40);
    expect(sidecar?.zoom?.keyframes).toEqual([[0, 1], [40, 2]]);
    expect(plan?.autoZoom[40]).toBeCloseTo(4, 12);
  });

  test("validateSpec rejects invalid camera zoom lanes", () => {
    const base: Spec = {
      duration: 1,
      contacts: [],
      axes: {},
    };

    expect(() => validateSpec({
      ...base,
      camera: { zoom: { keyframes: [] } },
    })).toThrow(/keyframes/);

    expect(() => validateSpec({
      ...base,
      camera: { zoom: { keyframes: [{ t: 2, zoom: 3 }] } },
    })).toThrow(/out of/);

    expect(() => validateSpec({
      ...base,
      camera: { zoom: { keyframes: [{ t: 0, zoom: 0 }] } },
    })).toThrow(/must be > 0/);

    expect(() => validateSpec({
      ...base,
      camera: { zoom: { smoothingFrames: 0.5, keyframes: [{ t: 0, zoom: 3 }] } },
    })).toThrow(/smoothingFrames/);
  });
});
