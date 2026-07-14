/**
 * Sealed fixed-horizon contact-phase assay.
 *
 * This is intentionally narrower than the retired v1 "bridge" read. It
 * constructs a bounded phase only from the physical prefix and current event,
 * then replays it through the known next *time boundary*. It does not generate,
 * rank, or claim a next-contact candidate. Long low-air carrier behavior is a
 * separate duration-aware question and is deliberately out of scope here.
 */
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import countercurrent from "../../benchmark/v2/cases/normative/representative/countercurrent.ts";
import dense240 from "../../benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts";
import pickupShifted from "../../benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { MIN_LANDING_AIRBORNE_FRAMES, PERSISTENCE_FRAMES } from "../lib/detector.ts";
import {
  hasPreTargetSledProximityFromTrace,
  readPreTargetSledTrace,
  type PreTargetSledTrace,
} from "./arc_placement.ts";
import {
  assertCompilerSourcesCommitted,
  compilerCandidateIdentity,
} from "./benchmark_v2/compiler_identity.ts";
import { detectWindow } from "./core/candidate.ts";
import {
  airborneAt,
  contactLineIdsAt,
  engineLineFromTrackLine,
  makeBaseEngine,
  measurementLastFrame,
  offBeatLandingEvents,
  positionAt,
  speedAt,
  velocityAt,
} from "./core/substrate.ts";
import { IMPACT_WINDOW, type Gap, type TrackLine } from "./types.ts";
import {
  buildTrajectoryCaptureSetup,
  materializeTrajectoryCaptureInput,
  type TrajectoryCaptureCase,
} from "./trajectory/capture_input.ts";
import { observeOwnedContactTransition } from "./trajectory/contact_observation.ts";
import { prepareTrajectoryPrefix, TrajectoryPrefixUnavailableError } from "./trajectory/prefix_capture_core.ts";
import { sha256, stableJson } from "./trajectory/postimpact_study_inputs.ts";
import {
  allocateStudyArtifactPath,
  assertStudyArtifactPathUnused,
  forensicDriftArtifactPath,
  studyArtifactIdentity,
  studySourceIdentity,
  writeStudyArtifact,
} from "./trajectory/study_artifact.ts";
import { rebuildPhysicalPrefixEngine } from "./trajectory/study_fixture.ts";
import {
  engineCollisionHitsForLineIds,
  exactEngineStateTraceFingerprint,
  survivesThroughFrame,
} from "./trajectory/study_trace.ts";
import { extractPlanningState, type PlanningState } from "./trajectory/state.ts";
import {
  TWO_CONTACT_PHASE_PROTOCOL,
  makeCompactTwoContactControls,
  makeOracleTwoContactControls,
  realizeTwoContactPhase,
  type TwoContactPhaseControl,
} from "./trajectory/two_contact_phase.ts";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_two_contact_envelope.ts --out=FILE [--case=all|ID]",
    "",
    "Runs the sealed fixed-horizon phase-response assay at its preregistered",
    "500k prefix budget. It constructs no continuation and writes immutable",
    "evidence outside the repository.",
  ].join("\n") + "\n");
  process.exit(0);
}

const CAPTURE_BUDGET = 500_000;
const CURRENT_CLOSURE_FRAMES_AFTER_TARGET = TWO_CONTACT_PHASE_PROTOCOL.fixedResponseHorizonFrames +
  TWO_CONTACT_PHASE_PROTOCOL.maxOwnedEventOffsetFrames;
const ORACLE_CONTROL_COUNT = TWO_CONTACT_PHASE_PROTOCOL.oracleCount;
const POSITIVE_CONTROL_TARGET_FRAME = 13;
const POSITIVE_CONTROL_LINE: TrackLine = {
  id: 1,
  type: 0,
  x1: -100,
  y1: 20,
  x2: 100,
  y2: 20,
  flipped: false,
  leftExtended: false,
  rightExtended: false,
};

type ScenarioKind = "dense" | "pickup" | "ordinary" | "impact_led";
type Scenario = {
  id: string;
  kind: ScenarioKind;
  capture: TrajectoryCaptureCase;
};

const scenarios: readonly Scenario[] = [
  {
    id: "dense",
    kind: "dense",
    capture: {
      id: "two_contact_dense",
      cohort: "calibration",
      category: "dense",
      spec: dense,
      sourcePath: "benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts",
      seed: 3_057_130_498,
      targetGap: 69,
      selectionRationale: "Predeclared dense phase boundary immediately before the g70 dead end.",
    },
  },
  {
    id: "dense240",
    kind: "dense",
    capture: {
      id: "two_contact_dense240",
      cohort: "calibration",
      category: "dense",
      spec: dense240,
      sourcePath: "benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts",
      seed: 3_057_130_496,
      targetGap: 86,
      selectionRationale: "Independent 240ms dense phase boundary used only as a second physical state.",
    },
  },
  {
    id: "pickup",
    kind: "pickup",
    capture: {
      id: "two_contact_pickup",
      cohort: "calibration",
      category: "ordinary",
      spec: pickupShifted,
      sourcePath: "benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts",
      seed: 27,
      targetGap: 90,
      selectionRationale: "Predeclared shifted-pickup boundary; unavailability is retained rather than replaced.",
    },
  },
  {
    id: "ordinary",
    kind: "ordinary",
    capture: {
      id: "two_contact_ordinary",
      cohort: "calibration",
      category: "ordinary",
      spec: countercurrent,
      sourcePath: "benchmark/v2/cases/normative/representative/countercurrent.ts",
      seed: 24,
      targetGap: 20,
      selectionRationale: "Predeclared ordinary contact-to-contact transition, independent of failure localization.",
    },
  },
  {
    id: "impact_led",
    kind: "impact_led",
    capture: {
      id: "two_contact_impact_led",
      cohort: "calibration",
      category: "ordinary",
      spec: believer,
      sourcePath: "benchmark/v2/cases/normative/development_music/believer_56_6s.ts",
      seed: 24,
      targetGap: 72,
      selectionRationale: "Predeclared high-impact music boundary; no local score is used for selection.",
    },
  },
];

