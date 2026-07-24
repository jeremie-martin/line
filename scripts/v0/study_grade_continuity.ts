/**
 * Grade-continuity assay (calibration only, WASM/500k believer fixtures).
 *
 * The campaign's next declared trajectory-synthesis falsifier is deliberately
 * modest: does retaining a shallow post-contact grade across several ordinary
 * contacts physically hold speed through the slow believer clusters where
 * independently sampled grades regress to the mean?  This is not a compiler
 * candidate.  It replays frozen prefixes, admits every proposed line set with
 * the ordinary tryCandidateLines gate, and compares two otherwise-identical
 * streams:
 *
 *   - independent: production normal geometry at every attempt;
 *   - grade-continuous: on a deterministic 25% attempt span, blend only the
 *     post-contact terminal grade toward the previous committed terminal grade;
 *   - energy-continuous: on that same span, retain the contact-side tangent
 *     and solve a distributed tail-work adjustment from a decayed exact
 *     multi-contact speed-deficit state.
 *   - contact-phase-continuous: on that same span, carry the preceding
 *     committed contact anchor's tangent-frame phase into an otherwise
 *     unchanged normal contact-centered line set.
 *   - airborne-phase-continuous: on that same span, shorten only the sampled
 *     post-contact tail when the exact incoming detector phase has accrued
 *     fewer than six airborne frames.
 *   - frenet-curvature-continuous: on that same span, preserve the raw
 *     contact and terminal tangents while carrying the preceding terminal
 *     normal acceleration v²κ into the raw post-curve's interior curvature.
 *
 * The independent arm also records, only after each completed chain, the
 * exact candidate-owned TAIL/NOSE/STRING contact-time pattern.  It is a
 * read-only precondition for a possible distributed timing component.
 *
 * The previous grade is a continuous measured property of the committed line
 * set.  No source, case, duration class, target identity, or outcome feeds the
 * construction.  Candidate choice is the ordinary local exact cost minimum;
 * this assay does not install a ranker, choose a source default, or claim a
 * full-compiler result. The energy stream is deliberately a distinct physical
 * controller, not a second delivery of the retired predecessor-grade law.
 */
import { makeRng } from "../lib/rng.ts";
import { sampleArcPlacementGeometry } from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { axisLookaheadEndFrame, tryCandidateLines } from "./core/candidate.ts";
import { engineLineFromTrackLine, type GapFit } from "./core/substrate.ts";
import { getCandidateProbe, type SpecContext } from "./optimizer/sample.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { authoredSpeedToPx, type Gap, type TrackLine } from "./types.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import { extractPlanningState } from "./trajectory/state.ts";
import {
  prepareStateCoupledTrajectoryFixture,
  type PreparedTrajectoryFixtureCore,
} from "./trajectory/study_context.ts";
import {
  allocateStudyArtifactPath,
  studyArtifactIdentity,
  studySourceIdentity,
  writeImmutableJsonArtifact,
} from "./trajectory/study_artifact.ts";

const SCHEMA = "line.study-trajectory-continuity-controls.v6";
const FIXTURE_DIR = "generated/studies/trajectory-fixtures/grade-continuity-2026-07-17/v3";
const FIXTURES = {
  believer36: "believer36-b500000-d7aec722a976.json",
  believer69: "believer69-b500000-24448183619b.json",
} as const;
type StateId = keyof typeof FIXTURES;
type Family = "independent" | "grade-continuous" | "energy-continuous" | "contact-phase-continuous" | "airborne-phase-continuous" | "frenet-curvature-continuous";

// The physical hypothesis is persistent shallow grades, not a one-off rail.
// Every fourth low-discrepancy attempt receives the correlated terminal grade;
// the other 75% remain byte-for-byte normal proposals.
const CHAIN_CONTACTS = 5;
const CANDIDATES_PER_CONTACT = 24;
const CONTINUITY_SHARE = 0.25;
const TERMINAL_GRADE_BLEND = 0.70;
const SHALLOW_GRADE_FULL_DEG = 8;
const SHALLOW_GRADE_ZERO_DEG = 22;
const SPEED_DEFICIT_START_PX_PER_FRAME = 0.35;
const SPEED_DEFICIT_SPAN_PX_PER_FRAME = 2.0;
/** The controller remembers a physical speed debt across contacts, rather
 * than any preceding terrain heading. A 0.72 decay has a finite roughly
 * three-contact memory and prevents a stale deficit becoming a hidden mode. */
const ENERGY_DEBT_DECAY = 0.72;
const ENERGY_DEBT_FULL_PX_PER_FRAME = 2.0;
/** Maximum requested additional mean downhill work over a tail. This is a
 * distributed energy bias, not a steep launch or a terminal-angle command. */
const ENERGY_WORK_FULL_DEG = 5;
const ENERGY_WORK_SOLVE_DELTA_DEG = 18;
/** A phase is a signed contact-anchor displacement along the incoming tangent,
 * normalized by reference speed. The fixed blend is not a source constant: it
 * is one bounded physical falsifier for whether phase persistence exists. */
const CONTACT_PHASE_BLEND = 0.70;
/** The detector cannot form a distinct landing without this many preceding
 * airborne frames. The controller reads only the current exact phase, never a
 * later contact or its targets. */
const LEGAL_AIRBORNE_FRAMES = 6;
/** At maximum phase shortfall, leave the contact and first outgoing segment
 * untouched, shortening the remaining sampled tail by 35%. */
const AIRBORNE_PHASE_TAIL_MIN_SCALE = 0.65;
const DEFAULT_TRIALS = 24;
const STATE_FRAME_BUDGET = 3_000_000;

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_grade_continuity.ts [--case=believer36|believer69|all] [--trials=N] [--out-dir=DIR]",
    "",
    "Calibration-only trajectory-continuity assay. Requires LR_ENGINE=wasm and",
    "the frozen believer-energy V3 fixtures. It compares ordinary local-cost",
    "chains against predecessor-grade, energy, phase, and Frenet-curvature streams.",
  ].join("\n") + "\n");
  process.exit(0);
}

if (process.env.LR_ENGINE !== "wasm") {
  throw new Error("grade-continuity assay requires LR_ENGINE=wasm");
}
const supported = ["--case=", "--trials=", "--out-dir=", "--help", "-h"];
const unknown = argv.filter((value) => !supported.some((prefix) => value === prefix || value.startsWith(prefix)));
if (unknown.length > 0) throw new Error(`unsupported option(s): ${unknown.join(", ")}`);

const stateIds: readonly StateId[] = ["believer36", "believer69"];
const requestedCase = argument("case") ?? "all";
if (requestedCase !== "all" && !stateIds.includes(requestedCase as StateId)) {
  throw new Error(`unknown --case=${requestedCase}; expected all|${stateIds.join("|")}`);
}
const requestedTrials = argument("trials") ?? `${DEFAULT_TRIALS}`;
const trials = Number(requestedTrials);
if (!Number.isInteger(trials) || trials <= 0 || trials > 256) {
  throw new Error(`--trials must be an integer in [1, 256]; received ${requestedTrials}`);
}
const selected: readonly StateId[] = requestedCase === "all" ? stateIds : [requestedCase as StateId];
const outDir = argument("out-dir") ?? "generated/studies/grade-continuity/v7-frenet-curvature";

