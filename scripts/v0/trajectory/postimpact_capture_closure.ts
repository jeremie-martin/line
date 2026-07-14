/**
 * Target-blind closure of a post-impact capture event.
 *
 * This leaf owns the common mirrored capture screen and the exact H/H+1
 * comparator used by post-impact studies. It knows nothing about an outgoing
 * interval, authored axes, phase geometry, fixture provenance, or a compiler
 * candidate. Downstream assays may decorate a closed capture only through a
 * separately declared construction boundary.
 */
import { PERSISTENCE_FRAMES } from "../../lib/detector.ts";
import {
  makeMirroredPostimpactCaptureArcScreen,
  postimpactContactKinematicFrameFromPlanningState,
  realizePostimpactCaptureArc,
  resolvePostimpactCaptureArc,
  type PostimpactCaptureArcDesignEntry,
  type PostimpactRealizedCaptureArc,
} from "./postimpact_capture_arc.ts";
import {
  observeOwnedContactTransition,
  type OwnedContactObservation,
} from "./contact_observation.ts";
import {
  postimpactLineIdRange,
  type PostimpactConstructionContext,
} from "./postimpact_construction_context.ts";
import { postimpactMeasurementLastFrame } from "./postimpact_detection_measurement.ts";
import { detectPostimpactWindow } from "./postimpact_detector.ts";
import {
  postimpactNamedReferenceState,
  postimpactOffBeatLandingsInWindow,
  samePostimpactExactEngineTrace,
  samePostimpactOwnedCaptureEvent,
  unresolvedPostimpactOffBeatLandingFramesAtWindowEnd,
  type PostimpactNamedReferenceState,
} from "./postimpact_observation.ts";
import {
  makePostimpactNamedReferenceStep,
  type PostimpactNamedReferenceStep,
} from "./postimpact_support_orientation.ts";
import { extractPlanningState } from "./state.ts";
import {
  emptyPostimpactEngineStateTraceFingerprint,
  exactPostimpactEngineStateTraceFingerprint,
  postimpactEngineCollisionWitnessesForLineIds,
  survivesPostimpactThroughFrame,
  type PostimpactEngineCollisionWitness,
  type PostimpactEngineTraceFingerprint,
} from "./postimpact_trace.ts";
import { targetFrameFromPlanningState } from "./target_frame.ts";

export const POSTIMPACT_CAPTURE_CLOSURE_PROTOCOL = Object.freeze({
  captureScreen: "mirrored_current_impact_capture_arc.v1",
  captureEventMaxOffsetFrames: 1,
  selectionWindow: "current_end_plus_capture_offset_plus_persistence_minus_one.v1",
  // The owned transition selector can legitimately choose a gate-eligible
  // bounce for a short gap, not only a landing. Bind H to that selected event.
  responseBoundary: "selected_owned_event_plus_impact_window_plus_one.v1",
} as const);

const CAPTURE_EVENT_MAX_OFFSET_FRAMES = POSTIMPACT_CAPTURE_CLOSURE_PROTOCOL.captureEventMaxOffsetFrames;

export type PostimpactCaptureClosureRows = {
  rows: PostimpactCaptureClosureRow[];
};

export type PostimpactCaptureClosureRow = {
  rowIndex: number;
  captureStatus: string;
  captureReason: string | null;
  report: Record<string, unknown>;
  pending: PostimpactCaptureClosurePending | null;
  /**
   * Expected capture misses remain unavailable. A thrown construction error or
   * a changed protected prefix/capture identity is protocol-invalid and must
   * fail a downstream assay rather than being silently counted as coverage.
   */
  protocolInvalid: boolean;
};

/** Immutable capture-only facts shared by downstream construction assays. */
export type PostimpactCaptureClosureCertificate = {
  supportStartFrame: number;
  captureOnlyCompleteThroughHPlusOne: boolean;
  captureOnlyTraceStartFrame: number;
  captureOnlyTraceEndFrame: number;
  exactCaptureOnlyTrace: PostimpactEngineTraceFingerprint;
  namedReferenceStep: PostimpactNamedReferenceStep;
};

