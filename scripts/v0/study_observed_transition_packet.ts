/**
 * Observe the final normal compiler path at one frozen authored transition.
 *
 * This is deliberately read-only. Its only purpose is to determine whether a
 * later transition-source experiment has a real, finite capture boundary to
 * start from. It neither contributes candidates nor changes selection.
 */
import { PERSISTENCE_FRAMES } from "../lib/detector.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { fingerprintFiles } from "./benchmark_v2/suite_model.ts";
import { engineLineFromTrackLine, makeBaseEngine } from "./core/substrate.ts";
import { compileHandoff, snapshotHandoffNode, type HandoffNodeSnapshot } from "./optimizer/handoff.ts";
import { leafKeyForReport } from "./optimizer/register.ts";
import type { CompileCheckpoint } from "./optimizer/types.ts";
import { scoreDriftReport } from "./score.ts";
import { IMPACT_WINDOW, type Gap, type TrackLine } from "./types.ts";
import {
  bindFinalOutputSnapshot,
  selectedTransitionAvailability,
  type SelectedTransitionLineGroups,
} from "./trajectory/observed_transition_packet.ts";
import { observeOwnedContactTransition } from "./trajectory/contact_observation.ts";
import { detectPostimpactWindow } from "./trajectory/postimpact_detector.ts";
import {
  samePostimpactExactEngineTrace,
  samePostimpactOwnedCaptureEvent,
} from "./trajectory/postimpact_observation.ts";
import { exactPostimpactEngineStateTraceFingerprint } from "./trajectory/postimpact_trace.ts";
import {
  buildObservedTransitionPacketSetup,
  getObservedTransitionPacketCase,
  OBSERVED_TRANSITION_PACKET_CASE_IDS,
} from "./trajectory/observed_transition_packet_panel.ts";
import { materializeTrajectoryCaptureInput } from "./trajectory/capture_input.ts";
import { sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import {
  allocateStudyArtifactPath,
  assertStudyArtifactPathUnused,
  forensicDriftArtifactPath,
  studySourceIdentity,
  writeImmutableJsonArtifact,
} from "./trajectory/study_artifact.ts";
import { activeStudyEngine } from "./trajectory/study_runtime.ts";
import { extractPlanningState, type PlanningState } from "./trajectory/state.ts";
import { targetFrameFromPlanningState } from "./trajectory/target_frame.ts";
import { transitionContractForGap } from "./trajectory/transition_contract.ts";

const argv = process.argv.slice(2);
const STUDY_SCHEMA = "line.study-observed-transition-packet.v2";
const FIXED_BUDGET = 500_000;

function argument(name: string): string | undefined {
  return argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_observed_transition_packet.ts --case=NAME [--out=FILE] [--verify-output-neutrality]",
    "",
    `Cases: ${OBSERVED_TRANSITION_PACKET_CASE_IDS.join(", ")}`,
    "",
    "Runs one normal WASM/500k compile and records only its final selected path.",
  ].join("\n") + "\n");
  process.exit(0);
}

const caseId = argument("case");
if (caseId === undefined || !OBSERVED_TRANSITION_PACKET_CASE_IDS.includes(caseId as never)) {
  throw new Error(`--case must be one of ${OBSERVED_TRANSITION_PACKET_CASE_IDS.join(", ")}`);
}
const unknownOptions = argv.filter((value) =>
  value.startsWith("--") && !value.startsWith("--case=") && !value.startsWith("--out=") &&
  value !== "--verify-output-neutrality",
);
if (unknownOptions.length > 0) throw new Error(`unsupported option(s): ${unknownOptions.join(", ")}`);

const engine = activeStudyEngine();
if (engine !== "wasm") throw new Error(`observed transition packet requires LR_ENGINE=wasm; received ${engine}`);
const panel = getObservedTransitionPacketCase(caseId);
const setup = buildObservedTransitionPacketSetup(panel);
const current = setup.gaps[panel.targetGap];
const next = setup.gaps[panel.targetGap + 1];
if (current === undefined || next === undefined || !current.endsWithContact || !next.endsWithContact ||
    next.startFrame !== current.endFrame) {
  throw new Error(`${panel.id}: declared target does not form a contiguous contact transition`);
}
const transition = transitionContractForGap(current, next, setup.gapAxisTargets);
if (transition.outgoing === null) throw new Error(`${panel.id}: missing direct outgoing interval`);

