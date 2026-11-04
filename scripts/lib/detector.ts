import {hypot2} from './hypot2.ts';
/**
 * Trajectory analysis detector.
 *
 * Given a per-frame rider trajectory (position, velocity, sled-point contacts,
 * sled-intact flag), emits {measurements, events, terminus} per the contract
 * pinned in PROBLEM.md.
 *
 * Split in two halves:
 *   1. `extractRawTrajectory(engine, duration)` — drives lr-core, dumps the
 *      raw per-frame data the detector needs.
 *   2. `detect(raw, params)` — pure function over the raw data → analysis.
 *
 * Step (1) is the only part coupled to lr-core. Step (2) is unit-testable
 * with hand-built fixtures.
 */

import type {LineRiderEngine, BallisticState} from './native_motion/engine.ts';
import { COLLISION_UPDATE_TYPE } from "./update_types.ts";

// ────────── Pinned constants (PROBLEM.md §Definitions) ──────────

/** Bounce-vs-landing threshold: airborne for >K frames ⇒ landing, 1..K ⇒ bounce. */
export const K_BOUNCE_LANDING = 5;
/** Smallest airborne run the detector can classify as a landing. */
export const MIN_LANDING_AIRBORNE_FRAMES = K_BOUNCE_LANDING + 1;
/** Kick threshold: angle change per frame, degrees. */
export const THETA_KICK_DEG = 20;
/** Stall threshold (engine units / frame). */
export const V_STALL = 0.05;
/** Frames of sustained <V_STALL to trip rideStalled. */
export const V_STALL_FRAMES = 20;
/** leftWorld envelope, in engine units. */
export const WORLD_ENVELOPE = 1e6;
/** Window size (frames) used to verify a landing/bounce actually persisted. */
export const PERSISTENCE_FRAMES = 5;
/** Fraction of the persistence window that must be in contact (≥). */
export const PERSISTENCE_RATIO = 0.5;
/** Names of collision points that count as "sled-side" contact. */
export const SLED_POINT_ORDER = ["PEG", "TAIL", "NOSE", "STRING"] as const;
export const SLED_POINT_NAMES = new Set<string>(SLED_POINT_ORDER);

/** Sled pose ("internal rotation"): TAIL→NOSE angle in degrees (+down,
 *  screen +y), read from an already-fetched rider. Pure property read —
 *  zero metered frames when the rider's frame is already simulated. Null
 *  when TAIL/NOSE are unreadable or coincident. */
