/**
 * Clean post-impact observation leaves.
 *
 * These helpers measure and compare an already-fixed replay. They intentionally
 * have no access to fixture selection, compiler placement/search, benchmark
 * policy, or authored outgoing targets.
 */
import { PERSISTENCE_FRAMES, type Detection } from "../../lib/detector.ts";
import {
  postimpactAirborneAt,
  postimpactMeasurementLastFrame,
  postimpactOffBeatLandingEvents,
  postimpactPositionAt,
  postimpactSpeedAt,
  postimpactVelocityAt,
} from "./postimpact_detection_measurement.ts";
import { postimpactSpeedPxToAuthored } from "./postimpact_physics.ts";
import type { PostimpactSpeedRuler } from "./postimpact_physics.ts";
import type { PlanningState, Vec2 } from "./state.ts";
import type { TargetFrame } from "./target_frame.ts";
import { samePostimpactEngineTrace, type PostimpactEngineTraceFingerprint } from "./postimpact_trace.ts";

export type PostimpactNamedReferenceState = {
  point: TargetFrame["anchorPoint"];
  position: Vec2;
  velocity: Vec2;
  speedPxPerFrame: number;
  headingDeg: number;
};

export type PostimpactCoMWindow = {
  startFrame: number;
  endFrame: number;
  measurementSamples: number;
  airborneSamples: number;
  airFraction: number;
  meanSpeedPxPerFrame: number;
  meanSpeedAuthored: number;
  terminal: {
    position: Vec2;
    velocity: Vec2;
    speedPxPerFrame: number;
    headingDeg: number;
  };
};

export const POSTIMPACT_UNRESOLVED_TAIL_RULE =
  "landing_at_or_after_observed_end_minus_(persistence_minus_two).v1" as const;

/** Full engine-state fingerprints are a fail-closed capture identity predicate. */
export function samePostimpactExactEngineTrace(
  left: PostimpactEngineTraceFingerprint,
  right: PostimpactEngineTraceFingerprint,
): boolean {
  return samePostimpactEngineTrace(left, right);
}

/**
 * Capture equality includes every serialized selected-event field, rather than
 * only a timing or line-id projection. Callers may pass their own event type;
 * equality remains exact and target-blind.
 */
export function samePostimpactOwnedCaptureEvent(left: unknown, right: unknown): boolean {
  return left !== null && left !== undefined && right !== null && right !== undefined &&
    postimpactStableJson(left) === postimpactStableJson(right);
}

/** The scorer-facing impact outcome is part of capture identity. */
export function samePostimpactScoredContactImpact(left: unknown, right: unknown): boolean {
  return left !== null && left !== undefined && right !== null && right !== undefined &&
    postimpactStableJson(left) === postimpactStableJson(right);
}

/** Read a fixed named reference point rather than reselecting one later. */
export function postimpactNamedReferenceState(
  state: PlanningState | null,
  anchorPoint: TargetFrame["anchorPoint"],
): PostimpactNamedReferenceState | null {
  if (state === null) return null;
  const selected = anchorPoint === "rider"
    ? { position: state.position, velocity: state.velocity }
    : state.points[anchorPoint];
  if (selected === undefined || selected.velocity === null) return null;
  const speedPxPerFrame = Math.hypot(selected.velocity.x, selected.velocity.y);
  if (!(speedPxPerFrame > 1e-12) || !Number.isFinite(speedPxPerFrame)) return null;
  return {
    point: anchorPoint,
    position: { ...selected.position },
    velocity: { ...selected.velocity },
    speedPxPerFrame,
    headingDeg: Math.atan2(selected.velocity.y, selected.velocity.x) * 180 / Math.PI,
  };
}

export function postimpactDisplacement(from: Vec2, to: Vec2): Vec2 {
  return { x: to.x - from.x, y: to.y - from.y };
}