const sourceIdentity = studySourceIdentity("scripts/v0/study_grade_continuity.ts");
const observationCompiler = compilerCandidateIdentity("wasm");
const protocolFingerprint = sha256(stableJson({
  protocol: "grade-energy-contact-airborne-frenet-and-timing-observation.v6",
  captureBudget: 500_000,
  stream: {
    baseline: "sampleArcPlacementGeometry(normal)",
    correlated: "on deterministic low-discrepancy 25% attempt span, blend terminal post grade toward previous committed terminal grade",
    normalCandidatesPreserved: true,
    selection: "minimum ordinary exact GapFit.cost at each contact",
  },
  constants: {
    chainContacts: CHAIN_CONTACTS,
    candidatesPerContact: CANDIDATES_PER_CONTACT,
    continuityShare: CONTINUITY_SHARE,
    terminalGradeBlend: TERMINAL_GRADE_BLEND,
    shallowGradeFullDeg: SHALLOW_GRADE_FULL_DEG,
    shallowGradeZeroDeg: SHALLOW_GRADE_ZERO_DEG,
    speedDeficitStartPxPerFrame: SPEED_DEFICIT_START_PX_PER_FRAME,
    speedDeficitSpanPxPerFrame: SPEED_DEFICIT_SPAN_PX_PER_FRAME,
    energyDebtDecay: ENERGY_DEBT_DECAY,
    energyDebtFullPxPerFrame: ENERGY_DEBT_FULL_PX_PER_FRAME,
    energyWorkFullDeg: ENERGY_WORK_FULL_DEG,
    energyWorkSolveDeltaDeg: ENERGY_WORK_SOLVE_DELTA_DEG,
    contactPhaseBlend: CONTACT_PHASE_BLEND,
    legalAirborneFrames: LEGAL_AIRBORNE_FRAMES,
    airbornePhaseTailMinScale: AIRBORNE_PHASE_TAIL_MIN_SCALE,
    frenetRule: "target terminal curvature = preceding committed v²κ divided by current measured entry speed squared; a sine interior tangent packet preserves contact and terminal tangents",
    timingObservation: "after independent chains finish, reconstruct candidate-owned TAIL/NOSE/STRING collision offsets over H-1..H+6; timing is never an input to construction or choice",
    trials,
    stateFrameBudget: STATE_FRAME_BUDGET,
  },
}));

type CandidateRow = {
  attempt: number;
  transformed: boolean;
  previousGradeDeg: number | null;
  rawTerminalGradeDeg: number | null;
  proposedTerminalGradeDeg: number | null;
  controllerDebt: number | null;
  rawMeanWorkGradeDeg: number | null;
  proposedMeanWorkGradeDeg: number | null;
  previousContactPhaseFrames: number | null;
  rawContactPhaseFrames: number | null;
  proposedContactPhaseFrames: number | null;
  incomingAirborneAgeFrames: number | null;
  airbornePhasePressure: number | null;
  rawPostTailLengthPx: number | null;
  proposedPostTailLengthPx: number | null;
  previousNormalAcceleration: number | null;
  rawTerminalCurvatureRadPerPx: number | null;
  proposedTerminalCurvatureRadPerPx: number | null;
  admitted: boolean;
  cost: number | null;
  simFrames: number;
};

type ContactStep = {
  gapIndex: number;
  authored: { speed: number | null; air: number | null; impact: number | null };
  entry: { speed: number; angleDeg: number };
  carriedEnergyDebt: number | null;
  contactPhaseFrames: number | null;
  incomingAirborneAgeFrames: number | null;
  carriedNormalAcceleration: number | null;
  sledContactTiming: SledContactTiming | null;
  candidates: CandidateRow[];
  chosen: {
    attempt: number;
    transformed: boolean;
    cost: number;
    terminalGradeDeg: number;
    achieved: { speed: number | null; air: number | null; impact: number | null };
  } | null;
  result: "committed" | "no-admitted-candidate" | "missing-contact";
};

type SledContactTiming = {
  window: { startOffset: number; endOffset: number };
  firstOffset: Partial<Record<"TAIL" | "NOSE" | "STRING", number>>;
  lastOffset: Partial<Record<"TAIL" | "NOSE" | "STRING", number>>;
  updates: Partial<Record<"TAIL" | "NOSE" | "STRING", number>>;
};

type Trial = {
  family: Family;
  trial: number;
  completedContacts: number;
  chargedFrames: number;
  steps: ContactStep[];
  terminal: {
    speed: number | null;
    velocityAngleDeg: number | null;
    meanAchievedSpeed: number | null;
    meanTerminalGradeDeg: number | null;
  };
};

type FamilySummary = {
  trials: number;
  completeChains: number;
  meanCompletedContacts: number;
  terminalSpeed: Summary;
  meanAchievedSpeed: Summary;
  meanTerminalGradeDeg: Summary;
  transformedChosen: number;
  transformedAdmitted: number;
};

type TimingSummary = {
  trials: number;
  committedSteps: number;
  readableSteps: number;
  distinctFirstPatterns: number;
  firstPatternCounts: Record<string, number>;
  successivePairs: number;
  exactPatternPairs: number;
  sameActiveSetPairs: number;
  sharedPointComparisons: number;
  meanSharedPointFirstOffsetDelta: number | null;
};

type Summary = { count: number; mean: number | null; median: number | null; min: number | null; max: number | null };

let totalFrames = 0;
const started = performance.now();
const results = selected.map((id) => runState(id));
for (const result of results) {
  const independent = result.summary.families.independent;
  const grade = result.summary.families["grade-continuous"];
  const energy = result.summary.families["energy-continuous"];
  const phase = result.summary.families["contact-phase-continuous"];
  const airborne = result.summary.families["airborne-phase-continuous"];
  const frenet = result.summary.families["frenet-curvature-continuous"];
  const gradeDelta = difference(grade.terminalSpeed.mean, independent.terminalSpeed.mean);
  const energyDelta = difference(energy.terminalSpeed.mean, independent.terminalSpeed.mean);
  const phaseDelta = difference(phase.terminalSpeed.mean, independent.terminalSpeed.mean);
  const airborneDelta = difference(airborne.terminalSpeed.mean, independent.terminalSpeed.mean);
  const frenetDelta = difference(frenet.terminalSpeed.mean, independent.terminalSpeed.mean);
  process.stdout.write(
    `${result.id}: grade complete ${grade.completeChains}/${grade.trials} speed Δ${signed(gradeDelta)}; ` +
    `energy complete ${energy.completeChains}/${energy.trials} speed Δ${signed(energyDelta)} ` +
    `phase complete ${phase.completeChains}/${phase.trials} speed Δ${signed(phaseDelta)} ` +
    `airborne complete ${airborne.completeChains}/${airborne.trials} speed Δ${signed(airborneDelta)} ` +
    `frenet complete ${frenet.completeChains}/${frenet.trials} speed Δ${signed(frenetDelta)} ` +
    `vs independent ${independent.completeChains}/${independent.trials}; phase chosen ${phase.transformedChosen}; airborne chosen ${airborne.transformedChosen}; frenet chosen ${frenet.transformedChosen}; ` +
    `frames ${result.chargedFrames}\n`,
  );
}
process.stdout.write(`grade continuity: ${results.length} state(s), ${Math.round(performance.now() - started)}ms; charged frames ${totalFrames}\n`);

