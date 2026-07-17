/**
 * Six-frame full-sled redirection-density field.
 *
 * The scored impact contract measures redirection over a fixed six-frame
 * window, while normal geometry distributes each raw post-contact turn over a
 * sampled arclength.  This component preserves the raw contact tangent,
 * terminal tangent, segment count, segment lengths, flags, and turn sign. It
 * reads the exact mean velocity of all four sled points and concentrates the
 * raw curve's existing turn over the physical distance that collective state
 * travels during the canonical impact window; later segments retain the raw
 * terminal tangent.  No target threshold, turn magnitude, rate scale, point
 * selection, score result, or selector participates in the construction.
 */
import { IMPACT_WINDOW, type TrackLine } from "../types.ts";
import type { PlanningState, Vec2 } from "./state.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;
const EPSILON = 1e-8;

export type FullSledWindowedRedirectionUnavailable = {
  status: "unavailable";
  reason:
    | "missing_full_sled_velocity"
    | "degenerate_collective_speed"
    | "missing_post_curve"
    | "degenerate_post_curve"
    | "zero_raw_turn";
};

export type FullSledWindowedRedirectionReady = {
  status: "ready";
  lines: TrackLine[];
  contactIndex: number;
  collectiveVelocity: Vec2;
  field: {
    rawTurnDeg: number;
    responseDistancePx: number;
    meanAbsTangentShiftDeg: number;
    maxAbsTangentShiftDeg: number;
  };
  protocol: "full-sled-six-frame-redirection-density.v1";
};

export type FullSledWindowedRedirection = FullSledWindowedRedirectionUnavailable | FullSledWindowedRedirectionReady;

export function realizeFullSledWindowedRedirectionField(
  lines: readonly TrackLine[],
  state: PlanningState,
  contactAnchor: Vec2,
): FullSledWindowedRedirection {
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
  const rawAngles = unwrap(source.map(({ line }) => Math.atan2(line.y2 - line.y1, line.x2 - line.x1)));
  const startAngle = rawAngles[0]!;
  const terminalAngle = rawAngles[rawAngles.length - 1]!;
  const rawTurn = terminalAngle - startAngle;
  if (!Number.isFinite(rawTurn) || Math.abs(rawTurn) <= EPSILON) {
    return { status: "unavailable", reason: "zero_raw_turn" };
  }
  const starts: number[] = [];
  let traversed = 0;
  for (const entry of source) {
    starts.push(traversed);
    traversed += entry.length;
  }
  const lastStart = starts[starts.length - 1]!;
  if (lastStart <= EPSILON) return { status: "unavailable", reason: "degenerate_post_curve" };
  const responseDistancePx = Math.min(collective.speed * IMPACT_WINDOW, lastStart);
  if (!Number.isFinite(responseDistancePx) || responseDistancePx <= EPSILON) {
    return { status: "unavailable", reason: "degenerate_collective_speed" };
  }
  const post: TrackLine[] = [];
  const shifts: number[] = [];
  let start = { x: source[0]!.line.x1, y: source[0]!.line.y1 };
  for (let index = 0; index < source.length; index++) {
    const entry = source[index]!;
    const phase = Math.min(1, starts[index]! / responseDistancePx);
    const angle = startAngle + rawTurn * phase;
    const end = { x: start.x + Math.cos(angle) * entry.length, y: start.y + Math.sin(angle) * entry.length };
    if (![end.x, end.y].every(Number.isFinite)) {
      return { status: "unavailable", reason: "degenerate_post_curve" };
    }
    post.push({ ...copyLine(entry.line), x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    shifts.push(Math.abs(angle - rawAngles[index]!) * 180 / Math.PI);
    start = end;
  }
  return {
    status: "ready",
    lines: [...prefix, ...post],
    contactIndex,
    collectiveVelocity: collective.velocity,
    field: {
      rawTurnDeg: rawTurn * 180 / Math.PI,
      responseDistancePx,
      meanAbsTangentShiftDeg: mean(shifts),
      maxAbsTangentShiftDeg: Math.max(...shifts),
    },
    protocol: "full-sled-six-frame-redirection-density.v1",
  };
}

function fullSledVelocity(state: PlanningState): { velocity: Vec2; speed: number } | FullSledWindowedRedirectionUnavailable {
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

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function copyLine(line: TrackLine): TrackLine {
  return { ...line };
}
