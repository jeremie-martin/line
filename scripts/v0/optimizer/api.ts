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
  compile as legacyCompile,
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
import { polishLeafVariant } from "./polish.ts";
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
  /** Optional callback fired once per ENUMERATED leaf evaluated (not
   *  fired for derived polish variants). Used by property tests;
   *  null-cost in normal use. */
  onLeaf?: (leaf: Leaf, key: LeafKey) => void;
  /** Stage B: after each enumerated leaf, also evaluate a polished
   *  clone-and-test variant (see `polish.ts`) and offer it to the
   *  register. Default true. Set false to measure the raw search path
   *  (e.g. the d=0-equals-greedy equivalence test). Polish can only
   *  add leaves to `E`, never reorder it, so monotonicity and
   *  determinism are preserved. */
  polish?: boolean;
  /** Floor leaf (the mandatory prelude, always evaluated first). "legacy"
   *  runs the proven backtracking greedy descent (`compile()` — what
   *  greedy_v1 measures) and seeds the register with it; this realizes the
   *  LDS thesis "discrepancy-0 = the greedy track, coverage ≥ greedy by
   *  construction" using a PROPER greedy (master's naive rank-0 descent
   *  lacks backtracking and dead-ends on dense specs like drums). "none"
   *  uses only the rank-0 LDS leaf as the floor (raw search path; used by
   *  the d=0-equals-greedy_v2 equivalence test). Default "legacy". */
  floor?: "legacy" | "none";
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

  const polishEnabled = opts.polish ?? true;
  const floorMode = opts.floor ?? "legacy";
  let budgetExhausted = false;

  /** Score a leaf (or polish variant) and offer it to the register.
   *  Returns the comparator key. */
  const consider = (leafLike: Leaf): LeafKey => {
    const key = scoreLeaf(leafLike, spec, gaps, allContactFrames, durationFrames);
    register.consider(
      buildLeafOutput(leafLike, spec, gaps, allContactFrames, durationFrames, startState, budgetExhausted),
      key,
    );
    return key;
  };

  // Mandatory prelude — the floor leaf. "legacy" runs the proven
  // backtracking greedy descent (`compile()`, what greedy_v1 measures) and
  // seeds the register with it. This realizes the LDS thesis "discrepancy-0
  // = the greedy track, coverage ≥ greedy by construction" using a PROPER
  // greedy: master's rank-0 enumerateLeaves descent has no backtracking and
  // dead-ends on dense specs (e.g. drums_signature gap 36). The floor's
  // physics cost is metered (compile() does not reset the detector counter)
  // and it is always evaluated before any budget check, like the d=0 leaf.
  if (floorMode === "legacy") {
    const floor = legacyCompile(userSpec, seed);
    const s = scoreDriftReport(floor.report);
    register.consider(floor, {
      contract_passed: s.contract_passed,
      axis_quality: s.axis_quality,
      full_score: s.score,
    });
  }

  for (const leaf of enumerateLeaves(root, maxDiscrepancy, gaps, ctx, seed, budgetUnits)) {
    const key = consider(leaf);
    opts.onLeaf?.(leaf, key);

    // Stage B — polish as clone-and-test: derive a polished variant of this
    // leaf and offer it too. The variant is a NEW leaf (original untouched),
    // so best-so-far can only improve; `E` is extended in a fixed,
    // deterministic order, never reordered. Interleaving per-leaf (rather
    // than a final pass) means even a low budget polishes the d=0 greedy
    // leaf first, so low-budget output is "greedy + polish" ≈ greedy_v1.
    if (polishEnabled) {
      const variant = polishLeafVariant(leaf.fits, spec, gaps, allContactFrames, durationFrames);
      if (variant !== null) {
        consider({ ...leaf, fits: variant.fits, engine: variant.engine });
      }
    }

    // Op boundary: check budget AFTER scoring/considering this leaf (and its
    // polish variant). Stopping AFTER consider means we always benefit from
    // work already paid for, and preserves the prefix-superset invariant —
    // the same leaves would have been considered at any larger budget.
    if (getSimFrames() >= budgetUnits) {
      budgetExhausted = true;
      break;
    }
  }
  // Also catch the case where the finer-grained cutoff inside enumerateLeaves
  // stopped the search before the loop body ran (e.g. tiny budget below the
  // floor cost, or dead-end exploration halted): the budget was still spent.
  if (getSimFrames() >= budgetUnits) budgetExhausted = true;

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
