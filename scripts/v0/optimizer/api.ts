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
import type { Budget, CompileOutput, Spec } from "./types.ts";

export type CompileLDSOptions = {
  /** Maximum total discrepancy across the search. Default 64
   *  (effectively unbounded for practical specs — `Budget` is the
   *  real cap). Lower this if you want a deterministic-depth search
   *  independent of compute budget; usually you just want the budget. */
  maxDiscrepancy?: number;
  /** Compute budget in sim-frames. Enumeration stops at the next op
   *  boundary after `getSimFrames() >= budget.units`. If unset, runs
   *  until `maxDiscrepancy` is fully enumerated. */
  budget?: Budget;
  /** Optional callback fired once per leaf evaluated (used by
   *  property tests; null-cost in normal use). */
  onLeaf?: (leaf: Leaf, key: LeafKey) => void;
};

export function compileLDS(
  userSpec: Spec,
  seed = 0,
  opts: CompileLDSOptions = {},
): CompileOutput {
  const maxDiscrepancy = opts.maxDiscrepancy ?? 64;
  if (!Number.isInteger(maxDiscrepancy) || maxDiscrepancy < 0) {
    throw new Error(`compileLDS: maxDiscrepancy must be a non-negative integer, got ${maxDiscrepancy}`);
  }
  const budgetUnits = opts.budget?.units ?? Infinity;
  if (opts.budget !== undefined) {
    if (opts.budget.kind !== "work") {
      throw new Error(`compileLDS: only Budget.kind === "work" is supported`);
    }
    if (!Number.isFinite(budgetUnits) || budgetUnits <= 0) {
      throw new Error(`compileLDS: budget.units must be positive, got ${budgetUnits}`);
    }
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

  let budgetExhausted = false;
  for (const leaf of enumerateLeaves(root, maxDiscrepancy, gaps, ctx, seed)) {
    const key = scoreLeaf(leaf, spec, gaps, allContactFrames, durationFrames);
    const becameBest = register.consider(
      buildLeafOutput(leaf, spec, gaps, allContactFrames, durationFrames, startState, budgetExhausted),
      key,
    );
    opts.onLeaf?.(leaf, key);
    void becameBest;
    // Op boundary: check budget AFTER scoring/considering this leaf.
    // The one-leaf overshoot is bounded by the cost of one scoreLeaf
    // call (≈ durationFrames + 20 sim_frames), which is acceptable
    // and preserves the prefix-superset invariant — the same leaf
    // would have been considered at any budget that allowed reaching
    // it. Stopping AFTER consider means we always benefit from work
    // already paid for.
    if (getSimFrames() >= budgetUnits) {
      budgetExhausted = true;
      break;
    }
  }

  const best = register.getBest();
  if (best === null) {
    throw new Error(
      `compileLDS: no leaf reached end-of-spec ` +
      `(spec_duration=${spec.duration}s, seed=${seed}, ` +
      `maxDiscrepancy=${maxDiscrepancy}, ` +
      `budget=${opts.budget ? opts.budget.units : "unset"}, ` +
      `sim_frames_used=${getSimFrames()}, ` +
      `budget_exhausted=${budgetExhausted})`,
    );
  }
  // Update budget_exhausted on the returned output (the leaf was
  // built before we knew the final state of the budget flag).
  return {
    ...best,
    stats: { ...best.stats, budget_exhausted: budgetExhausted, sim_frames: getSimFrames() },
  };
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
  budgetExhausted: boolean,
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
      budget_exhausted: budgetExhausted,
    },
  };
}
