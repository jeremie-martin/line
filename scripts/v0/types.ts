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
 * The three creative axes, in canonical order. Single source of iteration.
 * Axis semantics:
 *   - `air`           — airborne-frame fraction, [0, 0.99].
 *   - `speed`         — authored pace, [0, 1], mapped to raw px/frame by
 *                       `authoredSpeedToPx`.
 *   - `grain`         — median(line_length) / LINE_LENGTH_CAP, [0, 1].
 */
export const AXES = ["air", "speed", "grain"] as const;
export type AxisName = (typeof AXES)[number];

/** Upper bound for each normalized authored target/sample value. */
export const AXIS_VALUE_MAX = {
  air: 0.99,
  speed: 1,
  grain: 1,
} as const satisfies Record<AxisName, number>;

/** Axes whose achieved value can be measured over an arbitrary frame range. */
export const FRAME_SPAN_AXES = ["air", "speed"] as const satisfies readonly AxisName[];
export type FrameSpanAxisName = (typeof FRAME_SPAN_AXES)[number];

/**
 * Resolved or measured per-axis scalar values for one gap (or one frame).
 * The numeric bag flowing through `gap.targets`, candidate `achieved`,
 * `axisCost`, and `sampleGapTargets`.
 */
export type AxisValues = Partial<Record<AxisName, number>>;

export type AxisQualityStreamCounter = {
  attempts: number;
  successes: number;
};

/** Candidate sources that can be selected into the returned handoff prefix. */
export const HANDOFF_CANDIDATE_SOURCES = ["pool", "reuse", "brake", "startup", "axisq"] as const;
export type HandoffCandidateSourceName = (typeof HANDOFF_CANDIDATE_SOURCES)[number];
export type HandoffCandidateSourceCounter = Partial<Record<HandoffCandidateSourceName, number>>;

/** Handoff evaluation origins. These are diagnostics only: they say which path
 *  offered an output to the best-so-far register. */
export const HANDOFF_EVALUATION_PHASES = ["main", "tail", "suffix", "polish"] as const;
export type HandoffEvaluationPhase = (typeof HANDOFF_EVALUATION_PHASES)[number];
export type HandoffEvaluationPhaseCounter = Partial<Record<HandoffEvaluationPhase, number>>;
export type HandoffContactCountCounter = Partial<Record<number, number>>;

/** Compiler-owned candidate sampling streams. Normal is the main deterministic
 *  candidate prefix; extra streams must justify their sample budget separately. */
export const CANDIDATE_SAMPLE_MODES = [
  "normal",
  "brake",
  "startup_catch",
  "air_support",
  "speed_drag",
  "low_air_settle",
] as const;
export type CandidateSampleMode = (typeof CANDIDATE_SAMPLE_MODES)[number];

export type ArcPlacementCounter = {
  sampled: number;
  preclear_rejected: number;
  direct_attempted: number;
  direct_landed: number;
  direct_failed: number;
  direct_survival_failed: number;
  direct_landing_failed: number;
  direct_offbeat_failed: number;
  fallback_attempted: number;
  fallback_landed: number;
};

export type ArcPlacementMode = "target_state";

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
 * Per-compile work counters. Non-modifying instrumentation that captures where the
 * compiler spends effort. Each compile is one independent run at a single budget;
 * counters such as `sim_frames` and `leaves_considered` accumulate within that run
 * and reset at the top of each `compile()` call.
 */
