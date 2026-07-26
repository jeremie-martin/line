/**
 * Canonical causal launch acquisition.
 *
 * THE ANCHOR IS THE CONFIRMED GEOMETRIC ARC EXIT (core/exit_read.ts
 * `confirmedArcExitFrame`) — a physical fact about the geometry and the
 * trajectory. There is deliberately no forward scan and no alternative anchor
 * rule. A scan existed while the predictor fitted a velocity from several
 * samples; both predictors need exactly one state (ten points plus their
 * previous positions), so buying 0-3 extra exact frames bought nothing while
 * making the anchor a function of the detection-window schedule.
 *
 * The boundary error that retired the scan was ~1e-5 px, measured on the exact
 * constraint kernel, which is now the A/B arm; the shipped closed form sits at
 * ~0.50 px. The argument is unaffected — a later anchor does not make either
 * predictor need fewer states — but do not quote the 1e-5 as a property of the
 * default. See docs/BALLISTIC_READINESS_DECISIONS.md §4.
 *
 * The detector already owns the simulated prefix; we summarize the exact gap
 * prefix from it and perform exactly one rider read, at the anchor.
 */

import {
  getRiderMetered,
  type Detection,
} from "../../lib/detector.ts";
import {
  constraintBallisticOrientationFromState,
  constraintBallisticStateFromRider,
} from "./ballistic_micro_sim.ts";
import {
  type BallisticLaunchObservation,
  type BallisticState,
} from "./ballistic_projection.ts";
import { summarizeBallisticAxisPrefix } from "./measure.ts";
import { airborneAt, velocityAt } from "./substrate.ts";

export type BallisticLaunchCapture = {
  /** Start of the scorer interval this launch completes: the authored contact
   *  where the arc was placed, which is also the outgoing gap's first frame. */
  gapStartFrame: number;
  /** The confirmed geometric arc exit. This is the anchor, verbatim. */
  anchorFrame: number;
  /** The authored contact this launch flies toward. Acquisition is strictly
   *  causal and may not read this frame or any later one. */
  targetFrameExclusive: number;
  groundedFrames: number;
};

// deno-lint-ignore no-explicit-any
export function captureBallisticLaunchObservation(
  engine: any,
  det: Detection,
  capture: BallisticLaunchCapture,
): BallisticLaunchObservation | null {
  const anchorFrame = capture.anchorFrame;
  if (
    !Number.isSafeInteger(anchorFrame) ||
    anchorFrame < capture.gapStartFrame ||
    anchorFrame >= capture.targetFrameExclusive
  ) return null;
  if (airborneAt(det, anchorFrame) !== true) return null;
  const anchorVelocity = velocityAt(det, anchorFrame);
  if (
    anchorVelocity === undefined ||
    !Number.isFinite(anchorVelocity.x) ||
    !Number.isFinite(anchorVelocity.y)
  ) return null;

  const rider = getRiderMetered(engine, anchorFrame);
  if (!riderUsable(rider)) return null;
  const position = rider?.position;
  const velocity = rider?.velocity;
  if (!finiteVector(position) || !finiteVector(velocity)) return null;
  const speed = Math.hypot(velocity.x, velocity.y);
  if (!Number.isFinite(speed)) return null;
  const prefix = summarizeBallisticAxisPrefix(
    det,
    { startFrame: capture.gapStartFrame },
    anchorFrame,
  );
  if (
    prefix === null ||
    prefix.startFrame !== capture.gapStartFrame ||
    prefix.prefixEndFrame !== anchorFrame
  ) return null;
  const prefixWithAmplitude = {
    ...prefix,
    displacementYByFrame: prefixDisplacements(
      det,
      capture.gapStartFrame,
      anchorFrame,
    ),
  };

  const constraintState = constraintBallisticStateFromRider(rider, 0);
  if (constraintState === null) return null;
  const orientation = constraintBallisticOrientationFromState(
    constraintState,
  );
  const state: BallisticState = {
    x: position.x,
    y: position.y,
    vx: velocity.x,
    vy: velocity.y,
    speed,
    comAngleDeg: speed > 0
      ? Math.atan2(velocity.y, velocity.x) * 180 / Math.PI
      : null,
    sledPoseDeg: orientation.sledPoseDeg,
    sledPoseRateDegPerFrame: orientation.sledPoseRateDegPerFrame,
    constraintState,
  };
  return {
    gapStartFrame: capture.gapStartFrame,
    anchorFrame,
    state,
    prefix: prefixWithAmplitude,
    groundedFrames: capture.groundedFrames,
    airborne: true,
  };
}

function prefixDisplacements(
  det: Detection,
  startFrame: number,
  endFrame: number,
): number[] {
  const values = [0];
  let dy = 0;
  for (let frame = startFrame + 1; frame <= endFrame; frame++) {
    const velocity = velocityAt(det, frame);
    if (velocity === undefined) return [];
    dy += velocity.y;
    values.push(dy);
  }
  return values;
}

// deno-lint-ignore no-explicit-any
function riderUsable(rider: any): boolean {
  try {
    if (rider?.get?.("SLED_INTACT")?.isBinded?.() === false) return false;
    if (rider?.get?.("RIDER_MOUNTED")?.isBinded?.() === false) return false;
  } catch {
    // Missing binding accessors are tolerated consistently with probe reads.
  }
  return true;
}

function finiteVector(value: unknown): value is { x: number; y: number } {
  const vector = value as { x?: unknown; y?: unknown } | null | undefined;
  return typeof vector?.x === "number" &&
    typeof vector.y === "number" &&
    Number.isFinite(vector.x) &&
    Number.isFinite(vector.y);
}
