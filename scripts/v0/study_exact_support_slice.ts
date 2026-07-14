/**
 * Exact post-impact tangent-aligned support-slice assay.
 *
 * This is a calibration-only physical experiment. It does not expose tuning
 * flags, select an action, or contribute compiler candidates. Its sole purpose
 * is to establish whether the fixed rail stencil has a prefix-safe, directional
 * local response worth testing in a later rollout experiment.
 */
import { PERSISTENCE_FRAMES } from "../lib/detector.ts";
import { hasPreTargetSledProximityFromTrace } from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { detectWindow } from "./core/candidate.ts";
import { engineLineFromTrackLine, measurementLastFrame } from "./core/substrate.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { IMPACT_WINDOW, type TrackLine } from "./types.ts";
import { realizeContactCaptureArc, resolveContactCaptureArc } from "./trajectory/contact_capture_arc.ts";
import { makeMirroredContactCaptureArcScreen } from "./trajectory/contact_capture_arc_design.ts";
import { contactKinematicFrameFromPlanningState } from "./trajectory/contact_kinematic_frame.ts";
import { observeOwnedContactTransition, type OwnedContactObservation } from "./trajectory/contact_observation.ts";
import {
  EXACT_SUPPORT_SLICE_PROTOCOL,
  EXACT_SUPPORT_SLICE_PHASE_LEAD_STEPS,
  EXACT_SUPPORT_SLICE_RAIL_ACTIONS,
  realizeExactSupportSlice,
  resolveExactSupportSliceOrientation,
} from "./trajectory/exact_support_slice.ts";
import {
  angleDeltaDeg,
  classifyExactSupportSliceConstructionProbe,
  displacement,
  exactSupportSliceCaptureClosureEndFrame,
  exactSupportSliceCaptureSelectionValidationEndFrame,
  exactSupportSliceMeasurementHorizon,
  firstSharedSafeExactSupportSlicePhase,
  measureCoMWindow,
  namedReferenceState,
  offBeatLandingsInWindow,
  remainingAirSpeedBudget,
  sameExactEngineTrace,
  sameOwnedCaptureEvent,
  sameScoredContactImpact,
  unresolvedOffBeatLandingFramesAtWindowEnd,
} from "./trajectory/exact_support_slice_assay.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import { scoredContactImpact } from "./trajectory/scored_contact_impact.ts";
import { parseExactSupportSliceCliArguments } from "./trajectory/exact_support_slice_cli.ts";
import { extractPlanningState } from "./trajectory/state.ts";
import { prepareStateCoupledTrajectoryFixture, type PreparedTrajectoryFixtureCore } from "./trajectory/study_context.ts";
import {
  allocateStudyArtifactPath,
  assertStudyArtifactPathUnused,
  forensicDriftArtifactPath,
  studyArtifactIdentity,
  studySourceIdentity,
  writeStudyArtifact,
} from "./trajectory/study_artifact.ts";
import { activeStudyEngine } from "./trajectory/study_runtime.ts";
import {
  emptyEngineStateTraceFingerprint,
  engineCollisionHitsForLineIds,
  exactEngineStateTraceFingerprint,
  survivesThroughFrame,
} from "./trajectory/study_trace.ts";
import { targetFrameFromPlanningState } from "./trajectory/target_frame.ts";
import { transitionContractForGap } from "./trajectory/transition_contract.ts";

const argv = process.argv.slice(2);
// Eligible owned-event frames stop at target + 1. Their detector classification
// receives a complete fixed persistence tail before the H - 1 closure read;
// the separate local state read reaches H + 1 only for geometry/comparator use.
const CAPTURE_EVENT_SELECTION_MAX_OFFSET_FRAMES = 1;
const CAPTURE_LOCAL_STATE_OBSERVATION_FRAMES = IMPACT_WINDOW + 3;
const STUDY_SCHEMA = "line.study-exact-postimpact-support-slice.v2";

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_exact_support_slice.ts --fixture=FILE [--out=FILE]",
    "",
    "Runs the fixed capture-only plus five-rail exact support-slice assay.",
    "Calibration-only; only stable V3 fixtures are accepted and no tuning flags exist.",
  ].join("\n") + "\n");
  process.exit(0);
}

const { fixturePath, explicitOut } = parseExactSupportSliceCliArguments(argv);
if (explicitOut !== undefined) assertStudyArtifactPathUnused(explicitOut);

const fixture = readFrozenTrajectoryFixture(fixturePath);
if (fixture.schema !== "line.frozen-trajectory-prefix.v3" || !fixture.capture.identityCheck.stable) {
  throw new Error("exact support slice requires a stable V3 frozen fixture; V2 remains archival evidence only");
}
const engineName = activeStudyEngine();
const sourceIdentityAtStart = studySourceIdentity("scripts/v0/study_exact_support_slice.ts");
const observationCompilerAtStart = compilerCandidateIdentity(engineName);
const protocolFingerprint = sha256(stableJson({
  captureScreen: "fixed_mirrored_contact_capture_arc.v1",
  railProtocol: EXACT_SUPPORT_SLICE_PROTOCOL,
  captureEligibility: "eligible_event_frames_through_target_plus_1_with_fixed_persistence_validation_then_impact_closure_at_H_minus_1",
  phaseConstruction: "first_shared_safe_phase_from_declared_ladder_using_capture_only_H_to_H_plus_1_orientation_and_through_H_guard_and_fixed_12_frame_state_normalized_extent",
  railActions: EXACT_SUPPORT_SLICE_RAIL_ACTIONS,
  responseBoundary: "H = selected_owned_event.frame + IMPACT_WINDOW + 1",
  measurementHorizon: "Q = min(12, outgoing.endFrame - H); Q >= 4; observe [H,H+Q] inclusive",
  constructionExtent: "fixed 12-frame state-normalized rail extent; outgoing endpoint is excluded from geometry and phase construction",
  orientation: "same_named_capture_only_reference_H_to_H_plus_1",
  guards: [
    "full_engine_prefix_identity_[0,current.startFrame-1]",
    "capture_only_identity_[outgoing.startFrame,H]_inclusive",
    "zero_all_body_support_collision_[0,H]_inclusive",
    "full_selected_capture_event_and_scored_impact_equality",
    "strict_survival_and_complete_measurement_through_H_plus_Q",
    "no_offbeat_landing_[H,H_plus_Q]",
  ],
}));
const artifactIdentity = studyArtifactIdentity({
  schema: STUDY_SCHEMA,
  fixtureFingerprint: fixture.fixtureFingerprint,
  studySourceFingerprint: sourceIdentityAtStart.studySourceFingerprint,
  observationCandidateFingerprint: observationCompilerAtStart.candidateFingerprint,
  protocolFingerprint,
});
const started = performance.now();
const prepared = prepareStateCoupledTrajectoryFixture(fixture);
if (prepared.panel.cohort !== "calibration") {
  throw new Error(`exact support slice accepts only calibration fixtures; ${prepared.panel.id} is ${prepared.panel.cohort}`);
}
const contract = transitionContractForGap(prepared.current, prepared.outgoing, prepared.setup.gapAxisTargets);
if (contract.outgoing === null) throw new Error("frozen contact fixture has no outgoing interval");
const physicalPrefixEndFrame = prepared.current.startFrame - 1;
const baselinePhysicalPrefixTrace = prefixTrace(prepared.engine, physicalPrefixEndFrame);
const eventImpact = contract.event.impact ?? null;
const rows = eventImpact === null || eventImpact <= 0
  ? [outOfScopeRow(eventImpact)]
  : makeMirroredContactCaptureArcScreen(contactKinematicFrameFromPlanningState(
    prepared.state,
    prepared.frame,
    { impact: eventImpact },
  )).map((entry, index) => evaluateRow(entry, index, prepared, eventImpact, baselinePhysicalPrefixTrace));
const summary = summarizeRows(rows);
const sourceIdentityAtEnd = studySourceIdentity("scripts/v0/study_exact_support_slice.ts");
const observationCompilerAtEnd = compilerCandidateIdentity(engineName);
const identityStable = sourceIdentityAtStart.studySourceFingerprint === sourceIdentityAtEnd.studySourceFingerprint &&
  observationCompilerAtStart.candidateFingerprint === observationCompilerAtEnd.candidateFingerprint;
const protocolStatus = !identityStable
  ? "invalid_identity_drift"
  : summary.rowErrors > 0
  ? "invalid_runtime_error"
  : summary.invalidConstructionProbeActions > 0 || summary.constructionInvalidRows > 0
  ? "invalid_construction_phase_probe"
  : summary.invalidConstructionActions > 0
  ? "complete_with_invalid_construction_actions"
  : summary.constructionUnavailableRows > 0 && summary.completePairedRows === 0
  ? "complete_without_shared_safe_construction_phase"
  : "complete";
