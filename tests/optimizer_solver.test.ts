/**
 * Step 2 verification — solveOneGap's prefix property.
 *
 * For any K' >= K, `solveOneGap(K')` starts with the exact same
 * candidates (in the same order) as `solveOneGap(K)`. This is the
 * single-gap analogue of "more compute → ≥ result quality" and the
 * substrate Property 1 (monotonicity-in-budget) rests on.
 *
 * We exercise on multiple (spec, gap_index) sample sites drawn from
 * the golden suite to catch any subtle K-dependent behavior.
 */
import { describe, test, expect } from "vitest";
import { solveOneGap, pickLowestCost } from "../scripts/v0/optimizer/solver.ts";
import { getCandidatesSorted, makeRootNode } from "../scripts/v0/optimizer/node.ts";
import type { SpecContext } from "../scripts/v0/optimizer/sample.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import { CALIB, secToFrame } from "../scripts/v0/types.ts";
import { makeRng } from "../scripts/lib/rng.ts";
import {
  effectiveAxes,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
} from "../scripts/v0/core/substrate.ts";

async function setupAtGap0(name: string, seed: number) {
  const spec = await loadGoldenSpec(name as never, "base");
  validateSpec(spec);
  const startState = resolveStartState(spec);
  const engine = makeBaseEngine(startState);
  const durationFrames = secToFrame(spec.duration);
  const allContactFrames = [...spec.contacts]
    .map((c) => secToFrame(c.t))
    .sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, durationFrames);
  const rngTargets = makeRng(seed);
  for (const gap of gaps) {
    const sec = effectiveAxes(gap, spec);
    gap.targets = sampleGapTargets(sec, CALIB.SIGMA, rngTargets);
  }
  const ctx: SpecContext = { allContactFrames, durationFrames };
  return { engine, gap: gaps[0], ctx };
}

function candKey(c: { cost: number; arc: unknown }): string {
  return JSON.stringify({ cost: c.cost, arc: c.arc });
}

