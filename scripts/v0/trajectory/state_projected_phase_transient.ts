/**
 * State-projected capture-phase transient.
 *
 * The exact unforced future position and velocity determine the ballistic
 * origin needed to reach that state.  Projecting that origin onto the current
 * target-frame sweep yields one legal capture phase; the same terminal state
 * determines the local launch tangent.  This is a compact boundary law, not
 * a phase span or an inter-contact surface.
 */
import { ELEVATION, type TrackLine } from "../types.ts";
import { type ContactKinematicFrame } from "./contact_kinematic_frame.ts";
import {
  resolveContactCaptureArc,
  type ResolvedContactCaptureArc,
} from "./contact_capture_arc.ts";
import type { Vec2 } from "./state.ts";

const SCOOP_SEGMENTS = 3;
const APPROACH_FRAMES = 2;
const RUNWAY_FRAMES = 1;
const EPSILON = 1e-8;

export type ProjectedPhaseEndpointState = {
  reference: Vec2;
  referenceVelocity: Vec2 | null;
  velocity: Vec2;
};

export type StateProjectedPhaseTransientUnavailable = {
  status: "unavailable";
  reason: "missing_impact" | "missing_terminal_state" | "degenerate_launch" | "degenerate_turn";
};

export type StateProjectedPhaseTransientReady = {
  status: "ready";
  lines: TrackLine[];
  capture: Pick<ResolvedContactCaptureArc, "capturePoint" | "approachPoint" | "entryAngleDeg"> & {
    phase: number;
    unconstrainedPhase: number;
    phaseResidualPx: number;
  };
  terminal: {
    reference: Vec2;
    velocity: Vec2;
    gravityDebiasedLaunchVelocity: Vec2;
    launchAngleDeg: number;
    frames: number;
    turnOrientation: -1 | 1;
    turnDeg: number;
  };
  protocol: "ballistic-origin-projected-target-phase/gravity-debiased-terminal-tangent";
};

export type StateProjectedPhaseTransient = StateProjectedPhaseTransientUnavailable | StateProjectedPhaseTransientReady;

export function realizeStateProjectedPhaseTransient(
  frame: ContactKinematicFrame,
  future: ProjectedPhaseEndpointState,
  futureFrames: number,
  lineIdStart: number,
): StateProjectedPhaseTransient {
  if (frame.impact === null) return { status: "unavailable", reason: "missing_impact" };
  if (!Number.isSafeInteger(futureFrames) || futureFrames <= 0 || !Number.isSafeInteger(lineIdStart)) {
    return { status: "unavailable", reason: "degenerate_launch" };
  }
  const terminalVelocity = future.referenceVelocity ?? future.velocity;
  if (!finiteVec(future.reference) || !finiteVec(terminalVelocity)) {
    return { status: "unavailable", reason: "missing_terminal_state" };
  }
  const launchVelocity = {
    x: terminalVelocity.x,
    y: terminalVelocity.y - ELEVATION.GRAVITY_PX_PER_FRAME2 * futureFrames,
  };
  const launchAngleDeg = angleDeg(launchVelocity);
  if (launchAngleDeg === null) return { status: "unavailable", reason: "degenerate_launch" };
  const entryDelta = signedAngleDelta(frame.com.headingDeg, launchAngleDeg);
  if (Math.abs(entryDelta) <= EPSILON) return { status: "unavailable", reason: "degenerate_turn" };
  const turnOrientation: -1 | 1 = entryDelta < 0 ? -1 : 1;

  // Reverse the engine's discrete ballistic update from the future physical
  // state. This is the unique launch point compatible with both terminal
  // position and velocity in free flight; only its along-sweep coordinate is
  // controllable by a legal current-frame capture.
  const requiredCapture = {
    x: future.reference.x - launchVelocity.x * futureFrames,
    y: future.reference.y - launchVelocity.y * futureFrames - gravityDisplacement(futureFrames),
  };
  const anchorUnit = unit(frame.anchor.headingDeg);
  const relative = {
    x: requiredCapture.x - frame.anchor.reference.x,
    y: requiredCapture.y - frame.anchor.reference.y,
  };
  const unconstrainedPhase = dot(relative, anchorUnit) / frame.anchor.speedPxPerFrame;
  if (!Number.isFinite(unconstrainedPhase)) return { status: "unavailable", reason: "degenerate_launch" };
  const phase = clamp(unconstrainedPhase, 0, 1);
  const projected = {
    x: frame.anchor.reference.x + anchorUnit.x * phase * frame.anchor.speedPxPerFrame,
    y: frame.anchor.reference.y + anchorUnit.y * phase * frame.anchor.speedPxPerFrame,
  };
  const phaseResidualPx = Math.hypot(requiredCapture.x - projected.x, requiredCapture.y - projected.y);
  const capture = resolveContactCaptureArc(frame, {
    turnOrientation,
    targetPhaseOffsetFrames: phase,
    entryTurnShare: 0,
    approachFrames: APPROACH_FRAMES,
    runwayFrames: RUNWAY_FRAMES,
  });
  const turnDeg = signedAngleDelta(capture.entryAngleDeg, launchAngleDeg);
  if (!Number.isFinite(turnDeg)) return { status: "unavailable", reason: "degenerate_turn" };
  const lines: TrackLine[] = [solidLine(lineIdStart, capture.approachPoint, capture.capturePoint)];
  let point = { ...capture.capturePoint };
  for (let index = 0; index < SCOOP_SEGMENTS; index++) {
    const fraction = SCOOP_SEGMENTS === 1 ? 0 : index / (SCOOP_SEGMENTS - 1);
    const tangent = unit(capture.entryAngleDeg + turnDeg * fraction);
    const next = { x: point.x + tangent.x * frame.com.speedPxPerFrame, y: point.y + tangent.y * frame.com.speedPxPerFrame };
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
      phase,
      unconstrainedPhase,
      phaseResidualPx,
    },
    terminal: {
      reference: { ...future.reference },
      velocity: { ...terminalVelocity },
      gravityDebiasedLaunchVelocity: launchVelocity,
      launchAngleDeg,
      frames: futureFrames,
      turnOrientation,
      turnDeg,
    },
    protocol: "ballistic-origin-projected-target-phase/gravity-debiased-terminal-tangent",
  };
}

function gravityDisplacement(frames: number): number {
  return .5 * ELEVATION.GRAVITY_PX_PER_FRAME2 * frames * (frames + 1);
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

function dot(left: Vec2, right: Vec2): number {
  return left.x * right.x + left.y * right.y;
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, value));
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