type LocalOutcome = {
  structurallyValid: boolean;
  closureEndFrame: number;
  detectionEndFrame: number;
  complete: boolean;
  selectedOwnedEvent: unknown;
  closestOwnedEvent: unknown;
  contactObservation: {
    observationStartFrame: number;
    observationEndFrame: number;
    terminus: unknown;
    ownedEvents: unknown[];
    nearbyEvents: unknown[];
  };
  persistenceWindowComplete: boolean;
  responseWindowComplete: boolean;
  permittedEventWindowPhaseCollisions: Array<{ frame: number; lineId: number; pointIds: string[] }>;
  confirmedOffBeatLandingFrames: number[];
  unresolvedTailOffBeatLandingFrames: number[];
  rejectionReasons: string[];
};

type OutgoingObservation = {
  knownTimeBoundaryFrame: number;
  observationEndFrame: number;
  complete: boolean;
  measurementLastFrame: number;
  intervalFrames: number;
  airborneFrames: number | null;
  groundedFrames: number | null;
  airFraction: number | null;
  lastGroundedFrame: number | null;
  trailingAirborneFramesAtBoundary: number | null;
  requiredDetectorRunwayFrames: number;
  detectorRunwayResidualFrames: number | null;
  boundaryPhaseLineIds: number[];
  phaseCollisionFrames: number[];
  terminalStateAtBoundary: ReturnType<typeof summarizeDetectionState>;
  confirmedOffBeatLandingFrames: number[];
  unresolvedTailOffBeatLandingFrames: number[];
};

type FamilyRow = {
  index: number;
  status: "observed" | "error";
  error: string | null;
  control: ReturnType<typeof serializeControl>;
  realized: ReturnType<typeof summarizeRealized> | null;
  preTarget: {
    guardEndFrame: number;
    sledProximity: boolean;
    traceMatchesPrefix: boolean;
    trace: ReturnType<typeof exactEngineStateTraceFingerprint> | null;
    collisions: Array<{ frame: number; lineId: number; pointIds: string[] }>;
  } | null;
  local: LocalOutcome | null;
  outgoing: OutgoingObservation | null;
  elapsedMs: number;
};

type FamilyResult = {
  rows: FamilyRow[];
  summary: {
    attempted: number;
    observed: number;
    localStructuralValid: number;
    completeOutgoingObservation: number;
    detectorRunwayReadyAtBoundary: number;
    errors: number;
    byCollisionSide: Record<"toward_motion" | "away_from_motion", {
      attempted: number;
      observed: number;
      localStructuralValid: number;
      errors: number;
      localRejectionReasons: Record<string, number>;
    }>;
    localRejectionReasons: Record<string, number>;
  };
};

type PositiveControlResult = {
  status: "passed" | "failed";
  targetFrame: number;
  preEventGuardEndFrame: number;
  observationEndFrame: number;
  line: TrackLine;
  preTargetSledProximity: boolean;
  preTargetTraceMatchesPrefix: boolean;
  preTargetCollisions: Array<{ frame: number; lineId: number; pointIds: string[] }>;
  permittedEventWindowCollisions: Array<{ frame: number; lineId: number; pointIds: string[] }>;
  selectedOwnedEvent: unknown;
  closestOwnedEvent: unknown;
  ownedEvents: unknown[];
  nearbyEvents: unknown[];
  persistenceWindowComplete: boolean;
  responseWindowComplete: boolean;
  complete: boolean;
  confirmedOffBeatLandingFrames: number[];
  unresolvedTailOffBeatLandingFrames: number[];
  failureReasons: string[];
};

type ScenarioResult =
  | {
    id: string;
    kind: ScenarioKind;
    status: "available";
    capture: ReturnType<typeof summarizeCapture>;
    currentState: ReturnType<typeof summarizeState>;
    compact: FamilyResult;
    oracle: FamilyResult;
  }
  | {
    id: string;
    kind: ScenarioKind;
    status: "unavailable";
    code: string;
    message: string;
  };

const outputPath = requiredPath("out");
const requestedCase = argument("case") ?? "all";
assertNoUnknownOptions();
assertExactEnvironment();
assertExternalEvidencePath(outputPath);
assertStudyArtifactPathUnused(outputPath);

const selected = requestedCase === "all"
  ? scenarios
  : scenarios.filter((scenario) => scenario.id === requestedCase);
if (selected.length !== 1 && requestedCase !== "all") {
  throw new Error(`unknown --case=${requestedCase}; expected all or ${scenarios.map((scenario) => scenario.id).join("|")}`);
}

const sourceIdentityAtStart = studySourceIdentity("scripts/v0/study_two_contact_envelope.ts");
assertStudySourcesCommitted(sourceIdentityAtStart.sourceFiles);
assertCompilerSourcesCommitted();
const compilerAtStart = compilerCandidateIdentity("wasm");
const panelFingerprint = sha256(stableJson({
  transform: benchmarkPolicy.transform,
  scenarios: scenarios.map((scenario) => ({
    id: scenario.id,
    sourcePath: scenario.capture.sourcePath,
    seed: scenario.capture.seed,
    targetGap: scenario.capture.targetGap,
  })),
}));
const selectedPanelFingerprint = sha256(stableJson({
  requestedCase,
  scenarios: selected.map((scenario) => ({
    id: scenario.id,
    sourcePath: scenario.capture.sourcePath,
    seed: scenario.capture.seed,
    targetGap: scenario.capture.targetGap,
  })),
}));
const protocolFingerprint = sha256(stableJson({
  protocol: "causal-fixed-horizon-phase-response.v3",
  captureBudget: CAPTURE_BUDGET,
  phase: TWO_CONTACT_PHASE_PROTOCOL,
  oracleControlCount: ORACLE_CONTROL_COUNT,
  currentClosureFramesAfterTarget: CURRENT_CLOSURE_FRAMES_AFTER_TARGET,
  endpoint: "known next time boundary only; no continuation generation, scoring, or selection",
  preTargetGuards: ["full_engine_trace_through_earliest_permitted_event_minus_one", "all_body_collision", "sled_proximity"],
  localGuards: ["owned_capture_roles", "persistence", "impact_window", "survival", "no_confirmed_or_unresolved_offbeat"],
  outgoingReporting: ["exact occupancy", "trailing airborne run", "phase collisions", "terminal state"],
}));
const artifactIdentity = studyArtifactIdentity({
  schema: "line.study-causal-contact-phase-response.v3",
  fixtureFingerprint: selectedPanelFingerprint,
  studySourceFingerprint: sourceIdentityAtStart.studySourceFingerprint,
  observationCandidateFingerprint: compilerAtStart.candidateFingerprint,
  protocolFingerprint,
});

