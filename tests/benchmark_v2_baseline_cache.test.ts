import { describe, expect, it } from "vitest";
import {
  baselineCachePlan,
  readBaselineCache,
  seedScheduleAtDepth,
  verifyBaselineCache,
} from "../scripts/v0/benchmark_v2/baseline_cache.ts";
import { buildWorkerTasks } from "../scripts/v0/benchmark_v2/runner.ts";
import { assertEvalArguments } from "../scripts/v0/benchmark_v2/eval.ts";

describe("canonical baseline cache fixed-N plans", () => {
  it("makes N=37, N=83, and N=251 deterministic prefix plans without compiler work", () => {
    const cache = readBaselineCache();
    // This checks the retained v9 anchor byte-for-byte once; the rest of the
    // test is pure planning and therefore is safe to run before any costly
    // extension or candidate compile.
    verifyBaselineCache(cache, 48);

    const n37 = baselineCachePlan(cache, 37);
    const n83 = baselineCachePlan(cache, 83);
    const n251 = baselineCachePlan(cache, 251);
    expect(n37).toMatchObject({ requestedSeeds: 37, coveredSeeds: 37, missingBaselineSeeds: 0 });
    expect(n83).toMatchObject({ requestedSeeds: 83, coveredSeeds: 48, missingBaselineSeeds: 35 });
    expect(n251).toMatchObject({ requestedSeeds: 251, coveredSeeds: 48, missingBaselineSeeds: 203 });
    expect(n37.candidateCompiles).toBe(37 * n37.developmentSources * n37.budgets.length);
    expect(n83.missingBaselineCompiles).toBe(35 * n83.developmentSources * n83.budgets.length);
    expect(n251.missingBaselineCompiles).toBe(203 * n251.developmentSources * n251.budgets.length);
  });

  it("keeps every historical 48-slot seed and allocates disjoint stable tails", () => {
    const cache = readBaselineCache();
    const n37 = seedScheduleAtDepth(cache.cache, 37);
    const n83 = seedScheduleAtDepth(cache.cache, 83);
    const n251 = seedScheduleAtDepth(cache.cache, 251);
    for (const [index, budget] of n37.byBudget.entries()) {
      expect(n83.byBudget[index].actualSeeds.slice(0, 37)).toEqual(budget.actualSeeds);
      expect(n251.byBudget[index].actualSeeds.slice(0, 83)).toEqual(n83.byBudget[index].actualSeeds);
    }
    const all = n251.byBudget.flatMap((entry) => entry.actualSeeds);
    expect(new Set(all).size).toBe(all.length);
  });

  it("hands a tail extension only its missing seed slots", () => {
    const schedule = seedScheduleAtDepth(readBaselineCache().cache, 83);
    const tasks = buildWorkerTasks(
      schedule,
      [{ id: "case-a" }, { id: "case-b" }],
      "development",
      0,
      { sourceManifestPath: "source", heldoutManifestPath: "heldout" },
      83,
      48,
    );
    expect(tasks).toHaveLength((83 - 48) * schedule.byBudget.length * 2);
    expect(Math.min(...tasks.map((task) => task.seedSlot))).toBe(48);
    expect(Math.max(...tasks.map((task) => task.seedSlot))).toBe(82);
  });

  it("accepts fixed-N eval syntax and rejects an ambiguous legacy depth", () => {
    expect(() => assertEvalArguments(["--to-verdict", "--seeds=83"])).not.toThrow();
    expect(() => assertEvalArguments(["--to-verdict", "--seeds=83", "--depth=83"])).toThrow(/mutually exclusive/);
  });
});
