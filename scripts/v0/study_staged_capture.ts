/**
 * Staged Transition Solver Assay (calibration-only, WASM).
 *
 * Implements docs/staged-transition-solver-assay.md. Question: given an
 * immutable physical prefix and the current contact's authored impact, can a
 * side-aware static capture close the current event, expose a sealed physical
 * handoff at the response horizon H, and hand a continuous duration-aware
 * support/release curve — fed only that handoff, exact outgoing sample
 * accounting, and authored air — that changes outgoing occupancy without
 * changing the protected prefix or reattributing the capture?
 *
 * Study-only, outside the compiler identity boundary. No compiler source
 * imports this file or scripts/v0/trajectory/staged_capture.ts. Exact replay
 * is the sole authority: every guard is an engine-trace/collision/detector
 * comparison, every result retains geometry, roles, witnesses, and sim cost.
 */
import { PERSISTENCE_FRAMES } from "../lib/detector.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { detectWindow } from "./core/candidate.ts";
import {
  airborneAt,
  contactLineIdsAt,
  engineLineFromTrackLine,
  measurementLastFrame,
} from "./core/substrate.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { IMPACT_WINDOW, type TrackLine } from "./types.ts";
import { contactKinematicFrameFromPlanningState } from "./trajectory/contact_kinematic_frame.ts";
import {
  observeOwnedContactTransition,
  type OwnedContactObservation,
} from "./trajectory/contact_observation.ts";
import {
  measureCoMWindow,
  offBeatLandingsInWindow,
  sameExactEngineTrace,
  sameOwnedCaptureEvent,
  sameScoredContactImpact,
  unresolvedOffBeatLandingFramesAtWindowEnd,
} from "./trajectory/exact_support_slice_assay.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import { scoredContactImpact } from "./trajectory/scored_contact_impact.ts";
import {
  makeStagedCaptureStencil,
  positiveRailWallTangentDeg,
  realizePositiveRail,
  realizeStagedCapture,
  resolvePositiveRailSide,
  supportGroundedBudgetFrames,
  realizeStagedSupport,
  POSITIVE_RAIL_PROTOCOL,
  STAGED_CAPTURE_BAND_FRAMES,
  STAGED_CAPTURE_ROLES,
  STAGED_RESPONSE_HORIZON_OFFSET_FRAMES,
  STAGED_SUPPORT_CONTROLS,
  STAGED_SUPPORT_PROTOCOL,
  type SealedCaptureHandoff,
  type StagedCaptureControl,
} from "./trajectory/staged_capture.ts";
import { extractPlanningState } from "./trajectory/state.ts";
import {
  prepareStateCoupledTrajectoryFixture,
  type PreparedTrajectoryFixtureCore,
} from "./trajectory/study_context.ts";
import {
  allocateStudyArtifactPath,
  studyArtifactIdentity,
  studySourceIdentity,
  writeStudyArtifact,
} from "./trajectory/study_artifact.ts";
import {
  emptyEngineStateTraceFingerprint,
  engineCollisionHitsForLineIds,
  exactEngineStateTraceFingerprint,
  survivesThroughFrame,
  type ExactTraceFingerprint,
} from "./trajectory/study_trace.ts";
import { targetFrameFromPlanningState } from "./trajectory/target_frame.ts";
import { transitionContractForGap } from "./trajectory/transition_contract.ts";

const SCHEMA = "line.study-staged-capture.v1";
const FIXTURE_DIR = "generated/studies/trajectory-fixtures/current-2026-07-15/v3";
const FIXTURES = {
  dense: "dense-b500000-0552802c01e1.json",
  dense240: "dense240-b500000-e8f074b651d9.json",
  ordinary: "ordinary-b500000-e71c85b5c2c2.json",
  frontier3: "frontier3-b500000-90ddd122630f.json",
  frontier4: "frontier4-b500000-27012bb38253.json",
  frontier5: "frontier5-b500000-c39d45c390ff.json",
  frontier6: "frontier6-b500000-1a6e45e009e3.json",
  frontier7: "frontier7-b500000-95fa353bf4b0.json",
} as const;
type StateId = keyof typeof FIXTURES;
const STATE_IDS = Object.keys(FIXTURES) as StateId[];

/** Capture-stage detector horizon: derived only from current-gap data (the
 *  ±1 event window, its full persistence tail, and the impact window). The
 *  outgoing interval is intentionally NOT read at this stage. */
const CAPTURE_VALIDATION_TAIL_FRAMES = 1 + PERSISTENCE_FRAMES + IMPACT_WINDOW;

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_staged_capture.ts [--case=all|dense,dense240,...] [--out-dir=DIR]",
    "",
    "Staged transition solver assay (docs/staged-transition-solver-assay.md).",
    "Calibration-only; requires LR_ENGINE=wasm and the frozen v3 fixtures.",
    `States: ${STATE_IDS.join(", ")}`,
  ].join("\n") + "\n");
  process.exit(0);
}
if (process.env.LR_ENGINE !== "wasm") {
  throw new Error(`study requires LR_ENGINE=wasm; received LR_ENGINE=${process.env.LR_ENGINE ?? "(unset)"}`);
}
const requestedCases = (argument("case") ?? "all").split(",").filter(Boolean);
const selected: StateId[] = requestedCases.includes("all")
  ? [...STATE_IDS]
  : requestedCases.map((id) => {
    if (!STATE_IDS.includes(id as StateId)) throw new Error(`unknown --case=${id}; expected all|${STATE_IDS.join("|")}`);
    return id as StateId;
  });
const outDir = argument("out-dir") ?? "generated/studies/staged-capture/v1";

