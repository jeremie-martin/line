/**
 * Continuous co-rotating multi-contact post-curve field.
 *
 * A normal proposal already owns a finite contact-to-release tangent field.
 * This realization leaves its inbound geometry, segment count, arc-length
 * budget, flags, and first outgoing tangent intact.  It projects the exact
 * PEG/TAIL/NOSE/STRING velocity cloud onto its unique least-squares rigid
 * translation-plus-rotation field, then transports each later raw tangent by
 * that observed angular motion over the segment's gravity-time traversal.
 *
 * It is deliberately a single physical map, not a rate knob, point selector,
 * score gate, or post-hoc geometry choice.  The exact candidate evaluator
 * remains responsible for all collision and quality decisions.
 */
import { ELEVATION, type TrackLine } from "../types.ts";
import type { PlanningState, Vec2 } from "./state.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;
const EPSILON = 1e-8;

export type RigidSledTwist = {
  pointCount: 4;
  center: Vec2;
  collectiveVelocity: Vec2;
  angularVelocityRadPerFrame: number;
};

export type CoRotatingContactFieldUnavailable = {
  status: "unavailable";
  reason:
    | "missing_full_sled_velocity"
    | "degenerate_sled_cloud"
    | "degenerate_collective_speed"
    | "missing_post_curve"
    | "degenerate_post_curve"
    | "unreachable_gravity_time";
};

export type CoRotatingContactFieldReady = {
  status: "ready";
  lines: TrackLine[];
  contactIndex: number;
  twist: RigidSledTwist;
  travel: {
    totalFrames: number;
    terminalRotationDeg: number;
  };
  protocol: "co-rotating-full-sled-gravity-time-post-curve.v1";
};

export type CoRotatingContactField = CoRotatingContactFieldUnavailable | CoRotatingContactFieldReady;

/**
 * The velocity cloud's least-squares rigid-body projection.  With a
 * nondegenerate sled cloud, translation is the point mean and angular rate is
 * the unique scalar minimizing residual velocity over every native sled point.
 */
export function rigidSledTwist(state: PlanningState): RigidSledTwist | CoRotatingContactFieldUnavailable {
  const points = SLED_POINTS.map((name) => state.points[name]);
  if (points.some((point) => point === undefined || point.velocity === null)) {
    return { status: "unavailable", reason: "missing_full_sled_velocity" };
  }
  const readable = points as Array<NonNullable<typeof points[number]>>;
  const center = readable.reduce(
    (sum, point) => ({ x: sum.x + point.position.x / readable.length, y: sum.y + point.position.y / readable.length }),
    { x: 0, y: 0 },
  );
  const collectiveVelocity = readable.reduce(
    (sum, point) => ({ x: sum.x + point.velocity!.x / readable.length, y: sum.y + point.velocity!.y / readable.length }),
    { x: 0, y: 0 },
  );
  let numerator = 0;
  let denominator = 0;
  for (const point of readable) {
    const rx = point.position.x - center.x;
    const ry = point.position.y - center.y;
    const dvx = point.velocity!.x - collectiveVelocity.x;
    const dvy = point.velocity!.y - collectiveVelocity.y;
    numerator += rx * dvy - ry * dvx;
    denominator += rx * rx + ry * ry;
  }
  if (!Number.isFinite(denominator) || denominator <= EPSILON) {
    return { status: "unavailable", reason: "degenerate_sled_cloud" };
  }
  const angularVelocityRadPerFrame = numerator / denominator;
  if (![center.x, center.y, collectiveVelocity.x, collectiveVelocity.y, angularVelocityRadPerFrame].every(Number.isFinite)) {
    return { status: "unavailable", reason: "degenerate_sled_cloud" };
  }
  return { pointCount: 4, center, collectiveVelocity, angularVelocityRadPerFrame };
}

/**
 * Transport the post-contact portion of a raw normal curve in the instantaneous
 * full-sled co-rotating frame.  `contactAnchor` is only used to locate the raw
 * target-adjacent segment; it does not select a sled point or alter the prefix.
 */
export function realizeCoRotatingContactField(
  lines: readonly TrackLine[],
  state: PlanningState,
  contactAnchor: Vec2,
): CoRotatingContactField {
  const twist = rigidSledTwist(state);
  if ("status" in twist) return twist;
  const collectiveSpeed = Math.hypot(twist.collectiveVelocity.x, twist.collectiveVelocity.y);
  if (!Number.isFinite(collectiveSpeed) || collectiveSpeed <= EPSILON) {
    return { status: "unavailable", reason: "degenerate_collective_speed" };
  }
  const contactIndex = nearestPostStart(lines, contactAnchor);
  if (contactIndex < 0 || contactIndex >= lines.length - 1) {
    return { status: "unavailable", reason: "missing_post_curve" };
  }
  const prefix = lines.slice(0, contactIndex).map(copyLine);
  const rawPost = lines.slice(contactIndex);
  const first = rawPost[0]!;
  let start = { x: first.x1, y: first.y1 };
  let elapsedFrames = 0;
  const post: TrackLine[] = [];
  for (const raw of rawPost) {
    const dx = raw.x2 - raw.x1;
    const dy = raw.y2 - raw.y1;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length <= EPSILON) {
      return { status: "unavailable", reason: "degenerate_post_curve" };
    }
    const midY = (raw.y1 + raw.y2) / 2;
    const midSpeedSquared = collectiveSpeed * collectiveSpeed +
      2 * ELEVATION.GRAVITY_PX_PER_FRAME2 * (midY - first.y1);
    if (!Number.isFinite(midSpeedSquared) || midSpeedSquared <= EPSILON) {
      return { status: "unavailable", reason: "unreachable_gravity_time" };
    }
    const angle = Math.atan2(dy, dx) + twist.angularVelocityRadPerFrame * elapsedFrames;
    const end = { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
    if (![end.x, end.y].every(Number.isFinite)) {
      return { status: "unavailable", reason: "degenerate_post_curve" };
    }
    post.push({ ...copyLine(raw), x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    start = end;
    elapsedFrames += length / Math.sqrt(midSpeedSquared);
  }
  return {
    status: "ready",
    lines: [...prefix, ...post],
    contactIndex,
    twist,
    travel: {
      totalFrames: elapsedFrames,
      terminalRotationDeg: twist.angularVelocityRadPerFrame * elapsedFrames * 180 / Math.PI,
    },
    protocol: "co-rotating-full-sled-gravity-time-post-curve.v1",
  };
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

function copyLine(line: TrackLine): TrackLine {
  return { ...line };
}
