/**
 * Calibration-only assay for a fixed five-arm, post-impact support curve.
 *
 * Construction is intentionally target-blind: it receives only a rebuilt
 * physical prefix, the current impact, and a fresh line-id range. The sealed
 * input boundary releases outgoing observation only after every capture row
 * has completed its declared phase certificate. Nothing in this file selects
 * a compiler candidate or changes compiler behavior.
 */
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, relative, resolve } from "node:path";
import ts from "typescript";
import { PERSISTENCE_FRAMES } from "../lib/detector.ts";
import { engineLineFromTrackLine, measurementLastFrame } from "./core/substrate.ts";
import { IMPACT_WINDOW, type TrackLine } from "./types.ts";
import {
  realizeContactCaptureArc,
  resolveContactCaptureArc,
  type RealizedContactCaptureArc,
} from "./trajectory/contact_capture_arc.ts";
import { makeMirroredContactCaptureArcScreen, type ContactCaptureArcDesignEntry } from "./trajectory/contact_capture_arc_design.ts";
import { contactKinematicFrameFromPlanningState } from "./trajectory/contact_kinematic_frame.ts";
import { observeOwnedContactTransition, type OwnedContactObservation } from "./trajectory/contact_observation.ts";
import {
  CONTINUOUS_SUPPORT_CURVE_ACTIONS,
  CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS,
  CONTINUOUS_SUPPORT_CURVE_PROTOCOL,
  realizeContinuousSupportCurve,
  realizeContinuousSupportCurveAtResolution,
  type ContinuousSupportCurve,
  type ContinuousSupportCurveAction,
} from "./trajectory/continuous_support_curve.ts";
import { parseContinuousSupportCurveCliArguments } from "./trajectory/continuous_support_curve_cli.ts";
import {
  postimpactLineIdRange,
  withPostimpactStudyInputBoundaryFromPath,
  type PostimpactStudyConstructionContext,
} from "./trajectory/postimpact_fixture.ts";
import {
  certifyContinuousSupportCurvePhase,
  classifyPostimpactConstructionProbe,
  classifyContinuousSupportCurveCausalExposure,
  firstCertifiedContinuousSupportCurvePhase,
  postimpactMeasurementHorizon,
  summarizeContinuousSupportCurveMatchedNeutralContrast,
  type ContinuousSupportCurveCausalExposure,
  type ContinuousSupportCurvePhaseCertificate,
  type ContinuousSupportCurveSharedCaptureCertificate,
} from "./trajectory/postimpact_support_assay.ts";
import { makePostimpactNamedReferenceStep } from "./trajectory/postimpact_support_orientation.ts";
import { detectPostimpactWindow as detectWindow } from "./trajectory/postimpact_detector.ts";
import {
  measurePostimpactCoMWindow as measureCoMWindow,
  postimpactNamedReferenceState as namedReferenceState,
  postimpactOffBeatLandingsInWindow as offBeatLandingsInWindow,
  samePostimpactExactEngineTrace as sameExactEngineTrace,
  samePostimpactOwnedCaptureEvent as sameOwnedCaptureEvent,
  samePostimpactScoredContactImpact as sameScoredContactImpact,
  unresolvedPostimpactOffBeatLandingFramesAtWindowEnd as unresolvedOffBeatLandingFramesAtWindowEnd,
} from "./trajectory/postimpact_observation.ts";
import { scoredContactImpact } from "./trajectory/scored_contact_impact.ts";
import { extractPlanningState } from "./trajectory/state.ts";
import {
  emptyPostimpactEngineStateTraceFingerprint as emptyEngineStateTraceFingerprint,
  postimpactEngineCollisionWitnessesForLineIds as engineCollisionHitsForLineIds,
  exactPostimpactEngineStateTraceFingerprint as exactEngineStateTraceFingerprint,
  survivesPostimpactThroughFrame as survivesThroughFrame,
  type PostimpactEngineCollisionWitness as EngineCollisionHit,
  type PostimpactEngineTraceFingerprint as ExactTraceFingerprint,
} from "./trajectory/postimpact_trace.ts";
import { targetFrameFromPlanningState } from "./trajectory/target_frame.ts";

const STUDY_SCHEMA = "line.study-continuous-postimpact-support-curve.v2";
const CAPTURE_EVENT_MAX_OFFSET_FRAMES = 1;
const RUNNER_PATH = "scripts/v0/study_continuous_support_curve.ts";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_continuous_support_curve.ts --fixture=FILE [--out=FILE]",
    "",
    "Runs the fixed post-impact support-curve calibration assay.",
    "Construction is target-blind; output is descriptive evidence only.",
  ].join("\n") + "\n");
  process.exit(0);
}

const { fixturePath, explicitOut } = parseContinuousSupportCurveCliArguments(argv);
if (explicitOut !== undefined) assertUnusedArtifactPath(explicitOut);
const started = performance.now();
const sourceIdentityAtStart = sourceIdentity(RUNNER_PATH);
const compilerIdentityAtStart = observedCompilerIdentity();
const protocol = Object.freeze({
  captureScreen: "fixed_mirrored_contact_capture_arc.v2",
  constructionInput: "sealed_current_impact_and_physical_prefix_only.v1",
  phaseSelection: "first_certified_declared_phase_all_five_arms.v1",
  phaseLeadSteps: CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS,
  actions: CONTINUOUS_SUPPORT_CURVE_ACTIONS,
  curve: CONTINUOUS_SUPPORT_CURVE_PROTOCOL,
  captureProtection: {
    expectedContactsBeforeMeasurement: "current_contact_only",
    exactTrace: "full_non_scarf_engine_state_v1",
    referenceStep: "capture_only_named_H_to_H_plus_1.v1",
  },
  measurement: "outgoing_end_opens_only_after_phase_selection; Q=min(12,outgoing.end-H), Q>=4",
  directionalEvidence: "matched_neutral_five_arm_causal_exposure.v1",
  resolutionDiagnostic: "selected_phase_only_nominal_and_2x_nonselecting.v1",
});
const protocolFingerprint = sha256(stableJson(protocol));

const boundary = withPostimpactStudyInputBoundaryFromPath(
  fixturePath,
  (context) => constructRows(context),
);
const measuredRows = boundary.constructionResult.rows.map((row) => measureRow(row, boundary.observation));
const summary = summarizeFixture(measuredRows);
const sourceIdentityAtEnd = sourceIdentity(RUNNER_PATH);
const compilerIdentityAtEnd = observedCompilerIdentity();
const identityStable = sourceIdentityAtStart.fingerprint === sourceIdentityAtEnd.fingerprint &&
  compilerIdentityAtStart.fingerprint === compilerIdentityAtEnd.fingerprint;
const artifactIdentity = {
  fixtureFingerprint: boundary.audit.fixtureFingerprint,
  protocolFingerprint,
  sourceFingerprint: sourceIdentityAtStart.fingerprint,
  compilerFingerprint: compilerIdentityAtStart.fingerprint,
};
const assayStatus = classifyAssayStatus(identityStable, summary);
const output = {
  schema: STUDY_SCHEMA,
  artifactIdentity: { ...artifactIdentity, fingerprint: sha256(stableJson(artifactIdentity)) },
  purpose: [
    "Falsify or characterize a continuous, active-normal-relative post-impact support curve.",
    "Construction is blind to outgoing axes, next events, case identity, seed, and duration class.",
    "This is calibration evidence only; it cannot select a compiler implementation or rollout.",
  ],
  status: {
    protocolStatus: assayStatus.protocolStatus,
    executionComplete: assayStatus.executionComplete,
    descriptiveLocalClaimEligible: assayStatus.descriptiveLocalClaimEligible,
    matchedNeutralDirectionalContrastRows: summary.matchedNeutralDirectionalContrastRows,
    productionIntegration: "forbidden: calibration assay, not a compiler candidate source or promotion controller",
    claimEligibility: assayStatus.claimEligibility,
  },
  protocol: { ...protocol, protocolFingerprint },
  argv: [...argv],
  elapsedMs: round(performance.now() - started),
  provenance: {
    fixturePath,
    audit: boundary.audit,
    runtime: { node: process.version, engine: process.env.LR_ENGINE ?? "wasm" },
    sourceAtStart: sourceIdentityAtStart,
    sourceAtEnd: sourceIdentityAtEnd,
    compilerAtStart: compilerIdentityAtStart,
    compilerAtEnd: compilerIdentityAtEnd,
  },
  rows: measuredRows.map((row) => row.report),
  summary,
  caveats: [
    "Phase selection uses only construction certificates; outgoing observation and full authored contact frames become available afterward.",
    "The fixed five-arm ladder is a representation assay, not a search menu. No arm or capture row is promoted.",
    "Resolution 2x is a post-selection sensitivity diagnostic. It cannot select a phase, action, or compiler behavior.",
    "Rows within this one frozen fixture share a prefix and capture screen; no row-count is interpreted as independent statistical evidence.",
  ],
};
const canonicalPath = explicitOut ??
  `generated/studies/continuous-support-curve/v2/${boundary.audit.fixtureFingerprint.slice(0, 12)}-${protocolFingerprint.slice(0, 12)}.json`;