const sourceIdentity = studySourceIdentity("scripts/v0/study_staged_capture.ts");
const observationCompiler = compilerCandidateIdentity("wasm");
const protocolFingerprint = sha256(stableJson({
  protocol: "staged-transition-solver-assay.v1",
  captureStencil: "existing 24 compact geometric controls x both one-way collision sides = 48; fixed ordering (design-screen order major, side minor sideA=flipped:false first); first structurally closed control selected; capture completed before outgoing data is released",
  captureValidationTailFrames: CAPTURE_VALIDATION_TAIL_FRAMES,
  captureBandFrames: STAGED_CAPTURE_BAND_FRAMES,
  responseHorizon: `H = selected_owned_event.frame + ${STAGED_RESPONSE_HORIZON_OFFSET_FRAMES} (IMPACT_WINDOW + 1)`,
  captureGuards: [
    "full_engine_trace_identity_[0,current.endFrame-2]_vs_bare_prefix",
    "zero_proposed_line_collision_[0,current.endFrame-2]",
    "owned_event_within_current.endFrame_plus_minus_1_on_a_capture_role",
    "survival_and_complete_persistence_and_impact_windows_through_H",
    "no_local_offbeat_landing_[current.startFrame,event+IMPACT_WINDOW]",
  ],
  sealedHandoff: "{point, tangentDeg, flipped} from exact replay at H (named target-frame reference); flipped = selected capture side",
  supportInputs: "sealed handoff + outgoing startFrame/endFrame/measurement samples + authored air only; no next impact, no case/seed identity, no target-dependent release point",
  supportAccounting: "groundedBudgetFrames = max(0, (1-air)*outgoingSamples - groundedSamplesBefore_H); extentPx = budget * handoff.speed * scale",
  supportControls: STAGED_SUPPORT_CONTROLS,
  supportProtocol: STAGED_SUPPORT_PROTOCOL,
  supportGuards: [
    "full_engine_trace_identity_[0,current.endFrame-2]_vs_bare_prefix",
    "capture_only_trace_identity_[outgoing.startFrame,H]",
    "zero_support_collision_[0,H]_inclusive (permitted support start is strictly after H)",
    "same_selected_capture_event_and_scored_impact_as_capture_only",
  ],
  release: "finite end of the support curve; no endpoint rail aimed at the next landing",
  positiveRail: { ...POSITIVE_RAIL_PROTOCOL, rule: "identical static perpendicular wall geometry on both one-way sides across the anchor's predicted path; must admit exactly the motion-facing side (active-normal-along-motion convention)" },
  measurement: "arms {ordinary-baseline, capture-only, combined per support control} measured over the exact outgoing window to outgoing.endFrame + 1; next contact is an outcome, never a construction target",
}));

const started = performance.now();
const results = selected.map((id) => runState(id));
printRunSummary(results);

// ─────────────────────────────────────────────────────────────────────────────

type CaptureRowStatus =
  | "closed"
  | "no_owned_event"
  | "survival"
  | "persistence_unavailable"
  | "response_unavailable"
  | "offbeat"
  | "offbeat_unresolved"
  | "prefix_trace_changed"
  | "prefix_intrusion"
  | "geometry_error"
  | "not_evaluated";

type SelectedCaptureContext = {
  control: StagedCaptureControl;
  // deno-lint-ignore no-explicit-any
  captureEngine: any;
  lines: TrackLine[];
  roles: Map<number, string>;
  lineIds: Set<number>;
  selectedEvent: NonNullable<OwnedContactObservation["selectedOwnedEvent"]>;
  impact: ReturnType<typeof scoredContactImpact>;
  hFrame: number;
};

