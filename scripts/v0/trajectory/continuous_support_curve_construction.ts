/**
 * Curve-specific decoration of the shared target-blind capture closure.
 *
 * Capture realization and H/H+1 identity live in `postimpact_capture_closure`.
 * This module owns only the fixed curve phase ladder; it cannot see outgoing
 * timing, axes, fixture identity, or any post-H outcome.
 */
import {
  CONTINUOUS_SUPPORT_CURVE_ACTIONS,
  CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS,
  realizeContinuousSupportCurve,
  type ContinuousSupportCurve,
  type ContinuousSupportCurveAction,
} from "./continuous_support_curve.ts";
import type { PostimpactConstructionContext } from "./postimpact_construction_context.ts";
import {
  POSTIMPACT_CAPTURE_CLOSURE_PROTOCOL,
  constructPostimpactCaptureClosureRows,
  observePostimpactCapture,
  postimpactAllBodyCollisions,
  postimpactFirstCollisionFrame,
  postimpactTrace,
  scorePostimpactCapture,
  type PostimpactCaptureClosurePending,
  type PostimpactCaptureClosureRow,
} from "./postimpact_capture_closure.ts";
import { postimpactLineIdRange } from "./postimpact_construction_context.ts";
import { postimpactMeasurementLastFrame } from "./postimpact_detection_measurement.ts";
import { detectPostimpactWindow } from "./postimpact_detector.ts";
import {
  samePostimpactExactEngineTrace,
  samePostimpactOwnedCaptureEvent,
  samePostimpactScoredContactImpact,
} from "./postimpact_observation.ts";
import {
  certifyContinuousSupportCurvePhase,
  classifyPostimpactConstructionProbe,
  firstCertifiedContinuousSupportCurvePhase,
  type ContinuousSupportCurvePhaseCertificate,
  type ContinuousSupportCurveSharedCaptureCertificate,
} from "./postimpact_support_assay.ts";
import {
  survivesPostimpactThroughFrame,
  type PostimpactEngineCollisionWitness,
} from "./postimpact_trace.ts";

/** Compatibility name retained in existing curve audit artifacts. */
export const CONTINUOUS_SUPPORT_CURVE_CONSTRUCTION_PROTOCOL = POSTIMPACT_CAPTURE_CLOSURE_PROTOCOL;

export type ContinuousSupportCurveConstructionRows = {
  rows: ContinuousSupportCurveConstructionRow[];
};

export type ContinuousSupportCurveConstructionRow = {
  report: Record<string, unknown>;
  pending: ContinuousSupportCurvePendingCapture | null;
};

export type ContinuousSupportCurvePendingCapture = PostimpactCaptureClosurePending & {
  impactWindowFrames: number;
  sharedCaptureCertificate: ContinuousSupportCurveSharedCaptureCertificate;
  constructionPhases: ContinuousSupportCurveConstructionPhaseRecord[];
  selectedPhase: ContinuousSupportCurveConstructionPhaseRecord;
};

export type ContinuousSupportCurveConstructionPhaseRecord = {
  phaseLeadSteps: (typeof CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS)[number];
  certificate: ContinuousSupportCurvePhaseCertificate;
  actions: ContinuousSupportCurveConstructionActionRecord[];
};

export type ContinuousSupportCurveConstructionActionRecord = {
  action: ContinuousSupportCurveAction;
  status: "observed" | "error";
  constructionSafe: boolean;
  expectedCollisionRejection: boolean;
  protocolInvalid: boolean;
  reason: string | null;
  curve: ContinuousSupportCurve | null;
  preOrAtHCurveCollisions: PostimpactEngineCollisionWitness[];
  firstCurveCollisionFrame: number | null;
  traceMatchesBeforeFirstSupportCollision: boolean;
  elapsedMs: number;
};

/**
 * Select the first curve phase certified from the shared capture closure. The
 * closure and every phase are completed before any outgoing observation opens.
 */
export function constructContinuousSupportCurveRows(
  context: PostimpactConstructionContext,
): ContinuousSupportCurveConstructionRows {
  const captureRows = constructPostimpactCaptureClosureRows(context);
  return { rows: captureRows.rows.map(decorateCaptureClosureRow) };
}