const materialized = materializeTrajectoryCaptureInput(setup);
const materializedFingerprint = sha256(stableJson(materialized));
const panelSourceFingerprintAtStart = fingerprintFiles([panel.sourcePath]);
const sourceIdentityAtStart = studySourceIdentity("scripts/v0/study_observed_transition_packet.ts");
const compilerAtStart = compilerCandidateIdentity(engine);
const verifyOutputNeutrality = argv.includes("--verify-output-neutrality");
const protocol = {
  schema: STUDY_SCHEMA,
  engine: "wasm",
  budget: FIXED_BUDGET,
  panel: { id: panel.id, sourcePath: panel.sourcePath, seed: panel.seed, targetGap: panel.targetGap },
  finalBinding: "last_improving_register_snapshot_matches_emitted_lines.v1",
  captureBoundary: "shortest_current_fit_prefix_owns_event_and_matches_full_engine_through_H_plus_1.v1",
  responseBoundary: "H=selected_owned_event_plus_impact_window_plus_one.v1",
  outgoingInput: "direct_interval_literal_air_speed_only; undefined_remains_undefined.v1",
  outputNeutralityControl: verifyOutputNeutrality,
};
const protocolFingerprint = sha256(stableJson(protocol));
const artifactIdentity = {
  schema: STUDY_SCHEMA,
  materializedFingerprint,
  panelSourceFingerprint: panelSourceFingerprintAtStart,
  studySourceFingerprint: sourceIdentityAtStart.studySourceFingerprint,
  observationCandidateFingerprint: compilerAtStart.candidateFingerprint,
  protocolFingerprint,
};
const artifactFingerprint = sha256(stableJson(artifactIdentity));
const explicitOut = argument("out");
if (explicitOut !== undefined) assertStudyArtifactPathUnused(explicitOut);

let finalSnapshot: HandoffNodeSnapshot | null = null;
const started = performance.now();
const checkpoint = compileHandoff(setup.spec, panel.seed, {
  budget: FIXED_BUDGET,
  onNode(node, key, event) {
    if (event.improved) finalSnapshot = snapshotHandoffNode(node, key, event);
  },
});
const control = verifyOutputNeutrality
  ? compileHandoff(setup.spec, panel.seed, { budget: FIXED_BUDGET })
  : null;
const binding = bindFinalOutputSnapshot(finalSnapshot, checkpoint.track.lines);
const bindingErrors = binding.status === "bound"
  ? verifyFinalSnapshot(binding.snapshot, checkpoint, setup.durationFrames)
  : [binding.reason];
const selected = binding.status === "bound" && bindingErrors.length === 0
  ? selectedTransitionAvailability(binding.snapshot.node, panel.targetGap)
  : null;
const observation = binding.status === "bound" && selected?.status === "available"
  ? observeFinalTransition(binding.snapshot, selected.groups, current, transition.outgoing)
  : null;

const sourceIdentityAtEnd = studySourceIdentity("scripts/v0/study_observed_transition_packet.ts");
const compilerAtEnd = compilerCandidateIdentity(engine);
const panelSourceFingerprintAtEnd = fingerprintFiles([panel.sourcePath]);
const materializedFingerprintAtEnd = sha256(stableJson(
  materializeTrajectoryCaptureInput(buildObservedTransitionPacketSetup(panel)),
));
const identityStable = sourceIdentityAtStart.studySourceFingerprint === sourceIdentityAtEnd.studySourceFingerprint &&
  compilerAtStart.candidateFingerprint === compilerAtEnd.candidateFingerprint &&
  panelSourceFingerprintAtStart === panelSourceFingerprintAtEnd &&
  materializedFingerprint === materializedFingerprintAtEnd;
const outputNeutrality = control === null
  ? "not_requested"
  : sameOutputIdentity(outputIdentity(checkpoint), outputIdentity(control)) ? "exact_match" : "mismatch";
const status = !identityStable
  ? "invalid_identity"
  : outputNeutrality === "mismatch"
  ? "invalid_observation"
  : binding.status !== "bound" || bindingErrors.length > 0
  ? "invalid_output_binding"
  : selected?.status !== "available" || observation?.availability !== "available"
  ? "unavailable"
  : "observed";
