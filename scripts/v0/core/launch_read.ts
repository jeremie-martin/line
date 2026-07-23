/**
 * Single source of truth for the smoothed launch-velocity read (the short-probe
 * launch fix, commit f23ef60). The estimator averages up to LAUNCH_READ_FRAMES
 * consecutive AIRBORNE velocity reads — each compensated by g·k so that gravity
 * over the read window does not bias the average — then adds a constant vy
 * offset (LAUNCH_VY_OFFSET_PX) that corrects the post-impact-transient
 * under-read of vy.
 *
 * This module is intentionally DEPENDENCY-FREE (no imports) so that both call
 * sites can share it without an import cycle: optimizer/arc_probe.ts imports
 * `axisCost` from core/candidate.ts, so candidate.ts cannot import from
 * arc_probe.ts. The two call sites differ only in where the per-frame velocity
 * comes from (the metered ENGINE in arc_probe.ts vs the DETECTION arrays in
 * candidate.ts) and in the stop predicate (arc_probe.ts also bounds on the
 * fork horizon); the float-op sequence of the average is identical and lives
 * here.
 */

/** Frames averaged by the gravity-corrected launch-velocity estimator. */
export const LAUNCH_READ_FRAMES = 4;

/** Constant correction to the launch vy read (px/f). The velocity readout
 *  at the first airborne frames after a catch UNDERESTIMATES vy by a
 *  roughly constant amount (post-impact transient of the constrained body):
 *  signed prediction error vs full-sim truth is flat across dt buckets, so
 *  this is a read offset, not an acceleration. Fitted on 22.7k probe rows
 *  across 6 golden specs (smoothed read: +0.0345; raw read: +0.0265) and
 *  validated out-of-sample — see the calibration note in
 *  docs/ARC_AIMING_FORMALIZATION.md and study_latent_decomposition.ts. */
export const LAUNCH_VY_OFFSET_PX = 0.0345;

/** The articulated alternative's relative-velocity confidence e-fold horizon. */
export const ARTICULATED_RELATIVE_VELOCITY_TAU_FRAMES = 4;

export type LaunchVelocity = { x: number; y: number };
export type LaunchKinematicState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type BodyAssemblyLaunchSample = {
  frame: number;
  body: LaunchKinematicState;
  assembly: LaunchKinematicState;
};

export const ASSEMBLY_SLED_POINT_IDS = ["PEG", "TAIL", "NOSE", "STRING"] as const;
export type AssemblySledPointId = typeof ASSEMBLY_SLED_POINT_IDS[number];

/**
 * Extra launch coordinates used by the next-impact predictor. The public rider
 * coordinate is the six-point body center; `assembly*` is the ten-point center
 * of that body plus PEG/TAIL/NOSE/STRING. In free flight the latter is the
 * conserved ballistic coordinate, while the body moves around it.
 *
 * The state is anchored at the last already-simulated launch sample. `frameOffset`
 * locates that anchor relative to the public suffix/release frame.
 */
export type ArticulatedBallisticState = {
  frameOffset: number;
  assemblyX: number;
  assemblyY: number;
  assemblyVx: number;
  assemblyVy: number;
  relativeX: number;
  relativeY: number;
  relativeVx: number;
  relativeVy: number;
  angularRateRadPerFrame: number;
};

/**
 * Gravity-corrected average of consecutive airborne velocity reads, starting
 * from the launch-frame velocity `v0` and walking forward up to
 * LAUNCH_READ_FRAMES frames. `g` is the per-frame gravity (px/f²).
 *
 * For each step k = 1 .. LAUNCH_READ_FRAMES-1:
 *   - `continueRead(k)` is consulted FIRST; a false result stops the walk
 *     (used for the airborne/horizon gating). When it returns true,
 *   - `readVelocity(k)` supplies the frame-(launch+k) velocity. A null /
 *     undefined / non-finite read also stops the walk.
 *   - otherwise sx += v.x, sy += v.y − g·k, n++.
 *
 * Result: `{ vx: sx/n, vy: sy/n + LAUNCH_VY_OFFSET_PX, n }`. The accumulation
 * order and float operations match the original two hand-mirrored loops
 * exactly (commit f23ef60), so both call sites stay bit-identical.
 */
