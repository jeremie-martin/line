/**
 * Frozen-prefix study of a local target-frame contact primitive.
 *
 * This command is intentionally narrower than `study_transition_envelope.ts`:
 * it evaluates contact closure before introducing an outgoing support model.
 * Full candidate admission is observed only after a proposal closes locally.
 * It is calibration-only and cannot select or promote a compiler change.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PERSISTENCE_FRAMES } from "../lib/detector.ts";
import { clearImpactTemplateMarker, hasPreTargetSledProximityFromTrace, sampleArcPlacementGeometry } from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { fingerprintFiles } from "./benchmark_v2/suite_model.ts";
import { axisLookaheadEndFrame, detectWindow, tryCandidateLines } from "./core/candidate.ts";
import {
  engineLineFromTrackLine,
  offBeatLandingEvents,
  redirArcPxAtLanding,
} from "./core/substrate.ts";
import { makeRng } from "../lib/rng.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import type { Candidate } from "./optimizer/sample.ts";
import { IMPACT_WINDOW, normImpact, type TrackLine } from "./types.ts";
import {
  realizeContactClosure,
  resolveContactClosure,
  type ContactClosureControl,
  type RealizedContactClosure,
} from "./trajectory/contact_closure.ts";
import {
  contactTurnScreenMagnitudeDeg,
  makeLocalContactClosureScreen,
  type ContactClosureDesignEntry,
} from "./trajectory/contact_closure_design.ts";
import {
  realizeContactPhaseCarrier,
  resolveContactPhaseCarrier,
  type ContactPhaseCarrierControl,
  type RealizedContactPhaseCarrier,
} from "./trajectory/contact_phase_carrier.ts";
import {
  makeContactPhaseCarrierScreen,
} from "./trajectory/contact_phase_carrier_design.ts";
import {
  realizeContactCaptureArc,
  resolveContactCaptureArc,
  type ContactCaptureArcControl,
  type RealizedContactCaptureArc,
} from "./trajectory/contact_capture_arc.ts";
import { makeContactCaptureArcScreen } from "./trajectory/contact_capture_arc_design.ts";
import { contactKinematicFrameFromPlanningState } from "./trajectory/contact_kinematic_frame.ts";
import {
  observeOwnedContactTransition,
  ownedSledCollisionTelemetry,
} from "./trajectory/contact_observation.ts";
import { makeTransitionEnvelopeCenter, resolveSupportEnvelope } from "./trajectory/envelope/model.ts";
import { realizeSupportPath } from "./trajectory/envelope/realizer.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import { prepareComparableTrajectoryFixture, type PreparedTrajectoryFixture } from "./trajectory/study_context.ts";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

/** Matches the current candidate evaluator's documented local survival margin. */
const LOCAL_SURVIVAL_WINDOW_FRAMES = 16;

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_local_contact_closure.ts --fixture=FILE [--formulation=two-line|phase-carrier|capture-arc] [--out=FILE]",
    "",
    "Runs a fixed, calibration-only local contact-closure screen against an",
    "equal-count raw-normal proposal stream. It cannot select a source control.",
  ].join("\n") + "\n");
  process.exit(0);
}

const STUDY_SOURCE_FILES = [
  "scripts/v0/study_local_contact_closure.ts",
  "scripts/v0/trajectory/contact_closure.ts",
  "scripts/v0/trajectory/contact_closure_design.ts",
  "scripts/v0/trajectory/contact_phase_carrier.ts",
  "scripts/v0/trajectory/contact_phase_carrier_design.ts",
  "scripts/v0/trajectory/contact_capture_arc.ts",
  "scripts/v0/trajectory/contact_capture_arc_design.ts",
  "scripts/v0/trajectory/contact_kinematic_frame.ts",
  "scripts/v0/trajectory/curve_resolution.ts",
  "scripts/v0/trajectory/contact_observation.ts",
  "scripts/v0/trajectory/study_context.ts",
  "scripts/v0/trajectory/frozen_fixture.ts",
  "scripts/v0/trajectory/panel.ts",
  "scripts/v0/trajectory/state.ts",
  "scripts/v0/trajectory/target_frame.ts",
  "scripts/v0/trajectory/envelope/model.ts",
  "scripts/v0/trajectory/envelope/realizer.ts",
  "scripts/v0/trajectory/outgoing_interval.ts",
  "scripts/v0/trajectory/study_fixture.ts",
  "scripts/v0/arc_placement.ts",
  "scripts/v0/core/candidate.ts",
  "scripts/v0/core/substrate.ts",
  "scripts/v0/types.ts",
  "scripts/v0/optimizer/sample.ts",
  "scripts/v0/optimizer/handoff.ts",
  "scripts/lib/detector.ts",
] as const;

