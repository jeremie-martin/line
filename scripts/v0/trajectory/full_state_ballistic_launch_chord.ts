/**
 * Study-only predecessor launch component.
 *
 * A finite passive chord is derived from the complete sled point cloud and a
 * ballistic midpoint launch law for the already-authored interval to the next
 * contact.  It is neither a support rail nor a post-C1 release: the component
 * owns one predecessor collision only, then terminates after one cloud
 * diameter so the following state is free flight.
 */
import { SLED_POINT_ORDER } from "../../lib/detector.ts";
import { makeSolidLine } from "../arc.ts";
import { ELEVATION, type TrackLine } from "../types.ts";
import type { PlanningState, SledPointName, Vec2 } from "./state.ts";

const EPSILON = 1e-8;

export type FullStateBallisticLaunchChordUnavailable = {
  status: "unavailable";
  reason: "missing_full_sled_state" | "zero_mean_speed" | "invalid_flight_interval" | "unreachable_ballistic_launch" | "degenerate_chord";
};

export type FullStateBallisticLaunchChordReady = {
  status: "ready";
  sourcePointIds: readonly SledPointName[];
  flightFrames: number;
  incomingSpeedPxPerFrame: number;
  launchSpeedPxPerFrame: number;
  launchVyPxPerFrame: number;
  incomingHeadingDeg: number;
  launchHeadingDeg: number;
  collisionHeadingDeg: number;
  cloudRmsNormalRadiusPx: number;
  chordLengthPx: number;
  lines: TrackLine[];
};

export type FullStateBallisticLaunchChord =
  | FullStateBallisticLaunchChordUnavailable
  | FullStateBallisticLaunchChordReady;

type FullPoint = { id: SledPointName; position: Vec2; velocity: Vec2 };

/**
 * Realize the one-form passive predecessor impulse.  The launch vertical
 * component is the gravity-symmetric midpoint condition `-g*N/2`; horizontal
 * speed is the incoming collective horizontal carry, so the construction
 * neither creates energy nor reads a target axis.
 */
export function realizeFullStateBallisticLaunchChord(
  state: PlanningState,
  flightFrames: number,
  lineIdStart: number,
): FullStateBallisticLaunchChord {
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  if (!Number.isSafeInteger(flightFrames) || flightFrames < 2) {
    return { status: "unavailable", reason: "invalid_flight_interval" };
  }
  const points = fullPoints(state);
  if (points === null) return { status: "unavailable", reason: "missing_full_sled_state" };
  const center = mean(points.map((point) => point.position));
  const incomingVelocity = mean(points.map((point) => point.velocity));
  const incomingSpeed = Math.hypot(incomingVelocity.x, incomingVelocity.y);
  if (!(incomingSpeed > EPSILON)) return { status: "unavailable", reason: "zero_mean_speed" };

  const launchVy = -.5 * ELEVATION.GRAVITY_PX_PER_FRAME2 * flightFrames;
  const horizontalSquared = incomingSpeed * incomingSpeed - launchVy * launchVy;
  if (!(horizontalSquared > EPSILON)) return { status: "unavailable", reason: "unreachable_ballistic_launch" };
  const horizontalSign = Math.sign(incomingVelocity.x) || 1;
  const launchVelocity = { x: horizontalSign * Math.sqrt(horizontalSquared), y: launchVy };
  const incomingHeadingDeg = degrees(Math.atan2(incomingVelocity.y, incomingVelocity.x));
  const launchHeadingDeg = degrees(Math.atan2(launchVelocity.y, launchVelocity.x));
  // The angle bisector is the unique frictionless reflection plane that maps
  // the collective incoming direction to the ballistic launch direction.
  const collisionHeadingDeg = halfAngle(incomingHeadingDeg, launchHeadingDeg);
  const collisionTangent = unit(collisionHeadingDeg);
  const gravityNormal = gravityFacingLeftNormal(collisionTangent);
  const radius = Math.sqrt(meanNumber(points.map((point) => {
    const projection = dot(subtract(point.position, center), gravityNormal);
    return projection * projection;
  })));
  const chordLength = 2 * radius;
  if (!(chordLength > EPSILON)) return { status: "unavailable", reason: "degenerate_chord" };

  const contact = add(center, scale(gravityNormal, radius));
  const collisionStart = subtract(contact, scale(collisionTangent, chordLength));
  const launchEnd = add(contact, scale(unit(launchHeadingDeg), chordLength));
  if (![collisionStart, contact, launchEnd].every(finitePoint)) {
    throw new Error("full-state ballistic launch chord emitted non-finite geometry");
  }
  const lines = [
    solidFacingGravity(lineIdStart, collisionStart, contact),
    solidFacingGravity(lineIdStart + 1, contact, launchEnd),
  ];
  if (lines.some((line) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1) <= EPSILON)) {
    return { status: "unavailable", reason: "degenerate_chord" };
  }
  return {
    status: "ready",
    sourcePointIds: points.map((point) => point.id),
    flightFrames,
    incomingSpeedPxPerFrame: incomingSpeed,
    launchSpeedPxPerFrame: Math.hypot(launchVelocity.x, launchVelocity.y),
    launchVyPxPerFrame: launchVy,
    incomingHeadingDeg,
    launchHeadingDeg,
    collisionHeadingDeg,
    cloudRmsNormalRadiusPx: radius,
    chordLengthPx: chordLength,
    lines,
  };
}

