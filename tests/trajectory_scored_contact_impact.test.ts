import { describe, expect, test } from "vitest";
import { normImpact } from "../scripts/v0/types.ts";
import { scoredContactImpactFromRaw } from "../scripts/v0/trajectory/scored_contact_impact.ts";
import type { PostimpactImpactConvention } from "../scripts/v0/trajectory/postimpact_physics.ts";

const ALTERNATE_CONVENTION: Readonly<PostimpactImpactConvention> = Object.freeze({
  impactWindowFrames: 9,
  catchableRedirFraction: 0.5,
  redirArcSoftPxPerFrame: 2,
  redirArcVeryStrongPxPerFrame: 8,
  speedRulerMinPxPerFrame: 4,
  speedRulerMaxPxPerFrame: 16,
});

describe("study scored contact impact", () => {
  test("reports the production impact metric without making it a selector", () => {
    const outcome = scoredContactImpactFromRaw({
      target: 0.7,
      landingFrame: 42,
      responseWindowComplete: true,
      rawPxPerFrame: 4.2,
    });
    expect(outcome).toMatchObject({
      availability: "measured",
      target: 0.7,
      landingFrame: 42,
      achieved: normImpact(4.2),
      residual: normImpact(4.2) - 0.7,
    });
  });

  test("does not manufacture an impact when the response window is incomplete", () => {
    expect(scoredContactImpactFromRaw({
      target: 0.7,
      landingFrame: 42,
      responseWindowComplete: false,
      rawPxPerFrame: 4.2,
    })).toMatchObject({ availability: "response_window_unavailable", achieved: null, residual: null });
  });

  test("uses a sealed fixture convention rather than ambient impact constants", () => {
    expect(scoredContactImpactFromRaw({
      target: 0.25,
      landingFrame: 42,
      responseWindowComplete: true,
      rawPxPerFrame: 5,
    }, ALTERNATE_CONVENTION)).toMatchObject({
      availability: "measured",
      windowFrames: 9,
      achieved: 0.5,
      residual: 0.25,
    });
  });
});
