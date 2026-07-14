/**
 * Study-only C1 capture boundary plus adaptive polyline response for one
 * target contact.
 *
 * The anchor follows the predicted sled point, while entry incidence follows
 * CoM velocity because the scored impact measures CoM redirection. The band
 * then approximates the remaining requested turn over the same six-frame
 * window used by the impact scorer. It contains no gap-duration, case, seed,
 * or outgoing-support input.
 */
import { PERSISTENCE_FRAMES } from "../../lib/detector.ts";
import { IMPACT_WINDOW, type TrackLine } from "../types.ts";
import { adaptiveCurveSegmentCount } from "./curve_resolution.ts";
import type { ContactKinematicFrame } from "./contact_kinematic_frame.ts";

export const CAPTURE_ARC_RESPONSE_HORIZON_FRAMES = Math.max(PERSISTENCE_FRAMES, IMPACT_WINDOW);

export type ContactCaptureArcControl = {
  /**
   * Signed response orientation. Impact specifies a magnitude only, so a
   * universal proposal family must make both physically mirrored directions
   * explicit instead of hiding one in the construction formula.
   */
  turnOrientation: -1 | 1;
  /**
   * Predicted reference-point phase from the authored target through one
   * reference-speed frame after it. This is expressed along the sled-point
   * target frame, not the terrain tangent.
   */
  targetPhaseOffsetFrames: number;
  /** Share of the catchable requested turn spent as initial capture incidence. */
  entryTurnShare: number;
  /** Finite C1 approach before the target boundary, in reference-speed frames. */
  approachFrames: number;
  /** Collinear post-boundary runway before the smooth response arc. */
  runwayFrames: number;
};

export type ResolvedContactCaptureArc = {
  capturePoint: { x: number; y: number };
  approachPoint: { x: number; y: number };
  runwayExitPoint: { x: number; y: number };
  exitPoint: { x: number; y: number };
  entryAngleDeg: number;
  exitAngleDeg: number;
  turnOrientation: -1 | 1;
  impactTurnDeg: number;
  entryTurnDeg: number;
  remainingTurnDeg: number;
  approachPx: number;
  runwayPx: number;
  arcExtentPx: number;
  arcSegmentCount: number;
  responseHorizonFrames: number;
};

export type RealizedContactCaptureArc = ResolvedContactCaptureArc & {
  lines: TrackLine[];
  lineRoles: { approach: number; runway: number; arc: number[] };
  /** Every line in the C1 local capture band may own the target collision. */
  captureBandLineIds: number[];
  handoff: { point: { x: number; y: number }; tangentDeg: number; source: "capture_arc_geometry" };
};

/**
 * Resolve local geometry only. The final target tangent is the CoM heading
 * plus the explicitly chosen signed catchable redirection; `entryTurnShare`
 * chooses how the same total response is distributed between initial incidence
 * and later curvature. Exact simulation judges collision and achieved response.
 */
export function resolveContactCaptureArc(
  frame: ContactKinematicFrame,
  control: ContactCaptureArcControl,
): ResolvedContactCaptureArc {
  if (frame.impact === null) {
    throw new Error("contact capture arc requires an authored impact target; non-impact contact formulation is separate work");
  }
  const anchorSpeed = positive("frame.anchor.speedPxPerFrame", frame.anchor.speedPxPerFrame);
  const anchorHeading = finite("frame.anchor.headingDeg", frame.anchor.headingDeg);
  const comHeading = finite("frame.com.headingDeg", frame.com.headingDeg);
  const phaseOffset = bounded("targetPhaseOffsetFrames", control.targetPhaseOffsetFrames, 0, 1);
  const entryTurnShare = bounded("entryTurnShare", control.entryTurnShare, 0, 1);
  const turnOrientation = orientation(control.turnOrientation);
  const approachFrames = positive("approachFrames", control.approachFrames);
  const runwayFrames = positive("runwayFrames", control.runwayFrames);
  if (!(runwayFrames < CAPTURE_ARC_RESPONSE_HORIZON_FRAMES)) {
    throw new Error(`runwayFrames must be below the ${CAPTURE_ARC_RESPONSE_HORIZON_FRAMES}-frame capture response horizon`);
  }
  const impactTurnDeg = positiveImpactTurn(frame.impact.catchableTurnDeg);
  const entryTurnDeg = impactTurnDeg * entryTurnShare;
  const remainingTurnDeg = turnOrientation * (impactTurnDeg - entryTurnDeg);
  const entryAngleDeg = comHeading + turnOrientation * entryTurnDeg;
  const exitAngleDeg = entryAngleDeg + remainingTurnDeg;
  const anchorTangent = unit(anchorHeading);
  const capturePoint = {
    x: frame.anchor.reference.x + anchorTangent.x * phaseOffset * anchorSpeed,
    y: frame.anchor.reference.y + anchorTangent.y * phaseOffset * anchorSpeed,
  };
  const entryTangent = unit(entryAngleDeg);
  const approachPx = approachFrames * anchorSpeed;
  const runwayPx = runwayFrames * anchorSpeed;
  const arcExtentPx = (CAPTURE_ARC_RESPONSE_HORIZON_FRAMES - runwayFrames) * anchorSpeed;
  const approachPoint = {
    x: capturePoint.x - entryTangent.x * approachPx,
    y: capturePoint.y - entryTangent.y * approachPx,
  };
  const runwayExitPoint = {
    x: capturePoint.x + entryTangent.x * runwayPx,
    y: capturePoint.y + entryTangent.y * runwayPx,
  };
  const resolvedCount = adaptiveCurveSegmentCount(arcExtentPx, remainingTurnDeg, 1);
  const arcSegmentCount = Math.abs(remainingTurnDeg) <= 1e-12 ? 1 : Math.max(2, resolvedCount);
  let point = { ...runwayExitPoint };
  const arcSegmentPx = arcExtentPx / arcSegmentCount;
  for (let index = 0; index < arcSegmentCount; index++) {
    const fraction = arcSegmentCount === 1 ? 0 : index / (arcSegmentCount - 1);
    const tangent = unit(entryAngleDeg + remainingTurnDeg * fraction);
    point = { x: point.x + tangent.x * arcSegmentPx, y: point.y + tangent.y * arcSegmentPx };
  }
  return {
    capturePoint,
    approachPoint,
    runwayExitPoint,
    exitPoint: point,
    entryAngleDeg,
    exitAngleDeg,
    turnOrientation,
    impactTurnDeg,
    entryTurnDeg,
    remainingTurnDeg,
    approachPx,
    runwayPx,
    arcExtentPx,
    arcSegmentCount,
    responseHorizonFrames: CAPTURE_ARC_RESPONSE_HORIZON_FRAMES,
  };
}

