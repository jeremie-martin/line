import { describe, expect, test } from "vitest";
import { makeRng } from "../scripts/lib/rng.ts";
import { resetPerCompileState } from "../scripts/v0/core/compile_lifecycle.ts";
import {
  effectiveAxes,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
} from "../scripts/v0/core/substrate.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import { setAimCompileBudgetFrames } from "../scripts/v0/optimizer/aim.ts";
import {
  compileHandoff,
  readFwdEvalCounters,
  redrawFirstHopOnEmpty,
} from "../scripts/v0/optimizer/handoff.ts";
import {
  getCandidatesSorted,
  isRolloutAimSuppressed,
  makeRootNode,
  setRolloutAimSuppressed,
  setRolloutContext,
} from "../scripts/v0/optimizer/node.ts";
import type { Candidate, SpecContext } from "../scripts/v0/optimizer/sample.ts";
import { CALIB, secToFrame, type Gap, type Spec } from "../scripts/v0/types.ts";

/**
 * `redrawFirstHopOnEmpty` (handoff.ts): the rollout's own rescue, promoted with
 * no tests. The four call sites all guard it behind an empty pool, so what has
 * to hold is what the function does once it is reached — the width it re-draws
 * at, what it leaves behind in the node memo, what it does to the shared
 * aim-suppression flag, and which of its two counters moves.
 */

const SEED = 19;
const BUDGET = 750_000;

let cached: { spec: Spec; gaps: Gap[]; ctx: SpecContext } | null = null;

async function panel(): Promise<{ spec: Spec; gaps: Gap[]; ctx: SpecContext }> {
  if (cached !== null) return cached;
  const spec = await loadGoldenSpec("dense_sprint", "base");
  validateSpec(spec);
  const durationFrames = secToFrame(spec.duration);
  const allContactFrames = spec.contacts
    .map((contact) => secToFrame(contact.t))
    .sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, durationFrames);
  const targetRng = makeRng(0);
  for (const gap of gaps) {
    gap.targets = sampleGapTargets(effectiveAxes(gap, spec), CALIB.SIGMA, targetRng);
  }
  cached = { spec, gaps, ctx: { allContactFrames, durationFrames, gaps } };
  return cached;
}

/** A root node on a freshly reset compile, so no memo or lane state carries over. */
function freshRoot(spec: Spec, gapCount: number) {
  resetPerCompileState();
  setAimCompileBudgetFrames(BUDGET);
  return makeRootNode(makeBaseEngine(resolveStartState(spec)), gapCount);
}

function fingerprint(pool: readonly Candidate[]): string {
  return `${pool.length}#` +
    pool.map((candidate) => `${candidate.cost.toFixed(6)}:${candidate.lines.length}`).join("|");
}

