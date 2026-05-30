/**
 * Reach-guided forward compiler — public entry point.
 *
 * A cleaner replacement for the LDS discrepancy sweep (`../optimizer/`). The
 * core idea (docs/search_rethink_state_handoff.md §5.B/§5.E, plan
 * `keen-sniffing-boot.md`): the problem is FEASIBILITY of state hand-offs, not
 * a search over whole tracks. So we keep ONE good forward adaptive-DFS descent
 * (the LDS floor `buildBacktrackingLeaf`, which already reaches end-of-spec on
 * every golden spec) and guide / widen it instead of enumerating whole-track
 * leaves. No discrepancy, no repair-as-leaves.
 *
 * MODES (opts.mode, default "adaptive"):
 *   - "cost"      — one floor descent ranked by pure axis cost (`costOrderer`).
 *                   The clean, simple forward compiler.
 *   - "lookahead" — one floor descent whose orderer uses forward one-step
 *                   lookahead to demote doomed cheapest hand-offs (`rank.ts`).
 *                   Rescues catastrophic specs; can dent healthy ones.
 *   - "adaptive"  — run BOTH and let the strict register keep the better track
 *                   per spec. Empirically (seed 0, 13 specs) this matches LDS
 *                   aggregate goal_score at a fraction of LDS's compute, getting
 *                   lookahead's catastrophe-rescues without its healthy-spec
 *                   regressions. The second descent's cost is bounded (see below).
 *
 * Cost of the second (cost-only) descent in "adaptive" vs LDS: a single floor
 * descent costs ~15k–80k sim-frames on the golden specs; running two is ≤ ~2×
 * that, still well under LDS's flat 200k budget — because LDS pays the floor
 * AND a whole-track discrepancy sweep on top. Adaptive ≈ two floors; LDS ≈ one
 * floor + sweep. So adaptive is cheaper than LDS while matching its quality.
 *
 * Determinism / budget contract: identical machinery to compileLDS — per-gap
 * RNG seeded by (seed, gapIndex), sim-frame budget as a pure stop condition
 * (each floor is budget-exempt and must complete; the hard guard still trips a
 * runaway op), strict-improvement register. The architecture-agnostic contract
 * harness (`tests/budget_contract_harness.ts`) is the guardrail.
 */

import {
  type ResolvedStart,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
  effectiveAxes,
} from "../core/substrate.ts";
import { withOptimizedPrerollStart } from "../core/preroll.ts";
import { makeRng } from "../../lib/rng.ts";
import { CALIB, secToFrame } from "../types.ts";
import {
  BASE_BACKTRACK_DEPTH,
  buildBacktrackingLeaf,
  type Leaf,
  type SearchTelemetry,
} from "../optimizer/lds.ts";
import { costOrderer, makeRootNode, type CandidateOrderer } from "../optimizer/node.ts";
import { polishLeafVariant } from "../optimizer/polish.ts";
import { evaluateLeaf, buildLeafOutput } from "../optimizer/api.ts";
import { BestSoFarRegister } from "../optimizer/register.ts";
import {
  PhysicsFrameLimitExceeded,
  getSimFrames,
  resetSimFrames,
  setSimFrameLimit,
} from "../optimizer/sim_frames.ts";
import { resetArcPlacementStats, snapshotArcPlacementStats } from "../arc_placement.ts";
import { lookaheadOrderer } from "./rank.ts";
import type { SpecContext } from "../optimizer/sample.ts";
import type { Budget, CompileOutput, Spec } from "../optimizer/types.ts";

export type CompileReachMode = "adaptive" | "lookahead" | "cost";

export type CompileReachOptions = {
  /** Compute budget in sim-frames. Each floor descent is budget-EXEMPT (must
   *  complete); polish and (Stage 3) later passes stop at the next op boundary
   *  once spent. Unset → unbounded. */
  budget?: Budget;
  /** Stage B polish clone-and-test variant of each floor leaf (default true). */
  polish?: boolean;
  /** Which floor descents to run (default "adaptive"; see file header). */
  mode?: CompileReachMode;
};

/** Budgeted compiles stop at op boundaries once `budget.units` is spent; this
 *  hard guard catches work still inside a single expensive op. Same value as
 *  compileLDS so wall-clock behavior matches. */
const BUDGET_HARD_LIMIT_MULTIPLIER = 1.2;

/** The orderers a mode runs, in order. Cost first so that on a tie the simpler
 *  (cost-only) track wins via the strict register's earliest-on-tie rule. */
function orderersForMode(mode: CompileReachMode): CandidateOrderer[] {
  switch (mode) {
    case "cost": return [costOrderer];
    case "lookahead": return [lookaheadOrderer];
    case "adaptive": return [costOrderer, lookaheadOrderer];
  }
}

