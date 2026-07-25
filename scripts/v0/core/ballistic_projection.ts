/**
 * Canonical collision-free projection contract.
 *
 * State acquisition produces one `BallisticLaunchObservation`. This module
 * owns all deterministic propagation and prefix/suffix composition used by
 * readiness. It does not know authored target utility, catchability, candidate
 * ranking, or search policy.
 */

import {
  CALIB,
  ELEVATION,
  netDyToElevation,
} from "../types.ts";
import {
  advanceConstraintBallisticState,
  advanceConstraintBallisticTrajectory,
  BALLISTIC_POINT_IDS,
  cloneConstraintBallisticState,
  type ConstraintBallisticState,
} from "./ballistic_micro_sim.ts";
import type { BallisticAxisPrefixSummary } from "./measure.ts";
import type { GapFit } from "./substrate.ts";

export type BallisticObservedPrefix = BallisticAxisPrefixSummary & {
  /** Cumulative vertical displacement, zero at the scorer-gap start. */
  displacementYByFrame?: number[];
};

export type BallisticState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  /** CoM velocity direction in degrees, positive = screen-down. */
  comAngleDeg: number | null;
  /** Sled TAIL->NOSE pose in degrees, positive = screen-down. */
  sledPoseDeg: number | null;
  /** Frame-to-frame sled-pose angular velocity in degrees/frame. */
  sledPoseRateDegPerFrame: number | null;
  /** Exact ten-point/previous-point state at `anchorFrame`. */
  constraintState?: ConstraintBallisticState;
};

export type IncomingKinematics = Pick<
  BallisticState,
  | "vx"
  | "vy"
  | "speed"
  | "comAngleDeg"
  | "sledPoseDeg"
  | "sledPoseRateDegPerFrame"
> & {
  /** Predicted binding integrity at the incoming boundary when available. */
  riderMounted?: boolean;
  sledIntact?: boolean;
};

/**
 * Normalized articulation quantities consumed by readiness. Keeping their
 * derivation beside the propagated primitive state gives production,
 * telemetry, and the predictor benchmark one physical source of truth.
 */
export type BallisticArticulationFeatures = readonly [
  relativeX: number,
  relativeY: number,
  relativeVx: number,
  relativeVy: number,
  bodyPoseRelative: number,
  sledLength: number,
  bodyLength: number,
];

export function ballisticArticulationFeatures(
  state: Pick<BallisticState, "constraintState" | "comAngleDeg">,
): BallisticArticulationFeatures | null {
  const constraint = state.constraintState;
  if (constraint === undefined) return null;
  const bodyIds = [
    "BUTT",
    "SHOULDER",
    "RHAND",
    "LHAND",
    "LFOOT",
    "RFOOT",
  ] as const;
  const assemblyIds = [
    "PEG",
    "TAIL",
    "NOSE",
    "STRING",
    ...bodyIds,
  ] as const;
  const centroid = (
    ids: readonly (keyof typeof constraint.points)[],
  ) => {
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    for (const id of ids) {
      const point = constraint.points[id];
      x += point.x;
      y += point.y;
      vx += point.vx;
      vy += point.vy;
    }
    return {
      x: x / ids.length,
      y: y / ids.length,
      vx: vx / ids.length,
      vy: vy / ids.length,
    };
  };
  const body = centroid(bodyIds);
  const assembly = centroid(assemblyIds);
  const tail = constraint.points.TAIL;
  const nose = constraint.points.NOSE;
  const butt = constraint.points.BUTT;
  const shoulder = constraint.points.SHOULDER;
  const bodyPose = Math.atan2(
    shoulder.y - butt.y,
    shoulder.x - butt.x,
  ) * 180 / Math.PI;
  const referenceAngle = state.comAngleDeg ?? 0;
  return [
    clamp((assembly.x - body.x) / 20, -3, 3),
    clamp((assembly.y - body.y) / 20, -3, 3),
    clamp((assembly.vx - body.vx) / 5, -3, 3),
    clamp((assembly.vy - body.vy) / 5, -3, 3),
    clamp(wrappedDegrees(bodyPose - referenceAngle) / 90, -2, 2),
    clamp(Math.hypot(nose.x - tail.x, nose.y - tail.y) / 20, 0, 2),
    clamp(
      Math.hypot(
        shoulder.x - butt.x,
        shoulder.y - butt.y,
      ) / 10,
      0,
      2,
    ),
  ];
}

