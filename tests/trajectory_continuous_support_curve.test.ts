import { describe, expect, test } from "vitest";
import {
  CONTINUOUS_SUPPORT_CURVE_ACTIONS,
  CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS,
  CONTINUOUS_SUPPORT_CURVE_PROTOCOL,
  CONTINUOUS_SUPPORT_CURVE_RESOLUTION_DIAGNOSTIC_MULTIPLIERS,
  realizeContinuousSupportCurve,
  realizeContinuousSupportCurveAtResolution,
} from "../scripts/v0/trajectory/continuous_support_curve.ts";
import { makePostimpactNamedReferenceStep } from "../scripts/v0/trajectory/postimpact_support_orientation.ts";

const anchor = {
  reference: { x: 100, y: 200 },
  headingDeg: 0,
  speedPxPerFrame: 10,
  sledSpanPx: 18,
  anchorPoint: "TAIL" as const,
  headingSource: "reference_point_velocity" as const,
};

function action(id: (typeof CONTINUOUS_SUPPORT_CURVE_ACTIONS)[number]["id"]) {
  return CONTINUOUS_SUPPORT_CURVE_ACTIONS.find((candidate) => candidate.id === id)!;
}

function referenceStep(
  stepAnchor: typeof anchor = anchor,
  displacement: { x: number; y: number } = { x: 10, y: 0.5 },
) {
  return makePostimpactNamedReferenceStep({
    anchorPoint: stepAnchor.anchorPoint,
    fromFrame: 100,
    toFrame: 101,
    fromReference: stepAnchor.reference,
    toReference: {
      x: stepAnchor.reference.x + displacement.x,
      y: stepAnchor.reference.y + displacement.y,
    },
    exactCaptureOnlyTraceFingerprint: "capture-only-trace-at-H",
  });
}

function realize(
  id: (typeof CONTINUOUS_SUPPORT_CURVE_ACTIONS)[number]["id"],
  options: {
    curveAnchor?: typeof anchor;
    displacement?: { x: number; y: number };
    phaseLeadSteps?: number;
    lineIdStart?: number;
  } = {},
) {
  const curveAnchor = options.curveAnchor ?? anchor;
  return realizeContinuousSupportCurve({
    anchor: curveAnchor,
    captureOnlyNamedReferenceStep: referenceStep(curveAnchor, options.displacement),
    phaseLeadSteps: (options.phaseLeadSteps ?? 0) as 0 | 1 | 2 | 3 | 4,
  }, action(id), options.lineIdStart ?? 70);
}

