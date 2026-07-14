/**
 * Calibration-only study of a straight, duration-scaled post-impact carrier.
 *
 * The staged fixture boundary first closes the current capture target-blind,
 * then releases only the outgoing endpoint so every fixed phase/fraction arm
 * can be certified before outgoing axes and authored contact frames open for
 * descriptive measurement. This never changes compiler behavior.
 */
import { PERSISTENCE_FRAMES } from "../lib/detector.ts";
import { classifyPostimpactMeasurementBoundary } from "./trajectory/postimpact_construction_probe.ts";
import {
  allocatePostimpactAssayArtifactPath,
  assertUnusedPostimpactAssayArtifactPath,
  postimpactAssayRuntimeIdentity,
  postimpactAssaySourceIdentity,
  readPostimpactAssayArtifact,
  writeImmutablePostimpactAssayArtifact,
} from "./trajectory/postimpact_assay_artifact.ts";
import {
  POSTIMPACT_CAPTURE_CLOSURE_PROTOCOL,
  observePostimpactCapture,
  postimpactAllBodyCollisions,
  postimpactTrace,
} from "./trajectory/postimpact_capture_closure.ts";
import {
  constructPostimpactLongCarrierCaptureRows,
  POSTIMPACT_LONG_CARRIER_CAPTURE_PROTOCOL,
} from "./trajectory/postimpact_long_carrier_capture.ts";
import { postimpactContactLineIdsAt, postimpactMeasurementLastFrame } from "./trajectory/postimpact_detection_measurement.ts";
import { detectPostimpactWindow } from "./trajectory/postimpact_detector.ts";
import {
  withPostimpactCaptureThenDurationBoundaryFromPath,
} from "./trajectory/postimpact_fixture.ts";
import {
  POSTIMPACT_LONG_CARRIER_SURFACE_PROTOCOL,
} from "./trajectory/postimpact_long_carrier.ts";
import {
  POSTIMPACT_LONG_CARRIER_PROTOCOL,
  postimpactLongCarrierDurationEndpointMatches,
} from "./trajectory/postimpact_long_carrier_protocol.ts";
import {
  POSTIMPACT_LONG_CARRIER_CONSTRUCTION_PROTOCOL,
  constructPostimpactLongCarrierDurationRows,
  validatePostimpactLongCarrierMeasurementRoster,
  type PostimpactLongCarrierConstructionArm,
  type PostimpactLongCarrierConstructionRow,
  type PostimpactLongCarrierPendingCapture,
} from "./trajectory/postimpact_long_carrier_construction.ts";
import {
  measurePostimpactCoMWindow,
  POSTIMPACT_UNRESOLVED_TAIL_RULE,
  postimpactNamedReferenceState,
  samePostimpactExactEngineTrace,
  samePostimpactOwnedCaptureEvent,
  splitPostimpactOffBeatLandingsInWindow,
} from "./trajectory/postimpact_observation.ts";
import { sha256, stableJson } from "./trajectory/postimpact_study_inputs.ts";
import { extractPlanningState } from "./trajectory/state.ts";
import { survivesPostimpactThroughFrame } from "./trajectory/postimpact_trace.ts";

const STUDY_SCHEMA = "line.study-postimpact-long-carrier-duration.v1";
const RUNNER_PATH = "scripts/v0/study_long_carrier_duration_response.ts";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_long_carrier_duration_response.ts --fixture=FILE [--out=FILE]",
    "",
    "Runs the fixed duration-aware, axis-blind long-carrier calibration assay.",
    "Construction is not a compiler candidate or promotion workflow.",
  ].join("\n") + "\n");
  process.exit(0);
}

const { fixturePath, explicitOut } = parseArguments(argv);
if (explicitOut !== undefined) assertUnusedPostimpactAssayArtifactPath(explicitOut);
if ((process.env.LR_ENGINE ?? "wasm") !== "wasm") {
  throw new Error("long-carrier duration study is wasm-only; other engine identities are not certified");
}
const started = performance.now();
const sourceAtStart = postimpactAssaySourceIdentity(RUNNER_PATH);
const runtimeAtStart = postimpactAssayRuntimeIdentity();

