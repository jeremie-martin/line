/** Shared observation rules for the preregistered exact-support-slice assay. */
import { PERSISTENCE_FRAMES, type Detection } from "../../lib/detector.ts";
import {
  airborneAt,
  measurementLastFrame,
  offBeatLandingEvents,
  positionAt,
  speedAt,
  velocityAt,
} from "../core/substrate.ts";
import { IMPACT_WINDOW, speedPxToAuthored } from "../types.ts";
import type { ScoredContactImpactOutcome } from "./scored_contact_impact.ts";
import type { OwnedContactEvent } from "./contact_observation.ts";
import { stableJson } from "./frozen_fixture.ts";
import type { PlanningState, Vec2 } from "./state.ts";
import type { ExactTraceFingerprint } from "./study_trace.ts";
import type { TargetFrame } from "./target_frame.ts";
import { EXACT_SUPPORT_SLICE_PROTOCOL } from "./exact_support_slice.ts";

export const EXACT_SUPPORT_SLICE_MAX_MEASUREMENT_HORIZON_FRAMES =
  EXACT_SUPPORT_SLICE_PROTOCOL.maxMeasurementHorizonFrames;
export const EXACT_SUPPORT_SLICE_MIN_MEASUREMENT_HORIZON_FRAMES =
  EXACT_SUPPORT_SLICE_PROTOCOL.minMeasurementHorizonFrames;

/**
 * Capture eligibility closes at the scorer's impact endpoint. H is deliberately
 * one frame later, so H/H+1 availability cannot decide whether a capture is
 * admitted to the construction assay.
 */
export function exactSupportSliceCaptureClosureEndFrame(selectedEventFrame: number | null): number | null {
  if (selectedEventFrame === null) return null;
  if (!Number.isSafeInteger(selectedEventFrame)) throw new Error("selected capture event frame must be a safe integer");
  return selectedEventFrame + IMPACT_WINDOW;
}

/**
 * Event eligibility is filtered at target +/- `maxSelectionOffsetFrames`, but
 * detector persistence needs its complete fixed tail before an event can seed
 * the H-1 capture closure read.
 */
export function exactSupportSliceCaptureSelectionValidationEndFrame(
  targetFrame: number,
  maxSelectionOffsetFrames: number,
): number {
  if (!Number.isSafeInteger(targetFrame)) throw new Error("capture target frame must be a safe integer");
  if (!Number.isSafeInteger(maxSelectionOffsetFrames) || maxSelectionOffsetFrames < 0) {
    throw new Error("capture selection offset must be a non-negative safe integer");
  }
  return targetFrame + maxSelectionOffsetFrames + PERSISTENCE_FRAMES - 1;
}

export type ExactSupportSliceConstructionProbeGuards = {
  /** Immutable [0,current.startFrame-1] replay identity. */
  physicalPrefixMatchesBaseline: boolean;
  /** Capture-only comparator itself was measurable through H. */
  captureOnlyPreHComplete: boolean;
  /** Full-engine capture-only trace was available with the declared semantics. */
  captureOnlyPreHTraceAvailable: boolean;
  /** Exact capture-only state over [outgoing.startFrame,H]. */
  captureTraceMatchesComparator: boolean;
  /** Candidate and capture-only traces agree through the first collision minus one. */
  traceMatchesBeforeFirstSupportCollision: boolean;
  selectedCaptureEventMatchesComparator: boolean;
  impactMatchesComparator: boolean;
  survivesThroughH: boolean;
  preOrAtHSupportCollisionCount: number;
};

/**
 * A support collision is an expected construction rejection only after the
 * immutable physical prefix and baseline comparator are intact. That prevents
 * an incidental collision from masking a broken pre-existing invariant.
 */
