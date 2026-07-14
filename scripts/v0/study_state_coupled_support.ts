/**
 * Two-pass exact-engine feasibility study for a state-coupled contact
 * transition. This is not a compiler source, selector, or promotion command.
 *
 * For every fixed mirrored capture row:
 *   1. replay only the capture band and observe its exact response;
 *   2. derive one support path from that exact state and literal outgoing axes;
 *   3. replay capture + support from the original frozen prefix.
 *
 * The paired capture-only replay is the causal comparator. No legacy support
 * geometry, next-event impact, target jitter, optimizer ranking, or retry path
 * enters the formulation.
 */
import { PERSISTENCE_FRAMES } from "../lib/detector.ts";
import { hasPreTargetSledProximityFromTrace } from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { detectWindow } from "./core/candidate.ts";
import { measureGapAxes } from "./core/measure.ts";
import {
  airborneAt,
  engineLineFromTrackLine,
  measurementLastFrame,
  offBeatLandingEvents,
  speedAt,
} from "./core/substrate.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { IMPACT_WINDOW, TARGET_AXES, type TrackLine } from "./types.ts";
import {
  realizeContactCaptureArc,
  resolveContactCaptureArc,
} from "./trajectory/contact_capture_arc.ts";
import { makeMirroredContactCaptureArcScreen } from "./trajectory/contact_capture_arc_design.ts";
import { contactKinematicFrameFromPlanningState } from "./trajectory/contact_kinematic_frame.ts";
import { observeOwnedContactTransition, ownedSledCollisionTelemetry } from "./trajectory/contact_observation.ts";
import { realizeSupportPath } from "./trajectory/envelope/realizer.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import { scoredContactImpact } from "./trajectory/scored_contact_impact.ts";
import { extractPlanningState } from "./trajectory/state.ts";
import {
  planStateCoupledSupport,
  type ExactResponseBoundary,
  type StateShotSupportPlan,
} from "./trajectory/state_coupled_support.ts";
import {
  prepareStateCoupledTrajectoryFixture,
  type PreparedTrajectoryFixtureCore,
} from "./trajectory/study_context.ts";
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
import { transitionContractForGap, type IntervalAxes } from "./trajectory/transition_contract.ts";

const argv = process.argv.slice(2);
// These controls are deliberately fixed for this first feasibility shot.  Keep
// them before top-level evaluation: every capture row must run under exactly
// the same declared protocol.
const LOCAL_SURVIVAL_WINDOW_FRAMES = 16;
const NEUTRAL_SUPPORT_CONTROL = { supportTimeScale: 1, gradeResidualDeg: 0, curvatureSkew: 0 } as const;

const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_state_coupled_support.ts --fixture=FILE [--out=FILE]",
    "",
    "Runs the fixed mirrored capture screen plus one neutral exact-state support shot.",
    "Calibration-only; no selection, tuning, or compiler integration flags are accepted.",
  ].join("\n") + "\n");
  process.exit(0);
}

const fixturePath = argument("fixture");
if (fixturePath === undefined) throw new Error("--fixture=FILE is required");
const unsupported = argv.filter((value) => value.startsWith("--") && !value.startsWith("--fixture=") && !value.startsWith("--out="));
if (unsupported.length > 0) throw new Error(`unsupported study control(s): ${unsupported.join(", ")}`);
const explicitOut = argument("out");

const fixture = readFrozenTrajectoryFixture(fixturePath);
const STUDY_SCHEMA = "line.study-state-coupled-support.v5";
const protocolFingerprint = sha256(stableJson({
  localSurvivalWindowFrames: LOCAL_SURVIVAL_WINDOW_FRAMES,
  supportControl: NEUTRAL_SUPPORT_CONTROL,
  supportRealizer: "state_shot_v1",
}));
const engineName = activeStudyEngine();
const sourceIdentityAtStart = studySourceIdentity("scripts/v0/study_state_coupled_support.ts");
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
  throw new Error(`state-coupled support study accepts only calibration fixtures; ${prepared.panel.id} is ${prepared.panel.cohort}`);
}
const contract = transitionContractForGap(
  prepared.current,
  prepared.outgoing,
  prepared.setup.gapAxisTargets,
);
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
  evaluateRow(entry, index, prepared, contract.outgoing!, contract.event.impact, baselinePhysicalPrefixTrace),
);
const summary = summarizeRows(rows);
const sourceIdentityAtEnd = studySourceIdentity("scripts/v0/study_state_coupled_support.ts");
const observationCompilerAtEnd = compilerCandidateIdentity(engineName);
const identityStable = sourceIdentityAtStart.studySourceFingerprint === sourceIdentityAtEnd.studySourceFingerprint &&
  observationCompilerAtStart.candidateFingerprint === observationCompilerAtEnd.candidateFingerprint;
