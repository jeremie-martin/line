import { describe, expect, test } from "vitest";
import {
  angleDeltaDeg,
  displacement,
  EXACT_SUPPORT_SLICE_MAX_HORIZON_FRAMES,
  EXACT_SUPPORT_SLICE_MIN_HORIZON_FRAMES,
  exactSupportSliceHorizon,
  measureCoMWindow,
  namedReferenceState,
  offBeatLandingsInWindow,
  remainingAirSpeedBudget,
  sameOwnedCaptureEvent,
  sameScoredContactImpact,
} from "../scripts/v0/trajectory/exact_support_slice_assay.ts";
import { EXACT_SUPPORT_SLICE_PROTOCOL } from "../scripts/v0/trajectory/exact_support_slice.ts";

describe("exact support slice assay rules", () => {
  test("defines Q as elapsed intervals and retains short horizons as unavailable", () => {
    expect(EXACT_SUPPORT_SLICE_MAX_HORIZON_FRAMES).toBe(EXACT_SUPPORT_SLICE_PROTOCOL.maxHorizonFrames);
    expect(EXACT_SUPPORT_SLICE_MIN_HORIZON_FRAMES).toBe(EXACT_SUPPORT_SLICE_PROTOCOL.minHorizonFrames);
    expect(exactSupportSliceHorizon(120, 108)).toEqual({ status: "ready", horizonFrames: 12, measurementSamples: 13 });
    expect(exactSupportSliceHorizon(110, 106)).toEqual({ status: "ready", horizonFrames: 4, measurementSamples: 5 });
    expect(exactSupportSliceHorizon(110, 107)).toEqual({ status: "insufficient_support_horizon", availableIntervals: 3 });
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
      metric: "redirArcPxAtLanding -> normImpact", windowFrames: 6, availability: "measured",
      target: 0.4, landingFrame: 50, redirArcPx: 5, achieved: 0.3, residual: -0.1,
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
