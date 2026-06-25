import { describe, expect, test } from "vitest";
import {
  predictFirstCompletionFrames,
  predictSuffixCompletionFrames,
  traversalBudgetInputs,
  traversalBudgetSlack,
  TRAVERSAL_BUDGET_MODEL_V1,
} from "../scripts/v0/optimizer/budget_model.ts";
import type { Spec } from "../scripts/v0/types.ts";

const TEST_MODEL = {
  ...TRAVERSAL_BUDGET_MODEL_V1,
  interceptFrames: 100,
  contactFrames: 10,
  durationFrameScale: 2,
};

const SPEC: Spec = {
  duration: 4,
  contacts: [
    { t: 0.05 },
    { t: 0.5 },
    { t: 1.25 },
    { t: 2.0 },
  ],
  axes: {},
};

describe("optimizer/budget_model.ts", () => {
  test("extracts traversal inputs from feasible contacts and authored duration", () => {
    expect(traversalBudgetInputs(SPEC)).toEqual({
      contactCount: 3,
      durationFrames: 160,
    });
  });

  test("predicts first-completion frames from inputs or a spec", () => {
    const expected = 100 + 3 * 10 + 160 * 2;
    expect(predictFirstCompletionFrames({ contactCount: 3, durationFrames: 160 }, TEST_MODEL))
      .toBe(expected);
    expect(predictFirstCompletionFrames(SPEC, TEST_MODEL)).toBe(expected);
  });

  test("predicts suffix cost without charging full-run startup overhead", () => {
    expect(predictSuffixCompletionFrames(SPEC, 0, TEST_MODEL)).toBe(3 * 10 + 160 * 2);
    expect(predictSuffixCompletionFrames(SPEC, 1, TEST_MODEL)).toBe(2 * 10 + (160 - 20) * 2);
    expect(predictSuffixCompletionFrames(SPEC, 3, TEST_MODEL)).toBe((160 - 80) * 2);
  });

  test("clamps suffix anchors to valid gap boundaries", () => {
    expect(predictSuffixCompletionFrames(SPEC, -1, TEST_MODEL))
      .toBe(predictSuffixCompletionFrames(SPEC, 0, TEST_MODEL));
    expect(predictSuffixCompletionFrames(SPEC, Number.NaN, TEST_MODEL))
      .toBe(predictSuffixCompletionFrames(SPEC, 0, TEST_MODEL));
    expect(predictSuffixCompletionFrames(SPEC, 999, TEST_MODEL))
      .toBe(predictSuffixCompletionFrames(SPEC, 3, TEST_MODEL));
  });

  test("reports budget slack as budget divided by predicted first completion", () => {
    expect(traversalBudgetSlack(900, SPEC, TEST_MODEL)).toBeCloseTo(900 / 450);
    expect(traversalBudgetSlack(-1, SPEC, TEST_MODEL)).toBe(0);
  });
});