const started = performance.now();
const positiveControl = runPositiveControl();
const results = selected.map((scenario) => runScenario(scenario));
const sourceIdentityAtEnd = studySourceIdentity("scripts/v0/study_two_contact_envelope.ts");
const compilerAtEnd = compilerCandidateIdentity("wasm");
const identityStable = sourceIdentityAtStart.studySourceFingerprint === sourceIdentityAtEnd.studySourceFingerprint &&
  compilerAtStart.candidateFingerprint === compilerAtEnd.candidateFingerprint;
const rowErrors = results.reduce((sum, result) => result.status === "available"
  ? sum + result.compact.summary.errors + result.oracle.summary.errors
  : sum, 0);
const availableScenarioCount = results.filter((result) => result.status === "available").length;
const observedRowCount = results.reduce((sum, result) => result.status === "available"
  ? sum + result.compact.summary.observed + result.oracle.summary.observed
  : sum, 0);
const runtimeComplete = identityStable && rowErrors === 0;
const eligibleEvidence = runtimeComplete && positiveControl.status === "passed" &&
  availableScenarioCount > 0 && observedRowCount > 0;
const protocolStatus = !identityStable
  ? "invalid_identity_drift"
  : rowErrors > 0
  ? "invalid_runtime_error"
  : positiveControl.status !== "passed"
  ? "invalid_positive_control"
  : availableScenarioCount === 0 || observedRowCount === 0
  ? "inconclusive_no_available_observation"
  : "complete";
const document = {
  schema: "line.study-causal-contact-phase-response.v3",
  artifactIdentity,
  purpose: [
    "Falsify whether a fixed current-event phase stencil can close a local owned contact without using later-contact information.",
    "Replay the realized local geometry through the known next time boundary and report descriptive occupancy/release telemetry only.",
    "Retain every compact and oracle row; no control, candidate, continuation, score, headline, or promotion result is selected here.",
  ],
  status: {
    protocolStatus,
    runtimeComplete,
    executionComplete: runtimeComplete,
    eligibleEvidence,
    availableScenarioCount,
    observedRowCount,
    claimEligibility: !identityStable
      ? "invalid: source or observed compiler identity changed during replay"
      : rowErrors > 0
      ? "invalid: one or more rows raised an unexpected runtime error"
      : positiveControl.status !== "passed"
      ? "invalid: the independent detector/ownership positive control did not pass"
      : availableScenarioCount === 0 || observedRowCount === 0
      ? "inconclusive: no selected scenario yielded an available observed row"
      : "descriptive bounded-contact evidence only; not continuation or long-carrier evidence",
    retiredSchemas: {
      v1: "line.study-two-contact-envelope.v1 is non-evidence due to noncausal endpoint and false-node defects.",
      v2: "line.study-causal-contact-phase-response.v2 is non-evidence because chirality selected collision side and no positive control established the observation path.",
    },
  },
  protocol: {
    captureBudget: CAPTURE_BUDGET,
    phase: TWO_CONTACT_PHASE_PROTOCOL,
    oracleControlCount: ORACLE_CONTROL_COUNT,
    currentConstructionInputs: ["frozen physical prefix", "pre-contact planning state", "current impact ask", "predeclared control"],
    excludedConstructionInputs: ["outgoing duration", "outgoing axes", "next impact", "later contacts", "case id", "seed", "candidate score", "oracle outcomes"],
    prefixCondition: "The frozen physical prefix is selected by a full-spec compiler traversal. The construction is target-blind conditional on that prefix; this assay is not end-to-end future-blind compiler evidence.",
    positiveControl: "A fixed one-way horizontal rail proves the exact detector, role ownership, pre-event trace/collision guard, persistence, response, and off-beat path before phase rows can be interpreted.",
    endpoint: "The next contact time is used only after geometry is fixed as a detector observation boundary.",
    nonClaims: [
      "No row is a compiler candidate or a two-contact bridge witness.",
      "No outgoing air, speed, amplitude, elevation, impact, or long-carrier target is used or scored.",
      "The 3/4/5/6/7-second low-air ladder is excluded because a six-frame local phase cannot represent a duration-aware carrier.",
    ],
  },
  argv: [...argv],
  elapsedMs: round(performance.now() - started),
  provenance: {
    panelFingerprint,
    selectedPanelFingerprint,
    selectedScenarioIds: selected.map((scenario) => scenario.id),
    transform: benchmarkPolicy.transform,
    transformFingerprint: sha256(stableJson(benchmarkPolicy.transform)),
    runtime: { node: process.version, engine: "wasm" },
    studySourceFiles: sourceIdentityAtStart.sourceFiles,
    observationCompiler: compilerAtStart,
  },
  identityCheck: {
    stable: identityStable,
    studySourceFingerprintAtStart: sourceIdentityAtStart.studySourceFingerprint,
    studySourceFingerprintAtEnd: sourceIdentityAtEnd.studySourceFingerprint,
    observationCandidateFingerprintAtStart: compilerAtStart.candidateFingerprint,
    observationCandidateFingerprintAtEnd: compilerAtEnd.candidateFingerprint,
  },
  positiveControl,
  results,
};
const destination = identityStable
  ? outputPath
  : allocateStudyArtifactPath(forensicDriftArtifactPath(
    outputPath,
    sourceIdentityAtEnd.studySourceFingerprint,
    compilerAtEnd.candidateFingerprint,
  ));