const output = {
  schema: STUDY_SCHEMA,
  artifactIdentity,
  purpose: [
    "Measure the exact local response of one fixed tangent-aligned offset rail stencil after a captured contact.",
    "Retain every capture, comparator, and rail action; never select or promote an action from calibration output.",
    "Produce per-fixture descriptive evidence only; a separately declared panel-level evaluator owns any rollout-feasibility conclusion.",
  ],
  status: {
    protocolStatus,
    executionComplete: identityStable && summary.rowErrors === 0 &&
      summary.invalidConstructionProbeActions === 0 && summary.constructionInvalidRows === 0,
    descriptiveLocalClaimEligible: identityStable && summary.rowErrors === 0 &&
      summary.invalidConstructionProbeActions === 0 && summary.constructionInvalidRows === 0 &&
      summary.invalidConstructionActions === 0 && summary.completePairedRows > 0,
    descriptiveLocalClaimEligibility: !identityStable
      ? "invalid: source or observed compiler identity changed during replay"
      : summary.rowErrors > 0
      ? "invalid: unexpected row or action runtime error"
    : summary.invalidConstructionProbeActions > 0 || summary.constructionInvalidRows > 0
    ? "invalid: a phase probe changed the protected trace/capture without an expected pre/equal-H support collision"
    : summary.invalidConstructionActions > 0
    ? "invalid for physical inference: one or more rails changed the protected prefix/capture or collided through H"
    : summary.constructionUnavailableRows > 0 && summary.completePairedRows === 0
    ? "unavailable: no conditionally closed row had one shared phase whose full five-arm stencil remained collision-free through H"
      : summary.completePairedRows === 0
      ? "unavailable: no row completed every declared rail under the structural contract"
      : "eligible only for descriptive local rail response on this calibration fixture; it is not a rollout or compiler decision",
    rolloutFeasibility: {
      status: "not_evaluated_per_fixture",
      reason: "requires a separately declared panel-level analysis of preregistered directional response across ordinary/dense and low-air physical states",
    },
    productionIntegration: "forbidden: fixed calibration assay, not a compiler generator, source default, or selector",
    cohortPolicy: "stable V3 calibration fixtures only; production and qualification specifications remain held out",
    fixedArms: ["capture-only", ...EXACT_SUPPORT_SLICE_RAIL_ACTIONS.map((action) => action.id)],
  },
  protocol: {
    protocolFingerprint,
    captureEventSelectionMaxOffsetFrames: CAPTURE_EVENT_SELECTION_MAX_OFFSET_FRAMES,
    captureSelectionValidation: "targetFrame + captureEventSelectionMaxOffsetFrames + PERSISTENCE_FRAMES - 1; eligible event frames remain restricted to target +/- 1",
    captureClosure: "selected_owned_event.frame + IMPACT_WINDOW = H - 1; H/H+1 do not decide capture eligibility",
    localStateObservationFrames: CAPTURE_LOCAL_STATE_OBSERVATION_FRAMES,
    responseBoundary: "H = selected_owned_event.frame + IMPACT_WINDOW + 1",
    measurementHorizon: "Q = min(12, outgoing.endFrame - H); Q >= 4; [H,H+Q] is inclusive and contains Q+1 samples",
    constructionExtent: "fixed 12-frame state-normalized rail extent; outgoing endpoint cannot alter rail geometry or phase selection",
    railProtocol: EXACT_SUPPORT_SLICE_PROTOCOL,
    railActions: EXACT_SUPPORT_SLICE_RAIL_ACTIONS,
    phaseConstruction: {
      candidates: EXACT_SUPPORT_SLICE_PHASE_LEAD_STEPS,
      rule: "for each closed capture, retain every candidate and select only the first phase where all five arms preserve exact physical-prefix/capture identity, survival, and zero all-body support collision through H inclusive",
      selectionInputs: "the locked capture-only H-to-H+1 named-reference displacement plus fixed-extent through-H all-arm construction replay; H+Q effects, outgoing endpoint, authored outgoing axes, and next-event data are excluded",
    },
    geometryInputs: [
      "exact_named_response_anchor_at_H",
      "capture_only_same_named_reference_displacement_H_to_H_plus_1",
    ],
    withheldFromGeometry: [
      "outgoing_authored_axes",
      "next_contact_event_or_target",
      "duration_class",
      "case_id",
      "seed",
      "optimizer_score",
    ],
    structuralEndpoint: "for the shared selected phase only: full non-scarf identity over the physical prefix and capture-only comparator through H inclusive; zero all-body support collision through H inclusive; same selected capture event and scorer impact; strict survival, readable [H,H+Q] measurements, and no off-beat landing",
  },
  argv: [...argv],
  elapsedMs: round(performance.now() - started),
  provenance: {
    fixturePath,
    fixtureFingerprint: fixture.fixtureFingerprint,
    captureCompiler: fixture.captureCompiler,
    captureIdentity: fixture.capture.captureIdentity,
    observationCompiler: observationCompilerAtStart,
    runtime: { node: process.version, engine: engineName },
    studySourceFingerprint: sourceIdentityAtStart.studySourceFingerprint,
    studySourceFiles: sourceIdentityAtStart.sourceFiles,
  },
  identityCheck: {
    stable: identityStable,
    sourceFingerprintAtStart: sourceIdentityAtStart.studySourceFingerprint,
    sourceFingerprintAtEnd: sourceIdentityAtEnd.studySourceFingerprint,
    observationCandidateFingerprintAtStart: observationCompilerAtStart.candidateFingerprint,
    observationCandidateFingerprintAtEnd: observationCompilerAtEnd.candidateFingerprint,
  },
  panel: prepared.panel,
  fixtureReplay: prepared.replay,
  physicalPrefixGuard: {
    startFrame: 0,
    endFrame: physicalPrefixEndFrame,
    baselineTrace: baselinePhysicalPrefixTrace,
    comparator: "exact_full_non_scarf_engine_state_v1",
  },
  transition: {
    incoming: { gap: contract.incoming.gapIndex, frames: contract.incoming.intervalFrames, axes: contract.incoming.axes },
    event: contract.event,
    outgoing: {
      gap: contract.outgoing.gapIndex,
      frames: contract.outgoing.intervalFrames,
      axes: contract.outgoing.axes,
      nextEvent: contract.outgoing.arrival,
      geometryInput: "no outgoing interval field reaches rail geometry; outgoing.endFrame only bounds capture/read availability and post-construction measurement",
    },
  },
  rows,
  summary,
  caveats: [
    "Static rail terrain is constructed from the locked capture-only H-to-H+1 geometry observation. The shared phase ladder then uses all-arm replay through H to eliminate retroactive intrusion before any H+Q outcome is inspected.",
    "The H to H+1 reference displacement is not a target or predicted force law. It chooses only the one-sided normal of the declared rail before action outcomes are observed.",
    "The outgoing endpoint only bounds capture/read availability and the Q-frame report. It does not reach rail geometry or phase choice.",
    "CoM detector air/speed and named-reference terminal state are reported separately. A Q-frame response cannot establish whole-gap satisfaction, score improvement, or a compiler action choice.",
    "Rows are deterministic conditional observations, not independent statistical replicates. The 3-7 second rideout ladder remains one correlated capability family.",
    "Identity is sampled before and after replay over the static import closure plus observed compiler/engine fingerprint. Literal byte-snapshot evidence still requires an external immutable workspace.",
  ],
};

const canonicalOutPath = explicitOut ??
  `generated/studies/exact-support-slice/v2/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}-${artifactIdentity.fingerprint.slice(0, 12)}.json`;
const outPath = !identityStable
  ? allocateStudyArtifactPath(forensicDriftArtifactPath(canonicalOutPath, sourceIdentityAtEnd.studySourceFingerprint, observationCompilerAtEnd.candidateFingerprint))
  : explicitOut ?? allocateStudyArtifactPath(canonicalOutPath);
writeStudyArtifact(outPath, output);
process.stderr.write(
  `exact support slice ${prepared.panel.id}: ${summary.structurallyValidActions}/${summary.actionAttempts} structurally valid outcome rails; ` +
  `${summary.constructionProbeActions} through-H construction probes across ${summary.constructionPhaseAttempts} phases, ` +
  `${summary.captureClosed}/${summary.captureRows} closed captures -> ${outPath}\n`,
);
if (!identityStable || summary.rowErrors > 0 || summary.invalidConstructionProbeActions > 0 ||
    summary.constructionInvalidRows > 0 || summary.invalidConstructionActions > 0) {
  const reason = !identityStable
    ? "identity drift"
    : summary.rowErrors > 0
    ? `${summary.rowErrors} unexpected row/action error(s)`
    : summary.invalidConstructionProbeActions > 0 || summary.constructionInvalidRows > 0
    ? `${summary.invalidConstructionProbeActions} invalid phase probe(s) across ${summary.constructionInvalidRows} row(s)`
    : `${summary.invalidConstructionActions} rail(s) violated the protected construction contract`;
  process.stderr.write(`exact support slice invalid: ${reason}\n`);
  process.exitCode = 2;
}

type CaptureStatus =
  | "closed"
  | "preclear"
  | "survival"
  | "landing"
  | "response_unavailable"
  | "persistence_unavailable"
  | "offbeat"
  | "offbeat_persistence_unavailable"
  | "selection_persistence_unavailable"
  | "selection_unavailable"
  | "physical_prefix_changed"
  | "zero_impact_out_of_scope"
  | "error";