export type CompileStats = {
  // ─── Generic compile counters ───
  /** Per-gap candidate samples (placement sampler calls). The most
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
  /** Terminal leaves passed through clone-and-test polish. */
  polish_variants_tried?: number;
  /** Polish passes that produced geometry-distinct variants offered to the
   *  register, and how many of those became the new best. */
  polish_variants_changed?: number;
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
  /** Source-rank summary for contact candidates used by the returned best
   *  prefix. Non-contact gaps and skipped contacts are excluded. These are the
   *  candidate source ranks recorded by handoff's ranked option stream, not
   *  benchmark-specific labels. */
  handoff_selected_candidate_rank_count?: number;
  handoff_selected_candidate_rank_mean?: number;
  handoff_selected_candidate_rank_max?: number;
  handoff_selected_candidate_nonzero_ranks?: number;
  /** Selected candidate source counts for the returned best prefix. Prefer this
   *  map for new analyzer/reporting code; the flattened fields below are kept as
   *  compact JSON compatibility mirrors. */
  handoff_selected_candidate_by_source?: HandoffCandidateSourceCounter;
  /** For selected candidates whose source is `axisq`, split selected best-path
   *  usage by the registered axis-quality stream that produced the candidate. */
  handoff_selected_axis_quality_by_axis?: Partial<Record<AxisName, number>>;
  handoff_selected_candidate_pool_count?: number;
  handoff_selected_candidate_reuse_count?: number;
  handoff_selected_candidate_brake_count?: number;
  handoff_selected_candidate_startup_count?: number;
  handoff_selected_candidate_axis_quality_count?: number;
  /** Viable candidates scored by handoff, summarized by post-catch release
   *  state. These are candidate-pool coverage diagnostics only; they are not
   *  used by ranking or scoring. Release speed is in authored speed units. */
  handoff_candidate_release_count?: number;
  handoff_candidate_release_speed_mean?: number;
  handoff_candidate_release_speed_min?: number;
  handoff_candidate_release_speed_max?: number;
  handoff_candidate_release_speed_std?: number;
  handoff_candidate_release_grounded_mean?: number;
  handoff_candidate_release_grounded_min?: number;
  handoff_candidate_release_grounded_max?: number;
  handoff_candidate_release_zero_grounded_count?: number;
  handoff_candidate_release_airborne_count?: number;
  /** Candidate next-contact preview coverage from previews the search already
   *  paid for. These are diagnostic-only; quality search currently disables
   *  universal previews, so this summarizes previewed contract/rescue options. */
  handoff_candidate_preview_count?: number;
  handoff_candidate_preview_zero_next_count?: number;
  handoff_candidate_preview_first_survivors_mean?: number;
  handoff_candidate_preview_first_survivors_min?: number;
  handoff_candidate_preview_first_survivors_max?: number;
  /** Prefix reports scored through the best-so-far register. Nonterminal
   *  prefixes are intentionally partial reports over their committed horizon;
   *  terminal prefixes use the full spec duration. */
  handoff_partial_evaluations?: number;
  handoff_full_evaluations?: number;
  /** Register offers, full-duration offers, and strict best-so-far improvements
   *  split by evaluation origin. These are denominators for judging terminal
   *  feedback work before changing scheduler policy. */
  handoff_evaluations_by_phase?: HandoffEvaluationPhaseCounter;
  handoff_full_evaluations_by_phase?: HandoffEvaluationPhaseCounter;
  handoff_improvements_by_phase?: HandoffEvaluationPhaseCounter;
  /** Full-duration output offers minus exact duplicate full SearchNode offers.
   *  This is the terminal-basin scarcity signal used by bounded suffix repair. */
  handoff_unique_full_evaluations?: number;
  /** Exact SearchNode outputs offered to the register more than once, usually
   *  because speculative completion reached a node before normal frontier
   *  traversal. The phase maps attribute the repeated offer to the path that
   *  made it visible, so future scheduler probes can separate ordinary DFS,
   *  near-tail completion, bounded repair, and polish duplication. */
  handoff_duplicate_evaluations?: number;
  handoff_duplicate_full_evaluations?: number;
  handoff_duplicate_evaluations_by_phase?: HandoffEvaluationPhaseCounter;
  handoff_duplicate_full_evaluations_by_phase?: HandoffEvaluationPhaseCounter;
  /** Greedy suffix completions attempted/succeeded from near-tail handoff
   *  prefixes before the normal soft-budget stop. */
  handoff_tail_completion_attempts?: number;
  handoff_tail_completion_successes?: number;
  handoff_tail_completion_improvements?: number;
  /** Tail-completion work split by how many required contacts remained at the
   *  source prefix. This is diagnostic-only depth attribution for deciding
   *  whether future tail scheduling should be more selective than one global
   *  remaining-contact window. */
  handoff_tail_completion_attempts_by_remaining_contacts?: HandoffContactCountCounter;
  handoff_tail_completion_successes_by_remaining_contacts?: HandoffContactCountCounter;
  handoff_tail_completion_improvements_by_remaining_contacts?: HandoffContactCountCounter;
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
  /** Startup dead-end catch samples and viable catches. These run only after the
   *  ordinary contract/rescue batches cannot produce a required-contact option. */
  handoff_startup_attempts?: number;
  handoff_startup_successes?: number;
  /** Registered axis-quality extra-stream samples and viable candidates. */
  handoff_axis_quality_attempts?: number;
  handoff_axis_quality_successes?: number;
  /** Axis-quality stream counters split by registered stream axis. These are
   *  diagnostic-only; the aggregate counters above remain the compatibility
   *  total. */
  handoff_axis_quality_by_axis?: Partial<Record<AxisName, AxisQualityStreamCounter>>;
  /** Legacy flattened counters for compact golden compatibility. Prefer
   *  `handoff_axis_quality_by_axis` for new analyzer/reporting code. */
  handoff_axis_quality_air_attempts?: number;
  handoff_axis_quality_air_successes?: number;
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

  /** Target-state placement counters. Non-scoring diagnostics. */
  arc_placement?: {
    mode: ArcPlacementMode;
    sampled: number;
    preclear_rejected: number;
    direct_attempted: number;
    direct_landed: number;
    direct_failed: number;
    direct_survival_failed: number;
    direct_landing_failed: number;
    direct_offbeat_failed: number;
    fallback_attempted: number;
    fallback_landed: number;
    by_sample_mode: Record<CandidateSampleMode, ArcPlacementCounter>;
  };

  /** Track-repair post-pass diagnostics (only present when repair ran). Non-scoring. */
  repair?: {
    first_completion_frame: number;
    restarts: number;
    accepts: number;
    frames_spent: number;
    gaps_touched: number;
    reconverged: number;
    records: Array<{
      worst: number; anchor: number; up: number; totalGaps: number;
      framesAtAnchor: number; framesBefore: number; framesSpent: number;
      estCost: number; predictedFeasible: boolean; completed: boolean;
      beforeScore: number; afterScore: number; accepted: boolean;
      inhSpeed: number | null; inhVy: number | null; inhGrounded: number | null;
    }>;
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
    [axis: string]: GapAxisValueReport;
  };
};

