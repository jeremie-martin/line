/**
 * Gravity-compensated endpoint-state Hermite transient.
 *
 * This one-form multi-contact construction begins with a frame-centred
 * k+1 capture and transfers continuously to the unforced k+2 *state*, not
 * merely its position.  The transfer is cubic in gravity-debiased space, so
 * its finite geometry carries both terminal reference position and velocity.
 * It has no source lane, score, outcome, case, seed, or selectable control.
 */
import { ELEVATION, type TrackLine } from "../types.ts";
import { type ContactKinematicFrame } from "./contact_kinematic_frame.ts";
import {
  resolveContactCaptureArc,
  type ResolvedContactCaptureArc,
} from "./contact_capture_arc.ts";
import type { Vec2 } from "./state.ts";

const TRANSFER_SEGMENTS = 4;
const FRAME_CENTER_PHASE = 0.5;
const APPROACH_FRAMES = 2;
const RUNWAY_FRAMES = 1;
const EPSILON = 1e-8;

export type EndpointState = {
  reference: Vec2;
  /** Use the named-reference velocity when exposed; CoM is the safe fallback. */
  referenceVelocity: Vec2 | null;
  velocity: Vec2;
};

export type StateHermiteTransientUnavailable = {
  status: "unavailable";
  reason: "missing_impact" | "missing_terminal_velocity" | "degenerate_transfer" | "degenerate_turn";
};

export type StateHermiteTransientReady = {
  status: "ready";
  lines: TrackLine[];
  capture: Pick<ResolvedContactCaptureArc, "capturePoint" | "approachPoint" | "entryAngleDeg">;
  terminal: {
    reference: Vec2;
    velocity: Vec2;
    frames: number;
    turnOrientation: -1 | 1;
    entryVelocity: Vec2;
    debiasedTerminalVelocity: Vec2;
  };
  protocol: "frame-centred-distributed-capture/gravity-debiased-endpoint-state-hermite";
};

export type StateHermiteTransient = StateHermiteTransientUnavailable | StateHermiteTransientReady;

/**
 * Realize a k+1 capture plus a finite C1 state transfer.  The cubic is solved
 * in the frame obtained by subtracting discrete gravity displacement, then
 * gravity is restored at each emitted point.  Thus its end state is not a
 * score-derived target: it is the exact unforced k+2 physical reference.
 */
export function realizeStateHermiteTransient(
  frame: ContactKinematicFrame,
  future: EndpointState,
  futureFrames: number,
  lineIdStart: number,
): StateHermiteTransient {
  if (frame.impact === null) return { status: "unavailable", reason: "missing_impact" };
  if (!Number.isSafeInteger(futureFrames) || futureFrames <= 0 || !Number.isSafeInteger(lineIdStart)) {
    return { status: "unavailable", reason: "degenerate_transfer" };
  }
  const terminalVelocity = future.referenceVelocity ?? future.velocity;
  if (!finiteVec(future.reference) || !finiteVec(terminalVelocity)) {
    return { status: "unavailable", reason: "missing_terminal_velocity" };
  }

  const toTerminal = {
    x: future.reference.x - frame.anchor.reference.x,
    y: future.reference.y - frame.anchor.reference.y - gravityDisplacement(futureFrames),
  };
  const direction = angleDeg(toTerminal);
  if (direction === null) return { status: "unavailable", reason: "degenerate_transfer" };
  const entryDelta = signedAngleDelta(frame.com.headingDeg, direction);
  if (Math.abs(entryDelta) <= EPSILON) return { status: "unavailable", reason: "degenerate_turn" };
  const turnOrientation: -1 | 1 = entryDelta < 0 ? -1 : 1;
  const capture = resolveContactCaptureArc(frame, {
    turnOrientation,
    targetPhaseOffsetFrames: FRAME_CENTER_PHASE,
    entryTurnShare: 0,
    approachFrames: APPROACH_FRAMES,
    runwayFrames: RUNWAY_FRAMES,
  });

  const entryUnit = unit(capture.entryAngleDeg);
  const entryVelocity = {
    x: entryUnit.x * frame.com.speedPxPerFrame,
    y: entryUnit.y * frame.com.speedPxPerFrame,
  };
  // In the gravity-debiased frame, a free-flight terminal velocity has its
  // accumulated discrete gravity removed.  The endpoint position receives the
  // matching sum y += vy + g integration correction below.
  const debiasedTerminalVelocity = {
    x: terminalVelocity.x,
    y: terminalVelocity.y - ELEVATION.GRAVITY_PX_PER_FRAME2 * futureFrames,
  };
  const endpointDebiased = {
    x: future.reference.x,
    y: future.reference.y - gravityDisplacement(futureFrames),
  };
  const tangentScale = futureFrames / 3;
  const p0 = { ...capture.capturePoint };
  const p1 = { x: p0.x + entryVelocity.x * tangentScale, y: p0.y + entryVelocity.y * tangentScale };
  const p2 = {
    x: endpointDebiased.x - debiasedTerminalVelocity.x * tangentScale,
    y: endpointDebiased.y - debiasedTerminalVelocity.y * tangentScale,
  };
  if (![p0, p1, p2, endpointDebiased].every(finiteVec)) {
    return { status: "unavailable", reason: "degenerate_transfer" };
  }

  const points = [{ ...p0 }];
  for (let index = 1; index <= TRANSFER_SEGMENTS; index++) {
    const t = index / TRANSFER_SEGMENTS;
    const debiased = cubicPoint(p0, p1, p2, endpointDebiased, t);
    points.push({ x: debiased.x, y: debiased.y + gravityDisplacement(futureFrames * t) });
  }
  // Avoid numerical drift in the physical endpoint: it is a hard state
  // boundary, not a target approximation.
  points[points.length - 1] = { ...future.reference };
  const lines: TrackLine[] = [solidLine(lineIdStart, capture.approachPoint, capture.capturePoint)];
  for (let index = 1; index < points.length; index++) {
    lines.push(solidLine(lineIdStart + lines.length, points[index - 1]!, points[index]!));
  }
  if (!lines.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite))) {
    return { status: "unavailable", reason: "degenerate_transfer" };
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
      reference: { ...future.reference },
      velocity: { ...terminalVelocity },
      frames: futureFrames,
      turnOrientation,
      entryVelocity,
      debiasedTerminalVelocity,
    },
    protocol: "frame-centred-distributed-capture/gravity-debiased-endpoint-state-hermite",
  };
}

function gravityDisplacement(frames: number): number {
  return .5 * ELEVATION.GRAVITY_PX_PER_FRAME2 * frames * (frames + 1);
}

function cubicPoint(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
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
