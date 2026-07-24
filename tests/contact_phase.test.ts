import { afterEach, describe, expect, test } from "vitest";
import { MIN_LANDING_AIRBORNE_FRAMES } from "../scripts/lib/detector.ts";
import {
  ballisticLaunchLeavesDetectorRunway,
  detectorRunwayControl,
  detectorRunwayEnabled,
  detectorRunwaySpacingEligible,
} from "../scripts/v0/optimizer/contact_phase.ts";

describe("detector runway policy", () => {
  const originalFlag = process.env.LR_DETECTOR_RUNWAY;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.LR_DETECTOR_RUNWAY;
    else process.env.LR_DETECTOR_RUNWAY = originalFlag;
  });

  test("targets the three-frame runway above the landing detector floor", () => {
    expect(detectorRunwaySpacingEligible(MIN_LANDING_AIRBORNE_FRAMES)).toBe(false);
    expect(detectorRunwaySpacingEligible(MIN_LANDING_AIRBORNE_FRAMES + 1)).toBe(true);
    expect(detectorRunwaySpacingEligible(MIN_LANDING_AIRBORNE_FRAMES + 2)).toBe(true);
    expect(detectorRunwaySpacingEligible(MIN_LANDING_AIRBORNE_FRAMES + 3)).toBe(true);
    expect(detectorRunwaySpacingEligible(MIN_LANDING_AIRBORNE_FRAMES + 4)).toBe(false);
  });

  test("has one dynamic ablation switch and defaults on", () => {
    delete process.env.LR_DETECTOR_RUNWAY;
    expect(detectorRunwayEnabled()).toBe(true);
    process.env.LR_DETECTOR_RUNWAY = "0";
    expect(detectorRunwayEnabled()).toBe(false);
  });

  test("smoothly adapts one normalized catch from shallow to steep entry", () => {
    expect(detectorRunwayControl(-5)).toEqual({
      approachDeltaDeg: 3,
      tangentFrames: 1.4,
    });
    expect(detectorRunwayControl(9)).toEqual({
      approachDeltaDeg: 1.5,
      tangentFrames: 1.75,
    });
    expect(detectorRunwayControl(18)).toEqual({
      approachDeltaDeg: 0,
      tangentFrames: 2.1,
    });
  });

  test("measures runway from the first launch sample, not the later anchor", () => {
    const launch = {
      anchorFrame: 14,
      anchorScanFrames: 4,
      airborne: true,
    } as Parameters<typeof ballisticLaunchLeavesDetectorRunway>[0];
    expect(ballisticLaunchLeavesDetectorRunway(launch, 16)).toBe(true);
  });
});
