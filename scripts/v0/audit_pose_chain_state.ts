/**
 * Read-only pose-state audit for ordinary five-contact chains on frozen
 * believer fixtures.  It contains no candidate modification or chooser.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { makeRng } from "../lib/rng.ts";
import { sampleArcPlacementGeometry } from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { axisLookaheadEndFrame, tryCandidateLines } from "./core/candidate.ts";
import { engineLineFromTrackLine, type GapFit } from "./core/substrate.ts";
import { getCandidateProbe } from "./optimizer/sample.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { type Gap } from "./types.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import { extractPlanningState } from "./trajectory/state.ts";
import { prepareStateCoupledTrajectoryFixture, type PreparedTrajectoryFixtureCore } from "./trajectory/study_context.ts";
import { allocateStudyArtifactPath, studyArtifactIdentity, studySourceIdentity, writeImmutableJsonArtifact } from "./trajectory/study_artifact.ts";

const SCHEMA = "line.audit-pose-chain-state.v1";
const FIXTURE_DIR = "generated/studies/trajectory-fixtures/grade-continuity-2026-07-17/v3";
const FIXTURES = {
  believer36: "believer36-b500000-d7aec722a976.json",
  believer69: "believer69-b500000-24448183619b.json",
} as const;
type StateId = keyof typeof FIXTURES;
const CHAIN_CONTACTS = 5;
const CANDIDATES_PER_CONTACT = 24;
const DEFAULT_TRIALS = 96;
const STATE_FRAME_BUDGET = 1_000_000;

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined => argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write("Usage: audit_pose_chain_state.ts [--case=believer36|believer69|all] [--trials=96] [--out-dir=PATH]\n");
  process.exit(0);
}
if (process.env.LR_ENGINE !== "wasm") throw new Error("pose-chain audit requires LR_ENGINE=wasm");
const supported = ["--case=", "--trials=", "--out-dir=", "--help", "-h"];
const unknown = argv.filter((value) => !supported.some((prefix) => value === prefix || value.startsWith(prefix)));
if (unknown.length > 0) throw new Error(`unsupported option(s): ${unknown.join(", ")}`);
const requested = argument("case") ?? "all";
if (requested !== "all" && !(requested in FIXTURES)) throw new Error(`unknown --case=${requested}`);
const trials = Number(argument("trials") ?? DEFAULT_TRIALS);
if (!Number.isSafeInteger(trials) || trials < 8 || trials > 256) throw new Error(`--trials must be an integer in [8, 256]`);
const selected: readonly StateId[] = requested === "all" ? ["believer36", "believer69"] : [requested as StateId];
const outDir = argument("out-dir") ?? "generated/studies/pose-chain-state/v1";

type PoseState = { poseDeg: number | null; poseRateDegPerFrame: number | null; axisMismatchDeg: number | null };
type StateObservation = {
  trial: number;
  depth: number;
  gapIndex: number;
  pose: PoseState;
  viable: number;
  selectedAttempt: number | null;
  selectedCost: number | null;
  chargedFrames: number;
  remainingChainComplete: boolean;
};
type Trial = { trial: number; completedContacts: number; chargedFrames: number; states: StateObservation[] };
type MetricSummary = { readableStates: number; strata: number; low: { n: number; complete: number; rate: number | null }; high: { n: number; complete: number; rate: number | null }; lowOverHighCompletionRatio: number | null; byDepth: Array<{ depth: number; n: number; lowRate: number | null; highRate: number | null; lowOverHighRatio: number | null }> };

const sourceIdentity = studySourceIdentity("scripts/v0/audit_pose_chain_state.ts");
const observationCompiler = compilerCandidateIdentity("wasm");
const protocolFingerprint = sha256(stableJson({
  protocol: "ordinary-local-cost pose-state descriptive audit",
  chainContacts: CHAIN_CONTACTS,
  candidatesPerContact: CANDIDATES_PER_CONTACT,
  trials,
  depthStrata: "within frozen fixture and contact depth; lower/upper empirical quartiles of each metric",
  stateFrameBudget: STATE_FRAME_BUDGET,
}));

const started = performance.now();
const results = selected.map(runFixture);
for (const result of results) {
  const mismatch = result.summary.axisMismatch;
  const rate = result.summary.absPoseRate;
  process.stdout.write(`${result.id}: complete ${result.summary.completeChains}/${result.summary.trials}; ` +
    `mismatch low/high ${fmt(mismatch.low.rate)}/${fmt(mismatch.high.rate)} ratio ${fmt(mismatch.lowOverHighCompletionRatio)}; ` +
    `rate low/high ${fmt(rate.low.rate)}/${fmt(rate.high.rate)} ratio ${fmt(rate.lowOverHighCompletionRatio)}; frames ${result.chargedFrames}\n`);
}
process.stdout.write(`pose-chain audit: ${results.length} fixture(s), ${Math.round(performance.now() - started)}ms\n`);

function runFixture(id: StateId) {
  const fixturePath = `${FIXTURE_DIR}/${FIXTURES[id]}`;
  const fixture = readFrozenTrajectoryFixture(fixturePath);
  const prepared = prepareStateCoupledTrajectoryFixture(fixture);
  if (prepared.panel.cohort !== "calibration") throw new Error(`${id}: expected calibration fixture`);
  let chargedFrames = 0;
  const trialsOut: Trial[] = [];
  for (let trial = 0; trial < trials && chargedFrames < STATE_FRAME_BUDGET; trial++) {
    const row = runTrial(prepared, trial);
    chargedFrames += row.chargedFrames;
    trialsOut.push(row);
  }
  const states = trialsOut.flatMap((row) => row.states);
  const summary = {
    trials: trialsOut.length,
    completeChains: trialsOut.filter((row) => row.completedContacts === CHAIN_CONTACTS).length,
    fixtureReplay: prepared.replay,
    poseReadableStates: states.filter((row) => row.pose.axisMismatchDeg !== null && row.pose.poseRateDegPerFrame !== null).length,
    totalStates: states.length,
    axisMismatch: summarizeMetric(states, (row) => row.pose.axisMismatchDeg),
    absPoseRate: summarizeMetric(states, (row) => row.pose.poseRateDegPerFrame === null ? null : Math.abs(row.pose.poseRateDegPerFrame)),
  };
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
    purpose: "Read-only association audit: ordinary normal candidate stream and exact local-cost choice only; pose is never read by candidate construction or selection.",
    provenance: {
      fixturePath, fixtureFingerprint: fixture.fixtureFingerprint, captureCompiler: fixture.captureCompiler,
      observationCompiler, runtime: { node: process.version, engine: "wasm" },
      studySourceFingerprint: sourceIdentity.studySourceFingerprint, studySourceFiles: sourceIdentity.sourceFiles,
    },
    protocol: {
      chainContacts: CHAIN_CONTACTS, candidatesPerContact: CANDIDATES_PER_CONTACT,
      candidateStream: "ordinary sampleArcPlacementGeometry normal stream; no geometry transformation",
      choice: "minimum exact admitted GapFit.cost, stable attempt order on ties",
      pose: "TAIL-to-NOSE pose, one-frame pose rate, and modulo-180 axis mismatch to COM velocity at the exact target frame",
      association: "remaining completion is stratified by fixture and contact depth before lower/upper empirical-quartile comparison",
    },
    chargedFrames,
    budgetExhausted: chargedFrames >= STATE_FRAME_BUDGET,
    summary,
    trials: trialsOut,
  };
  const artifactPath = allocateStudyArtifactPath(`${outDir}/${id}-${fixture.fixtureFingerprint.slice(0, 12)}.json`);
  writeImmutableJsonArtifact(artifactPath, artifact, "pose-chain-state artifact");
  return { id, artifactPath, chargedFrames, summary };
}

function runTrial(prepared: PreparedTrajectoryFixtureCore, trial: number): Trial {
  let engine = prepared.engine;
  let lineIdStart = prepared.lineIdStart;
  const states: StateObservation[] = [];
  let completed = 0;
  for (let depth = 0; depth < CHAIN_CONTACTS; depth++) {
    const gap = prepared.setup.gaps[prepared.current.index + depth];
    if (gap === undefined || !gap.endsWithContact) break;
    const planning = extractPlanningState(engine, gap.endFrame);
    const pose = readPose(planning);
    const probe = getCandidateProbe(engine, gap, prepared.ctx);
    const rng = makeRng((Math.imul((trial + 1) | 0, 1_000_003) + gap.index + 1) | 0);
    const axisEnd = axisLookaheadEndFrame(gap, prepared.ctx.allContactFrames);
    let chosen: { fit: GapFit; attempt: number } | null = null;
    let viable = 0;
    let chargedFrames = 0;
    for (let attempt = 0; attempt < CANDIDATES_PER_CONTACT; attempt++) {
      const geometry = sampleArcPlacementGeometry(rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap, lineIdStart, "normal", prepared.ctx.allContactFrames);
      const before = getSimFrames();
      const fit = tryCandidateLines(engine, gap, geometry.lines, lineIdStart, prepared.ctx.allContactFrames, axisEnd, gap.targets, true, undefined, probe.preTargetSledTrace) as GapFit | null;
      chargedFrames += getSimFrames() - before;
      if (fit === null) continue;
      viable++;
      if (chosen === null || fit.cost < chosen.fit.cost) chosen = { fit, attempt };
    }
    states.push({ trial, depth, gapIndex: gap.index, pose, viable, selectedAttempt: chosen?.attempt ?? null, selectedCost: chosen === null ? null : round(chosen.fit.cost), chargedFrames, remainingChainComplete: false });
    if (chosen === null) break;
    engine = engine.addLine(chosen.fit.lines.map((line) => engineLineFromTrackLine(line)));
    lineIdStart += chosen.fit.lines.length;
    completed++;
  }
  const complete = completed === CHAIN_CONTACTS;
  for (const state of states) state.remainingChainComplete = complete;
  return { trial, completedContacts: completed, chargedFrames: states.reduce((sum, state) => sum + state.chargedFrames, 0), states };
}

function readPose(state: ReturnType<typeof extractPlanningState>): PoseState {
  if (state === null || state.sledPoseDeg === null || state.sledPoseRateDegPerFrame === null) {
    return { poseDeg: state?.sledPoseDeg ?? null, poseRateDegPerFrame: state?.sledPoseRateDegPerFrame ?? null, axisMismatchDeg: null };
  }
  return {
    poseDeg: round(state.sledPoseDeg),
    poseRateDegPerFrame: round(state.sledPoseRateDegPerFrame),
    axisMismatchDeg: round(axisDifferenceDeg(state.sledPoseDeg, state.velocityAngleDeg)),
  };
}

function summarizeMetric(rows: readonly StateObservation[], metric: (row: StateObservation) => number | null): MetricSummary {
  const byDepth = new Map<number, StateObservation[]>();
  for (const row of rows) {
    if (row.depth === 0 || metric(row) === null) continue;
    const entries = byDepth.get(row.depth) ?? [];
    entries.push(row);
    byDepth.set(row.depth, entries);
  }
  const low: boolean[] = [];
  const high: boolean[] = [];
  const detail: MetricSummary["byDepth"] = [];
  for (const [depth, entries] of [...byDepth.entries()].sort(([left], [right]) => left - right)) {
    const values = entries.map(metric).filter((value): value is number => value !== null).sort((left, right) => left - right);
    if (values.length < 8 || values[0] === values.at(-1)) continue;
    const q1 = quantile(values, 0.25);
    const q3 = quantile(values, 0.75);
    const lowRows = entries.filter((row) => metric(row)! <= q1);
    const highRows = entries.filter((row) => metric(row)! >= q3);
    const lowRate = rate(lowRows.map((row) => row.remainingChainComplete));
    const highRate = rate(highRows.map((row) => row.remainingChainComplete));
    low.push(...lowRows.map((row) => row.remainingChainComplete));
    high.push(...highRows.map((row) => row.remainingChainComplete));
    detail.push({ depth, n: entries.length, lowRate, highRate, lowOverHighRatio: ratio(lowRate, highRate) });
  }
  const lowRate = rate(low);
  const highRate = rate(high);
  return {
    readableStates: rows.filter((row) => metric(row) !== null).length,
    strata: detail.length,
    low: { n: low.length, complete: low.filter(Boolean).length, rate: lowRate },
    high: { n: high.length, complete: high.filter(Boolean).length, rate: highRate },
    lowOverHighCompletionRatio: ratio(lowRate, highRate),
    byDepth: detail,
  };
}

function axisDifferenceDeg(left: number, right: number): number {
  const delta = Math.abs(wrapDeg(left - right));
  return Math.min(delta, Math.abs(180 - delta));
}
function wrapDeg(value: number): number { return ((value + 180) % 360 + 360) % 360 - 180; }
function quantile(values: readonly number[], fraction: number): number { return values[Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * fraction)))]!; }
function rate(values: readonly boolean[]): number | null { return values.length === 0 ? null : round(values.filter(Boolean).length / values.length); }
function ratio(numerator: number | null, denominator: number | null): number | null { return numerator === null || denominator === null || denominator <= 0 ? null : round(numerator / denominator); }
function fmt(value: number | null): string { return value === null ? "n/a" : value.toFixed(3); }
function round(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
