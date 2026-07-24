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
  /*
   * The terminal public state must carry the exact constraint state that
   * produced its velocity and pose. The per-frame callback intentionally
   * avoids allocating point snapshots for intermediate aggregate samples.
   */
  const terminalIncoming = incoming as BallisticState | null;
  if (terminalIncoming !== null) {
    incoming = {
      ...terminalIncoming,
      constraintState: advanced.constraintState,
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