const score = scoreDriftReport(checkpoint.report, { totalFrames: setup.durationFrames });
const output = {
  schema: STUDY_SCHEMA,
  artifactIdentity: { ...artifactIdentity, fingerprint: artifactFingerprint },
  argv: [...argv],
  elapsedMs: round(performance.now() - started),
  status: {
    value: status,
    identityStable,
    outputNeutrality,
    outputBound: binding.status === "bound" && bindingErrors.length === 0,
    transitionAvailable: selected?.status === "available",
    constructionEligible: status === "observed" && observation?.captureBoundary.status === "available" &&
      observation.response.step !== null,
    productionIntegration: "forbidden: read-only observation only",
  },
  protocol: { ...protocol, fingerprint: protocolFingerprint },
  provenance: {
    runtime: { node: process.version, engine, relevantEnvironment: relevantEnvironment() },
    studySource: sourceIdentityAtStart,
    compiler: compilerAtStart,
    panel: {
      id: panel.id,
      cohort: panel.cohort,
      category: panel.category,
      sourcePath: panel.sourcePath,
      sourceFingerprint: panelSourceFingerprintAtStart,
      seed: panel.seed,
      targetGap: panel.targetGap,
      selectionRationale: panel.selectionRationale,
    },
    materialized: { fingerprint: materializedFingerprint, contactFrames: materialized.contactFrames },
  },
  identityCheck: {
    stable: identityStable,
    studySourceFingerprintAtStart: sourceIdentityAtStart.studySourceFingerprint,
    studySourceFingerprintAtEnd: sourceIdentityAtEnd.studySourceFingerprint,
    compilerFingerprintAtStart: compilerAtStart.candidateFingerprint,
    compilerFingerprintAtEnd: compilerAtEnd.candidateFingerprint,
    panelSourceFingerprintAtStart,
    panelSourceFingerprintAtEnd,
    materializedFingerprintAtStart: materializedFingerprint,
    materializedFingerprintAtEnd,
  },
  finalOutput: {
    ...outputIdentity(checkpoint),
    score: round(score.score),
    contractPassed: score.contract_passed,
    stats: {
      simFrames: checkpoint.stats.sim_frames ?? null,
      budgetExhausted: checkpoint.stats.budget_exhausted ?? null,
      improvements: checkpoint.stats.improvements ?? null,
      deepestGap: checkpoint.stats.handoff_deepest_seen_gap ?? null,
    },
    binding: {
      status: binding.status,
      errors: bindingErrors,
      snapshot: binding.status === "bound" ? snapshotSummary(binding.snapshot) : null,
    },
  },
  outputNeutralityControl: control === null ? null : {
    identity: outputIdentity(control),
    exactMatch: outputNeutrality === "exact_match",
  },
  transition: {
    incoming: transition.incoming,
    event: transition.event,
    // The future event is intentionally not included in the constructible
    // release input. The outgoing interval and literal non-event axes are.
    outgoing: {
      gapIndex: transition.outgoing.gapIndex,
      startFrame: transition.outgoing.startFrame,
      endFrame: transition.outgoing.endFrame,
      intervalFrames: transition.outgoing.intervalFrames,
      measurementSamples: transition.outgoing.measurementSamples,
      axes: transition.outgoing.axes,
    },
    finalPath: selected === null ? null : {
      status: selected.status,
      ...(selected.status === "unavailable" ? { reason: selected.reason } : {}),
      lineIds: selected.groups.ids,
    },
  },
  observation,
  caveats: [
    "This packet records the final normal compiler output only; it is not a candidate or benchmark result.",
    "Unavailable final paths are retained as coverage evidence and are never replaced with another search visit.",
    "A future release construction receives no next impact, later target, case identity, score, seed, or prior outcome.",
  ],
};

const canonicalOut = `generated/studies/observed-transition-packet/v2/${panel.id}-` +
  `${materializedFingerprint.slice(0, 12)}-${artifactFingerprint.slice(0, 12)}.json`;
const outPath = identityStable
  ? explicitOut ?? allocateStudyArtifactPath(canonicalOut)
  : allocateStudyArtifactPath(forensicDriftArtifactPath(
    canonicalOut,
    sourceIdentityAtEnd.studySourceFingerprint,
    compilerAtEnd.candidateFingerprint,
    materializedFingerprintAtEnd,
  ));
