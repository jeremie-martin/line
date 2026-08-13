import { describe, expect, test } from "vitest";
import { scaleAnalysisRun } from "../scripts/v0/benchmark_v2/scale_analysis_projection.ts";

describe("Benchmark V2 scale analysis projection", () => {
  test("retains compact repair and aim mechanics while omitting bulky compile stats", () => {
    const projected = scaleAnalysisRun({
      task: { sourceId: "source", budget: 750_000, actualSeed: 1 },
      report: { contacts: new Array(10).fill({}) },
      authoredContacts: 10,
      phaseResults: [{ large: true }],
      stats: {
        repair_target_search: {
          policy: "target_improvement_first",
          target_pools: 7,
          reordered: 2,
        },
        aim: {
          enum_lane_bases: 12,
          enum_lane_base_skips: 2,
          joint_probe_rows: 60,
          joint_probe_frames_charged: 900,
          enum_emitted: 18,
          aimed_pool_entries: 20,
          aimed_rank0: 4,
          aimed_top3: 10,
          aimed_rank_sum: 70,
          aimed_pool_size_sum: 500,
          study: { large: true },
        },
        handoff_aimed_selected: 7,
        unrelated_large_stats: { samples: [1, 2, 3] },
      },
      budgetTelemetry: {
        schema: "line.compile-budget-telemetry.v9",
        node_events: [{ large: true }],
        compile: { work: {} },
        episodes: [{
          repair_decision: {
            target_gap_index: 4,
            considered_targets: [{ large: true }],
            incumbent_track_hash: "incumbent",
            working_track_hash: "working",
          },
          outcome: {
            terminal_reached: true,
            terminal_offer_track_hash: "offer",
          },
        }],
      },
    });

    expect(projected).not.toHaveProperty("report");
    expect(projected).not.toHaveProperty("authoredContacts");
    expect(projected).not.toHaveProperty("phaseResults");
    expect(projected.stats).toEqual({
      repair_target_search: {
        policy: "target_improvement_first",
        target_pools: 7,
        reordered: 2,
      },
      aim: {
        enum_lane_bases: 12,
        enum_lane_base_skips: 2,
        joint_probe_rows: 60,
        joint_probe_frames_charged: 900,
        enum_emitted: 18,
        aimed_pool_entries: 20,
        aimed_rank0: 4,
        aimed_top3: 10,
        aimed_rank_sum: 70,
        aimed_pool_size_sum: 500,
      },
      handoff_aimed_selected: 7,
    });
    expect(projected).not.toHaveProperty("stats.unrelated_large_stats");
    expect(projected).not.toHaveProperty("stats.aim.study");
    expect(projected).not.toHaveProperty("budgetTelemetry.node_events");
    expect(projected).not.toHaveProperty(
      "budgetTelemetry.episodes.0.repair_decision.considered_targets",
    );
    expect(projected).not.toHaveProperty(
      "budgetTelemetry.episodes.0.outcome.terminal_offer_track_hash",
    );
  });

  test("uses an explicit null stats field when target-search mechanics are absent", () => {
    expect(scaleAnalysisRun({ budgetTelemetry: null, stats: { other: 1 } })).toMatchObject({
      stats: null,
      budgetTelemetry: null,
    });
  });

  test("retains only the attributable impact-resolution study counters", () => {
    const projected = scaleAnalysisRun({
      stats: {
        aim: {
          study: {
            model_impact_resolution_policy: "validated-mae-top1",
            enum_model_impact_top1_changed: 9,
            enum_model_impact_top1_advantage_mean: 0.051,
            enum_model_impact_top1_resolution_suppressed: 4,
            enum_model_impact_scores: 999_999,
          },
        },
      },
      budgetTelemetry: null,
    });
    expect(projected.stats).toEqual({
      aim: {
        study: {
          model_impact_resolution_policy: "validated-mae-top1",
          enum_model_impact_top1_changed: 9,
          enum_model_impact_top1_advantage_mean: 0.051,
          enum_model_impact_top1_resolution_suppressed: 4,
        },
      },
    });
  });
});
