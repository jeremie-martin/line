/**
 * Exact local response assay for state-shot terrain support.
 *
 * This is deliberately narrower than the full outgoing feasibility study. It
 * holds a fixed mirrored capture screen constant, observes the exact response
 * state, then applies every member of one predeclared action stencil for a
 * fixed short horizon. It is not a compiler candidate source, optimizer menu,
 * control solver, or a basis for selecting an action.
 */
import { PERSISTENCE_FRAMES } from "../lib/detector.ts";
import { hasPreTargetSledProximityFromTrace } from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { detectWindow } from "./core/candidate.ts";
import {
  airborneAt,
  contactLineIdsAt,
  engineLineFromTrackLine,
  measurementLastFrame,
  offBeatLandingEvents,
  positionAt,
  speedAt,
  velocityAt,
} from "./core/substrate.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { IMPACT_WINDOW, speedPxToAuthored, type TrackLine } from "./types.ts";
import {
  realizeContactCaptureArc,
  resolveContactCaptureArc,
} from "./trajectory/contact_capture_arc.ts";
import { makeMirroredContactCaptureArcScreen } from "./trajectory/contact_capture_arc_design.ts";
import { contactKinematicFrameFromPlanningState } from "./trajectory/contact_kinematic_frame.ts";
import { observeOwnedContactTransition } from "./trajectory/contact_observation.ts";
import { realizeSupportPath } from "./trajectory/envelope/realizer.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import { scoredContactImpact } from "./trajectory/scored_contact_impact.ts";
import { extractPlanningState } from "./trajectory/state.ts";
import {
  planStateSupportResponse,
  stateSupportResponseActions,
  type StateSupportResponseMenu,
  type StateSupportResponseAction,
} from "./trajectory/state_support_response.ts";
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
  exactTraceFingerprint,
  survivesThroughFrame,
} from "./trajectory/study_trace.ts";
import { targetFrameFromPlanningState } from "./trajectory/target_frame.ts";
import { transitionContractForGap } from "./trajectory/transition_contract.ts";

const argv = process.argv.slice(2);
const LOCAL_SURVIVAL_WINDOW_FRAMES = 16;
const RESPONSE_HORIZON_FRAMES = 12;

const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_state_support_response.ts --fixture=FILE [--menu=coarse-v1|threshold-v1] [--out=FILE]",
    "",
    "Runs one fixed 12-frame, seven-action exact response assay after every",
    "closed mirrored capture row. Calibration-only; no tuning flags are accepted.",
  ].join("\n") + "\n");
  process.exit(0);
}

const fixturePath = argument("fixture");
if (fixturePath === undefined) throw new Error("--fixture=FILE is required");
const menuName = argument("menu") ?? "coarse-v1";
if (menuName !== "coarse-v1" && menuName !== "threshold-v1") {
  throw new Error(`unknown --menu=${menuName}; expected coarse-v1 or threshold-v1`);
}
const responseMenu = menuName as StateSupportResponseMenu;
const actionMenu = stateSupportResponseActions(responseMenu);
const unsupported = argv.filter((value) =>
  value.startsWith("--") && !value.startsWith("--fixture=") && !value.startsWith("--menu=") && !value.startsWith("--out="),
);
if (unsupported.length > 0) throw new Error(`unsupported assay control(s): ${unsupported.join(", ")}`);
const explicitOut = argument("out");

