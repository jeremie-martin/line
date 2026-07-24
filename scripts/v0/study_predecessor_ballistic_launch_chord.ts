/**
 * Calibration-only exact reachability assay for the full-state ballistic
 * launch chord.  One chord replaces only the immediate predecessor fit; the
 * current and following ordinary streams remain fixed return tests.
 */
import { makeRng } from "../lib/rng.ts";
import { clearImpactTemplateMarker, hasPreTargetSledProximityFromTrace, sampleArcPlacementGeometry } from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { axisLookaheadEndFrame, detectWindow, tryCandidateLines } from "./core/candidate.ts";
import { airborneAt, engineLineFromTrackLine, type GapFit } from "./core/substrate.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { getCandidateProbe } from "./optimizer/sample.ts";
import type { Gap, TrackLine } from "./types.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson, type FrozenTrajectoryFixture } from "./trajectory/frozen_fixture.ts";
import { postimpactEngineCollisionWitnessesForLineIds } from "./trajectory/postimpact_trace.ts";
import { realizeFullStateBallisticLaunchChord, type FullStateBallisticLaunchChord } from "./trajectory/full_state_ballistic_launch_chord.ts";
import { extractPlanningState, type PlanningState } from "./trajectory/state.ts";
import { rebuildPhysicalPrefixEngine, type PhysicalPrefixFixture } from "./trajectory/study_fixture.ts";
import { prepareStateCoupledTrajectoryFixture, type PreparedTrajectoryFixtureCore } from "./trajectory/study_context.ts";
import { allocateStudyArtifactPath, studyArtifactIdentity, studySourceIdentity, writeImmutableJsonArtifact } from "./trajectory/study_artifact.ts";

const SCHEMA = "line.study-predecessor-ballistic-launch-chord.v1";
const FIXTURE_DIR = "generated/studies/trajectory-fixtures/current-2026-07-15/v3";
const FIXTURES = {
  dense240: "dense240-b500000-e8f074b651d9.json",
  ordinary: "ordinary-b500000-e71c85b5c2c2.json",
} as const;
const CURRENT_ATTEMPTS = 16;
const FOLLOWING_ATTEMPTS = 8;
const IMPACT_TOLERANCE = .05;
const MIN_SLED_ZERO_FRICTION_UPDATES = 3;
const MIN_RETURN_AIRBORNE_FRAMES = 6;

type StateId = keyof typeof FIXTURES;
type Topology = { peg: number; sledZeroFriction: number; feetZeroFriction: number; total: number };
type ReturnMeasure = { survivedToBeat: boolean; airborneMarginBeforeBeat: number; replayFrames: number };
type CurrentSummary = {
  attempted: number; available: number; admitted: number; impactAccurateDistributed: number;
  sixFrameReturns: number; coherent: number; followingAdmissions: number;
  bestImpactAbsError: number | null; maxSledZeroFriction: number; maxReturnAirborne: number; frames: number; errors: string[];
};
type StateResult = {
  id: StateId; artifactPath: string; predecessorGap: number; flightFrames: number; chord: FullStateBallisticLaunchChord;
  predecessor: { admitted: boolean; preTargetPreclearRejected: boolean | null; admissionFrames: number; preTouchdownState: PlanningState | null; error: string | null };
  current: CurrentSummary | null; chargedFrames: number; verdict: "retain-feasibility" | "retire"; reasons: string[];
};

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined => argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write("Usage: study_predecessor_ballistic_launch_chord.ts [--case=dense240|ordinary|all] [--out-dir=DIR]\\n");
  process.exit(0);
}
if (process.env.LR_ENGINE !== "wasm") throw new Error(`study requires LR_ENGINE=wasm; received ${process.env.LR_ENGINE ?? "(unset)"}`);
const supported = ["--case=", "--out-dir=", "--help", "-h"];
const unknown = argv.filter((value) => !supported.some((prefix) => value === prefix || value.startsWith(prefix)));
if (unknown.length > 0) throw new Error(`unsupported option(s): ${unknown.join(", ")}`);
const requested = argument("case") ?? "all";
const ids: readonly StateId[] = ["dense240", "ordinary"];
if (requested !== "all" && !ids.includes(requested as StateId)) throw new Error(`unknown --case=${requested}`);
const selected: readonly StateId[] = requested === "all" ? ids : [requested as StateId];
const outDir = argument("out-dir") ?? "generated/studies/predecessor-ballistic-launch-chord/v1";
const sourceIdentity = studySourceIdentity("scripts/v0/study_predecessor_ballistic_launch_chord.ts");
const observationCompiler = compilerCandidateIdentity("wasm");
const protocolFingerprint = sha256(stableJson({
  protocol: "predecessor-full-state-ballistic-launch-chord.v1", fixtures: FIXTURES,
  predecessor: "one passive two-segment full-body chord; collision plane is incoming/ballistic-launch angle bisector; chord span is two RMS normal radii",
  ballisticLaunch: "preserve collective speed; vy=-g*N/2 using only authored predecessor-to-current interval N",
  streams: { current: CURRENT_ATTEMPTS, following: FOLLOWING_ATTEMPTS },
  coherent: { impactAbsErrorAtMost: IMPACT_TOLERANCE, zeroFrictionSledUpdatesAtLeast: MIN_SLED_ZERO_FRICTION_UPDATES, returnAirborneFramesAtLeast: MIN_RETURN_AIRBORNE_FRAMES, normalFollowingAdmissionAtLeast: 1 },
}));