/**
 * A closed capture carries replay state and exact comparator evidence. It has
 * no outgoing frame, duration, axes, fixture identity, seed, or future
 * authored-contact information. The generic one-stage form intentionally
 * retains the current score adapter/outcome; duration-aware assays must first
 * project it through `postimpact_long_carrier_capture.ts`.
 */
export type PostimpactCaptureClosurePending = {
  rowIndex: number;
  entry: PostimpactCaptureArcDesignEntry;
  capture: PostimpactRealizedCaptureArc;
  // deno-lint-ignore no-explicit-any
  captureEngine: any;
  addTrackLines: PostimpactConstructionContext["prepared"]["addTrackLines"];
  scoreContactImpact: PostimpactConstructionContext["prepared"]["scoreContactImpact"];
  impactConvention: PostimpactConstructionContext["prepared"]["impactConvention"];
  current: PostimpactConstructionContext["current"];
  baselinePhysicalPrefixTrace: PostimpactEngineTraceFingerprint;
  captureOnlyObservation: OwnedContactObservation;
  captureOnlyImpact: unknown;
  captureTraceThroughH: PostimpactEngineTraceFingerprint;
  captureFullTraceThroughH: PostimpactEngineTraceFingerprint;
  captureTraceThroughHPlusOne: PostimpactEngineTraceFingerprint;
  supportStartFrame: number;
  responseAnchor: ReturnType<typeof targetFrameFromPlanningState>;
  /** Exact named-reference state at H; carrier planning uses its raw speed. */
  namedReferenceAtH: PostimpactNamedReferenceState;
  namedReferenceStep: PostimpactNamedReferenceStep;
  sharedCaptureCertificate: PostimpactCaptureClosureCertificate;
};

/**
 * Close the fixed mirrored capture screen from a sealed physical prefix. This
 * function is deliberately unable to inspect an outgoing interval or read a
 * file, environment, compiler policy, scorer implementation, or fixture data.
 */
export function constructPostimpactCaptureClosureRows(
  context: PostimpactConstructionContext,
): PostimpactCaptureClosureRows {
  const { prepared, current } = context;
  const baselinePhysicalPrefixTrace = postimpactTrace(prepared.engine, 0, current.startFrame - 1);
  const target = targetFrameFromPlanningState(prepared.targetPlanningState);
  const kinematic = postimpactContactKinematicFrameFromPlanningState(
    prepared.targetPlanningState,
    target,
    current.impact,
    prepared.impactConvention,
  );
  const screen = makeMirroredPostimpactCaptureArcScreen(kinematic);
  return {
    rows: screen.map((entry, rowIndex) => constructCaptureClosureRow({
      rowIndex,
      entry,
      context,
      baselinePhysicalPrefixTrace,
      target,
    })),
  };
}

