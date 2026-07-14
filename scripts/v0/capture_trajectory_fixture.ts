/**
 * Capture a frozen physical-prefix fixture for a trajectory-synthesis study.
 *
 * This is intentionally separate from an observation study: capture is the
 * one place allowed to select a prefix from the current compiler. Subsequent
 * comparisons rebuild the serialized engine and refuse a mismatched source or
 * target checkpoint.
 */
import { join } from "node:path";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { compilerCandidateIdentity, type CompilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { fingerprintFiles } from "./benchmark_v2/suite_model.ts";
import { getCandidateProbe } from "./optimizer/sample.ts";
import {
  compileHandoff,
  setForwardEvalContext,
  type HandoffNode,
  type HandoffNodeEvent,
} from "./optimizer/handoff.ts";
import type { LeafKey } from "./optimizer/register.ts";
import { nextContactGap } from "./optimizer/objective.ts";
import { scoreDriftReport } from "./score.ts";
import { FPS } from "./types.ts";
import {
  buildTrajectoryPanelSetup,
  activeTrajectoryPanelCases,
  assertActiveTrajectoryPanel,
  assertTrajectoryCalibrationProtocol,
  getTrajectoryPanelCase,
  materializeTrajectoryPanelInput,
  TRAJECTORY_CALIBRATION_PROTOCOL,
  type ActiveTrajectoryPanelCohort,
  type TrajectoryPanelCase,
} from "./trajectory/panel.ts";
import {
  frozenFixtureCaptureArtifactIdentity,
  fixtureFingerprintForPayload,
  sha256,
  stableJson,
  type FrozenTrajectoryFixtureV3,
  type FrozenFixtureCaptureArtifactIdentity,
} from "./trajectory/frozen_fixture.ts";
import { extractPlanningState, type PlanningState } from "./trajectory/state.ts";
import {
  makePhysicalPrefixFixture,
  rebuildPhysicalPrefixEngine,
} from "./trajectory/study_fixture.ts";
import { activeStudyEngine } from "./trajectory/study_runtime.ts";
import {
  allocateStudyArtifactPath,
  assertStudyArtifactPathUnused,
  forensicDriftArtifactPath,
  studySourceIdentity,
  writeImmutableJsonArtifact,
} from "./trajectory/study_artifact.ts";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: capture_trajectory_fixture.ts --case=NAME|all [--cohort=calibration|validation] [--budget=500000] [--out=FILE] [--out-dir=DIR]",
    "",
    "Captures a current compiler prefix once, then serializes enough physical and",
    "provenance state for later trajectory studies to replay it without search.",
    "--out is valid for one case; --out-dir is used for --case=all. `all` defaults to the calibration cohort.",
    "New captures write immutable V3 records addressed by start provenance; an occupied --out is rejected before compilation.",
    "For --case=all, source, compiler, and every declared panel input are frozen and rechecked before each compile.",
    "V2 fixtures remain readable archival inputs but are never rewritten or upgraded in place.",
    "A requested cohort with no active rows is an error; V2 reserve rows are quarantined, not validation.",
  ].join("\n") + "\n");
  process.exit(0);
}

type Visit = { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent };

const caseArgument = argument("case");
if (caseArgument === undefined) throw new Error("--case=NAME|all is required");
const cohortArgument = argument("cohort") ?? "calibration";
if (cohortArgument !== "calibration" && cohortArgument !== "validation") {
  throw new Error(`unknown --cohort=${cohortArgument}; expected calibration or validation`);
}
const cohort = cohortArgument as ActiveTrajectoryPanelCohort;
const budget = integerArgument("budget", TRAJECTORY_CALIBRATION_PROTOCOL.captureBudget);
if (budget <= 0) throw new Error(`invalid --budget=${budget}`);
const selectedPanels = caseArgument === "all"
  ? activeTrajectoryPanelCases(cohort)
  : [getTrajectoryPanelCase(caseArgument)];