/** Scorer-facing CoM air/speed measurements over an inclusive observation window. */
export function measurePostimpactCoMWindow(
  detection: Detection,
  startFrame: number,
  endFrame: number,
  speedRuler: PostimpactSpeedRuler,
): PostimpactCoMWindow | null {
  if (!Number.isSafeInteger(startFrame) || !Number.isSafeInteger(endFrame) || endFrame < startFrame) return null;
  let airborneSamples = 0;
  let speedSumPxPerFrame = 0;
  for (let frame = startFrame; frame <= endFrame; frame++) {
    const airborne = postimpactAirborneAt(detection, frame);
    const speed = postimpactSpeedAt(detection, frame);
    if (airborne === undefined || speed === undefined) return null;
    if (airborne) airborneSamples++;
    speedSumPxPerFrame += speed;
  }
  const position = postimpactPositionAt(detection, endFrame);
  const velocity = postimpactVelocityAt(detection, endFrame);
  const speed = postimpactSpeedAt(detection, endFrame);
  if (position === undefined || velocity === undefined || speed === undefined) return null;
  const measurementSamples = endFrame - startFrame + 1;
  const meanSpeedPxPerFrame = speedSumPxPerFrame / measurementSamples;
  return {
    startFrame,
    endFrame,
    measurementSamples,
    airborneSamples,
    airFraction: airborneSamples / measurementSamples,
    meanSpeedPxPerFrame,
    meanSpeedAuthored: postimpactSpeedPxToAuthored(meanSpeedPxPerFrame, speedRuler),
    terminal: {
      position: { ...position },
      velocity: { ...velocity },
      speedPxPerFrame: speed,
      headingDeg: Math.atan2(velocity.y, velocity.x) * 180 / Math.PI,
    },
  };
}

export function postimpactOffBeatLandingsInWindow(
  detection: Detection,
  authoredContactFrames: readonly number[],
  startFrame: number,
  endFrame: number,
): number[] {
  return postimpactOffBeatLandingEvents(detection, authoredContactFrames)
    .filter((event) => event.frame >= startFrame && event.frame <= endFrame)
    .map((event) => event.frame);
}

/**
 * A window-clipped detector cannot verify persistence for a landing in its tail.
 * Preserve such off-beat landings as unresolved instead of treating them as a
 * verified semantic failure.
 */
export function unresolvedPostimpactOffBeatLandingFramesAtWindowEnd(
  detection: Detection,
  authoredContactFrames: readonly number[],
  startFrame: number,
  endFrame: number,
): number[] {
  const observedEndFrame = Math.min(endFrame, postimpactMeasurementLastFrame(detection));
  const firstUnresolvedFrame = observedEndFrame - (PERSISTENCE_FRAMES - 2);
  return postimpactOffBeatLandingsInWindow(detection, authoredContactFrames, startFrame, observedEndFrame)
    .filter((frame) => frame >= firstUnresolvedFrame);
}

/**
 * Keep verified and unresolved-tail off-beat events disjoint. A clipped tail
 * is telemetry, not a confirmed timing failure, so callers must never count
 * the same landing in both categories.
 */
export function splitPostimpactOffBeatLandingsInWindow(
  detection: Detection,
  authoredContactFrames: readonly number[],
  startFrame: number,
  endFrame: number,
): { confirmedFrames: number[]; unresolvedTailFrames: number[] } {
  const unresolvedTailFrames = unresolvedPostimpactOffBeatLandingFramesAtWindowEnd(
    detection,
    authoredContactFrames,
    startFrame,
    endFrame,
  );
  const unresolved = new Set(unresolvedTailFrames);
  return {
    confirmedFrames: postimpactOffBeatLandingsInWindow(
      detection,
      authoredContactFrames,
      startFrame,
      endFrame,
    ).filter((frame) => !unresolved.has(frame)),
    unresolvedTailFrames,
  };
}

/** Mirror `frozen_fixture.stableJson` without importing fixture/panel machinery. */
export function postimpactStableJson(value: unknown): string {
  const serialized = JSON.stringify(sortPostimpactKeys(value));
  if (serialized === undefined) throw new Error("post-impact stable JSON requires a serializable value");
  return serialized;
}

function sortPostimpactKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortPostimpactKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortPostimpactKeys(child)]));
  }
  return value;
}
