import { describe, expect, test } from "vitest";
import { deriveRepairSchemeChoices } from "../scripts/benchmark/analyze_repair_scheme_space.ts";

describe("repair scheme-space counterfactuals", () => {
  test("separates suffix opportunity, suffix density, and local density", () => {
    const target = (gap: number, sse: number, costs: Array<[number, number]>) => ({
      target_gap_index: gap,
      target_gap_sse: sse,
      anchor_options: costs.map(([anchor, cost]) => ({
        parent_depth: gap - anchor,
        anchor_gap_index: anchor,
        estimated_anchor_cost_frames: cost,
        estimated_anchor_cost_upper_frames: cost * 1.1,
        anchor_cost_source: "measured_cost_to_end",
        affordability: "affordable",
      })),
    });
    const choices = deriveRepairSchemeChoices({
      target_gap_index: 2,
      anchor_gap_index: 1,
      considered_targets: [
        target(0, 0.01, [[0, 100]]),
        target(1, 0.20, [[0, 100], [1, 50]]),
        target(2, 0.40, [[0, 100], [1, 50], [2, 40]]),
        target(3, 0.02, [[0, 100], [1, 50], [2, 40], [3, 5]]),
      ],
    });
    expect(choices.current).toMatchObject({ targetGap: 2, anchorGap: 1 });
    expect(choices.max_suffix_opportunity).toMatchObject({ targetGap: 2, anchorGap: 0 });
    expect(choices.suffix_opportunity_per_cost).toMatchObject({ targetGap: 2, anchorGap: 1 });
    expect(choices.single_gap_opportunity_per_cost).toMatchObject({ targetGap: 2, anchorGap: 2 });
  });
});