const started = performance.now();
let totalFrames = 0;
const results = selected.map(runState);
process.stdout.write([
  `predecessor ballistic launch chord: ${results.length} state(s), ${round(performance.now() - started)}ms; engine=wasm; charged frames ${totalFrames}`,
  ...results.map((result) => `${result.id}: ${result.verdict}; predecessor=${result.predecessor.admitted ? "admitted" : "rejected"}, preclear=${result.predecessor.preTargetPreclearRejected ?? "n/a"}, currentCoherent=${result.current?.coherent ?? 0}, currentAdmitted=${result.current?.admitted ?? 0}/${CURRENT_ATTEMPTS}; ${result.reasons.join("; ") || "all declared checks passed"}`),
].join("\n") + "\n");

function runState(id: StateId): StateResult {
  const fixturePath = `${FIXTURE_DIR}/${FIXTURES[id]}`;
  const fixture = readFrozenTrajectoryFixture(fixturePath);
  const prepared = prepareStateCoupledTrajectoryFixture(fixture);
  const predecessorGap = prepared.setup.gaps[prepared.current.index - 1];
  if (predecessorGap === undefined || !predecessorGap.endsWithContact) throw new Error(`fixture ${id} has no predecessor contact`);
  const prefix = prefixBeforeGap(fixture, predecessorGap.index);
  const engine = rebuildPhysicalPrefixEngine(prefix);
  const probe = getCandidateProbe(engine, predecessorGap, prepared.ctx);
  const state = extractPlanningState(engine, predecessorGap.endFrame);
  const flightFrames = prepared.current.endFrame - predecessorGap.endFrame;
  const chord = state === null
    ? { status: "unavailable", reason: "missing_full_sled_state" } as FullStateBallisticLaunchChord
    : realizeFullStateBallisticLaunchChord(state, flightFrames, prefix.prefixNextLineId);
  let chargedFrames = 0;
  const charge = (frames: number): void => { chargedFrames += frames; totalFrames += frames; };
  let predecessor: StateResult["predecessor"] = { admitted: false, preTargetPreclearRejected: null, admissionFrames: 0, preTouchdownState: null, error: null };
  let current: CurrentSummary | null = null;
  const reasons: string[] = [];
  if (chord.status !== "ready") {
    reasons.push(`construction unavailable: ${chord.reason}`);
  } else {
    const preTargetPreclearRejected = hasPreTargetSledProximityFromTrace(probe.preTargetSledTrace(), chord.lines);
    const before = getSimFrames();
    const fit = tryCandidateLines(engine, predecessorGap, chord.lines, prefix.prefixNextLineId, prepared.ctx.allContactFrames, axisLookaheadEndFrame(predecessorGap, prepared.ctx.allContactFrames), predecessorGap.targets, true, undefined, probe.preTargetSledTrace) as GapFit | null;
    const admissionFrames = getSimFrames() - before;
    charge(admissionFrames);
    if (fit === null) {
      predecessor = { admitted: false, preTargetPreclearRejected, admissionFrames, preTouchdownState: null, error: preTargetPreclearRejected ? "pre-target guard rejects predecessor chord" : "unchanged predecessor gate rejected chord" };
      reasons.push("predecessor chord not admitted");
    } else {
      const after = engine.addLine(fit.lines.map((line: TrackLine) => engineLineFromTrackLine(line)));
      const preTouchdownState = extractPlanningState(after, prepared.current.endFrame);
      predecessor = { admitted: true, preTargetPreclearRejected, admissionFrames, preTouchdownState, error: preTouchdownState === null ? "pre-touchdown state unreadable" : null };
      if (preTouchdownState === null) reasons.push("pre-touchdown state unreadable");
      else {
        current = evaluateCurrent(prepared, after, prefix.prefixNextLineId + fit.lines.length, charge);
        if (current.coherent === 0) reasons.push("no coherent unchanged current/following normal continuation");
      }
    }
  }
  const verdict: StateResult["verdict"] = reasons.length === 0 ? "retain-feasibility" : "retire";
  const artifactIdentity = studyArtifactIdentity({ schema: SCHEMA, fixtureFingerprint: fixture.fixtureFingerprint, studySourceFingerprint: sourceIdentity.studySourceFingerprint, observationCandidateFingerprint: observationCompiler.candidateFingerprint, protocolFingerprint });
  const artifactPath = allocateStudyArtifactPath(`${outDir}/${prepared.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}.json`);
  writeImmutableJsonArtifact(artifactPath, {
    schema: SCHEMA, artifactIdentity,
    purpose: [
      "Falsify one predecessor physical candidate basis that emits a finite full-state ballistic launch chord rather than an ordinary predecessor sample or a stationary current-contact surface.",
      "Current and following raw-normal streams are fixed exact return tests only; they do not choose or alter the predecessor chord.",
    ],
    status: { productionIntegration: "forbidden", cohortPolicy: "calibration only" }, argv: [...argv],
    provenance: { fixturePath, fixtureFingerprint: fixture.fixtureFingerprint, captureCompiler: fixture.captureCompiler, observationCompiler, runtime: { node: process.version, engine: "wasm" }, studySourceFingerprint: sourceIdentity.studySourceFingerprint, studySourceFiles: sourceIdentity.sourceFiles },
    panel: prepared.panel, fixtureReplay: prepared.replay,
    protocol: {
      continuousInputs: "complete PEG/TAIL/NOSE/STRING positions and velocities plus authored predecessor-to-current interval; no axes from current/following contacts",
      predecessorAdmission: "unchanged tryCandidateLines", currentAndFollowing: { currentAttempts: CURRENT_ATTEMPTS, followingAttempts: FOLLOWING_ATTEMPTS, admission: "unchanged tryCandidateLines" },
      coherent: { impactAbsErrorAtMost: IMPACT_TOLERANCE, zeroFrictionSledUpdatesAtLeast: MIN_SLED_ZERO_FRICTION_UPDATES, returnAirborneFramesAtLeast: MIN_RETURN_AIRBORNE_FRAMES, normalFollowingAdmissionAtLeast: 1 },
    },
    result: { id, predecessorGap: predecessorGap.index, flightFrames, chord, predecessor, current, chargedFrames, verdict, reasons },
  }, "predecessor ballistic launch chord artifact");
  return { id, artifactPath, predecessorGap: predecessorGap.index, flightFrames, chord, predecessor, current, chargedFrames, verdict, reasons };
}

