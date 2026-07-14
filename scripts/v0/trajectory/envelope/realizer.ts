/**
 * Polyline realization for the independent contact-strip/support-envelope
 * model. The realizer is geometry-only: it does not inspect a spec, a seed, or
 * legacy compiler policy, and it makes no physics or scoring decision.
 */
import type { TrackLine } from "../../types.ts";
import type {
  IncomingTargetFrame,
  TransitionEnvelopeControl,
} from "./model.ts";
import { adaptiveCurveSegmentCount, type CurveResolutionOptions } from "../curve_resolution.ts";

export type EnvelopeRealizerOptions = CurveResolutionOptions;

export type RealizedTransitionEnvelope = {
  lines: TrackLine[];
  contactPoint: { x: number; y: number };
  entryAngleDeg: number;
  supportEntryAngleDeg: number;
  supportExitAngleDeg: number;
  supportSegmentCount: number;
};

export type SupportPathStart = {
  point: { x: number; y: number };
  entryAngleDeg: number;
};

/**
 * Geometry-only support description. The realizer deliberately does not need
 * an exit-speed prediction or a kinematic-grade derivation; those belong to a
 * planner and may differ between study formulations.
 */
export type SupportPathPlan = {
  intervalFrames: number;
  supportIntervals: number;
  plannedAirborneIntervals: number;
  plannedExtentPx: number;
  meanGradeDeg: number;
  curvaturePower: number;
};

export type RealizedSupportPath = {
  lines: TrackLine[];
  exitPoint: { x: number; y: number };
  entryAngleDeg: number;
  exitAngleDeg: number;
  segmentCount: number;
};

export type SupportPathOptions = EnvelopeRealizerOptions & {
  /**
   * A composite primitive may reserve a collision-local portion of the total
   * planned extent. The support path then owns only this remaining extent.
   */
  extentPx?: number;
  /**
   * Make the first realized support segment share `start.entryAngleDeg`.
   * This is used when a collision strip hands off a declared entry tangent.
   * A polyline cannot be literally G1 at its vertices; the adaptive angular
   * bound limits each subsequent line-to-line turn instead.
   */
  preserveEntryTangent?: boolean;
};

/**
 * Draw a short incoming reach into an independently anchored contact point,
 * followed by a support path whose arc length scales with elapsed outgoing
 * time. A non-zero `contactTurnDeg` is explicit collision geometry, not a
 * hidden midpoint kink.
 */
export function realizeTransitionEnvelope(
  frame: IncomingTargetFrame,
  control: TransitionEnvelopeControl,
  envelope: ResolvedSupportEnvelope,
  lineIdStart: number,
  options: EnvelopeRealizerOptions = {},
): RealizedTransitionEnvelope {
  const speed = positive("frame.speedPxPerFrame", frame.speedPxPerFrame);
  const preReachPx = positive("preReachPx", control.preReachPx);
  assertEnvelope(envelope);
  const targetAngle = radians(frame.headingDeg);
  const targetTangent = { x: Math.cos(targetAngle), y: Math.sin(targetAngle) };
  const targetNormal = { x: -targetTangent.y, y: targetTangent.x };
  const contactPoint = {
    x: frame.reference.x + targetTangent.x * finite("targetTangentOffsetPx", control.targetTangentOffsetPx) +
      targetNormal.x * finite("targetNormalOffsetPx", control.targetNormalOffsetPx),
    y: frame.reference.y + targetTangent.y * finite("targetTangentOffsetPx", control.targetTangentOffsetPx) +
      targetNormal.y * finite("targetNormalOffsetPx", control.targetNormalOffsetPx),
  };
  const entryAngleDeg = frame.headingDeg + finite("entryAngleRelativeDeg", control.entryAngleRelativeDeg);
  const entryTangent = unit(entryAngleDeg);
  const entryPoint = {
    x: contactPoint.x - entryTangent.x * preReachPx,
    y: contactPoint.y - entryTangent.y * preReachPx,
  };
  const lines: TrackLine[] = [solidLine(lineIdStart, entryPoint, contactPoint)];
  const supportEntryAngleDeg = entryAngleDeg + finite("contactTurnDeg", control.contactTurnDeg);
  const support = realizeSupportPath(
    { point: contactPoint, entryAngleDeg: supportEntryAngleDeg },
    envelope,
    lineIdStart + lines.length,
    options,
  );
  lines.push(...support.lines);
  // Keep the parameter present in this geometry boundary: a zero/invalid speed
  // must fail before it can silently create a degenerate time-to-distance plan.
  void speed;
  return {
    lines,
    contactPoint,
    entryAngleDeg,
    supportEntryAngleDeg,
    supportExitAngleDeg: support.exitAngleDeg,
    supportSegmentCount: support.segmentCount,
  };
}