const protocolStatus = !identityStable
  ? "invalid_identity_drift"
  : summary.rowErrors === 0
  ? "complete"
  : "invalid_runtime_error";
const output = {
  // v5 binds the structural claim to the complete non-scarf engine state,
  // strict terminal survival, and an immutable execution identity.
  schema: STUDY_SCHEMA,
  artifactIdentity,
  purpose: [
    "A paired, exact-engine feasibility study of support derived from an observed post-contact state.",
    "Every fixed mirrored capture row is retained; no row is selected or retried.",
    "The same capture-only replay is the comparator for each capture-plus-support replay.",
  ],
  status: {
    protocolStatus,
    executionComplete: identityStable && summary.rowErrors === 0,
    supportPlanAvailable: summary.planReady > 0,
    structuralClaimEligible: identityStable && summary.rowErrors === 0 && summary.structurallyCoherent > 0,
    productionIntegration: "forbidden: this is a calibration feasibility study, not a compiler candidate source or selector",
    cohortPolicy: "calibration only; a clean held-out cohort must be declared after the formulation and menu are frozen",
    captureMenu: "fixed mirrored 24-row positive-impact capture screen",
    supportControl: { supportTimeScale: 1, gradeResidualDeg: 0, curvatureSkew: 0 },
    supportMeaning: "state shooting only: support starts from the exact response-state anchor and does not claim a geometric or G1 connector to the capture handoff",
    comparator: "same capture geometry without support, not raw normal",
    endpoint: "full non-scarf engine-state identity before the current gap and against capture-only replay through H-1, no all-body support collision before H, same owned capture event, survival strictly through the persistence horizon, and no off-beat landing; axis residuals are descriptive measurements, not admission thresholds",
  },
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
  transition: summarizeTransition(contract),
  protocol: { protocolFingerprint },
  rows,
  summary,
  caveats: [
    "A support line is present from the start of the replay even though it is constructed from a future exact state. Full-engine prefix identity, exact capture-only comparison through H-1, and all-body support-line collision telemetry explicitly test for retroactive intrusion.",
    "The first support shot conditions only on authored air. Authored speed, elevation, and amplitude remain measured residuals; no interval average is converted into an exit-state command.",
    "A structurally coherent calibration row proves only that this static support did not retroactively intrude and replayed through the outgoing persistence horizon. It is not a quality pass, connector validation, control selection, generalization claim, or compiler authorization.",
    "Identity is sampled before and after replay over the static import closure plus observed compiler/engine fingerprint. In-process module loading precedes that first sample, so archival evidence requiring a literal byte snapshot must run from an external immutable workspace.",
    "The 3/4/5/6/7-second ladder is one correlated capability family and is never pooled as independent evidence.",
  ],
};

const canonicalOutPath = explicitOut ??
  `generated/studies/state-coupled-support/v5/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}-${artifactIdentity.fingerprint.slice(0, 12)}.json`;
const outPath = !identityStable
  ? allocateStudyArtifactPath(forensicDriftArtifactPath(canonicalOutPath, sourceIdentityAtEnd.studySourceFingerprint, observationCompilerAtEnd.candidateFingerprint))
  : explicitOut ?? allocateStudyArtifactPath(canonicalOutPath);
