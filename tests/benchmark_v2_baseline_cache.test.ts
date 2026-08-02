import { describe, expect, it } from "vitest";
import {
  baselineCachePlan,
  baselineCacheHeadlineAtDepth,
  cacheCoverage,
  readBaselineCache,
  seedScheduleAtDepth,
  verifyBaselineCache,
} from "../scripts/v0/benchmark_v2/baseline_cache.ts";
import { buildWorkerTasks } from "../scripts/v0/benchmark_v2/runner.ts";
import { assertEvalArguments } from "../scripts/v0/benchmark_v2/eval.ts";
import { decisionProtocolFingerprint } from "../scripts/v0/benchmark_v2/decision_protocol.ts";
import { readFileSync } from "node:fs";

describe("canonical baseline cache fixed-N plans", () => {
  it("uses the active scorer-bound 750k campaign archive with a four-look N=48 maximum", () => {
    const cache = readBaselineCache();
    const reference = JSON.parse(readFileSync("benchmark/v2/campaign-baseline.json", "utf8"));
    expect(cache.campaignScope).toEqual({
      budgets: [750_000],
      maximumSeeds: 48,
      promotionSeeds: 48,
      looks: [8, 16, 32, 48],
      targetHeadline: 650,
      sequentialPolicyFingerprint: reference.sequential_eval_policy_fingerprint,
      sequentialInferenceFingerprint: reference.sequential_eval_inference_fingerprint,
      sequentialCalibrationFingerprint: reference.sequential_eval_calibration_fingerprint,
    });
    const plan = baselineCachePlan(cache, 48);
    verifyBaselineCache(cache, 48);
    expect(plan).toMatchObject({
      requestedSeeds: 48,
      coveredSeeds: 48,
      missingBaselineSeeds: 0,
      budgets: [750_000],
      candidateCompiles: 2_112,
    });
    expect(reference.compiler_source_fingerprint).toBe(
      reference.compiler_snapshot.compilerSourceFingerprint,
    );
    expect(reference.candidate_fingerprint).toBe(
      reference.compiler_snapshot.candidateFingerprint,
    );
    expect(reference.decision_protocol_fingerprint).toBe(decisionProtocolFingerprint());
    expect(baselineCacheHeadlineAtDepth(cache, 48)).toEqual({
      seeds: 48,
      headline: 595.6319,
      validRuns: 2_112,
      totalRuns: 2_112,
    });
  });

  it("plans any N deterministically from the cache prefix, without compiler work", () => {
    const cache = readBaselineCache("benchmark/v2/baseline.json");
    // Coverage is read from the cache rather than hardcoded: a baseline may be
    // frozen at any depth and extended on demand, so pinning a slot count here
    // would assert a property of one particular baseline instead of the
    // planner. What must hold for every N is that planning is pure - it never
    // compiles - and that covered + missing accounts for exactly N.
    const covered = cacheCoverage(cache.cache);
    verifyBaselineCache(cache, Math.min(covered, 48));

    for (const requested of [37, 83, 251]) {
      const plan = baselineCachePlan(cache, requested);
      expect(plan).toMatchObject({
        requestedSeeds: requested,
        coveredSeeds: Math.min(requested, covered),
        missingBaselineSeeds: Math.max(0, requested - covered),
      });
      expect(plan.candidateCompiles).toBe(
        requested * plan.developmentSources * plan.budgets.length,
      );
      expect(plan.missingBaselineCompiles).toBe(
        Math.max(0, requested - covered) * plan.developmentSources *
          plan.budgets.length,
      );
    }
  });

  it("allows a one-seed diagnostic from the same canonical cache prefix", () => {
    const plan = baselineCachePlan(readBaselineCache("benchmark/v2/baseline.json"), 1);
    expect(plan).toMatchObject({
      requestedSeeds: 1,
      coveredSeeds: 1,
      missingBaselineSeeds: 0,
    });
    expect(plan.candidateCompiles).toBe(
      plan.developmentSources * plan.budgets.length,
    );
  });

  it("keeps every historical 48-slot seed and allocates disjoint stable tails", () => {
    const cache = readBaselineCache("benchmark/v2/baseline.json");
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
    const schedule = seedScheduleAtDepth(readBaselineCache("benchmark/v2/baseline.json").cache, 83);
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

  it("accepts fixed-N eval syntax without a registered operating point", () => {
    expect(() => assertEvalArguments(["--seeds=1"])).not.toThrow();
    expect(() => assertEvalArguments(["--seeds=2"])).not.toThrow();
    expect(() => assertEvalArguments(["--seeds=83"])).not.toThrow();
    expect(() => assertEvalArguments(["--to-verdict", "--seeds=83"])).toThrow(/does not accept/);
    expect(() => assertEvalArguments(["--seeds=83", "--depth=83"])).toThrow(/does not accept/);
  });
});
