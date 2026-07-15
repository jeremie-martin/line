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
import {
  observeOneCandidate,
  sampleOneCandidate,
  type SpecContext,
} from "../scripts/v0/optimizer/sample.ts";
import { chooseRideOutPolishedFit } from "../scripts/v0/core/candidate.ts";
import { sampleArcPlacementGeometry } from "../scripts/v0/arc_placement.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import { AXIS_VALUE_MAX, FPS, secToFrame, type Gap, type TrackLine } from "../scripts/v0/types.ts";
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
  // Sample gap targets the same way the compiler does, so the gap is
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
  test("gap target sampling uses canonical per-axis bounds and ignores grain", () => {
    const sampled = sampleGapTargets(
      { air: 2, speed: 2, grain: 2 },
      0,
      () => 0.5,
    );
    expect(sampled).toEqual({
      air: AXIS_VALUE_MAX.air,
      speed: AXIS_VALUE_MAX.speed,
    });
  });

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
      expect(a.geometry).toBe(b.geometry);
      expect(a.lines).toEqual(b.lines);
      expect(a.achieved).toEqual(b.achieved);
    }
  });

  test("target-state geometry sampler has RNG diversity before engine gates", () => {
    const gap: Gap = {
      index: 0,
      startFrame: 0,
      endFrame: 24,
      endsWithContact: true,
      targets: { air: 0.45, speed: 0.55, grain: 0.5 },
    };
    const targetState = {
      sledX: 100,
      sledY: 50,
      velocity: { x: 8, y: 2 },
      speed: Math.hypot(8, 2),
      angleDeg: 14,
    };
    const outcomes = new Set<string>();
    for (let s = 1; s <= 10; s++) {
      const geometry = sampleArcPlacementGeometry(
        makeRng(s), 100, 50, gap.targets, targetState, 8, gap, 1, "normal", [24, 52],
      );
      outcomes.add(JSON.stringify(geometry));
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
      expect(withSample.geometry).toBe(cleanSample.geometry);
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

  test("observation API preserves the atomic sampler result while exposing raw geometry", async () => {
    const { engine, gap, ctx } = await setupAt("tiny_dance", 0);
    const observed = observeOneCandidate(engine, gap, makeRng(91), ctx, 1, 3);
    const ordinary = sampleOneCandidate(engine, gap, makeRng(91), ctx, 1, 3);
    expect(observed.geometry.kind).toBe("lines");
    expect(observed.geometry.lines.length).toBeGreaterThan(0);
    expect(observed.geometry.postContactStartLine).toBeTypeOf("number");
    expect(observed.geometry.postContactStartLine).toBeGreaterThan(0);
    expect(observed.geometry.postContactStartLine).toBeLessThan(observed.geometry.lines.length);
    expect(observed.fit === null).toBe(ordinary === null);
    if (observed.fit !== null && ordinary !== null) {
      expect(observed.fit.cost).toBe(ordinary.cost);
      expect(observed.fit.lines).toEqual(ordinary.lines);
      expect(observed.fit.achieved).toEqual(ordinary.achieved);
      expect(observed.fit.postContactStartLine).toBe(observed.geometry.postContactStartLine);
    }
  });

  test("ride-out polish defaults to enabled and disabled study rows retain base geometry", () => {
    const lines: TrackLine[] = [{
      id: 1,
      type: 0,
      x1: 0,
      y1: 0,
      x2: 20,
      y2: 0,
      flipped: false,
      leftExtended: false,
      rightExtended: false,
    }];
    const gap: Gap = {
      index: 0,
      startFrame: 0,
      endFrame: 80,
      endsWithContact: true,
      targets: { air: 0.7 },
    };
    const base = { arc: null, geometry: "lines" as const, lines, achieved: { air: 0.6 }, cost: 1 };
    let disabledCalls = 0;
    const disabled = chooseRideOutPolishedFit(
      base, gap, 160, lines, 2,
      () => {
        disabledCalls++;
        return { ...base, cost: 0.5 };
      },
      false,
    );
    expect(disabled).toBe(base);
    expect(disabledCalls).toBe(0);

    let enabledCalls = 0;
    const enabled = chooseRideOutPolishedFit(
      base, gap, 160, lines, 2,
      (extendedLines) => {
        enabledCalls++;
        return { ...base, lines: extendedLines, cost: 0.5 };
      },
    );
    expect(enabledCalls).toBeGreaterThan(0);
    expect(enabled.cost).toBe(0.5);
    expect(enabled.lines).toHaveLength(2);
  });
});
