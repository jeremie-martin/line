import { describe, expect, it } from "vitest";
import {
  amplitudeImpactCouplingLaw,
  amplitudeLaunchLaw,
  amplitudeTargetArcPlan,
  ballisticLaunchAngleForArrivalDeg,
} from "../scripts/v0/arc_placement.ts";

describe("amplitude launch law", () => {
  it("is default-off and rejects unknown modes", () => {
    expect(amplitudeLaunchLaw({})).toBeNull();
    expect(amplitudeLaunchLaw({ LR_AMPLITUDE_LAUNCH_LAW: "off" })).toBeNull();
    expect(amplitudeLaunchLaw({ LR_AMPLITUDE_LAUNCH_LAW: "feasible-gate" }))
      .toBe("feasible-gate");
    expect(amplitudeLaunchLaw({ LR_AMPLITUDE_LAUNCH_LAW: "dense-ceiling-gate" }))
      .toBe("dense-ceiling-gate");
    expect(amplitudeLaunchLaw({ LR_AMPLITUDE_LAUNCH_LAW: "air-conflict-gate" }))
      .toBe("air-conflict-gate");
    expect(amplitudeLaunchLaw({ LR_AMPLITUDE_LAUNCH_LAW: "target-airtime" }))
      .toBe("target-airtime");
    expect(amplitudeLaunchLaw({ LR_AMPLITUDE_LAUNCH_LAW: "suppress-all" }))
      .toBe("suppress-all");
    expect(() => amplitudeLaunchLaw({ LR_AMPLITUDE_LAUNCH_LAW: "source-special" }))
      .toThrow();
  });

  it("keeps the amplitude/impact coupling default-off", () => {
    expect(amplitudeImpactCouplingLaw({})).toBeNull();
    expect(amplitudeImpactCouplingLaw({ LR_AMPLITUDE_IMPACT_COUPLING: "off" }))
      .toBeNull();
    expect(amplitudeImpactCouplingLaw({
      LR_AMPLITUDE_IMPACT_COUPLING: "exact-arrival",
    })).toBe("exact-arrival");
    expect(() => amplitudeImpactCouplingLaw({
      LR_AMPLITUDE_IMPACT_COUPLING: "source-special",
    })).toThrow();
  });

  it("inverts the ballistic sagitta into a bounded airtime plan", () => {
    const short = amplitudeTargetArcPlan(1, 20, 10);
    expect(short.fullAirCeiling).toBeCloseTo(0.1458333333, 8);
    expect(short.airFrames).toBe(20);
    expect(short.postLength).toBe(28);

    const feasible = amplitudeTargetArcPlan(0.35, 48, 10);
    expect(feasible.fullAirCeiling).toBeCloseTo(0.84, 8);
    expect(feasible.airFrames).toBeCloseTo(30.98386677, 8);
    expect(feasible.postLength).toBeCloseTo(170.1613323, 7);
    expect(feasible.launchAngleDeg).toBeLessThan(0);
  });

  it("solves the launch angle for a fixed-duration arrival", () => {
    const speed = 10;
    const frames = 18;
    const wantedArrivalDeg = 24;
    const launchDeg = ballisticLaunchAngleForArrivalDeg(
      speed,
      frames,
      wantedArrivalDeg,
    );
    expect(launchDeg).not.toBeNull();
    const launchRad = launchDeg! * Math.PI / 180;
    const vx = speed * Math.cos(launchRad);
    const vy = speed * Math.sin(launchRad) + 0.175 * frames;
    expect(Math.atan2(vy, vx) * 180 / Math.PI).toBeCloseTo(wantedArrivalDeg, 10);
  });
});
