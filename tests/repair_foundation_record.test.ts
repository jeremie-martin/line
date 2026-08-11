import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("independent repair foundation record", () => {
  test("promotes the architecture without rewriting the benchmark decision", () => {
    const record = JSON.parse(readFileSync(
      "benchmark/v2/studies/repair-controller-foundation.json",
      "utf8",
    ));

    expect(record).toMatchObject({
      schema: "line.benchmark-v2.repair-controller-foundation.v1",
      status: "promoted_behavioral_foundation",
      promotion_basis: "verified_behavior_and_architecture",
      canonical_benchmark_decision: "inconclusive",
      canonical_benchmark_accept: false,
      scale_scope: { paired_cells: 1024, seeds: 16 },
      score_result: { delta: 0.0316, canonical_750k_delta: 0.2904 },
      behavior_result: { violations: 0, accepted_incumbent_identical_terminals: 0 },
    });
    for (const evidence of Object.values<any>(record.evidence)) {
      expect(evidence.path).toBeTypeOf("string");
      expect(evidence.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  test("binds the accepted depth-six production promotion to both decisions", () => {
    const record = JSON.parse(readFileSync(
      "benchmark/v2/studies/repair-depth-six-promotion.json",
      "utf8",
    ));

    expect(record).toMatchObject({
      schema: "line.benchmark-v2.repair-depth-six-promotion.v1",
      status: "accepted_and_promoted",
      production_policy: {
        previous_maximum_parent_depth: 4,
        maximum_parent_depth: 6,
      },
      scale_decision: {
        stopping_depth: 8,
        outcome: "prefer-candidate",
        delta: 0.5128,
        reference_valid: 495,
        candidate_valid: 495,
      },
      canonical_decision: {
        stopping_depth: 32,
        outcome: "accept",
        promotable: true,
        delta: 0.4348,
        reference_valid: 1408,
        candidate_valid: 1408,
      },
      behavior_result: {
        violations: 0,
        accepted_incumbent_identical_terminal_offers: 0,
      },
    });
    expect(record.scale_decision.directional_probability)
      .toBeGreaterThan(record.scale_decision.required_directional_probability);
    expect(record.canonical_decision.directional_probability)
      .toBeGreaterThan(record.canonical_decision.required_directional_probability);
    expect(record.canonical_decision.one_sided_lower_bound).toBeGreaterThan(0);
    for (const evidence of Object.values<any>(record.evidence)) {
      expect(evidence.path).toBeTypeOf("string");
      expect(evidence.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
