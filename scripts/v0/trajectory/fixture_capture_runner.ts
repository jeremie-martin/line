/** Generic immutable prefix-fixture capture orchestration for a declared roster. */
import { join } from "node:path";
import { benchmarkPolicy } from "../../../benchmark/v2/policy.ts";
import { compilerCandidateIdentity, type CompilerCandidateIdentity } from "../benchmark_v2/compiler_identity.ts";
import { fingerprintFiles } from "../benchmark_v2/suite_model.ts";
import { nextContactGap } from "../optimizer/objective.ts";
import { captureTrajectoryPrefix } from "./prefix_capture_core.ts";
import {
  frozenFixtureCaptureArtifactIdentity,
  fixtureFingerprintForPayload,
  sha256,
  stableJson,
  type FrozenTrajectoryFixtureV3,
  type FrozenFixtureCaptureArtifactIdentity,
} from "./frozen_fixture.ts";
import { activeStudyEngine } from "./study_runtime.ts";
import {
  allocateStudyArtifactPath,
  assertStudyArtifactPathUnused,
  forensicDriftArtifactPath,
  studySourceIdentity,
  writeImmutableJsonArtifact,
} from "./study_artifact.ts";
import type { TrajectoryCaptureCase, TrajectoryCaptureSetup } from "./capture_input.ts";

const CAPTURE_PROTOCOL = {
  engine: "wasm",
  captureBudget: 500_000,
  relevantEnvironment: { LR_ENGINE: "wasm" },
} as const;

export type FixtureCaptureCatalog = {
  entryPath: string;
  defaultOutDir: string;
  usage: readonly string[];
  allowedCohorts: readonly ("calibration" | "validation")[];
  activeCases: (cohort: "calibration" | "validation") => readonly TrajectoryCaptureCase[];
  getCase: (id: string) => TrajectoryCaptureCase;
  buildSetup: (panel: TrajectoryCaptureCase) => TrajectoryCaptureSetup;
};

export function runTrajectoryFixtureCapture(argv: readonly string[], catalog: FixtureCaptureCatalog): void {
  const argument = (name: string): string | undefined =>
    argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write([...catalog.usage, ""].join("\n"));
    return;
  }
  const caseArgument = argument("case");
  if (caseArgument === undefined) throw new Error("--case=NAME|all is required");
  const cohortArgument = argument("cohort") ?? catalog.allowedCohorts[0]!;
  if (!catalog.allowedCohorts.includes(cohortArgument as "calibration" | "validation")) {
    throw new Error(`unsupported --cohort=${cohortArgument}`);
  }
  const cohort = cohortArgument as "calibration" | "validation";
  const budget = integerArgument(argument("budget"), CAPTURE_PROTOCOL.captureBudget);
  if (budget <= 0) throw new Error(`invalid --budget=${budget}`);
  const selectedPanels = caseArgument === "all"
    ? catalog.activeCases(cohort)
    : [catalog.getCase(caseArgument)];
  if (selectedPanels.length === 0) throw new Error(`no active ${cohort} trajectory panels are declared`);
  if (selectedPanels.some((panel) => panel.cohort !== cohort)) {
    throw new Error(`requested panels do not all belong to --cohort=${cohort}`);
  }
  if (selectedPanels.some((panel) => panel.cohort === "quarantined")) {
    throw new Error("quarantined trajectory panels are audit-only and cannot be captured");
  }
  for (const panel of selectedPanels) validateStructuralSelection(panel, catalog.buildSetup(panel));
  const captureEnvironment = relevantEnvironment();
  const captureEngine = activeStudyEngine();
  assertCaptureProtocol(captureEngine, budget, captureEnvironment);
  const explicitOut = argument("out");
  if (explicitOut !== undefined && selectedPanels.length !== 1) {
    throw new Error("--out is only valid when capturing one panel; use --out-dir for --case=all");
  }
  if (explicitOut !== undefined) assertStudyArtifactPathUnused(explicitOut);
  const outDir = argument("out-dir") ?? catalog.defaultOutDir;
  const sourceIdentityAtStart = studySourceIdentity(catalog.entryPath);
  const captureCompilerAtStart = compilerCandidateIdentity(captureEngine);
  const panelSourceFingerprintsAtStart = new Map(
    selectedPanels.map((panel) => [panel.id, fingerprintFiles([panel.sourcePath])]),
  );

  for (const panel of selectedPanels) {
    const panelSourceFingerprintAtStart = panelSourceFingerprintsAtStart.get(panel.id);
    if (panelSourceFingerprintAtStart === undefined) throw new Error(`missing source fingerprint for ${panel.id}`);
    assertCaptureSessionStable(
      catalog.entryPath,
      panel,
      sourceIdentityAtStart,
      captureCompilerAtStart,
      panelSourceFingerprintAtStart,
      captureEngine,
    );
    const captureIdentity = captureIdentityFor(
      catalog.entryPath,
      panel,
      panelSourceFingerprintAtStart,
      sourceIdentityAtStart,
      captureCompilerAtStart,
      captureEngine,
      budget,
      captureEnvironment,
    );
    const canonicalOutPath = explicitOut ?? join(
      outDir,
      "v3",
      `${panel.id}-b${budget}-${captureIdentity.fingerprint.slice(0, 12)}.json`,
    );
    const normalOutPath = explicitOut ?? allocateStudyArtifactPath(canonicalOutPath);
    const fixture = capturePanel(
      argv,
      catalog,
      panel,
      budget,
      captureIdentity,
      sourceIdentityAtStart,
      captureCompilerAtStart,
      captureEngine,
      captureEnvironment,
    );
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
}

