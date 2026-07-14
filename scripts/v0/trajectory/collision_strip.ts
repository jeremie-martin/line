/**
 * Study-only two-stage transition geometry.
 *
 * The collision strip owns a bounded spatial neighbourhood of the current
 * contact. The support path starts at its exit and owns the remaining planned
 * outgoing support extent. Neither stage reads a specification, a seed, a
 * gap index, or legacy arc-placement policy.
 */
import type { TrackLine } from "../types.ts";
import { adaptiveCurveSegmentCount, type CurveResolutionOptions } from "./curve_resolution.ts";
import type { IncomingTargetFrame, ResolvedSupportEnvelope } from "./envelope/model.ts";
import { realizeSupportPath, type EnvelopeRealizerOptions } from "./envelope/realizer.ts";

export type CollisionStripControl = {
  /** Contact placement along the target tangent, in incoming-speed frames. */
  targetTangentOffsetFrames: number;
  /** Contact placement across the target tangent, in exposed sled spans. */
  targetNormalOffsetSledSpans: number;
  /** Pre-contact line direction relative to the target incoming tangent. */
  entryAngleRelativeDeg: number;
  /** Incoming line reach in incoming-speed frames. */
  preReachFrames: number;
  /** Explicit position-continuous but tangent-discontinuous collision turn. */
  collisionTurnDeg: number;
  /** Turn distributed over the local post-contact strip. */
  stripTurnDeg: number;
  /** Nominal supported time allocated to the local strip. */
  stripSupportFrames: number;
  /** Log2 power describing where the local strip spends its turn. */
  stripCurvatureSkew: number;
};

export type ResolvedCollisionStrip = {
  contactPoint: { x: number; y: number };
  entryAngleDeg: number;
  postEntryAngleDeg: number;
  stripExitAngleDeg: number;
  preReachPx: number;
  stripExtentPx: number;
  stripSupportFrames: number;
  remainingSupportFrames: number;
  remainingSupportExtentPx: number;
  stripCurvaturePower: number;
};

export type CollisionStripRealizerOptions = CurveResolutionOptions & {
  support?: EnvelopeRealizerOptions;
};

export type RealizedCollisionStripTransition = {
  lines: TrackLine[];
  contactPoint: { x: number; y: number };
  stripExitPoint: { x: number; y: number };
  entryAngleDeg: number;
  postEntryAngleDeg: number;
  stripExitAngleDeg: number;
  stripSegmentCount: number;
  supportSegmentCount: number;
};

/**
 * Allocate a local contact strip from the outgoing support budget. This is a
 * planning allocation, not a claim that drawn distance equals grounded time;
 * exact simulation observes actual occupancy afterwards.
 */
export function resolveCollisionStrip(
  frame: IncomingTargetFrame,
  envelope: ResolvedSupportEnvelope,
  control: CollisionStripControl,
): ResolvedCollisionStrip {
  const speed = positive("frame.speedPxPerFrame", frame.speedPxPerFrame);
  const sledSpanPx = positive("frame.sledSpanPx", frame.sledSpanPx);
  const targetAngle = radians(finite("frame.headingDeg", frame.headingDeg));
  const tangent = { x: Math.cos(targetAngle), y: Math.sin(targetAngle) };
  const normal = { x: -tangent.y, y: tangent.x };
  const targetTangentOffsetPx = finite("targetTangentOffsetFrames", control.targetTangentOffsetFrames) * speed;
  const targetNormalOffsetPx = finite("targetNormalOffsetSledSpans", control.targetNormalOffsetSledSpans) * sledSpanPx;
  const entryAngleDeg = frame.headingDeg + finite("entryAngleRelativeDeg", control.entryAngleRelativeDeg);
  const postEntryAngleDeg = entryAngleDeg + finite("collisionTurnDeg", control.collisionTurnDeg);
  const stripTurnDeg = finite("stripTurnDeg", control.stripTurnDeg);
  const stripExitAngleDeg = postEntryAngleDeg + stripTurnDeg;
  const preReachPx = positive("preReachFrames", control.preReachFrames) * speed;
  const requestedStripSupportFrames = nonNegative("stripSupportFrames", control.stripSupportFrames);
  const stripSupportFrames = Math.min(requestedStripSupportFrames, envelope.supportIntervals);
  const remainingSupportFrames = envelope.supportIntervals - stripSupportFrames;
  const stripFraction = envelope.supportIntervals <= 1e-9 ? 0 : stripSupportFrames / envelope.supportIntervals;
  const stripExtentPx = envelope.plannedExtentPx * stripFraction;
  const remainingSupportExtentPx = envelope.plannedExtentPx - stripExtentPx;
  const stripCurvaturePower = positive(
    "stripCurvaturePower",
    Math.pow(2, finite("stripCurvatureSkew", control.stripCurvatureSkew)),
  );
  return {
    contactPoint: {
      x: frame.reference.x + tangent.x * targetTangentOffsetPx + normal.x * targetNormalOffsetPx,
      y: frame.reference.y + tangent.y * targetTangentOffsetPx + normal.y * targetNormalOffsetPx,
    },
    entryAngleDeg,
    postEntryAngleDeg,
    stripExitAngleDeg,
    preReachPx,
    stripExtentPx,
    stripSupportFrames,
    remainingSupportFrames,
    remainingSupportExtentPx,
    stripCurvaturePower,
  };
}

