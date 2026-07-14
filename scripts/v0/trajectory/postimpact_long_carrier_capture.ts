/**
 * Score-blind stage-two handoff for the long-carrier calibration assay.
 *
 * The generic capture closure retains the current authored impact and its
 * opaque scored outcome so other one-stage studies can report them. A
 * duration-aware stage must not receive either value. This adapter strips
 * them, removes scored outcomes from its report surface, and exposes only a
 * boolean protected-impact verifier for construction safety checks.
 */
import type { OwnedContactObservation } from "./contact_observation.ts";
import type { PostimpactConstructionContext } from "./postimpact_construction_context.ts";
import {
  constructPostimpactCaptureClosureRows,
  postimpactCaptureObservationSurface,
  scorePostimpactCapture,
  type PostimpactCaptureObservationSurface,
  type PostimpactCaptureClosurePending,
  type PostimpactCaptureClosureRow,
} from "./postimpact_capture_closure.ts";
import { detectPostimpactWindow } from "./postimpact_detector.ts";
import { samePostimpactScoredContactImpact } from "./postimpact_observation.ts";
import type { PostimpactNamedReferenceState } from "./postimpact_observation.ts";
import type { PostimpactNamedReferenceStep } from "./postimpact_support_orientation.ts";
import type { PostimpactEngineTraceFingerprint } from "./postimpact_trace.ts";
import type { TargetFrame } from "./target_frame.ts";
import type { PostimpactSpeedRuler } from "./postimpact_physics.ts";

export const POSTIMPACT_LONG_CARRIER_CAPTURE_PROTOCOL = Object.freeze({
  stageTwoInput: "reduced_physical_capture_timing_and_opaque_impact_verifier_only.v1",
  excluded: Object.freeze([
    "current_impact_target",
    "raw_scored_impact_outcome",
    "score_adapter",
    "resolved_capture_geometry",
    "capture_screen_control",
    "outgoing_axes",
    "authored_contact_frames",
  ]),
  protectedImpactVerifier: "opaque_boolean_capture_impact_identity.v1",
  stageTwoReport: "reduced_capture_status_and_physical_ids_only.v1",
} as const);

export type PostimpactLongCarrierCaptureRows = {
  rows: PostimpactLongCarrierCaptureRow[];
};

export type PostimpactLongCarrierCaptureRow = {
  report: Record<string, unknown>;
  pending: PostimpactLongCarrierDurationCapture | null;
  protocolInvalid: boolean;
};

/**
 * All values visible to duration construction are physical/timing facts. The
 * current target and raw score are held in a closure behind one equality
 * predicate, so a phase cannot condition its geometry on either quantity.
 */
export type PostimpactLongCarrierDurationCapture = {
  // deno-lint-ignore no-explicit-any
  captureEngine: any;
  addTrackLines: PostimpactConstructionContext["prepared"]["addTrackLines"];
  captureLineIds: readonly number[];
  lastCaptureLineId: number;
  captureObservationSurface: PostimpactCaptureObservationSurface;
  current: Readonly<{
    startFrame: number;
    endFrame: number;
    intervalFrames: number;
  }>;
  baselinePhysicalPrefixTrace: PostimpactEngineTraceFingerprint;
  captureOnlyObservation: OwnedContactObservation;
  captureTraceThroughH: PostimpactEngineTraceFingerprint;
  captureFullTraceThroughH: PostimpactEngineTraceFingerprint;
  captureTraceThroughHPlusOne: PostimpactEngineTraceFingerprint;
  supportStartFrame: number;
  responseAnchorPoint: TargetFrame["anchorPoint"];
  namedReferenceAtH: PostimpactNamedReferenceState;
  namedReferenceStep: PostimpactNamedReferenceStep;
  sharedCaptureCertificate: PostimpactCaptureClosurePending["sharedCaptureCertificate"];
  impactWindowFrames: number;
  speedRuler: PostimpactSpeedRuler;
  protectedCaptureImpactMatches: (
    detection: ReturnType<typeof detectPostimpactWindow>,
    observation: OwnedContactObservation,
  ) => boolean;
};

/** Construct a generic capture, then expose only the duration-safe projection. */
export function constructPostimpactLongCarrierCaptureRows(
  context: PostimpactConstructionContext,
): PostimpactLongCarrierCaptureRows {
  const captureRows = constructPostimpactCaptureClosureRows(context);
  return {
    rows: captureRows.rows.map(projectPostimpactLongCarrierCaptureRow),
  };
}