function runState(id: StateId) {
  const stateStarted = performance.now();
  const stateSimBefore = getSimFrames();
  const fixturePath = `${FIXTURE_DIR}/${FIXTURES[id]}`;
  const fixture = readFrozenTrajectoryFixture(fixturePath);
  const prepared = prepareStateCoupledTrajectoryFixture(fixture);
  if (prepared.panel.cohort !== "calibration") {
    throw new Error(`staged capture accepts only calibration fixtures; ${prepared.panel.id} is ${prepared.panel.cohort}`);
  }
  const contract = transitionContractForGap(prepared.current, prepared.outgoing, prepared.setup.gapAxisTargets);
  if (contract.outgoing === null) throw new Error(`${id}: fixture has no outgoing interval`);
  const eventImpact = contract.event.impact;
  const authoredAir = contract.outgoing.axes.air;
  const authoredSpeed = contract.outgoing.axes.speed;
  const protectedEndFrame = prepared.current.endFrame - 2;
  const measureEndFrame = prepared.outgoing.endFrame + 1;
  const baselineProtectedTrace = prefixTrace(prepared.engine, protectedEndFrame);

  const positiveControl = evaluatePositiveRailControl(prepared, protectedEndFrame, baselineProtectedTrace);
  const baselineArm = measureOutcomeArm({
    engine: prepared.engine,
    prepared,
    contract,
    measureEndFrame,
    captureIds: new Set<number>(),
    supportIds: new Set<number>(),
    label: "ordinary-baseline",
  });

  // ── capture stage: fixed-order first-structurally-closed selection ────────
  let captureRows: object[] = [];
  let selectedContext: SelectedCaptureContext | null = null;
  let captureScope: "evaluated" | "zero_impact_out_of_scope" = "evaluated";
  if (eventImpact === null || eventImpact <= 0) {
    // The doc's zero-impact control remains unavailable rather than being
    // silently converted into a synthetic target (falsifier 6 is structural).
    captureScope = "zero_impact_out_of_scope";
  } else {
    const kinematic = contactKinematicFrameFromPlanningState(prepared.state, prepared.frame, { impact: eventImpact });
    const stencil = makeStagedCaptureStencil(kinematic);
    for (const control of stencil) {
      if (selectedContext !== null) {
        captureRows.push({ index: control.index, label: control.label, flipped: control.flipped, status: "not_evaluated" as CaptureRowStatus });
        continue;
      }
      const evaluated = evaluateCaptureControl(prepared, kinematic, control, protectedEndFrame, baselineProtectedTrace);
      captureRows.push(evaluated.row);
      if (evaluated.context !== null) selectedContext = evaluated.context;
    }
  }

  // ── selected capture: exact replay through H, sealed handoff ──────────────
  let handoff: (SealedCaptureHandoff & { anchorPoint: string; headingSource: string }) | null = null;
  let handoffUnavailableReason: string | null = null;
  let captureOnlyArm: ReturnType<typeof measureOutcomeArm> | null = null;
  let captureOnlyIdentity: {
    hTrace: ExactTraceFingerprint;
    observationAtMeasureEnd: OwnedContactObservation;
    impactAtMeasureEnd: ReturnType<typeof scoredContactImpact>;
    groundedSamplesBeforeSupport: number | null;
  } | null = null;
  let accounting: object | null = null;
  let supportArms: object[] = [];
  if (selectedContext !== null) {
    const hFrame = selectedContext.hFrame;
    const responseState = extractPlanningState(selectedContext.captureEngine, hFrame);
    if (responseState === null) {
      handoffUnavailableReason = "planning_state_unavailable_at_H";
    } else {
      const anchor = targetFrameFromPlanningState(responseState);
      handoff = {
        point: { ...anchor.reference },
        tangentDeg: anchor.headingDeg,
        flipped: selectedContext.control.flipped,
        speedPxPerFrame: anchor.speedPxPerFrame,
        anchorPoint: anchor.anchorPoint,
        headingSource: anchor.headingSource,
      };
    }
    captureOnlyArm = measureOutcomeArm({
      engine: selectedContext.captureEngine,
      prepared,
      contract,
      measureEndFrame,
      captureIds: selectedContext.lineIds,
      supportIds: new Set<number>(),
      label: "capture-only",
    });
    const captureOnlyDet = captureOnlyArm.detection;
    const groundedBefore = countGroundedSamples(captureOnlyDet, prepared.outgoing.startFrame, hFrame - 1);
    captureOnlyIdentity = {
      hTrace: exactEngineStateTraceFingerprint(selectedContext.captureEngine, prepared.outgoing.startFrame, hFrame),
      observationAtMeasureEnd: observeCapture(captureOnlyDet, prepared, selectedContext, measureEndFrame),
      impactAtMeasureEnd: captureImpactOf(captureOnlyDet, prepared, selectedContext, measureEndFrame, eventImpact!),
      groundedSamplesBeforeSupport: groundedBefore,
    };
    const outgoingSamples = contract.outgoing.measurementSamples;
    accounting = {
      outgoingMeasurementSamples: outgoingSamples,
      groundedSamplesBeforeSupport: groundedBefore,
      authoredAir: authoredAir ?? null,
      groundedBudgetFrames: authoredAir === undefined || groundedBefore === null
        ? null
        : round(supportGroundedBudgetFrames({
          outgoingMeasurementSamples: outgoingSamples,
          groundedSamplesBeforeSupport: groundedBefore,
          authoredAir,
        })),
    };
    // ── support/release arms ────────────────────────────────────────────────
    if (handoff === null) {
      supportArms = STAGED_SUPPORT_CONTROLS.map((control) => ({
        control, status: "unavailable_no_handoff", reason: handoffUnavailableReason,
      }));
    } else if (authoredAir === undefined) {
      // The undefined-axis control: unavailable, never synthesized.
      supportArms = STAGED_SUPPORT_CONTROLS.map((control) => ({
        control, status: "unavailable_axis_undefined", reason: "authored outgoing air does not exist",
      }));
    } else if (groundedBefore === null) {
      supportArms = STAGED_SUPPORT_CONTROLS.map((control) => ({
        control, status: "unavailable_accounting", reason: "capture-only outgoing prefix not measurable through H-1",
      }));
    } else {
      const budget = supportGroundedBudgetFrames({
        outgoingMeasurementSamples: outgoingSamples,
        groundedSamplesBeforeSupport: groundedBefore,
        authoredAir,
      });
      supportArms = STAGED_SUPPORT_CONTROLS.map((control) =>
        evaluateSupportArm({
          prepared, contract, control, handoff: handoff!, budget,
          selectedContext: selectedContext!, captureOnlyIdentity: captureOnlyIdentity!,
          protectedEndFrame, baselineProtectedTrace, measureEndFrame,
          eventImpact: eventImpact!,
        })
      );
    }
  }

  const summary = summarizeState({
    id, prepared, contract, positiveControl, captureScope, captureRows,
    selectedContext, handoff, baselineArm, captureOnlyArm, supportArms,
    authoredAir: authoredAir ?? null, authoredSpeed: authoredSpeed ?? null,
  });

  const artifactIdentity = studyArtifactIdentity({
    schema: SCHEMA,
    fixtureFingerprint: fixture.fixtureFingerprint,
    studySourceFingerprint: sourceIdentity.studySourceFingerprint,
    observationCandidateFingerprint: observationCompiler.candidateFingerprint,
    protocolFingerprint,
  });
  const document = {
    schema: SCHEMA,
    artifactIdentity,
    purpose: [
      "Test the staged capture-to-support construction (docs/staged-transition-solver-assay.md) on one frozen calibration state.",
      "Retain every control, guard witness, trace identity, and sim cost; select nothing beyond the declared first-structurally-closed capture rule.",
      "Production integration is forbidden: this is a calibration study outside the compiler identity boundary.",
    ],
    status: {
      studyEligible: positiveControl.pass,
      ineligibilityReason: positiveControl.pass ? null : "positive static rail side-control failed; the full study is ineligible on this state",
      productionIntegration: "forbidden: calibration study, not a candidate source, selector, or promotion command",
      cohortPolicy: "stable V3 calibration fixtures only",
    },
    argv: [...argv],
    elapsedMs: round(performance.now() - stateStarted),
    stateSimFrames: getSimFrames() - stateSimBefore,
    provenance: {
      fixturePath,
      fixtureFingerprint: fixture.fixtureFingerprint,
      captureCompiler: fixture.captureCompiler,
      observationCompiler,
      runtime: { node: process.version, engine: "wasm" },
      studySourceFingerprint: sourceIdentity.studySourceFingerprint,
      studySourceFiles: sourceIdentity.sourceFiles,
    },
    panel: prepared.panel,
    fixtureReplay: prepared.replay,
    protocol: { protocolFingerprint },
    transition: {
      incoming: { gap: contract.incoming.gapIndex, frames: contract.incoming.intervalFrames, axes: contract.incoming.axes },
      event: contract.event,
      outgoing: {
        gap: contract.outgoing.gapIndex,
        frames: contract.outgoing.intervalFrames,
        measurementSamples: contract.outgoing.measurementSamples,
        axes: contract.outgoing.axes,
        nextEvent: contract.outgoing.arrival,
      },
    },
    physicalPrefixGuard: {
      startFrame: 0,
      endFrame: protectedEndFrame,
      baselineTrace: baselineProtectedTrace,
      comparator: "exact_full_non_scarf_engine_state_v1",
    },
    positiveControl,
    captureScope,
    captureRows,
    handoff: handoff === null
      ? { available: false, reason: selectedContext === null ? "no_closed_capture" : handoffUnavailableReason }
      : { available: true, ...handoff, hFrame: selectedContext!.hFrame },
    accounting,
    arms: {
      ordinaryBaseline: publicArm(baselineArm),
      captureOnly: captureOnlyArm === null ? null : publicArm(captureOnlyArm),
      supportOnly: { status: "not_physically_meaningful", reason: "support is defined from the sealed capture handoff; without a closed capture there is no handoff to begin at" },
      combined: supportArms,
    },
    summary,
  };
  const artifactPath = allocateStudyArtifactPath(
    `${outDir}/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}.json`,
  );
  writeStudyArtifact(artifactPath, document);
  return { id, prepared, contract, positiveControl, captureScope, captureRows, selectedContext, handoff, baselineArm, captureOnlyArm, supportArms, summary, artifactPath };
}