function constructCaptureClosureRow(input: {
  rowIndex: number;
  entry: PostimpactCaptureArcDesignEntry;
  context: PostimpactConstructionContext;
  baselinePhysicalPrefixTrace: PostimpactEngineTraceFingerprint;
  target: ReturnType<typeof targetFrameFromPlanningState>;
}): PostimpactCaptureClosureRow {
  const started = performance.now();
  const { context, entry } = input;
  const { prepared, current } = context;
  let capture: PostimpactRealizedCaptureArc;
  try {
    const kinematic = postimpactContactKinematicFrameFromPlanningState(
      prepared.targetPlanningState,
      input.target,
      current.impact,
      prepared.impactConvention,
    );
    const resolved = resolvePostimpactCaptureArc(kinematic, entry.control, prepared.impactConvention);
    const captureRange = postimpactLineIdRange(prepared.nextLineId, resolved.arcSegmentCount + 2);
    capture = realizePostimpactCaptureArc(resolved, captureRange.start);
    if (capture.lines.at(-1)?.id !== captureRange.end) {
      throw new Error("capture line-id allocation drifted from its reserved range");
    }
  } catch (error) {
    return unavailableCaptureClosureRow(
      input.rowIndex,
      entry,
      "capture_realization_error",
      errorMessage(error),
      started,
      null,
      {},
      true,
    );
  }

  try {
    const captureLineIds = new Set(capture.lines.map((line) => line.id));
    const captureEngine = prepared.addTrackLines(prepared.engine, capture.lines);
    const preTargetCaptureCollisions = postimpactAllBodyCollisions(
      captureEngine,
      0,
      current.startFrame - 1,
      captureLineIds,
    );
    if (preTargetCaptureCollisions.length > 0) {
      return unavailableCaptureClosureRow(
        input.rowIndex,
        entry,
        "capture_pre_target_collision",
        "capture primitive collided before the current contact",
        started,
        capture,
        { preTargetCaptureCollisions },
      );
    }

    const selectionEndFrame = current.endFrame + CAPTURE_EVENT_MAX_OFFSET_FRAMES + PERSISTENCE_FRAMES - 1;
    const selectionDetection = detectPostimpactWindow(captureEngine, 0, selectionEndFrame);
    const selectionObservation = observePostimpactCapture(
      selectionDetection,
      current,
      capture,
      selectionEndFrame,
      prepared.impactConvention.impactWindowFrames,
    );
    const selected = selectionObservation.selectedOwnedEvent;
    if (selected === null) {
      return unavailableCaptureClosureRow(
        input.rowIndex,
        entry,
        "capture_not_owned_on_time",
        "no owned current-contact event in the fixed selection window",
        started,
        capture,
        {
          selection: summarizePostimpactCapture(
            prepared.scoreContactImpact,
            selectionDetection,
            selectionObservation,
            current.impact,
          ),
        },
      );
    }

    const supportStartFrame = selected.frame + prepared.impactConvention.impactWindowFrames + 1;
    const captureOnlyEndFrame = supportStartFrame + 1;
    const captureOnlyDetection = detectPostimpactWindow(captureEngine, 0, captureOnlyEndFrame);
    const captureOnlyObservation = observePostimpactCapture(
      captureOnlyDetection,
      current,
      capture,
      captureOnlyEndFrame,
      prepared.impactConvention.impactWindowFrames,
    );
    const captureOnlyImpact = scorePostimpactCapture(
      prepared.scoreContactImpact,
      captureOnlyDetection,
      captureOnlyObservation,
      current.impact,
    );
    const captureOnlyComplete = survivesPostimpactThroughFrame(captureOnlyDetection, captureOnlyEndFrame) &&
      postimpactMeasurementLastFrame(captureOnlyDetection) >= captureOnlyEndFrame;
    const physicalPrefixTrace = postimpactTrace(captureEngine, 0, current.startFrame - 1);
    const captureTraceThroughH = postimpactTrace(captureEngine, current.endFrame, supportStartFrame);
    const captureFullTraceThroughH = postimpactTrace(captureEngine, 0, supportStartFrame);
    const captureTraceThroughHPlusOne = postimpactTrace(captureEngine, current.endFrame, captureOnlyEndFrame);
    const captureSelectionStartFrame = Math.max(0, current.endFrame - CAPTURE_EVENT_MAX_OFFSET_FRAMES);
    const currentOnlyFrames = [current.endFrame];
    const captureOffBeatFrames = postimpactOffBeatLandingsInWindow(
      captureOnlyDetection,
      currentOnlyFrames,
      captureSelectionStartFrame,
      captureOnlyEndFrame,
    );
    const captureUnresolvedOffBeatFrames = unresolvedPostimpactOffBeatLandingFramesAtWindowEnd(
      captureOnlyDetection,
      currentOnlyFrames,
      captureSelectionStartFrame,
      captureOnlyEndFrame,
    );
    const responseState = captureOnlyComplete ? extractPlanningState(captureEngine, supportStartFrame) : null;
    const responseStatePlusOne = captureOnlyComplete
      ? extractPlanningState(captureEngine, captureOnlyEndFrame)
      : null;
    const responseAnchor = responseState === null ? null : targetFrameFromPlanningState(responseState);
    const namedAtH = responseAnchor === null
      ? null
      : postimpactNamedReferenceState(responseState, responseAnchor.anchorPoint);
    const namedAtHPlusOne = responseAnchor === null
      ? null
      : postimpactNamedReferenceState(responseStatePlusOne, responseAnchor.anchorPoint);
    const physicalPrefixMatchesBaseline = samePostimpactExactEngineTrace(
      physicalPrefixTrace,
      input.baselinePhysicalPrefixTrace,
    );
    const selectedCaptureMatches = samePostimpactOwnedCaptureEvent(
      selectionObservation.selectedOwnedEvent,
      captureOnlyObservation.selectedOwnedEvent,
    );
    const captureStable = physicalPrefixMatchesBaseline &&
      selectedCaptureMatches &&
      captureOnlyObservation.persistenceWindowComplete &&
      captureOnlyObservation.responseWindowComplete &&
      captureOffBeatFrames.length === 0 &&
      captureUnresolvedOffBeatFrames.length === 0;
    const captureTraceAvailable = captureTraceThroughHPlusOne.fingerprint !== null &&
      captureTraceThroughHPlusOne.unavailableAtFrame === null;
    if (!captureOnlyComplete || !captureStable || responseAnchor === null || namedAtH === null || namedAtHPlusOne === null ||
        !captureTraceAvailable) {
      return unavailableCaptureClosureRow(
        input.rowIndex,
        entry,
        "capture_comparator_unavailable",
        "capture-only H-to-H+1 comparator is incomplete, drifting, or unreadable",
        started,
        capture,
        {
          selection: summarizePostimpactCapture(
            prepared.scoreContactImpact,
            selectionDetection,
            selectionObservation,
            current.impact,
          ),
          captureOnly: summarizePostimpactCapture(
            prepared.scoreContactImpact,
            captureOnlyDetection,
            captureOnlyObservation,
            current.impact,
          ),
          physicalPrefixMatchesBaseline: samePostimpactExactEngineTrace(
            physicalPrefixTrace,
            input.baselinePhysicalPrefixTrace,
          ),
          selectedCaptureMatches,
          captureTraceAvailable,
          captureOffBeatFrames,
          captureUnresolvedOffBeatFrames,
          captureTraceThroughHPlusOne,
        },
        !physicalPrefixMatchesBaseline || !selectedCaptureMatches || !captureTraceAvailable,
      );
    }

    const namedReferenceStep = makePostimpactNamedReferenceStep({
      anchorPoint: responseAnchor.anchorPoint,
      fromFrame: supportStartFrame,
      toFrame: captureOnlyEndFrame,
      fromReference: namedAtH.position,
      toReference: namedAtHPlusOne.position,
      exactCaptureOnlyTraceFingerprint: captureTraceThroughHPlusOne.fingerprint,
    });
    const sharedCaptureCertificate: PostimpactCaptureClosureCertificate = Object.freeze({
      supportStartFrame,
      captureOnlyCompleteThroughHPlusOne: true,
      captureOnlyTraceStartFrame: current.endFrame,
      captureOnlyTraceEndFrame: captureOnlyEndFrame,
      exactCaptureOnlyTrace: captureTraceThroughHPlusOne,
      namedReferenceStep,
    });
    return {
      report: {
        rowIndex: input.rowIndex,
        label: entry.label,
        control: entry.control,
        captureStatus: "closed",
        capture: summarizePostimpactCapture(prepared.scoreContactImpact, captureOnlyDetection, captureOnlyObservation, current.impact, {
          geometry: summarizePostimpactCaptureGeometry(capture),
          supportStartFrame,
          physicalPrefixMatchesBaseline: samePostimpactExactEngineTrace(physicalPrefixTrace, input.baselinePhysicalPrefixTrace),
          captureTraceThroughHPlusOne,
          namedReferenceStep: summarizePostimpactNamedStep(namedReferenceStep),
        }),
        captureClosure: {
          supportStartFrame,
          responseAnchorPoint: responseAnchor.anchorPoint,
          namedReferenceStep: summarizePostimpactNamedStep(namedReferenceStep),
        },
        elapsedMs: round(performance.now() - started),
      },
      rowIndex: input.rowIndex,
      captureStatus: "closed",
      captureReason: null,
      pending: {
        rowIndex: input.rowIndex,
        entry,
        capture,
        captureEngine,
        addTrackLines: prepared.addTrackLines,
        scoreContactImpact: prepared.scoreContactImpact,
        impactConvention: prepared.impactConvention,
        current,
        baselinePhysicalPrefixTrace: input.baselinePhysicalPrefixTrace,
        captureOnlyObservation,
        captureOnlyImpact,
        captureTraceThroughH,
        captureFullTraceThroughH,
        captureTraceThroughHPlusOne,
        supportStartFrame,
        responseAnchor,
        namedReferenceAtH: namedAtH,
        namedReferenceStep,
        sharedCaptureCertificate,
      },
      protocolInvalid: false,
    };
  } catch (error) {
    return unavailableCaptureClosureRow(
      input.rowIndex,
      entry,
      "construction_error",
      errorMessage(error),
      started,
      capture,
      {},
      true,
    );
  }
}