function evaluateRow(
  entry: ReturnType<typeof makeMirroredContactCaptureArcScreen>[number],
  index: number,
  input: PreparedTrajectoryFixtureCore,
  eventImpact: number,
  baselinePhysicalPrefixTrace: ReturnType<typeof exactEngineStateTraceFingerprint>,
) {
  const started = performance.now();
  const simBefore = getSimFrames();
  let capture: ReturnType<typeof realizeContactCaptureArc>;
  try {
    const kinematic = contactKinematicFrameFromPlanningState(input.state, input.frame, { impact: eventImpact });
    capture = realizeContactCaptureArc(resolveContactCaptureArc(kinematic, entry.control), input.lineIdStart);
  } catch (error) {
    return captureFailure(entry, index, "error", error, started, simBefore);
  }
  const captureLines = capture.lines;
  const captureRoles = new Map<number, string>([
    [capture.lineRoles.approach, "capture_band_approach"],
    [capture.lineRoles.runway, "capture_band_runway"],
    ...capture.lineRoles.arc.map((id) => [id, "capture_band_arc"] as const),
  ]);
  if (hasPreTargetSledProximityFromTrace(input.probe.preTargetSledTrace(), captureLines)) {
    return captureUnavailable(entry, index, capture, "preclear", "capture_preclear", started, simBefore);
  }

  try {
    const captureEngine = input.engine.addLine(captureLines.map((line) => engineLineFromTrackLine(line)));
    const captureEventSelectionEnd = Math.min(
      input.outgoing.endFrame,
      input.current.endFrame + CAPTURE_EVENT_SELECTION_MAX_OFFSET_FRAMES,
    );
    const captureEventSelectionValidationRequiredEnd = exactSupportSliceCaptureSelectionValidationEndFrame(
      input.current.endFrame,
      CAPTURE_EVENT_SELECTION_MAX_OFFSET_FRAMES,
    );
    const captureEventSelectionValidationEnd = Math.min(
      input.outgoing.endFrame,
      captureEventSelectionValidationRequiredEnd,
    );
    const localEnd = Math.min(input.outgoing.endFrame, input.current.endFrame + CAPTURE_LOCAL_STATE_OBSERVATION_FRAMES);
    // Selection and capture admission intentionally use separate bounded
    // detectors. H/H+1 belongs only to the later geometry/comparator read.
    const selectionDetection = detectWindow(captureEngine, 0, captureEventSelectionValidationEnd);
    const selectionComplete = survivesThroughFrame(selectionDetection, captureEventSelectionEnd) &&
      measurementLastFrame(selectionDetection) >= captureEventSelectionEnd;
    const selectionValidationReached = survivesThroughFrame(selectionDetection, captureEventSelectionValidationEnd) &&
      measurementLastFrame(selectionDetection) >= captureEventSelectionValidationEnd;
    const selectionValidationComplete = captureEventSelectionValidationEnd === captureEventSelectionValidationRequiredEnd &&
      selectionValidationReached;
    const selectionObservation = observeCapture(
      selectionDetection,
      input,
      captureLines,
      captureRoles,
      captureEventSelectionEnd,
    );
    const captureClosureEnd = exactSupportSliceCaptureClosureEndFrame(selectionObservation.selectedOwnedEvent?.frame ?? null);
    const captureClosureObserved = captureClosureEnd !== null && captureClosureEnd <= input.outgoing.endFrame;
    const closureDetection = captureClosureObserved
      ? detectWindow(captureEngine, 0, captureClosureEnd)
      : selectionDetection;
    const captureClosureComplete = captureClosureObserved && survivesThroughFrame(closureDetection, captureClosureEnd!) &&
      measurementLastFrame(closureDetection) >= captureClosureEnd!;
    const localObservation = captureClosureObserved
      ? observeCapture(closureDetection, input, captureLines, captureRoles, captureClosureEnd!)
      : selectionObservation;
    const selectionMatchesClosure = captureClosureEnd === null || !captureClosureObserved
      ? null
      : sameOwnedCaptureEvent(selectionObservation.selectedOwnedEvent, localObservation.selectedOwnedEvent);
    const captureClosureUnresolvedOffBeatLandingFrames = captureClosureObserved
      ? unresolvedOffBeatLandingFramesAtWindowEnd(
        closureDetection,
        authoredContactFramesThrough(input, captureClosureEnd!),
        input.current.startFrame,
        captureClosureEnd!,
      )
      : [];
    const localDetection = detectWindow(captureEngine, 0, localEnd);
    const physicalPrefixTrace = prefixTrace(captureEngine, input.current.startFrame - 1);
    const localImpact = captureImpact(closureDetection, localObservation, input);
    const captureStatus = sameExactEngineTrace(physicalPrefixTrace, baselinePhysicalPrefixTrace)
      ? !selectionComplete
        ? "survival" as const
        : !selectionValidationReached
          ? "survival" as const
          : !selectionValidationComplete
          ? "selection_persistence_unavailable" as const
          : selectionObservation.selectedOwnedEvent === null
            ? "landing" as const
        : !captureClosureObserved
          ? "response_unavailable" as const
          : !captureClosureComplete
            ? "survival" as const
            : !selectionMatchesClosure
            ? "selection_unavailable" as const
            : captureClosureUnresolvedOffBeatLandingFrames.length > 0
              ? "offbeat_persistence_unavailable" as const
              : classifyCapture(closureDetection, localObservation, input, captureClosureEnd!)
      : "physical_prefix_changed" as const;
    const local = summarizeCaptureLocal(
      selectionDetection,
      closureDetection,
      localDetection,
      selectionObservation,
      localObservation,
      localImpact,
      captureStatus,
      physicalPrefixTrace,
      baselinePhysicalPrefixTrace,
      input,
      captureEventSelectionEnd,
      captureEventSelectionValidationRequiredEnd,
      captureEventSelectionValidationEnd,
      selectionComplete,
      selectionValidationReached,
      selectionValidationComplete,
      captureClosureEnd,
      captureClosureObserved,
      captureClosureComplete,
      captureClosureUnresolvedOffBeatLandingFrames,
      localEnd,
      selectionMatchesClosure,
    );
    if (captureStatus !== "closed") {
      return captureUnavailable(entry, index, capture, captureStatus, `capture_${captureStatus}`, started, simBefore, local);
    }
    const selected = localObservation.selectedOwnedEvent;
    if (selected === null) throw new Error("closed capture lacks a selected owned event");
    const supportStartFrame = selected.frame + IMPACT_WINDOW + 1;
    const measurementHorizon = exactSupportSliceMeasurementHorizon(input.outgoing.endFrame, supportStartFrame);
    if (measurementHorizon.status !== "ready") {
      return {
        ...baseRow(entry, index, capture, local, started, simBefore),
        captureStatus: "closed" as const,
        response: { eventFrame: selected.frame, supportStartFrame, measurementHorizon },
        assay: { status: "insufficient_measurement_horizon" as const, reason: measurementHorizon.status, actions: [] },
      };
    }
    const actionEndFrame = supportStartFrame + measurementHorizon.measurementHorizonFrames;
    // This first comparator is intentionally bounded at H. The construction
    // ladder below may inspect only this evidence, never a response outcome.
    const captureOnlyPreHDetection = detectWindow(captureEngine, 0, supportStartFrame);
    const captureOnlyPreHObservation = observeCapture(
      captureOnlyPreHDetection,
      input,
      captureLines,
      captureRoles,
      supportStartFrame,
    );
    const captureOnlyPreHImpact = captureImpact(captureOnlyPreHDetection, captureOnlyPreHObservation, input);
    const captureOnlyPreHTrace = exactEngineStateTraceFingerprint(captureEngine, input.outgoing.startFrame, supportStartFrame);
    const captureOnlyPreHTraceAvailable = sameExactEngineTrace(captureOnlyPreHTrace, captureOnlyPreHTrace);
    const captureOnlyPreHComplete = survivesThroughFrame(captureOnlyPreHDetection, supportStartFrame) &&
      measurementLastFrame(captureOnlyPreHDetection) >= supportStartFrame;
    const preHAuthoredContactFrames = authoredContactFramesThrough(input, supportStartFrame);
    const captureOnlyPreHAllOffBeatLandingFrames = offBeatLandingsInWindow(
      captureOnlyPreHDetection,
      preHAuthoredContactFrames,
      input.current.startFrame,
      supportStartFrame,
    );
    const captureOnlyPreHUnresolvedOffBeatLandingFrames = unresolvedOffBeatLandingFramesAtWindowEnd(
      captureOnlyPreHDetection,
      preHAuthoredContactFrames,
      input.current.startFrame,
      supportStartFrame,
    );
    const captureOnlyPreHOffBeatLandingFrames = captureOnlyPreHAllOffBeatLandingFrames.filter(
      (frame) => !captureOnlyPreHUnresolvedOffBeatLandingFrames.includes(frame),
    );
    const responseState = extractPlanningState(captureEngine, supportStartFrame);
    const responseAnchor = responseState === null ? null : targetFrameFromPlanningState(responseState);
    const namedAtH = responseState === null || responseAnchor === null
      ? null
      : namedReferenceState(responseState, responseAnchor.anchorPoint);
    const nextResponseState = extractPlanningState(captureEngine, supportStartFrame + 1);
    const namedAtHPlusOne = responseAnchor === null || nextResponseState === null
      ? null
      : namedReferenceState(nextResponseState, responseAnchor.anchorPoint);
    const captureObservationStableAtH = sameOwnedCaptureEvent(
      localObservation.selectedOwnedEvent,
      captureOnlyPreHObservation.selectedOwnedEvent,
    ) && sameScoredContactImpact(localImpact, captureOnlyPreHImpact);
    const namedAnchorStable = responseAnchor !== null && namedAtH !== null &&
      samePoint(responseAnchor.reference, namedAtH.position);
    const preHComparatorReady = captureOnlyPreHComplete && captureOnlyPreHTraceAvailable &&
      namedAtH !== null && namedAtHPlusOne !== null &&
      captureObservationStableAtH && namedAnchorStable && captureOnlyPreHOffBeatLandingFrames.length === 0 &&
      captureOnlyPreHUnresolvedOffBeatLandingFrames.length === 0;
    const response = {
      eventFrame: selected.frame,
      supportStartFrame,
      measurementHorizon,
      actionEndFrame,
      anchor: responseAnchor === null ? null : summarizeAnchor(responseAnchor),
      namedReferenceAtH: namedAtH === null ? null : summarizeReference(namedAtH),
      namedReferenceAtHPlusOne: namedAtHPlusOne === null ? null : summarizeReference(namedAtHPlusOne),
      captureOnlyReferenceDisplacement: namedAtH === null || namedAtHPlusOne === null
        ? null
        : point(displacement(namedAtH.position, namedAtHPlusOne.position)),
      namedAnchorMatchesTargetFrame: namedAnchorStable,
    };
    const preHComparator = {
      complete: captureOnlyPreHComplete,
      traceAvailable: captureOnlyPreHTraceAvailable,
      observationMatchesLocalCapture: captureObservationStableAtH,
      captureTrace: captureOnlyPreHTrace,
      offBeatLandingFrames: captureOnlyPreHOffBeatLandingFrames,
      unresolvedOffBeatLandingFrames: captureOnlyPreHUnresolvedOffBeatLandingFrames,
      impact: captureOnlyPreHImpact,
    };
    if (!preHComparatorReady || responseState === null || responseAnchor === null || namedAtH === null || namedAtHPlusOne === null) {
      return {
        ...baseRow(entry, index, capture, local, started, simBefore),
        captureStatus: "closed" as const,
        response,
        comparator: { preH: preHComparator, response: null },
        assay: {
          status: "comparator_unavailable" as const,
          reason: preHComparatorFailureReason({
            captureOnlyPreHComplete,
            captureOnlyPreHTraceAvailable,
            captureObservationStableAtH,
            namedAnchorStable,
            namedAtH,
            namedAtHPlusOne,
            captureOnlyPreHOffBeatLandingFrames,
            captureOnlyPreHUnresolvedOffBeatLandingFrames,
          }),
          actions: [],
        },
      };
    }
    const displacementHToHPlusOne = displacement(namedAtH.position, namedAtHPlusOne.position);
    try {
      resolveExactSupportSliceOrientation({
        anchor: responseAnchor,
        captureOnlyReferenceDisplacement: displacementHToHPlusOne,
      });
    } catch (error) {
      return {
        ...baseRow(entry, index, capture, local, started, simBefore),
        captureStatus: "closed" as const,
        response,
        comparator: { preH: preHComparator, response: null },
        assay: { status: "orientation_unavailable" as const, reason: errorMessage(error), actions: [] },
      };
    }
    const constructionPhases = EXACT_SUPPORT_SLICE_PHASE_LEAD_STEPS.map((phaseLeadSteps) =>
      evaluateConstructionPhase({
        phaseLeadSteps,
        input,
        captureLines,
        captureRoles,
        captureOnlyPreHObservation,
        captureOnlyPreHImpact,
        captureOnlyPreHTrace,
        captureOnlyEngine: captureEngine,
        captureOnlyPreHTraceAvailable,
        captureOnlyPreHComplete,
        responseAnchor,
        supportStartFrame,
        captureOnlyReferenceDisplacement: displacementHToHPlusOne,
        baselinePhysicalPrefixTrace,
      }),
    );
    const selectedConstructionPhase = firstSharedSafeExactSupportSlicePhase(constructionPhases);
    const invalidConstructionProbeActions = constructionPhases.reduce((sum, phase) => sum + phase.invalidProbeActions, 0);
    if (invalidConstructionProbeActions > 0) {
      return {
        ...baseRow(entry, index, capture, local, started, simBefore),
        captureStatus: "closed" as const,
        response,
        comparator: { preH: preHComparator, response: null },
        assay: {
          status: "construction_invalid" as const,
          reason: "one_or_more_phase_probes_changed_the_protected_trace_or_capture_without_a_support_collision",
          constructionPhases,
          selectedPhaseLeadSteps: null,
          actions: [],
        },
      };
    }
    if (selectedConstructionPhase === null) {
      return {
        ...baseRow(entry, index, capture, local, started, simBefore),
        captureStatus: "closed" as const,
        response,
        comparator: { preH: preHComparator, response: null },
        assay: {
          status: "construction_unavailable" as const,
          reason: "no_declared_shared_phase_preserved_all_five_rails_through_H",
          constructionPhases,
          selectedPhaseLeadSteps: null,
          actions: [],
        },
      };
    }
    // The phase is fixed before this H+Q comparator is read. Only now may the
    // assay observe a response-window endpoint and paired action effects.
    const captureOnlyDetection = detectWindow(captureEngine, 0, actionEndFrame);
    const captureOnlyObservation = observeCapture(captureOnlyDetection, input, captureLines, captureRoles, actionEndFrame);
    const captureOnlyImpact = captureImpact(captureOnlyDetection, captureOnlyObservation, input);
    const captureOnlyTrace = exactEngineStateTraceFingerprint(captureEngine, input.outgoing.startFrame, supportStartFrame);
    const captureOnlyWindow = measureCoMWindow(captureOnlyDetection, supportStartFrame, actionEndFrame);
    const captureOnlyAllOffBeatLandingFrames = offBeatLandingsInWindow(
      captureOnlyDetection,
      input.ctx.allContactFrames,
      supportStartFrame,
      actionEndFrame,
    );
    const captureOnlyUnresolvedOffBeatLandingFrames = unresolvedOffBeatLandingFramesAtWindowEnd(
      captureOnlyDetection,
      input.ctx.allContactFrames,
      supportStartFrame,
      actionEndFrame,
    );
    const captureOnlyOffBeatLandingFrames = captureOnlyAllOffBeatLandingFrames.filter(
      (frame) => !captureOnlyUnresolvedOffBeatLandingFrames.includes(frame),
    );
    const namedTerminal = responseAnchor === null
      ? null
      : namedReferenceState(extractPlanningState(captureEngine, actionEndFrame), responseAnchor.anchorPoint);
    const captureOnlyComplete = survivesThroughFrame(captureOnlyDetection, actionEndFrame) &&
      measurementLastFrame(captureOnlyDetection) >= actionEndFrame;
    const captureObservationStable = sameOwnedCaptureEvent(
      captureOnlyPreHObservation.selectedOwnedEvent,
      captureOnlyObservation.selectedOwnedEvent,
    ) && sameScoredContactImpact(captureOnlyPreHImpact, captureOnlyImpact);
    const comparatorReady = captureOnlyComplete && captureOnlyWindow !== null && namedTerminal !== null &&
      captureObservationStable && captureOnlyOffBeatLandingFrames.length === 0 &&
      captureOnlyUnresolvedOffBeatLandingFrames.length === 0;
    const comparator = {
      preH: preHComparator,
      response: {
        complete: captureOnlyComplete,
        observationMatchesPreHCapture: captureObservationStable,
        captureTrace: captureOnlyTrace,
        offBeatLandingFrames: captureOnlyOffBeatLandingFrames,
        unresolvedOffBeatLandingFrames: captureOnlyUnresolvedOffBeatLandingFrames,
        window: captureOnlyWindow === null ? null : summarizeCoMWindow(captureOnlyWindow),
        terminalNamedReference: namedTerminal === null ? null : summarizeReference(namedTerminal),
        remainingBudget: remainingAirSpeedBudget({
          detection: captureOnlyDetection,
          outgoingStartFrame: input.outgoing.startFrame,
          outgoingEndFrame: input.outgoing.endFrame,
          supportStartFrame,
          axes: contractAxes(input),
        }),
        impact: captureOnlyImpact,
      },
    };
    if (!comparatorReady) {
      return {
        ...baseRow(entry, index, capture, local, started, simBefore),
        captureStatus: "closed" as const,
        response,
        comparator,
        assay: {
          status: "comparator_unavailable" as const,
          reason: comparatorFailureReason({
            captureOnlyComplete,
            captureObservationStable,
            namedAnchorStable,
            captureOnlyWindow,
            namedTerminal,
            namedAtH,
            namedAtHPlusOne,
            captureOnlyOffBeatLandingFrames,
            captureOnlyUnresolvedOffBeatLandingFrames,
          }),
          constructionPhases,
          selectedPhaseLeadSteps: selectedConstructionPhase.phaseLeadSteps,
          actions: [],
        },
      };
    }
    const actions = EXACT_SUPPORT_SLICE_RAIL_ACTIONS.map((action) => evaluateAction({
      action,
      phaseLeadSteps: selectedConstructionPhase.phaseLeadSteps,
      input,
      captureLines,
      captureRoles,
      captureOnlyObservation,
      captureOnlyImpact,
      captureOnlyTrace,
      captureOnlyWindow,
      captureOnlyTerminalReference: namedTerminal,
      responseAnchor,
      supportStartFrame,
      actionEndFrame,
      captureOnlyReferenceDisplacement: displacementHToHPlusOne,
      baselinePhysicalPrefixTrace,
    }));
    return {
      ...baseRow(entry, index, capture, local, started, simBefore),
      captureStatus: "closed" as const,
      response,
      comparator,
      assay: {
        status: "ready" as const,
        constructionPhases,
        selectedPhaseLeadSteps: selectedConstructionPhase.phaseLeadSteps,
        actions,
      },
    };
  } catch (error) {
    return captureFailure(entry, index, "error", error, started, simBefore, capture);
  }
}