const fixture = readFrozenTrajectoryFixture(fixturePath);
const STUDY_SCHEMA = "line.study-state-support-response.v4";
const protocolFingerprint = sha256(stableJson({
  responseMenu,
  actions: actionMenu,
  localSurvivalWindowFrames: LOCAL_SURVIVAL_WINDOW_FRAMES,
  responseHorizonFrames: RESPONSE_HORIZON_FRAMES,
}));
const engineName = activeStudyEngine();
const sourceIdentityAtStart = studySourceIdentity("scripts/v0/study_state_support_response.ts");
const observationCompilerAtStart = compilerCandidateIdentity(engineName);
const artifactIdentity = studyArtifactIdentity({
  schema: STUDY_SCHEMA,
  fixtureFingerprint: fixture.fixtureFingerprint,
  studySourceFingerprint: sourceIdentityAtStart.studySourceFingerprint,
  observationCandidateFingerprint: observationCompilerAtStart.candidateFingerprint,
  protocolFingerprint,
});
if (explicitOut !== undefined) assertStudyArtifactPathUnused(explicitOut);
const started = performance.now();
const prepared = prepareStateCoupledTrajectoryFixture(fixture);
if (prepared.panel.cohort !== "calibration") {
  throw new Error(`state support response accepts only calibration fixtures; ${prepared.panel.id} is ${prepared.panel.cohort}`);
}
const contract = transitionContractForGap(prepared.current, prepared.outgoing, prepared.setup.gapAxisTargets);
if (contract.outgoing === null) throw new Error("frozen contact fixture has no outgoing interval");
const kinematic = contactKinematicFrameFromPlanningState(
  prepared.state,
  prepared.frame,
  { impact: contract.event.impact ?? undefined },
);
const screen = makeMirroredContactCaptureArcScreen(kinematic);
const physicalPrefixEndFrame = prepared.current.startFrame - 1;
const baselinePhysicalPrefixTrace = prefixTrace(prepared.engine, physicalPrefixEndFrame);
const rows = screen.map((entry, index) =>
  evaluateRow(entry, index, prepared, contract.event.impact, actionMenu, baselinePhysicalPrefixTrace),
);
const summary = summarizeRows(rows);
const sourceIdentityAtEnd = studySourceIdentity("scripts/v0/study_state_support_response.ts");
const observationCompilerAtEnd = compilerCandidateIdentity(engineName);
const identityStable = sourceIdentityAtStart.studySourceFingerprint === sourceIdentityAtEnd.studySourceFingerprint &&
  observationCompilerAtStart.candidateFingerprint === observationCompilerAtEnd.candidateFingerprint;
const protocolStatus = !identityStable
  ? "invalid_identity_drift"
  : summary.rowErrors === 0
  ? "complete"
  : "invalid_runtime_error";
const output = {
  schema: STUDY_SCHEMA,
  artifactIdentity,
  purpose: [
    "Measure directional exact-engine response to a fixed, state-normalized support action stencil.",
    "Retain every capture and action row; do not select an action or solve a control target.",
    "Use this only to decide whether a later receding exact rollout is scientifically justified.",
  ],
  status: {
    protocolStatus,
    executionComplete: identityStable && summary.rowErrors === 0,
    actionAvailable: summary.actionAttempts > 0,
    claimEligible: identityStable && summary.rowErrors === 0 && summary.completePaired.rows > 0,
    claimEligibility: !identityStable
      ? "invalid: source or observed compiler identity changed during replay"
      : summary.rowErrors > 0
      ? "invalid: unexpected runtime error"
      : summary.actionAttempts === 0
      ? "unavailable: no closed capture had the fixed local horizon"
      : summary.completePaired.rows === 0
      ? "unavailable: no capture row completed every declared action structurally"
      : "eligible only for the tested one-shot local action form and this calibration cohort",
    productionIntegration: "forbidden: calibration response assay, not compiler code or a selection menu",
    cohortPolicy: "calibration only; a clean held-out cohort is required after a formulation and fixed rollout policy exist",
    captureMenu: "fixed mirrored 24-row positive-impact capture screen",
    actionMenu: {
      name: responseMenu,
      horizonFrames: RESPONSE_HORIZON_FRAMES,
      actions: actionMenu,
      meaning: "fixed local response stencil; no action is selected, interpolated, or promoted",
    },
    structuralEndpoint: "full non-scarf engine-state identity before the current gap and against capture-only replay through H-1, no all-body support collision before H, same owned capture event, survival strictly beyond the local horizon unless end-of-spec occurs at it, and no off-beat landing",
  },
  protocol: { protocolFingerprint },
  argv: [...argv],
  elapsedMs: round(performance.now() - started),
  provenance: {
    fixturePath,
    fixtureFingerprint: fixture.fixtureFingerprint,
    captureCompiler: fixture.captureCompiler,
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
      plannerInput: "none: this local assay reads only the observed response state and fixed action menu",
    },
  },
  rows,
  summary,
  caveats: [
    "The static support path is constructed from a future observed state, so every action must prove full-engine identity before the current gap and against capture-only replay through H-1, plus no all-body pre-H support collision.",
    "Identity is sampled before and after replay over the static import closure plus observed compiler/engine fingerprint. In-process module loading precedes that first sample, so archival evidence requiring a literal byte snapshot must run from an external immutable workspace.",
    "The local horizon is intentionally not a full-gap score or a next-contact proposal. Its air/speed/heading outputs are response measurements, not benchmark fitness.",
    "Complete-paired rows are the causal response summary. Per-action observed means retain failures as descriptive telemetry but do not use a common denominator.",
    "This assay can reject the tested one-shot grade form as an independent local actuator; it does not establish or reject every possible multi-chunk grade controller.",
    "The realizer's current global +/-85 degree tangent guard is an explicit study-envelope limitation, not a physical generator constraint.",
    "The 3/4/5/6/7-second ladder is one correlated capability family and is not independent statistical evidence.",
  ],
};