function decorateCaptureClosureRow(row: PostimpactCaptureClosureRow): ContinuousSupportCurveConstructionRow {
  if (row.pending === null) {
    return {
      report: {
        ...row.report,
        construction: { phases: [], selectedPhaseLeadSteps: null },
      },
      pending: null,
    };
  }
  const capture = row.pending;
  const phases = CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS.map((phaseLeadSteps) =>
    evaluateConstructionPhase(capture, phaseLeadSteps),
  );
  const selectedCertificate = firstCertifiedContinuousSupportCurvePhase(phases.map((phase) => phase.certificate));
  const selectedPhase = selectedCertificate === null
    ? null
    : phases.find((phase) => phase.phaseLeadSteps === selectedCertificate.phaseLeadSteps) ?? null;
  const report: Record<string, unknown> = {
    ...row.report,
    captureStatus: selectedPhase === null ? "no_certified_phase" : "closed",
    construction: {
      phaseLeadSteps: CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS,
      phases: phases.map(summarizeConstructionPhase),
      selectedPhaseLeadSteps: selectedPhase?.phaseLeadSteps ?? null,
    },
  };
  if (selectedPhase === null) return { report, pending: null };
  return {
    report,
    pending: {
      ...capture,
      impactWindowFrames: capture.impactConvention.impactWindowFrames,
      sharedCaptureCertificate: capture.sharedCaptureCertificate,
      constructionPhases: phases,
      selectedPhase,
    },
  };
}

function evaluateConstructionPhase(
  capture: PostimpactCaptureClosurePending,
  phaseLeadSteps: (typeof CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS)[number],
): ContinuousSupportCurveConstructionPhaseRecord {
  const actions = CONTINUOUS_SUPPORT_CURVE_ACTIONS.map((action) =>
    evaluateConstructionAction(capture, phaseLeadSteps, action),
  );
  const certificate = certifyContinuousSupportCurvePhase(
    phaseLeadSteps,
    actions.map((action) => ({
      action: { id: action.action.id },
      status: action.status,
      constructionSafe: action.constructionSafe,
      expectedCollisionRejection: action.expectedCollisionRejection,
      protocolInvalid: action.protocolInvalid,
    })),
    capture.sharedCaptureCertificate,
  );
  return { phaseLeadSteps, certificate, actions };
}

