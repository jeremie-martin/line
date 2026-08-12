import { describe, expect, test } from "vitest";
import { pairedScaleMechanics } from "../scripts/benchmark/analyze_scale_mechanics.ts";
import { BUDGET_TELEMETRY_SCHEMA } from "../scripts/v0/optimizer/budget_telemetry.ts";

describe("paired scale mechanics", () => {
  test("summarizes paired compiler work and complete repair outcomes by budget", () => {
    const row = (budget: number, seed: number, candidate: boolean) => ({
      task: { sourceId: "source", budget, actualSeed: seed },
      trackHash: candidate ? `candidate-${budget}-${seed}` : `reference-${budget}-${seed}`,
      score: { score: 500 + (candidate ? 2 : 0) },
      stats: candidate ? {
        repair_target_search: {
          target_pools: 4,
          ordinary_first_improves_incumbent: 1,
          ordinary_first_not_improving: 3,
          improving_alternative_available: 2,
          reordered: 2,
          local_sse_gain_sum: 0.25,
          forward_score_debt_sum: 0.5,
        },
      } : {},
      budgetTelemetry: {
        schema: BUDGET_TELEMETRY_SCHEMA,
        compile: {
          total_spent_frames: budget,
          first_terminal_total_spent_frames: budget / 2,
          final_output_lane: candidate ? "repair" : "initial",
          work: work(candidate),
        },
        episodes: [{
          episode_id: 0,
          lane: "repair",
          search_seed: seed,
          anchor: { gap_index: candidate ? 4 : 3 },
          repair_decision: {
            iteration_index: 0,
            incumbent_revision: 0,
            incumbent_track_hash: "a".repeat(64),
            working_track_source: candidate
              ? "rejected_local_improvement"
              : "global_incumbent",
            working_track_hash: candidate ? "b".repeat(64) : "a".repeat(64),
            parent_depth: 1,
            target_gap_index: candidate ? 5 : 4,
            anchor_gap_index: candidate ? 4 : 3,
          },
          incumbent_target_gap_before: {
            status: "measured",
            gap_index: candidate ? 5 : 4,
            sse: 0.3,
            axes: {},
          },
          working_target_gap_before: {
            status: "measured",
            gap_index: candidate ? 5 : 4,
            sse: 0.3,
            axes: {},
          },
          allocated_frames: budget / 2,
          start: {
            estimated_remaining_work_frames: budget / 5,
            estimate_lower_frames: 0,
            estimate_upper_frames: budget / 2,
            estimator_applicability: "calibrated",
          },
          work: work(candidate),
          outcome: {
            terminal_reached: true,
            register_improved: candidate,
            accepted_alternative: candidate,
            terminal_offer_target_gap: {
              status: "measured",
              gap_index: candidate ? 5 : 4,
              sse: candidate ? 0.1 : 0.3,
              axes: {},
            },
            incumbent_target_gap_after: {
              status: "measured",
              gap_index: candidate ? 5 : 4,
              sse: candidate ? 0.1 : 0.3,
              axes: {},
            },
            working_to_offer_divergence: {
              compared_gap_count: 8,
              first_divergent_gap_index: candidate ? 4 : null,
              divergent_gap_count: candidate ? 2 : 0,
              divergent_suffix_gap_count: candidate ? 2 : 0,
              terminal_geometry_identical: !candidate,
            },
            internal_full_score_delta: candidate ? 4 : 0,
            spent_frames: budget / 3,
            first_terminal_offset_frames: budget / 4,
            terminal_observation_censored: false,
            rejected_local_improvement_followup: candidate
              ? "blocked_one_step_limit"
              : "not_rejected_local_improvement",
            rejected_local_improvement_bridge_assessment: null,
            stop_reason: candidate ? "first_terminal_return" : "local_ceiling",
          },
        }],
      } as any,
    });
    const reference = [row(100, 1, false), row(200, 1, false)];
    const candidate = [row(100, 1, true), row(200, 1, true)];
    const result = pairedScaleMechanics(reference, candidate);

    expect(result.overall).toMatchObject({ cells: 2, changedTracks: 2, rawScoreDeltaMean: 2 });
    expect(result.overall.metrics.requestedNormalProposalsPerRankedOptionCall).toMatchObject({
      observations: 2,
      referenceMean: 40,
      candidateMean: 20,
      delta: -20,
      relativeDelta: -0.5,
    });
    expect(result.overall.metrics.repairEpisodesWithRegisterImprovement.candidateMean).toBe(1);
    expect(result.overall.metrics.repairRegisterImprovements.candidateMean).toBe(2);
    expect(result.overall.metrics.repairFirstTerminalReturnEpisodes.candidateMean).toBe(1);
    expect(result.overall.metrics.repairMeanAnchorGap.delta).toBe(1);
    expect(result.overall.metrics.repairRejectedLocalBridgeEpisodes.delta).toBe(1);
    expect(result.overall.metrics.repairRejectedLocalFollowupBlockedOneStep.delta).toBe(1);
    expect(result.overall.metrics.repairTerminalReachedRate.candidateMean).toBe(1);
    expect(result.overall.metrics.repairTotalSpentFrames.candidateMean).toBe(50);
    expect(result.overall.metrics.repairTerminalImprovementPerEvaluation).toMatchObject({
      referenceMean: 0,
      candidateMean: 1,
    });
    expect(result.overall.metrics.repairEpisodeImprovementRate.candidateMean).toBe(1);
    expect(result.overall.metrics.repairCompletionEstimateSignedErrorFrames.candidateMean).toBe(7.5);
    expect(result.overall.metrics.repairCompletionEstimateIntervalCoverage.candidateMean).toBe(1);
    expect(result.overall.metrics.repairCompletionWithinAllocationRate.candidateMean).toBe(1);
    expect(result.overall.metrics.repairCalibratedEstimatorRate.candidateMean).toBe(1);
    expect(result.overall.metrics.repairTargetSearchReorderRate).toMatchObject({
      referenceMean: 0,
      candidateMean: 0.5,
    });
    expect(result.overall.metrics.repairTargetSearchImprovingAlternativeRate.candidateMean).toBe(0.5);
    expect(result.overall.metrics.repairTargetSearchLocalSseGain.candidateMean).toBe(0.25);
    expect(result.overall.metrics.repairTerminalOfferTargetGapImprovementRate).toMatchObject({
      referenceMean: 0,
      candidateMean: 1,
      delta: 1,
    });
    expect(result.overall.metrics.repairTerminalOfferTargetGapMissingRate.candidateMean).toBe(0);
    expect(result.overall.metrics.finalOutputFromRepair.delta).toBe(1);
    expect(result.perBudget.map((entry) => entry.budget)).toEqual([100, 200]);
  });

  test("rejects candidates without a paired reference cell", () => {
    const candidate = [{
      task: { sourceId: "source", budget: 100, actualSeed: 1 },
      budgetTelemetry: {
        schema: BUDGET_TELEMETRY_SCHEMA,
        compile: { work: work(false) },
        episodes: [{
          episode_id: 0,
          lane: "initial",
          work: work(false),
          outcome: { terminal_reached: true, register_improved: false },
        }],
      },
    } as any];
    expect(() => pairedScaleMechanics([], candidate)).toThrow(/reference is missing/);
  });

  test("rejects duplicate reference cells and old telemetry schemas", () => {
    const base = {
      task: { sourceId: "source", budget: 100, actualSeed: 1 },
      budgetTelemetry: {
        schema: BUDGET_TELEMETRY_SCHEMA,
        compile: { work: work(false) },
        episodes: [{
          episode_id: 0,
          lane: "initial",
          work: work(false),
          outcome: { terminal_reached: true, register_improved: false },
        }],
      },
    } as any;
    expect(() => pairedScaleMechanics([base, structuredClone(base)], [structuredClone(base)]))
      .toThrow(/reference contains duplicate cell/);
    const old = structuredClone(base);
    old.budgetTelemetry.schema = "line.compile-budget-telemetry.v2";
    expect(() => pairedScaleMechanics([base], [old])).toThrow(/expected line\.compile-budget-telemetry\.v9/);

    const corrupt = structuredClone(base);
    corrupt.budgetTelemetry.compile.work.actual_candidate_samples++;
    expect(() => pairedScaleMechanics([base], [corrupt])).toThrow(/candidate-mode accounting/);
  });
});