writeImmutableJsonArtifact(outPath, output, "observed transition packet");
process.stderr.write(
  `observed transition packet ${panel.id}: status=${status} score=${round(score.score)} ` +
  `simFrames=${checkpoint.stats.sim_frames ?? "?"} -> ${outPath}\n`,
);
if (status.startsWith("invalid_")) process.exitCode = 2;

function observeFinalTransition(
  snapshot: HandoffNodeSnapshot,
  groups: SelectedTransitionLineGroups,
  currentGap: Gap,
  outgoing: { startFrame: number; endFrame: number; intervalFrames: number; axes: Record<string, number | undefined> },
) {
  const fullEngine = makeEngine(snapshot, groups.all);
  const fullDetectionEnd = currentGap.endFrame + IMPACT_WINDOW + PERSISTENCE_FRAMES + 3;
  const fullDetection = detectPostimpactWindow(fullEngine, 0, fullDetectionEnd);
  const fullOwned = observeOwnedContactTransition(fullDetection, {
    targetFrame: currentGap.endFrame,
    observationStartFrame: currentGap.startFrame,
    gapFrames: currentGap.endFrame - currentGap.startFrame,
    observationEndFrame: fullDetectionEnd,
    ownedLineIds: new Set(groups.ids.current),
    persistenceOffsetFrames: PERSISTENCE_FRAMES,
    responseOffsetFrames: IMPACT_WINDOW + 1,
    timingToleranceFrames: 1,
  });
  const event = fullOwned.selectedOwnedEvent;
  if (event === null || !event.gateEligible) {
    return {
      availability: "unavailable" as const,
      reason: "no_gate_eligible_owned_current_event",
      captureBoundary: { status: "unavailable" as const, reason: "full_selected_event_not_owned" },
      response: { h: null, hPlusOne: null, stateH: null, stateHPlusOne: null, step: null },
    };
  }

  const h = event.frame + IMPACT_WINDOW + 1;
  const hPlusOne = h + 1;
  const fullTrace = exactPostimpactEngineStateTraceFingerprint(fullEngine, 0, hPlusOne);
  const prefixTrace = exactPostimpactEngineStateTraceFingerprint(makeEngine(snapshot, groups.prior), 0, currentGap.startFrame - 1);
  const fullPrefixTrace = exactPostimpactEngineStateTraceFingerprint(fullEngine, 0, currentGap.startFrame - 1);
  const capture = shortestExactCapturePrefix(snapshot, groups, currentGap, event, hPlusOne, fullTrace);
  const stateH = extractPlanningState(fullEngine, h);
  const stateHPlusOne = extractPlanningState(fullEngine, hPlusOne);
  const step = responseStep(stateH, stateHPlusOne, h, hPlusOne);
  return {
    availability: capture.status === "available" && step !== null ? "available" as const : "unavailable" as const,
    ...(capture.status === "available" && step !== null ? {} : { reason: "finite_capture_or_response_step_unavailable" }),
    locality: {
      prefixMatchesFullBeforeCurrent: samePostimpactExactEngineTrace(prefixTrace, fullPrefixTrace),
      prefixTrace,
      fullPrefixTrace,
    },
    captureBoundary: capture,
    response: { event, h, hPlusOne, stateH, stateHPlusOne, step },
    outgoing: {
      startFrame: outgoing.startFrame,
      endFrame: outgoing.endFrame,
      intervalFrames: outgoing.intervalFrames,
      axes: { ...outgoing.axes },
    },
  };
}

function shortestExactCapturePrefix(
  snapshot: HandoffNodeSnapshot,
  groups: SelectedTransitionLineGroups,
  currentGap: Gap,
  fullEvent: unknown,
  hPlusOne: number,
  fullTrace: ReturnType<typeof exactPostimpactEngineStateTraceFingerprint>,
) {
  for (let count = 1; count <= groups.current.length; count++) {
    const retained = groups.current.slice(0, count);
    const engine = makeEngine(snapshot, [...groups.prior, ...retained]);
    const detection = detectPostimpactWindow(engine, 0, hPlusOne);
    const owned = observeOwnedContactTransition(detection, {
      targetFrame: currentGap.endFrame,
      observationStartFrame: currentGap.startFrame,
      gapFrames: currentGap.endFrame - currentGap.startFrame,
      observationEndFrame: hPlusOne,
      ownedLineIds: new Set(retained.map((line) => line.id)),
      persistenceOffsetFrames: PERSISTENCE_FRAMES,
      responseOffsetFrames: IMPACT_WINDOW + 1,
      timingToleranceFrames: 1,
    });
    const trace = exactPostimpactEngineStateTraceFingerprint(engine, 0, hPlusOne);
    if (samePostimpactOwnedCaptureEvent(owned.selectedOwnedEvent, fullEvent) &&
        samePostimpactExactEngineTrace(trace, fullTrace)) {
      return {
        status: "available" as const,
        retainedLineCount: count,
        retainedLineIds: retained.map((line) => line.id),
        fullCurrentLineCount: groups.current.length,
        fullCurrentLineIds: [...groups.ids.current],
        trace,
      };
    }
  }
  return {
    status: "unavailable" as const,
    reason: "no_current_fit_prefix_preserves_owned_capture_through_H_plus_1",
    fullCurrentLineCount: groups.current.length,
    fullCurrentLineIds: [...groups.ids.current],
  };
}