function runState(id: StateId): { id: StateId; artifactPath: string; summary: { families: Record<Family, FamilySummary>; comparison: Record<string, number | null>; timing: TimingSummary }; chargedFrames: number } {
  const fixturePath = `${FIXTURE_DIR}/${FIXTURES[id]}`;
  const fixture = readFrozenTrajectoryFixture(fixturePath);
  const prepared = prepareStateCoupledTrajectoryFixture(fixture);
  if (prepared.panel.cohort !== "calibration") throw new Error(`${id} is not a calibration fixture`);

  let chargedFrames = 0;
  const charge = (frames: number): void => {
    chargedFrames += frames;
    totalFrames += frames;
  };
  const rows: Trial[] = [];
  for (let trial = 0; trial < trials; trial++) {
    if (chargedFrames >= STATE_FRAME_BUDGET) break;
    const prefixTerminalGradeDeg = prefixTerminalGrade(fixture);
    rows.push(runTrial(prepared, "independent", trial, charge, prefixTerminalGradeDeg));
    if (chargedFrames >= STATE_FRAME_BUDGET) break;
    rows.push(runTrial(prepared, "grade-continuous", trial, charge, prefixTerminalGradeDeg));
    if (chargedFrames >= STATE_FRAME_BUDGET) break;
    rows.push(runTrial(prepared, "energy-continuous", trial, charge, prefixTerminalGradeDeg));
    if (chargedFrames >= STATE_FRAME_BUDGET) break;
    rows.push(runTrial(prepared, "contact-phase-continuous", trial, charge, prefixTerminalGradeDeg));
    if (chargedFrames >= STATE_FRAME_BUDGET) break;
    rows.push(runTrial(prepared, "airborne-phase-continuous", trial, charge, prefixTerminalGradeDeg));
    if (chargedFrames >= STATE_FRAME_BUDGET) break;
    rows.push(runTrial(prepared, "frenet-curvature-continuous", trial, charge, prefixTerminalGradeDeg));
  }
  const families: Record<Family, FamilySummary> = {
    independent: summarize(rows.filter((row) => row.family === "independent")),
    "grade-continuous": summarize(rows.filter((row) => row.family === "grade-continuous")),
    "energy-continuous": summarize(rows.filter((row) => row.family === "energy-continuous")),
    "contact-phase-continuous": summarize(rows.filter((row) => row.family === "contact-phase-continuous")),
    "airborne-phase-continuous": summarize(rows.filter((row) => row.family === "airborne-phase-continuous")),
    "frenet-curvature-continuous": summarize(rows.filter((row) => row.family === "frenet-curvature-continuous")),
  };
  const comparison = {
    terminalSpeedMeanDelta: difference(families["grade-continuous"].terminalSpeed.mean, families.independent.terminalSpeed.mean),
    meanAchievedSpeedDelta: difference(families["grade-continuous"].meanAchievedSpeed.mean, families.independent.meanAchievedSpeed.mean),
    completeChainDelta: families["grade-continuous"].completeChains - families.independent.completeChains,
    energyTerminalSpeedMeanDelta: difference(families["energy-continuous"].terminalSpeed.mean, families.independent.terminalSpeed.mean),
    energyMeanAchievedSpeedDelta: difference(families["energy-continuous"].meanAchievedSpeed.mean, families.independent.meanAchievedSpeed.mean),
    energyCompleteChainDelta: families["energy-continuous"].completeChains - families.independent.completeChains,
    phaseTerminalSpeedMeanDelta: difference(families["contact-phase-continuous"].terminalSpeed.mean, families.independent.terminalSpeed.mean),
    phaseMeanAchievedSpeedDelta: difference(families["contact-phase-continuous"].meanAchievedSpeed.mean, families.independent.meanAchievedSpeed.mean),
    phaseCompleteChainDelta: families["contact-phase-continuous"].completeChains - families.independent.completeChains,
    airbornePhaseTerminalSpeedMeanDelta: difference(families["airborne-phase-continuous"].terminalSpeed.mean, families.independent.terminalSpeed.mean),
    airbornePhaseMeanAchievedSpeedDelta: difference(families["airborne-phase-continuous"].meanAchievedSpeed.mean, families.independent.meanAchievedSpeed.mean),
    airbornePhaseCompleteChainDelta: families["airborne-phase-continuous"].completeChains - families.independent.completeChains,
    frenetCurvatureTerminalSpeedMeanDelta: difference(families["frenet-curvature-continuous"].terminalSpeed.mean, families.independent.terminalSpeed.mean),
    frenetCurvatureMeanAchievedSpeedDelta: difference(families["frenet-curvature-continuous"].meanAchievedSpeed.mean, families.independent.meanAchievedSpeed.mean),
    frenetCurvatureCompleteChainDelta: families["frenet-curvature-continuous"].completeChains - families.independent.completeChains,
  };
  const timing = summarizeTiming(rows.filter((row) => row.family === "independent"));
  const artifactIdentity = studyArtifactIdentity({
    schema: SCHEMA,
    fixtureFingerprint: fixture.fixtureFingerprint,
    studySourceFingerprint: sourceIdentity.studySourceFingerprint,
    observationCandidateFingerprint: observationCompiler.candidateFingerprint,
    protocolFingerprint,
  });
  const artifact = {
    schema: SCHEMA,
    artifactIdentity,
    purpose: "Fixture-only falsifier for predecessor-grade, cumulative kinetic-energy, contact-phase, incoming-airborne-phase, and Frenet-curvature trajectory controls, plus a read-only independent-chain distributed contact-timing observation. Every candidate remains subject to the ordinary exact admission gate; the Frenet stream changes only a deterministic post-contact interior tangent packet while preserving the sampled contact and terminal tangents.",
    status: {
      productionIntegration: "forbidden: calibration study only; it does not modify compiler candidates, selection, or promotion",
      resultEligibility: "physical/executable evidence only; a source-default lane requires its own scope panel and normal V2 funnel",
    },
    argv: [...argv],
    elapsedMs: Math.round(performance.now() - started),
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
    protocol: {
      chainContacts: CHAIN_CONTACTS,
      candidatesPerContact: CANDIDATES_PER_CONTACT,
      selection: "ordinary GapFit.cost minimum; stable attempt order resolves ties",
      correlatedAttemptRule: "lowDiscrepancyRoll(attempt, 41) >= 0.75; independent stream never transforms",
      gradeRule: "terminal post grade blends toward the prior committed terminal line grade only while that prior grade is shallow and the authored speed exceeds measured entry speed; capture-side geometry through the contact vertex is byte-preserved",
      energyRule: "a decayed per-contact exact speed-deficit integral requests a bounded distributed mean-tail-work adjustment; it preserves the contact anchor, every segment length, and the first post-contact tangent, and reads no preceding terrain heading",
      contactPhaseRule: "the preceding committed contact anchor's signed displacement from its predicted sled point, in current-reference-speed frames, blends with the raw contact anchor; the complete normal line set translates only along the current incoming tangent and no missing phase becomes a synthetic anchor",
      airbornePhaseRule: "when exact PlanningState.phase.airborneAgeFrames is below six, the deterministic attempt span preserves every line through the first post-contact segment and shortens only later sampled tail segments by a smooth 1.0-to-0.65 scale; it reads no later contact, axis, source, duration, or outcome",
      frenetCurvatureRule: "the preceding chosen post-curve's terminal normal acceleration v²κ is divided by the current measured entry speed squared to target current terminal curvature. A sine tangent packet changes post-contact interior headings only, preserving each segment length, the capture-side/contact tangent, and the terminal tangent; it reads no source, target identity, duration, axis, or outcome",
      timingObservation: "after an independent chain's terminal state and charge are final, a separate immutable reconstruction reads candidate-owned TAIL/NOSE/STRING collision offsets over H-1..H+6; it is not available to any candidate family, gate, or selection",
      admission: "unchanged tryCandidateLines with exact survival, landing, off-beat, and target-axis gates",
      sourceInputs: "grade stream: previous committed terminal grade plus authored speed deficit; energy stream: exact measured speed-deficit integral; contact-phase stream: previous committed contact-anchor phase plus current incoming tangent/reference speed; airborne-phase stream: current exact airborne age only; Frenet stream: preceding chosen terminal v²κ plus current measured entry speed; all streams use existing sampled geometry and attempt coordinate only, and none reads source, case, duration class, or outcomes",
    },
    chargedFrames,
    budgetExhausted: chargedFrames >= STATE_FRAME_BUDGET,
    summary: { families, comparison, timing },
    rows,
  };
  const artifactPath = allocateStudyArtifactPath(`${outDir}/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}.json`);
  writeImmutableJsonArtifact(artifactPath, artifact, "grade-continuity artifact");
  return { id, artifactPath, summary: { families, comparison, timing }, chargedFrames };
}