function work(candidate: boolean) {
  return {
    ranked_option_calls: 5,
    requested_normal_proposals: candidate ? 100 : 200,
    actual_candidate_samples: candidate ? 100 : 200,
    viable_candidates: candidate ? 50 : 100,
    candidate_samples_by_stream: { normal: candidate ? 100 : 200 },
    by_evaluation_origin: {
      frontier: { register_offers: 3, terminal_node_evaluations: 1, register_improvements: candidate ? 2 : 0, terminal_register_improvements: candidate ? 1 : 0 },
      tail_completion: { register_offers: 0, terminal_node_evaluations: 0, register_improvements: 0, terminal_register_improvements: 0 },
      polish: { register_offers: 0, terminal_node_evaluations: 0, register_improvements: 0, terminal_register_improvements: 0 },
    },
    nodes_processed: candidate ? 14 : 12,
    nodes_expanded: candidate ? 12 : 10,
    children_enqueued: candidate ? 30 : 20,
    register_offers: 3,
    partial_node_evaluations: 2,
    terminal_node_evaluations: 1,
    first_time_terminal_node_evaluations: 1,
    revisited_terminal_node_evaluations: 0,
    distinct_terminal_tracks: 1,
    repeated_terminal_track_evaluations: 0,
    register_improvements: candidate ? 2 : 0,
    terminal_register_improvements: candidate ? 1 : 0,
  };
}
