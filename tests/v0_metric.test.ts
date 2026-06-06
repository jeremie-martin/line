import { describe, expect, test } from "vitest";
import {
  pairedBootstrapCI,
  parseBudgetList,
  suiteFromGroups,
  weightedBudgetScore,
  type BudgetWeight,
  type CurvePoint,
  type ScoreCube,
  type ValidCube,
} from "../scripts/v0/metric.ts";
import { budgetWeights } from "../scripts/v0/golden_suite.ts";
import { shiftedGeometricMean } from "../scripts/v0/score.ts";

const BUDGETS = [50_000, 100_000, 200_000];
const WEIGHTS: BudgetWeight[] = budgetWeights(BUDGETS);

function pts(scores: number[], budgets = BUDGETS): CurvePoint[] {
  return budgets.map((budget, i) => ({ budget, score: scores[i] }));
}

function scoreCube(specs: string[], seeds: number[], f: (spec: string, seed: number, budget: number) => number): ScoreCube {
  const cube: ScoreCube = new Map();
  for (const spec of specs) {
    const bySeed = new Map<number, Map<number, number>>();
    for (const seed of seeds) {
      const byBudget = new Map<number, number>();
      for (const b of BUDGETS) byBudget.set(b, f(spec, seed, b));
      bySeed.set(seed, byBudget);
    }
    cube.set(spec, bySeed);
  }
  return cube;
}

function validCube(specs: string[], seeds: number[], f: (spec: string) => boolean): ValidCube {
  const cube: ValidCube = new Map();
  for (const spec of specs) {
    const bySeed = new Map<number, Map<number, boolean>>();
    for (const seed of seeds) {
      const byBudget = new Map<number, boolean>();
      for (const b of BUDGETS) byBudget.set(b, f(spec));
      bySeed.set(seed, byBudget);
    }
    cube.set(spec, bySeed);
  }
  return cube;
}

describe("weightedBudgetScore", () => {
  test("weights are proportional to budget value — the largest budget dominates", () => {
    // {50,100,200}k -> normalized weights {1/7, 2/7, 4/7}. Improving the TOP budget
    // raises the headline more than the same improvement at the cheapest budget.
    const improveTop = weightedBudgetScore(pts([300, 300, 400]), WEIGHTS);
    const improveBottom = weightedBudgetScore(pts([400, 300, 300]), WEIGHTS);
    expect(improveTop).toBeGreaterThan(improveBottom);
  });

  test("a uniformly higher curve scores exactly +delta higher", () => {
    const a = weightedBudgetScore(pts([300, 350, 400]), WEIGHTS);
    const b = weightedBudgetScore(pts([350, 400, 450]), WEIGHTS);
    expect(b - a).toBeCloseTo(50, 9);
  });

  test("explicit weighted mean matches Σw·s/Σw", () => {
    const scores = [300, 360, 600];
    const sumW = WEIGHTS.reduce((s, w) => s + w.weight, 0);
    const expected = WEIGHTS.reduce((s, w, i) => s + w.weight * scores[i], 0) / sumW;
    expect(weightedBudgetScore(pts(scores), WEIGHTS)).toBeCloseTo(expected, 9);
  });

  test("a budget SUBSET renormalizes over the weights actually used", () => {
    // Only the 50k and 200k points present: divisor is w50+w200, not the full sum.
    const subset = [
      { budget: 50_000, score: 300 },
      { budget: 200_000, score: 600 },
    ];
    const w50 = WEIGHTS.find((w) => w.budget === 50_000)!.weight;
    const w200 = WEIGHTS.find((w) => w.budget === 200_000)!.weight;
    const expected = (w50 * 300 + w200 * 600) / (w50 + w200);
    expect(weightedBudgetScore(subset, WEIGHTS)).toBeCloseTo(expected, 9);
  });
});

describe("CLI value validators", () => {
  test("parseBudgetList rejects 'k'-suffixed / non-integer / non-positive (no silent parseInt)", () => {
    expect(parseBudgetList("50000,100000")).toEqual([50_000, 100_000]);
    expect(() => parseBudgetList("50k,100k")).toThrow(); // would silently become 50/100 with parseInt
    expect(() => parseBudgetList("abc")).toThrow();
    expect(() => parseBudgetList("50000.5")).toThrow();
    expect(() => parseBudgetList("-5")).toThrow();
  });
});

