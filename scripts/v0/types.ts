/**
 * v0 types — Spec, Section, Contact, Arc, DriftReport.
 * See ../../DESIGN.md for the canonical definitions.
 */

import type { TrackLine } from "../lib/primitive.ts";

// ─────────── Spec (authoring surface) ───────────

export type Spec = {
  /** Track duration, seconds. */
  duration: number;
  /** Default axis values that sections may override per-axis. */
  defaults?: Partial<SectionAxes>;
  /** Hard sync events. */
  contacts: Contact[];
  /** Soft style blocks, may stack (last-declared wins per axis). */
  sections: Section[];
  /**
   * Optional rider initial state. Omitted ⇒ legacy default (0,0)+v=(0.4,0).
   * Manual override only — use `preroll` instead if you want the compiler to
   * choose a §0-compatible initial state.
   */
  start?: StartState;
  /**
   * Optional pre-roll budget, seconds. The current compiler treats this as
   * permission to optimize the rider's initial velocity for the real spec
   * timeline. Future implementations may synthesize visible pre-roll
   * geometry that reaches the chosen initial condition.
   */
  preroll?: number;
};

/** Manual override for rider initial state. px / px·frame⁻¹. */
export type StartState = {
  vx: number;
  vy: number;
  /** Default 0. */
  x?: number;
  /** Default 0. */
  y?: number;
};

export type Contact = {
  /** Seconds, must be in [0, duration]. */
  t: number;
};

export type Section = {
  /** Seconds. */
  t0: number;
  /** Seconds. */
  t1: number;
} & SectionAxes;

export type SectionAxes = {
  /** Airborne-frame fraction. [0, 0.99]. */
  air?: number;
  /** mean(|velocity|) / SPEED_CAP. [0, 1]. */
  speed?: number;
  /** Per-contact traversed/segment-length ratio, averaged. [0, 1]. */
  contact_style?: number;
  /** median(line_length) / LINE_LENGTH_CAP. [0, 1]. */
  grain?: number;
};

// ─────────── Arc (placement primitive) ───────────

export type Arc = {
  anchor: { x: number; y: number };
  /** Total arc length, units. */
  length: number;
  /** Tangent angle at start, degrees. */
  startAngleDeg: number;
  /** Tangent angle at end, degrees (== startAngle ⇒ straight). */
  endAngleDeg: number;
  /** Polyline granularity. */
  segments: number;
  /** Shape of curvature profile, [-1, +1]. 0 = circular, ±1 = biased. */
  curveBias: number;
};

// ─────────── Output ───────────

export { type TrackLine } from "../lib/primitive.ts";

export type DriftReport = {
  contacts: ContactReport[];
  sections: SectionReport[];
  /** Landing events not aligned with any Contact (hard violation, see C3). */
  off_beat_landings: { frame: number }[];
  terminus: { frame: number; reason: string };
};

/**
 * Per-compile work counters. Non-modifying instrumentation for the
 * anytime-budget investigation — captures where the compiler spends
 * effort so we can pick a cheat-resistant iteration unit later.
 *
 * All counters are monotonic within one `compile()` call and reset
 * at the top of each call.
 */