function runTrial(
  prepared: PreparedTrajectoryFixtureCore,
  family: Family,
  trial: number,
  charge: (frames: number) => void,
  initialPreviousGrade: number | null,
): Trial {
  let engine = prepared.engine;
  let lineIdStart = prepared.lineIdStart;
  // The first studied gap also has a committed predecessor: the frozen prefix
  // retains its exact chosen line set.  Starting at null would silently turn
  // the mechanism off precisely at the slow-episode onset.
  let previousGrade: number | null = initialPreviousGrade;
  // Unlike the retired grade stream, this state contains no prior terrain
  // property. It is only a bounded integral of exact entry-speed deficit.
  let carriedEnergyDebt = 0;
  let previousContactPhaseFrames: number | null = null;
  let previousNormalAcceleration: number | null = null;
  const steps: ContactStep[] = [];
  const committedForTiming: Array<{ step: ContactStep; gap: Gap; lines: readonly TrackLine[] }> = [];

  for (let offset = 0; offset < CHAIN_CONTACTS; offset++) {
    const gap = prepared.setup.gaps[prepared.current.index + offset];
    if (gap === undefined || !gap.endsWithContact) {
      steps.push({
        gapIndex: prepared.current.index + offset,
        authored: { speed: null, air: null, impact: null },
        entry: { speed: 0, angleDeg: 0 }, carriedEnergyDebt: null, contactPhaseFrames: null, incomingAirborneAgeFrames: null, carriedNormalAcceleration: null, sledContactTiming: null, candidates: [], chosen: null, result: "missing-contact",
      });
      break;
    }
    const probe = getCandidateProbe(engine, gap, prepared.ctx);
    const incomingState = extractPlanningState(engine, gap.endFrame);
    const incomingAirborneAgeFrames = incomingState?.phase.airborneAgeFrames ?? null;
    const contactAnchor = { x: probe.targetState.sledX, y: probe.targetState.sledY };
    const rng = makeRng((Math.imul((trial + 1) | 0, 1000003) + gap.index + 1) | 0);
    const axisEnd = axisLookaheadEndFrame(gap, prepared.ctx.allContactFrames);
    const candidates: CandidateRow[] = [];
    let chosen: { fit: GapFit; attempt: number; transformed: boolean; terminalGradeDeg: number; contactPhaseFrames: number | null } | null = null;
    const instantaneousEnergyDebt = gap.targets.speed === undefined
      ? 0
      : clamp(
        (authoredSpeedToPx(gap.targets.speed) - probe.targetState.speed) / ENERGY_DEBT_FULL_PX_PER_FRAME,
        0,
        1,
      );
    const controllerDebt = clamp(
      ENERGY_DEBT_DECAY * carriedEnergyDebt + (1 - ENERGY_DEBT_DECAY) * instantaneousEnergyDebt,
      0,
      1,
    );

    for (let attempt = 0; attempt < CANDIDATES_PER_CONTACT; attempt++) {
      const geometry = sampleArcPlacementGeometry(
        rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap, lineIdStart, "normal",
        prepared.ctx.allContactFrames,
      );
      const rawTerminalGradeDeg = terminalGrade(geometry.lines);
      const rawMeanWorkGradeDeg = tailMeanWorkGrade(geometry.lines, contactAnchor);
      const rawContactPhaseFrames = contactPhaseFrames(
        geometry.lines, contactAnchor, probe.targetState.speed, probe.targetState.angleDeg,
      );
      const rawTerminalCurvatureRadPerPx = terminalCurvature(geometry.lines, contactAnchor);
      const speedDeficit = gap.targets.speed === undefined
        ? 0
        : smoothstep((authoredSpeedToPx(gap.targets.speed) - probe.targetState.speed - SPEED_DEFICIT_START_PX_PER_FRAME) /
          SPEED_DEFICIT_SPAN_PX_PER_FRAME);
      const span = isContinuityAttempt(attempt);
      const gradeTransformed = family === "grade-continuous" && previousGrade !== null && speedDeficit > 0 && span;
      const energyTransformed = family === "energy-continuous" && controllerDebt > 0 && span;
      const phaseTransformed = family === "contact-phase-continuous" && previousContactPhaseFrames !== null && span;
      const airbornePhasePressure = incomingAirbornePhasePressure(incomingAirborneAgeFrames);
      const airbornePhaseTransformed = family === "airborne-phase-continuous" && airbornePhasePressure > 0 && span;
      const frenetTransformed = family === "frenet-curvature-continuous" && previousNormalAcceleration !== null && probe.targetState.speed > 1e-9 && span;
      const transformed = gradeTransformed || energyTransformed || phaseTransformed || airbornePhaseTransformed || frenetTransformed;
      const lines = gradeTransformed
        ? correlateTerminalGrade(geometry.lines, contactAnchor, previousGrade!, speedDeficit)
        : energyTransformed
        ? correlateTailWork(geometry.lines, contactAnchor, controllerDebt)
        : phaseTransformed
        ? correlateContactPhase(
          geometry.lines, contactAnchor, probe.targetState.speed, probe.targetState.angleDeg,
          previousContactPhaseFrames!,
        )
        : airbornePhaseTransformed
        ? correlateAirbornePhaseTail(geometry.lines, contactAnchor, airbornePhasePressure)
        : frenetTransformed
        ? correlateFrenetCurvature(geometry.lines, contactAnchor, previousNormalAcceleration!, probe.targetState.speed)
        : geometry.lines;
      const proposedTerminalGradeDeg = terminalGrade(lines);
      const proposedMeanWorkGradeDeg = tailMeanWorkGrade(lines, contactAnchor);
      const proposedContactPhaseFrames = contactPhaseFrames(
        lines, contactAnchor, probe.targetState.speed, probe.targetState.angleDeg,
      );
      const rawPostTailLengthPx = postTailLength(geometry.lines, contactAnchor);
      const proposedPostTailLengthPx = postTailLength(lines, contactAnchor);
      const proposedTerminalCurvatureRadPerPx = terminalCurvature(lines, contactAnchor);
      const before = getSimFrames();
      const fit = tryCandidateLines(
        engine, gap, lines, lineIdStart, prepared.ctx.allContactFrames, axisEnd,
        gap.targets, true, undefined, probe.preTargetSledTrace,
      ) as GapFit | null;
      const frames = getSimFrames() - before;
      charge(frames);
      candidates.push({
        attempt, transformed, previousGradeDeg: previousGrade, rawTerminalGradeDeg,
        proposedTerminalGradeDeg,
        controllerDebt: family === "energy-continuous" ? round(controllerDebt) : null,
        rawMeanWorkGradeDeg,
        proposedMeanWorkGradeDeg,
        previousContactPhaseFrames: family === "contact-phase-continuous" ? previousContactPhaseFrames : null,
        rawContactPhaseFrames,
        proposedContactPhaseFrames,
        incomingAirborneAgeFrames,
        airbornePhasePressure: family === "airborne-phase-continuous" ? round(airbornePhasePressure) : null,
        rawPostTailLengthPx,
        proposedPostTailLengthPx,
        previousNormalAcceleration: family === "frenet-curvature-continuous" && previousNormalAcceleration !== null ? round(previousNormalAcceleration) : null,
        rawTerminalCurvatureRadPerPx: rawTerminalCurvatureRadPerPx === null ? null : round(rawTerminalCurvatureRadPerPx),
        proposedTerminalCurvatureRadPerPx: proposedTerminalCurvatureRadPerPx === null ? null : round(proposedTerminalCurvatureRadPerPx),
        admitted: fit !== null, cost: fit === null ? null : round(fit.cost), simFrames: frames,
      });
      if (fit !== null && (chosen === null || fit.cost < chosen.fit.cost)) {
        chosen = {
          fit, attempt, transformed, terminalGradeDeg: proposedTerminalGradeDeg ?? 0,
          contactPhaseFrames: proposedContactPhaseFrames,
        };
      }
    }

    const authored = {
      speed: gap.targets.speed ?? null,
      air: gap.targets.air ?? null,
      impact: gap.targets.impact ?? null,
    };
    if (chosen === null) {
      steps.push({ gapIndex: gap.index, authored, entry: { speed: round(probe.targetState.speed), angleDeg: round(probe.targetState.angleDeg) }, carriedEnergyDebt: family === "energy-continuous" ? round(controllerDebt) : null, contactPhaseFrames: family === "contact-phase-continuous" ? previousContactPhaseFrames : null, incomingAirborneAgeFrames, carriedNormalAcceleration: family === "frenet-curvature-continuous" && previousNormalAcceleration !== null ? round(previousNormalAcceleration) : null, sledContactTiming: null, candidates, chosen: null, result: "no-admitted-candidate" });
      break;
    }
    const achieved = chosen.fit.achieved;
    steps.push({
      gapIndex: gap.index,
      authored,
      entry: { speed: round(probe.targetState.speed), angleDeg: round(probe.targetState.angleDeg) },
      carriedEnergyDebt: family === "energy-continuous" ? round(controllerDebt) : null,
      contactPhaseFrames: family === "contact-phase-continuous" ? chosen.contactPhaseFrames : null,
      incomingAirborneAgeFrames,
      carriedNormalAcceleration: family === "frenet-curvature-continuous" && previousNormalAcceleration !== null ? round(previousNormalAcceleration) : null,
      sledContactTiming: null,
      candidates,
      chosen: {
        attempt: chosen.attempt,
        transformed: chosen.transformed,
        cost: round(chosen.fit.cost),
        terminalGradeDeg: round(chosen.terminalGradeDeg),
        achieved: { speed: achieved.speed ?? null, air: achieved.air ?? null, impact: achieved.impact ?? null },
      },
      result: "committed",
    });
    committedForTiming.push({ step: steps.at(-1)!, gap, lines: chosen.fit.lines });
    engine = engine.addLine(chosen.fit.lines.map((line) => engineLineFromTrackLine(line)));
    lineIdStart += chosen.fit.lines.length;
    previousGrade = chosen.terminalGradeDeg;
    carriedEnergyDebt = controllerDebt;
    previousContactPhaseFrames = chosen.contactPhaseFrames;
    const committedCurvature = terminalCurvature(chosen.fit.lines, contactAnchor);
    previousNormalAcceleration = committedCurvature === null || achieved.speed === undefined || achieved.speed === null
      ? null
      : committedCurvature * achieved.speed * achieved.speed;
  }

  // Collision traces are read on an independent reconstruction only after the
  // chain's gates, choice, terminal state, and frame charge are final. They
  // cannot affect live traversal, admission, or selection.
  if (family === "independent") {
    let timingEngine = prepared.engine;
    for (const committedStep of committedForTiming) {
      timingEngine = timingEngine.addLine(committedStep.lines.map((line) => engineLineFromTrackLine(line)));
      committedStep.step.sledContactTiming = observeSledContactTiming(timingEngine, committedStep.lines, committedStep.gap);
    }
  }

  const committed = steps.filter((step) => step.result === "committed");
  const last = committed.at(-1);
  const terminalGap = last === undefined ? null : prepared.setup.gaps[last.gapIndex + 1];
  const terminalProbe = terminalGap === null || terminalGap === undefined
    ? null
    : getCandidateProbe(engine, terminalGap, prepared.ctx).targetState;
  const chosenSpeeds = committed
    .map((step) => step.chosen?.achieved.speed)
    .filter((value): value is number => value !== null && value !== undefined);
  const grades = committed
    .map((step) => step.chosen?.terminalGradeDeg)
    .filter((value): value is number => value !== null && value !== undefined);
  const chargedFrames = steps.flatMap((step) => step.candidates).reduce((sum, candidate) => sum + candidate.simFrames, 0);
  return {
    family, trial, completedContacts: committed.length, chargedFrames, steps,
    terminal: {
      speed: terminalProbe === null ? null : round(terminalProbe.speed),
      velocityAngleDeg: terminalProbe === null ? null : round(terminalProbe.angleDeg),
      meanAchievedSpeed: mean(chosenSpeeds),
      meanTerminalGradeDeg: mean(grades),
    },
  };
}

