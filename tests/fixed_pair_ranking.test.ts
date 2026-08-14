import { describe, expect, test } from "vitest";
import {
  selectIncumbentFirstChallengerSecond,
} from "../scripts/v0/optimizer/fixed_pair_ranking.ts";

type Candidate = { id: string; cluster: string };

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
