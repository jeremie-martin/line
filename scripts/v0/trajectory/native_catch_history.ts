/**
 * Causal full-sled history available to the native contact sampler.
 *
 * The normal evaluator already owns a flattened sled-position trace through
 * H-2 for pre-clearance, and the candidate probe already owns the exact rider
 * at H.  This characterizer deliberately consumes only those two existing
 * observations: enabling a history-aware proposal must not introduce another
 * engine replay or change the prefix engine's read cursor.
 */
import type { PrecontactMulticontactHistoryReady } from "./precontact_multicontact_history.ts";

export const NATIVE_CATCH_SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;

export type NativeCatchSledPoint = {
  name?: typeof NATIVE_CATCH_SLED_POINTS[number];
  x: number;
  y: number;
  vx: number;
  vy: number;
};

/** The actual sled point that supplies the placement anchor at H. */
export type NativeCatchReferenceFrame = {
  point: typeof NATIVE_CATCH_SLED_POINTS[number];
  x: number;
  y: number;
  velocity: { x: number; y: number };
  speed: number;
  angleDeg: number;
};

const TRACE_STRIDE = NATIVE_CATCH_SLED_POINTS.length * 2;
const HISTORY_FRAMES = 6;
const GRAVITY_PX_PER_FRAME2 = .175;
const EPSILON = 1e-8;

export function readNativeCatchSledPoints(rider: any): NativeCatchSledPoint[] | null {
  const points = NATIVE_CATCH_SLED_POINTS.map((name) => {
    const point = rider?.get?.(name);
    const position = point?.pos;
    const velocity = point?.vel ?? point?.velocity;
    if (
      typeof position?.x !== "number" || !Number.isFinite(position.x) ||
      typeof position?.y !== "number" || !Number.isFinite(position.y) ||
      typeof velocity?.x !== "number" || !Number.isFinite(velocity.x) ||
      typeof velocity?.y !== "number" || !Number.isFinite(velocity.y)
    ) return null;
    return { name, x: position.x, y: position.y, vx: velocity.x, vy: velocity.y };
  });
  return points.some((point) => point === null)
    ? null
    : points as NativeCatchSledPoint[];
}

/**
 * Recover the velocity frame of the same lowest sled point used by
 * `readTargetStateFromRider`. The fallback coordinates are important: that
 * routine retains the rider reference unless a sled point is lower on screen,
 * so this helper must fail closed rather than silently choose a different
 * anchor.
 */
export function nativeCatchReferenceFrame(
  points: readonly NativeCatchSledPoint[] | null,
  fallbackX: number,
  fallbackY: number,
): NativeCatchReferenceFrame | null {
  if (points === null || points.length !== NATIVE_CATCH_SLED_POINTS.length) return null;
  let selected: NativeCatchSledPoint | null = null;
  let sledY = fallbackY;
  for (let index = 0; index < points.length; index++) {
    const point = points[index]!;
    if (point.y > sledY) {
      selected = point;
      sledY = point.y;
    }
  }
  if (selected === null) return null;
  const speed = Math.hypot(selected.vx, selected.vy);
  return {
    point: selected.name ?? NATIVE_CATCH_SLED_POINTS[points.indexOf(selected)]!,
    x: selected.x,
    y: selected.y,
    velocity: { x: selected.vx, y: selected.vy },
    speed,
    angleDeg: speed > EPSILON
      ? Math.atan2(selected.vy, selected.vx) * 180 / Math.PI
      : 0,
  };
}