const boundary = withPostimpactCaptureThenDurationBoundaryFromPath(
  fixturePath,
  constructPostimpactLongCarrierCaptureRows,
  constructPostimpactLongCarrierDurationRows,
);
const protocol = Object.freeze({
  stagedBoundary: {
    capture: "target_blind_physical_prefix_and_current_impact_only.v1",
    duration: "axis_blind_arrival_blind_scalar_outgoing_end_frame_only.v1",
    observation: "outgoing_axes_and_authored_contact_frames_after_phase_selection.v1",
    engine: "wasm_only_certified_runtime_identity.v1",
  },
  captureClosure: POSTIMPACT_CAPTURE_CLOSURE_PROTOCOL,
  captureProjection: POSTIMPACT_LONG_CARRIER_CAPTURE_PROTOCOL,
  carrierConstruction: POSTIMPACT_LONG_CARRIER_CONSTRUCTION_PROTOCOL,
  carrierDuration: POSTIMPACT_LONG_CARRIER_PROTOCOL,
  carrierSurface: POSTIMPACT_LONG_CARRIER_SURFACE_PROTOCOL,
  activeReplayConvention: boundary.audit.impactConvention,
  eventSemantics: {
    H: "selected_owned_current_event_plus_impact_window_plus_one.v1",
    namedReference: "capture_only_same_named_reference_H_to_H_plus_one.v1",
    speedSource: "observed_named_reference_speed_at_H.v1",
    offBeatToleranceFrames: 1,
    unresolvedTailRule: POSTIMPACT_UNRESOLVED_TAIL_RULE,
    persistenceFrames: PERSISTENCE_FRAMES,
  },
  measurement: {
    window: "inclusive_H_through_scheduled_outgoing_end_frame.v1",
    primary: "five_arm_complete_air_fraction_nonincreasing_one_sample_tolerance.v1",
    arrivalTimeSnapshot: "state_at_scheduled_endpoint_only_no_future_terrain_or_contact_claim.v1",
  },
});
const protocolFingerprint = sha256(stableJson(protocol));
const measuredRows = boundary.durationResult.rows.map((row) => measureRow(row, boundary.observation));
const sourceAtEnd = postimpactAssaySourceIdentity(RUNNER_PATH);
const runtimeAtEnd = postimpactAssayRuntimeIdentity();
const identityStable = sourceAtStart.fingerprint === sourceAtEnd.fingerprint &&
  runtimeAtStart.fingerprint === runtimeAtEnd.fingerprint;
const summary = summarize(measuredRows);
const status = classifyStatus(identityStable, summary);
const artifactIdentityPayload = {
  fixtureFingerprint: boundary.audit.fixtureFingerprint,
  protocolFingerprint,
  sourceFingerprint: sourceAtStart.fingerprint,
  runtimeFingerprint: runtimeAtStart.fingerprint,
};
const output = {
  schema: STUDY_SCHEMA,
  artifactIdentity: {
    ...artifactIdentityPayload,
    fingerprint: sha256(stableJson(artifactIdentityPayload)),
  },
  purpose: [
    "Falsify or characterize a fixed duration-aware planner and straight target-blind carrier realizer.",
    "This is descriptive calibration evidence on one frozen fixture, not compiler selection or a rollout controller.",
  ],
  status,
  protocol: { ...protocol, protocolFingerprint },
  argv: [...argv],
  elapsedMs: round(performance.now() - started),
  provenance: {
    fixturePath,
    audit: boundary.audit,
    runtime: { node: process.version, engine: process.env.LR_ENGINE ?? "wasm" },
    sourceAtStart,
    sourceAtEnd,
    runtimeAtStart,
    runtimeAtEnd,
  },
  rows: measuredRows.map((row) => row.report),
  summary,
  caveats: [
    "The scalar endpoint makes stage-two construction duration-aware. It receives no outgoing axes, next impact, contact identity, score, seed, category, or fixture provenance.",
    "V3 replay includes only the physical prefix before the current gap. An arrivalTimeSnapshot at E is not a next-contact, impact, target-fit, or continuation-feasibility observation.",
    "All five fractions are retained in a primary row. Survival, carrier collision, and off-beat outcomes are reported rather than filtered away; incomplete rows are unavailable rather than imputed.",
    "Rows within one frozen fixture share a capture screen and prefix. Their count is not independent statistical evidence and cannot authorize compiler integration.",
    "The artifact content checksum detects accidental or stale edits on the trusted no-clobber artifact filesystem; it is not a signature against an actor who can replace both payload and checksum.",
  ],
};
const canonicalPath =
  `generated/studies/long-carrier-duration/v1/${boundary.audit.fixtureFingerprint.slice(0, 12)}-${protocolFingerprint.slice(0, 12)}.json`;