function fullPoints(state: PlanningState): FullPoint[] | null {
  const points = SLED_POINT_ORDER.map((id) => {
    const point = state.points[id];
    return point === undefined || point.velocity === null ? null : { id, position: point.position, velocity: point.velocity };
  });
  return points.every((point): point is FullPoint => point !== null) ? points : null;
}

function solidFacingGravity(id: number, start: Vec2, end: Vec2): TrackLine {
  const tangent = subtract(end, start);
  const leftNormal = { x: -tangent.y, y: tangent.x };
  return leftNormal.y >= 0
    ? makeSolidLine(id, start.x, start.y, end.x, end.y)
    : makeSolidLine(id, end.x, end.y, start.x, start.y);
}

function gravityFacingLeftNormal(tangent: Vec2): Vec2 {
  const length = Math.hypot(tangent.x, tangent.y);
  if (!(length > EPSILON)) throw new Error("launch chord requires a non-zero collision tangent");
  const left = { x: -tangent.y / length, y: tangent.x / length };
  return left.y >= 0 ? left : { x: -left.x, y: -left.y };
}

function halfAngle(incomingDeg: number, launchDeg: number): number {
  const delta = normalizeAngle(launchDeg - incomingDeg);
  return incomingDeg + delta / 2;
}

function normalizeAngle(value: number): number {
  let out = value % 360;
  if (out > 180) out -= 360;
  if (out <= -180) out += 360;
  return out;
}

function mean(values: readonly Vec2[]): Vec2 {
  if (values.length === 0) throw new Error("mean requires one or more values");
  return {
    x: values.reduce((sum, value) => sum + value.x, 0) / values.length,
    y: values.reduce((sum, value) => sum + value.y, 0) / values.length,
  };
}

function meanNumber(values: readonly number[]): number {
  if (values.length === 0) throw new Error("meanNumber requires one or more values");
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unit(degreesValue: number): Vec2 {
  const radians = degreesValue * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function add(left: Vec2, right: Vec2): Vec2 { return { x: left.x + right.x, y: left.y + right.y }; }
function subtract(left: Vec2, right: Vec2): Vec2 { return { x: left.x - right.x, y: left.y - right.y }; }
function scale(value: Vec2, amount: number): Vec2 { return { x: value.x * amount, y: value.y * amount }; }
function dot(left: Vec2, right: Vec2): number { return left.x * right.x + left.y * right.y; }
function degrees(value: number): number { return value * 180 / Math.PI; }
function finitePoint(point: Vec2): boolean { return Number.isFinite(point.x) && Number.isFinite(point.y); }