/** A deterministic 25% attempt span, equivalent in role to the normal sampler's
 * low-discrepancy attempt lanes. */
function isContinuityAttempt(attempt: number): boolean {
  return lowDiscrepancyRoll(attempt, 41) >= 1 - CONTINUITY_SHARE;
}

function lowDiscrepancyRoll(attempt: number, salt: number): number {
  const stride = 0.6180339887498949;
  const offset = (salt + 1) * 0.137503523749935;
  const raw = (Math.max(0, attempt) + 1) * stride + offset;
  return raw - Math.floor(raw);
}

/**
 * Preserve every pre-contact/capture-side segment and re-realize only the
 * terminal post profile.  The target terminal heading is a continuous blend of
 * the sampled terminal heading and the previous committed heading.  A shallow
 * gate prevents a steep prior release from becoming a hidden rescue lane.
 */
function correlateTerminalGrade(
  lines: readonly TrackLine[],
  contactAnchor: { x: number; y: number },
  previousGradeDeg: number,
  speedDeficitPressure: number,
): TrackLine[] {
  const vertices = polylineVertices(lines);
  if (vertices.length < 3) return [...lines];
  let contact = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const distance = Math.hypot(vertices[i].x - contactAnchor.x, vertices[i].y - contactAnchor.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      contact = i;
    }
  }
  const postSegments = vertices.length - 1 - contact;
  if (postSegments < 2) return [...lines];
  const rawTerminal = heading(vertices.at(-2)!, vertices.at(-1)!);
  const shallow = 1 - smoothstep((Math.abs(previousGradeDeg) - SHALLOW_GRADE_FULL_DEG) /
    (SHALLOW_GRADE_ZERO_DEG - SHALLOW_GRADE_FULL_DEG));
  const terminal = lerpAngle(
    rawTerminal, previousGradeDeg, TERMINAL_GRADE_BLEND * shallow * clamp(speedDeficitPressure, 0, 1),
  );
  const rebuilt = vertices.slice(0, contact + 1).map((point) => ({ ...point }));
  let point = { ...vertices[contact] };
  for (let index = 1; index <= postSegments; index++) {
    const from = vertices[contact + index - 1];
    const to = vertices[contact + index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const rawHeading = heading(from, to);
    // Preserve the contact side exactly; the terminal release direction carries
    // the correlated component, fading in continuously across the post profile.
    const progress = index / postSegments;
    const angle = lerpAngle(rawHeading, terminal, progress * progress);
    const radians = angle * Math.PI / 180;
    point = { x: point.x + Math.cos(radians) * length, y: point.y + Math.sin(radians) * length };
    rebuilt.push(point);
  }
  return rebuilt.slice(1).map((end, index) => ({
    ...lines[index],
    x1: rebuilt[index].x,
    y1: rebuilt[index].y,
    x2: end.x,
    y2: end.y,
  }));
}