const outPath = explicitOut ?? allocatePostimpactAssayArtifactPath(canonicalPath);
writeImmutablePostimpactAssayArtifact(outPath, output);
readPostimpactAssayArtifact(outPath);
process.stderr.write(
  `long carrier: ${summary.selectedPhaseRows}/${summary.captureRows} selected phases; ` +
  `${summary.completeFiveArmRows} complete five-arm rows; ${summary.monotoneRows}/${summary.completeFiveArmRows} monotone; ` +
  `${round(performance.now() - started)}ms -> ${outPath}\n`,
);
if (!status.executionComplete) process.exitCode = 2;

type MeasurementObservation = {
  outgoing: { endFrame: number };
  authoredContactFrames: readonly number[];
};

type MeasuredRow = {
  report: Record<string, unknown>;
  captureProtocolInvalid: boolean;
  selectedPhase: boolean;
  constructionInvalidPhases: number;
  constructionProtocolInvalid: boolean;
  constructionReportMismatches: number;
  measurementRosterViolations: number;
  durationEndpointMismatches: number;
  measurementProtectedBoundaryViolations: number;
  armErrors: number;
  completeFiveArm: boolean;
  monotone: boolean | null;
};

type MeasuredArm = {
  supportFraction: number;
  status: "observed" | "error";
  reason: string | null;
  constructionSafe: boolean;
  protectedBoundaryValid: boolean;
  structurallyComplete: boolean;
  /** Engine collision witnesses can include multiple body points per frame. */
  preOrAtHCarrierCollisionWitnessCount: number;
  preOrAtHCarrierCollisionFrameCount: number;
  carrierCollisionWitnessCount: number;
  carrierCollisionFrameCount: number;
  carrierContactSamples: number | null;
  carrierContactFraction: number | null;
  /** Detector-confirmed off-beat landings in the observed window. */
  observedOffBeatFrames: number[];
  unresolvedTailOffBeatFrames: number[];
  window: ReturnType<typeof measurePostimpactCoMWindow>;
  arrivalTimeSnapshot: Record<string, unknown> | null;
};

