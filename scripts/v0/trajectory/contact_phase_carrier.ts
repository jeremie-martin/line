/**
 * Study-only local contact-phase terrain primitive.
 *
 * The intended contact is the start of a finite carrier segment, not a forced
 * terrain kink. A collinear approach reaches that point, the carrier gives
 * collision ownership a finite phase, and a later tail spends an explicit
 * post-contact turn. No outgoing interval or support model enters here.
 */
import type { TrackLine } from "../types.ts";
import type { TargetFrame } from "./target_frame.ts";

export type ContactPhaseCarrierControl = {
  targetTangentOffsetFrames: number;
  targetNormalOffsetSledSpans: number;
  entryAngleRelativeDeg: number;
  approachFrames: number;
  carrierFrames: number;
  tailTurnDeg: number;
  tailFrames: number;
};

export type ResolvedContactPhaseCarrier = {
  contactPoint: { x: number; y: number };
  approachPoint: { x: number; y: number };
  carrierExitPoint: { x: number; y: number };
  handoffPoint: { x: number; y: number };
  entryAngleDeg: number;
  tailAngleDeg: number;
  approachPx: number;
  carrierPx: number;
  tailPx: number;
};

export type RealizedContactPhaseCarrier = ResolvedContactPhaseCarrier & {
  lines: TrackLine[];
  lineRoles: { approach: number; carrier: number; tail: number };
  carrierLineIds: number[];
  handoff: { point: { x: number; y: number }; tangentDeg: number; source: "phase_carrier_geometry" };
};

export function resolveContactPhaseCarrier(
  frame: TargetFrame,
  control: ContactPhaseCarrierControl,
): ResolvedContactPhaseCarrier {
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
  const tailAngleDeg = entryAngleDeg + finite("tailTurnDeg", control.tailTurnDeg);
  const approachPx = positive("approachFrames", control.approachFrames) * speed;
  const carrierPx = positive("carrierFrames", control.carrierFrames) * speed;
  const tailPx = positive("tailFrames", control.tailFrames) * speed;
  const entryTangent = unit(entryAngleDeg);
  const tailTangent = unit(tailAngleDeg);
  const approachPoint = {
    x: contactPoint.x - entryTangent.x * approachPx,
    y: contactPoint.y - entryTangent.y * approachPx,
  };
  const carrierExitPoint = {
    x: contactPoint.x + entryTangent.x * carrierPx,
    y: contactPoint.y + entryTangent.y * carrierPx,
  };
  const handoffPoint = {
    x: carrierExitPoint.x + tailTangent.x * tailPx,
    y: carrierExitPoint.y + tailTangent.y * tailPx,
  };
  return {
    contactPoint,
    approachPoint,
    carrierExitPoint,
    handoffPoint,
    entryAngleDeg,
    tailAngleDeg,
    approachPx,
    carrierPx,
    tailPx,
  };
}

export function realizeContactPhaseCarrier(
  resolved: ResolvedContactPhaseCarrier,
  lineIdStart: number,
): RealizedContactPhaseCarrier {
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  assertResolved(resolved);
  const lines = [
    solidLine(lineIdStart, resolved.approachPoint, resolved.contactPoint),
    solidLine(lineIdStart + 1, resolved.contactPoint, resolved.carrierExitPoint),
    solidLine(lineIdStart + 2, resolved.carrierExitPoint, resolved.handoffPoint),
  ];
  return {
    ...resolved,
    lines,
    lineRoles: { approach: lines[0]!.id, carrier: lines[1]!.id, tail: lines[2]!.id },
    carrierLineIds: [lines[1]!.id],
    handoff: {
      point: { ...resolved.handoffPoint },
      tangentDeg: resolved.tailAngleDeg,
      source: "phase_carrier_geometry",
    },
  };
}

function assertResolved(value: ResolvedContactPhaseCarrier): void {
  for (const [name, number] of Object.entries({
    contactX: value.contactPoint.x,
    contactY: value.contactPoint.y,
    approachX: value.approachPoint.x,
    approachY: value.approachPoint.y,
    carrierExitX: value.carrierExitPoint.x,
    carrierExitY: value.carrierExitPoint.y,
    handoffX: value.handoffPoint.x,
    handoffY: value.handoffPoint.y,
    entryAngleDeg: value.entryAngleDeg,
    tailAngleDeg: value.tailAngleDeg,
  })) finite(name, number);
  positive("approachPx", value.approachPx);
  positive("carrierPx", value.carrierPx);
  positive("tailPx", value.tailPx);
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
