/**
 * Calibration-only atlas for predecessor-to-current full-state reachability.
 *
 * The study deliberately never changes current-contact geometry.  It samples
 * an ordinary predecessor, observes the resulting free state at the next beat,
 * then tests the unchanged normal streams at that current and following beat.
 */
import { makeRng } from "../lib/rng.ts";
import { clearImpactTemplateMarker, sampleArcPlacementGeometry } from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { axisLookaheadEndFrame, detectWindow, tryCandidateLines } from "./core/candidate.ts";
import { airborneAt, engineLineFromTrackLine, type GapFit } from "./core/substrate.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { getCandidateProbe } from "./optimizer/sample.ts";
import type { AxisValues, Gap, TrackLine } from "./types.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson, type FrozenTrajectoryFixture } from "./trajectory/frozen_fixture.ts";
import { postimpactEngineCollisionWitnessesForLineIds } from "./trajectory/postimpact_trace.ts";
import { rebuildPhysicalPrefixEngine, type PhysicalPrefixFixture } from "./trajectory/study_fixture.ts";
import { prepareStateCoupledTrajectoryFixture, type PreparedTrajectoryFixtureCore } from "./trajectory/study_context.ts";
import {
  allocateStudyArtifactPath,
  studyArtifactIdentity,
  studySourceIdentity,
  writeImmutableJsonArtifact,
} from "./trajectory/study_artifact.ts";
import { extractPlanningState, type PlanningState } from "./trajectory/state.ts";

const SCHEMA = "line.study-precontact-state-reachability.v1";
const FIXTURE_DIR = "generated/studies/trajectory-fixtures/current-2026-07-15/v3";
const FIXTURES = {
  dense240: "dense240-b500000-e8f074b651d9.json",
  ordinary: "ordinary-b500000-e71c85b5c2c2.json",
} as const;
const PREDECESSOR_ATTEMPTS = 16;
const CURRENT_ATTEMPTS = 16;
const FOLLOWING_ATTEMPTS = 8;
const IMPACT_TOLERANCE = .05;
const MIN_ZERO_FRICTION_SLED_UPDATES = 3;
const MIN_RETURN_AIRBORNE_FRAMES = 6;

type StateId = keyof typeof FIXTURES;

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_precontact_state_reachability.ts [--case=dense240|ordinary|all] [--out-dir=DIR]\\n" +
    "Fixed ordinary predecessor/current/following streams; calibration-only.\\n",
  );
  process.exit(0);
}
assertExactEnvironment();
const supportedOptions = ["--case=", "--out-dir=", "--help", "-h"];
const unknownOptions = argv.filter((value) => !supportedOptions.some((prefix) => value === prefix || value.startsWith(prefix)));
if (unknownOptions.length > 0) throw new Error(`unsupported option(s): ${unknownOptions.join(", ")}`);
const requestedCase = argument("case") ?? "all";
const stateIds: readonly StateId[] = ["dense240", "ordinary"];
if (requestedCase !== "all" && !stateIds.includes(requestedCase as StateId)) {
  throw new Error(`unknown --case=${requestedCase}; expected all|${stateIds.join("|")}`);
}
const selected: readonly StateId[] = requestedCase === "all" ? stateIds : [requestedCase as StateId];
const outDir = argument("out-dir") ?? "generated/studies/precontact-state-reachability/v1";
const sourceIdentity = studySourceIdentity("scripts/v0/study_precontact_state_reachability.ts");
const observationCompiler = compilerCandidateIdentity("wasm");
const protocolFingerprint = sha256(stableJson({
  protocol: "precontact-full-state-reachability.v1",
  fixtures: FIXTURES,
  streams: { predecessor: PREDECESSOR_ATTEMPTS, current: CURRENT_ATTEMPTS, following: FOLLOWING_ATTEMPTS },
  coherent: {
    impactAbsErrorAtMost: IMPACT_TOLERANCE,
    zeroFrictionSledUpdatesAtLeast: MIN_ZERO_FRICTION_SLED_UPDATES,
    returnAirborneFramesAtLeast: MIN_RETURN_AIRBORNE_FRAMES,
    normalFollowingAdmissionAtLeast: 1,
  },
  admission: "unchanged tryCandidateLines at every contact",
}));

