import { describe, expect, test } from "vitest";
import {
  pairedV2CalibrationVerdict,
  pairedV2Decision,
  pairedV2DecisionForCalibration,
  studentTQuantile,
  v2HeadlineForDecisionRuns,
  type DecisionProfile,
  type DecisionRun,
} from "../scripts/v0/benchmark_v2/decision_model.ts";
import type { SuiteManifest, SuiteParent } from "../scripts/v0/benchmark_v2/suite_model.ts";
import {
  summarizeDevelopmentBudget,
  weightedBudgetHeadline,
  type V2RunScore,
} from "../scripts/v0/benchmark_v2/evaluator.ts";

function suite(
  parents: SuiteParent[] = [
    { id: "a", members: ["a", "a_variant"] },
    { id: "b", members: ["b", "b_variant"] },
  ],
): SuiteManifest {
  const members = parents.flatMap((parent) => parent.members);
  return {
    schema: "line.benchmark-v2.suite.v3",
    status: "selected-canonical-development-suite",
    description: "test",
    strata: [{ id: "representative", weight: 1, groups: [{ id: "g", weight: 1, members, parents }] }],
    component_weights: { air: 0.3, speed: 0.3, impact: 0.3, amplitude: 0.1 },
    axis_quality_tolerance: 0.25,
    transform: { kind: "production_felt_jolt", jolt_ms: -15 },
    seed_policy: {
      kind: "profile_budget_disjoint_contiguous",
      profile_seed_bases: { probe: 20, canonical: 0 },
    },
    profiles: {
      probe: { budgets: [100], seeds_per_budget: 3 },
      canonical: { budgets: [100, 200], seeds_per_budget: 3 },
    },
    budget_weights: [{ budget: 100, weight: 0.25 }, { budget: 200, weight: 0.75 }],
  };
}

function runs(
  suiteValue: SuiteManifest,
  profile: DecisionProfile,
  effect: (sourceId: string, budget: number, seedSlot: number) => number,
  base = 500,
): DecisionRun[] {
  const members = suiteValue.strata.flatMap((stratum) => stratum.groups.flatMap((group) => group.members));
  const config = suiteValue.profiles[profile];
  return members.flatMap((sourceId) => config.budgets.flatMap((budget, budgetIndex) =>
    Array.from({ length: config.seeds_per_budget }, (_, seedSlot) => ({
      sourceId,
      budget,
      seedSlot,
      actualSeed: suiteValue.seed_policy.profile_seed_bases[profile] +
        budgetIndex * config.seeds_per_budget + seedSlot,
      score: { score: base + effect(sourceId, budget, seedSlot), valid: true },
    }))
  ));
}

