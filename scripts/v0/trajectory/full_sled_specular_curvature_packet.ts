/**
 * Full-sled constant-energy specular curvature packet.
 *
 * A frictionless plane redirects a velocity without changing its magnitude
 * only when its tangent bisects the incoming and outgoing directions.  This
 * realization applies that constraint to the complete pre-contact sled state:
 * the raw curve contributes its already-authored signed turn, while all four
 * sled velocities provide the collective incoming direction and the kinetic
 * radius over which the tangent correction can form.
 *
 * It is intentionally a single state-to-geometry map.  It neither reads an
 * exact candidate outcome nor chooses a point, response duration, scale,
 * target, score, or source policy.
 */
import { ELEVATION, type TrackLine } from "../types.ts";
import type { PlanningState, Vec2 } from "./state.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;
const EPSILON = 1e-8;

export type FullSledSpecularCurvaturePacketUnavailable = {
  status: "unavailable";
  reason:
    | "missing_full_sled_velocity"
    | "degenerate_collective_speed"
    | "missing_contact_curve"
    | "degenerate_curve"
    | "zero_raw_turn";
};

export type FullSledSpecularCurvaturePacketReady = {
  status: "ready";
  lines: TrackLine[];
  contactIndex: number;
  collectiveVelocity: Vec2;
  field: {
    rawTurnDeg: number;
    contactTangentShiftDeg: number;
    kineticRadiusPx: number;
    meanVertexDisplacementPx: number;
    maxVertexDisplacementPx: number;
  };
  protocol: "full-sled-constant-energy-specular-curvature-packet.v1";
};

export type FullSledSpecularCurvaturePacket =
  | FullSledSpecularCurvaturePacketUnavailable
  | FullSledSpecularCurvaturePacketReady;

/**
 * Preserve the raw curve's signed surface turn, but make the contact tangent
 * the unique unoriented reflection plane that redirects the full-cloud mean
 * velocity through that turn at equal collective speed.  The contact correction
 * fades C1 over `mean(|v_i|^2) / g`, the gravity-defined radius of a unit turn.
 */
export function realizeFullSledSpecularCurvaturePacket(
  lines: readonly TrackLine[],
  state: PlanningState,
  contactAnchor: Vec2,
): FullSledSpecularCurvaturePacket {
  const motion = fullSledMotion(state);
  if ("status" in motion) return motion;
  const contactIndex = nearestPostStart(lines, contactAnchor);
  if (contactIndex <= 0 || contactIndex >= lines.length) {
    return { status: "unavailable", reason: "missing_contact_curve" };
  }
  const source = lines.map((line) => ({ line, length: lineLength(line) }));
  if (source.some(({ length }) => !Number.isFinite(length) || length <= EPSILON) || !connected(lines)) {
    return { status: "unavailable", reason: "degenerate_curve" };
  }
  const angles = unwrap(source.map(({ line }) => Math.atan2(line.y2 - line.y1, line.x2 - line.x1)));
  const contactAngle = angles[contactIndex]!;
  const rawTurn = angles[angles.length - 1]! - contactAngle;
  if (!Number.isFinite(rawTurn) || Math.abs(rawTurn) <= EPSILON) {
    return { status: "unavailable", reason: "zero_raw_turn" };
  }

  // Reflection in a surface tangent t maps heading h to 2t-h.  Setting the
  // output to the raw curve's proposed turn gives t = h + rawTurn/2.  Use the
  // unoriented equivalent nearest the existing contact tangent so line facing
  // and topology stay unchanged.
  const incomingAngle = Math.atan2(motion.collectiveVelocity.y, motion.collectiveVelocity.x);
  const specularTangent = incomingAngle + rawTurn / 2;
  const contactTangentShift = unorientedAngleDelta(contactAngle, specularTangent);
  const kineticRadiusPx = motion.meanSquaredSpeed / ELEVATION.GRAVITY_PX_PER_FRAME2;
  if (!Number.isFinite(kineticRadiusPx) || kineticRadiusPx <= EPSILON) {
    return { status: "unavailable", reason: "degenerate_collective_speed" };
  }

  const centerDistances = distancesFromContact(source.map(({ length }) => length), contactIndex);
  const adjustedAngles = angles.map((angle, index) =>
    angle + contactTangentShift * compactC1Weight(centerDistances[index]! / kineticRadiusPx),
  );
  const contact = { x: lines[contactIndex]!.x1, y: lines[contactIndex]!.y1 };
  const rebuilt = rebuildAboutContact(lines, source.map(({ length }) => length), adjustedAngles, contactIndex, contact);
  if (!rebuilt.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite)) || !connected(rebuilt)) {
    throw new Error("specular curvature packet emitted non-finite or disconnected geometry");
  }
  const rawVertices = vertices(lines);
  const packetVertices = vertices(rebuilt);
  const displacement = rawVertices.map((point, index) => Math.hypot(
    point.x - packetVertices[index]!.x,
    point.y - packetVertices[index]!.y,
  ));
  return {
    status: "ready",
    lines: rebuilt,
    contactIndex,
    collectiveVelocity: motion.collectiveVelocity,
    field: {
      rawTurnDeg: rawTurn * 180 / Math.PI,
      contactTangentShiftDeg: contactTangentShift * 180 / Math.PI,
      kineticRadiusPx,
      meanVertexDisplacementPx: mean(displacement),
      maxVertexDisplacementPx: Math.max(...displacement),
    },
    protocol: "full-sled-constant-energy-specular-curvature-packet.v1",
  };
}

