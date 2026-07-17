/**
 * Impulse-closed contact-frame transport transient.
 *
 * The construction deliberately separates a finite, native capture prefix
 * from its continuation.  It first realizes a one-frame C1 capture runway,
 * lets the exact engine resolve that collision, then transports the measured
 * zero-friction sled velocity frame through the authored impact turn to make
 * the remaining response tail.  No unforced future state, control menu, or
 * score result enters either boundary.
 */
import { type TrackLine } from "../types.ts";
import { type ContactKinematicFrame } from "./contact_kinematic_frame.ts";
import {
  resolveContactCaptureArc,
  type ResolvedContactCaptureArc,
} from "./contact_capture_arc.ts";
import type { PlanningState, Vec2 } from "./state.ts";

const FRAME_CENTER_PHASE = .5;
const APPROACH_FRAMES = 2;
const RUNWAY_FRAMES = 1;
const TAIL_FRAMES = 5;
const TAIL_SEGMENTS = 3;
const EPSILON = 1e-8;
const ZERO_FRICTION_SLED_POINTS = ["TAIL", "NOSE", "STRING"] as const;

export type ContactFrameTransportUnavailable = {
  status: "unavailable";
  reason:
    | "missing_impact"
    | "missing_zero_friction_velocity"
    | "degenerate_relative_heading"
    | "degenerate_tail";
};

export type ContactFrameTransportPrefixReady = {
  status: "prefix_ready";
  prefixLines: TrackLine[];
  capture: Pick<ResolvedContactCaptureArc, "capturePoint" | "approachPoint" | "runwayExitPoint" | "entryAngleDeg">;
  incoming: {
    collectiveVelocity: Vec2;
    collectiveHeadingDeg: number;
    relativeHeadingDeg: number;
    turnOrientation: -1 | 1;
    requestedComExitHeadingDeg: number;
  };
  protocol: "exact-prefix/zero-friction-contact-frame-transport";
};

export type ContactFrameTransportPrefix = ContactFrameTransportUnavailable | ContactFrameTransportPrefixReady;

export type ContactFrameTransportReady = {
  status: "ready";
  lines: TrackLine[];
  capture: ContactFrameTransportPrefixReady["capture"];
  incoming: ContactFrameTransportPrefixReady["incoming"];
  postImpact: {
    collectiveVelocity: Vec2;
    collectiveHeadingDeg: number;
    relativeHeadingDeg: number;
    observedComHeadingDeg: number;
    terminalTangentDeg: number;
    tailLengthPx: number;
  };
  protocol: "exact-prefix/zero-friction-contact-frame-transport";
};

export type ContactFrameTransport = ContactFrameTransportUnavailable | ContactFrameTransportReady;

/**
 * Build only the finite capture prefix that is allowed to create the first
 * collision.  Its turn sign is the signed physical differential between the
 * CoM and the aggregate velocity of the three zero-friction sled points.
 */
export function realizeContactFrameTransportPrefix(
  frame: ContactKinematicFrame,
  incomingState: PlanningState,
  lineIdStart: number,
): ContactFrameTransportPrefix {
  if (frame.impact === null) return { status: "unavailable", reason: "missing_impact" };
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("contact-frame transport line id must be a safe integer");
  const collectiveVelocity = aggregateZeroFrictionVelocity(incomingState);
  const collectiveHeadingDeg = angleDeg(collectiveVelocity);
  if (collectiveHeadingDeg === null) return { status: "unavailable", reason: "missing_zero_friction_velocity" };
  const relativeHeadingDeg = signedAngleDelta(frame.com.headingDeg, collectiveHeadingDeg);
  if (Math.abs(relativeHeadingDeg) <= EPSILON) {
    return { status: "unavailable", reason: "degenerate_relative_heading" };
  }
  const turnOrientation: -1 | 1 = relativeHeadingDeg < 0 ? -1 : 1;
  const resolved = resolveContactCaptureArc(frame, {
    turnOrientation,
    targetPhaseOffsetFrames: FRAME_CENTER_PHASE,
    // The finite prefix carries the requested incidence.  The continuation is
    // not a second candidate arm: it is resolved from this prefix's exact
    // collision state below.
    entryTurnShare: 1,
    approachFrames: APPROACH_FRAMES,
    runwayFrames: RUNWAY_FRAMES,
  });
  const entryUnit = unit(resolved.entryAngleDeg);
  const prefixLines = [
    solidLine(lineIdStart, resolved.approachPoint, resolved.capturePoint),
    solidLine(lineIdStart + 1, resolved.capturePoint, resolved.runwayExitPoint),
  ];
  const requestedComExitHeadingDeg = frame.com.headingDeg +
    turnOrientation * frame.impact.catchableTurnDeg;
  if (![...prefixLines.flatMap((line) => [line.x1, line.y1, line.x2, line.y2]), entryUnit.x, entryUnit.y]
    .every(Number.isFinite)) {
    throw new Error("contact-frame transport emitted a non-finite prefix");
  }
  return {
    status: "prefix_ready",
    prefixLines,
    capture: {
      capturePoint: { ...resolved.capturePoint },
      approachPoint: { ...resolved.approachPoint },
      runwayExitPoint: { ...resolved.runwayExitPoint },
      entryAngleDeg: resolved.entryAngleDeg,
    },
    incoming: {
      collectiveVelocity,
      collectiveHeadingDeg,
      relativeHeadingDeg,
      turnOrientation,
      requestedComExitHeadingDeg,
    },
    protocol: "exact-prefix/zero-friction-contact-frame-transport",
  };
}

