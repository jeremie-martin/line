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
  EXACT_SUPPORT_SLICE_RAIL_ACTIONS,
  realizeExactSupportSlice,
  resolveExactSupportSliceOrientation,
} from "./trajectory/exact_support_slice.ts";
import {
  angleDeltaDeg,
  displacement,
  exactSupportSliceHorizon,
  measureCoMWindow,
  namedReferenceState,
  offBeatLandingsInWindow,
  remainingAirSpeedBudget,
  sameExactEngineTrace,
  sameOwnedCaptureEvent,
  sameScoredContactImpact,
} from "./trajectory/exact_support_slice_assay.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import { scoredContactImpact } from "./trajectory/scored_contact_impact.ts";
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
const LOCAL_CAPTURE_OBSERVATION_FRAMES = 16;
const STUDY_SCHEMA = "line.study-exact-postimpact-support-slice.v1";

const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_exact_support_slice.ts --fixture=FILE [--out=FILE]",
    "",
    "Runs the fixed capture-only plus five-rail exact support-slice assay.",
    "Calibration-only; only stable V3 fixtures are accepted and no tuning flags exist.",
  ].join("\n") + "\n");
  process.exit(0);
}

const fixturePath = argument("fixture");
if (fixturePath === undefined) throw new Error("--fixture=FILE is required");
const explicitOut = argument("out");
const unsupported = argv.filter((value) => value.startsWith("--") && !value.startsWith("--fixture=") && !value.startsWith("--out="));
if (unsupported.length > 0) throw new Error(`unsupported exact-support-slice control(s): ${unsupported.join(", ")}`);
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
  railActions: EXACT_SUPPORT_SLICE_RAIL_ACTIONS,
  responseBoundary: "H = selected_owned_event.frame + IMPACT_WINDOW + 1",
  horizon: "Q = min(12, outgoing.endFrame - H); Q >= 4; observe [H,H+Q] inclusive",
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
  : summary.invalidConstructionActions > 0
  ? "complete_with_invalid_construction_actions"
  : "complete";
const output = {
  schema: STUDY_SCHEMA,
  artifactIdentity,
  purpose: [
    "Measure the exact local response of one fixed tangent-aligned offset rail stencil after a captured contact.",
    "Retain every capture, comparator, and rail action; never select or promote an action from calibration output.",
    "Authorize at most a separately declared receding-rollout feasibility study when the preregistered physical endpoint is met.",
  ],
  status: {
    protocolStatus,
    executionComplete: identityStable && summary.rowErrors === 0,
    claimEligible: identityStable && summary.rowErrors === 0 && summary.invalidConstructionActions === 0 && summary.completePairedRows > 0,
    claimEligibility: !identityStable
      ? "invalid: source or observed compiler identity changed during replay"
      : summary.rowErrors > 0
      ? "invalid: unexpected row or action runtime error"
      : summary.invalidConstructionActions > 0
      ? "invalid for physical inference: one or more rails changed the protected prefix/capture or collided through H"
      : summary.completePairedRows === 0
      ? "unavailable: no row completed every declared rail under the structural contract"
      : "eligible only for descriptive local rail response on this calibration fixture; it is not a rollout or compiler decision",
    productionIntegration: "forbidden: fixed calibration assay, not a compiler generator, source default, or selector",
    cohortPolicy: "stable V3 calibration fixtures only; production and qualification specifications remain held out",
    fixedArms: ["capture-only", ...EXACT_SUPPORT_SLICE_RAIL_ACTIONS.map((action) => action.id)],
  },
  protocol: {
    protocolFingerprint,
    localCaptureObservationFrames: LOCAL_CAPTURE_OBSERVATION_FRAMES,
    responseBoundary: "H = selected_owned_event.frame + IMPACT_WINDOW + 1",
    horizon: "Q = min(12, outgoing.endFrame - H); Q >= 4; [H,H+Q] is inclusive and contains Q+1 samples",
    railProtocol: EXACT_SUPPORT_SLICE_PROTOCOL,
    railActions: EXACT_SUPPORT_SLICE_RAIL_ACTIONS,
    geometryInputs: [
      "exact_named_response_anchor_at_H",
      "capture_only_same_named_reference_displacement_H_to_H_plus_1",
      "outgoing_interval_end_only_for_local_horizon_cap",
    ],
    withheldFromGeometry: [
      "outgoing_authored_axes",
      "next_contact_event_or_target",
      "duration_class",
      "case_id",
      "seed",
      "optimizer_score",
    ],
    structuralEndpoint: "full non-scarf identity over the physical prefix and capture-only comparator through H inclusive; zero all-body support collision through H inclusive; same selected capture event and scorer impact; strict survival, readable [H,H+Q] measurements, and no off-beat landing",
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
      geometryInput: "only outgoing.endFrame caps Q; no authored outgoing axis or next-event field reaches rail geometry",
    },
  },
  rows,
  summary,
  caveats: [
    "Static rail terrain is constructed from a later exact capture-only observation. Full prefix and capture-only-through-H identity, plus zero pre/equal-H rail collision, are mandatory guards against retroactive intrusion.",
    "The H to H+1 reference displacement is not a target or predicted force law. It chooses only the one-sided normal of the declared rail before action outcomes are observed.",
    "The outgoing endpoint is read solely to cap an otherwise fixed local horizon. This does not use a duration class, next-event target, or authored axis, but it is an explicit future-boundary dependency.",
    "CoM detector air/speed and named-reference terminal state are reported separately. A Q-frame response cannot establish whole-gap satisfaction, score improvement, or a compiler action choice.",
    "Rows are deterministic conditional observations, not independent statistical replicates. The 3-7 second rideout ladder remains one correlated capability family.",
    "Identity is sampled before and after replay over the static import closure plus observed compiler/engine fingerprint. Literal byte-snapshot evidence still requires an external immutable workspace.",
  ],
};