// ── capture control evaluation ───────────────────────────────────────────────

function evaluateCaptureControl(
  prepared: PreparedTrajectoryFixtureCore,
  kinematic: ReturnType<typeof contactKinematicFrameFromPlanningState>,
  control: StagedCaptureControl,
  protectedEndFrame: number,
  baselineProtectedTrace: ExactTraceFingerprint,
): { row: object; context: SelectedCaptureContext | null } {
  const rowStarted = performance.now();
  const simBefore = getSimFrames();
  const finish = (status: CaptureRowStatus, extra: object = {}): { row: object; context: null } => ({
    row: {
      index: control.index,
      label: control.label,
      flipped: control.flipped,
      control: {
        turnOrientation: control.turnOrientation,
        targetPhaseOffsetFrames: control.targetPhaseOffsetFrames,
        entryTurnShare: control.entryTurnShare,
        turnMagnitudeDeg: round(control.turnMagnitudeDeg),
      },
      status,
      ...extra,
      elapsedMs: round(performance.now() - rowStarted),
      simFrames: getSimFrames() - simBefore,
    },
    context: null,
  });
  let realization: ReturnType<typeof realizeStagedCapture>;
  try {
    realization = realizeStagedCapture(kinematic, control, prepared.lineIdStart);
  } catch (error) {
    return finish("geometry_error", { error: errorMessage(error) });
  }
  const lineIds = new Set(realization.lines.map((line) => line.id));
  const captureEngine = prepared.engine.addLine(realization.lines.map((line) => engineLineFromTrackLine(line)));
  const validationEnd = prepared.current.endFrame + CAPTURE_VALIDATION_TAIL_FRAMES;
  const detection = detectWindow(captureEngine, 0, validationEnd);
  const observation = observeOwnedContactTransition(detection, {
    targetFrame: prepared.current.endFrame,
    gapFrames: prepared.current.endFrame - prepared.current.startFrame,
    observationEndFrame: validationEnd,
    ownedLineIds: lineIds,
    lineRoles: realization.roles,
    requiredLineRoles: STAGED_CAPTURE_ROLES,
    persistenceOffsetFrames: PERSISTENCE_FRAMES,
    responseOffsetFrames: IMPACT_WINDOW,
    timingToleranceFrames: 1,
  });
  const geometry = {
    lineCount: realization.lines.length,
    lineHash: sha256(stableJson(realization.lines)),
    capturePoint: point(realization.capturePoint),
    entryAngleDeg: round(realization.entryAngleDeg),
    exitAngleDeg: round(realization.exitAngleDeg),
    impactTurnDeg: round(realization.impactTurnDeg),
    entryTurnDeg: round(realization.entryTurnDeg),
    remainingTurnDeg: round(realization.remainingTurnDeg),
    arcSegmentCount: realization.arcSegmentCount,
  };
  const selectedEvent = observation.selectedOwnedEvent;
  if (selectedEvent === null) {
    return finish("no_owned_event", { geometry, nearbyEventCount: observation.nearbyEvents.length, terminus: detection.terminus });
  }
  const hFrame = selectedEvent.frame + STAGED_RESPONSE_HORIZON_OFFSET_FRAMES;
  const closureEnd = selectedEvent.frame + IMPACT_WINDOW;
  if (!survivesThroughFrame(detection, hFrame) || measurementLastFrame(detection) < hFrame) {
    return finish("survival", { geometry, selectedEvent, terminus: detection.terminus });
  }
  if (!observation.persistenceWindowComplete) return finish("persistence_unavailable", { geometry, selectedEvent });
  if (!observation.responseWindowComplete) return finish("response_unavailable", { geometry, selectedEvent });
  // Off-beat classification reads only authored contacts at or before the
  // local closure window: no outgoing knowledge reaches the capture stage.
  const authoredThroughClosure = prepared.ctx.allContactFrames.filter((frame) => frame <= closureEnd);
  const unresolvedOffBeat = unresolvedOffBeatLandingFramesAtWindowEnd(
    detection, authoredThroughClosure, prepared.current.startFrame, closureEnd,
  );
  const offBeat = offBeatLandingsInWindow(
    detection, authoredThroughClosure, prepared.current.startFrame, closureEnd,
  ).filter((frame) => !unresolvedOffBeat.includes(frame));
  if (offBeat.length > 0) return finish("offbeat", { geometry, selectedEvent, offBeatLandingFrames: offBeat });
  if (unresolvedOffBeat.length > 0) {
    return finish("offbeat_unresolved", { geometry, selectedEvent, unresolvedOffBeatLandingFrames: unresolvedOffBeat });
  }
  // Expensive protected-prefix guards, evaluated last: the full engine trace
  // must be preserved AND no proposed line may collide through endFrame - 2.
  const protectedTrace = prefixTrace(captureEngine, protectedEndFrame);
  if (!sameExactEngineTrace(protectedTrace, baselineProtectedTrace)) {
    return finish("prefix_trace_changed", { geometry, selectedEvent, protectedTrace });
  }
  const prefixHits = collisionHits(captureEngine, 0, protectedEndFrame, lineIds);
  if (prefixHits.length > 0) {
    return finish("prefix_intrusion", { geometry, selectedEvent, prefixHits: prefixHits.slice(0, 8) });
  }
  const impact = scoredContactImpact(detection, {
    target: kinematic.impact?.target ?? null,
    landingFrame: selectedEvent.frame,
    responseWindowComplete: observation.responseWindowComplete,
  });
  const closedRow = finish("closed", {
    geometry,
    selectedEvent,
    collisionWitnesses: {
      eventContactLineIds: selectedEvent.contactLineIds,
      ownedLineIds: selectedEvent.ownedLineIds,
      lineRoles: selectedEvent.lineRoles,
    },
    impact,
    hFrame,
    protectedTraceMatchesBaseline: true,
  });
  return {
    row: closedRow.row,
    context: {
      control,
      captureEngine,
      lines: realization.lines,
      roles: realization.roles,
      lineIds,
      selectedEvent,
      impact,
      hFrame,
    },
  };
}