function evaluateConstructionPhase(input: {
  phaseLeadSteps: (typeof EXACT_SUPPORT_SLICE_PHASE_LEAD_STEPS)[number];
  input: PreparedTrajectoryFixtureCore;
  captureLines: TrackLine[];
  captureRoles: ReadonlyMap<number, string>;
  captureOnlyPreHObservation: OwnedContactObservation;
  captureOnlyPreHImpact: ReturnType<typeof captureImpact>;
  captureOnlyPreHTrace: ReturnType<typeof exactEngineStateTraceFingerprint>;
  captureOnlyEngine: any;
  captureOnlyPreHComplete: boolean;
  captureOnlyPreHTraceAvailable: boolean;
  responseAnchor: ReturnType<typeof targetFrameFromPlanningState>;
  supportStartFrame: number;
  captureOnlyReferenceDisplacement: { x: number; y: number };
  baselinePhysicalPrefixTrace: ReturnType<typeof exactEngineStateTraceFingerprint>;
}) {
  const actions = EXACT_SUPPORT_SLICE_RAIL_ACTIONS.map((action) => evaluateConstructionAction({ ...input, action }));
  const invalidProbeActions = actions.filter((action) => action.status === "error" || action.protocolInvalid);
  return {
    phaseLeadSteps: input.phaseLeadSteps,
    actions,
    sharedConstructionSafe: actions.length === EXACT_SUPPORT_SLICE_RAIL_ACTIONS.length &&
      actions.every((action) => action.status === "observed" && action.constructionSafe),
    invalidProbeActions: invalidProbeActions.length,
    collisionOnlyRejection: invalidProbeActions.length === 0 && actions.some((action) =>
      action.status === "observed" && action.expectedCollisionRejection,
    ),
  };
}

