/**
 * Exact two-chunk control for the local state-support assay.
 *
 * For every declared threshold action this compares: (1) the existing finite
 * first chunk, (2) the same geometry with its final collinear segment extended,
 * and (3) the same extension represented as a separate G1 carrier line. It is
 * a calibration-only falsification study, not a rollout controller or compiler
 * candidate source.
 */
import { getSledPointPositionsMetered, PERSISTENCE_FRAMES, SLED_POINT_ORDER } from "../lib/detector.ts";
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
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import { scoredContactImpact } from "./trajectory/scored_contact_impact.ts";
import { extractPlanningState } from "./trajectory/state.ts";
import {
  realizeStateSupportContinuation,
  STATE_SUPPORT_CARRIER_FRAMES,
  STATE_SUPPORT_FIRST_CHUNK_FRAMES,
  type StateSupportContinuationArm,
} from "./trajectory/state_support_continuation.ts";
import { stateSupportResponseActions, type StateSupportResponseAction } from "./trajectory/state_support_response.ts";
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
  compareKinematicTraces,
  emptyEngineStateTraceFingerprint,
  engineCollisionHitsForLineIds,
  exactEngineStateTraceFingerprint,
  exactKinematicTraceFingerprint,
  exactTraceFingerprint,
  survivesThroughFrame,
} from "./trajectory/study_trace.ts";
import { targetFrameFromPlanningState } from "./trajectory/target_frame.ts";
import { transitionContractForGap } from "./trajectory/transition_contract.ts";

const argv = process.argv.slice(2);
const LOCAL_SURVIVAL_WINDOW_FRAMES = 16;
const ACTIONS = stateSupportResponseActions("threshold-v1");
const CONTINUATION_WINDOW_FRAMES = STATE_SUPPORT_FIRST_CHUNK_FRAMES + STATE_SUPPORT_CARRIER_FRAMES;

const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_state_support_continuation.ts --fixture=FILE [--out=FILE]",
    "",
    "Runs the fixed threshold-v1 local action menu with a predeclared",
    "carrier-presence and topology/line-label control matrix. Calibration-only; no tuning flags are accepted.",
  ].join("\n") + "\n");
  process.exit(0);
}

const fixturePath = argument("fixture");
if (fixturePath === undefined) throw new Error("--fixture=FILE is required");
const unsupported = argv.filter((value) => value.startsWith("--") && !value.startsWith("--fixture=") && !value.startsWith("--out="));
if (unsupported.length > 0) throw new Error(`unsupported continuation control(s): ${unsupported.join(", ")}`);
const explicitOut = argument("out");