/**
 * One causal hand-off from exact simulation to collision-free projection.
 * `prefix` is measured over `[gapStartFrame, anchorFrame]`, inclusive.
 */
export type BallisticLaunchObservation = {
  gapStartFrame: number;
  anchorFrame: number;
  state: BallisticState;
  prefix: BallisticObservedPrefix;
  /** Diagnostic contact occupancy between the preceding catch and anchor. */
  groundedFrames: number;
  /** Must be true before collision-free projection is legal. */
  airborne: boolean;
};

/**
 * Compiler-only extension. GapFit belongs to the frozen evaluator contract, so
 * predictor metadata must not be added to core/substrate.ts.
 */
export type BallisticFitFields = {
  ballisticLaunch?: BallisticLaunchObservation;
};

export type BallisticGapFit = GapFit & BallisticFitFields;

export function ballisticLaunchOf(
  fit: GapFit | BallisticFitFields,
): BallisticLaunchObservation | undefined {
  return (fit as BallisticFitFields).ballisticLaunch;
}

export function copyBallisticFitFields(
  fit: GapFit | BallisticFitFields,
  options: { clone?: boolean } = {},
): BallisticFitFields {
  const launch = ballisticLaunchOf(fit);
  if (launch === undefined) return {};
  return {
    ballisticLaunch: options.clone === true
      ? cloneBallisticLaunchObservation(launch)
      : launch,
  };
}

/**
 * The target boundary is intentionally frame-explicit: pre-contact position
 * and incoming velocity do not pretend to be one ordinary engine-frame state.
 */
export type IncomingContactBoundary = {
  targetFrame: number;
  preContactFrame: number;
  preContact: BallisticState;
  incomingVelocityFrame: number;
  incoming: IncomingKinematics;
  /** Collision-free point/body state projected to the authored contact frame. */
  projectedContactFrame: number;
  projectedContact: BallisticState;
};

/**
 * Physical projection of one contact-to-contact interval. Air occupancy uses
 * the exact prefix plus a collision-free suffix; a caller that owns a future
 * contact must apply its terminal-occupancy convention explicitly.
 */
export type BallisticGapProjection = {
  gapStartFrame: number;
  targetFrame: number;
  frameCount: number;
  meanSpeedPx: number;
  airFramesWithCollisionFreeSuffix: number;
  elevation: number | null;
  amplitude: number | null;
  boundary: IncomingContactBoundary;
};

export function cloneBallisticLaunchObservation(
  launch: BallisticLaunchObservation,
): BallisticLaunchObservation {
  return {
    ...launch,
    state: {
      ...launch.state,
      ...(launch.state.constraintState === undefined
        ? {}
        : {
          constraintState: cloneConstraintBallisticState(
            launch.state.constraintState,
          ),
        }),
    },
    prefix: {
      ...launch.prefix,
      ...(launch.prefix.displacementYByFrame === undefined
        ? {}
        : {
          displacementYByFrame: [
            ...launch.prefix.displacementYByFrame,
          ],
        }),
    },
  };
}

/** Propagate one coherent primitive state; speed and angle are always derived. */
export function propagateBallisticState(
  state: BallisticState,
  dtFrames: number,
): BallisticState {
  const dt = Math.max(0, Math.round(dtFrames));
  if (state.constraintState === undefined) {
    throw new Error(
      `constraint state is required for canonical ballistic propagation`,
    );
  }
  const advanced = advanceConstraintBallisticState(
    state.constraintState,
    dt,
    ELEVATION.GRAVITY_PX_PER_FRAME2,
  );
  if (advanced === null) {
    throw new Error(`constraint ballistic propagation failed`);
  }
  return stateFromPrimitive(
    advanced.arrival,
    advanced.orientation.sledPoseDeg,
    advanced.orientation.sledPoseRateDegPerFrame,
    advanced.constraintState,
  );
}