// ── support arm evaluation ───────────────────────────────────────────────────

function evaluateSupportArm(input: {
  prepared: PreparedTrajectoryFixtureCore;
  contract: ReturnType<typeof transitionContractForGap>;
  control: (typeof STAGED_SUPPORT_CONTROLS)[number];
  handoff: SealedCaptureHandoff;
  budget: number;
  selectedContext: SelectedCaptureContext;
  captureOnlyIdentity: {
    hTrace: ExactTraceFingerprint;
    observationAtMeasureEnd: OwnedContactObservation;
    impactAtMeasureEnd: ReturnType<typeof scoredContactImpact>;
  };
  protectedEndFrame: number;
  baselineProtectedTrace: ExactTraceFingerprint;
  measureEndFrame: number;
  eventImpact: number;
}): object {
  const armStarted = performance.now();
  const simBefore = getSimFrames();
  const { prepared, selectedContext } = input;
  let support: ReturnType<typeof realizeStagedSupport>;
  try {
    support = realizeStagedSupport(
      input.handoff, input.budget, input.control,
      prepared.lineIdStart + selectedContext.lines.length,
    );
  } catch (error) {
    return {
      control: input.control,
      status: "unavailable_construction",
      reason: errorMessage(error),
      groundedBudgetFrames: round(input.budget),
      elapsedMs: round(performance.now() - armStarted),
      simFrames: getSimFrames() - simBefore,
    };
  }
  const supportIds = new Set(support.lineIds);
  const composite = prepared.engine.addLine(
    [...selectedContext.lines, ...support.lines].map((line) => engineLineFromTrackLine(line)),
  );
  const arm = measureOutcomeArm({
    engine: composite,
    prepared,
    contract: input.contract,
    measureEndFrame: input.measureEndFrame,
    captureIds: selectedContext.lineIds,
    supportIds,
    label: `combined-${input.control.id}`,
  });
  const detection = arm.detection;
  const hFrame = selectedContext.hFrame;
  // Exact composite guards. The permitted support start is strictly after H:
  // the trace-through-H identity and the collision guard are one contract
  // (a support collision at or before H is an attributed construction
  // rejection, mirroring the exact-support-slice "[0,H] inclusive" guard).
  const protectedTrace = prefixTrace(composite, input.protectedEndFrame);
  const prefixMatches = sameExactEngineTrace(protectedTrace, input.baselineProtectedTrace);
  const earlySupportHits = collisionHits(composite, 0, hFrame, supportIds);
  const hTrace = exactEngineStateTraceFingerprint(composite, prepared.outgoing.startFrame, hFrame);
  const hTraceMatches = sameExactEngineTrace(hTrace, input.captureOnlyIdentity.hTrace);
  const observation = observeCapture(detection, prepared, selectedContext, input.measureEndFrame);
  const captureEventPreserved = sameOwnedCaptureEvent(
    observation.selectedOwnedEvent,
    input.captureOnlyIdentity.observationAtMeasureEnd.selectedOwnedEvent,
  );
  const impact = captureImpactOf(detection, prepared, selectedContext, input.measureEndFrame, input.eventImpact);
  const impactPreserved = sameScoredContactImpact(impact, input.captureOnlyIdentity.impactAtMeasureEnd);
  const guardsPassed = prefixMatches && earlySupportHits.length === 0 && hTraceMatches &&
    captureEventPreserved && impactPreserved;
  const supportContactHits = collisionHits(composite, hFrame + 1, input.measureEndFrame, supportIds);
  return {
    control: input.control,
    status: guardsPassed ? "valid" : "invalid",
    geometry: {
      lineCount: support.lines.length,
      lineHash: sha256(stableJson(support.lines)),
      groundedBudgetFrames: round(support.groundedBudgetFrames),
      extentPx: round(support.extentPx),
      segmentCount: support.segmentCount,
      startPoint: point(support.startPoint),
      endPoint: point(support.endPoint),
      entryTangentDeg: round(support.entryTangentDeg),
      exitTangentDeg: round(support.exitTangentDeg),
      flipped: support.flipped,
      lineIds: support.lineIds,
    },
    guards: {
      protectedPrefixMatchesBaseline: prefixMatches,
      supportCollisionBeforeH: earlySupportHits.slice(0, 8),
      supportCollisionBeforeHCount: earlySupportHits.length,
      captureTraceThroughHMatchesCaptureOnly: hTraceMatches,
      captureEventPreserved,
      captureImpactPreserved: impactPreserved,
      impact,
    },
    supportContact: {
      collisionCount: supportContactHits.length,
      firstFrame: supportContactHits[0]?.frame ?? null,
      lastFrame: supportContactHits.at(-1)?.frame ?? null,
    },
    outcome: publicArm(arm),
    elapsedMs: round(performance.now() - armStarted),
    simFrames: getSimFrames() - simBefore,
  };
}

// ── shared outcome measurement (all arms) ────────────────────────────────────

