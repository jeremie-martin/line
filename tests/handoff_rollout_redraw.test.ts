import { describe, expect, test } from "vitest";
import { makeRng } from "../scripts/lib/rng.ts";
import { beginEnvFlagEpoch } from "../scripts/v0/env_flags.ts";
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
  setRolloutRedrawPressure,
} from "../scripts/v0/optimizer/handoff.ts";
import { deadlinePressure } from "../scripts/v0/optimizer/deadline.ts";
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

  /**
   * THE REDRAW-DOSE LAW (handoff.ts `REDRAW_DOSE_PRESSURE_SPAN`):
   *   dose = max(1, round(1 + 5 * deadlinePressure(margin)))
   * bounded by `REDRAW_MAX_TOTAL_WIDTH` so the widened request can never equal a
   * width a real expansion asks for. The width the re-draw requested is readable
   * off the memo it deliberately leaves behind, and at base width 0 the request
   * IS the dose.
   */
  describe("dose law", () => {
    /** The nCand the re-draw asked for, read off the memo it leaves behind. */
    function redrawWidth(
      spec: Spec,
      gaps: Gap[],
      ctx: SpecContext,
      pressure: number,
      width: number,
    ): number {
      const node = freshRoot(spec, gaps.length);
      getCandidatesSorted(node, gaps, ctx, SEED, width);
      setRolloutRedrawPressure(pressure);
      try {
        redrawFirstHopOnEmpty(node, gaps, ctx, SEED, width);
      } finally {
        setRolloutRedrawPressure(0);
      }
      return node._candidatesCache?.nCand ?? -1;
    }

    test("pressure 0 is the pre-law compiler: width + 1, at every width", async () => {
      const { spec, gaps, ctx } = await panel();
      for (const width of [0, 1, 2, 3]) {
        expect(redrawWidth(spec, gaps, ctx, 0, width)).toBe(width + 1);
      }
    }, 120_000);

    test("full pressure is the measured dose: 1 + SPAN = 6", async () => {
      const { spec, gaps, ctx } = await panel();
      // Full pressure is the ramp's own saturation, not a magic number: any
      // margin at or below the full-pressure anchor reads 1.
      expect(deadlinePressure(0.5)).toBe(1);
      expect(redrawWidth(spec, gaps, ctx, 1, 0)).toBe(6);
      expect(redrawWidth(spec, gaps, ctx, deadlinePressure(0.5), 1)).toBe(1 + 6);
    }, 120_000);

    test("monotone non-decreasing in pressure, base dose at 0, 1 + SPAN at 1", async () => {
      const { spec, gaps, ctx } = await panel();
      const doses = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
        .map((pressure) => redrawWidth(spec, gaps, ctx, pressure, 0));
      expect(doses[0]).toBe(1);
      expect(doses[doses.length - 1]).toBe(6);
      for (let i = 1; i < doses.length; i++) {
        expect(doses[i]).toBeGreaterThanOrEqual(doses[i - 1]);
      }
      // A magnitude, not a mode: the ramp actually visits the middle.
      expect(new Set(doses).size).toBeGreaterThan(2);
    }, 120_000);

    test("no width it can write collides with a real expansion's width", async () => {
      const { spec, gaps, ctx } = await panel();
      // Every production rollout base width (greedy 1, the impact arm's
      // firstBranch 3, opening-best's 2) crossed with the whole pressure range.
      // The memo is keyed on (seed, nCand): the re-draw builds with the aim lane
      // suppressed, so anything the SEARCH or the START SCAN asks for at the same
      // node must stay strictly above everything below.
      const realExpansionWidths = [8, 16, 27, 32, 80, 81]; // START_*_K / breadth law / rescue tiers
      const written = new Set<number>();
      for (const width of [1, 2, 3]) {
        for (const pressure of [0, 0.25, 0.5, 0.75, 1]) {
          written.add(redrawWidth(spec, gaps, ctx, pressure, width));
        }
      }
      for (const w of written) {
        expect(w).toBeLessThanOrEqual(7);
        expect(realExpansionWidths).not.toContain(w);
      }
    }, 120_000);

    test("the study knob PINS the dose and outranks the law", async () => {
      const { spec, gaps, ctx } = await panel();
      process.env.LR_STUDY_ROLLOUT_REDRAW = "1";
      beginEnvFlagEpoch(); // compile-scoped reader; the flag is sampled per epoch
      try {
        // Pinned at the base dose, the law's coordinate stops mattering.
        expect(redrawWidth(spec, gaps, ctx, 1, 0)).toBe(1);
        expect(redrawWidth(spec, gaps, ctx, 1, 3)).toBe(4);
      } finally {
        delete process.env.LR_STUDY_ROLLOUT_REDRAW;
        beginEnvFlagEpoch();
      }
    }, 120_000);

    test("a compile leaves the ambient pressure clean", async () => {
      const { spec, gaps, ctx } = await panel();
      compileHandoff(spec, 0, { budget: 150_000 });
      // `rankedOptions` publishes the build's pressure and restores it. Nothing
      // sets the ambient here on purpose: if any path inside the compile leaked
      // its pressure, this re-draw — outside every pool build — would over-dose.
      const node = freshRoot(spec, gaps.length);
      getCandidatesSorted(node, gaps, ctx, SEED, 0);
      redrawFirstHopOnEmpty(node, gaps, ctx, SEED, 0);
      expect(node._candidatesCache?.nCand).toBe(1);
    }, 300_000);
  });

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