writeStudyArtifact(destination, document);
process.stdout.write(formatSummary(document) + "\n");
if (!eligibleEvidence) process.exitCode = 2;

function runScenario(scenario: Scenario): ScenarioResult {
  const setup = buildTrajectoryCaptureSetup(scenario.capture, benchmarkPolicy.transform);
  try {
    const prepared = prepareTrajectoryPrefix(scenario.capture, setup, CAPTURE_BUDGET);
    const prefixEngine = rebuildPhysicalPrefixEngine(prepared.physicalPrefix);
    const currentState = requireState(prefixEngine, prepared.current.endFrame, `${scenario.id} current target`);
    const preTargetGuardEndFrame = currentPreEventGuardEndFrame(prepared.current);
    const prefixTrace = exactEngineStateTraceFingerprint(prefixEngine, 0, preTargetGuardEndFrame);
    const compact = evaluateFamily(
      makeCompactTwoContactControls({
        currentImpact: prepared.current.targets.impact,
        observedComSpeed: currentState.speed,
      }),
      prefixEngine,
      prefixTrace,
      preTargetGuardEndFrame,
      prepared.current,
      prepared.outgoing,
      prepared.physicalPrefix.prefixNextLineId,
      prepared.preTargetSledTrace,
      setup.allContactFrames,
    );
    const oracle = evaluateFamily(
      makeOracleTwoContactControls(ORACLE_CONTROL_COUNT),
      prefixEngine,
      prefixTrace,
      preTargetGuardEndFrame,
      prepared.current,
      prepared.outgoing,
      prepared.physicalPrefix.prefixNextLineId,
      prepared.preTargetSledTrace,
      setup.allContactFrames,
    );
    return {
      id: scenario.id,
      kind: scenario.kind,
      status: "available",
      capture: summarizeCapture(scenario.capture, prepared, setup),
      currentState: summarizeState(currentState),
      compact,
      oracle,
    };
  } catch (error) {
    if (error instanceof TrajectoryPrefixUnavailableError) {
      return { id: scenario.id, kind: scenario.kind, status: "unavailable", code: error.code, message: error.message };
    }
    throw error;
  }
}

function evaluateFamily(
  controls: readonly TwoContactPhaseControl[],
  prefixEngine: any,
  prefixTrace: ReturnType<typeof exactEngineStateTraceFingerprint>,
  preTargetGuardEndFrame: number,
  current: Gap,
  outgoing: Gap,
  lineIdStart: number,
  preTargetSledTrace: PreTargetSledTrace,
  allContactFrames: readonly number[],
): FamilyResult {
  const rows = controls.map((control, index) => evaluateControl({
    index,
    control,
    prefixEngine,
    prefixTrace,
    preTargetGuardEndFrame,
    current,
    outgoing,
    lineIdStart,
    preTargetSledTrace,
    allContactFrames,
  }));
  return { rows, summary: summarizeRows(rows) };
}

