/**
 * The compiler's contract: Spec, Contact, axis curves, Arc, DriftReport, and the rulers that give authored values their meaning.
 */


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
};

export type SpecMusic = {
  /** Repo-relative path or URL for the source audio. */
  audio: string;
  title?: string;
  artist?: string;
  /** Human-readable tempo/meter label, e.g. "100 BPM · 4/4". */
  tempo?: string;
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
   * The landing's intensity at this beat, absolute on the felt scale [0, 1]: 0 is a perfectly smooth catch, 1 is very
   * strong. It is the rider's redirection impulse (`IMPACT` below): the surface redirecting the rider's path at speed,
   * read from the centre of mass only, so a rotating sled or a whipping limb, which look violent but are not felt, do
   * not count; slowing along a straight line reads about 0, and a bend followed by an unbend adds up.
   *
   * Authored on the beat, not as a curve: impact qualifies one landing, where the axes are continuous between beats.
   * The compiler resolves it into the targets of the gap that ends at this beat and steers toward it; it is scored.
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
 * The creative axes, in canonical order. Single source of iteration.
 * Axis semantics:
 *   - `air`           — airborne-frame fraction, [0, 0.99].
 *   - `speed`         — authored pace, [0, 1], mapped to raw px/frame by
 *                       `authoredSpeedToPx`.
 *   - `amplitude`     — peak upward bow of the trajectory above the takeoff→
 *                       landing chord (jump arc height / sagitta), normalized by
 *                       `AMPLITUDE_CAP`, [0, 1]. Orthogonal to `air`:
 *                       `air` is how *long* aloft, `amplitude` is how *high*.
 *   - `impact`        — landing intensity at a beat: the rider's redirection
 *                       IMPULSE `cArc = Σ v̄·|Δθ|` accumulated over the CONTACTED frames
 *                       of the `IMPACT_WINDOW`-frame episode after touchdown,
 *                       felt-normalized via `normImpact` [0, 1]
 *                       (0 = perfectly smooth, 1 = very strong). NOT
 *                       authored as a curve — it is a per-beat qualifier
 *                       (`Contact.impact`) resolved into the terminating gap so it
 *                       can reuse this per-gap plumbing. Scored, but not in
 *                       `TARGET_AXES`: it is not authored as a curve.
 */
export const AXES = ["air", "speed", "amplitude", "impact"] as const;
export type AxisName = (typeof AXES)[number];

/** Axes authored as curves. */
export const TARGET_AXES = ["air", "speed", "amplitude"] as const satisfies readonly AxisName[];

/** Upper bound for each normalized authored target/sample value. */
export const AXIS_VALUE_MAX = {
  air: 0.99,
  speed: 1,
  amplitude: 1,
  impact: 1,
} as const satisfies Record<AxisName, number>;

/**
 * Resolved or measured per-axis scalar values for one gap (or one frame).
 * The numeric bag flowing through `gap.targets`, candidate `achieved`,
 * `axisCost`, and `clampGapTargets`.
 */
export type AxisValues = Partial<Record<AxisName, number>>;

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

export { type TrackLine } from "../lib/track.ts";

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
   *  the physical ceiling given the rider's state here. Populated for `impact` (the
   *  speed-bounded catchable redirection): a target above `ceiling` asked for more
   *  than physics allowed at this gap, so the shortfall is expected, not a compiler
   *  miss. Absent for axes without a meaningful per-gap ceiling. */
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

/**
 * Landing impact. Impact is the rider's redirection impulse `cArc = Σ v̄·|Δθ|`: the centre of mass's heading change per
 * frame times its midpoint speed, summed over the frames in contact during the `IMPACT_WINDOW` frames after touchdown
 * (how hard the ground bends the path; bending in the air, which is gravity, never counts). `contactRedirArcPxAtLanding`
 * (substrate.ts) measures it and `normImpact` maps it to the felt scale [0, 1].
 *
 * What can be reached is bounded by speed: the turn the engine delivers reliably inside the window is at most
 * `MAX_RELIABLE_TURN_RAD` (measured: the ceiling is about speed × 1.0 rad across the `SPEED_RULER` range, and beyond it
 * the hit ejects the rider). `impactCeiling` reports that bound per beat, so a target above it reads as physics.
 */
export const IMPACT = {MAX_RELIABLE_TURN_RAD: 1.0} as const;

/** Frames (0.15 s at 40 fps) over which the redirection impulse is measured: where the felt match peaks. */
export const IMPACT_WINDOW = 6;

/** The felt scale of impact, linear in the raw impulse (px/frame): SOFT, zero redirection, is impact 0; VERY_STRONG is
 * impact 1, chosen inside a flat valley [7.3, 7.9] of the landings measured, in the middle of what was felt as "very
 * strong", and below the physical top (about 11.3), so values above 1 saturate. */
export const IMPACT_RULER = {SOFT: 0, VERY_STRONG: 7.55} as const;

/** Raw contact-redirection impulse (px/frame) → felt impact [0, 1]. */
export function normImpact(rawImpactPx: number): number {
  return Math.max(0, Math.min(1, (rawImpactPx - IMPACT_RULER.SOFT) / (IMPACT_RULER.VERY_STRONG - IMPACT_RULER.SOFT)));
}
/** Inverse: the raw impulse (px/frame) an authored impact [0, 1] asks for. */
export function impactToRawPx(impact: number): number {
  return IMPACT_RULER.SOFT + Math.max(0, Math.min(1, impact)) * (IMPACT_RULER.VERY_STRONG - IMPACT_RULER.SOFT);
}
/** Wrap an angle (radians) to (−π, π]. */
export const wrapPi = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** The largest impact [0, 1] that can be caught at an entering speed (px/frame): a target above it is physics (too
 * slow to redirect that much, or the hit would eject), not a compiler miss. */
export function impactCeiling(speedPx: number): number {
  return normImpact(Math.max(0, speedPx) * IMPACT.MAX_RELIABLE_TURN_RAD);
}

export const CALIB = {
  /** Divisor of the `amplitude` axis: the peak upward sagitta (px) above the takeoff→landing chord that reads 1.0. */
  AMPLITUDE_CAP: 60,
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
