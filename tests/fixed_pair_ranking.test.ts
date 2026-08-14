import { describe, expect, test } from "vitest";
import {
  selectIncumbentFirstChallengerSecond,
  selectIncumbentFirstGuardedChallengerSecond,
} from "../scripts/v0/optimizer/fixed_pair_ranking.ts";

type Candidate = {
  id: string;
  cluster: string;
  incumbentImpact?: number;
  incumbentUtility?: number;
  residualImpact?: number;
};

const distinct = (
  candidate: Candidate,
  selected: readonly Candidate[],
): boolean => selected.every((prior) => prior.cluster !== candidate.cluster);

describe("incumbent-first challenger-second ranking", () => {
  test("changes only the second slot and then resumes incumbent order", () => {
    const a = { id: "a", cluster: "a" };
    const b = { id: "b", cluster: "b" };
    const c = { id: "c", cluster: "c" };
    const result = selectIncumbentFirstChallengerSecond(
      [a, b, c],
      [c, b, a],
      3,
      distinct,
    );

    expect(result.incumbentSelected).toEqual([a, b, c]);
    expect(result.selected).toEqual([a, c, b]);
    expect(result.eligible).toBe(true);
    expect(result.substitutedSecond).toBe(true);
    expect(result.challengerDistinctnessRejections).toBe(0);
  });

  test("counts challenger rows rejected by geometric distinctness", () => {
    const a = { id: "a", cluster: "same" };
    const near = { id: "near", cluster: "same" };
    const b = { id: "b", cluster: "b" };
    const result = selectIncumbentFirstChallengerSecond(
      [a, b, near],
      [near, a, b],
      2,
      distinct,
    );

    expect(result.selected).toEqual([a, b]);
    expect(result.substitutedSecond).toBe(false);
    expect(result.challengerDistinctnessRejections).toBe(2);
  });

  test("leaves a one-choice selection unchanged and ineligible", () => {
    const a = { id: "a", cluster: "a" };
    const result = selectIncumbentFirstChallengerSecond(
      [a],
      [a],
      2,
      distinct,
    );

    expect(result.selected).toEqual([a]);
    expect(result.eligible).toBe(false);
    expect(result.substitutedSecond).toBe(false);
  });

  test("rejects candidates outside the incumbent domain", () => {
    const a = { id: "a", cluster: "a" };
    const b = { id: "b", cluster: "b" };
    const foreign = { id: "foreign", cluster: "foreign" };
    expect(() =>
      selectIncumbentFirstChallengerSecond(
        [a, b],
        [foreign, b, a],
        2,
        distinct,
      )
    ).toThrow(/foreign candidate/);
  });
});

const guardedScores = (candidate: Candidate) => ({
  incumbentImpact: candidate.incumbentImpact ?? 0,
  incumbentUtility: candidate.incumbentUtility ?? 0,
  residualImpact: candidate.residualImpact ?? 0,
});
const guardedThresholds = {
  maximumIncumbentImpactRegret: 0.01,
  maximumIncumbentUtilityRegret: 0.01,
  minimumResidualImpactAdvantage: 0.02,
};

describe("guarded incumbent-first challenger-second ranking", () => {
  const candidates = () => {
    const a = {
      id: "a", cluster: "a", incumbentImpact: 0.90,
      incumbentUtility: 0.90, residualImpact: 0.80,
    };
    const b = {
      id: "b", cluster: "b", incumbentImpact: 0.80,
      incumbentUtility: 0.80, residualImpact: 0.70,
    };
    const c = {
      id: "c", cluster: "c", incumbentImpact: 0.795,
      incumbentUtility: 0.795, residualImpact: 0.73,
    };
    return { a, b, c };
  };

  test("substitutes only the second choice when every gate passes", () => {
    const { a, b, c } = candidates();
    const result = selectIncumbentFirstGuardedChallengerSecond(
      [a, b, c], [c, b, a], 3, distinct, guardedScores, guardedThresholds,
    );

    expect(result.incumbentSelected).toEqual([a, b, c]);
    expect(result.selected).toEqual([a, c, b]);
    expect(result.challengerDiffered).toBe(true);
    expect(result.substitutedSecond).toBe(true);
    expect(result.gate).toEqual({
      incumbentImpactRegret: 0.0050000000000000044,
      incumbentUtilityRegret: 0.0050000000000000044,
      residualImpactAdvantage: 0.030000000000000027,
      impactRegretPassed: true,
      utilityRegretPassed: true,
      residualAdvantagePassed: true,
      accepted: true,
    });
  });

  test.each([
    ["impact regret", { incumbentImpact: 0.78, incumbentUtility: 0.80, residualImpact: 0.73 }, "impactRegretPassed"],
    ["utility regret", { incumbentImpact: 0.80, incumbentUtility: 0.78, residualImpact: 0.73 }, "utilityRegretPassed"],
    ["residual advantage", { incumbentImpact: 0.80, incumbentUtility: 0.80, residualImpact: 0.719 }, "residualAdvantagePassed"],
  ] as const)("retains the complete incumbent list on a failed %s gate", (_label, override, gate) => {
    const { a, b, c } = candidates();
    Object.assign(c, override);
    const result = selectIncumbentFirstGuardedChallengerSecond(
      [a, b, c], [c, b, a], 3, distinct, guardedScores, guardedThresholds,
    );

    expect(result.selected).toEqual([a, b, c]);
    expect(result.challengerDiffered).toBe(true);
    expect(result.substitutedSecond).toBe(false);
    expect(result.gate?.[gate]).toBe(false);
    expect(result.gate?.accepted).toBe(false);
  });

  test("accepts exact threshold boundaries", () => {
    const { a, b, c } = candidates();
    Object.assign(c, {
      incumbentImpact: 0.79,
      incumbentUtility: 0.79,
      residualImpact: 0.72,
    });
    const result = selectIncumbentFirstGuardedChallengerSecond(
      [a, b, c], [c, b, a], 2, distinct, guardedScores, guardedThresholds,
    );

    expect(result.substitutedSecond).toBe(true);
    expect(result.gate?.accepted).toBe(true);
  });

  test("does not run the gate when the challenger keeps the incumbent second", () => {
    const { a, b, c } = candidates();
    const result = selectIncumbentFirstGuardedChallengerSecond(
      [a, b, c], [b, c, a], 2, distinct, guardedScores, guardedThresholds,
    );

    expect(result.selected).toEqual([a, b]);
    expect(result.challengerDiffered).toBe(false);
    expect(result.gate).toBeNull();
  });

  test("rejects invalid thresholds and candidate scores", () => {
    const { a, b, c } = candidates();
    expect(() => selectIncumbentFirstGuardedChallengerSecond(
      [a, b, c], [c, b, a], 2, distinct, guardedScores,
      { ...guardedThresholds, minimumResidualImpactAdvantage: -1 },
    )).toThrow(/finite non-negative/);
    c.residualImpact = Number.NaN;
    expect(() => selectIncumbentFirstGuardedChallengerSecond(
      [a, b, c], [c, b, a], 2, distinct, guardedScores, guardedThresholds,
    )).toThrow(/must be finite/);
  });
});
