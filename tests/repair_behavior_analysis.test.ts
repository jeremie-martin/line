import { describe, expect, test } from "vitest";
import { summarizeRepairBehavior } from "../scripts/benchmark/analyze_repair_behavior.ts";
import { BUDGET_TELEMETRY_SCHEMA } from "../scripts/v0/optimizer/budget_telemetry.ts";

function row() {
  const key = (score: number) => ({
    contract_passed: true,
    axis_quality: score / 1000,
    internal_full_score: score,
    drift_quality: 1,
  });
  const episode = ({
    iteration,
    revision,
    start,
    remaining,
    target,
    anchor,
    affordable,
    before,
    after,
    accepted,
    seed,
    scoreBefore,
    scoreAfter,
  }: any) => ({
    episode_id: iteration,
    lane: "repair",
    search_seed: seed,
    anchor: { gap_index: anchor, remaining_gaps: 10 - anchor },
    repair_decision: {
      iteration_index: iteration,
      incumbent_revision: revision,
      incumbent_track_hash: "a".repeat(64),
      remaining_budget_frames: remaining,
      headroom_fraction: 0.2,
      usable_budget_frames: Math.floor(remaining * 0.8),
      parent_depth: target - anchor,
      affordable_target_gap_indices: affordable,
      target_gap_index: target,
      target_gap_sse: before,
      anchor_gap_index: anchor,
      estimated_anchor_cost_frames: Math.floor(remaining * 0.5),
      estimated_anchor_cost_upper_frames: Math.floor(remaining * 0.7),
      anchor_cost_source: "measured_cost_to_end",
      considered_targets: affordable.map((gap: number) => ({
        target_gap_index: gap,
        target_gap_sse: gap === target ? before : before / 2,
        anchor_options: [{
          parent_depth: target - anchor,
          anchor_gap_index: gap - (target - anchor),
          estimated_anchor_cost_frames: Math.floor(remaining * 0.5),
          estimated_anchor_cost_upper_frames: Math.floor(remaining * 0.7),
          anchor_cost_source: "measured_cost_to_end",
          affordability: "affordable",
        }],
      })),
    },
    incumbent_weak_gap_sse: before,
    repair_weak_gap_before: { gap_index: target, sse: before, axes: {} },
    start_total_spent_frames: start,
    allocated_frames: Math.floor(remaining * 0.7),
    register_key_at_start: key(scoreBefore),
    register_key_at_end: key(scoreAfter),
    work: {
      terminal_node_evaluations: 1,
      terminal_register_improvements: accepted ? 1 : 0,
    },
    outcome: {
      terminal_reached: true,
      accepted_alternative: accepted,
      spent_frames: Math.floor(remaining * 0.6),
      first_terminal_offset_frames: Math.floor(remaining * 0.6),
      terminal_observation_censored: false,
      internal_full_score_delta: scoreAfter - scoreBefore,
      repair_weak_gap_after: { gap_index: target, sse: after, axes: {} },
      repair_divergence: {
        compared_gap_count: 10,
        first_divergent_gap_index: anchor,
        divergent_gap_count: 10 - anchor,
        divergent_suffix_gap_count: 10 - anchor,
        terminal_geometry_identical: false,
      },
      terminal_offer_track_hash: (accepted ? "b" : "c").repeat(64),
    },
  });
  return {
    task: { sourceId: "source", budget: 200, actualSeed: 7 },
    budgetTelemetry: {
      schema: BUDGET_TELEMETRY_SCHEMA,
      compile: {
        repair_budget_frames: 200,
        total_spent_frames: 195,
      },
      episodes: [
        episode({
          iteration: 0,
          revision: 1,
          start: 100,
          remaining: 100,
          target: 5,
          anchor: 3,
          affordable: [5, 6],
          before: 0.4,
          after: 0.4,
          accepted: false,
          seed: 10,
          scoreBefore: 500,
          scoreAfter: 500,
        }),
        episode({
          iteration: 1,
          revision: 1,
          start: 180,
          remaining: 20,
          target: 6,
          anchor: 4,
          affordable: [6],
          before: 0.3,
          after: 0.1,
          accepted: true,
          seed: 11,
          scoreBefore: 500,
          scoreAfter: 502,
        }),
      ],
    },
  } as any;
}

describe("repair behavior analysis", () => {
  test("audits independent transitions and summarizes direct outcomes", () => {
    const result = summarizeRepairBehavior([row()]);

    expect(result.invariantAudit.passed).toBe(true);
    expect(result.overall).toMatchObject({
      runs: 1,
      repairEpisodes: 2,
      terminalReached: 2,
      acceptedAlternatives: 1,
      terminalGeometryIdentical: 0,
      weakGapSseImprovement: 0.2,
      internalFullScoreDelta: 2,
      replayableDecisionEpisodes: 2,
      directTrackIdentityEpisodes: 2,
    });
    expect(result.transitions).toMatchObject({
      total: 1,
      afterRejected: 1,
      afterRejectedAnchorLater: 1,
      afterRejectedAffordableSetShrank: 1,
    });
    expect(result.perParentDepth).toEqual([
      expect.objectContaining({
        parentDepth: 2,
        repairEpisodes: 2,
        acceptedAlternatives: 1,
      }),
    ]);
    expect(result.perIteration.map(({ iterationIndex, repairEpisodes }) => ({
      iterationIndex,
      repairEpisodes,
    }))).toEqual([
      { iterationIndex: 0, repairEpisodes: 1 },
      { iterationIndex: 1, repairEpisodes: 1 },
    ]);
    expect(result.selection).toMatchObject({
      maximumConsideredParentDepth: 2,
      selectedAtMaximumConsideredDepth: 2,
      deeperStructuralAnchorBlockedByAffordability: 0,
    });
    expect(result.terminalOfferDiversity).toMatchObject({
      terminalOffersWithHash: 2,
      distinctTerminalOfferTracks: 2,
      repeatedTerminalOffersAgainstSameIncumbent: 0,
    });
    expect(result.transitionOutcomes.afterRejectedDifferentDecision).toMatchObject({
      repairEpisodes: 1,
      terminalReached: 1,
      acceptedAlternatives: 1,
      internalFullScoreDelta: 2,
    });
    expect(result.transitionOutcomes.afterRejectedSameTargetAndAnchor.repairEpisodes).toBe(0);
  });

  test("reports sequence violations instead of silently summarizing them", () => {
    const corrupted = row();
    corrupted.budgetTelemetry.episodes[1].repair_decision.incumbent_revision = 2;
    corrupted.budgetTelemetry.episodes[1].repair_decision.incumbent_track_hash = "d".repeat(64);
    corrupted.budgetTelemetry.episodes[1].search_seed = 10;
    const result = summarizeRepairBehavior([corrupted]);

    expect(result.invariantAudit.passed).toBe(false);
    expect(result.invariantAudit.checks.incumbentRevisionTracksAcceptance.violations).toBe(1);
    expect(result.invariantAudit.checks.incumbentTrackHashFlowsIntoNextIteration.violations).toBe(1);
    expect(result.invariantAudit.checks.freshSearchSeedPerIteration.violations).toBe(1);
  });

  test("audits terminal outcome attribution against terminal work", () => {
    const corrupted = row();
    corrupted.budgetTelemetry.episodes[0].outcome.terminal_reached = false;
    const result = summarizeRepairBehavior([corrupted]);

    expect(result.invariantAudit.passed).toBe(false);
    expect(result.invariantAudit.checks.terminalOutcomeMatchesWork.violations).toBe(1);
  });
});
