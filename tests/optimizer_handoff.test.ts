import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import {
  compileHandoff,
  compileHandoffFromSnapshot,
  snapshotHandoffNode,
  type HandoffNodeSnapshot,
} from "../scripts/v0/optimizer/handoff.ts";
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
    expect(a.stats.handoff_suffix_repair_attempts ?? 0).toBeGreaterThanOrEqual(
      a.stats.handoff_suffix_repair_successes ?? 0,
    );
    expect(a.stats.handoff_suffix_repair_successes ?? 0).toBeGreaterThanOrEqual(
      a.stats.handoff_suffix_repair_improvements ?? 0,
    );
    expect(a.stats.handoff_suffix_repair_attempts).toBe(b.stats.handoff_suffix_repair_attempts);
    expect(a.stats.handoff_suffix_repair_successes).toBe(b.stats.handoff_suffix_repair_successes);
    expect(a.stats.handoff_suffix_repair_improvements)
      .toBe(b.stats.handoff_suffix_repair_improvements);
    expect(a.stats.handoff_suffix_repair_nodes).toBe(b.stats.handoff_suffix_repair_nodes);
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
    expect(a.stats.handoff_prefix_branch_forks).toBeGreaterThanOrEqual(0);
    expect(a.stats.handoff_prefix_branch_evaluations).toBeGreaterThanOrEqual(0);
    expect(a.stats.handoff_prefix_branch_full_evaluations).toBeGreaterThanOrEqual(0);
    expect(a.stats.handoff_prefix_branch_improvements).toBeGreaterThanOrEqual(0);
    expect(a.stats.handoff_prefix_branch_duplicate_key_skips).toBeGreaterThanOrEqual(0);
    expect(sumContactCountCounter(a.stats.handoff_prefix_branch_forks_by_remaining_contacts))
      .toBe(a.stats.handoff_prefix_branch_forks ?? 0);
    expect(sumContactCountCounter(a.stats.handoff_prefix_branch_evaluations_by_remaining_contacts))
      .toBe(a.stats.handoff_prefix_branch_evaluations ?? 0);
    expect(
      sumContactCountCounter(a.stats.handoff_prefix_branch_full_evaluations_by_remaining_contacts),
    ).toBe(a.stats.handoff_prefix_branch_full_evaluations ?? 0);
    expect(
      sumContactCountCounter(a.stats.handoff_prefix_branch_improvements_by_remaining_contacts),
    ).toBe(a.stats.handoff_prefix_branch_improvements ?? 0);
    expect(sumContactCountCounter(a.stats.handoff_prefix_branch_prunes_by_remaining_contacts))
      .toBe(a.stats.handoff_prefix_branch_prunes ?? 0);
    expect(
      sumContactCountCounter(
        a.stats.handoff_prefix_branch_duplicate_key_skips_by_remaining_contacts,
      ),
    ).toBe(a.stats.handoff_prefix_branch_duplicate_key_skips ?? 0);
    expect(a.stats.handoff_partial_evaluations).toBe(b.stats.handoff_partial_evaluations);
    expect(a.stats.handoff_frontier_size).toBe(b.stats.handoff_frontier_size);
    expect(a.stats.handoff_frontier_oldest_gap_lag).toBe(b.stats.handoff_frontier_oldest_gap_lag);
    expect(a.stats.handoff_far_back_pulses).toBe(b.stats.handoff_far_back_pulses);
    expect(a.stats.handoff_prefix_branch_forks).toBe(b.stats.handoff_prefix_branch_forks);
    expect(a.stats.handoff_prefix_branch_evaluations).toBe(b.stats.handoff_prefix_branch_evaluations);
    expect(a.stats.handoff_prefix_branch_full_evaluations)
      .toBe(b.stats.handoff_prefix_branch_full_evaluations);
    expect(a.stats.handoff_prefix_branch_improvements)
      .toBe(b.stats.handoff_prefix_branch_improvements);
    expect(a.stats.handoff_prefix_branch_forks_by_remaining_contacts).toEqual(
      b.stats.handoff_prefix_branch_forks_by_remaining_contacts,
    );
    expect(a.stats.handoff_prefix_branch_evaluations_by_remaining_contacts).toEqual(
      b.stats.handoff_prefix_branch_evaluations_by_remaining_contacts,
    );
    expect(a.stats.handoff_prefix_branch_full_evaluations_by_remaining_contacts).toEqual(
      b.stats.handoff_prefix_branch_full_evaluations_by_remaining_contacts,
    );
    expect(a.stats.handoff_prefix_branch_improvements_by_remaining_contacts).toEqual(
      b.stats.handoff_prefix_branch_improvements_by_remaining_contacts,
    );
    expect(a.stats.handoff_prefix_branch_prunes_by_remaining_contacts).toEqual(
      b.stats.handoff_prefix_branch_prunes_by_remaining_contacts,
    );
    expect(a.stats.handoff_prefix_branch_duplicate_key_skips).toBe(
      b.stats.handoff_prefix_branch_duplicate_key_skips,
    );
    expect(a.stats.handoff_prefix_branch_duplicate_key_skips_by_remaining_contacts).toEqual(
      b.stats.handoff_prefix_branch_duplicate_key_skips_by_remaining_contacts,
    );
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
    const budget = 10_000;
    // This characterizes the scheduler's deferred-start-root requeueing under a tiny
    // budget. The pattern depends on per-gap candidate yield at 10k; it was written
    // for the `impact_anchor` family (fast early yield). The now-default `continuous`
    // converges slower, so pin impact_anchor to keep testing the scheduler property
    // it was designed around (the scheduler logic itself is mode-agnostic).
    const prevMode = process.env.LR_ARC_PLACEMENT;
    process.env.LR_ARC_PLACEMENT = "impact_anchor";
    let result;
    try {
      result = checkpoint(compileHandoff(spec, 0, {
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
    } finally {
      if (prevMode === undefined) delete process.env.LR_ARC_PLACEMENT;
      else process.env.LR_ARC_PLACEMENT = prevMode;
    }

    expect(result.stats.budget_exhausted).toBe(true);
    expect(seen.length).toBeGreaterThan(1);
    const firstRequeued = seen.findIndex((node, index) => index > 0 && !node.deferExpansion);
    expect(firstRequeued).toBeGreaterThan(1);
    expect(seen.slice(1, firstRequeued).every((node) => node.deferExpansion)).toBe(true);
    expect(seen.slice(0, firstRequeued).every((node) => node.gapIndex === 0)).toBe(true);
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
