/**
 * Full-sled gravity-time tangent field.
 *
 * Normal geometry currently allocates its post-contact tangent schedule by
 * arclength, while contact response and impact are measured in frames.  This
 * component retains a raw curve's contact point, prefix, line count, segment
 * lengths, flags, and complete tangent range, but resamples that range by the
 * physical traversal time implied by the exact four-point collective sled
 * velocity and gravity.  It has no orientation transport, damping, rate cap,
 * endpoint correction, score gate, or selector.
 */
import { ELEVATION, type TrackLine } from "../types.ts";
import type { PlanningState, Vec2 } from "./state.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;
const EPSILON = 1e-8;

type FullSledVelocity = { velocity: Vec2; speed: number };

export type FullSledGravityTimeFieldUnavailable = {
  status: "unavailable";
  reason:
    | "missing_full_sled_velocity"
    | "degenerate_collective_speed"
    | "missing_post_curve"
    | "degenerate_post_curve"
    | "unreachable_gravity_time";
};

export type FullSledGravityTimeFieldReady = {
  status: "ready";
  lines: TrackLine[];
  contactIndex: number;
  collectiveVelocity: Vec2;
  travel: { totalFrames: number; meanAbsTangentShiftDeg: number; maxAbsTangentShiftDeg: number };
  protocol: "full-sled-gravity-time-post-curve.v1";
};

export type FullSledGravityTimeField = FullSledGravityTimeFieldUnavailable | FullSledGravityTimeFieldReady;

export function realizeFullSledGravityTimeField(
  lines: readonly TrackLine[],
  state: PlanningState,
  contactAnchor: Vec2,
): FullSledGravityTimeField {
  const collective = fullSledVelocity(state);
  if ("status" in collective) return collective;
  const contactIndex = nearestPostStart(lines, contactAnchor);
  if (contactIndex < 0 || contactIndex >= lines.length - 1) {
    return { status: "unavailable", reason: "missing_post_curve" };
  }
  const prefix = lines.slice(0, contactIndex).map(copyLine);
  const rawPost = lines.slice(contactIndex);
  const source = rawPost.map((line) => ({ line, length: Math.hypot(line.x2 - line.x1, line.y2 - line.y1) }));
  if (source.some(({ length }) => !Number.isFinite(length) || length <= EPSILON)) {
    return { status: "unavailable", reason: "degenerate_post_curve" };
  }
  const first = source[0]!.line;
  const totalLength = source.reduce((sum, entry) => sum + entry.length, 0);
  const elapsedAtStart: number[] = [];
  let totalFrames = 0;
  let traversedLength = 0;
  const spatialAtStart: number[] = [];
  for (const entry of source) {
    elapsedAtStart.push(totalFrames);
    spatialAtStart.push(traversedLength / totalLength);
    const midY = (entry.line.y1 + entry.line.y2) / 2;
    const midSpeedSquared = collective.speed * collective.speed +
      2 * ELEVATION.GRAVITY_PX_PER_FRAME2 * (midY - first.y1);
    if (!Number.isFinite(midSpeedSquared) || midSpeedSquared <= EPSILON) {
      return { status: "unavailable", reason: "unreachable_gravity_time" };
    }
    totalFrames += entry.length / Math.sqrt(midSpeedSquared);
    traversedLength += entry.length;
  }
  if (!Number.isFinite(totalFrames) || totalFrames <= EPSILON) {
    return { status: "unavailable", reason: "degenerate_post_curve" };
  }
  const rawAngles = unwrap(source.map(({ line }) => Math.atan2(line.y2 - line.y1, line.x2 - line.x1)));
  const post: TrackLine[] = [];
  const shifts: number[] = [];
  let start = { x: first.x1, y: first.y1 };
  for (let index = 0; index < source.length; index++) {
    const entry = source[index]!;
    const timeFraction = elapsedAtStart[index]! / totalFrames;
    const angle = interpolateAngle(spatialAtStart, rawAngles, timeFraction);
    const rawAngle = rawAngles[index]!;
    const end = { x: start.x + Math.cos(angle) * entry.length, y: start.y + Math.sin(angle) * entry.length };
    if (![end.x, end.y].every(Number.isFinite)) {
      return { status: "unavailable", reason: "degenerate_post_curve" };
    }
    post.push({ ...copyLine(entry.line), x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    shifts.push(Math.abs(angle - rawAngle) * 180 / Math.PI);
    start = end;
  }
  return {
    status: "ready",
    lines: [...prefix, ...post],
    contactIndex,
    collectiveVelocity: collective.velocity,
    travel: {
      totalFrames,
      meanAbsTangentShiftDeg: mean(shifts),
      maxAbsTangentShiftDeg: Math.max(...shifts),
    },
    protocol: "full-sled-gravity-time-post-curve.v1",
  };
}

function fullSledVelocity(state: PlanningState): FullSledVelocity | FullSledGravityTimeFieldUnavailable {
  const points = SLED_POINTS.map((name) => state.points[name]);
  if (points.some((point) => point === undefined || point.velocity === null)) {
    return { status: "unavailable", reason: "missing_full_sled_velocity" };
  }
  const readable = points as Array<NonNullable<typeof points[number]>>;
  const velocity = readable.reduce(
    (sum, point) => ({ x: sum.x + point.velocity!.x / readable.length, y: sum.y + point.velocity!.y / readable.length }),
    { x: 0, y: 0 },
  );
  const speed = Math.hypot(velocity.x, velocity.y);
  if (![velocity.x, velocity.y, speed].every(Number.isFinite) || speed <= EPSILON) {
    return { status: "unavailable", reason: "degenerate_collective_speed" };
  }
  return { velocity, speed };
}

function nearestPostStart(lines: readonly TrackLine[], anchor: Vec2): number {
  let index = -1;
  let distance = Infinity;
  for (let candidate = 0; candidate < lines.length; candidate++) {
    const line = lines[candidate]!;
    const candidateDistance = (line.x1 - anchor.x) ** 2 + (line.y1 - anchor.y) ** 2;
    if (candidateDistance < distance) {
      index = candidate;
      distance = candidateDistance;
    }
  }
  return index;
}

function unwrap(angles: readonly number[]): number[] {
  const out: number[] = [];
  for (const angle of angles) {
    const prior = out[out.length - 1];
    if (prior === undefined) out.push(angle);
    else {
      let delta = (angle - prior) % (2 * Math.PI);
      if (delta <= -Math.PI) delta += 2 * Math.PI;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      out.push(prior + delta);
    }
  }
  return out;
}

function interpolateAngle(spatial: readonly number[], angles: readonly number[], fraction: number): number {
  if (fraction <= spatial[0]!) return angles[0]!;
  for (let index = 1; index < spatial.length; index++) {
    const right = spatial[index]!;
    if (fraction <= right) {
      const left = spatial[index - 1]!;
      const progress = right === left ? 0 : (fraction - left) / (right - left);
      return angles[index - 1]! + (angles[index]! - angles[index - 1]!) * progress;
    }
  }
  return angles[angles.length - 1]!;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function copyLine(line: TrackLine): TrackLine {
  return { ...line };
}