describe("optimizer/solver.ts — Step 2 K-candidate solver", () => {
  // 8 sample sites: 4 specs × 2 seeds each, all at gap 0.
  const sites: Array<[string, number]> = [
    ["tiny_dance", 0], ["tiny_dance", 1],
    ["mini_burst", 0], ["mini_burst", 1],
    ["cold_start", 0], ["cold_start", 2],
    ["syncopated_switchback", 0], ["syncopated_switchback", 3],
  ];

  for (const [name, seed] of sites) {
    test(`prefix property at ${name} seed=${seed}: K=4 ⊆ K=16 ⊆ K=64`, async () => {
      const { engine, gap, ctx } = await setupAtGap0(name, seed);
      // Each solve uses a freshly-seeded RNG (otherwise the second
      // call would see depleted state). Same seed → identical RNG
      // sequence → identical first-K results across calls.
      const RNG_SEED = 4242;
      const c4 = solveOneGap(engine, gap, makeRng(RNG_SEED), 4, ctx, 1);
      const c16 = solveOneGap(engine, gap, makeRng(RNG_SEED), 16, ctx, 1);
      const c64 = solveOneGap(engine, gap, makeRng(RNG_SEED), 64, ctx, 1);

      // c16 starts with c4's candidates in the same order
      expect(c16.length).toBeGreaterThanOrEqual(c4.length);
      for (let i = 0; i < c4.length; i++) {
        expect(candKey(c16[i])).toBe(candKey(c4[i]));
      }
      // c64 starts with c16's candidates
      expect(c64.length).toBeGreaterThanOrEqual(c16.length);
      for (let i = 0; i < c16.length; i++) {
        expect(candKey(c64[i])).toBe(candKey(c16[i]));
      }
    });
  }

  test("two calls with the same K and seed produce identical results", async () => {
    const { engine, gap, ctx } = await setupAtGap0("tiny_dance", 0);
    const a = solveOneGap(engine, gap, makeRng(7), 8, ctx, 1);
    const b = solveOneGap(engine, gap, makeRng(7), 8, ctx, 1);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(candKey(a[i])).toBe(candKey(b[i]));
    }
  });

  test("K=0 returns empty list (no throw)", async () => {
    const { engine, gap, ctx } = await setupAtGap0("tiny_dance", 0);
    expect(solveOneGap(engine, gap, makeRng(1), 0, ctx, 1)).toEqual([]);
  });

  test("negative K throws", async () => {
    const { engine, gap, ctx } = await setupAtGap0("tiny_dance", 0);
    expect(() => solveOneGap(engine, gap, makeRng(1), -1, ctx, 1)).toThrow();
  });

  test("pickLowestCost returns null on empty, lowest-cost otherwise", () => {
    expect(pickLowestCost([])).toBeNull();
    const items = [
      { cost: 0.5, arc: null, lines: [], achieved: {} } as never,
      { cost: 0.2, arc: null, lines: [], achieved: {} } as never,
      { cost: 0.8, arc: null, lines: [], achieved: {} } as never,
    ];
    expect(pickLowestCost(items)!.cost).toBe(0.2);
  });

  test("lowest-cost monotonicity: lowest_cost(K=K') ≤ lowest_cost(K=K) for K' ≥ K", async () => {
    // The DOWNSTREAM consequence of the prefix property: as K grows,
    // the lowest-cost candidate can only improve (lower cost) or stay
    // the same. This is the actual property the chainer cares about.
    const { engine, gap, ctx } = await setupAtGap0("tiny_dance", 0);
    const lows: number[] = [];
    for (const K of [1, 4, 16, 64]) {
      const cs = solveOneGap(engine, gap, makeRng(123), K, ctx, 1);
      const best = pickLowestCost(cs);
      lows.push(best === null ? Infinity : best.cost);
    }
    for (let i = 0; i < lows.length - 1; i++) {
      expect(lows[i + 1]).toBeLessThanOrEqual(lows[i] + 1e-9);
    }
  });

  test("node candidate cache extends deterministic prefixes without changing sorted candidates", async () => {
    const { engine, gap, ctx } = await setupAtGap0("syncopated_switchback", 0);
    const seed = 17;
    const cachedNode = makeRootNode(engine, 1);
    getCandidatesSorted(cachedNode, [gap], ctx, seed, 4);
    const extended = getCandidatesSorted(cachedNode, [gap], ctx, seed, 16);

    const freshNode = makeRootNode(engine, 1);
    const fresh = getCandidatesSorted(freshNode, [gap], ctx, seed, 16);

    expect(extended.length).toBe(fresh.length);
    for (let i = 0; i < fresh.length; i++) {
      expect(candKey(extended[i])).toBe(candKey(fresh[i]));
    }
  });

  test("node candidate cache can answer smaller deterministic prefixes from a larger cache", async () => {
    const { engine, gap, ctx } = await setupAtGap0("syncopated_switchback", 0);
    const seed = 19;
    const cachedNode = makeRootNode(engine, 1);
    getCandidatesSorted(cachedNode, [gap], ctx, seed, 16);
    const prefix = getCandidatesSorted(cachedNode, [gap], ctx, seed, 4);

    const freshNode = makeRootNode(engine, 1);
    const fresh = getCandidatesSorted(freshNode, [gap], ctx, seed, 4);

    expect(prefix.length).toBe(fresh.length);
    for (let i = 0; i < fresh.length; i++) {
      expect(candKey(prefix[i])).toBe(candKey(fresh[i]));
    }
  });

  test("node prefix cache reapplies lane extras when answering smaller pools", () => {
    const oldAimLaunch = process.env.LR_AIM_LAUNCH;
    process.env.LR_AIM_LAUNCH = "0";
    try {
      const seed = 23;
      const sampled = { cost: 2, arc: "sampled", lines: [], achieved: {}, sampleAttempt: 0 } as never;
      const outsidePrefix = {
        cost: 0.5,
        arc: "outside-prefix",
        lines: [],
        achieved: {},
        sampleAttempt: 8,
      } as never;
      const scoop = { cost: 1, arc: "scoop", lines: [], achieved: {}, scooped: true } as never;
      const node = makeRootNode({}, 1);
      node._candidatesCache = {
        seed,
        nCand: 16,
        sampleOrder: [sampled, outsidePrefix],
        candidates: [outsidePrefix, sampled],
      };
      node._scoopCache = scoop;

      const prefix = getCandidatesSorted(
        node,
        [{ endsWithContact: true } as never],
        { allContactFrames: [], durationFrames: 0 },
        seed,
        4,
      );

      expect(prefix).toEqual([scoop, sampled]);
    } finally {
      if (oldAimLaunch === undefined) {
        delete process.env.LR_AIM_LAUNCH;
      } else {
        process.env.LR_AIM_LAUNCH = oldAimLaunch;
      }
    }
  });

  test("node candidate cache is isolated by search seed", async () => {
    const { engine, gap, ctx } = await setupAtGap0("syncopated_switchback", 0);
    const cachedNode = makeRootNode(engine, 1);
    getCandidatesSorted(cachedNode, [gap], ctx, 17, 16);
    const fromSeed18 = getCandidatesSorted(cachedNode, [gap], ctx, 18, 16);

    const freshNode = makeRootNode(engine, 1);
    const freshSeed18 = getCandidatesSorted(freshNode, [gap], ctx, 18, 16);

    expect(fromSeed18.length).toBe(freshSeed18.length);
    for (let i = 0; i < freshSeed18.length; i++) {
      expect(candKey(fromSeed18[i])).toBe(candKey(freshSeed18[i]));
    }
  });

  test("node candidate cache validates candidate counts before cache hits", async () => {
    const { engine, gap, ctx } = await setupAtGap0("syncopated_switchback", 0);
    const node = makeRootNode(engine, 1);
    getCandidatesSorted(node, [gap], ctx, 17, 16);

    expect(() => getCandidatesSorted(node, [gap], ctx, 17, -1)).toThrow(/nCand/);
    expect(() => getCandidatesSorted(node, [gap], ctx, 17, 3.5)).toThrow(/nCand/);
  });
});
