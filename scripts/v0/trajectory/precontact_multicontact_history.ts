/** Candidate-independent full-sled history characterization. */
import type { PlanningState, Vec2 } from "./state.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;
const EPSILON = 1e-8;

export type PrecontactMulticontactHistoryUnavailable = {
  status: "unavailable";
  reason: "too_few_samples" | "missing_full_sled_state" | "nonmonotonic_frames" | "zero_collective_speed";
};

export type PrecontactMulticontactHistoryReady = {
  status: "ready";
  frameCount: number;
  collectiveTurnDeg: number;
  collectiveSpeedDeltaPxPerFrame: number;
  accelerationResidualFromGravityPxPerFrame2: number;
  poseTurnDeg: number;
  angularVelocityDeltaDegPerFrame: number;
  rmsPairDistanceChangePx: number;
  rmsRelativeVelocityChangePxPerFrame: number;
};

export type PrecontactMulticontactHistory =
  | PrecontactMulticontactHistoryUnavailable
  | PrecontactMulticontactHistoryReady;

/**
 * Characterize the continuous full-sled evolution already present before a
 * candidate is generated.  The acceleration residual removes literal engine
 * gravity, leaving only a state transition a pre-contact geometry component
 * could plausibly encode without replaying a candidate outcome.
 */
export function characterizePrecontactMulticontactHistory(
  states: readonly PlanningState[],
  gravityPxPerFrame2: number,
): PrecontactMulticontactHistory {
  if (states.length < 2) return { status: "unavailable", reason: "too_few_samples" };
  if (!Number.isFinite(gravityPxPerFrame2)) return { status: "unavailable", reason: "nonmonotonic_frames" };
  for (let index = 1; index < states.length; index++) {
    if (!(states[index]!.frame > states[index - 1]!.frame)) return { status: "unavailable", reason: "nonmonotonic_frames" };
  }
  const snapshots = states.map(snapshot);
  if (snapshots.some((entry) => entry === null)) return { status: "unavailable", reason: "missing_full_sled_state" };
  const readable = snapshots as FullSledSnapshot[];
  const first = readable[0]!;
  const last = readable[readable.length - 1]!;
  const elapsedFrames = states[states.length - 1]!.frame - states[0]!.frame;
  const firstSpeed = length(first.collectiveVelocity);
  const lastSpeed = length(last.collectiveVelocity);
  if (!(firstSpeed > EPSILON) || !(lastSpeed > EPSILON)) return { status: "unavailable", reason: "zero_collective_speed" };
  const acceleration = scale(subtract(last.collectiveVelocity, first.collectiveVelocity), 1 / elapsedFrames);
  const accelerationResidual = length({ x: acceleration.x, y: acceleration.y - gravityPxPerFrame2 });
  const relativeVelocityChange = rms(last.relativeVelocities.map((velocity, index) =>
    length(subtract(velocity, first.relativeVelocities[index]!)),
  ));
  return {
    status: "ready",
    frameCount: elapsedFrames + 1,
    collectiveTurnDeg: angleDeltaDeg(first.collectiveVelocity, last.collectiveVelocity),
    collectiveSpeedDeltaPxPerFrame: lastSpeed - firstSpeed,
    accelerationResidualFromGravityPxPerFrame2: accelerationResidual,
    poseTurnDeg: angleDeltaDeg(first.bodyAxis, last.bodyAxis),
    angularVelocityDeltaDegPerFrame: (last.angularVelocityRadPerFrame - first.angularVelocityRadPerFrame) * 180 / Math.PI,
    rmsPairDistanceChangePx: rms(last.pairDistances.map((distance, index) => distance - first.pairDistances[index]!)),
    rmsRelativeVelocityChangePxPerFrame: relativeVelocityChange,
  };
}

type FullSledSnapshot = {
  collectiveVelocity: Vec2;
  relativeVelocities: Vec2[];
  pairDistances: number[];
  bodyAxis: Vec2;
  angularVelocityRadPerFrame: number;
};

function snapshot(state: PlanningState): FullSledSnapshot | null {
  const points = SLED_POINTS.map((name) => state.points[name]);
  if (points.some((point) => point === undefined || point.velocity === null)) return null;
  const readable = points as Array<NonNullable<typeof points[number]>>;
  const center = mean(readable.map((point) => point.position));
  const collectiveVelocity = mean(readable.map((point) => point.velocity!));
  const relativeVelocities = readable.map((point) => subtract(point.velocity!, collectiveVelocity));
  const pairDistances: number[] = [];
  for (let left = 0; left < readable.length; left++) {
    for (let right = left + 1; right < readable.length; right++) {
      pairDistances.push(length(subtract(readable[left]!.position, readable[right]!.position)));
    }
  }
  const tail = readable[SLED_POINTS.indexOf("TAIL")]!;
  const nose = readable[SLED_POINTS.indexOf("NOSE")]!;
  const bodyAxis = subtract(nose.position, tail.position);
  if (!(length(bodyAxis) > EPSILON)) return null;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < readable.length; index++) {
    const position = subtract(readable[index]!.position, center);
    const velocity = relativeVelocities[index]!;
    numerator += position.x * velocity.y - position.y * velocity.x;
    denominator += position.x * position.x + position.y * position.y;
  }
  if (!(denominator > EPSILON) || !Number.isFinite(numerator)) return null;
  return { collectiveVelocity, relativeVelocities, pairDistances, bodyAxis, angularVelocityRadPerFrame: numerator / denominator };
}

function mean(values: readonly Vec2[]): Vec2 {
  return values.reduce(
    (sum, value) => ({ x: sum.x + value.x / values.length, y: sum.y + value.y / values.length }),
    { x: 0, y: 0 },
  );
}

function rms(values: readonly number[]): number {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value / values.length, 0));
}

function angleDeltaDeg(from: Vec2, to: Vec2): number {
  let delta = (Math.atan2(to.y, to.x) - Math.atan2(from.y, from.x)) * 180 / Math.PI;
  while (delta <= -180) delta += 360;
  while (delta > 180) delta -= 360;
  return delta;
}

function subtract(left: Vec2, right: Vec2): Vec2 { return { x: left.x - right.x, y: left.y - right.y }; }
function scale(value: Vec2, amount: number): Vec2 { return { x: value.x * amount, y: value.y * amount }; }
function length(value: Vec2): number { return Math.hypot(value.x, value.y); }