function unavailableCaptureClosureRow(
  rowIndex: number,
  entry: PostimpactCaptureArcDesignEntry,
  captureStatus: string,
  reason: string,
  started: number,
  capture: PostimpactRealizedCaptureArc | null = null,
  extra: Record<string, unknown> = {},
  protocolInvalid = false,
): PostimpactCaptureClosureRow {
  return {
    rowIndex,
    captureStatus,
    captureReason: reason,
    report: {
      rowIndex,
      label: entry.label,
      control: entry.control,
      captureStatus,
      reason,
      capture: capture === null ? null : summarizePostimpactCaptureGeometry(capture),
      captureClosure: null,
      elapsedMs: round(performance.now() - started),
      ...extra,
    },
    pending: null,
    protocolInvalid,
  };
}

export function observePostimpactCapture(
  detection: ReturnType<typeof detectPostimpactWindow>,
  current: Pick<PostimpactConstructionContext["current"], "endFrame" | "intervalFrames">,
  capture: PostimpactCaptureObservationSurface,
  endFrame: number,
  impactWindowFrames: number,
): OwnedContactObservation {
  const roles = new Map<number, string>([
    [capture.lineRoles.approach, "capture_approach"],
    [capture.lineRoles.runway, "capture_runway"],
    ...capture.lineRoles.arc.map((id) => [id, "capture_arc"] as const),
  ]);
  return observeOwnedContactTransition(detection, {
    targetFrame: current.endFrame,
    gapFrames: current.intervalFrames,
    observationEndFrame: endFrame,
    ownedLineIds: new Set(capture.captureBandLineIds),
    lineRoles: roles,
    requiredLineRoles: ["capture_approach", "capture_runway", "capture_arc"],
    persistenceOffsetFrames: PERSISTENCE_FRAMES,
    responseOffsetFrames: impactWindowFrames,
  });
}

