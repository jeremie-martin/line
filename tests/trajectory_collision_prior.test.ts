import { describe, expect, test } from "vitest";
import {
  BRAKING_IMPACT_ENTRY_TURN_SHARE,
  brakingImpactEntryPrior,
  oneFrameLagNeutralEntryPrior,
  targetNeutralEntryPrior,
} from "../scripts/v0/trajectory/collision_prior.ts";
import { IMPACT, impactToRedirArcPx } from "../scripts/v0/types.ts";
import type { IncomingTargetFrame } from "../scripts/v0/trajectory/envelope/model.ts";

const frame: IncomingTargetFrame = {
  reference: { x: 0, y: 0 },
  headingDeg: 0,
  speedPxPerFrame: 12,
  sledSpanPx: 18,
  anchorPoint: "NOSE",
  headingSource: "reference_point_velocity",
};

describe("collision entry priors", () => {
  test("uses the target reference as the neutral contact coordinate", () => {
    expect(targetNeutralEntryPrior().targetTangentOffsetFrames).toBe(0);
    expect(oneFrameLagNeutralEntryPrior().targetTangentOffsetFrames).toBe(-1);
  });

  test("assigns a signed entry turn only to a braking impact", () => {
    const braking = brakingImpactEntryPrior(frame, { speed: 0.8, impact: 0.8 });
    expect(braking.entryAngleRelativeDeg).toBeLessThan(0);
    expect(braking.diagnostics.requiredRedirectionTurnDeg).not.toBeNull();
    expect(braking.diagnostics.entryTurnShare).toBe(BRAKING_IMPACT_ENTRY_TURN_SHARE);
    const accelerating = brakingImpactEntryPrior(frame, { speed: 1, impact: 0.8 });
    expect(accelerating.entryAngleRelativeDeg).toBe(0);
    const absent = brakingImpactEntryPrior(frame, { impact: 0.8 });
    expect(absent.entryAngleRelativeDeg).toBe(0);
  });

  test("inverts redirection impact in angle space before catchability clamping", () => {
    const moderate = brakingImpactEntryPrior(frame, { speed: 0.8, impact: 0.5 });
    const expectedModerate = Math.min(
      impactToRedirArcPx(0.5) / frame.speedPxPerFrame,
      Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION),
    ) * 180 / Math.PI;
    expect(moderate.diagnostics.requiredRedirectionTurnDeg).toBeCloseTo(expectedModerate, 12);

    const slow = brakingImpactEntryPrior({ ...frame, speedPxPerFrame: 5.4 }, { speed: 0, impact: 1 });
    expect(slow.diagnostics.requiredRedirectionTurnDeg).toBeCloseTo(
      Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION) * 180 / Math.PI,
      12,
    );
  });
});