/**
 * Realize a position-continuous pre-contact reach, an explicitly controlled
 * collision-local turn, then a G1-at-the-declared-tangent support envelope.
 */
export function realizeCollisionStripTransition(
  resolved: ResolvedCollisionStrip,
  envelope: ResolvedSupportEnvelope,
  lineIdStart: number,
  options: CollisionStripRealizerOptions = {},
): RealizedCollisionStripTransition {
  assertResolvedStrip(resolved);
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("collision strip lineIdStart must be a safe integer");
  const entryTangent = unit(resolved.entryAngleDeg);
  const entryPoint = {
    x: resolved.contactPoint.x - entryTangent.x * resolved.preReachPx,
    y: resolved.contactPoint.y - entryTangent.y * resolved.preReachPx,
  };
  const lines = [solidLine(lineIdStart, entryPoint, resolved.contactPoint)];
  let point = { ...resolved.contactPoint };
  const stripTurnDeg = resolved.stripExitAngleDeg - resolved.postEntryAngleDeg;
  const stripSegmentCount = adaptiveCurveSegmentCount(
    resolved.stripExtentPx,
    stripTurnDeg,
    resolved.stripCurvaturePower,
    options,
  );
  if (stripSegmentCount > 0) {
    const stripSegmentLength = resolved.stripExtentPx / stripSegmentCount;
    for (let index = 0; index < stripSegmentCount; index++) {
      // The first discrete strip segment uses the declared post-contact
      // tangent. This makes the collision turn explicit rather than hiding a
      // half-step turn inside midpoint sampling.
      const fraction = stripSegmentCount === 1 ? 0 : index / (stripSegmentCount - 1);
      const angleDeg = resolved.postEntryAngleDeg + stripTurnDeg * Math.pow(fraction, resolved.stripCurvaturePower);
      const tangent = unit(angleDeg);
      const next = {
        x: point.x + tangent.x * stripSegmentLength,
        y: point.y + tangent.y * stripSegmentLength,
      };
      lines.push(solidLine(lineIdStart + lines.length, point, next));
      point = next;
    }
  }
  const support = realizeSupportPath(
    { point, entryAngleDeg: resolved.stripExitAngleDeg },
    envelope,
    lineIdStart + lines.length,
    { ...options.support, extentPx: resolved.remainingSupportExtentPx, preserveEntryTangent: true },
  );
  lines.push(...support.lines);
  return {
    lines,
    contactPoint: { ...resolved.contactPoint },
    stripExitPoint: point,
    entryAngleDeg: resolved.entryAngleDeg,
    postEntryAngleDeg: resolved.postEntryAngleDeg,
    stripExitAngleDeg: resolved.stripExitAngleDeg,
    stripSegmentCount,
    supportSegmentCount: support.segmentCount,
  };
}

function assertResolvedStrip(strip: ResolvedCollisionStrip): void {
  for (const [name, value] of Object.entries({
    contactX: strip.contactPoint.x,
    contactY: strip.contactPoint.y,
    entryAngleDeg: strip.entryAngleDeg,
    postEntryAngleDeg: strip.postEntryAngleDeg,
    stripExitAngleDeg: strip.stripExitAngleDeg,
  })) finite(name, value);
  positive("preReachPx", strip.preReachPx);
  nonNegative("stripExtentPx", strip.stripExtentPx);
  nonNegative("stripSupportFrames", strip.stripSupportFrames);
  nonNegative("remainingSupportFrames", strip.remainingSupportFrames);
  nonNegative("remainingSupportExtentPx", strip.remainingSupportExtentPx);
  positive("stripCurvaturePower", strip.stripCurvaturePower);
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
  const angle = radians(angleDeg);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function radians(value: number): number {
  return value * Math.PI / 180;
}

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
}

function nonNegative(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be non-negative and finite`);
  return value;
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}