/**
 * Public only as the typed stage-two projection. It is intentionally the sole
 * conversion from a generic capture to the duration-aware input surface.
 */
export function projectPostimpactLongCarrierCaptureRow(
  row: PostimpactCaptureClosureRow,
): PostimpactLongCarrierCaptureRow {
  return {
    report: summarizePostimpactLongCarrierSafeCaptureRow(row),
    pending: row.pending === null ? null : projectPostimpactLongCarrierDurationCapture(row.pending),
    protocolInvalid: row.protocolInvalid,
  };
}

export function projectPostimpactLongCarrierDurationCapture(
  pending: PostimpactCaptureClosurePending,
): PostimpactLongCarrierDurationCapture {
  const { scoreContactImpact, captureOnlyImpact, current: scoredCurrent } = pending;
  const captureLineIds = Object.freeze(pending.capture.lines.map((line) => line.id));
  const lastCaptureLineId = captureLineIds.at(-1);
  if (lastCaptureLineId === undefined) throw new Error("long-carrier capture projection requires at least one capture line");
  const current = Object.freeze({
    startFrame: scoredCurrent.startFrame,
    endFrame: scoredCurrent.endFrame,
    intervalFrames: scoredCurrent.intervalFrames,
  });
  const protectedCaptureImpactMatches = Object.freeze((
    detection: ReturnType<typeof detectPostimpactWindow>,
    observation: OwnedContactObservation,
  ) => samePostimpactScoredContactImpact(
    scorePostimpactCapture(scoreContactImpact, detection, observation, scoredCurrent.impact),
    captureOnlyImpact,
  ));
  return Object.freeze({
    captureEngine: pending.captureEngine,
    addTrackLines: pending.addTrackLines,
    captureLineIds,
    lastCaptureLineId,
    captureObservationSurface: postimpactCaptureObservationSurface(pending.capture),
    current,
    baselinePhysicalPrefixTrace: pending.baselinePhysicalPrefixTrace,
    captureOnlyObservation: pending.captureOnlyObservation,
    captureTraceThroughH: pending.captureTraceThroughH,
    captureFullTraceThroughH: pending.captureFullTraceThroughH,
    captureTraceThroughHPlusOne: pending.captureTraceThroughHPlusOne,
    supportStartFrame: pending.supportStartFrame,
    responseAnchorPoint: pending.responseAnchor.anchorPoint,
    namedReferenceAtH: pending.namedReferenceAtH,
    namedReferenceStep: pending.namedReferenceStep,
    sharedCaptureCertificate: pending.sharedCaptureCertificate,
    impactWindowFrames: pending.impactConvention.impactWindowFrames,
    speedRuler: Object.freeze({
      speedRulerMinPxPerFrame: pending.impactConvention.speedRulerMinPxPerFrame,
      speedRulerMaxPxPerFrame: pending.impactConvention.speedRulerMaxPxPerFrame,
    }),
    protectedCaptureImpactMatches,
  });
}

function summarizePostimpactLongCarrierSafeCaptureRow(
  row: PostimpactCaptureClosureRow,
): Record<string, unknown> {
  if (row.pending === null) {
    return Object.freeze({
      rowIndex: row.rowIndex,
      captureStatus: row.captureStatus,
      reason: row.captureReason,
      capture: null,
      captureClosure: null,
    });
  }
  const capture = row.pending;
  return Object.freeze({
    rowIndex: row.rowIndex,
    captureStatus: row.captureStatus,
    reason: row.captureReason,
    capture: Object.freeze({
      lineIds: Object.freeze(capture.capture.lines.map((line) => line.id)),
      supportStartFrame: capture.supportStartFrame,
      captureTraceThroughHPlusOne: capture.captureTraceThroughHPlusOne,
    }),
    captureClosure: Object.freeze({
      supportStartFrame: capture.supportStartFrame,
      responseAnchorPoint: capture.responseAnchor.anchorPoint,
      namedReferenceStep: Object.freeze({
        anchorPoint: capture.namedReferenceStep.anchorPoint,
        fromFrame: capture.namedReferenceStep.fromFrame,
        toFrame: capture.namedReferenceStep.toFrame,
        exactCaptureOnlyTraceFingerprint: capture.namedReferenceStep.exactCaptureOnlyTraceFingerprint,
      }),
    }),
  });
}