function makeEngine(snapshot: HandoffNodeSnapshot, lines: readonly TrackLine[]): any {
  let engine = makeBaseEngine(snapshot.node.startState);
  if (lines.length > 0) engine = engine.addLine(lines.map((line) => engineLineFromTrackLine({ ...line })));
  return engine;
}

function responseStep(
  stateH: PlanningState | null,
  stateHPlusOne: PlanningState | null,
  h: number,
  hPlusOne: number,
) {
  if (stateH === null || stateHPlusOne === null) return null;
  try {
    const frame = targetFrameFromPlanningState(stateH);
    const from = namedReferencePosition(stateH, frame.anchorPoint);
    const to = namedReferencePosition(stateHPlusOne, frame.anchorPoint);
    if (from === null || to === null) return null;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    if (!(distance > 1e-12) || !Number.isFinite(distance)) return null;
    return {
      anchorPoint: frame.anchorPoint,
      fromFrame: h,
      toFrame: hPlusOne,
      from,
      to,
      distancePx: distance,
      headingDeg: Math.atan2(dy, dx) * 180 / Math.PI,
    };
  } catch {
    return null;
  }
}

function namedReferencePosition(
  state: PlanningState,
  anchorPoint: ReturnType<typeof targetFrameFromPlanningState>["anchorPoint"],
): { x: number; y: number } | null {
  const position = anchorPoint === "rider" ? state.position : state.points[anchorPoint]?.position;
  return position === undefined ? null : { ...position };
}

function verifyFinalSnapshot(snapshot: HandoffNodeSnapshot, result: CompileCheckpoint, totalFrames: number): string[] {
  const errors: string[] = [];
  if (snapshot.event.improvementCount !== result.stats.improvements) {
    errors.push("final_improvement_count_does_not_match_checkpoint");
  }
  if (snapshot.event.outputDurationFrames !== result.track.duration) {
    errors.push("final_output_duration_does_not_match_checkpoint");
  }
  if (stableJson(snapshot.key) !== stableJson(leafKeyForReport(result.report, totalFrames))) {
    errors.push("final_leaf_key_does_not_match_checkpoint_report");
  }
  return errors;
}

function outputIdentity(result: CompileCheckpoint) {
  return {
    trackFingerprint: sha256(stableJson(result.track)),
    reportFingerprint: sha256(stableJson(result.report)),
    statsFingerprint: sha256(stableJson(result.stats)),
  };
}

function sameOutputIdentity(
  left: ReturnType<typeof outputIdentity>,
  right: ReturnType<typeof outputIdentity>,
): boolean {
  return left.trackFingerprint === right.trackFingerprint && left.reportFingerprint === right.reportFingerprint &&
    left.statsFingerprint === right.statsFingerprint;
}

function snapshotSummary(snapshot: HandoffNodeSnapshot) {
  return {
    event: { ...snapshot.event },
    key: { ...snapshot.key },
    gapIndex: snapshot.node.search.gapIndex,
    skippedContacts: snapshot.node.skippedContacts,
    rankTrace: snapshot.node.rankTrace.map((entry) => ({ ...entry })),
    fitPresence: snapshot.node.search.prefixFits.map((fit) => fit !== null),
  };
}

function relevantEnvironment(): Record<string, string> {
  return Object.fromEntries(Object.entries(process.env)
    .filter(([name, value]) => name.startsWith("LR_") && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right)) as Array<[string, string]>);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
