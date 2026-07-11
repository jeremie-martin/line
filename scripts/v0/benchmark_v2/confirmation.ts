import { createHash, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createCompilerSnapshot,
  runSnapshotBenchmark,
  validateCompilerSnapshot,
  type CompilerSnapshot,
  type SnapshotBenchmarkRun,
} from "./compiler_snapshot.ts";
import { loadSourceManifest, resolveSources } from "./model.ts";
import { compilerCandidateIdentity } from "./runner.ts";
import { loadSuiteManifest, resolvedSeedSchedule } from "./suite_model.ts";

export const CONFIRMATION_STATE_SCHEMA = "line.benchmark-v2.confirmation-state.v2" as const;
export const CONFIRMATION_DECLARATION_SCHEMA = "line.benchmark-v2.confirmation-declaration.v3" as const;
export const DEFAULT_CONFIRMATION_STATE_PATH = "benchmark/v2/confirmation-state.json";

export type ConfirmationMode = "improvement" | "simplification";

export type ConfirmationDeclaration = {
  schema: typeof CONFIRMATION_DECLARATION_SCHEMA;
  attemptId: string;
  declaredAt: string;
  baselineLabel: string;
  baselineCandidateFingerprint: string;
  baselineSuiteFingerprint: string;
  baselineSnapshotSha256: string;
  candidateFingerprint: string;
  candidateSnapshot: CompilerSnapshot;
  canonicalSeedBase: number;
  seedScheduleFingerprint: string;
  mode: ConfirmationMode;
  margin: number | null;
  statement: string;
};

export type SeedLedgerEntry = {
  attemptId: string;
  canonicalSeedBase: number;
  seedCount: number;
  seedScheduleFingerprint: string;
};

export type ConfirmationState = {
  schema: typeof CONFIRMATION_STATE_SCHEMA;
  status: "blocked" | "available" | "running" | "evidence-ready" | "consumed";
  reason: string | null;
  baseline: {
    label: string;
    suiteFingerprint: string;
    archiveSha256: string;
    candidateFingerprint: string | null;
    listeningReviewFingerprint: string | null;
    compilerSnapshot: CompilerSnapshot | null;
  };
  seedLedger: SeedLedgerEntry[];
  attempt: null | {
    declarationPath: string;
    declarationSha256: string;
    declaration: ConfirmationDeclaration;
    baseArchivePath?: string;
    baseArchiveSha256?: string;
    baseRetainedCompressedArchive?: string;
    baseRetainedCompressedSha256?: string;
    developmentArchivePath?: string;
    developmentArchiveSha256?: string;
    decisionArtifactPath?: string;
    decisionArtifactSha256?: string;
    outcome?: string;
  };
};

export function assertBaselineTransitionAllowed(
  candidateFingerprint: string,
  suiteFingerprint?: string,
  statePath = DEFAULT_CONFIRMATION_STATE_PATH,
): void {
  if (!existsSync(statePath)) {
    throw new Error(`confirmation state is missing; restore the tracked ledger before rebaselining`);
  }
  const state = readConfirmationState(statePath);
  if (state.status === "blocked") return;
  if (suiteFingerprint !== undefined && state.baseline.suiteFingerprint !== suiteFingerprint) return;
  if (
    state.status === "consumed" && state.attempt?.outcome === "accept" &&
    state.attempt.declaration.candidateFingerprint === candidateFingerprint
  ) return;
  throw new Error(
    `a new baseline is allowed only for the initially blocked workflow or the candidate accepted by the last canonical attempt`,
  );
}