describe("Benchmark V2 decision model", () => {
  test("uses accurate small-sample Student-t critical values", () => {
    expect(studentTQuantile(0.95, 2)).toBeCloseTo(2.919986, 5);
    expect(studentTQuantile(0.975, 3)).toBeCloseTo(3.182446, 5);
    expect(studentTQuantile(0.95, 11)).toBeCloseTo(1.795885, 5);
  });

  test("recomputes the exact nested V2 headline", () => {
    const s = suite();
    const rows = runs(s, "canonical", (sourceId, budget, seedSlot) =>
      sourceId.charCodeAt(0) + budget / 20 + seedSlot * 7 - 120
    );
    const scored = rows.map((run) => ({ ...run, score: fullScore(run.score.score) }));
    const summaries = s.profiles.canonical.budgets.map((budget) =>
      summarizeDevelopmentBudget(scored, budget, s)
    );
    expect(v2HeadlineForDecisionRuns(rows, s, "canonical"))
      .toBeCloseTo(weightedBudgetHeadline(summaries, s.budget_weights), 4);
  });

  test("is deterministic and gives probe and canonical decisions different authority", () => {
    const s = suite();
    const probeBase = runs(s, "probe", () => 0);
    const probeCandidate = runs(s, "probe", () => 20);
    const first = pairedV2Decision(probeBase, probeCandidate, s, {
      profile: "probe", mode: "improvement", iterations: 1_000, bootstrapSeed: 42,
    });
    const second = pairedV2Decision(probeBase, probeCandidate, s, {
      profile: "probe", mode: "improvement", iterations: 1_000, bootstrapSeed: 42,
    });
    expect(first).toEqual(second);
    expect(first.outcome).toBe("advance");
    expect(first.promotable).toBe(false);
    expect(first.confidence.oneSidedLevel).toBe(0.9);
    expect(first.confidence.oneSidedCriticalLevel).toBe(0.95);

    const canonical = pairedV2Decision(
      runs(s, "canonical", () => 0),
      runs(s, "canonical", () => 20),
      s,
      { profile: "canonical", mode: "improvement", iterations: 1_000, bootstrapSeed: 42 },
    );
    expect(canonical.outcome).toBe("accept");
    expect(canonical.promotable).toBe(true);
    expect(canonical.confidence.oneSidedLevel).toBe(0.95);
    expect(canonical.confidence.oneSidedCriticalLevel).toBe(0.99);
    expect(canonical.confidence.centralLevel).toBe(0.95);
    expect(canonical.confidence.centralCriticalLevel).toBe(0.99);
  });

  test("keeps an identical comparison unresolved rather than manufacturing evidence", () => {
    const s = suite();
    const rows = runs(s, "canonical", () => 0);
    const decision = pairedV2Decision(rows, structuredClone(rows), s, {
      profile: "canonical", mode: "improvement", iterations: 500, bootstrapSeed: 1,
    });
    expect(decision.delta).toBe(0);
    expect(decision.confidence.centralLo).toBe(0);
    expect(decision.confidence.centralHi).toBe(0);
    expect(decision.outcome).toBe("inconclusive");
  });

  test("keeps one-seed runs descriptive and never promotion-authoritative", () => {
    const s = suite();
    s.profiles.canonical.seeds_per_budget = 1;
    const base = runs(s, "canonical", () => 0);
    const candidate = runs(s, "canonical", () => 20);
    const decision = pairedV2Decision(base, candidate, s, {
      profile: "canonical", mode: "improvement", iterations: 500, bootstrapSeed: 1,
    });
    expect(decision.delta).toBeGreaterThan(0);
    expect(decision.confidence.available).toBe(false);
    expect(decision.confidence.standardError).toBe(0);
    expect(decision.outcome).toBe("inconclusive");
    expect(decision.promotable).toBe(false);
    expect(decision.perBudget.every((entry) => !entry.confidence.available)).toBe(true);
    expect(decision.perStratum.every((entry) => !entry.confidence.available)).toBe(true);
  });

  test("calibration fast path exactly matches the full calibration verdict", () => {
    const s = suite();
    const base = runs(s, "canonical", () => 0);
    const candidate = runs(s, "canonical", (_source, budget, seedSlot) =>
      budget === 100 ? [3, -1, 2][seedSlot] : [-2, 4, 1][seedSlot]
    );
    const options = { profile: "canonical" as const, mode: "improvement" as const, bootstrapSeed: 0 };
    const full = pairedV2DecisionForCalibration(base, candidate, s, options);
    const fast = pairedV2CalibrationVerdict(base, candidate, s, options);
    expect(fast).toEqual({ delta: full.delta, confidence: full.confidence, outcome: full.outcome });
  });

  test("resamples the shared seed as one catalog-wide block", () => {
    const parents = Array.from({ length: 42 }, (_, index) => ({ id: `s${index}`, members: [`s${index}`] }));
    const s = suite(parents);
    const base = runs(s, "probe", () => 0);
    const effects = [-10, -10, 30];
    const candidate = runs(s, "probe", (_source, _budget, seedSlot) => effects[seedSlot]);
    const decision = pairedV2Decision(base, candidate, s, {
      profile: "probe", mode: "improvement", iterations: 5_000, bootstrapSeed: 42,
    });

    expect(decision.delta).toBeGreaterThan(0);
    expect(decision.confidence.lowerBound).toBeLessThan(0);
    expect(decision.outcome).toBe("unresolved");
    expect(decision.uncertainty.seed.standardError).toBeGreaterThan(5);
  });

  test("draws disjoint budget seed blocks independently", () => {
    const s = suite([{ id: "a", members: ["a"] }]);
    const base = runs(s, "canonical", () => 0);
    const candidate = runs(s, "canonical", (_source, budget, seedSlot) =>
      budget === 100 ? [-20, 0, 20][seedSlot] : [20, 0, -20][seedSlot]
    );
    const decision = pairedV2Decision(base, candidate, s, {
      profile: "canonical", mode: "improvement", iterations: 3_000, bootstrapSeed: 9,
    });
    // Reusing one slot draw across budgets would cancel these effects and produce SE=0.
    expect(decision.uncertainty.seed.standardError).toBeGreaterThan(5);
    expect(decision.outcome).toBe("inconclusive");
  });

  test("keeps variants inside parents so duplication does not create fake precision", () => {
    const compact = suite([
      { id: "a", members: ["a"] },
      { id: "b", members: ["b"] },
    ]);
    const expanded = suite([
      { id: "a", members: ["a", "a1", "a2", "a3"] },
      { id: "b", members: ["b", "b1", "b2", "b3"] },
    ]);
    const effect = (sourceId: string) => sourceId.startsWith("a") ? 20 : -10;
    const compactDecision = pairedV2Decision(
      runs(compact, "probe", () => 0),
      runs(compact, "probe", (sourceId) => effect(sourceId)),
      compact,
      { profile: "probe", mode: "improvement", iterations: 3_000, bootstrapSeed: 7 },
    );
    const expandedDecision = pairedV2Decision(
      runs(expanded, "probe", () => 0),
      runs(expanded, "probe", (sourceId) => effect(sourceId)),
      expanded,
      { profile: "probe", mode: "improvement", iterations: 3_000, bootstrapSeed: 7 },
    );
    expect(expandedDecision.delta).toBeCloseTo(compactDecision.delta, 4);
    expect(expandedDecision.uncertainty.catalogSensitivity.standardError)
      .toBeCloseTo(compactDecision.uncertainty.catalogSensitivity.standardError, 4);
  });

  test("supports an explicit simplification non-inferiority margin", () => {
    const s = suite();
    const base = runs(s, "canonical", () => 0);
    const inside = pairedV2Decision(base, runs(s, "canonical", () => -0.05), s, {
      profile: "canonical", mode: "simplification", margin: 0.1, iterations: 500,
    });
    const outside = pairedV2Decision(base, runs(s, "canonical", () => -0.2), s, {
      profile: "canonical", mode: "simplification", margin: 0.1, iterations: 500,
    });
    expect(inside.threshold).toBe(-0.1);
    expect(inside.outcome).toBe("accept");
    expect(outside.outcome).toBe("reject");
    expect(() => pairedV2Decision(base, base, s, {
      profile: "canonical", mode: "simplification", iterations: 500,
    })).toThrow(/positive headline-point margin/);
  });

  test("rejects unpaired, incomplete, inconsistent-block, and malformed inputs", () => {
    const s = suite();
    const base = runs(s, "probe", () => 0);
    expect(() => pairedV2Decision(base, base.slice(1), s, {
      profile: "probe", mode: "improvement", iterations: 500,
    })).toThrow(/paired scope/);

    const inconsistent = structuredClone(base);
    inconsistent.find((run) => run.sourceId === "b" && run.seedSlot === 0)!.actualSeed++;
    expect(() => pairedV2Decision(inconsistent, structuredClone(inconsistent), s, {
      profile: "probe", mode: "improvement", iterations: 500,
    })).toThrow(/multiple actual seeds/);

    const malformed = structuredClone(base);
    malformed[0].score.score = Number.NaN;
    expect(() => pairedV2Decision(malformed, structuredClone(malformed), s, {
      profile: "probe", mode: "improvement", iterations: 500,
    })).toThrow(/invalid seed or score/);
  });
});

function fullScore(score: number): V2RunScore {
  return {
    schema: "line.benchmark-v2.run-score.v2",
    score,
    valid: true,
    scoringMode: "axis_quality",
    hardFailures: [],
    contacts: { authored: 1, reported: 1, hit: 1, drift: 0, missing: 0 },
    offBeatLandings: 0,
    terminus: { frame: 1, reason: "endOfSpec" },
    weightedAxisRms: 0,
    expectedObservations: {},
    components: {},
    diagnostics: {},
  };
}
