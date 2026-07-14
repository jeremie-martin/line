import { describe, expect, test } from "vitest";
import { IMPACT_WINDOW } from "../scripts/v0/types.ts";
import {
  planStateSupportResponse,
  STATE_SUPPORT_RESPONSE_ACTIONS,
  STATE_SUPPORT_RESPONSE_THRESHOLD_ACTIONS,
  stateSupportResponseActions,
} from "../scripts/v0/trajectory/state_support_response.ts";

const response = {
  eventFrame: 100,
  supportStartFrame: 100 + IMPACT_WINDOW + 1,
  anchor: {
    reference: { x: 20, y: 30 },
    headingDeg: -12,
    speedPxPerFrame: 11,
    sledSpanPx: 18,
    anchorPoint: "TAIL" as const,
    headingSource: "reference_point_velocity" as const,
  },
  prefix: {
    startFrame: 100,
    endFrameExclusive: 100 + IMPACT_WINDOW + 1,
    measurementSamples: IMPACT_WINDOW + 1,
    airborneSamples: 0,
  },
};

describe("state-support response action stencil", () => {
  test("is fixed, non-redundant, and symmetric around a single neutral action", () => {
    expect(STATE_SUPPORT_RESPONSE_ACTIONS.map((action) => action.id)).toEqual([
      "neutral",
      "grade_negative",
      "grade_positive",
      "grade_negative_early",
      "grade_negative_late",
      "grade_positive_early",
      "grade_positive_late",
    ]);
    const pairs: Array<[string, string]> = [
      ["grade_negative", "grade_positive"],
      ["grade_negative_early", "grade_positive_early"],
      ["grade_negative_late", "grade_positive_late"],
    ];
    for (const [negativeId, positiveId] of pairs) {
      const negative = STATE_SUPPORT_RESPONSE_ACTIONS.find((action) => action.id === negativeId)!;
      const positive = STATE_SUPPORT_RESPONSE_ACTIONS.find((action) => action.id === positiveId)!;
      expect(negative.gradeResidualDeg).toBe(-positive.gradeResidualDeg);
      expect(negative.curvatureSkew).toBe(positive.curvatureSkew);
    }
  });

  test("uses only exact response state and a fixed horizon", () => {
    const action = STATE_SUPPORT_RESPONSE_ACTIONS.find((candidate) => candidate.id === "grade_positive_late")!;
    const plan = planStateSupportResponse(response, 12, action);
    expect(plan.intervalFrames).toBe(12);
    expect(plan.supportIntervals + plan.plannedAirborneIntervals).toBe(12);
    expect(plan.plannedExtentPx).toBe(132);
    expect(plan.meanGradeDeg).toBe(4);
    expect(plan.curvaturePower).toBe(2);
    expect(plan.anchor).not.toBe(response.anchor);
    expect(plan.anchor.reference).not.toBe(response.anchor.reference);
  });

  test("keeps the threshold refinement one-dimensional and source-declared", () => {
    expect(stateSupportResponseActions("coarse-v1")).toBe(STATE_SUPPORT_RESPONSE_ACTIONS);
    expect(stateSupportResponseActions("threshold-v1")).toBe(STATE_SUPPORT_RESPONSE_THRESHOLD_ACTIONS);
    expect(STATE_SUPPORT_RESPONSE_THRESHOLD_ACTIONS.map((action) => [action.gradeResidualDeg, action.curvatureSkew]))
      .toEqual([[-8, 0], [-4, 0], [0, 0], [4, 0], [8, 0]]);
  });

  test("fails closed for an invalid physical horizon", () => {
    expect(() => planStateSupportResponse(response, 0, STATE_SUPPORT_RESPONSE_ACTIONS[0]!))
      .toThrow(/positive safe integer/);
  });
});