const fixturePath = argument("fixture");
if (fixturePath === undefined) throw new Error("--fixture=FILE is required");
const formulation = argument("formulation") ?? "two-line";
if (formulation !== "two-line" && formulation !== "phase-carrier" && formulation !== "capture-arc") {
  throw new Error(`unknown --formulation=${formulation}; expected two-line, phase-carrier, or capture-arc`);
}
const fixture = readFrozenTrajectoryFixture(fixturePath);
const started = performance.now();
const prepared = prepareComparableTrajectoryFixture(fixture);
if (prepared.panel.cohort !== "calibration") {
  throw new Error(
    `local contact-closure calibration accepts only calibration fixtures; ${prepared.panel.id} is ${prepared.panel.cohort}`,
  );
}

const directScreen = buildDirectScreen(formulation, prepared);
const turnMagnitudeDeg = directScreen[0]?.turnMagnitudeDeg;
if (turnMagnitudeDeg === undefined) throw new Error("local contact screen must declare at least one row");
const directRecords = directScreen.map((entry, index) => evaluateClosureDesignEntry(entry, index, prepared));
const rawSeed = rawStreamSeed(prepared);
const rawRecords = evaluateRawNormalProposals(prepared, directScreen.length, rawSeed);

const output = {
  schema: "line.study-local-contact-closure.v4",
  purpose: [
    "Measure one explicitly named local contact formulation before outgoing support is attached.",
    "Compare equal-count raw normal geometric proposals using the same bounded local endpoint.",
    "Run full exact candidate admission only after the bounded local endpoint closes; downstream admission is observation, not a contact-closure score.",
  ],
  status: {
    productionIntegration: "forbidden: this calibration study is not a candidate source, selector, or family promotion command",
    cohortPolicy: "calibration only; a separately frozen future validation cohort is required before any predictive claim",
    primaryEndpoint: "local preclear, on-time owned contact, bounded survival, complete persistence and six-frame scorer response windows, and no off-beat landing before the next authored contact",
    fullAdmission: "downstream observation only for locally closed proposals; its neutral stitch is pre-impact target-frame geometry, not evidence for a measured-state support law; tryCandidateLines remains the production authority",
  },
  decisionContract: {
    noSelection: "No row, hypothesis, or placement may be chosen from this output.",
    rawNormalMeaning: "An operational coverage comparator, not a statistical superiority estimate.",
    permittedInference: "At most, reject this local primitive as lacking broad closure coverage or justify a separately predeclared validation screen.",
    forbiddenInference: "No support law, compiler source default, or parameter value may be promoted from this calibration output.",
  },
  argv: [...argv],
  formulation,
  elapsedMs: round(performance.now() - started),
  provenance: {
    fixturePath,
    fixtureFingerprint: fixture.fixtureFingerprint,
    captureCompiler: fixture.captureCompiler,
    observationCompiler: compilerCandidateIdentity(process.env.LR_ENGINE ?? "js"),
    runtime: { node: process.version, engine: process.env.LR_ENGINE ?? "js" },
    studySourceFingerprint: fingerprintFiles(STUDY_SOURCE_FILES),
  },
  panel: prepared.panel,
  fixture: {
    captureBudget: prepared.fixture.captureBudget,
    captureEngine: prepared.fixture.captureEngine,
    captureEnvironment: prepared.fixture.captureEnvironment,
    baselineContractPassed: prepared.fixture.baselineContractPassed,
    baselineScore: prepared.fixture.baselineScore,
    baselineDeepestGap: prepared.fixture.baselineDeepestGap,
    interpretation: prepared.fixture.baselineContractPassed
      ? "The frozen prefix came from a contract-passing compiler run. It remains a local conditional study state, not a representative distribution sample."
      : "This is an intentionally retained capability/failure-state prefix, not representative production evidence; do not pool it with contract-passing rows.",
  },
  fixtureReplay: prepared.replay,
  targetFrame: summarizeTargetFrame(prepared),
  localEndpoint: {
    requestedSurvivalFramesAfterTarget: LOCAL_SURVIVAL_WINDOW_FRAMES,
    detectorPersistenceFrames: PERSISTENCE_FRAMES,
    scorerImpactWindowFrames: IMPACT_WINDOW,
    scorerImpactDefinition: "redirArcPxAtLanding(selected owned landing, IMPACT_WINDOW) -> normImpact; reported only when the entire response window is readable",
    boundary: "The window stops before the next authored contact; its available horizon is reported per fixture.",
  },
  directScreen: {
    count: directScreen.length,
    turnMagnitudeDeg: round(turnMagnitudeDeg),
    hypotheses: [...new Set(directScreen.map((entry) => entry.hypothesis))],
    placements: [...new Set(directScreen.map((entry) => entry.placement.label))],
    declaration: formulation === "two-line"
      ? "Five symmetric impact-scale turn allocations crossed with five one-factor target-frame placements on a two-line local primitive."
      : formulation === "phase-carrier"
      ? "Five symmetric impact-scale entry/tail turn allocations crossed with five one-factor target-frame placements on a three-line phase-carrier primitive."
      : "Four impact-turn allocations crossed with three predicted sled-point phases on a C1 capture boundary plus adaptive polyline response over the scorer horizon.",
  },
  rawNormal: {
    count: rawRecords.length,
    streamSeed: rawSeed,
    declaration: "The current normal geometry sampler is called once per attempt without its full candidate evaluator; only the shared local endpoint runs before any downstream full admission.",
  },
  directRecords,
  rawRecords,
  coverage: {
    direct: summarizeCoverage(directRecords),
    rawNormal: summarizeCoverage(rawRecords),
  },
  caveats: [
    "The target frame predicts state with no proposed terrain. It is a coordinate system for a hypothesis, not a collision oracle.",
    "The local handoff is geometry only. It is not the post-impact physical state; the latter is read from exact detector observations.",
    "A local closure can fail after a support path is added because static downstream terrain can alter collision dynamics. Full admission is retained separately for that reason.",
    "The 3/4/5/6/7-second duration ladder must be interpreted as one correlated family, not five independent observations.",
    "Raw normal proposes its complete legacy fragment while direct formulations own only a bounded local phase. Lower raw-normal coverage is an operational comparison, not a topology-only treatment effect.",
  ],
};

