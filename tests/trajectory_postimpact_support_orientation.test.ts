import { describe, expect, test } from "vitest";
import {
  activeNormalForDirectedTangent,
  POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL,
  resolvePostimpactSupportOrientation,
} from "../scripts/v0/trajectory/postimpact_support_orientation.ts";

const anchor = {
  reference: { x: 100, y: 200 },
  headingDeg: 0,
  speedPxPerFrame: 10,
  sledSpanPx: 18,
  anchorPoint: "TAIL" as const,
  headingSource: "reference_point_velocity" as const,
};

describe("post-impact support orientation", () => {
  test("uses capture-only named-reference motion to choose the active collision side", () => {
    const positive = resolvePostimpactSupportOrientation({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: 0.5 },
    });
    const negative = resolvePostimpactSupportOrientation({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: -0.5 },
    });
    expect(positive.entryFlipped).toBe(false);
    expect(positive.entryActiveNormal).toEqual({ x: 0, y: 1 });
    expect(positive.entryTangentProjectionPx).toBeCloseTo(10, 12);
    expect(positive.entryNormalProjectionPx).toBeCloseTo(0.5, 12);
    expect(positive.preloadPx).toBeCloseTo(1, 12);
    expect(negative.entryFlipped).toBe(true);
    expect(negative.entryActiveNormal).toEqual({ x: 0, y: -1 });
  });

  test("fails closed for an ambiguous side or a non-forward named-reference step", () => {
    expect(() => resolvePostimpactSupportOrientation({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: 0 },
    })).toThrow(/stable active normal/);
    expect(() => resolvePostimpactSupportOrientation({
      anchor,
      captureOnlyReferenceDisplacement: { x: -10, y: 1 },
    })).toThrow(/canonical direction/);
  });

  test("keeps explicit directed-line orientation separate from endpoint direction", () => {
    expect(activeNormalForDirectedTangent({ x: 1, y: 0 }, false)).toEqual({ x: 0, y: 1 });
    expect(activeNormalForDirectedTangent({ x: 1, y: 0 }, true)).toEqual({ x: 0, y: -1 });
    expect(POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL.preloadSpeedFrames).toBe(0.1);
    expect(Object.isFrozen(POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL)).toBe(true);
  });
});
