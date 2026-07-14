/** Shared observation rules for the preregistered exact-support-slice assay. */
import type { Detection } from "../../lib/detector.ts";
import {
  airborneAt,
  offBeatLandingEvents,
  positionAt,
  speedAt,
  velocityAt,
} from "../core/substrate.ts";
import { speedPxToAuthored } from "../types.ts";
import type { ScoredContactImpactOutcome } from "./scored_contact_impact.ts";
import type { OwnedContactEvent } from "./contact_observation.ts";
import { stableJson } from "./frozen_fixture.ts";
import type { PlanningState, Vec2 } from "./state.ts";
import type { ExactTraceFingerprint } from "./study_trace.ts";
import type { TargetFrame } from "./target_frame.ts";
import { EXACT_SUPPORT_SLICE_PROTOCOL } from "./exact_support_slice.ts";

export const EXACT_SUPPORT_SLICE_MAX_HORIZON_FRAMES = EXACT_SUPPORT_SLICE_PROTOCOL.maxHorizonFrames;
export const EXACT_SUPPORT_SLICE_MIN_HORIZON_FRAMES = EXACT_SUPPORT_SLICE_PROTOCOL.minHorizonFrames;

export type ExactSupportSliceHorizon =
  | { status: "ready"; horizonFrames: number; measurementSamples: number }
  | { status: "insufficient_support_horizon"; availableIntervals: number };

/** Q is elapsed intervals; [H, H+Q] contains Q+1 scorer samples. */
export function exactSupportSliceHorizon(outgoingEndFrame: number, supportStartFrame: number): ExactSupportSliceHorizon {
  const availableIntervals = outgoingEndFrame - supportStartFrame;
  if (!Number.isSafeInteger(availableIntervals) || availableIntervals < EXACT_SUPPORT_SLICE_MIN_HORIZON_FRAMES) {
    return { status: "insufficient_support_horizon", availableIntervals };
  }
  const horizonFrames = Math.min(EXACT_SUPPORT_SLICE_MAX_HORIZON_FRAMES, availableIntervals);
  return { status: "ready", horizonFrames, measurementSamples: horizonFrames + 1 };
}

/** Full engine-state fingerprints are a fail-closed identity predicate. */
export function sameExactEngineTrace(left: ExactTraceFingerprint, right: ExactTraceFingerprint): boolean {
  return left.fingerprint !== null && right.fingerprint !== null &&
    left.unavailableAtFrame === null && right.unavailableAtFrame === null &&
    left.semantics === "full_non_scarf_engine_state_v1" &&
    right.semantics === "full_non_scarf_engine_state_v1" &&
    left.frameCount === right.frameCount && left.fingerprint === right.fingerprint;
}

/**
 * A capture equality guard intentionally includes all selected-event metadata,
 * not just timing or owned line IDs. This prevents a changed detector event
 * kind/role from masquerading as the same capture.
 */
export function sameOwnedCaptureEvent(left: OwnedContactEvent | null, right: OwnedContactEvent | null): boolean {
  return left !== null && right !== null && stableJson(left) === stableJson(right);
}

/** The scorer-facing impact outcome is part of the capture identity. */
export function sameScoredContactImpact(
  left: ScoredContactImpactOutcome,
  right: ScoredContactImpactOutcome,
): boolean {
  return stableJson(left) === stableJson(right);
}