const started = performance.now();
let totalFrames = 0;
const results = selected.map((id) => runState(id));
process.stdout.write([
  `precontact full-state reachability: ${results.length} state(s), ${round(performance.now() - started)}ms; engine=wasm; charged frames ${totalFrames}`,
  ...results.map(formatResult),
].join("\n") + "\n");

type ContactTopology = { peg: number; sledZeroFriction: number; feetZeroFriction: number; total: number };
type ReturnMeasure = {
  replayFrames: number;
  survivedToBeat: boolean;
  terminusFrame: number;
  terminusReason: string;
  airborneMarginBeforeBeat: number;
};
type FollowingMeasure = { attempted: number; available: number; admitted: number; frames: number; errors: string[] };
type CurrentSummary = {
  attempted: number;
  available: number;
  admitted: number;
  impactAccurateDistributed: number;
  sixFrameReturns: number;
  coherent: number;
  bestImpactAbsError: number | null;
  maxSledZeroFriction: number;
  maxReturnAirborneFrames: number;
  followingAdmissions: number;
  frames: number;
  errors: string[];
};
type PredecessorRow = {
  attempt: number;
  admitted: boolean;
  admissionFrames: number;
  preTouchdownState: PlanningState | null;
  current: CurrentSummary | null;
  error: string | null;
};
type StateResult = {
  id: StateId;
  artifactPath: string;
  panel: PreparedTrajectoryFixtureCore["panel"];
  predecessorGap: { index: number; endFrame: number };
  rows: PredecessorRow[];
  summary: {
    predecessorAttempted: number;
    predecessorAdmitted: number;
    coherentPredecessors: number;
    featureDistributions: Record<string, { coherent: NumberStats | null; noncoherent: NumberStats | null }>;
    verdict: "retain-feasibility" | "retire";
    reasons: string[];
  };
  chargedFrames: number;
};
type NumberStats = { count: number; min: number; median: number; max: number };