function evaluateControl(input: {
  index: number;
  control: TwoContactPhaseControl;
  prefixEngine: any;
  prefixTrace: ReturnType<typeof exactEngineStateTraceFingerprint>;
  preTargetGuardEndFrame: number;
  current: Gap;
  outgoing: Gap;
  lineIdStart: number;
  preTargetSledTrace: PreTargetSledTrace;
  allContactFrames: readonly number[];
}): FamilyRow {
  const started = performance.now();
  try {
    const state = requireState(
      input.prefixEngine,
      input.current.endFrame - input.control.phaseLookbackFrames,
      `phase[${input.index}] placement state`,
    );
    const realized = realizeTwoContactPhase(state, input.control, input.lineIdStart);
    const allPhaseLineIds = new Set(realized.lines.map((line) => line.id));
    const sledProximity = hasPreTargetSledProximityFromTrace(input.preTargetSledTrace, realized.lines);
    const candidateEngine = input.prefixEngine.addLine(realized.lines.map((line) => engineLineFromTrackLine(line)));
    const preTargetTrace = exactEngineStateTraceFingerprint(candidateEngine, 0, input.preTargetGuardEndFrame);
    const preTargetCollisions = collisionHitsInRange(
      candidateEngine,
      0,
      input.preTargetGuardEndFrame,
      allPhaseLineIds,
    );
    const closureEndFrame = input.current.endFrame + CURRENT_CLOSURE_FRAMES_AFTER_TARGET;
    const outgoingObservationEndFrame = input.outgoing.endFrame + PERSISTENCE_FRAMES - 1;
    const detectionEndFrame = Math.max(closureEndFrame, outgoingObservationEndFrame);
    const detection = detectWindow(candidateEngine, 0, detectionEndFrame);
    const captureRoles = new Map<number, string>([
      [realized.lineRoles.captureApproach, "capture_approach"],
      [realized.lineRoles.captureSurface, "capture_surface"],
      ...realized.lineRoles.phaseTail.map((lineId) => [lineId, "phase_tail"] as const),
    ]);
    const observation = observeOwnedContactTransition(detection, {
      targetFrame: input.current.endFrame,
      observationStartFrame: input.current.endFrame - TWO_CONTACT_PHASE_PROTOCOL.maxOwnedEventOffsetFrames,
      gapFrames: input.current.endFrame - input.current.startFrame,
      observationEndFrame: closureEndFrame,
      ownedLineIds: allPhaseLineIds,
      lineRoles: captureRoles,
      requiredLineRoles: ["capture_approach", "capture_surface"],
      persistenceOffsetFrames: PERSISTENCE_FRAMES,
      responseOffsetFrames: IMPACT_WINDOW,
      timingToleranceFrames: TWO_CONTACT_PHASE_PROTOCOL.maxOwnedEventOffsetFrames,
    });
    const localOffBeat = splitOffBeatLandings(detection, [input.current.endFrame], input.current.startFrame, closureEndFrame);
    const localComplete = survivesThroughFrame(detection, closureEndFrame) &&
      measurementLastFrame(detection) >= closureEndFrame;
    const permittedEventWindowPhaseCollisions = collisionHitsInRange(
      candidateEngine,
      input.current.endFrame - TWO_CONTACT_PHASE_PROTOCOL.maxOwnedEventOffsetFrames,
      closureEndFrame,
      allPhaseLineIds,
    );
    const rejectionReasons = localRejectionReasons({
      sledProximity,
      traceMatchesPrefix: sameExactTrace(input.prefixTrace, preTargetTrace),
      preTargetCollisions,
      observation,
      complete: localComplete,
      offBeat: localOffBeat,
    });
    const local: LocalOutcome = {
      structurallyValid: rejectionReasons.length === 0,
      closureEndFrame,
      detectionEndFrame,
      complete: localComplete,
      selectedOwnedEvent: observation.selectedOwnedEvent,
      closestOwnedEvent: observation.closestOwnedEvent,
      contactObservation: {
        observationStartFrame: input.current.endFrame - TWO_CONTACT_PHASE_PROTOCOL.maxOwnedEventOffsetFrames,
        observationEndFrame: closureEndFrame,
        terminus: observation.terminus,
        ownedEvents: observation.ownedEvents,
        nearbyEvents: observation.nearbyEvents,
      },
      persistenceWindowComplete: observation.persistenceWindowComplete,
      responseWindowComplete: observation.responseWindowComplete,
      permittedEventWindowPhaseCollisions,
      confirmedOffBeatLandingFrames: localOffBeat.confirmedFrames,
      unresolvedTailOffBeatLandingFrames: localOffBeat.unresolvedTailFrames,
      rejectionReasons,
    };
    return {
      index: input.index,
      status: "observed",
      error: null,
      control: serializeControl(input.control),
      realized: summarizeRealized(realized),
      preTarget: {
        guardEndFrame: input.preTargetGuardEndFrame,
        sledProximity,
        traceMatchesPrefix: sameExactTrace(input.prefixTrace, preTargetTrace),
        trace: preTargetTrace,
        collisions: preTargetCollisions,
      },
      local,
      outgoing: observeOutgoingBoundary(
        detection,
        input.current,
        input.outgoing,
        allPhaseLineIds,
        input.allContactFrames.filter((frame) => frame <= input.outgoing.endFrame),
      ),
      elapsedMs: round(performance.now() - started),
    };
  } catch (error) {
    return {
      index: input.index,
      status: "error",
      error: errorMessage(error),
      control: serializeControl(input.control),
      realized: null,
      preTarget: null,
      local: null,
      outgoing: null,
      elapsedMs: round(performance.now() - started),
    };
  }
}

function observeOutgoingBoundary(
  detection: ReturnType<typeof detectWindow>,
  current: Gap,
  outgoing: Gap,
  phaseLineIds: ReadonlySet<number>,
  contactFramesThroughBoundary: readonly number[],
): OutgoingObservation {
  const startFrame = current.endFrame;
  const boundaryFrame = outgoing.endFrame;
  const observationEndFrame = boundaryFrame + PERSISTENCE_FRAMES - 1;
  const measurementEnd = measurementLastFrame(detection);
  const complete = survivesThroughFrame(detection, observationEndFrame) && measurementEnd >= observationEndFrame;
  let airborneFrames = 0;
  let groundedFrames = 0;
  let lastGroundedFrame: number | null = null;
  let allSamplesAvailable = true;
  const phaseCollisionFrames: number[] = [];
  for (let frame = startFrame; frame < boundaryFrame; frame++) {
    const airborne = airborneAt(detection, frame);
    if (airborne === undefined) {
      allSamplesAvailable = false;
      break;
    }
    if (airborne) airborneFrames++;
    else {
      groundedFrames++;
      lastGroundedFrame = frame;
    }
    if (contactLineIdsAt(detection, frame).some((lineId) => phaseLineIds.has(lineId))) {
      phaseCollisionFrames.push(frame);
    }
  }
  const trailingAirborneFramesAtBoundary = allSamplesAvailable
    ? trailingAirborneFrames(detection, startFrame, boundaryFrame)
    : null;
  const boundaryPhaseLineIds = contactLineIdsAt(detection, boundaryFrame)
    .filter((lineId) => phaseLineIds.has(lineId));
  const offBeat = splitOffBeatLandings(detection, contactFramesThroughBoundary, startFrame, observationEndFrame);
  const intervalFrames = boundaryFrame - startFrame;
  return {
    knownTimeBoundaryFrame: boundaryFrame,
    observationEndFrame,
    complete,
    measurementLastFrame: measurementEnd,
    intervalFrames,
    airborneFrames: allSamplesAvailable ? airborneFrames : null,
    groundedFrames: allSamplesAvailable ? groundedFrames : null,
    airFraction: allSamplesAvailable && intervalFrames > 0 ? airborneFrames / intervalFrames : null,
    lastGroundedFrame,
    trailingAirborneFramesAtBoundary,
    requiredDetectorRunwayFrames: MIN_LANDING_AIRBORNE_FRAMES,
    detectorRunwayResidualFrames: trailingAirborneFramesAtBoundary === null
      ? null
      : Math.max(0, MIN_LANDING_AIRBORNE_FRAMES - trailingAirborneFramesAtBoundary),
    boundaryPhaseLineIds,
    phaseCollisionFrames,
    terminalStateAtBoundary: summarizeDetectionState(detection, boundaryFrame),
    confirmedOffBeatLandingFrames: offBeat.confirmedFrames,
    unresolvedTailOffBeatLandingFrames: offBeat.unresolvedTailFrames,
  };
}