function measureOutcomeArm(input: {
  // deno-lint-ignore no-explicit-any
  engine: any;
  prepared: PreparedTrajectoryFixtureCore;
  contract: ReturnType<typeof transitionContractForGap>;
  measureEndFrame: number;
  captureIds: ReadonlySet<number>;
  supportIds: ReadonlySet<number>;
  label: string;
}) {
  const simBefore = getSimFrames();
  const { prepared } = input;
  const detection = detectWindow(input.engine, 0, input.measureEndFrame);
  const outgoing = prepared.outgoing;
  const survivesToNextBoundary = survivesThroughFrame(detection, outgoing.endFrame) &&
    measurementLastFrame(detection) >= outgoing.endFrame;
  const window = survivesToNextBoundary
    ? measureCoMWindow(detection, outgoing.startFrame, outgoing.endFrame)
    : null;
  const authoredAir = input.contract.outgoing?.axes.air;
  const authoredSpeed = input.contract.outgoing?.axes.speed;
  const unresolvedOffBeat = unresolvedOffBeatLandingFramesAtWindowEnd(
    detection, prepared.ctx.allContactFrames, outgoing.startFrame, outgoing.endFrame,
  );
  const offBeat = offBeatLandingsInWindow(
    detection, prepared.ctx.allContactFrames, outgoing.startFrame, outgoing.endFrame,
  ).filter((frame) => !unresolvedOffBeat.includes(frame));
  const nextBoundaryEvents = detection.events
    .filter((event) => Math.abs(event.frame - outgoing.endFrame) <= 1)
    .map((event) => {
      const ids = contactLineIdsAt(detection, event.frame);
      return {
        type: event.type,
        frame: event.frame,
        offsetFrames: event.frame - outgoing.endFrame,
        contactLineIds: ids,
        ownership: ids.some((lineId) => input.supportIds.has(lineId))
          ? "support"
          : ids.some((lineId) => input.captureIds.has(lineId))
          ? "capture"
          : ids.length > 0
          ? "prefix"
          : "none",
      };
    });
  return {
    label: input.label,
    detection,
    survivesToNextBoundary,
    terminus: detection.terminus,
    window,
    airResidual: window !== null && authoredAir !== undefined ? window.airFraction - authoredAir : null,
    speedResidualAuthored: window !== null && authoredSpeed !== undefined
      ? window.meanSpeedAuthored - authoredSpeed
      : null,
    outgoingOffBeatLandingFrames: offBeat,
    outgoingUnresolvedOffBeatLandingFrames: unresolvedOffBeat,
    nextBoundaryEvents,
    simFrames: getSimFrames() - simBefore,
  };
}

type OutcomeArm = ReturnType<typeof measureOutcomeArm>;

/** Artifact-facing arm record (the engine detection object stays internal). */
function publicArm(arm: OutcomeArm) {
  return {
    label: arm.label,
    survivesToNextBoundary: arm.survivesToNextBoundary,
    terminus: arm.terminus,
    window: arm.window === null ? null : {
      startFrame: arm.window.startFrame,
      endFrame: arm.window.endFrame,
      measurementSamples: arm.window.measurementSamples,
      airborneSamples: arm.window.airborneSamples,
      airFraction: round(arm.window.airFraction),
      meanSpeedAuthored: round(arm.window.meanSpeedAuthored),
      terminal: {
        position: point(arm.window.terminal.position),
        speedPxPerFrame: round(arm.window.terminal.speedPxPerFrame),
        headingDeg: round(arm.window.terminal.headingDeg),
      },
    },
    airResidual: arm.airResidual === null ? null : round(arm.airResidual),
    speedResidualAuthored: arm.speedResidualAuthored === null ? null : round(arm.speedResidualAuthored),
    outgoingOffBeatLandingFrames: arm.outgoingOffBeatLandingFrames,
    outgoingUnresolvedOffBeatLandingFrames: arm.outgoingUnresolvedOffBeatLandingFrames,
    nextBoundaryEvents: arm.nextBoundaryEvents,
    simFrames: arm.simFrames,
  };
}

// ── positive static rail side-control ────────────────────────────────────────

function evaluatePositiveRailControl(
  prepared: PreparedTrajectoryFixtureCore,
  protectedEndFrame: number,
  baselineProtectedTrace: ExactTraceFingerprint,
) {
  const simBefore = getSimFrames();
  const targetFrameIndex = prepared.current.endFrame;
  const observationEnd = targetFrameIndex + POSITIVE_RAIL_PROTOCOL.observationTailFrames;
  const failure = (reason: string) => ({
    pass: false,
    reason,
    motionFacingFlipped: null as boolean | null,
    arms: [] as object[],
    simFrames: getSimFrames() - simBefore,
  });
  const stateAtTarget = extractPlanningState(prepared.engine, targetFrameIndex);
  if (stateAtTarget === null) return failure("planning_state_unavailable_at_target");
  const anchor = targetFrameFromPlanningState(stateAtTarget);
  const heading = (anchor.headingDeg * Math.PI) / 180;
  const motion = {
    x: Math.cos(heading) * anchor.speedPxPerFrame,
    y: Math.sin(heading) * anchor.speedPxPerFrame,
  };
  let resolution: ReturnType<typeof resolvePositiveRailSide>;
  try {
    resolution = resolvePositiveRailSide(positiveRailWallTangentDeg(anchor.headingDeg), motion);
  } catch (error) {
    return failure(`side_resolution: ${errorMessage(error)}`);
  }
  const bareObservationTrace = exactEngineStateTraceFingerprint(prepared.engine, 0, observationEnd);
  const arms = [false, true].map((flipped) => {
    const rail = realizePositiveRail(
      { point: anchor.reference, headingDeg: anchor.headingDeg, speedPxPerFrame: anchor.speedPxPerFrame },
      flipped, prepared.lineIdStart,
    );
    const engine = prepared.engine.addLine([engineLineFromTrackLine(rail)]);
    detectWindow(engine, 0, observationEnd);
    const hits = collisionHits(engine, 0, observationEnd, new Set([rail.id]));
    const prefixHits = hits.filter((hit) => hit.frame <= protectedEndFrame);
    const protectedTrace = prefixTrace(engine, protectedEndFrame);
    const fullTrace = exactEngineStateTraceFingerprint(engine, 0, observationEnd);
    return {
      flipped,
      railLineId: rail.id,
      railEndpoints: { p1: point({ x: rail.x1, y: rail.y1 }), p2: point({ x: rail.x2, y: rail.y2 }) },
      collisionCount: hits.length,
      firstCollisionFrame: hits[0]?.frame ?? null,
      prefixCollisionCount: prefixHits.length,
      protectedPrefixMatchesBaseline: sameExactEngineTrace(protectedTrace, baselineProtectedTrace),
      inertVsBare: sameExactEngineTrace(fullTrace, bareObservationTrace),
    };
  });
  const facing = arms.find((arm) => arm.flipped === resolution.motionFacingFlipped)!;
  const offside = arms.find((arm) => arm.flipped !== resolution.motionFacingFlipped)!;
  const pass = facing.collisionCount > 0 && facing.prefixCollisionCount === 0 &&
    facing.protectedPrefixMatchesBaseline &&
    offside.collisionCount === 0 && offside.inertVsBare && offside.protectedPrefixMatchesBaseline;
  return {
    pass,
    reason: pass ? null : "positive rail did not admit exactly the motion-facing side with an intact protected prefix",
    motionFacingFlipped: resolution.motionFacingFlipped,
    motionProjectionPx: round(resolution.motionProjectionPx),
    wallTangentDeg: round(resolution.wallTangentDeg),
    anchor: { reference: point(anchor.reference), headingDeg: round(anchor.headingDeg), speedPxPerFrame: round(anchor.speedPxPerFrame), anchorPoint: anchor.anchorPoint },
    arms,
    simFrames: getSimFrames() - simBefore,
  };
}