function evaluateCurrent(prepared: PreparedTrajectoryFixtureCore, engine: any, lineIdStart: number, charge: (frames: number) => void): CurrentSummary {
  const errors: string[] = [];
  const beforeProbe = getSimFrames();
  let probe: ReturnType<typeof getCandidateProbe>;
  try { probe = getCandidateProbe(engine, prepared.current, prepared.ctx); } catch (error) {
    charge(getSimFrames() - beforeProbe);
    return emptyCurrent([errorMessage(error)]);
  }
  const probeFrames = getSimFrames() - beforeProbe;
  charge(probeFrames);
  const rng = makeRng(streamSeed(prepared, prepared.current, 0x4b31));
  const target = prepared.ctx.gapAxisTargets[prepared.current.index] ?? prepared.current.targets;
  const axisEnd = axisLookaheadEndFrame(prepared.current, prepared.ctx.allContactFrames);
  let available = 0, admitted = 0, impactAccurateDistributed = 0, sixFrameReturns = 0, coherent = 0, followingAdmissions = 0, maxSledZeroFriction = 0, maxReturnAirborne = 0, candidateFrames = 0;
  let bestImpactAbsError: number | null = null;
  for (let attempt = 0; attempt < CURRENT_ATTEMPTS; attempt++) {
    clearImpactTemplateMarker();
    let lines: TrackLine[];
    try {
      lines = sampleArcPlacementGeometry(rng, probe.refX, probe.refY, prepared.current.targets, probe.targetState, attempt, prepared.current, lineIdStart, "normal", prepared.ctx.allContactFrames).lines;
      available++;
    } catch (error) { errors.push(errorMessage(error)); continue; }
    const before = getSimFrames();
    const fit = tryCandidateLines(engine, prepared.current, lines, lineIdStart, prepared.ctx.allContactFrames, axisEnd, prepared.current.targets, true, undefined, probe.preTargetSledTrace) as GapFit | null;
    const frames = getSimFrames() - before;
    candidateFrames += frames;
    charge(frames);
    if (fit === null) continue;
    admitted++;
    const impact = (fit.achieved).impact;
    const impactAbsError = impact === undefined || target.impact === undefined ? null : Math.abs(impact - target.impact);
    if (impactAbsError !== null) bestImpactAbsError = bestImpactAbsError === null ? impactAbsError : Math.min(bestImpactAbsError, impactAbsError);
    const currentEngine = engine.addLine(fit.lines.map((line: TrackLine) => engineLineFromTrackLine(line)));
    const topology = targetTopology(currentEngine, prepared.current.endFrame, fit.lines);
    maxSledZeroFriction = Math.max(maxSledZeroFriction, topology?.sledZeroFriction ?? 0);
    const accurateDistributed = impactAbsError !== null && impactAbsError <= IMPACT_TOLERANCE && (topology?.sledZeroFriction ?? 0) >= MIN_SLED_ZERO_FRICTION_UPDATES;
    if (accurateDistributed) impactAccurateDistributed++;
    const returned = measureReturn(prepared, currentEngine, charge);
    maxReturnAirborne = Math.max(maxReturnAirborne, returned.airborneMarginBeforeBeat);
    const returns = returned.survivedToBeat && returned.airborneMarginBeforeBeat >= MIN_RETURN_AIRBORNE_FRAMES;
    if (returns) sixFrameReturns++;
    if (!accurateDistributed || !returns) continue;
    const next = evaluateFollowing(prepared, currentEngine, lineIdStart + fit.lines.length, charge);
    followingAdmissions += next.admitted;
    errors.push(...next.errors);
    if (next.admitted > 0) coherent++;
  }
  return { attempted: CURRENT_ATTEMPTS, available, admitted, impactAccurateDistributed, sixFrameReturns, coherent, followingAdmissions, bestImpactAbsError: bestImpactAbsError === null ? null : round(bestImpactAbsError), maxSledZeroFriction, maxReturnAirborne, frames: probeFrames + candidateFrames, errors };
}