function evaluateConstructionAction(input: {
  action: (typeof EXACT_SUPPORT_SLICE_RAIL_ACTIONS)[number];
  phaseLeadSteps: (typeof EXACT_SUPPORT_SLICE_PHASE_LEAD_STEPS)[number];
  input: PreparedTrajectoryFixtureCore;
  captureLines: TrackLine[];
  captureRoles: ReadonlyMap<number, string>;
  captureOnlyPreHObservation: OwnedContactObservation;
  captureOnlyPreHImpact: ReturnType<typeof captureImpact>;
  captureOnlyPreHTrace: ReturnType<typeof exactEngineStateTraceFingerprint>;
  captureOnlyEngine: any;
  captureOnlyPreHComplete: boolean;
  captureOnlyPreHTraceAvailable: boolean;
  responseAnchor: ReturnType<typeof targetFrameFromPlanningState>;
  supportStartFrame: number;
  captureOnlyReferenceDisplacement: { x: number; y: number };
  baselinePhysicalPrefixTrace: ReturnType<typeof exactEngineStateTraceFingerprint>;
}) {
  const started = performance.now();
  const simBefore = getSimFrames();
  try {
    const slice = realizeExactSupportSlice({
      anchor: input.responseAnchor,
      captureOnlyReferenceDisplacement: input.captureOnlyReferenceDisplacement,
      phaseLeadSteps: input.phaseLeadSteps,
    }, input.action, input.input.lineIdStart + input.captureLines.length);
    const supportLineIds = new Set(slice.lines.map((line) => line.id));
    const engine = input.input.engine.addLine([...input.captureLines, ...slice.lines].map((line) => engineLineFromTrackLine(line)));
    const detection = detectWindow(engine, 0, input.supportStartFrame);
    const observation = observeCapture(detection, input.input, input.captureLines, input.captureRoles, input.supportStartFrame);
    const impact = captureImpact(detection, observation, input.input);
    const physicalPrefixTrace = prefixTrace(engine, input.input.current.startFrame - 1);
    const captureTrace = exactEngineStateTraceFingerprint(engine, input.input.outgoing.startFrame, input.supportStartFrame);
    const preOrAtHSupportCollisions = collisionHits(engine, 0, input.supportStartFrame, supportLineIds);
    const firstSupportCollisionFrame = preOrAtHSupportCollisions.reduce<number | null>(
      (first, hit) => first === null ? hit.frame : Math.min(first, hit.frame),
      null,
    );
    const traceMatchesBeforeFirstSupportCollision = firstSupportCollisionFrame === null
      ? true
      : sameExactEngineTrace(
        prefixTrace(engine, firstSupportCollisionFrame - 1),
        prefixTrace(input.captureOnlyEngine, firstSupportCollisionFrame - 1),
      );
    const survivesThroughH = survivesThroughFrame(detection, input.supportStartFrame) &&
      measurementLastFrame(detection) >= input.supportStartFrame;
    const physicalPrefixMatchesBaseline = sameExactEngineTrace(physicalPrefixTrace, input.baselinePhysicalPrefixTrace);
    const captureTraceMatchesComparator = sameExactEngineTrace(captureTrace, input.captureOnlyPreHTrace);
    const captureEventMatchesComparator = sameOwnedCaptureEvent(
      observation.selectedOwnedEvent,
      input.captureOnlyPreHObservation.selectedOwnedEvent,
    );
    const impactMatchesComparator = sameScoredContactImpact(impact, input.captureOnlyPreHImpact);
    const constructionVerdict = classifyExactSupportSliceConstructionProbe({
      physicalPrefixMatchesBaseline,
      captureOnlyPreHComplete: input.captureOnlyPreHComplete,
      captureOnlyPreHTraceAvailable: input.captureOnlyPreHTraceAvailable,
      captureTraceMatchesComparator,
      traceMatchesBeforeFirstSupportCollision,
      selectedCaptureEventMatchesComparator: captureEventMatchesComparator,
      impactMatchesComparator,
      survivesThroughH,
      preOrAtHSupportCollisionCount: preOrAtHSupportCollisions.length,
    });
    return {
      action: input.action,
      status: "observed" as const,
      rail: summarizeSlice(slice),
      guards: {
        physicalPrefixTrace,
        physicalPrefixMatchesBaseline,
        captureOnlyTrace: captureTrace,
        captureOnlyTraceMatchesComparator: captureTraceMatchesComparator,
        firstSupportCollisionFrame,
        traceMatchesBeforeFirstSupportCollision,
        selectedCaptureEventMatchesComparator: captureEventMatchesComparator,
        impactMatchesComparator,
        survivesThroughH,
        preOrAtHSupportCollisions,
      },
      ...constructionVerdict,
      elapsedMs: round(performance.now() - started),
      simFrames: getSimFrames() - simBefore,
    };
  } catch (error) {
    return {
      action: input.action,
      status: "error" as const,
      reason: errorMessage(error),
      constructionSafe: false,
      expectedCollisionRejection: false,
      protocolInvalid: true,
      elapsedMs: round(performance.now() - started),
      simFrames: getSimFrames() - simBefore,
    };
  }
}

