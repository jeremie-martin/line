/**
 * Frontier-Catch Continuation Competence (calibration-only, WASM/500k).
 *
 * Declared in docs/compiler-improvement-campaign.md ("Declared Study:
 * Frontier-Catch Continuation Competence (2026-07-17)"). Question: from the
 * arrival state left by a committed "entry-incidence frontier" catch at contact
 * k (a retained catch-geometry frontier param member) versus an incumbent raw-
 * normal catch, can the NORMAL production sampler construct an admissible catch
 * at contact k+1, and at what achieved-axis quality? The catch-frontier oracle
 * proved chainability only BALLISTICALLY (>= MIN_LANDING_AIRBORNE_FRAMES
 * airborne, survived to the beat). It never asked whether the normal sampler
 * can actually build a fit from the frontier arrival. This study answers that.
 *
 * Method: replay retained catch-frontier rows by exact identity on the frozen
 * prefix engine (segment 1), admit through the UNCHANGED `tryCandidateLines`
 * (asserting re-admission matches the artifact), extend the engine with each
 * admitted fit, then run the production raw-normal member stream at the next
 * authored contact (segment 2, following study_two_contact_shooting's chaining)
 * and record admissions plus achieved axes. Every engine touch is bracketed by
 * getSimFrames(). Segment-1 arrival diagnostics (airborne margin, arrival
 * angle/speed, survived-to-beat) are re-measured so each row is self-contained.
 *
 * This is study-only code OUTSIDE the compiler identity boundary. It reads the
 * frozen fixtures, the retained catch-frontier artifacts, and shared
 * primitives; no compiler source imports it, and it selects/promotes nothing.
 */
import { readFileSync } from "node:fs";
import { MIN_LANDING_AIRBORNE_FRAMES } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { makeSolidLine } from "./arc.ts";
import {
  clearImpactTemplateMarker,
  sampleArcPlacementGeometry,
} from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { axisLookaheadEndFrame, detectWindow, tryCandidateLines } from "./core/candidate.ts";
import {
  airborneAt,
  contactLineIdsAt,
  engineLineFromTrackLine,
  velocityAt,
  type GapFit,
} from "./core/substrate.ts";
import { getCandidateProbe, type CandidateProbe } from "./optimizer/sample.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import type { AxisValues, Gap, TrackLine } from "./types.ts";
import { makeMirroredContactCaptureArcScreen } from "./trajectory/contact_capture_arc_design.ts";
import {
  contactKinematicFrameFromPlanningState,
  type ContactKinematicFrame,
} from "./trajectory/contact_kinematic_frame.ts";
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
import { targetFrameFromPlanningState } from "./trajectory/target_frame.ts";

const SCHEMA = "line.study-frontier-continuation.v1";
const FIXTURE_DIR = "generated/studies/trajectory-fixtures/current-2026-07-15/v3";
const FIXTURES = {
  dense240: "dense240-b500000-e8f074b651d9.json",
  ordinary: "ordinary-b500000-e71c85b5c2c2.json",
  frontier5: "frontier5-b500000-c39d45c390ff.json",
} as const;
type StateId = keyof typeof FIXTURES;

// Retained catch-frontier source artifacts (segment-1 member provenance).
// For ordinary, both `ordinary-20b4de9179d7.json` and its `.attempt-2` sibling
// are complete runs (2500 param samples, budgetExhausted false) with byte-
// identical summaries and rows; the base append-only record is used.
const CATCH_FRONTIER_DIR = "generated/studies/catch-frontier/v1";
const SOURCE_ARTIFACTS: Record<StateId, string> = {
  dense240: "dense240-db0b899a54a0.json",
  ordinary: "ordinary-20b4de9179d7.json",
  frontier5: "frontier5-ff3ac51918b0.json",
};

// Segment-1 selection caps and the raw-normal control-stream length that the
// catch-frontier study used (must equal its CONTROL_SAMPLES so replaying the
// same RNG stream reproduces each raw-normal member at its attempt index).
const SEG1_SET_MAX = 24;
const CATCH_FRONTIER_CONTROL_SAMPLES = 300;

type Seg1Family = "frontier" | "incumbent";
type CatchFrontierFamily = "param" | "raw-normal";

// ── Sampled catch geometry (CatchParams) — verbatim shape from the retained
//    catch-frontier artifact rows so `params` can be rebuilt exactly. ─────────
type CatchParams = {
  orient: -1 | 1;
  thetaPreDeg: number;
  lPrePx: number;
  segments: number;
  lPostPx: number;
  deltasDeg: number[];
  contactYOffsetPx: number;
};

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_frontier_continuation.ts [--case=dense240|ordinary|frontier5|all] [--out-dir=DIR]",
    "",
    "Frontier-catch continuation-competence assay (calibration-only). Requires LR_ENGINE=wasm.",
    "Replays retained catch-frontier rows (frontier param + incumbent raw-normal) at contact k,",
    "extends the engine, runs the production raw-normal sampler at contact k+1 from each arrival,",
    "and reports the segment-2 admission rate and best achieved axis quality per family.",
    "Writes one immutable JSON artifact per state under the out-dir default",
    "generated/studies/frontier-continuation/v1/ plus a compact stdout table.",
  ].join("\n") + "\n");
  process.exit(0);
}

