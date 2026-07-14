import { describe, expect, test } from "vitest";
import {
  CONTINUOUS_SUPPORT_CURVE_ACTIONS,
  CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS,
  CONTINUOUS_SUPPORT_CURVE_PROTOCOL,
  realizeContinuousSupportCurve,
} from "../scripts/v0/trajectory/continuous_support_curve.ts";

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

function realize(id: (typeof CONTINUOUS_SUPPORT_CURVE_ACTIONS)[number]["id"]) {
  return realizeContinuousSupportCurve({
    anchor,
    captureOnlyReferenceDisplacement: { x: 10, y: 0.5 },
    phaseLeadSteps: 0,
  }, action(id), 70);
}

describe("continuous support curve", () => {
  test("declares one immutable matched five-arm curvature ladder", () => {
    expect(CONTINUOUS_SUPPORT_CURVE_ACTIONS).toEqual([
      { id: "curve-turn-negative-8", totalTurnDeg: -8 },
      { id: "curve-turn-negative-4", totalTurnDeg: -4 },
      { id: "curve-neutral", totalTurnDeg: 0 },
      { id: "curve-turn-positive-4", totalTurnDeg: 4 },
      { id: "curve-turn-positive-8", totalTurnDeg: 8 },
    ]);
    expect(CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS).toEqual([0, 1, 2, 3, 4]);
    expect(CONTINUOUS_SUPPORT_CURVE_PROTOCOL.segmentCount).toBe(4);
    expect(Object.isFrozen(CONTINUOUS_SUPPORT_CURVE_ACTIONS)).toBe(true);
    expect(Object.isFrozen(CONTINUOUS_SUPPORT_CURVE_ACTIONS[0]!)).toBe(true);
    expect(Object.isFrozen(CONTINUOUS_SUPPORT_CURVE_PROTOCOL)).toBe(true);
  });

  test("keeps every action on identical topology, breakpoints, length, and collision side", () => {
    const curves = CONTINUOUS_SUPPORT_CURVE_ACTIONS.map((declared) => realize(declared.id));
    for (const curve of curves) {
      expect(curve.lines).toHaveLength(4);
      expect(curve.segments.map((segment) => [segment.startArcFraction, segment.endArcFraction]))
        .toEqual([[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]]);
      expect(curve.segments.map((segment) => segment.lengthPx)).toEqual([30, 30, 30, 30]);
      expect(curve.lines.every((line) => line.flipped === false)).toBe(true);
      expect(curve.lines.every((line) => !line.leftExtended && !line.rightExtended)).toBe(true);
      expect(curve.minimumAdjacentActiveNormalDot).toBeGreaterThanOrEqual(
        CONTINUOUS_SUPPORT_CURVE_PROTOCOL.minAdjacentActiveNormalDot,
      );
    }
  });

  test("turn begins in the first segment and is symmetric around the matched neutral arm", () => {
    const negative = realize("curve-turn-negative-8");
    const neutral = realize("curve-neutral");
    const positive = realize("curve-turn-positive-8");
    expect(negative.segments[0]!.tangentDeg).toBeCloseTo(-1, 12);
    expect(neutral.segments[0]!.tangentDeg).toBeCloseTo(0, 12);
    expect(positive.segments[0]!.tangentDeg).toBeCloseTo(1, 12);
    expect(negative.segments.map((segment) => segment.tangentDeg)).toEqual([-1, -3, -5, -7]);
    expect(positive.segments.map((segment) => segment.tangentDeg)).toEqual([1, 3, 5, 7]);
    expect(negative.terminalTangentDeg).toBe(-8);
    expect(neutral.terminalTangentDeg).toBe(0);
    expect(positive.terminalTangentDeg).toBe(8);
  });

  test("keeps construction scale state-normalized and phase placement target-blind", () => {
    const phaseTwo = realizeContinuousSupportCurve({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: 0.5 },
      phaseLeadSteps: 2,
    }, action("curve-neutral"), 1);
    const fast = realizeContinuousSupportCurve({
      anchor: { ...anchor, speedPxPerFrame: 20 },
      captureOnlyReferenceDisplacement: { x: 10, y: 0.5 },
      phaseLeadSteps: 0,
    }, action("curve-neutral"), 1);
    expect(phaseTwo.phaseLeadPx).toBeCloseTo(20, 12);
    expect(phaseTwo.curveStart).toEqual({ x: 120, y: 201 });
    expect(phaseTwo.extentPx).toBe(120);
    expect(fast.extentPx).toBe(240);
  });

  test("fails closed for an undeclared action, invalid phase, and ambiguous active side", () => {
    expect(() => realizeContinuousSupportCurve({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: 0.5 },
      phaseLeadSteps: 0,
    }, { id: "curve-neutral", totalTurnDeg: 3 } as any, 1)).toThrow(/declared assay stencil/);
    expect(() => realizeContinuousSupportCurve({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: 0.5 },
      phaseLeadSteps: 5 as any,
    }, action("curve-neutral"), 1)).toThrow(/phaseLeadSteps/);
    expect(() => realizeContinuousSupportCurve({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: 0 },
      phaseLeadSteps: 0,
    }, action("curve-neutral"), 1)).toThrow(/stable active normal/);
  });
});
