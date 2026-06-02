/**
 * v0 types — Spec, Contact, axis curves, Arc, DriftReport.
 */

import type { TrackLine } from "../lib/primitive.ts";

// ─────────── Spec (authoring surface) ───────────

export type Spec = {
  /** Track duration, seconds. */
  duration: number;
  /** Hard sync events. */
  contacts: Contact[];
  /**
   * Per-axis target curves — the authoring surface. Each axis is a function of
   * track time (seconds); an absent key means that axis is never targeted. See
   * `core/curves.ts` for the `constant`/`ramp`/`keyframes` builders.
   */
  axes: AxisCurves;
  /**
   * Optional rider initial state. Omitted => default (0,0)+v=(0.4,0).
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
  /**
   * Per-gap target jitter (Gaussian σ): each gap's resolved axis target is
   * perturbed by `gauss(target, jitter)` once, for neighbor-to-neighbor
   * variety so adjacent catches aren't identical on a flat curve. Omitted ⇒
   * `CALIB.SIGMA` (0.05, the legacy default). Set `0` for an exact, un-jittered
   * read of the curve (useful when the curve itself carries the variation, e.g.
   * the continuous showcase specs). First step of moving jitter out of CALIB
   * into the spec; a future per-axis form may follow.
   */
  jitter?: number;
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

/**
 * Axis target curve: absolute track time (seconds) → axis value, or
 * `undefined` for "no pressure on this axis at this time". Built from the
 * helpers in `core/curves.ts` (`constant`, `ramp`, `keyframes`); raw lambdas
 * are allowed too.
 */
export type Curve = (t: number) => number | undefined;

/**
 * The four creative axes, in canonical order. Single source of iteration.
 * Axis semantics (all normalized):
 *   - `air`           — airborne-frame fraction, [0, 0.99].
 *   - `speed`         — mean(|velocity|) / SPEED_CAP, [0, 1].
 *   - `contact_style` — per-contact traversed/segment-length ratio, averaged, [0, 1].
 *   - `grain`         — median(line_length) / LINE_LENGTH_CAP, [0, 1].
 */
export const AXES = ["air", "speed", "contact_style", "grain"] as const;
export type AxisName = (typeof AXES)[number];

/** Upper bound for each normalized authored/measured axis value. */
export const AXIS_VALUE_MAX = {
  air: 0.99,
  speed: 1,
  contact_style: 1,
  grain: 1,
} as const satisfies Record<AxisName, number>;

/** Axes whose achieved value can be measured over an arbitrary frame range. */
export const FRAME_SPAN_AXES = ["air", "speed"] as const satisfies readonly AxisName[];
export type FrameSpanAxisName = (typeof FRAME_SPAN_AXES)[number];

/** Axes whose achieved value is tied to the contact event/placed catch geometry. */
export const CONTACT_EVENT_AXES = ["contact_style"] as const satisfies readonly AxisName[];
export type ContactEventAxisName = (typeof CONTACT_EVENT_AXES)[number];

/**
 * Resolved or measured per-axis scalar values for one gap (or one frame).
 * The numeric bag flowing through `gap.targets`, candidate `achieved`,
 * `axisCost`, and `sampleGapTargets`.
 */
export type AxisValues = Partial<Record<AxisName, number>>;

/**
 * True when the resolved target bag contains exactly this canonical axis set.
 * This is intentionally AXES-driven: adding a future axis must not silently keep
 * old "air-only" or similar policies active when that new axis is targeted.
 */
export function hasExactlyTargetAxes(
  values: AxisValues,
  requiredAxes: readonly AxisName[],
): boolean {
  const required = new Set(requiredAxes);
  for (const axis of AXES) {
    const hasTarget = values[axis] !== undefined;
    if (hasTarget !== required.has(axis)) return false;
  }
  return true;
}

/** True when any axis in the provided canonical category is targeted. */
export function hasAnyTargetAxis(
  values: AxisValues,
  axes: readonly AxisName[],
): boolean {
  return axes.some((axis) => values[axis] !== undefined);
}

/**
 * Authoring surface: an optional target curve per axis. An absent key means the
 * axis is never targeted; a present curve returning `undefined` at some t means
 * "not targeted there".
 */
export type AxisCurves = Partial<Record<AxisName, Curve>>;

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
  /** Per-gap achieved-vs-target axes (replaces the former per-section `sections`). */
  gaps: GapAxisReport[];
  /** Landing events not aligned with any Contact (hard violation, see C3). */
  off_beat_landings: { frame: number }[];
  terminus: { frame: number; reason: string };
};