const outPath = argument("out") ?? `generated/studies/local-contact-closure/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}.json`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
process.stderr.write(
  `local closure ${prepared.panel.id}: ${output.coverage.direct.closed}/${output.coverage.direct.attempted} direct locally closed, ` +
  `${output.coverage.rawNormal.closed}/${output.coverage.rawNormal.attempted} raw-normal locally closed -> ${outPath}\n`,
);

type LocalStatus =
  | "closed"
  | "preclear"
  | "survival"
  | "landing"
  | "persistence_unavailable"
  | "response_unavailable"
  | "offbeat"
  | "error";
type ScoredImpactAvailability =
  | "measured"
  | "not_authored"
  | "not_observed_preclear"
  | "no_owned_contact"
  | "response_unavailable"
  | "measurement_unavailable";
type ScoredImpactOutcome = {
  /** Exact production impact metric availability for this local owned event. */
  availability: ScoredImpactAvailability;
  metric: "redirArcPxAtLanding -> normImpact";
  windowFrames: number;
  target: number | null;
  landingFrame: number | null;
  responseEndFrame: number | null;
  persistenceWindowComplete: boolean | null;
  responseWindowComplete: boolean | null;
  redirArcPx: number | null;
  achieved: number | null;
  residual: number | null;
};
type LocalRecord = ReturnType<typeof evaluateLines> | ReturnType<typeof failedLocalRecord>;
type LocalFormulation = "two-line" | "phase-carrier" | "capture-arc";
type DirectScreenEntry = {
  formulation: LocalFormulation;
  label: string;
  hypothesis: string;
  placement: { label: string };
  turnMagnitudeDeg: number;
  control: ContactClosureControl | ContactPhaseCarrierControl | ContactCaptureArcControl;
};
type LocalHandoff = { point: { x: number; y: number }; tangentDeg: number };

function buildDirectScreen(formulation: LocalFormulation, prepared: PreparedTrajectoryFixture): DirectScreenEntry[] {
  if (formulation === "two-line") {
    const turnMagnitudeDeg = contactTurnScreenMagnitudeDeg(prepared.frame, prepared.current.targets);
    return makeLocalContactClosureScreen({ turnMagnitudeDeg }).map((entry) => ({
      formulation,
      label: entry.label,
      hypothesis: entry.hypothesis,
      placement: entry.placement,
      turnMagnitudeDeg: entry.turnMagnitudeDeg,
      control: entry.control,
    }));
  }
  if (formulation === "phase-carrier") {
    const turnMagnitudeDeg = contactTurnScreenMagnitudeDeg(prepared.frame, prepared.current.targets);
    return makeContactPhaseCarrierScreen({ turnMagnitudeDeg }).map((entry) => ({
      formulation,
      label: entry.label,
      hypothesis: entry.hypothesis,
      placement: entry.placement,
      turnMagnitudeDeg: entry.turnMagnitudeDeg,
      control: entry.control,
    }));
  }
  const kinematic = contactKinematicFrameFromPlanningState(
    prepared.state,
    prepared.frame,
    prepared.current.targets,
  );
  return makeContactCaptureArcScreen(kinematic).map((entry) => ({
    formulation,
    label: entry.label,
    hypothesis: entry.hypothesis,
    placement: entry.placement,
    turnMagnitudeDeg: entry.turnMagnitudeDeg,
    control: entry.control,
  }));
}