function summarizeRows(rows: readonly FamilyRow[]): FamilyResult["summary"] {
  const emptySide = () => ({
    attempted: 0,
    observed: 0,
    localStructuralValid: 0,
    errors: 0,
    localRejectionReasons: {} as Record<string, number>,
  });
  const byCollisionSide: FamilyResult["summary"]["byCollisionSide"] = {
    toward_motion: emptySide(),
    away_from_motion: emptySide(),
  };
  const localRejectionReasons: Record<string, number> = {};
  for (const row of rows) {
    const side = byCollisionSide[row.control.collisionSide];
    side.attempted++;
    if (row.status === "observed") side.observed++;
    if (row.local?.structurallyValid === true) side.localStructuralValid++;
    if (row.status === "error") side.errors++;
    for (const reason of row.local?.rejectionReasons ?? []) {
      localRejectionReasons[reason] = (localRejectionReasons[reason] ?? 0) + 1;
      side.localRejectionReasons[reason] = (side.localRejectionReasons[reason] ?? 0) + 1;
    }
  }
  return {
    attempted: rows.length,
    observed: rows.filter((row) => row.status === "observed").length,
    localStructuralValid: rows.filter((row) => row.local?.structurallyValid === true).length,
    completeOutgoingObservation: rows.filter((row) => row.outgoing?.complete === true).length,
    detectorRunwayReadyAtBoundary: rows.filter((row) => row.outgoing?.detectorRunwayResidualFrames === 0).length,
    errors: rows.filter((row) => row.status === "error").length,
    byCollisionSide,
    localRejectionReasons,
  };
}

function summarizeCapture(
  capture: TrajectoryCaptureCase,
  prepared: ReturnType<typeof prepareTrajectoryPrefix>,
  setup: ReturnType<typeof buildTrajectoryCaptureSetup>,
) {
  const materialized = materializeTrajectoryCaptureInput(setup);
  return {
    sourcePath: capture.sourcePath,
    seed: capture.seed,
    targetGap: prepared.current.index,
    targetFrame: prepared.current.endFrame,
    nextTimeBoundaryGap: prepared.outgoing.index,
    nextTimeBoundaryFrame: prepared.outgoing.endFrame,
    intervalFrames: prepared.outgoingIntervalFrames,
    physicalPrefixFingerprint: prepared.physicalPrefixFingerprint,
    physicalPrefix: prepared.physicalPrefix,
    materializedFingerprint: sha256(stableJson(materialized)),
    projection: prepared.projection,
    currentImpact: prepared.current.targets.impact ?? null,
  };
}

function requireState(engine: any, frame: number, label: string): PlanningState {
  const state = extractPlanningState(engine, frame);
  if (state === null) throw new Error(`${label}: unable to read planning state at frame ${frame}`);
  return state;
}

function collisionHitsInRange(
  engine: any,
  startFrame: number,
  endFrame: number,
  lineIds: ReadonlySet<number>,
): Array<{ frame: number; lineId: number; pointIds: string[] }> {
  const hits: Array<{ frame: number; lineId: number; pointIds: string[] }> = [];
  for (let frame = startFrame; frame <= endFrame; frame++) {
    hits.push(...engineCollisionHitsForLineIds(engine, frame, lineIds));
  }
  return hits;
}

function sameExactTrace(
  left: ReturnType<typeof exactEngineStateTraceFingerprint>,
  right: ReturnType<typeof exactEngineStateTraceFingerprint>,
): boolean {
  return left.fingerprint !== null &&
    left.fingerprint === right.fingerprint &&
    left.frameCount === right.frameCount &&
    left.unavailableAtFrame === right.unavailableAtFrame &&
    left.semantics === right.semantics;
}

function currentPreEventGuardEndFrame(current: Pick<Gap, "endFrame">): number {
  const endFrame = current.endFrame - TWO_CONTACT_PHASE_PROTOCOL.maxOwnedEventOffsetFrames - 1;
  if (!Number.isSafeInteger(endFrame) || endFrame < 0) {
    throw new Error(`current contact frame ${current.endFrame} cannot support the declared pre-event guard`);
  }
  return endFrame;
}

function localRejectionReasons(input: {
  sledProximity: boolean;
  traceMatchesPrefix: boolean;
  preTargetCollisions: readonly unknown[];
  observation: ReturnType<typeof observeOwnedContactTransition>;
  complete: boolean;
  offBeat: { confirmedFrames: readonly number[]; unresolvedTailFrames: readonly number[] };
}): string[] {
  const reasons: string[] = [];
  if (input.sledProximity) reasons.push("pretarget_sled_proximity");
  if (!input.traceMatchesPrefix) reasons.push("pretarget_engine_trace_changed");
  if (input.preTargetCollisions.length > 0) reasons.push("pretarget_phase_collision");
  if (input.observation.selectedOwnedEvent === null) reasons.push("no_eligible_owned_capture_event");
  if (!input.observation.persistenceWindowComplete) reasons.push("persistence_window_incomplete");
  if (!input.observation.responseWindowComplete) reasons.push("response_window_incomplete");
  if (!input.complete) reasons.push("closure_horizon_incomplete");
  if (input.offBeat.confirmedFrames.length > 0) reasons.push("confirmed_offbeat_landing");
  if (input.offBeat.unresolvedTailFrames.length > 0) reasons.push("unresolved_tail_offbeat_landing");
  return reasons;
}

/**
 * Fixed end-to-end control for the observation path itself. It is not a
 * compiler candidate and cannot influence a phase row: a falling rider meets
 * one explicitly oriented rail at frame 13. The control exercises the same
 * exact pre-event replay, line ownership, detector, persistence/response,
 * and off-beat checks used by the assay rows.
 */