export function realizeContactCaptureArc(
  resolved: ResolvedContactCaptureArc,
  lineIdStart: number,
): RealizedContactCaptureArc {
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  assertResolved(resolved);
  const lines: TrackLine[] = [];
  lines.push(solidLine(lineIdStart + lines.length, resolved.approachPoint, resolved.capturePoint));
  lines.push(solidLine(lineIdStart + lines.length, resolved.capturePoint, resolved.runwayExitPoint));
  let point = { ...resolved.runwayExitPoint };
  const segmentPx = resolved.arcExtentPx / resolved.arcSegmentCount;
  for (let index = 0; index < resolved.arcSegmentCount; index++) {
    // The first arc segment shares the entry tangent, preserving C1 geometry
    // across approach, target boundary, and runway. Later joins approximate
    // the smooth curve with a bounded-angle polyline.
    const fraction = resolved.arcSegmentCount === 1 ? 0 : index / (resolved.arcSegmentCount - 1);
    const tangent = unit(resolved.entryAngleDeg + resolved.remainingTurnDeg * fraction);
    const next = { x: point.x + tangent.x * segmentPx, y: point.y + tangent.y * segmentPx };
    lines.push(solidLine(lineIdStart + lines.length, point, next));
    point = next;
  }
  if (distance(point, resolved.exitPoint) > 1e-8) throw new Error("capture arc realization drifted from its resolved exit");
  const approach = lines[0]!;
  const runway = lines[1]!;
  const arc = lines.slice(2).map((line) => line.id);
  return {
    ...resolved,
    lines,
    lineRoles: { approach: approach.id, runway: runway.id, arc },
    captureBandLineIds: lines.map((line) => line.id),
    handoff: {
      point: { ...resolved.exitPoint },
      tangentDeg: resolved.exitAngleDeg,
      source: "capture_arc_geometry",
    },
  };
}

function assertResolved(value: ResolvedContactCaptureArc): void {
  for (const [name, number] of Object.entries({
    captureX: value.capturePoint.x,
    captureY: value.capturePoint.y,
    approachX: value.approachPoint.x,
    approachY: value.approachPoint.y,
    runwayExitX: value.runwayExitPoint.x,
    runwayExitY: value.runwayExitPoint.y,
    exitX: value.exitPoint.x,
    exitY: value.exitPoint.y,
    entryAngleDeg: value.entryAngleDeg,
    exitAngleDeg: value.exitAngleDeg,
    impactTurnDeg: value.impactTurnDeg,
    entryTurnDeg: value.entryTurnDeg,
    remainingTurnDeg: value.remainingTurnDeg,
  })) finite(name, number);
  positive("approachPx", value.approachPx);
  positive("runwayPx", value.runwayPx);
  positive("arcExtentPx", value.arcExtentPx);
  orientation(value.turnOrientation);
  if (!Number.isSafeInteger(value.arcSegmentCount) || value.arcSegmentCount < 1) {
    throw new Error("arcSegmentCount must be a positive safe integer");
  }
}

function solidLine(
  id: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
): TrackLine {
  return {
    id,
    type: 0,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    flipped: false,
    leftExtended: false,
    rightExtended: false,
  };
}

function unit(angleDeg: number): { x: number; y: number } {
  const radians = angleDeg * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
}

function positiveImpactTurn(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("frame.impact.catchableTurnDeg must be finite and non-negative");
  }
  if (value === 0) {
    throw new Error(
      "capture arc currently scopes to authored impact > 0; zero-impact contact needs a separately predeclared neutral-incidence study",
    );
  }
  return value;
}

function orientation(value: number): -1 | 1 {
  if (value !== -1 && value !== 1) {
    throw new Error("turnOrientation must be -1 or 1");
  }
  return value;
}

function bounded(name: string, value: number, lower: number, upper: number): number {
  if (!Number.isFinite(value) || value < lower || value > upper) {
    throw new Error(`${name} must be in [${lower}, ${upper}]`);
  }
  return value;
}