describe("rollout re-draw on empty", () => {
  test("re-draws the ordinary pool at width + 1, exactly once", async () => {
    const { spec, gaps, ctx } = await panel();
    const node = freshRoot(spec, gaps.length);
    // Width 0 is the cheapest way to reach the state the four call sites gate
    // on: `solveOneGap(K = 0)` samples nothing, so the pool is empty without
    // needing a node whose real first draw happens to fail.
    expect(getCandidatesSorted(node, gaps, ctx, SEED, 0)).toHaveLength(0);

    const before = readFwdEvalCounters();
    const widened = redrawFirstHopOnEmpty(node, gaps, ctx, SEED, 0);
    const after = readFwdEvalCounters();

    expect(after.fwd_rollout_redraws - before.fwd_rollout_redraws).toBe(1);
    expect(widened.length).toBeGreaterThan(0);
    // The extra draw is the sample the SEARCH would take next, not a second
    // mechanism: the same pool an untouched node builds at width + 1.
    const reference = getCandidatesSorted(freshRoot(spec, gaps.length), gaps, ctx, SEED, 1);
    expect(fingerprint(widened)).toBe(fingerprint(reference));
  }, 120_000);

  test("leaves the widened pool in the node memo so later reads see the correction", async () => {
    const { spec, gaps, ctx } = await panel();
    const node = freshRoot(spec, gaps.length);
    getCandidatesSorted(node, gaps, ctx, SEED, 0);
    const widened = redrawFirstHopOnEmpty(node, gaps, ctx, SEED, 0);

    // Not a cache-cleared copy: `cachedForwardContinuation` and the
    // online-continuation filter read this memo, and a discarded widened pool
    // would freeze the refuted dead-end verdict where it does the damage.
    expect(node._candidatesCache?.nCand).toBe(1);
    expect(node._candidatesCache?.candidates).toBe(widened);
    expect(getCandidatesSorted(node, gaps, ctx, SEED, 1)).toBe(widened);
  }, 120_000);

  test("restores the aim-suppression flag rather than clearing it", async () => {
    const { spec, gaps, ctx } = await panel();
    for (const suppressed of [true, false]) {
      const node = freshRoot(spec, gaps.length);
      getCandidatesSorted(node, gaps, ctx, SEED, 0);
      setRolloutAimSuppressed(suppressed);
      try {
        redrawFirstHopOnEmpty(node, gaps, ctx, SEED, 0);
        expect(isRolloutAimSuppressed()).toBe(suppressed);
      } finally {
        setRolloutAimSuppressed(false);
      }
    }
  }, 120_000);

  test("builds the widened pool with the aim lane suppressed", async () => {
    const { spec, gaps, ctx } = await panel();
    // The lane gate is `inRolloutContext && rolloutAimSuppressed`, so the
    // suppression only bites where the re-draw actually runs: inside a charged
    // rollout, at a width the lane qualifies for (nCand > 1).
    setRolloutContext(true);
    try {
      const widened = redrawFirstHopOnEmpty(freshRoot(spec, gaps.length), gaps, ctx, SEED, 3);
      setRolloutAimSuppressed(true);
      const suppressed = getCandidatesSorted(freshRoot(spec, gaps.length), gaps, ctx, SEED, 4);
      setRolloutAimSuppressed(false);
      const unsuppressed = getCandidatesSorted(freshRoot(spec, gaps.length), gaps, ctx, SEED, 4);

      expect(fingerprint(widened)).toBe(fingerprint(suppressed));
      // Non-vacuity: the lane is live at this node, so dropping the suppression
      // would change the pool.
      expect(fingerprint(unsuppressed)).not.toBe(fingerprint(suppressed));
    } finally {
      setRolloutAimSuppressed(false);
      setRolloutContext(false);
    }
  }, 120_000);

  test("counts a refutation only when the wider draw finds one", async () => {
    const { spec, gaps, ctx } = await panel();
    const skipIndex = gaps.findIndex((gap) => !gap.endsWithContact);
    expect(skipIndex).toBeGreaterThanOrEqual(0);
    // A gap that ends in no contact has no candidates at ANY width, which is
    // the still-empty outcome: the re-draw is counted, the refutation is not.
    const node = { ...freshRoot(spec, gaps.length), gapIndex: skipIndex, _candidatesCache: null };

    const before = readFwdEvalCounters();
    const widened = redrawFirstHopOnEmpty(node, gaps, ctx, SEED, 0);
    const after = readFwdEvalCounters();

    expect(widened).toHaveLength(0);
    expect(after.fwd_rollout_redraws - before.fwd_rollout_redraws).toBe(1);
    expect(after.fwd_rollout_redraw_refuted - before.fwd_rollout_redraw_refuted).toBe(0);
  }, 120_000);

  test("a real compile re-draws only on empties, and ships both counters", async () => {
    const { spec } = await panel();
    const { stats } = compileHandoff(spec, 0, { budget: 250_000 });
    const fwd = stats.fwd_eval;

    expect(fwd).not.toBeNull();
    expect(fwd!.fwd_rollout_redraws).toBeGreaterThan(0);
    expect(fwd!.fwd_rollout_redraw_refuted).toBeGreaterThan(0);
    expect(fwd!.fwd_rollout_redraw_refuted).toBeLessThanOrEqual(fwd!.fwd_rollout_redraws);
    // Every forward-eval call expands a first hop; only the empty ones re-draw.
    expect(fwd!.fwd_rollout_redraws).toBeLessThan(fwd!.fwd_eval_calls);
  }, 300_000);
});