function evaluateFollowing(prepared: PreparedTrajectoryFixtureCore, engine: any, lineIdStart: number, charge: (frames: number) => void): { admitted: number; errors: string[] } {
  const errors: string[] = [];
  const beforeProbe = getSimFrames();
  let probe: ReturnType<typeof getCandidateProbe>;
  try { probe = getCandidateProbe(engine, prepared.outgoing, prepared.ctx); } catch (error) {
    charge(getSimFrames() - beforeProbe);
    return { admitted: 0, errors: [errorMessage(error)] };
  }
  charge(getSimFrames() - beforeProbe);
  const rng = makeRng(streamSeed(prepared, prepared.outgoing, 0x8f21));
  const axisEnd = axisLookaheadEndFrame(prepared.outgoing, prepared.ctx.allContactFrames);
  let admitted = 0;
  for (let attempt = 0; attempt < FOLLOWING_ATTEMPTS; attempt++) {
    clearImpactTemplateMarker();
    try {
      const lines = sampleArcPlacementGeometry(rng, probe.refX, probe.refY, prepared.outgoing.targets, probe.targetState, attempt, prepared.outgoing, lineIdStart, "normal", prepared.ctx.allContactFrames).lines;
      const before = getSimFrames();
      const fit = tryCandidateLines(engine, prepared.outgoing, lines, lineIdStart, prepared.ctx.allContactFrames, axisEnd, prepared.outgoing.targets, true, undefined, probe.preTargetSledTrace) as GapFit | null;
      charge(getSimFrames() - before);
      if (fit !== null) admitted++;
    } catch (error) { errors.push(errorMessage(error)); }
  }
  return { admitted, errors };
}