const canonicalOutPath = explicitOut ??
  `generated/studies/state-support-response/${responseMenu}/v4/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}-${artifactIdentity.fingerprint.slice(0, 12)}.json`;
const outPath = !identityStable
  ? allocateStudyArtifactPath(forensicDriftArtifactPath(canonicalOutPath, sourceIdentityAtEnd.studySourceFingerprint, observationCompilerAtEnd.candidateFingerprint))
  : explicitOut ?? allocateStudyArtifactPath(canonicalOutPath);
writeStudyArtifact(outPath, output);
process.stderr.write(
  `state support response ${prepared.panel.id}: ${summary.structurallyValidActions}/${summary.actionAttempts} structurally valid actions, ` +
  `${summary.captureClosed}/${summary.captureRows} closed captures -> ${outPath}\n`,
);
if (!identityStable || summary.rowErrors > 0) {
  process.stderr.write(`state support response invalid: ${!identityStable ? "identity drift" : `${summary.rowErrors} unexpected row error(s)`}\n`);
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
  | "response_state_unavailable"
  | "physical_prefix_changed"
  | "error";

function evaluateRow(
  entry: ReturnType<typeof makeMirroredContactCaptureArcScreen>[number],
  index: number,
  input: PreparedTrajectoryFixtureCore,
  eventImpact: number | null,
  actionMenu: readonly StateSupportResponseAction[],
  baselinePhysicalPrefixTrace: ReturnType<typeof exactTraceFingerprint>,
) {
  const started = performance.now();
  const simBefore = getSimFrames();
  let capture: ReturnType<typeof realizeContactCaptureArc>;
  try {
    const kinematic = contactKinematicFrameFromPlanningState(
      input.state,
      input.frame,
      { impact: eventImpact ?? undefined },
    );
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
    const localEngine = input.engine.addLine(captureLines.map((line) => engineLineFromTrackLine(line)));
    const localEnd = Math.min(input.outgoing.endFrame, input.current.endFrame + LOCAL_SURVIVAL_WINDOW_FRAMES);
    const localDetection = detectWindow(localEngine, 0, localEnd);
    const localObservation = observeOwnedContactTransition(localDetection, {
      targetFrame: input.current.endFrame,
      gapFrames: input.current.endFrame - input.current.startFrame,
      observationEndFrame: localEnd,
      ownedLineIds: new Set(captureLines.map((line) => line.id)),
      lineRoles: captureRoles,
      requiredLineRoles: ["capture_band_approach", "capture_band_runway", "capture_band_arc"],
      persistenceOffsetFrames: PERSISTENCE_FRAMES,
      responseOffsetFrames: IMPACT_WINDOW,
    });
    const observedCaptureStatus = classifyCapture(localDetection, localObservation, input, localEnd);
    const localPhysicalPrefixTrace = prefixTrace(localEngine, input.current.startFrame - 1);
    const captureStatus = sameTrace(localPhysicalPrefixTrace, baselinePhysicalPrefixTrace)
      ? observedCaptureStatus
      : "physical_prefix_changed" as const;
    const local = summarizeLocal(
      localEngine,
      localDetection,
      localObservation,
      captureStatus,
      input,
      localEnd,
      localPhysicalPrefixTrace,
      baselinePhysicalPrefixTrace,
    );
    if (captureStatus !== "closed") {
      return captureUnavailable(entry, index, capture, captureStatus, `capture_${captureStatus}`, started, simBefore, local);
    }
    const event = localObservation.selectedOwnedEvent;
    if (event === null) throw new Error("closed capture lacks selected event");
    const supportStartFrame = event.frame + IMPACT_WINDOW + 1;
    const responseState = extractPlanningState(localEngine, supportStartFrame);
    if (responseState === null) {
      return captureUnavailable(entry, index, capture, "response_state_unavailable", "exact_response_state_unavailable", started, simBefore, local);
    }
    const response = {
      eventFrame: event.frame,
      supportStartFrame,
      anchor: targetFrameFromPlanningState(responseState),
      prefix: observePrefix(localDetection, input.outgoing.startFrame, supportStartFrame),
    };
    if (response.prefix === null) {
      return captureUnavailable(entry, index, capture, "response_state_unavailable", "exact_response_prefix_unavailable", started, simBefore, local);
    }
    const availableFrames = input.outgoing.endFrame - supportStartFrame;
    if (availableFrames < RESPONSE_HORIZON_FRAMES) {
      return {
        ...baseRow(entry, index, capture, local, started, simBefore),
        captureStatus: "closed" as const,
        response: summarizeResponse(response),
        assay: {
          status: "horizon_unavailable" as const,
          horizonFrames: RESPONSE_HORIZON_FRAMES,
          availableFrames,
          reason: "response boundary leaves less than the fixed local horizon",
          actions: [],
        },
      };
    }
    const actionEndFrame = supportStartFrame + RESPONSE_HORIZON_FRAMES;
    const actions = actionMenu.map((action) => evaluateAction(
      action,
      input,
      captureLines,
      captureRoles,
      localObservation,
      response,
      local.captureTrace,
      baselinePhysicalPrefixTrace,
      actionEndFrame,
    ));
    const actionsWithNeutralEffects = effectsFromNeutral(actions);
    return {
      ...baseRow(entry, index, capture, local, started, simBefore),
      captureStatus: "closed" as const,
      response: summarizeResponse(response),
      assay: {
        status: "ready" as const,
        horizonFrames: RESPONSE_HORIZON_FRAMES,
        availableFrames,
        actionEndFrame,
        actions: actionsWithNeutralEffects,
      },
    };
  } catch (error) {
    return captureFailure(entry, index, "error", error, started, simBefore, capture);
  }
}

function evaluateAction(
  action: StateSupportResponseAction,
  input: PreparedTrajectoryFixtureCore,
  captureLines: TrackLine[],
  captureRoles: Map<number, string>,
  localObservation: ReturnType<typeof observeOwnedContactTransition>,
  response: { eventFrame: number; supportStartFrame: number; anchor: ReturnType<typeof targetFrameFromPlanningState>; prefix: NonNullable<ReturnType<typeof observePrefix>> },
  captureOnlyTrace: ReturnType<typeof exactTraceFingerprint>,
  baselinePhysicalPrefixTrace: ReturnType<typeof exactTraceFingerprint>,
  actionEndFrame: number,
) {
  const started = performance.now();
  const simBefore = getSimFrames();
  try {
    const plan = planStateSupportResponse(response, RESPONSE_HORIZON_FRAMES, action);
    const support = realizeSupportPath(
      { point: plan.anchor.reference, entryAngleDeg: plan.anchor.headingDeg },
      plan,
      input.lineIdStart + captureLines.length,
      { preserveEntryTangent: true },
    );
    const supportLines = support.lines;
    const engine = input.engine.addLine([...captureLines, ...supportLines].map((line) => engineLineFromTrackLine(line)));
    const detection = detectWindow(engine, 0, actionEndFrame);
    const responseEnd = Math.min(input.outgoing.endFrame, input.current.endFrame + LOCAL_SURVIVAL_WINDOW_FRAMES);
    const observation = observeOwnedContactTransition(detection, {
      targetFrame: input.current.endFrame,
      gapFrames: input.current.endFrame - input.current.startFrame,
      observationEndFrame: responseEnd,
      ownedLineIds: new Set(captureLines.map((line) => line.id)),
      lineRoles: captureRoles,
      requiredLineRoles: ["capture_band_approach", "capture_band_runway", "capture_band_arc"],
      persistenceOffsetFrames: PERSISTENCE_FRAMES,
      responseOffsetFrames: IMPACT_WINDOW,
    });
    const captureStatus = classifyCapture(detection, observation, input, responseEnd);
    const physicalPrefixTrace = prefixTrace(engine, input.current.startFrame - 1);
    const captureTrace = exactEngineStateTraceFingerprint(engine, input.current.startFrame, response.supportStartFrame - 1);
    const responseAxisTrace = exactTraceFingerprint(detection, input.outgoing.startFrame, response.supportStartFrame - 1);
    const supportIds = new Set(supportLines.map((line) => line.id));
    const supportCollisionBeforeResponse = [];
    for (let frame = 0; frame < response.supportStartFrame; frame++) {
      supportCollisionBeforeResponse.push(...engineCollisionHitsForLineIds(engine, frame, supportIds));
    }
    const complete = survivesThroughFrame(detection, actionEndFrame) &&
      measurementLastFrame(detection) >= actionEndFrame;
    const offBeatLandingFrames = offBeatLandingEvents(detection, input.ctx.allContactFrames)
      .filter((event) => event.frame >= input.current.startFrame && event.frame <= actionEndFrame)
      .map((event) => event.frame);
    const state = complete
      ? measureActionWindow(detection, response.supportStartFrame, actionEndFrame, response.anchor.headingDeg, supportLines)
      : null;
    const structurallyValid = complete &&
      captureStatus === "closed" &&
      sameTrace(physicalPrefixTrace, baselinePhysicalPrefixTrace) &&
      sameEvent(localObservation.selectedOwnedEvent, observation.selectedOwnedEvent) &&
      sameTrace(captureTrace, captureOnlyTrace) &&
      supportCollisionBeforeResponse.length === 0 &&
      offBeatLandingFrames.length === 0;
    return {
      action,
      status: "observed" as const,
      plan: summarizePlan(plan),
      support: summarizeLines(supportLines),
      terminus: detection.terminus,
      complete,
      captureStatus,
      selectedCaptureEventMatchesLocal: sameEvent(localObservation.selectedOwnedEvent, observation.selectedOwnedEvent),
      physicalPrefixTrace,
      physicalPrefixTraceMatchesBaseline: sameTrace(physicalPrefixTrace, baselinePhysicalPrefixTrace),
      captureTrace,
      captureTraceMatchesCaptureOnly: sameTrace(captureTrace, captureOnlyTrace),
      responseAxisTrace,
      supportCollisionBeforeResponse,
      offBeatLandingFrames,
      state,
      structurallyValid,
      elapsedMs: round(performance.now() - started),
      simFrames: getSimFrames() - simBefore,
    };
  } catch (error) {
    const message = errorMessage(error);
    const isExplicitStudyEnvelope = message.includes("support tangent exceeds the explicit study envelope");
    return {
      action,
      status: isExplicitStudyEnvelope ? "study_envelope_unavailable" as const : "error" as const,
      reason: message,
      structurallyValid: false,
      elapsedMs: round(performance.now() - started),
      simFrames: getSimFrames() - simBefore,
    };
  }
}

function classifyCapture(
  detection: ReturnType<typeof detectWindow>,
  observation: ReturnType<typeof observeOwnedContactTransition>,
  input: PreparedTrajectoryFixtureCore,
  localEnd: number,
): CaptureStatus {
  const survived = survivesThroughFrame(detection, localEnd);
  const offBeat = offBeatLandingEvents(detection, input.ctx.allContactFrames)
    .filter((event) => event.frame >= input.current.startFrame && event.frame < input.outgoing.endFrame && event.frame <= localEnd);
  if (!survived) return "survival";
  if (observation.selectedOwnedEvent === null) return "landing";
  if (!observation.responseWindowComplete) return "response_unavailable";
  if (!observation.persistenceWindowComplete) return "persistence_unavailable";
  if (offBeat.length > 0) return "offbeat";
  return "closed";
}

function summarizeLocal(
  engine: any,
  detection: ReturnType<typeof detectWindow>,
  observation: ReturnType<typeof observeOwnedContactTransition>,
  status: CaptureStatus,
  input: PreparedTrajectoryFixtureCore,
  localEnd: number,
  physicalPrefixTrace: ReturnType<typeof exactTraceFingerprint>,
  baselinePhysicalPrefixTrace: ReturnType<typeof exactTraceFingerprint>,
) {
  const selected = observation.selectedOwnedEvent;
  const captureTraceEndFrame = selected === null ? input.current.startFrame : selected.frame + IMPACT_WINDOW;
  return {
    status,
    observationEndFrame: localEnd,
    terminus: detection.terminus,
    selectedOwnedEvent: selected,
    persistenceWindowComplete: observation.persistenceWindowComplete,
    responseWindowComplete: observation.responseWindowComplete,
    responseEndFrame: observation.responseEndFrame,
    offBeatLandingFrames: offBeatLandingEvents(detection, input.ctx.allContactFrames)
      .filter((event) => event.frame >= input.current.startFrame && event.frame < input.outgoing.endFrame && event.frame <= localEnd)
      .map((event) => event.frame),
    physicalPrefixTrace,
    physicalPrefixTraceMatchesBaseline: sameTrace(physicalPrefixTrace, baselinePhysicalPrefixTrace),
    captureTrace: exactEngineStateTraceFingerprint(engine, input.current.startFrame, captureTraceEndFrame),
    responseAxisTrace: exactTraceFingerprint(detection, input.outgoing.startFrame, captureTraceEndFrame),
    scoredImpact: scoredContactImpact(detection, {
      target: input.current.targets.impact ?? null,
      landingFrame: selected?.frame ?? null,
      responseWindowComplete: observation.responseWindowComplete,
    }),
  };
}

function observePrefix(detection: ReturnType<typeof detectWindow>, startFrame: number, endFrameExclusive: number) {
  let airborneSamples = 0;
  let speedSumPxPerFrame = 0;
  for (let frame = startFrame; frame < endFrameExclusive; frame++) {
    const airborne = airborneAt(detection, frame);
    const speed = speedAt(detection, frame);
    if (airborne === undefined || speed === undefined) return null;
    if (airborne) airborneSamples++;
    speedSumPxPerFrame += speed;
  }
  return {
    startFrame,
    endFrameExclusive,
    measurementSamples: endFrameExclusive - startFrame,
    airborneSamples,
    speedSumPxPerFrame,
  };
}

function measureActionWindow(
  detection: ReturnType<typeof detectWindow>,
  startFrame: number,
  endFrame: number,
  entryHeadingDeg: number,
  supportLines: readonly TrackLine[],
) {
  let airSamples = 0;
  let speedSumPx = 0;
  let samples = 0;
  const supportIds = new Set(supportLines.map((line) => line.id));
  const airFrames: number[] = [];
  const supportContactFrames: number[] = [];
  for (let frame = startFrame; frame <= endFrame; frame++) {
    const airborne = airborneAt(detection, frame);
    const speed = speedAt(detection, frame);
    if (airborne === undefined || speed === undefined) return null;
    if (airborne) {
      airSamples++;
      airFrames.push(frame);
    }
    if (contactLineIdsAt(detection, frame).some((id) => supportIds.has(id))) supportContactFrames.push(frame);
    speedSumPx += speed;
    samples++;
  }
  const velocity = velocityAt(detection, endFrame);
  if (velocity === undefined) return null;
  const headingDeg = Math.atan2(velocity.y, velocity.x) * 180 / Math.PI;
  return {
    startFrame,
    endFrame,
    measurementSamples: samples,
    airborneSamples: airSamples,
    airFraction: round(airSamples / samples),
    meanSpeedPxPerFrame: round(speedSumPx / samples),
    meanSpeedAuthored: round(speedPxToAuthored(speedSumPx / samples)),
    endHeadingDeg: round(headingDeg),
    headingDeltaDeg: round(angleDelta(headingDeg, entryHeadingDeg)),
    temporal: {
      firstAirborneFrame: airFrames[0] ?? null,
      airborneRuns: contiguousRuns(airFrames),
      supportContactDuty: round(supportContactFrames.length / samples),
      firstSupportContactFrame: supportContactFrames[0] ?? null,
      lastSupportContactFrame: supportContactFrames.at(-1) ?? null,
      supportContactRuns: contiguousRuns(supportContactFrames),
      firstAirborneTipDistancePx: airFrames[0] === undefined
        ? null
        : distanceToSupportTip(detection, airFrames[0], supportLines),
    },
  };
}

function contiguousRuns(frames: readonly number[]) {
  if (frames.length === 0) return [];
  const runs: Array<{ startFrame: number; endFrame: number; frameCount: number }> = [];
  let startFrame = frames[0]!;
  let previous = startFrame;
  for (const frame of frames.slice(1)) {
    if (frame !== previous + 1) {
      runs.push({ startFrame, endFrame: previous, frameCount: previous - startFrame + 1 });
      startFrame = frame;
    }
    previous = frame;
  }
  runs.push({ startFrame, endFrame: previous, frameCount: previous - startFrame + 1 });
  return runs;
}

/**
 * Display-only endpoint diagnostic. It is intentionally not used as an
 * ownership, collision, or selection condition: the engine's contact IDs are
 * the physical authority.
 */
function distanceToSupportTip(
  detection: ReturnType<typeof detectWindow>,
  frame: number,
  supportLines: readonly TrackLine[],
): number | null {
  const position = positionAt(detection, frame);
  const tip = supportLines.at(-1);
  if (position === undefined || tip === undefined) return null;
  return round(Math.hypot(position.x - tip.x2, position.y - tip.y2));
}

function effectsFromNeutral(actions: ReturnType<typeof evaluateAction>[]) {
  const neutral = actions.find((record) => record.action.id === "neutral");
  if (neutral === undefined || neutral.status !== "observed" || !neutral.structurallyValid) {
    return actions.map((record) => ({
      ...record,
      effectFromNeutral: {
        status: "unavailable" as const,
        reason: neutral === undefined
          ? "neutral_action_missing"
          : neutral.status !== "observed"
          ? "neutral_action_unobserved"
          : "neutral_action_not_structurally_valid",
      },
    }));
  }
  return actions.map((record) => {
    if (record.status !== "observed") {
      return { ...record, effectFromNeutral: { status: "unavailable" as const, reason: "action_unobserved" } };
    }
    return {
      ...record,
      effectFromNeutral: record.state === null || neutral.state === null ? {
        status: "unavailable" as const,
        reason: "action_or_neutral_window_unavailable",
      } : {
        status: "observed" as const,
        airFractionDelta: round(record.state.airFraction - neutral.state.airFraction),
        meanSpeedAuthoredDelta: round(record.state.meanSpeedAuthored - neutral.state.meanSpeedAuthored),
        headingDeltaDegDelta: round(record.state.headingDeltaDeg - neutral.state.headingDeltaDeg),
        structuralValidityChanged: record.structurallyValid !== neutral.structurallyValid,
      },
    };
  });
}

function baseRow(
  entry: ReturnType<typeof makeMirroredContactCaptureArcScreen>[number],
  index: number,
  capture: ReturnType<typeof realizeContactCaptureArc>,
  local: ReturnType<typeof summarizeLocal>,
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
      lines: summarizeLines(capture.lines),
      handoff: { point: point(capture.handoff.point), tangentDeg: round(capture.handoff.tangentDeg) },
      turnOrientation: capture.turnOrientation,
      impactTurnDeg: round(capture.impactTurnDeg),
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
  local: ReturnType<typeof summarizeLocal> | null = null,
) {
  return {
    ...baseRow(entry, index, capture, local ?? { status: captureStatus }, started, simBefore),
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
    capture: capture === undefined ? null : { lines: summarizeLines(capture.lines) },
    local: { status: captureStatus, error: errorMessage(error) },
    captureStatus,
    response: null,
    assay: { status: "error" as const, reason: errorMessage(error), actions: [] },
    elapsedMs: round(performance.now() - started),
    simFrames: getSimFrames() - simBefore,
  };
}

function summarizeResponse(response: { eventFrame: number; supportStartFrame: number; anchor: ReturnType<typeof targetFrameFromPlanningState>; prefix: NonNullable<ReturnType<typeof observePrefix>> }) {
  return {
    eventFrame: response.eventFrame,
    supportStartFrame: response.supportStartFrame,
    anchor: {
      reference: point(response.anchor.reference),
      headingDeg: round(response.anchor.headingDeg),
      speedPxPerFrame: round(response.anchor.speedPxPerFrame),
      anchorPoint: response.anchor.anchorPoint,
      headingSource: response.anchor.headingSource,
    },
    prefix: {
      startFrame: response.prefix.startFrame,
      endFrameExclusive: response.prefix.endFrameExclusive,
      measurementSamples: response.prefix.measurementSamples,
      airborneSamples: response.prefix.airborneSamples,
      speedSumPxPerFrame: round(response.prefix.speedSumPxPerFrame),
    },
  };
}

function summarizePlan(plan: ReturnType<typeof planStateSupportResponse>) {
  return {
    action: plan.action,
    horizonFrames: plan.horizonFrames,
    plannedExtentPx: round(plan.plannedExtentPx),
    meanGradeDeg: round(plan.meanGradeDeg),
    curvaturePower: round(plan.curvaturePower),
    anchor: {
      reference: point(plan.anchor.reference),
      headingDeg: round(plan.anchor.headingDeg),
      speedPxPerFrame: round(plan.anchor.speedPxPerFrame),
    },
  };
}

function summarizeLines(lines: readonly TrackLine[]) {
  const lengths = lines.map((line) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1));
  return {
    lineCount: lines.length,
    lineHash: sha256(stableJson(lines)),
    totalLengthPx: round(lengths.reduce((sum, value) => sum + value, 0)),
    segmentLengthsPx: lengths.map(round),
  };
}