describe("suiteFromGroups", () => {
  test("is geomean-over-seeds then geomean-over-specs (parity contract with golden.ts)", () => {
    const groups = [
      [400, 200],
      [300, 300],
      [0, 600],
    ];
    const expected = shiftedGeometricMean(groups.map((g) => shiftedGeometricMean(g)));
    expect(suiteFromGroups(groups)).toBeCloseTo(expected, 9);
    const higher = groups.map((g) => g.map((v) => v + 50));
    expect(suiteFromGroups(higher)).toBeGreaterThan(suiteFromGroups(groups));
  });
});

describe("pairedBootstrapCI", () => {
  const specs = ["a", "b", "c", "d", "e"];
  const seeds = [0, 1, 2, 3];

  test("a large broad gain is accepted with CI clear of zero", () => {
    const base = scoreCube(specs, seeds, () => 300);
    const cand = scoreCube(specs, seeds, () => 500);
    const d = pairedBootstrapCI(base, cand, BUDGETS, { weightByBudget: WEIGHTS, B: 500, rngSeed: 1 });
    expect(d.verdict).toBe("accept");
    expect(d.ciLo).toBeGreaterThan(0);
    expect(d.pLeZero).toBe(0);
    expect(d.baseHeadline).toBeCloseTo(300, 5);
    expect(d.candidateHeadline).toBeCloseTo(500, 5);
    expect(d.delta).toBeCloseTo(200, 5);
  });

  test("no real change is inconclusive, not accepted", () => {
    const base = scoreCube(specs, seeds, () => 300);
    const cand = scoreCube(specs, seeds, () => 300);
    const d = pairedBootstrapCI(base, cand, BUDGETS, { weightByBudget: WEIGHTS, B: 500, rngSeed: 1 });
    expect(d.verdict).toBe("inconclusive");
    expect(d.ciLo).toBeLessThanOrEqual(0);
  });

  test("a purely negative change is rejected", () => {
    const base = scoreCube(specs, seeds, () => 500);
    const cand = scoreCube(specs, seeds, () => 300);
    const d = pairedBootstrapCI(base, cand, BUDGETS, { weightByBudget: WEIGHTS, B: 500, rngSeed: 1 });
    expect(d.verdict).toBe("reject");
    expect(d.ciHi).toBeLessThan(0);
  });

  test("validity is REPORTED but does NOT gate the verdict (a quality gain still accepts)", () => {
    const base = scoreCube(specs, seeds, () => 300);
    const cand = scoreCube(specs, seeds, () => 500);
    const vBase = validCube(specs, seeds, () => true);
    const vCand = validCube(specs, seeds, (spec) => spec !== "a"); // spec a now fails
    const d = pairedBootstrapCI(base, cand, BUDGETS, {
      weightByBudget: WEIGHTS,
      B: 500,
      rngSeed: 1,
      validBase: vBase,
      validCand: vCand,
    });
    expect(d.ciLo).toBeGreaterThan(0);
    expect(d.verdict).toBe("accept"); // validity regression does NOT veto anymore
    // ...but the regression is visible in the reported per-budget validity rates.
    expect(d.validity.length).toBe(BUDGETS.length);
    for (const v of d.validity) expect(v.candRate).toBeLessThan(v.baseRate);
  });

  test("fixed rngSeed is reproducible", () => {
    const base = scoreCube(specs, seeds, (s, se) => 300 + se * 10);
    const cand = scoreCube(specs, seeds, (s, se) => 320 + se * 10);
    const a = pairedBootstrapCI(base, cand, BUDGETS, { weightByBudget: WEIGHTS, B: 500, rngSeed: 7 });
    const b = pairedBootstrapCI(base, cand, BUDGETS, { weightByBudget: WEIGHTS, B: 500, rngSeed: 7 });
    expect(a.ciLo).toBe(b.ciLo);
    expect(a.ciHi).toBe(b.ciHi);
  });
});
