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

export function adaptSlide(userOpts: SlideUserParams, rider: IncomingState): ResolvedSlideParams {
  // startAngleDeg — speed-gated tangent-matching.
  //
  // Low speed (< 6 units/frame): the rider's kinetic energy is small enough
  // that a perpendicular catch is survivable. Use the traditional 20°
  // catch — produces strong deflection and a long slide.
  //
  // Higher speed: need to match the rider's incoming direction more
  // closely so the perpendicular impact doesn't eject them. Tangent-match
  // up to 65° (caps at 65° because beyond that the rider's path is too
  // vertical for any reasonable line geometry to redirect).
  let startAngleDeg = userOpts.startAngleDeg;
  if (startAngleDeg === undefined) {
    if (rider.speed < 6) {
      // Low speed — traditional catch, capped so the line isn't steeper
      // than the rider's incoming direction.
      startAngleDeg = Math.min(20, Math.max(rider.angleDeg, 3));
    } else {
      // Higher speed — tangent-match.
      startAngleDeg = Math.min(rider.angleDeg, 65);
    }
  }

  const endAngleDeg = userOpts.endAngleDeg ?? 3;
  const segments = userOpts.segments ?? 6;
  // segmentLength scales with speed so the rider gets enough contact frames.
  const segmentLength = userOpts.segmentLength ?? Math.max(20, Math.ceil(rider.speed * 4));
  const offset = userOpts.offset ?? 2;
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

export function adaptDrop(userOpts: DropUserParams, rider: IncomingState): ResolvedDropParams {
  // startAngleDeg matches incoming flow.
  const startAngleDeg = userOpts.startAngleDeg ?? Math.max(3, Math.min(rider.angleDeg, 30));
  // endAngleDeg gets steeper by a magnitude.
  const dropMagnitude = 25;
  const endAngleDeg = userOpts.endAngleDeg ?? Math.min(60, startAngleDeg + dropMagnitude);
  const segments = userOpts.segments ?? 8;
  const segmentLength = userOpts.segmentLength ?? Math.max(20, Math.ceil(rider.speed * 4));
  const offset = userOpts.offset ?? 2;
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

export function adaptGlide(userOpts: GlideUserParams, rider: IncomingState): ResolvedGlideParams {
  const angleDeg = userOpts.angleDeg ?? 5;
  // For higher speed, longer segments to maintain a similar slide duration.
  const segmentLength = userOpts.segmentLength ?? Math.max(20, Math.ceil(rider.speed * 4));
  // Target ~1.5s of glide = 60 frames, so segments × segmentLength ≈ 60 × mean_vx.
  const segments = userOpts.segments ?? Math.max(4, Math.ceil((60 * Math.max(1, rider.speed)) / segmentLength));
  const offset = userOpts.offset ?? 2;
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

export function adaptWave(userOpts: WaveUserParams, rider: IncomingState): ResolvedWaveParams {
  // Baseline should be at most rider's incoming angle (so the catch is gentle).
  const baselineAngleDeg = userOpts.baselineAngleDeg ?? Math.min(5, Math.max(0, rider.angleDeg - 5));
  const peakAngleDeg = userOpts.peakAngleDeg ?? 10;
  const segments = userOpts.segments ?? 8;
  const segmentLength = userOpts.segmentLength ?? Math.max(20, Math.ceil(rider.speed * 3));
  const offset = userOpts.offset ?? 2;
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

export function adaptSigmoid(userOpts: SigmoidUserParams, rider: IncomingState): ResolvedSigmoidParams {
  const startAngleDeg = userOpts.startAngleDeg ?? Math.min(rider.angleDeg, 10);
  const peakAngleDeg = userOpts.peakAngleDeg ?? Math.max(startAngleDeg + 15, 25);
  const segments = userOpts.segments ?? 10;
  const segmentLength = userOpts.segmentLength ?? Math.max(20, Math.ceil(rider.speed * 3));
  const steepness = userOpts.steepness ?? 8;
  const offset = userOpts.offset ?? 2;
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

export function adaptRamp(userOpts: RampUserParams, rider: IncomingState): ResolvedRampParams {
  const insufficientVx = rider.velocity.x < 1.5;
  // Angle: gentler for low vx, steeper for high vx (rider has energy to climb)
  const baseAngle = rider.velocity.x < 3 ? -15 : rider.velocity.x < 6 ? -25 : -35;
  const angleDeg = userOpts.angleDeg ?? baseAngle;
  // Length scales with vx
  const length = userOpts.length ?? Math.max(20, Math.ceil(rider.velocity.x * 8));
  const offset = userOpts.offset ?? 2;
  const minAirborneFramesAfter = userOpts.minAirborneFramesAfter ?? 8;
  return { angleDeg, length, offset, minAirborneFramesAfter, insufficientVx };
}

// ────────── Catch ──────────

export type ResolvedCatchParams = {
  halfWidth: number;
  frameTolerance: number;
};

export type CatchUserParams = Partial<ResolvedCatchParams>;

export function adaptCatch(userOpts: CatchUserParams, rider: IncomingState): ResolvedCatchParams {
  // halfWidth: needs to give ≥3 contact frames per persistence rule.
  // The sled passes through the line at roughly vx units/frame. For 3 frames
  // of contact, the line should span >= 3*vx units, so halfWidth >= 1.5*vx.
  // Add safety factor.
  const halfWidth = userOpts.halfWidth ?? Math.max(6, Math.ceil(rider.velocity.x * 2.5));
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

export function adaptBrake(userOpts: BrakeUserParams, rider: IncomingState): ResolvedBrakeParams {
  // Steeper uphill for higher incoming vx (more energy to dissipate).
  const angleDeg = userOpts.angleDeg ?? (rider.velocity.x < 3 ? -20 : rider.velocity.x < 6 ? -30 : -40);
  const length = userOpts.length ?? Math.max(30, Math.ceil(rider.velocity.x * 12));
  const offset = userOpts.offset ?? 2;
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

export function adaptKicker(userOpts: KickerUserParams, rider: IncomingState): ResolvedKickerParams {
  const inAngleDeg = userOpts.inAngleDeg ?? Math.min(rider.angleDeg, 5);
  // Out at sharp negative angle to launch
  const outAngleDeg = userOpts.outAngleDeg ?? -25;
  const segmentLength = userOpts.segmentLength ?? Math.max(15, Math.ceil(rider.speed * 3));
  const offset = userOpts.offset ?? 2;
  return { inAngleDeg, outAngleDeg, segmentLength, offset };
}

export type ResolvedBounceStripParams = {
  bumpCount: number;
  bumpSpacing: number;
  bumpHalfWidth: number;
};

export type BounceStripUserParams = Partial<ResolvedBounceStripParams>;

export function adaptBounceStrip(userOpts: BounceStripUserParams, rider: IncomingState): ResolvedBounceStripParams {
  const bumpCount = userOpts.bumpCount ?? 4;
  const bumpSpacing = userOpts.bumpSpacing ?? 12;
  // Wider bumps for faster riders.
  const bumpHalfWidth = userOpts.bumpHalfWidth ?? Math.max(4, Math.ceil(rider.velocity.x * 2));
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

export function adaptHalfPipe(userOpts: HalfPipeUserParams, rider: IncomingState): ResolvedHalfPipeParams {
  // Peak descent: capped so the rider doesn't lose all speed on the climb.
  const peakDescentDeg = userOpts.peakDescentDeg ?? (rider.speed < 4 ? 15 : 25);
  const segments = userOpts.segments ?? 12;
  const segmentLength = userOpts.segmentLength ?? Math.max(15, Math.ceil(rider.speed * 3));
  const offset = userOpts.offset ?? 2;
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

export function adaptLoop(userOpts: LoopUserParams, rider: IncomingState): ResolvedLoopParams {
  // Centripetal requirement: |v|² / R >= g (approximately).
  // With lr-core gravity ≈ 0.175 / frame², R <= |v|² / 0.175.
  // For some safety margin and to give the rider room to complete:
  const minRadiusForSpeed = Math.max(20, (rider.speed * rider.speed) / 0.35);
  const radius = userOpts.radius ?? minRadiusForSpeed;
  const segments = userOpts.segments ?? 24;
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

export function adaptJump(userOpts: JumpUserParams, rider: IncomingState): ResolvedJumpParams {
  const airDuration = userOpts.airDuration ?? 30;
  // Gentler launch for low vx.
  const launchAngleDeg = userOpts.launchAngleDeg ?? (rider.velocity.x < 3 ? -15 : -25);
  const rampLength = userOpts.rampLength ?? Math.max(25, Math.ceil(rider.velocity.x * 8));
  const catchHalfWidth = userOpts.catchHalfWidth ?? Math.max(6, Math.ceil(rider.velocity.x * 2.5));
  const frameTolerance = userOpts.frameTolerance ?? 2;
  return { airDuration, launchAngleDeg, rampLength, catchHalfWidth, frameTolerance };
}