function fullSledMotion(
  state: PlanningState,
): { collectiveVelocity: Vec2; meanSquaredSpeed: number } | FullSledSpecularCurvaturePacketUnavailable {
  const points = SLED_POINTS.map((name) => state.points[name]);
  if (points.some((point) => point === undefined || point.velocity === null)) {
    return { status: "unavailable", reason: "missing_full_sled_velocity" };
  }
  const readable = points as Array<NonNullable<typeof points[number]>>;
  const collectiveVelocity = readable.reduce(
    (sum, point) => ({ x: sum.x + point.velocity!.x / readable.length, y: sum.y + point.velocity!.y / readable.length }),
    { x: 0, y: 0 },
  );
  const meanSquaredSpeed = readable.reduce(
    (sum, point) => sum + point.velocity!.x ** 2 + point.velocity!.y ** 2,
    0,
  ) / readable.length;
  if (
    ![collectiveVelocity.x, collectiveVelocity.y, meanSquaredSpeed].every(Number.isFinite) ||
    Math.hypot(collectiveVelocity.x, collectiveVelocity.y) <= EPSILON ||
    meanSquaredSpeed <= EPSILON
  ) {
    return { status: "unavailable", reason: "degenerate_collective_speed" };
  }
  return { collectiveVelocity, meanSquaredSpeed };
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

function distancesFromContact(lengths: readonly number[], contactIndex: number): number[] {
  const out = Array<number>(lengths.length);
  let distance = 0;
  for (let index = contactIndex; index < lengths.length; index++) {
    out[index] = distance + lengths[index]! / 2;
    distance += lengths[index]!;
  }
  distance = 0;
  for (let index = contactIndex - 1; index >= 0; index--) {
    out[index] = distance + lengths[index]! / 2;
    distance += lengths[index]!;
  }
  return out;
}

function rebuildAboutContact(
  raw: readonly TrackLine[],
  lengths: readonly number[],
  angles: readonly number[],
  contactIndex: number,
  contact: Vec2,
): TrackLine[] {
  const rebuilt = Array<TrackLine>(raw.length);
  let end = { ...contact };
  for (let index = contactIndex - 1; index >= 0; index--) {
    const start = {
      x: end.x - Math.cos(angles[index]!) * lengths[index]!,
      y: end.y - Math.sin(angles[index]!) * lengths[index]!,
    };
    rebuilt[index] = { ...raw[index]!, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
    end = start;
  }
  let start = { ...contact };
  for (let index = contactIndex; index < raw.length; index++) {
    const next = {
      x: start.x + Math.cos(angles[index]!) * lengths[index]!,
      y: start.y + Math.sin(angles[index]!) * lengths[index]!,
    };
    rebuilt[index] = { ...raw[index]!, x1: start.x, y1: start.y, x2: next.x, y2: next.y };
    start = next;
  }
  return rebuilt;
}

function compactC1Weight(normalizedDistance: number): number {
  if (!(normalizedDistance < 1)) return 0;
  if (normalizedDistance <= 0) return 1;
  return Math.cos(Math.PI * normalizedDistance / 2) ** 2;
}

function unorientedAngleDelta(from: number, to: number): number {
  let delta = (to - from) % Math.PI;
  if (delta <= -Math.PI / 2) delta += Math.PI;
  if (delta > Math.PI / 2) delta -= Math.PI;
  return delta;
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

function vertices(lines: readonly TrackLine[]): Vec2[] {
  return [{ x: lines[0]!.x1, y: lines[0]!.y1 }, ...lines.map((line) => ({ x: line.x2, y: line.y2 }))];
}

function connected(lines: readonly TrackLine[]): boolean {
  return lines.every((line, index) => {
    const prior = lines[index - 1];
    return lineLength(line) > EPSILON &&
      (prior === undefined || (line.x1 === prior.x2 && line.y1 === prior.y2));
  });
}

function lineLength(line: TrackLine): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
