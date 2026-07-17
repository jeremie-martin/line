/**
 * A post-catch, full-sled configuration envelope.
 *
 * This is intentionally a response component, rather than another incoming
 * contact curve.  Its input is the exact state one engine frame after an
 * already-admitted native catch.  It traces the gravity-facing support of the
 * complete PEG/TAIL/NOSE/STRING configuration as that observed configuration
 * evolves under its measured collective velocity, gravity, and angular rate.
 *
 * The support point is a support function over the whole cloud, never a
 * selected sled point.  The resulting finite polyline starts at the observed
 * post-catch frame and has no inbound segment, so callers can explicitly
 * reject any realization that intrudes on the original catch.
 */
import { SLED_POINT_ORDER } from "../../lib/detector.ts";
import { makeSolidLine } from "../arc.ts";
import { ELEVATION, IMPACT_WINDOW, type TrackLine } from "../types.ts";
import type { PlanningState, SledPointName, Vec2 } from "./state.ts";

const EPSILON = 1e-8;

export type PostcatchSledReactionEnvelopeUnavailable = {
  status: "unavailable";
  reason: "missing_full_sled_state" | "missing_angular_rate" | "degenerate_path";
};

export type PostcatchSledReactionEnvelopeReady = {
  status: "ready";
  /** The observed exact state is the first node, conventionally H + 1. */
  startFrame: number;
  horizonFrames: number;
  measuredSledRateDegPerFrame: number;
  sourcePointIds: readonly SledPointName[];
  nodeCount: number;
  supportLevel: "full-sled-gravity-support-function";
  lines: TrackLine[];
};

export type PostcatchSledReactionEnvelope =
  | PostcatchSledReactionEnvelopeUnavailable
  | PostcatchSledReactionEnvelopeReady;

type FullPoint = {
  id: SledPointName;
  position: Vec2;
  velocity: Vec2;
  relative: Vec2;
};

/**
 * Realize one deterministic response contour from an exact full-sled state.
 *
 * The path contains one support node for each frame from `state.frame` through
 * `state.frame + IMPACT_WINDOW - 1`.  This is a physical time discretization,
 * not a candidate menu: the interval is the evaluator's fixed response
 * horizon and every node comes from the same observed configuration law.
 */
export function realizePostcatchSledReactionEnvelope(
  state: PlanningState,
  lineIdStart: number,
): PostcatchSledReactionEnvelope {
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  const angularRate = state.sledPoseRateDegPerFrame;
  if (angularRate === null || !Number.isFinite(angularRate)) {
    return { status: "unavailable", reason: "missing_angular_rate" };
  }
  const points = fullPoints(state);
  if (points === null) return { status: "unavailable", reason: "missing_full_sled_state" };

  const center = mean(points.map((point) => point.position));
  const velocity = mean(points.map((point) => point.velocity));
  const speed = Math.hypot(velocity.x, velocity.y);
  if (!(speed > EPSILON)) return { status: "unavailable", reason: "missing_full_sled_state" };

  const nodes = Array.from(
    { length: IMPACT_WINDOW },
    (_, step) => supportNode(center, velocity, points, angularRate, step),
  );
  if (nodes.some((node) => !finitePoint(node))) {
    throw new Error("post-catch sled reaction envelope emitted a non-finite node");
  }
  const lines = nodes.slice(1).map((node, index) => {
    const prior = nodes[index]!;
    if (Math.hypot(node.x - prior.x, node.y - prior.y) <= EPSILON) {
      throw new Error("post-catch sled reaction envelope emitted a zero-length path segment");
    }
    return makeSolidLine(lineIdStart + index, prior.x, prior.y, node.x, node.y);
  });
  if (lines.length === 0) return { status: "unavailable", reason: "degenerate_path" };
  return {
    status: "ready",
    startFrame: state.frame,
    horizonFrames: IMPACT_WINDOW,
    measuredSledRateDegPerFrame: angularRate,
    sourcePointIds: points.map((point) => point.id),
    nodeCount: nodes.length,
    supportLevel: "full-sled-gravity-support-function",
    lines,
  };
}

function fullPoints(state: PlanningState): FullPoint[] | null {
  const raw = SLED_POINT_ORDER.map((id) => {
    const point = state.points[id];
    return point === undefined || point.velocity === null
      ? null
      : { id, position: point.position, velocity: point.velocity, relative: point.relativePosition };
  });
  return raw.every((point): point is FullPoint => point !== null) ? raw : null;
}

function supportNode(
  origin: Vec2,
  initialVelocity: Vec2,
  points: readonly FullPoint[],
  angularRateDegPerFrame: number,
  step: number,
): Vec2 {
  const gravity = ELEVATION.GRAVITY_PX_PER_FRAME2;
  // lr-core applies gravity before the following velocity read.  The same
  // discrete law gives the center displacement after `step` full frames.
  const center = {
    x: origin.x + initialVelocity.x * step,
    y: origin.y + initialVelocity.y * step + .5 * gravity * step * (step + 1),
  };
  const velocity = { x: initialVelocity.x, y: initialVelocity.y + gravity * step };
  const tangent = unit(velocity);
  const leftNormal = { x: -tangent.y, y: tangent.x };
  const gravityFacingNormal = leftNormal.y >= 0 ? leftNormal : { x: -leftNormal.x, y: -leftNormal.y };
  const support = Math.max(...points.map((point) => dot(rotate(point.relative, angularRateDegPerFrame * step), gravityFacingNormal)));
  return {
    x: center.x + gravityFacingNormal.x * support,
    y: center.y + gravityFacingNormal.y * support,
  };
}

function mean(points: readonly Vec2[]): Vec2 {
  if (points.length === 0) throw new Error("mean requires at least one point");
  return {
    x: points.reduce((total, point) => total + point.x, 0) / points.length,
    y: points.reduce((total, point) => total + point.y, 0) / points.length,
  };
}

function unit(value: Vec2): Vec2 {
  const length = Math.hypot(value.x, value.y);
  if (!(length > EPSILON)) throw new Error("reaction envelope requires a non-zero collective velocity");
  return { x: value.x / length, y: value.y / length };
}

function rotate(point: Vec2, degrees: number): Vec2 {
  const radians = degrees * Math.PI / 180;
  return {
    x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
  };
}

function dot(left: Vec2, right: Vec2): number {
  return left.x * right.x + left.y * right.y;
}

function finitePoint(point: Vec2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}
