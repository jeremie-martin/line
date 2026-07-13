import { afterEach, describe, expect, test } from "vitest";
import { MIN_LANDING_AIRBORNE_FRAMES } from "../scripts/lib/detector.ts";
import {
  kinematicSupportEnabled,
  planKinematicSupport,
} from "../scripts/v0/optimizer/kinematic_support.ts";

describe("kinematic support plan", () => {
  const originalFlag = process.env.LR_KINEMATIC_SUPPORT;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.LR_KINEMATIC_SUPPORT;
    else process.env.LR_KINEMATIC_SUPPORT = originalFlag;
  });

  test("reserves a detector-valid flight and integrates riding speed", () => {
    const plan = planKinematicSupport({
      air: 0.02,
      gapFrames: 280,
      entrySpeed: 12.2,
      exitSpeed: 11.45,
      referenceLength: 360,
    });
    expect(plan.targetFlightFrames).toBe(MIN_LANDING_AIRBORNE_FRAMES);
    expect(plan.targetGroundFrames).toBe(274);
    expect(plan.targetLength).toBeCloseTo((12.2 + 11.45) * 0.5 * 274, 8);
    expect(plan.supportAngleDeg).toBeLessThan(0);
    expect(plan.extensionPressure).toBe(1);
  });

  test("uses one continuous air-time model for ordinary gaps", () => {
    const plan = planKinematicSupport({
      air: 0.5,
      gapFrames: 40,
      entrySpeed: 10,
      exitSpeed: 10,
      referenceLength: 200,
    });
    expect(plan.targetFlightFrames).toBe(20);
    expect(plan.targetGroundFrames).toBe(20);
    expect(plan.supportAngleDeg).toBe(0);
    expect(plan.extensionPressure).toBe(0);
  });

  test("has a single ablation and defaults on", () => {
    delete process.env.LR_KINEMATIC_SUPPORT;
    expect(kinematicSupportEnabled()).toBe(true);
    process.env.LR_KINEMATIC_SUPPORT = "0";
    expect(kinematicSupportEnabled()).toBe(false);
  });
});