/** Exact full-state traces are safety invariants: unavailable or mismatched ranges fail closed. */
function sameTrace(
  left: ReturnType<typeof exactTraceFingerprint>,
  right: ReturnType<typeof exactTraceFingerprint>,
): boolean {
  return left.fingerprint !== null && right.fingerprint !== null &&
    left.unavailableAtFrame === null && right.unavailableAtFrame === null &&
    left.semantics === right.semantics && left.frameCount === right.frameCount &&
    left.fingerprint === right.fingerprint;
}

function prefixTrace(engine: any, endFrame: number): ReturnType<typeof exactTraceFingerprint> {
  if (endFrame < 0) return emptyEngineStateTraceFingerprint();
  return exactEngineStateTraceFingerprint(engine, 0, endFrame);
}

function sameEvent(
  left: ReturnType<typeof observeOwnedContactTransition>["selectedOwnedEvent"],
  right: ReturnType<typeof observeOwnedContactTransition>["selectedOwnedEvent"],
) {
  return left !== null && right !== null && left.frame === right.frame &&
    left.ownedLineIds.length === right.ownedLineIds.length &&
    left.ownedLineIds.every((id, index) => id === right.ownedLineIds[index]);
}

function summarizeRows(rows: readonly ReturnType<typeof evaluateRow>[]) {
  const captureClosed = rows.filter((row) => row.captureStatus === "closed").length;
  const actions = rows.flatMap((row) => row.assay.actions);
  const observed = actions.filter((action) => action.status === "observed");
  const readyRows = rows.filter((row) => row.assay.status === "ready");
  const completePairedRows = readyRows.filter((row) =>
    row.assay.actions.length === actionMenu.length &&
    row.assay.actions.every((action) =>
      action.status === "observed" && action.structurallyValid && action.state !== null
    ),
  );
  const byAction = Object.fromEntries(actionMenu.map((declared) => {
    const records = readyRows.flatMap((row) => {
      const record = row.assay.actions.find((action) => action.action.id === declared.id);
      return record === undefined ? [] : [record];
    });
    const observedRecords = records.filter((record) => record.status === "observed");
    const structurallyValid = observedRecords.filter((record) => record.structurallyValid && record.state !== null);
    const pairedRecords = completePairedRows.flatMap((row) => {
      const record = row.assay.actions.find((action) => action.action.id === declared.id);
      return record === undefined ? [] : [record];
    });
    return [declared.id, {
      intentionToTreat: {
        denominatorReadyCaptureRows: readyRows.length,
        actionPresent: records.length,
        observed: observedRecords.length,
        structurallyValid: structurallyValid.length,
        structurallyInvalidObserved: observedRecords.length - structurallyValid.length,
        unobservedOrUnavailable: readyRows.length - observedRecords.length,
      },
      descriptiveAllObserved: summarizeActionMeasurements(observedRecords),
      conditionalStructuralValid: summarizeActionMeasurements(structurallyValid),
      completePaired: summarizeActionMeasurements(pairedRecords),
    }];
  }));
  const orientation = Object.fromEntries(([-1, 1] as const).map((turnOrientation) => {
    const orientationRows = rows.filter((row) => row.turnOrientation === turnOrientation);
    const orientationReady = orientationRows.filter((row) => row.assay.status === "ready");
    const orientationComplete = completePairedRows.filter((row) => row.turnOrientation === turnOrientation);
    return [String(turnOrientation), {
      captureRows: orientationRows.length,
      captureClosed: orientationRows.filter((row) => row.captureStatus === "closed").length,
      readyCaptureRows: orientationReady.length,
      completePairedRows: orientationComplete.length,
    }];
  }));
  return {
    captureRows: rows.length,
    captureClosed,
    capturePreclear: rows.filter((row) => row.captureStatus === "preclear").length,
    captureMissed: rows.filter((row) => row.captureStatus === "landing").length,
    captureSurvivalFailure: rows.filter((row) => row.captureStatus === "survival").length,
    horizonUnavailable: rows.filter((row) => row.assay.status === "horizon_unavailable").length,
    actionAttempts: actions.length,
    observedActions: observed.length,
    studyEnvelopeUnavailable: actions.filter((action) => action.status === "study_envelope_unavailable").length,
    structurallyValidActions: observed.filter((action) => action.structurallyValid).length,
    rowErrors: rows.filter((row) => row.captureStatus === "error").length +
      actions.filter((action) => action.status === "error").length,
    responseAvailability: {
      readyCaptureRows: readyRows.length,
      noActionRows: captureClosed - readyRows.length,
      actionMenuSize: actionMenu.length,
    },
    actionById: byAction,
    completePaired: {
      denominatorReadyCaptureRows: readyRows.length,
      rows: completePairedRows.length,
      nonCompleteReadyRows: readyRows.length - completePairedRows.length,
      rowIndices: completePairedRows.map((row) => row.index),
      interpretation: "Every declared action was observed, structurally valid, and had a readable local state on the same capture row.",
    },
    captureByTurnOrientation: orientation,
  };
}

function summarizeActionMeasurements(records: readonly { state?: {
  airFraction: number;
  meanSpeedAuthored: number;
  headingDeltaDeg: number;
  temporal: { firstAirborneFrame: number | null; supportContactDuty: number };
} | null }[]) {
  const states = records.flatMap((record) => record.state === null || record.state === undefined ? [] : [record.state]);
  return {
    rowsWithReadableState: states.length,
    meanAirFraction: mean(states.map((state) => state.airFraction)),
    meanSpeedAuthored: mean(states.map((state) => state.meanSpeedAuthored)),
    meanHeadingDeltaDeg: mean(states.map((state) => state.headingDeltaDeg)),
    meanSupportContactDuty: mean(states.map((state) => state.temporal.supportContactDuty)),
    rowsWithAirborneObservation: states.filter((state) => state.temporal.firstAirborneFrame !== null).length,
  };
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function point(value: { x: number; y: number }) {
  return { x: round(value.x), y: round(value.y) };
}

function angleDelta(left: number, right: number) {
  let delta = (left - right + 180) % 360;
  if (delta < 0) delta += 360;
  return delta - 180;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