if (selectedPanels.length === 0) {
  throw new Error(
    `no active ${cohort} trajectory panels are declared; old V2 reserve rows are quarantined and a new cohort must be declared first`,
  );
}
if (caseArgument !== "all") assertActiveTrajectoryPanel(selectedPanels[0]!, "trajectory fixture capture");
if (caseArgument !== "all" && selectedPanels[0]!.cohort !== cohort) {
  throw new Error(`panel ${caseArgument} belongs to ${selectedPanels[0]!.cohort}, not --cohort=${cohort}`);
}
const captureEnvironment = relevantEnvironment();
const captureEngine = activeStudyEngine();
assertTrajectoryCalibrationProtocol({
  engine: captureEngine,
  captureBudget: budget,
  relevantEnvironment: captureEnvironment,
}, "trajectory fixture capture");
const explicitOut = argument("out");
if (explicitOut !== undefined && selectedPanels.length !== 1) {
  throw new Error("--out is only valid when capturing one panel; use --out-dir for --case=all");
}
if (explicitOut !== undefined) assertStudyArtifactPathUnused(explicitOut);
const outDir = argument("out-dir") ?? "generated/studies/trajectory-fixtures";
const sourceIdentityAtStart = studySourceIdentity("scripts/v0/capture_trajectory_fixture.ts");
const captureCompilerAtStart = compilerCandidateIdentity(captureEngine);
const panelSourceFingerprintsAtStart = new Map(
  selectedPanels.map((panel) => [panel.id, fingerprintFiles([panel.sourcePath])]),
);

for (const panel of selectedPanels) {
  const panelSourceFingerprintAtStart = panelSourceFingerprintsAtStart.get(panel.id);
  if (panelSourceFingerprintAtStart === undefined) {
    throw new Error(`missing frozen session source fingerprint for ${panel.id}`);
  }
  const currentSourceIdentity = studySourceIdentity("scripts/v0/capture_trajectory_fixture.ts");
  const currentCaptureCompiler = compilerCandidateIdentity(captureEngine);
  const currentPanelSourceFingerprint = fingerprintFiles([panel.sourcePath]);
  assertCaptureSessionStable(
    panel,
    currentSourceIdentity,
    currentCaptureCompiler,
    currentPanelSourceFingerprint,
    panelSourceFingerprintAtStart,
  );
  const captureIdentity = captureIdentityFor(panel, panelSourceFingerprintAtStart);
  const canonicalOutPath = explicitOut ?? join(
    outDir,
    "v3",
    `${panel.id}-b${budget}-${captureIdentity.fingerprint.slice(0, 12)}.json`,
  );
  const normalOutPath = explicitOut ?? allocateStudyArtifactPath(canonicalOutPath);
  const fixture = capturePanel(panel, budget, captureIdentity, currentSourceIdentity, currentCaptureCompiler);
  const outPath = fixture.capture.identityCheck.stable
    ? normalOutPath
    : allocateStudyArtifactPath(forensicDriftArtifactPath(
      canonicalOutPath,
      fixture.capture.identityCheck.studySourceFingerprintAtEnd,
      fixture.capture.identityCheck.captureCandidateFingerprintAtEnd,
      fixture.capture.identityCheck.panelSourceFingerprintAtEnd,
    ));
  writeImmutableJsonArtifact(outPath, fixture, "frozen trajectory fixture");
  process.stderr.write(
    `fixture ${panel.id}: g${fixture.panel.selectedTargetGap}->g${fixture.panel.outgoingGap} ` +
    `(${fixture.panel.outgoingIntervalFrames} frames) -> ${outPath}\n`,
  );
  if (!fixture.capture.identityCheck.stable) {
    process.stderr.write(`fixture ${panel.id} invalid: source or compiler identity drift\n`);
    process.exitCode = 2;
    break;
  }
}