function evaluateClosureDesignEntry(
  entry: DirectScreenEntry,
  index: number,
  preparedFixture: PreparedTrajectoryFixture,
) {
  let realization: ReturnType<typeof realizeDirectEntry>;
  try {
    realization = realizeDirectEntry(entry, preparedFixture);
  } catch (error) {
    return failedDesignRecord(entry, index, error);
  }
  const local = evaluateLines({
    family: "contact_closure",
    label: entry.label,
    index,
    lines: realization.lines,
    requiredLineRoles: realization.requiredLineRoles,
    lineRoles: realization.lineRoles,
    handoff: realization.handoff,
    geometryBoundary: realization.geometryBoundary,
    prepared: preparedFixture,
    stitchSupport: true,
  });
  return {
    family: "contact_closure" as const,
    formulation: entry.formulation,
    label: entry.label,
    index,
    hypothesis: entry.hypothesis,
    placement: entry.placement,
    turnMagnitudeDeg: round(entry.turnMagnitudeDeg),
    control: roundControl(entry.control),
    realization: realization.summary,
    local,
  };
}

function failedDesignRecord(entry: DirectScreenEntry, index: number, error: unknown) {
  return {
    family: "contact_closure" as const,
    formulation: entry.formulation,
    label: entry.label,
    index,
    hypothesis: entry.hypothesis,
    placement: entry.placement,
    turnMagnitudeDeg: round(entry.turnMagnitudeDeg),
    control: roundControl(entry.control),
    realization: null,
    local: failedLocalRecord(error),
  };
}

function realizeDirectEntry(entry: DirectScreenEntry, prepared: PreparedTrajectoryFixture) {
  if (entry.formulation === "two-line") {
    const realized = realizeContactClosure(
      resolveContactClosure(prepared.frame, entry.control as ContactClosureControl),
      prepared.lineIdStart,
    );
    return {
      lines: realized.lines,
      // The target is the shared local junction. Exact ownership can fall on
      // either adjacent line, but no later support line is eligible.
      requiredLineRoles: ["approach", "contact_guard"],
      lineRoles: new Map([
        [realized.lineRoles.ingress, "approach"],
        [realized.lineRoles.guard, "contact_guard"],
      ]),
      handoff: realized.handoff,
      geometryBoundary: realized.contactPoint,
      summary: summarizeClosure(realized),
    };
  }
  if (entry.formulation === "phase-carrier") {
    const realized = realizeContactPhaseCarrier(
      resolveContactPhaseCarrier(prepared.frame, entry.control as ContactPhaseCarrierControl),
      prepared.lineIdStart,
    );
    return {
      lines: realized.lines,
      // The phase's C1 target boundary is shared by approach and carrier. The
      // tail intentionally remains ineligible: it is later response terrain.
      requiredLineRoles: ["approach", "contact_carrier"],
      lineRoles: new Map([
        [realized.lineRoles.approach, "approach"],
        [realized.lineRoles.carrier, "contact_carrier"],
        [realized.lineRoles.tail, "tail"],
      ]),
      handoff: realized.handoff,
      geometryBoundary: realized.contactPoint,
      summary: summarizePhaseCarrier(realized),
    };
  }
  const kinematic = contactKinematicFrameFromPlanningState(
    prepared.state,
    prepared.frame,
    prepared.current.targets,
  );
  const realized = realizeContactCaptureArc(
    resolveContactCaptureArc(kinematic, entry.control as ContactCaptureArcControl),
    prepared.lineIdStart,
  );
  return {
    lines: realized.lines,
    requiredLineRoles: ["capture_band_approach", "capture_band_runway", "capture_band_arc"],
    lineRoles: new Map([
      [realized.lineRoles.approach, "capture_band_approach"],
      [realized.lineRoles.runway, "capture_band_runway"],
      ...realized.lineRoles.arc.map((id) => [id, "capture_band_arc"] as const),
    ]),
    handoff: realized.handoff,
    geometryBoundary: realized.capturePoint,
    summary: summarizeCaptureArc(realized),
  };
}