function runPositiveControl(): PositiveControlResult {
  const prefixEngine = makeBaseEngine({ position: { x: 0, y: 0 }, velocity: { x: 1, y: 0 } });
  const preEventGuardEndFrame = currentPreEventGuardEndFrame({ endFrame: POSITIVE_CONTROL_TARGET_FRAME });
  const prefixTrace = exactEngineStateTraceFingerprint(prefixEngine, 0, preEventGuardEndFrame);
  const candidateEngine = prefixEngine.addLine([engineLineFromTrackLine(POSITIVE_CONTROL_LINE)]);
  const candidateTrace = exactEngineStateTraceFingerprint(candidateEngine, 0, preEventGuardEndFrame);
  const lineIds = new Set([POSITIVE_CONTROL_LINE.id]);
  const preTargetCollisions = collisionHitsInRange(candidateEngine, 0, preEventGuardEndFrame, lineIds);
  const preTargetSledProximity = hasPreTargetSledProximityFromTrace(
    readPreTargetSledTrace(prefixEngine, {
      index: 0,
      startFrame: 0,
      endFrame: POSITIVE_CONTROL_TARGET_FRAME,
      endsWithContact: true,
      targets: {},
    }),
    [POSITIVE_CONTROL_LINE],
  );
  const observationEndFrame = POSITIVE_CONTROL_TARGET_FRAME + CURRENT_CLOSURE_FRAMES_AFTER_TARGET;
  const detection = detectWindow(candidateEngine, 0, observationEndFrame);
  const observation = observeOwnedContactTransition(detection, {
    targetFrame: POSITIVE_CONTROL_TARGET_FRAME,
    observationStartFrame: POSITIVE_CONTROL_TARGET_FRAME - TWO_CONTACT_PHASE_PROTOCOL.maxOwnedEventOffsetFrames,
    gapFrames: POSITIVE_CONTROL_TARGET_FRAME,
    observationEndFrame,
    ownedLineIds: lineIds,
    lineRoles: new Map([[POSITIVE_CONTROL_LINE.id, "positive_control_capture"]]),
    requiredLineRoles: ["positive_control_capture"],
    persistenceOffsetFrames: PERSISTENCE_FRAMES,
    responseOffsetFrames: IMPACT_WINDOW,
    timingToleranceFrames: TWO_CONTACT_PHASE_PROTOCOL.maxOwnedEventOffsetFrames,
  });
  const offBeat = splitOffBeatLandings(detection, [POSITIVE_CONTROL_TARGET_FRAME], 0, observationEndFrame);
  const complete = survivesThroughFrame(detection, observationEndFrame) &&
    measurementLastFrame(detection) >= observationEndFrame;
  const permittedEventWindowCollisions = collisionHitsInRange(
    candidateEngine,
    POSITIVE_CONTROL_TARGET_FRAME - TWO_CONTACT_PHASE_PROTOCOL.maxOwnedEventOffsetFrames,
    observationEndFrame,
    lineIds,
  );
  const failureReasons = localRejectionReasons({
    sledProximity: preTargetSledProximity,
    traceMatchesPrefix: sameExactTrace(prefixTrace, candidateTrace),
    preTargetCollisions,
    observation,
    complete,
    offBeat,
  });
  if (permittedEventWindowCollisions.length === 0) failureReasons.push("no_permitted_control_collision_witness");
  return {
    status: failureReasons.length === 0 ? "passed" : "failed",
    targetFrame: POSITIVE_CONTROL_TARGET_FRAME,
    preEventGuardEndFrame,
    observationEndFrame,
    line: { ...POSITIVE_CONTROL_LINE },
    preTargetSledProximity,
    preTargetTraceMatchesPrefix: sameExactTrace(prefixTrace, candidateTrace),
    preTargetCollisions,
    permittedEventWindowCollisions,
    selectedOwnedEvent: observation.selectedOwnedEvent,
    closestOwnedEvent: observation.closestOwnedEvent,
    ownedEvents: observation.ownedEvents,
    nearbyEvents: observation.nearbyEvents,
    persistenceWindowComplete: observation.persistenceWindowComplete,
    responseWindowComplete: observation.responseWindowComplete,
    complete,
    confirmedOffBeatLandingFrames: offBeat.confirmedFrames,
    unresolvedTailOffBeatLandingFrames: offBeat.unresolvedTailFrames,
    failureReasons,
  };
}

function splitOffBeatLandings(
  detection: ReturnType<typeof detectWindow>,
  contactFrames: readonly number[],
  startFrame: number,
  endFrame: number,
): { confirmedFrames: number[]; unresolvedTailFrames: number[] } {
  const observedEnd = Math.min(endFrame, measurementLastFrame(detection));
  const all = offBeatLandingEvents(detection, [...contactFrames])
    .filter((event) => event.frame >= startFrame && event.frame <= observedEnd)
    .map((event) => event.frame);
  const firstUnresolvedFrame = observedEnd - (PERSISTENCE_FRAMES - 2);
  const unresolvedTailFrames = all.filter((frame) => frame >= firstUnresolvedFrame);
  const unresolved = new Set(unresolvedTailFrames);
  return { confirmedFrames: all.filter((frame) => !unresolved.has(frame)), unresolvedTailFrames };
}

function trailingAirborneFrames(
  detection: ReturnType<typeof detectWindow>,
  startFrame: number,
  boundaryFrame: number,
): number | null {
  let count = 0;
  for (let frame = boundaryFrame - 1; frame >= startFrame; frame--) {
    const airborne = airborneAt(detection, frame);
    if (airborne === undefined) return null;
    if (!airborne) break;
    count++;
  }
  return count;
}

function summarizeDetectionState(detection: ReturnType<typeof detectWindow>, frame: number) {
  const position = positionAt(detection, frame);
  const velocity = velocityAt(detection, frame);
  const speed = speedAt(detection, frame);
  const airborne = airborneAt(detection, frame);
  if (position === undefined || velocity === undefined || speed === undefined || airborne === undefined) return null;
  return {
    frame,
    position: roundPoint(position),
    velocity: roundPoint(velocity),
    speed: round(speed),
    airborne,
  };
}