export function initializeConfirmationStateFromBaseline(
  baselinePath = "benchmark/v2/baseline.json",
  statePath = DEFAULT_CONFIRMATION_STATE_PATH,
): ConfirmationState {
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const previous = existsSync(statePath) ? readConfirmationState(statePath) : undefined;
  const approved = baseline.schema === "line.benchmark-v2.baseline-reference.v7" &&
    baseline.status === "canonical-baseline" && baseline.listening_review_status === "approved" &&
    baseline.compiler_snapshot !== undefined;
  if (approved) validateCompilerSnapshot(baseline.compiler_snapshot);
  const state: ConfirmationState = {
    schema: CONFIRMATION_STATE_SCHEMA,
    status: approved ? "available" : "blocked",
    reason: approved
      ? null
      : "An approved listening review and a V7 baseline with a compiler snapshot are required.",
    baseline: {
      label: baseline.label,
      suiteFingerprint: baseline.suite_fingerprint,
      archiveSha256: baseline.development.archive_sha256,
      candidateFingerprint: baseline.candidate_fingerprint ?? null,
      listeningReviewFingerprint: baseline.listening_review_fingerprint ?? null,
      compilerSnapshot: approved ? baseline.compiler_snapshot : null,
    },
    seedLedger: previous?.seedLedger ?? [],
    attempt: null,
  };
  writeAtomic(statePath, state);
  return state;
}

