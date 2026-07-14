import { describe, expect, test } from "vitest";
import {
  activeNormalForDirectedTangent,
  makePostimpactNamedReferenceStep,
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

function namedStep(options: {
  anchor?: typeof anchor;
  displacement?: { x: number; y: number };
  fromFrame?: number;
  toFrame?: number;
  fingerprint?: string;
} = {}) {
  const stepAnchor = options.anchor ?? anchor;
  const displacement = options.displacement ?? { x: 10, y: 0.5 };
  return makePostimpactNamedReferenceStep({
    anchorPoint: stepAnchor.anchorPoint,
    fromFrame: options.fromFrame ?? 40,
    toFrame: options.toFrame ?? 41,
    fromReference: stepAnchor.reference,
    toReference: {
      x: stepAnchor.reference.x + displacement.x,
      y: stepAnchor.reference.y + displacement.y,
    },
    exactCaptureOnlyTraceFingerprint: options.fingerprint ?? "capture-only-exact-trace",
  });
}

function resolve(displacement: { x: number; y: number }) {
  return resolvePostimpactSupportOrientation({
    anchor,
    captureOnlyNamedReferenceStep: namedStep({ displacement }),
  });
}

describe("post-impact support orientation", () => {
  test("binds orientation to an immutable exact H-to-H+1 named-reference step", () => {
    const step = namedStep();
    expect(Object.isFrozen(step)).toBe(true);
    expect(Object.isFrozen(step.fromReference)).toBe(true);
    expect(step).toMatchObject({
      anchorPoint: "TAIL",
      fromFrame: 40,
      toFrame: 41,
      fromReference: { x: 100, y: 200 },
      toReference: { x: 110, y: 200.5 },
      exactCaptureOnlyTraceFingerprint: "capture-only-exact-trace",
    });
  });

  test("uses capture-only named-reference motion to choose the active collision side", () => {
    const positive = resolve({ x: 10, y: 0.5 });
    const negative = resolve({ x: 10, y: -0.5 });
    expect(positive.entryFlipped).toBe(false);
    expect(positive.entryActiveNormal).toEqual({ x: 0, y: 1 });
    expect(positive.entryTangentProjectionPx).toBeCloseTo(10, 12);
    expect(positive.entryNormalProjectionPx).toBeCloseTo(0.5, 12);
    expect(positive.preloadPx).toBeCloseTo(1, 12);
    expect(positive.referenceStep).toMatchObject({
      anchorPoint: "TAIL",
      fromFrame: 40,
      toFrame: 41,
      exactCaptureOnlyTraceFingerprint: "capture-only-exact-trace",
    });
    expect(positive.referenceStep.referenceStepPx).toBeCloseTo(Math.hypot(10, 0.5), 12);
    expect(positive.referenceStep.referenceStepToAnchorSpeedRatio).toBeCloseTo(Math.hypot(10, 0.5) / 10, 12);
    expect(positive.referenceStep.entryTangentProjectionToReferenceStepRatio).toBeCloseTo(10 / Math.hypot(10, 0.5), 12);
    expect(positive.referenceStep.entryActiveNormalProjectionToReferenceStepRatio).toBeCloseTo(0.5 / Math.hypot(10, 0.5), 12);
    expect(negative.entryFlipped).toBe(true);
    expect(negative.entryActiveNormal).toEqual({ x: 0, y: -1 });
  });

  test("uses state-relative ratios rather than fixed absolute pixel thresholds", () => {
    const smallAnchor = {
      ...anchor,
      reference: { x: 1, y: 2 },
      speedPxPerFrame: 0.01,
    };
    const orientation = resolvePostimpactSupportOrientation({
      anchor: smallAnchor,
      // The active-normal displacement is 0.0005px, below the previous raw
      // pixel threshold, but it is a healthy five-percent directional signal.
      captureOnlyNamedReferenceStep: namedStep({
        anchor: smallAnchor,
        displacement: { x: 0.01, y: 0.0005 },
      }),
    });
    expect(orientation.entryNormalProjectionPx).toBeCloseTo(0.0005, 12);
    expect(orientation.referenceStep.entryActiveNormalProjectionToReferenceStepRatio).toBeGreaterThan(0.04);

    expect(() => resolve({ x: 10, y: 0.0005 })).toThrow(/stable active normal/);
    expect(() => resolvePostimpactSupportOrientation({
      anchor,
      captureOnlyNamedReferenceStep: namedStep({ displacement: { x: 1e-5, y: 1e-5 } }),
    })).toThrow(/too small relative to anchor speed/);
  });

  test("fails closed for an ambiguous side or a non-forward named-reference step", () => {
    expect(() => resolve({ x: 10, y: 0 })).toThrow(/stable active normal/);
    expect(() => resolve({ x: -10, y: 1 })).toThrow(/canonical direction/);
  });

  test("revalidates frame, point, anchor, and fingerprint provenance at use time", () => {
    const valid = namedStep();
    const unsafe = (patch: Record<string, unknown>) => ({ ...valid, ...patch }) as any;
    expect(() => resolvePostimpactSupportOrientation({
      anchor,
      captureOnlyNamedReferenceStep: unsafe({ toFrame: 42 }),
    })).toThrow(/contiguous/);
    expect(() => resolvePostimpactSupportOrientation({
      anchor,
      captureOnlyNamedReferenceStep: unsafe({ anchorPoint: "NOSE" }),
    })).toThrow(/same anchor point/);
    expect(() => resolvePostimpactSupportOrientation({
      anchor,
      captureOnlyNamedReferenceStep: unsafe({ fromReference: { x: 99, y: 200 } }),
    })).toThrow(/exact anchor reference/);
    expect(() => resolvePostimpactSupportOrientation({
      anchor,
      captureOnlyNamedReferenceStep: unsafe({ exactCaptureOnlyTraceFingerprint: " " }),
    })).toThrow(/non-empty exact capture-only trace fingerprint/);
    expect(() => makePostimpactNamedReferenceStep({
      ...valid,
      toFrame: 42,
    })).toThrow(/contiguous/);
  });

  test("keeps explicit directed-line orientation separate from endpoint direction", () => {
    expect(activeNormalForDirectedTangent({ x: 1, y: 0 }, false)).toEqual({ x: 0, y: 1 });
    expect(activeNormalForDirectedTangent({ x: 1, y: 0 }, true)).toEqual({ x: 0, y: -1 });
    expect(POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL.preloadSpeedFrames).toBe(0.1);
    expect(POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL.minReferenceStepToAnchorSpeedRatio).toBeGreaterThan(0);
    expect(Object.isFrozen(POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL)).toBe(true);
  });
});
