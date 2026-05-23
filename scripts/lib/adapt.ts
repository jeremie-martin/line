/**
 * Per-move adaptation: choose move parameters as a function of the rider's
 * incoming state at `opts.at`. Replaces the static defaults that each move
 * used to hard-code.
 *
 * Each `adapt*` function takes (userOpts, rider) and returns a fully
 * resolved parameter set. User-passed values always win — adapters only
 * fill in the params the user didn't specify.
 *
 * Empirical basis: rules below were derived from parameter sweeps
 * (preheat slide → second move at various target frames; record what
 * combination survives). See probe history in git for the sweep code.
 */

import { type Vec2 } from "./detector.ts";
import { jitter, jitterInt } from "./rng.ts";

/** Convenience: an RNG that an adapter may use to jitter chosen defaults. */
export type AdaptRng = (() => number) | undefined;

/** A snapshot of the rider's state at the moment a move is being placed. */
export type IncomingState = {
  pos: Vec2;
  velocity: Vec2;
  /** |velocity|. */
  speed: number;
  /** atan2(vy, vx) in degrees. 0° = horizontal right; 90° = straight down. */
  angleDeg: number;
};

/** Read the rider state at `frame` from an lr-core engine. */
// deno-lint-ignore no-explicit-any
export function readIncoming(engine: any, frame: number): IncomingState {
  const rider = engine.getRider(frame);
  const v = rider.velocity;
  const speed = Math.hypot(v.x, v.y);
  const angleDeg = (Math.atan2(v.y, v.x) * 180) / Math.PI;
  return {
    pos: { x: rider.position.x, y: rider.position.y },
    velocity: { x: v.x, y: v.y },
    speed,
    angleDeg,
  };
}

// ────────── Slide / Curve ──────────
//
// Rules:
//  - low incoming angle (< 25°): traditional 20° → 3° pattern works
//  - moderate incoming angle (25°–55°): tangent-match by approaching the
//    incoming angle, then flatten to ~3°
//  - steep incoming angle (≥ 55°): match incoming closely (within 5°) so
//    the perpendicular impact component is small enough to absorb
//  - segmentLength scales with speed: roughly 4× speed gives 4+ contact
//    frames per segment (needed for the persistence rule)

export type ResolvedSlideParams = {
  startAngleDeg: number;
  endAngleDeg: number;
  segments: number;
  segmentLength: number;
  offset: number;
  minDurationFrames: number;
};

export type SlideUserParams = Partial<ResolvedSlideParams>;

export function adaptSlide(userOpts: SlideUserParams, rider: IncomingState, rng?: AdaptRng): ResolvedSlideParams {
  let startAngleDeg = userOpts.startAngleDeg;
  if (startAngleDeg === undefined) {
    if (rider.speed < 6) {
      startAngleDeg = jitter(rng, Math.min(20, Math.max(rider.angleDeg, 3)), 0.2);
    } else {
      startAngleDeg = jitter(rng, Math.min(rider.angleDeg, 65), 0.1);
    }
  }
  const endAngleDeg = userOpts.endAngleDeg ?? jitter(rng, 3, 0.3);
  const segments = userOpts.segments ?? jitterInt(rng, 6, 0.25);
  const segmentLength = userOpts.segmentLength ?? jitter(rng, Math.max(20, Math.ceil(rider.speed * 4)), 0.25);
  const offset = userOpts.offset ?? jitter(rng, 2, 0.3);
  const minDurationFrames = userOpts.minDurationFrames ?? 20;
  return { startAngleDeg, endAngleDeg, segments, segmentLength, offset, minDurationFrames };
}

// ────────── Drop ──────────
//
// Inverse of slide — shallow start, steepens. Adapt:
//  - startAngleDeg matches incoming flow so the catch is graceful
//  - endAngleDeg = startAngleDeg + magnitude (default magnitude 25°)
//  - segmentLength scales with speed (same logic as slide)

export type ResolvedDropParams = {
  startAngleDeg: number;
  endAngleDeg: number;
  segments: number;
  segmentLength: number;
  offset: number;
  minDurationFrames: number;
  minExitVy: number;
};

export type DropUserParams = Partial<ResolvedDropParams>;