const fixture = readFrozenTrajectoryFixture(fixturePath);
const STUDY_SCHEMA = "line.study-state-support-continuation.v4";
const protocolFingerprint = sha256(stableJson({
  actionMenu: "threshold-v1",
  actions: ACTIONS,
  firstChunkFrames: STATE_SUPPORT_FIRST_CHUNK_FRAMES,
  carrierFrames: STATE_SUPPORT_CARRIER_FRAMES,
  continuationWindowFrames: CONTINUATION_WINDOW_FRAMES,
  carrier: "fixed_collinear_exit_tangent",
  matrix: ["firstOnlyA", "mergedA", "mergedB", "splitAB", "splitBA"],
}));
const engineName = activeStudyEngine();
const sourceIdentityAtStart = studySourceIdentity("scripts/v0/study_state_support_continuation.ts");
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
  throw new Error(`state support continuation accepts only calibration fixtures; ${prepared.panel.id} is ${prepared.panel.cohort}`);
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
const rows = screen.map((entry, index) => evaluateRow(entry, index, prepared, contract.event.impact, baselinePhysicalPrefixTrace));
const summary = summarizeRows(rows);
const sourceIdentityAtEnd = studySourceIdentity("scripts/v0/study_state_support_continuation.ts");
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
    "Measure a finite carrier-presence contrast while separating topology from engine line-label/order sensitivity.",
    "Retain every capture, action, and arm; no action, arm, controller, or compiler source change may be selected from this output.",
    "Test only whether the fixed local formulation has enough physical continuity to justify a later, separately designed rollout study.",
  ],
  status: {
    protocolStatus,
    executionComplete: identityStable && summary.rowErrors === 0,
    actionAvailable: summary.actionAttempts > 0,
    primaryCarrierComparisonAvailable: summary.primaryCarrierComparableActions > 0,
    topologyMatrixComparisonAvailable: summary.topologyAComparableActions > 0 && summary.topologyBComparableActions > 0,
    labelControlComparisonAvailable: summary.labelMergedComparableActions > 0 && summary.labelSplitComparableActions > 0,
    claimEligibility: !identityStable
      ? "invalid: source or observed compiler identity changed during replay"
      : summary.rowErrors > 0
      ? "invalid: unexpected runtime error"
      : summary.primaryCarrierComparableActions === 0
      ? "unavailable: no closed capture retained the fixed 17-frame continuation horizon"
      : summary.topologyAComparableActions === 0 || summary.topologyBComparableActions === 0
      ? "available only for the descriptive added-carrier contrast; the topology matrix is unavailable"
      : summary.labelMergedComparableActions === 0 || summary.labelSplitComparableActions === 0
      ? "available only for descriptive carrier/topology telemetry; one or more label controls are unavailable"
      : "available only for descriptive local carrier/topology/label diagnosis on this calibration cohort",
    productionIntegration: "forbidden: calibration continuation control, not a compiler candidate source, rollout controller, or selector",
    cohortPolicy: "calibration only; holdout is declared only after a physical continuation formulation and fixed menu exist",
  },
  protocol: {
    protocolFingerprint,
    actionMenu: "threshold-v1",
    actions: ACTIONS,
    firstChunkFrames: STATE_SUPPORT_FIRST_CHUNK_FRAMES,
    carrierFrames: STATE_SUPPORT_CARRIER_FRAMES,
    continuationWindowFrames: CONTINUATION_WINDOW_FRAMES,
    carrier: "fixed_collinear_exit_tangent",
    geometryInputs: ["exact_response_anchor", "declared_threshold_action"],
    withheldFromGeometry: ["outgoing.axes", "outgoing.arrival", "next_event_impact", "duration_class", "seed", "case_id"],
    arms: {
      firstOnlyA: "existing finite first chunk, final line label A",
      mergedA: "carrier merged into the final line with label A",
      mergedB: "same merged coordinates with final line label B",
      splitAB: "same carrier as a separate line: final segment A, carrier B",
      splitBA: "same split coordinates with labels swapped: final segment B, carrier A",
    },
    contrasts: {
      primaryCarrier: "firstOnlyA vs splitAB: preserves every first-chunk line byte-for-byte and adds carrier B",
      mergedRepresentation: "firstOnlyA vs mergedA: representation telemetry only; lengthening changes the existing line's geometry/cache",
      topologyA: "mergedA vs splitAB",
      topologyB: "mergedB vs splitBA",
      labelMerged: "mergedA vs mergedB",
      labelSplit: "splitAB vs splitBA",
      attributionRule: "this study reports carrier, topology, and label ingredients only; it never emits a segmentation verdict. A separately preregistered analysis must define stability, negligibility, and a physical endpoint before any such verdict.",
    },
    structuralEndpoint: "full non-scarf engine-state identity over the frozen physical prefix and against capture-only replay through H-1, no all-body support collision before H, same owned capture event, survival strictly beyond H+17 unless end-of-spec occurs at H+17, and no off-beat landing in the observation horizon",
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
  transition: {
    incoming: { gap: contract.incoming.gapIndex, frames: contract.incoming.intervalFrames, axes: contract.incoming.axes },
    event: contract.event,
    outgoing: {
      gap: contract.outgoing.gapIndex,
      frames: contract.outgoing.intervalFrames,
      axes: contract.outgoing.axes,
      nextEvent: contract.outgoing.arrival,
      plannerInput: "none: this control receives only the observed response state and fixed action declaration",
    },
  },
  rows,
  summary,
  caveats: [
    "Static proposed terrain is present from frame zero even though constructed from a future observed state; every arm must prove full-engine identity before the current gap and against capture-only replay through H-1, plus zero all-body support collision before H.",
    "The engine orders collidable lines by ID. The topology/label matrix therefore treats merged-vs-split as a representation contrast, not a segmentation verdict. A raw hash mismatch or numerical-screen result alone is never a physical-effect verdict.",
    "Support CollisionUpdate line/point pairs are exact all-body contact evidence. Post-step sled projections beyond the virtual tip are retained only as geometric telemetry, not as collision location or causal exposure proof.",
    "A continuation-control result cannot establish a multi-chunk controller, a next-contact construction, or a long-rideout solution.",
    "The 3/4/5/6/7-second ladder is one correlated calibration family, not five independent observations.",
    "Identity is sampled before and after replay over the static import closure plus observed compiler/engine fingerprint. In-process module loading precedes that first sample, so archival evidence requiring a literal byte snapshot must run from an external immutable workspace.",
  ],
};

const canonicalOutPath = explicitOut ??
  `generated/studies/state-support-continuation/threshold-v1/v4/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}-${artifactIdentity.fingerprint.slice(0, 12)}.json`;
const outPath = !identityStable
  ? allocateStudyArtifactPath(forensicDriftArtifactPath(
    canonicalOutPath,
    sourceIdentityAtEnd.studySourceFingerprint,
    observationCompilerAtEnd.candidateFingerprint,
  ))
  : explicitOut ?? allocateStudyArtifactPath(canonicalOutPath);
