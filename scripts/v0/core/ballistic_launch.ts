/**
 * Canonical causal launch acquisition.
 *
 * The detector already owns the simulated prefix. We use it to select the last
 * consecutive airborne sample and summarize the exact gap prefix, then perform
 * one rider read at that anchor to capture the ten-point constraint state.
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

/** Maximum consecutive causal frames inspected before selecting the latest
 * exact rider-state anchor. Only the selected anchor performs a rider read. */
export const BALLISTIC_ANCHOR_SCAN_FRAMES = 4;

export type BallisticLaunchCapture = {
  gapStartFrame: number;
  firstSampleFrame: number;
  /** Inclusive cap from the already-simulated detector window. */
  lastSampleFrame: number;
  /** Launch acquisition is strictly causal and may not sample this frame. */
  targetFrameExclusive: number;
  groundedFrames: number;
};

// deno-lint-ignore no-explicit-any
export function captureBallisticLaunchObservation(
  engine: any,
  det: Detection,
  capture: BallisticLaunchCapture,
): BallisticLaunchObservation | null {
  const lastAllowed = Math.min(
    capture.lastSampleFrame,
    capture.targetFrameExclusive - 1,
    capture.firstSampleFrame + BALLISTIC_ANCHOR_SCAN_FRAMES - 1,
  );
  let anchorFrame: number | null = null;
  let anchorScanFrames = 0;
  for (
    let frame = capture.firstSampleFrame;
    frame <= lastAllowed;
    frame++
  ) {
    if (airborneAt(det, frame) !== true) break;
    const velocity = velocityAt(det, frame);
    if (
      velocity === undefined ||
      !Number.isFinite(velocity.x) ||
      !Number.isFinite(velocity.y)
    ) break;
    anchorFrame = frame;
    anchorScanFrames++;
  }
  if (anchorFrame === null) return null;

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
    anchorScanFrames,
    groundedFrames: capture.groundedFrames,
    airborne: true,
  };
}

/** First causal sample represented by a consecutive launch read. */
export function ballisticLaunchFirstSampleFrame(
  launch: Pick<
    BallisticLaunchObservation,
    "anchorFrame" | "anchorScanFrames"
  >,
): number {
  return launch.anchorFrame - launch.anchorScanFrames + 1;
}

/**
 * Reuse the already-read anchor state for a different scorer interval. This is
 * the only supported way to share one engine read between current-gap
 * completion and next-gap readiness.
 */
export function rebaseBallisticLaunchObservation(
  det: Detection,
  launch: BallisticLaunchObservation,
  gapStartFrame: number,
): BallisticLaunchObservation | null {
  const prefix = summarizeBallisticAxisPrefix(
    det,
    { startFrame: gapStartFrame },
    launch.anchorFrame,
  );
  if (
    prefix === null ||
    prefix.startFrame !== gapStartFrame ||
    prefix.prefixEndFrame !== launch.anchorFrame
  ) return null;
  return {
    ...launch,
    gapStartFrame,
    prefix: {
      ...prefix,
      displacementYByFrame: prefixDisplacements(
        det,
        gapStartFrame,
        launch.anchorFrame,
      ),
    },
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