describe("continuous support curve", () => {
  test("declares one immutable matched five-arm local-turn ladder", () => {
    expect(CONTINUOUS_SUPPORT_CURVE_ACTIONS).toEqual([
      { id: "curve-turn-negative-8", totalTurnDeg: -8 },
      { id: "curve-turn-negative-4", totalTurnDeg: -4 },
      { id: "curve-neutral", totalTurnDeg: 0 },
      { id: "curve-turn-positive-4", totalTurnDeg: 4 },
      { id: "curve-turn-positive-8", totalTurnDeg: 8 },
    ]);
    expect(CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS).toEqual([0, 1, 2, 3, 4]);
    expect(CONTINUOUS_SUPPORT_CURVE_RESOLUTION_DIAGNOSTIC_MULTIPLIERS).toEqual([1, 2]);
    expect(CONTINUOUS_SUPPORT_CURVE_PROTOCOL).toMatchObject({
      constructionExtentFrames: 12,
      curvaturePower: 1,
      maxChordErrorPx: 2,
      maxTurnDegPerSegment: 5,
    });
    expect((CONTINUOUS_SUPPORT_CURVE_PROTOCOL as any).segmentCount).toBeUndefined();
    expect((CONTINUOUS_SUPPORT_CURVE_PROTOCOL as any).preloadSpeedFrames).toBeUndefined();
    expect(Object.isFrozen(CONTINUOUS_SUPPORT_CURVE_ACTIONS)).toBe(true);
    expect(Object.isFrozen(CONTINUOUS_SUPPORT_CURVE_ACTIONS[0]!)).toBe(true);
    expect(Object.isFrozen(CONTINUOUS_SUPPORT_CURVE_PROTOCOL)).toBe(true);
  });

  test("uses one common adaptive topology and declared sagitta/angle tolerances for every arm", () => {
    const curves = CONTINUOUS_SUPPORT_CURVE_ACTIONS.map((declared) => realize(declared.id));
    const baseline = curves[0]!;
    expect(baseline.resolution).toMatchObject({
      segmentCount: 2,
      maximumActionTurnDeg: 8,
      curvaturePower: 1,
      maxChordErrorPx: 2,
      maxTurnDegPerSegment: 5,
      maximumTangentStepDeg: 4,
    });
    expect(baseline.resolution.maximumDeclaredChordSagittaPx).toBeLessThanOrEqual(
      CONTINUOUS_SUPPORT_CURVE_PROTOCOL.maxChordErrorPx,
    );
    for (const curve of curves) {
      expect(curve.lines).toHaveLength(baseline.resolution.segmentCount);
      expect({ ...curve.resolution, actualChordSagittaPx: undefined })
        .toEqual({ ...baseline.resolution, actualChordSagittaPx: undefined });
      expect(curve.resolution.actualChordSagittaPx).toBeLessThanOrEqual(
        CONTINUOUS_SUPPORT_CURVE_PROTOCOL.maxChordErrorPx,
      );
      expect(curve.segments.map((segment) => [segment.startArcFraction, segment.endArcFraction]))
        .toEqual([[0, 0.5], [0.5, 1]]);
      expect(curve.segments.map((segment) => segment.tangentArcFraction)).toEqual([0.25, 0.75]);
      expect(curve.lines.every((line) => line.flipped === false)).toBe(true);
      expect(curve.lines.every((line) => !line.leftExtended && !line.rightExtended)).toBe(true);
      expect(curve.lines.every((line) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1) > 0)).toBe(true);
      expect(curve.segments.every((segment) => Math.abs(segment.lengthPx - curve.segments[0]!.lengthPx) < 1e-9)).toBe(true);
      expect(curve.minimumAdjacentActiveNormalDot).toBeGreaterThanOrEqual(
        CONTINUOUS_SUPPORT_CURVE_PROTOCOL.minAdjacentActiveNormalDot,
      );
    }
    const neutral = realize("curve-neutral");
    expect(neutral.segments.map((segment) => segment.tangentDeg)).toEqual([0, 0]);
    expect(neutral.segments.map((segment) => segment.lengthPx)).toEqual([60, 60]);
  });

  test("records exact continuous endpoint tangents and midpoint chord headings with bounded entry continuity", () => {
    const positive = realize("curve-turn-positive-8");
    const negative = realize("curve-turn-negative-8");
    for (const curve of [positive, negative]) {
      expect(curve.entryTangentDeg).toBeCloseTo(anchor.headingDeg, 12);
      expect(curve.firstRealizedChordTangentDeg).toBeCloseTo(curve.segments[0]!.tangentDeg, 12);
      expect(curve.lastRealizedChordTangentDeg).toBeCloseTo(curve.segments.at(-1)!.tangentDeg, 12);
      expect(curve.entryActiveNormalContinuityDot).toBeGreaterThanOrEqual(
        CONTINUOUS_SUPPORT_CURVE_PROTOCOL.minAdjacentActiveNormalDot,
      );
      expect(curve.entryActiveNormalContinuityDot).toBeLessThan(1);
    }
    expect(positive.segments.map((segment) => segment.tangentDeg)).toEqual([2, 6]);
    expect(negative.segments.map((segment) => segment.tangentDeg)).toEqual([-2, -6]);
    expect(positive.terminalTangentDeg).toBe(8);
    expect(negative.terminalTangentDeg).toBe(-8);
  });

  test("realizes exact circular-arc chords rather than equal-length tangent marching", () => {
    const curve = realize("curve-turn-positive-8");
    const turnRadians = 8 * Math.PI / 180;
    const radiusPx = curve.extentPx / turnRadians;
    const expectedSagittaPx = radiusPx * (1 - Math.cos(turnRadians / (2 * curve.resolution.segmentCount)));
    const terminal = curve.lines.at(-1)!;
    expect(curve.resolution.actualChordSagittaPx).toBeCloseTo(expectedSagittaPx, 12);
    expect(curve.resolution.actualChordSagittaPx).toBeLessThanOrEqual(
      CONTINUOUS_SUPPORT_CURVE_PROTOCOL.maxChordErrorPx,
    );
    expect(terminal.x2).toBeCloseTo(curve.curveStart.x + radiusPx * Math.sin(turnRadians), 10);
    expect(terminal.y2).toBeCloseTo(curve.curveStart.y + radiusPx * (1 - Math.cos(turnRadians)), 10);
    for (const [index, segment] of curve.segments.entries()) {
      const line = curve.lines[index]!;
      const chordHeadingDeg = Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180 / Math.PI;
      expect(chordHeadingDeg).toBeCloseTo(segment.tangentDeg, 10);
    }
  });

  test("offers only a fixed 2x post-selection resolution diagnostic", () => {
    const nominal = realize("curve-turn-positive-8");
    const doubled = realizeContinuousSupportCurveAtResolution({
      anchor,
      captureOnlyNamedReferenceStep: referenceStep(),
      phaseLeadSteps: 0,
    }, action("curve-turn-positive-8"), 70, 2);
    expect(nominal.resolution.resolutionMultiplier).toBe(1);
    expect(doubled.resolution.resolutionMultiplier).toBe(2);
    expect(doubled.lines).toHaveLength(nominal.lines.length * 2);
    expect(doubled.resolution.actualChordSagittaPx).toBeLessThan(nominal.resolution.actualChordSagittaPx);
    expect(() => realizeContinuousSupportCurveAtResolution({
      anchor,
      captureOnlyNamedReferenceStep: referenceStep(),
      phaseLeadSteps: 0,
    }, action("curve-neutral"), 1, 3 as any)).toThrow(/declared diagnostic set/);
  });

  test("interprets signed actions relative to the active normal, not a fixed world heading", () => {
    const positiveOnLeft = realize("curve-turn-positive-8", { displacement: { x: 10, y: 0.5 } });
    const positiveOnRight = realize("curve-turn-positive-8", { displacement: { x: 10, y: -0.5 } });
    const negativeOnRight = realize("curve-turn-negative-8", { displacement: { x: 10, y: -0.5 } });

    expect(positiveOnLeft.entryFlipped).toBe(false);
    expect(positiveOnLeft.entryActiveNormal).toEqual({ x: 0, y: 1 });
    expect(positiveOnLeft.worldTotalTurnDeg).toBe(8);
    expect(positiveOnLeft.segments.map((segment) => segment.tangentDeg)).toEqual([2, 6]);

    expect(positiveOnRight.entryFlipped).toBe(true);
    expect(positiveOnRight.entryActiveNormal).toEqual({ x: 0, y: -1 });
    expect(positiveOnRight.worldTotalTurnDeg).toBe(-8);
    expect(positiveOnRight.segments.map((segment) => segment.tangentDeg)).toEqual([-2, -6]);
    expect(positiveOnRight.lines.every((line) => line.flipped)).toBe(true);

    expect(negativeOnRight.worldTotalTurnDeg).toBe(8);
    expect(negativeOnRight.segments.map((segment) => segment.tangentDeg)).toEqual([2, 6]);
  });

  test("keeps construction scale adaptive, state-normalized, and target-blind", () => {
    const phaseTwo = realize("curve-neutral", { phaseLeadSteps: 2 });
    const fasterAnchor = { ...anchor, speedPxPerFrame: 1000 };
    const faster = realize("curve-neutral", {
      curveAnchor: fasterAnchor,
      displacement: { x: 1000, y: 50 },
    });
    expect(phaseTwo.phaseLeadPx).toBeCloseTo(20, 12);
    expect(phaseTwo.curveStart).toEqual({ x: 120, y: 201 });
    expect(phaseTwo.extentPx).toBe(120);
    expect(faster.extentPx).toBe(12000);
    expect(faster.resolution.segmentCount).toBeGreaterThan(phaseTwo.resolution.segmentCount);
    expect(faster.resolution.maximumDeclaredChordSagittaPx).toBeLessThanOrEqual(
      CONTINUOUS_SUPPORT_CURVE_PROTOCOL.maxChordErrorPx,
    );
  });

  test("carries capture-only reference provenance into the emitted curve", () => {
    const curve = realize("curve-neutral");
    expect(curve.referenceStep).toMatchObject({
      anchorPoint: "TAIL",
      fromFrame: 100,
      toFrame: 101,
      exactCaptureOnlyTraceFingerprint: "capture-only-trace-at-H",
    });
    expect(curve.referenceStep.referenceStepToAnchorSpeedRatio).toBeGreaterThan(0);
    expect(curve.referenceStep.entryActiveNormalProjectionToReferenceStepRatio).toBeGreaterThan(0);
  });

  test("enforces unique non-negative signed i32 line ids for the whole emitted arm", () => {
    const maxStart = 0x7fffffff - 1;
    const curve = realize("curve-neutral", { lineIdStart: maxStart });
    expect(curve.lines.map((line) => line.id)).toEqual([maxStart, maxStart + 1]);
    expect(new Set(curve.lines.map((line) => line.id)).size).toBe(curve.lines.length);
    expect(() => realize("curve-neutral", { lineIdStart: 0x7fffffff }))
      .toThrow(/unique signed 32-bit integers/);
    expect(() => realize("curve-neutral", { lineIdStart: -1 }))
      .toThrow(/non-negative signed 32-bit integer/);
  });

  test("fails closed for undeclared actions, invalid phase, ambiguous side, and invalid step provenance", () => {
    const validStep = referenceStep();
    const unsafeStep = (patch: Record<string, unknown>) => ({ ...validStep, ...patch }) as any;
    expect(() => realizeContinuousSupportCurve({
      anchor,
      captureOnlyNamedReferenceStep: validStep,
      phaseLeadSteps: 0,
    }, { id: "curve-neutral", totalTurnDeg: 3 } as any, 1)).toThrow(/declared assay stencil/);
    expect(() => realizeContinuousSupportCurve({
      anchor,
      captureOnlyNamedReferenceStep: validStep,
      phaseLeadSteps: 5 as any,
    }, action("curve-neutral"), 1)).toThrow(/phaseLeadSteps/);
    expect(() => realize("curve-neutral", { displacement: { x: 10, y: 0 } })).toThrow(/stable active normal/);
    expect(() => realizeContinuousSupportCurve({
      anchor,
      captureOnlyNamedReferenceStep: unsafeStep({ toFrame: 102 }),
      phaseLeadSteps: 0,
    }, action("curve-neutral"), 1)).toThrow(/contiguous/);
    expect(() => realizeContinuousSupportCurve({
      anchor,
      captureOnlyNamedReferenceStep: unsafeStep({ anchorPoint: "NOSE" }),
      phaseLeadSteps: 0,
    }, action("curve-neutral"), 1)).toThrow(/same anchor point/);
    expect(() => realizeContinuousSupportCurve({
      anchor,
      captureOnlyNamedReferenceStep: unsafeStep({ exactCaptureOnlyTraceFingerprint: "" }),
      phaseLeadSteps: 0,
    }, action("curve-neutral"), 1)).toThrow(/non-empty exact capture-only trace fingerprint/);
  });
});
