/**
 * Geometry-only contact strip for trajectory-synthesis studies.
 *
 * This is deliberately independent of arc-placement policy. It converts an
 * explicit contact-frame coordinate into ordinary line segments; the caller
 * still has to submit those lines to the existing exact evaluator.
 */
import type { TrackLine } from "../types.ts";

export type ContactFrame = {
  /** Physical point used as the local origin for this contact prediction. */
  reference: { x: number; y: number };
  /** Incoming velocity heading at that prediction, in degrees. */
  headingDeg: number;
};

/**
 * A compact, event-aligned contact representation.
 *
 * Distances are intentionally in pixels in this first containment study. That
 * makes the geometry exactly reversible. A later time-normalized planner may
 * derive bounded proposals from speed, but must demonstrate that conversion
 * rather than silently losing this representation's coverage.
 */
export type ContactStripControl = {
  /** Contact displacement along the incoming target-frame tangent. */
  targetTangentOffsetPx: number;
  /** Contact displacement along the incoming target-frame normal. */
  targetNormalOffsetPx: number;
  /** Entry-tangent residual from `frame.headingDeg`. */
  entryAngleRelativeDeg: number;
  /** Independent incoming surface reach before the event. */
  preReachPx: number;
  /** Total drawn extent after the event; not an asserted grounded duration. */
  surfaceExtentPx: number;
  /** Entry-to-exit tangent turn over the post-contact surface. */
  totalTurnDeg: number;
  /** Turning schedule exponent; 1 is uniform turn by segment fraction. */
  turnExponent: number;
};

export type ContactStripRealizationMode =
  /** Reproduces a standard endpoint-turn polyline, including its contact kink. */
  | "endpoint_turn"
  /** First support segment is tangent-continuous with the incoming reach. */
  | "tangent_continuous";

export type ContactStripRealizationOptions = {
  postSegments?: number;
  mode?: ContactStripRealizationMode;
};

export type RealizedContactStrip = {
  lines: TrackLine[];
  contactPoint: { x: number; y: number };
  entryAngleDeg: number;
  exitAngleDeg: number;
  postSegments: number;
  mode: ContactStripRealizationMode;
};

export type ExtractedContactStrip = {
  control: ContactStripControl;
  postSegments: number;
};

/**
 * Lossless target-frame form for an arbitrary connected strip. It is a study
 * artifact, not a production control surface. Keeping it separate lets the
 * containment diagnostic distinguish a coordinate limitation from a compact
 * model limitation.
 */
export type ExactContactStripProfile = {
  targetTangentOffsetPx: number;
  targetNormalOffsetPx: number;
  entryAngleRelativeDeg: number;
  preReachPx: number;
  post: Array<{ lengthPx: number; angleRelativeDeg: number }>;
};

/**
 * Realize an event-aligned strip without inspecting authored targets, case
 * identity, RNG state, or compiler policy. `endpoint_turn` exists only for
 * lossless containment tests; a production primitive must earn the smoother
 * mode through exact evidence. Contact position is resolved before entry
 * orientation, so an approach-angle change cannot move the contact event.
 */
export function realizeContactStrip(
  frame: ContactFrame,
  control: ContactStripControl,
  lineIdStart: number,
  options: ContactStripRealizationOptions = {},
): RealizedContactStrip {
  const postSegments = validatePostSegments(options.postSegments ?? 8);
  const mode = options.mode ?? "endpoint_turn";
  const preReachPx = requirePositive("preReachPx", control.preReachPx);
  const surfaceExtentPx = requirePositive("surfaceExtentPx", control.surfaceExtentPx);
  const turnExponent = requirePositive("turnExponent", control.turnExponent);
  const targetAngle = degreesToRadians(frame.headingDeg);
  const targetTangent = { x: Math.cos(targetAngle), y: Math.sin(targetAngle) };
  const targetNormal = { x: -targetTangent.y, y: targetTangent.x };
  const entryAngleDeg = frame.headingDeg + control.entryAngleRelativeDeg;
  const entryAngle = degreesToRadians(entryAngleDeg);
  const tangent = { x: Math.cos(entryAngle), y: Math.sin(entryAngle) };
  const contactPoint = {
    x: frame.reference.x +
      targetTangent.x * control.targetTangentOffsetPx +
      targetNormal.x * control.targetNormalOffsetPx,
    y: frame.reference.y +
      targetTangent.y * control.targetTangentOffsetPx +
      targetNormal.y * control.targetNormalOffsetPx,
  };
  const entryPoint = {
    x: contactPoint.x - tangent.x * preReachPx,
    y: contactPoint.y - tangent.y * preReachPx,
  };
  const lines: TrackLine[] = [solidLine(lineIdStart, entryPoint, contactPoint)];
  const segmentLength = surfaceExtentPx / postSegments;
  let point = { ...contactPoint };
  for (let index = 0; index < postSegments; index++) {
    const fraction = turnFraction(index, postSegments, mode, turnExponent);
    const angle = degreesToRadians(entryAngleDeg + control.totalTurnDeg * fraction);
    const next = {
      x: point.x + Math.cos(angle) * segmentLength,
      y: point.y + Math.sin(angle) * segmentLength,
    };
    lines.push(solidLine(lineIdStart + lines.length, point, next));
    point = next;
  }
  return {
    lines,
    contactPoint,
    entryAngleDeg,
    exitAngleDeg: entryAngleDeg + control.totalTurnDeg,
    postSegments,
    mode,
  };
}

