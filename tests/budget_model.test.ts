import { describe, expect, test } from "vitest";
import {
  predictFirstCompletionFrames,
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
  test("predicts first-completion frames from a spec", () => {
    const expected = 100 + 3 * 10 + 160 * 2;
    expect(predictFirstCompletionFrames(SPEC, TEST_MODEL)).toBe(expected);
  });

  test("reports budget slack as budget divided by predicted first completion", () => {
    expect(traversalBudgetSlack(900, SPEC, TEST_MODEL)).toBeCloseTo(900 / 450);
    expect(traversalBudgetSlack(-1, SPEC, TEST_MODEL)).toBe(0);
  });
});