function measureRow(
  row: PostimpactLongCarrierConstructionRow,
  observation: MeasurementObservation,
): MeasuredRow {
  const constructionInvalidPhases = row.constructionInvalidPhaseCount;
  const constructionReportMismatches = row.constructionReportMatchesTypedState ? 0 : 1;
  if (row.pending === null) {
    return {
      report: {
        ...row.report,
        measurement: { status: "construction_unavailable", primary: null, arms: [] },
      },
      captureProtocolInvalid: row.captureProtocolInvalid,
      selectedPhase: false,
      constructionInvalidPhases,
      constructionProtocolInvalid: row.constructionProtocolInvalid,
      constructionReportMismatches,
      measurementRosterViolations: 0,
      durationEndpointMismatches: 0,
      measurementProtectedBoundaryViolations: 0,
      armErrors: 0,
      completeFiveArm: false,
      monotone: null,
    };
  }
  const pending = row.pending;
  const rosterValidation = validatePostimpactLongCarrierMeasurementRoster(pending);
  if (!rosterValidation.valid) {
    return {
      report: {
        ...row.report,
        measurement: {
          status: "invalid_selected_phase_roster",
          reason: rosterValidation.reason,
          primary: null,
          arms: [],
        },
      },
      captureProtocolInvalid: false,
      selectedPhase: false,
      constructionInvalidPhases,
      constructionProtocolInvalid: row.constructionProtocolInvalid,
      constructionReportMismatches,
      measurementRosterViolations: 1,
      durationEndpointMismatches: 0,
      measurementProtectedBoundaryViolations: 0,
      armErrors: 0,
      completeFiveArm: false,
      monotone: null,
    };
  }
  const endpointMatchesConstruction = postimpactLongCarrierDurationEndpointMatches(
    pending.outgoingEndFrame,
    observation.outgoing.endFrame,
  );
  if (!endpointMatchesConstruction) {
    return {
      report: {
        ...row.report,
        measurement: {
          status: "duration_endpoint_mismatch",
          constructionOutgoingEndFrame: pending.outgoingEndFrame,
          measurementOutgoingEndFrame: observation.outgoing.endFrame,
          primary: null,
          arms: [],
        },
      },
      captureProtocolInvalid: false,
      selectedPhase: true,
      constructionInvalidPhases,
      constructionProtocolInvalid: row.constructionProtocolInvalid,
      constructionReportMismatches,
      measurementRosterViolations: 0,
      durationEndpointMismatches: 1,
      measurementProtectedBoundaryViolations: 0,
      armErrors: 0,
      completeFiveArm: false,
      monotone: null,
    };
  }
  const arms = pending.selectedPhase.arms.map((arm) => measureArm(pending, arm, observation));
  const completeFiveArm = arms.length === 5 && arms.every((arm) => arm.structurallyComplete);
  const primary = completeFiveArm ? summarizePrimary(arms, pending.capture.supportStartFrame, observation.outgoing.endFrame) : null;
  return {
    report: {
      ...row.report,
      measurement: {
        status: completeFiveArm ? "complete" : "incomplete_five_arm_measurement",
        measurementStartFrame: pending.capture.supportStartFrame,
        measurementEndFrame: observation.outgoing.endFrame,
        primary,
        arms: arms.map(summarizeMeasuredArm),
      },
    },
    captureProtocolInvalid: false,
    selectedPhase: true,
    constructionInvalidPhases,
    constructionProtocolInvalid: row.constructionProtocolInvalid,
    constructionReportMismatches,
    measurementRosterViolations: 0,
    durationEndpointMismatches: 0,
    measurementProtectedBoundaryViolations: arms.filter((arm) => !arm.protectedBoundaryValid).length,
    armErrors: arms.filter((arm) => arm.status === "error").length,
    completeFiveArm,
    monotone: primary?.monotone ?? null,
  };
}