function runState(id: StateId): StateResult {
  const fixturePath = `${FIXTURE_DIR}/${FIXTURES[id]}`;
  const fixture = readFrozenTrajectoryFixture(fixturePath);
  const prepared = prepareStateCoupledTrajectoryFixture(fixture);
  if (prepared.panel.cohort !== "calibration") throw new Error(`fixture ${id} is not calibration`);
  const predecessorGap = prepared.setup.gaps[prepared.current.index - 1];
  if (predecessorGap === undefined || !predecessorGap.endsWithContact) {
    throw new Error(`fixture ${id} has no predecessor contact gap`);
  }
  const prefix = prefixBeforeGap(fixture, predecessorGap.index);
  const predecessorEngine = rebuildPhysicalPrefixEngine(prefix);
  const predecessorProbe = getCandidateProbe(predecessorEngine, predecessorGap, prepared.ctx);
  const predecessorLineId = prefix.prefixNextLineId;
  const predecessorAxisEnd = axisLookaheadEndFrame(predecessorGap, prepared.ctx.allContactFrames);
  const predecessorRng = makeRng(streamSeed(prepared, predecessorGap, 0x31a7));
  const rows: PredecessorRow[] = [];
  let chargedFrames = 0;
  const charge = (frames: number): void => { chargedFrames += frames; totalFrames += frames; };

  for (let attempt = 0; attempt < PREDECESSOR_ATTEMPTS; attempt++) {
    clearImpactTemplateMarker();
    let lines: TrackLine[];
    try {
      lines = sampleArcPlacementGeometry(
        predecessorRng,
        predecessorProbe.refX,
        predecessorProbe.refY,
        predecessorGap.targets,
        predecessorProbe.targetState,
        attempt,
        predecessorGap,
        predecessorLineId,
        "normal",
        prepared.ctx.allContactFrames,
      ).lines;
    } catch (error) {
      rows.push({ attempt, admitted: false, admissionFrames: 0, preTouchdownState: null, current: null, error: errorMessage(error) });
      continue;
    }
    const before = getSimFrames();
    const fit = tryCandidateLines(
      predecessorEngine,
      predecessorGap,
      lines,
      predecessorLineId,
      prepared.ctx.allContactFrames,
      predecessorAxisEnd,
      predecessorGap.targets,
      true,
      undefined,
      predecessorProbe.preTargetSledTrace,
    ) as GapFit | null;
    const admissionFrames = getSimFrames() - before;
    charge(admissionFrames);
    if (fit === null) {
      rows.push({ attempt, admitted: false, admissionFrames, preTouchdownState: null, current: null, error: "unchanged predecessor gate rejected" });
      continue;
    }
    const engineAfterPredecessor = predecessorEngine.addLine(fit.lines.map((line: TrackLine) => engineLineFromTrackLine(line)));
    const state = extractPlanningState(engineAfterPredecessor, prepared.current.endFrame);
    if (state === null) {
      rows.push({ attempt, admitted: true, admissionFrames, preTouchdownState: null, current: null, error: "full pre-touchdown state unreadable" });
      continue;
    }
    const current = evaluateCurrentStream(prepared, engineAfterPredecessor, predecessorLineId + fit.lines.length, attempt, charge);
    rows.push({ attempt, admitted: true, admissionFrames, preTouchdownState: state, current, error: null });
  }

  const coherentRows = rows.filter((row) => (row.current?.coherent ?? 0) > 0 && row.preTouchdownState !== null);
  const noncoherentRows = rows.filter((row) => row.admitted && (row.current?.coherent ?? 0) === 0 && row.preTouchdownState !== null);
  const featureDistributions = stateFeatureDistributions(coherentRows, noncoherentRows);
  const reasons: string[] = [];
  if (coherentRows.length === 0) reasons.push("no coherent pre-touchdown state in the fixed ordinary predecessor stream");
  const summary: StateResult["summary"] = {
    predecessorAttempted: PREDECESSOR_ATTEMPTS,
    predecessorAdmitted: rows.filter((row) => row.admitted).length,
    coherentPredecessors: coherentRows.length,
    featureDistributions,
    verdict: coherentRows.length > 0 ? "retain-feasibility" : "retire",
    reasons,
  };
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
      "Measure whether an ordinary predecessor can reach a full pre-touchdown state from which unchanged ordinary current and following contacts satisfy the distributed multi-contact return boundary.",
      "No row is selected, ranked, fed back into geometry, or connected to compiler identity.",
    ],
    status: { productionIntegration: "forbidden", cohortPolicy: "calibration only" },
    argv: [...argv],
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
      predecessorGap: predecessorGap.index,
      streams: { predecessor: PREDECESSOR_ATTEMPTS, current: CURRENT_ATTEMPTS, following: FOLLOWING_ATTEMPTS },
      currentGeometry: "unchanged ordinary sampleArcPlacementGeometry",
      coherent: {
        impactAbsErrorAtMost: IMPACT_TOLERANCE,
        zeroFrictionSledUpdatesAtLeast: MIN_ZERO_FRICTION_SLED_UPDATES,
        returnAirborneFramesAtLeast: MIN_RETURN_AIRBORNE_FRAMES,
        normalFollowingAdmissionAtLeast: 1,
      },
      admission: "unchanged tryCandidateLines at every contact",
    },
    chargedFrames,
    summary,
    rows,
  };
  const artifactPath = allocateStudyArtifactPath(`${outDir}/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}.json`);
  writeImmutableJsonArtifact(artifactPath, document, "precontact state reachability artifact");
  return { id, artifactPath, panel: prepared.panel, predecessorGap: { index: predecessorGap.index, endFrame: predecessorGap.endFrame }, rows, summary, chargedFrames };
}

