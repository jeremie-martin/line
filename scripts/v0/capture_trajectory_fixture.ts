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
import {
  buildTrajectoryPanelSetup,
  activeTrajectoryPanelCases,
  assertActiveTrajectoryPanel,
  assertTrajectoryCalibrationProtocol,
  getTrajectoryPanelCase,
  TRAJECTORY_CALIBRATION_PROTOCOL,
  type ActiveTrajectoryPanelCohort,
  type TrajectoryPanelCase,
} from "./trajectory/panel.ts";
import { captureTrajectoryPrefix } from "./trajectory/prefix_capture_core.ts";
import {
  frozenFixtureCaptureArtifactIdentity,
  fixtureFingerprintForPayload,
  sha256,
  stableJson,
  type FrozenTrajectoryFixtureV3,
  type FrozenFixtureCaptureArtifactIdentity,
} from "./trajectory/frozen_fixture.ts";
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
  const captured = captureTrajectoryPrefix(panel, setup, captureBudget);
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
      selectedTargetGap: captured.current.index,
      outgoingGap: captured.outgoing.index,
      currentFrame: captured.current.endFrame,
      outgoingFrame: captured.outgoing.endFrame,
      outgoingIntervalFrames: captured.outgoingIntervalFrames,
      expectedOutgoingFrames: panel.expectedOutgoingFrames ?? null,
      studyScope: panel.studyScope ?? null,
    },
    transform: {
      value: benchmarkPolicy.transform,
      fingerprint: sha256(stableJson(benchmarkPolicy.transform)),
    },
    materialized: captured.materialized,
    materializedFingerprint: captured.materializedFingerprint,
    physicalPrefix: captured.physicalPrefix,
    physicalPrefixFingerprint: captured.physicalPrefixFingerprint,
    checkpoints: {
      targetPlanningState: captured.targetPlanningState,
      targetProbeState: captured.targetProbeState,
      preTargetSledTrace: captured.preTargetSledTrace,
      targetPlanningStateFingerprint: sha256(stableJson(captured.targetPlanningState)),
      targetProbeStateFingerprint: sha256(stableJson(captured.targetProbeState)),
      preTargetSledTraceFingerprint: sha256(stableJson(captured.preTargetSledTrace)),
    },
    captureCompiler: captureCompilerAtStart,
    baseline: {
      ...captured.baseline,
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
      studyScope: panel.studyScope ?? null,
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