/** Minimal physical capture metadata needed to re-observe an owned event. */
export type PostimpactCaptureObservationSurface = Readonly<{
  captureBandLineIds: readonly number[];
  lineRoles: Readonly<{
    approach: number;
    runway: number;
    arc: readonly number[];
  }>;
}>;

/** Clone only the line-role facts required for observation; omit arc geometry. */
export function postimpactCaptureObservationSurface(
  capture: PostimpactRealizedCaptureArc,
): PostimpactCaptureObservationSurface {
  return Object.freeze({
    captureBandLineIds: Object.freeze([...capture.captureBandLineIds]),
    lineRoles: Object.freeze({
      approach: capture.lineRoles.approach,
      runway: capture.lineRoles.runway,
      arc: Object.freeze([...capture.lineRoles.arc]),
    }),
  });
}

export function scorePostimpactCapture(
  scorer: PostimpactConstructionContext["prepared"]["scoreContactImpact"],
  detection: ReturnType<typeof detectPostimpactWindow>,
  observation: OwnedContactObservation,
  impactTarget: number,
): unknown {
  return scorer(detection, {
    target: impactTarget,
    landingFrame: observation.selectedOwnedEvent?.frame ?? null,
    responseWindowComplete: observation.responseWindowComplete,
  });
}

export function postimpactAllBodyCollisions(
  // deno-lint-ignore no-explicit-any
  engine: any,
  startFrame: number,
  endFrame: number,
  lineIds: ReadonlySet<number>,
): PostimpactEngineCollisionWitness[] {
  if (endFrame < startFrame) return [];
  const hits: PostimpactEngineCollisionWitness[] = [];
  for (let frame = startFrame; frame <= endFrame; frame++) {
    const frameHits = postimpactEngineCollisionWitnessesForLineIds(engine, frame, lineIds);
    if (frameHits.some((hit) => hit.pointIds.length === 0)) {
      throw new Error("post-impact support collision telemetry lacked all-body point attribution");
    }
    hits.push(...frameHits);
  }
  return hits;
}