/**
 * Project and compose `[gapStartFrame, targetFrame]` inclusively. The exact
 * observed prefix is reused; only frames after `anchorFrame` are predicted.
 */

/*
 * Closed-form gap projection: the same outputs, without stepping the kernel.
 *
 * In free flight every constraint moves its two points by equal and opposite
 * amounts, there are no per-point masses, and the joint passes only read
 * positions, so the SUM of the ten point positions is invariant under the whole
 * solve. The ten-point system centre therefore follows exact Verlet projectile
 * motion, and the rider - which is NOT itself ballistic, being coupled to the
 * sled through the binds - is carried on the offset it held at launch:
 *
 *   S_k = S_0 + k*VS_0 + g*k*(k+1)/2      R_k = S_k + (R_0 - S_0)
 *
 * The per-frame loop needs only `speed` and `vy`; pose is needed at the two
 * captured frames alone. So every frame costs a hypot and a few adds instead of
 * 135 constraint solves. Measured against the exact kernel on the frozen
 * corpus of 202,752 real call sites: 0.58 px position, 0.034 px/frame speed,
 * 0.20 deg angle, at 451 ns per prediction against 19,806 - 44x cheaper - and
 * with sled pose taken from the system's conserved angular momentum rather than
 * a two-point finite difference.
 *
 * THIS IS THE DEFAULT. `LR_BALLISTIC_CLOSED_FORM=0` restores the exact kernel
 * for A/B work.
 *
 * The exact kernel was never a free choice, it was an unpriced one: it charges
 * nothing to the frame budget, so a near-complete shadow simulation ran beside
 * the real one - 31.5% of all frames the compiler simulated, and up to 0.92
 * unbilled per billed on air-heavy specs. Under the closed form that is zero,
 * and the budget axis finally measures what it claims to.
 *
 * Adopted at statistical parity, not improvement, which is the correct bar: a
 * worse predictor cannot beat a perfect one. 24 seeds, against the kernel with
 * readiness retrained on each predictor's own corpus - headline 494.91 ->
 * 494.63, delta -0.28, SE 2.50, 95% [-7.00, +6.44]; representative +3.33,
 * legacy_regression -4.61, music +2.34, capability -15.14, no stratum
 * significantly different and validity flat at 2928/3168 against 2932.
 *
 * Known cost, recorded rather than buried: `frontier_pickup_progression` stalls
 * a little more often (750k: 3 of 24 against the kernel's 0 of 16). The failure
 * mode is IDENTICAL in both - `terminus:rideStalled` on a marginal-energy track
 * that the kernel also fails 15 of 16 times at 250k - so this is the same
 * physical margin crossed slightly more often, not a new mechanism, and it is
 * already inside the parity result above.
 */