const canonicalOutPath = explicitOut ??
  `generated/studies/exact-support-slice/v1/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}-${artifactIdentity.fingerprint.slice(0, 12)}.json`;
const outPath = !identityStable
  ? allocateStudyArtifactPath(forensicDriftArtifactPath(canonicalOutPath, sourceIdentityAtEnd.studySourceFingerprint, observationCompilerAtEnd.candidateFingerprint))
  : explicitOut ?? allocateStudyArtifactPath(canonicalOutPath);
writeStudyArtifact(outPath, output);
process.stderr.write(
  `exact support slice ${prepared.panel.id}: ${summary.structurallyValidActions}/${summary.actionAttempts} structurally valid rails, ` +
  `${summary.captureClosed}/${summary.captureRows} closed captures -> ${outPath}\n`,
);
if (!identityStable || summary.rowErrors > 0 || summary.invalidConstructionActions > 0) {
  const reason = !identityStable
    ? "identity drift"
    : summary.rowErrors > 0
    ? `${summary.rowErrors} unexpected row/action error(s)`
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
    const localEnd = Math.min(input.outgoing.endFrame, input.current.endFrame + LOCAL_CAPTURE_OBSERVATION_FRAMES);
    const localDetection = detectWindow(captureEngine, 0, localEnd);
    const localObservation = observeCapture(localDetection, input, captureLines, captureRoles, localEnd);
    const physicalPrefixTrace = prefixTrace(captureEngine, input.current.startFrame - 1);
    const localImpact = captureImpact(localDetection, localObservation, input);
    const captureStatus = sameExactEngineTrace(physicalPrefixTrace, baselinePhysicalPrefixTrace)
      ? classifyCapture(localDetection, localObservation, input, localEnd)
      : "physical_prefix_changed" as const;
    const local = summarizeCaptureLocal(
      localDetection,
      localObservation,
      localImpact,
      captureStatus,
      physicalPrefixTrace,
      baselinePhysicalPrefixTrace,
      input,
      localEnd,
    );
    if (captureStatus !== "closed") {
      return captureUnavailable(entry, index, capture, captureStatus, `capture_${captureStatus}`, started, simBefore, local);
    }
    const selected = localObservation.selectedOwnedEvent;
    if (selected === null) throw new Error("closed capture lacks a selected owned event");
    const supportStartFrame = selected.frame + IMPACT_WINDOW + 1;
    const horizon = exactSupportSliceHorizon(input.outgoing.endFrame, supportStartFrame);
    if (horizon.status !== "ready") {
      return {
        ...baseRow(entry, index, capture, local, started, simBefore),
        captureStatus: "closed" as const,
        response: { eventFrame: selected.frame, supportStartFrame, horizon },
        assay: { status: "insufficient_support_horizon" as const, reason: horizon.status, actions: [] },
      };
    }
    const actionEndFrame = supportStartFrame + horizon.horizonFrames;
    const captureOnlyDetection = detectWindow(captureEngine, 0, actionEndFrame);
    const captureOnlyObservation = observeCapture(captureOnlyDetection, input, captureLines, captureRoles, actionEndFrame);
    const captureOnlyImpact = captureImpact(captureOnlyDetection, captureOnlyObservation, input);
    const captureOnlyTrace = exactEngineStateTraceFingerprint(captureEngine, input.outgoing.startFrame, supportStartFrame);
    const captureOnlyWindow = measureCoMWindow(captureOnlyDetection, supportStartFrame, actionEndFrame);
    const captureOnlyOffBeatLandingFrames = offBeatLandingsInWindow(
      captureOnlyDetection,
      input.ctx.allContactFrames,
      supportStartFrame,
      actionEndFrame,
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
    const namedTerminal = responseAnchor === null
      ? null
      : namedReferenceState(extractPlanningState(captureEngine, actionEndFrame), responseAnchor.anchorPoint);
    const captureOnlyComplete = survivesThroughFrame(captureOnlyDetection, actionEndFrame) &&
      measurementLastFrame(captureOnlyDetection) >= actionEndFrame;
    const captureObservationStable = sameOwnedCaptureEvent(localObservation.selectedOwnedEvent, captureOnlyObservation.selectedOwnedEvent) &&
      sameScoredContactImpact(localImpact, captureOnlyImpact);
    const namedAnchorStable = responseAnchor !== null && namedAtH !== null &&
      samePoint(responseAnchor.reference, namedAtH.position);
    const comparatorReady = captureOnlyComplete && captureOnlyWindow !== null && namedTerminal !== null &&
      namedAtH !== null && namedAtHPlusOne !== null && captureObservationStable && namedAnchorStable &&
      captureOnlyOffBeatLandingFrames.length === 0;
    const response = {
      eventFrame: selected.frame,
      supportStartFrame,
      horizon,
      actionEndFrame,
      anchor: responseAnchor === null ? null : summarizeAnchor(responseAnchor),
      namedReferenceAtH: namedAtH === null ? null : summarizeReference(namedAtH),
      namedReferenceAtHPlusOne: namedAtHPlusOne === null ? null : summarizeReference(namedAtHPlusOne),
      captureOnlyReferenceDisplacement: namedAtH === null || namedAtHPlusOne === null
        ? null
        : point(displacement(namedAtH.position, namedAtHPlusOne.position)),
      namedAnchorMatchesTargetFrame: namedAnchorStable,
    };
    const comparator = {
      complete: captureOnlyComplete,
      observationMatchesLocalCapture: captureObservationStable,
      captureTrace: captureOnlyTrace,
      offBeatLandingFrames: captureOnlyOffBeatLandingFrames,
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
    };
    if (!comparatorReady || responseState === null || responseAnchor === null || namedAtH === null || namedAtHPlusOne === null) {
      return {
        ...baseRow(entry, index, capture, local, started, simBefore),
        captureStatus: "closed" as const,
        response,
        comparator,
        assay: {
          status: "comparator_unavailable" as const,
          reason: comparatorFailureReason({ captureOnlyComplete, captureObservationStable, namedAnchorStable, captureOnlyWindow, namedTerminal, namedAtH, namedAtHPlusOne, captureOnlyOffBeatLandingFrames }),
          actions: [],
        },
      };
    }
    const displacementHToHPlusOne = displacement(namedAtH.position, namedAtHPlusOne.position);
    let orientation: ReturnType<typeof resolveExactSupportSliceOrientation>;
    try {
      orientation = resolveExactSupportSliceOrientation({
        anchor: responseAnchor,
        captureOnlyReferenceDisplacement: displacementHToHPlusOne,
      });
    } catch (error) {
      return {
        ...baseRow(entry, index, capture, local, started, simBefore),
        captureStatus: "closed" as const,
        response,
        comparator,
        assay: { status: "orientation_unavailable" as const, reason: errorMessage(error), actions: [] },
      };
    }
    const actions = EXACT_SUPPORT_SLICE_RAIL_ACTIONS.map((action) => evaluateAction({
      action,
      input,
      captureLines,
      captureRoles,
      captureOnlyObservation,
      captureOnlyImpact,
      captureOnlyTrace,
      captureOnlyWindow,
      captureOnlyTerminalReference: namedTerminal,
      responseAnchor,
      responseCoMState: responseState,
      supportStartFrame,
      actionEndFrame,
      horizonFrames: horizon.horizonFrames,
      captureOnlyReferenceDisplacement: displacementHToHPlusOne,
      baselinePhysicalPrefixTrace,
      orientation,
    }));
    return {
      ...baseRow(entry, index, capture, local, started, simBefore),
      captureStatus: "closed" as const,
      response,
      comparator,
      assay: { status: "ready" as const, actions },
    };
  } catch (error) {
    return captureFailure(entry, index, "error", error, started, simBefore, capture);
  }
}

