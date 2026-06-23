import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import {
  checkpointAt,
  compileBudgetCurve,
  compileHandoff,
  compileHandoffFromSnapshot,
  objectiveLeafValue,
  setForwardEvalContext,
  snapshotHandoffNode,
  type HandoffNodeSnapshot,
} from "../scripts/v0/optimizer/handoff.ts";
import { axisErrorsForTargets, axisQualityForTargets, axisQualityFromErrors } from "../scripts/v0/score.ts";
import type { SearchNode } from "../scripts/v0/optimizer/node.ts";
import type { GapFit } from "../scripts/v0/core/substrate.ts";
import type { AxisValues, Gap } from "../scripts/v0/types.ts";
import type { Spec } from "../scripts/v0/optimizer/types.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import {
  AXES,
  HANDOFF_CANDIDATE_SOURCES,
  HANDOFF_EVALUATION_PHASES,
  secToFrame,
} from "../scripts/v0/types.ts";
import {
  assertBudgetSearchContract,
  type BudgetCompile,
} from "./budget_contract_harness.ts";
import type { CompileCheckpoint, CompileStats } from "../scripts/v0/optimizer/types.ts";

function hashTrack(track: unknown): string {
  return createHash("sha256").update(JSON.stringify(track)).digest("hex");
}

function checkpoint(result: CompileCheckpoint, budget: number): CompileCheckpoint {
  if (result.budget !== budget) throw new Error(`expected checkpoint ${budget}, got ${result.budget}`);
  return result;
}

function sumPhaseCounter(
  counter: CompileStats["handoff_duplicate_evaluations_by_phase"],
): number {
  return HANDOFF_EVALUATION_PHASES.reduce((sum, phase) => sum + (counter?.[phase] ?? 0), 0);
}

function sumContactCountCounter(
  counter: CompileStats["handoff_tail_completion_attempts_by_remaining_contacts"],
): number {
  return Object.values(counter ?? {}).reduce((sum, count) => sum + count, 0);
}

async function firstCleanSnapshot(): Promise<HandoffNodeSnapshot> {
  const spec = await loadGoldenSpec("tiny_dance", "base");
  let snapshot: HandoffNodeSnapshot | null = null;
  compileHandoff(spec, 0, {
    budget: 20_000,
    maxNodes: 12,
    polish: false,
    onNode: (node, key, event) => {
      if (snapshot !== null) return;
      if (event.phase !== "main") return;
      if (!node.startExpanded || node.deferExpansion || node.skippedContacts !== 0) return;
      if (node.search.gapIndex <= 0) return;
      snapshot = snapshotHandoffNode(node, key, event);
    },
  });
  if (snapshot === null) throw new Error("expected a clean handoff snapshot");
  return snapshot;
}

