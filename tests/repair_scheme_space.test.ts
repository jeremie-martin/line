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
      remaining_budget_frames: 130,
      usable_budget_frames: 130,
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
    expect(choices.max_local_window_opportunity).toMatchObject({ targetGap: 3, anchorGap: 0 });
    expect(choices.reserve_selected_depth_zero).toMatchObject({
      targetGap: 2,
      anchorGap: 1,
    });
    expect(choices.reserve_cheapest_current_repair).toMatchObject({
      targetGap: 2,
      anchorGap: 0,
    });
    expect(choices.reserve_cheapest_else_deepest).toMatchObject({
      targetGap: 2,
      anchorGap: 0,
    });
    expect(choices.density_guarded_depth_eight).toMatchObject({
      targetGap: 2,
      anchorGap: 1,
    });
    expect(choices.worst_target_window_per_cost).toMatchObject({
      targetGap: 2,
      anchorGap: 1,
    });
    expect(choices.worst_target_runway_per_cost).toMatchObject({
      targetGap: 2,
      anchorGap: 1,
    });
  });

  test("extends beyond depth six only when suffix opportunity density does not fall", () => {
    const decision = (depthEightCost: number) => ({
      remaining_budget_frames: 1_000,
      usable_budget_frames: 1_000,
      target_gap_index: 8,
      anchor_gap_index: 0,
      considered_targets: Array.from({ length: 9 }, (_, gap) => ({
        target_gap_index: gap,
        target_gap_sse: gap < 2 ? 0.5 : 0.01,
        anchor_options: Array.from({ length: gap + 1 }, (__, parentDepth) => ({
          parent_depth: parentDepth,
          anchor_gap_index: gap - parentDepth,
          estimated_anchor_cost_frames: gap - parentDepth === 0
            ? depthEightCost
            : 100 + 10 * (8 - (gap - parentDepth)),
          estimated_anchor_cost_upper_frames: gap - parentDepth === 0
            ? depthEightCost
            : 100 + 10 * (8 - (gap - parentDepth)),
          anchor_cost_source: "measured_cost_to_end",
          affordability: "affordable",
        })),
      })),
    });

    expect(deriveRepairSchemeChoices(decision(10_000)).density_guarded_depth_eight)
      .toMatchObject({ targetGap: 8, anchorGap: 2, parentDepth: 6 });
    expect(deriveRepairSchemeChoices(decision(120)).density_guarded_depth_eight)
      .toMatchObject({ targetGap: 8, anchorGap: 0, parentDepth: 8 });
  });
});