function measureArm(
  pending: PostimpactLongCarrierPendingCapture,
  constructionArm: PostimpactLongCarrierConstructionArm,
  observationInput: MeasurementObservation,
): MeasuredArm {
  const { capture } = pending;
  try {
    const carrier = constructionArm.carrier;
    if (carrier === null) throw new Error("selected long-carrier phase is missing declared carrier geometry");
    const carrierIds = new Set(carrier.lines.map((line) => line.id));
    const captureIds = new Set(capture.captureLineIds);
    const carrierLineIdsUnique = carrierIds.size === carrier.lines.length;
    const carrierLineIdsDisjointFromCapture = [...carrierIds].every((id) => !captureIds.has(id));
    const engine = capture.addTrackLines(capture.captureEngine, carrier.lines);
    const endFrame = observationInput.outgoing.endFrame;
    const detection = detectPostimpactWindow(engine, 0, endFrame);
    const captureObservation = observePostimpactCapture(
      detection,
      capture.current,
      capture.captureObservationSurface,
      endFrame,
      capture.impactWindowFrames,
    );
    const preOrAtHCarrierCollisions = postimpactAllBodyCollisions(
      engine,
      0,
      capture.supportStartFrame,
      carrierIds,
    );
    const carrierCollisions = postimpactAllBodyCollisions(
      engine,
      capture.supportStartFrame,
      endFrame,
      carrierIds,
    );
    const complete = survivesPostimpactThroughFrame(detection, endFrame) &&
      postimpactMeasurementLastFrame(detection) >= endFrame;
    const window = complete
      ? measurePostimpactCoMWindow(detection, capture.supportStartFrame, endFrame, capture.speedRuler)
      : null;
    const terminalState = window === null ? null : extractPlanningState(engine, endFrame);
    const terminalReference = terminalState === null
      ? null
      : postimpactNamedReferenceState(terminalState, capture.responseAnchorPoint);
    const offBeatSplit = splitPostimpactOffBeatLandingsInWindow(
      detection,
      observationInput.authoredContactFrames,
      capture.supportStartFrame,
      endFrame,
    );
    const observedOffBeatFrames = offBeatSplit.confirmedFrames;
    const unresolvedTailOffBeatFrames = offBeatSplit.unresolvedTailFrames;
    const carrierContactSamples = window === null ? null : countCarrierContactSamples(
      detection,
      carrierIds,
      capture.supportStartFrame,
      endFrame,
    );
    const boundaryVerdict = classifyPostimpactMeasurementBoundary({
      selectedConstructionArmSafe: constructionArm.status === "observed" && constructionArm.constructionSafe &&
        !constructionArm.protocolInvalid,
      carrierLineIdsUnique,
      carrierLineIdsDisjointFromCapture,
      preOrAtHCarrierCollisionCount: preOrAtHCarrierCollisions.length,
      physicalPrefixMatchesBaseline: samePostimpactExactEngineTrace(
        postimpactTrace(engine, 0, capture.current.startFrame - 1),
        capture.baselinePhysicalPrefixTrace,
      ),
      captureFullTraceMatchesComparator: samePostimpactExactEngineTrace(
        postimpactTrace(engine, 0, capture.supportStartFrame),
        capture.captureFullTraceThroughH,
      ),
      captureTraceMatchesComparator: samePostimpactExactEngineTrace(
        postimpactTrace(engine, capture.current.endFrame, capture.supportStartFrame),
        capture.captureTraceThroughH,
      ),
      selectedCaptureEventMatchesComparator: samePostimpactOwnedCaptureEvent(
        captureObservation.selectedOwnedEvent,
        capture.captureOnlyObservation.selectedOwnedEvent,
      ),
      impactMatchesComparator: capture.protectedCaptureImpactMatches(detection, captureObservation),
    });
    const structurallyComplete = boundaryVerdict.protectedBoundaryValid && complete && window !== null && terminalReference !== null;
    return {
      supportFraction: constructionArm.supportFraction,
      status: "observed",
      reason: boundaryVerdict.reason ?? (structurallyComplete ? null : "measurement_outcome_incomplete"),
      constructionSafe: constructionArm.constructionSafe,
      protectedBoundaryValid: boundaryVerdict.protectedBoundaryValid,
      structurallyComplete,
      preOrAtHCarrierCollisionWitnessCount: preOrAtHCarrierCollisions.length,
      preOrAtHCarrierCollisionFrameCount: uniqueCollisionFrameCount(preOrAtHCarrierCollisions),
      carrierCollisionWitnessCount: carrierCollisions.length,
      carrierCollisionFrameCount: uniqueCollisionFrameCount(carrierCollisions),
      carrierContactSamples,
      carrierContactFraction: carrierContactSamples === null || window === null
        ? null
        : carrierContactSamples / window.measurementSamples,
      observedOffBeatFrames,
      unresolvedTailOffBeatFrames,
      window,
      arrivalTimeSnapshot: window === null || terminalReference === null
        ? null
        : {
          frame: endFrame,
          terminalCoM: window.terminal,
          terminalNamedReference: terminalReference,
          nextContactObservation: "unavailable_no_future_terrain_in_v3_prefix",
        },
    };
  } catch (error) {
    return {
      supportFraction: constructionArm.supportFraction,
      status: "error",
      reason: errorMessage(error),
      constructionSafe: constructionArm.constructionSafe,
      protectedBoundaryValid: false,
      structurallyComplete: false,
      preOrAtHCarrierCollisionWitnessCount: 0,
      preOrAtHCarrierCollisionFrameCount: 0,
      carrierCollisionWitnessCount: 0,
      carrierCollisionFrameCount: 0,
      carrierContactSamples: null,
      carrierContactFraction: null,
      observedOffBeatFrames: [],
      unresolvedTailOffBeatFrames: [],
      window: null,
      arrivalTimeSnapshot: null,
    };
  }
}