export type CompileStats = {
  // ─── Legacy compile() counters ─── (the standalone optimizer leaves these at
  //     their zero defaults; see the "optimizer-native" group at the end). Kept
  //     for the legacy `compile()` reference path and back-compat.
  /** Per-gap candidate samples (sampleArcParams calls). The most
   *  fine-grained unit of "search work" in the optimizer. */
  candidates_sampled: number;
  /** Full engine rebuilds (rebuildEngine calls). Coarse but explicit
   *  physics-replay cost; mostly triggered by polish passes. */
  engine_rebuilds: number;
  /** Successful per-gap commits in the main loop (each one places a
   *  fit into the gap array). */
  gap_commits: number;
  /** Backtrack invocations (main loop revisits an earlier gap because
   *  the current gap exhausted its candidates). */
  gap_backtracks: number;
  /** Final-track validation retries that triggered a re-compile of
   *  some prefix because off-beat landings were detected. */
  validation_retries: number;
  /** Polish-pass invocations after the main loop. Each is one pass
   *  over the committed fits to nudge specific axes. */
  polish_iterations: number;
  /** Sum of the final committed `cost` over all GapFits (the L2 SSE
   *  the per-gap optimizer was minimizing during search). Recorded
   *  for the cost-vs-quality correlation study in Phase 0. */
  total_committed_cost: number;
  /** Per-gap committed cost, in gap order (null entries for skipped
   *  gaps). Same data as total_committed_cost but at gap granularity
   *  so per-section / per-spec breakdowns are possible. */
  committed_costs_per_gap: (number | null)[];
  /** Total simulated rider frames across all trajectory extractions
   *  in this compile call. The work-unit for the new optimizer's
   *  budget; charged at the trajectory-extraction boundary in
   *  `scripts/v0/optimizer/sim_frames.ts`. The legacy compiler does
   *  not populate this field; it remains 0. */
  sim_frames: number;
  /** True iff the new optimizer hit its work-units budget before
   *  natural enumeration completion. False if no budget was set or
   *  if enumeration completed within budget. Legacy compiler never
   *  sets this (no budget concept); it remains false. */
  budget_exhausted: boolean;

  // ─── Optimizer-native diagnostics ─── (populated by compileLDS; absent on the
  //     legacy compile() path). Non-scoring — they make the golden breakdown
  //     actionable on hard specs (the gradient lives in the breakdown, GOAL_LDS §1).
  /** Leaves offered to the best-so-far register (base floor + repair + deviations
   *  + polish variants). The total search volume actually evaluated. */
  leaves_considered?: number;
  /** How many considered leaves strictly improved the best-so-far. */
  improvements?: number;
  /** Polish clone-and-test variants that were geometry-distinct and so offered to
   *  the register, and how many of those became the new best. */
  polish_variants_tried?: number;
  polish_variants_adopted?: number;
  /** Guided-repair leaves yielded (each is one re-descent forbidding an
   *  assembled-track-missing candidate). 0 means the base path satisfied the
   *  contract with no repair needed. */
  repair_rounds?: number;
  /** Candidate-list cache hits/misses across the whole search (base descent +
   *  repair + deviations). Low hit-rate ⇒ the search is re-sampling many distinct
   *  prefixes (expensive); high ⇒ lots of shared structure. */
  candidate_cache_hits?: number;
  candidate_cache_misses?: number;
  /** Backtrack steps taken inside the d=0 base-path descent (buildBacktrackingLeaf).
   *  High ⇒ a thrashing base floor (e.g. drums_crescendo). */
  base_backtracks?: number;

  /** Partial-prefix search diagnostics (compileHandoff). A node is one concrete
   *  prefix state at a gap boundary; unlike LDS leaves, most nodes are not whole
   *  tracks yet. */
  search_nodes_expanded?: number;
  frontier_max_size?: number;
  /** Prefix reports scored through the best-so-far register. Nonterminal
   *  prefixes are intentionally partial reports over their committed horizon;
   *  terminal prefixes use the full spec duration. */
  handoff_partial_evaluations?: number;
  handoff_full_evaluations?: number;
  /** Greedy suffix completions attempted/succeeded from near-tail handoff
   *  prefixes before the normal soft-budget stop. */
  handoff_tail_completion_attempts?: number;
  handoff_tail_completion_successes?: number;
  /** Deterministic root/start-state alternatives available to compileHandoff,
   *  and the selected rank for the returned best prefix. */
  handoff_start_options?: number;
  handoff_start_rank?: number;
  handoff_previews?: number;
  /** Future contacts successfully rolled forward inside handoff preview
   *  rollouts. Higher means candidate ranking is using multi-gap feasibility,
   *  not only one-step survival. */
  handoff_preview_contacts?: number;
  handoff_preview_survivors?: number;
  /** Contact gaps skipped in the returned handoff best prefix. */
  handoff_skips?: number;
  /** Skip branches generated during handoff search because a contact gap had no
   *  viable candidate at that prefix. */
  handoff_skip_branches?: number;
  /** Skip branches whose continuation was delayed behind existing frontier
   *  alternatives, so local handoff siblings get searched before marching past
   *  a missed contact. */
  handoff_deferred_skips?: number;

  /** Impact-anchored arc placement counters (only present when
   *  LR_ARC_PLACEMENT=impact_anchor). Non-scoring diagnostics. */
  arc_placement?: {
    mode: "impact_anchor";
    sampled: number;
    preclear_rejected: number;
    direct_attempted: number;
    direct_landed: number;
    direct_failed: number;
    fallback_attempted: number;
    fallback_landed: number;
  };
};

export type ContactReport = {
  t_target: number;
  t_actual: number | null;
  frame_error: number | null;
  status: "hit" | "drift" | "missing";
};

