/**
 * Polyline realization of the trajectory study's contact primitive.
 *
 * A tangent-continuous support law is integrated in the incoming rider Frenet
 * frame. The engine still receives ordinary solid line segments and remains
 * responsible for every contact and survival decision.
 */
import type { TrackLine } from "../types.ts";
import type { ContactPrimitiveControl } from "./primitive.ts";
import type { PlanningState, Vec2 } from "./state.ts";

export type RealizedContactPrimitive = {
  lines: TrackLine[];
  entryPoint: Vec2;
  contactPoint: Vec2;
  releasePoint: Vec2;
  entryAngleDeg: number;
  exitAngleDeg: number;
};

export function realizeContactPrimitive(
  contactAnchorState: PlanningState,
  control: ContactPrimitiveControl,
  lineIdStart: number,
): RealizedContactPrimitive {
  // The primitive is placed in the physical frame that the exact evaluator
  // will reach at the target contact. A prior phase state can inform the
  // control, but it cannot anchor geometry for a later collision window.
  const speed = Math.max(1, contactAnchorState.speed);
  const entryAngleDeg = contactAnchorState.velocityAngleDeg + control.entryAngleRelativeDeg;
  const entryAngle = degreesToRadians(entryAngleDeg);
  const tangent = { x: Math.cos(entryAngle), y: Math.sin(entryAngle) };
  const normal = { x: -tangent.y, y: tangent.x };
  const contactPoint = {
    x: contactAnchorState.reference.x + tangent.x * speed * control.entryLeadFrames + normal.x * control.normalOffsetPx,
    y: contactAnchorState.reference.y + tangent.y * speed * control.entryLeadFrames + normal.y * control.normalOffsetPx,
  };
  const preFrames = Math.max(1, control.entryLeadFrames + 1.25);
  const entryPoint = {
    x: contactPoint.x - tangent.x * speed * preFrames,
    y: contactPoint.y - tangent.y * speed * preFrames,
  };
  const lines: TrackLine[] = [solidLine(lineIdStart, entryPoint, contactPoint)];

  const supportFrames = Math.max(0.25, control.supportFrames);
  const supportLength = speed * supportFrames;
  // Keep the approximation in time units rather than a legacy pixel cap. This
  // remains bounded by the caller's physical support-time intent, including
  // multi-second rideouts.
  const segments = Math.max(3, Math.ceil(supportFrames / 1.25));
  const segmentLength = supportLength / segments;
  let point = { ...contactPoint };
  for (let index = 0; index < segments; index++) {
    // The first support segment shares the pre-contact tangent. A polyline
    // cannot be globally C1, but the contact itself must not contain a hidden
    // angle discontinuity introduced by midpoint sampling.
    const progress = turnProgress(
      segments === 1 ? 1 : index / (segments - 1),
      control.turnFrontload,
    );
    const angle = degreesToRadians(entryAngleDeg + control.totalTurnDeg * progress);
    const next = {
      x: point.x + Math.cos(angle) * segmentLength,
      y: point.y + Math.sin(angle) * segmentLength,
    };
    lines.push(solidLine(lineIdStart + lines.length, point, next));
    point = next;
  }
  return {
    lines,
    entryPoint,
    contactPoint,
    releasePoint: point,
    entryAngleDeg,
    exitAngleDeg: entryAngleDeg + control.totalTurnDeg,
  };
}

function turnProgress(t: number, frontload: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  // Negative frontload has exponent < 1 and therefore spends more turn near
  // contact; positive values defer turn toward release.
  return Math.pow(clamped, Math.pow(2, frontload));
}

function solidLine(id: number, start: Vec2, end: Vec2): TrackLine {
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

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}