function evaluateConstructionAction(
  capture: PostimpactCaptureClosurePending,
  phaseLeadSteps: (typeof CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS)[number],
  action: ContinuousSupportCurveAction,
): ContinuousSupportCurveConstructionActionRecord {
  const started = performance.now();
  try {
    const curveStart = capture.capture.lines.at(-1)!.id + 1;
    const curve = realizeContinuousSupportCurve({
      anchor: capture.responseAnchor,
      captureOnlyNamedReferenceStep: capture.namedReferenceStep,
      phaseLeadSteps,
    }, action, curveStart);
    postimpactLineIdRange(curveStart, curve.lines.length);
    const curveIds = new Set(curve.lines.map((line) => line.id));
    const engine = capture.addTrackLines(capture.captureEngine, curve.lines);
    const detection = detectPostimpactWindow(engine, 0, capture.supportStartFrame);
    const observation = observePostimpactCapture(
      detection,
      capture.current,
      capture.capture,
      capture.supportStartFrame,
      capture.impactConvention.impactWindowFrames,
    );
    const impact = scorePostimpactCapture(
      capture.scoreContactImpact,
      detection,
      observation,
      capture.current.impact,
    );
    const preOrAtHCurveCollisions = postimpactAllBodyCollisions(
      engine,
      0,
      capture.supportStartFrame,
      curveIds,
    );
    const firstCurveCollisionFrame = postimpactFirstCollisionFrame(preOrAtHCurveCollisions);
    const traceMatchesBeforeFirstSupportCollision = firstCurveCollisionFrame === null
      ? samePostimpactExactEngineTrace(
        postimpactTrace(engine, 0, capture.supportStartFrame),
        capture.captureFullTraceThroughH,
      )
      : samePostimpactExactEngineTrace(
        postimpactTrace(engine, 0, firstCurveCollisionFrame - 1),
        postimpactTrace(capture.captureEngine, 0, firstCurveCollisionFrame - 1),
      );
    const verdict = classifyPostimpactConstructionProbe({
      physicalPrefixMatchesBaseline: samePostimpactExactEngineTrace(
        postimpactTrace(engine, 0, capture.current.startFrame - 1),
        capture.baselinePhysicalPrefixTrace,
      ),
      captureOnlyPreHComplete: capture.sharedCaptureCertificate.captureOnlyCompleteThroughHPlusOne,
      captureOnlyPreHTraceAvailable: capture.sharedCaptureCertificate.exactCaptureOnlyTrace.fingerprint !== null &&
        capture.sharedCaptureCertificate.exactCaptureOnlyTrace.unavailableAtFrame === null,
      captureTraceMatchesComparator: samePostimpactExactEngineTrace(
        postimpactTrace(engine, capture.current.endFrame, capture.supportStartFrame),
        capture.captureTraceThroughH,
      ),
      traceMatchesBeforeFirstSupportCollision,
      selectedCaptureEventMatchesComparator: samePostimpactOwnedCaptureEvent(
        observation.selectedOwnedEvent,
        capture.captureOnlyObservation.selectedOwnedEvent,
      ),
      impactMatchesComparator: samePostimpactScoredContactImpact(impact, capture.captureOnlyImpact),
      survivesThroughH: survivesPostimpactThroughFrame(detection, capture.supportStartFrame) &&
        postimpactMeasurementLastFrame(detection) >= capture.supportStartFrame,
      preOrAtHSupportCollisionCount: preOrAtHCurveCollisions.length,
    });
    return {
      action,
      status: "observed",
      curve,
      preOrAtHCurveCollisions,
      firstCurveCollisionFrame,
      traceMatchesBeforeFirstSupportCollision,
      elapsedMs: round(performance.now() - started),
      ...verdict,
    };
  } catch (error) {
    return {
      action,
      status: "error",
      constructionSafe: false,
      expectedCollisionRejection: false,
      protocolInvalid: true,
      reason: errorMessage(error),
      curve: null,
      preOrAtHCurveCollisions: [],
      firstCurveCollisionFrame: null,
      traceMatchesBeforeFirstSupportCollision: false,
      elapsedMs: round(performance.now() - started),
    };
  }
}

function summarizeConstructionPhase(phase: ContinuousSupportCurveConstructionPhaseRecord) {
  return {
    phaseLeadSteps: phase.phaseLeadSteps,
    certificate: phase.certificate,
    actions: phase.actions.map((action) => ({
      action: action.action,
      status: action.status,
      constructionSafe: action.constructionSafe,
      expectedCollisionRejection: action.expectedCollisionRejection,
      protocolInvalid: action.protocolInvalid,
      reason: action.reason,
      curve: action.curve === null ? null : summarizeCurve(action.curve),
      preOrAtHCurveCollisions: action.preOrAtHCurveCollisions,
      firstCurveCollisionFrame: action.firstCurveCollisionFrame,
      traceMatchesBeforeFirstSupportCollision: action.traceMatchesBeforeFirstSupportCollision,
      elapsedMs: action.elapsedMs,
    })),
  };
}

function summarizeCurve(curve: ContinuousSupportCurve) {
  return {
    action: curve.action,
    extentPx: round(curve.extentPx),
    constructionExtentFrames: curve.constructionExtentFrames,
    phaseLeadSteps: curve.phaseLeadSteps,
    phaseLeadPx: round(curve.phaseLeadPx),
    entryTangentDeg: round(curve.entryTangentDeg),
    terminalTangentDeg: round(curve.terminalTangentDeg),
    worldTotalTurnDeg: round(curve.worldTotalTurnDeg),
    entryFlipped: curve.entryFlipped,
    entryActiveNormalContinuityDot: round(curve.entryActiveNormalContinuityDot),
    minimumAdjacentActiveNormalDot: round(curve.minimumAdjacentActiveNormalDot),
    referenceStep: curve.referenceStep,
    resolution: curve.resolution,
    lineCount: curve.lines.length,
    lines: curve.lines.map((line) => ({ ...line })),
    segments: curve.segments.map((segment, index) => ({
      lineId: segment.lineId,
      segmentIndex: index,
      tangentDeg: round(segment.tangentDeg),
      startArcFraction: segment.startArcFraction,
      endArcFraction: segment.endArcFraction,
    })),
  };
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
