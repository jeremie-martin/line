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
});
