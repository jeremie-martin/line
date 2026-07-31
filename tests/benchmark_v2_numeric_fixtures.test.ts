import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  pairedV2Decision,
  studentTQuantile,
  type DecisionRun,
} from "../scripts/v0/benchmark_v2/decision_model.ts";
import {
  BENCHMARK_IMPLEMENTATION_SOURCE_FILES,
  BENCHMARK_SCORING_PROTOCOL_FINGERPRINT,
  fingerprintFiles,
  type SuiteManifest,
} from "../scripts/v0/benchmark_v2/suite_model.ts";

// Independently computed oracle values. The jackknife fixture numbers were
// derived outside this codebase (Python: shifted geometric means, the exact
// per-level 1e-4 rounding, delete-1 pseudovalues); the t quantiles come from
// mpmath (30-digit) and R's qt(); the Wilson intervals from R. A failure here
// means the statistics core changed behavior, not that a constant drifted.

const FROZEN_DEFINITION_FINGERPRINT =
  "c71466608589ae75745608e1a451abe786e835f4ff0fd79314f155747283a3d6";

function fixtureSuite(): SuiteManifest {
  return {
    schema: "line.benchmark-v2.suite.v3",
    status: "selected-canonical-development-suite",
    description: "numeric fixture",
    strata: [{ id: "representative", weight: 1, groups: [{ id: "g", weight: 1, members: ["a", "b"] }] }],
    component_weights: { air: 0.3, speed: 0.3, impact: 0.3, amplitude: 0.1 },
    axis_quality_tolerance: 0.25,
    transform: { kind: "production_felt_jolt", jolt_ms: -15 },
    seed_policy: {
      kind: "profile_budget_disjoint_contiguous",
      profile_seed_bases: { probe: 100, canonical: 0 },
    },
    profiles: {
      probe: { budgets: [250000], seeds_per_budget: 4 },
      canonical: { budgets: [250000], seeds_per_budget: 4 },
    },
    budget_weights: [{ budget: 250000, weight: 1 }],
  };
}

function fixtureRuns(scores: Record<string, number[]>): DecisionRun[] {
  return Object.entries(scores).flatMap(([sourceId, values]) =>
    values.map((score, seedSlot) => ({
      sourceId,
      budget: 250000,
      seedSlot,
      actualSeed: seedSlot,
      score: { score, valid: true },
    }))
  );
}

describe("Benchmark V2 numeric fixtures (external oracles)", () => {
  test("paired seed-block jackknife matches the hand-computed fixture", () => {
    const base = fixtureRuns({ a: [100, 110, 90, 100], b: [200, 190, 210, 200] });
    const candidate = fixtureRuns({ a: [104, 112, 95, 103], b: [206, 196, 213, 209] });
    const decision = pairedV2Decision(base, candidate, fixtureSuite(), {
      profile: "canonical",
      mode: "improvement",
      iterations: 100,
      bootstrapSeed: 1,
    });
    // Point estimates (exact after the model's 1e-4 rounding).
    expect(decision.baseHeadline).toBe(141.2622);
    expect(decision.candidateHeadline).toBe(145.9198);
    expect(decision.delta).toBe(4.6576);
    // Jackknife pseudovalue variance: pseudovalues 4.9453 / 3.6235 / 4.7698 /
    // 5.2987, sample variance 0.5252400825, SE = sqrt(var/4).
    expect(decision.confidence.standardError).toBe(0.3624);
    expect(decision.confidence.degreesOfFreedom).toBe(3);
    // Bounds at the policy criticals: one-sided t(0.99, 3) = 4.5407028586,
    // central t(0.995, 3) = 5.8409093097 (mpmath), applied to the unrounded
    // estimate/SE then rounded at 1e-4.
    expect(decision.confidence.lowerBound).toBe(3.0122);
    expect(decision.confidence.upperBound).toBe(6.303);
    expect(decision.confidence.centralLo).toBe(2.541);
    expect(decision.confidence.centralHi).toBe(6.7742);
    expect(decision.outcome).toBe("accept");
  });

  test("Student-t quantiles match mpmath and R", () => {
    expect(studentTQuantile(0.99, 3)).toBeCloseTo(4.5407028586, 8);
    expect(studentTQuantile(0.995, 3)).toBeCloseTo(5.8409093097, 8);
    expect(studentTQuantile(0.95, 3)).toBeCloseTo(2.3533634348, 8);
    expect(studentTQuantile(0.995, 7)).toBeCloseTo(3.49948, 4);
    expect(studentTQuantile(0.99, 21)).toBeCloseTo(2.51765, 4);
    expect(studentTQuantile(0.99, 14)).toBeCloseTo(2.62449, 4);
    expect(studentTQuantile(0.95, 2)).toBeCloseTo(2.919986, 5);
  });

  test("retained coverage-study Wilson intervals match the R oracle", () => {
    const coverage = JSON.parse(readFileSync("benchmark/v2/studies/decision-coverage.json", "utf8"));
    const rows = [
      ...(coverage.results ?? []),
      ...(coverage.powerResults ?? []),
      ...(coverage.safetyResults ?? []),
      ...(coverage.diagnosticResults ?? []),
    ].filter((row: any) => row.seedsPerBudget === 48);
    const byScenario = new Map(rows.map((row: any) => [row.scenario, row]));
    // R: binom.wilson / prop.test-derived 95% intervals, rounded at 1e-4.
    expect(byScenario.get("empirical_blocks").falseAccept.count).toBe(6);
    expect(byScenario.get("empirical_blocks").falseAccept.wilson95).toEqual([0.0028, 0.013]);
    expect(byScenario.get("empirical_blocks").centralCoverage.count).toBe(998);
    expect(byScenario.get("empirical_blocks").centralCoverage.wilson95).toEqual([0.9927, 0.9995]);
    expect(byScenario.get("symmetric_validity_flips").falseAccept.count).toBe(9);
    expect(byScenario.get("symmetric_validity_flips").falseAccept.wilson95).toEqual([0.0047, 0.017]);
    expect(byScenario.get("empirical_score_gain").positiveOutcome.count).toBe(1000);
    expect(byScenario.get("empirical_score_gain").positiveOutcome.wilson95).toEqual([0.9962, 1]);
    expect(byScenario.get("empirical_score_gain").negativeOutcome.count).toBe(0);
    expect(byScenario.get("empirical_score_gain").negativeOutcome.wilson95).toEqual([0, 0.0038]);
    expect(byScenario.get("paired_empirical_noninferiority_inside").positiveOutcome.count).toBe(919);
    expect(byScenario.get("paired_empirical_noninferiority_inside").positiveOutcome.wilson95).toEqual([0.9004, 0.9344]);
  });

  test("the score protocol is explicit while implementation bytes remain auditable", () => {
    expect(BENCHMARK_SCORING_PROTOCOL_FINGERPRINT).toBe(FROZEN_DEFINITION_FINGERPRINT);
    expect(fingerprintFiles([...BENCHMARK_IMPLEMENTATION_SOURCE_FILES])).toMatch(/^[a-f0-9]{64}$/);
  });
});