assertExactEnvironment();
const supportedOptions = ["--case=", "--out-dir=", "--help", "-h"];
const unknownOptions = argv.filter((value) => !supportedOptions.some((prefix) => value === prefix || value.startsWith(prefix)));
if (unknownOptions.length > 0) throw new Error(`unsupported option(s): ${unknownOptions.join(", ")}`);

const requestedCase = argument("case") ?? "all";
const stateIds: readonly StateId[] = ["dense240", "ordinary", "frontier5"];
if (requestedCase !== "all" && !stateIds.includes(requestedCase as StateId)) {
  throw new Error(`unknown --case=${requestedCase}; expected all|${stateIds.join("|")}`);
}
const selected: readonly StateId[] = requestedCase === "all" ? stateIds : [requestedCase as StateId];
const outDir = argument("out-dir") ?? "generated/studies/frontier-continuation/v1";

const sourceIdentity = studySourceIdentity("scripts/v0/study_frontier_continuation.ts");
const observationCompiler = compilerCandidateIdentity("wasm");
const protocolFingerprint = sha256(stableJson({
  protocol: "frontier-catch-continuation.v1",
  captureBudget: 500_000,
  segment1: {
    frontier: `catch-frontier rows family=param admitted&&chainable, sorted by |impactErrSigned| asc, N<=${SEG1_SET_MAX}`,
    incumbent: `catch-frontier rows family=raw-normal admitted, artifact order, N<=${SEG1_SET_MAX}`,
    rebuild: "param via buildCatchLines(params); raw-normal via replayed control RNG stream indexed by attempt",
    admission: "tryCandidateLines (survival, +/-1 landing, no off-beat; unchanged)",
  },
  segment2: {
    family: "raw-normal only (production sampler); capture-arc family excluded",
    memberCount: "makeMirroredContactCaptureArcScreen(kinematic2).length (same count study_two_contact_shooting uses)",
    seed: "rawStreamSeed2(prepared, outgoing.index, artifactRowIndex)",
    chaining: "engine.addLine(fit1.lines) -> getCandidateProbe(outgoing) -> raw-normal stream at k+1",
  },
  replayIntegrity: "re-admission (true/false) must match the artifact row for every selected member",
}));

const started = performance.now();
let grandTotalFrames = 0;
const runResults = selected.map((id) => runState(id));

const summaryLines: string[] = [
  `frontier continuation: ${runResults.length} state(s), ${round(performance.now() - started)}ms; engine=wasm; total charged frames ${grandTotalFrames}`,
];
for (const result of runResults) summaryLines.push(...formatStateSummary(result));
process.stdout.write(summaryLines.join("\n") + "\n");

// ─────────────────────────────────────────────────────────────────────────────

type ArrivalDiagnostics = {
  rideFrames: number;
  survivedToBeat: boolean;
  terminusFrame: number;
  terminusReason: string;
  airborneMarginBeforeBeat: number;
  arrivalSpeed: number | null;
  arrivalAngleDeg: number | null;
};

type Seg2Row = {
  label: string;
  admitted: boolean;
  admissionFrames: number;
  achieved: RoundedAxes;
  impactErrAbs: number | null;
  airErrAbs: number | null;
  speedErrAbs: number | null;
  finalLineCount: number | null;
  error: string | null;
};

type Seg2Block =
  | null
  | {
    available: boolean;
    memberCount: number;
    probeFrames: number;
    attempted: number;
    admitted: number;
    admissionFrames: number;
    error: string | null;
    bestAxisErr: { impact: number | null; air: number | null; speed: number | null };
    rows: Seg2Row[];
  };

type Row = {
  seg1Family: Seg1Family;
  catchFrontierFamily: CatchFrontierFamily;
  artifactRowIndex: number;
  label: string;
  params: CatchParams | null;
  attemptIndex: number | null;
  artifactAdmitted: boolean;
  replayedAdmitted: boolean;
  replayMismatch: boolean;
  admissionFrames: number;
  achieved: RoundedAxes;
  arrival: ArrivalDiagnostics | null;
  seg2: Seg2Block;
  totalChargedFrames: number;
};

type FamilySummary = {
  selected: number;
  admitted: number;
  replayMismatches: number;
  seg2AnyAdmittedRate: number | null;
  seg2AdmittedCount: { min: number | null; median: number | null; max: number | null };
  bestSeg2AxisErrMedians: { impact: number | null; air: number | null; speed: number | null };
  arrivalFeatureMedians: { angleDeg: number | null; speed: number | null; airborneMargin: number | null };
};

type StateSummary = {
  outgoingTargets: RoundedAxes;
  families: Record<Seg1Family, FamilySummary>;
  frontierVsIncumbentSeg2AnyAdmittedRatio: number | null;
};