export function gravityCorrectedLaunchAverage(
  v0: LaunchVelocity,
  g: number,
  continueRead: (k: number) => boolean,
  readVelocity: (k: number) => LaunchVelocity | null | undefined,
): { vx: number; vy: number; n: number } {
  let sx = v0.x;
  let sy = v0.y;
  let n = 1;
  for (let k = 1; k < LAUNCH_READ_FRAMES; k++) {
    if (!continueRead(k)) break;
    const v = readVelocity(k);
    if (v === undefined || v === null || !Number.isFinite(v.x) || !Number.isFinite(v.y)) break;
    sx += v.x;
    sy += v.y - g * k;
    n++;
  }
  const vx = sx / n;
  const vy = sy / n + LAUNCH_VY_OFFSET_PX;
  return { vx, vy, n };
}

/**
 * Reconstruct the body and ten-point assembly centers from the cheap rider
 * readout. The public position/velocity aggregate represents six body points;
 * the four exposed sled points complete the equal-mass ten-point assembly.
 */
// deno-lint-ignore no-explicit-any
export function bodyAssemblyLaunchSampleFromRider(
  rider: any,
  frame: number,
): BodyAssemblyLaunchSample | null {
  const position = rider?.position;
  const velocity = rider?.velocity;
  if (!finiteVector(position) || !finiteVector(velocity)) return null;
  const body = { x: position.x, y: position.y, vx: velocity.x, vy: velocity.y };
  const sledPoints = {} as Record<AssemblySledPointId, LaunchKinematicState>;
  for (const id of ASSEMBLY_SLED_POINT_IDS) {
    const point = rider.get?.(id);
    if (!finiteVector(point?.pos) || !finiteVector(point?.vel)) return null;
    sledPoints[id] = {
      x: point.pos.x,
      y: point.pos.y,
      vx: point.vel.x,
      vy: point.vel.y,
    };
  }
  return { frame, body, assembly: tenPointAssemblyState(body, sledPoints) };
}

/** One authoritative equal-mass reconstruction used by production experiments
 * and corpus capture. The public rider body is the mean of six points; the four
 * exposed sled points complete the ten-point assembly. */
export function tenPointAssemblyState(
  body: LaunchKinematicState,
  sledPoints: Readonly<Record<AssemblySledPointId, LaunchKinematicState>>,
): LaunchKinematicState {
  let x = body.x * 6;
  let y = body.y * 6;
  let vx = body.vx * 6;
  let vy = body.vy * 6;
  for (const id of ASSEMBLY_SLED_POINT_IDS) {
    const point = sledPoints[id];
    x += point.x;
    y += point.y;
    vx += point.vx;
    vy += point.vy;
  }
  return { x: x / 10, y: y / 10, vx: vx / 10, vy: vy / 10 };
}

/**
 * Fit the articulated launch state from one to four consecutive airborne
 * samples. Assembly velocity is gravity-normalized and averaged at the first
 * sample, then advanced to the last-sample anchor. Body-relative phase comes
 * from measured angular displacement, with the instantaneous r×v/r² rate as a
 * one-sample fallback.
 */
export function articulatedBallisticState(
  samples: readonly BodyAssemblyLaunchSample[],
  g: number,
): ArticulatedBallisticState | null {
  if (samples.length === 0) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  let assemblyVx = 0;
  let assemblyVy = 0;
  for (const sample of samples) {
    const dt = sample.frame - first.frame;
    if (
      !Number.isFinite(dt) ||
      !finiteKinematicState(sample.body) ||
      !finiteKinematicState(sample.assembly)
    ) return null;
    assemblyVx += sample.assembly.vx;
    assemblyVy += sample.assembly.vy - g * dt;
  }
  assemblyVx /= samples.length;
  assemblyVy = assemblyVy / samples.length + g * (last.frame - first.frame);

  const relativeX = last.body.x - last.assembly.x;
  const relativeY = last.body.y - last.assembly.y;
  const relativeVx = last.body.vx - last.assembly.vx;
  const relativeVy = last.body.vy - last.assembly.vy;
  const angularRateRadPerFrame = measuredRelativeAngularRate(samples) ??
    instantaneousRelativeAngularRate(relativeX, relativeY, relativeVx, relativeVy);
  const state: ArticulatedBallisticState = {
    frameOffset: last.frame - first.frame,
    assemblyX: last.assembly.x,
    assemblyY: last.assembly.y,
    assemblyVx,
    assemblyVy,
    relativeX,
    relativeY,
    relativeVx,
    relativeVy,
    angularRateRadPerFrame,
  };
  return Object.values(state).every(Number.isFinite) ? state : null;
}

/**
 * Predict the articulated alternative from the first launch-sample frame.
 * This deliberately returns only a kinematic result: it cannot be accidentally
 * fed back into itself with an obsolete anchor.
 */