/**
 * Per-compile work counters. Non-modifying instrumentation for the
 * anytime-budget investigation — captures where the compiler spends
 * effort so we can pick a cheat-resistant iteration unit later.
 *
 * Counters are captured per budget checkpoint. Work counters such as
 * `sim_frames` and `leaves_considered` are monotonic across checkpoints within
 * one `compile()` call and reset at the top of each call.
 */
export type CompileStats = {
  // ─── Generic compile counters ───
  /** Per-gap candidate samples (sampleArcParams calls). The most
   *  fine-grained unit of "search work" in the optimizer. */
  candidates_sampled: number;
  /** Candidate samples that survived hard gates and returned a viable GapFit. */
  candidates_viable: number;
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
   *  in this compile call. This is the compiler's budget unit, charged
   *  at the trajectory-extraction boundary in `optimizer/sim_frames.ts`. */
  sim_frames: number;
  /** True iff this checkpoint's budget was reached before the search stopped
   *  naturally or by the fixed node cap. */
  budget_exhausted: boolean;

  // ─── Search diagnostics ───
  /** Outputs offered to the best-so-far register. */
  leaves_considered?: number;
  /** How many considered leaves strictly improved the best-so-far. */
  improvements?: number;
  /** Polish clone-and-test variants that were geometry-distinct and so offered to
   *  the register, and how many of those became the new best. */
  polish_variants_tried?: number;
  polish_variants_adopted?: number;

  /** Partial-prefix search diagnostics (compileHandoff). A node is one concrete
   *  prefix state at a gap boundary; most nodes are not whole tracks yet. */
  search_nodes_expanded?: number;
  frontier_max_size?: number;
  /** Remaining handoff frontier at this checkpoint. `gap` is the next gap index
   *  to expand on that branch; a positive oldest-gap lag means the search has
   *  seen deeper prefixes while older alternatives are still waiting. */
  handoff_frontier_size?: number;
  handoff_pass_frontier_size?: number;
  handoff_fallback_frontier_size?: number;
  handoff_frontier_min_gap?: number;
  handoff_frontier_max_gap?: number;
  handoff_deepest_seen_gap?: number;
  handoff_frontier_oldest_gap_lag?: number;
  handoff_frontier_mean_gap_lag?: number;
  /** Remaining branches at least three gap expansions behind the deepest seen
   *  prefix. This is an instrumentation-only proxy for "far-back" alternatives. */
  handoff_frontier_far_back_count?: number;
  /** Quality-phase scheduler pulses that selected a lagged pass-frontier branch
   *  instead of the normal LIFO branch. */
  handoff_far_back_pulses?: number;
  /** Search-lane seed used for candidate sampling/start lookahead. Normally
   *  equals the public compile seed; diagnostics may vary it while keeping the
   *  public seed's target jitter fixed. */
  handoff_search_seed?: number;
  /** Search-lane id for the returned best prefix. Lane 0 is the baseline handoff
   *  sequence; higher lanes are deterministic downstream resampling branches. */
  handoff_search_lane?: number;
  /** Clean prefixes cloned into alternate downstream search lanes during this
   *  compile. These are ordinary frontier nodes and are scored by the same
   *  best-so-far register as baseline prefixes. */
  handoff_prefix_branch_forks?: number;
  /** Alternate-lane outputs actually offered to the best-so-far register, how
   *  many of them were full-duration outputs, and how many strictly improved
   *  the register. Forks alone only show branch volume; these counters show
   *  whether branch work converted into accepted downstream basins. */
  handoff_prefix_branch_evaluations?: number;
  handoff_prefix_branch_full_evaluations?: number;
  handoff_prefix_branch_improvements?: number;
  /** Alternate-lane branch subtrees pruned after producing full-duration
   *  evaluations without any register improvement. */
  handoff_prefix_branch_prunes?: number;
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
  /** Selected start-state velocity in polar form. This is report-only
   *  instrumentation for start-policy probes; it is not used by scoring. */
  handoff_start_speed?: number;
  handoff_start_angle_deg?: number;
  /** Start-state diversity reached by the search. `seen` includes root partials;
   *  `with_fits` counts start ranks that reached at least one committed catch. */
  handoff_start_ranks_seen?: number;
  handoff_start_ranks_with_fits?: number;
  handoff_previews?: number;
  /** Future contacts successfully rolled forward inside handoff preview
   *  rollouts. Higher means candidate ranking is using multi-gap feasibility,
   *  not only one-step survival. */
  handoff_preview_contacts?: number;
  handoff_preview_survivors?: number;
  /** Translated recent-catch candidates validated at the current gap, and how
   *  often those reuse validations returned a viable catch. */
  handoff_reuse_attempts?: number;
  handoff_reuse_successes?: number;
  /** Extra brake-mode candidate samples and viable brake catches. */
  handoff_brake_attempts?: number;
  handoff_brake_successes?: number;
  /** Registered axis-quality extra-stream samples and viable candidates. */
  handoff_axis_quality_attempts?: number;
  handoff_axis_quality_successes?: number;
  /** Axis-quality stream counters split by registered stream axis. These are
   *  diagnostic-only; the aggregate counters above remain the compatibility
   *  total. */
  handoff_axis_quality_air_attempts?: number;
  handoff_axis_quality_air_successes?: number;
  handoff_axis_quality_contact_style_attempts?: number;
  handoff_axis_quality_contact_style_successes?: number;
  /** Required-contact dead-ends where handoff spent one larger deterministic
   *  candidate batch before accepting a skip, and how often that rescue batch
   *  found at least one viable catch. */
  handoff_rescue_attempts?: number;
  handoff_rescue_successes?: number;
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

/**
 * Per-gap achieved-vs-target axis report — the section-free replacement for
 * `SectionReport`. One entry per contact gap that received a catch; `axes`
 * holds only the axes actually targeted there (target = the gap's resolved
 * curve mean, achieved = measured on the final track).
 */
export type GapAxisReport = {
  /** Gap index in time order (matches `Gap.index`). */
  gap_index: number;
  /** Landing time of the gap's terminating contact, seconds. */
  t_end: number;
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
  targets: AxisValues;
};

// ─────────── Conventions ───────────

/** Engine framerate. Spec time (seconds) ↔ frame conversion. */
export const FPS = 40;

/**
 * Calibration constants. TODO calibrate empirically against rendered tracks.
 */
export const CALIB = {
  /** Divisor for `speed` axis. px/frame. */
  SPEED_CAP: 12,
  /** Divisor for `grain` axis. units. */
  LINE_LENGTH_CAP: 49,
  /**
   * Per-gap target jitter (Gaussian σ): each gap's resolved axis target gets
   * `gauss(target, SIGMA)` noise for neighbor-to-neighbor variety. Global for
   * now. FUTURE (deferred, see project memory): move jitter into the spec as a
   * creative lever — per-axis (steady speed but jittery air), and ultimately a
   * curve that can oscillate fast *within* a single gap (sub-gap variation),
   * not just one sample per gap. Tracked as a follow-up to the curve refactor.
   */
  SIGMA: 0.05,
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
 * Rider initial-state defaults used when `Spec.start` is omitted.
 */
export const START_DEFAULTS = {
  POSITION: { x: 0, y: 0 },
  VELOCITY: { x: 0.4, y: 0 },
  /** Sanity cap on |vx|, |vy|. px/frame. ~1.7× SPEED_CAP; rejects absurd
   *  manual start velocities without constraining normal play. */
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
