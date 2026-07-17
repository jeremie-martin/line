/**
 * Terminal-tangent contact transient.
 *
 * A short, collidable k+1 capture-to-launch transition whose single outgoing
 * tangent is the gravity-debiased velocity of the exact unforced k+2 state.
 * Unlike a position intercept or a full interval curve, it changes only the
 * native capture response band while carrying a future physical velocity
 * boundary into its geometry.
 */
import { ELEVATION, type TrackLine } from "../types.ts";
import { type ContactKinematicFrame } from "./contact_kinematic_frame.ts";
import {
  resolveContactCaptureArc,
  type ResolvedContactCaptureArc,
} from "./contact_capture_arc.ts";
import type { Vec2 } from "./state.ts";

const SCOOP_SEGMENTS = 3;
const FRAME_CENTER_PHASE = .5;
const APPROACH_FRAMES = 2;
const RUNWAY_FRAMES = 1;
const EPSILON = 1e-8;

export type TerminalVelocityState = {
  referenceVelocity: Vec2 | null;
  velocity: Vec2;
};

export type TerminalTangentTransientUnavailable = {
  status: "unavailable";
  reason: "missing_impact" | "missing_terminal_velocity" | "degenerate_launch" | "degenerate_turn";
};

export type TerminalTangentTransientReady = {
  status: "ready";
  lines: TrackLine[];
  capture: Pick<ResolvedContactCaptureArc, "capturePoint" | "approachPoint" | "entryAngleDeg">;
  terminal: {
    velocity: Vec2;
    gravityDebiasedLaunchVelocity: Vec2;
    launchAngleDeg: number;
    frames: number;
    turnOrientation: -1 | 1;
    turnDeg: number;
  };
  protocol: "frame-centred-distributed-capture/gravity-debiased-terminal-tangent";
};

export type TerminalTangentTransient = TerminalTangentTransientUnavailable | TerminalTangentTransientReady;

export function realizeTerminalTangentTransient(
  frame: ContactKinematicFrame,
  future: TerminalVelocityState,
  futureFrames: number,
  lineIdStart: number,
): TerminalTangentTransient {
  if (frame.impact === null) return { status: "unavailable", reason: "missing_impact" };
  if (!Number.isSafeInteger(futureFrames) || futureFrames <= 0 || !Number.isSafeInteger(lineIdStart)) {
    return { status: "unavailable", reason: "degenerate_launch" };
  }
  const terminalVelocity = future.referenceVelocity ?? future.velocity;
  if (!finiteVec(terminalVelocity)) return { status: "unavailable", reason: "missing_terminal_velocity" };
  const launchVelocity = {
    x: terminalVelocity.x,
    y: terminalVelocity.y - ELEVATION.GRAVITY_PX_PER_FRAME2 * futureFrames,
  };
  const launchAngleDeg = angleDeg(launchVelocity);
  if (launchAngleDeg === null) return { status: "unavailable", reason: "degenerate_launch" };
  const entryDelta = signedAngleDelta(frame.com.headingDeg, launchAngleDeg);
  if (Math.abs(entryDelta) <= EPSILON) return { status: "unavailable", reason: "degenerate_turn" };
  const turnOrientation: -1 | 1 = entryDelta < 0 ? -1 : 1;
  const capture = resolveContactCaptureArc(frame, {
    turnOrientation,
    targetPhaseOffsetFrames: FRAME_CENTER_PHASE,
    entryTurnShare: 0,
    approachFrames: APPROACH_FRAMES,
    runwayFrames: RUNWAY_FRAMES,
  });
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
    return { status: "unavailable", reason: "degenerate_launch" };
  }
  return {
    status: "ready",
    lines,
    capture: {
      capturePoint: { ...capture.capturePoint },
      approachPoint: { ...capture.approachPoint },
      entryAngleDeg: capture.entryAngleDeg,
    },
    terminal: {
      velocity: { ...terminalVelocity },
      gravityDebiasedLaunchVelocity: launchVelocity,
      launchAngleDeg,
      frames: futureFrames,
      turnOrientation,
      turnDeg,
    },
    protocol: "frame-centred-distributed-capture/gravity-debiased-terminal-tangent",
  };
}

function solidLine(id: number, start: Vec2, end: Vec2): TrackLine {
  return { id, type: 0, x1: start.x, y1: start.y, x2: end.x, y2: end.y, flipped: false, leftExtended: false, rightExtended: false };
}

function unit(angle: number): Vec2 {
  const radians = angle * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function angleDeg(value: Vec2): number | null {
  return Math.hypot(value.x, value.y) > EPSILON ? Math.atan2(value.y, value.x) * 180 / Math.PI : null;
}

function signedAngleDelta(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta <= -180) delta += 360;
  if (delta > 180) delta -= 360;
  return delta;
}

function finiteVec(value: Vec2): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y);
}
