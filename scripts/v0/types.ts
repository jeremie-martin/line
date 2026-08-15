/**
 * v0 types — Spec, Contact, axis curves, Arc, DriftReport.
 */

import type { TrackLine } from "../lib/primitive.ts";

// ─────────── Spec (authoring surface) ───────────

export type Spec = {
  /** Track duration, seconds. */
  duration: number;
  /**
   * Optional music/audio assets associated with this spec. The compiler ignores
   * this field; dashboards/renderers can use it to play the source track and
   * overlay analysis assets against the authored contacts/axes.
   */
  music?: SpecMusic;
  /** Hard sync events. */
  contacts: Contact[];
  /**
   * Per-axis target curves — the authoring surface. Each axis is a function of
   * track time (seconds); an absent key means that axis is never targeted. See
   * `core/curves.ts` for the `constant`/`ramp`/`keyframes` builders.
   */
  axes: AxisCurves;
  /**
   * Render-only camera intent. The compiler ignores this field; render CLIs turn
   * it into Line Rider camera keyframes. This keeps camera timing tied to the
   * authored musical spec instead of the realized trajectory.
   */
  camera?: SpecCamera;
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

export type SpecCamera = {
  zoom?: SpecZoomLane;
  /**
   * Per-beat camera "punch" (shake): the camera snaps in (or out) on strong
   * landings, then eases back, reacting to each contact's authored `impact`.
   * Render-only intent (the compiler ignores `camera`); render CLIs bake it into
   * the per-frame zoom. Authoring it HERE — not as a CLI flag — keeps the camera
   * shake part of the spec, so it's reproducible and per-song.
   */
  beatPunch?: SpecBeatPunch;
};

export type SpecBeatPunch = {
  /**
   * Absolute impact gate, [0,1]: every beat with `impact >= threshold` punches.
   * When set, this is the gate (the clean "all beats above X shake" behavior).
   * Mutually exclusive with `percentile`; `threshold` wins if both are given.
   */
  threshold?: number;
  /**
   * Relative gate: punch the top `(100 - percentile)%` of beats by impact. Used
   * only when `threshold` is unset. Default 70 (punch the top 30%).
   */
  percentile?: number;
  /** Peak zoom delta at the song's max impact. Default 0.13. */
  amp?: number;
  /**
   * Strength of the weakest selected beat as a fraction of `amp` (1 = uniform;
   * <1 = shake scales up with impact, from `floor·amp` at the gate to `amp` at
   * the max). Default 0.5. The proportional-to-impact behavior.
   */
  floor?: number;
  /** Exponential decay time constant after the hit, frames. Default 4. */
  decay?: number;
  /** Ramp-in before the hit, frames. Default 1. */
  attack?: number;
  /** Punch direction: "in" (zoom toward the rider) or "out". Default "in". */
  dir?: "in" | "out";
};

export type SpecZoomLane = {
  /**
   * Explicit zoom keyframes. `zoom` uses the same linear playback scale as
   * `scripts/inspect.ts --zoom=N`; the Line Rider bundle's native zoomer gets
   * log2-converted keyframes at render time.
   */
  keyframes: SpecZoomKeyframe[];
  /** Native createZoomer smoothing window in frames. Default 0. */
  smoothingFrames?: number;
};

export type SpecZoomKeyframe = {
  /** Seconds on the authored spec/music timeline. */
  t: number;
  /** Linear playback zoom, same unit as `--zoom=N`; must be > 0. */
  zoom: number;
};

export type SpecMusic = {
  /** Repo-relative path or URL for the source audio. */
  audio: string;
  title?: string;
  artist?: string;
  /** Human-readable tempo/meter label, e.g. "100 BPM · 4/4". */
  tempo?: string;
  /**
   * Seconds added to audio time before comparing to spec time. Default 0.
   * Positive values mean the dashboard reads the spec at `audio.currentTime + offset`.
   */
  offset?: number;
  /** Optional beat/onset/downbeat analysis JSON, repo-relative path or URL. */
  beats?: string;
  /** Optional spectrogram assets, repo-relative paths or URLs. */
  spectrogram?: {
    image?: string;
    metadata?: string;
  };
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
  /**
   * Optional per-beat landing intensity ("how hard the rider slams into the arc" —
   * "claquage"), absolute [0, 1] on a FELT scale: **0 = a perfectly smooth catch,
   * 1 = very strong**. Defined as the rider's **redirection IMPULSE**
   * `cArc = Σ v̄·|Δθ|` — the per-frame CoM heading change × midpoint speed, ACCUMULATED
   * over the CONTACTED frames of the `IMPACT_WINDOW`-frame (~0.15s) episode after
   * touchdown (airborne frames contribute zero — flight is not impact) — mapped to
   * [0,1] by `normImpact` against `IMPACT_RULER.SOFT`/`IMPACT_RULER.VERY_STRONG` (read the
   * live values from the `IMPACT_RULER` block below rather than a number copied into
   * prose; gentler than SOFT clamps to 0, harder than VERY_STRONG to 1).
   * PROMOTED 2026-07-31 over the net-form `redirArc = v·Δθ` (LOCKED 2026-06-14);
   * history, adjudication and calibration in `docs/impact_definition.md`.
   *
   * Why the redirection impulse (not perpendicular `redir = v·sinΔθ`, nor normal closing,
   * nor body force): the felt hit is the surface *redirecting* the rider's path at speed;
   * `v·Δθ` keeps the speed weighting with no sin-compression of the biggest slams, beats
   * `redir`/`turn` and generalizes across tracks (incl. flat-drop slams), and stays
   * CoM-velocity-only so it's immune to sled rotation / limb whip (which look violent but
   * aren't felt). Accumulating |Δθ| rather than taking the net endpoint turn means a
   * bend-then-unbend contact (S-bend, bounce reflection) adds instead of cancelling to 0.
   * Decelerating *along* the path (a glide slowing on a straight line) builds no Δθ →
   * reads ~0. See `docs/impact_definition.md`.
   *
   * Authored on the beat (NOT an axis): impact is an adjective on a discrete landing
   * event, where the axes (air/speed/elevation/amplitude) are continuous fields over
   * the span *between* beats. Internally it is resolved into the terminating gap's
   * target bag so it reuses the per-gap axis measurement/report plumbing (each contact
   * gap ends in exactly one beat, so per-gap scalar ≡ per-beat value).
   *
   * Status: SCORED (folds into the contract `axis_quality`). Measured by
   * `contactRedirArcPxAtLanding` (substrate.ts) → `normImpact`; reported with target/achieved/
   * error/ceiling. The compiler steers toward it via the arc-placement redir lever
   * (target → needed CoM turn = impactToRawPx(target)/speed) and candidate ranking.
   */
  impact?: number;
};

/**
 * Axis target curve: absolute track time (seconds) → axis value, or
 * `undefined` for "no pressure on this axis at this time". Built from the
 * helpers in `core/curves.ts` (`constant`, `ramp`, `keyframes`); raw lambdas
 * are allowed too.
 */
export type CurveKind = "constant" | "ramp" | "keyframes";
export type CurveMeta = {
  kind: CurveKind;
  defaultEase?: string;
  points: { t: number; v: number; ease?: string; sourceIndex?: number }[];
};
export type Curve = ((t: number) => number | undefined) & { meta?: CurveMeta };

/**
 * The creative axes, in canonical order. Single source of iteration. New axes
 * are *appended* (never reordered): per-axis RNG draws in `sampleGapTargets`
 * happen only for targeted axes, so appending keeps existing specs byte-identical.
 * Axis semantics:
 *   - `air`           — airborne-frame fraction, [0, 0.99].
 *   - `speed`         — authored pace, [0, 1], mapped to raw px/frame by
 *                       `authoredSpeedToPx`.
 *   - `grain`         — median(line_length) / LINE_LENGTH_CAP, [0, 1].
 *   - `elevation`     — altitude trend on a *relative climb-effort* scale, [0, 1]:
 *                       0.5 = level (net-zero altitude), →1 = climb as steeply as
 *                       the current speed safely allows, →0 = dive hard. Resolved
 *                       per-gap against the speed-supported vertical-velocity band
 *                       (see `ELEVATION` / `elevationBand` / `netDyToElevation`).
 *                       Asymmetric: free fall ≈ 0.33 (not 0.5), and plunge covers a
 *                       much larger altitude range than climb — see `ELEVATION`.
 *   - `amplitude`     — peak upward bow of the trajectory above the takeoff→
 *                       landing chord (jump arc height / sagitta), normalized by
 *                       `CALIB.AMPLITUDE_CAP`, [0, 1]. Orthogonal to `air`:
 *                       `air` is how *long* aloft, `amplitude` is how *high*.
 *   - `impact`        — landing intensity at a beat: the rider's redirection
 *                       IMPULSE `cArc = Σ v̄·|Δθ|` accumulated over the CONTACTED frames
 *                       of the `IMPACT_WINDOW`-frame episode after touchdown,
 *                       felt-normalized via `normImpact` [0, 1]
 *                       (0 = perfectly smooth, 1 = very strong). NOT
 *                       authored as a curve — it is a per-beat qualifier
 *                       (`Contact.impact`) resolved into the terminating gap so it
 *                       can reuse this per-gap plumbing. SCORED. In AXES and scored,
 *                       but kept out of `TARGET_AXES` — it draws no sampling RNG and
 *                       isn't curve-authored (a per-beat qualifier).
 */
export const AXES = ["air", "speed", "grain", "elevation", "amplitude", "impact"] as const;
export type AxisName = (typeof AXES)[number];

/**
 * Axes that can be authored as active optimization targets. `grain` remains in
 * AXES for measured legacy data, but spec-authored grain is intentionally
 * ignored while the grain axis is being removed from the compiler.
 */
export const TARGET_AXES = ["air", "speed", "elevation", "amplitude"] as const satisfies readonly AxisName[];
export type TargetAxisName = (typeof TARGET_AXES)[number];
const TARGET_AXIS_SET: ReadonlySet<AxisName> = new Set<AxisName>(TARGET_AXES);

/**
 * Axes that are MEASURED and surfaced in the drift report but EXCLUDED from the
 * scored `axis_quality`. `scoreDriftReport` filters these out of the `axis_error_*`
 * aggregation, so the report-only boundary lives in one place, not as a string
 * literal in the scorer.
 *
 * v2: now EMPTY — `impact` has been PROMOTED to a scored target (the golden suite
 * authors per-beat impact; the optimizer is expected to steer toward it). impact
 * stays in AXES (measured/reported) and out of TARGET_AXES, so it draws no
 * target-sampling RNG. The register's true scorer now rewards hitting it, and
 * the compiler may use impact in deterministic ranking/geometry bias.
 */
export const REPORT_ONLY_AXES = [] as const satisfies readonly AxisName[];
export const REPORT_ONLY_AXIS_SET: ReadonlySet<string> = new Set<string>(REPORT_ONLY_AXES);

/** Upper bound for each normalized authored target/sample value. */
export const AXIS_VALUE_MAX = {
  air: 0.99,
  speed: 1,
  grain: 1,
  elevation: 1,
  amplitude: 1,
  impact: 1,
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
export const HANDOFF_EVALUATION_PHASES = [
  "frontier",
  "tail_completion",
  "polish",
] as const;
export type HandoffEvaluationPhase = (typeof HANDOFF_EVALUATION_PHASES)[number];
export type HandoffEvaluationPhaseCounter = Partial<Record<HandoffEvaluationPhase, number>>;
export type HandoffContactCountCounter = Partial<Record<number, number>>;

/** Compiler-owned candidate sampling streams. Normal is the main deterministic
 *  candidate prefix; extra streams must justify their sample budget separately. */
export const CANDIDATE_SAMPLE_MODES = [
  "normal",
  "brake",
  "startup_catch",
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
 * True when the resolved target bag contains exactly this active target-axis
 * set. Axes outside TARGET_AXES are ignored even if a legacy caller supplies
 * them in the bag.
 */
export function hasExactlyTargetAxes(
  values: AxisValues,
  requiredAxes: readonly AxisName[],
): boolean {
  for (const axis of requiredAxes) {
    if (!TARGET_AXIS_SET.has(axis)) return false;
  }
  const required = new Set(requiredAxes);
  for (const axis of TARGET_AXES) {
    const hasTarget = values[axis] !== undefined;
    if (hasTarget !== required.has(axis)) return false;
  }
  return true;
}

/** True when any active target axis in the provided category is targeted. */
export function hasAnyTargetAxis(
  values: AxisValues,
  axes: readonly AxisName[],
): boolean {
  return axes.some((axis) => TARGET_AXIS_SET.has(axis) && values[axis] !== undefined);
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

export type BallisticPredictionErrorSummary = {
  pairs: number;
  mae: number | null;
  bias: number | null;
  max_abs_error: number | null;
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
  actual_candidate_samples: number;
  /** Candidate samples that survived hard gates and returned a viable GapFit. */
  viable_candidate_samples: number;
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
  /** Structural first-completion model used for budget-normalized telemetry.
   *  Diagnostic only; compiler policy must explicitly opt in to using it. */
  traversal_budget_model?: string;
  /** Predicted simulated frames needed to reach the first complete traversal,
   *  from spec structure only (feasible contacts + authored duration). */
  predicted_first_completion_frames?: number;
  /** Requested budget divided by `predicted_first_completion_frames`. This
   *  normalizes raw budgets across short/easy vs long/dense specs. */
  budget_slack?: number;
  /** Requested per-node policy candidate count over contact-node expansions. */
  handoff_requested_normal_proposals_per_ranked_option_call_min?: number;
  handoff_requested_normal_proposals_per_ranked_option_call_mean?: number;
  handoff_requested_normal_proposals_per_ranked_option_call_max?: number;
  /** Resolved branch limit over contact-node expansions. */
  handoff_policy_branch_limit_min?: number;
  handoff_policy_branch_limit_mean?: number;
  handoff_policy_branch_limit_max?: number;
  /** First terminal traversal considered by the search, regardless of whether
   *  it improved the best-so-far register. Null when the run never reached a
   *  complete traversal before stopping. */
  first_completion_frame?: number | null;
  /** SHA-256 of JSON.stringify(track) for the first terminal traversal. This
   * proves that post-terminal policies preserve the actual incumbent, not only
   * the charged frame at which one appeared. */
  handoff_first_terminal_track_hash?: string | null;

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
  /** Present for the production selective-backtracking frontier policy. An
   *  explicit DFS diagnostic omits the object. */
  handoff_selective_backtracking?: {
    policy:
      | "selective_axis_regret_catchup"
      | "selective_axis_regret_catchup_repair_incumbent_once"
      | "selective_axis_regret_catchup_periodic_initial"
      | "selective_axis_regret_catchup_periodic_repair"
      | "selective_axis_regret_catchup_value_map"
      | "selective_axis_regret_catchup_value_deferred_map"
      | "selective_axis_regret_catchup_value_deferred_initial"
      | "selective_axis_regret_catchup_value_deferred_pass_only"
      | "selective_axis_regret_catchup_value_deferred_prefix_gate"
      | "selective_axis_regret_catchup_value_initial"
      | "selective_axis_regret_catchup_value_initial_progress_10"
      | "selective_axis_regret_catchup_value_initial_expire_10"
      | "selective_axis_regret_catchup_value_initial_expire_10_stable_priority"
      | "selective_axis_regret_catchup_value_initial_expire_10_first_deficit_stop_005"
      | "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q"
      | "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_empty_retry"
      | "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_after_first"
      | "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_before_last"
      | "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_positive_prefix"
      | "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_nonpositive_prefix"
      | "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_no_refill"
      | "selective_axis_regret_catchup_value_initial_expire_10_run_proof";
    deferred_value_density_threshold: number;
    deferred_value_min_gap_progress: number;
    deferred_value_allowance_fractions: number[];
    deferred_value_map_max_allowance_fraction: number;
    deferred_value_crossings: number;
    deferred_value_progress_expired: number;
    deferred_value_alternative_unavailable_at_collection: number;
    deferred_value_collected: number;
    deferred_value_assessed: number;
    deferred_value_incumbent_path: number;
    deferred_value_production_consumed: number;
    deferred_value_alternative_unavailable_at_terminal: number;
    deferred_value_affordable: number;
    deferred_value_first_terminal_total_spent_frames: number | null;
    deferred_value_first_terminal_track_hash: string | null;
    deferred_value_opportunities: Array<
      import("./optimizer/selective_backtracking.ts").SelectiveDeferredValueOpportunity
    >;
    deferred_value_attempts: Array<
      import("./optimizer/selective_backtracking.ts").SelectiveDeferredValueAttempt
    >;
    min_contact_advance: number;
    min_axis_loss_delta: number;
    catchup_axis_loss_gain_threshold: number;
    catchup_priority_rule: "endpoint_gain" | "all_checkpoints_positive";
    value_probe_stop_rule: "equal_depth_or_budget" | "first_pre_target_deficit_005";
    value_probe_first_checkpoint_deficit_threshold: number | null;
    value_probe_candidate_breadth_rule:
      | "production"
      | "three_quarter_after_floor"
      | "three_quarter_after_floor_empty_full_retry"
      | "full_first_then_three_quarter_after_floor"
      | "three_quarter_after_floor_then_full_last"
      | "full_first_then_three_quarter_while_prefix_positive"
      | "full_first_then_three_quarter_while_prefix_nonpositive";
    value_probe_candidate_breadth_scale: number;
    value_live_exploration_budget_fraction: number;
    value_live_opportunities: Array<
      import("./optimizer/selective_backtracking.ts").SelectiveValueLiveOpportunity
    >;
    catchup_endpoint_winners_suppressed_unstable: number;
    mature_axis_loss_delta_max: number;
    /** Observation-only unique causal-watch counts. `crossed_watches` reached
     * the threshold; `admissible_watches` also had its exact sibling available,
     * no execution ceiling, and no conservative deadline pressure. */
    regret_opportunities_by_min_axis_loss_delta: Record<
      string,
      { crossed_watches: number; admissible_watches: number }
    >;
    repair_incumbent_regret_opportunities_by_min_axis_loss_delta: Record<
      string,
      { crossed_watches: number; admissible_watches: number }
    >;
    repair_incumbent_regret_opportunities_by_min_contact_advance: Record<
      string,
      { crossed_watches: number; admissible_watches: number }
    >;
    repair_incumbent_axis_loss_delta_max: number;
    repair_incumbent_max_backtracks_per_attempt: number;
    repair_incumbent_attempt_limit_suppressed_watches: number;
    contact_expansions_observed: number;
    branch_watches_armed: number;
    branch_watches_by_alternative_count: Record<string, number>;
    mature_watch_checks: number;
    loss_threshold_crossings: number;
    deadline_suppressed_crossings: number;
    execution_ceiling_suppressed_crossings: number;
    unavailable_alternatives: number;
    selective_backtracks: number;
    selective_backtracks_by_signal: {
      branch_regret: number;
      repair_incumbent_regret: number;
      periodic_exploration: number;
      value_exploration: number;
    };
    selective_backtracks_with_multiple_admissible_rewind_choices: number;
    admissible_rewind_choice_count_sum: number;
    admissible_rewind_choice_count_max: number;
    selective_backtracks_with_additional_sibling_available: number;
    additional_siblings_available_at_selective_backtrack_sum: number;
    additional_siblings_available_at_selective_backtrack_max: number;
    suspended_continuations_resumed: number;
    catchup_completed: number;
    catchup_alternative_selected: number;
    catchup_current_selected: number;
    catchup_probe_dead_ends: number;
    catchup_probe_deferred: number;
    catchup_probe_budget_yields: number;
    catchup_probe_first_deficit_stops: number;
    catchup_execution_ceiling_stops: number;
    catchup_probe_attempts: number;
    catchup_probe_target_reaches: number;
    catchup_probes_with_local_fallback_choice: number;
    catchup_probes_with_positive_local_fallback_choice: number;
    catchup_local_fallback_choice_count_sum: number;
    catchup_positive_local_fallback_choice_count_sum: number;
    catchup_local_fallback_choice_count_max: number;
    catchup_additional_probe_attempts: number;
    catchup_additional_probe_target_reaches: number;
    catchup_tournaments_with_additional_probe: number;
    catchup_additional_alternative_selected: number;
    catchup_probe_nodes_processed: number;
    catchup_probe_frames: number;
    axis_loss_delta_sum: number;
    axis_loss_delta_max: number;
    contact_advance_sum: number;
    contact_advance_max: number;
    gap_rewind_sum: number;
    gap_rewind_max: number;
    selective_backtracks_by_lane: {
      initial: number;
      snapshot: number;
      deferred_value: number;
      repair: number;
      resumed: number;
    };
    events: Array<{
      watch_id: number;
      lane: "initial" | "snapshot" | "deferred_value" | "repair" | "resumed";
      trigger_signal:
        | "branch_regret"
        | "repair_incumbent_regret"
        | "periodic_exploration"
        | "value_exploration";
      branch_gap_index: number;
      from_gap_index: number;
      alternative_gap_index: number;
      additional_siblings_available: number;
      catchup_alternatives_requested: number;
      contact_advance: number;
      gap_rewind: number;
      baseline_axis_loss: number;
      trigger_axis_loss: number;
      axis_loss_delta: number;
      incumbent_axis_loss: number | null;
      incumbent_axis_loss_delta: number | null;
      repair_attempt_index: number | null;
      admissible_rewind_choices: Array<{
        branch_gap_index: number;
        alternative_gap_index: number;
        contact_advance: number;
        gap_rewind: number;
        axis_loss_delta: number;
        conservative_deadline_margin: number;
      }>;
      alternative_conservative_deadline_margin: number;
      trigger_total_spent_frames: number;
      resumed_total_spent_frames: number | null;
      catchup_outcome:
        | "alternative_selected"
        | "current_selected"
        | "probe_dead_end"
        | "probe_deferred"
        | "probe_budget_yield"
        | "probe_first_deficit_stop"
        | "execution_ceiling"
        | null;
      catchup_end_gap_index: number | null;
      catchup_probe_nodes_processed: number;
      catchup_probe_frames: number;
      catchup_axis_loss: number | null;
      catchup_axis_loss_gain: number | null;
      catchup_best_alternative_all_checkpoints_positive: boolean | null;
      catchup_endpoint_winner_priority_suppressed: boolean;
      catchup_selected_alternative_ordinal: number | null;
      catchup_selected_route_ordinal: number | null;
      catchup_probe_results: Array<{
        route_ordinal: number;
        route_kind: "causal_alternative";
        alternative_ordinal: number;
        outcome:
          | "reached_target"
          | "probe_dead_end"
          | "probe_deferred"
          | "probe_budget_yield"
          | "probe_first_deficit_stop"
          | "execution_ceiling";
        end_gap_index: number;
        probe_nodes_processed: number;
        probe_frames: number;
        ranked_option_calls: number;
        requested_normal_proposals: number;
        candidate_geometry_evaluations: number;
        normal_empty_full_width_retry_attempts: number;
        normal_empty_full_width_retry_successes: number;
        normal_empty_full_width_retry_requested_proposals: number;
        normal_empty_full_width_retry_incremental_requested_proposals: number;
        normal_empty_full_width_retry_candidate_geometry_evaluations: number;
        normal_empty_full_width_retry_frames: number;
        atomic_node_primary_normal_requested_proposals: Array<number | null>;
        atomic_node_starting_prefix_axis_loss_gain: Array<number | null>;
        atomic_node_frames: number[];
        tail_completion_attempts: number;
        budget_allowance_frames: number | null;
        budget_remaining_before_yield: number | null;
        estimated_next_node_frames: number | null;
        axis_loss: number | null;
        local_fallback_choices: Array<{
          choice_ordinal: number;
          gap_index: number;
          remaining_gap_advance: number;
          current_relative_axis_loss_gain: number;
          conservative_deadline_margin: number;
        }>;
      }>;
      catchup_checkpoints: Array<{
        route_ordinal: number;
        route_kind: "causal_alternative";
        alternative_ordinal: number;
        gap_index: number;
        contact_advance: number;
        probe_nodes_processed: number;
        probe_frames: number;
        current_axis_loss: number;
        alternative_axis_loss: number;
        alternative_axis_loss_gain: number;
      }>;
    }>;
  };
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
  /** Number of compiler-owned startup lines emitted before the first gap. */
  handoff_start_lines?: number;
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

  /** Enumerative-proposer funnel + probe workload (optimizer/aim.ts).
   *  Non-scoring diagnostics; absent when the lane never ran. */
  aim?: {
    /** Arc-probe design used by the production aim lane. */
    probe_design: "signed3_narrow" | "signed3" | "signed3_wide";
    enum_considered: number;
    enum_no_target: number;
    enum_probe_crash: number;
    enum_model_unscoreable: number;
    enum_next_before_exit: number;
    enum_on_target: number;
    enum_gate_fail: number;
    enum_emitted: number;
    joint_probe_rows: number;
    joint_probe_frames_charged: number;
    enum_lane_bases: number;
    enum_lane_base_skips: number;
    /** Exact-pool placement of aim-lane proposals, once per pool build. */
    aimed_pool_entries: number;
    aimed_rank0: number;
    aimed_top3: number;
    aimed_rank_sum: number;
    aimed_pool_size_sum: number;
    /** Study-only telemetry; emitted only with LR_AIM_STUDY_STATS=1. */
    study?: {
      enum_projection_pairs: number;
      enum_projection_err_mean: number;
      enum_objective_gain_mean: number;
      model_impact_policy: "off" | "full" | "distilled";
      enum_model_impact_scores: number;
      enum_model_impact_grids: number;
      enum_model_impact_top1_changed: number;
      model_impact_resolution_policy: "off" | "validated-mae-top1";
      enum_model_impact_top1_advantage_mean: number;
      enum_model_impact_top1_resolution_suppressed: number;
      enum_model_impact_state_missing: number;
      enum_model_impact_mean: number;
      enum_model_impact_spread_mean: number;
      enum_model_impact_selected_rank_observations: number;
      enum_model_impact_selected_max_ordinary_rank_mean: number;
      enum_model_impact_selected_within_4: number;
      enum_model_impact_selected_within_8: number;
      enum_model_impact_selected_within_16: number;
      enum_model_impact_selected_within_32: number;
      enum_model_impact_selected_within_64: number;
      /** R3 joint-model split: rotate recruit rate, rotate-probe failures
       *  and rotated-proposal gate outcomes. */
      enum_rot_probe_crash: number;
      enum_rot_recruited: number;
      enum_rot_emitted: number;
      enum_rot_gate_fail: number;
      /** Joint short-probe telemetry: stop/suffix/full-horizon frame means and
       *  estimated saved frames per probe row. A "clean suffix" is one whose
       *  observed suffixFrame..horizonFrame window stays fully airborne. */
      joint_probe_clean_suffix: number;
      joint_probe_horizon_mean: number;
      joint_probe_suffix_mean: number;
      joint_probe_full_horizon_mean: number;
      joint_probe_saved_frames_mean: number;
      joint_probe_suffix_after_current_mean: number;
      joint_probe_suffix_after_next: number;
      joint_probe_current_ok: number;
      joint_probe_next_state_ok: number;
      joint_fit_degraded_outputs: number;
      enum_current_axes_targeted: number;
      enum_current_axes_modeled: number;
      enum_current_term_missing: number;
      rank_quality_pools: number;
      rank_quality_top3_disagree: number;
      rank_quality_top1_disagree: number;
      rank_quality_candidates_scored: number;
      rank_quality_objective_defined: number;
      rank_quality_pred_bail: number;
      rank_quality_pred_used: number;
      rank_air_pools: number;
      rank_air_cands: number;
      rank_air_pred_mean: number;
      rank_air_ask_mean: number;
      rank_air_spread_mean: number;
      rank_air_deliverable_pools: number;
      enum_air_considered: number;
      enum_air_gate_fail: number;
      enum_air_emitted: number;
    };
  };
  /** Collision-free frames advanced by the ballistic kernel. The budget is
   *  denominated in ENGINE frames, which this kernel never charges, so without
   *  this counter the volume of ballistic work is invisible. Compare against
   *  `sim_frames`: a ratio near 1 means the compile ran a full shadow flight
   *  simulation alongside its real one. */
  ballistic_micro_sim_frames?: number;
  /** Mean per-pool spread and level of each objective layer (optimizer/aim.ts).
   *  A layer can only rank if it VARIES across the pool, and the layer that
   *  varies most is the one deciding. Non-scoring diagnostics. */
  objective_layer_spread?: {
    pools: number;
    settled_spread_mean: number;
    projected_spread_mean: number;
    readiness_spread_mean: number;
    value_spread_mean: number;
    settled_level_mean: number;
    projected_level_mean: number;
    readiness_level_mean: number;
    value_level_mean: number;
  };
  /** Geometric-exit release-read funnel (core/candidate.ts). Non-scoring
   *  diagnostics; absent under LR_RANK_QUALITY=off (no read taken). */
  release_exit?: {
    release_exit_used: number;
    release_exit_fallback_no_exit: number;
    release_exit_fallback_unreadable: number;
    release_exit_airborne: number;
    release_exit_reconfirm_broken: number;
  };
  /** Short-horizon gap-fit funnel (core/candidate.ts). Non-scoring
   *  diagnostics: truncated vs full-horizon evals and frames saved. */
  gapfit_short?: {
    gapfit_truncated: number;
    gapfit_full: number;
    gapfit_frames_saved: number;
  };
  /** Forward-eval cost + agreement instrument (optimizer/handoff.ts,
   *  MEASURE-ONLY). cost: rollout sim-frames charged + call/pool counts;
   *  agreement (over POOL-SOURCE candidates only): does the true charged
   *  forward rollout (winner = max value) agree with the quality-objective
   *  rank, and about aimed candidates. Sums to be divided by counts at
   *  aggregation. Absent when forward-eval never ran (gate off). */
  fwd_eval?: {
    fwd_eval_frames_charged: number;
    fwd_eval_calls: number;
    start_eval_frames_charged: number;
    /** Rollout dead-ends (both leaf modes): recursion hit a zero-candidate node. */
    fwd_rollout_no_candidate: number;
    /** Re-draws on empty (HANDOFF_ROLLOUT_REDRAW_ON_EMPTY): first rolled contacts
     *  that expanded to nothing at the shape's own width, and the subset the extra
     *  draw refuted. `redraws - refuted` is what still lands as a dead-end verdict,
     *  so the pair reads directly against `fwd_rollout_no_candidate`. */
    fwd_rollout_redraws: number;
    fwd_rollout_redraw_refuted: number;
    /** Study-only hop-2+ redraw arm; zero in production archives. */
    fwd_rollout_later_redraws: number;
    fwd_rollout_later_redraw_refuted: number;
    fwd_pools: number;
    fwd_top1_agree: number;
    fwd_rank_of_quality_top1_sum: number;
    fwd_quality_rank_of_winner_sum: number;
    fwd_disagree_value_gap_sum: number;
    fwd_disagree_count: number;
    fwd_winner_aimed: number;
    fwd_pools_with_aimed: number;
    fwd_aimed_best_rank_sum: number;
    /** Disagreement characterization (top-1 disagree only, except agree-impact pair). */
    fwd_disagree_impact_targeted: number;
    fwd_disagree_not_impact_targeted: number;
    fwd_agree_impact_targeted: number;
    fwd_agree_not_impact_targeted: number;
    fwd_disagree_winner_aimed_q1_not: number;
    fwd_disagree_q1_aimed_winner_not: number;
    fwd_disagree_winner_costlier: number;
    fwd_disagree_winner_cheaper: number;
  };
  /** Deadline-signal instrument (optimizer/handoff.ts + optimizer/deadline.ts,
   *  MEASURE-ONLY). The live margin — remaining policy budget over estimated
   *  remaining work — chooses the PRESSURE on spend; these counters say how
   *  often it engaged and at what margin the compile ran, split at the Phase-1a
   *  consumer boundary (first completion). Present on every handoff compile:
   *  every compile builds pools and reads the margin. */
  deadline?: {
    /** Pool builds (`rankedOptions` calls) that read the margin, all callers. */
    deadline_pool_builds: number;
    /** ... before first completion, where the ramp's consumers act. Builds whose
     *  caller passed no margin are in neither phase, so the unpaced remainder is
     *  `ranked_option_calls - pre_builds - post_builds`. */
    deadline_pre_builds: number;
    /** Pre-completion builds where the ramp engaged (`pressure > 0`, i.e.
     *  margin below DEADLINE_MARGIN_NO_PRESSURE) and where it saturated
     *  (`pressure >= 1`, margin at or below DEADLINE_MARGIN_FULL_PRESSURE). */
    deadline_pre_pressured: number;
    deadline_pre_full_pressure: number;
    /** Margin distribution over pre-completion builds; mean is `sum / builds`.
     *  The minimum is null when the phase saw no finite margin. */
    deadline_pre_margin_sum: number;
    deadline_pre_margin_min: number | null;
    /** The same after first completion, where the two pool-affecting consumers
     *  are deliberately held off (Phase 1a): the margin a post-completion
     *  consumer would have seen. */
    deadline_post_builds: number;
    /** Counterfactual twins of the pre-side pair: how often the ramp WOULD have
     *  engaged / saturated post-completion. The live pressure there is 0 by the
     *  phase gate, not by the margin, so these are computed from the margin with
     *  the same `deadlinePressure` anchors and are directly comparable to
     *  `deadline_pre_pressured` / `deadline_pre_full_pressure`. */
    deadline_post_pressured: number;
    deadline_post_full_pressure: number;
    deadline_post_margin_sum: number;
    deadline_post_margin_min: number | null;
    /** SUBSEQUENT-TERMINAL CHURN (not a phase-flip window — that reading was
     *  falsified 4,406/4,406 on 2026-08-04). Terminal (structurally complete)
     *  traversals offered to the register, and how many did NOT improve it.
     *  The FIRST terminal always improves by construction (`contract_passed`
     *  ranks first in register.consider and terminals pass the contract), so
     *  the two frames below coincide on every measured compile; the counter
     *  reads as "how much post-completion budget re-derives a non-improvement"
     *  — a repair-ROI number. Both frames are null when the compile never
     *  reached a terminal. See docs/forward-eval-metrics.md. */
    deadline_terminal_considers: number;
    deadline_terminal_without_improvement: number;
    deadline_first_terminal_frame: number | null;
    deadline_first_improving_terminal_frame: number | null;
  };
  /** Aim-proposer fits in the final returned track; not all search selections. */
  handoff_aimed_selected?: number;
  /**
   * Study-only final-path join for repair auxiliary fits.  `emission` contains
   * only quantities already computed at candidate admission; final gap reports
   * are attached after the returned track has been scored.  Never read by the
   * compiler.
   */
  handoff_repair_aux_selected_certificates?: Array<{
    selected_gap_index: number;
    emission: {
      schema: "line.handoff.repair-aux-study-certificate.v1";
      gapIndex: number;
      nextGapIndex: number;
      admission: "impact-speed-pareto" | "impact-speed-air-outgoing-pareto";
      currentTargets: AxisValues;
      nextTargets: AxisValues;
      base: {
        achieved: AxisValues;
        currentSse: number;
        projectedOutgoingQuality: number | null;
      };
      candidate: {
        achieved: AxisValues;
        currentSse: number;
        projectedOutgoingQuality: number | null;
      };
    };
    final_current_gap: GapAxisReport | null;
    final_next_gap: GapAxisReport | null;
  }>;
  /**
   * End-to-end validation on the transitions selected into this output.
   * Prediction comes from the preceding fit's canonical ballistic launch;
   * truth is the next committed fit's exact scorer-window measurement.
   * This validates ballistic projection only. Selected fits are not the
   * counterfactual proposal population required to validate readiness.
   */
  ballistic_selected_transitions?: {
    eligible: number;
    projected: number;
    unprojectable: number;
    speed: BallisticPredictionErrorSummary;
    air: BallisticPredictionErrorSummary;
    elevation: BallisticPredictionErrorSummary;
  };

  /** Target-state placement counters. Non-scoring diagnostics. */
  arc_placement?: {
    mode: ArcPlacementMode;
    /** Default-off geometry command calibration; authored/scored targets stay unchanged. */
    impact_command_law: "off" | "inverse-baseline";
    impact_command_adjusted: number;
    impact_command_target_sum: number;
    impact_command_value_sum: number;
    impact_next_command_adjusted: number;
    impact_next_target_sum: number;
    impact_next_value_sum: number;
    /** Default-off native ride-out floor sized to the scorer impact window. */
    impact_support_window_law?: "full";
    /** Geometry attempts with an authored impact target while the law is active. */
    impact_support_window_attempts?: number;
    /** Eligible attempts whose post-contact support was actually lengthened. */
    impact_support_window_extended?: number;
    /** Aggregate added post-contact support length over extended attempts. */
    impact_support_window_added_px_sum?: number;
    /** Default-off extra post-contact subdivision in the frozen atlas band. */
    impact_segment_atlas_window_law?: "fixed";
    impact_segment_atlas_window_attempts?: number;
    impact_segment_atlas_window_extra_segments?: number;
    /** Default-off generic curve resolution from the trajectory geometry contract. */
    normal_post_curve_resolution_law?:
      | "tolerance"
      | "tolerance-additive"
      | "tolerance-native-span";
    normal_post_curve_resolution_attempts?: number;
    normal_post_curve_resolution_refined?: number;
    normal_post_curve_resolution_added_segments?: number;
    /** Refined siblings charged through the exact current-gap evaluator. */
    normal_post_curve_resolution_siblings_evaluated?: number;
    /** Exact no-axis-debt siblings admitted beside their nominal parent. */
    normal_post_curve_resolution_siblings_admitted?: number;
    /** Default-off active-material study. Omitted from ordinary compiles. */
    impact_active_carrier_law?:
      | "window-quarter"
      | "window-accel-pressure"
      | "window-accel-laminate-pressure"
      | "window-accel-laminate-additive-pressure"
      | "contact-segment-accel-pressure"
      | "contact-segment-additive-pressure"
      | "post-capture-accel-pressure";
    /** Normal post-contact attempts placed in the reserved active-material lane. */
    impact_active_carrier_attempts?: number;
    /** Coincident post-contact segments converted to forward acceleration. */
    impact_active_carrier_lines?: number;
    /** Acceleration lines retained in the final best-so-far track. */
    impact_active_carrier_final_lines?: number;
    /** Fixed direct-retention geometry x material interaction study. */
    impact_carrier_ripple_law?: "active-half";
    impact_carrier_ripple_attempts?: number;
    impact_carrier_ripple_lines?: number;
    impact_carrier_ripple_final_lines?: number;
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

  /** Default-off passive capture–redirect–release proposal telemetry. */
  contact_transition?: {
    eligible_pools: number;
    suppressed_by_chicane_room: number;
    suppressed_by_existing_delivery: number;
    offered: number;
    constructed: number;
    construction_failed: number;
    exact_attempts: number;
    exact_rejected: number;
    contact_achieved: number;
    delivery_not_improved: number;
    staged_state_available: number;
    staged_return_constructed: number;
    staged_outbound_collision: number;
    staged_return_collision: number;
    staged_both_collisions: number;
    staged_objective_defined: number;
    staged_settled_quality_sum: number;
    staged_projected_quality_sum: number;
    staged_readiness_sum: number;
    staged_catchability_sum: number;
    staged_speed_fit_sum: number;
    staged_air_fit_sum: number;
    staged_impact_feasibility_sum: number;
    staged_elevation_fit_sum: number;
    staged_objective_sum: number;
    staged_incumbent_objective_sum: number;
    active_pulse_segments_constructed: number;
    active_pulse_candidates_admitted: number;
    active_pulse_final_lines: number;
    release_observed: number;
    airborne_release: number;
    selected_for_branch: number;
    selected_negative_orientation: number;
    selected_positive_orientation: number;
    pool_entries: number;
    pool_rank0: number;
    pool_top3: number;
    pool_rank_sum: number;
    pool_size_sum: number;
    achieved_impact_sum: number;
    target_impact_sum: number;
  };

  /** Default-off repair-only branch insurance for a same-speed impact specialist. */
  impact_repair_insurance?: {
    eligible_pools: number;
    specialist_available: number;
    specialist_already_selected: number;
    specialist_inserted: number;
    final_selected: number;
    suppressed_by_reserved_branch: number;
    impact_error_gain_sum: number;
    speed_error_delta_sum: number;
    displaced_score_delta_sum: number;
  };

  /** Study arm: branch ordering at the independently selected repair target. */
  repair_target_search?: {
    policy:
      | "target_top_three_first"
      | "target_improvement_first"
      | "target_eligible_first";
    target_pools: number;
    eligible_options: number;
    ordinary_selected_options: number;
    already_first: number;
    reordered: number;
    promoted_from_outside_top_three: number;
    ordinary_first_improves_incumbent: number;
    ordinary_first_not_improving: number;
    improving_alternative_available: number;
    ordinary_first_sse_sum: number;
    chosen_first_sse_sum: number;
    local_sse_gain_sum: number;
    forward_score_debt_sum: number;
  };

  /** Default-off exact or learned screen for a locally better impact branch. */
  impact_response_admission?: {
    eligible_pools: number;
    prefiltered_candidates: number;
    response_probes: number;
    response_probe_frames: number;
    safe_candidates: number;
    already_admitted: number;
    inserted: number;
    branch_reserved: number;
    final_selected: number;
    impact_error_gain_sum: number;
    settled_quality_gain_sum: number;
    model_candidates_scored: number;
    model_candidates_admitted: number;
    contact_retention_rejects: number;
    active_repair_probes: number;
    active_repair_probe_frames: number;
    active_repair_viable: number;
    active_repair_interaction_passed: number;
    active_repair_material_lines: number;
    active_repair_final_lines: number;
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
  /** Maximum achievable value of this axis at this gap, in the same [0,1] units —
   *  the physical ceiling given the rider's state here. Currently populated for
   *  `elevation` (the speed-supported climb ceiling): a target above `ceiling`
   *  asked for more than physics allowed at this gap, so the shortfall is expected,
   *  not a compiler miss. Absent for axes without a meaningful per-gap ceiling. */
  ceiling?: number;
  /** Static planning estimate for the hardest target likely to fit around this
   *  beat. Unlike `ceiling`, this is derived from authored neighboring gaps and
   *  speed rather than the achieved rider state. It is diagnostic only and must
   *  never replace the authored target. */
  feasibility_bound?: number;
  /** Raw diagnostic units for axes whose authored scale hides physical units. */
  raw?: {
    unit: "px/frame" | "px";
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
  /**
   * End frame (inclusive). For a contact gap this is the authored contact
   * frame; for the tail gap it is endOfSpec.
   */
  endFrame: number;
  /** True iff this gap's end is a hard Contact (false for tail gap). */
  endsWithContact: boolean;
  /** Per-axis targets sampled for this gap. */
  targets: AxisValues;
  /** Authored impact target of the NEXT contact (the beat this gap's launch
   *  flies toward), resolved by the compiler alongside `targets.impact`.
   *  Lets generation plan the ARRIVAL into a hard beat (launch steeper so the
   *  crossing angle carries the redirection budget). Undefined when the next
   *  beat has no authored impact. */
  nextImpact?: number;
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

/**
 * Elevation axis model (relative climb-effort). At a given entering speed and gap
 * length there is an achievable vertical-velocity *band*; the authored elevation
 * [0,1] is resolved against THAT band, so the meaning is speed-relative:
 *   1.0 = climb as steeply as the current speed safely allows (apex-at-next-beat,
 *         capped by a stall/reach margin),
 *   0.5 = level (net-zero altitude over the gap),
 *   0.0 = dive as steeply as the band allows.
 *
 * Two things that surprise authors, both honest consequences of gravity:
 *
 *  - **0.5 (level) is NOT "do nothing".** Between beats the rider is always
 *    falling, so net-zero altitude needs an active *upward* launch to cancel the
 *    drop. "Release and let gravity work" (free fall) lands around ~0.33, not 0.5.
 *
 *  - **The two halves are physically asymmetric**, even though each maps to a
 *    [0,0.5] span of the axis. Climb (0.5→1) fights gravity and is tightly
 *    speed-capped, so it covers a *small* altitude range; plunge (0.5→0) has
 *    gravity helping, so it covers a *much larger* range (typically several× the
 *    climb range). Concretely on a ~0.5s gap at mid speed: 0.5→1 ≈ a few tens of
 *    px up, while 0.5→0 ≈ a few hundred px down. So 0.5→~0.33 is the gentle "ease
 *    off into a fall" zone, and ~0.33→0 is an *active* dive steeper than free
 *    fall. The band normalizes each side to a half so authoring *feels* uniform;
 *    the underlying physics is not (down is the free direction). Plunge is
 *    currently capped *symmetrically* with climb (same `VERTICAL_FRACTION` /
 *    apex cap) for catchability — it could be opened up for a more violent
 *    nosedive if a spec ever wants it.
 *
 * Both the launch generator (`arc_placement`) and the achieved measurement
 * (`core/measure`) resolve against this same band so they agree. Up is −y.
 */
export const ELEVATION = {
  /** Gravity model (px/frame²). Matches the launch model in `arc_placement` so the
   *  generator and the measurement share one band. */
  GRAVITY_PX_PER_FRAME2: 0.175,
  /** Cap on |vy| as a fraction of total speed: the stall/reach margin that keeps
   *  enough horizontal speed to carry the rider to the next catch. Conservative —
   *  climbing bleeds speed across gaps, so over-committing vertical stalls the ride. */
  VERTICAL_FRACTION: 0.5,
  /** Fraction of the per-gap *apex* climb (the kinematic max a single isolated gap
   *  could net) that the compiler can realistically deliver. The apex is optimistic
   *  because sustained climbing bleeds speed across gaps and the multi-gap forward
   *  search avoids speed-stranding climbs — so on the elevation benchmark, climb
   *  tops out around ~0.6–0.65 on the axis scale regardless of how hard it's asked.
   *  Used only for the reported `ceiling` diagnostic (never scored), to tell an
   *  author "the realistic best climb here" vs the unreachable apex. Empirical,
   *  grain-cap style — calibrate against study_elevation.ts, not intuition. */
  ACHIEVABLE_CLIMB_FRACTION: 0.3,
} as const;

export type ElevationBand = {
  /** Launch vy (px/frame, up = −) for the steepest safe climb. */
  vyClimb: number;
  /** Launch vy for net-zero altitude (the symmetric arc). */
  vyLevel: number;
  /** Launch vy for the steepest plunge. */
  vyPlunge: number;
  g: number;
  frames: number;
};

/** Achievable vertical-velocity band for a gap of `frames` at entering `speedPx`. */
export function elevationBand(speedPx: number, frames: number): ElevationBand {
  const g = ELEVATION.GRAVITY_PX_PER_FRAME2;
  const N = Math.max(1, frames);
  const cap = Math.min(g * N, ELEVATION.VERTICAL_FRACTION * Math.max(1, speedPx));
  return { vyClimb: -cap, vyLevel: -0.5 * g * N, vyPlunge: cap, g, frames: N };
}

/** Authored elevation [0,1] → launch vy (px/frame, up = −), resolved against the band. */
export function elevationToLaunchVy(elevation: number, speedPx: number, frames: number): number {
  const b = elevationBand(speedPx, frames);
  const e = Math.max(0, Math.min(1, elevation));
  const t = Math.abs(e - 0.5) / 0.5;
  return e >= 0.5
    ? b.vyLevel + (b.vyClimb - b.vyLevel) * t
    : b.vyLevel + (b.vyPlunge - b.vyLevel) * t;
}

/**
 * Net vertical displacement Δy (px, down = +) over a gap → achieved elevation
 * [0,1], normalized against the same band. Level (Δy=0) anchors at 0.5; the band's
 * steepest climb maps to 1.0, steepest plunge to 0.0. In the genuinely-too-slow
 * regime (can't reach level) the climb side compresses below 0.5 — honest signal.
 */
export function netDyToElevation(dy: number, speedPx: number, frames: number): number {
  const b = elevationBand(speedPx, frames);
  const sag = 0.5 * b.g * b.frames * b.frames;
  const dyClimb = b.vyClimb * b.frames + sag; // most-up the band allows (usually < 0)
  const dyPlunge = b.vyPlunge * b.frames + sag; // most-down (> 0)
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  if (dy <= 0) {
    const denom = dyClimb < 0 ? dyClimb : -1;
    return clamp01(0.5 + 0.5 * (dy / denom));
  }
  const denom = dyPlunge > 0 ? dyPlunge : 1;
  return clamp01(0.5 - 0.5 * (dy / denom));
}

/**
 * Realistically-achievable elevation (normalized [0,1]) for a gap at the given
 * entering speed — the honest "best climb you can expect here". NOT the band's
 * apex (which is tautologically ~1.0): the apex is a single-gap kinematic max the
 * compiler can't sustain, so this discounts it by `ACHIEVABLE_CLIMB_FRACTION`
 * (empirically ≈ the benchmark's observed climb cap). Drops below 0.5 only when
 * the rider is genuinely too slow to climb. Report-only; never scored.
 * `target > ceiling` ⇒ the shortfall is physics, not an optimizer miss.
 */
export function elevationCeiling(speedPx: number, frames: number): number {
  const b = elevationBand(speedPx, frames);
  const sag = 0.5 * b.g * b.frames * b.frames;
  const dyApex = b.vyClimb * b.frames + sag; // optimistic single-gap kinematic climb
  const dyAchievable = ELEVATION.ACHIEVABLE_CLIMB_FRACTION * dyApex;
  return netDyToElevation(dyAchievable, speedPx, frames);
}

/** Maximum RELIABLE CoM turn (rad) the engine can deliver within the impact window —
 *  MEASURED by the catchability atlas (study_catchability_atlas.ts, 2026-07-31):
 *  ceiling(speed) ≈ speed × 1.0 rad within ±6% across the SPEED_RULER envelope
 *  (flat-slam frontier at normal closing ≈ 6–7 px/f; scoop frontier at centripetal
 *  ≈ 3 px/f²; ≥80% catch across pose phases). Replaces the inherited 0.9-fraction
 *  guess (asin(0.9) ≈ 1.12 rad). Revalidated: 0 of ~13k real landings exceed it.
 *
 *  Hoisted out of the `IMPACT` literal so `CATCHABLE_REDIR_FRACTION` can DERIVE from
 *  it: the two are one bound in two forms, and a retune must move both together.
 *  Must stay in (0, π/2] — `asin(sin(x)) === x` only holds there, and every aim clamp
 *  recovers the turn that way (asserted below). */
const MAX_RELIABLE_TURN_RAD = 1.0;
if (!(MAX_RELIABLE_TURN_RAD > 0) || MAX_RELIABLE_TURN_RAD > Math.PI / 2) {
  // Beyond π/2 the sin() round-trip folds back (asin(sin(2.0)) = 1.14), so the aim
  // clamps would silently disagree with impactCeiling/impactFeasibilityBound.
  throw new Error(`IMPACT.MAX_RELIABLE_TURN_RAD must be in (0, π/2]; got ${MAX_RELIABLE_TURN_RAD}`);
}

/**
 * Landing-impact model (absolute, speed-bounded). Impact is the rider's **redirection
 * impulse** `cArc = Σ v̄·|Δθ|` — per-frame CoM heading change × midpoint speed,
 * accumulated over CONTACTED frames of the `IMPACT_WINDOW` episode after touchdown
 * (how hard the ground bends the path; airborne bending — gravity — never counts),
 * mapped to felt [0,1] by `normImpact` (`IMPACT_RULER.SOFT`/`VERY_STRONG`). Scored by
 * `contactRedirArcPxAtLanding` (substrate.ts); promoted 2026-07-31 over the net-form
 * `redirArc = v·Δθ` (divergence-label adjudication + felt-rank edge — see
 * `docs/impact_definition.md`).
 *
 * The achievable impact is bounded ABOVE by speed: the reliable in-window turn is
 * capped (`IMPACT.MAX_RELIABLE_TURN_RAD`, atlas-measured), and beyond it the hit
 * ejects (the catch fails). `impactCeiling` reports that honest per-beat bound so
 * a target above it reads as physics, not an optimizer miss.
 */
export const IMPACT = {
  /** See `MAX_RELIABLE_TURN_RAD` above — the atlas-measured reliable in-window turn (rad).
   *  Consumed directly by `impactCeiling` and `impactFeasibilityBound`. */
  MAX_RELIABLE_TURN_RAD,
  /** = sin(MAX_RELIABLE_TURN_RAD) — DERIVED, never hand-written. The same bound
   *  expressed as a redirection FRACTION, because the aim/feasibility clamps and the
   *  sealed `PostimpactImpactConvention` consume it as `asin(fraction)` — keeping the
   *  fraction form means every consumer and frozen fixture keeps its shape while the
   *  effective clamp is exactly the measured turn. Deriving it (rather than pinning the
   *  literal `Math.sin(1.0)`) is what keeps `asin(CATCHABLE_REDIR_FRACTION) ===
   *  MAX_RELIABLE_TURN_RAD` true through a future retune — the invariant
   *  tests/v0_impact.test.ts pins and the six aim clamps depend on. */
  CATCHABLE_REDIR_FRACTION: Math.sin(MAX_RELIABLE_TURN_RAD),
  /** [LEGACY — NOT SCORED] catchable fraction for the OLD one-frame normal-closing
   *  metric. Kept only for `calibrate_impact.ts` (the point-baseline study tool).
   *  The scored impact uses CATCHABLE_REDIR_FRACTION above — don't tune this one. */
  CATCHABLE_NORMAL_FRACTION: 0.6,
} as const;

/** Window (frames, ~0.15s at FPS=40) over which the redirection impact is measured.
 *  The felt redirection episode; label-validated (study_impact_labels.ts: the felt
 *  match peaks at W≈6). Canonical home; impact_support re-exports it. */
export const IMPACT_WINDOW = 6;

/**
 * Felt impact scale (PROMOTED 2026-07-31, user decision): impact = the **redirection
 * impulse** `cArc = Σ v̄·|Δθ|` accumulated over CONTACTED frames of the IMPACT_WINDOW
 * episode (`contactRedirArcPxAtLanding`, substrate.ts), mapped affine to [0,1] so
 * 0 = a perfectly smooth catch (zero path bending) and 1 = "very strong". Successor
 * to the 2026-06-14 net-form `redirArc = v·Δθ` lock — same anchors structure, same
 * window; the accumulated contacted-only form won the divergence-label adjudication
 * and never cancels on bend-then-unbend contacts. History + calibration:
 * docs/impact_definition.md.
 */
/** Calibration anchors are env-tunable so they can be A/B'd without a recompile
 *  (LR_IMPACT_SOFT / LR_IMPACT_VSTRONG). Defaults = the shipped values. */
/** Parse a numeric env knob (`name`), falling back to `dflt` when unset, empty,
 *  or non-finite. Shared single source of truth for env-tunable float knobs. */
export function impactEnvNum(name: string, dflt: number): number {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
  if (raw === undefined || raw === "") return dflt;
  const n = Number(raw);
  return Number.isFinite(n) ? n : dflt;
}
export const IMPACT_RULER = {
  /** Raw scored impulse (px/frame) at a felt "soft" landing → impact 0. SOFT = 0:
   *  the PHYSICAL floor — zero
   *  redirection is zero impact. Derived 2026-06-15: the achievable-range fit wanted SOFT < 0
   *  (unphysical), so it's floored at 0; a non-redirecting catch reads 0. Env-overridable for study. */
  SOFT: impactEnvNum("LR_IMPACT_SOFT", 0),
  /** Scored-impulse px/frame at a felt "very strong" landing → impact 1. VSTRONG = 7.55
   *  (2026-07-31, the cArc promotion): the combined-corpus compatibility optimum V* —
   *  equal-weight over the canonical V2 inventory (12,168 landings, V* 7.45) and the
   *  production/labeled corpus (937 landings, V* 7.85) — inside a FLAT valley [7.3, 7.9]
   *  (mean meaning-shift ≤ 0.05 anywhere in it, so existing authored specs keep their
   *  meaning with NO migration), mid-CI of the felt "very strong" [6.4, 13.4], and
   *  deliberately BELOW the atlas physics top (~11.3): [0,1] is the felt/compatibility
   *  scale; physical headroom above it saturates. Linear map (isotonic-vs-linear found
   *  no defensible curvature). See docs/impact_definition.md Calibration. */
  VERY_STRONG: impactEnvNum("LR_IMPACT_VSTRONG", 7.55),
} as const;
// Fail fast on a degenerate env-set anchor pair: a non-positive span makes
// normImpact divide by zero (silently clamped to 0/1) or, when SOFT > VERY_STRONG,
// inverts the scored impact axis — both silently corrupt the headline.
if (!(IMPACT_RULER.VERY_STRONG > IMPACT_RULER.SOFT)) {
  throw new Error(
    `Invalid impact anchors: LR_IMPACT_VSTRONG (${IMPACT_RULER.VERY_STRONG}) must be > ` +
      `LR_IMPACT_SOFT (${IMPACT_RULER.SOFT}); a non-positive span corrupts the scored impact axis.`,
  );
}
/**
 * Stable identity carried by production preview payloads. Bump `version` only
 * when the raw measurement or normalization contract changes.
 */
export const IMPACT_METRIC = Object.freeze({
  id: "contact-redirection-impulse",
  version: 1,
  rawUnit: "px/frame",
  windowFrames: IMPACT_WINDOW,
  soft: IMPACT_RULER.SOFT,
  veryStrong: IMPACT_RULER.VERY_STRONG,
});

/** Raw scored contact-redirection impulse (px/frame) → felt impact [0,1]. */
export function normImpact(rawImpactPx: number): number {
  return Math.max(
    0,
    Math.min(
      1,
      (rawImpactPx - IMPACT_RULER.SOFT) /
        (IMPACT_RULER.VERY_STRONG - IMPACT_RULER.SOFT),
    ),
  );
}
/** Inverse: raw scored impulse (px/frame) requested by authored impact [0,1]. */
export function impactToRawPx(impact: number): number {
  return IMPACT_RULER.SOFT + Math.max(0, Math.min(1, impact)) *
    (IMPACT_RULER.VERY_STRONG - IMPACT_RULER.SOFT);
}
/** Wrap an angle (radians) to (−π, π]. Canonical home (the scored impact's per-frame
 *  heading-change terms and the study harnesses' turnNetDeg share this definition). */
export const wrapPi = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Maximum catchable normalized impact [0,1] at the given entering speed (px/frame).
 * `target > impactCeiling(speed)` ⇒ the shortfall is physics (too slow to redirect at all,
 * or the hit would eject), not a compiler miss. Max reliable impulse = entering speed ×
 * `IMPACT.MAX_RELIABLE_TURN_RAD` (the atlas-measured window-turn bound).
 */
export function impactCeiling(speedPx: number): number {
  return normImpact(Math.max(0, speedPx) * IMPACT.MAX_RELIABLE_TURN_RAD); // atlas: ceil(s) ≈ s × 1.0 rad
}

export const CALIB = {
  /** Divisor for `grain` axis. units. */
  LINE_LENGTH_CAP: 49,
  /** [LEGACY — NOT SCORED as of 2026-06-14] Cap for the OLD perpendicular `redir`
   *  metric (v·sin Δθ). The scored impact is the contacted-frame impulse on the felt
   *  `IMPACT_RULER` scale. Kept only for explicit analysis comparisons. */
  REDIR_CAP: 8.5,
  /** [LEGACY — NOT SCORED] Divisor for the OLD one-frame normal-closing impact
   *  ("point"). Do not tune this for scoring; it is retained only for explicit
   *  analysis comparisons. */
  IMPACT_CAP: 5,
  /** Divisor for `amplitude` axis: peak upward chord-relative sagitta (px) that
   *  maps to a normalized amplitude of 1.0. Provisional — calibrate against the
   *  achieved envelope on a soaring-arc probe spec, the same way grain's cap was
   *  set. */
  AMPLITUDE_CAP: 60,
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
