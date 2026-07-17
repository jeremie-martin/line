/**
 * Study-only full-state guide ribbon.
 *
 * This realizes one time-ordered contact locus, not a spatial hull or a
 * companion support surface.  At every response node it uses the complete
 * native sled position-and-velocity field to form a continuous RMS support
 * level set around the point-cloud centroid.  The authored catchable turn is
 * distributed over the scored impact window with its side supplied by the
 * measured angular-rate sign.
 *
 * It is intentionally outside compiler policy.  Exact admission decides
 * whether this physical state-to-geometry hypothesis has any value.
 */
import { SLED_POINT_ORDER } from "../../lib/detector.ts";
import { makeSolidLine } from "../arc.ts";
import { IMPACT_WINDOW, type TrackLine } from "../types.ts";
import type { ContactKinematicFrame } from "./contact_kinematic_frame.ts";
import type { PlanningState, SledPointName, Vec2 } from "./state.ts";

const EPSILON = 1e-8;
const INBOUND_CONTACT_FRAME = -1;

export type FullStateGuideRibbonUnavailable = {
  status: "unavailable";
  reason: "missing_impact" | "missing_full_sled_state" | "missing_angular_rate" | "zero_angular_rate" | "degenerate_path";
};

export type FullStateGuideRibbonReady = {
  status: "ready";
  horizonFrames: number;
  signedResponseTurnDeg: number;
  measuredSledRateDegPerFrame: number;
  sourcePointIds: readonly SledPointName[];
  inboundFrame: number;
  nodeCount: number;
  supportLevel: "full-sled-rms-normal-radius";
  lines: TrackLine[];
};

export type FullStateGuideRibbon = FullStateGuideRibbonUnavailable | FullStateGuideRibbonReady;

type FullPoint = { id: SledPointName; position: Vec2; velocity: Vec2; relative: Vec2 };

/**
 * Build a finite C0 polyline whose nodes are the state-predicted collective
 * support locus at H-1..H+6.  The RMS normal radius is a symmetric functional
 * of every sled point: no point identity, contact result, selector, or raw
 * candidate coordinate chooses the geometry.
 */
export function realizeFullStateGuideRibbon(
  state: PlanningState,
  frame: ContactKinematicFrame,
  lineIdStart: number,
): FullStateGuideRibbon {
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  if (frame.impact === null) return { status: "unavailable", reason: "missing_impact" };
  const angularRate = state.sledPoseRateDegPerFrame;
  if (angularRate === null || !Number.isFinite(angularRate)) {
    return { status: "unavailable", reason: "missing_angular_rate" };
  }
  if (Math.abs(angularRate) <= EPSILON) return { status: "unavailable", reason: "zero_angular_rate" };

  const points = fullPoints(state);
  if (points === null) return { status: "unavailable", reason: "missing_full_sled_state" };
  const center = mean(points.map((point) => point.position));
  const meanVelocity = mean(points.map((point) => point.velocity));
  const speed = Math.hypot(meanVelocity.x, meanVelocity.y);
  if (!(speed > EPSILON)) return { status: "unavailable", reason: "missing_full_sled_state" };
  const headingDeg = degrees(Math.atan2(meanVelocity.y, meanVelocity.x));
  const signedResponseTurnDeg = Math.sign(angularRate) * frame.impact.catchableTurnDeg;
  const nodes = Array.from(
    { length: IMPACT_WINDOW - INBOUND_CONTACT_FRAME + 1 },
    (_, index) => guideNode(center, points, speed, headingDeg, signedResponseTurnDeg, angularRate, INBOUND_CONTACT_FRAME + index),
  );
  if (nodes.some((node) => !finitePoint(node))) throw new Error("full-state guide ribbon emitted a non-finite node");
  const lines = nodes.slice(1).map((node, index) => {
    const prior = nodes[index]!;
    if (Math.hypot(node.x - prior.x, node.y - prior.y) <= EPSILON) {
      throw new Error("full-state guide ribbon emitted a zero-length path segment");
    }
    return makeSolidLine(lineIdStart + index, prior.x, prior.y, node.x, node.y);
  });
  if (lines.length === 0) return { status: "unavailable", reason: "degenerate_path" };
  return {
    status: "ready",
    horizonFrames: IMPACT_WINDOW,
    signedResponseTurnDeg,
    measuredSledRateDegPerFrame: angularRate,
    sourcePointIds: points.map((point) => point.id),
    inboundFrame: INBOUND_CONTACT_FRAME,
    nodeCount: nodes.length,
    supportLevel: "full-sled-rms-normal-radius",
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

function guideNode(
  center: Vec2,
  points: readonly FullPoint[],
  speed: number,
  headingDeg: number,
  totalTurnDeg: number,
  angularRateDegPerFrame: number,
  step: number,
): Vec2 {
  const locusCenter = integrateCenter(center, speed, headingDeg, totalTurnDeg, step);
  const fraction = step / IMPACT_WINDOW;
  const tangent = unit(headingDeg + totalTurnDeg * fraction);
  const leftNormal = { x: -tangent.y, y: tangent.x };
  const gravityFacingNormal = leftNormal.y >= 0 ? leftNormal : { x: -leftNormal.x, y: -leftNormal.y };
  const supportRadius = Math.sqrt(meanNumber(points.map((point) => {
    const relative = rotate(point.relative, angularRateDegPerFrame * step);
    const projection = dot(relative, gravityFacingNormal);
    return projection * projection;
  })));
  return {
    x: locusCenter.x + gravityFacingNormal.x * supportRadius,
    y: locusCenter.y + gravityFacingNormal.y * supportRadius,
  };
}

function integrateCenter(origin: Vec2, speed: number, headingDeg: number, totalTurnDeg: number, steps: number): Vec2 {
  let point = { ...origin };
  if (steps >= 0) {
    for (let index = 0; index < steps; index++) point = translate(point, speed, headingDeg, totalTurnDeg, index, 1);
  } else {
    for (let index = -1; index >= steps; index--) point = translate(point, speed, headingDeg, totalTurnDeg, index, -1);
  }
  return point;
}

function translate(point: Vec2, speed: number, headingDeg: number, totalTurnDeg: number, interval: number, direction: -1 | 1): Vec2 {
  const tangent = unit(headingDeg + totalTurnDeg * ((interval + .5) / IMPACT_WINDOW));
  return { x: point.x + direction * tangent.x * speed, y: point.y + direction * tangent.y * speed };
}

function mean(points: readonly Vec2[]): Vec2 {
  if (points.length === 0) throw new Error("mean requires at least one point");
  return {
    x: points.reduce((total, point) => total + point.x, 0) / points.length,
    y: points.reduce((total, point) => total + point.y, 0) / points.length,
  };
}

function meanNumber(values: readonly number[]): number {
  if (values.length === 0) throw new Error("meanNumber requires at least one value");
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function unit(degreesValue: number): Vec2 {
  const radians = degreesValue * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function rotate(point: Vec2, degreesValue: number): Vec2 {
  const radians = degreesValue * Math.PI / 180;
  return {
    x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
  };
}

function dot(left: Vec2, right: Vec2): number {
  return left.x * right.x + left.y * right.y;
}

function degrees(radians: number): number {
  return radians * 180 / Math.PI;
}

function finitePoint(point: Vec2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}