function evaluateAction(input: {
  action: (typeof EXACT_SUPPORT_SLICE_RAIL_ACTIONS)[number];
  phaseLeadSteps: (typeof EXACT_SUPPORT_SLICE_PHASE_LEAD_STEPS)[number];
  input: PreparedTrajectoryFixtureCore;
  captureLines: TrackLine[];
  captureRoles: ReadonlyMap<number, string>;
  captureOnlyObservation: OwnedContactObservation;
  captureOnlyImpact: ReturnType<typeof captureImpact>;
  captureOnlyTrace: ReturnType<typeof exactEngineStateTraceFingerprint>;
  captureOnlyWindow: NonNullable<ReturnType<typeof measureCoMWindow>>;
  captureOnlyTerminalReference: NonNullable<ReturnType<typeof namedReferenceState>>;
  responseAnchor: ReturnType<typeof targetFrameFromPlanningState>;
  supportStartFrame: number;
  actionEndFrame: number;
  captureOnlyReferenceDisplacement: { x: number; y: number };
  baselinePhysicalPrefixTrace: ReturnType<typeof exactEngineStateTraceFingerprint>;
}) {
  const started = performance.now();
  const simBefore = getSimFrames();
  try {
    const slice = realizeExactSupportSlice({
      anchor: input.responseAnchor,
      captureOnlyReferenceDisplacement: input.captureOnlyReferenceDisplacement,
      phaseLeadSteps: input.phaseLeadSteps,
    }, input.action, input.input.lineIdStart + input.captureLines.length);
    const supportLineIds = new Set(slice.lines.map((line) => line.id));
    const engine = input.input.engine.addLine([...input.captureLines, ...slice.lines].map((line) => engineLineFromTrackLine(line)));
    const detection = detectWindow(engine, 0, input.actionEndFrame);
    const observation = observeCapture(detection, input.input, input.captureLines, input.captureRoles, input.actionEndFrame);
    const impact = captureImpact(detection, observation, input.input);
    const physicalPrefixTrace = prefixTrace(engine, input.input.current.startFrame - 1);
    const captureTrace = exactEngineStateTraceFingerprint(engine, input.input.outgoing.startFrame, input.supportStartFrame);
    const preOrAtHCollisions = collisionHits(engine, 0, input.supportStartFrame, supportLineIds);
    const localCollisions = collisionHits(engine, input.supportStartFrame, input.actionEndFrame, supportLineIds);
    const complete = survivesThroughFrame(detection, input.actionEndFrame) &&
      measurementLastFrame(detection) >= input.actionEndFrame;
    const allOffBeatLandingFrames = offBeatLandingsInWindow(
      detection,
      input.input.ctx.allContactFrames,
      input.supportStartFrame,
      input.actionEndFrame,
    );
    const unresolvedOffBeatLandingFrames = unresolvedOffBeatLandingFramesAtWindowEnd(
      detection,
      input.input.ctx.allContactFrames,
      input.supportStartFrame,
      input.actionEndFrame,
    );
    const offBeatLandingFrames = allOffBeatLandingFrames.filter(
      (frame) => !unresolvedOffBeatLandingFrames.includes(frame),
    );
    const window = complete ? measureCoMWindow(detection, input.supportStartFrame, input.actionEndFrame) : null;
    const terminalPlanningState = complete ? extractPlanningState(engine, input.actionEndFrame) : null;
    const terminalNamedReference = terminalPlanningState === null
      ? null
      : namedReferenceState(terminalPlanningState, input.responseAnchor.anchorPoint);
    const physicalPrefixMatchesBaseline = sameExactEngineTrace(physicalPrefixTrace, input.baselinePhysicalPrefixTrace);
    const captureTraceMatchesComparator = sameExactEngineTrace(captureTrace, input.captureOnlyTrace);
    const captureEventMatchesComparator = sameOwnedCaptureEvent(
      observation.selectedOwnedEvent,
      input.captureOnlyObservation.selectedOwnedEvent,
    );
    const impactMatchesComparator = sameScoredContactImpact(impact, input.captureOnlyImpact);
    const constructionValid = physicalPrefixMatchesBaseline && captureTraceMatchesComparator &&
      preOrAtHCollisions.length === 0 && captureEventMatchesComparator && impactMatchesComparator;
    const structurallyValid = constructionValid && complete && window !== null && terminalNamedReference !== null &&
      offBeatLandingFrames.length === 0 && unresolvedOffBeatLandingFrames.length === 0;
    return {
      action: input.action,
      status: "observed" as const,
      rail: summarizeSlice(slice),
      guards: {
        physicalPrefixTrace,
        physicalPrefixMatchesBaseline,
        captureOnlyTrace: captureTrace,
        captureOnlyTraceMatchesComparator: captureTraceMatchesComparator,
        selectedCaptureEventMatchesComparator: captureEventMatchesComparator,
        impactMatchesComparator,
        preOrAtHSupportCollisions: preOrAtHCollisions,
        constructionValid,
      },
      terminus: detection.terminus,
      complete,
      offBeatLandingFrames,
      unresolvedOffBeatLandingFrames,
      supportCollisions: localCollisions,
      supportContact: summarizeSupportContact(localCollisions),
      impact,
      window: window === null ? null : summarizeCoMWindow(window),
      terminalNamedReference: terminalNamedReference === null ? null : summarizeReference(terminalNamedReference),
      effectsFromCaptureOnly: window === null || terminalNamedReference === null
        ? null
        : summarizeEffects(input.captureOnlyWindow, window, input.captureOnlyTerminalReference, terminalNamedReference, input.responseAnchor),
      structurallyValid,
      elapsedMs: round(performance.now() - started),
      simFrames: getSimFrames() - simBefore,
    };
  } catch (error) {
    return {
      action: input.action,
      status: "error" as const,
      reason: errorMessage(error),
      structurallyValid: false,
      elapsedMs: round(performance.now() - started),
      simFrames: getSimFrames() - simBefore,
    };
  }
}

function observeCapture(
  detection: ReturnType<typeof detectWindow>,
  input: PreparedTrajectoryFixtureCore,
  captureLines: readonly TrackLine[],
  captureRoles: ReadonlyMap<number, string>,
  observationEndFrame: number,
): OwnedContactObservation {
  return observeOwnedContactTransition(detection, {
    targetFrame: input.current.endFrame,
    gapFrames: input.current.endFrame - input.current.startFrame,
    observationEndFrame,
    ownedLineIds: new Set(captureLines.map((line) => line.id)),
    lineRoles: captureRoles,
    requiredLineRoles: ["capture_band_approach", "capture_band_runway", "capture_band_arc"],
    persistenceOffsetFrames: PERSISTENCE_FRAMES,
    responseOffsetFrames: IMPACT_WINDOW,
  });
}

function captureImpact(
  detection: ReturnType<typeof detectWindow>,
  observation: OwnedContactObservation,
  input: PreparedTrajectoryFixtureCore,
) {
  return scoredContactImpact(detection, {
    target: input.current.targets.impact ?? null,
    landingFrame: observation.selectedOwnedEvent?.frame ?? null,
    responseWindowComplete: observation.responseWindowComplete,
  });
}

function classifyCapture(
  detection: ReturnType<typeof detectWindow>,
  observation: OwnedContactObservation,
  input: PreparedTrajectoryFixtureCore,
  captureClosureEnd: number,
): CaptureStatus {
  if (observation.selectedOwnedEvent === null) return "landing";
  if (!survivesThroughFrame(detection, captureClosureEnd)) return "survival";
  if (!observation.responseWindowComplete) return "response_unavailable";
  if (!observation.persistenceWindowComplete) return "persistence_unavailable";
  const offBeat = offBeatLandingsInWindow(
    detection,
    authoredContactFramesThrough(input, captureClosureEnd),
    input.current.startFrame,
    captureClosureEnd,
  );
  if (offBeat.length > 0) return "offbeat";
  return "closed";
}

function summarizeCaptureLocal(
  selectionDetection: ReturnType<typeof detectWindow>,
  closureDetection: ReturnType<typeof detectWindow>,
  localStateDetection: ReturnType<typeof detectWindow>,
  selectionObservation: OwnedContactObservation,
  observation: OwnedContactObservation,
  impact: ReturnType<typeof captureImpact>,
  status: CaptureStatus,
  physicalPrefixTrace: ReturnType<typeof exactEngineStateTraceFingerprint>,
  baselinePhysicalPrefixTrace: ReturnType<typeof exactEngineStateTraceFingerprint>,
  input: PreparedTrajectoryFixtureCore,
  captureEventSelectionEnd: number,
  captureEventSelectionValidationRequiredEnd: number,
  captureEventSelectionValidationEnd: number,
  selectionComplete: boolean,
  selectionValidationReached: boolean,
  selectionValidationComplete: boolean,
  captureClosureEnd: number | null,
  captureClosureObserved: boolean,
  captureClosureComplete: boolean,
  captureClosureUnresolvedOffBeatLandingFrames: readonly number[],
  localEnd: number,
  selectionMatchesClosure: boolean | null,
) {
  const captureClosureAllOffBeatLandingFrames = captureClosureEnd === null
    ? []
    : offBeatLandingsInWindow(
      closureDetection,
      authoredContactFramesThrough(input, captureClosureEnd),
      input.current.startFrame,
      captureClosureEnd,
    );
  const captureClosureOffBeatLandingFrames = captureClosureAllOffBeatLandingFrames.filter(
    (frame) => !captureClosureUnresolvedOffBeatLandingFrames.includes(frame),
  );
  return {
    status,
    captureEventSelectionEndFrame: captureEventSelectionEnd,
    captureEventSelectionValidationRequiredEndFrame: captureEventSelectionValidationRequiredEnd,
    captureEventSelectionValidationEndFrame: captureEventSelectionValidationEnd,
    captureEventSelectionComplete: selectionComplete,
    captureEventSelectionValidationReached: selectionValidationReached,
    captureEventSelectionValidationComplete: selectionValidationComplete,
    captureClosureEndFrame: captureClosureEnd,
    captureClosureObserved,
    captureClosureComplete,
    localStateObservationEndFrame: localEnd,
    selectionTerminus: selectionDetection.terminus,
    captureClosureTerminus: closureDetection.terminus,
    localStateObservationTerminus: localStateDetection.terminus,
    selectionOwnedEvent: selectionObservation.selectedOwnedEvent,
    selectedOwnedEvent: observation.selectedOwnedEvent,
    selectionMatchesClosure,
    persistenceWindowComplete: observation.persistenceWindowComplete,
    responseWindowComplete: observation.responseWindowComplete,
    impact,
    captureClosureAllOffBeatLandingFrames,
    captureClosureOffBeatLandingFrames,
    captureClosureUnresolvedOffBeatLandingFrames,
    localStateObservationOffBeatLandingFrames: offBeatLandingsInWindow(
      localStateDetection,
      input.ctx.allContactFrames,
      input.current.startFrame,
      localEnd,
    ),
    physicalPrefixTrace,
    physicalPrefixTraceMatchesBaseline: sameExactEngineTrace(physicalPrefixTrace, baselinePhysicalPrefixTrace),
  };
}

function baseRow(
  entry: ReturnType<typeof makeMirroredContactCaptureArcScreen>[number],
  index: number,
  capture: ReturnType<typeof realizeContactCaptureArc>,
  local: unknown,
  started: number,
  simBefore: number,
) {
  return {
    index,
    label: entry.label,
    hypothesis: entry.hypothesis,
    placement: entry.placement,
    turnOrientation: entry.turnOrientation,
    control: entry.control,
    capture: {
      geometry: summarizeCapture(capture),
      lines: summarizeLines(capture.lines),
    },
    local,
    elapsedMs: round(performance.now() - started),
    simFrames: getSimFrames() - simBefore,
  };
}

function captureUnavailable(
  entry: ReturnType<typeof makeMirroredContactCaptureArcScreen>[number],
  index: number,
  capture: ReturnType<typeof realizeContactCaptureArc>,
  captureStatus: CaptureStatus,
  reason: string,
  started: number,
  simBefore: number,
  local: unknown = { status: captureStatus },
) {
  return {
    ...baseRow(entry, index, capture, local, started, simBefore),
    captureStatus,
    response: null,
    assay: { status: "not_attempted" as const, reason, actions: [] },
  };
}

