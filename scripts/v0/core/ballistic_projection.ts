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
 * One causal hand-off from exact simulation to collision-free projection.
 * `prefix` is measured over `[gapStartFrame, anchorFrame]`, inclusive.
 */
export type BallisticLaunchObservation = {
  gapStartFrame: number;
  anchorFrame: number;
  state: BallisticState;
  prefix: BallisticObservedPrefix;
  /** Consecutive usable launch samples ending at `anchorFrame`. */
  sampleCount: number;
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

/** Scorer-compatible projection of one contact-to-contact gap. */
export type BallisticGapProjection = {
  gapStartFrame: number;
  targetFrame: number;
  frameCount: number;
  meanSpeedPx: number;
  airFraction: number;
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
  const advanced = state.constraintState === undefined
    ? null
    : advanceConstraintBallisticState(
      state.constraintState,
      dt,
      ELEVATION.GRAVITY_PX_PER_FRAME2,
    );
  if (advanced !== null) {
    return stateFromPrimitive(
      advanced.arrival,
      propagatedPose(state, dt),
      state.sledPoseRateDegPerFrame,
      advanced.constraintState,
    );
  }
  return fallbackBallisticState(state, dt);
}

/**
 * Project and compose `[gapStartFrame, targetFrame]` inclusively. The exact
 * observed prefix is reused; only frames after `anchorFrame` are predicted.
 */
export function projectBallisticGap(
  launch: BallisticLaunchObservation,
  targetFrame: number,
  options: {
    terminalContact: "grounded" | "none";
    includeElevation?: boolean;
    includeAmplitude?: boolean;
  },
): BallisticGapProjection | null {
  if (
    !launch.airborne ||
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

  if (launch.state.constraintState !== undefined) {
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
  } else {
    for (let relativeFrame = 1; relativeFrame <= dt; relativeFrame++) {
      const projected = fallbackBallisticState(launch.state, relativeFrame);
      speedSumPx += projected.speed;
      speedFrames++;
      dy += projected.vy;
      displacementYByFrame?.push(dy);
      if (relativeFrame === preContactDt) preContact = projected;
      if (relativeFrame === dt) incoming = projected;
    }
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
  /*
   * For an authored catch, the detector observes the target frame as grounded
   * while retaining its incoming velocity. Tail/end-of-spec projections have
   * no such correction. Callers must state which boundary they own.
   */
  const suffixAirFrames = Math.max(
    0,
    suffixFrames - (options.terminalContact === "grounded" ? 1 : 0),
  );
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
    airFraction: Math.max(
      0,
      Math.min(1, (prefixAirFrames + suffixAirFrames) / frameCount),
    ),
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

function fallbackBallisticState(
  state: BallisticState,
  dt: number,
): BallisticState {
  const g = ELEVATION.GRAVITY_PX_PER_FRAME2;
  const primitive = {
    x: state.x + state.vx * dt,
    y: state.y + state.vy * dt + 0.5 * g * dt * (dt + 1),
    vx: state.vx,
    vy: state.vy + g * dt,
  };
  return stateFromPrimitive(
    primitive,
    propagatedPose(state, dt),
    state.sledPoseRateDegPerFrame,
  );
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

function propagatedPose(state: BallisticState, dt: number): number | null {
  return state.sledPoseDeg !== null &&
      state.sledPoseRateDegPerFrame !== null
    ? normalizeAngleDeg(
      state.sledPoseDeg + state.sledPoseRateDegPerFrame * dt,
    )
    : state.sledPoseDeg;
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

function normalizeAngleDeg(value: number): number {
  let normalized = ((value + 180) % 360 + 360) % 360 - 180;
  if (normalized === -180) normalized = 180;
  return normalized;
}