function summarizeRealized(realized: ReturnType<typeof realizeTwoContactPhase>) {
  return {
    lineHash: lineHash(realized.lines),
    lineCount: realized.lines.length,
    lineLength: round(lineLength(realized.lines)),
    // This bounded assay emits only a few lines per row. Preserve IEEE-754
    // values rather than inspection rounding so a row is replayable from its
    // immutable evidence without an ad-hoc rerun.
    lines: realized.lines.map((line) => ({
      id: line.id,
      type: line.type,
      x1: line.x1,
      y1: line.y1,
      x2: line.x2,
      y2: line.y2,
      flipped: Boolean(line.flipped),
      leftExtended: Boolean(line.leftExtended),
      rightExtended: Boolean(line.rightExtended),
    })),
    segmentCount: realized.segmentCount,
    contactPoint: { ...realized.contactPoint },
    entryAngleDeg: realized.entryAngleDeg,
    exitAngleDeg: realized.exitAngleDeg,
    lineRoles: { ...realized.lineRoles, phaseTail: [...realized.lineRoles.phaseTail] },
    anchor: {
      point: realized.anchor.point,
      headingSource: realized.anchor.headingSource,
      headingDeg: realized.anchor.headingDeg,
      speedPxPerFrame: realized.anchor.speedPxPerFrame,
      sledSpanPx: realized.anchor.sledSpanPx,
    },
    com: {
      headingDeg: realized.com.headingDeg,
      speedPxPerFrame: realized.com.speedPxPerFrame,
    },
    orientation: structuredClone(realized.orientation),
  };
}

function summarizeState(state: PlanningState) {
  return {
    frame: state.frame,
    reference: roundPoint(state.reference),
    velocity: roundPoint(state.velocity),
    speed: round(state.speed),
    velocityAngleDeg: round(state.velocityAngleDeg),
    referencePointName: state.referencePointName,
    phase: { ...state.phase },
  };
}

function serializeControl(control: TwoContactPhaseControl) {
  return {
    phaseLookbackFrames: control.phaseLookbackFrames,
    chirality: control.chirality,
    tailAction: control.tailAction,
    collisionSide: control.collisionSide,
    approachDeltaDeg: control.approachDeltaDeg,
    turnDeg: control.turnDeg,
    preloadSledSpans: control.preloadSledSpans,
    tangentFrames: control.tangentFrames,
    approachFrames: control.approachFrames,
    captureSurfaceFrames: control.captureSurfaceFrames,
    phaseHorizonFrames: control.phaseHorizonFrames,
  };
}

function lineHash(lines: readonly TrackLine[]): string {
  return sha256(stableJson(lines.map((line) => ({
    id: line.id,
    type: line.type,
    x1: line.x1,
    y1: line.y1,
    x2: line.x2,
    y2: line.y2,
    flipped: Boolean(line.flipped),
    leftExtended: Boolean(line.leftExtended),
    rightExtended: Boolean(line.rightExtended),
  }))));
}

function lineLength(lines: readonly TrackLine[]): number {
  return lines.reduce((sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1), 0);
}

function requiredPath(name: string): string {
  const value = argument(name);
  if (value === undefined || value === "") throw new Error(`--${name}=FILE is required`);
  return resolve(value);
}

function assertNoUnknownOptions(): void {
  const supported = ["--out=", "--case="];
  const unknown = argv.filter((value) => !supported.some((prefix) => value.startsWith(prefix)));
  if (unknown.length > 0) throw new Error(`unsupported option(s): ${unknown.join(", ")}`);
}

function assertExactEnvironment(): void {
  const relevant = Object.fromEntries(Object.entries(process.env)
    .filter(([name, value]) => name.startsWith("LR_") && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right)));
  if (stableJson(relevant) !== stableJson({ LR_ENGINE: "wasm" })) {
    throw new Error(`study requires exactly LR_ENGINE=wasm; received ${stableJson(relevant)}`);
  }
}

function assertStudySourcesCommitted(paths: readonly string[]): void {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", ...paths], { stdio: "ignore" });
    execFileSync("git", ["diff", "--quiet", "HEAD", "--", ...paths], { stdio: "ignore" });
  } catch {
    throw new Error("study sources and panel definitions must be tracked, committed, and clean");
  }
}

function assertExternalEvidencePath(path: string): void {
  const workspace = realpathSync(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
  const canonical = canonicalProspectivePath(path);
  if (canonical === workspace || relative(workspace, canonical) === "" || !relative(workspace, canonical).startsWith("..")) {
    throw new Error(`study evidence must be outside the repository: ${path}`);
  }
}

function canonicalProspectivePath(path: string): string {
  let existing = resolve(path);
  const suffix: string[] = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) throw new Error(`cannot resolve evidence parent for ${path}`);
    suffix.unshift(basename(existing));
    existing = parent;
  }
  return resolve(realpathSync(existing), ...suffix);
}

function formatSummary(document: {
  results: readonly ScenarioResult[];
  elapsedMs: number;
  positiveControl: PositiveControlResult;
  status: { protocolStatus: string; eligibleEvidence: boolean };
}): string {
  const lines = [
    `causal contact-phase response: ${document.results.length} scenario(s), ${round(document.elapsedMs)}ms; ` +
      `positive-control=${document.positiveControl.status}; status=${document.status.protocolStatus}`,
  ];
  for (const result of document.results) {
    if (result.status === "unavailable") {
      lines.push(`${result.id}: unavailable (${result.code})`);
      continue;
    }
    lines.push(
      `${result.id}: compact ${formatFamilySummary(result.compact.summary)}; ` +
      `oracle ${formatFamilySummary(result.oracle.summary)}`,
    );
  }
  return lines.join("\n");
}

function formatFamilySummary(summary: FamilyResult["summary"]): string {
  const toward = summary.byCollisionSide.toward_motion;
  const away = summary.byCollisionSide.away_from_motion;
  return `toward=${toward.localStructuralValid}/${toward.attempted}, ` +
    `away-diagnostic=${away.localStructuralValid}/${away.attempted}, ` +
    `runway-ready=${summary.detectorRunwayReadyAtBoundary}`;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundPoint(value: { x: number; y: number }) {
  return { x: round(value.x), y: round(value.y) };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