export async function runCanonicalConfirmation(args = process.argv.slice(2)): Promise<string> {
  const argument = (name: string): string | undefined =>
    args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const statePath = resolve(argument("confirmation-state") ?? DEFAULT_CONFIRMATION_STATE_PATH);
  const declarationDir = resolve(argument("declaration-dir") ?? "benchmark/v2/confirmations");
  const outDir = resolve(argument("out-dir") ?? "generated/benchmark-v2/canonical-runs");
  const archiveDir = resolve(argument("archive-dir") ?? "benchmark/v2/runs");
  const sourceManifestPath = argument("manifest") ?? "benchmark/v2/compat/source-manifest.json";
  const suiteManifestPath = argument("suite") ?? "benchmark/v2/compat/suite-manifest.json";
  const resume = args.includes("--resume");
  const identity = compilerCandidateIdentity(process.env.LR_ENGINE ?? "typescript");
  if (process.env.LR_ENGINE !== "wasm") throw new Error(`canonical confirmation requires LR_ENGINE=wasm`);

  let state = readConfirmationState(statePath);
  let declaration: ConfirmationDeclaration;
  let declarationPath: string;
  if (resume) {
    if (state.status !== "running" || state.attempt === null) {
      throw new Error(`--resume requires a running confirmation attempt`);
    }
    declaration = state.attempt.declaration;
    declarationPath = resolve(state.attempt.declarationPath);
    if (declaration.candidateFingerprint !== identity.candidateFingerprint) {
      throw new Error(`current compiler identity does not match the running confirmation declaration`);
    }
    validateCompilerSnapshot(declaration.candidateSnapshot);
  } else {
    if (state.status !== "available" || state.attempt !== null || state.baseline.compilerSnapshot === null) {
      throw new Error(`canonical confirmation is ${state.status}; establish a new approved baseline before another attempt`);
    }
    validateCompilerSnapshot(state.baseline.compilerSnapshot);
    const mode = parseMode(argument("decision-mode"));
    const margin = parseMargin(mode, argument("margin"));
    const suite = loadSuiteManifest(suiteManifestPath, resolveSources(loadSourceManifest(sourceManifestPath)));
    const profile = suite.profiles.canonical;
    const seedCount = profile.budgets.length * profile.seeds_per_budget;
    const canonicalSeedBase = allocateCanonicalSeedBase(state.seedLedger, seedCount);
    const schedule = resolvedSeedSchedule(
      suite,
      "canonical",
      profile.budgets,
      profile.seeds_per_budget,
      canonicalSeedBase,
    );
    const seedScheduleFingerprint = sha256(Buffer.from(JSON.stringify(schedule)));
    const attemptId = `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")}-${randomBytes(4).toString("hex")}`;
    const candidateSnapshot = createCompilerSnapshot(`${attemptId}-candidate`, archiveDir);
    if (candidateSnapshot.candidateFingerprint !== identity.candidateFingerprint) {
      throw new Error(`candidate changed while its canonical snapshot was being created`);
    }
    declaration = {
      schema: CONFIRMATION_DECLARATION_SCHEMA,
      attemptId,
      declaredAt: new Date().toISOString(),
      baselineLabel: state.baseline.label,
      baselineCandidateFingerprint: state.baseline.candidateFingerprint!,
      baselineSuiteFingerprint: state.baseline.suiteFingerprint,
      baselineSnapshotSha256: state.baseline.compilerSnapshot.archiveSha256,
      candidateFingerprint: identity.candidateFingerprint,
      candidateSnapshot,
      canonicalSeedBase,
      seedScheduleFingerprint,
      mode,
      margin,
      statement: mode === "improvement"
        ? "This candidate and fresh seed epoch are frozen before either paired canonical run."
        : `This candidate, margin ${margin}, and fresh seed epoch are frozen before either paired canonical run.`,
    };
    declarationPath = resolve(declarationDir, `${attemptId}.json`);
    writeAtomic(declarationPath, declaration);
    state = {
      ...state,
      status: "running",
      reason: null,
      seedLedger: [...state.seedLedger, {
        attemptId,
        canonicalSeedBase,
        seedCount,
        seedScheduleFingerprint,
      }],
      attempt: {
        declarationPath: relativeToCwd(declarationPath),
        declarationSha256: sha256(readFileSync(declarationPath)),
        declaration,
      },
    };
    writeAtomic(statePath, state);
  }

  const forwarded = args.filter((arg) =>
    !arg.startsWith("--confirmation-state=") && !arg.startsWith("--declaration-dir=") &&
    !arg.startsWith("--decision-mode=") && !arg.startsWith("--margin=") &&
    !arg.startsWith("--label=") && !arg.startsWith("--canonical-seed-base=")
  );
  mkdirSync(outDir, { recursive: true });
  mkdirSync(archiveDir, { recursive: true });
  const common = [
    ...forwarded,
    `--confirmation-declaration=${declarationPath}`,
    `--canonical-seed-base=${declaration.canonicalSeedBase}`,
  ];
  const basePath = resolve(outDir, `${declaration.attemptId}-baseline-development.json`);
  const baseRun = runSnapshotBenchmark(
    state.baseline.compilerSnapshot!,
    "development",
    ["--profile=canonical", ...common],
    basePath,
  );
  if (baseRun.workerFailures > 0) throw new Error(`fresh baseline execution has worker failures`);
  const baseBytes = readFileSync(basePath);
  const baseArchive = JSON.parse(baseBytes.toString("utf8"));
  if (baseArchive.git?.candidateFingerprint !== declaration.baselineCandidateFingerprint) {
    throw new Error(`fresh baseline execution does not reproduce the frozen compiler snapshot identity`);
  }
  const retainedBase = retainSnapshotRun(baseRun, archiveDir, `${declaration.attemptId}-baseline-development`);

  const candidatePath = resolve(outDir, `${declaration.attemptId}-development.json`);
  const candidateRun = runSnapshotBenchmark(
    declaration.candidateSnapshot,
    "development",
    ["--profile=canonical", ...common],
    candidatePath,
  );
  if (candidateRun.workerFailures > 0) throw new Error(`canonical candidate execution has worker failures`);
  const candidateArchive = JSON.parse(readFileSync(candidatePath, "utf8"));
  if (candidateArchive.git?.candidateFingerprint !== declaration.candidateFingerprint) {
    throw new Error(`canonical candidate execution does not reproduce its declared compiler snapshot`);
  }
  const retainedCandidate = retainSnapshotRun(
    candidateRun,
    archiveDir,
    `${declaration.attemptId}-development`,
  );

  const qualificationPath = resolve(outDir, `${declaration.attemptId}-qualification.json`);
  const qualificationRun = runSnapshotBenchmark(
    declaration.candidateSnapshot,
    "qualification",
    ["--profile=canonical", `--development-archive=${candidatePath}`, ...common],
    qualificationPath,
  );
  if (qualificationRun.workerFailures > 0) throw new Error(`canonical qualification execution has worker failures`);
  const retainedQualification = retainSnapshotRun(
    qualificationRun,
    archiveDir,
    `${declaration.attemptId}-qualification`,
  );
  writeFileSync(resolve(archiveDir, `${declaration.attemptId}-canonical.json`), `${JSON.stringify({
    schema: "line.benchmark-v2.canonical-bundle.v1",
    label: declaration.attemptId,
    generatedAt: new Date().toISOString(),
    development: retainedCandidate,
    qualification: retainedQualification,
  }, null, 2)}\n`);
  state = readConfirmationState(statePath);
  if (state.status !== "running" || state.attempt?.declarationSha256 !== sha256(readFileSync(declarationPath))) {
    throw new Error(`confirmation state changed while paired canonical evidence was running`);
  }
  state.status = "evidence-ready";
  state.attempt.baseArchivePath = relativeToCwd(basePath);
  state.attempt.baseArchiveSha256 = sha256(baseBytes);
  state.attempt.baseRetainedCompressedArchive = retainedBase.archive;
  state.attempt.baseRetainedCompressedSha256 = retainedBase.compressedSha256;
  state.attempt.developmentArchivePath = relativeToCwd(candidateRun.outputPath);
  state.attempt.developmentArchiveSha256 = candidateRun.archiveSha256;
  writeAtomic(statePath, state);
  return candidateRun.outputPath;
}