function capturePanel(
  panel: TrajectoryPanelCase,
  captureBudget: number,
  captureIdentity: FrozenFixtureCaptureArtifactIdentity,
  sourceIdentityAtStart: ReturnType<typeof studySourceIdentity>,
  captureCompilerAtStart: CompilerCandidateIdentity,
): FrozenTrajectoryFixtureV3 {
  const started = performance.now();
  const setup = buildTrajectoryPanelSetup(panel);
  setForwardEvalContext(setup.spec, setup.gapAxisTargets);
  const visits: Visit[] = [];
  const baseline = compileHandoff(setup.spec, panel.seed, {
    budget: captureBudget,
    onNode(node, key, event) {
      visits.push({ node, key, event });
    },
  });
  const deepest = deepestUnskippedVisit(visits);
  if (deepest === null) throw new Error(`${panel.id}: no unskipped prefix was captured`);
  const visit = exactVisitOnDeepestPath(visits, deepest, panel.targetGap);
  if (visit === null) {
    throw new Error(`${panel.id}: requested g${panel.targetGap} is not on the captured deepest path`);
  }
  const current = setup.gaps[visit.node.search.gapIndex];
  if (current === undefined || !current.endsWithContact) {
    throw new Error(`${panel.id}: selected g${panel.targetGap} is not a contact gap`);
  }
  const outgoing = nextContactGap(current, setup.gaps);
  if (outgoing === null || outgoing.startFrame !== current.endFrame || !outgoing.endsWithContact) {
    throw new Error(`${panel.id}: g${current.index} has no contiguous outgoing contact interval`);
  }
  const outgoingIntervalFrames = outgoing.endFrame - outgoing.startFrame;
  if (panel.expectedOutgoingFrames !== undefined && outgoingIntervalFrames !== panel.expectedOutgoingFrames) {
    throw new Error(
      `${panel.id}: outgoing interval ${outgoingIntervalFrames} != declared ${panel.expectedOutgoingFrames}`,
    );
  }

  const physicalPrefix = makePhysicalPrefixFixture(visit.node);
  const physicalPrefixFingerprint = sha256(stableJson(physicalPrefix));
  const originalEngine = visit.node.search.prefixEngine;
  const replayEngine = rebuildPhysicalPrefixEngine(physicalPrefix);
  const originalProbe = getCandidateProbe(originalEngine, current, {
    allContactFrames: setup.allContactFrames,
    durationFrames: setup.durationFrames,
    gapAxisTargets: setup.gapAxisTargets,
  });
  const replayProbe = getCandidateProbe(replayEngine, current, {
    allContactFrames: setup.allContactFrames,
    durationFrames: setup.durationFrames,
    gapAxisTargets: setup.gapAxisTargets,
  });
  const originalState = requirePlanningState(originalEngine, current.endFrame, `${panel.id} original`);
  const replayState = requirePlanningState(replayEngine, current.endFrame, `${panel.id} replay`);
  const originalTrace = originalProbe.preTargetSledTrace();
  const replayTrace = replayProbe.preTargetSledTrace();
  assertStableEqual(`${panel.id} target planning state`, originalState, replayState);
  assertStableEqual(`${panel.id} target probe state`, originalProbe.targetState, replayProbe.targetState);
  assertStableEqual(`${panel.id} pre-target sled trace`, originalTrace, replayTrace);

  const materialized = materializeTrajectoryPanelInput(setup);
  const materializedFingerprint = sha256(stableJson(materialized));
  const report = scoreDriftReport(baseline.report, { totalFrames: Math.round(setup.spec.duration * FPS) });
  const panelSourceFingerprintAtEnd = fingerprintFiles([panel.sourcePath]);
  const sourceIdentityAtEnd = studySourceIdentity("scripts/v0/capture_trajectory_fixture.ts");
  const captureCompilerAtEnd = compilerCandidateIdentity(captureEngine);
  const identityStable = sourceIdentityAtStart.studySourceFingerprint === sourceIdentityAtEnd.studySourceFingerprint &&
    captureCompilerAtStart.candidateFingerprint === captureCompilerAtEnd.candidateFingerprint &&
    captureIdentity.panelSourceFingerprint === panelSourceFingerprintAtEnd;
  const payload: Omit<FrozenTrajectoryFixtureV3, "fixtureFingerprint"> = {
    schema: "line.frozen-trajectory-prefix.v3",
    purpose: "Frozen physical-prefix input for trajectory studies; not a compiler candidate or a comparative result.",
    capture: {
      argv: [...argv],
      runtime: {
        node: process.version,
        engine: captureEngine,
        relevantEnvironment: captureEnvironment,
      },
      elapsedMs: round(performance.now() - started),
      captureBudget,
      studySourceFingerprint: sourceIdentityAtStart.studySourceFingerprint,
      studySourceFiles: [...sourceIdentityAtStart.sourceFiles],
      captureIdentity,
      identityCheck: {
        stable: identityStable,
        panelSourceFingerprintAtStart: captureIdentity.panelSourceFingerprint,
        panelSourceFingerprintAtEnd,
        studySourceFingerprintAtStart: sourceIdentityAtStart.studySourceFingerprint,
        studySourceFingerprintAtEnd: sourceIdentityAtEnd.studySourceFingerprint,
        captureCandidateFingerprintAtStart: captureCompilerAtStart.candidateFingerprint,
        captureCandidateFingerprintAtEnd: captureCompilerAtEnd.candidateFingerprint,
      },
      captureCompilerAtEnd,
    },
    panel: {
      id: panel.id,
      cohort: panel.cohort,
      category: panel.category,
      sourcePath: panel.sourcePath,
      sourceFingerprint: captureIdentity.panelSourceFingerprint,
      publicSeed: panel.seed,
      requestedTargetGap: panel.targetGap,
      selectionRationale: panel.selectionRationale,
      selectedTargetGap: current.index,
      outgoingGap: outgoing.index,
      currentFrame: current.endFrame,
      outgoingFrame: outgoing.endFrame,
      outgoingIntervalFrames,
      expectedOutgoingFrames: panel.expectedOutgoingFrames ?? null,
    },
    transform: {
      value: benchmarkPolicy.transform,
      fingerprint: sha256(stableJson(benchmarkPolicy.transform)),
    },
    materialized,
    materializedFingerprint,
    physicalPrefix,
    physicalPrefixFingerprint,
    checkpoints: {
      targetPlanningState: originalState,
      targetProbeState: originalProbe.targetState,
      preTargetSledTrace: [...originalTrace],
      targetPlanningStateFingerprint: sha256(stableJson(originalState)),
      targetProbeStateFingerprint: sha256(stableJson(originalProbe.targetState)),
      preTargetSledTraceFingerprint: sha256(stableJson(originalTrace)),
    },
    captureCompiler: captureCompilerAtStart,
    baseline: {
      contractPassed: report.contract_passed,
      score: round(report.score),
      deepestGap: baseline.stats.handoff_deepest_seen_gap ?? null,
      targetPrefixSimFrames: visit.event.simFrames,
    },
  };
  return {
    ...payload,
    fixtureFingerprint: fixtureFingerprintForPayload(payload),
  };
}