export function classifyExactSupportSliceConstructionProbe(
  guards: ExactSupportSliceConstructionProbeGuards,
): {
  protectedTraceAndCaptureStable: boolean;
  collisionCausallyAttributed: boolean;
  expectedCollisionRejection: boolean;
  protocolInvalid: boolean;
  constructionSafe: boolean;
} {
  if (!Number.isSafeInteger(guards.preOrAtHSupportCollisionCount) || guards.preOrAtHSupportCollisionCount < 0) {
    throw new Error("support collision count must be a non-negative safe integer");
  }
  const hasCollision = guards.preOrAtHSupportCollisionCount > 0;
  const protectedTraceAndCaptureStable = guards.captureOnlyPreHComplete &&
    guards.captureOnlyPreHTraceAvailable &&
    guards.physicalPrefixMatchesBaseline &&
    guards.captureTraceMatchesComparator &&
    guards.selectedCaptureEventMatchesComparator &&
    guards.impactMatchesComparator &&
    guards.survivesThroughH;
  const immutableComparatorStable = guards.captureOnlyPreHComplete &&
    guards.captureOnlyPreHTraceAvailable &&
    guards.physicalPrefixMatchesBaseline;
  const collisionCausallyAttributed = hasCollision && guards.traceMatchesBeforeFirstSupportCollision;
  const expectedCollisionRejection = immutableComparatorStable && collisionCausallyAttributed;
  const protocolInvalid = !immutableComparatorStable ||
    (hasCollision ? !collisionCausallyAttributed : !protectedTraceAndCaptureStable);
  return {
    protectedTraceAndCaptureStable,
    collisionCausallyAttributed,
    expectedCollisionRejection,
    protocolInvalid,
    constructionSafe: protectedTraceAndCaptureStable && !hasCollision,
  };
}

/** First declared shared-safe phase wins; no outcome data participates. */
export function firstSharedSafeExactSupportSlicePhase<T extends { sharedConstructionSafe: boolean }>(
  phases: readonly T[],
): T | null {
  return phases.find((phase) => phase.sharedConstructionSafe) ?? null;
}

export type ExactSupportSliceMeasurementHorizon =
  | { status: "ready"; measurementHorizonFrames: number; measurementSamples: number }
  | { status: "insufficient_measurement_horizon"; availableIntervals: number };

/**
 * Q is elapsed intervals; [H, H+Q] contains Q+1 scorer samples. This is an
 * observation boundary only: it cannot reach rail geometry or phase choice.
 */
export function exactSupportSliceMeasurementHorizon(
  outgoingEndFrame: number,
  supportStartFrame: number,
): ExactSupportSliceMeasurementHorizon {
  const availableIntervals = outgoingEndFrame - supportStartFrame;
  if (!Number.isSafeInteger(availableIntervals) || availableIntervals < EXACT_SUPPORT_SLICE_MIN_MEASUREMENT_HORIZON_FRAMES) {
    return { status: "insufficient_measurement_horizon", availableIntervals };
  }
  const measurementHorizonFrames = Math.min(EXACT_SUPPORT_SLICE_MAX_MEASUREMENT_HORIZON_FRAMES, availableIntervals);
  return {
    status: "ready",
    measurementHorizonFrames,
    measurementSamples: measurementHorizonFrames + 1,
  };
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
 * `detectWindow(..., endFrame)` classifies an endpoint landing using a clipped
 * persistence window. An off-beat landing in that tail is therefore retained
 * as unresolved rather than treated as a verified semantic landing.
 */
export function unresolvedOffBeatLandingFramesAtWindowEnd(
  detection: Detection,
  authoredContactFrames: readonly number[],
  startFrame: number,
  endFrame: number,
): number[] {
  const observedEndFrame = Math.min(endFrame, measurementLastFrame(detection));
  const firstUnresolvedFrame = observedEndFrame - (PERSISTENCE_FRAMES - 2);
  return offBeatLandingsInWindow(detection, authoredContactFrames, startFrame, observedEndFrame)
    .filter((frame) => frame >= firstUnresolvedFrame);
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