export function readConfirmationState(path = DEFAULT_CONFIRMATION_STATE_PATH): ConfirmationState {
  const state = JSON.parse(readFileSync(path, "utf8")) as ConfirmationState;
  if (state.schema !== CONFIRMATION_STATE_SCHEMA) throw new Error(`unsupported confirmation state`);
  return state;
}

export function consumeConfirmation(
  statePath: string,
  candidateArchiveSha256: string,
  mode: ConfirmationMode,
  margin: number | undefined,
  decisionArtifactPath: string,
  outcome: string,
): void {
  const state = readConfirmationState(statePath);
  validateConfirmationStateFields(state, candidateArchiveSha256, mode, margin);
  const artifactBytes = readFileSync(decisionArtifactPath);
  state.status = "consumed";
  state.attempt!.decisionArtifactPath = relativeToCwd(resolve(decisionArtifactPath));
  state.attempt!.decisionArtifactSha256 = sha256(artifactBytes);
  state.attempt!.outcome = outcome;
  writeAtomic(statePath, state);
}

export function confirmationBaseArchive(statePath: string): { path: string; archiveSha256: string; label: string } {
  const state = readConfirmationState(statePath);
  if (state.status !== "evidence-ready" || state.attempt?.baseArchivePath === undefined ||
    state.attempt.baseArchiveSha256 === undefined) {
    throw new Error(`fresh paired baseline evidence is unavailable for this canonical attempt`);
  }
  return {
    path: resolve(state.attempt.baseArchivePath),
    archiveSha256: state.attempt.baseArchiveSha256,
    label: `${state.baseline.label}-fresh-paired`,
  };
}

export function validateConfirmationEvidence(
  statePath: string,
  input: {
    baseArchiveSha256: string;
    baseCandidateFingerprint: string;
    candidateArchiveSha256: string;
    candidateFingerprint: string;
    suiteFingerprint: string;
    baseConfirmationDeclaration?: { path: string; sha256: string };
    confirmationDeclaration?: { path: string; sha256: string };
    seedSchedule: unknown;
    mode: ConfirmationMode;
    margin?: number;
  },
): ConfirmationDeclaration {
  const state = readConfirmationState(statePath);
  validateConfirmationStateFields(state, input.candidateArchiveSha256, input.mode, input.margin);
  const attempt = state.attempt!;
  const declaration = attempt.declaration;
  validateCompilerSnapshot(declaration.candidateSnapshot);
  if (state.baseline.compilerSnapshot === null) throw new Error(`baseline compiler snapshot is unavailable`);
  validateCompilerSnapshot(state.baseline.compilerSnapshot);
  const expectedDeclarationPath = resolve(attempt.declarationPath);
  const linked = [input.baseConfirmationDeclaration, input.confirmationDeclaration];
  if (
    attempt.baseArchiveSha256 !== input.baseArchiveSha256 ||
    declaration.baselineCandidateFingerprint !== input.baseCandidateFingerprint ||
    declaration.baselineSuiteFingerprint !== input.suiteFingerprint ||
    declaration.candidateFingerprint !== input.candidateFingerprint ||
    declaration.seedScheduleFingerprint !== sha256(Buffer.from(JSON.stringify(input.seedSchedule))) ||
    linked.some((entry) => entry === undefined || resolve(entry.path) !== expectedDeclarationPath ||
      entry.sha256 !== attempt.declarationSha256) ||
    sha256(readFileSync(expectedDeclarationPath)) !== attempt.declarationSha256
  ) {
    throw new Error(`canonical archives are not paired to the fresh seed epoch and immutable declaration`);
  }
  return declaration;
}