// ── shared helpers ───────────────────────────────────────────────────────────

function observeCapture(
  detection: ReturnType<typeof detectWindow>,
  prepared: PreparedTrajectoryFixtureCore,
  context: SelectedCaptureContext,
  observationEndFrame: number,
): OwnedContactObservation {
  return observeOwnedContactTransition(detection, {
    targetFrame: prepared.current.endFrame,
    gapFrames: prepared.current.endFrame - prepared.current.startFrame,
    observationEndFrame,
    ownedLineIds: context.lineIds,
    lineRoles: context.roles,
    requiredLineRoles: STAGED_CAPTURE_ROLES,
    persistenceOffsetFrames: PERSISTENCE_FRAMES,
    responseOffsetFrames: IMPACT_WINDOW,
    timingToleranceFrames: 1,
  });
}

function captureImpactOf(
  detection: ReturnType<typeof detectWindow>,
  prepared: PreparedTrajectoryFixtureCore,
  context: SelectedCaptureContext,
  observationEndFrame: number,
  eventImpact: number,
) {
  const observation = observeCapture(detection, prepared, context, observationEndFrame);
  return scoredContactImpact(detection, {
    target: eventImpact,
    landingFrame: observation.selectedOwnedEvent?.frame ?? null,
    responseWindowComplete: observation.responseWindowComplete,
  });
}

function countGroundedSamples(
  detection: ReturnType<typeof detectWindow>,
  startFrame: number,
  endFrame: number,
): number | null {
  let grounded = 0;
  for (let frame = startFrame; frame <= endFrame; frame++) {
    const airborne = airborneAt(detection, frame);
    if (airborne === undefined) return null;
    if (!airborne) grounded++;
  }
  return grounded;
}

// deno-lint-ignore no-explicit-any
function prefixTrace(engine: any, endFrame: number): ExactTraceFingerprint {
  return endFrame < 0 ? emptyEngineStateTraceFingerprint() : exactEngineStateTraceFingerprint(engine, 0, endFrame);
}

// deno-lint-ignore no-explicit-any
function collisionHits(engine: any, startFrame: number, endFrame: number, lineIds: ReadonlySet<number>) {
  const hits = [];
  for (let frame = startFrame; frame <= endFrame; frame++) {
    hits.push(...engineCollisionHitsForLineIds(engine, frame, lineIds));
  }
  return hits;
}

// ── summaries ────────────────────────────────────────────────────────────────

function summarizeState(input: {
  id: StateId;
  prepared: PreparedTrajectoryFixtureCore;
  contract: ReturnType<typeof transitionContractForGap>;
  positiveControl: ReturnType<typeof evaluatePositiveRailControl>;
  captureScope: string;
  captureRows: readonly object[];
  selectedContext: SelectedCaptureContext | null;
  handoff: object | null;
  baselineArm: OutcomeArm;
  captureOnlyArm: OutcomeArm | null;
  supportArms: readonly object[];
  authoredAir: number | null;
  authoredSpeed: number | null;
}) {
  const rows = input.captureRows as Array<{ status: CaptureRowStatus; index: number; label?: string; flipped?: boolean }>;
  const evaluated = rows.filter((row) => row.status !== "not_evaluated");
  const closed = rows.find((row) => row.status === "closed") ?? null;
  const statusCounts: Record<string, number> = {};
  for (const row of evaluated) statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  const arms = input.supportArms as Array<{ control: { id: string }; status: string; guards?: { captureEventPreserved: boolean; captureImpactPreserved: boolean }; outcome?: { survivesToNextBoundary: boolean; airResidual: number | null } }>;
  return {
    positiveControlPass: input.positiveControl.pass,
    captureScope: input.captureScope,
    stencilSize: rows.length,
    controlsEvaluated: evaluated.length,
    captureClosed: closed !== null,
    firstClosedControl: closed === null ? null : { index: closed.index, label: closed.label, flipped: closed.flipped },
    captureStatusCounts: statusCounts,
    supportArmStatusCounts: countBy(arms, (arm) => arm.status),
    captureIdentityPreservedArms: arms.filter((arm) => arm.guards?.captureEventPreserved && arm.guards?.captureImpactPreserved).length,
    validSupportArms: arms.filter((arm) => arm.status === "valid").length,
    baseline: { survives: input.baselineArm.survivesToNextBoundary, airResidual: opt(input.baselineArm.airResidual) },
    captureOnly: input.captureOnlyArm === null ? null : {
      survives: input.captureOnlyArm.survivesToNextBoundary,
      airResidual: opt(input.captureOnlyArm.airResidual),
      speedResidualAuthored: opt(input.captureOnlyArm.speedResidualAuthored),
    },
  };
}