describe("optimizer/handoff.ts - prefix hand-off search", () => {
  test("satisfies the determinism contract (same spec/seed/budget -> identical Track)", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const compile: BudgetCompile = (inputSpec, opts) =>
      compileHandoff(inputSpec, opts.seed, {
        budget: opts.budget,
        maxNodes: opts.maxNodes ?? 12,
        polish: false,
      });
    assertBudgetSearchContract(compile, "tiny_dance/handoff", spec, { budget: 20_000, maxNodes: 12 });
  }, 120_000);

  test("compileBudgetCurve returns one checkpoint per budget; checkpointAt finds/throws", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const budgets = [7_000, 20_000];
    const curve = compileBudgetCurve(spec, 0, budgets, { maxNodes: 12, polish: false });
    expect(curve.map((c) => c.budget)).toEqual(budgets);
    // each curve entry is an INDEPENDENT run == a direct single-budget compile (byte-identical)
    for (const budget of budgets) {
      const direct = compileHandoff(spec, 0, { budget, maxNodes: 12, polish: false });
      expect(hashTrack(checkpointAt(curve, budget).track)).toBe(hashTrack(direct.track));
    }
    expect(() => checkpointAt(curve, 999_999)).toThrow(/missing checkpoint for budget 999999/);
  }, 120_000);

  test("same (spec, seed, budget) records identical work and previews", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const budget = 20_000;
    const a = checkpoint(compileHandoff(spec, 0, { budget, maxNodes: 12, polish: false }), budget);
    const b = checkpoint(compileHandoff(spec, 0, { budget, maxNodes: 12, polish: false }), budget);
    expect(hashTrack(a.track)).toBe(hashTrack(b.track));
    expect(a.stats.sim_frames).toBe(b.stats.sim_frames);
    expect(a.stats.candidates_sampled).toBeGreaterThan(0);
    expect(a.stats.candidates_sampled).toBe(b.stats.candidates_sampled);
    expect(a.stats.candidates_viable).toBeGreaterThan(0);
    expect(a.stats.candidates_viable).toBeLessThanOrEqual(a.stats.candidates_sampled);
    expect(a.stats.candidates_viable).toBe(b.stats.candidates_viable);
    expect(a.stats.arc_placement?.sampled ?? 0).toBeGreaterThan(0);
    expect(a.stats.arc_placement?.by_sample_mode.normal.sampled ?? 0).toBeGreaterThan(0);
    expect(a.stats.arc_placement).toEqual(b.stats.arc_placement);
    expect(a.stats.handoff_reuse_attempts ?? 0).toBeGreaterThanOrEqual(a.stats.handoff_reuse_successes ?? 0);
    expect(a.stats.handoff_reuse_attempts).toBe(b.stats.handoff_reuse_attempts);
    expect(a.stats.handoff_reuse_successes).toBe(b.stats.handoff_reuse_successes);
    expect(a.stats.handoff_brake_attempts ?? 0).toBeGreaterThanOrEqual(a.stats.handoff_brake_successes ?? 0);
    expect(a.stats.handoff_brake_attempts).toBe(b.stats.handoff_brake_attempts);
    expect(a.stats.handoff_brake_successes).toBe(b.stats.handoff_brake_successes);
    expect(a.stats.handoff_axis_quality_attempts ?? 0).toBeGreaterThanOrEqual(
      a.stats.handoff_axis_quality_successes ?? 0,
    );
    expect(a.stats.handoff_axis_quality_attempts).toBe(b.stats.handoff_axis_quality_attempts);
    expect(a.stats.handoff_axis_quality_successes).toBe(b.stats.handoff_axis_quality_successes);
    expect(a.stats.handoff_axis_quality_by_axis).toEqual(b.stats.handoff_axis_quality_by_axis);
    const axisQualityTotal = AXES.reduce(
      (sum, axis) => sum + (a.stats.handoff_axis_quality_by_axis?.[axis]?.attempts ?? 0),
      0,
    );
    const axisQualitySuccessTotal = AXES.reduce(
      (sum, axis) => sum + (a.stats.handoff_axis_quality_by_axis?.[axis]?.successes ?? 0),
      0,
    );
    expect(axisQualityTotal).toBe(a.stats.handoff_axis_quality_attempts ?? 0);
    expect(axisQualitySuccessTotal).toBe(a.stats.handoff_axis_quality_successes ?? 0);
    expect(a.stats.handoff_axis_quality_by_axis?.air?.attempts ?? 0).toBe(
      a.stats.handoff_axis_quality_air_attempts ?? 0,
    );
    expect(a.stats.handoff_axis_quality_by_axis?.air?.successes ?? 0).toBe(
      a.stats.handoff_axis_quality_air_successes ?? 0,
    );
    expect(a.stats.handoff_axis_quality_air_attempts ?? 0).toBeGreaterThanOrEqual(
      a.stats.handoff_axis_quality_air_successes ?? 0,
    );
    expect(a.stats.handoff_axis_quality_air_attempts).toBe(
      b.stats.handoff_axis_quality_air_attempts,
    );
    expect(a.stats.handoff_axis_quality_air_successes).toBe(
      b.stats.handoff_axis_quality_air_successes,
    );
    expect(a.stats.handoff_tail_completion_attempts ?? 0).toBeGreaterThanOrEqual(
      a.stats.handoff_tail_completion_successes ?? 0,
    );
    expect(a.stats.handoff_tail_completion_successes ?? 0).toBeGreaterThanOrEqual(
      a.stats.handoff_tail_completion_improvements ?? 0,
    );
    expect(a.stats.handoff_tail_completion_attempts).toBe(b.stats.handoff_tail_completion_attempts);
    expect(a.stats.handoff_tail_completion_successes).toBe(b.stats.handoff_tail_completion_successes);
    expect(a.stats.handoff_tail_completion_improvements)
      .toBe(b.stats.handoff_tail_completion_improvements);
    expect(sumContactCountCounter(a.stats.handoff_tail_completion_attempts_by_remaining_contacts))
      .toBe(a.stats.handoff_tail_completion_attempts ?? 0);
    expect(sumContactCountCounter(a.stats.handoff_tail_completion_successes_by_remaining_contacts))
      .toBe(a.stats.handoff_tail_completion_successes ?? 0);
    expect(
      sumContactCountCounter(a.stats.handoff_tail_completion_improvements_by_remaining_contacts),
    ).toBe(a.stats.handoff_tail_completion_improvements ?? 0);
    expect(a.stats.handoff_tail_completion_attempts_by_remaining_contacts).toEqual(
      b.stats.handoff_tail_completion_attempts_by_remaining_contacts,
    );
    expect(a.stats.handoff_tail_completion_successes_by_remaining_contacts).toEqual(
      b.stats.handoff_tail_completion_successes_by_remaining_contacts,
    );
    expect(a.stats.handoff_tail_completion_improvements_by_remaining_contacts).toEqual(
      b.stats.handoff_tail_completion_improvements_by_remaining_contacts,
    );
    expect(a.stats.handoff_duplicate_evaluations ?? 0).toBeGreaterThanOrEqual(
      a.stats.handoff_duplicate_full_evaluations ?? 0,
    );
    expect(a.stats.handoff_duplicate_evaluations ?? 0).toBeLessThanOrEqual(
      a.stats.leaves_considered ?? 0,
    );
    expect(a.stats.handoff_duplicate_evaluations).toBe(b.stats.handoff_duplicate_evaluations);
    expect(a.stats.handoff_duplicate_full_evaluations)
      .toBe(b.stats.handoff_duplicate_full_evaluations);
    expect(sumPhaseCounter(a.stats.handoff_evaluations_by_phase)).toBe(
      a.stats.leaves_considered ?? 0,
    );
    expect(sumPhaseCounter(a.stats.handoff_full_evaluations_by_phase)).toBe(
      a.stats.handoff_full_evaluations ?? 0,
    );
    expect(sumPhaseCounter(a.stats.handoff_improvements_by_phase)).toBe(
      a.stats.improvements ?? 0,
    );
    expect(a.stats.handoff_evaluations_by_phase).toEqual(b.stats.handoff_evaluations_by_phase);
    expect(a.stats.handoff_full_evaluations_by_phase).toEqual(
      b.stats.handoff_full_evaluations_by_phase,
    );
    expect(a.stats.handoff_improvements_by_phase).toEqual(b.stats.handoff_improvements_by_phase);
    expect(sumPhaseCounter(a.stats.handoff_duplicate_evaluations_by_phase)).toBe(
      a.stats.handoff_duplicate_evaluations ?? 0,
    );
    expect(sumPhaseCounter(a.stats.handoff_duplicate_full_evaluations_by_phase)).toBe(
      a.stats.handoff_duplicate_full_evaluations ?? 0,
    );
    expect(a.stats.handoff_duplicate_evaluations_by_phase).toEqual(
      b.stats.handoff_duplicate_evaluations_by_phase,
    );
    expect(a.stats.handoff_duplicate_full_evaluations_by_phase).toEqual(
      b.stats.handoff_duplicate_full_evaluations_by_phase,
    );
    expect(a.stats.handoff_unique_full_evaluations ?? 0).toBeGreaterThanOrEqual(0);
    expect(a.stats.handoff_unique_full_evaluations ?? 0).toBe(
      Math.max(
        0,
        (a.stats.handoff_full_evaluations ?? 0) -
          (a.stats.handoff_duplicate_full_evaluations ?? 0),
      ),
    );
    expect(a.stats.handoff_unique_full_evaluations).toBe(
      b.stats.handoff_unique_full_evaluations,
    );
    expect(a.stats.search_nodes_expanded).toBeGreaterThan(0);
    expect(a.stats.handoff_frontier_size).toBeGreaterThanOrEqual(0);
    expect(a.stats.handoff_deepest_seen_gap).toBeGreaterThanOrEqual(0);
    expect(a.stats.handoff_start_ranks_seen).toBeGreaterThan(0);
    expect(a.stats.handoff_start_ranks_with_fits).toBeGreaterThan(0);
    expect(a.stats.handoff_selected_candidate_rank_count ?? 0).toBeGreaterThan(0);
    expect(a.stats.handoff_selected_candidate_rank_mean ?? 0).toBeGreaterThanOrEqual(0);
    expect(a.stats.handoff_selected_candidate_rank_max ?? 0).toBeGreaterThanOrEqual(
      a.stats.handoff_selected_candidate_rank_mean ?? 0,
    );
    expect(a.stats.handoff_selected_candidate_nonzero_ranks ?? 0).toBeLessThanOrEqual(
      a.stats.handoff_selected_candidate_rank_count ?? 0,
    );
    const selectedSourceCount =
      HANDOFF_CANDIDATE_SOURCES.reduce(
        (sum, source) => sum + (a.stats.handoff_selected_candidate_by_source?.[source] ?? 0),
        0,
      );
    expect(selectedSourceCount).toBe(a.stats.handoff_selected_candidate_rank_count);
    expect(a.stats.handoff_selected_candidate_by_source?.pool ?? 0).toBe(
      a.stats.handoff_selected_candidate_pool_count ?? 0,
    );
    expect(a.stats.handoff_selected_candidate_by_source?.reuse ?? 0).toBe(
      a.stats.handoff_selected_candidate_reuse_count ?? 0,
    );
    expect(a.stats.handoff_selected_candidate_by_source?.brake ?? 0).toBe(
      a.stats.handoff_selected_candidate_brake_count ?? 0,
    );
    expect(a.stats.handoff_selected_candidate_by_source?.axisq ?? 0).toBe(
      a.stats.handoff_selected_candidate_axis_quality_count ?? 0,
    );
    const selectedAxisQualityByAxis = AXES.reduce(
      (sum, axis) => sum + (a.stats.handoff_selected_axis_quality_by_axis?.[axis] ?? 0),
      0,
    );
    expect(selectedAxisQualityByAxis).toBe(
      a.stats.handoff_selected_candidate_by_source?.axisq ?? 0,
    );
    expect(a.stats.handoff_partial_evaluations).toBeGreaterThan(0);
    expect(a.stats.handoff_full_evaluations).toBeGreaterThan(0);
    expect(a.stats.handoff_previews).toBeGreaterThan(0);
    expect(a.stats.handoff_preview_contacts).toBeGreaterThan(0);
    expect(a.stats.handoff_preview_survivors).toBeGreaterThan(0);
    expect(a.stats.handoff_far_back_pulses).toBeGreaterThanOrEqual(0);
    expect(a.stats.handoff_partial_evaluations).toBe(b.stats.handoff_partial_evaluations);
    expect(a.stats.handoff_frontier_size).toBe(b.stats.handoff_frontier_size);
    expect(a.stats.handoff_frontier_oldest_gap_lag).toBe(b.stats.handoff_frontier_oldest_gap_lag);
    expect(a.stats.handoff_far_back_pulses).toBe(b.stats.handoff_far_back_pulses);
    expect(a.stats.handoff_start_ranks_seen).toBe(b.stats.handoff_start_ranks_seen);
    expect(a.stats.handoff_start_ranks_with_fits).toBe(b.stats.handoff_start_ranks_with_fits);
    expect(a.stats.handoff_selected_candidate_rank_count)
      .toBe(b.stats.handoff_selected_candidate_rank_count);
    expect(a.stats.handoff_selected_candidate_rank_mean)
      .toBe(b.stats.handoff_selected_candidate_rank_mean);
    expect(a.stats.handoff_selected_candidate_rank_max)
      .toBe(b.stats.handoff_selected_candidate_rank_max);
    expect(a.stats.handoff_selected_candidate_nonzero_ranks)
      .toBe(b.stats.handoff_selected_candidate_nonzero_ranks);
    expect(a.stats.handoff_selected_candidate_pool_count)
      .toBe(b.stats.handoff_selected_candidate_pool_count);
    expect(a.stats.handoff_selected_candidate_reuse_count)
      .toBe(b.stats.handoff_selected_candidate_reuse_count);
    expect(a.stats.handoff_selected_candidate_brake_count)
      .toBe(b.stats.handoff_selected_candidate_brake_count);
    expect(a.stats.handoff_selected_candidate_axis_quality_count)
      .toBe(b.stats.handoff_selected_candidate_axis_quality_count);
    expect(a.stats.handoff_selected_candidate_by_source)
      .toEqual(b.stats.handoff_selected_candidate_by_source);
    expect(a.stats.handoff_selected_axis_quality_by_axis)
      .toEqual(b.stats.handoff_selected_axis_quality_by_axis);
    expect(a.stats.handoff_full_evaluations).toBe(b.stats.handoff_full_evaluations);
    expect(a.stats.handoff_preview_contacts).toBe(b.stats.handoff_preview_contacts);
    expect(a.stats.handoff_preview_survivors).toBe(b.stats.handoff_preview_survivors);
  }, 60_000);

  test("forward-eval cost+agreement instrument is populated and self-consistent at gate budget", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    // Default fwd-eval gate is 75k; at 100k the pool is scored by the true forward rollout.
    const budget = 100_000;
    const prevLeaf = process.env.LR_FWD_EVAL_LEAF;
    let a!: ReturnType<typeof checkpoint>;
    let b!: ReturnType<typeof checkpoint>;
    try {
      process.env.LR_FWD_EVAL_LEAF = "full";
      a = checkpoint(compileHandoff(spec, 0, { budget, polish: false }), budget);
      b = checkpoint(compileHandoff(spec, 0, { budget, polish: false }), budget);
    } finally {
      if (prevLeaf === undefined) delete process.env.LR_FWD_EVAL_LEAF;
      else process.env.LR_FWD_EVAL_LEAF = prevLeaf;
    }
    const fe = a.stats.fwd_eval;
    expect(fe).toBeDefined();
    expect(a.stats.fwd_eval).toEqual(b.stats.fwd_eval); // deterministic, measure-only
    if (fe === undefined) return;
    // Cost counters are non-negative; a charged rollout was performed.
    expect(fe.fwd_eval_calls).toBeGreaterThan(0);
    expect(fe.fwd_eval_frames_charged).toBeGreaterThan(0);
    expect(fe.start_eval_frames_charged).toBeGreaterThanOrEqual(0);
    expect(fe.fwd_eval_frames_charged).toBeLessThanOrEqual(a.stats.sim_frames ?? Infinity);
    // Agreement counters: agreements are a subset of pools; disagreements are the complement.
    expect(fe.fwd_pools).toBeGreaterThan(0);
    expect(fe.fwd_top1_agree).toBeLessThanOrEqual(fe.fwd_pools);
    expect(fe.fwd_top1_agree + fe.fwd_disagree_count).toBe(fe.fwd_pools);
    // Aimed: winners/pools-with-aimed are subsets of all pools.
    expect(fe.fwd_pools_with_aimed).toBeLessThanOrEqual(fe.fwd_pools);
    expect(fe.fwd_winner_aimed).toBeLessThanOrEqual(fe.fwd_pools_with_aimed);
    // Value gap on disagreement is non-negative (forward winner has >= value than quality #1).
    expect(fe.fwd_disagree_value_gap_sum).toBeGreaterThanOrEqual(0);
    // Rank histograms: 8 cells each, summing to pools (one entry per pool).
    expect(fe.fwd_winner_quality_rank_hist).toHaveLength(8);
    expect(fe.fwd_quality_top1_fwd_rank_hist).toHaveLength(8);
    expect(fe.fwd_winner_quality_rank_hist.reduce((s, n) => s + n, 0)).toBe(fe.fwd_pools);
    expect(fe.fwd_quality_top1_fwd_rank_hist.reduce((s, n) => s + n, 0)).toBe(fe.fwd_pools);
    // Impact-targeted split spans every pool (agree + disagree, impact-targeted or not).
    expect(
      fe.fwd_agree_impact_targeted + fe.fwd_agree_not_impact_targeted +
        fe.fwd_disagree_impact_targeted + fe.fwd_disagree_not_impact_targeted,
    ).toBe(fe.fwd_pools);
    // Value-gap histogram: 6 cells summing to the disagreement count.
    expect(fe.fwd_disagree_value_gap_hist).toHaveLength(6);
    expect(fe.fwd_disagree_value_gap_hist.reduce((s, n) => s + n, 0)).toBe(fe.fwd_disagree_count);
    // Cost-sign + aimed-asymmetry counters are subsets of disagreements.
    expect(fe.fwd_disagree_winner_costlier + fe.fwd_disagree_winner_cheaper)
      .toBeLessThanOrEqual(fe.fwd_disagree_count);
    expect(fe.fwd_disagree_winner_aimed_q1_not).toBeLessThanOrEqual(fe.fwd_disagree_count);
    expect(fe.fwd_disagree_q1_aimed_winner_not).toBeLessThanOrEqual(fe.fwd_disagree_count);
    // New leaf-mode counters (default/full path): non-negative; dead-uncovered ⊆ all reports;
    // full-leaf path produced at least one report and the dead-rider proof is rare (≈0).
    expect(fe.fwd_rollout_no_candidate).toBeGreaterThanOrEqual(0);
    expect(fe.fwd_leaf_reports).toBeGreaterThan(0);
    expect(fe.fwd_leaf_dead_uncovered).toBeGreaterThanOrEqual(0);
    expect(fe.fwd_leaf_dead_uncovered).toBeLessThanOrEqual(fe.fwd_leaf_reports);
  }, 120_000);

  test("explicit default search seed preserves public compile behavior", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const budget = 20_000;
    const implicit = checkpoint(
      compileHandoff(spec, 2, { budget, maxNodes: 12, polish: false }),
      budget,
    );
    const explicit = checkpoint(
      compileHandoff(spec, 2, {
        budget,
        maxNodes: 12,
        polish: false,
        searchSeed: 2,
      }),
      budget,
    );
    expect(hashTrack(explicit.track)).toBe(hashTrack(implicit.track));
    expect(explicit.stats.sim_frames).toBe(implicit.stats.sim_frames);
    expect(explicit.stats.handoff_search_seed).toBe(2);
  }, 60_000);

  test("can return an honest partial/failing prefix under a small budget", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const result = checkpoint(compileHandoff(spec, 0, {
      budget: 1,
      maxNodes: 12,
      polish: false,
    }), 1);
    expect(result.track.lines.length).toBeGreaterThanOrEqual(0);
    expect(result.track.duration).toBeLessThan(secToFrame(spec.duration) + 20);
    expect(result.report.terminus.reason).not.toBe("endOfSpec");
    expect(result.report.contacts.length).toBeGreaterThan(0);
    expect(result.report.contacts.every((contact) => contact.status === "missing")).toBe(true);
    expect(result.stats.budget_exhausted).toBe(true);
    expect(result.stats.leaves_considered).toBeGreaterThan(0);
    expect(result.stats.handoff_partial_evaluations).toBeGreaterThan(0);
  }, 120_000);

  test("visits deferred start roots before requeueing one under a small budget", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const seen: { gapIndex: number; deferExpansion: boolean }[] = [];
    // This exercises the raw deferred-start-root SCHEDULER, not the start ranker, so pin
    // start-eval off (default greedy:2 reorders starts and spends up-front budget, perturbing
    // this delicately-tuned scenario). At 20k fwd-eval (gate 75k) and repair (gate 150k) are
    // already off. The contact-centered NORMAL family emits longer ride-outs, so 12k exhausts
    // within the first start root before any deferral; 16k re-exercises the deferred-root path
    // (root-0 deferred visits before the first requeue) with budget still spent. (Was 20k
    // before the short-horizon gap fit; cheaper evals let 20k complete without exhaustion —
    // the scenario passes for budgets 10k-18k under the new frame economics.)
    const prevStartEval = process.env.LR_START_EVAL;
    process.env.LR_START_EVAL = "off";
    // Same reasoning for the enumerative proposer (optimizer/aim.ts, default
    // on): its metered probe frames shift this scenario's budget arithmetic.
    const prevAimEnum = process.env.LR_AIM_ENUM;
    process.env.LR_AIM_ENUM = "0";
    try {
      const budget = 16_000;
      const result = checkpoint(compileHandoff(spec, 0, {
        budget,
        maxNodes: 12,
        polish: false,
        onNode: (node) => {
          seen.push({
            gapIndex: node.search.gapIndex,
            deferExpansion: node.deferExpansion,
          });
        },
      }), budget);

      expect(result.stats.budget_exhausted).toBe(true);
      expect(seen.length).toBeGreaterThan(1);
      const firstRequeued = seen.findIndex((node, index) => index > 0 && !node.deferExpansion);
      expect(firstRequeued).toBeGreaterThan(1);
      expect(seen.slice(1, firstRequeued).every((node) => node.deferExpansion)).toBe(true);
      expect(seen.slice(0, firstRequeued).every((node) => node.gapIndex === 0)).toBe(true);
    } finally {
      if (prevStartEval === undefined) delete process.env.LR_START_EVAL;
      else process.env.LR_START_EVAL = prevStartEval;
      if (prevAimEnum === undefined) delete process.env.LR_AIM_ENUM;
      else process.env.LR_AIM_ENUM = prevAimEnum;
    }
  }, 60_000);

  test("polish path uses the selected root start state", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const result = checkpoint(compileHandoff(spec, 0, {
      budget: 8_000,
      maxNodes: 12,
      polish: true,
    }), 8_000);
    expect(result.stats.handoff_start_options).toBeGreaterThan(1);
    expect(result.stats.leaves_considered).toBeGreaterThan(0);
  }, 60_000);

  test("handoff snapshots clear search caches while preserving prefix state", async () => {
    const snapshot = await firstCleanSnapshot();
    expect(snapshot.node.search.gapIndex).toBeGreaterThan(0);
    expect(snapshot.node.search.prefixFits.length).toBe(snapshot.node.search.gapIndex);
    expect(snapshot.node.search._candidatesCache).toBeNull();
    expect(snapshot.node.search._childrenCache).toBeUndefined();
    expect(snapshot.node.rankTrace.length).toBe(snapshot.node.search.gapIndex);
    for (const entry of snapshot.node.rankTrace) {
      expect(entry.source === "axisq" || entry.sourceAxis === undefined).toBe(true);
    }
    expect(snapshot.node.skippedContacts).toBe(0);
    expect(snapshot.event.simFrames).toBeGreaterThan(0);
  }, 60_000);

  test("can continue handoff search from a prefix snapshot", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const snapshot = await firstCleanSnapshot();
    const prefixLineCount = snapshot.node.search.prefixFits
      .reduce((sum, fit) => sum + (fit === null ? 0 : fit.lines.length), 0);
    const result = checkpoint(compileHandoffFromSnapshot(spec, 0, snapshot, {
      budget: 5_000,
      searchSeed: 123,
      maxNodes: 8,
      polish: false,
    }), 5_000);

    expect(result.stats.sim_frames).toBeGreaterThan(0);
    expect(result.stats.handoff_start_options).toBe(0);
    expect(result.stats.handoff_start_rank).toBe(snapshot.node.startRank);
    expect(result.stats.handoff_search_seed).toBe(123);
    expect(result.track.lines.length).toBeGreaterThanOrEqual(prefixLineCount);
  }, 60_000);
});