/**
 * Realize the support portion independently from collision geometry. The
 * caller supplies the physical start point and tangent; this function only
 * approximates the declared outgoing envelope. When the first segment is
 * anchored to that tangent, it inserts one additional emitted segment so the
 * resolution's per-turn guarantee applies to actual adjacent segments.
 */
export function realizeSupportPath(
  start: SupportPathStart,
  envelope: SupportPathPlan,
  lineIdStart: number,
  options: SupportPathOptions = {},
): RealizedSupportPath {
  assertEnvelope(envelope);
  finite("support start x", start.point.x);
  finite("support start y", start.point.y);
  finite("support entryAngleDeg", start.entryAngleDeg);
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("support lineIdStart must be a safe integer");
  const extentPx = nonNegative("support extentPx", options.extentPx ?? envelope.plannedExtentPx);
  // Integral of t^p on [0, 1] is 1/(p+1). Choose the endpoint turn so the
  // ideal continuous tangent-angle mean equals the planned mean grade; the
  // finite adaptive polyline is an approximation that exact physics observes.
  const totalTurnDeg = (envelope.meanGradeDeg - start.entryAngleDeg) * (envelope.curvaturePower + 1);
  const exitAngleDeg = start.entryAngleDeg + totalTurnDeg;
  if (Math.abs(start.entryAngleDeg) > 85 || Math.abs(exitAngleDeg) > 85) {
    throw new Error("support tangent exceeds the explicit study envelope");
  }
  if (extentPx <= 1e-9) {
    return {
      lines: [],
      exitPoint: { ...start.point },
      entryAngleDeg: start.entryAngleDeg,
      exitAngleDeg: start.entryAngleDeg,
      segmentCount: 0,
    };
  }
  const resolvedSegmentCount = adaptiveCurveSegmentCount(
    extentPx,
    totalTurnDeg,
    envelope.curvaturePower,
    options,
  );
  const segmentCount = options.preserveEntryTangent && Math.abs(totalTurnDeg) > 1e-12
    // `resolvedSegmentCount` is the number of angular intervals required by
    // adaptiveCurveSegmentCount. Anchoring a first line adds its initial angle
    // sample, so the emitted polyline needs one more line than intervals.
    ? resolvedSegmentCount + 1
    : resolvedSegmentCount;
  let point = { ...start.point };
  const segmentLength = extentPx / segmentCount;
  const lines: TrackLine[] = [];
  for (let index = 0; index < segmentCount; index++) {
    // Midpoint tangents are the first-order integral of the continuous angle
    // schedule. This avoids making the endpoint line carry all the turn.
    const fraction = options.preserveEntryTangent
      ? (segmentCount === 1 ? 0 : index / (segmentCount - 1))
      : (index + 0.5) / segmentCount;
    const angleDeg = start.entryAngleDeg + totalTurnDeg * Math.pow(fraction, envelope.curvaturePower);
    const tangent = unit(angleDeg);
    const next = {
      x: point.x + tangent.x * segmentLength,
      y: point.y + tangent.y * segmentLength,
    };
    lines.push(solidLine(lineIdStart + lines.length, point, next));
    point = next;
  }
  return { lines, exitPoint: point, entryAngleDeg: start.entryAngleDeg, exitAngleDeg, segmentCount };
}

function solidLine(id: number, start: { x: number; y: number }, end: { x: number; y: number }): TrackLine {
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
  const value = radians(angleDeg);
  return { x: Math.cos(value), y: Math.sin(value) };
}

function radians(value: number): number {
  return value * Math.PI / 180;
}

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

function nonNegative(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be non-negative and finite`);
  return value;
}

function assertEnvelope(envelope: SupportPathPlan): void {
  if (!Number.isSafeInteger(envelope.intervalFrames) || envelope.intervalFrames < 0) {
    throw new Error("envelope.intervalFrames must be a non-negative safe integer");
  }
  nonNegative("envelope.supportIntervals", envelope.supportIntervals);
  nonNegative("envelope.plannedAirborneIntervals", envelope.plannedAirborneIntervals);
  if (Math.abs(
    envelope.supportIntervals + envelope.plannedAirborneIntervals - envelope.intervalFrames,
  ) > 1e-8) {
    throw new Error("envelope occupancy partition must equal its outgoing interval");
  }
  nonNegative("envelope.plannedExtentPx", envelope.plannedExtentPx);
  finite("envelope.meanGradeDeg", envelope.meanGradeDeg);
  positive("envelope.curvaturePower", envelope.curvaturePower);
}
