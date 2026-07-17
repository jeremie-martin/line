/**
 * A post-catch full-sled flux membrane.
 *
 * A configuration envelope follows the gravity-facing exterior and may be
 * contact-free. This distinct object is the full sled's *forward* support
 * cross-section at the exact post-catch state: a finite one-way collision
 * membrane whose normal is the collective sled flow. It is not a rail copied
 * from raw geometry: its location, tangent span, and active face all follow
 * continuously from the complete observed sled configuration and velocity.
 */
import { SLED_POINT_ORDER } from "../../lib/detector.ts";
import type { TrackLine } from "../types.ts";
import type { PlanningState, SledPointName, Vec2 } from "./state.ts";

const EPSILON = 1e-8;

export type PostcatchSledFluxMembraneUnavailable = {
  status: "unavailable";
  reason: "missing_full_sled_state" | "degenerate_membrane";
};

export type PostcatchSledFluxMembraneReady = {
  status: "ready";
  startFrame: number;
  sourcePointIds: readonly SledPointName[];
  supportPlane: "full-sled-forward-support-function";
  activeFace: "collective-flow";
  lines: TrackLine[];
};

export type PostcatchSledFluxMembrane =
  | PostcatchSledFluxMembraneUnavailable
  | PostcatchSledFluxMembraneReady;

type FullPoint = { id: SledPointName; position: Vec2; velocity: Vec2; relative: Vec2 };

/**
 * Construct one directed finite membrane. The directed tangent makes the
 * unflipped engine active normal equal the observed collective flow; there is
 * no side arm or boolean side choice.
 */
export function realizePostcatchSledFluxMembrane(
  state: PlanningState,
  lineId: number,
): PostcatchSledFluxMembrane {
  if (!Number.isSafeInteger(lineId)) throw new Error("lineId must be a safe integer");
  const points = fullPoints(state);
  if (points === null) return { status: "unavailable", reason: "missing_full_sled_state" };
  const center = mean(points.map((point) => point.position));
  const velocity = mean(points.map((point) => point.velocity));
  const normal = unit(velocity);
  if (normal === null) return { status: "unavailable", reason: "degenerate_membrane" };
  // For tangent=(ny,-nx), the directed-line left normal is (nx,ny), i.e. the
  // collective flow. `flipped` remains the constant false representation.
  const tangent = { x: normal.y, y: -normal.x };
  const normalSupport = Math.max(...points.map((point) => dot(point.relative, normal)));
  const tangentValues = points.map((point) => dot(point.relative, tangent));
  const lower = Math.min(...tangentValues);
  const upper = Math.max(...tangentValues);
  if (!(upper - lower > EPSILON)) return { status: "unavailable", reason: "degenerate_membrane" };
  const plane = { x: center.x + normal.x * normalSupport, y: center.y + normal.y * normalSupport };
  const start = { x: plane.x + tangent.x * lower, y: plane.y + tangent.y * lower };
  const end = { x: plane.x + tangent.x * upper, y: plane.y + tangent.y * upper };
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) {
    throw new Error("post-catch sled flux membrane emitted a non-finite endpoint");
  }
  return {
    status: "ready",
    startFrame: state.frame,
    sourcePointIds: points.map((point) => point.id),
    supportPlane: "full-sled-forward-support-function",
    activeFace: "collective-flow",
    lines: [{
      id: lineId,
      type: 0,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      flipped: false,
      leftExtended: false,
      rightExtended: false,
    }],
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

function mean(points: readonly Vec2[]): Vec2 {
  return {
    x: points.reduce((total, point) => total + point.x, 0) / points.length,
    y: points.reduce((total, point) => total + point.y, 0) / points.length,
  };
}

function unit(value: Vec2): Vec2 | null {
  const length = Math.hypot(value.x, value.y);
  return length > EPSILON && Number.isFinite(length) ? { x: value.x / length, y: value.y / length } : null;
}

function dot(left: Vec2, right: Vec2): number {
  return left.x * right.x + left.y * right.y;
}
