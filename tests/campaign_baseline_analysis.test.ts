import { describe, expect, test } from "vitest";
import {
  activeCampaignAnalysisContract,
  activeCampaignComparisonGuidance,
} from "../scripts/benchmark/campaign_baseline_analysis_contract.ts";

function fixture(depth: number) {
  const actualSeeds = Array.from({ length: depth }, (_, index) => index + 16);
  const seedSchedule = {
    kind: "profile_budget_disjoint_contiguous",
    profile: "canonical",
    seedBase: 0,
    seedsPerBudget: depth,
    byBudget: [{ budget: 750_000, actualSeeds }],
  };
  return {
    baseline: {
      scope: {
        promotion_seeds: depth,
        sequential_looks: [8, 16, 32, 48],
      },
      development: { seed_schedule: seedSchedule },
    },
    archive: {
      identity: { seedSchedule },
      runs: Array.from({ length: 44 * depth }, () => ({})),
    },
  };
}

describe("active campaign analysis depth", () => {
  test.each([8, 16, 32, 48])("accepts the exact N=%i promotion prefix", (depth) => {
    const { baseline, archive } = fixture(depth);
    const contract = activeCampaignAnalysisContract(baseline, archive, 44);
    expect(contract.promotionSeeds).toBe(depth);
    expect(contract.expectedRows).toBe(44 * depth);
    expect(contract.paired95Critical).toBeGreaterThan(1.96);
    expect(activeCampaignComparisonGuidance(depth)).toContain(`N=${depth}`);
  });

  test("rejects a detached or completed-later archive", () => {
    const { baseline, archive } = fixture(16);
    archive.runs.push({});
    expect(() => activeCampaignAnalysisContract(baseline, archive, 44)).toThrow(
      /exact 750k\/N=16 promotion prefix/,
    );
  });
});