function evaluateRawNormalProposals(
  preparedFixture: PreparedTrajectoryFixture,
  count: number,
  streamSeed: number,
) {
  const rng = makeRng(streamSeed);
  const records = [];
  for (let attempt = 0; attempt < count; attempt++) {
    clearImpactTemplateMarker();
    try {
      const geometry = sampleArcPlacementGeometry(
        rng,
        preparedFixture.probe.refX,
        preparedFixture.probe.refY,
        preparedFixture.current.targets,
        preparedFixture.probe.targetState,
        attempt,
        preparedFixture.current,
        preparedFixture.lineIdStart,
        "normal",
        preparedFixture.ctx.allContactFrames,
      );
      const local = evaluateLines({
        family: "raw_normal",
        label: `normal_${attempt}`,
        index: attempt,
        lines: geometry.lines,
        requiredLineRoles: ["raw_proposal"],
        lineRoles: lineRoles(geometry.lines, "raw_proposal"),
        handoff: null,
        prepared: preparedFixture,
        stitchSupport: false,
      });
      records.push({
        family: "raw_normal" as const,
        label: `normal_${attempt}`,
        index: attempt,
        proposal: summarizeLines(geometry.lines),
        local,
      });
    } catch (error) {
      records.push({
        family: "raw_normal" as const,
        label: `normal_${attempt}`,
        index: attempt,
        proposal: null,
        local: failedLocalRecord(error),
      });
    }
  }
  return records;
}

function evaluateLines(input: {
  family: "contact_closure" | "raw_normal";
  label: string;
  index: number;
  lines: TrackLine[];
  requiredLineRoles: readonly string[];
  lineRoles: Map<number, string>;
  handoff: LocalHandoff | null;
  /** Named construction boundary, reported as telemetry and never gated. */
  geometryBoundary?: { x: number; y: number };
  prepared: PreparedTrajectoryFixture;
  /** Only the local primitive receives an intentionally separate downstream stitch. */
  stitchSupport: boolean;
}) {
  const started = performance.now();
  const simBefore = getSimFrames();
  const proposed = summarizeLines(input.lines);
  if (!proposed.valid) {
    return {
      status: "error" as const,
      error: "invalid local geometry",
      proposed,
      endpoint: null,
      fullAdmission: null,
      elapsedMs: round(performance.now() - started),
      simFrames: getSimFrames() - simBefore,
    };
  }
  if (hasPreTargetSledProximityFromTrace(input.prepared.probe.preTargetSledTrace(), input.lines)) {
    return {
      status: "preclear" as const,
      error: null,
      proposed,
      endpoint: {
        availableHorizonFrames: null,
        truncatedByNextContact: null,
        survivedThroughWindow: null,
        offBeatLandingFrames: [],
        observation: null,
        scoredImpact: unobservedImpactOutcome(input.prepared.current.targets.impact),
        geometry: input.geometryBoundary === undefined ? null : {
          boundary: point(input.geometryBoundary),
          selectedEventComDistancePx: null,
          selectedEventCollision: null,
        },
      },
      fullAdmission: null,
      elapsedMs: round(performance.now() - started),
      simFrames: getSimFrames() - simBefore,
    };
  }

  const end = localObservationEnd(input.prepared);
  const engine = input.prepared.engine.addLine(input.lines.map((line) => engineLineFromTrackLine(line)));
  const detection = detectWindow(engine, input.prepared.current.startFrame, end.frame);
  const observation = observeOwnedContactTransition(detection, {
    targetFrame: input.prepared.current.endFrame,
    gapFrames: input.prepared.current.endFrame - input.prepared.current.startFrame,
    observationEndFrame: end.frame,
    ownedLineIds: new Set(input.lines.map((line) => line.id)),
    lineRoles: input.lineRoles,
    requiredLineRoles: input.requiredLineRoles,
    persistenceOffsetFrames: PERSISTENCE_FRAMES,
    // This must be the actual scorer window, not the geometry primitive's
    // current response-horizon convention. The study cannot claim an impact
    // outcome when the production metric would be truncated.
    responseOffsetFrames: IMPACT_WINDOW,
  });
  const collisionTelemetry = observation.selectedOwnedEvent === null
    ? null
    : ownedSledCollisionTelemetry(
      engine.getUpdatesAtFrame(observation.selectedOwnedEvent.frame),
      new Set(observation.selectedOwnedEvent.ownedLineIds),
    );
  const survivedThroughWindow = detection.terminus.reason === "endOfSpec" || detection.terminus.frame >= end.frame;
  const offBeatLandingFrames = offBeatLandingEvents(detection, input.prepared.ctx.allContactFrames)
    .filter((event) => event.frame >= input.prepared.current.startFrame && event.frame <= end.frame)
    .map((event) => event.frame);
  const scoredImpact = measureOwnedScoredImpact(
    detection,
    observation,
    input.prepared.current.targets.impact,
  );
  const status: LocalStatus = !survivedThroughWindow
    ? "survival"
    : observation.selectedOwnedEvent === null
    ? "landing"
    : !observation.responseWindowComplete
    ? "response_unavailable"
    : !observation.persistenceWindowComplete
    ? "persistence_unavailable"
    : offBeatLandingFrames.length > 0
    ? "offbeat"
    : "closed";
  const endpoint = {
    availableHorizonFrames: end.frame - input.prepared.current.endFrame,
    truncatedByNextContact: end.truncatedByNextContact,
    survivedThroughWindow,
    offBeatLandingFrames,
    observation: summarizeObservation(observation),
    scoredImpact,
    geometry: input.geometryBoundary === undefined ? null : {
      boundary: point(input.geometryBoundary),
      selectedEventComDistancePx: observation.selectedEventState === null
        ? null
        : round(distance(input.geometryBoundary, observation.selectedEventState.position)),
      selectedEventCollision: collisionTelemetry,
    },
  };
  const fullAdmission = status === "closed"
    ? observeFullAdmission(input.lines, input.handoff, input.stitchSupport, input.prepared)
    : null;
  return {
    status,
    error: null,
    proposed,
    endpoint,
    fullAdmission,
    elapsedMs: round(performance.now() - started),
    simFrames: getSimFrames() - simBefore,
  };
}