function uniqueCollisionFrameCount(collisions: readonly { frame: number }[]): number {
  return new Set(collisions.map((collision) => collision.frame)).size;
}

function countCarrierContactSamples(
  detection: ReturnType<typeof detectPostimpactWindow>,
  carrierIds: ReadonlySet<number>,
  startFrame: number,
  endFrame: number,
): number {
  let samples = 0;
  for (let frame = startFrame; frame <= endFrame; frame++) {
    if (postimpactContactLineIdsAt(detection, frame).some((id) => carrierIds.has(id))) samples++;
  }
  return samples;
}

function summarizePrimary(arms: readonly MeasuredArm[], startFrame: number, endFrame: number) {
  const ordered = [...arms].sort((left, right) => left.supportFraction - right.supportFraction);
  const samples = endFrame - startFrame + 1;
  const tolerance = 1 / samples;
  const pairs = ordered.slice(1).map((arm, index) => ({
    lowerFraction: ordered[index]!.supportFraction,
    higherFraction: arm.supportFraction,
    lowerAirFraction: ordered[index]!.window!.airFraction,
    higherAirFraction: arm.window!.airFraction,
    nonIncreasing: arm.window!.airFraction <= ordered[index]!.window!.airFraction + tolerance,
  }));
  return {
    metric: "air_fraction_inclusive_H_through_E",
    measurementSamples: samples,
    tolerance,
    arms: ordered.map((arm) => ({
      supportFraction: arm.supportFraction,
      airFraction: arm.window!.airFraction,
      airborneSamples: arm.window!.airborneSamples,
    })),
    adjacentPairs: pairs,
    monotone: pairs.every((pair) => pair.nonIncreasing),
  };
}

function summarizeMeasuredArm(arm: MeasuredArm) {
  return {
    supportFraction: arm.supportFraction,
    status: arm.status,
    reason: arm.reason,
    constructionSafe: arm.constructionSafe,
    protectedBoundaryValid: arm.protectedBoundaryValid,
    structurallyComplete: arm.structurallyComplete,
    preOrAtHCarrierCollisionWitnessCount: arm.preOrAtHCarrierCollisionWitnessCount,
    preOrAtHCarrierCollisionFrameCount: arm.preOrAtHCarrierCollisionFrameCount,
    carrierCollisionWitnessCount: arm.carrierCollisionWitnessCount,
    carrierCollisionFrameCount: arm.carrierCollisionFrameCount,
    carrierContactSamples: arm.carrierContactSamples,
    carrierContactFraction: arm.carrierContactFraction,
    observedOffBeatFrames: arm.observedOffBeatFrames,
    unresolvedTailOffBeatFrames: arm.unresolvedTailOffBeatFrames,
    window: arm.window,
    arrivalTimeSnapshot: arm.arrivalTimeSnapshot,
  };
}

function summarize(rows: readonly MeasuredRow[]) {
  const captureRows = rows.length;
  const captureProtocolInvalidRows = rows.filter((row) => row.captureProtocolInvalid).length;
  const selectedPhaseRows = rows.filter((row) => row.selectedPhase).length;
  const completeFiveArmRows = rows.filter((row) => row.completeFiveArm).length;
  const monotoneRows = rows.filter((row) => row.monotone === true).length;
  return {
    level: "single_fixture",
    captureRows,
    captureProtocolInvalidRows,
    selectedPhaseRows,
    completeFiveArmRows,
    monotoneRows,
    nonMonotoneRows: rows.filter((row) => row.monotone === false).length,
    unavailableRows: rows.filter((row) => !row.completeFiveArm).length,
    constructionInvalidPhases: rows.reduce((sum, row) => sum + row.constructionInvalidPhases, 0),
    constructionProtocolInvalidRows: rows.filter((row) => row.constructionProtocolInvalid).length,
    constructionReportMismatches: rows.reduce((sum, row) => sum + row.constructionReportMismatches, 0),
    measurementRosterViolations: rows.reduce((sum, row) => sum + row.measurementRosterViolations, 0),
    durationEndpointMismatches: rows.reduce((sum, row) => sum + row.durationEndpointMismatches, 0),
    measurementProtectedBoundaryViolations: rows.reduce(
      (sum, row) => sum + row.measurementProtectedBoundaryViolations,
      0,
    ),
    armErrors: rows.reduce((sum, row) => sum + row.armErrors, 0),
    interpretation: "Five-arm rows are correlated alternatives on one frozen fixture. Monotonicity is descriptive duration-response evidence only, never a compiler-performance or promotion verdict.",
  };
}

