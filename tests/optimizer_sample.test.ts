/**
 * Step 1 verification — sampleOneCandidate is a pure function.
 *
 * Contract: same `(engine, gap, rng-state, ctx, lineIdStart)` →
 * identical Candidate (or both null). The wrapper holds no module
 * state and does not silently reseed.
 *
 * We exercise this against real golden-spec gap state, not synthetic
 * data, so we catch any subtle dependence on engine internals.
 */
import { describe, test, expect } from "vitest";
import { sampleOneCandidate, type SpecContext } from "../scripts/v0/optimizer/sample.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import { FPS, secToFrame } from "../scripts/v0/types.ts";
import { makeRng } from "../scripts/lib/rng.ts";
import {
  effectiveAxes,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
} from "../scripts/v0/core/substrate.ts";
import { CALIB } from "../scripts/v0/types.ts";

/** Build an `(engine_at_gap_0_start, gap_0, ctx)` triple from a
 *  golden spec for the determinism test. We deliberately use gap 0
 *  so the engine state is the initial state (no prior commits). */
async function setupAt(name: string, seed: number) {
  const spec = await loadGoldenSpec(name as never, "base");
  validateSpec(spec);
  const startState = resolveStartState(spec);
  const engine = makeBaseEngine(startState);
  const durationFrames = secToFrame(spec.duration);
  const allContactFrames = [...spec.contacts]
    .map((c) => secToFrame(c.t))
    .sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, durationFrames);
  // Sample gap targets the same way compile.ts does, so the gap is
  // ready to be solved.
  const rngTargets = makeRng(seed);
  for (const gap of gaps) {
    const sec = effectiveAxes(gap, spec);
    gap.targets = sampleGapTargets(sec, CALIB.SIGMA, rngTargets);
  }
  const ctx: SpecContext = { allContactFrames, durationFrames };
  return { engine, gap: gaps[0], ctx };
}

describe("optimizer/sample.ts — Step 1 atomic sample", () => {
  test("two calls with the same RNG seed produce identical candidates", async () => {
    const { engine, gap, ctx } = await setupAt("tiny_dance", 0);
    const rngA = makeRng(42);
    const rngB = makeRng(42);
    const a = sampleOneCandidate(engine, gap, rngA, ctx, 1);
    const b = sampleOneCandidate(engine, gap, rngB, ctx, 1);
    // Either both null (same gate failure) or both same Candidate.
    expect(a === null).toBe(b === null);
    if (a !== null && b !== null) {
      expect(a.cost).toBe(b.cost);
      expect(a.arc).toEqual(b.arc);
      expect(a.lines).toEqual(b.lines);
      expect(a.achieved).toEqual(b.achieved);
    }
  });

  test("different RNG seeds produce different candidates (on a viable gap)", async () => {
    const { engine, gap, ctx } = await setupAt("tiny_dance", 0);
    // Try a handful of seeds and assert we get at least two distinct
    // outcomes — sanity check that sampling isn't constant.
    const outcomes = new Set<string>();
    for (let s = 1; s <= 10; s++) {
      const fit = sampleOneCandidate(engine, gap, makeRng(s), ctx, 1);
      outcomes.add(fit === null ? "null" : JSON.stringify(fit.arc));
    }
    expect(outcomes.size).toBeGreaterThan(1);
  });

  test("does not depend on the order of preceding RNG draws on a separate RNG", async () => {
    const { engine, gap, ctx } = await setupAt("tiny_dance", 0);
    // Build a fresh RNG, draw some samples from a SECOND independent
    // RNG, then sample. Verify it matches a freshly-seeded RNG sample.
    const rngWith = makeRng(42);
    const noise = makeRng(99);
    for (let i = 0; i < 17; i++) noise(); // burn samples on separate RNG
    const withSample = sampleOneCandidate(engine, gap, rngWith, ctx, 1);

    const rngClean = makeRng(42);
    const cleanSample = sampleOneCandidate(engine, gap, rngClean, ctx, 1);

    expect(withSample === null).toBe(cleanSample === null);
    if (withSample !== null && cleanSample !== null) {
      expect(withSample.cost).toBe(cleanSample.cost);
    }
  });

  test("lineIdStart changes the line IDs in the output but not the cost", async () => {
    const { engine, gap, ctx } = await setupAt("tiny_dance", 0);
    const a = sampleOneCandidate(engine, gap, makeRng(7), ctx, 1);
    const b = sampleOneCandidate(engine, gap, makeRng(7), ctx, 100);
    expect(a === null).toBe(b === null);
    if (a !== null && b !== null) {
      // Same RNG seed → same arc + same cost.
      expect(a.cost).toBe(b.cost);
      expect(a.arc).toEqual(b.arc);
      // Different lineIdStart → different line IDs.
      expect(a.lines[0].id).not.toBe(b.lines[0].id);
    }
  });
});
