import { describe, expect, test } from "vitest";
import { normImpact } from "../scripts/v0/types.ts";
import { scoredContactImpactFromRedir } from "../scripts/v0/trajectory/scored_contact_impact.ts";

describe("study scored contact impact", () => {
  test("reports the production impact metric without making it a selector", () => {
    const outcome = scoredContactImpactFromRedir({
      target: 0.7,
      landingFrame: 42,
      responseWindowComplete: true,
      redirArcPx: 4.2,
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
    expect(scoredContactImpactFromRedir({
      target: 0.7,
      landingFrame: 42,
      responseWindowComplete: false,
      redirArcPx: 4.2,
    })).toMatchObject({ availability: "response_window_unavailable", achieved: null, residual: null });
  });
});