function printRunSummary(results: ReturnType<typeof runState>[]): void {
  const lines: string[] = [
    `staged capture assay: ${results.length} state(s), ${round((performance.now() - started) / 1000)}s, engine=wasm`,
  ];
  for (const result of results) {
    const contractOut = result.contract.outgoing!;
    lines.push(
      `STATE ${result.id} (gap ${result.prepared.panel.currentGap}->${result.prepared.panel.outgoingGap}, ` +
        `outgoing ${contractOut.intervalFrames}f; impact ${fmt(result.contract.event.impact)}, air ${fmt(contractOut.axes.air)}):`,
    );
    const pc = result.positiveControl;
    lines.push(`  positive-rail: ${pc.pass ? "PASS" : "FAIL"} motion-facing flipped=${pc.motionFacingFlipped}${pc.pass ? "" : ` (${pc.reason})`}`);
    const s = result.summary;
    if (s.captureScope !== "evaluated") {
      lines.push(`  capture: ${s.captureScope}`);
    } else if (!s.captureClosed) {
      lines.push(`  capture: NOT CLOSED (evaluated ${s.controlsEvaluated}/${s.stencilSize}; ${JSON.stringify(s.captureStatusCounts)})`);
    } else {
      lines.push(`  capture: CLOSED at control ${s.firstClosedControl!.index}/${s.stencilSize} "${s.firstClosedControl!.label}" (evaluated ${s.controlsEvaluated}; ${JSON.stringify(s.captureStatusCounts)})`);
    }
    lines.push(`  arms:  ${armLine(publicish(result.baselineArm))}`);
    if (result.captureOnlyArm !== null) lines.push(`         ${armLine(publicish(result.captureOnlyArm))}`);
    for (const arm of result.supportArms as Array<Record<string, unknown>>) {
      const control = (arm.control as { id: string }).id;
      if (arm.status === "valid" || arm.status === "invalid") {
        const outcome = arm.outcome as ReturnType<typeof publicArm>;
        const guards = arm.guards as { captureEventPreserved: boolean; captureImpactPreserved: boolean; supportCollisionBeforeHCount: number; protectedPrefixMatchesBaseline: boolean; captureTraceThroughHMatchesCaptureOnly: boolean };
        lines.push(`         ${control}: ${arm.status}` +
          `${arm.status === "invalid" ? ` [prefix=${guards.protectedPrefixMatchesBaseline} preH=${guards.supportCollisionBeforeHCount === 0} Htrace=${guards.captureTraceThroughHMatchesCaptureOnly} event=${guards.captureEventPreserved} impact=${guards.captureImpactPreserved}]` : ""}` +
          ` ${armLine(outcome)}`);
      } else {
        lines.push(`         ${control}: ${arm.status}${arm.reason !== undefined ? ` (${arm.reason})` : ""}`);
      }
    }
    lines.push(`  artifact: ${result.artifactPath}`);
  }
  lines.push(...falsifierAssessment(results));
  process.stdout.write(lines.join("\n") + "\n");
}

/** Mechanical evidence for the doc's "Readout and Falsifiers" items 1-6.
 *  Verdicts belong to the reader; this block only aggregates the witnesses. */
function falsifierAssessment(results: ReturnType<typeof runState>[]): string[] {
  const positiveFailures = results.filter((result) => !result.positiveControl.pass).map((result) => result.id);
  const prefixDriftWitnesses: string[] = [];
  for (const result of results) {
    for (const arm of result.supportArms as Array<{ control: { id: string }; guards?: { protectedPrefixMatchesBaseline: boolean } }>) {
      if (arm.guards !== undefined && !arm.guards.protectedPrefixMatchesBaseline) {
        prefixDriftWitnesses.push(`${result.id}/${arm.control.id}`);
      }
    }
    for (const row of result.captureRows as Array<{ status: string; index: number }>) {
      if (row.status === "prefix_trace_changed" || row.status === "prefix_intrusion") {
        prefixDriftWitnesses.push(`${result.id}/capture#${row.index}(${row.status})`);
      }
    }
  }
  const firstClosed = results.map((result) =>
    `${result.id}:${result.summary.firstClosedControl === null ? "none" : result.summary.firstClosedControl.index}`
  );
  const identityBreaks: string[] = [];
  let engagedArms = 0;
  for (const result of results) {
    for (const arm of result.supportArms as Array<{ control: { id: string }; status: string; guards?: { captureEventPreserved: boolean; captureImpactPreserved: boolean } }>) {
      if (arm.guards === undefined) continue;
      engagedArms++;
      if (!arm.guards.captureEventPreserved || !arm.guards.captureImpactPreserved) {
        identityBreaks.push(`${result.id}/${arm.control.id}`);
      }
    }
  }
  const closureByState = results.map((result) => `${result.id}=${result.summary.captureClosed ? "closed" : (result.summary.captureScope !== "evaluated" ? result.summary.captureScope : "open")}`);
  const validArmsByState = results.map((result) => `${result.id}=${result.summary.validSupportArms}/${(result.supportArms as unknown[]).length}`);
  const outOfScope = results.filter((result) => result.captureScope !== "evaluated").map((result) => result.id);
  return [
    "FALSIFIERS (docs/staged-transition-solver-assay.md, items 1-6):",
    `  1 positive-control/prefix-drift: positive-control failures=[${positiveFailures.join(",") || "none"}]; prefix-drift witnesses=[${prefixDriftWitnesses.join(",") || "none"}]`,
    `  2 oracle/case-specific selection: fixed-order first-closed control index per state {${firstClosed.join(", ")}} of 48; zero case/seed/duration inputs exist in the construction`,
    `  3 capture identity under support: ${identityBreaks.length}/${engagedArms} constructed arms broke capture event/impact identity${identityBreaks.length > 0 ? ` [${identityBreaks.join(",")}]` : ""}`,
    `  4 generality: closure {${closureByState.join(", ")}}; valid support arms {${validArmsByState.join(", ")}}`,
    `  5 ordinary-control regression: compare the ordinary state's combined arms against capture-only/baseline in the tables above`,
    `  6 undefined-axis conversion: out-of-scope/unavailable states=[${outOfScope.join(",") || "none"}]; synthetic targets constructed=0 (no synthesis path exists)`,
  ];
}

function publicish(arm: OutcomeArm) {
  return publicArm(arm);
}

function armLine(arm: ReturnType<typeof publicArm>): string {
  const next = arm.nextBoundaryEvents.length === 0
    ? "none"
    : arm.nextBoundaryEvents.map((event) => `${event.type}@${event.offsetFrames >= 0 ? "+" : ""}${event.offsetFrames}(${event.ownership})`).join(",");
  return `${arm.label}: survives=${arm.survivesToNextBoundary}` +
    ` air=${arm.window === null ? "-" : fmt(arm.window.airFraction)}${arm.airResidual === null ? "" : `(res ${signed(arm.airResidual)})`}` +
    `${arm.speedResidualAuthored === null ? "" : ` speedRes=${signed(arm.speedResidualAuthored)}`}` +
    ` offbeat=${arm.outgoingOffBeatLandingFrames.length}` +
    ` nextBoundary=${next}` +
    ` sim=${arm.simFrames}`;
}

function countBy<T>(values: readonly T[], key: (value: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[key(value)] = (counts[key(value)] ?? 0) + 1;
  return counts;
}

function opt(value: number | null): number | null {
  return value === null ? null : round(value);
}

function fmt(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : String(round(value));
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${round(value)}`;
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
