/**
 * Shared causal features at the incoming contact of an unbuilt arc.
 *
 * This module contains no fitted coefficients and no inference. It is the
 * single source of truth used by the canonical readiness extractor and by
 * study-only reference models.
 */

import type { IncomingKinematics } from "../core/ballistic_projection.ts";
import type { AxisValues } from "../types.ts";

export type ReadinessBoundaryState =
  & Pick<IncomingKinematics, "speed" | "comAngleDeg">
  & Partial<IncomingKinematics>;

export type ArcProposalFeatureContext = {
  proposalTargets: AxisValues;
  incomingGapFrameCount?: number;
};

export const READINESS_BASE_FEATURE_NAMES = [
  "intercept",
  "speed",
  "speed2",
  "speed3",
  "angle",
  "angle2",
  "angle3",
  "pose_relative",
  "pose_relative_abs",
  "pose_relative2",
  "pose_missing",
  "pose_rate",
  "pose_rate_abs",
  "pose_rate2",
  "pose_rate_missing",
  "log_duration",
  "log_duration2",
  "hinge:speed:-1",
  "hinge:speed:0",
  "hinge:speed:1",
  "hinge:angle:-1",
  "hinge:angle:-0.5",
  "hinge:angle:0",
  "hinge:angle:0.5",
  "hinge:angle:1",
  "hinge:pose:-1",
  "hinge:pose:-0.5",
  "hinge:pose:0",
  "hinge:pose:0.5",
  "hinge:pose:1",
  "hinge:rate:-1",
  "hinge:rate:0",
  "hinge:rate:1",
  "hinge:duration:-1",
  "hinge:duration:0",
  "hinge:duration:1",
  "target:air",
  "missing:air",
  "target:speed",
  "missing:speed",
  "target:impact",
  "missing:impact",
  "target:elevation",
  "missing:elevation",
  "target:amplitude",
  "missing:amplitude",
  "target:grain",
  "missing:grain",
  "speed_x_angle",
  "speed_x_pose",
  "angle_x_pose",
  "angle_x_duration",
  "impact_x_angle",
  "impact_x_speed",
  "air_x_duration",
  "target_speed_x_speed",
] as const;

export function readinessBaseFeatureVector(
  incoming: ReadinessBoundaryState,
  context: ArcProposalFeatureContext,
): number[] {
  const speed = clamp((incoming.speed - 9) / 3, -3, 3);
  const angle = clamp(((incoming.comAngleDeg ?? 0) - 10) / 20, -3, 3);
  const poseMissing = incoming.sledPoseDeg == null ? 1 : 0;
  const pose = incoming.sledPoseDeg == null ||
      incoming.comAngleDeg === null
    ? 0
    : clamp(
      wrappedDegrees(incoming.sledPoseDeg - incoming.comAngleDeg) / 90,
      -2,
      2,
    );
  const rateMissing =
    incoming.sledPoseRateDegPerFrame == null ? 1 : 0;
  const rate = incoming.sledPoseRateDegPerFrame == null
    ? 0
    : clamp(incoming.sledPoseRateDegPerFrame / 10, -3, 3);
  const duration = clamp(
    Math.log(Math.max(1, context.incomingGapFrameCount ?? 32) / 32),
    -2,
    2,
  );
  const targets = context.proposalTargets;
  const air = centeredTarget(targets.air);
  const targetSpeed = centeredTarget(targets.speed);
  const impact = centeredTarget(targets.impact);
  const elevation = centeredTarget(targets.elevation);
  const amplitude = centeredTarget(targets.amplitude);
  const grain = centeredTarget(targets.grain);
  return [
    1,
    speed,
    speed * speed,
    speed * speed * speed,
    angle,
    angle * angle,
    angle * angle * angle,
    pose,
    Math.abs(pose),
    pose * pose,
    poseMissing,
    rate,
    Math.abs(rate),
    rate * rate,
    rateMissing,
    duration,
    duration * duration,
    Math.max(0, speed + 1),
    Math.max(0, speed),
    Math.max(0, speed - 1),
    Math.max(0, angle + 1),
    Math.max(0, angle + 0.5),
    Math.max(0, angle),
    Math.max(0, angle - 0.5),
    Math.max(0, angle - 1),
    Math.max(0, pose + 1),
    Math.max(0, pose + 0.5),
    Math.max(0, pose),
    Math.max(0, pose - 0.5),
    Math.max(0, pose - 1),
    Math.max(0, rate + 1),
    Math.max(0, rate),
    Math.max(0, rate - 1),
    Math.max(0, duration + 1),
    Math.max(0, duration),
    Math.max(0, duration - 1),
    air,
    targets.air === undefined ? 1 : 0,
    targetSpeed,
    targets.speed === undefined ? 1 : 0,
    impact,
    targets.impact === undefined ? 1 : 0,
    elevation,
    targets.elevation === undefined ? 1 : 0,
    amplitude,
    targets.amplitude === undefined ? 1 : 0,
    grain,
    targets.grain === undefined ? 1 : 0,
    speed * angle,
    speed * pose,
    angle * pose,
    angle * duration,
    impact * angle,
    impact * speed,
    air * duration,
    targetSpeed * speed,
  ];
}

function centeredTarget(value: number | undefined): number {
  return value === undefined ? 0 : (value - 0.5) * 2;
}

function wrappedDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
