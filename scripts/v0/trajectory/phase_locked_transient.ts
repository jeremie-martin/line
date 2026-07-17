/**
 * A phase-locked vector-intercept transient.
 *
 * This study-only component creates one finite k+1 contact-to-launch surface
 * from an exact incoming state and the unforced k+2 reference state.  Its
 * final tangent is the two-dimensional discrete-ballistic intercept, rather
 * than the retired symmetric vertical launch.  The contact geometry is the
 * fixed distributed, frame-centred capture form; chirality follows the signed
 * physical turn from incoming travel to the intercept vector.  No candidate,
 * score, source identity, or result selects a branch.
 */
import { ELEVATION, type TrackLine } from "../types.ts";
import { type ContactKinematicFrame } from "./contact_kinematic_frame.ts";
import {
  resolveContactCaptureArc,
  type ResolvedContactCaptureArc,
} from "./contact_capture_arc.ts";

const SCOOP_SEGMENTS = 3;
const FRAME_CENTER_PHASE = 0.5;
const APPROACH_FRAMES = 2;
const RUNWAY_FRAMES = 1;
const EPSILON = 1e-8;

export type PhaseLockedTransientUnavailable = {
  status: "unavailable";
  reason: "missing_impact" | "degenerate_intercept" | "degenerate_turn";
};

export type PhaseLockedTransientReady = {
  status: "ready";
  lines: TrackLine[];
  capture: Pick<ResolvedContactCaptureArc, "capturePoint" | "approachPoint" | "entryAngleDeg">;
  intercept: {
    targetReference: { x: number; y: number };
    frames: number;
    launchVelocity: { x: number; y: number };
    launchAngleDeg: number;
    turnOrientation: -1 | 1;
    turnDeg: number;
  };
  protocol: "frame-centred-distributed-capture/vector-ballistic-intercept";
};

export type PhaseLockedTransient = PhaseLockedTransientUnavailable | PhaseLockedTransientReady;

/**
 * Realize one source-neutral transient. `futureReference` is read from the
 * immutable engine containing the already-admitted k geometry but no k+1
 * component, at the next-next authored contact.  Discrete gravity matches the
 * engine's `y += vy + gravity` stepping convention.
 */
export function realizePhaseLockedTransient(
  frame: ContactKinematicFrame,
  futureReference: { x: number; y: number },
  futureFrames: number,
  lineIdStart: number,
): PhaseLockedTransient {
  if (frame.impact === null) return { status: "unavailable", reason: "missing_impact" };
  if (!Number.isSafeInteger(futureFrames) || futureFrames <= 0) {
    return { status: "unavailable", reason: "degenerate_intercept" };
  }
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("phase-locked transient line id must be a safe integer");
  if (![futureReference.x, futureReference.y].every(Number.isFinite)) {
    return { status: "unavailable", reason: "degenerate_intercept" };
  }

  // First resolve the exact frame-centred contact form. Its bend sign is not a
  // menu arm: it is the signed travel-to-intercept turn.
  const provisionalTarget = {
    x: futureReference.x - frame.anchor.reference.x,
    y: futureReference.y - frame.anchor.reference.y -
      .5 * ELEVATION.GRAVITY_PX_PER_FRAME2 * futureFrames * (futureFrames + 1),
  };
  const provisionalAngle = angleDeg(provisionalTarget);
  if (provisionalAngle === null) return { status: "unavailable", reason: "degenerate_intercept" };
  const entryDelta = signedAngleDelta(frame.com.headingDeg, provisionalAngle);
  if (Math.abs(entryDelta) <= EPSILON) return { status: "unavailable", reason: "degenerate_turn" };
  const turnOrientation: -1 | 1 = entryDelta < 0 ? -1 : 1;
  const capture = resolveContactCaptureArc(frame, {
    turnOrientation,
    targetPhaseOffsetFrames: FRAME_CENTER_PHASE,
    entryTurnShare: 0,
    approachFrames: APPROACH_FRAMES,
    runwayFrames: RUNWAY_FRAMES,
  });

  // The launch point is the actual finite capture boundary. Solve the unique
  // gravity-only velocity that reaches the unforced k+2 reference in the
  // literal number of frames after that point.
  const launchVelocity = {
    x: (futureReference.x - capture.capturePoint.x) / futureFrames,
    y: (futureReference.y - capture.capturePoint.y -
      .5 * ELEVATION.GRAVITY_PX_PER_FRAME2 * futureFrames * (futureFrames + 1)) / futureFrames,
  };
  const launchAngleDeg = angleDeg(launchVelocity);
  if (launchAngleDeg === null) return { status: "unavailable", reason: "degenerate_intercept" };
  const turnDeg = signedAngleDelta(capture.entryAngleDeg, launchAngleDeg);
  if (!Number.isFinite(turnDeg)) return { status: "unavailable", reason: "degenerate_turn" };

  const lines: TrackLine[] = [solidLine(lineIdStart, capture.approachPoint, capture.capturePoint)];
  const segmentLength = frame.com.speedPxPerFrame;
  let point = { ...capture.capturePoint };
  for (let index = 0; index < SCOOP_SEGMENTS; index++) {
    const fraction = SCOOP_SEGMENTS === 1 ? 0 : index / (SCOOP_SEGMENTS - 1);
    const tangent = unit(capture.entryAngleDeg + turnDeg * fraction);
    const next = { x: point.x + tangent.x * segmentLength, y: point.y + tangent.y * segmentLength };
    lines.push(solidLine(lineIdStart + lines.length, point, next));
    point = next;
  }
  if (!lines.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite))) {
    throw new Error("phase-locked transient emitted a non-finite line");
  }
  return {
    status: "ready",
    lines,
    capture: {
      capturePoint: { ...capture.capturePoint },
      approachPoint: { ...capture.approachPoint },
      entryAngleDeg: capture.entryAngleDeg,
    },
    intercept: {
      targetReference: { ...futureReference },
      frames: futureFrames,
      launchVelocity,
      launchAngleDeg,
      turnOrientation,
      turnDeg,
    },
    protocol: "frame-centred-distributed-capture/vector-ballistic-intercept",
  };
}

function solidLine(
  id: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
): TrackLine {
  return { id, type: 0, x1: start.x, y1: start.y, x2: end.x, y2: end.y, flipped: false, leftExtended: false, rightExtended: false };
}

function unit(angle: number): { x: number; y: number } {
  const radians = angle * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function angleDeg(value: { x: number; y: number }): number | null {
  const length = Math.hypot(value.x, value.y);
  return Number.isFinite(length) && length > EPSILON ? Math.atan2(value.y, value.x) * 180 / Math.PI : null;
}

function signedAngleDelta(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta <= -180) delta += 360;
  if (delta > 180) delta -= 360;
  return delta;
}