function classifyStatus(identityStable: boolean, summary: ReturnType<typeof summarize>) {
  if (!identityStable) {
    return {
      protocolStatus: "invalid_identity_drift",
      executionComplete: false,
      descriptiveDurationResponseEligible: false,
      claimEligibility: "invalid: runner source or ambient replay identity changed during execution",
    };
  }
  if (summary.captureProtocolInvalidRows > 0) {
    return {
      protocolStatus: "invalid_capture_stage",
      executionComplete: false,
      descriptiveDurationResponseEligible: false,
      claimEligibility: "invalid: one or more capture rows threw or changed protected capture identity",
    };
  }
  if (summary.armErrors > 0) {
    return {
      protocolStatus: "invalid_runtime_error",
      executionComplete: false,
      descriptiveDurationResponseEligible: false,
      claimEligibility: "invalid: one or more post-selection arm replays raised a runtime error",
    };
  }
  if (summary.constructionInvalidPhases > 0 || summary.constructionProtocolInvalidRows > 0 ||
      summary.constructionReportMismatches > 0) {
    return {
      protocolStatus: "invalid_construction_phase_probe",
      executionComplete: false,
      descriptiveDurationResponseEligible: false,
      claimEligibility: "invalid: a duration-phase probe drifted before H or its report disagreed with typed construction state",
    };
  }
  if (summary.measurementRosterViolations > 0) {
    return {
      protocolStatus: "invalid_selected_measurement_roster",
      executionComplete: false,
      descriptiveDurationResponseEligible: false,
      claimEligibility: "invalid: a selected phase no longer matched its sealed certificate and declared five-arm roster",
    };
  }
  if (summary.durationEndpointMismatches > 0) {
    return {
      protocolStatus: "invalid_duration_endpoint_mismatch",
      executionComplete: false,
      descriptiveDurationResponseEligible: false,
      claimEligibility: "invalid: phase construction and post-selection measurement used different outgoing endpoints",
    };
  }
  if (summary.measurementProtectedBoundaryViolations > 0) {
    return {
      protocolStatus: "invalid_measurement_protected_boundary",
      executionComplete: false,
      descriptiveDurationResponseEligible: false,
      claimEligibility: "invalid: one or more post-selection replays changed the protected prefix or capture identity",
    };
  }
  if (summary.completeFiveArmRows === 0) {
    return {
      protocolStatus: "complete_without_eligible_evidence",
      executionComplete: true,
      descriptiveDurationResponseEligible: false,
      claimEligibility: "unavailable: no row completed every declared fraction through the scheduled endpoint",
    };
  }
  return {
    protocolStatus: "complete_with_descriptive_rows",
    executionComplete: true,
    descriptiveDurationResponseEligible: true,
    claimEligibility: "eligible only for descriptive fixed-carrier duration response on this frozen fixture; not compiler, target-fit, or next-contact evidence",
  };
}

function parseArguments(values: readonly string[]): { fixturePath: string; explicitOut: string | undefined } {
  const fixture = values.filter((value) => value.startsWith("--fixture=")).map((value) => value.slice("--fixture=".length));
  const out = values.filter((value) => value.startsWith("--out=")).map((value) => value.slice("--out=".length));
  const unsupported = values.filter((value) => !value.startsWith("--fixture=") && !value.startsWith("--out="));
  if (unsupported.length > 0) throw new Error(`unsupported long-carrier control(s): ${unsupported.join(", ")}`);
  if (fixture.length !== 1 || fixture[0] === "") throw new Error("--fixture=FILE is required exactly once and must be non-empty");
  if (out.length > 1 || out.some((value) => value === "")) throw new Error("--out=FILE may be supplied once and must be non-empty");
  return { fixturePath: fixture[0]!, explicitOut: out[0] };
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
