import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import {
  compileHandoff,
  compileHandoffFromSnapshot,
  snapshotHandoffNode,
  type HandoffNodeSnapshot,
} from "../scripts/v0/optimizer/handoff.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import { secToFrame } from "../scripts/v0/types.ts";
import {
  assertBudgetSearchContract,
  type BudgetCompile,
} from "./budget_contract_harness.ts";
import type { CompileCheckpoint, CompileResult } from "../scripts/v0/optimizer/types.ts";

function hashTrack(track: unknown): string {
  return createHash("sha256").update(JSON.stringify(track)).digest("hex");
}

function checkpoint(result: CompileResult, budget: number): CompileCheckpoint {
  const found = result.checkpoints.find((c) => c.budget === budget);
  if (found === undefined) throw new Error(`missing checkpoint ${budget}`);
  return found;
}

async function firstCleanSnapshot(): Promise<HandoffNodeSnapshot> {
  const spec = await loadGoldenSpec("tiny_dance", "base");
  let snapshot: HandoffNodeSnapshot | null = null;
  compileHandoff(spec, 0, {
    budgets: [20_000],
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
  test("satisfies the architecture-agnostic budget-search contract", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const compile: BudgetCompile = (inputSpec, opts) =>
      compileHandoff(inputSpec, opts.seed, {
        budgets: opts.budgets,
        maxNodes: opts.maxNodes ?? 12,
        polish: false,
      });
    assertBudgetSearchContract(compile, "tiny_dance/handoff", spec, {
      budgets: [1, 7_000, 20_000],
      checkFreeze: true,
      freezeMaxNodes: 12,
    });
  }, 120_000);

  test("same (spec, seed, budget) records identical work and previews", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const budget = 20_000;
    const a = checkpoint(compileHandoff(spec, 0, { budgets: [budget], maxNodes: 12, polish: false }), budget);
    const b = checkpoint(compileHandoff(spec, 0, { budgets: [budget], maxNodes: 12, polish: false }), budget);
    expect(hashTrack(a.track)).toBe(hashTrack(b.track));
    expect(a.stats.sim_frames).toBe(b.stats.sim_frames);
    expect(a.stats.candidates_sampled).toBeGreaterThan(0);
    expect(a.stats.candidates_sampled).toBe(b.stats.candidates_sampled);
    expect(a.stats.candidates_viable).toBeGreaterThan(0);
    expect(a.stats.candidates_viable).toBeLessThanOrEqual(a.stats.candidates_sampled);
    expect(a.stats.candidates_viable).toBe(b.stats.candidates_viable);
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
    expect(a.stats.handoff_axis_quality_air_attempts ?? 0).toBeGreaterThanOrEqual(
      a.stats.handoff_axis_quality_air_successes ?? 0,
    );
    expect(a.stats.handoff_axis_quality_air_attempts).toBe(
      b.stats.handoff_axis_quality_air_attempts,
    );
    expect(a.stats.handoff_axis_quality_air_successes).toBe(
      b.stats.handoff_axis_quality_air_successes,
    );
    expect(a.stats.handoff_axis_quality_contact_style_attempts ?? 0).toBeGreaterThanOrEqual(
      a.stats.handoff_axis_quality_contact_style_successes ?? 0,
    );
    expect(a.stats.handoff_axis_quality_contact_style_attempts).toBe(
      b.stats.handoff_axis_quality_contact_style_attempts,
    );
    expect(a.stats.handoff_axis_quality_contact_style_successes).toBe(
      b.stats.handoff_axis_quality_contact_style_successes,
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
    expect(a.stats.search_nodes_expanded).toBeGreaterThan(0);
    expect(a.stats.handoff_frontier_size).toBeGreaterThanOrEqual(0);
    expect(a.stats.handoff_deepest_seen_gap).toBeGreaterThanOrEqual(0);
    expect(a.stats.handoff_start_ranks_seen).toBeGreaterThan(0);
    expect(a.stats.handoff_start_ranks_with_fits).toBeGreaterThan(0);
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
    expect(a.stats.handoff_start_ranks_seen).toBe(b.stats.handoff_start_ranks_seen);
    expect(a.stats.handoff_start_ranks_with_fits).toBe(b.stats.handoff_start_ranks_with_fits);
    expect(a.stats.handoff_full_evaluations).toBe(b.stats.handoff_full_evaluations);
    expect(a.stats.handoff_preview_contacts).toBe(b.stats.handoff_preview_contacts);
    expect(a.stats.handoff_preview_survivors).toBe(b.stats.handoff_preview_survivors);
  }, 60_000);

  test("explicit default search seed preserves public compile behavior", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const budget = 20_000;
    const implicit = checkpoint(
      compileHandoff(spec, 2, { budgets: [budget], maxNodes: 12, polish: false }),
      budget,
    );
    const explicit = checkpoint(
      compileHandoff(spec, 2, {
        budgets: [budget],
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
      budgets: [1],
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
    const result = checkpoint(compileHandoff(spec, 0, {
      budgets: [6_700],
      maxNodes: 12,
      polish: false,
      onNode: (node) => {
        seen.push({
          gapIndex: node.search.gapIndex,
          deferExpansion: node.deferExpansion,
        });
      },
    }), 6_700);

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
      budgets: [8_000],
      maxNodes: 12,
      polish: true,
    }), 8_000);
    expect(result.stats.handoff_start_options).toBeGreaterThan(1);
    expect(result.stats.leaves_considered).toBeGreaterThan(0);
  }, 60_000);

  test("multi-budget checkpoints match standalone budget compiles byte-for-byte", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const budgets = [7_000, 20_000, 30_000];
    const multi = compileHandoff(spec, 0, { budgets, maxNodes: 20, polish: false });
    for (const budget of budgets) {
      const standalone = compileHandoff(spec, 0, { budgets: [budget], maxNodes: 20, polish: false });
      expect(hashTrack(checkpoint(multi, budget).track)).toBe(hashTrack(checkpoint(standalone, budget).track));
    }
  }, 120_000);

  test("handoff snapshots clear search caches while preserving prefix state", async () => {
    const snapshot = await firstCleanSnapshot();
    expect(snapshot.node.search.gapIndex).toBeGreaterThan(0);
    expect(snapshot.node.search.prefixFits.length).toBe(snapshot.node.search.gapIndex);
    expect(snapshot.node.search._candidatesCache).toBeNull();
    expect(snapshot.node.search._childrenCache).toBeUndefined();
    expect(snapshot.node.ranks.length).toBe(snapshot.node.search.gapIndex);
    expect(snapshot.node.skippedContacts).toBe(0);
    expect(snapshot.event.simFrames).toBeGreaterThan(0);
  }, 60_000);

  test("can continue handoff search from a prefix snapshot", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const snapshot = await firstCleanSnapshot();
    const prefixLineCount = snapshot.node.search.prefixFits
      .reduce((sum, fit) => sum + (fit === null ? 0 : fit.lines.length), 0);
    const result = checkpoint(compileHandoffFromSnapshot(spec, 0, snapshot, {
      budgets: [5_000],
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
