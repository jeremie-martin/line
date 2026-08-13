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
        node_events: [{
          episode_id: 4,
          lane: "repair",
          gap_index: 3,
          requested_normal_proposals: 81,
          large: true,
        }, {
          episode_id: 4,
          lane: "repair",
          gap_index: 4,
          requested_normal_proposals: 61,
          large: true,
        }, {
          episode_id: 4,
          lane: "repair",
          gap_index: 5,
          requested_normal_proposals: 45,
          large: true,
        }],
        compile: { work: {} },
        episodes: [{
          episode_id: 4,
          lane: "repair",
          anchor: { gap_index: 3 },
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
    expect(projected).toHaveProperty("budgetTelemetry.repair_node_policy", {
      anchor: {
        pool_builds: 1,
        requested_normal_proposals: 81,
        requested_normal_proposals_min: 81,
        requested_normal_proposals_max: 81,
      },
      descendant: {
        pool_builds: 2,
        requested_normal_proposals: 106,
        requested_normal_proposals_min: 45,
        requested_normal_proposals_max: 61,
      },
      before_target_descendant: {
        pool_builds: 0,
        requested_normal_proposals: 0,
        requested_normal_proposals_min: null,
        requested_normal_proposals_max: null,
      },
      target: {
        pool_builds: 1,
        requested_normal_proposals: 61,
        requested_normal_proposals_min: 61,
        requested_normal_proposals_max: 61,
      },
      post_target: {
        pool_builds: 1,
        requested_normal_proposals: 45,
        requested_normal_proposals_min: 45,
        requested_normal_proposals_max: 45,
      },
    });
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