const outPath = identityStable ? (explicitOut ?? allocateArtifactPath(canonicalPath)) :
  allocateArtifactPath(driftArtifactPath(canonicalPath, sourceIdentityAtEnd.fingerprint, compilerIdentityAtEnd.fingerprint));
writeImmutableJson(outPath, output);
process.stderr.write(
  `continuous support curve: ${summary.selectedCertifiedPhaseRows}/${summary.captureRows} selected certified phases; ` +
  `${summary.completeMeasurementRows} complete measurements; ${summary.completePairedRows} complete five-arm rows; ` +
  `${summary.structurallyValidNominalArms}/${summary.measuredNominalArmAttempts} measured nominal arms valid; ` +
  `${round(performance.now() - started)}ms -> ${outPath}\n`,
);
if (!assayStatus.executionComplete) process.exitCode = 2;

type ConstructionRows = { rows: ConstructionRow[] };

type ConstructionRow = {
  report: Record<string, unknown>;
  pending: PendingCapture | null;
};

type PendingCapture = {
  rowIndex: number;
  entry: ContactCaptureArcDesignEntry;
  capture: RealizedContactCaptureArc;
  captureEngine: any;
  current: PostimpactStudyConstructionContext["current"];
  baselinePhysicalPrefixTrace: ExactTraceFingerprint;
  captureOnlyObservation: OwnedContactObservation;
  captureOnlyImpact: ReturnType<typeof scoredContactImpact>;
  captureTraceThroughH: ExactTraceFingerprint;
  captureFullTraceThroughH: ExactTraceFingerprint;
  captureTraceThroughHPlusOne: ExactTraceFingerprint;
  supportStartFrame: number;
  responseAnchor: ReturnType<typeof targetFrameFromPlanningState>;
  namedReferenceStep: ReturnType<typeof makePostimpactNamedReferenceStep>;
  sharedCaptureCertificate: ContinuousSupportCurveSharedCaptureCertificate;
  constructionPhases: ConstructionPhaseRecord[];
  selectedPhase: ConstructionPhaseRecord;
};

type ConstructionPhaseRecord = {
  phaseLeadSteps: (typeof CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS)[number];
  certificate: ContinuousSupportCurvePhaseCertificate;
  actions: ConstructionActionRecord[];
};

type ConstructionActionRecord = {
  action: ContinuousSupportCurveAction;
  status: "observed" | "error";
  constructionSafe: boolean;
  expectedCollisionRejection: boolean;
  protocolInvalid: boolean;
  reason: string | null;
  curve: ContinuousSupportCurve | null;
  preOrAtHCurveCollisions: EngineCollisionHit[];
  firstCurveCollisionFrame: number | null;
  traceMatchesBeforeFirstSupportCollision: boolean;
  elapsedMs: number;
};

type CaptureMeasurement = {
  detection: ReturnType<typeof detectWindow>;
  observation: OwnedContactObservation;
  impact: ReturnType<typeof scoredContactImpact>;
  traceThroughH: ExactTraceFingerprint;
  complete: boolean;
  window: NonNullable<ReturnType<typeof measureCoMWindow>> | null;
  terminalReference: NonNullable<ReturnType<typeof namedReferenceState>> | null;
  offBeatFrames: number[];
  unresolvedOffBeatFrames: number[];
};

type MeasuredArm = {
  action: ContinuousSupportCurveAction;
  status: "observed" | "error";
  reason: string | null;
  curve: ContinuousSupportCurve | null;
  constructionSafe: boolean;
  structurallyValid: boolean;
  physicalPrefixMatchesBaseline: boolean;
  captureTraceMatchesComparator: boolean;
  selectedCaptureEventMatchesComparator: boolean;
  impactMatchesComparator: boolean;
  traceMatchesBeforeFirstSupportCollision: boolean;
  curveLineIdsDisjointFromCapture: boolean;
  preOrAtHCurveCollisions: EngineCollisionHit[];
  curveCollisions: EngineCollisionHit[];
  offBeatFrames: number[];
  unresolvedOffBeatFrames: number[];
  window: NonNullable<ReturnType<typeof measureCoMWindow>> | null;
  terminalReference: NonNullable<ReturnType<typeof namedReferenceState>> | null;
  causalExposure: ContinuousSupportCurveCausalExposure | null;
  elapsedMs: number;
};

function constructRows(context: PostimpactStudyConstructionContext): ConstructionRows {
  const { prepared, current } = context;
  const physicalPrefixEndFrame = current.startFrame - 1;
  const baselinePhysicalPrefixTrace = trace(prepared.engine, 0, physicalPrefixEndFrame);
  const target = targetFrameFromPlanningState(prepared.targetPlanningState);
  const kinematic = contactKinematicFrameFromPlanningState(prepared.targetPlanningState, target, { impact: current.impact });
  const screen = makeMirroredContactCaptureArcScreen(kinematic);
  return {
    rows: screen.map((entry, rowIndex) => constructCaptureRow({
      rowIndex,
      entry,
      context,
      baselinePhysicalPrefixTrace,
      target,
    })),
  };
}

