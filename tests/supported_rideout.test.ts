import { describe, expect, test } from "vitest";
import {
  planSupportedRideout,
  supportedRideoutFlightFrames,
  supportedRideoutSegments,
} from "../scripts/v0/core/supported_rideout.ts";

describe("supported rideout study model", () => {
  test("leaves non-deficit geometry unchanged", () => {
    const plan = planSupportedRideout({
      mode: "coordinated",
      air: 0.5,
      gapFrames: 40,
      speed: 10,
      sampledPostLength: 180,
      legacyPostLength: 196,
      lengthBlend: 1,
      legacyBlendStrength: 0.6,
    });
    expect(plan.deficitPressure).toBe(0);
    expect(plan.postLength).toBe(196);
  });

  test("leaves deficit geometry unchanged when the mechanism is off", () => {
    const plan = planSupportedRideout({
      mode: "off",
      air: 0.02,
      gapFrames: 200,
      speed: 11.5,
      sampledPostLength: 180,
      legacyPostLength: 260,
      lengthBlend: 1,
      legacyBlendStrength: 0.6,
    });
    expect(plan.deficitPressure).toBe(1);
    expect(plan.postLength).toBe(260);
  });

  test("scales long low-air support from duration and speed", () => {
    const plan = planSupportedRideout({
      mode: "coordinated",
      air: 0.02,
      gapFrames: 200,
      speed: 11.5,
      sampledPostLength: 180,
      legacyPostLength: 260,
      lengthBlend: 1,
      legacyBlendStrength: 0.6,
    });
    expect(plan.effectiveAir).toBe(0.025);
    expect(plan.targetGroundFrames).toBe(195);
    expect(plan.targetLength).toBeCloseTo(2242.5);
    expect(plan.postLength).toBeCloseTo(2242.5);
    expect(supportedRideoutFlightFrames("coordinated", plan, 200, 11.5)).toBeCloseTo(5);
    expect(supportedRideoutSegments("coordinated", plan.postLength, 28, 16)).toBe(80);
  });

  test("separates length-only and coordinated segmentation", () => {
    expect(supportedRideoutSegments("length", 2240, 28, 16)).toBe(16);
    expect(supportedRideoutSegments("coordinated", 2240, 28, 16)).toBe(80);
  });
});