describe("optimizer/handoff.ts - objective leaf scorer (LR_FWD_EVAL_LEAF=objective)", () => {
  // Minimal Gap/GapFit/SearchNode fixtures. New contract — objectiveLeafValue reconstructs the
  // true scorer from committed data:
  //   value = 1000 × axisQualityFromErrors(ALL committed-prefix errors)   // one COMBINED RMS
  //                × survival(lastContactEndFrame/totalFrames) × exp(-min(20, remainingContacts))
  // No readiness, no drift/off_beat (structurally 1 on gate-passed contacts); missedContacts ignored.
  const contactGap = (index: number, targets: AxisValues): Gap => ({
    index,
    startFrame: index * 30,
    endFrame: index * 30 + 30,
    endsWithContact: true,
    targets,
  });
  const nonContactGap = (index: number): Gap => ({
    index,
    startFrame: index * 30,
    endFrame: index * 30 + 30,
    endsWithContact: false,
    targets: {},
  });
  const fitWith = (achieved: AxisValues): GapFit => ({
    arc: null,
    geometry: "lines",
    lines: [],
    achieved,
    cost: 0,
  });
  const leafOf = (prefixFits: (GapFit | null)[]): SearchNode =>
    ({ gapIndex: prefixFits.length, prefixFits } as unknown as SearchNode);
  // objectiveLeafValue scores against the module-global TRUE targets (fwdEvalGapAxisTargets),
  // NOT gap.targets. Install per-gap-index true targets so the unit fixtures are scored by the
  // same ruler the production path uses.
  const installTargets = (gaps: Gap[]): AxisValues[] => {
    const targets = gaps.map((g) => g.targets);
    setForwardEvalContext({} as unknown as Spec, targets);
    return targets;
  };

  const DUR = 1200;
  // Reference implementation of the new contract, for cross-checking objectiveLeafValue.
  const expected = (gaps: Gap[], fits: (GapFit | null)[], dur = DUR): number => {
    const targets = gaps.map((g) => g.targets);
    const errors: number[] = [];
    let missingFitCount = 0;
    for (let i = 0; i < fits.length; i++) {
      if (!gaps[i]?.endsWithContact) continue;
      const fit = fits[i];
      if (fit == null) {
        missingFitCount += 1;
        continue;
      }
      for (const e of axisErrorsForTargets(targets[i], fit.achieved)) errors.push(e);
    }
    let v = 1000 * axisQualityFromErrors(errors).axis_quality;
    if (missingFitCount > 0) v *= Math.exp(-missingFitCount);
    let horizon = 0;
    for (let i = Math.min(fits.length, gaps.length) - 1; i >= 0; i--) {
      if (gaps[i].endsWithContact) {
        horizon = gaps[i].endFrame;
        break;
      }
    }
    // Terminal leaf (no contact gap remains at/after fits.length) ⇒ reachedEnd ⇒ survival 1;
    // partial leaf keeps the lastContact/duration proxy (matches the full leaf's clamped survival).
    const isTerminal = fits.length >= gaps.length ||
      !gaps.slice(fits.length).some((g) => g.endsWithContact);
    const survival = isTerminal ? 1 : (dur > 0 ? Math.min(1, Math.max(0, horizon / dur)) : 0);
    const remaining = gaps.slice(fits.length).filter((g) => g.endsWithContact).length;
    v *= survival * Math.exp(-Math.min(20, remaining) / 1.0);
    return v;
  };

  test("axis is ONE combined RMS over the whole committed prefix, NOT a per-gap product", () => {
    const t0: AxisValues = { speed: 1.0 };
    const t1: AxisValues = { speed: 1.0 };
    const gaps = [contactGap(0, t0), contactGap(1, t1)];
    installTargets(gaps);
    const f0 = fitWith({ speed: 1.0 }); // error 0
    const f1 = fitWith({ speed: 0.7 }); // error -0.3
    const leaf = leafOf([f0, f1]);
    const combined = axisQualityFromErrors([
      ...axisErrorsForTargets(t0, f0.achieved),
      ...axisErrorsForTargets(t1, f1.achieved),
    ]).axis_quality;
    const product = axisQualityForTargets(t0, f0.achieved).axis_quality *
      axisQualityForTargets(t1, f1.achieved).axis_quality;
    expect(combined).not.toBeCloseTo(product, 4); // the fold genuinely differs
    expect(objectiveLeafValue(leaf, 0, gaps, 0, DUR)).toBeCloseTo(expected(gaps, [f0, f1]), 9);
  });

  test("survival_quality (PARTIAL leaf) = last committed contact endFrame / totalFrames", () => {
    const t0: AxisValues = { speed: 1.0 };
    const t1: AxisValues = { speed: 1.0 };
    const gaps = [contactGap(0, t0), contactGap(1, t1)]; // 2 contacts ⇒ a 1-fit leaf is PARTIAL
    installTargets(gaps);
    const f0 = fitWith({ speed: 1.0 }); // perfect ⇒ axis_quality 1
    const leaf = leafOf([f0]); // 1 of 2 committed ⇒ gap 1 still ahead ⇒ partial
    // axis 1 × survival(30/DUR) × missing exp(-1) (one remaining contact)
    expect(objectiveLeafValue(leaf, 0, gaps, 0, DUR)).toBeCloseTo(1000 * (30 / DUR) * Math.exp(-1), 9);
    // halve the duration ⇒ survival doubles
    expect(objectiveLeafValue(leaf, 0, gaps, 0, DUR / 2)).toBeCloseTo(1000 * (30 / (DUR / 2)) * Math.exp(-1), 9);
  });

  test("survival_quality (TERMINAL leaf) reproduces the scorer's reachedEnd = 1", () => {
    const t0: AxisValues = { speed: 1.0 };
    const gaps = [contactGap(0, t0)]; // single contact ⇒ a leaf covering it is terminal (reachedEnd)
    installTargets(gaps);
    const f0 = fitWith({ speed: 1.0 }); // perfect ⇒ axis_quality 1
    const leaf = leafOf([f0]);
    // Terminal ⇒ survival 1 (NOT 30/DUR); no remaining contacts ⇒ missing 1 ⇒ value 1000.
    expect(objectiveLeafValue(leaf, 0, gaps, 0, DUR)).toBeCloseTo(1000, 9);
    // Duration no longer scales a terminal leaf's survival.
    expect(objectiveLeafValue(leaf, 0, gaps, 0, DUR / 2)).toBeCloseTo(1000, 9);
  });

  test("missedContacts argument is IGNORED (subsumed by depth-based survival/missing)", () => {
    const t0: AxisValues = { speed: 1.0 };
    const gaps = [contactGap(0, t0)];
    installTargets(gaps);
    const f0 = fitWith({ speed: 1.0 });
    const leaf = leafOf([f0]);
    const base = objectiveLeafValue(leaf, 0, gaps, 0, DUR);
    expect(objectiveLeafValue(leaf, 0, gaps, 5, DUR)).toBeCloseTo(base, 9);
  });

  test("missing_quality = exp(-min(20, remaining contact gaps past the leaf))", () => {
    const t: AxisValues = { speed: 1.0 };
    const gaps = [contactGap(0, t), contactGap(1, t), contactGap(2, t)];
    installTargets(gaps);
    const f0 = fitWith({ speed: 1.0 });
    const leaf = leafOf([f0]); // gapIndex 1 ⇒ contacts 1,2 remain ⇒ futureMissing 2
    const axis = axisQualityForTargets(t, f0.achieved).axis_quality;
    expect(objectiveLeafValue(leaf, 0, gaps, 0, DUR))
      .toBeCloseTo(1000 * axis * (30 / DUR) * Math.exp(-2), 9);
    expect(objectiveLeafValue(leaf, 0, gaps, 0, DUR)).toBeCloseTo(expected(gaps, [f0]), 9);
  });

  test("non-contact gaps in the prefix are skipped", () => {
    const t0: AxisValues = { speed: 1.0 };
    const t2: AxisValues = { speed: 1.0 };
    const gaps = [contactGap(0, t0), nonContactGap(1), contactGap(2, t2)];
    installTargets(gaps);
    const f0 = fitWith({ speed: 1.0 });
    const f2 = fitWith({ speed: 0.8 });
    const leaf = leafOf([f0, null, f2]);
    expect(objectiveLeafValue(leaf, 0, gaps, 0, DUR)).toBeCloseTo(expected(gaps, [f0, null, f2]), 9);
  });

  test("a CONTACT gap with a null fit applies the defensive e^-1 factor", () => {
    const t0: AxisValues = { speed: 1.0 };
    const t1: AxisValues = { speed: 1.0 };
    const gaps = [contactGap(0, t0), contactGap(1, t1)];
    installTargets(gaps);
    const f0 = fitWith({ speed: 1.0 });
    const leaf = leafOf([f0, null]); // gap 1 is a contact with no committed catch ⇒ ×e^-1
    expect(objectiveLeafValue(leaf, 0, gaps, 0, DUR)).toBeCloseTo(expected(gaps, [f0, null]), 9);
  });

  test("rootGapIndex is ignored — axis spans the whole prefix either way", () => {
    const t: AxisValues = { speed: 1.0 };
    const gaps = [contactGap(0, t), contactGap(1, t)];
    installTargets(gaps);
    const f0 = fitWith({ speed: 0.5 });
    const f1 = fitWith({ speed: 1.0 });
    const leaf = leafOf([f0, f1]);
    expect(objectiveLeafValue(leaf, 1, gaps, 0, DUR))
      .toBeCloseTo(objectiveLeafValue(leaf, 0, gaps, 0, DUR), 9);
  });

  test("flag default is the short leaf: env-unset ≡ LR_FWD_EVAL_LEAF=objective at 100k", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const budget = 100_000;
    const prev = process.env.LR_FWD_EVAL_LEAF;
    delete process.env.LR_FWD_EVAL_LEAF;
    const unset = checkpoint(compileHandoff(spec, 0, { budget, polish: false }), budget);
    process.env.LR_FWD_EVAL_LEAF = "objective";
    const objective = checkpoint(compileHandoff(spec, 0, { budget, polish: false }), budget);
    if (prev === undefined) delete process.env.LR_FWD_EVAL_LEAF;
    else process.env.LR_FWD_EVAL_LEAF = prev;
    // The default is now the objective (short) leaf, so env-unset is byte-identical to it.
    expect(hashTrack(objective.track)).toBe(hashTrack(unset.track));
    expect(objective.stats.sim_frames).toBe(unset.stats.sim_frames);
    expect(objective.stats.fwd_eval).toEqual(unset.stats.fwd_eval);
  }, 120_000);

  test("shadow leaf ranks identically to full: byte-identical track + sim_frames at 100k", async () => {
    const spec = await loadGoldenSpec("big_air_ramp", "base");
    const budget = 100_000;
    const prev = process.env.LR_FWD_EVAL_LEAF;
    const prevRd = process.env.LR_FWD_EVAL_LEAF_READINESS;
    process.env.LR_FWD_EVAL_LEAF = "full";
    const full = checkpoint(compileHandoff(spec, 0, { budget, polish: false }), budget);
    process.env.LR_FWD_EVAL_LEAF = "shadow";
    process.env.LR_FWD_EVAL_LEAF_READINESS = "0";
    const shadow = checkpoint(compileHandoff(spec, 0, { budget, polish: false }), budget);
    if (prev === undefined) delete process.env.LR_FWD_EVAL_LEAF;
    else process.env.LR_FWD_EVAL_LEAF = prev;
    if (prevRd === undefined) delete process.env.LR_FWD_EVAL_LEAF_READINESS;
    else process.env.LR_FWD_EVAL_LEAF_READINESS = prevRd;
    // Shadow ranks by the full leaf, so the produced track is byte-identical to full mode and
    // charges identical frames; it only ADDS measure-only objective-vs-full agreement telemetry.
    expect(hashTrack(shadow.track)).toBe(hashTrack(full.track));
    expect(shadow.stats.sim_frames).toBe(full.stats.sim_frames);
    const fe = shadow.stats.fwd_eval;
    expect(fe).toBeDefined();
    if (fe === undefined) return;
    // The shadow agreement instrument populated (pools seen ⇒ agreement recorded).
    expect(fe.shadow_pools).toBeGreaterThan(0);
    expect(fe.shadow_top1_agree + fe.shadow_disagree_count).toBe(fe.shadow_pools);
  }, 120_000);

  test("objective leaf is deterministic and collapses rollout frame cost vs full", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const budget = 100_000;
    const prev = process.env.LR_FWD_EVAL_LEAF;
    const prevHybrid = process.env.LR_FWD_EVAL_LEAF_HYBRID;

    process.env.LR_FWD_EVAL_LEAF = "full"; // explicit: the default is now the objective leaf
    const fullRun = checkpoint(compileHandoff(spec, 0, { budget, polish: false }), budget);

    process.env.LR_FWD_EVAL_LEAF = "objective";
    // Disable the impact hybrid (default on) to assert the PURE objective frame-collapse property;
    // the hybrid intentionally re-charges full-leaf frames on impact gaps (a quality fix, measured
    // separately).
    process.env.LR_FWD_EVAL_LEAF_HYBRID = "0";
    const objA = checkpoint(compileHandoff(spec, 0, { budget, polish: false }), budget);
    const objB = checkpoint(compileHandoff(spec, 0, { budget, polish: false }), budget);
    if (prev === undefined) delete process.env.LR_FWD_EVAL_LEAF;
    else process.env.LR_FWD_EVAL_LEAF = prev;
    if (prevHybrid === undefined) delete process.env.LR_FWD_EVAL_LEAF_HYBRID;
    else process.env.LR_FWD_EVAL_LEAF_HYBRID = prevHybrid;

    // Deterministic across reruns.
    expect(hashTrack(objA.track)).toBe(hashTrack(objB.track));
    expect(objA.stats.sim_frames).toBe(objB.stats.sim_frames);

    const feFull = fullRun.stats.fwd_eval;
    const feObj = objA.stats.fwd_eval;
    expect(feFull).toBeDefined();
    expect(feObj).toBeDefined();
    if (feFull === undefined || feObj === undefined) return;
    // Objective rollout charges far fewer frames (zero-frame leaf): < 0.5× full-mode.
    expect(feObj.fwd_eval_frames_charged).toBeLessThan(feFull.fwd_eval_frames_charged * 0.5);
    // New counters exist; default(full) run's dead-uncovered proof is rare (≈0).
    expect(feFull.fwd_leaf_reports).toBeGreaterThan(0);
    expect(feFull.fwd_leaf_dead_uncovered).toBeLessThanOrEqual(feFull.fwd_leaf_reports);
    // Objective run completes with a valid output.
    expect(objA.track.lines.length).toBeGreaterThan(0);
  }, 180_000);
});