/** Read a fixed named reference point rather than reselecting "lowest" later. */
export function namedReferenceState(
  state: PlanningState | null,
  anchorPoint: TargetFrame["anchorPoint"],
): { point: TargetFrame["anchorPoint"]; position: Vec2; velocity: Vec2; speedPxPerFrame: number; headingDeg: number } | null {
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

export function displacement(from: Vec2, to: Vec2): Vec2 {
  return { x: to.x - from.x, y: to.y - from.y };
}

/** Scorer-facing CoM air/speed measurements over an inclusive observation window. */
export function measureCoMWindow(
  detection: Detection,
  startFrame: number,
  endFrame: number,
): {
  startFrame: number;
  endFrame: number;
  measurementSamples: number;
  airborneSamples: number;
  airFraction: number;
  meanSpeedPxPerFrame: number;
  meanSpeedAuthored: number;
  terminal: { position: Vec2; velocity: Vec2; speedPxPerFrame: number; headingDeg: number };
} | null {
  if (!Number.isSafeInteger(startFrame) || !Number.isSafeInteger(endFrame) || endFrame < startFrame) return null;
  let airborneSamples = 0;
  let speedSumPxPerFrame = 0;
  for (let frame = startFrame; frame <= endFrame; frame++) {
    const airborne = airborneAt(detection, frame);
    const speed = speedAt(detection, frame);
    if (airborne === undefined || speed === undefined) return null;
    if (airborne) airborneSamples++;
    speedSumPxPerFrame += speed;
  }
  const position = positionAt(detection, endFrame);
  const velocity = velocityAt(detection, endFrame);
  const speed = speedAt(detection, endFrame);
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
    meanSpeedAuthored: speedPxToAuthored(meanSpeedPxPerFrame),
    terminal: {
      position: { ...position },
      velocity: { ...velocity },
      speedPxPerFrame: speed,
      headingDeg: Math.atan2(velocity.y, velocity.x) * 180 / Math.PI,
    },
  };
}

export function offBeatLandingsInWindow(
  detection: Detection,
  authoredContactFrames: readonly number[],
  startFrame: number,
  endFrame: number,
): number[] {
  return offBeatLandingEvents(detection, [...authoredContactFrames])
    .filter((event) => event.frame >= startFrame && event.frame <= endFrame)
    .map((event) => event.frame);
}

/**
 * Reporting-only residual direction after the capture prefix. No member of the
 * rail stencil reads this object while constructing geometry.
 */
export function remainingAirSpeedBudget(input: {
  detection: Detection;
  outgoingStartFrame: number;
  outgoingEndFrame: number;
  supportStartFrame: number;
  axes: { air?: number; speed?: number };
}): {
  prefixMeasurementSamples: number;
  remainingMeasurementSamples: number;
  air: { target: number; remainingSamples: number; remainingFraction: number } | null;
  speed: { target: number; remainingSumAuthored: number; remainingMeanAuthored: number } | null;
} | null {
  if (input.supportStartFrame < input.outgoingStartFrame || input.supportStartFrame > input.outgoingEndFrame) return null;
  let prefixAirborneSamples = 0;
  let prefixSpeedAuthoredSum = 0;
  for (let frame = input.outgoingStartFrame; frame < input.supportStartFrame; frame++) {
    const airborne = airborneAt(input.detection, frame);
    const speed = speedAt(input.detection, frame);
    if (airborne === undefined || speed === undefined) return null;
    if (airborne) prefixAirborneSamples++;
    prefixSpeedAuthoredSum += speedPxToAuthored(speed);
  }
  const totalSamples = input.outgoingEndFrame - input.outgoingStartFrame + 1;
  const prefixMeasurementSamples = input.supportStartFrame - input.outgoingStartFrame;
  const remainingMeasurementSamples = totalSamples - prefixMeasurementSamples;
  return {
    prefixMeasurementSamples,
    remainingMeasurementSamples,
    air: input.axes.air === undefined ? null : {
      target: input.axes.air,
      remainingSamples: input.axes.air * totalSamples - prefixAirborneSamples,
      remainingFraction: (input.axes.air * totalSamples - prefixAirborneSamples) / remainingMeasurementSamples,
    },
    speed: input.axes.speed === undefined ? null : {
      target: input.axes.speed,
      remainingSumAuthored: input.axes.speed * totalSamples - prefixSpeedAuthoredSum,
      remainingMeanAuthored: (input.axes.speed * totalSamples - prefixSpeedAuthoredSum) / remainingMeasurementSamples,
    },
  };
}

export function angleDeltaDeg(left: number, right: number): number {
  let delta = (left - right + 180) % 360;
  if (delta < 0) delta += 360;
  return delta - 180;
}