export function adaptDrop(userOpts: DropUserParams, rider: IncomingState, rng?: AdaptRng): ResolvedDropParams {
  const startAngleDeg = userOpts.startAngleDeg ?? jitter(rng, Math.max(3, Math.min(rider.angleDeg, 30)), 0.2);
  const dropMagnitude = jitter(rng, 25, 0.25);
  const endAngleDeg = userOpts.endAngleDeg ?? Math.min(60, startAngleDeg + dropMagnitude);
  const segments = userOpts.segments ?? jitterInt(rng, 8, 0.25);
  const segmentLength = userOpts.segmentLength ?? jitter(rng, Math.max(20, Math.ceil(rider.speed * 4)), 0.25);
  const offset = userOpts.offset ?? jitter(rng, 2, 0.3);
  const minDurationFrames = userOpts.minDurationFrames ?? 20;
  const minExitVy = userOpts.minExitVy ?? 1.5;
  return { startAngleDeg, endAngleDeg, segments, segmentLength, offset, minDurationFrames, minExitVy };
}

// ────────── Glide ──────────
//
// Long shallow slide. Adapt segment count + length so the total slide
// duration approximates a target (default 1 second = 40 frames at avg vx).

export type ResolvedGlideParams = {
  angleDeg: number;
  segments: number;
  segmentLength: number;
  offset: number;
  minDurationFrames: number;
};

export type GlideUserParams = Partial<ResolvedGlideParams>;

export function adaptGlide(userOpts: GlideUserParams, rider: IncomingState, rng?: AdaptRng): ResolvedGlideParams {
  const angleDeg = userOpts.angleDeg ?? jitter(rng, 5, 0.4);
  const segmentLength = userOpts.segmentLength ?? jitter(rng, Math.max(20, Math.ceil(rider.speed * 4)), 0.25);
  const segments = userOpts.segments ?? jitterInt(rng, Math.max(4, Math.ceil((60 * Math.max(1, rider.speed)) / segmentLength)), 0.2);
  const offset = userOpts.offset ?? jitter(rng, 2, 0.3);
  const minDurationFrames = userOpts.minDurationFrames ?? 30;
  return { angleDeg, segments, segmentLength, offset, minDurationFrames };
}

// ────────── Wave ──────────

export type ResolvedWaveParams = {
  segments: number;
  segmentLength: number;
  peakAngleDeg: number;
  baselineAngleDeg: number;
  offset: number;
  minDurationFrames: number;
};

export type WaveUserParams = Partial<ResolvedWaveParams>;

export function adaptWave(userOpts: WaveUserParams, rider: IncomingState, rng?: AdaptRng): ResolvedWaveParams {
  const baselineAngleDeg = userOpts.baselineAngleDeg ?? jitter(rng, Math.min(5, Math.max(0, rider.angleDeg - 5)), 0.3);
  const peakAngleDeg = userOpts.peakAngleDeg ?? jitter(rng, 10, 0.3);
  const segments = userOpts.segments ?? jitterInt(rng, 8, 0.25);
  const segmentLength = userOpts.segmentLength ?? jitter(rng, Math.max(20, Math.ceil(rider.speed * 3)), 0.25);
  const offset = userOpts.offset ?? jitter(rng, 2, 0.3);
  const minDurationFrames = userOpts.minDurationFrames ?? 20;
  return { segments, segmentLength, peakAngleDeg, baselineAngleDeg, offset, minDurationFrames };
}

// ────────── Sigmoid ──────────

export type ResolvedSigmoidParams = {
  startAngleDeg: number;
  peakAngleDeg: number;
  segments: number;
  segmentLength: number;
  steepness: number;
  offset: number;
  minDurationFrames: number;
};

export type SigmoidUserParams = Partial<ResolvedSigmoidParams>;

export function adaptSigmoid(userOpts: SigmoidUserParams, rider: IncomingState, rng?: AdaptRng): ResolvedSigmoidParams {
  const startAngleDeg = userOpts.startAngleDeg ?? jitter(rng, Math.min(rider.angleDeg, 10), 0.3);
  const peakAngleDeg = userOpts.peakAngleDeg ?? jitter(rng, Math.max(startAngleDeg + 15, 25), 0.25);
  const segments = userOpts.segments ?? jitterInt(rng, 10, 0.25);
  const segmentLength = userOpts.segmentLength ?? jitter(rng, Math.max(20, Math.ceil(rider.speed * 3)), 0.25);
  const steepness = userOpts.steepness ?? jitter(rng, 8, 0.3);
  const offset = userOpts.offset ?? jitter(rng, 2, 0.3);
  const minDurationFrames = userOpts.minDurationFrames ?? 25;
  return { startAngleDeg, peakAngleDeg, segments, segmentLength, steepness, offset, minDurationFrames };
}

