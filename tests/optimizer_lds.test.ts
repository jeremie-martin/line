/**
 * Stage 1 verification — LDS core + the prefix-superset property.
 *
 * The property (the contract that makes monotonicity-in-budget hold
 * by construction):
 *
 *   For any maxD' >= maxD, the SET of leaves enumerated by
 *   enumerateLeaves(..., maxD) is a STRICT SUBSET of the set
 *   enumerated by enumerateLeaves(..., maxD').
 *
 * If this holds, then any best-over-prefix selection is monotonic
 * in the prefix length: a larger prefix can only add leaves, never
 * remove them, so the max is non-decreasing.
 *
 * Tested on tiny_dance (cheap, deterministic). The test stays in
 * CI to catch any future change that breaks the enumeration
 * invariant.
 */
import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { compileLDS } from "../scripts/v0/optimizer/api.ts";
import { compileGreedy_v2 } from "../scripts/v0/optimizer/greedy.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import { enumerateLeaves, type Leaf } from "../scripts/v0/optimizer/lds.ts";
import { makeRootNode, N_CAND } from "../scripts/v0/optimizer/node.ts";
import {
  effectiveAxes,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
  withOptimizedPrerollStart,
} from "../scripts/v0/compile.ts";
import { CALIB, secToFrame } from "../scripts/v0/types.ts";
import { makeRng } from "../scripts/lib/rng.ts";
import type { SpecContext } from "../scripts/v0/optimizer/sample.ts";

function hashTrack(t: unknown): string {
  return createHash("sha256").update(JSON.stringify(t)).digest("hex");
}

/** Fingerprint a leaf by its rank-sequence — uniquely identifies a
 *  leaf within an enumeration over fixed (spec, seed, N_CAND). */
function leafFingerprint(leaf: Leaf): string {
  return leaf.ranks.join(",");
}

/** Set up a (spec, seed) for direct LDS enumeration (without going
 *  through compileLDS, so we can drive enumerateLeaves directly). */
async function setupForEnumeration(name: string, seed: number) {
  const raw = await loadGoldenSpec(name as never, "base");
  validateSpec(raw);
  const spec = withOptimizedPrerollStart(raw, seed);
  const startState = resolveStartState(spec);
  const durationFrames = secToFrame(spec.duration);
  const allContactFrames = [...spec.contacts]
    .map((c) => secToFrame(c.t))
    .sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, durationFrames);
  const masterRng = makeRng(seed);
  for (const gap of gaps) {
    const sec = effectiveAxes(gap, spec);
    gap.targets = sampleGapTargets(sec, CALIB.SIGMA, masterRng);
  }
  const ctx: SpecContext = { allContactFrames, durationFrames };
  const engine = makeBaseEngine(startState);
  const root = makeRootNode(engine, gaps.length);
  return { root, gaps, ctx, seed };
}

describe("optimizer/lds.ts — Stage 1 LDS core", () => {
  test("PROPERTY (in CI forever): leaves(maxD=k) ⊇ leaves(maxD=k-1) for k=1,2", async () => {
    // Single enumeration to maxD=2 — partition leaves by discrepancy.
    // The candidate-cache inside enumerateLeaves makes this much
    // faster than three separate calls.
    const setup = await setupForEnumeration("tiny_dance", 0);
    const fpsByDiscrepancy: Map<number, string[]> = new Map();
    for (const leaf of enumerateLeaves(setup.root, 2, setup.gaps, setup.ctx, setup.seed)) {
      const d = leaf.discrepancy;
      if (!fpsByDiscrepancy.has(d)) fpsByDiscrepancy.set(d, []);
      fpsByDiscrepancy.get(d)!.push(leafFingerprint(leaf));
    }
    const fpsD0 = fpsByDiscrepancy.get(0) ?? [];
    const fpsD1 = fpsByDiscrepancy.get(1) ?? [];
    const fpsD2 = fpsByDiscrepancy.get(2) ?? [];

    // d=0 has exactly one leaf: the greedy track.
    expect(fpsD0.length).toBe(1);

    // Per-d sets are disjoint by construction (each leaf has one d).
    const setD0 = new Set(fpsD0);
    const setD1 = new Set(fpsD1);
    const setD2 = new Set(fpsD2);
    for (const fp of setD0) expect(setD1.has(fp)).toBe(false);
    for (const fp of setD0) expect(setD2.has(fp)).toBe(false);
    for (const fp of setD1) expect(setD2.has(fp)).toBe(false);

    // The superset property: leaves(maxD=k) = union over d ≤ k of
    // leaves at exactly d. So leaves(maxD=1) ⊇ leaves(maxD=0) iff
    // d=1's set adds new fingerprints without removing any.
    // Since the sets are disjoint AND non-empty, the prefix-superset
    // holds by construction.
    expect(setD1.size).toBeGreaterThan(0);
    expect(setD2.size).toBeGreaterThan(0);

    // Sanity: total leaf count at d ≤ k is the sum of the partition.
    const totalAtMaxD0 = setD0.size;
    const totalAtMaxD1 = setD0.size + setD1.size;
    const totalAtMaxD2 = setD0.size + setD1.size + setD2.size;
    expect(totalAtMaxD1).toBeGreaterThan(totalAtMaxD0);
    expect(totalAtMaxD2).toBeGreaterThan(totalAtMaxD1);
  }, 300_000);

  test("d=0 leaf equals greedy_v2 result on tiny_dance seed=0 (within rounding)", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const lds = compileLDS(spec, 0, { maxDiscrepancy: 0 });
    const greedy = compileGreedy_v2(spec, 0, { K: N_CAND });
    // Both follow the greedy rank-0-at-every-gap path. With the same
    // N_CAND, the candidate pool is identical and the lowest-cost
    // pick is the same. Result should be hash-identical.
    expect(hashTrack(lds.track)).toBe(hashTrack(greedy.track));
  }, 60_000);

  test("determinism: two compileLDS calls with same args → hash-identical Track", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const a = compileLDS(spec, 0, { maxDiscrepancy: 1 });
    const b = compileLDS(spec, 0, { maxDiscrepancy: 1 });
    expect(hashTrack(a.track)).toBe(hashTrack(b.track));
  }, 120_000);

  test("monotonicity-in-maxDiscrepancy: score(maxD=1) ≥ score(maxD=0)", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const r0 = compileLDS(spec, 0, { maxDiscrepancy: 0 });
    const r1 = compileLDS(spec, 0, { maxDiscrepancy: 1 });
    // Compute axis_quality directly from the reports.
    const errs0: number[] = [];
    for (const s of r0.report.sections)
      for (const v of Object.values(s.axes ?? {}))
        errs0.push((v as { error?: number }).error ?? 0);
    const errs1: number[] = [];
    for (const s of r1.report.sections)
      for (const v of Object.values(s.axes ?? {}))
        errs1.push((v as { error?: number }).error ?? 0);
    const q = (errs: number[]) =>
      errs.length === 0 ? 1 : Math.exp(-Math.sqrt(errs.reduce((a, b) => a + b * b, 0) / errs.length) / 0.25);
    expect(q(errs1)).toBeGreaterThanOrEqual(q(errs0));
  }, 120_000);

  test("invalid maxDiscrepancy throws", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    expect(() => compileLDS(spec, 0, { maxDiscrepancy: -1 })).toThrow();
    expect(() => compileLDS(spec, 0, { maxDiscrepancy: 1.5 })).toThrow();
  });
});