function captureFailure(
  entry: ReturnType<typeof makeMirroredContactCaptureArcScreen>[number],
  index: number,
  captureStatus: CaptureStatus,
  error: unknown,
  started: number,
  simBefore: number,
  capture: ReturnType<typeof realizeContactCaptureArc> | undefined = undefined,
) {
  return {
    index,
    label: entry.label,
    hypothesis: entry.hypothesis,
    placement: entry.placement,
    turnOrientation: entry.turnOrientation,
    control: entry.control,
    capture: capture === undefined ? null : { geometry: summarizeCapture(capture), lines: summarizeLines(capture.lines) },
    local: { status: captureStatus, error: errorMessage(error) },
    captureStatus,
    response: null,
    assay: { status: "error" as const, reason: errorMessage(error), actions: [] },
    elapsedMs: round(performance.now() - started),
    simFrames: getSimFrames() - simBefore,
  };
}

function outOfScopeRow(impact: number | null) {
  return {
    index: null,
    label: "positive-impact-capture-required",
    hypothesis: "zero-impact contacts require an independently preregistered neutral-incidence formulation",
    placement: null,
    turnOrientation: null,
    control: null,
    capture: null,
    local: { status: "zero_impact_out_of_scope", authoredImpact: impact },
    captureStatus: "zero_impact_out_of_scope" as const,
    response: null,
    assay: { status: "not_attempted" as const, reason: "zero_impact_out_of_scope", actions: [] },
    elapsedMs: 0,
    simFrames: 0,
  };
}

function prefixTrace(engine: any, endFrame: number): ReturnType<typeof exactEngineStateTraceFingerprint> {
  return endFrame < 0 ? emptyEngineStateTraceFingerprint() : exactEngineStateTraceFingerprint(engine, 0, endFrame);
}

function collisionHits(engine: any, startFrame: number, endFrame: number, lineIds: ReadonlySet<number>) {
  const hits = [];
  for (let frame = startFrame; frame <= endFrame; frame++) {
    hits.push(...engineCollisionHitsForLineIds(engine, frame, lineIds));
  }
  return hits;
}

function contractAxes(input: PreparedTrajectoryFixtureCore): { air?: number; speed?: number } {
  return {
    ...(input.outgoing.targets.air === undefined ? {} : { air: input.outgoing.targets.air }),
    ...(input.outgoing.targets.speed === undefined ? {} : { speed: input.outgoing.targets.speed }),
  };
}

/** Pre-response gates must not use a later authored contact to forgive an event. */
function authoredContactFramesThrough(input: PreparedTrajectoryFixtureCore, endFrame: number): number[] {
  return input.ctx.allContactFrames.filter((frame) => frame <= endFrame);
}

function comparatorFailureReason(input: {
  captureOnlyComplete: boolean;
  captureObservationStable: boolean;
  namedAnchorStable: boolean;
  captureOnlyWindow: ReturnType<typeof measureCoMWindow>;
  namedTerminal: ReturnType<typeof namedReferenceState>;
  namedAtH: ReturnType<typeof namedReferenceState>;
  namedAtHPlusOne: ReturnType<typeof namedReferenceState>;
  captureOnlyOffBeatLandingFrames: readonly number[];
  captureOnlyUnresolvedOffBeatLandingFrames: readonly number[];
}): string {
  if (!input.captureOnlyComplete) return "capture_only_did_not_survive_or_measure_through_H_plus_Q";
  if (!input.captureObservationStable) return "capture_observation_or_impact_changed_when_extended_to_H_plus_Q";
  if (!input.namedAnchorStable) return "target_frame_reference_does_not_match_same_named_reference_at_H";
  if (input.namedAtH === null || input.namedAtHPlusOne === null) return "same_named_reference_unavailable_at_H_or_H_plus_1";
  if (input.namedTerminal === null) return "same_named_reference_unavailable_at_terminal";
  if (input.captureOnlyWindow === null) return "capture_only_com_window_unavailable";
  if (input.captureOnlyOffBeatLandingFrames.length > 0) return "capture_only_has_offbeat_landing_in_observation_window";
  if (input.captureOnlyUnresolvedOffBeatLandingFrames.length > 0) {
    return "capture_only_offbeat_landing_persistence_unresolved_at_observation_boundary";
  }
  return "unknown_comparator_failure";
}

function preHComparatorFailureReason(input: {
  captureOnlyPreHComplete: boolean;
  captureOnlyPreHTraceAvailable: boolean;
  captureObservationStableAtH: boolean;
  namedAnchorStable: boolean;
  namedAtH: ReturnType<typeof namedReferenceState>;
  namedAtHPlusOne: ReturnType<typeof namedReferenceState>;
  captureOnlyPreHOffBeatLandingFrames: readonly number[];
  captureOnlyPreHUnresolvedOffBeatLandingFrames: readonly number[];
}): string {
  if (!input.captureOnlyPreHComplete) return "capture_only_did_not_survive_or_measure_through_H";
  if (!input.captureOnlyPreHTraceAvailable) return "capture_only_full_engine_trace_unavailable_through_H";
  if (!input.captureObservationStableAtH) return "capture_observation_or_impact_changed_before_H";
  if (!input.namedAnchorStable) return "target_frame_reference_does_not_match_same_named_reference_at_H";
  if (input.namedAtH === null || input.namedAtHPlusOne === null) return "same_named_reference_unavailable_at_H_or_H_plus_1";
  if (input.captureOnlyPreHOffBeatLandingFrames.length > 0) return "capture_only_has_offbeat_landing_through_H";
  if (input.captureOnlyPreHUnresolvedOffBeatLandingFrames.length > 0) {
    return "capture_only_offbeat_landing_persistence_unresolved_at_H_boundary";
  }
  return "unknown_pre_H_comparator_failure";
}

function summarizeCapture(capture: ReturnType<typeof realizeContactCaptureArc>) {
  return {
    capturePoint: point(capture.capturePoint),
    handoff: { point: point(capture.handoff.point), tangentDeg: round(capture.handoff.tangentDeg) },
    turnOrientation: capture.turnOrientation,
    impactTurnDeg: round(capture.impactTurnDeg),
    entryTurnDeg: round(capture.entryTurnDeg),
    remainingTurnDeg: round(capture.remainingTurnDeg),
  };
}

function summarizeSlice(slice: ReturnType<typeof realizeExactSupportSlice>) {
  return {
    action: slice.action,
    constructionExtentFrames: slice.constructionExtentFrames,
    baseConstructionExtentPx: round(slice.baseConstructionExtentPx),
    extentPx: round(slice.extentPx),
    preloadPx: round(slice.preloadPx),
    phaseLeadSteps: slice.phaseLeadSteps,
    phaseLeadPx: round(slice.phaseLeadPx),
    railStart: point(slice.railStart),
    entryTangentDeg: round(slice.entryTangentDeg),
    entryFlipped: slice.entryFlipped,
    entryActiveNormal: point(slice.entryActiveNormal),
    entryNormalProjectionPx: round(slice.entryNormalProjectionPx),
    entryTangentProjectionPx: round(slice.entryTangentProjectionPx),
    minimumAdjacentActiveNormalDot: round(slice.minimumAdjacentActiveNormalDot),
    segments: slice.segments.map((segment) => ({
      lineId: segment.lineId,
      tangentDeg: round(segment.tangentDeg),
      activeNormal: point(segment.activeNormal),
      flipped: segment.flipped,
      lengthPx: round(segment.lengthPx),
    })),
    lines: summarizeLines(slice.lines),
    footprint: slice.footprint,
  };
}

function summarizeLines(lines: readonly TrackLine[]) {
  const lengths = lines.map((line) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1));
  return {
    lineCount: lines.length,
    lineHash: sha256(stableJson(lines)),
    totalLengthPx: round(lengths.reduce((sum, value) => sum + value, 0)),
    segmentLengthsPx: lengths.map(round),
    lineIds: lines.map((line) => line.id),
    endpointDirections: lines.map((line) => ({
      id: line.id,
      p1: point({ x: line.x1, y: line.y1 }),
      p2: point({ x: line.x2, y: line.y2 }),
      type: line.type,
      flipped: line.flipped,
      leftExtended: line.leftExtended,
      rightExtended: line.rightExtended,
    })),
  };
}

function summarizeAnchor(anchor: ReturnType<typeof targetFrameFromPlanningState>) {
  return {
    reference: point(anchor.reference),
    headingDeg: round(anchor.headingDeg),
    speedPxPerFrame: round(anchor.speedPxPerFrame),
    sledSpanPx: round(anchor.sledSpanPx),
    anchorPoint: anchor.anchorPoint,
    headingSource: anchor.headingSource,
  };
}

function summarizeReference(reference: NonNullable<ReturnType<typeof namedReferenceState>>) {
  return {
    point: reference.point,
    position: point(reference.position),
    velocity: point(reference.velocity),
    speedPxPerFrame: round(reference.speedPxPerFrame),
    headingDeg: round(reference.headingDeg),
  };
}

function summarizeCoMWindow(window: NonNullable<ReturnType<typeof measureCoMWindow>>) {
  return {
    startFrame: window.startFrame,
    endFrame: window.endFrame,
    measurementSamples: window.measurementSamples,
    airborneSamples: window.airborneSamples,
    airFraction: round(window.airFraction),
    meanSpeedPxPerFrame: round(window.meanSpeedPxPerFrame),
    meanSpeedAuthored: round(window.meanSpeedAuthored),
    terminal: {
      position: point(window.terminal.position),
      velocity: point(window.terminal.velocity),
      speedPxPerFrame: round(window.terminal.speedPxPerFrame),
      headingDeg: round(window.terminal.headingDeg),
    },
  };
}