function evaluateCurrentStream(
  prepared: PreparedTrajectoryFixtureCore,
  engine: any,
  lineIdStart: number,
  predecessorAttempt: number,
  charge: (frames: number) => void,
): CurrentSummary {
  const errors: string[] = [];
  const beforeProbe = getSimFrames();
  let probe: ReturnType<typeof getCandidateProbe>;
  try {
    probe = getCandidateProbe(engine, prepared.current, prepared.ctx);
  } catch (error) {
    charge(getSimFrames() - beforeProbe);
    return emptyCurrentSummary(errors.concat(errorMessage(error)));
  }
  const probeFrames = getSimFrames() - beforeProbe;
  charge(probeFrames);
  const rng = makeRng(streamSeed(prepared, prepared.current, 0x6d51 ^ predecessorAttempt));
  const target = prepared.ctx.gapAxisTargets[prepared.current.index] ?? prepared.current.targets;
  const axisEnd = axisLookaheadEndFrame(prepared.current, prepared.ctx.allContactFrames);
  let available = 0;
  let admitted = 0;
  let impactAccurateDistributed = 0;
  let sixFrameReturns = 0;
  let coherent = 0;
  let bestImpactAbsError: number | null = null;
  let maxSledZeroFriction = 0;
  let maxReturnAirborneFrames = 0;
  let followingAdmissions = 0;
  let candidateFrames = 0;
  for (let attempt = 0; attempt < CURRENT_ATTEMPTS; attempt++) {
    clearImpactTemplateMarker();
    let lines: TrackLine[];
    try {
      lines = sampleArcPlacementGeometry(
        rng,
        probe.refX,
        probe.refY,
        prepared.current.targets,
        probe.targetState,
        attempt,
        prepared.current,
        lineIdStart,
        "normal",
        prepared.ctx.allContactFrames,
      ).lines;
      available++;
    } catch (error) {
      errors.push(errorMessage(error));
      continue;
    }
    const before = getSimFrames();
    const fit = tryCandidateLines(
      engine,
      prepared.current,
      lines,
      lineIdStart,
      prepared.ctx.allContactFrames,
      axisEnd,
      prepared.current.targets,
      true,
      undefined,
      probe.preTargetSledTrace,
    ) as GapFit | null;
    const frames = getSimFrames() - before;
    candidateFrames += frames;
    charge(frames);
    if (fit === null) continue;
    admitted++;
    const achievedImpact = (fit.achieved).impact;
    const impactAbsError = achievedImpact === undefined || target.impact === undefined ? null : Math.abs(achievedImpact - target.impact);
    if (impactAbsError !== null) bestImpactAbsError = bestImpactAbsError === null ? impactAbsError : Math.min(bestImpactAbsError, impactAbsError);
    const currentEngine = engine.addLine(fit.lines.map((line: TrackLine) => engineLineFromTrackLine(line)));
    const topology = targetTopology(currentEngine, prepared.current.endFrame, fit.lines);
    maxSledZeroFriction = Math.max(maxSledZeroFriction, topology?.sledZeroFriction ?? 0);
    const impactAccurateAndDistributed = impactAbsError !== null && impactAbsError <= IMPACT_TOLERANCE &&
      topology !== null && topology.sledZeroFriction >= MIN_ZERO_FRICTION_SLED_UPDATES;
    if (impactAccurateAndDistributed) impactAccurateDistributed++;
    const returned = measureReturn(prepared, currentEngine, charge);
    maxReturnAirborneFrames = Math.max(maxReturnAirborneFrames, returned.airborneMarginBeforeBeat);
    const returns = returned.survivedToBeat && returned.airborneMarginBeforeBeat >= MIN_RETURN_AIRBORNE_FRAMES;
    if (returns) sixFrameReturns++;
    if (!impactAccurateAndDistributed || !returns) continue;
    const following = evaluateFollowingNormal(prepared, currentEngine, lineIdStart + fit.lines.length, charge);
    followingAdmissions += following.admitted;
    if (following.admitted > 0) coherent++;
    errors.push(...following.errors);
  }
  return {
    attempted: CURRENT_ATTEMPTS,
    available,
    admitted,
    impactAccurateDistributed,
    sixFrameReturns,
    coherent,
    bestImpactAbsError: bestImpactAbsError === null ? null : round(bestImpactAbsError),
    maxSledZeroFriction,
    maxReturnAirborneFrames,
    followingAdmissions,
    frames: probeFrames + candidateFrames,
    errors,
  };
}