function observeFullAdmission(
  localLines: TrackLine[],
  handoff: LocalHandoff | null,
  stitchSupport: boolean,
  prepared: PreparedTrajectoryFixture,
) {
  const stitched = stitchSupport ? stitchNeutralSupport(localLines, handoff, prepared) : {
    lines: localLines,
    supportLineIds: [] as number[],
  };
  const started = performance.now();
  const simBefore = getSimFrames();
  try {
    const fit = tryCandidateLines(
      prepared.engine,
      prepared.current,
      stitched.lines,
      prepared.lineIdStart,
      prepared.ctx.allContactFrames,
      axisLookaheadEndFrame(prepared.current, prepared.ctx.allContactFrames),
      prepared.current.targets,
      true,
      "normal",
      prepared.probe.preTargetSledTrace,
      { allowRideOutPolish: false },
    ) as Candidate | null;
    return {
      evaluated: true,
      stitchedNeutralSupport: stitchSupport,
      supportLineIds: stitched.supportLineIds,
      accepted: fit !== null,
      candidate: fit === null ? null : summarizeCandidate(fit),
      fullLineHash: sha256(stableJson(stitched.lines)),
      supportEvidence: stitchSupport
        ? "none: neutral support is constructed from pre-impact target-frame prediction and a geometric handoff, not the detector-measured post-impact state"
        : "not applicable: raw-normal proposal supplied its own full fragment",
      contactReattribution: "not measured after support stitching; this is an end-to-end evaluator outcome, not proof that local collision ownership persisted",
      elapsedMs: round(performance.now() - started),
      simFrames: getSimFrames() - simBefore,
    };
  } catch (error) {
    return {
      evaluated: true,
      stitchedNeutralSupport: stitchSupport,
      supportLineIds: stitched.supportLineIds,
      accepted: false,
      candidate: null,
      error: errorMessage(error),
      supportEvidence: stitchSupport
        ? "none: neutral support is constructed from pre-impact target-frame prediction and a geometric handoff, not the detector-measured post-impact state"
        : "not applicable: raw-normal proposal supplied its own full fragment",
      contactReattribution: "not measured after support stitching; this is an end-to-end evaluator outcome, not proof that local collision ownership persisted",
      elapsedMs: round(performance.now() - started),
      simFrames: getSimFrames() - simBefore,
    };
  }
}

function stitchNeutralSupport(
  localLines: TrackLine[],
  handoff: LocalHandoff | null,
  prepared: PreparedTrajectoryFixture,
) {
  if (handoff === null) throw new Error("a direct local primitive must provide a geometric handoff before support stitching");
  // Deliberately legacy/prediction-based containment terrain. It remains only
  // to observe the existing evaluator after a local closure, never as evidence
  // that a post-impact measured-state support formulation works.
  const center = makeTransitionEnvelopeCenter(prepared.frame, prepared.intent);
  const envelope = resolveSupportEnvelope(prepared.intent, prepared.frame.speedPxPerFrame, center);
  const support = realizeSupportPath(
    { point: handoff.point, entryAngleDeg: handoff.tangentDeg },
    envelope,
    prepared.lineIdStart + localLines.length,
    { preserveEntryTangent: true },
  );
  return {
    lines: [...localLines, ...support.lines],
    supportLineIds: support.lines.map((line) => line.id),
  };
}

function localObservationEnd(prepared: PreparedTrajectoryFixture) {
  const requested = prepared.current.endFrame + LOCAL_SURVIVAL_WINDOW_FRAMES;
  const beforeNextContact = prepared.outgoing.endFrame - 1;
  const frame = Math.max(prepared.current.endFrame, Math.min(requested, beforeNextContact));
  return { frame, truncatedByNextContact: frame < requested };
}

/**
 * Read the same impact quantity as the production scorer, but only for the
 * selected owned local landing. This keeps local-contact attribution explicit:
 * an unowned landing cannot accidentally become evidence for the primitive.
 */
