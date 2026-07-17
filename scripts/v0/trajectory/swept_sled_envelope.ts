/**
 * Study-only body-conformal contact contour.
 *
 * This is deliberately neither a raw-candidate augmentation nor a parallel
 * support rail.  It predicts the complete rigid sled through the scored
 * redirection window, then realizes the one exterior, gravity-facing monotone
 * hull of that swept body as a single collidable contour.
 */
import { SLED_POINT_ORDER } from "../../lib/detector.ts";
import { makeSolidLine } from "../arc.ts";
import { IMPACT_WINDOW, type TrackLine } from "../types.ts";
import type { ContactKinematicFrame } from "./contact_kinematic_frame.ts";
import type { PlanningState, SledPointName, Vec2 } from "./state.ts";

const EPSILON = 1e-8;
const INBOUND_CONTACT_FRAME = -1;

export type SweptSledEnvelopeUnavailable = {
  status: "unavailable";
  reason: "missing_impact" | "missing_full_sled_pose" | "missing_angular_rate" | "zero_angular_rate" | "degenerate_hull";
};

export type SweptSledEnvelopeReady = {
  status: "ready";
  horizonFrames: number;
  signedResponseTurnDeg: number;
  measuredSledRateDegPerFrame: number;
  sourcePointIds: readonly SledPointName[];
  sweptSampleCount: number;
  hullPointCount: number;
  hullSourcePointIds: readonly SledPointName[];
  lines: TrackLine[];
};

export type SweptSledEnvelope = SweptSledEnvelopeUnavailable | SweptSledEnvelopeReady;

type SweptPoint = {
  pointId: SledPointName;
  step: number;
  world: Vec2;
  along: number;
  down: number;
};

/**
 * Construct one finite, one-way, travel-ordered contour.  The signed response
 * is fixed solely by the present angular velocity; its magnitude is the
 * authored physical redirection request over the exact impact window.
 */
export function realizeSweptSledEnvelope(
  state: PlanningState,
  frame: ContactKinematicFrame,
  lineIdStart: number,
): SweptSledEnvelope {
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  if (frame.impact === null) return { status: "unavailable", reason: "missing_impact" };
  const angularRate = state.sledPoseRateDegPerFrame;
  if (angularRate === null || !Number.isFinite(angularRate)) {
    return { status: "unavailable", reason: "missing_angular_rate" };
  }
  if (Math.abs(angularRate) <= EPSILON) return { status: "unavailable", reason: "zero_angular_rate" };

  const sourcePointIds = SLED_POINT_ORDER.filter((id): id is SledPointName => state.points[id] !== undefined);
  if (sourcePointIds.length !== SLED_POINT_ORDER.length) {
    return { status: "unavailable", reason: "missing_full_sled_pose" };
  }
  const speed = frame.com.speedPxPerFrame;
  if (!Number.isFinite(speed) || speed <= EPSILON) throw new Error("frame.com.speedPxPerFrame must be positive and finite");

  const heading = radians(frame.com.headingDeg);
  const forward = { x: Math.cos(heading), y: Math.sin(heading) };
  const perpendicular = { x: -forward.y, y: forward.x };
  const gravityFacingNormal = perpendicular.y >= 0
    ? perpendicular
    : { x: -perpendicular.x, y: -perpendicular.y };
  const signedResponseTurnDeg = Math.sign(angularRate) * frame.impact.catchableTurnDeg;
  const relativePoints = sourcePointIds.map((pointId) => ({
    pointId,
    relative: state.points[pointId]!.relativePosition,
  }));
  const samples: SweptPoint[] = [];
  for (let step = INBOUND_CONTACT_FRAME; step <= IMPACT_WINDOW; step++) {
    const center = integrateCenter(state.position, speed, frame.com.headingDeg, signedResponseTurnDeg, step);
    const rotationDeg = angularRate * step;
    for (const source of relativePoints) {
      const offset = rotate(source.relative, rotationDeg);
      const world = { x: center.x + offset.x, y: center.y + offset.y };
      const displacement = { x: world.x - state.position.x, y: world.y - state.position.y };
      samples.push({
        pointId: source.pointId,
        step,
        world,
        along: dot(displacement, forward),
        down: dot(displacement, gravityFacingNormal),
      });
    }
  }
  const hull = upperMonotoneHull(samples);
  if (hull.length < 2) return { status: "unavailable", reason: "degenerate_hull" };
  const lines = hull.slice(1).map((point, index) => {
    const prior = hull[index]!;
    return makeSolidLine(lineIdStart + index, prior.world.x, prior.world.y, point.world.x, point.world.y);
  });
  if (lines.some((line) => lineLength(line) <= EPSILON)) {
    throw new Error("swept sled envelope emitted a zero-length hull edge");
  }
  return {
    status: "ready",
    horizonFrames: IMPACT_WINDOW,
    signedResponseTurnDeg,
    measuredSledRateDegPerFrame: angularRate,
    sourcePointIds,
    sweptSampleCount: samples.length,
    hullPointCount: hull.length,
    hullSourcePointIds: [...new Set(hull.map((point) => point.pointId))],
    lines,
  };
}

function integrateCenter(
  origin: Vec2,
  speed: number,
  headingDeg: number,
  totalTurnDeg: number,
  steps: number,
): Vec2 {
  let point = { ...origin };
  if (steps >= 0) {
    for (let index = 0; index < steps; index++) {
      point = translateCenter(point, speed, headingDeg, totalTurnDeg, index, 1);
    }
  } else {
    for (let index = -1; index >= steps; index--) {
      point = translateCenter(point, speed, headingDeg, totalTurnDeg, index, -1);
    }
  }
  return point;
}

function translateCenter(
  point: Vec2,
  speed: number,
  headingDeg: number,
  totalTurnDeg: number,
  intervalIndex: number,
  direction: -1 | 1,
): Vec2 {
  const fraction = (intervalIndex + 0.5) / IMPACT_WINDOW;
  const tangent = radians(headingDeg + totalTurnDeg * fraction);
  return {
    x: point.x + direction * Math.cos(tangent) * speed,
    y: point.y + direction * Math.sin(tangent) * speed,
  };
}

/** Keep one exterior contour; no named point or parallel companion is chosen. */
function upperMonotoneHull(points: readonly SweptPoint[]): SweptPoint[] {
  const byAlong = [...points].sort((left, right) =>
    left.along - right.along || right.down - left.down || left.step - right.step || left.pointId.localeCompare(right.pointId)
  );
  const exterior: SweptPoint[] = [];
  for (const point of byAlong) {
    const last = exterior[exterior.length - 1];
    if (last !== undefined && Math.abs(point.along - last.along) <= EPSILON) {
      // Equal forward position has one gravity-facing exterior point.  The
      // lexical tie-break makes this deterministic without choosing a sled ID.
      continue;
    }
    while (exterior.length >= 2 && cross(exterior[exterior.length - 2]!, exterior[exterior.length - 1]!, point) >= -EPSILON) {
      exterior.pop();
    }
    exterior.push(point);
  }
  return exterior;
}

function cross(first: SweptPoint, second: SweptPoint, third: SweptPoint): number {
  return (second.along - first.along) * (third.down - first.down) -
    (second.down - first.down) * (third.along - first.along);
}

function rotate(point: Vec2, degrees: number): Vec2 {
  const angle = radians(degrees);
  return {
    x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
    y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
  };
}

function dot(left: Vec2, right: Vec2): number {
  return left.x * right.x + left.y * right.y;
}

function radians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function lineLength(line: TrackLine): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}