type StateResult = {
  id: StateId;
  artifactPath: string;
  panel: PreparedTrajectoryFixtureCore["panel"];
  summary: StateSummary;
  stateFrames: number;
  outgoingGapPath: string;
};

type SelectedMember = {
  seg1Family: Seg1Family;
  catchFrontierFamily: CatchFrontierFamily;
  artifactRowIndex: number;
  label: string;
  params: CatchParams | null;
  attemptIndex: number | null;
  artifactAdmitted: boolean;
};

function runState(id: StateId): StateResult {
  const fixturePath = `${FIXTURE_DIR}/${FIXTURES[id]}`;
  const fixture = readFrozenTrajectoryFixture(fixturePath);
  // prepareStateCoupledTrajectoryFixture fails closed on any replay mismatch.
  const prepared = prepareStateCoupledTrajectoryFixture(fixture);
  if (prepared.panel.cohort !== "calibration") {
    throw new Error(`frontier continuation accepts only calibration fixtures; ${prepared.panel.id} is ${prepared.panel.cohort}`);
  }

  const sourceArtifactPath = `${CATCH_FRONTIER_DIR}/${SOURCE_ARTIFACTS[id]}`;
  const sourceArtifactText = readFileSync(sourceArtifactPath, "utf8");
  const sourceArtifact = JSON.parse(sourceArtifactText) as CatchFrontierArtifact;
  const sourceArtifactSha256 = sha256(stableJson(sourceArtifact));
  if (sourceArtifact.provenance?.fixtureFingerprint !== fixture.fixtureFingerprint) {
    throw new Error(
      `source artifact ${SOURCE_ARTIFACTS[id]} fixtureFingerprint ${sourceArtifact.provenance?.fixtureFingerprint} != active fixture ${fixture.fixtureFingerprint}; the tree changed since the oracle ran`,
    );
  }

  const allContactFrames = prepared.ctx.allContactFrames;
  const axisEnd1 = axisLookaheadEndFrame(prepared.current, allContactFrames);
  const axisEnd2 = axisLookaheadEndFrame(prepared.outgoing, allContactFrames);
  const outgoingTargets = prepared.ctx.gapAxisTargets[prepared.outgoing.index] ?? {};
  const kinematic1 = contactKinematicFrameFromPlanningState(prepared.state, prepared.frame, prepared.current.targets);

  // Rebuild the exact raw-normal control-stream members (indexed by attempt) by
  // replaying the identical RNG stream the catch-frontier study drew from. The
  // stream is stateful/shared across attempts, so members must be produced in
  // order; we replay the full control length so any selected attempt index is
  // reproduced bit-for-bit.
  const rawNormalMembers = replayRawNormalControlStream(prepared, allContactFrames);

  const selectedMembers = selectSegment1Members(sourceArtifact.rows);

  let stateFrames = 0;
  const charge = (frames: number): void => {
    stateFrames += frames;
    grandTotalFrames += frames;
  };

  let outgoingGapPath = "prepared.outgoing";
  const rows: Row[] = [];
  let replayMismatchRow: Row | null = null;
  for (const member of selectedMembers) {
    // Rebuild this member's candidate lines.
    let lines: TrackLine[] | null = null;
    if (member.catchFrontierFamily === "param") {
      if (member.params === null) throw new Error(`frontier row ${member.artifactRowIndex} has no params to rebuild`);
      lines = buildCatchLines(kinematic1, member.params, prepared.lineIdStart);
    } else {
      const attempt = member.attemptIndex;
      if (attempt === null || rawNormalMembers[attempt] === undefined) {
        throw new Error(`incumbent row ${member.artifactRowIndex} has no replayable attempt index (${attempt})`);
      }
      lines = rawNormalMembers[attempt];
      if (lines === null) {
        throw new Error(`incumbent row ${member.artifactRowIndex} attempt ${attempt} produced no geometry on replay`);
      }
    }

    // Segment-1 admission on the frozen prefix engine (unchanged tryCandidateLines).
    const s1Before = getSimFrames();
    const fit1 = tryCandidateLines(
      prepared.engine,
      prepared.current,
      lines,
      prepared.lineIdStart,
      allContactFrames,
      axisEnd1,
      prepared.current.targets,
      true,
      undefined,
      prepared.probe.preTargetSledTrace,
    ) as GapFit | null;
    const s1Frames = getSimFrames() - s1Before;
    charge(s1Frames);

    const replayedAdmitted = fit1 !== null;
    const replayMismatch = replayedAdmitted !== member.artifactAdmitted;

    const row: Row = {
      seg1Family: member.seg1Family,
      catchFrontierFamily: member.catchFrontierFamily,
      artifactRowIndex: member.artifactRowIndex,
      label: member.label,
      params: member.params,
      attemptIndex: member.attemptIndex,
      artifactAdmitted: member.artifactAdmitted,
      replayedAdmitted,
      replayMismatch,
      admissionFrames: s1Frames,
      achieved: fit1 === null ? null : roundAxes(fit1.achieved),
      arrival: null,
      seg2: null,
      totalChargedFrames: s1Frames,
    };

    if (replayMismatch) {
      replayMismatchRow = row;
      rows.push(row);
      break;
    }
    if (fit1 === null) {
      rows.push(row);
      continue;
    }

    // Segment-1 arrival diagnostics (ballistic ride to the next beat), copied
    // from study_catch_frontier's chain measurement.
    const arrival = measureArrival(prepared, fit1, charge);
    row.arrival = arrival;
    row.totalChargedFrames += arrival.rideFrames;

    // Segment 2: extend the immutable engine and run the production raw-normal
    // sampler at contact k+1 from this arrival.
    const engine2 = prepared.engine.addLine(fit1.lines.map((line: TrackLine) => engineLineFromTrackLine(line)));
    const lineId2 = prepared.lineIdStart + fit1.lines.length;

    const p2Before = getSimFrames();
    const probe2 = getCandidateProbe(engine2, prepared.outgoing, prepared.ctx);
    const state2 = extractPlanningState(engine2, prepared.outgoing.endFrame);
    const p2Frames = getSimFrames() - p2Before;
    charge(p2Frames);
    row.totalChargedFrames += p2Frames;

    if (state2 === null) {
      row.seg2 = emptySeg2(p2Frames, null);
      rows.push(row);
      continue;
    }

    // Same member count study_two_contact_shooting uses for segment 2: the
    // mirrored capture-arc screen length. Building it can throw when the
    // outgoing contact authors no impact; that is the "family unavailable" path.
    let seg2Count: number;
    try {
      const frame2 = targetFrameFromPlanningState(state2);
      const kinematic2 = contactKinematicFrameFromPlanningState(state2, frame2, prepared.outgoing.targets);
      seg2Count = makeMirroredContactCaptureArcScreen(kinematic2).length;
    } catch (error) {
      row.seg2 = emptySeg2(p2Frames, errorMessage(error));
      rows.push(row);
      continue;
    }

    const seg2Members = buildRawMembers(
      makeRng(rawStreamSeed2(prepared, prepared.outgoing.index, member.artifactRowIndex)),
      probe2,
      prepared.outgoing,
      lineId2,
      allContactFrames,
      seg2Count,
    );

    const seg2Rows: Seg2Row[] = [];
    let seg2AdmissionFrames = 0;
    let seg2Admitted = 0;
    for (const seg2Member of seg2Members) {
      const evaluated = evaluateSegment2(
        engine2,
        prepared.outgoing,
        seg2Member,
        lineId2,
        axisEnd2,
        allContactFrames,
        probe2,
        outgoingTargets,
        (frames) => {
          seg2AdmissionFrames += frames;
          charge(frames);
          row.totalChargedFrames += frames;
        },
      );
      if (evaluated.admitted) seg2Admitted++;
      seg2Rows.push(evaluated);
    }

    row.seg2 = {
      available: true,
      memberCount: seg2Count,
      probeFrames: p2Frames,
      attempted: seg2Rows.length,
      admitted: seg2Admitted,
      admissionFrames: seg2AdmissionFrames,
      error: null,
      bestAxisErr: bestSeg2AxisErr(seg2Rows),
      rows: seg2Rows,
    };
    rows.push(row);
  }

  const summary = summarizeState(rows, outgoingTargets);
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
      "Attribution for the catch-frontier 2x2 'supply unvalued' cell: can the NORMAL sampler build an admissible catch at contact k+1 from a committed entry-incidence frontier arrival, and at what achieved quality vs an incumbent raw-normal arrival?",
      "Segment 1 replays retained catch-frontier rows by exact identity and asserts re-admission matches the artifact; segment 2 runs the production raw-normal stream at k+1 on the extended engine.",
      "Retain every row; no control, candidate, source default, or promotion is selected here.",
    ],
    status: {
      productionIntegration: "forbidden: calibration study outside the compiler identity boundary; not a candidate source, selector, or promotion command",
      cohortPolicy: "calibration only; a separately frozen validation cohort is required before any predictive claim",
      replay: replayMismatchRow === null ? "clean" : "replay-mismatch",
    },
    argv: [...argv],
    elapsedMs: round(performance.now() - started),
    provenance: {
      fixturePath,
      fixtureFingerprint: fixture.fixtureFingerprint,
      captureCompiler: fixture.captureCompiler,
      observationCompiler,
      runtime: { node: process.version, engine: "wasm" },
      studySourceFingerprint: sourceIdentity.studySourceFingerprint,
      studySourceFiles: sourceIdentity.sourceFiles,
      sourceArtifact: {
        path: sourceArtifactPath,
        filename: SOURCE_ARTIFACTS[id],
        sha256: sourceArtifactSha256,
        schema: sourceArtifact.schema ?? null,
        ordinaryNote: id === "ordinary"
          ? "both ordinary-20b4de9179d7.json and .attempt-2 are complete (2500 param samples, budgetExhausted false) with identical summaries/rows; base append-only record used"
          : null,
      },
    },
    panel: prepared.panel,
    fixtureReplay: prepared.replay,
    protocol: {
      captureBudget: prepared.fixture.captureBudget,
      captureEngine: prepared.fixture.captureEngine,
      captureEnvironment: prepared.fixture.captureEnvironment,
      segment1: {
        frontierSelected: rows.filter((r) => r.seg1Family === "frontier").length,
        incumbentSelected: rows.filter((r) => r.seg1Family === "incumbent").length,
        seg1SetMax: SEG1_SET_MAX,
        catchFrontierControlSamples: CATCH_FRONTIER_CONTROL_SAMPLES,
        rebuild: "param via buildCatchLines(kinematic1, params); raw-normal via replayed control RNG stream (attempt-indexed)",
        admission: "tryCandidateLines(engine, gap, lines, lineIdStart, allContactFrames, axisLookaheadEndFrame, gap.targets, true, undefined, probe.preTargetSledTrace)",
      },
      segment2: {
        outgoingGap: prepared.outgoing.index,
        outgoingGapDerivation: outgoingGapPath,
        family: "raw-normal only (capture-arc excluded)",
        memberCount: "makeMirroredContactCaptureArcScreen(kinematic2).length",
        seed: "rawStreamSeed2(prepared, outgoing.index, artifactRowIndex)",
        chaining: "engine.addLine(fit1.lines) -> getCandidateProbe(outgoing) -> tryCandidateLines at k+1",
        errorsMeasuredAgainst: "true per-gap axis targets for the outgoing gap (ctx.gapAxisTargets[outgoing.index]), matching the exact scorer",
        bestPerRowDefinition: "per seg-1 row with >=1 seg-2 admission: min |axis err| over admitted seg-2 rows, independently per axis",
      },
      replayIntegrity: "re-admission (true/false) asserted to match the artifact row for every selected member; a mismatch writes status replay-mismatch and exits nonzero",
    },
    stateFrames,
    summary,
    rows,
  };

  const artifactPath = allocateStudyArtifactPath(`${outDir}/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}.json`);
  writeImmutableJsonArtifact(artifactPath, document, "frontier-continuation artifact");

  if (replayMismatchRow !== null) {
    process.stdout.write(
      `\nREPLAY MISMATCH on ${id}: artifact row ${replayMismatchRow.artifactRowIndex} ` +
      `(${replayMismatchRow.catchFrontierFamily} ${replayMismatchRow.label}) admitted ` +
      `${replayMismatchRow.replayedAdmitted} on replay but ${replayMismatchRow.artifactAdmitted} in the artifact; ` +
      `the tree changed since the oracle ran. Artifact written with status replay-mismatch: ${artifactPath}\n`,
    );
    process.exit(3);
  }

  return { id, artifactPath, panel: prepared.panel, summary, stateFrames, outgoingGapPath };
}