// ────────── Ramp ──────────
//
// Single upward line. Needs vx to launch from. Refuses (returns a flag)
// if the rider has insufficient horizontal velocity.

export type ResolvedRampParams = {
  angleDeg: number;
  length: number;
  offset: number;
  minAirborneFramesAfter: number;
  /** True if rider has too little vx to launch. The move's place() can
   * still proceed; verify() will report drift. */
  insufficientVx: boolean;
};

export type RampUserParams = Partial<Omit<ResolvedRampParams, "insufficientVx">>;

export function adaptRamp(userOpts: RampUserParams, rider: IncomingState, rng?: AdaptRng): ResolvedRampParams {
  const insufficientVx = rider.velocity.x < 1.5;
  const baseAngle = rider.velocity.x < 3 ? -15 : rider.velocity.x < 6 ? -25 : -35;
  const angleDeg = userOpts.angleDeg ?? jitter(rng, baseAngle, 0.2);
  const length = userOpts.length ?? jitter(rng, Math.max(20, Math.ceil(rider.velocity.x * 8)), 0.25);
  const offset = userOpts.offset ?? jitter(rng, 2, 0.3);
  const minAirborneFramesAfter = userOpts.minAirborneFramesAfter ?? 8;
  return { angleDeg, length, offset, minAirborneFramesAfter, insufficientVx };
}

// ────────── Catch ──────────

export type ResolvedCatchParams = {
  halfWidth: number;
  frameTolerance: number;
};

export type CatchUserParams = Partial<ResolvedCatchParams>;

export function adaptCatch(userOpts: CatchUserParams, rider: IncomingState, rng?: AdaptRng): ResolvedCatchParams {
  const halfWidth = userOpts.halfWidth ?? jitter(rng, Math.max(6, Math.ceil(rider.velocity.x * 2.5)), 0.25);
  const frameTolerance = userOpts.frameTolerance ?? 1;
  return { halfWidth, frameTolerance };
}

// ────────── Brake ──────────

export type ResolvedBrakeParams = {
  angleDeg: number;
  length: number;
  offset: number;
  minVxDrop: number;
};

export type BrakeUserParams = Partial<ResolvedBrakeParams>;

export function adaptBrake(userOpts: BrakeUserParams, rider: IncomingState, rng?: AdaptRng): ResolvedBrakeParams {
  const baseAngle = rider.velocity.x < 3 ? -20 : rider.velocity.x < 6 ? -30 : -40;
  const angleDeg = userOpts.angleDeg ?? jitter(rng, baseAngle, 0.2);
  const length = userOpts.length ?? jitter(rng, Math.max(30, Math.ceil(rider.velocity.x * 12)), 0.25);
  const offset = userOpts.offset ?? jitter(rng, 2, 0.3);
  const minVxDrop = userOpts.minVxDrop ?? 0.5;
  return { angleDeg, length, offset, minVxDrop };
}

// ────────── Kicker / BounceStrip / HalfPipe / Loop / Jump ──────────

export type ResolvedKickerParams = {
  inAngleDeg: number;
  outAngleDeg: number;
  segmentLength: number;
  offset: number;
};

export type KickerUserParams = Partial<ResolvedKickerParams>;

export function adaptKicker(userOpts: KickerUserParams, rider: IncomingState, rng?: AdaptRng): ResolvedKickerParams {
  const inAngleDeg = userOpts.inAngleDeg ?? jitter(rng, Math.min(rider.angleDeg, 5), 0.3);
  const outAngleDeg = userOpts.outAngleDeg ?? jitter(rng, -25, 0.25);
  const segmentLength = userOpts.segmentLength ?? jitter(rng, Math.max(15, Math.ceil(rider.speed * 3)), 0.25);
  const offset = userOpts.offset ?? jitter(rng, 2, 0.3);
  return { inAngleDeg, outAngleDeg, segmentLength, offset };
}