function measureOwnedScoredImpact(
  detection: ReturnType<typeof detectWindow>,
  observation: ReturnType<typeof observeOwnedContactTransition>,
  target: number | undefined,
): ScoredImpactOutcome {
  const landing = observation.selectedOwnedEvent;
  const base = {
    metric: "redirArcPxAtLanding -> normImpact" as const,
    windowFrames: IMPACT_WINDOW,
    target: target === undefined ? null : round(target),
    landingFrame: landing?.frame ?? null,
    responseEndFrame: observation.responseEndFrame,
    persistenceWindowComplete: observation.persistenceWindowComplete,
    responseWindowComplete: observation.responseWindowComplete,
  };
  if (target === undefined) {
    return {
      ...base,
      availability: "not_authored",
      redirArcPx: null,
      achieved: null,
      residual: null,
    };
  }
  if (landing === null) {
    return {
      ...base,
      availability: "no_owned_contact",
      redirArcPx: null,
      achieved: null,
      residual: null,
    };
  }
  if (!observation.responseWindowComplete) {
    return {
      ...base,
      availability: "response_unavailable",
      redirArcPx: null,
      achieved: null,
      residual: null,
    };
  }
  const redirArcPx = redirArcPxAtLanding(detection, landing.frame, IMPACT_WINDOW);
  if (redirArcPx === undefined) {
    return {
      ...base,
      availability: "measurement_unavailable",
      redirArcPx: null,
      achieved: null,
      residual: null,
    };
  }
  const achieved = normImpact(redirArcPx);
  return {
    ...base,
    availability: "measured",
    redirArcPx: round(redirArcPx),
    achieved: round(achieved),
    residual: round(achieved - target),
  };
}

function unobservedImpactOutcome(target: number | undefined): ScoredImpactOutcome {
  return {
    availability: target === undefined ? "not_authored" : "not_observed_preclear",
    metric: "redirArcPxAtLanding -> normImpact",
    windowFrames: IMPACT_WINDOW,
    target: target === undefined ? null : round(target),
    landingFrame: null,
    responseEndFrame: null,
    persistenceWindowComplete: null,
    responseWindowComplete: null,
    redirArcPx: null,
    achieved: null,
    residual: null,
  };
}

function summarizeCoverage(records: readonly { local: LocalRecord }[]) {
  const count = (status: LocalStatus) => records.filter((record) => record.local.status === status).length;
  const impactCount = (availability: ScoredImpactAvailability) => records.filter((record) =>
    record.local.endpoint?.scoredImpact.availability === availability,
  ).length;
  const closed = count("closed");
  const fullEvaluated = records.filter((record) => record.local.fullAdmission !== null);
  return {
    attempted: records.length,
    closed,
    preclear: count("preclear"),
    survival: count("survival"),
    landing: count("landing"),
    persistenceUnavailable: count("persistence_unavailable"),
    responseUnavailable: count("response_unavailable"),
    offbeat: count("offbeat"),
    errors: count("error"),
    scoredImpact: {
      measured: impactCount("measured"),
      notAuthored: impactCount("not_authored"),
      notObservedPreclear: impactCount("not_observed_preclear"),
      noOwnedContact: impactCount("no_owned_contact"),
      responseUnavailable: impactCount("response_unavailable"),
      measurementUnavailable: impactCount("measurement_unavailable"),
    },
    fullEvaluated: fullEvaluated.length,
    fullAccepted: fullEvaluated.filter((record) => record.local.fullAdmission?.accepted === true).length,
  };
}

function summarizeTargetFrame(prepared: PreparedTrajectoryFixture) {
  return {
    reference: { x: round(prepared.frame.reference.x), y: round(prepared.frame.reference.y) },
    headingDeg: round(prepared.frame.headingDeg),
    speedPxPerFrame: round(prepared.frame.speedPxPerFrame),
    sledSpanPx: round(prepared.frame.sledSpanPx),
    anchorPoint: prepared.frame.anchorPoint,
    headingSource: prepared.frame.headingSource,
  };
}

function summarizeClosure(closure: RealizedContactClosure) {
  return {
    lineHash: sha256(stableJson(closure.lines)),
    contactPoint: point(closure.contactPoint),
    entryPoint: point(closure.entryPoint),
    handoff: { point: point(closure.handoff.point), tangentDeg: round(closure.handoff.tangentDeg) },
    entryAngleDeg: round(closure.entryAngleDeg),
    postContactAngleDeg: round(closure.postContactAngleDeg),
    preReachPx: round(closure.preReachPx),
    localContinuationPx: round(closure.localContinuationPx),
    lineRoles: closure.lineRoles,
  };
}