/** Realize a lossless profile without imposing equal segment length or turn law. */
export function realizeExactContactStripProfile(
  frame: ContactFrame,
  profile: ExactContactStripProfile,
  lineIdStart: number,
): TrackLine[] {
  if (profile.post.length === 0) throw new Error("exact contact strip requires one post line");
  const contactPoint = contactPointInTargetFrame(frame, profile);
  const entryAngleDeg = frame.headingDeg + profile.entryAngleRelativeDeg;
  const entryAngle = degreesToRadians(entryAngleDeg);
  const tangent = { x: Math.cos(entryAngle), y: Math.sin(entryAngle) };
  const preReachPx = requirePositive("preReachPx", profile.preReachPx);
  const entryPoint = {
    x: contactPoint.x - tangent.x * preReachPx,
    y: contactPoint.y - tangent.y * preReachPx,
  };
  const lines: TrackLine[] = [solidLine(lineIdStart, entryPoint, contactPoint)];
  let point = { ...contactPoint };
  for (const segment of profile.post) {
    const lengthPx = requirePositive("post.lengthPx", segment.lengthPx);
    const angle = degreesToRadians(frame.headingDeg + segment.angleRelativeDeg);
    const next = {
      x: point.x + Math.cos(angle) * lengthPx,
      y: point.y + Math.sin(angle) * lengthPx,
    };
    lines.push(solidLine(lineIdStart + lines.length, point, next));
    point = next;
  }
  return lines;
}

/** Extract a truly lossless target-frame profile from a connected line strip. */
export function extractExactContactStripProfile(
  frame: ContactFrame,
  lines: readonly TrackLine[],
): ExactContactStripProfile {
  if (lines.length < 2) throw new Error("contact strip requires one pre line and one post line");
  assertConnected(lines);
  const pre = lines[0];
  const preReachPx = length(pre);
  if (!(preReachPx > 0)) throw new Error("contact strip pre line must be non-zero");
  const entryAngleDeg = degrees(Math.atan2(pre.y2 - pre.y1, pre.x2 - pre.x1));
  const contactDelta = {
    x: pre.x2 - frame.reference.x,
    y: pre.y2 - frame.reference.y,
  };
  const targetAngle = degreesToRadians(frame.headingDeg);
  const targetTangent = { x: Math.cos(targetAngle), y: Math.sin(targetAngle) };
  const targetNormal = { x: -targetTangent.y, y: targetTangent.x };
  const post = lines.slice(1).map((line) => {
    const lengthPx = length(line);
    if (!(lengthPx > 0)) throw new Error("contact strip post lines must be non-zero");
    return {
      lengthPx,
      angleRelativeDeg: normalizeAngleDeg(
        degrees(Math.atan2(line.y2 - line.y1, line.x2 - line.x1)) - frame.headingDeg,
      ),
    };
  });
  return {
    targetTangentOffsetPx: dot(contactDelta, targetTangent),
    targetNormalOffsetPx: dot(contactDelta, targetNormal),
    entryAngleRelativeDeg: normalizeAngleDeg(entryAngleDeg - frame.headingDeg),
    preReachPx,
    post,
  };
}

/**
 * Recover the reversible coordinate of a connected pre-plus-post strip. The
 * reconstruction fails closed unless an endpoint-turn realization recreates
 * every coordinate. It intentionally exposes the line count rather than
 * guessing a policy.
 */
