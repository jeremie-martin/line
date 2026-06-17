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
   * "claquage"), absolute [0, 1] on a FELT scale: **0 = soft, 1 = very strong**.
   * Defined as the rider's **velocity REDIRECTION ARC** `redirArc = v·Δθ` (incoming
   * CoM speed × net heading change over the `IMPACT_WINDOW`-frame (~0.15s) episode after
   * contact), mapped to [0,1] by `normImpact` (the felt scale: redirArc ≈ 2.0 px/frame →
   * soft → 0; ≈ 6.5 px/frame → very strong → 1; gentler clamps to 0, harder to 1).
   * Anchored to the user's felt labels (LOCKED 2026-06-14, docs/impact_problem_statement.md).
   *
   * Why the redirection arc (not perpendicular `redir = v·sinΔθ`, nor normal closing,
   * nor body force): the felt hit is the surface *redirecting* the rider's path at speed;
   * `v·Δθ` keeps the speed weighting with no sin-compression of the biggest slams, beats
   * `redir`/`turn` and generalizes across tracks (incl. flat-drop slams), and stays
   * CoM-velocity-only so it's immune to sled rotation / limb whip (which look violent but
   * aren't felt). Decelerating *along* the path (a glide slowing on a curved arc) builds
   * no Δθ → reads ~0. See `docs/impact_problem_statement.md`.
   *
   * Authored on the beat (NOT an axis): impact is an adjective on a discrete landing
   * event, where the axes (air/speed/elevation/amplitude) are continuous fields over
   * the span *between* beats. Internally it is resolved into the terminating gap's
   * target bag so it reuses the per-gap axis measurement/report plumbing (each contact
   * gap ends in exactly one beat, so per-gap scalar ≡ per-beat value).
   *
   * Status: SCORED (folds into the contract `axis_quality`). Measured by
   * `redirArcPxAtLanding` (substrate.ts) → `normImpact`; reported with target/achieved/
   * error/ceiling. The compiler steers toward it via the arc-placement redir lever
   * (target → needed CoM turn = impactToRedirArcPx(target)/speed) and candidate ranking.
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
 *   - `impact`        — landing intensity at a beat: the rider's velocity
 *                       REDIRECTION ARC `redirArc = v·Δθ` over the `IMPACT_WINDOW`-frame
 *                       episode after contact, felt-normalized via `normImpact` [0, 1]
 *                       (0 = soft, 1 = very strong). NOT
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

  /** Enumerative-proposer funnel + prediction accuracy (optimizer/aim.ts).
   *  Non-scoring diagnostics; absent when the lane never ran. */
  aim?: {
	    /** Arc-probe design used (LR_AIM_JOINT_PROBE_DESIGN, default "cross5"). */
	    probe_design: "cross5" | "grid9" | "pitch3";
	    /** Joint arc-probe horizon mode (LR_AIM_PROBE_MODE, default "short"). */
	    probe_mode: "short" | "full";
	    /** Short-probe fit model space (LR_AIM_MODEL_SPACE, default "latent"). */
	    model_space: "latent" | "direct";
	    enum_considered: number;
	    enum_no_target: number;
	    enum_probe_crash: number;
	    enum_model_unscoreable: number;
	    enum_next_before_exit: number;
	    enum_on_target: number;
    enum_gate_fail: number;
    enum_emitted: number;
    enum_readiness_err_mean: number;
    enum_readiness_gain_mean: number;
    /** R3 joint-model split: rotate recruit rate, rotate-probe failures
     *  and rotated-proposal gate outcomes. */
    enum_rot_probe_crash: number;
    enum_rot_recruited: number;
    enum_rot_emitted: number;
    enum_rot_gate_fail: number;
    /** Selection-rank telemetry: proposals' position in the cost-sorted
     *  pool they entered, per pool build. rank0 = pool best; top3 = rank<3.
     *  Counts/sums (the lab derives means). */
    aimed_pool_entries: number;
    aimed_rank0: number;
    aimed_top3: number;
    aimed_rank_sum: number;
    aimed_pool_size_sum: number;
    /** Joint short-probe telemetry: stop/suffix/full-horizon frame means and
     *  estimated saved frames per probe row. A "clean suffix" is one whose
     *  observed suffixFrame..horizonFrame window stays fully airborne. */
    joint_probe_rows: number;
    joint_probe_clean_suffix: number;
    joint_probe_horizon_mean: number;
	    joint_probe_suffix_mean: number;
	    joint_probe_full_horizon_mean: number;
	    joint_probe_saved_frames_mean: number;
	    joint_probe_suffix_after_current_mean: number;
	    joint_probe_suffix_after_next: number;
	    joint_probe_launch_read_frames_mean: number;
	    joint_probe_current_ok: number;
	    joint_probe_next_state_ok: number;
	    joint_probe_frames_charged: number;
	    joint_fit_degraded_outputs: number;
	    enum_current_axes_targeted: number;
	    enum_current_axes_modeled: number;
	    enum_current_term_missing: number;
	  };
  /** Geometric-exit release-read funnel (core/candidate.ts). Non-scoring
   *  diagnostics; absent under LR_RANK_QUALITY=off (no read taken). */
  release_exit?: {
    release_exit_used: number;
    release_exit_fallback_no_exit: number;
    release_exit_fallback_next_contact: number;
    release_exit_fallback_unreadable: number;
    release_exit_airborne: number;
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
    /** Dead-rider proof (full-leaf path only). reports = all full-leaf detections;
     *  dead_uncovered = those whose terminus is a non-endOfSpec death past the last
     *  committed contact (the uncovered span the objective leaf's missed-penalty would
     *  otherwise have to cover). Read from a default-mode run; expect ≈0. */
    fwd_leaf_reports: number;
    fwd_leaf_dead_uncovered: number;
    fwd_pools: number;
    fwd_top1_agree: number;
    fwd_rank_of_quality_top1_sum: number;
    fwd_quality_rank_of_winner_sum: number;
    fwd_disagree_value_gap_sum: number;
    fwd_disagree_count: number;
    fwd_winner_aimed: number;
    fwd_pools_with_aimed: number;
    fwd_aimed_best_rank_sum: number;
    /** Forward winner's quality-rank, bucketed [0,1,2,3,4,5,6-8,9+] (8 cells). */
    fwd_winner_quality_rank_hist: number[];
    /** Quality-#1's forward-rank, same buckets (8 cells). */
    fwd_quality_top1_fwd_rank_hist: number[];
    /** Disagreement characterization (top-1 disagree only, except agree-impact pair). */
    fwd_disagree_impact_targeted: number;
    fwd_disagree_not_impact_targeted: number;
    fwd_agree_impact_targeted: number;
    fwd_agree_not_impact_targeted: number;
    fwd_disagree_winner_aimed_q1_not: number;
    fwd_disagree_q1_aimed_winner_not: number;
    /** Disagreement value-gap, bucketed [0-2,2-5,5-10,10-20,20-50,50+] (6 cells). */
    fwd_disagree_value_gap_hist: number[];
    fwd_disagree_winner_costlier: number;
    fwd_disagree_winner_cheaper: number;
  };
  /** Committed fits in this output produced by the proposer. */
  handoff_aimed_selected?: number;
  /** Readiness v0 (optimizer/readiness.ts, READINESS_ROADMAP R1, telemetry
   *  only): realized-arrival catchability per committed contact gap (null
   *  for non-contact/uncommitted), joinable with report gap outcomes by
   *  index; plus mean/min summaries. Consumed by no decision. */
  readiness_per_gap?: (number | null)[];
  readiness_mean?: number | null;
  readiness_min?: number | null;

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
    /** Per-restart detail; present only under LR_REPAIR_LOG (heavy — gated to keep archives lean). */
    records?: Array<{
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
  /** Maximum achievable value of this axis at this gap, in the same [0,1] units —
   *  the physical ceiling given the rider's state here. Currently populated for
   *  `elevation` (the speed-supported climb ceiling): a target above `ceiling`
   *  asked for more than physics allowed at this gap, so the shortfall is expected,
   *  not a compiler miss. Absent for axes without a meaningful per-gap ceiling. */
  ceiling?: number;
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
  /** Bounded impact target of the NEXT contact (the beat this gap's launch
   *  flies toward), resolved by the compiler alongside `targets.impact`.
   *  Lets generation plan the ARRIVAL into a hard beat (launch steeper so the
   *  crossing angle carries the redirection budget). Undefined when the next
   *  beat has no authored impact. */
  nextImpact?: number;
  /** Re-aimed per-axis targets, computed up front by the global planning pre-pass
   *  (optimizer/planning.ts). When set, GENERATION and the ranking OBJECTIVE aim at
   *  these via `aimTargets(gap)` instead of `targets`; the official scorer and the
   *  scorer-mirroring local `axisCost` ALWAYS use `targets`/`gapAxisTargets`. Unset
   *  (the default) ⇒ `aimTargets()` falls back to `targets` ⇒ byte-identical to the
   *  no-planning compiler. See docs/planning-campaign.md. */
  plannedTargets?: AxisValues;
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

/**
 * Landing-impact model (absolute, speed-bounded). Impact is the rider's **velocity
 * REDIRECTION ARC** `redirArc = v·Δθ` — incoming CoM speed × net heading change over the
 * `IMPACT_WINDOW`-frame episode after contact (how hard the catch bends the path), mapped
 * to felt [0,1] by `normImpact` (`REDIRARC.SOFT`/`VERY_STRONG`). See `redirArcPxAtLanding`
 * (substrate.ts) and `docs/impact_problem_statement.md`.
 *
 * The achievable impact is bounded ABOVE by speed: the turn a catch can deliver is
 * capped, and beyond the catchable ceiling a hard hit ejects (the catch fails).
 * `impactCeiling` reports that honest per-beat bound so
 * a target above it reads as physics, not an optimizer miss. PROVISIONAL — recalibrate
 * against `study_impact_calibrate.ts` / `specs/probe_impact.ts`.
 */
export const IMPACT = {
  /** Catchability cap, consumed as `asin(CATCHABLE_REDIR_FRACTION)` = the maximum
   *  *catchable* CoM turn angle (≈64° at 0.9): beyond this the landing ejects and fails
   *  the contact. Used by `impactCeiling`/`impactFeasibilityBound` (and the arc-placement
   *  redir lever's turn clamp) under the redirArc = v·Δθ metric. Provisional. */
  CATCHABLE_REDIR_FRACTION: 0.9,
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
 * Felt impact scale (LOCKED 2026-06-14, user decision): impact = velocity-redirection ARC
 * `redirArc = v·Δθ` (incoming CoM speed px/frame × net heading change over IMPACT_WINDOW,
 * radians), mapped affine to [0,1] so 0 = a "soft" landing and 1 = "very strong". Anchors
 * from the user's felt labels (docs/impact_problem_statement.md): soft ≈ 2.0 px/frame,
 * very strong ≈ 6.5 px/frame. Gentler-than-soft clamps to 0; harder-than-very-strong to 1.
 * Provisional end anchors (thin soft/very-strong label data) — structure is fixed.
 */
/** Calibration anchors are env-tunable so they can be A/B'd without a recompile
 *  (LR_IMPACT_SOFT / LR_IMPACT_VSTRONG). Defaults = the shipped values. The user's felt
 *  labels (54 beats, docs/impact_problem_statement.md) put soft ≈ 2.8–2.9 and very-strong
 *  ≈ 6.5 px/frame; the shipped SOFT=2.0 sits below the felt soft and is under review. */
/** Parse a numeric env knob (`name`), falling back to `dflt` when unset, empty,
 *  or non-finite. Shared single source of truth for env-tunable float knobs. */
export function impactEnvNum(name: string, dflt: number): number {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
  if (raw === undefined || raw === "") return dflt;
  const n = Number(raw);
  return Number.isFinite(n) ? n : dflt;
}
export const REDIRARC = {
  /** redirArc (px/frame) at a felt "soft" landing → impact 0. SOFT = 0: the PHYSICAL floor — zero
   *  redirection is zero impact. Derived 2026-06-15: the achievable-range fit wanted SOFT < 0
   *  (unphysical), so it's floored at 0; a non-redirecting catch reads 0. Env-overridable for study. */
  SOFT: impactEnvNum("LR_IMPACT_SOFT", 0),
  /** redirArc (px/frame) at a felt "very strong" landing → impact 1. VSTRONG = 7.29: auto-fit on a
   *  rich (authored, achieved-px) cloud (1767 landings, SOFT pinned 0, per-level-median least-squares),
   *  in a flat valley [7.3, 8.5]; corroborated by the author's perceptual "very strong" (~7–8px) and the
   *  achievable hard-hit ceiling. The compiler's `v·Δθ` IS the felt-impact measure (author-validated),
   *  so the [0,1] map is a straight linear normalization of it. */
  VERY_STRONG: impactEnvNum("LR_IMPACT_VSTRONG", 7.29),
};
// Fail fast on a degenerate env-set anchor pair: a non-positive span makes
// normImpact divide by zero (silently clamped to 0/1) or, when SOFT > VERY_STRONG,
// inverts the scored impact axis — both silently corrupt the headline.
if (!(REDIRARC.VERY_STRONG > REDIRARC.SOFT)) {
  throw new Error(
    `Invalid impact anchors: LR_IMPACT_VSTRONG (${REDIRARC.VERY_STRONG}) must be > ` +
      `LR_IMPACT_SOFT (${REDIRARC.SOFT}); a non-positive span corrupts the scored impact axis.`,
  );
}
/** redirArc px/frame → felt impact [0,1] (the SCORED normalization). */
export function normImpact(redirArcPx: number): number {
  return Math.max(0, Math.min(1, (redirArcPx - REDIRARC.SOFT) / (REDIRARC.VERY_STRONG - REDIRARC.SOFT)));
}
/** Inverse: the redirArc (px/frame) an authored impact [0,1] is asking for. Used by the
 *  generation lever / readiness to convert a normalized ask into a target turn. */
export function impactToRedirArcPx(impact: number): number {
  return REDIRARC.SOFT + Math.max(0, Math.min(1, impact)) * (REDIRARC.VERY_STRONG - REDIRARC.SOFT);
}
/** SUPERSEDED — the convention rescale is now baked at authoring (golden specs use
 *  `withImpactLegacy`/`migrateImpact`, beats.ts), so authored impact already sits on the new felt
 *  scale and this is identity by default. Kept only as the `LR_IMPACT_RESCALE=1` study switch (and so
 *  legacy callers still resolve); remove once all callers drop it. */
const _impactRescaleOn = ((globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env?.["LR_IMPACT_RESCALE"]) === "1";
export function rescaleAuthoredImpact(authored: number): number {
  if (!_impactRescaleOn) return authored;
  return normImpact(authored * CALIB.REDIR_CAP);
}
/** Wrap an angle (radians) to (−π, π]. Canonical home (the scored impact's net-heading-change
 *  and the study harnesses' turnNetDeg share this one definition). */
export const wrapPi = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Maximum catchable normalized impact [0,1] at the given entering speed (px/frame).
 * `target > impactCeiling(speed)` ⇒ the shortfall is physics (too slow to redirect at all,
 * or the hit would eject), not a compiler miss. Max catchable redirArc = entering speed ×
 * the largest catchable turn (asin of the catchable redirection fraction).
 */
export function impactCeiling(speedPx: number): number {
  const maxTurn = Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION); // ≈ 1.12 rad (64°)
  return normImpact(Math.max(0, speedPx) * maxTurn);
}

export const CALIB = {
  /** Divisor for `grain` axis. units. */
  LINE_LENGTH_CAP: 49,
  /** [LEGACY — NOT SCORED as of 2026-06-14] Cap for the OLD perpendicular `redir`
   *  metric (v·sin Δθ). The scored impact is now `redirArc = v·Δθ` on the felt scale
   *  `REDIRARC.SOFT`/`VERY_STRONG` via `normImpact` (see above). Kept only for the
   *  dashboard's REDIR comparison lane and the `study_*` harnesses' `redirPx`. */
  REDIR_CAP: 8.5,
  /** [LEGACY — NOT SCORED] Divisor for the OLD one-frame normal-closing impact
   *  ("point"). The scored impact is REDIR_CAP above (redirection) — don't tune this
   *  one for scoring. Kept because the `study_*` harnesses and `make_overlay_data`
   *  still normalize the point baseline by it for side-by-side comparison. */
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