function summarizePhaseCarrier(carrier: RealizedContactPhaseCarrier) {
  return {
    lineHash: sha256(stableJson(carrier.lines)),
    contactPoint: point(carrier.contactPoint),
    approachPoint: point(carrier.approachPoint),
    carrierExitPoint: point(carrier.carrierExitPoint),
    handoff: { point: point(carrier.handoff.point), tangentDeg: round(carrier.handoff.tangentDeg) },
    entryAngleDeg: round(carrier.entryAngleDeg),
    tailAngleDeg: round(carrier.tailAngleDeg),
    approachPx: round(carrier.approachPx),
    carrierPx: round(carrier.carrierPx),
    tailPx: round(carrier.tailPx),
    lineRoles: carrier.lineRoles,
  };
}

function summarizeCaptureArc(capture: RealizedContactCaptureArc) {
  return {
    lineHash: sha256(stableJson(capture.lines)),
    capturePoint: point(capture.capturePoint),
    approachPoint: point(capture.approachPoint),
    runwayExitPoint: point(capture.runwayExitPoint),
    handoff: { point: point(capture.handoff.point), tangentDeg: round(capture.handoff.tangentDeg) },
    entryAngleDeg: round(capture.entryAngleDeg),
    exitAngleDeg: round(capture.exitAngleDeg),
    impactTurnDeg: round(capture.impactTurnDeg),
    entryTurnDeg: round(capture.entryTurnDeg),
    remainingTurnDeg: round(capture.remainingTurnDeg),
    responseHorizonFrames: capture.responseHorizonFrames,
    approachPx: round(capture.approachPx),
    runwayPx: round(capture.runwayPx),
    arcExtentPx: round(capture.arcExtentPx),
    arcSegmentCount: capture.arcSegmentCount,
    lineRoles: capture.lineRoles,
  };
}

function summarizeObservation(observation: ReturnType<typeof observeOwnedContactTransition>) {
  return {
    terminus: observation.terminus,
    targetState: summarizeState(observation.targetState),
    selectedOwnedEvent: observation.selectedOwnedEvent,
    selectedEventState: summarizeState(observation.selectedEventState),
    persistenceEndFrame: observation.persistenceEndFrame,
    persistenceEndState: summarizeState(observation.persistenceEndState),
    persistenceWindowComplete: observation.persistenceWindowComplete,
    responseEndFrame: observation.responseEndFrame,
    responseEndState: summarizeState(observation.responseEndState),
    responseWindowComplete: observation.responseWindowComplete,
    closestOwnedEvent: observation.closestOwnedEvent,
    ownedEvents: observation.ownedEvents,
    nearbyEvents: observation.nearbyEvents,
  };
}

function summarizeState(state: ReturnType<typeof observeOwnedContactTransition>["targetState"]) {
  return state === null ? null : {
    frame: state.frame,
    position: point(state.position),
    velocity: point(state.velocity),
    speedPxPerFrame: round(state.speedPxPerFrame),
    airborne: state.airborne,
  };
}

function summarizeCandidate(candidate: Candidate) {
  return {
    cost: round(candidate.cost),
    achieved: roundRecord(candidate.achieved),
    achievedAtEnd: candidate.achievedAtEnd === undefined ? null : roundRecord(candidate.achievedAtEnd),
    finalLineCount: candidate.lines.length,
    finalLineHash: sha256(stableJson(candidate.lines)),
  };
}

function summarizeLines(lines: readonly TrackLine[]) {
  const lengths = lines.map((line) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1));
  return {
    lineCount: lines.length,
    lineHash: sha256(stableJson(lines)),
    totalLengthPx: round(lengths.reduce((sum, value) => sum + value, 0)),
    valid: lines.length > 0 && lines.every((line, index) =>
      Number.isSafeInteger(line.id) &&
      [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite) &&
      lengths[index]! > 1e-9,
    ),
  };
}

function failedLocalRecord(error: unknown) {
  return {
    status: "error" as const,
    error: errorMessage(error),
    proposed: null,
    endpoint: null,
    fullAdmission: null,
    elapsedMs: 0,
    simFrames: 0,
  };
}

function lineRoles(lines: readonly TrackLine[], role: string): Map<number, string> {
  return new Map(lines.map((line) => [line.id, role]));
}

function rawStreamSeed(prepared: PreparedTrajectoryFixture): number {
  return (Math.imul(prepared.panel.seed | 0, 1_000_003) + prepared.current.index + 1) | 0;
}

function roundControl(
  control: ContactClosureControl | ContactPhaseCarrierControl | ContactCaptureArcControl,
): Record<string, number> {
  return roundRecord(control as Record<string, number>);
}

function roundRecord(record: Record<string, number | undefined>): Record<string, number> {
  return Object.fromEntries(Object.entries(record).flatMap(([key, value]) =>
    typeof value === "number" ? [[key, round(value)]] : [],
  ));
}

function point(value: { x: number; y: number }) {
  return { x: round(value.x), y: round(value.y) };
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