export type GapAxisValueReport = {
  /** Authored axis units. For speed this may be outside [0, 1] on achieved values. */
  target: number;
  achieved: number;
  error: number;
  /** Raw diagnostic units for axes whose authored scale hides physical units. */
  raw?: {
    unit: "px/frame";
    target: number;
    achieved: number;
    error: number;
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

export const SPEED_RULER = {
  /** Authored speed 0.0 maps to this physical velocity. */
  MIN_PX_PER_FRAME: 5.4,
  /** Authored speed 1.0 maps to this physical velocity. */
  MAX_PX_PER_FRAME: 12.6,
  RANGE_PX_PER_FRAME: 12.6 - 5.4,
} as const;

export function authoredSpeedToPx(speed: number): number {
  return SPEED_RULER.MIN_PX_PER_FRAME + speed * SPEED_RULER.RANGE_PX_PER_FRAME;
}

export function speedPxToAuthored(pxPerFrame: number): number {
  return (pxPerFrame - SPEED_RULER.MIN_PX_PER_FRAME) / SPEED_RULER.RANGE_PX_PER_FRAME;
}

export const SPEED_AXIS = {
  /** Authored speed 0.0 maps to this physical velocity. */
  MIN_PX_PER_FRAME: SPEED_RULER.MIN_PX_PER_FRAME,
  /** Authored speed 1.0 maps to this physical velocity. */
  MAX_PX_PER_FRAME: SPEED_RULER.MAX_PX_PER_FRAME,
  RANGE_PX_PER_FRAME: SPEED_RULER.RANGE_PX_PER_FRAME,
  /** No authored speed pressure at start: begin at the slowest meaningful pace. */
  UNTARGETED_START_PX_PER_FRAME: SPEED_RULER.MIN_PX_PER_FRAME,
  /** No authored speed pressure in reachability probes: use a moderate pace. */
  UNTARGETED_REACHABILITY_PX_PER_FRAME: 6.6,
  /** Physical high-speed boundary used by start-policy overshoot scoring. */
  HIGH_START_PX_PER_FRAME: 9.0,
} as const;

export const CALIB = {
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
} as const;

/**
 * Rider initial-state defaults used when `Spec.start` is omitted.
 */
export const START_DEFAULTS = {
  POSITION: { x: 0, y: 0 },
  VELOCITY: { x: 0.4, y: 0 },
  /** Sanity cap on |vx|, |vy|. px/frame. Rejects absurd
   *  manual start velocities without constraining normal play. */
  VELOCITY_SANITY_CAP: 20,
} as const;

/** Pre-roll safety limits. */
export const PREROLL = {
  /** Sanity cap on user-supplied preroll seconds. */
  MAX_S: 10,
  /** Default preroll when a spec omits it. Preroll (compiler-chosen initial
   * velocity) is enabled by default: every realistic spec wants the compiler to
   * arrive at the first contact already in stride rather than spinning up from
   * the engine's default rest state. A spec must opt OUT explicitly with
   * `preroll: 0` (e.g. to test the from-default path). */
  DEFAULT_S: 5,
} as const;

/** Convert seconds → frame index. */
export function secToFrame(t: number): number {
  return Math.round(t * FPS);
}

/** Convert frame index → seconds. */
export function frameToSec(f: number): number {
  return f / FPS;
}