// ─────────────────────────────────────────────────────────────────────────────

function selectSegment1Members(rows: readonly CatchFrontierRow[]): SelectedMember[] {
  // FRONTIER: param rows admitted && chainable, sorted by |impactErrSigned| asc.
  const frontierRows = rows
    .filter((r) => r.family === "param" && r.admitted && r.chainable && r.impactErrSigned !== null && r.impactErrSigned !== undefined)
    .slice()
    .sort((a, b) => Math.abs(a.impactErrSigned!) - Math.abs(b.impactErrSigned!))
    .slice(0, SEG1_SET_MAX);
  const frontier: SelectedMember[] = frontierRows.map((r) => ({
    seg1Family: "frontier",
    catchFrontierFamily: "param",
    artifactRowIndex: r.index,
    label: r.label,
    params: r.params as CatchParams,
    attemptIndex: null,
    artifactAdmitted: r.admitted === true,
  }));

  // INCUMBENT: raw-normal rows admitted, artifact order, up to N.
  const incumbentRows = rows
    .filter((r) => r.family === "raw-normal" && r.admitted)
    .slice(0, SEG1_SET_MAX);
  const incumbent: SelectedMember[] = incumbentRows.map((r) => ({
    seg1Family: "incumbent",
    catchFrontierFamily: "raw-normal",
    artifactRowIndex: r.index,
    label: r.label,
    params: null,
    attemptIndex: attemptIndexFromLabel(r.label),
    artifactAdmitted: r.admitted === true,
  }));

  return [...frontier, ...incumbent];
}