export type ResolvedBounceStripParams = {
  bumpCount: number;
  bumpSpacing: number;
  bumpHalfWidth: number;
};

export type BounceStripUserParams = Partial<ResolvedBounceStripParams>;

export function adaptBounceStrip(userOpts: BounceStripUserParams, rider: IncomingState, rng?: AdaptRng): ResolvedBounceStripParams {
  // bumpCount and bumpSpacing affect timing (each bump fires at a specific
  // frame relative to atFrame). Don't jitter timing.
  const bumpCount = userOpts.bumpCount ?? 4;
  const bumpSpacing = userOpts.bumpSpacing ?? 12;
  // bumpHalfWidth is a shape param — jitter freely.
  const bumpHalfWidth = userOpts.bumpHalfWidth ?? jitter(rng, Math.max(4, Math.ceil(rider.velocity.x * 2)), 0.25);
  return { bumpCount, bumpSpacing, bumpHalfWidth };
}

export type ResolvedHalfPipeParams = {
  peakDescentDeg: number;
  segments: number;
  segmentLength: number;
  offset: number;
  minDurationFrames: number;
};

export type HalfPipeUserParams = Partial<ResolvedHalfPipeParams>;

export function adaptHalfPipe(userOpts: HalfPipeUserParams, rider: IncomingState, rng?: AdaptRng): ResolvedHalfPipeParams {
  const basePeak = rider.speed < 4 ? 15 : 25;
  const peakDescentDeg = userOpts.peakDescentDeg ?? jitter(rng, basePeak, 0.25);
  const segments = userOpts.segments ?? jitterInt(rng, 12, 0.2);
  const segmentLength = userOpts.segmentLength ?? jitter(rng, Math.max(15, Math.ceil(rider.speed * 3)), 0.25);
  const offset = userOpts.offset ?? jitter(rng, 2, 0.3);
  const minDurationFrames = userOpts.minDurationFrames ?? 25;
  return { peakDescentDeg, segments, segmentLength, offset, minDurationFrames };
}

export type ResolvedLoopParams = {
  radius: number;
  segments: number;
  sweepDeg: number;
  minSweepDeg: number;
  /** True if speed too low to attempt a loop. */
  insufficientSpeed: boolean;
};

export type LoopUserParams = Partial<Omit<ResolvedLoopParams, "insufficientSpeed">>;

export function adaptLoop(userOpts: LoopUserParams, rider: IncomingState, rng?: AdaptRng): ResolvedLoopParams {
  const minRadiusForSpeed = Math.max(20, (rider.speed * rider.speed) / 0.35);
  const radius = userOpts.radius ?? jitter(rng, minRadiusForSpeed, 0.2);
  const segments = userOpts.segments ?? jitterInt(rng, 24, 0.15);
  // sweepDeg affects how long the loop is; treat as timing-adjacent — no jitter.
  const sweepDeg = userOpts.sweepDeg ?? 270;
  const minSweepDeg = userOpts.minSweepDeg ?? 180;
  const insufficientSpeed = rider.speed < 3;
  return { radius, segments, sweepDeg, minSweepDeg, insufficientSpeed };
}

export type ResolvedJumpParams = {
  airDuration: number;
  launchAngleDeg: number;
  rampLength: number;
  catchHalfWidth: number;
  frameTolerance: number;
};

export type JumpUserParams = Partial<ResolvedJumpParams>;

export function adaptJump(userOpts: JumpUserParams, rider: IncomingState, rng?: AdaptRng): ResolvedJumpParams {
  // airDuration defines WHEN the landing fires; treat as timing — no jitter.
  const airDuration = userOpts.airDuration ?? 30;
  const baseLaunch = rider.velocity.x < 3 ? -15 : -25;
  const launchAngleDeg = userOpts.launchAngleDeg ?? jitter(rng, baseLaunch, 0.2);
  const rampLength = userOpts.rampLength ?? jitter(rng, Math.max(25, Math.ceil(rider.velocity.x * 8)), 0.25);
  const catchHalfWidth = userOpts.catchHalfWidth ?? jitter(rng, Math.max(6, Math.ceil(rider.velocity.x * 2.5)), 0.25);
  const frameTolerance = userOpts.frameTolerance ?? 2;
  return { airDuration, launchAngleDeg, rampLength, catchHalfWidth, frameTolerance };
}
