import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  readRepairArm,
  renderRepairBehaviorPlot,
  summarizeRepairBehavior,
} from "../scripts/benchmark/analyze_repair_behavior.ts";
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
    offer,
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
      working_track_source: "global_incumbent",
      working_track_hash: "a".repeat(64),
      remaining_budget_frames: remaining,
      headroom_fraction: 0.2,
      usable_budget_frames: Math.floor(remaining * 0.8),
      selection_policy: "worst_gap_deepest_affordable",
      parent_depth: target - anchor,
      affordable_target_gap_indices: affordable,
      affordable_anchor_gap_indices: affordable.map((gap: number) => gap - (target - anchor)),
      target_gap_index: target,
      target_gap_sse: before,
      anchor_gap_index: anchor,
      mutable_suffix_sse: before +
        affordable.filter((gap: number) => gap !== target).length * before / 2,
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
    incumbent_target_gap_before: { status: "measured", gap_index: target, sse: before, axes: {} },
    working_target_gap_before: { status: "measured", gap_index: target, sse: before, axes: {} },
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
      terminal_offer_target_gap: { status: "measured", gap_index: target, sse: offer, axes: {} },
      incumbent_target_gap_after: { status: "measured", gap_index: target, sse: after, axes: {} },
      working_to_offer_divergence: {
        compared_gap_count: 10,
        first_divergent_gap_index: anchor,
        divergent_gap_count: 10 - anchor,
        divergent_suffix_gap_count: 10 - anchor,
        terminal_geometry_identical: false,
      },
      terminal_offer_track_hash: (accepted ? "b" : "c").repeat(64),
      rejected_local_improvement_followup: "not_rejected_local_improvement",
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
          offer: 0.2,
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
          offer: 0.1,
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
      acceptedTerminalGeometryIdentical: 0,
      terminalOfferTargetGapSseImprovement: 0.4,
      rejectedTerminalOfferTargetGapImproved: 1,
      incumbentTargetGapSseImprovement: 0.2,
      internalFullScoreDelta: 2,
      replayableDecisionEpisodes: 2,
      directTrackIdentityEpisodes: 2,
    });
    expect(result.transitions).toMatchObject({
      total: 1,
      afterRejected: 1,
      afterRejectedIncumbentRetry: 1,
      afterRejectedBridgeReturnToIncumbent: 0,
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
      selectionPolicies: { worst_gap_deepest_affordable: 2 },
      explanatoryDepthBeyondOptionRadius: 0,
      meanAffordableTargets: 1.5,
      meanAffordableAnchors: 1.5,
    });
    expect(result.terminalOfferDiversity).toMatchObject({
      terminalOffersWithHash: 2,
      distinctTerminalOfferTracks: 2,
      repeatedTerminalOffersAgainstSameWorkingTrack: 0,
    });
    expect(result.transitionOutcomes.afterRejectedDifferentDecision).toMatchObject({
      repairEpisodes: 1,
      terminalReached: 1,
      acceptedAlternatives: 1,
      internalFullScoreDelta: 2,
    });
    expect(result.transitionOutcomes.afterRejectedSameTargetAndAnchor.repairEpisodes).toBe(0);
  });

  test("counts a terminal that lost the selected target as missing, not comparable", () => {
    const input = row();
    const first = input.budgetTelemetry.episodes[0];
    first.outcome.terminal_offer_target_gap = {
      status: "missing",
      gap_index: first.repair_decision.target_gap_index,
    };

    const result = summarizeRepairBehavior([input]);

    expect(result.invariantAudit.passed).toBe(true);
    expect(result.overall).toMatchObject({
      terminalReached: 2,
      terminalOfferTargetGapMissing: 1,
      terminalOfferTargetGapImprovementRate: 0.5,
      rejectedTerminalOfferTargetGapImproved: 0,
      acceptedTerminalOfferTargetGapMissing: 0,
    });
  });

  test("audits and reports one-step rejected-local-improvement lineage", () => {
    const input = row();
    const [parent, bridge] = input.budgetTelemetry.episodes;
    parent.outcome.rejected_local_improvement_followup = "scheduled";
    bridge.parent_episode_id = parent.episode_id;
    bridge.repair_decision.working_track_source = "rejected_local_improvement";
    bridge.repair_decision.working_track_hash = parent.outcome.terminal_offer_track_hash;

    const result = summarizeRepairBehavior([input]);

    expect(result.invariantAudit.passed).toBe(true);
    expect(result.overall.workingTrackBridgeEpisodes).toBe(1);
    expect(result.overall.rejectedLocalImprovementFollowup).toMatchObject({ scheduled: 1 });
    expect(result.transitions).toMatchObject({
      afterRejected: 1,
      afterRejectedLocalBridge: 1,
      afterRejectedGlobalIncumbentFollowup: 0,
      afterRejectedIncumbentRetry: 0,
      afterRejectedBridgeReturnToIncumbent: 0,
    });
    expect(result.transitionOutcomes.afterRejectedLocalBridge).toMatchObject({
      repairEpisodes: 1,
      acceptedAlternatives: 1,
    });
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

  test("renders self-contained behavior plots without invalid coordinates", () => {
    const summary = summarizeRepairBehavior([row()]);
    for (const dimension of ["budget", "iteration", "parent-depth"] as const) {
      const svg = renderRepairBehaviorPlot(summary, dimension, "fixture & arm");
      expect(svg).toContain("<svg");
      expect(svg).toContain("fixture &amp; arm");
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("Infinity");
    }
  });

  test("streams complete scale checkpoints into the behavior audit", async () => {
    const directory = mkdtempSync(join(tmpdir(), "repair-behavior-checkpoint-"));
    const path = join(directory, "scale.checkpoint.jsonl");
    const contents = [
      JSON.stringify({
        schema: "line.benchmark-v2.budget-scale-checkpoint.v1",
        planFingerprint: "fixture",
      }),
      JSON.stringify({ type: "result", result: { ...row(), status: "ok" } }),
      "",
    ].join("\n");
    writeFileSync(path, contents);

    try {
      const arm = await readRepairArm(path);
      expect(arm.schema).toBe("line.benchmark-v2.budget-scale-checkpoint.v1");
      expect(arm.runs).toHaveLength(1);
      expect(arm.runs[0]?.task).toEqual(row().task);
      expect(arm.sha256).toBe(createHash("sha256").update(contents).digest("hex"));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
