/**
 * One-shot executor for the prospective fixed long-carrier transfer cohort.
 *
 * This is intentionally not a general batch wrapper. It writes an immutable
 * declaration before doing work, plans/results every child invocation, never
 * retries a row, and preserves every failed or forensic publication in the
 * final assessment rather than inferring availability from child stderr.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { sha256, stableJson, assertPostimpactV3FixtureIntegrity } from "./trajectory/postimpact_study_inputs.ts";
import {
  assessLongCarrierReplication,
  type LongCarrierReplicationEvidence,
  type LongCarrierReplicationExpectedIdentities,
} from "./trajectory/long_carrier_replication_assessment.ts";
import {
  LONG_CARRIER_REPLICATION_COMMAND_TEMPLATES,
  LONG_CARRIER_REPLICATION_EXECUTION_DEFINITION_PATHS,
  LONG_CARRIER_REPLICATION_PROTOCOL,
  LONG_CARRIER_REPLICATION_SCOPE,
  isLongCarrierReplicationAuthoringInputPath,
  longCarrierReplicationArtifactPaths,
  longCarrierReplicationAssayArgv,
  longCarrierReplicationCaptureArgv,
  longCarrierReplicationSelfVerifierArgv,
} from "./trajectory/long_carrier_replication_protocol.ts";
import { sameLongCarrierReplicationExecutionBinding } from "./trajectory/long_carrier_replication_identity.ts";
import {
  isLongCarrierCompilerSourcePath,
  longCarrierReplicationCandidateIdentity,
} from "./trajectory/long_carrier_replication_candidate.ts";
import { longCarrierReplicationSourceIdentity } from "./trajectory/long_carrier_replication_source.ts";
import {
  assertLongCarrierReplicationRuntimeEnvironment,
  longCarrierReplicationChildEnvironment,
} from "./trajectory/long_carrier_replication_runtime.ts";
import {
  LONG_CARRIER_REPLICATION_DECLARATION_SCHEMA,
  LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
  LONG_CARRIER_REPLICATION_LEDGER_SCHEMA,
  longCarrierReplicationVerdictExitCode,
  replicationArtifactPublicationPaths,
  replicationRelativePath,
  resolveReplicationPath,
  writeSealedReplicationRecord,
} from "./trajectory/long_carrier_replication_records.ts";
import {
  postimpactAssayRuntimeIdentity,
  postimpactAssaySourceIdentity,
  readPostimpactAssayArtifact,
} from "./trajectory/postimpact_assay_artifact.ts";

const CONTROLLER_PATH = "scripts/v0/run_long_carrier_replication.ts";
const VERIFIER_PATH = "scripts/v0/verify_long_carrier_replication.ts";
const CAPTURE_PATH = "scripts/v0/capture_long_carrier_replication_fixture.ts";
const ASSAY_PATH = "scripts/v0/study_long_carrier_duration_response.ts";
const STDERR_TAIL_LIMIT = 4_000;

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: run_long_carrier_replication.ts --out-dir=DIR [--check]",
    "",
    "Runs the preregistered fixed long-carrier transfer cohort once.",
    "DIR must not exist. The controller writes declaration, immutable stage",
    "events, fixtures/assays, and a read-only-verifiable ledger under DIR.",
    "--check performs the same environment, source-closure, and output-path",
    "preflight without writing evidence or launching the compiler.",
  ].join("\n") + "\n");
  process.exit(0);
}

const options = parseOptions(argv);
const outDir = options.outDir;
if (existsSync(outDir)) throw new Error(`replication output root already exists: ${outDir}`);
assertExactEnvironment();
const definitionPaths = replicationDefinitionPaths();
assertDefinitionPathsCommitted(definitionPaths);

const initial = executionIdentity();
if (options.check) {
  process.stdout.write(
    `long-carrier replication preflight ok; ${LONG_CARRIER_REPLICATION_PROTOCOL.cases.length} cases at ` +
    `${LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget} WASM budget; output root is unused\n`,
  );
  process.exit(0);
}
const declarationPayload = {
  schema: LONG_CARRIER_REPLICATION_DECLARATION_SCHEMA,
  scope: LONG_CARRIER_REPLICATION_SCOPE,
  createdAt: new Date().toISOString(),
  protocol: LONG_CARRIER_REPLICATION_PROTOCOL,
  protocolFingerprint: sha256(stableJson(LONG_CARRIER_REPLICATION_PROTOCOL)),
  cases: LONG_CARRIER_REPLICATION_PROTOCOL.cases,
  environment: { LR_ENGINE: "wasm" },
  captureBudget: LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget,
  publicationRoot: outDir,
  command: {
    executable: process.execPath,
    templates: LONG_CARRIER_REPLICATION_COMMAND_TEMPLATES,
  },
  sourceRevision: sourceRevision(),
  definitionPaths,
  definitionFileFingerprints: fingerprintDefinitionPaths(definitionPaths),
  execution: initial,
};
const declarationPath = join(outDir, "declaration.json");
const declaration = writeSealedReplicationRecord(declarationPath, declarationPayload, "long-carrier replication declaration");
const declarationFingerprint = declaration.recordFingerprint;
const eventPaths: string[] = [];
const evidence: LongCarrierReplicationEvidence[] = [];
let abortReason: string | null = null;

for (const [index, entry] of LONG_CARRIER_REPLICATION_PROTOCOL.cases.entries()) {
  const ordinal = String(index + 1).padStart(2, "0");
  try {
    assertExecutionIdentity(initial);
  } catch (error) {
    abortReason = `execution identity changed before ${entry.id}: ${errorMessage(error)}`;
    eventPaths.push(writeAbortEvent(outDir, declarationFingerprint, abortReason));
    break;
  }

  const { fixture: fixtureRelativePath, assay: assayRelativePath } = longCarrierReplicationArtifactPaths(index + 1, entry.id);
  const fixturePath = join(outDir, fixtureRelativePath);
  const assayPath = join(outDir, assayRelativePath);
  const captureArgv = longCarrierReplicationCaptureArgv(entry, fixturePath);
  const capturePlan = writeStagePlan(outDir, ordinal, "capture", entry.id, declarationFingerprint, captureArgv, fixtureRelativePath);
  eventPaths.push(capturePlan);
  const captureRun = runChild(captureArgv);
  const captureArtifact = readFixturePublication(outDir, fixtureRelativePath);
  const captureClassification = captureArtifact.value !== null &&
    captureArtifact.artifactPath === fixtureRelativePath &&
    captureArtifact.observedArtifactPaths.length === 1 &&
    childCompletedSuccessfully(captureRun)
    ? "captured"
    : "invalid";
  const captureResult = writeStageResult(
    outDir,
    ordinal,
    "capture",
    entry.id,
    declarationFingerprint,
    capturePlan,
    captureArgv,
    fixtureRelativePath,
    captureArtifact.artifactPath,
    captureArtifact.observedArtifactPaths,
    captureRun,
    captureArtifact.value === null ? null : { fingerprint: String(captureArtifact.value.fixtureFingerprint) },
    captureArtifact.error,
    captureClassification,
  );
  eventPaths.push(captureResult);

  if (captureClassification !== "captured") {
    const skipped = writeSkippedAssayResult(
      outDir,
      ordinal,
      entry.id,
      declarationFingerprint,
      assayRelativePath,
      "capture did not produce one successful normal immutable V3 fixture",
    );
    eventPaths.push(skipped);
    evidence.push({
      id: entry.id,
      capture: {
        exitCode: captureRun.exitCode,
        fixture: captureArtifact.value,
        failureKind: "invalid",
      },
      assay: { exitCode: null, artifact: null },
    });
    continue;
  }

  const assayArgv = longCarrierReplicationAssayArgv(fixturePath, assayPath);
  const assayPlan = writeStagePlan(outDir, ordinal, "assay", entry.id, declarationFingerprint, assayArgv, assayRelativePath);
  eventPaths.push(assayPlan);
  const assayRun = runChild(assayArgv);
  const assayArtifact = readAssayPublication(outDir, assayRelativePath);
  const assayClassification = assayArtifact.value !== null &&
    assayArtifact.artifactPath === assayRelativePath &&
    assayArtifact.observedArtifactPaths.length === 1 &&
    childCompletedSuccessfully(assayRun)
    ? "assayed"
    : "invalid";
  const assayResult = writeStageResult(
    outDir,
    ordinal,
    "assay",
    entry.id,
    declarationFingerprint,
    assayPlan,
    assayArgv,
    assayRelativePath,
    assayArtifact.artifactPath,
    assayArtifact.observedArtifactPaths,
    assayRun,
    assayArtifact.value === null ? null : { fingerprint: String(assayArtifact.value.artifactContentFingerprint) },
    assayArtifact.error,
    assayClassification,
  );
  eventPaths.push(assayResult);
  evidence.push({
    id: entry.id,
    capture: { exitCode: captureRun.exitCode, fixture: captureArtifact.value },
    assay: { exitCode: assayRun.exitCode, artifact: assayArtifact.value },
  });
}

if (abortReason === null) {
  try {
    assertExecutionIdentity(initial);
  } catch (error) {
    abortReason = `execution identity changed after the final case: ${errorMessage(error)}`;
    eventPaths.push(writeAbortEvent(outDir, declarationFingerprint, abortReason));
  }
}

const assessment = assessLongCarrierReplication(evidence, expectedIdentities(initial));
const ledger = writeSealedReplicationRecord(join(outDir, "ledger.json"), {
  schema: LONG_CARRIER_REPLICATION_LEDGER_SCHEMA,
  scope: LONG_CARRIER_REPLICATION_SCOPE,
  declarationPath: "declaration.json",
  declarationFingerprint,
  completed: abortReason === null,
  abortReason,
  eventPaths,
  assessment,
}, "long-carrier replication ledger");

const expectedExitCode = abortReason === null ? longCarrierReplicationVerdictExitCode(assessment.verdict) : 2;
let exitCode = expectedExitCode;
if (abortReason === null) {
  const verification = runChild(longCarrierReplicationSelfVerifierArgv(outDir));
  if (!childTerminatedNormally(verification) || verification.exitCode !== expectedExitCode) {
    process.stderr.write(
      `long-carrier replication self-verification failed; expected exit ${expectedExitCode}, ` +
      `received ${verification.exitCode ?? "null"}: ${tail(verification.stderr || verification.stdout)}\n`,
    );
    exitCode = 2;
  }
}
process.stdout.write(
  `long-carrier replication ${assessment.verdict}; ${evidence.length}/${LONG_CARRIER_REPLICATION_PROTOCOL.cases.length} cases recorded; ` +
  `ledger=${replicationRelativePath(outDir, join(outDir, "ledger.json"), "ledger")} (${ledger.recordFingerprint.slice(0, 12)})\n`,
);
process.exitCode = exitCode;

function parseOptions(values: readonly string[]): { outDir: string; check: boolean } {
  const outputs = values.filter((value) => value.startsWith("--out-dir=")).map((value) => value.slice("--out-dir=".length));
  const checks = values.filter((value) => value === "--check");
  const unsupported = values.filter((value) => !value.startsWith("--out-dir=") && value !== "--check");
  if (unsupported.length > 0) throw new Error(`unsupported replication option(s): ${unsupported.join(", ")}`);
  if (outputs.length !== 1 || outputs[0] === "") throw new Error("--out-dir=DIR is required exactly once and must be non-empty");
  if (checks.length > 1) throw new Error("--check may be supplied once");
  return { outDir: resolve(outputs[0]!), check: checks.length === 1 };
}

function assertExactEnvironment(): void {
  assertLongCarrierReplicationRuntimeEnvironment();
  const relevant = Object.fromEntries(Object.entries(process.env)
    .filter(([name, value]) => name.startsWith("LR_") && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right)));
  if (stableJson(relevant) !== stableJson({ LR_ENGINE: "wasm" })) {
    throw new Error(`replication requires exactly LR_ENGINE=wasm; received ${stableJson(relevant)}`);
  }
}

function replicationDefinitionPaths(): string[] {
  const capture = longCarrierReplicationSourceIdentity(CAPTURE_PATH).sourceFiles;
  const assay = postimpactAssaySourceIdentity(ASSAY_PATH).sourceFiles;
  const controller = longCarrierReplicationSourceIdentity(CONTROLLER_PATH).sourceFiles;
  const verifier = longCarrierReplicationSourceIdentity(VERIFIER_PATH).sourceFiles;
  return [...new Set([
    ...LONG_CARRIER_REPLICATION_EXECUTION_DEFINITION_PATHS,
    ...capture,
    ...assay,
    ...controller,
    ...verifier,
  ])].filter((path) => !isCompilerBoundPath(path)).sort();
}

function isCompilerBoundPath(path: string): boolean {
  return isLongCarrierCompilerSourcePath(path) && !isLongCarrierReplicationAuthoringInputPath(path);
}

function assertDefinitionPathsCommitted(paths: readonly string[]): void {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", ...paths], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("long-carrier replication definition source closure must be tracked and committed before execution");
  }
  try {
    execFileSync("git", ["diff", "--quiet", "HEAD", "--", ...paths], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("long-carrier replication definition source closure must match HEAD before execution");
  }
}

function fingerprintDefinitionPaths(paths: readonly string[]): Record<string, string> {
  return Object.fromEntries(paths
    .map((path) => [path, sha256(readFileSync(path, "utf8"))]));
}

function sourceRevision(): { head: string; tree: string } {
  return {
    head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(),
    tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(),
  };
}

function executionIdentity() {
  const controller = longCarrierReplicationSourceIdentity(CONTROLLER_PATH);
  const verifier = longCarrierReplicationSourceIdentity(VERIFIER_PATH);
  const capture = longCarrierReplicationSourceIdentity(CAPTURE_PATH);
  const assay = postimpactAssaySourceIdentity(ASSAY_PATH);
  return {
    controllerSourceIdentity: controller,
    verifierSourceIdentity: verifier,
    captureSourceIdentity: capture,
    assaySourceIdentity: assay,
    captureCandidate: longCarrierReplicationCandidateIdentity("wasm"),
    assayRuntime: postimpactAssayRuntimeIdentity(),
  };
}

function assertExecutionIdentity(initialIdentity: ReturnType<typeof executionIdentity>): void {
  const current = executionIdentity();
  if (!sameLongCarrierReplicationExecutionBinding(initialIdentity, current)) {
    throw new Error("controller, runner, compiler candidate, assay source, or runtime identity no longer matches the declaration");
  }
}

function expectedIdentities(identity: ReturnType<typeof executionIdentity>): LongCarrierReplicationExpectedIdentities {
  return {
    captureStudySourceFingerprint: identity.captureSourceIdentity.fingerprint,
    captureCandidateFingerprint: identity.captureCandidate.candidateFingerprint,
    assaySourceFingerprint: identity.assaySourceIdentity.fingerprint,
    assayRuntimeFingerprint: identity.assayRuntime.fingerprint,
  };
}

function childEnvironment(): NodeJS.ProcessEnv {
  return longCarrierReplicationChildEnvironment();
}

type ChildRun = {
  exitCode: number | null;
  signal: string | null;
  error: string | null;
  elapsedMs: number;
  stdout: string;
  stderr: string;
};

function childCompletedSuccessfully(run: Pick<ChildRun, "exitCode" | "signal" | "error">): boolean {
  return run.exitCode === 0 && run.signal === null && run.error === null;
}

function childTerminatedNormally(run: Pick<ChildRun, "signal" | "error">): boolean {
  return run.signal === null && run.error === null;
}

function runChild(arguments_: readonly string[]): ChildRun {
  const started = performance.now();
  const result = spawnSync(process.execPath, arguments_, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: childEnvironment(),
  });
  return {
    exitCode: result.status,
    signal: result.signal,
    error: result.error === undefined ? null : errorMessage(result.error),
    elapsedMs: round(performance.now() - started),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

type ArtifactPublication = {
  artifactPath: string | null;
  observedArtifactPaths: string[];
  value: Record<string, unknown> | null;
  error: string | null;
};

function readFixturePublication(root: string, requestedArtifactPath: string): ArtifactPublication {
  const observedArtifactPaths = replicationArtifactPublicationPaths(root, requestedArtifactPath, {
    includeIdentityDriftSiblings: true,
  });
  if (observedArtifactPaths.length === 0) {
    return { artifactPath: null, observedArtifactPaths, value: null, error: "fixture was not published" };
  }
  if (observedArtifactPaths.length !== 1) {
    return {
      artifactPath: null,
      observedArtifactPaths,
      value: null,
      error: "capture published multiple normal or forensic fixture paths",
    };
  }
  const artifactPath = observedArtifactPaths[0]!;
  try {
    const fixture: unknown = JSON.parse(readFileSync(resolveReplicationPath(root, artifactPath, "capture artifact path"), "utf8"));
    assertPostimpactV3FixtureIntegrity(fixture, "long-carrier capture artifact");
    return { artifactPath, observedArtifactPaths, value: fixture as Record<string, unknown>, error: null };
  } catch (error) {
    return { artifactPath, observedArtifactPaths, value: null, error: `fixture integrity failure: ${errorMessage(error)}` };
  }
}

function readAssayPublication(root: string, requestedArtifactPath: string): ArtifactPublication {
  const observedArtifactPaths = replicationArtifactPublicationPaths(root, requestedArtifactPath);
  if (observedArtifactPaths.length === 0) {
    return { artifactPath: null, observedArtifactPaths, value: null, error: "assay was not published" };
  }
  const artifactPath = observedArtifactPaths[0]!;
  try {
    return {
      artifactPath,
      observedArtifactPaths,
      value: readPostimpactAssayArtifact(resolveReplicationPath(root, artifactPath, "assay artifact path")),
      error: null,
    };
  } catch (error) {
    return {
      artifactPath,
      observedArtifactPaths,
      value: null,
      error: `assay integrity failure: ${errorMessage(error)}`,
    };
  }
}

function writeStagePlan(
  root: string,
  ordinal: string,
  stage: "capture" | "assay",
  id: string,
  declarationFingerprint: string,
  arguments_: readonly string[],
  requestedArtifactPath: string,
): string {
  const relativePath = `events/${ordinal}-${stage}-${id}.plan.json`;
  writeSealedReplicationRecord(join(root, relativePath), {
    schema: LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
    kind: "plan",
    stage,
    id,
    ordinal: Number(ordinal),
    declarationFingerprint,
    argv: [process.execPath, ...arguments_],
    environment: { LR_ENGINE: "wasm" },
    requestedArtifactPath,
  }, `long-carrier ${stage} plan`);
  return relativePath;
}

function writeStageResult(
  root: string,
  ordinal: string,
  stage: "capture" | "assay",
  id: string,
  declarationFingerprint: string,
  planPath: string,
  arguments_: readonly string[],
  requestedArtifactPath: string,
  artifactPath: string | null,
  observedArtifactPaths: readonly string[],
  run: ChildRun,
  artifact: { fingerprint: string } | null,
  artifactError: string | null,
  classification: string,
): string {
  const relativePath = `events/${ordinal}-${stage}-${id}.result.json`;
  writeSealedReplicationRecord(join(root, relativePath), {
    schema: LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
    kind: "result",
    stage,
    id,
    ordinal: Number(ordinal),
    declarationFingerprint,
    planPath,
    argv: [process.execPath, ...arguments_],
    environment: { LR_ENGINE: "wasm" },
    requestedArtifactPath,
    artifactPath,
    observedArtifactPaths: [...observedArtifactPaths],
    artifact,
    artifactError,
    classification,
    child: summarizeChild(run),
  }, `long-carrier ${stage} result`);
  return relativePath;
}

function writeSkippedAssayResult(
  root: string,
  ordinal: string,
  id: string,
  declarationFingerprint: string,
  requestedArtifactPath: string,
  reason: string,
): string {
  const relativePath = `events/${ordinal}-assay-${id}.result.json`;
  writeSealedReplicationRecord(join(root, relativePath), {
    schema: LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
    kind: "result",
    stage: "assay",
    id,
    ordinal: Number(ordinal),
    declarationFingerprint,
    planPath: null,
    argv: null,
    environment: { LR_ENGINE: "wasm" },
    requestedArtifactPath,
    artifactPath: null,
    observedArtifactPaths: [],
    artifact: null,
    artifactError: reason,
    classification: "skipped",
    child: { exitCode: null, signal: null, error: null, elapsedMs: 0, stdoutSha256: null, stderrSha256: null, stdoutTail: "", stderrTail: "" },
  }, "long-carrier skipped assay result");
  return relativePath;
}

function writeAbortEvent(root: string, declarationFingerprint: string, reason: string): string {
  const relativePath = `events/abort-${eventPaths.length + 1}.json`;
  writeSealedReplicationRecord(join(root, relativePath), {
    schema: LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
    kind: "abort",
    declarationFingerprint,
    reason,
  }, "long-carrier replication abort");
  return relativePath;
}

function summarizeChild(run: ChildRun) {
  return {
    exitCode: run.exitCode,
    signal: run.signal,
    error: run.error,
    elapsedMs: run.elapsedMs,
    stdoutSha256: sha256(run.stdout),
    stderrSha256: sha256(run.stderr),
    stdoutTail: tail(run.stdout),
    stderrTail: tail(run.stderr),
  };
}

function tail(value: string): string {
  return value.length <= STDERR_TAIL_LIMIT ? value : value.slice(-STDERR_TAIL_LIMIT);
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