writeStudyArtifact(outPath, output);
process.stderr.write(
  `state support continuation ${prepared.panel.id}: ${summary.primaryCarrierComparableActions} carrier / ` +
  `${summary.topologyAComparableActions} topology-A / ${summary.labelSplitComparableActions} split-label comparisons over ${summary.actionAttempts} action rows -> ${outPath}\n`,
);
if (!identityStable || summary.rowErrors > 0) {
  process.stderr.write(`state support continuation invalid: ${!identityStable ? "identity drift" : `${summary.rowErrors} unexpected row error(s)`}\n`);
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

type ContinuationExposureGeometry = {
  virtualTipPoint: { x: number; y: number };
  exitTangent: { x: number; y: number };
  finalFirstLineId: number;
  carrierLineId: number | null;
};

function evaluateRow(
  entry: ReturnType<typeof makeMirroredContactCaptureArcScreen>[number],
  index: number,
  input: PreparedTrajectoryFixtureCore,
  eventImpact: number | null,
  baselinePhysicalPrefixTrace: ReturnType<typeof exactTraceFingerprint>,
) {
  const started = performance.now();
  const simBefore = getSimFrames();
  let capture: ReturnType<typeof realizeContactCaptureArc>;
  try {
    const frame = contactKinematicFrameFromPlanningState(input.state, input.frame, { impact: eventImpact ?? undefined });
    capture = realizeContactCaptureArc(resolveContactCaptureArc(frame, entry.control), input.lineIdStart);
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
    const localObservation = observeCapture(localDetection, captureLines, captureRoles, input, localEnd);
    const observedCaptureStatus = classifyCapture(localDetection, localObservation, input, localEnd);
    const localPhysicalPrefixTrace = prefixTrace(localEngine, input.current.startFrame - 1);
    const captureStatus = sameTrace(localPhysicalPrefixTrace, baselinePhysicalPrefixTrace)
      ? observedCaptureStatus
      : "physical_prefix_changed" as const;
    const local = summarizeCapture(
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
    if (availableFrames < CONTINUATION_WINDOW_FRAMES) {
      return {
        ...baseRow(entry, index, capture, local, started, simBefore),
        captureStatus: "closed" as const,
        response: summarizeResponse(response),
        continuation: {
          status: "horizon_unavailable" as const,
          requiredFrames: CONTINUATION_WINDOW_FRAMES,
          availableFrames,
          reason: "response boundary leaves less than the fixed two-chunk observation horizon",
          actions: [],
        },
      };
    }
    const actionEndFrame = supportStartFrame + CONTINUATION_WINDOW_FRAMES;
    const actions = ACTIONS.map((action) => evaluateAction(
      action,
      input,
      captureLines,
      captureRoles,
      localObservation,
      local.captureTrace,
      baselinePhysicalPrefixTrace,
      response,
      actionEndFrame,
    ));
    return {
      ...baseRow(entry, index, capture, local, started, simBefore),
      captureStatus: "closed" as const,
      response: summarizeResponse(response),
      continuation: {
        status: "ready" as const,
        requiredFrames: CONTINUATION_WINDOW_FRAMES,
        availableFrames,
        actionEndFrame,
        actions: actionsWithMergedNeutralEffects(actions),
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
  captureOnlyTrace: ReturnType<typeof exactTraceFingerprint>,
  baselinePhysicalPrefixTrace: ReturnType<typeof exactTraceFingerprint>,
  response: {
    eventFrame: number;
    supportStartFrame: number;
    anchor: ReturnType<typeof targetFrameFromPlanningState>;
    prefix: NonNullable<ReturnType<typeof observePrefix>>;
  },
  actionEndFrame: number,
) {
  const started = performance.now();
  const simBefore = getSimFrames();
  try {
    const geometry = realizeStateSupportContinuation(response, action, input.lineIdStart + captureLines.length);
    const observedArms = {
      firstOnlyA: observeArm("firstOnlyA", geometry.arms.firstOnlyA, exposureGeometryForArm(geometry, "firstOnlyA"), input, captureLines, captureRoles, localObservation, captureOnlyTrace, baselinePhysicalPrefixTrace, response, actionEndFrame),
      mergedA: observeArm("mergedA", geometry.arms.mergedA, exposureGeometryForArm(geometry, "mergedA"), input, captureLines, captureRoles, localObservation, captureOnlyTrace, baselinePhysicalPrefixTrace, response, actionEndFrame),
      mergedB: observeArm("mergedB", geometry.arms.mergedB, exposureGeometryForArm(geometry, "mergedB"), input, captureLines, captureRoles, localObservation, captureOnlyTrace, baselinePhysicalPrefixTrace, response, actionEndFrame),
      splitAB: observeArm("splitAB", geometry.arms.splitAB, exposureGeometryForArm(geometry, "splitAB"), input, captureLines, captureRoles, localObservation, captureOnlyTrace, baselinePhysicalPrefixTrace, response, actionEndFrame),
      splitBA: observeArm("splitBA", geometry.arms.splitBA, exposureGeometryForArm(geometry, "splitBA"), input, captureLines, captureRoles, localObservation, captureOnlyTrace, baselinePhysicalPrefixTrace, response, actionEndFrame),
    };
    return {
      action,
      status: "observed" as const,
      geometry: {
        firstPlan: summarizePlan(geometry.firstPlan),
        firstChunk: summarizeLines(geometry.arms.firstOnlyA),
        virtualTipPoint: point(geometry.virtualTipPoint),
        carrier: summarizeLines([geometry.carrier]),
        lineLabels: geometry.lineLabels,
        branches: {
          firstOnlyA: summarizeLines(geometry.arms.firstOnlyA),
          mergedA: summarizeLines(geometry.arms.mergedA),
          mergedB: summarizeLines(geometry.arms.mergedB),
          splitAB: summarizeLines(geometry.arms.splitAB),
          splitBA: summarizeLines(geometry.arms.splitBA),
        },
      },
      arms: {
        firstOnlyA: publicArm(observedArms.firstOnlyA),
        mergedA: publicArm(observedArms.mergedA),
        mergedB: publicArm(observedArms.mergedB),
        splitAB: publicArm(observedArms.splitAB),
        splitBA: publicArm(observedArms.splitBA),
      },
      comparisons: {
        primaryCarrier: compareArms("primary_carrier", observedArms.firstOnlyA, observedArms.splitAB, response.supportStartFrame, actionEndFrame),
        mergedRepresentation: compareArms("merged_representation", observedArms.firstOnlyA, observedArms.mergedA, response.supportStartFrame, actionEndFrame),
        topologyA: compareArms("topology_a", observedArms.mergedA, observedArms.splitAB, response.supportStartFrame, actionEndFrame),
        topologyB: compareArms("topology_b", observedArms.mergedB, observedArms.splitBA, response.supportStartFrame, actionEndFrame),
        labelMerged: compareArms("label_merged", observedArms.mergedA, observedArms.mergedB, response.supportStartFrame, actionEndFrame),
        labelSplit: compareArms("label_split", observedArms.splitAB, observedArms.splitBA, response.supportStartFrame, actionEndFrame),
      },
      elapsedMs: round(performance.now() - started),
      simFrames: getSimFrames() - simBefore,
    };
  } catch (error) {
    return {
      action,
      status: "error" as const,
      reason: errorMessage(error),
      elapsedMs: round(performance.now() - started),
      simFrames: getSimFrames() - simBefore,
    };
  }
}

function exposureGeometryForArm(
  geometry: ReturnType<typeof realizeStateSupportContinuation>,
  arm: StateSupportContinuationArm,
): ContinuationExposureGeometry {
  const lines = geometry.arms[arm];
  const split = arm === "splitAB" || arm === "splitBA";
  const finalFirst = lines.at(split ? -2 : -1);
  if (finalFirst === undefined) throw new Error(`${arm} has no final first-chunk segment`);
  const carrier = split ? lines.at(-1) : null;
  return {
    virtualTipPoint: geometry.virtualTipPoint,
    exitTangent: lineTangent(geometry.carrier),
    finalFirstLineId: finalFirst.id,
    carrierLineId: carrier?.id ?? null,
  };
}

function observeArm(
  arm: StateSupportContinuationArm,
  supportLines: readonly TrackLine[],
  exposureGeometry: ContinuationExposureGeometry,
  input: PreparedTrajectoryFixtureCore,
  captureLines: TrackLine[],
  captureRoles: Map<number, string>,
  localObservation: ReturnType<typeof observeOwnedContactTransition>,
  captureOnlyTrace: ReturnType<typeof exactTraceFingerprint>,
  baselinePhysicalPrefixTrace: ReturnType<typeof exactTraceFingerprint>,
  response: {
    eventFrame: number;
    supportStartFrame: number;
    anchor: ReturnType<typeof targetFrameFromPlanningState>;
    prefix: NonNullable<ReturnType<typeof observePrefix>>;
  },
  actionEndFrame: number,
) {
  const started = performance.now();
  const simBefore = getSimFrames();
  const engine = input.engine.addLine([...captureLines, ...supportLines].map((line) => engineLineFromTrackLine(line)));
  const detection = detectWindow(engine, 0, actionEndFrame);
  const responseEnd = Math.min(input.outgoing.endFrame, input.current.endFrame + LOCAL_SURVIVAL_WINDOW_FRAMES);
  const observation = observeCapture(detection, captureLines, captureRoles, input, responseEnd);
  const physicalPrefixTrace = prefixTrace(engine, input.current.startFrame - 1);
  const observedCaptureStatus = classifyCapture(detection, observation, input, responseEnd);
  const captureStatus = sameTrace(physicalPrefixTrace, baselinePhysicalPrefixTrace)
    ? observedCaptureStatus
    : "physical_prefix_changed" as const;
  const captureTrace = exactEngineStateTraceFingerprint(engine, input.current.startFrame, response.supportStartFrame - 1);
  const responseAxisTrace = exactTraceFingerprint(detection, input.outgoing.startFrame, response.supportStartFrame - 1);
  const supportIds = new Set(supportLines.map((line) => line.id));
  const supportCollisionBeforeResponse = [];
  for (let frame = 0; frame < response.supportStartFrame; frame++) {
    supportCollisionBeforeResponse.push(...engineCollisionHitsForLineIds(engine, frame, supportIds));
  }
  const exposure = observeContinuationExposure(
    engine,
    supportLines,
    exposureGeometry,
    response.supportStartFrame,
    actionEndFrame,
  );
  const complete = survivesThroughFrame(detection, actionEndFrame) &&
    measurementLastFrame(detection) >= actionEndFrame;
  const offBeatLandingFrames = offBeatLandingEvents(detection, input.ctx.allContactFrames)
    .filter((event) => event.frame >= input.current.startFrame && event.frame <= actionEndFrame)
    .map((event) => event.frame);
  const windows = complete ? {
    interior: measureWindow(detection, response.supportStartFrame, response.supportStartFrame + STATE_SUPPORT_FIRST_CHUNK_FRAMES - 1, response.anchor.headingDeg, supportLines),
    legacyBoundary: measureWindow(detection, response.supportStartFrame, response.supportStartFrame + STATE_SUPPORT_FIRST_CHUNK_FRAMES, response.anchor.headingDeg, supportLines),
    continuation: measureWindow(detection, response.supportStartFrame, actionEndFrame, response.anchor.headingDeg, supportLines),
  } : null;
  const structural = complete &&
    captureStatus === "closed" &&
    sameTrace(physicalPrefixTrace, baselinePhysicalPrefixTrace) &&
    sameEvent(localObservation.selectedOwnedEvent, observation.selectedOwnedEvent) &&
    sameTrace(captureTrace, captureOnlyTrace) &&
    supportCollisionBeforeResponse.length === 0 &&
    offBeatLandingFrames.length === 0 &&
    windows !== null && windows.interior !== null && windows.legacyBoundary !== null && windows.continuation !== null;
  return {
    arm,
    support: summarizeLines(supportLines),
    terminus: detection.terminus,
    complete,
    captureStatus,
    selectedCaptureEventMatchesLocal: sameEvent(localObservation.selectedOwnedEvent, observation.selectedOwnedEvent),
    captureTrace,
    responseAxisTrace,
    physicalPrefixTrace,
    physicalPrefixTraceMatchesBaseline: sameTrace(physicalPrefixTrace, baselinePhysicalPrefixTrace),
    captureTraceMatchesCaptureOnly: sameTrace(captureTrace, captureOnlyTrace),
    supportCollisionBeforeResponse,
    exposure,
    offBeatLandingFrames,
    captureImpact: scoredContactImpact(detection, {
      target: input.current.targets.impact ?? null,
      landingFrame: observation.selectedOwnedEvent?.frame ?? null,
      responseWindowComplete: observation.responseWindowComplete,
    }),
    kinematicTraces: complete ? {
      interior: exactKinematicTraceFingerprint(detection, response.supportStartFrame, response.supportStartFrame + STATE_SUPPORT_FIRST_CHUNK_FRAMES - 1),
      legacyBoundary: exactKinematicTraceFingerprint(detection, response.supportStartFrame, response.supportStartFrame + STATE_SUPPORT_FIRST_CHUNK_FRAMES),
      continuation: exactKinematicTraceFingerprint(detection, response.supportStartFrame, actionEndFrame),
    } : null,
    detection,
    windows,
    structurallyValid: structural,
    elapsedMs: round(performance.now() - started),
    simFrames: getSimFrames() - simBefore,
  };
}

function observeCapture(
  detection: ReturnType<typeof detectWindow>,
  captureLines: TrackLine[],
  captureRoles: Map<number, string>,
  input: PreparedTrajectoryFixtureCore,
  localEnd: number,
) {
  return observeOwnedContactTransition(detection, {
    targetFrame: input.current.endFrame,
    gapFrames: input.current.endFrame - input.current.startFrame,
    observationEndFrame: localEnd,
    ownedLineIds: new Set(captureLines.map((line) => line.id)),
    lineRoles: captureRoles,
    requiredLineRoles: ["capture_band_approach", "capture_band_runway", "capture_band_arc"],
    persistenceOffsetFrames: PERSISTENCE_FRAMES,
    responseOffsetFrames: IMPACT_WINDOW,
  });
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

function summarizeCapture(
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
  return { startFrame, endFrameExclusive, measurementSamples: endFrameExclusive - startFrame, airborneSamples, speedSumPxPerFrame };
}

function measureWindow(
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
  const raw = {
    airFraction: airSamples / samples,
    meanSpeedPxPerFrame: speedSumPx / samples,
    meanSpeedAuthored: speedPxToAuthored(speedSumPx / samples),
    endHeadingDeg: headingDeg,
    headingDeltaDeg: angleDelta(headingDeg, entryHeadingDeg),
    supportContactDuty: supportContactFrames.length / samples,
  };
  return {
    startFrame,
    endFrame,
    measurementSamples: samples,
    airborneSamples: airSamples,
    airFraction: round(raw.airFraction),
    meanSpeedPxPerFrame: round(raw.meanSpeedPxPerFrame),
    meanSpeedAuthored: round(raw.meanSpeedAuthored),
    endHeadingDeg: round(raw.endHeadingDeg),
    headingDeltaDeg: round(raw.headingDeltaDeg),
    raw,
    temporal: {
      firstAirborneFrame: airFrames[0] ?? null,
      airborneRuns: contiguousRuns(airFrames),
      supportContactDuty: round(raw.supportContactDuty),
      firstSupportContactFrame: supportContactFrames[0] ?? null,
      lastSupportContactFrame: supportContactFrames.at(-1) ?? null,
      supportContactRuns: contiguousRuns(supportContactFrames),
      firstAirborneTipDistancePx: airFrames[0] === undefined ? null : distanceToSupportTip(detection, airFrames[0], supportLines),
    },
  };
}

/**
 * Exact exposure is based only on engine CollisionUpdate line/point pairs.
 * Post-step sled projections are retained as visual geometry telemetry, but
 * cannot localize an earlier solver collision within a frame.
 */
function observeContinuationExposure(
  engine: any,
  supportLines: readonly TrackLine[],
  geometry: ContinuationExposureGeometry,
  startFrame: number,
  endFrame: number,
) {
  const supportIds = new Set(supportLines.map((line) => line.id));
  const collisionsByLine = new Map<number, Map<number, Set<string>>>(
    supportLines.map((line) => [line.id, new Map<number, Set<string>>() ]),
  );
  const rawCollisionUpdatesByLine = new Map<number, number>(supportLines.map((line) => [line.id, 0]));
  let firstGeometricReach: { frame: number; sledPoint: string; alongRailPx: number } | null = null;
  let firstPostStepSledCollisionProjectionAtOrBeyondTip: { frame: number; lineId: number; sledPoint: string; alongRailPx: number } | null = null;

  for (let frame = startFrame; frame <= endFrame; frame++) {
    const positions = getSledPointPositionsMetered(engine, frame);
    for (let index = 0; index < SLED_POINT_ORDER.length; index++) {
      const x = positions[index * 2];
      const y = positions[index * 2 + 1];
      if (x === undefined || y === undefined) continue;
      const alongRailPx = (x - geometry.virtualTipPoint.x) * geometry.exitTangent.x +
        (y - geometry.virtualTipPoint.y) * geometry.exitTangent.y;
      if (alongRailPx < 0) continue;
      const sledPoint = SLED_POINT_ORDER[index]!;
      if (firstGeometricReach === null) firstGeometricReach = { frame, sledPoint, alongRailPx };
    }
    for (const hit of engineCollisionHitsForLineIds(engine, frame, supportIds)) {
      rawCollisionUpdatesByLine.set(hit.lineId, (rawCollisionUpdatesByLine.get(hit.lineId) ?? 0) + 1);
      const byFrame = collisionsByLine.get(hit.lineId);
      const pointIds = byFrame?.get(frame) ?? new Set<string>();
      for (const pointId of hit.pointIds) pointIds.add(pointId);
      byFrame?.set(frame, pointIds);
      for (const pointId of hit.pointIds) {
        const index = SLED_POINT_ORDER.indexOf(pointId as typeof SLED_POINT_ORDER[number]);
        if (index < 0) continue;
        const x = positions[index * 2];
        const y = positions[index * 2 + 1];
        if (x === undefined || y === undefined) continue;
        const alongRailPx = (x - geometry.virtualTipPoint.x) * geometry.exitTangent.x +
          (y - geometry.virtualTipPoint.y) * geometry.exitTangent.y;
        if (alongRailPx >= 0 && firstPostStepSledCollisionProjectionAtOrBeyondTip === null) {
          firstPostStepSledCollisionProjectionAtOrBeyondTip = { frame, lineId: hit.lineId, sledPoint: pointId, alongRailPx };
        }
      }
    }
  }

  const perLineCollision = supportLines.map((line) => {
    const collisions = [...(collisionsByLine.get(line.id) ?? new Map<number, Set<string>>()).entries()]
      .map(([frame, pointIds]) => ({ frame, pointIds: [...pointIds].sort() }))
      .sort((left, right) => left.frame - right.frame);
    const frames = collisions.map((collision) => collision.frame);
    return {
      lineId: line.id,
      role: line.id === geometry.finalFirstLineId
        ? "first_chunk_final_segment"
        : geometry.carrierLineId !== null && line.id === geometry.carrierLineId
        ? "split_carrier"
        : "first_chunk_other_segment",
      collisionFrames: frames,
      collisionRuns: contiguousRuns(frames),
      rawCollisionUpdateCount: rawCollisionUpdatesByLine.get(line.id) ?? 0,
      collisions,
    };
  });
  const finalFirstCollision = perLineCollision.find((line) => line.lineId === geometry.finalFirstLineId) ?? null;
  const carrierCollision = geometry.carrierLineId === null
    ? null
    : perLineCollision.find((line) => line.lineId === geometry.carrierLineId) ?? null;
  const anySupportLineCollision = perLineCollision.some((line) => line.collisionFrames.length > 0);
  const allBodyPointIds = [...new Set(perLineCollision.flatMap((line) =>
    line.collisions.flatMap((collision) => collision.pointIds),
  ))].sort();
  const classification = carrierCollision !== null && carrierCollision.collisionFrames.length > 0
    ? "carrier_line_collision_observed"
    : anySupportLineCollision
    ? "support_line_collision_observed"
    : "no_support_line_collision";
  return {
    classification,
    virtualTipPoint: point(geometry.virtualTipPoint),
    exitTangent: point(geometry.exitTangent),
    geometricReach: firstGeometricReach === null ? null : {
      ...firstGeometricReach,
      alongRailPx: firstGeometricReach.alongRailPx,
      displayAlongRailPx: round(firstGeometricReach.alongRailPx),
      meaning: "sled-point projection reaches the virtual-tip plane; this alone is not contact exposure",
    },
    exactContact: {
      anySupportLineCollision,
      allBodyPointIds,
      carrierLineCollisionObserved: carrierCollision !== null && carrierCollision.collisionFrames.length > 0,
      meaning: "CollisionUpdate line/point pairs are exact engine telemetry and include every colliding rider or sled point",
    },
    firstPostStepSledCollisionProjectionAtOrBeyondTip: firstPostStepSledCollisionProjectionAtOrBeyondTip === null ? null : {
      ...firstPostStepSledCollisionProjectionAtOrBeyondTip,
      alongRailPx: firstPostStepSledCollisionProjectionAtOrBeyondTip.alongRailPx,
      displayAlongRailPx: round(firstPostStepSledCollisionProjectionAtOrBeyondTip.alongRailPx),
      meaning: "post-step sled-point projection after a CollisionUpdate; it is geometric telemetry, not an exact collision location",
    },
    firstFinalFirstSegmentCollisionFrame: finalFirstCollision?.collisionFrames[0] ?? null,
    firstCarrierCollisionFrame: carrierCollision?.collisionFrames[0] ?? null,
    perLineCollision,
  };
}

function publicArm(arm: ReturnType<typeof observeArm>) {
  const { detection: _detection, ...publicRecord } = arm;
  return publicRecord;
}

type ContinuationComparisonKind =
  | "primary_carrier"
  | "merged_representation"
  | "topology_a"
  | "topology_b"
  | "label_merged"
  | "label_split";

function compareArms(
  kind: ContinuationComparisonKind,
  left: ReturnType<typeof observeArm>,
  right: ReturnType<typeof observeArm>,
  supportStartFrame: number,
  actionEndFrame: number,
) {
  const comparable = left.structurallyValid && right.structurallyValid && left.windows !== null && right.windows !== null;
  if (!comparable) {
    return {
      status: "unavailable" as const,
      reason: !left.structurallyValid ? `${left.arm}_not_structurally_valid` : `${right.arm}_not_structurally_valid`,
    };
  }
  const leftInterior = left.windows!.interior!;
  const rightInterior = right.windows!.interior!;
  const leftBoundary = left.windows!.legacyBoundary!;
  const rightBoundary = right.windows!.legacyBoundary!;
  const leftContinuation = left.windows!.continuation!;
  const rightContinuation = right.windows!.continuation!;
  return {
    status: "observed" as const,
    kind,
    exposure: comparisonExposure(kind, left, right),
    rawKinematicHashesEqual: {
      interior: left.kinematicTraces?.interior.fingerprint === right.kinematicTraces?.interior.fingerprint,
      legacyBoundary: left.kinematicTraces?.legacyBoundary.fingerprint === right.kinematicTraces?.legacyBoundary.fingerprint,
      continuation: left.kinematicTraces?.continuation.fingerprint === right.kinematicTraces?.continuation.fingerprint,
      meaning: "audit-only: a raw hash mismatch is not by itself a physical-effect verdict",
    },
    kinematicComparison: {
      interior: compareKinematicTraces(left.detection, right.detection, supportStartFrame, supportStartFrame + STATE_SUPPORT_FIRST_CHUNK_FRAMES - 1),
      legacyBoundary: compareKinematicTraces(left.detection, right.detection, supportStartFrame, supportStartFrame + STATE_SUPPORT_FIRST_CHUNK_FRAMES),
      continuation: compareKinematicTraces(left.detection, right.detection, supportStartFrame, actionEndFrame),
    },
    windowDeltas: {
      interior: measurementDelta(leftInterior, rightInterior),
      legacyBoundary: measurementDelta(leftBoundary, rightBoundary),
      continuation: measurementDelta(leftContinuation, rightContinuation),
    },
  };
}

/** A comparison is never promoted beyond exact all-body line/point telemetry. */
function comparisonExposure(
  kind: ContinuationComparisonKind,
  left: ReturnType<typeof observeArm>,
  right: ReturnType<typeof observeArm>,
) {
  const carrierLineCollisionObserved = left.exposure.exactContact.carrierLineCollisionObserved ||
    right.exposure.exactContact.carrierLineCollisionObserved;
  const anySupportLineCollisionObserved = left.exposure.exactContact.anySupportLineCollision ||
    right.exposure.exactContact.anySupportLineCollision;
  const stratum = carrierLineCollisionObserved
    ? "carrier_line_collision_observed" as const
    : anySupportLineCollisionObserved
    ? "support_line_collision_observed" as const
    : "no_support_line_collision" as const;
  const eligibleFor = kind === "primary_carrier"
    ? "descriptive added-carrier contrast only; no solver-time endpoint location is observed"
    : kind === "merged_representation"
    ? "representation telemetry only: extending the existing line changes its geometry/cache"
    : kind === "topology_a" || kind === "topology_b"
    ? "descriptive topology contrast only; interpret alongside both label controls"
    : "line-label/order sensitivity control only";
  return {
    stratum,
    eligibleFor,
    left: left.exposure.classification,
    right: right.exposure.classification,
    exactAllBodySupportCollision: {
      left: left.exposure.exactContact.anySupportLineCollision,
      right: right.exposure.exactContact.anySupportLineCollision,
      carrierLineCollisionObserved,
    },
    postStepGeometricTelemetry: {
      leftVirtualTipProjection: left.exposure.firstPostStepSledCollisionProjectionAtOrBeyondTip !== null,
      rightVirtualTipProjection: right.exposure.firstPostStepSledCollisionProjectionAtOrBeyondTip !== null,
      meaning: "not an exact collision location and never used to grant causal exposure",
    },
  };
}

function measurementDelta(left: NonNullable<ReturnType<typeof measureWindow>>, right: NonNullable<ReturnType<typeof measureWindow>>) {
  const raw = {
    airFraction: right.raw.airFraction - left.raw.airFraction,
    meanSpeedPxPerFrame: right.raw.meanSpeedPxPerFrame - left.raw.meanSpeedPxPerFrame,
    meanSpeedAuthored: right.raw.meanSpeedAuthored - left.raw.meanSpeedAuthored,
    headingDeltaDeg: right.raw.headingDeltaDeg - left.raw.headingDeltaDeg,
    supportContactDuty: right.raw.supportContactDuty - left.raw.supportContactDuty,
  };
  return {
    raw,
    display: Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, round(value)])),
  };
}

function actionsWithMergedNeutralEffects(actions: ReturnType<typeof evaluateAction>[]) {
  const neutral = actions.find((action) => action.action.id === "neutral");
  return actions.map((action) => {
    const merged = action.status === "observed" ? action.arms.mergedA : null;
    const neutralMerged = neutral?.status === "observed" ? neutral.arms.mergedA : null;
    if (merged === null || neutralMerged === null || !merged.structurallyValid || !neutralMerged.structurallyValid ||
      merged.windows?.continuation === null || neutralMerged.windows?.continuation === null) {
      return {
        ...action,
        mergedAGradeEffectFromNeutral: { status: "unavailable" as const, reason: "action_or_neutral_merged_a_arm_not_structurally_valid" },
      };
    }
    return {
      ...action,
      mergedAGradeEffectFromNeutral: {
        status: "observed" as const,
        continuationWindow: measurementDelta(neutralMerged.windows.continuation, merged.windows.continuation),
      },
    };
  });
}

function baseRow(
  entry: ReturnType<typeof makeMirroredContactCaptureArcScreen>[number],
  index: number,
  capture: ReturnType<typeof realizeContactCaptureArc>,
  local: ReturnType<typeof summarizeCapture>,
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
  local: ReturnType<typeof summarizeCapture> | null = null,
) {
  return {
    ...baseRow(entry, index, capture, local ?? { status: captureStatus } as ReturnType<typeof summarizeCapture>, started, simBefore),
    captureStatus,
    response: null,
    continuation: { status: "not_attempted" as const, reason, actions: [] },
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
    continuation: { status: "error" as const, reason: errorMessage(error), actions: [] },
    elapsedMs: round(performance.now() - started),
    simFrames: getSimFrames() - simBefore,
  };
}

function summarizeResponse(response: {
  eventFrame: number;
  supportStartFrame: number;
  anchor: ReturnType<typeof targetFrameFromPlanningState>;
  prefix: NonNullable<ReturnType<typeof observePrefix>>;
}) {
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

function summarizePlan(plan: ReturnType<typeof realizeStateSupportContinuation>["firstPlan"]) {
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
    lineIds: lines.map((line) => line.id),
  };
}

function summarizeRows(rows: readonly ReturnType<typeof evaluateRow>[]) {
  const actions = rows.flatMap((row) => row.continuation.actions);
  const observed = actions.filter((action) => action.status === "observed");
  const primaryCarrier = observed.filter((action) => action.comparisons.primaryCarrier.status === "observed");
  const mergedRepresentation = observed.filter((action) => action.comparisons.mergedRepresentation.status === "observed");
  const topologyA = observed.filter((action) => action.comparisons.topologyA.status === "observed");
  const topologyB = observed.filter((action) => action.comparisons.topologyB.status === "observed");
  const labelMerged = observed.filter((action) => action.comparisons.labelMerged.status === "observed");
  const labelSplit = observed.filter((action) => action.comparisons.labelSplit.status === "observed");
  const numericalSummary = (comparisons: typeof primaryCarrier) => {
    const continuation = comparisons.map((action) => action.comparisons.primaryCarrier.kind === "primary_carrier"
      ? action.comparisons.primaryCarrier.kinematicComparison.continuation
      : null,
    ).filter((comparison): comparison is NonNullable<typeof comparison> => comparison !== null);
    return {
      pass: continuation.filter((comparison) => comparison.status === "observed" && comparison.passesDeclaredNumericalScreen).length,
      fail: continuation.filter((comparison) => comparison.status === "observed" && !comparison.passesDeclaredNumericalScreen).length,
      unavailableOrInvalid: continuation.filter((comparison) => comparison.status !== "observed").length,
      rawHashDifferent: comparisons.filter((action) => !action.comparisons.primaryCarrier.rawKinematicHashesEqual.continuation).length,
    };
  };
  return {
    captureRows: rows.length,
    captureClosed: rows.filter((row) => row.captureStatus === "closed").length,
    horizonUnavailable: rows.filter((row) => row.continuation.status === "horizon_unavailable").length,
    actionAttempts: actions.length,
    observedActions: observed.length,
    primaryCarrierComparableActions: primaryCarrier.length,
    mergedRepresentationComparableActions: mergedRepresentation.length,
    topologyAComparableActions: topologyA.length,
    topologyBComparableActions: topologyB.length,
    labelMergedComparableActions: labelMerged.length,
    labelSplitComparableActions: labelSplit.length,
    primaryCarrierComparisonsByExposureStratum: countBy(primaryCarrier.map((action) => action.comparisons.primaryCarrier.exposure.stratum)),
    topologyAComparisonsByExposureStratum: countBy(topologyA.map((action) => action.comparisons.topologyA.exposure.stratum)),
    topologyBComparisonsByExposureStratum: countBy(topologyB.map((action) => action.comparisons.topologyB.exposure.stratum)),
    labelMergedComparisonsByExposureStratum: countBy(labelMerged.map((action) => action.comparisons.labelMerged.exposure.stratum)),
    labelSplitComparisonsByExposureStratum: countBy(labelSplit.map((action) => action.comparisons.labelSplit.exposure.stratum)),
    primaryCarrierContinuationNumericalScreen: numericalSummary(primaryCarrier),
    rowErrors: rows.filter((row) => row.captureStatus === "error").length + actions.filter((action) => action.status === "error").length,
    completeMatrixActionRows: observed.filter((action) =>
      action.arms.firstOnlyA.structurallyValid && action.arms.mergedA.structurallyValid &&
      action.arms.mergedB.structurallyValid && action.arms.splitAB.structurallyValid &&
      action.arms.splitBA.structurallyValid
    ).length,
  };
}

function countBy(values: readonly string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
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

function distanceToSupportTip(detection: ReturnType<typeof detectWindow>, frame: number, supportLines: readonly TrackLine[]): number | null {
  const position = positionAt(detection, frame);
  const tip = supportLines.at(-1);
  if (position === undefined || tip === undefined) return null;
  return round(Math.hypot(position.x - tip.x2, position.y - tip.y2));
}

function sameEvent(
  left: ReturnType<typeof observeOwnedContactTransition>["selectedOwnedEvent"],
  right: ReturnType<typeof observeOwnedContactTransition>["selectedOwnedEvent"],
) {
  return left !== null && right !== null && left.frame === right.frame &&
    left.ownedLineIds.length === right.ownedLineIds.length &&
    left.ownedLineIds.every((id, index) => id === right.ownedLineIds[index]);
}

/** Exact traces are a safety invariant: unavailable or differently sized traces never match. */
function sameTrace(
  left: ReturnType<typeof exactTraceFingerprint>,
  right: ReturnType<typeof exactTraceFingerprint>,
): boolean {
  return left.fingerprint !== null && right.fingerprint !== null &&
    left.unavailableAtFrame === null && right.unavailableAtFrame === null &&
    left.semantics === right.semantics && left.frameCount === right.frameCount &&
    left.fingerprint === right.fingerprint;
}

/** Handle a legitimate frame-zero target without asking the window detector for [0, -1]. */
function prefixTrace(engine: any, endFrame: number): ReturnType<typeof exactTraceFingerprint> {
  if (endFrame < 0) return emptyEngineStateTraceFingerprint();
  return exactEngineStateTraceFingerprint(engine, 0, endFrame);
}

function lineTangent(line: TrackLine): { x: number; y: number } {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 0) throw new Error("continuation carrier has invalid tangent");
  return { x: dx / length, y: dy / length };
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