writeStudyArtifact(outPath, output);
process.stderr.write(
  `state-coupled support ${prepared.panel.id}: ${output.summary.structurallyCoherent}/${output.summary.attempted} structurally coherent rows, ` +
  `${output.summary.captureClosed} capture closures, ${output.summary.planReady} ready plans -> ${outPath}\n`,
);
if (!identityStable || summary.rowErrors > 0) {
  // Logical negative observations are evidence. An unexpected implementation
  // exception is not: leave the artifact for diagnosis but make accidental
  // downstream consumption impossible through a successful exit status.
  process.stderr.write(`state-coupled support invalid: ${!identityStable ? "identity drift" : `${summary.rowErrors} unexpected row error(s)`}\n`);
  process.exitCode = 2;
}

type CaptureRow = ReturnType<typeof evaluateRow>;
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
  outgoing: NonNullable<ReturnType<typeof transitionContractForGap>["outgoing"]>,
  eventImpact: number | null,
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
    return failedRow(entry, index, "error", error, started, simBefore);
  }
  const captureLines = capture.lines;
  const captureRoles = new Map<number, string>([
    [capture.lineRoles.approach, "capture_band_approach"],
    [capture.lineRoles.runway, "capture_band_runway"],
    ...capture.lineRoles.arc.map((id) => [id, "capture_band_arc"] as const),
  ]);
  if (hasPreTargetSledProximityFromTrace(input.probe.preTargetSledTrace(), captureLines)) {
    return rowWithoutSupport(entry, index, capture, "preclear", {
      status: "not_attempted",
      reason: "capture_preclear",
    }, started, simBefore);
  }

  try {
    const localEngine = input.engine.addLine(captureLines.map((line) => engineLineFromTrackLine(line)));
    const localEnd = Math.min(
      input.outgoing.endFrame,
      input.current.endFrame + LOCAL_SURVIVAL_WINDOW_FRAMES,
    );
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
    const localStatus = sameTrace(localPhysicalPrefixTrace, baselinePhysicalPrefixTrace)
      ? observedCaptureStatus
      : "physical_prefix_changed" as const;
    const local = summarizeCapturePass(
      localEngine,
      localDetection,
      localObservation,
      localStatus,
      input,
      capture,
      localEnd,
      eventImpact,
      localPhysicalPrefixTrace,
      baselinePhysicalPrefixTrace,
    );
    if (localStatus !== "closed") {
      return rowWithoutSupport(entry, index, capture, localStatus, {
        status: "not_attempted",
        reason: `capture_${localStatus}`,
      }, started, simBefore, local);
    }

    const event = localObservation.selectedOwnedEvent;
    if (event === null) throw new Error("closed capture lacks selected event");
    const supportStartFrame = event.frame + IMPACT_WINDOW + 1;
    const responseState = extractPlanningState(localEngine, supportStartFrame);
    if (responseState === null) {
      return rowWithoutSupport(entry, index, capture, "response_state_unavailable", {
        status: "not_attempted",
        reason: "exact_response_state_unavailable",
      }, started, simBefore, local);
    }
    const prefix = observePrefix(localDetection, input.outgoing.startFrame, supportStartFrame);
    if (prefix === null) {
      return rowWithoutSupport(entry, index, capture, "response_state_unavailable", {
        status: "not_attempted",
        reason: "exact_response_prefix_unavailable",
      }, started, simBefore, local);
    }
    const response: ExactResponseBoundary = {
      eventFrame: event.frame,
      supportStartFrame,
      anchor: targetFrameFromPlanningState(responseState),
      prefix,
    };
    const plan = planStateCoupledSupport(outgoing, response, NEUTRAL_SUPPORT_CONTROL);
    if (plan.status !== "ready") {
      return rowWithoutSupport(entry, index, capture, "closed", summarizeUnavailablePlan(plan), started, simBefore, local, response);
    }

    const support = realizeSupportPath(
      { point: plan.anchor.reference, entryAngleDeg: plan.anchor.headingDeg },
      plan,
      input.lineIdStart + captureLines.length,
      { preserveEntryTangent: true },
    );
    const supportLines = support.lines;
    const combinedLines = [...captureLines, ...supportLines];
    const finalEnd = input.outgoing.endFrame + PERSISTENCE_FRAMES;
    const captureOnlyFull = observeOutgoingPass(
      localEngine,
      captureLines,
      input,
      outgoing.axes,
      finalEnd,
      supportStartFrame,
      baselinePhysicalPrefixTrace,
    );
    const combinedEngine = input.engine.addLine(combinedLines.map((line) => engineLineFromTrackLine(line)));
    const combined = observeCombinedPass(
      combinedEngine,
      combinedLines,
      captureLines,
      supportLines,
      captureRoles,
      input,
      outgoing.axes,
      finalEnd,
      localObservation,
      supportStartFrame,
      captureOnlyFull.captureTrace,
      baselinePhysicalPrefixTrace,
      eventImpact,
    );
    const structurallyCoherent = combined.physicalPrefixTraceMatchesBaseline &&
      combined.captureTraceMatchesCaptureOnly &&
      combined.supportCollisionBeforeResponse.length === 0 &&
      combined.captureStatus === "closed" &&
      combined.selectedCaptureEventMatchesLocal &&
      combined.outgoing.complete &&
      combined.offBeatLandingFrames.length === 0;
    return {
      index,
      label: entry.label,
      hypothesis: entry.hypothesis,
      placement: entry.placement,
      turnOrientation: entry.turnOrientation,
      turnMagnitudeDeg: round(entry.turnMagnitudeDeg),
      control: roundRecord(entry.control),
      capture: summarizeCapture(capture),
      local,
      response: summarizeResponse(response),
      support: {
        status: "ready" as const,
        plan: summarizePlan(plan),
        lines: summarizeLines(supportLines),
        handoffSeparation: {
          distancePx: round(distance(capture.handoff.point, plan.anchor.reference)),
          tangentDeltaDeg: round(angleDelta(plan.anchor.headingDeg, capture.handoff.tangentDeg)),
          meaning: "state-shot geometric discontinuity is measured, not hidden; this study does not claim a connector",
        },
      },
      pairedCaptureOnly: captureOnlyFull,
      combined,
      supportEffect: compareSupportEffect(captureOnlyFull, combined.outgoing),
      structurallyCoherent,
      elapsedMs: round(performance.now() - started),
      simFrames: getSimFrames() - simBefore,
    };
  } catch (error) {
    return failedRow(entry, index, "error", error, started, simBefore, capture);
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

function summarizeCapturePass(
  engine: any,
  detection: ReturnType<typeof detectWindow>,
  observation: ReturnType<typeof observeOwnedContactTransition>,
  status: CaptureStatus,
  input: PreparedTrajectoryFixtureCore,
  capture: ReturnType<typeof realizeContactCaptureArc>,
  localEnd: number,
  eventImpact: number | null,
  physicalPrefixTrace: ReturnType<typeof exactTraceFingerprint>,
  baselinePhysicalPrefixTrace: ReturnType<typeof exactTraceFingerprint>,
) {
  const selected = observation.selectedOwnedEvent;
  const collision = selected === null
    ? null
    : ownedSledCollisionTelemetry(
      engine.getUpdatesAtFrame(selected.frame),
      new Set(selected.ownedLineIds),
    );
  const offBeat = offBeatLandingEvents(detection, input.ctx.allContactFrames)
    .filter((event) => event.frame >= input.current.startFrame && event.frame < input.outgoing.endFrame && event.frame <= localEnd)
    .map((event) => event.frame);
  return {
    status,
    observationEndFrame: localEnd,
    terminus: detection.terminus,
    selectedOwnedEvent: selected,
    persistenceWindowComplete: observation.persistenceWindowComplete,
    responseWindowComplete: observation.responseWindowComplete,
    responseEndFrame: observation.responseEndFrame,
    offBeatLandingFrames: offBeat,
    physicalPrefixTrace,
    physicalPrefixTraceMatchesBaseline: sameTrace(physicalPrefixTrace, baselinePhysicalPrefixTrace),
    captureTrace: exactEngineStateTraceFingerprint(
      engine,
      input.current.startFrame,
      selected === null ? input.current.startFrame : selected.frame + IMPACT_WINDOW,
    ),
    responseAxisTrace: exactTraceFingerprint(
      detection,
      input.outgoing.startFrame,
      selected === null ? input.outgoing.startFrame : selected.frame + IMPACT_WINDOW,
    ),
    exactImpact: scoredContactImpact(detection, {
      target: eventImpact,
      landingFrame: selected?.frame ?? null,
      responseWindowComplete: observation.responseWindowComplete,
    }),
    selectedCollision: collision,
  };
}

function observePrefix(
  detection: ReturnType<typeof detectWindow>,
  startFrame: number,
  endFrameExclusive: number,
) {
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

function observeOutgoingPass(
  engine: any,
  lines: TrackLine[],
  input: PreparedTrajectoryFixtureCore,
  axes: IntervalAxes,
  finalEnd: number,
  supportStartFrame: number,
  baselinePhysicalPrefixTrace: ReturnType<typeof exactTraceFingerprint>,
) {
  const started = performance.now();
  const simBefore = getSimFrames();
  const detection = detectWindow(engine, 0, finalEnd);
  const outgoing = summarizeOutgoing(detection, lines, input, axes, finalEnd, {
    elapsedMs: round(performance.now() - started),
    simFrames: getSimFrames() - simBefore,
  });
  const physicalPrefixTrace = prefixTrace(engine, input.current.startFrame - 1);
  return {
    ...outgoing,
    physicalPrefixTrace,
    physicalPrefixTraceMatchesBaseline: sameTrace(physicalPrefixTrace, baselinePhysicalPrefixTrace),
    captureTrace: exactEngineStateTraceFingerprint(engine, input.current.startFrame, supportStartFrame - 1),
    responseAxisTrace: exactTraceFingerprint(detection, input.outgoing.startFrame, supportStartFrame - 1),
  };
}

function observeCombinedPass(
  engine: any,
  lines: TrackLine[],
  captureLines: TrackLine[],
  supportLines: TrackLine[],
  captureRoles: Map<number, string>,
  input: PreparedTrajectoryFixtureCore,
  axes: IntervalAxes,
  finalEnd: number,
  localObservation: ReturnType<typeof observeOwnedContactTransition>,
  supportStartFrame: number,
  captureOnlyTrace: ReturnType<typeof exactTraceFingerprint>,
  baselinePhysicalPrefixTrace: ReturnType<typeof exactTraceFingerprint>,
  eventImpact: number | null,
) {
  const started = performance.now();
  const simBefore = getSimFrames();
  const detection = detectWindow(engine, 0, finalEnd);
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
  const observedCaptureStatus = classifyCapture(detection, observation, input, responseEnd);
  const physicalPrefixTrace = prefixTrace(engine, input.current.startFrame - 1);
  const captureStatus = sameTrace(physicalPrefixTrace, baselinePhysicalPrefixTrace)
    ? observedCaptureStatus
    : "physical_prefix_changed" as const;
  const captureTrace = exactEngineStateTraceFingerprint(engine, input.current.startFrame, supportStartFrame - 1);
  const responseAxisTrace = exactTraceFingerprint(detection, input.outgoing.startFrame, supportStartFrame - 1);
  const supportIds = new Set(supportLines.map((line) => line.id));
  const supportCollisionBeforeResponse = [];
  for (let frame = 0; frame < supportStartFrame; frame++) {
    supportCollisionBeforeResponse.push(...engineCollisionHitsForLineIds(engine, frame, supportIds));
  }
  const outgoing = summarizeOutgoing(detection, lines, input, axes, finalEnd, {
    elapsedMs: round(performance.now() - started),
    simFrames: getSimFrames() - simBefore,
  });
  const selectedMatches = sameEvent(localObservation.selectedOwnedEvent, observation.selectedOwnedEvent);
  return {
    captureStatus,
    selectedCaptureEventMatchesLocal: selectedMatches,
    selectedCaptureEvent: observation.selectedOwnedEvent,
    captureImpact: scoredContactImpact(detection, {
      target: eventImpact,
      landingFrame: observation.selectedOwnedEvent?.frame ?? null,
      responseWindowComplete: observation.responseWindowComplete,
    }),
    physicalPrefixTrace,
    physicalPrefixTraceMatchesBaseline: sameTrace(physicalPrefixTrace, baselinePhysicalPrefixTrace),
    captureTrace,
    captureTraceMatchesCaptureOnly: sameTrace(captureTrace, captureOnlyTrace),
    responseAxisTrace,
    supportCollisionBeforeResponse,
    offBeatLandingFrames: offBeatLandingEvents(detection, input.ctx.allContactFrames)
      .filter((event) => event.frame >= input.current.startFrame && event.frame <= input.outgoing.endFrame)
      .map((event) => event.frame),
    outgoing,
  };
}

function summarizeOutgoing(
  detection: ReturnType<typeof detectWindow>,
  lines: TrackLine[],
  input: PreparedTrajectoryFixtureCore,
  axes: IntervalAxes,
  requiredEndFrame: number,
  work: { elapsedMs: number; simFrames: number },
) {
  const complete = survivesThroughFrame(detection, requiredEndFrame) &&
    measurementLastFrame(detection) >= input.outgoing.endFrame;
  // The generic reduction helper can measure an ending event when an impact is
  // present in its Gap bag.  This study owns only the outgoing interval, so
  // give it a fresh literal bag with no arrival-event field.
  const outgoingMeasurementGap = { ...input.outgoing, targets: { ...axes } };
  const measured = complete
    ? measureGapAxes(detection, outgoingMeasurementGap, lines, input.outgoing.endFrame)
    : null;
  const residuals = Object.fromEntries(TARGET_AXES.flatMap((axis) => {
    const target = axes[axis];
    const actual = measured?.[axis];
    return target === undefined ? [] : [[axis, {
      target: round(target),
      actual: actual === undefined ? null : round(actual),
      residual: actual === undefined ? null : round(actual - target),
      absoluteError: actual === undefined ? null : round(Math.abs(actual - target)),
    }]];
  }));
  return {
    complete,
    terminus: detection.terminus,
    lastMeasuredFrame: measurementLastFrame(detection),
    residuals,
    work,
  };
}

function rowWithoutSupport(
  entry: ReturnType<typeof makeMirroredContactCaptureArcScreen>[number],
  index: number,
  capture: ReturnType<typeof realizeContactCaptureArc>,
  localStatus: CaptureStatus,
  support: { status: "not_attempted"; reason: string } | ReturnType<typeof summarizeUnavailablePlan>,
  started: number,
  simBefore: number,
  local: ReturnType<typeof summarizeCapturePass> | null = null,
  response: ExactResponseBoundary | null = null,
) {
  return {
    index,
    label: entry.label,
    hypothesis: entry.hypothesis,
    placement: entry.placement,
    turnOrientation: entry.turnOrientation,
    turnMagnitudeDeg: round(entry.turnMagnitudeDeg),
    control: roundRecord(entry.control),
    capture: summarizeCapture(capture),
    local,
    response: response === null ? null : summarizeResponse(response),
    support,
    pairedCaptureOnly: null,
    combined: null,
    structurallyCoherent: false,
    elapsedMs: round(performance.now() - started),
    simFrames: getSimFrames() - simBefore,
    localStatus,
  };
}

function failedRow(
  entry: ReturnType<typeof makeMirroredContactCaptureArcScreen>[number],
  index: number,
  status: CaptureStatus,
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
    turnMagnitudeDeg: round(entry.turnMagnitudeDeg),
    control: roundRecord(entry.control),
    capture: capture === undefined ? null : summarizeCapture(capture),
    local: { status, error: errorMessage(error) },
    response: null,
    support: { status: "not_attempted" as const, reason: "row_error" },
    pairedCaptureOnly: null,
    combined: null,
    structurallyCoherent: false,
    elapsedMs: round(performance.now() - started),
    simFrames: getSimFrames() - simBefore,
  };
}

function summarizeUnavailablePlan(plan: Exclude<StateShotSupportPlan, { status: "ready" }>) {
  return {
    status: plan.status,
    targetAir: plan.targetAir,
    observedPrefixAirborneSamples: plan.observedPrefixAirborneSamples,
    requiredFutureAirborneSamples: plan.requiredFutureAirborneSamples,
    neutralSupportIntervals: plan.neutralSupportIntervals,
    requestedSupportIntervals: plan.requestedSupportIntervals,
    futureMeasurementSamples: plan.futureMeasurementSamples,
    futureIntervals: plan.futureIntervals,
  };
}

function summarizePlan(plan: Extract<StateShotSupportPlan, { status: "ready" }>) {
  return {
    status: plan.status,
    targetAir: round(plan.targetAir),
    outgoingAxes: roundRecord(plan.outgoingAxes),
    eventFrame: plan.eventFrame,
    supportStartFrame: plan.supportStartFrame,
    totalMeasurementSamples: plan.totalMeasurementSamples,
    prefixMeasurementSamples: plan.prefixMeasurementSamples,
    futureMeasurementSamples: plan.futureMeasurementSamples,
    futureIntervals: plan.futureIntervals,
    observedPrefixAirborneSamples: plan.observedPrefixAirborneSamples,
    requiredFutureAirborneSamples: round(plan.requiredFutureAirborneSamples),
    neutralSupportIntervals: round(plan.neutralSupportIntervals),
    supportTimeScale: round(plan.supportTimeScale),
    supportIntervals: round(plan.supportIntervals),
    plannedAirborneIntervals: round(plan.plannedAirborneIntervals),
    plannedExtentPx: round(plan.plannedExtentPx),
    meanGradeDeg: round(plan.meanGradeDeg),
    curvaturePower: round(plan.curvaturePower),
    anchor: {
      reference: point(plan.anchor.reference),
      headingDeg: round(plan.anchor.headingDeg),
      speedPxPerFrame: round(plan.anchor.speedPxPerFrame),
      anchorPoint: plan.anchor.anchorPoint,
      headingSource: plan.anchor.headingSource,
    },
  };
}

function summarizeTransition(contract: ReturnType<typeof transitionContractForGap>) {
  return {
    incoming: {
      gap: contract.incoming.gapIndex,
      frames: contract.incoming.intervalFrames,
      axes: roundRecord(contract.incoming.axes),
    },
    event: contract.event,
    outgoing: contract.outgoing === null ? null : {
      gap: contract.outgoing.gapIndex,
      endKind: contract.outgoing.endKind,
      frames: contract.outgoing.intervalFrames,
      measurementSamples: contract.outgoing.measurementSamples,
      axes: roundRecord(contract.outgoing.axes),
      nextEvent: contract.outgoing.arrival,
      supportPlannerInput: "outgoing.axes only; nextEvent is output telemetry and never planner input",
    },
  };
}

function summarizeCapture(capture: ReturnType<typeof realizeContactCaptureArc>) {
  return {
    lineHash: sha256(stableJson(capture.lines)),
    lines: summarizeLines(capture.lines),
    capturePoint: point(capture.capturePoint),
    handoff: { point: point(capture.handoff.point), tangentDeg: round(capture.handoff.tangentDeg) },
    entryAngleDeg: round(capture.entryAngleDeg),
    exitAngleDeg: round(capture.exitAngleDeg),
    turnOrientation: capture.turnOrientation,
    impactTurnDeg: round(capture.impactTurnDeg),
    entryTurnDeg: round(capture.entryTurnDeg),
    remainingTurnDeg: round(capture.remainingTurnDeg),
    arcSegmentCount: capture.arcSegmentCount,
  };
}

function summarizeResponse(response: ExactResponseBoundary) {
  return {
    eventFrame: response.eventFrame,
    supportStartFrame: response.supportStartFrame,
    scorerImpactWindowFrames: IMPACT_WINDOW,
    prefix: {
      startFrame: response.prefix.startFrame,
      endFrameExclusive: response.prefix.endFrameExclusive,
      measurementSamples: response.prefix.measurementSamples,
      airborneSamples: response.prefix.airborneSamples,
      speedSumPxPerFrame: round(response.prefix.speedSumPxPerFrame ?? 0),
    },
    anchor: {
      reference: point(response.anchor.reference),
      headingDeg: round(response.anchor.headingDeg),
      speedPxPerFrame: round(response.anchor.speedPxPerFrame),
      sledSpanPx: round(response.anchor.sledSpanPx),
      anchorPoint: response.anchor.anchorPoint,
      headingSource: response.anchor.headingSource,
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

function summarizeRows(rows: readonly CaptureRow[]) {
  const status = (value: string) => rows.filter((row) => row.local?.status === value || row.localStatus === value).length;
  const planReady = rows.filter((row) => row.support?.status === "ready").length;
  const structurallyCoherent = rows.filter((row) => row.structurallyCoherent).length;
  return {
    attempted: rows.length,
    captureClosed: status("closed"),
    capturePreclear: status("preclear"),
    captureLanding: status("landing"),
    captureSurvival: status("survival"),
    captureResponseUnavailable: status("response_unavailable"),
    capturePersistenceUnavailable: status("persistence_unavailable"),
    captureOffbeat: status("offbeat"),
    capturePhysicalPrefixChanged: status("physical_prefix_changed"),
    rowErrors: status("error"),
    planReady,
    planUnavailable: rows.filter((row) => row.support !== null && row.support.status !== "ready" && row.support.status !== "not_attempted").length,
    structurallyCoherent,
  };
}

/**
 * The pair shares identical capture geometry.  These deltas expose the actual
 * contribution of state-shot support rather than asking readers to infer it
 * from two separate residual bags. Negative absolute-error change is better.
 */
function compareSupportEffect(
  captureOnly: ReturnType<typeof summarizeOutgoing>,
  combined: ReturnType<typeof summarizeOutgoing>,
) {
  const axes = new Set([...Object.keys(captureOnly.residuals), ...Object.keys(combined.residuals)]);
  const residuals = Object.fromEntries([...axes].sort().map((axis) => {
    const before = captureOnly.residuals[axis as keyof typeof captureOnly.residuals] as {
      residual: number | null;
      absoluteError: number | null;
    } | undefined;
    const after = combined.residuals[axis as keyof typeof combined.residuals] as {
      residual: number | null;
      absoluteError: number | null;
    } | undefined;
    return [axis, {
      captureOnlyResidual: before?.residual ?? null,
      combinedResidual: after?.residual ?? null,
      residualDelta: before?.residual === null || before?.residual === undefined ||
          after?.residual === null || after?.residual === undefined
        ? null
        : round(after.residual - before.residual),
      captureOnlyAbsoluteError: before?.absoluteError ?? null,
      combinedAbsoluteError: after?.absoluteError ?? null,
      absoluteErrorDelta: before?.absoluteError === null || before?.absoluteError === undefined ||
          after?.absoluteError === null || after?.absoluteError === undefined
        ? null
        : round(after.absoluteError - before.absoluteError),
    }];
  }));
  return {
    captureOnlyComplete: captureOnly.complete,
    combinedComplete: combined.complete,
    survivalChanged: captureOnly.complete !== combined.complete,
    residuals,
    interpretation: "negative absoluteErrorDelta means support improved the paired outgoing measurement",
  };
}

function sameEvent(
  left: ReturnType<typeof observeOwnedContactTransition>["selectedOwnedEvent"],
  right: ReturnType<typeof observeOwnedContactTransition>["selectedOwnedEvent"],
): boolean {
  return left !== null && right !== null && left.frame === right.frame &&
    left.ownedLineIds.length === right.ownedLineIds.length &&
    left.ownedLineIds.every((id, index) => id === right.ownedLineIds[index]);
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

function roundRecord(record: Record<string, number | undefined>): Record<string, number> {
  return Object.fromEntries(Object.entries(record).flatMap(([key, value]) =>
    typeof value === "number" && Number.isFinite(value) ? [[key, round(value)]] : [],
  ));
}

function point(value: { x: number; y: number }) {
  return { x: round(value.x), y: round(value.y) };
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.hypot(left.x - right.x, left.y - right.y);
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
