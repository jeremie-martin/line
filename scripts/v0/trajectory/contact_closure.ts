/**
 * Study-only local terrain primitive centered on one predicted contact frame.
 *
 * It deliberately owns only the incoming catch and a short post-contact
 * continuation. It has no outgoing-duration, air, speed, or support-envelope
 * input. This lets a study ask whether the contact geometry itself closes
 * before a later state-time terrain model is introduced.
 */
import type { TrackLine } from "../types.ts";
import type { TargetFrame } from "./target_frame.ts";

export type ContactClosureControl = {
  /** Contact placement along the target-frame tangent in incoming-speed frames. */
  targetTangentOffsetFrames: number;
  /** Contact placement across the target-frame tangent in exposed sled spans. */
  targetNormalOffsetSledSpans: number;
  /** Incoming terrain tangent relative to the measured target-frame heading. */
  entryAngleRelativeDeg: number;
  /** Incoming terrain reach in incoming-speed frames. */
  preReachFrames: number;
  /** Explicit tangent change at the contact junction. */
  collisionTurnDeg: number;
  /** Short continuation after the contact in incoming-speed frames. */
  localContinuationFrames: number;
};

export type ResolvedContactClosure = {
  contactPoint: { x: number; y: number };
  entryPoint: { x: number; y: number };
  exitPoint: { x: number; y: number };
  entryAngleDeg: number;
  postContactAngleDeg: number;
  preReachPx: number;
  localContinuationPx: number;
};

export type RealizedContactClosure = ResolvedContactClosure & {
  lines: TrackLine[];
  /** IDs that may satisfy the local contact-closure endpoint. */
  contactClosureLineIds: number[];
  lineRoles: { ingress: number; guard: number };
  /** Geometric only; a later exact read determines the physical boundary state. */
  handoff: { point: { x: number; y: number }; tangentDeg: number; source: "closure_geometry" };
};

/**
 * Resolve only coordinates and lengths that are local to the target contact.
 * The target frame is the sole state input; downstream authored axes are
 * intentionally absent.
 */
export function resolveContactClosure(
  frame: TargetFrame,
  control: ContactClosureControl,
): ResolvedContactClosure {
  const speed = positive("frame.speedPxPerFrame", frame.speedPxPerFrame);
  const sledSpan = positive("frame.sledSpanPx", frame.sledSpanPx);
  const heading = finite("frame.headingDeg", frame.headingDeg);
  const tangent = unit(heading);
  const normal = { x: -tangent.y, y: tangent.x };
  const contactPoint = {
    x: frame.reference.x + tangent.x * finite("targetTangentOffsetFrames", control.targetTangentOffsetFrames) * speed +
      normal.x * finite("targetNormalOffsetSledSpans", control.targetNormalOffsetSledSpans) * sledSpan,
    y: frame.reference.y + tangent.y * finite("targetTangentOffsetFrames", control.targetTangentOffsetFrames) * speed +
      normal.y * finite("targetNormalOffsetSledSpans", control.targetNormalOffsetSledSpans) * sledSpan,
  };
  const entryAngleDeg = heading + finite("entryAngleRelativeDeg", control.entryAngleRelativeDeg);
  const postContactAngleDeg = entryAngleDeg + finite("collisionTurnDeg", control.collisionTurnDeg);
  const preReachPx = positive("preReachFrames", control.preReachFrames) * speed;
  const localContinuationPx = positive("localContinuationFrames", control.localContinuationFrames) * speed;
  const entryTangent = unit(entryAngleDeg);
  const postContactTangent = unit(postContactAngleDeg);
  const entryPoint = {
    x: contactPoint.x - entryTangent.x * preReachPx,
    y: contactPoint.y - entryTangent.y * preReachPx,
  };
  const exitPoint = {
    x: contactPoint.x + postContactTangent.x * localContinuationPx,
    y: contactPoint.y + postContactTangent.y * localContinuationPx,
  };
  return {
    contactPoint,
    entryPoint,
    exitPoint,
    entryAngleDeg,
    postContactAngleDeg,
    preReachPx,
    localContinuationPx,
  };
}

/** Realize a two-segment, position-continuous local contact primitive. */
export function realizeContactClosure(
  resolved: ResolvedContactClosure,
  lineIdStart: number,
): RealizedContactClosure {
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  assertResolved(resolved);
  const lines = [
    solidLine(lineIdStart, resolved.entryPoint, resolved.contactPoint),
    solidLine(lineIdStart + 1, resolved.contactPoint, resolved.exitPoint),
  ];
  return {
    ...resolved,
    lines,
    contactClosureLineIds: lines.map((line) => line.id),
    lineRoles: { ingress: lines[0]!.id, guard: lines[1]!.id },
    handoff: {
      point: { ...resolved.exitPoint },
      tangentDeg: resolved.postContactAngleDeg,
      source: "closure_geometry",
    },
  };
}

function assertResolved(value: ResolvedContactClosure): void {
  for (const [name, number] of Object.entries({
    contactX: value.contactPoint.x,
    contactY: value.contactPoint.y,
    entryX: value.entryPoint.x,
    entryY: value.entryPoint.y,
    exitX: value.exitPoint.x,
    exitY: value.exitPoint.y,
    entryAngleDeg: value.entryAngleDeg,
    postContactAngleDeg: value.postContactAngleDeg,
  })) finite(name, number);
  positive("preReachPx", value.preReachPx);
  positive("localContinuationPx", value.localContinuationPx);
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

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}