export function characterizeNativeCatchHistory(
  trace: readonly number[],
  traceFirstFrame: number,
  targetFrame: number,
  targetPoints: readonly NativeCatchSledPoint[] | null,
): PrecontactMulticontactHistoryReady | null {
  if (targetPoints === null || targetPoints.length !== NATIVE_CATCH_SLED_POINTS.length) return null;
  const startFrame = targetFrame - HISTORY_FRAMES;
  const start = tracePointsAt(trace, traceFirstFrame, startFrame);
  const next = tracePointsAt(trace, traceFirstFrame, startFrame + 1);
  if (start === null || next === null) return null;

  const startVelocity = mean(start.map((point, index) => ({
    x: next[index]!.x - point.x,
    y: next[index]!.y - point.y,
  })));
  const endVelocity = mean(targetPoints.map((point) => ({ x: point.vx, y: point.vy })));
  const startSpeed = length(startVelocity);
  const endSpeed = length(endVelocity);
  if (!(startSpeed > EPSILON) || !(endSpeed > EPSILON)) return null;

  const startRelativeVelocities = start.map((point, index) => ({
    x: next[index]!.x - point.x - startVelocity.x,
    y: next[index]!.y - point.y - startVelocity.y,
  }));
  const endRelativeVelocities = targetPoints.map((point) => ({
    x: point.vx - endVelocity.x,
    y: point.vy - endVelocity.y,
  }));
  const startPose = axis(start);
  const nextPose = axis(next);
  const endPose = axis(targetPoints);
  if (startPose === null || nextPose === null || endPose === null) return null;
  const acceleration = {
    x: (endVelocity.x - startVelocity.x) / HISTORY_FRAMES,
    y: (endVelocity.y - startVelocity.y) / HISTORY_FRAMES,
  };

  return {
    status: "ready",
    frameCount: HISTORY_FRAMES + 1,
    collectiveTurnDeg: angleDeltaDeg(startVelocity, endVelocity),
    collectiveSpeedDeltaPxPerFrame: endSpeed - startSpeed,
    accelerationResidualFromGravityPxPerFrame2: Math.hypot(
      acceleration.x,
      acceleration.y - GRAVITY_PX_PER_FRAME2,
    ),
    poseTurnDeg: angleDeltaRad(startPose, endPose) * 180 / Math.PI,
    angularVelocityDeltaDegPerFrame: (
      angularVelocity(targetPoints, endVelocity) - angleDeltaRad(startPose, nextPose)
    ) * 180 / Math.PI,
    rmsPairDistanceChangePx: rms(pairDistances(targetPoints).map((distance, index) =>
      distance - pairDistances(start)[index]!
    )),
    rmsRelativeVelocityChangePxPerFrame: rms(endRelativeVelocities.map((velocity, index) =>
      Math.hypot(
        velocity.x - startRelativeVelocities[index]!.x,
        velocity.y - startRelativeVelocities[index]!.y,
      )
    )),
  };
}

type Point = { x: number; y: number };

function tracePointsAt(
  trace: readonly number[],
  traceFirstFrame: number,
  frame: number,
): Point[] | null {
  const offset = (frame - traceFirstFrame) * TRACE_STRIDE;
  if (offset < 0 || offset + TRACE_STRIDE > trace.length) return null;
  const points: Point[] = [];
  for (let index = 0; index < NATIVE_CATCH_SLED_POINTS.length; index++) {
    const x = trace[offset + index * 2];
    const y = trace[offset + index * 2 + 1];
    if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    points.push({ x, y });
  }
  return points;
}

function axis(points: readonly Point[]): number | null {
  const tail = points[NATIVE_CATCH_SLED_POINTS.indexOf("TAIL")];
  const nose = points[NATIVE_CATCH_SLED_POINTS.indexOf("NOSE")];
  if (tail === undefined || nose === undefined) return null;
  const dx = nose.x - tail.x;
  const dy = nose.y - tail.y;
  return Math.hypot(dx, dy) > EPSILON ? Math.atan2(dy, dx) : null;
}

function angularVelocity(
  points: readonly NativeCatchSledPoint[],
  collectiveVelocity: Point,
): number {
  const center = mean(points);
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    const x = point.x - center.x;
    const y = point.y - center.y;
    const vx = point.vx - collectiveVelocity.x;
    const vy = point.vy - collectiveVelocity.y;
    numerator += x * vy - y * vx;
    denominator += x * x + y * y;
  }
  return denominator > EPSILON ? numerator / denominator : 0;
}

function pairDistances(points: readonly Point[]): number[] {
  const distances: number[] = [];
  for (let left = 0; left < points.length; left++) {
    for (let right = left + 1; right < points.length; right++) {
      distances.push(Math.hypot(
        points[left]!.x - points[right]!.x,
        points[left]!.y - points[right]!.y,
      ));
    }
  }
  return distances;
}

function mean(points: readonly Point[]): Point {
  return points.reduce(
    (sum, point) => ({
      x: sum.x + point.x / points.length,
      y: sum.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
}

function rms(values: readonly number[]): number {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value / values.length, 0));
}
function length(value: Point): number { return Math.hypot(value.x, value.y); }
function angleDeltaDeg(from: Point, to: Point): number {
  return angleDeltaRad(Math.atan2(from.y, from.x), Math.atan2(to.y, to.x)) * 180 / Math.PI;
}
function angleDeltaRad(from: number, to: number): number {
  let delta = to - from;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  return delta;
}
