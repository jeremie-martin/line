/**
 * Stage 1 — public compileLDS entry point.
 *
 * Wires the LDS leaf enumeration through the best-so-far register
 * and returns the best CompileOutput seen. No budget cutoff yet
 * (that's Stage 2); this stage runs to a maxDiscrepancy cap.
 *
 * Determinism: given `(spec, seed, opts)`, every step is
 * deterministic — RNG seeded by (seed, gap_index) per-node, leaf
 * enumeration order fixed by maxDiscrepancy/N_CAND/gap count,
 * register only swaps on strict improvement. Same inputs →
 * byte-identical Track.
 */

import { detect, extractRawTrajectory } from "../../lib/detector.ts";
import {
  type GapFit,
  buildDriftReport,
  buildTrackJson,
  effectiveAxes,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
  withOptimizedPrerollStart,
  type ResolvedStart,
} from "../compile.ts";
import { makeRng } from "../../lib/rng.ts";
import { CALIB, secToFrame } from "../types.ts";
import { scoreDriftReport } from "../score.ts";
import { enumerateLeaves, type Leaf } from "./lds.ts";
import { makeRootNode } from "./node.ts";
import { BestSoFarRegister, type LeafKey } from "./register.ts";
import { getSimFrames, resetSimFrames } from "./sim_frames.ts";
import type { SpecContext } from "./sample.ts";
import type { CompileOutput, Spec } from "./types.ts";

export type CompileLDSOptions = {
  /** Maximum total discrepancy across the search. Default 3.
   *  Reasoning: greedy_v1's BACKTRACK_DEPTH=2 + FINAL_VALIDATION_RETRIES=3
   *  bounds the search depth it explores; LDS at maxD=3 covers a
   *  comparable region. Higher values exponentially grow the leaf
   *  count; tune via measurement. */
  maxDiscrepancy?: number;
  /** Optional callback fired once per leaf evaluated (used by
   *  property tests; null-cost in normal use). */
  onLeaf?: (leaf: Leaf, key: LeafKey) => void;
};

export function compileLDS(
  userSpec: Spec,
  seed = 0,
  opts: CompileLDSOptions = {},
): CompileOutput {
  const maxDiscrepancy = opts.maxDiscrepancy ?? 3;
  if (!Number.isInteger(maxDiscrepancy) || maxDiscrepancy < 0) {
    throw new Error(`compileLDS: maxDiscrepancy must be a non-negative integer, got ${maxDiscrepancy}`);
  }

  resetSimFrames();
  validateSpec(userSpec);
  const spec = withOptimizedPrerollStart(userSpec, seed);
  const startState: ResolvedStart = resolveStartState(spec);
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
  const initialEngine = makeBaseEngine(startState);
  const root = makeRootNode(initialEngine, gaps.length);
  const register = new BestSoFarRegister();

  for (const leaf of enumerateLeaves(root, maxDiscrepancy, gaps, ctx, seed)) {
    const key = scoreLeaf(leaf, spec, gaps, allContactFrames, durationFrames);
    const becameBest = register.consider(buildLeafOutput(leaf, spec, gaps, allContactFrames, durationFrames, startState), key);
    opts.onLeaf?.(leaf, key);
    // becameBest is intentionally unused here — the register's
    // own counters report on it.
    void becameBest;
  }

  const best = register.getBest();
  if (best === null) {
    throw new Error(
      `compileLDS: no leaf reached end-of-spec (spec_duration=${spec.duration}s, ` +
      `seed=${seed}, maxDiscrepancy=${maxDiscrepancy})`,
    );
  }
  return best;
}

/** Build the LeafKey used by the register for ranking. Pure function
 *  of the leaf + spec geometry. */
function scoreLeaf(
  leaf: Leaf,
  spec: Spec,
  // deno-lint-ignore no-explicit-any
  gaps: any[],
  allContactFrames: number[],
  durationFrames: number,
): LeafKey {
  const det = detect(extractRawTrajectory(leaf.engine, durationFrames + 20));
  const report = buildDriftReport(
    det, spec, gaps, allContactFrames, durationFrames, [], leaf.fits as (GapFit | null)[],
  );
  const score = scoreDriftReport(report);
  return {
    contract_passed: score.contract_passed,
    axis_quality: score.axis_quality,
    full_score: score.score,
  };
}

/** Build a CompileOutput from a leaf (its fits + engine), running
 *  the final detect+report once. */
function buildLeafOutput(
  leaf: Leaf,
  spec: Spec,
  // deno-lint-ignore no-explicit-any
  gaps: any[],
  allContactFrames: number[],
  durationFrames: number,
  startState: ResolvedStart,
): CompileOutput {
  const fits = leaf.fits as (GapFit | null)[];
  const allLines = [];
  for (const fit of fits) if (fit !== null) allLines.push(...fit.lines);
  const track = buildTrackJson(allLines, durationFrames + 20, startState);
  const finalDet = detect(extractRawTrajectory(leaf.engine, durationFrames + 20));
  const report = buildDriftReport(
    finalDet, spec, gaps, allContactFrames, durationFrames, [], fits,
  );
  return {
    track,
    report,
    stats: {
      candidates_sampled: 0,
      engine_rebuilds: 0,
      gap_commits: fits.filter((f) => f !== null).length,
      gap_backtracks: 0,
      validation_retries: 0,
      polish_iterations: 0,
      total_committed_cost: leaf.cumulativeCost,
      committed_costs_per_gap: fits.map((f) => (f === null ? null : f.cost)),
      sim_frames: getSimFrames(),
    },
  };
}