function captureIdentityFor(
  panel: TrajectoryPanelCase,
  panelSourceFingerprint: string,
): FrozenFixtureCaptureArtifactIdentity {
  const protocolFingerprint = sha256(stableJson({
    schema: "line.frozen-trajectory-prefix-capture-protocol.v1",
    panel: {
      id: panel.id,
      cohort: panel.cohort,
      category: panel.category,
      sourcePath: panel.sourcePath,
      sourceFingerprint: panelSourceFingerprint,
      publicSeed: panel.seed,
      requestedTargetGap: panel.targetGap,
      selectionRationale: panel.selectionRationale,
      expectedOutgoingFrames: panel.expectedOutgoingFrames ?? null,
    },
    capture: {
      engine: captureEngine,
      budget,
      relevantEnvironment: captureEnvironment,
      transformFingerprint: sha256(stableJson(benchmarkPolicy.transform)),
    },
  }));
  return frozenFixtureCaptureArtifactIdentity({
    schema: "line.frozen-trajectory-prefix-capture.v1",
    panelId: panel.id,
    panelSourceFingerprint,
    captureBudget: budget,
    engine: captureEngine,
    relevantEnvironment: { ...captureEnvironment },
    studySourceFingerprint: sourceIdentityAtStart.studySourceFingerprint,
    captureCandidateFingerprint: captureCompilerAtStart.candidateFingerprint,
    protocolFingerprint,
  });
}

function assertCaptureSessionStable(
  panel: TrajectoryPanelCase,
  currentSourceIdentity: ReturnType<typeof studySourceIdentity>,
  currentCaptureCompiler: CompilerCandidateIdentity,
  currentPanelSourceFingerprint: string,
  panelSourceFingerprintAtStart: string,
): void {
  if (currentSourceIdentity.studySourceFingerprint !== sourceIdentityAtStart.studySourceFingerprint ||
      currentCaptureCompiler.candidateFingerprint !== captureCompilerAtStart.candidateFingerprint ||
      currentPanelSourceFingerprint !== panelSourceFingerprintAtStart) {
    throw new Error(
      `capture session identity changed before ${panel.id}; refusing to create a mixed-era fixture batch. Restart capture.`,
    );
  }
}

function deepestUnskippedVisit(visits: readonly Visit[]): Visit | null {
  return visits.reduce<Visit | null>((best, record) =>
    record.node.skippedContacts === 0 &&
      (best === null || record.node.search.gapIndex > best.node.search.gapIndex)
      ? record
      : best,
  );
}

function exactVisitOnDeepestPath(
  visits: readonly Visit[],
  deepest: Visit,
  targetGap: number,
): Visit | null {
  return visits.filter((record) =>
    record.node.skippedContacts === 0 &&
      record.node.search.gapIndex === targetGap &&
      isPrefix(record.node.search.prefixFits, deepest.node.search.prefixFits),
  ).at(-1) ?? null;
}

function isPrefix<T>(prefix: readonly T[], whole: readonly T[]): boolean {
  return prefix.length <= whole.length && prefix.every((item, index) => item === whole[index]);
}

function requirePlanningState(engine: unknown, frame: number, label: string): PlanningState {
  const state = extractPlanningState(engine, frame);
  if (state === null) throw new Error(`${label}: unable to read planning state at frame ${frame}`);
  return state;
}

function assertStableEqual(label: string, left: unknown, right: unknown): void {
  if (stableJson(left) !== stableJson(right)) throw new Error(`${label}: physical replay mismatch`);
}

function relevantEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env)
      .filter(([name, value]) => name.startsWith("LR_") && value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function integerArgument(name: string, fallback: number): number {
  const value = argument(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`invalid --${name}=${value}`);
  return parsed;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