/**
 * A separate multi-contact energy control. It does not observe or reuse a
 * preceding line angle: a bounded accumulated speed debt requests only a
 * small increase in the tail's *mean* downhill work. The first post-contact
 * tangent is invariant, so contact-side geometry is retained. Segment lengths
 * are invariant too; a single smooth curvature amplitude is solved by exact
 * arithmetic before the ordinary engine admission is consulted.
 */
function correlateTailWork(
  lines: readonly TrackLine[],
  contactAnchor: { x: number; y: number },
  debt: number,
): TrackLine[] {
  const vertices = polylineVertices(lines);
  if (vertices.length < 3) return [...lines];
  const contact = closestVertex(vertices, contactAnchor);
  const postSegments = vertices.length - 1 - contact;
  if (postSegments < 2) return [...lines];
  const rawGrade = meanGradeFromVertices(vertices, contact);
  if (rawGrade === null) return [...lines];
  const targetGrade = clamp(rawGrade + ENERGY_WORK_FULL_DEG * clamp(debt, 0, 1), -35, 35);
  const rawHeadings = Array.from({ length: postSegments }, (_, index) =>
    heading(vertices[contact + index]!, vertices[contact + index + 1]!),
  );
  const lengths = Array.from({ length: postSegments }, (_, index) => {
    const from = vertices[contact + index]!;
    const to = vertices[contact + index + 1]!;
    return Math.hypot(to.x - from.x, to.y - from.y);
  });
  // Mean grade is monotone over the deliberately small solve band for this
  // fixed, non-negative curvature field. If a pathological tail violates that
  // local condition, leave it normal rather than inventing a discontinuity.
  const realize = (amplitude: number) => {
    const rebuilt = vertices.slice(0, contact + 1).map((point) => ({ ...point }));
    let point = { ...vertices[contact]! };
    for (let index = 0; index < postSegments; index++) {
      const progress = index / (postSegments - 1);
      const angle = rawHeadings[index]! + amplitude * progress * progress;
      const radians = angle * Math.PI / 180;
      point = {
        x: point.x + Math.cos(radians) * lengths[index]!,
        y: point.y + Math.sin(radians) * lengths[index]!,
      };
      rebuilt.push(point);
    }
    return rebuilt;
  };
  const loGrade = meanGradeFromVertices(realize(-ENERGY_WORK_SOLVE_DELTA_DEG), contact);
  const hiGrade = meanGradeFromVertices(realize(ENERGY_WORK_SOLVE_DELTA_DEG), contact);
  if (loGrade === null || hiGrade === null || !(loGrade <= targetGrade && targetGrade <= hiGrade)) {
    return [...lines];
  }
  let lo = -ENERGY_WORK_SOLVE_DELTA_DEG;
  let hi = ENERGY_WORK_SOLVE_DELTA_DEG;
  for (let iteration = 0; iteration < 20; iteration++) {
    const mid = (lo + hi) / 2;
    const grade = meanGradeFromVertices(realize(mid), contact);
    if (grade === null) return [...lines];
    if (grade < targetGrade) lo = mid;
    else hi = mid;
  }
  const rebuilt = realize((lo + hi) / 2);
  return rebuilt.slice(1).map((end, index) => ({
    ...lines[index]!,
    x1: rebuilt[index]!.x,
    y1: rebuilt[index]!.y,
    x2: end.x,
    y2: end.y,
  }));
}

function tailMeanWorkGrade(
  lines: readonly TrackLine[],
  contactAnchor: { x: number; y: number },
): number | null {
  const vertices = polylineVertices(lines);
  if (vertices.length < 2) return null;
  return meanGradeFromVertices(vertices, closestVertex(vertices, contactAnchor));
}

function closestVertex(vertices: readonly { x: number; y: number }[], anchor: { x: number; y: number }): number {
  let result = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < vertices.length; index++) {
    const point = vertices[index]!;
    const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      result = index;
    }
  }
  return result;
}

function meanGradeFromVertices(vertices: readonly { x: number; y: number }[], contact: number): number | null {
  const start = vertices[contact];
  const end = vertices.at(-1);
  if (start === undefined || end === undefined || start === end) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.hypot(dx, dy) <= 1e-9) return null;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

/** Signed contact-anchor phase in reference-speed frames. The nearest vertex
 * is the normal sampler's contact center; the tangent is the exact incoming
 * target-state velocity direction, never a case/duration coordinate. */
function contactPhaseFrames(
  lines: readonly TrackLine[],
  contactAnchor: { x: number; y: number },
  speed: number,
  angleDeg: number,
): number | null {
  if (!(speed > 1e-9) || !Number.isFinite(angleDeg)) return null;
  const vertices = polylineVertices(lines);
  if (vertices.length === 0) return null;
  const contact = vertices[closestVertex(vertices, contactAnchor)];
  if (contact === undefined) return null;
  const radians = angleDeg * Math.PI / 180;
  return ((contact.x - contactAnchor.x) * Math.cos(radians) +
    (contact.y - contactAnchor.y) * Math.sin(radians)) / speed;
}

