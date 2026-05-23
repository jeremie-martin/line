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

// ────────── Pinned constants (PROBLEM.md §Definitions) ──────────

/** Bounce-vs-landing threshold: airborne for >K frames ⇒ landing, 1..K ⇒ bounce. */
export const K_BOUNCE_LANDING = 5;
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
export const SLED_POINT_NAMES = new Set(["PEG", "TAIL", "NOSE", "STRING"]);

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

export function detect(raw: RawTrajectory, params: Partial<DetectorParams> = {}): Detection {
  const P: DetectorParams = { ...DEFAULT_PARAMS, ...params };
  const frames = raw.frames;
  if (frames.length === 0) {
    throw new Error("detect: empty trajectory");
  }

  // Walk forward; stop at first terminus condition or duration.
  // Build measurements only up to the terminus frame inclusive.
  const position: Vec2[] = [];
  const velocity: Vec2[] = [];
  const speed: number[] = [];
  const sledContacts: string[][] = [];
  const contactLineIds: number[][] = [];
  const airborne: boolean[] = [];
  const events: DetEvent[] = [];

  let stallRun = 0;
  let airborneRun = 0;
  let airborneFrom = -1; // frame at which the current airborne run began
  let terminus: Terminus | null = null;

  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i];

    // Record per-frame measurements.
    position.push(fr.position);
    velocity.push(fr.velocity);
    const sp = Math.hypot(fr.velocity.x, fr.velocity.y);
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

  if (terminus === null) {
    // Reached the end of the supplied trajectory without a terminus condition.
    // Did we reach spec duration?
    const lastFrame = frames[frames.length - 1].frame;
    terminus = {
      frame: Math.min(lastFrame, raw.duration),
      reason: lastFrame >= raw.duration ? "endOfSpec" : "rideStalled",
    };
  }

  const measurements: Measurements = { position, velocity, speed, sledContacts, contactLineIds, airborne };
  const summary = computeSummary(measurements, raw.duration);

  return {
    measurements,
    events,
    terminus,
    params: P,
    summary,
  };
}

function computeSummary(m: Measurements, specDuration: number): Summary {
  const N = m.airborne.length;
  let contactFrames = 0;
  let airborneFrames = 0;
  let speedSlidingSum = 0;
  let speedAirborneSum = 0;
  let vxSlidingSum = 0;
  let vxAirborneSum = 0;
  let longestContactRun = 0;
  let longestAirborneRun = 0;
  const slideSegments: SlideSegment[] = [];

  let curRun = 0;
  let curRunIsAir = false;
  let runStart = 0;

  for (let i = 0; i < N; i++) {
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
    meanSpeedSliding: contactFrames > 0 ? speedSlidingSum / contactFrames : 0,
    meanSpeedAirborne: airborneFrames > 0 ? speedAirborneSum / airborneFrames : 0,
    meanVxSliding: contactFrames > 0 ? vxSlidingSum / contactFrames : 0,
    meanVxAirborne: airborneFrames > 0 ? vxAirborneSum / airborneFrames : 0,
    slideSegments,
  };
}

/**
 * Signed angle from v0 to v1 in degrees, in [-180, 180].
 * Returns 0 if either vector is zero (no defined direction).
 */
function signedAngleDeg(v0: Vec2, v1: Vec2): number {
  const m0 = Math.hypot(v0.x, v0.y);
  const m1 = Math.hypot(v1.x, v1.y);
  if (m0 === 0 || m1 === 0) return 0;
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
  const frames: RawFrame[] = [];
  for (let f = 0; f <= duration; f++) {
    const rider = engine.getRider(f);
    const updates = engine.getUpdatesAtFrame(f);

    const sledContacts: string[] = [];
    const contactLineIds: number[] = [];
    if (Array.isArray(updates)) {
      const seenPoints = new Set<string>();
      const seenLines = new Set<number>();
      for (const u of updates) {
        if (!u || u.type !== "CollisionUpdate" || !Array.isArray(u.updated)) continue;
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

    frames.push({
      frame: f,
      position: { x: rider.position.x, y: rider.position.y },
      velocity: { x: rider.velocity.x, y: rider.velocity.y },
      sledContacts,
      contactLineIds,
      sledBroken,
      riderEjected,
    });
  }
  return { duration, frames };
}