function capturePanel(
  argv: readonly string[],
  catalog: FixtureCaptureCatalog,
  panel: TrajectoryCaptureCase,
  captureBudget: number,
  captureIdentity: FrozenFixtureCaptureArtifactIdentity,
  sourceIdentityAtStart: ReturnType<typeof studySourceIdentity>,
  captureCompilerAtStart: CompilerCandidateIdentity,
  captureEngine: string,
  captureEnvironment: Record<string, string>,
): FrozenTrajectoryFixtureV3 {
  const started = performance.now();
  const setup = catalog.buildSetup(panel);
  const captured = captureTrajectoryPrefix(panel, setup, captureBudget);
  const panelSourceFingerprintAtEnd = fingerprintFiles([panel.sourcePath]);
  const sourceIdentityAtEnd = studySourceIdentity(catalog.entryPath);
  const captureCompilerAtEnd = compilerCandidateIdentity(captureEngine);
  const identityStable = sourceIdentityAtStart.studySourceFingerprint === sourceIdentityAtEnd.studySourceFingerprint &&
    captureCompilerAtStart.candidateFingerprint === captureCompilerAtEnd.candidateFingerprint &&
    captureIdentity.panelSourceFingerprint === panelSourceFingerprintAtEnd;
  const payload: Omit<FrozenTrajectoryFixtureV3, "fixtureFingerprint"> = {
    schema: "line.frozen-trajectory-prefix.v3",
    purpose: "Frozen physical-prefix input for trajectory studies; not a compiler candidate or a comparative result.",
    capture: {
      argv: [...argv],
      runtime: { node: process.version, engine: captureEngine, relevantEnvironment: captureEnvironment },
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
    transform: { value: benchmarkPolicy.transform, fingerprint: sha256(stableJson(benchmarkPolicy.transform)) },
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
    baseline: { ...captured.baseline },
  };
  return { ...payload, fixtureFingerprint: fixtureFingerprintForPayload(payload) };
}

function captureIdentityFor(
  entryPath: string,
  panel: TrajectoryCaptureCase,
  panelSourceFingerprint: string,
  sourceIdentityAtStart: ReturnType<typeof studySourceIdentity>,
  captureCompilerAtStart: CompilerCandidateIdentity,
  captureEngine: string,
  budget: number,
  captureEnvironment: Record<string, string>,
): FrozenFixtureCaptureArtifactIdentity {
  const protocolFingerprint = sha256(stableJson({
    schema: "line.frozen-trajectory-prefix-capture-protocol.v1",
    entryPath,
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
    capture: { engine: captureEngine, budget, relevantEnvironment: captureEnvironment, transformFingerprint: sha256(stableJson(benchmarkPolicy.transform)) },
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
  entryPath: string,
  panel: TrajectoryCaptureCase,
  sourceIdentityAtStart: ReturnType<typeof studySourceIdentity>,
  captureCompilerAtStart: CompilerCandidateIdentity,
  panelSourceFingerprintAtStart: string,
  captureEngine: string,
): void {
  const currentSourceIdentity = studySourceIdentity(entryPath);
  const currentCaptureCompiler = compilerCandidateIdentity(captureEngine);
  const currentPanelSourceFingerprint = fingerprintFiles([panel.sourcePath]);
  if (currentSourceIdentity.studySourceFingerprint !== sourceIdentityAtStart.studySourceFingerprint ||
      currentCaptureCompiler.candidateFingerprint !== captureCompilerAtStart.candidateFingerprint ||
      currentPanelSourceFingerprint !== panelSourceFingerprintAtStart) {
    throw new Error(`capture session identity changed before ${panel.id}; refusing to create a mixed-era fixture batch`);
  }
}

function assertCaptureProtocol(engine: string, budget: number, environment: Record<string, string>): void {
  if (engine !== CAPTURE_PROTOCOL.engine) throw new Error(`trajectory fixture capture requires LR_ENGINE=${CAPTURE_PROTOCOL.engine}; received ${engine}`);
  if (budget !== CAPTURE_PROTOCOL.captureBudget) throw new Error(`trajectory fixture capture requires budget ${CAPTURE_PROTOCOL.captureBudget}; received ${budget}`);
  if (stableJson(sortedEnvironment(environment)) !== stableJson(CAPTURE_PROTOCOL.relevantEnvironment)) {
    throw new Error(`trajectory fixture capture requires canonical LR environment ${stableJson(CAPTURE_PROTOCOL.relevantEnvironment)}`);
  }
}

/** Reject a bad source declaration before compilation can select a prefix. */
function validateStructuralSelection(panel: TrajectoryCaptureCase, setup: TrajectoryCaptureSetup): void {
  const current = setup.gaps[panel.targetGap];
  if (current === undefined || !current.endsWithContact) {
    throw new Error(`${panel.id}: declared g${panel.targetGap} is not a contact gap`);
  }
  const outgoing = nextContactGap(current, setup.gaps);
  if (outgoing === null || outgoing.startFrame !== current.endFrame || !outgoing.endsWithContact) {
    throw new Error(`${panel.id}: declared g${panel.targetGap} has no contiguous outgoing contact interval`);
  }
  const interval = outgoing.endFrame - outgoing.startFrame;
  if (panel.expectedOutgoingFrames !== undefined && interval !== panel.expectedOutgoingFrames) {
    throw new Error(`${panel.id}: declared outgoing interval ${interval} != ${panel.expectedOutgoingFrames}`);
  }
}

function relevantEnvironment(): Record<string, string> {
  return Object.fromEntries(Object.entries(process.env)
    .filter(([name, value]) => name.startsWith("LR_") && value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)));
}

function sortedEnvironment(environment: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(environment).sort(([a], [b]) => a.localeCompare(b)));
}

function integerArgument(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`invalid --budget=${value}`);
  return parsed;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