function evaluateFollowingNormal(
  prepared: PreparedTrajectoryFixtureCore,
  engine: any,
  lineIdStart: number,
  charge: (frames: number) => void,
): FollowingMeasure {
  const errors: string[] = [];
  const beforeProbe = getSimFrames();
  let probe: ReturnType<typeof getCandidateProbe>;
  try {
    probe = getCandidateProbe(engine, prepared.outgoing, prepared.ctx);
  } catch (error) {
    charge(getSimFrames() - beforeProbe);
    return { attempted: 0, available: 0, admitted: 0, frames: 0, errors: [errorMessage(error)] };
  }
  const probeFrames = getSimFrames() - beforeProbe;
  charge(probeFrames);
  const rng = makeRng(streamSeed(prepared, prepared.outgoing, 0x95d7));
  const axisEnd = axisLookaheadEndFrame(prepared.outgoing, prepared.ctx.allContactFrames);
  let available = 0;
  let admitted = 0;
  let framesTotal = 0;
  for (let attempt = 0; attempt < FOLLOWING_ATTEMPTS; attempt++) {
    clearImpactTemplateMarker();
    let lines: TrackLine[];
    try {
      lines = sampleArcPlacementGeometry(
        rng, probe.refX, probe.refY, prepared.outgoing.targets, probe.targetState,
        attempt, prepared.outgoing, lineIdStart, "normal", prepared.ctx.allContactFrames,
      ).lines;
      available++;
    } catch (error) {
      errors.push(errorMessage(error));
      continue;
    }
    const before = getSimFrames();
    const fit = tryCandidateLines(
      engine, prepared.outgoing, lines, lineIdStart, prepared.ctx.allContactFrames, axisEnd,
      prepared.outgoing.targets, true, undefined, probe.preTargetSledTrace,
    ) as GapFit | null;
    const frames = getSimFrames() - before;
    framesTotal += frames;
    charge(frames);
    if (fit !== null) admitted++;
  }
  return { attempted: FOLLOWING_ATTEMPTS, available, admitted, frames: probeFrames + framesTotal, errors };
}

function measureReturn(prepared: PreparedTrajectoryFixtureCore, engine: any, charge: (frames: number) => void): ReturnMeasure {
  const before = getSimFrames();
  const detection = detectWindow(engine, prepared.current.endFrame, prepared.outgoing.endFrame + 1);
  const replayFrames = getSimFrames() - before;
  charge(replayFrames);
  const survivedToBeat = detection.terminus.frame >= prepared.outgoing.endFrame || detection.terminus.reason === "endOfSpec";
  let airborneMarginBeforeBeat = 0;
  for (let frame = prepared.outgoing.endFrame - 1; frame > prepared.current.endFrame; frame--) {
    if (airborneAt(detection, frame) === true) airborneMarginBeforeBeat++;
    else break;
  }
  return {
    replayFrames,
    survivedToBeat,
    terminusFrame: detection.terminus.frame,
    terminusReason: detection.terminus.reason,
    airborneMarginBeforeBeat,
  };
}

function targetTopology(engine: any, frame: number, lines: readonly TrackLine[]): ContactTopology | null {
  try {
    const lineIds = new Set(lines.map((line) => line.id));
    const points = postimpactEngineCollisionWitnessesForLineIds(engine, frame, lineIds).flatMap((hit) => hit.pointIds);
    return {
      peg: points.filter((point) => point === "PEG").length,
      sledZeroFriction: points.filter((point) => point === "TAIL" || point === "NOSE" || point === "STRING").length,
      feetZeroFriction: points.filter((point) => point === "LFOOT" || point === "RFOOT").length,
      total: points.length,
    };
  } catch {
    return null;
  }
}