function validateConfirmationStateFields(
  state: ConfirmationState,
  candidateArchiveSha256: string,
  mode: ConfirmationMode,
  margin: number | undefined,
): void {
  if (state.status !== "evidence-ready" || state.attempt === null) {
    throw new Error(`canonical evidence is not linked to an available one-shot confirmation declaration`);
  }
  const declaration = state.attempt.declaration;
  if (
    state.attempt.developmentArchiveSha256 !== candidateArchiveSha256 ||
    declaration.mode !== mode || declaration.margin !== (mode === "simplification" ? margin : null)
  ) {
    throw new Error(`canonical evidence does not match its predeclared candidate, mode, margin, and archive`);
  }
}

function retainSnapshotRun(
  run: SnapshotBenchmarkRun,
  archiveDir: string,
  stem: string,
): {
  archive: string;
  summary: string;
  sha256: string;
  compressedSha256: string;
  headline: number | null;
  monitorScore: number | null;
} {
  const archivePath = resolve(archiveDir, `${stem}.json.gz`);
  const summaryPath = resolve(archiveDir, `${stem}.summary.json`);
  copyFileSync(`${run.outputPath}.gz`, archivePath);
  copyFileSync(run.summaryPath, summaryPath);
  writeFileSync(`${archivePath}.sha256`, `${run.compressedArchiveSha256}  ${relativeToCwd(archivePath)}\n`);
  return {
    archive: relativeToCwd(archivePath),
    summary: relativeToCwd(summaryPath),
    sha256: run.archiveSha256,
    compressedSha256: run.compressedArchiveSha256,
    headline: run.headline,
    monitorScore: run.qualificationMonitorScore,
  };
}

export function allocateCanonicalSeedBase(ledger: SeedLedgerEntry[], seedCount: number): number {
  const firstCanonicalSeed = 1_000_000;
  for (let attempt = 0; attempt < 1_000; attempt++) {
    const candidate = firstCanonicalSeed + randomBytes(4).readUInt32LE(0) % (2_000_000_000 - firstCanonicalSeed);
    const overlaps = ledger.some((entry) =>
      candidate < entry.canonicalSeedBase + entry.seedCount &&
      entry.canonicalSeedBase < candidate + seedCount
    );
    if (!overlaps) return candidate;
  }
  throw new Error(`unable to allocate a fresh canonical seed epoch`);
}

function parseMode(raw: string | undefined): ConfirmationMode {
  const mode = raw ?? "improvement";
  if (mode !== "improvement" && mode !== "simplification") {
    throw new Error(`--decision-mode must be improvement or simplification`);
  }
  return mode;
}

function parseMargin(mode: ConfirmationMode, raw: string | undefined): number | null {
  if (mode === "improvement") {
    if (raw !== undefined) throw new Error(`--margin is only valid for a simplification confirmation`);
    return null;
  }
  const margin = Number(raw);
  if (!Number.isFinite(margin) || margin <= 0) {
    throw new Error(`simplification confirmation requires --margin=<positive headline points>`);
  }
  return margin;
}

function writeAtomic(path: string, value: unknown): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, absolute);
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function relativeToCwd(path: string): string {
  const prefix = `${process.cwd()}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
