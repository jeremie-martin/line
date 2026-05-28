import { describe, expect, test } from "vitest";
import { compile } from "../scripts/v0/compile.ts";
import { scoreDriftReport } from "../scripts/v0/score.ts";
import type { Spec } from "../scripts/v0/types.ts";

const TRIVIAL: Spec = { duration: 1, contacts: [], sections: [] };

function score(spec: Spec, budgetUnits: number) {
  return compile(spec, {
    seed: 0,
    strategy: "lds",
    budget: { kind: "work", units: budgetUnits },
  });
}

function expectPrefixSubset(shorter: string[], longer: string[]): void {
  expect(longer.slice(0, shorter.length)).toEqual(shorter);
}

describe("v0 LDS anytime properties", () => {
  test("budgeted compiles are deterministic including stats", () => {
    const a = score(TRIVIAL, 10_000);
    const b = score(TRIVIAL, 10_000);

    expect(a.track).toEqual(b.track);
    expect(a.report).toEqual(b.report);
    expect(a.stats).toEqual(b.stats);
  });

  test("higher budgets evaluate a scored-leaf prefix superset", () => {
    const low = score(TRIVIAL, 1);
    const mid = score(TRIVIAL, 10_000);
    const high = score(TRIVIAL, 20_000);

    expect(low.stats.mandatory_prelude_units).toBeGreaterThan(0);
    expectPrefixSubset(low.stats.scored_leaf_fingerprints, mid.stats.scored_leaf_fingerprints);
    expectPrefixSubset(mid.stats.scored_leaf_fingerprints, high.stats.scored_leaf_fingerprints);
  });

  test("best-so-far score is non-decreasing with budget", () => {
    const budgets = [1, 10_000, 20_000];
    const scores = budgets.map((budget) => scoreDriftReport(score(TRIVIAL, budget).report));

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i].score).toBeGreaterThanOrEqual(scores[i - 1].score);
      if (scores[i].passed && scores[i - 1].passed) {
        expect(scores[i].axis_quality).toBeGreaterThanOrEqual(scores[i - 1].axis_quality);
      }
    }
  });

  test("mandatory prelude preserves legacy coverage floor", () => {
    const legacy = compile(TRIVIAL, 0);
    const lds = score(TRIVIAL, 1);

    expect(lds.report.contacts).toEqual(legacy.report.contacts);
    expect(lds.report.terminus).toEqual(legacy.report.terminus);
    expect(lds.stats.mandatory_prelude_units).toBeGreaterThan(0);
  });
});