function ballisticClosedFormEnabled(): boolean {
  return (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.LR_BALLISTIC_CLOSED_FORM !== "0";
}

type ClosedFormOrigin = {
  sx: number;
  sy: number;
  svx: number;
  svy: number;
  offsetX: number;
  offsetY: number;
  poseDeg: number | null;
  poseRateDegPerFrame: number | null;
};

/** Ten-point system centre and the rider's offset from it, read once. */
function closedFormOrigin(state: BallisticState): ClosedFormOrigin | null {
  const constraintState = state.constraintState;
  if (constraintState === undefined) return null;
  let sx = 0;
  let sy = 0;
  let svx = 0;
  let svy = 0;
  let count = 0;
  for (const id of BALLISTIC_POINT_IDS) {
    const point = constraintState.points[id];
    if (point === undefined) continue;
    sx += point.x;
    sy += point.y;
    svx += point.vx;
    svy += point.vy;
    count++;
  }
  if (count === 0) return null;
  sx /= count;
  sy /= count;
  svx /= count;
  svy /= count;
  const tail = constraintState.points.TAIL;
  const nose = constraintState.points.NOSE;
  const poseDeg = tail === undefined || nose === undefined
    ? null
    : Math.atan2(nose.y - tail.y, nose.x - tail.x) * 180 / Math.PI;
  /*
   * Rotation rate from the SYSTEM's angular momentum, not a one-frame finite
   * difference of the TAIL->NOSE segment.
   *
   * A rigid body in free flight conserves angular momentum, so angular velocity
   * is constant and pose is linear in time - linear extrapolation is the right
   * shape, and what was wrong was the slope. Differencing one segment across
   * one frame measures that segment's articulation as much as the body's
   * rotation. With equal masses and no external torque,
   * omega = sum(r x v) / sum(|r|^2) about the system centre, which uses all ten
   * points. Measured on the frozen corpus this takes sled-pose error from
   * 12.76 to 4.64 degrees and pose-rate error from 0.952 to 0.419.
   */
  let angularNumerator = 0;
  let angularDenominator = 0;
  for (const id of BALLISTIC_POINT_IDS) {
    const point = constraintState.points[id];
    if (point === undefined) continue;
    const rx = point.x - sx;
    const ry = point.y - sy;
    angularNumerator += rx * (point.vy - svy) - ry * (point.vx - svx);
    angularDenominator += rx * rx + ry * ry;
  }
  const poseRateDegPerFrame = angularDenominator > 0
    ? angularNumerator / angularDenominator * 180 / Math.PI
    : 0;
  return {
    sx,
    sy,
    svx,
    svy,
    offsetX: state.x - sx,
    offsetY: state.y - sy,
    poseDeg,
    poseRateDegPerFrame,
  };
}

function closedFormStateAt(
  origin: ClosedFormOrigin,
  k: number,
  gravity: number,
): BallisticState {
  const vy = origin.svy + k * gravity;
  const speed = Math.hypot(origin.svx, vy);
  return {
    x: origin.sx + k * origin.svx + origin.offsetX,
    y: origin.sy + k * origin.svy + gravity * k * (k + 1) / 2 + origin.offsetY,
    vx: origin.svx,
    vy,
    speed,
    comAngleDeg: speed > 0
      ? Math.atan2(vy, origin.svx) * 180 / Math.PI
      : null,
    sledPoseDeg: origin.poseDeg === null || origin.poseRateDegPerFrame === null
      ? null
      : origin.poseDeg + k * origin.poseRateDegPerFrame,
    sledPoseRateDegPerFrame: origin.poseRateDegPerFrame,
  };
}

export function projectBallisticGap(
  launch: BallisticLaunchObservation,
  targetFrame: number,
  options: {
    includeElevation?: boolean;
    includeAmplitude?: boolean;
  },
): BallisticGapProjection | null {
  if (
    !launch.airborne ||
    launch.state.constraintState === undefined ||
    !Number.isSafeInteger(targetFrame) ||
    targetFrame <= launch.anchorFrame ||
    launch.prefix.startFrame !== launch.gapStartFrame ||
    launch.prefix.prefixEndFrame !== launch.anchorFrame
  ) return null;

  const dt = targetFrame - launch.anchorFrame;
  const preContactDt = dt - 1;
  let preContact: BallisticState | null = preContactDt === 0
    ? cloneBallisticState(launch.state)
    : null;
  let incoming: BallisticState | null = null;
  let speedSumPx = launch.prefix.speedSumPx;
  let speedFrames = launch.prefix.speedFrames;
  let dy = launch.prefix.dy;
  const displacementYByFrame = options.includeAmplitude === true &&
      launch.prefix.displacementYByFrame !== undefined
    ? [...launch.prefix.displacementYByFrame]
    : null;

  const closedFormOriginState = ballisticClosedFormEnabled()
    ? closedFormOrigin(launch.state)
    : null;
  let terminalConstraintState = launch.state.constraintState;
  if (closedFormOriginState !== null) {
    /*
     * The kernel FAILS CLOSED - `advanceConstraintBallisticTrajectory` returns
     * null and the caller treats the arrival as unusable. The closed form has
     * no such failure, so it must not hand a non-finite value downstream: the
     * readiness extractor would throw on it mid-compile instead of the
     * candidate simply being rejected. Guard the launch state up front rather
     * than per frame; every later value is an affine function of it, so if the
     * origin is finite the whole trajectory is.
     */
    if (
      !Number.isFinite(closedFormOriginState.sx) ||
      !Number.isFinite(closedFormOriginState.sy) ||
      !Number.isFinite(closedFormOriginState.svx) ||
      !Number.isFinite(closedFormOriginState.svy) ||
      !Number.isFinite(closedFormOriginState.offsetX) ||
      !Number.isFinite(closedFormOriginState.offsetY)
    ) return null;
    /*
     * The kernel honours `frameOffset`; this loop measures k from the anchor
     * directly. Production always passes 0 (`captureBallisticLaunchObservation`
     * anchors the packet at the launch frame), so rather than silently
     * disagreeing on a path nobody takes, refuse it.
     */
    if (launch.state.constraintState.frameOffset !== 0) return null;
    for (let k = 1; k <= dt; k++) {
      const projected = closedFormStateAt(
        closedFormOriginState,
        k,
        ELEVATION.GRAVITY_PX_PER_FRAME2,
      );
      speedSumPx += projected.speed;
      speedFrames++;
      dy += projected.vy;
      displacementYByFrame?.push(dy);
      if (k === preContactDt) preContact = projected;
      if (k === dt) incoming = projected;
    }
    /*
     * Articulation is frozen at launch: the exact anchor packet is carried
     * through unadvanced rather than re-solved. Two consequences are real and
     * are stated here rather than discovered later.
     *
     * 1. `riderMounted` / `sledIntact` keep their launch values, so a predicted
     *    IN-FLIGHT dismount cannot occur. The kernel can break either (bind
     *    endurance, `ballistic_micro_sim.ts` `resolveConstraint`; joint cross,
     *    `resolveJoint`), so the `impossibleBinding` gate in
     *    `optimizer/readiness_scoring.ts` is now reachable only from launch
     *    state. This is not a slip: the closed form models the body as RIGID,
     *    and a rigid body never stretches a constraint, so "bindings never
     *    break" is what its own assumption implies. It is an accepted loss of
     *    resolution, bounded by the 24-seed parity measurement.
     *
     * 2. The per-frame suffix reports the ten-point SYSTEM speed while the
     *    prefix carries the engine's six-point BODY speed, so `meanSpeedPx`,
     *    `dy` and `elevation` mix two body definitions across the anchor. The
     *    model asserts the two coincide - it freezes the rider's relative
     *    velocity at zero - which is exactly the approximation measured at
     *    0.034 px/frame of speed error against engine truth.
     */
    terminalConstraintState = launch.state.constraintState;
  } else {
    const advanced = advanceConstraintBallisticTrajectory(
      launch.state.constraintState,
      dt,
      ELEVATION.GRAVITY_PX_PER_FRAME2,
      (relativeFrame, primitive, orientation) => {
        const projected = stateFromPrimitive(
          primitive,
          orientation.sledPoseDeg,
          orientation.sledPoseRateDegPerFrame,
        );
        speedSumPx += projected.speed;
        speedFrames++;
        dy += projected.vy;
        displacementYByFrame?.push(dy);
        if (relativeFrame === preContactDt) preContact = projected;
        if (relativeFrame === dt) incoming = projected;
      },
    );
    if (advanced === null) return null;
    terminalConstraintState = advanced.constraintState;
  }
  /*
   * The terminal public state must carry the exact constraint state that
   * produced its velocity and pose. The per-frame callback intentionally
   * avoids allocating point snapshots for intermediate aggregate samples.
   */
  const terminalIncoming = incoming as BallisticState | null;
  if (terminalIncoming !== null) {
    incoming = {
      ...terminalIncoming,
      constraintState: terminalConstraintState,
    };
  }

  if (preContact === null || incoming === null || speedFrames <= 0) return null;
  const frameCount = targetFrame - launch.gapStartFrame + 1;
  const prefixFrames = launch.anchorFrame - launch.gapStartFrame + 1;
  if (frameCount <= 0 || prefixFrames <= 0) return null;
  const suffixFrames = targetFrame - launch.anchorFrame;
  const prefixAirFrames = Math.max(
    0,
    Math.min(prefixFrames, launch.prefix.airFrames),
  );
  const suffixAirFrames = suffixFrames;
  const elevation = options.includeElevation === true &&
      targetFrame > launch.gapStartFrame
    ? netDyToElevation(
      dy,
      Math.max(0, launch.prefix.v0SpeedPx),
      targetFrame - launch.gapStartFrame,
    )
    : null;
  const amplitude = displacementYByFrame !== null &&
      displacementYByFrame.length === frameCount &&
      frameCount > 1
    ? amplitudeFromDisplacements(displacementYByFrame, dy)
    : null;
  return {
    gapStartFrame: launch.gapStartFrame,
    targetFrame,
    frameCount,
    meanSpeedPx: speedSumPx / speedFrames,
    airFramesWithCollisionFreeSuffix:
      prefixAirFrames + suffixAirFrames,
    elevation,
    amplitude,
    boundary: {
      targetFrame,
      preContactFrame: targetFrame - 1,
      preContact,
      incomingVelocityFrame: targetFrame,
      incoming: incomingKinematics(incoming),
      projectedContactFrame: targetFrame,
      projectedContact: incoming,
    },
  };
}

/**
 * Compose scorer air occupancy after the physics projection. The collision-
 * free suffix reaches the terminal frame airborne; callers explicitly decide
 * whether their policy replaces that one frame with a grounded observation.
 */
export function airFractionWithTerminalOccupancy(
  projection: Pick<
    BallisticGapProjection,
    "airFramesWithCollisionFreeSuffix" | "frameCount"
  >,
  terminalAirborne: boolean,
): number {
  const airFrames = projection.airFramesWithCollisionFreeSuffix -
    (terminalAirborne ? 0 : 1);
  return Math.max(0, Math.min(1, airFrames / projection.frameCount));
}

function amplitudeFromDisplacements(
  displacementYByFrame: readonly number[],
  totalDy: number,
): number {
  const span = displacementYByFrame.length - 1;
  let peak = 0;
  for (let index = 1; index <= span; index++) {
    const chord = (index / span) * totalDy;
    peak = Math.max(peak, chord - displacementYByFrame[index]);
  }
  return Math.min(1, peak / CALIB.AMPLITUDE_CAP);
}

export function incomingKinematics(
  state: BallisticState,
): IncomingKinematics {
  return {
    vx: state.vx,
    vy: state.vy,
    speed: state.speed,
    comAngleDeg: state.comAngleDeg,
    sledPoseDeg: state.sledPoseDeg,
    sledPoseRateDegPerFrame: state.sledPoseRateDegPerFrame,
    ...(state.constraintState === undefined
      ? {}
      : {
        riderMounted: state.constraintState.riderMounted,
        sledIntact: state.constraintState.sledIntact,
      }),
  };
}

function stateFromPrimitive(
  primitive: Readonly<{ x: number; y: number; vx: number; vy: number }>,
  sledPoseDeg: number | null,
  sledPoseRateDegPerFrame: number | null,
  constraintState?: ConstraintBallisticState,
): BallisticState {
  const speed = Math.hypot(primitive.vx, primitive.vy);
  return {
    ...primitive,
    speed,
    comAngleDeg: speed > 0
      ? Math.atan2(primitive.vy, primitive.vx) * 180 / Math.PI
      : null,
    sledPoseDeg,
    sledPoseRateDegPerFrame,
    ...(constraintState === undefined ? {} : { constraintState }),
  };
}

function cloneBallisticState(state: BallisticState): BallisticState {
  return {
    ...state,
    ...(state.constraintState === undefined
      ? {}
      : {
        constraintState: cloneConstraintBallisticState(state.constraintState),
      }),
  };
}

function wrappedDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
