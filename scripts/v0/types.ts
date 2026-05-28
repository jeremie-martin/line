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

// ─────────── Compiler options / stats ───────────

export type Budget = {
  /** Deterministic optimizer work units, calibrated from engine work counters. */
  kind: "work";
  units: number;
};

export type CompileOptions = {
  seed?: number;
  budget?: Budget;
  /**
   * Temporary migration flag. `legacy` preserves the current greedy /
   * backtracking compiler; `lds` enables the monotonic best-so-far search.
   */
  strategy?: "legacy" | "lds";
};

export type CompileStats = {
  sim_frames: number;
  work_units_used: number;
  budget_exhausted: boolean;
  physics_frames_computed: number;
  trajectory_frames_read: number;
  engine_add_lines: number;
  candidates_sampled: number;
  leaves_attempted: number;
  leaves_scored: number;
  scored_leaf_fingerprints: string[];
  max_discrepancy_started: number;
  mandatory_prelude_units: number;
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
  K: 48,
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