// deno-lint-ignore no-explicit-any
export function sledPoseDegFromRider(rider: any): number | null {
  const tail = rider.get?.("TAIL")?.pos;
  const nose = rider.get?.("NOSE")?.pos;
  if (!tail || !nose) return null;
  const dx = nose.x - tail.x;
  const dy = nose.y - tail.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return null;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

// ────────── Types ──────────

export type Vec2 = { x: number; y: number };

export type RawFrame = {
  frame: number;
  position: Vec2;
  velocity: Vec2;
  /** Sled-side collision-point ids in contact this frame (subset of SLED_POINT_NAMES). */
  sledContacts: string[];
  /**
   * Track-line ids the sled-side collision points fired against, this frame.
   * Used by the Move/ride() composer to attribute slide segments and events
   * to specific moves: each move owns the line ids it placed, so any frame
   * whose contactLineIds intersect a move's owned ids is "during" that move.
   */
  contactLineIds: number[];
  /** True iff SLED_INTACT.isBinded() === false at this frame (sled has fallen apart). */
  sledBroken: boolean;
  /** True iff RIDER_MOUNTED.isBinded() === false (rider thrown off the sled). */
  riderEjected: boolean;
};

export type RawTrajectory = {
  /** Inclusive last frame index expected by the spec (e.g. track.duration). */
  duration: number;
  frames: RawFrame[];
};



export type DetectorParams = {
  K: number;
  thetaDeg: number;
  vStall: number;
  vStallFrames: number;
  worldEnvelope: number;
  persistenceFrames: number;
  persistenceRatio: number;
};

export const DEFAULT_PARAMS: DetectorParams = {
  K: K_BOUNCE_LANDING,
  thetaDeg: THETA_KICK_DEG,
  vStall: V_STALL,
  vStallFrames: V_STALL_FRAMES,
  worldEnvelope: WORLD_ENVELOPE,
  persistenceFrames: PERSISTENCE_FRAMES,
  persistenceRatio: PERSISTENCE_RATIO,
};

export type EventLanding   = { frame: number; type: "landing";    airborneFrom: number };
export type EventBounce    = { frame: number; type: "bounce";     airborneFrom: number };
export type EventKick      = { frame: number; type: "kick";       angleDeg: number };
/** Sled point clipped through a line: brief contact (< persistence ratio) after sustained air. */
export type EventFlyThrough = { frame: number; type: "flyThrough"; airborneFrom: number; contactFraction: number };
export type DetEvent = EventLanding | EventBounce | EventKick | EventFlyThrough;

export type Terminus = {
  frame: number;
  reason: "endOfSpec" | "sledBroken" | "riderEjected" | "rideStalled" | "leftWorld";
};

export type Measurements = {
  /** Per-frame position (length = terminus.frame + 1). */
  position: Vec2[];
  /** Per-frame velocity. */
  velocity: Vec2[];
  /** |velocity|. */
  speed: number[];
  /** sled-point ids in contact, per frame. */
  sledContacts: string[][];
  /** track-line ids the sled fired against, per frame (mirrors RawFrame.contactLineIds). */
  contactLineIds: number[][];
  /** !sledContacts.length, per frame. */
  airborne: boolean[];
};

/** A continuous stretch of frames where the sled is in contact with a line. */
export type SlideSegment = {
  /** First frame of the slide (inclusive). */
  start: number;
  /** Last frame of the slide (inclusive). */
  end: number;
  /** end - start + 1. */
  durationFrames: number;
};

/**
 * High-level shape of the ride. The detector's `events` answer "what
 * transitions happen?"; the summary answers "what is the rider doing?".
 * Sliding (sled in contact with a line) is the verb at the heart of
 * Line Rider — a good ride is one with high contact fraction and long
 * sustained slides; the rider's *riding*, not flying or thrashing.
 */
export type Summary = {
  /** Frames the detector actually walked = terminus.frame + 1. */
  liveFrames: number;
  /** Full spec length = raw.duration + 1. */
  specFrames: number;
  /** Frames in sled contact. */
  contactFrames: number;
  /** Frames airborne. */
  airborneFrames: number;
  /** contactFrames / liveFrames. "While the ride lasted, how much was sliding?" */
  contactFractionLive: number;
  /** contactFrames / specFrames. "Of what was asked for, how much was sliding?" */
  contactFractionSpec: number;
  /** Longest run of consecutive in-contact frames. */
  longestContactRun: number;
  /** Longest run of consecutive airborne frames. */
  longestAirborneRun: number;
  /** Mean |v| over in-contact frames. */
  meanSpeedSliding: number;
  /** Mean |v| over airborne frames. */
  meanSpeedAirborne: number;
  /** Mean vx over in-contact frames. */
  meanVxSliding: number;
  /** Mean vx over airborne frames. */
  meanVxAirborne: number;
  /** All contiguous slide intervals, in order. */
  slideSegments: SlideSegment[];
};

export type Detection = {
  measurements: Measurements;
  events: DetEvent[];
  terminus: Terminus;
  params: DetectorParams;
  summary: Summary;
};

// ────────── Detector (pure function) ──────────

/** Detector state after the frames before `next`. */
type DetectorState = {
  P: DetectorParams;
  next: number;
  position: Vec2[];
  velocity: Vec2[];
  speed: number[];
  sledContacts: string[][];
  contactLineIds: number[][];
  airborne: boolean[];
  events: DetEvent[];
  stallRun: number;
  airborneRun: number;
  airborneFrom: number; // frame at which the current airborne run began
  terminus: Terminus | null;
};

/** Running summary of the measurements before `next`. */
type SummaryState = {
  next: number;
  contactFrames: number;
  airborneFrames: number;
  speedSlidingSum: number;
  speedAirborneSum: number;
  vxSlidingSum: number;
  vxAirborneSum: number;
  longestContactRun: number;
  longestAirborneRun: number;
  slideSegments: SlideSegment[];
  curRun: number;
  curRunIsAir: boolean;
  runStart: number;
};

export function detect(raw: RawTrajectory, params: Partial<DetectorParams> = {}): Detection {
  if (raw.frames.length === 0) throw new Error("detect: empty trajectory");
  const state = scanFrames(startDetector({ ...DEFAULT_PARAMS, ...params }), raw.frames, raw.frames.length);
  return finishDetection(raw, state, startSummary());
}

/** Repeated continuations of one immutable trajectory prefix. Measurement
 * storage belongs to this workspace. A synchronous callback may read it and
 * return owned results, but must not retain or mutate the detection arrays.
 * This keeps candidate evaluation from copying the same prefix on every read. */
export class DetectionContinuation {
  private readonly prefix: {
    detector: Pick<DetectorState, 'P' | 'next' | 'stallRun' | 'airborneRun' | 'airborneFrom' | 'terminus'>;
    summary: Omit<SummaryState, 'slideSegments'>;
    measurements: number;
    events: number;
    segments: number;
  };
  private readonly state: DetectorState;
  private readonly summary: SummaryState;
  private readonly last: RawFrame | undefined;
  private active = false;

  constructor(raw: RawTrajectory, params: Partial<DetectorParams> = {}) {
    const P = {...DEFAULT_PARAMS, ...params};
    this.state = scanFrames(startDetector(P), raw.frames, Math.max(0, raw.frames.length - P.persistenceFrames + 1));
    this.summary = scanSummary(startSummary(), this.state, this.state.airborne.length);
    this.last = this.state.next > 0 ? raw.frames[this.state.next - 1] : undefined;
    const {next, stallRun, airborneRun, airborneFrom, terminus} = this.state;
    const {slideSegments, ...summary} = this.summary;
    // Continuations only append. Reset lengths and scalar state; retain one
    // copy of the immutable prefix observations in the working arrays.
    this.prefix = {detector: {P, next, stallRun, airborneRun, airborneFrom, terminus}, summary,
      measurements: this.state.position.length, events: this.state.events.length, segments: slideSegments.length};
  }

  withDetection<T>(raw: RawTrajectory, consume: (detection: Detection) => T & (T extends PromiseLike<unknown> ? never : unknown)): T {
    if (this.active) throw new Error('detection continuation is already in use');
    const {detector: p, measurements, events, segments} = this.prefix, state = this.state, summary = this.summary;
    if (raw.frames.length === 0) throw new Error('detect: empty trajectory');
    if (raw.frames.length < p.next || (p.next > 0 && raw.frames[p.next - 1] !== this.last))
      throw new Error('trajectory does not extend the detected prefix');
    state.P = {...p.P};
    state.next = p.next; state.stallRun = p.stallRun;
    state.airborneRun = p.airborneRun; state.airborneFrom = p.airborneFrom; state.terminus = p.terminus;
    state.position.length = measurements; state.velocity.length = measurements;
    state.speed.length = measurements; state.sledContacts.length = measurements;
    state.contactLineIds.length = measurements; state.airborne.length = measurements;
    state.events.length = events;
    Object.assign(summary, this.prefix.summary);
    summary.slideSegments.length = segments;
    this.active = true;
    try {
      const result = consume(finishDetection(raw, scanFrames(state, raw.frames, raw.frames.length), summary));
      if (result && typeof (result as {then?: unknown}).then === 'function')
        throw new TypeError('detection callbacks must be synchronous');
      return result;
    } finally {
      this.active = false;
    }
  }
}

function startDetector(P: DetectorParams): DetectorState {
  return { P, next: 0, position: [], velocity: [], speed: [], sledContacts: [], contactLineIds: [], airborne: [], events: [],
    stallRun: 0, airborneRun: 0, airborneFrom: -1, terminus: null };
}

// Walk forward from state.next to `until`; stop at the first terminus condition.
// Build measurements only up to the terminus frame inclusive.
function scanFrames(state: DetectorState, frames: RawFrame[], until: number): DetectorState {
  const { P, position, velocity, speed, sledContacts, contactLineIds, airborne, events } = state;
  let { stallRun, airborneRun, airborneFrom, terminus } = state;
  let i = state.next;
  for (; terminus === null && i < until; i++) {
    const fr = frames[i];

    // Record per-frame measurements.
    position.push(fr.position);
    velocity.push(fr.velocity);
    const sp = hypot2(fr.velocity.x, fr.velocity.y);
    speed.push(sp);
    sledContacts.push(fr.sledContacts);
    contactLineIds.push(fr.contactLineIds);
    const isAir = fr.sledContacts.length === 0;
    airborne.push(isAir);

    // --- terminus checks ---
    // Either bind breaking ends the ride. Report whichever tripped this frame;
    // if both happen on the same frame, riderEjected is the more catastrophic
    // (rider physically detached) so it wins.
    if (fr.riderEjected) {
      terminus = { frame: fr.frame, reason: "riderEjected" };
      break;
    }
    if (fr.sledBroken) {
      terminus = { frame: fr.frame, reason: "sledBroken" };
      break;
    }
    if (sp < P.vStall) {
      stallRun++;
      if (stallRun >= P.vStallFrames) {
        terminus = { frame: fr.frame, reason: "rideStalled" };
        break;
      }
    } else {
      stallRun = 0;
    }
    if (
      Math.abs(fr.position.x) > P.worldEnvelope ||
      Math.abs(fr.position.y) > P.worldEnvelope
    ) {
      terminus = { frame: fr.frame, reason: "leftWorld" };
      break;
    }

    // --- airborne run-length tracking + landing / bounce emission ---
    if (isAir) {
      if (airborneRun === 0) airborneFrom = fr.frame;
      airborneRun++;
    } else if (airborneRun > 0) {
      // Just transitioned airborne → grounded. Verify the contact persists —
      // at extreme |v| the sled point can clip through a line on one frame
      // and exit the next (tunneling). That's not a real landing.
      const windowEnd = Math.min(frames.length, i + P.persistenceFrames);
      const windowLen = windowEnd - i;
      let groundedInWindow = 1; // current frame is grounded by construction
      for (let j = i + 1; j < windowEnd; j++) {
        if (frames[j].sledContacts.length > 0) groundedInWindow++;
      }
      const contactFraction = groundedInWindow / windowLen;
      const persisted = contactFraction >= P.persistenceRatio;

      if (persisted) {
        if (airborneRun > P.K) {
          events.push({ frame: fr.frame, type: "landing", airborneFrom });
        } else {
          events.push({ frame: fr.frame, type: "bounce", airborneFrom });
        }
      } else if (airborneRun > P.K) {
        // Sustained airborne phase + brief contact = tunneled through.
        events.push({ frame: fr.frame, type: "flyThrough", airborneFrom, contactFraction });
      }
      // (Short airborne + brief contact = noise, no event.)
      airborneRun = 0;
      airborneFrom = -1;
    }

    // --- kick emission (angle change between consecutive velocities) ---
    if (i > 0) {
      const v0 = frames[i - 1].velocity;
      const v1 = fr.velocity;
      const a = signedAngleDeg(v0, v1);
      if (Math.abs(a) >= P.thetaDeg) {
        events.push({ frame: fr.frame, type: "kick", angleDeg: a });
      }
    }
  }
  Object.assign(state, { next: i, stallRun, airborneRun, airborneFrom, terminus });
  return state;
}

function finishDetection(raw: RawTrajectory, state: DetectorState, summary: SummaryState): Detection {
  const frames = raw.frames;
  let terminus = state.terminus;
  if (terminus === null) {
    // Reached the end of the supplied trajectory without a terminus condition.
    // Did we reach spec duration?
    const lastFrame = frames[frames.length - 1].frame;
    terminus = {
      frame: Math.min(lastFrame, raw.duration),
      reason: lastFrame >= raw.duration ? "endOfSpec" : "rideStalled",
    };
  }

  const { position, velocity, speed, sledContacts, contactLineIds, airborne } = state;
  const measurements: Measurements = { position, velocity, speed, sledContacts, contactLineIds, airborne };

  return {
    measurements,
    events: state.events,
    terminus,
    params: state.P,
    summary: finishSummary(scanSummary(summary, measurements, airborne.length), airborne.length, raw.duration),
  };
}

function startSummary(): SummaryState {
  return { next: 0, contactFrames: 0, airborneFrames: 0, speedSlidingSum: 0, speedAirborneSum: 0, vxSlidingSum: 0, vxAirborneSum: 0,
    longestContactRun: 0, longestAirborneRun: 0, slideSegments: [], curRun: 0, curRunIsAir: false, runStart: 0 };
}

function scanSummary(s: SummaryState, m: Pick<Measurements, "velocity" | "speed" | "airborne">, until: number): SummaryState {
  let { contactFrames, airborneFrames, speedSlidingSum, speedAirborneSum, vxSlidingSum, vxAirborneSum,
    longestContactRun, longestAirborneRun, curRun, curRunIsAir, runStart } = s;
  const slideSegments = s.slideSegments;
  let i = s.next;
  for (; i < until; i++) {
    const isAir = m.airborne[i];
    if (isAir) {
      airborneFrames++;
      speedAirborneSum += m.speed[i];
      vxAirborneSum += m.velocity[i].x;
    } else {
      contactFrames++;
      speedSlidingSum += m.speed[i];
      vxSlidingSum += m.velocity[i].x;
    }

    if (i === 0) {
      curRun = 1;
      runStart = 0;
      curRunIsAir = isAir;
    } else if (isAir === curRunIsAir) {
      curRun++;
    } else {
      // run boundary
      if (curRunIsAir) {
        if (curRun > longestAirborneRun) longestAirborneRun = curRun;
      } else {
        if (curRun > longestContactRun) longestContactRun = curRun;
        slideSegments.push({ start: runStart, end: i - 1, durationFrames: curRun });
      }
      curRun = 1;
      runStart = i;
      curRunIsAir = isAir;
    }
  }
  Object.assign(s, { next: i, contactFrames, airborneFrames, speedSlidingSum, speedAirborneSum, vxSlidingSum,
    vxAirborneSum, longestContactRun, longestAirborneRun, curRun, curRunIsAir, runStart });
  return s;
}

function finishSummary(s: SummaryState, N: number, specDuration: number): Summary {
  let { longestContactRun, longestAirborneRun } = s;
  const { contactFrames, airborneFrames, curRun, curRunIsAir, runStart, slideSegments } = s;
  // Close final run.
  if (N > 0) {
    if (curRunIsAir) {
      if (curRun > longestAirborneRun) longestAirborneRun = curRun;
    } else {
      if (curRun > longestContactRun) longestContactRun = curRun;
      slideSegments.push({ start: runStart, end: N - 1, durationFrames: curRun });
    }
  }

  const specFrames = specDuration + 1;
  return {
    liveFrames: N,
    specFrames,
    contactFrames,
    airborneFrames,
    contactFractionLive: N > 0 ? contactFrames / N : 0,
    contactFractionSpec: specFrames > 0 ? contactFrames / specFrames : 0,
    longestContactRun,
    longestAirborneRun,
    meanSpeedSliding: contactFrames > 0 ? s.speedSlidingSum / contactFrames : 0,
    meanSpeedAirborne: airborneFrames > 0 ? s.speedAirborneSum / airborneFrames : 0,
    meanVxSliding: contactFrames > 0 ? s.vxSlidingSum / contactFrames : 0,
    meanVxAirborne: airborneFrames > 0 ? s.vxAirborneSum / airborneFrames : 0,
    slideSegments,
  };
}

/**
 * Signed angle from v0 to v1 in degrees, in [-180, 180].
 * Returns 0 if either vector is zero (no defined direction).
 */
function signedAngleDeg(v0: Vec2, v1: Vec2): number {
  if ((v0.x === 0 && v0.y === 0) || (v1.x === 0 && v1.y === 0)) return 0;
  const dot = v0.x * v1.x + v0.y * v1.y;
  const cross = v0.x * v1.y - v0.y * v1.x;
  return Math.atan2(cross, dot) * (180 / Math.PI);
}

// ────────── lr-core extractor ──────────

/**
 * Walk lr-core engine over [0, duration] inclusive, dump the data the detector
 * needs. The engine type is left as `any` because lr-core ships pre-modern JS
 * without TS types.
 */
// deno-lint-ignore no-explicit-any
export function extractRawTrajectory(engine: any, duration: number): RawTrajectory {
  return extractRawTrajectoryWindow(engine, 0, duration);
}

// deno-lint-ignore no-explicit-any
export function extractRawTrajectoryWindow(
  engine: any,
  startFrame: number,
  duration: number,
): RawTrajectory {
  const before = engineLastFrameIndex(engine);
  const start = Math.max(0, startFrame), end = Math.floor(duration);
  if (before !== null && before >= end && end >= start && Number.isInteger(start) &&
      typeof engine.getCachedRawFrames === 'function') {
    const frames: RawFrame[] = engine.getCachedRawFrames(start, end);
    _frameCount += frames.length;
    return {duration, frames};
  }
  let chargedThrough = before;
  const frames: RawFrame[] = [];
  for (let f = Math.max(0, startFrame); f <= duration; f++) {
    if (
      _physicsFrameLimit !== null &&
      chargedThrough !== null &&
      f > chargedThrough &&
      _physicsFrames + (f - chargedThrough) > _physicsFrameLimit
    ) {
      throw new PhysicsFrameLimitExceeded(_physicsFrameLimit, _physicsFrames + (f - chargedThrough));
    }
    frames.push(extractRawFrame(engine, f));
    if (_physicsFrameLimit !== null && chargedThrough !== null) {
      const afterFrame = engineLastFrameIndex(engine);
      if (afterFrame !== null) {
        chargePhysicsFrames(Math.max(0, afterFrame - chargedThrough));
        chargedThrough = afterFrame;
      }
    }
  }
  const after = engineLastFrameIndex(engine);
  if (_physicsFrameLimit === null && before !== null && after !== null) {
    chargePhysicsFrames(Math.max(0, after - before));
  }
  return { duration, frames };
}

/** Two work-unit counters, both reset per compile and non-reentrant
 *  (rely on the single-compile-at-a-time invariant compile.ts uses):
 *
 *  - `_frameCount` (reads): incremented once per `extractRawFrame` call,
 *    i.e. per frame *read* — including re-reads of frames lr-core has
 *    already simulated and cached. Kept as a secondary/cross-check
 *    counter; NOT the work unit.
 *  - `_physicsFrames` (computed): the delta in `engine.getLastFrameIndex()`
 *    across each extraction / metered `getRider`, i.e. frames the engine
 *    actually *integrated*. Re-reads of cached frames add zero. This is
 *    the honest work unit: it tracks real physics computation, dominates
 *    wall-clock (Property 2), and is an lr-core primitive the optimizer
 *    can't inflate (Property 3). See `optimizer/sim_frames.ts`. */
let _frameCount = 0;
let _physicsFrames = 0;
let _physicsFrameLimit: number | null = null;

export class PhysicsFrameLimitExceeded extends Error {
  readonly limit: number;
  readonly attempted: number;

  constructor(limit: number, attempted: number) {
    super(`physics frame budget hard limit exceeded (limit=${limit}, attempted=${attempted})`);
    this.name = "PhysicsFrameLimitExceeded";
    this.limit = limit;
    this.attempted = attempted;
  }
}

/** Read the cumulative frame-*read* count since the last reset
 *  (secondary counter; over-bills cached re-reads). */
export function getFrameCount(): number {
  return _frameCount;
}

/** Read the cumulative *physics* (newly-simulated) frame count since the
 *  last reset. This is the work unit `getSimFrames()` exposes. */
export function getPhysicsFrameCount(): number {
  return _physicsFrames;
}

/** Set/clear a hard cap on the physics-frame counter. Intended for budgeted
 *  compiles as a runaway guard; null means uncapped. */
export function setPhysicsFrameLimit(limit: number | null): void {
  if (limit !== null && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error(`setPhysicsFrameLimit: limit must be positive or null, got ${limit}`);
  }
  _physicsFrameLimit = limit === null ? null : Math.ceil(limit);
}

/** Reset both frame counters. Call at the start of each compile(). */
export function resetFrameCount(): void {
  _frameCount = 0;
  _physicsFrames = 0;
}

/** Refund the physics-frame counter back to a previously-saved value, discarding
 *  frames simulated since. Used by the FREE-PREVIEW proof-of-concept so forward-
 *  looking rollouts (which only inform ranking and whose nodes are discarded) do
 *  not count against the compile budget. Only ever lowers the counter. */
export function refundPhysicsFramesTo(saved: number): void {
  if (saved >= 0 && saved < _physicsFrames) _physicsFrames = saved;
}

function chargePhysicsFrames(delta: number): void {
  if (delta <= 0) return;
  const attempted = _physicsFrames + delta;
  if (_physicsFrameLimit !== null && attempted > _physicsFrameLimit) {
    _physicsFrames = attempted;
    throw new PhysicsFrameLimitExceeded(_physicsFrameLimit, attempted);
  }
  _physicsFrames = attempted;
}

/** Safely read lr-core's highest-simulated-frame index (monotonic engine
 *  state). Returns null if the engine doesn't expose it. */
// deno-lint-ignore no-explicit-any
function engineLastFrameIndex(engine: any): number | null {
  const fn = engine?.getLastFrameIndex;
  if (typeof fn !== "function") return null;
  try {
    const v = fn.call(engine);
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** Check the requested extension before reading, then charge what the engine
 * actually computed. Native snapshots and rider observations share this rule. */
function readMeteredFrame<T>(engine: any, frame: number, read: () => T): T {
  const before = engineLastFrameIndex(engine);
  if (
    _physicsFrameLimit !== null &&
    before !== null &&
    frame > before &&
    _physicsFrames + (frame - before) > _physicsFrameLimit
  ) {
    throw new PhysicsFrameLimitExceeded(_physicsFrameLimit, _physicsFrames + (frame - before));
  }
  const result = read();
  const after = engineLastFrameIndex(engine);
  if (before !== null && after !== null) chargePhysicsFrames(Math.max(0, after - before));
  return result;
}

/** Meter rider probes outside the extraction loop. Cached frames cost zero. */
export function getRiderMetered(engine: any, frame: number): any {
  return readMeteredFrame(engine, frame, () => engine.getRider(frame));
}

/** Owned native state reads and comparisons share the same meter boundary. */
export function getBallisticStateMetered(engine: LineRiderEngine, frame: number): BallisticState {
  return readMeteredFrame(engine, frame, () => engine.getBallisticStateAtFrame(frame));
}

export function matchesBallisticStateMetered(engine: LineRiderEngine, frame: number, expected: BallisticState): boolean {
  return readMeteredFrame(engine, frame, () => engine.matchesBallisticStateAtFrame(frame, expected));
}

/** Whether the rider is still mounted and the sled intact at `frame` on a native
 *  engine. An unbinding is permanent, so the replay stops at the first frame
 *  where the rider or sled has come apart. Only the frames simulated are
 *  charged, each checked against the limit before it is simulated. */
// deno-lint-ignore no-explicit-any
export function boundThroughMetered(engine: any, frame: number): boolean {
  const before = engine.getLastFrameIndex() as number;
  if (frame <= before) return engine.isBoundAtFrame(frame);
  if (typeof engine.advanceWhileBound === 'function' && Number.isFinite(frame) && frame <= 0x7fffffff) {
    const target = Math.floor(frame);
    if (target <= before) return true;
    const end = _physicsFrameLimit === null ? target : Math.min(target, before + Math.floor(_physicsFrameLimit - _physicsFrames));
    if (end > before) {
      const bound = engine.advanceWhileBound(end);
      chargePhysicsFrames(engine.getLastFrameIndex() - before);
      if (!bound) return false;
    }
    if (end < target) throw new PhysicsFrameLimitExceeded(_physicsFrameLimit!, _physicsFrames + 1);
    return true;
  }
  for (let f = before + 1; f <= frame; f++) {
    if (_physicsFrameLimit !== null && _physicsFrames + 1 > _physicsFrameLimit) {
      throw new PhysicsFrameLimitExceeded(_physicsFrameLimit, _physicsFrames + 1);
    }
    const bound = engine.isBoundAtFrame(f);
    chargePhysicsFrames(1);
    if (!bound) return false;
  }
  return true;
}

// deno-lint-ignore no-explicit-any
export function getSledPointPositionsMetered(engine: any, frame: number, out: number[] = []): number[] {
  const before = engineLastFrameIndex(engine);
  if (
    _physicsFrameLimit !== null &&
    before !== null &&
    frame > before &&
    _physicsFrames + (frame - before) > _physicsFrameLimit
  ) {
    throw new PhysicsFrameLimitExceeded(_physicsFrameLimit, _physicsFrames + (frame - before));
  }

  const fast = engine?.getSledPointPositionsAtFrame;
  if (typeof fast === "function") {
    fast.call(engine, frame, out);
  } else {
    const rider = engine.getRider(frame);
    let o = 0;
    for (const name of SLED_POINT_ORDER) {
      const pos = rider.get(name)?.pos;
      if (pos) {
        out[o++] = pos.x;
        out[o++] = pos.y;
      }
    }
    out.length = o;
  }

  const after = engineLastFrameIndex(engine);
  if (before !== null && after !== null) chargePhysicsFrames(Math.max(0, after - before));
  return out;
}

// deno-lint-ignore no-explicit-any
export function appendSledPointPositionsRangeMetered(
  engine: any,
  firstFrame: number,
  lastFrame: number,
  out: number[] = [],
): number[] {
  const first = Math.max(0, firstFrame);
  if (lastFrame < first) return out;

  const before = engineLastFrameIndex(engine);
  let chargedThrough = before;
  const fast = engine?.getSledPointPositionsAtFrame;
  const sledPositions: number[] = [];

  for (let frame = first; frame <= lastFrame; frame++) {
    if (
      _physicsFrameLimit !== null &&
      chargedThrough !== null &&
      frame > chargedThrough &&
      _physicsFrames + (frame - chargedThrough) > _physicsFrameLimit
    ) {
      throw new PhysicsFrameLimitExceeded(_physicsFrameLimit, _physicsFrames + (frame - chargedThrough));
    }

    if (typeof fast === "function") {
      fast.call(engine, frame, sledPositions);
    } else {
      const rider = engine.getRider(frame);
      let o = 0;
      for (const name of SLED_POINT_ORDER) {
        const pos = rider.get(name)?.pos;
        if (pos) {
          sledPositions[o++] = pos.x;
          sledPositions[o++] = pos.y;
        }
      }
      sledPositions.length = o;
    }

    for (let i = 0; i < sledPositions.length; i += 2) {
      out.push(sledPositions[i], sledPositions[i + 1]);
    }

    if (_physicsFrameLimit !== null && chargedThrough !== null) {
      const afterFrame = engineLastFrameIndex(engine);
      if (afterFrame !== null) {
        chargePhysicsFrames(Math.max(0, afterFrame - chargedThrough));
        chargedThrough = afterFrame;
      }
    }
  }

  const after = engineLastFrameIndex(engine);
  if (_physicsFrameLimit === null && before !== null && after !== null) {
    chargePhysicsFrames(Math.max(0, after - before));
  }
  return out;
}

// deno-lint-ignore no-explicit-any
function extractRawFrame(engine: any, frame: number): RawFrame {
  _frameCount++;
  const fastRawFrame = engine?.getRawFrameAtFrame;
  if (typeof fastRawFrame === "function") {
    return fastRawFrame.call(engine, frame) as RawFrame;
  }
  const rider = engine.getRider(frame);
  const updates = engine.getUpdatesAtFrame(frame);

  const sledContacts: string[] = [];
  const contactLineIds: number[] = [];
  if (Array.isArray(updates)) {
    const seenPoints = new Set<string>();
    const seenLines = new Set<number>();
    for (const u of updates) {
      if (!u || u.type !== COLLISION_UPDATE_TYPE || !Array.isArray(u.updated)) continue;
      // Only count this update if at least one of its updated points is
      // sled-side. Lr-core also emits CollisionUpdates for rider-side
      // points (BUTT, LFOOT, etc.); we don't want those.
      let sledSideInThisUpdate = false;
      for (const p of u.updated) {
        const pid = p?.id;
        if (typeof pid === "string" && SLED_POINT_NAMES.has(pid)) {
          sledSideInThisUpdate = true;
          if (!seenPoints.has(pid)) {
            seenPoints.add(pid);
            sledContacts.push(pid);
          }
        }
      }
      if (sledSideInThisUpdate && typeof u.id === "number" && !seenLines.has(u.id)) {
        seenLines.add(u.id);
        contactLineIds.push(u.id);
      }
    }
  }

  let sledBroken = false;
  let riderEjected = false;
  try {
    const sledIntact = rider.get?.("SLED_INTACT");
    if (sledIntact && typeof sledIntact.isBinded === "function") {
      sledBroken = sledIntact.isBinded() === false;
    }
    const riderMounted = rider.get?.("RIDER_MOUNTED");
    if (riderMounted && typeof riderMounted.isBinded === "function") {
      riderEjected = riderMounted.isBinded() === false;
    }
  } catch {
    // ignore; treat as intact
  }

  return {
    frame,
    position: { x: rider.position.x, y: rider.position.y },
    velocity: { x: rider.velocity.x, y: rider.velocity.y },
    sledContacts,
    contactLineIds,
    sledBroken,
    riderEjected,
  };
}