function attemptIndexFromLabel(label: string): number {
  const parts = label.split("_");
  const attempt = Number(parts[parts.length - 1]);
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new Error(`cannot derive raw-normal attempt index from label ${label}`);
  }
  return attempt;
}

/** Replay the catch-frontier raw-normal control stream: identical seed, same
 *  per-attempt sampleArcPlacementGeometry draw, producing member lines indexed
 *  by attempt. Bit-for-bit reproduces the retained control members. */
function replayRawNormalControlStream(
  prepared: PreparedTrajectoryFixtureCore,
  allContactFrames: number[],
): (TrackLine[] | null)[] {
  const controlRng = makeRng(controlStreamSeed(prepared));
  const members: (TrackLine[] | null)[] = [];
  for (let attempt = 0; attempt < CATCH_FRONTIER_CONTROL_SAMPLES; attempt++) {
    clearImpactTemplateMarker();
    try {
      const geometry = sampleArcPlacementGeometry(
        controlRng,
        prepared.probe.refX,
        prepared.probe.refY,
        prepared.current.targets,
        prepared.probe.targetState,
        attempt,
        prepared.current,
        prepared.lineIdStart,
        "normal",
        allContactFrames,
      );
      members.push(geometry.lines);
    } catch {
      members.push(null);
    }
  }
  return members;
}

