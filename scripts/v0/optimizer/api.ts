/**
 * Stage 1 — public compileLDS entry point.
 *
 * Wires the LDS leaf enumeration through the best-so-far register
 * and returns the best CompileOutput seen. No budget cutoff yet
 * (that's Stage 2); this stage runs to a maxDiscrepancy cap.
 *
 * Determinism: given `(spec, seed, opts)`, every step is
 * deterministic — RNG seeded by (seed, gap_index) per-node, the leaf
 * enumeration SEQUENCE fixed by (spec, seed, maxDiscrepancy) (base
 * floor, then the guided-repair chain, then the d=1..maxD deviation
 * sweep — a prefix-superset in maxD, not a globally discrepancy-sorted
 * order; see lds.ts), register only swaps on strict improvement. Same
 * inputs → byte-identical Track.
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
import { enumerateLeaves, type Leaf } from "./lds.ts";
import { makeRootNode } from "./node.ts";
import { polishLeafVariant } from "./polish.ts";
import { BestSoFarRegister, leafKeyForReport, type LeafKey } from "./register.ts";
import { getSimFrames, resetSimFrames } from "./sim_frames.ts";
import type { SpecContext } from "./sample.ts";
import type { Budget, CompileOutput, DriftReport, Spec } from "./types.ts";

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
  // The per-gap RNG seeds with int32 arithmetic (node.ts); seeds outside the
  // safe-integer range would silently collide or lose precision, breaking the
  // "different seed → different exploration" guarantee. Reject them up front.
  if (!Number.isSafeInteger(seed)) {
    throw new Error(`compileLDS: seed must be a safe integer, got ${seed}`);
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
  // `startState` is threaded explicitly into `polishLeafVariant` (which scopes
  // compile.ts's module-global start state via save/restore around its rebuilds)
  // rather than primed here as a side effect — so an interleaved `compile()` /
  // second `compileLDS()` can't leave polish rebuilding from a stale start
  // (review #5; the removed legacy floor used to set the global implicitly).
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
  let budgetExhausted = false;

  /** Score a leaf (or polish variant) and offer it to the register.
   *  Returns the comparator key. The detect+report runs once (`evaluateLeaf`)
   *  and is shared with `buildLeafOutput` — no second extraction (review #7). */
  const consider = (leafLike: Leaf): LeafKey => {
    const { report, key } = evaluateLeaf(leafLike, spec, gaps, allContactFrames, durationFrames);
    register.consider(
      buildLeafOutput(leafLike, report, durationFrames, startState, budgetExhausted),
      key,
    );
    return key;
  };

  // The legacy floor has been removed: the d=0 leaf (buildBacktrackingLeaf,
  // inside enumerateLeaves) is the search's own completion floor. compileLDS now
  // stands alone — no legacyCompile seed, no fallback.
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
      const variant = polishLeafVariant(leaf.fits, spec, gaps, allContactFrames, durationFrames, startState);
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
  // Loud signal on a degenerate best-effort result: the floor always reaches
  // end-of-spec (skip-marching unsatisfiable contacts), so on a contactful spec
  // a winner that commits ZERO contact fits means every contact was skipped.
  // Surface it rather than silently returning an empty track; we still return
  // the best-effort track (anytime semantics) instead of throwing (review #2).
  if (allContactFrames.length > 0 && best.stats.gap_commits === 0) {
    console.warn(
      `compileLDS: degenerate result — 0 of ${allContactFrames.length} contacts committed ` +
      `(every contact gap skipped); returning best-effort track. ` +
      `(seed=${seed}, maxDiscrepancy=${maxDiscrepancy}, ` +
      `budget=${opts.budget ? opts.budget.units : "unset"}, sim_frames=${getSimFrames()})`,
    );
  }
  // Update budget_exhausted on the returned output (the leaf was
  // built before we knew the final state of the budget flag).
  return {
    ...best,
    stats: { ...best.stats, budget_exhausted: budgetExhausted, sim_frames: getSimFrames() },
  };
}

/** Run detect + buildDriftReport ONCE for a leaf and derive both the drift
 *  report (for the CompileOutput) and the comparator key (for the register).
 *  Sharing the single extraction avoids re-running the dominant per-leaf
 *  detect/report work twice (review #7). Pure function of leaf + spec geometry. */
function evaluateLeaf(
  leaf: Leaf,
  spec: Spec,
  // deno-lint-ignore no-explicit-any
  gaps: any[],
  allContactFrames: number[],
  durationFrames: number,
): { report: DriftReport; key: LeafKey } {
  const det = detect(extractRawTrajectory(leaf.engine, durationFrames + 20));
  const report = buildDriftReport(
    det, spec, gaps, allContactFrames, durationFrames, [], leaf.fits as (GapFit | null)[],
  );
  // Build the comparator key via the shared helper (register.ts) — the single
  // source of truth, so the key selection ranks by can't drift from the key the
  // property tests reconstruct. totalFrames gives a dying leaf partial
  // survival_quality (matches how golden.ts scores the returned track; review P2).
  return { report, key: leafKeyForReport(report, durationFrames) };
}

/** Build a CompileOutput from a leaf using its already-computed drift report
 *  (run once in `evaluateLeaf` and shared — no second extraction). */
function buildLeafOutput(
  leaf: Leaf,
  report: DriftReport,
  durationFrames: number,
  startState: ResolvedStart,
  budgetExhausted: boolean,
): CompileOutput {
  const fits = leaf.fits as (GapFit | null)[];
  const allLines = [];
  for (const fit of fits) if (fit !== null) allLines.push(...fit.lines);
  const track = buildTrackJson(allLines, durationFrames + 20, startState);
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
      // total_committed_cost / committed_costs_per_gap are the committed
      // CANDIDATE sampling costs and intentionally exclude polish-added geometry
      // — identical to legacy `recordCommittedCosts` (compile.ts), so both
      // compilers report the same quantity (review #3).
      total_committed_cost: leaf.cumulativeCost,
      committed_costs_per_gap: fits.map((f) => (f === null ? null : f.cost)),
      sim_frames: getSimFrames(),
      budget_exhausted: budgetExhausted,
    },
  };
}