function measureReturn(prepared: PreparedTrajectoryFixtureCore, engine: any, charge: (frames: number) => void): ReturnMeasure & { terminusFrame: number; terminusReason: string } {
  const before = getSimFrames();
  const detection = detectWindow(engine, prepared.current.endFrame, prepared.outgoing.endFrame + 1);
  const replayFrames = getSimFrames() - before;
  charge(replayFrames);
  const survivedToBeat = detection.terminus.frame >= prepared.outgoing.endFrame || detection.terminus.reason === "endOfSpec";
  let airborneMarginBeforeBeat = 0;
  for (let frame = prepared.outgoing.endFrame - 1; frame > prepared.current.endFrame; frame--) {
    if (airborneAt(detection, frame) !== true) break;
    airborneMarginBeforeBeat++;
  }
  return { survivedToBeat, airborneMarginBeforeBeat, replayFrames, terminusFrame: detection.terminus.frame, terminusReason: detection.terminus.reason };
}

function targetTopology(engine: any, frame: number, lines: readonly TrackLine[]): Topology | null {
  try {
    const ids = new Set(lines.map((line) => line.id));
    const points = postimpactEngineCollisionWitnessesForLineIds(engine, frame, ids).flatMap((hit) => hit.pointIds);
    return { peg: points.filter((point) => point === "PEG").length, sledZeroFriction: points.filter((point) => point === "TAIL" || point === "NOSE" || point === "STRING").length, feetZeroFriction: points.filter((point) => point === "LFOOT" || point === "RFOOT").length, total: points.length };
  } catch { return null; }
}

function prefixBeforeGap(fixture: FrozenTrajectoryFixture, gapIndex: number): PhysicalPrefixFixture {
  const all = fixture.physicalPrefix;
  if (!Number.isSafeInteger(gapIndex) || gapIndex < 0 || gapIndex >= all.prefixFitLines.length) throw new Error(`cannot derive predecessor prefix at gap ${gapIndex}`);
  const prefixFitLines = all.prefixFitLines.slice(0, gapIndex).map((lines) => lines === null ? null : lines.map((line) => ({ ...line })));
  const lineCount = all.startLines.length + prefixFitLines.reduce((count, lines) => count + (lines?.length ?? 0), 0);
  return { ...all, gapIndex, prefixNextLineId: 1 + lineCount, prefixFitLines };
}
function emptyCurrent(errors: string[]): CurrentSummary { return { attempted: 0, available: 0, admitted: 0, impactAccurateDistributed: 0, sixFrameReturns: 0, coherent: 0, followingAdmissions: 0, bestImpactAbsError: null, maxSledZeroFriction: 0, maxReturnAirborne: 0, frames: 0, errors }; }
function streamSeed(prepared: PreparedTrajectoryFixtureCore, gap: Gap, salt: number): number { return (Math.imul(prepared.panel.seed | 0, 1_000_003) + Math.imul(gap.index + 1, 8_191) + salt) | 0; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function round(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