export type SectionReport = {
  section_index: number;
  survived: boolean;
  axes: {
    [axis: string]: { target: number; achieved: number; error: number };
  };
};

// ─────────── Compiler-internal (Gap) ───────────

export type Gap = {
  /** Gap index in time order; head gap = 0, tail gap = last. */
  index: number;
  /** Start frame (inclusive). */
  startFrame: number;
  /** End frame (the Contact frame; exclusive for sample-counting; for tail gap = endOfSpec). */
  endFrame: number;
  /** True iff this gap's end is a hard Contact (false for tail gap). */
  endsWithContact: boolean;
  /** Per-axis targets sampled for this gap. */
  targets: SectionAxes;
};

// ─────────── Conventions ───────────

/** Engine framerate. Spec time (seconds) ↔ frame conversion. */
export const FPS = 40;

/**
 * Investigation override: setting CALIB_K_OVERRIDE in the environment
 * replaces `CALIB.K` with the given value at module load. Used for the
 * quality-vs-K sweep that calibrates the compute-budget model. Does not
 * affect normal runs (env var unset). Removable once the investigation
 * concludes.
 */
const _kOverride = (() => {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.CALIB_K_OVERRIDE;
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`CALIB_K_OVERRIDE must be a positive number, got ${raw}`);
  }
  return Math.floor(n);
})();

/**
 * Calibration constants. TODO calibrate empirically against rendered tracks.
 * See ../../DESIGN.md § Calibration constants.
 */
export const CALIB = {
  /** Divisor for `speed` axis. px/frame. */
  SPEED_CAP: 12,
  /** Divisor for `grain` axis. units. */
  LINE_LENGTH_CAP: 49,
  /** Cross-gap target sampling spread (Gaussian σ). */
  SIGMA: 0.05,
  /** Per-gap candidate budget. */
  K: _kOverride ?? 48,
  /** Cross-gap backtrack depth. */
  BACKTRACK_DEPTH: 2,
  /** Max times the final-track validator can re-trigger compilation when
   *  assembled-track sync failures are detected after per-gap commit. */
  FINAL_VALIDATION_RETRIES: 3,
  /**
   * Default Arc parameter bounds.
   * Initial values are an empirical guess loosely centered on shapes that
   * are known to survive impact in the engine (gentle downward slopes,
   * multi-segment). TODO: widen as we learn what actually survives — the
   * design principle is wide random sampling, but bounds tight enough that
   * most samples are at least plausible.
   */
  ARC: {
    LENGTH_MIN: 25,
    LENGTH_MAX: 180,
    /** Start tangent — wide range so steep catches (for high-vy riders) and
     *  gentle catches (for low-vy riders) are both in the sample space. */
    START_ANGLE_MIN_DEG: 5,
    START_ANGLE_MAX_DEG: 70,
    /** End tangent — always flatter than start; allows mild upward (rebound). */
    END_ANGLE_MIN_DEG: -5,
    END_ANGLE_MAX_DEG: 20,
    SEGMENTS_MIN: 3,
    SEGMENTS_MAX: 12,
    /** Anchor X offset relative to rider's predicted x at landing frame. */
    ANCHOR_X_OFFSET_MIN: -14,
    ANCHOR_X_OFFSET_MAX: 4,
    /** Anchor Y offset relative to rider's predicted y at landing frame.
     *  Bisection adjusts further; this is the starting point. */
    ANCHOR_Y_OFFSET_MIN: -4,
    ANCHOR_Y_OFFSET_MAX: 10,
  },
} as const;

/**
 * Rider initial-state defaults. Matches the legacy hard-coded behavior;
 * used when `Spec.start` is omitted. See `resolveStartState` in compile.ts.
 */
export const START_DEFAULTS = {
  POSITION: { x: 0, y: 0 },
  VELOCITY: { x: 0.4, y: 0 },
  /** Sanity cap on |vx|, |vy|. px/frame. ~2.2× SPEED_CAP. */
  VELOCITY_SANITY_CAP: 20,
} as const;

/** Pre-roll safety limits. */
export const PREROLL = {
  /** Sanity cap on user-supplied preroll seconds. */
  MAX_S: 10,
} as const;

/** Convert seconds → frame index. */
export function secToFrame(t: number): number {
  return Math.round(t * FPS);
}

/** Convert frame index → seconds. */
export function frameToSec(f: number): number {
  return f / FPS;
}
