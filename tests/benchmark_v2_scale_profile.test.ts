import { describe, expect, test } from "vitest";
import {
  assertMultiBudgetExecutionScope,
  loadMultiBudgetProfile,
  multiBudgetSeeds,
  resolveMultiBudgetSources,
  summarizeScalePanel,
  type ScaleScoredRun,
} from "../scripts/v0/benchmark_v2/scale_profile.ts";
import {
  loadSourceManifest,
  resolveSources,
} from "../scripts/v0/benchmark_v2/model.ts";

const PROFILE_PATH = "benchmark/v2/scale-profile.json";

describe("Benchmark V2 compact multi-budget profile", () => {
  test("loads the frozen source, budget, and repeated-seed contract", () => {
    const { profile, fingerprint } = loadMultiBudgetProfile(PROFILE_PATH);

    expect(profile.id).toBe("compact-budget-response-v1");
    expect(profile.sources).toHaveLength(8);
    expect(profile.sources.map((source) => source.id)).toEqual([
      "countercurrent",
      "offgrid_conversation",
      "rising_switch",
      "amplitude_tides",
      "dense_dialogue",
      "frontier_pickup_progression",
      "frontier_dense_recovery",
      "frontier_low_air_endurance",
    ]);
    expect(profile.budgets.map((budget) => budget.frames)).toEqual([
      150_000,
      250_000,
      500_000,
      750_000,
      1_000_000,
      1_500_000,
      2_500_000,
      4_000_000,
    ]);
    expect(multiBudgetSeeds(profile, 4)).toEqual([14_016, 14_017, 14_018, 14_019]);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  test("requires the exact budget grid and a shared contiguous seed prefix", () => {
    const { profile } = loadMultiBudgetProfile(PROFILE_PATH);
    const budgets = profile.budgets.map((budget) => budget.frames);

    expect(() => assertMultiBudgetExecutionScope(profile, budgets, multiBudgetSeeds(profile, 8)))
      .not.toThrow();
    expect(() => assertMultiBudgetExecutionScope(profile, budgets.slice(1), multiBudgetSeeds(profile, 8)))
      .toThrow(/frozen budget grid/);
    expect(() => assertMultiBudgetExecutionScope(profile, budgets, [0, 1, 2, 3]))
      .toThrow(/frozen shared prefix/);
  });

  test("resolves only existing development sources from the prepared V2 catalog", () => {
    const { profile } = loadMultiBudgetProfile(PROFILE_PATH);
    const catalog = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
    const selected = resolveMultiBudgetSources(profile, catalog);

    expect(selected.map((source) => source.id)).toEqual(profile.sources.map((source) => source.id));
    expect(selected.every((source) => source.role !== "qualification_reference")).toBe(true);
  });

  test("aggregates seeds geometrically, then sources and budgets by declared weights", () => {
    const { profile } = loadMultiBudgetProfile(PROFILE_PATH);
    const runs: ScaleScoredRun[] = profile.budgets.flatMap(({ frames }, budgetIndex) =>
      profile.sources.flatMap((source, sourceIndex) => [0, 1].map((seedIndex) => ({
        sourceId: source.id,
        budget: frames,
        actualSeed: 14_016 + seedIndex,
        score: {
          score: 100 + 10 * budgetIndex + sourceIndex,
          valid: !(budgetIndex === 0 && sourceIndex === 0 && seedIndex === 0),
        },
      }))),
    );

    const panel = summarizeScalePanel(runs, profile);
    expect(panel.budgets).toHaveLength(8);
    expect(panel.budgets[0]?.score).toBe(103.5);
    expect(panel.budgets[7]?.score).toBe(173.5);
    expect(panel.scaleHeadline).toBe(138.5);
    expect(panel.validRuns).toBe(127);
    expect(panel.totalRuns).toBe(128);
  });
});
