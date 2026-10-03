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

/** Work and search counters reported by a compile. */
export type CompileStats = {
  /** Candidate geometries simulated, and how many of them were physically viable. */
  actual_candidate_samples: number;
  viable_candidate_samples: number;
  engine_rebuilds: number;
  /** Sections committed, and backtracks taken while committing them. */
  gap_commits: number;
  gap_backtracks: number;
  /** Σ squared axis error per gap of the reported ride, and each gap's share. */
  total_committed_cost: number;
  committed_costs_per_gap: number[];
  /** Native physics frames charged to the allowance (the whole compile). */
  sim_frames: number;
  budget_exhausted: boolean;
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