export function compileReach(
  userSpec: Spec,
  seed = 0,
  opts: CompileReachOptions = {},
): CompileOutput {
  if (!Number.isSafeInteger(seed)) {
    throw new Error(`compileReach: seed must be a safe integer, got ${seed}`);
  }
  const budgetUnits = opts.budget?.units ?? Infinity;
  if (opts.budget !== undefined) {
    if (opts.budget.kind !== "work") {
      throw new Error(`compileReach: only Budget.kind === "work" is supported`);
    }
    if (!Number.isFinite(budgetUnits) || budgetUnits <= 0) {
      throw new Error(`compileReach: budget.units must be positive, got ${budgetUnits}`);
    }
  }

  resetSimFrames();
  resetArcPlacementStats();
  const hardBudgetLimit = opts.budget === undefined
    ? null
    : Math.ceil(budgetUnits * BUDGET_HARD_LIMIT_MULTIPLIER);
  setSimFrameLimit(hardBudgetLimit);
  try {
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
      gap.targets = sampleGapTargets(effectiveAxes(gap, spec), CALIB.SIGMA, masterRng);
    }

    const ctx: SpecContext = { allContactFrames, durationFrames };
    const initialEngine = makeBaseEngine(startState);
    const register = new BestSoFarRegister();
    const polishEnabled = opts.polish ?? true;
    const orderers = orderersForMode(opts.mode ?? "adaptive");
    let budgetExhausted = false;
    const telemetry: SearchTelemetry = {
      repairRounds: 0, cacheHits: 0, cacheMisses: 0, baseBacktracks: 0,
    };
    let polishTried = 0;
    let polishAdopted = 0;

    const consider = (leafLike: Leaf): void => {
      const { report, key } = evaluateLeaf(leafLike, spec, gaps, allContactFrames, durationFrames);
      register.consider(
        buildLeafOutput(leafLike, report, durationFrames, startState, budgetExhausted),
        key,
      );
    };

    // Run one budget-EXEMPT floor descent with the given orderer and offer it
    // (plus its polish variant) to the register. Each orderer gets a FRESH root
    // node (and fresh candidate cache via buildBacktrackingLeaf's default) — the
    // orderer changes the per-gap ordering, so caches must not be shared. The
    // floor must complete (no budgetUnits cutoff); the hard guard still trips a
    // runaway op via PhysicsFrameLimitExceeded, surfaced to the caller.
    let hardLimitError: PhysicsFrameLimitExceeded | null = null;
    const runFloor = (orderer: CandidateOrderer): void => {
      const root = makeRootNode(initialEngine, gaps.length);
      const base = buildBacktrackingLeaf(
        root, gaps, ctx, seed, BASE_BACKTRACK_DEPTH, new Map(),
        undefined, undefined, telemetry, orderer,
      );
      if (base === null) return;
      consider(base.leaf);
      if (polishEnabled) {
        const variant = polishLeafVariant(
          base.leaf.fits, spec, gaps, allContactFrames, durationFrames, startState,
        );
        if (variant !== null) {
          polishTried++;
          const before = register.improvementCount;
          consider({ ...base.leaf, fits: variant.fits, engine: variant.engine });
          if (register.improvementCount > before) polishAdopted++;
        }
      }
    };

    try {
      for (const orderer of orderers) {
        runFloor(orderer);
        // Op boundary: once the budget is spent, don't start another floor.
        // Each completed floor is already in the register (anytime semantics).
        if (getSimFrames() >= budgetUnits) { budgetExhausted = true; break; }
      }
    } catch (error) {
      if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
      hardLimitError = error;
      budgetExhausted = true;
    }
    if (getSimFrames() >= budgetUnits) budgetExhausted = true;

    const best = register.getBest();
    if (best === null) {
      if (hardLimitError !== null) throw hardLimitError;
      throw new Error(
        `compileReach: no leaf reached end-of-spec ` +
        `(spec_duration=${spec.duration}s, seed=${seed}, ` +
        `budget=${opts.budget ? opts.budget.units : "unset"}, ` +
        `sim_frames_used=${getSimFrames()}, budget_exhausted=${budgetExhausted})`,
      );
    }
    if (allContactFrames.length > 0 && best.stats.gap_commits === 0) {
      console.warn(
        `compileReach: degenerate result — 0 of ${allContactFrames.length} contacts committed; ` +
        `returning best-effort track. (seed=${seed}, ` +
        `budget=${opts.budget ? opts.budget.units : "unset"}, sim_frames=${getSimFrames()})`,
      );
    }

    const arcStats = snapshotArcPlacementStats();
    return {
      ...best,
      stats: {
        ...best.stats,
        budget_exhausted: budgetExhausted,
        sim_frames: getSimFrames(),
        leaves_considered: register.consideredCount,
        improvements: register.improvementCount,
        polish_variants_tried: polishTried,
        polish_variants_adopted: polishAdopted,
        repair_rounds: telemetry.repairRounds,
        candidate_cache_hits: telemetry.cacheHits,
        candidate_cache_misses: telemetry.cacheMisses,
        base_backtracks: telemetry.baseBacktracks,
        ...(arcStats ? { arc_placement: arcStats } : {}),
      },
    };
  } finally {
    setSimFrameLimit(null);
  }
}