/**
 * Complete a prefix after the engine has resolved its target-frame response.
 * The tail is C1 with the capture runway at its start, and its terminal tangent
 * preserves the observed post-impact zero-friction sled/CoM angular relation
 * while applying the one requested CoM redirection.
 */
export function completeContactFrameTransport(
  prefix: ContactFrameTransportPrefixReady,
  postImpactState: PlanningState,
): ContactFrameTransport {
  const collectiveVelocity = aggregateZeroFrictionVelocity(postImpactState);
  const collectiveHeadingDeg = angleDeg(collectiveVelocity);
  if (collectiveHeadingDeg === null) return { status: "unavailable", reason: "missing_zero_friction_velocity" };
  const observedComHeadingDeg = postImpactState.velocityAngleDeg;
  if (!Number.isFinite(observedComHeadingDeg)) return { status: "unavailable", reason: "degenerate_tail" };
  const relativeHeadingDeg = signedAngleDelta(observedComHeadingDeg, collectiveHeadingDeg);
  const terminalTangentDeg = prefix.incoming.requestedComExitHeadingDeg + relativeHeadingDeg;
  const tailLengthPx = Math.hypot(collectiveVelocity.x, collectiveVelocity.y) * TAIL_FRAMES;
  if (!Number.isFinite(tailLengthPx) || tailLengthPx <= EPSILON || !Number.isFinite(terminalTangentDeg)) {
    return { status: "unavailable", reason: "degenerate_tail" };
  }
  const lines = [...prefix.prefixLines];
  const segmentLength = tailLengthPx / TAIL_SEGMENTS;
  let point = { ...prefix.capture.runwayExitPoint };
  for (let index = 0; index < TAIL_SEGMENTS; index++) {
    const fraction = TAIL_SEGMENTS === 1 ? 0 : index / (TAIL_SEGMENTS - 1);
    const tangent = unit(lerpAngle(prefix.capture.entryAngleDeg, terminalTangentDeg, fraction));
    const next = { x: point.x + tangent.x * segmentLength, y: point.y + tangent.y * segmentLength };
    lines.push(solidLine(lines[lines.length - 1]!.id + 1, point, next));
    point = next;
  }
  if (!lines.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite))) {
    throw new Error("contact-frame transport emitted a non-finite tail");
  }
  return {
    status: "ready",
    lines,
    capture: prefix.capture,
    incoming: prefix.incoming,
    postImpact: {
      collectiveVelocity,
      collectiveHeadingDeg,
      relativeHeadingDeg,
      observedComHeadingDeg,
      terminalTangentDeg,
      tailLengthPx,
    },
    protocol: "exact-prefix/zero-friction-contact-frame-transport",
  };
}

function aggregateZeroFrictionVelocity(state: PlanningState): Vec2 {
  const velocities = ZERO_FRICTION_SLED_POINTS
    .map((name) => state.points[name]?.velocity)
    .filter((velocity): velocity is Vec2 => velocity !== null && velocity !== undefined &&
      Number.isFinite(velocity.x) && Number.isFinite(velocity.y));
  if (velocities.length === 0) return { x: Number.NaN, y: Number.NaN };
  return velocities.reduce(
    (sum, velocity) => ({ x: sum.x + velocity.x / velocities.length, y: sum.y + velocity.y / velocities.length }),
    { x: 0, y: 0 },
  );
}

function solidLine(id: number, start: Vec2, end: Vec2): TrackLine {
  return { id, type: 0, x1: start.x, y1: start.y, x2: end.x, y2: end.y, flipped: false, leftExtended: false, rightExtended: false };
}

function unit(angleDeg: number): Vec2 {
  const radians = angleDeg * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function angleDeg(value: Vec2): number | null {
  return Math.hypot(value.x, value.y) > EPSILON ? Math.atan2(value.y, value.x) * 180 / Math.PI : null;
}

function lerpAngle(from: number, to: number, fraction: number): number {
  return from + signedAngleDelta(from, to) * fraction;
}

function signedAngleDelta(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta <= -180) delta += 360;
  if (delta > 180) delta -= 360;
  return delta;
}
