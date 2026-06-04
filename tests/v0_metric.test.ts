import { describe, expect, test } from "vitest";
import {
  ceilingAt,
  headlineScore,
  logAUC,
  pairedBootstrapCI,
  parseAlpha,
  parseBudgetList,
  selectScoreBudgets,
  suiteFromGroups,
  type CurvePoint,
  type ScoreCube,
  type ValidCube,
} from "../scripts/v0/metric.ts";
import { shiftedGeometricMean } from "../scripts/v0/score.ts";

const BUDGETS = [50_000, 100_000, 200_000];

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

describe("logAUC", () => {
  test("grid-invariance: refining a grid on the same log-linear curve is unchanged", () => {
    const f = (budget: number) => 50 + 30 * Math.log(budget);
    const coarse = logAUC([50_000, 200_000].map((b) => ({ budget: b, score: f(b) })));
    const fine = logAUC([50_000, 100_000, 200_000].map((b) => ({ budget: b, score: f(b) })));
    expect(Math.abs(coarse - fine)).toBeLessThan(1e-6);
  });

  test("monotonicity: a uniformly higher curve has higher logAUC", () => {
    const a = logAUC(pts([300, 350, 400]));
    const b = logAUC(pts([350, 400, 450]));
    expect(b).toBeGreaterThan(a);
    expect(Math.abs(b - a - 50)).toBeLessThan(1e-6); // +50 everywhere -> +50 logAUC
  });
});

describe("headlineScore", () => {
  test("ceilingAt picks the max-budget score", () => {
    expect(ceilingAt(pts([300, 400, 500]))).toBe(500);
  });

  test("alpha=1 reduces to ceiling, alpha=0 reduces to logAUC", () => {
    const p = pts([300, 400, 500]);
    expect(headlineScore(p, 1).score).toBeCloseTo(ceilingAt(p), 9);
    expect(headlineScore(p, 0).score).toBeCloseTo(logAUC(p), 9);
  });

  test("FAILURE MODE 1: a slow-but-higher-ceiling curve beats an early plateau", () => {
    const plateau = headlineScore(pts([400, 410, 410])); // great early, low ceiling
    const climber = headlineScore(pts([200, 350, 500])); // slow start, high ceiling
    expect(climber.score).toBeGreaterThan(plateau.score);
  });

  test("FAILURE MODE 2: a single-budget spike does not beat a monotone curve", () => {
    const spike = headlineScore(pts([0, 600, 0])); // huge mid spike, nothing at the ceiling
    const monotone = headlineScore(pts([300, 400, 450]));
    expect(monotone.score).toBeGreaterThan(spike.score);
  });
});

describe("selectScoreBudgets", () => {
  test("default = all; subset keeps only present budgets", () => {
    expect(selectScoreBudgets(BUDGETS)).toEqual(BUDGETS);
    expect(selectScoreBudgets(BUDGETS, [100_000, 999_999])).toEqual([100_000]);
  });
});

describe("CLI value validators", () => {
  test("parseAlpha accepts [0,1] and rejects NaN / out-of-range", () => {
    expect(parseAlpha("0.7")).toBe(0.7);
    expect(parseAlpha("0")).toBe(0);
    expect(parseAlpha("1")).toBe(1);
    expect(() => parseAlpha("fast")).toThrow();
    expect(() => parseAlpha("1.5")).toThrow();
    expect(() => parseAlpha("-0.1")).toThrow();
  });

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
    // a uniformly higher group set scores strictly higher (no aggregation inversion)
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
    const d = pairedBootstrapCI(base, cand, BUDGETS, { B: 500, rngSeed: 1 });
    expect(d.verdict).toBe("accept");
    expect(d.ciLo).toBeGreaterThan(0);
    expect(d.pLeZero).toBe(0);
    expect(d.delta).toBeCloseTo(200, 5);
  });

  test("no real change is inconclusive, not accepted", () => {
    const base = scoreCube(specs, seeds, () => 300);
    const cand = scoreCube(specs, seeds, () => 300);
    const d = pairedBootstrapCI(base, cand, BUDGETS, { B: 500, rngSeed: 1 });
    expect(d.verdict).toBe("inconclusive");
    expect(d.ciLo).toBeLessThanOrEqual(0);
  });

  test("a validity regression vetoes a quality gain", () => {
    const base = scoreCube(specs, seeds, () => 300);
    const cand = scoreCube(specs, seeds, () => 500);
    const vBase = validCube(specs, seeds, () => true);
    const vCand = validCube(specs, seeds, (spec) => spec !== "a"); // spec a now fails
    const d = pairedBootstrapCI(base, cand, BUDGETS, {
      B: 500,
      rngSeed: 1,
      validBase: vBase,
      validCand: vCand,
    });
    expect(d.ciLo).toBeGreaterThan(0); // quality genuinely improved
    expect(d.verdict).toBe("reject"); // but validity regressed -> veto
  });

  test("fixed rngSeed is reproducible", () => {
    const base = scoreCube(specs, seeds, (s, se) => 300 + se * 10);
    const cand = scoreCube(specs, seeds, (s, se) => 320 + se * 10);
    const a = pairedBootstrapCI(base, cand, BUDGETS, { B: 500, rngSeed: 7 });
    const b = pairedBootstrapCI(base, cand, BUDGETS, { B: 500, rngSeed: 7 });
    expect(a.ciLo).toBe(b.ciLo);
    expect(a.ciHi).toBe(b.ciHi);
  });
});