function evaluateAction(input: {
  action: (typeof EXACT_SUPPORT_SLICE_RAIL_ACTIONS)[number];
  input: PreparedTrajectoryFixtureCore;
  captureLines: TrackLine[];
  captureRoles: ReadonlyMap<number, string>;
  captureOnlyObservation: OwnedContactObservation;
  captureOnlyImpact: ReturnType<typeof captureImpact>;
  captureOnlyTrace: ReturnType<typeof exactEngineStateTraceFingerprint>;
  captureOnlyWindow: NonNullable<ReturnType<typeof measureCoMWindow>>;
  captureOnlyTerminalReference: NonNullable<ReturnType<typeof namedReferenceState>>;
  responseAnchor: ReturnType<typeof targetFrameFromPlanningState>;
  responseCoMState: NonNullable<ReturnType<typeof extractPlanningState>>;
  supportStartFrame: number;
  actionEndFrame: number;
  horizonFrames: number;
  captureOnlyReferenceDisplacement: { x: number; y: number };
  baselinePhysicalPrefixTrace: ReturnType<typeof exactEngineStateTraceFingerprint>;
  orientation: ReturnType<typeof resolveExactSupportSliceOrientation>;
}) {
  const started = performance.now();
  const simBefore = getSimFrames();
  try {
    const slice = realizeExactSupportSlice({
      anchor: input.responseAnchor,
      captureOnlyReferenceDisplacement: input.captureOnlyReferenceDisplacement,
      horizonFrames: input.horizonFrames,
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
    const offBeatLandingFrames = offBeatLandingsInWindow(
      detection,
      input.input.ctx.allContactFrames,
      input.supportStartFrame,
      input.actionEndFrame,
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
      offBeatLandingFrames.length === 0;
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
  localEnd: number,
): CaptureStatus {
  if (!survivesThroughFrame(detection, localEnd)) return "survival";
  if (observation.selectedOwnedEvent === null) return "landing";
  if (!observation.responseWindowComplete) return "response_unavailable";
  if (!observation.persistenceWindowComplete) return "persistence_unavailable";
  const offBeat = offBeatLandingsInWindow(detection, input.ctx.allContactFrames, input.current.startFrame, localEnd);
  if (offBeat.length > 0) return "offbeat";
  return "closed";
}

function summarizeCaptureLocal(
  detection: ReturnType<typeof detectWindow>,
  observation: OwnedContactObservation,
  impact: ReturnType<typeof captureImpact>,
  status: CaptureStatus,
  physicalPrefixTrace: ReturnType<typeof exactEngineStateTraceFingerprint>,
  baselinePhysicalPrefixTrace: ReturnType<typeof exactEngineStateTraceFingerprint>,
  input: PreparedTrajectoryFixtureCore,
  localEnd: number,
) {
  return {
    status,
    observationEndFrame: localEnd,
    terminus: detection.terminus,
    selectedOwnedEvent: observation.selectedOwnedEvent,
    persistenceWindowComplete: observation.persistenceWindowComplete,
    responseWindowComplete: observation.responseWindowComplete,
    impact,
    offBeatLandingFrames: offBeatLandingsInWindow(detection, input.ctx.allContactFrames, input.current.startFrame, localEnd),
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

function comparatorFailureReason(input: {
  captureOnlyComplete: boolean;
  captureObservationStable: boolean;
  namedAnchorStable: boolean;
  captureOnlyWindow: ReturnType<typeof measureCoMWindow>;
  namedTerminal: ReturnType<typeof namedReferenceState>;
  namedAtH: ReturnType<typeof namedReferenceState>;
  namedAtHPlusOne: ReturnType<typeof namedReferenceState>;
  captureOnlyOffBeatLandingFrames: readonly number[];
}): string {
  if (!input.captureOnlyComplete) return "capture_only_did_not_survive_or_measure_through_H_plus_Q";
  if (!input.captureObservationStable) return "capture_observation_or_impact_changed_when_extended_to_H_plus_Q";
  if (!input.namedAnchorStable) return "target_frame_reference_does_not_match_same_named_reference_at_H";
  if (input.namedAtH === null || input.namedAtHPlusOne === null) return "same_named_reference_unavailable_at_H_or_H_plus_1";
  if (input.namedTerminal === null) return "same_named_reference_unavailable_at_terminal";
  if (input.captureOnlyWindow === null) return "capture_only_com_window_unavailable";
  if (input.captureOnlyOffBeatLandingFrames.length > 0) return "capture_only_has_offbeat_landing_in_observation_window";
  return "unknown_comparator_failure";
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
    horizonFrames: slice.horizonFrames,
    baseExtentPx: round(slice.baseExtentPx),
    extentPx: round(slice.extentPx),
    preloadPx: round(slice.preloadPx),
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

function summarizeRows(rows: readonly ExactSupportSliceStudyRow[]) {
  const captureRows = rows.length;
  const captureClosed = rows.filter((row) => row.captureStatus === "closed").length;
  const readyRows = rows.filter((row) => row.assay.status === "ready");
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
    return [declared.id, {
      declared,
      attempted: records.length,
      observed: observed.length,
      structurallyValid: valid.length,
      invalidConstruction: observed.filter((record) => !record.guards.constructionValid).length,
      noSupportContact: observed.filter((record) => record.supportContact.status === "no_contact").length,
      descriptiveValidEffects: summarizeEffectRecords(valid),
    }];
  }));
  return {
    captureRows,
    captureClosed,
    captureByStatus: countBy(rows, (row) => row.captureStatus),
    assayByStatus: countBy(rows, (row) => row.assay.status),
    actionAttempts: actions.length,
    observedActions: observedActions.length,
    structurallyValidActions: structurallyValid.length,
    invalidConstructionActions: invalidConstructionActions.length,
    rowErrors: rows.filter((row) => row.captureStatus === "error").length + actions.filter((action) => action.status === "error").length,
    completePairedRows: completePairedRows.length,
    completePairedRowIndices: completePairedRows.map((row) => row.index),
    byAction,
    interpretation: "Counts are deterministic conditional observations on one calibration fixture. No action ranking, action selection, whole-gap conclusion, or statistical replicate claim is encoded.",
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