export function postimpactFirstCollisionFrame(collisions: readonly PostimpactEngineCollisionWitness[]): number | null {
  return collisions.length === 0 ? null : Math.min(...collisions.map((hit) => hit.frame));
}

export function postimpactTrace(
  // deno-lint-ignore no-explicit-any
  engine: any,
  startFrame: number,
  endFrame: number,
): PostimpactEngineTraceFingerprint {
  return endFrame < startFrame
    ? emptyPostimpactEngineStateTraceFingerprint()
    : exactPostimpactEngineStateTraceFingerprint(engine, startFrame, endFrame);
}

export function summarizePostimpactCapture(
  scorer: PostimpactConstructionContext["prepared"]["scoreContactImpact"],
  detection: ReturnType<typeof detectPostimpactWindow>,
  observation: OwnedContactObservation,
  impactTarget: number,
  extra: Record<string, unknown> = {},
) {
  return {
    geometry: null,
    selectedOwnedEvent: observation.selectedOwnedEvent,
    persistenceWindowComplete: observation.persistenceWindowComplete,
    responseWindowComplete: observation.responseWindowComplete,
    impact: scorePostimpactCapture(scorer, detection, observation, impactTarget),
    terminus: detection.terminus,
    ...extra,
  };
}

export function summarizePostimpactCaptureGeometry(capture: PostimpactRealizedCaptureArc) {
  return {
    lineCount: capture.lines.length,
    lineIds: capture.lines.map((line) => line.id),
    lines: capture.lines.map((line) => ({ ...line })),
    lineRoles: { ...capture.lineRoles, arc: [...capture.lineRoles.arc] },
    captureBandLineIds: [...capture.captureBandLineIds],
    responseHorizonFrames: capture.responseHorizonFrames,
    entryAngleDeg: round(capture.entryAngleDeg),
    exitAngleDeg: round(capture.exitAngleDeg),
  };
}

export function summarizePostimpactNamedStep(step: PostimpactNamedReferenceStep) {
  return {
    anchorPoint: step.anchorPoint,
    fromFrame: step.fromFrame,
    toFrame: step.toFrame,
    exactCaptureOnlyTraceFingerprint: step.exactCaptureOnlyTraceFingerprint,
  };
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
