import { describe, expect, test } from "vitest";
import {
  angleDeltaDeg,
  classifyExactSupportSliceConstructionProbe,
  displacement,
  exactSupportSliceCaptureClosureEndFrame,
  exactSupportSliceCaptureSelectionValidationEndFrame,
  EXACT_SUPPORT_SLICE_MAX_MEASUREMENT_HORIZON_FRAMES,
  EXACT_SUPPORT_SLICE_MIN_MEASUREMENT_HORIZON_FRAMES,
  exactSupportSliceMeasurementHorizon,
  firstSharedSafeExactSupportSlicePhase,
  measureCoMWindow,
  namedReferenceState,
  offBeatLandingsInWindow,
  remainingAirSpeedBudget,
  sameOwnedCaptureEvent,
  sameScoredContactImpact,
  unresolvedOffBeatLandingFramesAtWindowEnd,
} from "../scripts/v0/trajectory/exact_support_slice_assay.ts";
import { EXACT_SUPPORT_SLICE_PROTOCOL } from "../scripts/v0/trajectory/exact_support_slice.ts";

describe("exact support slice assay rules", () => {
  test("closes capture eligibility at H minus one rather than H or H plus one", () => {
    expect(exactSupportSliceCaptureClosureEndFrame(null)).toBeNull();
    expect(exactSupportSliceCaptureClosureEndFrame(100)).toBe(106);
    expect(exactSupportSliceCaptureSelectionValidationEndFrame(100, 1)).toBe(105);
    expect(() => exactSupportSliceCaptureClosureEndFrame(1.5)).toThrow(/safe integer/);
    expect(() => exactSupportSliceCaptureSelectionValidationEndFrame(100, -1)).toThrow(/non-negative/);
  });

  test("treats collision as expected only after immutable comparator invariants hold", () => {
    const stable = {
      physicalPrefixMatchesBaseline: true,
      captureOnlyPreHComplete: true,
      captureOnlyPreHTraceAvailable: true,
      captureTraceMatchesComparator: true,
      traceMatchesBeforeFirstSupportCollision: true,
      selectedCaptureEventMatchesComparator: true,
      impactMatchesComparator: true,
      survivesThroughH: true,
      preOrAtHSupportCollisionCount: 0,
    };
    expect(classifyExactSupportSliceConstructionProbe(stable)).toMatchObject({
      constructionSafe: true,
      expectedCollisionRejection: false,
      protocolInvalid: false,
    });
    expect(classifyExactSupportSliceConstructionProbe({
      ...stable,
      captureTraceMatchesComparator: false,
      preOrAtHSupportCollisionCount: 1,
    })).toMatchObject({
      constructionSafe: false,
      expectedCollisionRejection: true,
      protocolInvalid: false,
    });
    expect(classifyExactSupportSliceConstructionProbe({
      ...stable,
      physicalPrefixMatchesBaseline: false,
      preOrAtHSupportCollisionCount: 1,
    })).toMatchObject({
      expectedCollisionRejection: false,
      protocolInvalid: true,
    });
    expect(classifyExactSupportSliceConstructionProbe({
      ...stable,
      captureOnlyPreHTraceAvailable: false,
      preOrAtHSupportCollisionCount: 1,
    })).toMatchObject({
      expectedCollisionRejection: false,
      protocolInvalid: true,
    });
    expect(classifyExactSupportSliceConstructionProbe({
      ...stable,
      traceMatchesBeforeFirstSupportCollision: false,
      preOrAtHSupportCollisionCount: 1,
    })).toMatchObject({
      expectedCollisionRejection: false,
      protocolInvalid: true,
    });
    expect(classifyExactSupportSliceConstructionProbe({
      ...stable,
      impactMatchesComparator: false,
    })).toMatchObject({
      expectedCollisionRejection: false,
      protocolInvalid: true,
    });
  });

  test("selects only the first declared shared-safe phase and preserves no-safe availability", () => {
    const phases = [
      { lead: 0, sharedConstructionSafe: false },
      { lead: 1, sharedConstructionSafe: false },
      { lead: 2, sharedConstructionSafe: true },
      { lead: 3, sharedConstructionSafe: true },
    ];
    expect(firstSharedSafeExactSupportSlicePhase(phases)).toEqual(phases[2]);
    expect(firstSharedSafeExactSupportSlicePhase(phases.map((phase) => ({ ...phase, sharedConstructionSafe: false })))).toBeNull();
  });

  test("defines Q as elapsed observation intervals without changing the fixed construction extent", () => {
    expect(EXACT_SUPPORT_SLICE_MAX_MEASUREMENT_HORIZON_FRAMES).toBe(EXACT_SUPPORT_SLICE_PROTOCOL.maxMeasurementHorizonFrames);
    expect(EXACT_SUPPORT_SLICE_MIN_MEASUREMENT_HORIZON_FRAMES).toBe(EXACT_SUPPORT_SLICE_PROTOCOL.minMeasurementHorizonFrames);
    expect(EXACT_SUPPORT_SLICE_PROTOCOL.constructionExtentFrames).toBe(12);
    expect(exactSupportSliceMeasurementHorizon(120, 108)).toEqual({
      status: "ready",
      measurementHorizonFrames: 12,
      measurementSamples: 13,
    });
    expect(exactSupportSliceMeasurementHorizon(110, 106)).toEqual({
      status: "ready",
      measurementHorizonFrames: 4,
      measurementSamples: 5,
    });
    expect(exactSupportSliceMeasurementHorizon(110, 107)).toEqual({
      status: "insufficient_measurement_horizon",
      availableIntervals: 3,
    });
  });

  test("keeps the named response anchor fixed rather than reselection by height", () => {
    const state = {
      position: { x: 1, y: 2 }, velocity: { x: 3, y: 4 },
      points: {
        TAIL: { position: { x: 10, y: 20 }, velocity: { x: 2, y: 1 } },
        NOSE: { position: { x: 11, y: 99 }, velocity: { x: 5, y: 0 } },
      },
    } as any;
    const tail = namedReferenceState(state, "TAIL");
    expect(tail).toMatchObject({ point: "TAIL", position: { x: 10, y: 20 }, speedPxPerFrame: Math.sqrt(5) });
    expect(displacement(tail!.position, { x: 12, y: 23 })).toEqual({ x: 2, y: 3 });
    expect(namedReferenceState(null, "TAIL")).toBeNull();
  });

  test("does not treat an event-kind or impact change as the same capture", () => {
    const event = {
      type: "landing", frame: 50, timingErrorFrames: 0, contactLineIds: [3], ownedLineIds: [3],
      lineRoles: ["capture"], gateEligible: true, roleEligible: true,
    } as any;
    expect(sameOwnedCaptureEvent(event, { ...event })).toBe(true);
    expect(sameOwnedCaptureEvent(event, { ...event, type: "bounce" })).toBe(false);
    const impact = {
      metric: "contactRedirArcPxAtLanding -> normImpact", windowFrames: 6, availability: "measured",
      target: 0.4, landingFrame: 50, rawPxPerFrame: 5, achieved: 0.3, residual: -0.1,
    } as const;
    expect(sameScoredContactImpact(impact, { ...impact })).toBe(true);
    expect(sameScoredContactImpact(impact, { ...impact, achieved: 0.31 })).toBe(false);
  });

  test("reports scorer-facing inclusive CoM samples and reporting-only remaining budgets", () => {
    const detection = fakeDetection();
    expect(measureCoMWindow(detection, 4, 6)).toMatchObject({
      measurementSamples: 3,
      airborneSamples: 2,
      airFraction: 2 / 3,
      meanSpeedAuthored: 0.5,
      terminal: { speedPxPerFrame: 9 },
    });
    expect(remainingAirSpeedBudget({
      detection,
      outgoingStartFrame: 2,
      outgoingEndFrame: 6,
      supportStartFrame: 4,
      axes: { air: 0.6, speed: 0.5 },
    })).toMatchObject({
      prefixMeasurementSamples: 2,
      remainingMeasurementSamples: 3,
      air: { target: 0.6, remainingSamples: 2 },
      speed: { target: 0.5, remainingMeanAuthored: 0.5 },
    });
    expect(angleDeltaDeg(-175, 175)).toBe(10);
  });

  test("uses the detector's authored-contact array contract for off-beat landings", () => {
    const detection = {
      ...fakeDetection(),
      events: [
        { type: "landing", frame: 4 },
        { type: "landing", frame: 6 },
      ],
    } as any;
    expect(offBeatLandingsInWindow(detection, [4], 4, 6)).toEqual([6]);
    expect(unresolvedOffBeatLandingFramesAtWindowEnd(detection, [4], 0, 6)).toEqual([6]);
    const extendedDetection = {
      ...detection,
      measurements: { ...detection.measurements, airborne: Array(11).fill(false) },
    } as any;
    expect(unresolvedOffBeatLandingFramesAtWindowEnd(extendedDetection, [4], 0, 10)).toEqual([]);
  });
});

function fakeDetection() {
  const airborne = [false, false, false, true, false, true, true];
  const speed = [1, 1, 9, 9, 9, 9, 9];
  return {
    measurements: {
      airborne,
      speed,
      position: speed.map((_, frame) => ({ x: frame, y: frame + 1 })),
      velocity: speed.map((value) => ({ x: value, y: 0 })),
      sledContacts: airborne.map((value) => value ? [] : ["TAIL"]),
      contactLineIds: airborne.map((value) => value ? [] : [1]),
    },
    events: [],
    terminus: { frame: 20, reason: "endOfSpec" },
  } as any;
}