export function extractContactStrip(
  frame: ContactFrame,
  lines: readonly TrackLine[],
): ExtractedContactStrip {
  const exact = extractExactContactStripProfile(frame, lines);
  const postAngles = exact.post.map((segment) => frame.headingDeg + segment.angleRelativeDeg);
  const entryAngleDeg = frame.headingDeg + exact.entryAngleRelativeDeg;
  const totalTurnDeg = normalizeAngleDeg(postAngles.at(-1)! - entryAngleDeg);
  const control: ContactStripControl = {
    targetTangentOffsetPx: exact.targetTangentOffsetPx,
    targetNormalOffsetPx: exact.targetNormalOffsetPx,
    entryAngleRelativeDeg: exact.entryAngleRelativeDeg,
    preReachPx: exact.preReachPx,
    surfaceExtentPx: exact.post.reduce((sum, segment) => sum + segment.lengthPx, 0),
    totalTurnDeg,
    turnExponent: inferEndpointTurnExponent(postAngles, entryAngleDeg, totalTurnDeg),
  };
  const replay = realizeContactStrip(frame, control, 0, { postSegments: exact.post.length });
  if (maximumLineCoordinateError(lines, replay.lines) > 1e-8) {
    throw new Error("contact strip cannot losslessly express this post profile");
  }
  return { control, postSegments: exact.post.length };
}

/** Largest coordinate difference across two equivalent line fragments. */
export function maximumLineCoordinateError(
  left: readonly TrackLine[],
  right: readonly TrackLine[],
): number {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY;
  let maximum = 0;
  for (let index = 0; index < left.length; index++) {
    const a = left[index];
    const b = right[index];
    maximum = Math.max(
      maximum,
      Math.abs(a.x1 - b.x1),
      Math.abs(a.y1 - b.y1),
      Math.abs(a.x2 - b.x2),
      Math.abs(a.y2 - b.y2),
    );
  }
  return maximum;
}

function turnFraction(
  index: number,
  segments: number,
  mode: ContactStripRealizationMode,
  exponent: number,
): number {
  const raw = mode === "endpoint_turn"
    ? (index + 1) / segments
    : (segments === 1 ? 1 : index / (segments - 1));
  return Math.pow(raw, exponent);
}

function contactPointInTargetFrame(
  frame: ContactFrame,
  control: Pick<ContactStripControl, "targetTangentOffsetPx" | "targetNormalOffsetPx">,
): { x: number; y: number } {
  const targetAngle = degreesToRadians(frame.headingDeg);
  const targetTangent = { x: Math.cos(targetAngle), y: Math.sin(targetAngle) };
  const targetNormal = { x: -targetTangent.y, y: targetTangent.x };
  return {
    x: frame.reference.x +
      targetTangent.x * control.targetTangentOffsetPx +
      targetNormal.x * control.targetNormalOffsetPx,
    y: frame.reference.y +
      targetTangent.y * control.targetTangentOffsetPx +
      targetNormal.y * control.targetNormalOffsetPx,
  };
}

function inferEndpointTurnExponent(
  postAngles: readonly number[],
  entryAngleDeg: number,
  totalTurnDeg: number,
): number {
  if (Math.abs(totalTurnDeg) < 1e-9 || postAngles.length < 2) return 1;
  const samples: number[] = [];
  for (let index = 0; index + 1 < postAngles.length; index++) {
    const base = (index + 1) / postAngles.length;
    const fraction = normalizeAngleDeg(postAngles[index] - entryAngleDeg) / totalTurnDeg;
    if (base <= 0 || base >= 1 || fraction <= 0 || fraction >= 1) continue;
    const exponent = Math.log(fraction) / Math.log(base);
    if (Number.isFinite(exponent) && exponent > 0) samples.push(exponent);
  }
  if (samples.length === 0) return 1;
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

function assertConnected(lines: readonly TrackLine[]): void {
  for (let index = 1; index < lines.length; index++) {
    const prior = lines[index - 1];
    const current = lines[index];
    if (Math.abs(prior.x2 - current.x1) > 1e-8 || Math.abs(prior.y2 - current.y1) > 1e-8) {
      throw new Error(`contact strip is discontinuous at segment ${index}`);
    }
  }
}

function validatePostSegments(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`postSegments must be a positive integer, got ${value}`);
  }
  return value;
}

function requirePositive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
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

function length(line: TrackLine): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

function dot(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return left.x * right.x + left.y * right.y;
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}

function degrees(value: number): number {
  return value * 180 / Math.PI;
}

function normalizeAngleDeg(value: number): number {
  let normalized = (value + 180) % 360;
  if (normalized < 0) normalized += 360;
  return normalized - 180;
}