function constructCaptureRow(input: {
  rowIndex: number;
  entry: ContactCaptureArcDesignEntry;
  context: PostimpactStudyConstructionContext;
  baselinePhysicalPrefixTrace: ExactTraceFingerprint;
  target: ReturnType<typeof targetFrameFromPlanningState>;
}): ConstructionRow {
  const started = performance.now();
  const { context, entry } = input;
  const { prepared, current } = context;
  let capture: RealizedContactCaptureArc;
  try {
    const kinematic = contactKinematicFrameFromPlanningState(prepared.targetPlanningState, input.target, { impact: current.impact });
    const resolved = resolveContactCaptureArc(kinematic, entry.control);
    const captureRange = postimpactLineIdRange(prepared.nextLineId, resolved.arcSegmentCount + 2);
    capture = realizeContactCaptureArc(resolved, captureRange.start);
    if (capture.lines.at(-1)?.id !== captureRange.end) throw new Error("capture line-id allocation drifted from its reserved range");
  } catch (error) {
    return unavailableConstructionRow(input.rowIndex, entry, "capture_realization_error", errorMessage(error), started);
  }

  try {
    const captureLineIds = new Set(capture.lines.map((line) => line.id));
    const captureEngine = prepared.engine.addLine(capture.lines.map(engineLineFromTrackLine));
    const preTargetCaptureCollisions = allBodyCollisions(captureEngine, 0, current.startFrame - 1, captureLineIds);
    if (preTargetCaptureCollisions.length > 0) {
      return unavailableConstructionRow(
        input.rowIndex,
        entry,
        "capture_pre_target_collision",
        "capture primitive collided before the current contact",
        started,
        capture,
        { preTargetCaptureCollisions },
      );
    }

    // This endpoint is derived only from the current event and fixed detector
    // persistence. It deliberately cannot see the outgoing interval endpoint.
    const selectionEndFrame = current.endFrame + CAPTURE_EVENT_MAX_OFFSET_FRAMES + PERSISTENCE_FRAMES - 1;
    const selectionDetection = detectWindow(captureEngine, 0, selectionEndFrame);
    const selectionObservation = observeCapture(selectionDetection, current, capture, selectionEndFrame);
    const selected = selectionObservation.selectedOwnedEvent;
    if (selected === null) {
      return unavailableConstructionRow(
        input.rowIndex,
        entry,
        "capture_not_owned_on_time",
        "no owned current-contact event in the fixed selection window",
        started,
        capture,
        { selection: summarizeCapture(selectionDetection, selectionObservation, current.impact) },
      );
    }
    const supportStartFrame = selected.frame + IMPACT_WINDOW + 1;
    const captureOnlyEndFrame = supportStartFrame + 1;
    const captureOnlyDetection = detectWindow(captureEngine, 0, captureOnlyEndFrame);
    const captureOnlyObservation = observeCapture(captureOnlyDetection, current, capture, captureOnlyEndFrame);
    const captureOnlyImpact = captureImpact(captureOnlyDetection, captureOnlyObservation, current.impact);
    const captureOnlyComplete = survivesThroughFrame(captureOnlyDetection, captureOnlyEndFrame) &&
      measurementLastFrame(captureOnlyDetection) >= captureOnlyEndFrame;
    const physicalPrefixTrace = trace(captureEngine, 0, current.startFrame - 1);
    const captureTraceThroughH = trace(captureEngine, current.endFrame, supportStartFrame);
    const captureFullTraceThroughH = trace(captureEngine, 0, supportStartFrame);
    const captureTraceThroughHPlusOne = trace(captureEngine, current.endFrame, captureOnlyEndFrame);
    const currentOnlyFrames = [current.endFrame];
    // The current materialized gap begins at the *previous* authored contact.
    // Protect only the local current-contact selection window; treating that
    // earlier committed event as an unexpected landing would reject every
    // ordinary interval without adding future schedule information.
    const captureSelectionStartFrame = Math.max(0, current.endFrame - CAPTURE_EVENT_MAX_OFFSET_FRAMES);
    const captureOffBeatFrames = offBeatLandingsInWindow(
      captureOnlyDetection,
      currentOnlyFrames,
      captureSelectionStartFrame,
      captureOnlyEndFrame,
    );
    const captureUnresolvedOffBeatFrames = unresolvedOffBeatLandingFramesAtWindowEnd(
      captureOnlyDetection,
      currentOnlyFrames,
      captureSelectionStartFrame,
      captureOnlyEndFrame,
    );
    const responseState = captureOnlyComplete ? extractPlanningState(captureEngine, supportStartFrame) : null;
    const responseStatePlusOne = captureOnlyComplete ? extractPlanningState(captureEngine, captureOnlyEndFrame) : null;
    const responseAnchor = responseState === null ? null : targetFrameFromPlanningState(responseState);
    const namedAtH = responseAnchor === null ? null : namedReferenceState(responseState, responseAnchor.anchorPoint);
    const namedAtHPlusOne = responseAnchor === null
      ? null
      : namedReferenceState(responseStatePlusOne, responseAnchor.anchorPoint);
    const captureStable = sameExactEngineTrace(physicalPrefixTrace, input.baselinePhysicalPrefixTrace) &&
      sameOwnedCaptureEvent(selectionObservation.selectedOwnedEvent, captureOnlyObservation.selectedOwnedEvent) &&
      captureOnlyObservation.persistenceWindowComplete &&
      captureOnlyObservation.responseWindowComplete &&
      captureOffBeatFrames.length === 0 &&
      captureUnresolvedOffBeatFrames.length === 0;
    if (!captureOnlyComplete || !captureStable || responseAnchor === null || namedAtH === null || namedAtHPlusOne === null ||
        captureTraceThroughHPlusOne.fingerprint === null || captureTraceThroughHPlusOne.unavailableAtFrame !== null) {
      return unavailableConstructionRow(
        input.rowIndex,
        entry,
        "capture_comparator_unavailable",
        "capture-only H-to-H+1 comparator is incomplete, drifting, or unreadable",
        started,
        capture,
        {
          selection: summarizeCapture(selectionDetection, selectionObservation, current.impact),
          captureOnly: summarizeCapture(captureOnlyDetection, captureOnlyObservation, current.impact),
          physicalPrefixMatchesBaseline: sameExactEngineTrace(physicalPrefixTrace, input.baselinePhysicalPrefixTrace),
          captureOffBeatFrames,
          captureUnresolvedOffBeatFrames,
          captureTraceThroughHPlusOne,
        },
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
    const sharedCaptureCertificate: ContinuousSupportCurveSharedCaptureCertificate = {
      supportStartFrame,
      captureOnlyCompleteThroughHPlusOne: true,
      captureOnlyTraceStartFrame: current.endFrame,
      captureOnlyTraceEndFrame: captureOnlyEndFrame,
      exactCaptureOnlyTrace: captureTraceThroughHPlusOne,
      namedReferenceStep,
    };
    const phases = CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS.map((phaseLeadSteps) =>
      evaluateConstructionPhase({
        phaseLeadSteps,
        capture,
        captureEngine,
        current,
        baselinePhysicalPrefixTrace: input.baselinePhysicalPrefixTrace,
        captureOnlyObservation,
        captureOnlyImpact,
        captureTraceThroughH,
        captureFullTraceThroughH,
        supportStartFrame,
        responseAnchor,
        namedReferenceStep,
        sharedCaptureCertificate,
      }),
    );
    const selectedCertificate = firstCertifiedContinuousSupportCurvePhase(phases.map((phase) => phase.certificate));
    const selectedPhase = selectedCertificate === null
      ? null
      : phases.find((phase) => phase.phaseLeadSteps === selectedCertificate.phaseLeadSteps) ?? null;
    const report: Record<string, unknown> = {
      rowIndex: input.rowIndex,
      label: entry.label,
      control: entry.control,
      captureStatus: selectedPhase === null ? "no_certified_phase" : "closed",
      capture: summarizeCapture(captureOnlyDetection, captureOnlyObservation, current.impact, {
        supportStartFrame,
        physicalPrefixMatchesBaseline: sameExactEngineTrace(physicalPrefixTrace, input.baselinePhysicalPrefixTrace),
        captureTraceThroughHPlusOne,
        namedReferenceStep: summarizeNamedStep(namedReferenceStep),
      }),
      construction: {
        phaseLeadSteps: CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS,
        phases: phases.map(summarizeConstructionPhase),
        selectedPhaseLeadSteps: selectedPhase?.phaseLeadSteps ?? null,
      },
      elapsedMs: round(performance.now() - started),
    };
    if (selectedPhase === null) return { report, pending: null };
    return {
      report,
      pending: {
        rowIndex: input.rowIndex,
        entry,
        capture,
        captureEngine,
        current,
        baselinePhysicalPrefixTrace: input.baselinePhysicalPrefixTrace,
        captureOnlyObservation,
        captureOnlyImpact,
        captureTraceThroughH,
        captureFullTraceThroughH,
        captureTraceThroughHPlusOne,
        supportStartFrame,
        responseAnchor,
        namedReferenceStep,
        sharedCaptureCertificate,
        constructionPhases: phases,
        selectedPhase,
      },
    };
  } catch (error) {
    return unavailableConstructionRow(input.rowIndex, entry, "construction_error", errorMessage(error), started, capture);
  }
}

function evaluateConstructionPhase(input: {
  phaseLeadSteps: (typeof CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS)[number];
  capture: RealizedContactCaptureArc;
  captureEngine: any;
  current: PostimpactStudyConstructionContext["current"];
  baselinePhysicalPrefixTrace: ExactTraceFingerprint;
  captureOnlyObservation: OwnedContactObservation;
  captureOnlyImpact: ReturnType<typeof scoredContactImpact>;
  captureTraceThroughH: ExactTraceFingerprint;
  captureFullTraceThroughH: ExactTraceFingerprint;
  supportStartFrame: number;
  responseAnchor: ReturnType<typeof targetFrameFromPlanningState>;
  namedReferenceStep: ReturnType<typeof makePostimpactNamedReferenceStep>;
  sharedCaptureCertificate: ContinuousSupportCurveSharedCaptureCertificate;
}): ConstructionPhaseRecord {
  const actions = CONTINUOUS_SUPPORT_CURVE_ACTIONS.map((action) => evaluateConstructionAction({ ...input, action }));
  const certificate = certifyContinuousSupportCurvePhase(
    input.phaseLeadSteps,
    actions.map((action) => ({
      action: { id: action.action.id },
      status: action.status,
      constructionSafe: action.constructionSafe,
      expectedCollisionRejection: action.expectedCollisionRejection,
      protocolInvalid: action.protocolInvalid,
    })),
    input.sharedCaptureCertificate,
  );
  return { phaseLeadSteps: input.phaseLeadSteps, certificate, actions };
}

function evaluateConstructionAction(input: {
  phaseLeadSteps: (typeof CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS)[number];
  action: ContinuousSupportCurveAction;
  capture: RealizedContactCaptureArc;
  captureEngine: any;
  current: PostimpactStudyConstructionContext["current"];
  baselinePhysicalPrefixTrace: ExactTraceFingerprint;
  captureOnlyObservation: OwnedContactObservation;
  captureOnlyImpact: ReturnType<typeof scoredContactImpact>;
  captureTraceThroughH: ExactTraceFingerprint;
  captureFullTraceThroughH: ExactTraceFingerprint;
  supportStartFrame: number;
  responseAnchor: ReturnType<typeof targetFrameFromPlanningState>;
  namedReferenceStep: ReturnType<typeof makePostimpactNamedReferenceStep>;
  sharedCaptureCertificate: ContinuousSupportCurveSharedCaptureCertificate;
}): ConstructionActionRecord {
  const started = performance.now();
  try {
    const curveStart = input.capture.lines.at(-1)!.id + 1;
    const curve = realizeContinuousSupportCurve({
      anchor: input.responseAnchor,
      captureOnlyNamedReferenceStep: input.namedReferenceStep,
      phaseLeadSteps: input.phaseLeadSteps,
    }, input.action, curveStart);
    postimpactLineIdRange(curveStart, curve.lines.length);
    const curveIds = new Set(curve.lines.map((line) => line.id));
    const engine = input.captureEngine.addLine(curve.lines.map(engineLineFromTrackLine));
    const detection = detectWindow(engine, 0, input.supportStartFrame);
    const observation = observeCapture(detection, input.current, input.capture, input.supportStartFrame);
    const impact = captureImpact(detection, observation, input.current.impact);
    const preOrAtHCurveCollisions = allBodyCollisions(engine, 0, input.supportStartFrame, curveIds);
    const firstCurveCollisionFrame = firstCollisionFrame(preOrAtHCurveCollisions);
    const traceMatchesBeforeFirstSupportCollision = firstCurveCollisionFrame === null
      ? sameExactEngineTrace(trace(engine, 0, input.supportStartFrame), input.captureFullTraceThroughH)
      : sameExactEngineTrace(
        trace(engine, 0, firstCurveCollisionFrame - 1),
        trace(input.captureEngine, 0, firstCurveCollisionFrame - 1),
      );
    const verdict = classifyPostimpactConstructionProbe({
      physicalPrefixMatchesBaseline: sameExactEngineTrace(trace(engine, 0, input.current.startFrame - 1), input.baselinePhysicalPrefixTrace),
      // These are immutable capture-only facts. Candidate survival remains a
      // separate guard below, so a causally attributable at-H collision is an
      // expected phase rejection rather than a false comparator failure.
      captureOnlyPreHComplete: input.sharedCaptureCertificate.captureOnlyCompleteThroughHPlusOne,
      captureOnlyPreHTraceAvailable: input.sharedCaptureCertificate.exactCaptureOnlyTrace.fingerprint !== null &&
        input.sharedCaptureCertificate.exactCaptureOnlyTrace.unavailableAtFrame === null,
      captureTraceMatchesComparator: sameExactEngineTrace(trace(engine, input.current.endFrame, input.supportStartFrame), input.captureTraceThroughH),
      traceMatchesBeforeFirstSupportCollision,
      selectedCaptureEventMatchesComparator: sameOwnedCaptureEvent(observation.selectedOwnedEvent, input.captureOnlyObservation.selectedOwnedEvent),
      impactMatchesComparator: sameScoredContactImpact(impact, input.captureOnlyImpact),
      survivesThroughH: survivesThroughFrame(detection, input.supportStartFrame) && measurementLastFrame(detection) >= input.supportStartFrame,
      preOrAtHSupportCollisionCount: preOrAtHCurveCollisions.length,
    });
    return {
      action: input.action,
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
      action: input.action,
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

function measureRow(row: ConstructionRow, observation: { outgoing: { endFrame: number }; authoredContactFrames: readonly number[] }): ConstructionRow {
  if (row.pending === null) return row;
  const pending = row.pending;
  const horizon = postimpactMeasurementHorizon(observation.outgoing.endFrame, pending.supportStartFrame);
  if (horizon.status !== "ready") {
    return {
      report: { ...row.report, measurement: { status: "horizon_unavailable", horizon } },
      pending: null,
    };
  }
  const actionEndFrame = pending.supportStartFrame + horizon.measurementHorizonFrames;
  const captureMeasurement = measureCaptureOnly(pending, actionEndFrame, observation.authoredContactFrames);
  if (captureMeasurement === null) {
    return {
      report: { ...row.report, measurement: { status: "capture_only_comparator_unavailable", horizon } },
      pending: null,
    };
  }
  const nominal = CONTINUOUS_SUPPORT_CURVE_ACTIONS.map((action) =>
    measureArm(pending, action, actionEndFrame, observation.authoredContactFrames, captureMeasurement, 1),
  );
  const neutral = nominal.find((arm) => arm.action.id === "curve-neutral") ?? null;
  const withCausal = nominal.map((arm) => ({
    ...arm,
    causalExposure: classifyArmCausalExposure(arm, neutral, pending, actionEndFrame),
  }));
  const matchedNeutralContext = {
    phaseLeadSteps: pending.selectedPhase.phaseLeadSteps,
    measurementStartFrame: pending.supportStartFrame,
    measurementEndFrame: actionEndFrame,
    captureComparatorFingerprint: pending.captureTraceThroughHPlusOne.fingerprint!,
  };
  const contrast = summarizeContinuousSupportCurveMatchedNeutralContrast(withCausal.map((arm) => ({
    action: { id: arm.action.id },
    structurallyValid: arm.structurallyValid,
    terminalHeadingDeg: arm.window?.terminal.headingDeg ?? null,
    matchedNeutralContext,
    causalExposure: arm.causalExposure!,
  })));
  // The doubled realization happens only after the nominal selected phase has
  // been fixed. It is emitted for convergence evidence, never read above.
  const doubled = CONTINUOUS_SUPPORT_CURVE_ACTIONS.map((action) =>
    measureArm(pending, action, actionEndFrame, observation.authoredContactFrames, captureMeasurement, 2),
  );
  const resolutionDiagnostic = withCausal.map((arm) => {
    const double = doubled.find((candidate) => candidate.action.id === arm.action.id)!;
    return summarizeResolutionComparison(arm, double);
  });
  return {
    report: {
      ...row.report,
      measurement: {
        status: "complete",
        horizon,
        captureOnly: summarizeCaptureMeasurement(captureMeasurement),
        nominalActions: withCausal.map((arm) => summarizeMeasuredArm(arm, captureMeasurement)),
        matchedNeutralContrast: contrast,
        resolutionDiagnostic,
      },
    },
    pending: null,
  };
}

function measureCaptureOnly(
  pending: PendingCapture,
  actionEndFrame: number,
  authoredContactFrames: readonly number[],
): CaptureMeasurement | null {
  const detection = detectWindow(pending.captureEngine, 0, actionEndFrame);
  const observation = observeCapture(detection, pending.current, pending.capture, actionEndFrame);
  const impact = captureImpact(detection, observation, pending.current.impact);
  const complete = survivesThroughFrame(detection, actionEndFrame) && measurementLastFrame(detection) >= actionEndFrame;
  const offBeatFrames = offBeatLandingsInWindow(detection, [...authoredContactFrames], pending.supportStartFrame, actionEndFrame);
  const unresolvedOffBeatFrames = unresolvedOffBeatLandingFramesAtWindowEnd(
    detection,
    [...authoredContactFrames],
    pending.supportStartFrame,
    actionEndFrame,
  );
  const window = complete ? measureCoMWindow(detection, pending.supportStartFrame, actionEndFrame) : null;
  const terminalState = window === null ? null : extractPlanningState(pending.captureEngine, actionEndFrame);
  const terminalReference = terminalState === null ? null : namedReferenceState(terminalState, pending.responseAnchor.anchorPoint);
  const traceThroughH = trace(pending.captureEngine, pending.current.endFrame, pending.supportStartFrame);
  const stable = sameExactEngineTrace(traceThroughH, pending.captureTraceThroughH) &&
    sameOwnedCaptureEvent(observation.selectedOwnedEvent, pending.captureOnlyObservation.selectedOwnedEvent) &&
    sameScoredContactImpact(impact, pending.captureOnlyImpact) &&
    offBeatFrames.length === 0 && unresolvedOffBeatFrames.length === 0;
  return stable && complete && window !== null && terminalReference !== null
    ? { detection, observation, impact, traceThroughH, complete, window, terminalReference, offBeatFrames, unresolvedOffBeatFrames }
    : null;
}

function measureArm(
  pending: PendingCapture,
  action: ContinuousSupportCurveAction,
  actionEndFrame: number,
  authoredContactFrames: readonly number[],
  captureMeasurement: CaptureMeasurement,
  resolutionMultiplier: 1 | 2,
): MeasuredArm {
  const started = performance.now();
  try {
    const curveStart = pending.capture.lines.at(-1)!.id + 1;
    const input = {
      anchor: pending.responseAnchor,
      captureOnlyNamedReferenceStep: pending.namedReferenceStep,
      phaseLeadSteps: pending.selectedPhase.phaseLeadSteps,
    };
    const curve = resolutionMultiplier === 1
      ? realizeContinuousSupportCurve(input, action, curveStart)
      : realizeContinuousSupportCurveAtResolution(input, action, curveStart, 2);
    postimpactLineIdRange(curveStart, curve.lines.length);
    const curveIds = new Set(curve.lines.map((line) => line.id));
    const captureIds = new Set(pending.capture.lines.map((line) => line.id));
    const curveLineIdsDisjointFromCapture = [...curveIds].every((id) => !captureIds.has(id));
    const engine = pending.captureEngine.addLine(curve.lines.map(engineLineFromTrackLine));
    const detection = detectWindow(engine, 0, actionEndFrame);
    const captureObservation = observeCapture(detection, pending.current, pending.capture, actionEndFrame);
    const impact = captureImpact(detection, captureObservation, pending.current.impact);
    const preOrAtHCurveCollisions = allBodyCollisions(engine, 0, pending.supportStartFrame, curveIds);
    const curveCollisions = allBodyCollisions(engine, 0, actionEndFrame, curveIds);
    const firstCurveCollision = firstCollisionFrame(curveCollisions);
    const traceMatchesBeforeFirstSupportCollision = firstCurveCollision === null
      ? sameExactEngineTrace(trace(engine, 0, pending.supportStartFrame), pending.captureFullTraceThroughH)
      : sameExactEngineTrace(
        trace(engine, 0, firstCurveCollision - 1),
        trace(pending.captureEngine, 0, firstCurveCollision - 1),
      );
    const physicalPrefixMatchesBaseline = sameExactEngineTrace(
      trace(engine, 0, pending.current.startFrame - 1),
      pending.baselinePhysicalPrefixTrace,
    );
    const captureTraceMatchesComparator = sameExactEngineTrace(
      trace(engine, pending.current.endFrame, pending.supportStartFrame),
      pending.captureTraceThroughH,
    );
    const selectedCaptureEventMatchesComparator = sameOwnedCaptureEvent(
      captureObservation.selectedOwnedEvent,
      pending.captureOnlyObservation.selectedOwnedEvent,
    );
    const impactMatchesComparator = sameScoredContactImpact(impact, pending.captureOnlyImpact);
    const complete = survivesThroughFrame(detection, actionEndFrame) && measurementLastFrame(detection) >= actionEndFrame;
    const offBeatFrames = offBeatLandingsInWindow(detection, [...authoredContactFrames], pending.supportStartFrame, actionEndFrame);
    const unresolvedOffBeatFrames = unresolvedOffBeatLandingFramesAtWindowEnd(
      detection,
      [...authoredContactFrames],
      pending.supportStartFrame,
      actionEndFrame,
    );
    const window = complete ? measureCoMWindow(detection, pending.supportStartFrame, actionEndFrame) : null;
    const terminalState = window === null ? null : extractPlanningState(engine, actionEndFrame);
    const terminalReference = terminalState === null ? null : namedReferenceState(terminalState, pending.responseAnchor.anchorPoint);
    const constructionSafe = pending.selectedPhase.certificate.status === "certified" &&
      preOrAtHCurveCollisions.length === 0 && physicalPrefixMatchesBaseline && captureTraceMatchesComparator &&
      selectedCaptureEventMatchesComparator && impactMatchesComparator && traceMatchesBeforeFirstSupportCollision &&
      curveLineIdsDisjointFromCapture;
    const structurallyValid = constructionSafe && complete && window !== null && terminalReference !== null &&
      offBeatFrames.length === 0 && unresolvedOffBeatFrames.length === 0;
    return {
      action,
      status: "observed",
      reason: null,
      curve,
      constructionSafe,
      structurallyValid,
      physicalPrefixMatchesBaseline,
      captureTraceMatchesComparator,
      selectedCaptureEventMatchesComparator,
      impactMatchesComparator,
      traceMatchesBeforeFirstSupportCollision,
      curveLineIdsDisjointFromCapture,
      preOrAtHCurveCollisions,
      curveCollisions,
      offBeatFrames,
      unresolvedOffBeatFrames,
      window,
      terminalReference,
      causalExposure: null,
      elapsedMs: round(performance.now() - started),
    };
  } catch (error) {
    return failedMeasuredArm(action, errorMessage(error), started);
  }
}

function classifyArmCausalExposure(
  arm: MeasuredArm,
  neutral: MeasuredArm | null,
  pending: PendingCapture,
  measurementEndFrame: number,
): ContinuousSupportCurveCausalExposure {
  const actionSegments = arm.curve?.segments.map((segment, segmentIndex) => ({
    lineId: segment.lineId,
    segmentIndex,
    tangentDeg: segment.tangentDeg,
  })) ?? [];
  const neutralSegments = neutral?.curve?.segments.map((segment, segmentIndex) => ({
    lineId: segment.lineId,
    segmentIndex,
    tangentDeg: segment.tangentDeg,
  })) ?? [];
  return classifyContinuousSupportCurveCausalExposure({
    action: { id: arm.action.id },
    supportStartFrame: pending.supportStartFrame,
    constructionSafe: arm.constructionSafe,
    structurallyValid: arm.structurallyValid,
    physicalPrefixMatchesBaseline: arm.physicalPrefixMatchesBaseline,
    captureTraceMatchesComparator: arm.captureTraceMatchesComparator,
    selectedCaptureEventMatchesComparator: arm.selectedCaptureEventMatchesComparator,
    impactMatchesComparator: arm.impactMatchesComparator,
    traceMatchesBeforeFirstSupportCollision: arm.traceMatchesBeforeFirstSupportCollision,
    curveLineIdsDisjointFromCapture: arm.curveLineIdsDisjointFromCapture,
    measurementEndFrame,
    actionSegments,
    neutralSegments,
    curveCollisions: arm.curveCollisions,
  });
}

function failedMeasuredArm(action: ContinuousSupportCurveAction, reason: string, started: number): MeasuredArm {
  return {
    action,
    status: "error",
    reason,
    curve: null,
    constructionSafe: false,
    structurallyValid: false,
    physicalPrefixMatchesBaseline: false,
    captureTraceMatchesComparator: false,
    selectedCaptureEventMatchesComparator: false,
    impactMatchesComparator: false,
    traceMatchesBeforeFirstSupportCollision: false,
    curveLineIdsDisjointFromCapture: false,
    preOrAtHCurveCollisions: [],
    curveCollisions: [],
    offBeatFrames: [],
    unresolvedOffBeatFrames: [],
    window: null,
    terminalReference: null,
    causalExposure: null,
    elapsedMs: round(performance.now() - started),
  };
}

function unavailableConstructionRow(
  rowIndex: number,
  entry: ContactCaptureArcDesignEntry,
  captureStatus: string,
  reason: string,
  started: number,
  capture: RealizedContactCaptureArc | null = null,
  extra: Record<string, unknown> = {},
): ConstructionRow {
  return {
    report: {
      rowIndex,
      label: entry.label,
      control: entry.control,
      captureStatus,
      reason,
      capture: capture === null ? null : summarizeCaptureGeometry(capture),
      construction: { phases: [], selectedPhaseLeadSteps: null },
      elapsedMs: round(performance.now() - started),
      ...extra,
    },
    pending: null,
  };
}

function observeCapture(
  detection: ReturnType<typeof detectWindow>,
  current: PostimpactStudyConstructionContext["current"],
  capture: RealizedContactCaptureArc,
  endFrame: number,
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
    responseOffsetFrames: IMPACT_WINDOW,
  });
}

function captureImpact(
  detection: ReturnType<typeof detectWindow>,
  observation: OwnedContactObservation,
  impactTarget: number,
): ReturnType<typeof scoredContactImpact> {
  return scoredContactImpact(detection, {
    target: impactTarget,
    landingFrame: observation.selectedOwnedEvent?.frame ?? null,
    responseWindowComplete: observation.responseWindowComplete,
  });
}

function allBodyCollisions(engine: any, startFrame: number, endFrame: number, lineIds: ReadonlySet<number>): EngineCollisionHit[] {
  if (endFrame < startFrame) return [];
  const hits: EngineCollisionHit[] = [];
  for (let frame = startFrame; frame <= endFrame; frame++) {
    const frameHits = engineCollisionHitsForLineIds(engine, frame, lineIds);
    if (frameHits.some((hit) => hit.pointIds.length === 0)) {
      throw new Error("curve/capture collision telemetry lacked all-body point attribution");
    }
    hits.push(...frameHits);
  }
  return hits;
}

function firstCollisionFrame(collisions: readonly EngineCollisionHit[]): number | null {
  return collisions.length === 0 ? null : Math.min(...collisions.map((hit) => hit.frame));
}

function trace(engine: any, startFrame: number, endFrame: number): ExactTraceFingerprint {
  return endFrame < startFrame ? emptyEngineStateTraceFingerprint() : exactEngineStateTraceFingerprint(engine, startFrame, endFrame);
}

function summarizeConstructionPhase(phase: ConstructionPhaseRecord) {
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

function summarizeMeasuredArm(arm: MeasuredArm, captureOnly: CaptureMeasurement) {
  return {
    action: arm.action,
    status: arm.status,
    reason: arm.reason,
    curve: arm.curve === null ? null : summarizeCurve(arm.curve),
    constructionSafe: arm.constructionSafe,
    structurallyValid: arm.structurallyValid,
    guards: {
      physicalPrefixMatchesBaseline: arm.physicalPrefixMatchesBaseline,
      captureTraceMatchesComparator: arm.captureTraceMatchesComparator,
      selectedCaptureEventMatchesComparator: arm.selectedCaptureEventMatchesComparator,
      impactMatchesComparator: arm.impactMatchesComparator,
      traceMatchesBeforeFirstSupportCollision: arm.traceMatchesBeforeFirstSupportCollision,
      curveLineIdsDisjointFromCapture: arm.curveLineIdsDisjointFromCapture,
    },
    preOrAtHCurveCollisions: arm.preOrAtHCurveCollisions,
    curveCollisions: arm.curveCollisions,
    offBeatFrames: arm.offBeatFrames,
    unresolvedOffBeatFrames: arm.unresolvedOffBeatFrames,
    window: arm.window === null ? null : summarizeWindow(arm.window),
    terminalReference: arm.terminalReference === null ? null : summarizeReference(arm.terminalReference),
    effectFromCaptureOnly: arm.window === null || arm.terminalReference === null ||
        captureOnly.window === null || captureOnly.terminalReference === null ? null : {
      coMHeadingDeltaDeg: round(signedAngleDeltaDeg(captureOnly.window.terminal.headingDeg, arm.window.terminal.headingDeg)),
      namedReferenceHeadingDeltaDeg: round(signedAngleDeltaDeg(
        captureOnly.terminalReference.headingDeg,
        arm.terminalReference.headingDeg,
      )),
      airFractionDelta: round(arm.window.airFraction - captureOnly.window.airFraction),
      meanSpeedAuthoredDelta: round(arm.window.meanSpeedAuthored - captureOnly.window.meanSpeedAuthored),
    },
    causalExposure: arm.causalExposure,
    elapsedMs: arm.elapsedMs,
  };
}

function summarizeResolutionComparison(nominal: MeasuredArm, doubled: MeasuredArm) {
  const both = nominal.window !== null && doubled.window !== null;
  return {
    actionId: nominal.action.id,
    nominal: summarizeResolutionArm(nominal),
    doubled: summarizeResolutionArm(doubled),
    diagnosticOnly: true,
    deltaDoubledMinusNominal: !both ? null : {
      terminalCoMHeadingDeg: round(signedAngleDeltaDeg(nominal.window!.terminal.headingDeg, doubled.window!.terminal.headingDeg)),
      airFraction: round(doubled.window!.airFraction - nominal.window!.airFraction),
      meanSpeedAuthored: round(doubled.window!.meanSpeedAuthored - nominal.window!.meanSpeedAuthored),
    },
  };
}

function summarizeResolutionArm(arm: MeasuredArm) {
  return {
    status: arm.status,
    structurallyValid: arm.structurallyValid,
    curveResolution: arm.curve?.resolution ?? null,
    terminal: arm.window === null ? null : {
      headingDeg: round(arm.window.terminal.headingDeg),
      airFraction: round(arm.window.airFraction),
      meanSpeedAuthored: round(arm.window.meanSpeedAuthored),
    },
  };
}

function summarizeCaptureMeasurement(value: CaptureMeasurement) {
  return {
    complete: value.complete,
    observation: {
      selectedOwnedEvent: value.observation.selectedOwnedEvent,
      impact: value.impact,
    },
    traceThroughH: value.traceThroughH,
    window: value.window === null ? null : summarizeWindow(value.window),
    terminalReference: value.terminalReference === null ? null : summarizeReference(value.terminalReference),
    offBeatFrames: value.offBeatFrames,
    unresolvedOffBeatFrames: value.unresolvedOffBeatFrames,
  };
}

function summarizeCapture(
  detection: ReturnType<typeof detectWindow>,
  observation: OwnedContactObservation,
  impactTarget: number,
  extra: Record<string, unknown> = {},
) {
  return {
    geometry: null,
    selectedOwnedEvent: observation.selectedOwnedEvent,
    persistenceWindowComplete: observation.persistenceWindowComplete,
    responseWindowComplete: observation.responseWindowComplete,
    impact: captureImpact(detection, observation, impactTarget),
    terminus: detection.terminus,
    ...extra,
  };
}

function summarizeCaptureGeometry(capture: RealizedContactCaptureArc) {
  return {
    lineCount: capture.lines.length,
    lineIds: capture.lines.map((line) => line.id),
    responseHorizonFrames: capture.responseHorizonFrames,
    entryAngleDeg: round(capture.entryAngleDeg),
    exitAngleDeg: round(capture.exitAngleDeg),
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
    segments: curve.segments.map((segment, index) => ({
      lineId: segment.lineId,
      segmentIndex: index,
      tangentDeg: round(segment.tangentDeg),
      startArcFraction: segment.startArcFraction,
      endArcFraction: segment.endArcFraction,
    })),
  };
}

function summarizeNamedStep(step: ReturnType<typeof makePostimpactNamedReferenceStep>) {
  return {
    anchorPoint: step.anchorPoint,
    fromFrame: step.fromFrame,
    toFrame: step.toFrame,
    exactCaptureOnlyTraceFingerprint: step.exactCaptureOnlyTraceFingerprint,
  };
}

function summarizeWindow(window: NonNullable<ReturnType<typeof measureCoMWindow>>) {
  return {
    startFrame: window.startFrame,
    endFrame: window.endFrame,
    measurementSamples: window.measurementSamples,
    airFraction: round(window.airFraction),
    meanSpeedAuthored: round(window.meanSpeedAuthored),
    terminalHeadingDeg: round(window.terminal.headingDeg),
  };
}

function summarizeReference(reference: NonNullable<ReturnType<typeof namedReferenceState>>) {
  return {
    point: reference.point,
    position: { x: round(reference.position.x), y: round(reference.position.y) },
    speedPxPerFrame: round(reference.speedPxPerFrame),
    headingDeg: round(reference.headingDeg),
  };
}

type AssaySummary = {
  level: "single_fixture";
  captureRows: number;
  captureStatusCounts: Record<string, number>;
  selectedCertifiedPhaseRows: number;
  constructionPhaseAttempts: number;
  constructionProbeActions: number;
  constructionProbeErrors: number;
  invalidConstructionProbeActions: number;
  measurementStatusCounts: Record<string, number>;
  completeMeasurementRows: number;
  completePairedRows: number;
  measuredNominalArmAttempts: number;
  structurallyValidNominalArms: number;
  nominalArmErrors: number;
  matchedNeutralDirectionalContrastRows: number;
  monotoneMatchedNeutralDirectionalContrastRows: number;
  minimumContrastMatchedNeutralDirectionalContrastRows: number;
  resolutionDiagnosticActionErrors: number;
  orientationEvidence: {
    selectedRowsWithNeutralGeometry: number;
    referenceStepToAnchorSpeedRatio: NumericCoverage;
    entryTangentProjectionToReferenceStepRatio: NumericCoverage;
    entryActiveNormalProjectionToReferenceStepRatio: NumericCoverage;
    entryActiveNormalContinuityDot: NumericCoverage;
  };
  rowErrors: number;
  interpretation: string;
};

type NumericCoverage = {
  observations: number;
  minimum: number | null;
  median: number | null;
  maximum: number | null;
};

type AssayStatus = {
  protocolStatus:
    | "invalid_identity_drift"
    | "invalid_runtime_error"
    | "invalid_construction_phase_probe"
    | "complete_without_eligible_evidence"
    | "complete_with_descriptive_rows";
  executionComplete: boolean;
  descriptiveLocalClaimEligible: boolean;
  claimEligibility: string;
};

function summarizeFixture(rows: readonly ConstructionRow[]): AssaySummary {
  const reports = rows.map((row) => row.report);
  const captureStatusCounts = countRecordValues(reports.map((report) => stringField(report, "captureStatus")));
  const measurements = reports.map((report) => recordField(report, "measurement")).filter(isRecord);
  const measurementStatusCounts = countRecordValues(measurements.map((measurement) => stringField(measurement, "status")));
  const phases = reports.flatMap((report) => recordArray(recordField(report, "construction"), "phases"));
  const constructionActions = phases.flatMap((phase) => recordArray(phase, "actions"));
  const nominalArms = measurements.flatMap((measurement) => recordArray(measurement, "nominalActions"));
  const completeMeasurements = measurements.filter((measurement) => measurement.status === "complete");
  const completePairedRows = completeMeasurements.filter((measurement) =>
    recordArray(measurement, "nominalActions").length === CONTINUOUS_SUPPORT_CURVE_ACTIONS.length &&
    recordArray(measurement, "nominalActions").every((arm) => arm.structurallyValid === true)
  );
  const directionalContrasts = completeMeasurements.map((measurement) => recordField(measurement, "matchedNeutralContrast"));
  const selectedNeutralCurves = reports.flatMap(selectedNeutralCurve);
  return {
    level: "single_fixture",
    captureRows: rows.length,
    captureStatusCounts,
    selectedCertifiedPhaseRows: captureStatusCounts.closed ?? 0,
    constructionPhaseAttempts: phases.length,
    constructionProbeActions: constructionActions.length,
    constructionProbeErrors: constructionActions.filter((action) => action.status === "error").length,
    invalidConstructionProbeActions: constructionActions.filter((action) => action.protocolInvalid === true).length,
    measurementStatusCounts,
    completeMeasurementRows: completeMeasurements.length,
    completePairedRows: completePairedRows.length,
    measuredNominalArmAttempts: nominalArms.length,
    structurallyValidNominalArms: nominalArms.filter((arm) => arm.structurallyValid === true).length,
    nominalArmErrors: nominalArms.filter((arm) => arm.status === "error").length,
    matchedNeutralDirectionalContrastRows: directionalContrasts.filter((contrast) => contrast?.available === true).length,
    monotoneMatchedNeutralDirectionalContrastRows: directionalContrasts.filter((contrast) =>
      contrast?.available === true && contrast.monotone === true
    ).length,
    minimumContrastMatchedNeutralDirectionalContrastRows: directionalContrasts.filter((contrast) =>
      contrast?.available === true && contrast.meetsMinimumContrast === true
    ).length,
    resolutionDiagnosticActionErrors: completeMeasurements.flatMap((measurement) => recordArray(measurement, "resolutionDiagnostic"))
      .flatMap((diagnostic) => [recordField(diagnostic, "nominal"), recordField(diagnostic, "doubled")])
      .filter((arm) => arm?.status === "error").length,
    orientationEvidence: {
      selectedRowsWithNeutralGeometry: selectedNeutralCurves.length,
      referenceStepToAnchorSpeedRatio: summarizeNumericCoverage(selectedNeutralCurves.map((curve) =>
        numericField(recordField(curve, "referenceStep"), "referenceStepToAnchorSpeedRatio")
      )),
      entryTangentProjectionToReferenceStepRatio: summarizeNumericCoverage(selectedNeutralCurves.map((curve) =>
        numericField(recordField(curve, "referenceStep"), "entryTangentProjectionToReferenceStepRatio")
      )),
      entryActiveNormalProjectionToReferenceStepRatio: summarizeNumericCoverage(selectedNeutralCurves.map((curve) =>
        numericField(recordField(curve, "referenceStep"), "entryActiveNormalProjectionToReferenceStepRatio")
      )),
      entryActiveNormalContinuityDot: summarizeNumericCoverage(selectedNeutralCurves.map((curve) =>
        numericField(curve, "entryActiveNormalContinuityDot")
      )),
    },
    rowErrors: reports.filter((report) => stringField(report, "captureStatus")?.endsWith("_error") === true).length +
      constructionActions.filter((action) => action.status === "error").length +
      nominalArms.filter((arm) => arm.status === "error").length,
    interpretation: "Construction phases are target-blind feasibility probes. Complete five-arm rows are correlated alternatives on one frozen fixture; no count is an independent sample, compiler-performance result, or rollout decision.",
  };
}

function classifyAssayStatus(identityStable: boolean, summary: AssaySummary): AssayStatus {
  if (!identityStable) {
    return {
      protocolStatus: "invalid_identity_drift",
      executionComplete: false,
      descriptiveLocalClaimEligible: false,
      claimEligibility: "invalid: runner source or observed compiler identity changed during replay",
    };
  }
  if (summary.rowErrors > 0) {
    return {
      protocolStatus: "invalid_runtime_error",
      executionComplete: false,
      descriptiveLocalClaimEligible: false,
      claimEligibility: "invalid: one or more capture, construction, or nominal-arm replays raised a runtime error",
    };
  }
  if (summary.invalidConstructionProbeActions > 0) {
    return {
      protocolStatus: "invalid_construction_phase_probe",
      executionComplete: false,
      descriptiveLocalClaimEligible: false,
      claimEligibility: "invalid: a construction probe changed a protected comparator without an attributable at-or-before-H support collision",
    };
  }
  if (summary.completePairedRows === 0) {
    return {
      protocolStatus: "complete_without_eligible_evidence",
      executionComplete: true,
      descriptiveLocalClaimEligible: false,
      claimEligibility: "unavailable: no row completed the declared five-arm structural measurement contract",
    };
  }
  return {
    protocolStatus: "complete_with_descriptive_rows",
    executionComplete: true,
    descriptiveLocalClaimEligible: true,
    claimEligibility: "eligible only for descriptive local response on this frozen fixture; rows are correlated and cannot select a compiler behavior or establish rollout feasibility",
  };
}

function selectedNeutralCurve(report: Record<string, unknown>): Record<string, unknown>[] {
  const construction = recordField(report, "construction");
  const selectedPhaseLeadSteps = numericField(construction, "selectedPhaseLeadSteps");
  if (selectedPhaseLeadSteps === null) return [];
  const phase = recordArray(construction, "phases").find((candidate) =>
    numericField(candidate, "phaseLeadSteps") === selectedPhaseLeadSteps
  );
  const neutral = phase === undefined ? undefined : recordArray(phase, "actions").find((action) =>
    recordField(action, "action")?.id === "curve-neutral"
  );
  const curve = neutral === undefined ? null : recordField(neutral, "curve");
  return curve === null ? [] : [curve];
}

function countRecordValues(values: readonly (string | null)[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = value ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function summarizeNumericCoverage(values: readonly (number | null)[]): NumericCoverage {
  const observed = values.filter((value): value is number => value !== null && Number.isFinite(value)).sort((left, right) => left - right);
  if (observed.length === 0) return { observations: 0, minimum: null, median: null, maximum: null };
  const middle = Math.floor(observed.length / 2);
  const median = observed.length % 2 === 1
    ? observed[middle]!
    : (observed[middle - 1]! + observed[middle]!) / 2;
  return {
    observations: observed.length,
    minimum: round(observed[0]!),
    median: round(median),
    maximum: round(observed.at(-1)!),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function recordField(record: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  const value = record?.[key];
  return isRecord(value) ? value : null;
}

function recordArray(record: Record<string, unknown> | null, key: string): Record<string, unknown>[] {
  const value = record?.[key];
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function numericField(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function signedAngleDeltaDeg(fromDeg: number, toDeg: number): number {
  let delta = (toDeg - fromDeg) % 360;
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  return delta;
}

function sourceIdentity(entryPath: string): { sourceFiles: string[]; fingerprint: string } {
  const cwd = process.cwd();
  const pending = [normalizePath(entryPath, cwd)];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const path = pending.pop()!;
    if (visited.has(path)) continue;
    visited.add(path);
    const source = readFileSync(resolve(cwd, path), "utf8");
    const imports = ts.preProcessFile(source, true, true).importedFiles.map((entry) => entry.fileName);
    for (const specifier of imports) {
      const dependency = resolveLocalTypeScriptModule(path, specifier, cwd);
      if (dependency !== null && !visited.has(dependency)) pending.push(dependency);
    }
  }
  const sourceFiles = [...visited].sort();
  const hash = createHash("sha256");
  for (const path of sourceFiles) {
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(resolve(cwd, path)));
    hash.update("\0");
  }
  return { sourceFiles, fingerprint: hash.digest("hex") };
}

function observedCompilerIdentity() {
  const compilerPaths = [
    "scripts/v0/optimizer",
    "scripts/v0/core",
    "scripts/v0/types.ts",
    "scripts/v0/arc.ts",
    "scripts/v0/arc_placement.ts",
    "scripts/v0/score.ts",
    "scripts/lib",
    "engine-rs",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
  ];
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const diff = execFileSync("git", ["diff", "--binary", "HEAD", "--", ...compilerPaths], { encoding: "utf8" });
  const untrackedSourceFiles = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z", "--", ...compilerPaths],
    { encoding: "utf8" },
  ).split("\0").filter(Boolean).sort();
  const untrackedHash = createHash("sha256");
  for (const path of untrackedSourceFiles) {
    untrackedHash.update(path);
    untrackedHash.update("\0");
    untrackedHash.update(readFileSync(path));
    untrackedHash.update("\0");
  }
  const untrackedCompilerSourceSha256 = untrackedHash.digest("hex");
  const engineArtifactPath = process.env.LR_ENGINE === undefined || process.env.LR_ENGINE === "wasm"
    ? "engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm"
    : null;
  const engineArtifactFingerprint = engineArtifactPath !== null && existsSync(engineArtifactPath)
    ? sha256(readFileSync(engineArtifactPath))
    : null;
  const fingerprint = sha256(stableJson({
    head,
    compilerDiffSha256: sha256(diff),
    untrackedCompilerSourceSha256,
    untrackedSourceFiles,
    engine: process.env.LR_ENGINE ?? "wasm",
    engineArtifactFingerprint,
    relevantEnvironment: Object.fromEntries(Object.entries(process.env)
      .filter(([name, value]) => name.startsWith("LR_") && value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))),
  }));
  return {
    head,
    compilerDiffSha256: sha256(diff),
    untrackedCompilerSourceSha256,
    untrackedSourceFiles,
    engineArtifactFingerprint,
    fingerprint,
  };
}

function resolveLocalTypeScriptModule(fromPath: string, specifier: string, cwd: string): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) return null;
  const base = specifier.startsWith("/")
    ? resolve(cwd, `.${specifier}`)
    : resolve(dirname(resolve(cwd, fromPath)), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")]) {
    if (existsSync(candidate)) return normalizePath(candidate, cwd);
  }
  throw new Error(`cannot resolve local source dependency ${specifier} from ${fromPath}`);
}

function normalizePath(path: string, cwd: string): string {
  const normalized = relative(cwd, resolve(cwd, path));
  if (normalized.startsWith("..") || normalized === "") throw new Error(`study source must be inside workspace: ${path}`);
  return normalized.replaceAll("\\", "/");
}

function writeImmutableJson(path: string, payload: unknown): void {
  if (existsSync(path)) throw new Error(`refusing to overwrite existing immutable study artifact ${path}`);
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true });
  const temporary = resolve(directory, `.${basename(path)}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx" });
    fsyncPath(temporary);
    linkSync(temporary, path);
    fsyncPath(directory);
  } catch (error: any) {
    if (error?.code === "EEXIST") throw new Error(`refusing to overwrite existing immutable study artifact ${path}`);
    throw error;
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function fsyncPath(path: string): void {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function assertUnusedArtifactPath(path: string): void {
  if (existsSync(path)) throw new Error(`explicit study artifact path already exists and is immutable: ${path}`);
}

function allocateArtifactPath(path: string): string {
  if (!existsSync(path)) return path;
  const extension = extname(path);
  const stem = extension === "" ? path : path.slice(0, -extension.length);
  for (let attempt = 2; attempt < Number.MAX_SAFE_INTEGER; attempt++) {
    const candidate = `${stem}.attempt-${attempt}${extension}`;
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`no available immutable artifact path for ${path}`);
}

function driftArtifactPath(path: string, sourceFingerprint: string, compilerFingerprint: string): string {
  const extension = extname(path);
  const stem = extension === "" ? path : path.slice(0, -extension.length);
  return `${stem}.identity-drift-${sourceFingerprint.slice(0, 12)}-${compilerFingerprint.slice(0, 12)}${extension}`;
}

function stableJson(value: unknown): string {
  const encoded = JSON.stringify(sortKeys(value));
  if (encoded === undefined) throw new Error("cannot serialize undefined study identity");
  return encoded;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortKeys(child)]));
  }
  return value;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