function summarizeSupportContact(hits: readonly { frame: number; lineId: number; pointIds: string[] }[]) {
  return {
    status: hits.length === 0 ? "no_contact" as const : "contacted" as const,
    firstFrame: hits[0]?.frame ?? null,
    lastFrame: hits.at(-1)?.frame ?? null,
    collisionCount: hits.length,
    bodyPointIds: [...new Set(hits.flatMap((hit) => hit.pointIds))].sort(),
  };
}

function summarizeEffects(
  captureOnly: NonNullable<ReturnType<typeof measureCoMWindow>>,
  action: NonNullable<ReturnType<typeof measureCoMWindow>>,
  captureOnlyReference: NonNullable<ReturnType<typeof namedReferenceState>>,
  actionReference: NonNullable<ReturnType<typeof namedReferenceState>>,
  responseAnchor: ReturnType<typeof targetFrameFromPlanningState>,
) {
  return {
    coM: {
      airborneSamplesDelta: action.airborneSamples - captureOnly.airborneSamples,
      meanSpeedPxPerFrameDelta: round(action.meanSpeedPxPerFrame - captureOnly.meanSpeedPxPerFrame),
      meanSpeedAuthoredDelta: round(action.meanSpeedAuthored - captureOnly.meanSpeedAuthored),
      terminalPositionDeltaPx: round(Math.hypot(
        action.terminal.position.x - captureOnly.terminal.position.x,
        action.terminal.position.y - captureOnly.terminal.position.y,
      )),
      terminalSpeedPxPerFrameDelta: round(action.terminal.speedPxPerFrame - captureOnly.terminal.speedPxPerFrame),
      terminalHeadingDeltaDeg: round(angleDeltaDeg(action.terminal.headingDeg, captureOnly.terminal.headingDeg)),
    },
    namedReference: {
      point: responseAnchor.anchorPoint,
      actionTerminalHeadingRelativeToH: round(angleDeltaDeg(actionReference.headingDeg, responseAnchor.headingDeg)),
      captureOnlyTerminalHeadingRelativeToH: round(angleDeltaDeg(captureOnlyReference.headingDeg, responseAnchor.headingDeg)),
      terminalHeadingDeltaDeg: round(angleDeltaDeg(actionReference.headingDeg, captureOnlyReference.headingDeg)),
      terminalSpeedPxPerFrameDelta: round(actionReference.speedPxPerFrame - captureOnlyReference.speedPxPerFrame),
      terminalPositionDeltaPx: round(Math.hypot(
        actionReference.position.x - captureOnlyReference.position.x,
        actionReference.position.y - captureOnlyReference.position.y,
      )),
    },
  };
}

type ExactSupportSliceStudyRow = ReturnType<typeof evaluateRow> | ReturnType<typeof outOfScopeRow>;
type ConstructionPhaseEvidence = {
  constructionPhases: readonly ReturnType<typeof evaluateConstructionPhase>[];
  selectedPhaseLeadSteps: (typeof EXACT_SUPPORT_SLICE_PHASE_LEAD_STEPS)[number] | null;
};

function constructionPhaseEvidence(row: ExactSupportSliceStudyRow): ConstructionPhaseEvidence | null {
  const assay = row.assay;
  if (!("constructionPhases" in assay) || !("selectedPhaseLeadSteps" in assay) ||
      !Array.isArray(assay.constructionPhases)) return null;
  const selected = assay.selectedPhaseLeadSteps;
  if (selected !== null && !(EXACT_SUPPORT_SLICE_PHASE_LEAD_STEPS as readonly number[]).includes(selected as number)) {
    throw new Error("construction phase record has an undeclared selected lead");
  }
  return {
    constructionPhases: assay.constructionPhases,
    selectedPhaseLeadSteps: selected as ConstructionPhaseEvidence["selectedPhaseLeadSteps"],
  };
}

function summarizeRows(rows: readonly ExactSupportSliceStudyRow[]) {
  const captureRows = rows.length;
  const captureClosed = rows.filter((row) => row.captureStatus === "closed").length;
  const readyRows = rows.filter((row) => row.assay.status === "ready");
  const phaseRows = rows.flatMap((row) => {
    const evidence = constructionPhaseEvidence(row);
    return evidence === null ? [] : [{ row, evidence }];
  });
  const constructionPhases = phaseRows.flatMap(({ evidence }) => evidence.constructionPhases);
  const constructionProbeActions = constructionPhases.flatMap((phase) => phase.actions);
  const constructionProbeErrors = constructionProbeActions.filter((action) => action.status === "error");
  const invalidConstructionProbeActions = constructionProbeActions.filter((action) =>
    action.status === "observed" && action.protocolInvalid,
  );
  const constructionUnavailableRows = rows.filter((row) => row.assay.status === "construction_unavailable");
  const constructionInvalidRows = rows.filter((row) => row.assay.status === "construction_invalid");
  const selectedPhaseLeadCounts = countBy(
    phaseRows.flatMap(({ evidence }) => evidence.selectedPhaseLeadSteps === null ? [] : [evidence.selectedPhaseLeadSteps]),
    (lead) => String(lead),
  );
  const actions = readyRows.flatMap((row) => row.assay.actions);
  const observedActions = actions.filter((action) => action.status === "observed");
  const structurallyValid = observedActions.filter((action) => action.structurallyValid);
  const invalidConstructionActions = observedActions.filter((action) => !action.guards.constructionValid);
  const completePairedRows = readyRows.filter((row) =>
    row.assay.actions.length === EXACT_SUPPORT_SLICE_RAIL_ACTIONS.length &&
    row.assay.actions.every((action) => action.status === "observed" && action.structurallyValid && action.effectsFromCaptureOnly !== null),
  );
  const byAction = Object.fromEntries(EXACT_SUPPORT_SLICE_RAIL_ACTIONS.map((declared) => {
    const records = actions.filter((action) => action.action.id === declared.id);
    const observed = records.filter((record) => record.status === "observed");
    const valid = observed.filter((record) => record.structurallyValid && record.effectsFromCaptureOnly !== null);
    const paired = completePairedRows.flatMap((row) => row.assay.actions)
      .filter((record) => record.action.id === declared.id && record.status === "observed" && record.effectsFromCaptureOnly !== null);
    return [declared.id, {
      declared,
      attempted: records.length,
      observed: observed.length,
      structurallyValid: valid.length,
      invalidConstruction: observed.filter((record) => !record.guards.constructionValid).length,
      noSupportContact: observed.filter((record) => record.supportContact.status === "no_contact").length,
      availabilityConditionedEffects: summarizeEffectRecords(valid),
      completePairedEffects: summarizeEffectRecords(paired),
    }];
  }));
  return {
    captureRows,
    captureClosed,
    captureByStatus: countBy(rows, (row) => row.captureStatus),
    assayByStatus: countBy(rows, (row) => row.assay.status),
    constructionPhaseAttempts: constructionPhases.length,
    constructionProbeActions: constructionProbeActions.length,
    constructionSafePhaseCandidates: constructionPhases.filter((phase) => phase.sharedConstructionSafe).length,
    constructionCollisionOnlyRejectedPhaseCandidates: constructionPhases.filter((phase) => phase.collisionOnlyRejection).length,
    invalidConstructionProbeActions: invalidConstructionProbeActions.length,
    constructionProbeErrors: constructionProbeErrors.length,
    constructionUnavailableRows: constructionUnavailableRows.length,
    constructionInvalidRows: constructionInvalidRows.length,
    selectedPhaseLeadCounts,
    actionAttempts: actions.length,
    observedActions: observedActions.length,
    structurallyValidActions: structurallyValid.length,
    invalidConstructionActions: invalidConstructionActions.length,
    rowErrors: rows.filter((row) => row.captureStatus === "error").length +
      actions.filter((action) => action.status === "error").length + constructionProbeErrors.length,
    completePairedRows: completePairedRows.length,
    completePairedRowIndices: completePairedRows.map((row) => row.index),
    byAction,
    interpretation: "Construction phases are deterministic through-H feasibility probes using a locked capture-only H-to-H+1 geometry observation, not action outcomes; only the first shared-safe phase can produce a post-H action replay. Per-action availability-conditioned effects are diagnostic only; comparisons belong to completePairedEffects, which uses rows structurally valid for every declared arm. No action ranking, action selection, whole-gap conclusion, or statistical replicate claim is encoded.",
  };
}

function summarizeEffectRecords(records: readonly { effectsFromCaptureOnly: ReturnType<typeof summarizeEffects> | null }[]) {
  const effects = records.flatMap((record) => record.effectsFromCaptureOnly === null ? [] : [record.effectsFromCaptureOnly]);
  return {
    rows: effects.length,
    meanAirborneSamplesDelta: mean(effects.map((effect) => effect.coM.airborneSamplesDelta)),
    meanCoMSpeedAuthoredDelta: mean(effects.map((effect) => effect.coM.meanSpeedAuthoredDelta)),
    meanReferenceHeadingDeltaDeg: mean(effects.map((effect) => effect.namedReference.terminalHeadingDeltaDeg)),
  };
}

function countBy<T>(values: readonly T[], key: (value: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const label = key(value);
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return counts;
}

function samePoint(left: { x: number; y: number }, right: { x: number; y: number }): boolean {
  return Object.is(left.x, right.x) && Object.is(left.y, right.y);
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function point(value: { x: number; y: number }) {
  return { x: round(value.x), y: round(value.y) };
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