/** Preserve the entire sampled normal shape and collision-side encoding while
 * moving its contact center along the current incoming tangent. This is the
 * exact geometric analogue of constructing the contact point at a persistent
 * phase; normal admission decides whether the translated fragment is usable. */
function correlateContactPhase(
  lines: readonly TrackLine[],
  contactAnchor: { x: number; y: number },
  speed: number,
  angleDeg: number,
  previousPhaseFrames: number,
): TrackLine[] {
  const rawPhase = contactPhaseFrames(lines, contactAnchor, speed, angleDeg);
  if (rawPhase === null || !Number.isFinite(previousPhaseFrames)) return [...lines];
  const phase = rawPhase + (previousPhaseFrames - rawPhase) * CONTACT_PHASE_BLEND;
  const shift = (phase - rawPhase) * speed;
  const radians = angleDeg * Math.PI / 180;
  const dx = Math.cos(radians) * shift;
  const dy = Math.sin(radians) * shift;
  return lines.map((line) => ({
    ...line,
    x1: line.x1 + dx,
    y1: line.y1 + dy,
    x2: line.x2 + dx,
    y2: line.y2 + dy,
  }));
}

function incomingAirbornePhasePressure(airborneAgeFrames: number | null): number {
  if (airborneAgeFrames === null || !Number.isFinite(airborneAgeFrames)) return 0;
  return smoothstep((LEGAL_AIRBORNE_FRAMES - airborneAgeFrames) / LEGAL_AIRBORNE_FRAMES);
}

/**
 * Preserve all lines through the first outgoing segment after the sampled
 * contact. The remaining tail keeps its original segment directions and
 * collision flags while its lengths scale continuously with the measured
 * incoming phase shortfall. This is a release-timing test, not a new capture
 * primitive or a future-target-sized support rail.
 */
function correlateAirbornePhaseTail(
  lines: readonly TrackLine[],
  contactAnchor: { x: number; y: number },
  pressure: number,
): TrackLine[] {
  const vertices = polylineVertices(lines);
  if (vertices.length < 4) return [...lines];
  const contact = closestVertex(vertices, contactAnchor);
  const firstMutableLine = contact + 1;
  if (firstMutableLine >= lines.length) return [...lines];
  const scale = 1 + (AIRBORNE_PHASE_TAIL_MIN_SCALE - 1) * clamp(pressure, 0, 1);
  const result = lines.map((line) => ({ ...line }));
  let point = { ...vertices[firstMutableLine]! };
  for (let index = firstMutableLine; index < lines.length; index++) {
    const from = vertices[index]!;
    const to = vertices[index + 1]!;
    const dx = (to.x - from.x) * scale;
    const dy = (to.y - from.y) * scale;
    const next = { x: point.x + dx, y: point.y + dy };
    result[index] = {
      ...result[index]!,
      x1: point.x,
      y1: point.y,
      x2: next.x,
      y2: next.y,
    };
    point = next;
  }
  return result;
}

/**
 * Carry a physically measured normal acceleration across one contact without
 * copying a grade or changing either boundary tangent.  The sine field is zero
 * on the first (capture) and final (release) segment, so it redistributes only
 * interior curvature.  Its amplitude is solved analytically from the desired
 * final discrete curvature; exact candidate admission remains the sole judge.
 */
function correlateFrenetCurvature(
  lines: readonly TrackLine[],
  contactAnchor: { x: number; y: number },
  previousNormalAcceleration: number,
  entrySpeed: number,
): TrackLine[] {
  if (!Number.isFinite(previousNormalAcceleration) || !(entrySpeed > 1e-9)) return [...lines];
  const vertices = polylineVertices(lines);
  const contact = closestVertex(vertices, contactAnchor);
  const postSegments = vertices.length - 1 - contact;
  if (postSegments < 3) return [...lines];
  const rawCurvature = terminalCurvatureFromVertices(vertices, contact);
  if (rawCurvature === null) return [...lines];
  const headings = Array.from({ length: postSegments }, (_, index) =>
    headingRadians(vertices[contact + index]!, vertices[contact + index + 1]!),
  );
  const lengths = Array.from({ length: postSegments }, (_, index) => {
    const from = vertices[contact + index]!;
    const to = vertices[contact + index + 1]!;
    return Math.hypot(to.x - from.x, to.y - from.y);
  });
  if (lengths.some((length) => !(length > 1e-9))) return [...lines];
  const meanTerminalLength = (lengths.at(-1)! + lengths.at(-2)!) / 2;
  const sineStep = Math.sin(Math.PI / (postSegments - 1));
  if (!(sineStep > 1e-9)) return [...lines];
  const targetCurvature = previousNormalAcceleration / (entrySpeed * entrySpeed);
  // The final heading is unchanged while the penultimate heading receives
  // amplitude*sin(pi/(n-1)), hence this sign realizes target curvature.
  const amplitude = (rawCurvature - targetCurvature) * meanTerminalLength / sineStep;
  if (!Number.isFinite(amplitude)) return [...lines];
  const rebuilt = vertices.slice(0, contact + 1).map((point) => ({ ...point }));
  let point = { ...vertices[contact]! };
  for (let index = 0; index < postSegments; index++) {
    const packet = Math.sin(Math.PI * index / (postSegments - 1));
    const angle = headings[index]! + amplitude * packet;
    point = {
      x: point.x + Math.cos(angle) * lengths[index]!,
      y: point.y + Math.sin(angle) * lengths[index]!,
    };
    rebuilt.push(point);
  }
  return rebuilt.slice(1).map((end, index) => ({
    ...lines[index]!,
    x1: rebuilt[index]!.x,
    y1: rebuilt[index]!.y,
    x2: end.x,
    y2: end.y,
  }));
}

function postTailLength(
  lines: readonly TrackLine[],
  contactAnchor: { x: number; y: number },
): number | null {
  const vertices = polylineVertices(lines);
  if (vertices.length < 2) return null;
  const contact = closestVertex(vertices, contactAnchor);
  const firstMutableLine = contact + 1;
  if (firstMutableLine >= lines.length) return 0;
  let length = 0;
  for (let index = firstMutableLine; index < lines.length; index++) {
    const line = lines[index]!;
    length += Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
  }
  return round(length);
}

function polylineVertices(lines: readonly TrackLine[]): Array<{ x: number; y: number }> {
  if (lines.length === 0) return [];
  return [{ x: lines[0].x1, y: lines[0].y1 }, ...lines.map((line) => ({ x: line.x2, y: line.y2 }))];
}

function terminalGrade(lines: readonly TrackLine[]): number | null {
  const last = lines.at(-1);
  return last === undefined ? null : round(heading(last, last));
}

/** Final discrete Frenet curvature in radians/pixel over the post-contact
 * curve.  Unwrapped heading difference keeps left/right turns continuous. */
function terminalCurvature(
  lines: readonly TrackLine[],
  contactAnchor: { x: number; y: number },
): number | null {
  const vertices = polylineVertices(lines);
  return terminalCurvatureFromVertices(vertices, closestVertex(vertices, contactAnchor));
}

