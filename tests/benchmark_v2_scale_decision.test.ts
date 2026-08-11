import { describe, expect, test } from "vitest";
import type { CellPair, GridCell } from "../scripts/benchmark/paired_grid.ts";
import {
  pairedScaleComparison,
  scaleDepthCharacterization,
  scaleLookDecision,
} from "../scripts/v0/benchmark_v2/scale_decision.ts";
import {
  loadMultiBudgetProfile,
  multiBudgetSeeds,
  type MultiBudgetProfile,
} from "../scripts/v0/benchmark_v2/scale_profile.ts";

const PROFILE_PATH = "benchmark/v2/scale-profile.json";

describe("Benchmark V2 paired multi-budget decision", () => {
  test("prefers a consistently better candidate at the first declared look", () => {
    const profile = loadMultiBudgetProfile(PROFILE_PATH).profile;
    const pairs = scalePairs(profile, 4, () => 12);

    const result = pairedScaleComparison(pairs, profile, 4);
    expect(result.outcome).toBe("prefer-candidate");
    expect(result.stoppingDepth).toBe(4);
    expect(result.final.delta).toBe(12);
    expect(result.final.confidence.standardError).toBe(0);
    expect(result.final.directionalProbability).toBe(1);
    expect(result.nextLook).toBeNull();
    expect(result.perBudget.every((budget) => budget.delta === 12)).toBe(true);
    expect(result.perSource.every((source) => source.delta === 12)).toBe(true);
    expect(result.canonicalBudget).toMatchObject({ budget: 750_000, delta: 12 });
  });

  test("characterizes a fully run depth without overriding an earlier sequential decision", () => {
    const profile = loadMultiBudgetProfile(PROFILE_PATH).profile;
    const pairs = scalePairs(profile, 16, () => 12);

    const result = pairedScaleComparison(pairs, profile, 16);
    const characterization = scaleDepthCharacterization(pairs, profile, 16);
    expect(result.stoppingDepth).toBe(4);
    expect(result.looks.map((look) => look.depth)).toEqual([4]);
    expect(characterization).toMatchObject({ depth: 16, delta: 12 });
    expect(characterization.validity.total).toBe(1024);
  });

  test("does not invent a preference for identical arms", () => {
    const profile = loadMultiBudgetProfile(PROFILE_PATH).profile;
    const pairs = scalePairs(profile, 16, () => 0);

    const result = pairedScaleComparison(pairs, profile, 16);
    expect(result.outcome).toBe("inconclusive");
    expect(result.stoppingDepth).toBe(16);
    expect(result.looks.map((look) => [look.depth, look.action])).toEqual([
      [4, "continue"],
      [8, "continue"],
      [16, "inconclusive"],
    ]);
    expect(result.final.directionalProbability).toBe(0.5);
    expect(result.changedTracks).toBe(0);
  });

  test("deletes complete seed curves when estimating uncertainty", () => {
    const profile = loadMultiBudgetProfile(PROFILE_PATH).profile;
    const pairs = scalePairs(profile, 4, ({ seed }) => seed % 2 === 0 ? 20 : -10);

    const decision = scaleLookDecision(pairs, profile, 4);
    // The point estimate is not the arithmetic mean delta because the frozen
    // score recomputes the shifted geometric seed aggregate for each cell.
    expect(decision.delta).toBe(4.7275);
    // Four independent seed blocks with deltas 20, -10, 20, -10. Treating
    // the 64 cells in each curve as independent would make this far smaller.
    expect(decision.confidence.standardError).toBeCloseTo(8.6585, 4);
    expect(decision.action).toBe("continue");
  });

  test("reports validity changes without changing the authored-impact score target", () => {
    const profile = loadMultiBudgetProfile(PROFILE_PATH).profile;
    const pairs = scalePairs(profile, 4, ({ sourceId, budget, seed }, ref) => {
      if (sourceId === profile.sources[0]?.id && budget === 150_000 && seed === 14_016) {
        ref.valid = false;
        return 20;
      }
      if (sourceId === profile.sources[1]?.id && budget === 250_000 && seed === 14_017) {
        return -20;
      }
      return 0;
    });
    const gained = pairs.find((pair) =>
      pair.ref.sourceId === profile.sources[0]?.id &&
      pair.ref.budget === 150_000 && pair.ref.seed === 14_016
    )!;
    gained.candidate.valid = true;
    const lost = pairs.find((pair) =>
      pair.ref.sourceId === profile.sources[1]?.id &&
      pair.ref.budget === 250_000 && pair.ref.seed === 14_017
    )!;
    lost.candidate.valid = false;

    const result = pairedScaleComparison(pairs, profile, 4);
    expect(result.validity).toMatchObject({ gained: 1, lost: 1, total: 256 });
    expect(result.perBudget.find((budget) => budget.budget === 150_000)).toMatchObject({ gained: 1 });
    expect(result.perBudget.find((budget) => budget.budget === 250_000)).toMatchObject({ lost: 1 });
  });

  test("rejects an incomplete source-budget-seed panel", () => {
    const profile = loadMultiBudgetProfile(PROFILE_PATH).profile;
    const pairs = scalePairs(profile, 4, () => 0);
    pairs.pop();
    expect(() => pairedScaleComparison(pairs, profile, 4)).toThrow(/needs 256 paired cells/);
  });
});

function scalePairs(
  profile: MultiBudgetProfile,
  depth: number,
  delta: (
    cell: { sourceId: string; budget: number; seed: number },
    reference: GridCell,
  ) => number,
): CellPair[] {
  return profile.sources.flatMap((source, sourceIndex) =>
    profile.budgets.flatMap((budget, budgetIndex) =>
      multiBudgetSeeds(profile, depth).map((seed) => {
        const reference: GridCell = {
          sourceId: source.id,
          budget: budget.frames,
          seed,
          score: 400 + sourceIndex + budgetIndex,
          valid: true,
          trackHash: `reference-${source.id}-${budget.frames}-${seed}`,
          firstCompletionFrame: 100,
          status: "ok",
        };
        const movement = delta({ sourceId: source.id, budget: budget.frames, seed }, reference);
        const candidate: GridCell = {
          ...reference,
          score: reference.score + movement,
          trackHash: movement === 0 ? reference.trackHash : `candidate-${source.id}-${budget.frames}-${seed}`,
        };
        const key = `${source.id}\0${budget.frames}\0${seed}`;
        return { key, ref: reference, candidate };
      }),
    ),
  );
}