/** Build the production raw-normal member stream exactly as
 *  study_two_contact_shooting does (verbatim). */
function buildRawMembers(
  rng: () => number,
  probe: CandidateProbe,
  gap: Gap,
  lineIdStart: number,
  allContactFrames: number[],
  count: number,
): CandidateMember[] {
  const members: CandidateMember[] = [];
  for (let attempt = 0; attempt < count; attempt++) {
    clearImpactTemplateMarker();
    try {
      const geometry = sampleArcPlacementGeometry(
        rng,
        probe.refX,
        probe.refY,
        gap.targets,
        probe.targetState,
        attempt,
        gap,
        lineIdStart,
        "normal",
        allContactFrames,
      );
      members.push({ index: attempt, label: `normal_${attempt}`, lines: geometry.lines, error: null });
    } catch (error) {
      members.push({ index: attempt, label: `normal_${attempt}`, lines: null, error: errorMessage(error) });
    }
  }
  return members;
}

type CandidateMember = { index: number; label: string; lines: TrackLine[] | null; error: string | null };

function evaluateSegment2(
  engine2: any,
  outgoing: Gap,
  member: CandidateMember,
  lineId2: number,
  axisEnd2: number,
  allContactFrames: number[],
  probe2: CandidateProbe,
  outgoingTargets: AxisValues,
  charge: (frames: number) => void,
): Seg2Row {
  if (member.lines === null) {
    return { label: member.label, admitted: false, admissionFrames: 0, achieved: null, impactErrAbs: null, airErrAbs: null, speedErrAbs: null, finalLineCount: null, error: member.error };
  }
  const before = getSimFrames();
  const fit2 = tryCandidateLines(
    engine2,
    outgoing,
    member.lines,
    lineId2,
    allContactFrames,
    axisEnd2,
    outgoing.targets,
    true,
    undefined,
    probe2.preTargetSledTrace,
  ) as GapFit | null;
  const admissionFrames = getSimFrames() - before;
  charge(admissionFrames);
  if (fit2 === null) {
    return { label: member.label, admitted: false, admissionFrames, achieved: null, impactErrAbs: null, airErrAbs: null, speedErrAbs: null, finalLineCount: null, error: null };
  }
  const achieved = fit2.achieved;
  const errs = axisErrAbs(achieved, outgoingTargets);
  return {
    label: member.label,
    admitted: true,
    admissionFrames,
    achieved: roundAxes(fit2.achieved),
    impactErrAbs: errs.impact,
    airErrAbs: errs.air,
    speedErrAbs: errs.speed,
    finalLineCount: fit2.lines.length,
    error: null,
  };
}

/**
 * Realize the sampled catch as a travel-ordered polyline (verbatim from
 * study_catch_frontier's buildCatchLines): one pre-contact entry segment ending
 * at the contact point, then `segments` chained post-contact segments with
 * cumulative per-segment turns.
 */
function buildCatchLines(frame: ContactKinematicFrame, params: CatchParams, lineIdStart: number): TrackLine[] {
  const heading = frame.com.headingDeg;
  const contact = {
    x: frame.anchor.reference.x,
    y: frame.anchor.reference.y + params.contactYOffsetPx,
  };
  const entryAngleDeg = heading + params.orient * params.thetaPreDeg;
  const entryTangent = unit(entryAngleDeg);
  const entryStart = {
    x: contact.x - entryTangent.x * params.lPrePx,
    y: contact.y - entryTangent.y * params.lPrePx,
  };
  const lines: TrackLine[] = [];
  lines.push(makeSolidLine(lineIdStart + lines.length, entryStart.x, entryStart.y, contact.x, contact.y));
  const segmentPx = params.lPostPx / params.segments;
  let point = { ...contact };
  let angleDeg = entryAngleDeg;
  for (let index = 0; index < params.segments; index++) {
    angleDeg += params.orient * params.deltasDeg[index];
    const tangent = unit(angleDeg);
    const next = { x: point.x + tangent.x * segmentPx, y: point.y + tangent.y * segmentPx };
    lines.push(makeSolidLine(lineIdStart + lines.length, point.x, point.y, next.x, next.y));
    point = next;
  }
  for (const line of lines) {
    for (const value of [line.x1, line.y1, line.x2, line.y2]) {
      if (!Number.isFinite(value)) throw new Error("catch geometry produced a non-finite coordinate");
    }
  }
  return lines;
}