function terminalCurvatureFromVertices(
  vertices: readonly { x: number; y: number }[],
  contact: number,
): number | null {
  const postSegments = vertices.length - 1 - contact;
  if (postSegments < 2) return null;
  const before = vertices.at(-3);
  const pivot = vertices.at(-2);
  const end = vertices.at(-1);
  if (before === undefined || pivot === undefined || end === undefined) return null;
  const beforeLength = Math.hypot(pivot.x - before.x, pivot.y - before.y);
  const finalLength = Math.hypot(end.x - pivot.x, end.y - pivot.y);
  const meanLength = (beforeLength + finalLength) / 2;
  if (!(meanLength > 1e-9)) return null;
  return angleDifferenceRadians(headingRadians(before, pivot), headingRadians(pivot, end)) / meanLength;
}

/**
 * The exact timing pattern of the three zero-friction sled points on the
 * committed candidate lines.  This is intentionally an after-the-fact study
 * read: no timing observation is available to generation or exact choice.
 */
function observeSledContactTiming(
  engine: any,
  lines: readonly TrackLine[],
  gap: Gap,
): SledContactTiming | null {
  try {
    if (typeof engine?.getUpdatesAtFrame !== "function") return null;
    const ids = new Set(lines.map((line) => line.id));
    const names = new Set(["TAIL", "NOSE", "STRING"]);
    const firstOffset: SledContactTiming["firstOffset"] = {};
    const lastOffset: SledContactTiming["lastOffset"] = {};
    const updates: SledContactTiming["updates"] = {};
    const startOffset = -1;
    const endOffset = 6;
    for (let offset = startOffset; offset <= endOffset; offset++) {
      const frameUpdates = engine.getUpdatesAtFrame(Math.max(0, gap.endFrame + offset));
      if (!Array.isArray(frameUpdates)) continue;
      for (const update of frameUpdates) {
        const record = update as { id?: unknown; updated?: unknown };
        if (typeof record.id !== "number" || !ids.has(record.id) || !Array.isArray(record.updated)) continue;
        for (const updatePoint of record.updated) {
          const name = (updatePoint as { id?: unknown } | null)?.id;
          if (typeof name !== "string" || !names.has(name)) continue;
          const point = name as "TAIL" | "NOSE" | "STRING";
          if (firstOffset[point] === undefined) firstOffset[point] = offset;
          lastOffset[point] = offset;
          updates[point] = (updates[point] ?? 0) + 1;
        }
      }
    }
    return { window: { startOffset, endOffset }, firstOffset, lastOffset, updates };
  } catch {
    return null;
  }
}

function headingRadians(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function angleDifferenceRadians(from: number, to: number): number {
  return ((to - from + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
}

function prefixTerminalGrade(fixture: ReturnType<typeof readFrozenTrajectoryFixture>): number | null {
  const prefix = fixture.physicalPrefix as unknown as { prefixFitLines?: readonly (readonly TrackLine[])[] };
  const previousFit = prefix.prefixFitLines?.at(-1);
  return previousFit === undefined ? null : terminalGrade(previousFit);
}

function heading(from: { x1: number; y1: number; x2: number; y2: number } | { x: number; y: number }, to: { x: number; y: number } | { x1: number; y1: number; x2: number; y2: number }): number {
  const start = "x" in from ? from : { x: from.x1, y: from.y1 };
  const end = "x" in to ? to : { x: to.x2, y: to.y2 };
  return Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
}

function lerpAngle(from: number, to: number, amount: number): number {
  let delta = ((to - from + 180) % 360 + 360) % 360 - 180;
  return from + delta * clamp(amount, 0, 1);
}

function smoothstep(value: number): number {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function summarize(rows: readonly Trial[]): FamilySummary {
  const committed = rows.flatMap((row) => row.steps.filter((step) => step.result === "committed"));
  return {
    trials: rows.length,
    completeChains: rows.filter((row) => row.completedContacts === CHAIN_CONTACTS).length,
    meanCompletedContacts: mean(rows.map((row) => row.completedContacts)) ?? 0,
    terminalSpeed: distribution(rows.map((row) => row.terminal.speed)),
    meanAchievedSpeed: distribution(rows.map((row) => row.terminal.meanAchievedSpeed)),
    meanTerminalGradeDeg: distribution(rows.map((row) => row.terminal.meanTerminalGradeDeg)),
    transformedChosen: committed.filter((step) => step.chosen?.transformed).length,
    transformedAdmitted: committed.flatMap((step) => step.candidates).filter((candidate) => candidate.transformed && candidate.admitted).length,
  };
}

function summarizeTiming(rows: readonly Trial[]): TimingSummary {
  const committed = rows.flatMap((row) => row.steps.filter((step) => step.result === "committed"));
  const readable = committed.filter((step): step is ContactStep & { sledContactTiming: SledContactTiming } => step.sledContactTiming !== null);
  const pattern = (timing: SledContactTiming): string =>
    (["TAIL", "NOSE", "STRING"] as const).map((point) => timing.firstOffset[point] ?? "-").join("/");
  const active = (timing: SledContactTiming): string =>
    (["TAIL", "NOSE", "STRING"] as const).filter((point) => timing.firstOffset[point] !== undefined).join(",");
  const counts: Record<string, number> = {};
  for (const step of readable) {
    const key = pattern(step.sledContactTiming);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const pairs = rows.flatMap((row) => {
    const timed = row.steps.filter((step): step is ContactStep & { sledContactTiming: SledContactTiming } =>
      step.result === "committed" && step.sledContactTiming !== null,
    );
    return timed.slice(1).map((step, index) => [timed[index]!.sledContactTiming, step.sledContactTiming] as const);
  });
  const sharedDeltas = pairs.flatMap(([previous, current]) =>
    (["TAIL", "NOSE", "STRING"] as const).flatMap((point) => {
      const left = previous.firstOffset[point];
      const right = current.firstOffset[point];
      return left === undefined || right === undefined ? [] : [Math.abs(left - right)];
    }),
  );
  return {
    trials: rows.length,
    committedSteps: committed.length,
    readableSteps: readable.length,
    distinctFirstPatterns: Object.keys(counts).length,
    firstPatternCounts: Object.fromEntries(Object.entries(counts).sort(([, left], [, right]) => right - left)),
    successivePairs: pairs.length,
    exactPatternPairs: pairs.filter(([previous, current]) => pattern(previous) === pattern(current)).length,
    sameActiveSetPairs: pairs.filter(([previous, current]) => active(previous) === active(current)).length,
    sharedPointComparisons: sharedDeltas.length,
    meanSharedPointFirstOffsetDelta: mean(sharedDeltas),
  };
}

function distribution(values: readonly (number | null)[]): Summary {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value)).sort((a, b) => a - b);
  return {
    count: finite.length,
    mean: mean(finite),
    median: finite.length === 0 ? null : round(finite[Math.floor(finite.length / 2)]),
    min: finite.length === 0 ? null : round(finite[0]),
    max: finite.length === 0 ? null : round(finite.at(-1)!),
  };
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function difference(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : round(left - right);
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function fmt(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(3);
}

function signed(value: number | null): string {
  return value === null ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}