export function predictArticulatedBallisticArrival(
  state: ArticulatedBallisticState,
  dtFramesFromFirstSample: number,
  g: number,
  relativeVelocityTauFrames = ARTICULATED_RELATIVE_VELOCITY_TAU_FRAMES,
): LaunchKinematicState | null {
  return advanceArticulatedBallisticState(
    state,
    dtFramesFromFirstSample,
    g,
    relativeVelocityTauFrames,
  )?.arrival ?? null;
}

/** Advance and re-anchor the articulated state at the predicted frame. The
 * re-anchored result makes repeated propagation equivalent to one combined
 * propagation instead of retaining an obsolete launch anchor. */
export function advanceArticulatedBallisticState(
  state: ArticulatedBallisticState,
  dtFramesFromFirstSample: number,
  g: number,
  relativeVelocityTauFrames = ARTICULATED_RELATIVE_VELOCITY_TAU_FRAMES,
): {
  arrival: LaunchKinematicState;
  articulation: ArticulatedBallisticState;
} | null {
  const dt = Math.max(0, Math.round(dtFramesFromFirstSample));
  const frameOffset = Math.max(0, Math.round(state.frameOffset));
  if (dt < frameOffset || !(relativeVelocityTauFrames > 0)) return null;
  const anchorDt = dt - frameOffset;
  const assemblyX = state.assemblyX + state.assemblyVx * anchorDt;
  const assemblyY = state.assemblyY + state.assemblyVy * anchorDt +
    0.5 * g * anchorDt * (anchorDt + 1);
  const assemblyVx = state.assemblyVx;
  const assemblyVy = state.assemblyVy + g * anchorDt;
  const rotation = state.angularRateRadPerFrame * anchorDt;
  const relativePosition = rotateVector(state.relativeX, state.relativeY, rotation);
  const relativeVelocity = rotateVector(state.relativeVx, state.relativeVy, rotation);
  const confidence = Math.exp(-anchorDt / relativeVelocityTauFrames);
  const dampedRelativeVelocity = {
    x: confidence * relativeVelocity.x,
    y: confidence * relativeVelocity.y,
  };
  const arrival = {
    x: assemblyX + relativePosition.x,
    y: assemblyY + relativePosition.y,
    vx: assemblyVx + dampedRelativeVelocity.x,
    vy: assemblyVy + dampedRelativeVelocity.y,
  };
  const articulation: ArticulatedBallisticState = {
    frameOffset: 0,
    assemblyX,
    assemblyY,
    assemblyVx,
    assemblyVy,
    relativeX: relativePosition.x,
    relativeY: relativePosition.y,
    relativeVx: dampedRelativeVelocity.x,
    relativeVy: dampedRelativeVelocity.y,
    angularRateRadPerFrame: state.angularRateRadPerFrame,
  };
  return [...Object.values(arrival), ...Object.values(articulation)].every(Number.isFinite)
    ? { arrival, articulation }
    : null;
}

function measuredRelativeAngularRate(
  samples: readonly BodyAssemblyLaunchSample[],
): number | null {
  if (samples.length < 2) return null;
  let weighted = 0;
  let total = 0;
  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1];
    const current = samples[index];
    const ax = previous.body.x - previous.assembly.x;
    const ay = previous.body.y - previous.assembly.y;
    const bx = current.body.x - current.assembly.x;
    const by = current.body.y - current.assembly.y;
    const dt = current.frame - previous.frame;
    if (!(dt > 0)) continue;
    const weight = Math.hypot(ax, ay) * Math.hypot(bx, by);
    if (weight <= 1e-9) continue;
    weighted += weight * wrappedRadians(Math.atan2(by, bx) - Math.atan2(ay, ax)) / dt;
    total += weight;
  }
  return total > 0 ? weighted / total : null;
}

function instantaneousRelativeAngularRate(
  x: number,
  y: number,
  vx: number,
  vy: number,
): number {
  const radius2 = x * x + y * y;
  return radius2 > 1e-9 ? (x * vy - y * vx) / radius2 : 0;
}

function wrappedRadians(value: number): number {
  let out = value % (2 * Math.PI);
  if (out > Math.PI) out -= 2 * Math.PI;
  if (out <= -Math.PI) out += 2 * Math.PI;
  return out;
}

function rotateVector(x: number, y: number, radians: number): { x: number; y: number } {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: x * cosine - y * sine,
    y: x * sine + y * cosine,
  };
}

// deno-lint-ignore no-explicit-any
function finiteVector(value: any): value is { x: number; y: number } {
  return value !== undefined && value !== null &&
    Number.isFinite(value.x) && Number.isFinite(value.y);
}

function finiteKinematicState(
  value: BodyAssemblyLaunchSample["body"],
): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) &&
    Number.isFinite(value.vx) && Number.isFinite(value.vy);
}
