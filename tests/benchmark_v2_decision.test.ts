import { describe, expect, test } from "vitest";
import { pairedV2Decision, type DecisionRun } from "../scripts/v0/benchmark_v2/decision_model.ts";
import type { SuiteManifest } from "../scripts/v0/benchmark_v2/suite_model.ts";

function suite(): SuiteManifest {
  return {
    schema: "line.benchmark-v2.suite.v2",
    status: "selected-canonical-development-suite",
    description: "test",
    strata: [
      { id: "representative", weight: 0.5, groups: [{ id: "a", weight: 1, members: ["a1"] }] },
      { id: "capability", weight: 0.5, groups: [{ id: "b", weight: 1, members: ["b1"] }] },
    ],
    component_weights: { air: 0.3, speed: 0.3, impact: 0.3, amplitude: 0.1 },
    axis_quality_tolerance: 0.25,
    transform: { kind: "production_felt_jolt", jolt_ms: -15 },
    seed_policy: { kind: "budget_disjoint_contiguous", seed_base: 0 },
    profiles: {
      probe: { budgets: [100], seeds_per_budget: 2 },
      canonical: { budgets: [100, 200], seeds_per_budget: 2 },
    },
    budget_weights: [{ budget: 100, weight: 0.25 }, { budget: 200, weight: 0.75 }],
  };
}

function runs(offset: number): DecisionRun[] {
  return ["a1", "b1"].flatMap((sourceId) => [100, 200].flatMap((budget) => [0, 1].map((seedSlot) => ({
    sourceId,
    budget,
    seedSlot,
    actualSeed: seedSlot + (budget === 200 ? 2 : 0),
    score: { score: 500 + budget / 10 + seedSlot + offset, valid: true },
  }))));
}

describe("Benchmark V2 paired decision", () => {
  test("uses identical paired scope and deterministic family-aware resampling", () => {
    const first = pairedV2Decision(runs(0), runs(20), suite(), 2_000, 42);
    const second = pairedV2Decision(runs(0), runs(20), suite(), 2_000, 42);
    expect(first).toEqual(second);
    expect(first.verdict).toBe("accept");
    expect(first.delta).toBeCloseTo(20, 3);
    expect(first.perStratum.every((stratum) => stratum.delta > 0)).toBe(true);
  });

  test("rejects unpaired archives", () => {
    expect(() => pairedV2Decision(runs(0), runs(20).slice(1), suite(), 10)).toThrow(/paired scope/);
    const wrongSeed = structuredClone(runs(20));
    wrongSeed[0].actualSeed = 999;
    expect(() => pairedV2Decision(runs(0), wrongSeed, suite(), 10)).toThrow(/paired scope/);
  });
});
