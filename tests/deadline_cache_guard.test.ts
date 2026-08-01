/**
 * The debug assertion that keeps H2 honest.
 *
 * The candidate pool memo is keyed on `(seed, nCand)` and NOT on the aim lane's
 * deadline throttle, so a pool built under one throttle state and returned
 * frozen under the other makes that node's content depend on when it was first
 * visited. `LR_DEADLINE_CACHE_ASSERT=1` counts exactly that, and this file pins
 * the counter itself: silent when no cache lifetime straddles a transition, and
 * loud when one does. The env flag is sampled once at module load, hence the
 * dynamic imports.
 */
import { describe, expect, test } from "vitest";

describe("aim-lane throttle cache guard", () => {
  test("counts a frozen read that crosses a throttle transition, and only that", async () => {
    process.env.LR_DEADLINE_CACHE_ASSERT = "1";
    const { makeRng } = await import("../scripts/lib/rng.ts");
    const { setCompileBudgetFrames } = await import("../scripts/v0/arc_placement.ts");
    const { resetPerCompileState } = await import("../scripts/v0/core/compile_lifecycle.ts");
    const substrate = await import("../scripts/v0/core/substrate.ts");
    const { loadGoldenSpec } = await import("../scripts/v0/golden_suite.ts");
    const { setAimCompileBudgetFrames } = await import("../scripts/v0/optimizer/aim.ts");
    const node = await import("../scripts/v0/optimizer/node.ts");
    const { CALIB, secToFrame } = await import("../scripts/v0/types.ts");
    type SpecContext = import("../scripts/v0/optimizer/sample.ts").SpecContext;

    const spec = await loadGoldenSpec("dense_sprint", "base");
    substrate.validateSpec(spec);
    const durationFrames = secToFrame(spec.duration);
    const allContactFrames = spec.contacts
      .map((contact) => secToFrame(contact.t))
      .sort((a, b) => a - b);
    const gaps = substrate.sliceTimeline(allContactFrames, durationFrames);
    const targetRng = makeRng(0);
    for (const gap of gaps) {
      gap.targets = substrate.sampleGapTargets(
        substrate.effectiveAxes(gap, spec),
        CALIB.SIGMA,
        targetRng,
      );
    }
    const ctx: SpecContext = { allContactFrames, durationFrames, gaps };
    const freshNode = () => {
      resetPerCompileState();
      setCompileBudgetFrames(750_000);
      setAimCompileBudgetFrames(750_000);
      return node.makeRootNode(
        substrate.makeBaseEngine(substrate.resolveStartState(spec)),
        gaps.length,
      );
    };

    // Same state on both accesses: a frozen read, no transition.
    node.resetDeadlineCacheAssertStats();
    const quiet = freshNode();
    node.getCandidatesSorted(quiet, gaps, ctx, 19, 8);
    node.getCandidatesSorted(quiet, gaps, ctx, 19, 8);
    expect(node.deadlineCacheAssertStats()).toEqual({ frozenReads: 1, crossStateReads: 0 });

    // Built unthrottled, read throttled at the same nCand: the hazard itself.
    node.resetDeadlineCacheAssertStats();
    const straddled = freshNode();
    node.getCandidatesSorted(straddled, gaps, ctx, 19, 8);
    node.setAimLaneDeadlineThrottled(true);
    try {
      node.getCandidatesSorted(straddled, gaps, ctx, 19, 8);
    } finally {
      node.setAimLaneDeadlineThrottled(false);
    }
    expect(node.deadlineCacheAssertStats()).toEqual({ frozenReads: 1, crossStateReads: 1 });
    delete process.env.LR_DEADLINE_CACHE_ASSERT;
  }, 60_000);
});