/** Extend the immutable prefix engine with the admitted fit and ride to the
 *  next beat, measuring arrival diagnostics (verbatim from study_catch_frontier's
 *  measureChain, restricted to the self-contained arrival features). */
function measureArrival(
  prepared: PreparedTrajectoryFixtureCore,
  fit: GapFit,
  charge: (frames: number) => void,
): ArrivalDiagnostics {
  const engine2 = prepared.engine.addLine(fit.lines.map((line: TrackLine) => engineLineFromTrackLine(line)));
  const beat = prepared.outgoing.endFrame;
  const before = getSimFrames();
  const detection = detectWindow(engine2, prepared.current.endFrame, beat + 1);
  const rideFrames = getSimFrames() - before;
  charge(rideFrames);

  const survivedToBeat = detection.terminus.frame >= beat || detection.terminus.reason === "endOfSpec";
  let airborneMarginBeforeBeat = 0;
  for (let frame = beat - 1; frame > prepared.current.endFrame; frame--) {
    if (airborneAt(detection, frame) === true) airborneMarginBeforeBeat++;
    else break;
  }
  const arrival = velocityAt(detection, beat);
  return {
    rideFrames,
    survivedToBeat,
    terminusFrame: detection.terminus.frame,
    terminusReason: detection.terminus.reason,
    airborneMarginBeforeBeat,
    arrivalSpeed: arrival === undefined ? null : round(Math.hypot(arrival.x, arrival.y)),
    arrivalAngleDeg: arrival === undefined ? null : round((Math.atan2(arrival.y, arrival.x) * 180) / Math.PI),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function summarizeState(rows: readonly Row[], outgoingTargets: AxisValues): StateSummary {
  const families: Record<Seg1Family, FamilySummary> = {
    frontier: summarizeFamily(rows.filter((r) => r.seg1Family === "frontier")),
    incumbent: summarizeFamily(rows.filter((r) => r.seg1Family === "incumbent")),
  };
  const frontierRate = families.frontier.seg2AnyAdmittedRate;
  const incumbentRate = families.incumbent.seg2AnyAdmittedRate;
  const ratio = incumbentRate === null || incumbentRate === 0 || frontierRate === null
    ? null
    : round(frontierRate / incumbentRate);
  return {
    outgoingTargets: roundAxes(outgoingTargets),
    families,
    frontierVsIncumbentSeg2AnyAdmittedRatio: ratio,
  };
}

function summarizeFamily(rows: readonly Row[]): FamilySummary {
  const admittedRows = rows.filter((r) => r.replayedAdmitted && !r.replayMismatch);
  const replayMismatches = rows.filter((r) => r.replayMismatch).length;
  const seg2Counts = admittedRows.map((r) => r.seg2 !== null ? r.seg2.admitted : 0);
  const anyAdmitted = admittedRows.filter((r) => r.seg2 !== null && r.seg2.admitted > 0);
  const seg2AnyAdmittedRate = admittedRows.length > 0 ? round(anyAdmitted.length / admittedRows.length) : null;

  // Best-per-row axis err: over rows with >=1 seg-2 admission, min |axis err|.
  const bestImpact: number[] = [];
  const bestAir: number[] = [];
  const bestSpeed: number[] = [];
  for (const r of anyAdmitted) {
    const be = r.seg2!.bestAxisErr;
    if (be.impact !== null) bestImpact.push(be.impact);
    if (be.air !== null) bestAir.push(be.air);
    if (be.speed !== null) bestSpeed.push(be.speed);
  }

  const angles: number[] = [];
  const speeds: number[] = [];
  const margins: number[] = [];
  for (const r of admittedRows) {
    if (r.arrival === null) continue;
    if (r.arrival.arrivalAngleDeg !== null) angles.push(r.arrival.arrivalAngleDeg);
    if (r.arrival.arrivalSpeed !== null) speeds.push(r.arrival.arrivalSpeed);
    margins.push(r.arrival.airborneMarginBeforeBeat);
  }

  return {
    selected: rows.length,
    admitted: admittedRows.length,
    replayMismatches,
    seg2AnyAdmittedRate,
    seg2AdmittedCount: {
      min: seg2Counts.length > 0 ? Math.min(...seg2Counts) : null,
      median: median(seg2Counts),
      max: seg2Counts.length > 0 ? Math.max(...seg2Counts) : null,
    },
    bestSeg2AxisErrMedians: {
      impact: median(bestImpact),
      air: median(bestAir),
      speed: median(bestSpeed),
    },
    arrivalFeatureMedians: {
      angleDeg: median(angles),
      speed: median(speeds),
      airborneMargin: median(margins),
    },
  };
}

function bestSeg2AxisErr(rows: readonly Seg2Row[]): { impact: number | null; air: number | null; speed: number | null } {
  const admitted = rows.filter((r) => r.admitted);
  const minAbs = (values: (number | null)[]): number | null => {
    const present = values.filter((v): v is number => v !== null);
    return present.length > 0 ? round(Math.min(...present)) : null;
  };
  return {
    impact: minAbs(admitted.map((r) => r.impactErrAbs)),
    air: minAbs(admitted.map((r) => r.airErrAbs)),
    speed: minAbs(admitted.map((r) => r.speedErrAbs)),
  };
}

function formatStateSummary(result: StateResult): string[] {
  const s = result.summary;
  const line = (family: Seg1Family): string => {
    const f = s.families[family];
    return [
      `  ${family.padEnd(9)}`,
      `seg1Adm ${String(f.admitted).padStart(2)}/${String(f.selected).padStart(2)}`,
      `seg2AnyRate ${fmt(f.seg2AnyAdmittedRate)}`,
      `medSeg2Adm ${fmt(f.seg2AdmittedCount.median)}`,
      `bestErr[imp/air/sp] ${fmt(f.bestSeg2AxisErrMedians.impact)}/${fmt(f.bestSeg2AxisErrMedians.air)}/${fmt(f.bestSeg2AxisErrMedians.speed)}`,
      `arr[ang/sp/margin] ${fmt(f.arrivalFeatureMedians.angleDeg)}/${fmt(f.arrivalFeatureMedians.speed)}/${fmt(f.arrivalFeatureMedians.airborneMargin)}`,
    ].join("  ");
  };
  return [
    `STATE ${result.id} (gap ${result.panel.currentGap}->${result.panel.outgoingGap}, interval ${result.panel.outgoingIntervalFrames}f; outgoing gap via ${result.outgoingGapPath}):`,
    line("frontier"),
    line("incumbent"),
    `  frontier/incumbent seg2 any-admitted ratio: ${s.frontierVsIncumbentSeg2AnyAdmittedRatio === null ? "n/a (incumbent rate 0 or undefined)" : s.frontierVsIncumbentSeg2AnyAdmittedRatio}`,
    `  frames: ${result.stateFrames}`,
    `  artifact: ${result.artifactPath}`,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────

function emptySeg2(probeFrames: number, error: string | null): Seg2Block {
  return {
    available: false,
    memberCount: 0,
    probeFrames,
    attempted: 0,
    admitted: 0,
    admissionFrames: 0,
    error,
    bestAxisErr: { impact: null, air: null, speed: null },
    rows: [],
  };
}

function axisErrAbs(achieved: AxisValues, targets: AxisValues): { impact: number | null; air: number | null; speed: number | null } {
  const err = (a: number | undefined, t: number | undefined): number | null =>
    a !== undefined && t !== undefined ? round(Math.abs(a - t)) : null;
  return {
    impact: err(achieved.impact, targets.impact),
    air: err(achieved.air, targets.air),
    speed: err(achieved.speed, targets.speed),
  };
}

type RoundedAxes = { air: number | null; speed: number | null; impact: number | null } | null;

function roundAxes(axes: AxisValues | undefined): RoundedAxes {
  if (axes === undefined) return null;
  return {
    air: axes.air === undefined ? null : round(axes.air),
    speed: axes.speed === undefined ? null : round(axes.speed),
    impact: axes.impact === undefined ? null : round(axes.impact),
  };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return round(value);
}

/** Deterministic control-stream seed (verbatim from study_catch_frontier). */
function controlStreamSeed(prepared: PreparedTrajectoryFixtureCore): number {
  return (Math.imul(prepared.panel.seed | 0, 1_000_003) + prepared.current.index + 1) | 0;
}

/** Distinct deterministic seed per (state, artifact segment-1 row index) at
 *  contact k+1 (verbatim rawStreamSeed2 pattern from study_two_contact_shooting;
 *  rawStreamSeed inlined as the control-stream seed for the outgoing gap). */
function rawStreamSeed2(prepared: PreparedTrajectoryFixtureCore, gapIndex: number, rowIndex: number): number {
  const rawStreamSeed = (Math.imul(prepared.panel.seed | 0, 1_000_003) + gapIndex + 1) | 0;
  return (Math.imul(rawStreamSeed, 1_000_003) + rowIndex + 1) | 0;
}

function unit(angleDeg: number): { x: number; y: number } {
  const radians = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function fmt(value: number | null): string {
  return value === null ? "n/a" : String(round3(value));
}

function assertExactEnvironment(): void {
  if (process.env.LR_ENGINE !== "wasm") {
    throw new Error(`study requires LR_ENGINE=wasm; received LR_ENGINE=${process.env.LR_ENGINE ?? "(unset)"}`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function round3(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

// ── Retained catch-frontier artifact shapes (only the fields this study reads).
type CatchFrontierRow = {
  index: number;
  family: CatchFrontierFamily;
  label: string;
  params: CatchParams | null;
  admitted: boolean;
  chainable?: boolean;
  impactErrSigned?: number | null;
};
type CatchFrontierArtifact = {
  schema?: string;
  provenance?: { fixtureFingerprint?: string };
  rows: CatchFrontierRow[];
};