function prefixBeforeGap(fixture: FrozenTrajectoryFixture, gapIndex: number): PhysicalPrefixFixture {
  const all = fixture.physicalPrefix;
  if (!Number.isSafeInteger(gapIndex) || gapIndex < 0 || gapIndex >= all.prefixFitLines.length) {
    throw new Error(`cannot derive predecessor prefix at gap ${gapIndex}`);
  }
  const prefixFitLines = all.prefixFitLines.slice(0, gapIndex).map((lines) => lines === null ? null : lines.map((line) => ({ ...line })));
  const lineCount = all.startLines.length + prefixFitLines.reduce((count, lines) => count + (lines?.length ?? 0), 0);
  return {
    ...all,
    gapIndex,
    prefixNextLineId: 1 + lineCount,
    prefixFitLines,
  };
}

function emptyCurrentSummary(errors: string[]): CurrentSummary {
  return {
    attempted: 0, available: 0, admitted: 0, impactAccurateDistributed: 0, sixFrameReturns: 0,
    coherent: 0, bestImpactAbsError: null, maxSledZeroFriction: 0, maxReturnAirborneFrames: 0,
    followingAdmissions: 0, frames: 0, errors,
  };
}

function streamSeed(prepared: PreparedTrajectoryFixtureCore, gap: Gap, salt: number): number {
  return (Math.imul(prepared.panel.seed | 0, 1_000_003) + Math.imul(gap.index + 1, 8_191) + salt) | 0;
}

function stateFeatureDistributions(
  coherent: readonly PredecessorRow[],
  noncoherent: readonly PredecessorRow[],
): Record<string, { coherent: NumberStats | null; noncoherent: NumberStats | null }> {
  const feature = (row: PredecessorRow): Record<string, number> => {
    const state = row.preTouchdownState!;
    return {
      speed: state.speed,
      velocityX: state.velocity.x,
      velocityY: state.velocity.y,
      comHeadingDeg: state.velocityAngleDeg,
      sledPoseDeg: state.sledPoseDeg ?? NaN,
      sledPoseRateDegPerFrame: state.sledPoseRateDegPerFrame ?? NaN,
      referenceVelocityX: state.referenceVelocity?.x ?? NaN,
      referenceVelocityY: state.referenceVelocity?.y ?? NaN,
      airborneAgeFrames: state.phase.airborneAgeFrames,
      groundedAgeFrames: state.phase.groundedAgeFrames,
    };
  };
  const names = [
    "speed", "velocityX", "velocityY", "comHeadingDeg", "sledPoseDeg",
    "sledPoseRateDegPerFrame", "referenceVelocityX", "referenceVelocityY",
    "airborneAgeFrames", "groundedAgeFrames",
  ];
  return Object.fromEntries(names.map((name) => [name, {
    coherent: numberStats(coherent.map((row) => feature(row)[name]!).filter(Number.isFinite)),
    noncoherent: numberStats(noncoherent.map((row) => feature(row)[name]!).filter(Number.isFinite)),
  }]));
}

function numberStats(values: readonly number[]): NumberStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return {
    count: sorted.length,
    min: round(sorted[0]!),
    median: round(sorted[Math.floor((sorted.length - 1) / 2)]!),
    max: round(sorted[sorted.length - 1]!),
  };
}

function formatResult(result: StateResult): string {
  return `${result.id}: ${result.summary.verdict}; predecessor ${result.summary.predecessorAdmitted}/${PREDECESSOR_ATTEMPTS}, ` +
    `coherent ${result.summary.coherentPredecessors}; ${result.summary.reasons.join("; ") || "fixed stream reaches at least one coherent state"}`;
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
