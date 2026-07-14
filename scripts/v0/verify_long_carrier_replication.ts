/** Read-only verifier for a sealed long-carrier replication output root. */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { assertPostimpactV3FixtureIntegrity, sha256, stableJson } from "./trajectory/postimpact_study_inputs.ts";
import {
  assessLongCarrierReplication,
  type LongCarrierReplicationEvidence,
  type LongCarrierReplicationExpectedIdentities,
} from "./trajectory/long_carrier_replication_assessment.ts";
import {
  LONG_CARRIER_REPLICATION_COMMAND_TEMPLATES,
  LONG_CARRIER_REPLICATION_PROTOCOL,
  LONG_CARRIER_REPLICATION_SCOPE,
  longCarrierReplicationArtifactPaths,
  longCarrierReplicationAssayArgv,
  longCarrierReplicationAssayScriptArgv,
  longCarrierReplicationCaptureArgv,
  longCarrierReplicationCaptureScriptArgv,
  type LongCarrierReplicationCase,
} from "./trajectory/long_carrier_replication_protocol.ts";
import { sameLongCarrierReplicationExecutionBinding } from "./trajectory/long_carrier_replication_identity.ts";
import { longCarrierReplicationCandidateIdentity } from "./trajectory/long_carrier_replication_candidate.ts";
import { longCarrierReplicationSourceIdentity } from "./trajectory/long_carrier_replication_source.ts";
import { assertLongCarrierReplicationRuntimeEnvironment } from "./trajectory/long_carrier_replication_runtime.ts";
import {
  LONG_CARRIER_REPLICATION_DECLARATION_SCHEMA,
  LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
  LONG_CARRIER_REPLICATION_LEDGER_SCHEMA,
  longCarrierReplicationVerdictExitCode,
  readSealedReplicationRecord,
  replicationArtifactPublicationPaths,
  replicationPublishedEventPaths,
  replicationPublishedArtifactPaths,
  resolveReplicationPath,
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

type DeclarationContract = {
  executable: string;
  publicationRoot: string;
  cases: readonly LongCarrierReplicationCase[];
};

type ExpectedInvocation = {
  stage: "capture" | "assay";
  id: string;
  ordinal: number;
  requestedArtifactPath: string;
  argv: string[];
  nodeArgv: string[];
  scriptArgv: string[];
};

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: verify_long_carrier_replication.ts --out-dir=DIR [--require-current-identity]",
    "",
    "Reads a completed long-carrier replication ledger without launching the compiler.",
    "The optional strict flag also requires this checkout to match the declaration.",
  ].join("\n") + "\n");
  process.exit(0);
}

const options = parseArguments(argv);
assertLongCarrierReplicationRuntimeEnvironment();
const outDir = options.outDir;
const declaration = readSealedReplicationRecord(
  join(outDir, "declaration.json"),
  LONG_CARRIER_REPLICATION_DECLARATION_SCHEMA,
  "long-carrier replication declaration",
);
const contract = assertDeclaration(declaration);
if (options.requireCurrentIdentity) assertCurrentIdentity(declaration);
const ledger = readSealedReplicationRecord(
  join(outDir, "ledger.json"),
  LONG_CARRIER_REPLICATION_LEDGER_SCHEMA,
  "long-carrier replication ledger",
);
if (ledger.scope !== LONG_CARRIER_REPLICATION_SCOPE ||
    ledger.declarationPath !== "declaration.json" || ledger.declarationFingerprint !== declaration.recordFingerprint) {
  throw new Error("replication ledger does not bind the sealed declaration");
}
if (ledger.completed !== true) throw new Error(`replication ledger is incomplete: ${string(ledger.abortReason, "ledger abort reason")}`);
if (ledger.abortReason !== null) throw new Error("completed replication ledger cannot retain an abort reason");

const events = readEvents(outDir, ledger, declaration.recordFingerprint);
const evidence = evidenceFromEvents(outDir, events, declaration.recordFingerprint, contract);
const assessment = assessLongCarrierReplication(evidence, expectedIdentities(declaration));
if (stableJson(ledger.assessment) !== stableJson(assessment)) {
  throw new Error("ledger assessment does not match the read-only recomputation");
}
process.stdout.write(
  `long-carrier replication verified: ${assessment.verdict}; ${evidence.length}/${contract.cases.length} declared cases\n`,
);
process.exitCode = longCarrierReplicationVerdictExitCode(assessment.verdict);

function parseArguments(values: readonly string[]): { outDir: string; requireCurrentIdentity: boolean } {
  const outputs = values.filter((value) => value.startsWith("--out-dir=")).map((value) => value.slice("--out-dir=".length));
  const requireCurrentIdentity = values.filter((value) => value === "--require-current-identity");
  const unsupported = values.filter((value) => !value.startsWith("--out-dir=") && value !== "--require-current-identity");
  if (unsupported.length > 0) throw new Error(`unsupported verification option(s): ${unsupported.join(", ")}`);
  if (outputs.length !== 1 || outputs[0] === "") throw new Error("--out-dir=DIR is required exactly once and must be non-empty");
  if (requireCurrentIdentity.length > 1) throw new Error("--require-current-identity may be supplied once");
  return { outDir: resolve(outputs[0]!), requireCurrentIdentity: requireCurrentIdentity.length === 1 };
}

/**
 * V1 is the retained compatibility contract for this reader. The declaration
 * is self-describing, but it must also match the supported V1 contract; a
 * structurally valid alternate decision rule cannot borrow this assessor.
 */
function assertDeclaration(declaration: Record<string, unknown>): DeclarationContract {
  const protocol = record(declaration.protocol, "declaration protocol");
  if (
    declaration.scope !== LONG_CARRIER_REPLICATION_SCOPE ||
    declaration.protocolFingerprint !== sha256(stableJson(protocol)) ||
    stableJson(protocol) !== stableJson(LONG_CARRIER_REPLICATION_PROTOCOL) ||
    stableJson(declaration.cases) !== stableJson(LONG_CARRIER_REPLICATION_PROTOCOL.cases) ||
    stableJson(declaration.environment) !== stableJson({ LR_ENGINE: "wasm" }) ||
    declaration.captureBudget !== LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget
  ) {
    throw new Error("replication declaration does not match the supported frozen v1 protocol");
  }
  const command = record(declaration.command, "declaration command contract");
  const executable = string(command.executable, "declaration command executable");
  if (stableJson(command.templates) !== stableJson(LONG_CARRIER_REPLICATION_COMMAND_TEMPLATES)) {
    throw new Error("replication declaration command templates do not match the frozen protocol");
  }
  const revision = record(declaration.sourceRevision, "declaration source revision");
  if (!isGitObjectId(string(revision.head, "declaration source revision head")) ||
      !isGitObjectId(string(revision.tree, "declaration source revision tree"))) {
    throw new Error("replication declaration has malformed source revision identities");
  }
  const paths = stringArray(declaration.definitionPaths, "declaration definitionPaths");
  if (new Set(paths).size !== paths.length) throw new Error("declaration definitionPaths contains duplicates");
  const fingerprints = record(declaration.definitionFileFingerprints, "declaration definitionFileFingerprints");
  if (Object.keys(fingerprints).length !== paths.length || paths.some((path) => !isSha256(string(fingerprints[path], `source fingerprint for ${path}`)))) {
    throw new Error("declaration definition source fingerprints do not exactly cover its source closure");
  }
  assertExpectedIdentityShape(declaration);
  const publicationRoot = string(declaration.publicationRoot, "declaration publication root");
  if (resolve(publicationRoot) !== publicationRoot) {
    throw new Error("declaration publication root must be an absolute normalized path");
  }
  return { executable, publicationRoot, cases: LONG_CARRIER_REPLICATION_PROTOCOL.cases };
}

/** Only strict compatibility verification touches the current worktree. */
function assertCurrentIdentity(declaration: Record<string, unknown>): void {
  const execution = record(declaration.execution, "declaration execution");
  const expected = {
    controllerSourceIdentity: longCarrierReplicationSourceIdentity(CONTROLLER_PATH),
    verifierSourceIdentity: longCarrierReplicationSourceIdentity(VERIFIER_PATH),
    captureSourceIdentity: longCarrierReplicationSourceIdentity(CAPTURE_PATH),
    assaySourceIdentity: postimpactAssaySourceIdentity(ASSAY_PATH),
    captureCandidate: longCarrierReplicationCandidateIdentity("wasm"),
    assayRuntime: postimpactAssayRuntimeIdentity(),
  };
  if (!sameLongCarrierReplicationExecutionBinding(execution, expected)) {
    throw new Error("current controller, runner, compiler candidate, assay source, or runtime identity differs from the declaration");
  }
}

function readEvents(root: string, ledger: Record<string, unknown>, declarationFingerprint: string): Record<string, unknown>[] {
  const paths = stringArray(ledger.eventPaths, "ledger eventPaths");
  if (new Set(paths).size !== paths.length) throw new Error("ledger lists a duplicate event path");
  const published = replicationPublishedEventPaths(root);
  if (stableJson(paths.slice().sort()) !== stableJson(published)) {
    throw new Error("ledger event inventory does not match the output root");
  }
  return paths.map((relativePath) => {
    const event = readSealedReplicationRecord(
      resolveReplicationPath(root, relativePath, "ledger event path"),
      LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
      `replication event ${relativePath}`,
    );
    if (event.declarationFingerprint !== declarationFingerprint) {
      throw new Error(`event ${relativePath} does not bind the declaration`);
    }
    return { ...event, _relativePath: relativePath };
  });
}

function evidenceFromEvents(
  root: string,
  events: readonly Record<string, unknown>[],
  declarationFingerprint: string,
  contract: DeclarationContract,
): LongCarrierReplicationEvidence[] {
  const resultEvents = events.filter((event) => event.kind === "result");
  const planEvents = new Map(events
    .filter((event) => event.kind === "plan")
    .map((event) => [string(event._relativePath, "plan relative path"), event]));
  if (events.some((event) => event.kind !== "plan" && event.kind !== "result")) {
    throw new Error("completed ledger contains a non-stage event");
  }
  const usedPlans = new Set<string>();
  const evidence: LongCarrierReplicationEvidence[] = [];
  for (const [index, entry] of contract.cases.entries()) {
    const ordinal = index + 1;
    const paths = longCarrierReplicationArtifactPaths(ordinal, entry.id);
    const fixturePath = resolveReplicationPath(contract.publicationRoot, paths.fixture, "declared capture artifact path");
    const assayPath = resolveReplicationPath(contract.publicationRoot, paths.assay, "declared assay artifact path");
    const captureExpected: ExpectedInvocation = {
      stage: "capture",
      id: entry.id,
      ordinal,
      requestedArtifactPath: paths.fixture,
      nodeArgv: longCarrierReplicationCaptureArgv(entry, fixturePath),
      scriptArgv: longCarrierReplicationCaptureScriptArgv(entry, fixturePath),
      argv: [],
    };
    captureExpected.argv = [contract.executable, ...captureExpected.nodeArgv];
    const assayExpected: ExpectedInvocation = {
      stage: "assay",
      id: entry.id,
      ordinal,
      requestedArtifactPath: paths.assay,
      nodeArgv: longCarrierReplicationAssayArgv(fixturePath, assayPath),
      scriptArgv: longCarrierReplicationAssayScriptArgv(fixturePath, assayPath),
      argv: [],
    };
    assayExpected.argv = [contract.executable, ...assayExpected.nodeArgv];
    const captureEvent = oneResult(resultEvents, "capture", entry.id, ordinal);
    const capture = inspectCaptureResult(root, captureEvent, planEvents, usedPlans, declarationFingerprint, captureExpected);
    const assayEvent = oneResult(resultEvents, "assay", entry.id, ordinal);
    const assay = inspectAssayResult(
      root,
      assayEvent,
      planEvents,
      usedPlans,
      declarationFingerprint,
      assayExpected,
      capture,
      fixturePath,
    );
    evidence.push({
      id: entry.id,
      capture: { exitCode: capture.exitCode, fixture: capture.fixture, failureKind: "invalid" },
      assay: { exitCode: assay.exitCode, artifact: assay.artifact },
    });
  }
  if (resultEvents.length !== contract.cases.length * 2) throw new Error("ledger has an unexpected result-event roster");
  if (usedPlans.size !== planEvents.size) throw new Error("ledger contains an orphaned stage plan");
  const referencedArtifacts = new Set(resultEvents.flatMap((event) =>
    stringArray(event.observedArtifactPaths, "result observed artifact paths"),
  ));
  const unledgeredArtifacts = replicationPublishedArtifactPaths(root).filter((path) => !referencedArtifacts.has(path));
  if (unledgeredArtifacts.length > 0) {
    throw new Error(`output root contains unledgered fixture or assay artifacts: ${unledgeredArtifacts.join(", ")}`);
  }
  return evidence;
}

type InspectedCapture = {
  classification: string;
  exitCode: number | null;
  fixture: Record<string, unknown> | null;
};

type InspectedAssay = {
  exitCode: number | null;
  artifact: Record<string, unknown> | null;
};

function inspectCaptureResult(
  root: string,
  event: Record<string, unknown>,
  plans: ReadonlyMap<string, Record<string, unknown>>,
  usedPlans: Set<string>,
  declarationFingerprint: string,
  expected: ExpectedInvocation,
): InspectedCapture {
  assertExecutedResult(event, plans, usedPlans, declarationFingerprint, expected);
  const classification = string(event.classification, "capture classification");
  if (classification !== "captured" && classification !== "invalid") {
    throw new Error("capture result has an unsupported classification");
  }
  const publication = assertPublicationInventory(root, event, expected.requestedArtifactPath, true);
  const exitCode = childExitCode(event);
  const fixture = loadFixtureFromEvent(root, event, expected, publication);
  if (classification === "captured") {
    if (!childCompletedSuccessfully(event) || publication.artifactPath !== expected.requestedArtifactPath ||
        stableJson(publication.paths) !== stableJson([expected.requestedArtifactPath]) || fixture === null) {
      throw new Error("captured result lacks one successful normal fixture publication");
    }
  }
  if (classification === "invalid" && exitCode === 0 && publication.artifactPath === expected.requestedArtifactPath &&
      stableJson(publication.paths) === stableJson([expected.requestedArtifactPath]) && fixture !== null) {
    throw new Error("invalid capture result is indistinguishable from a successful normal capture");
  }
  if (classification === "invalid" && fixture !== null && publication.artifactPath !== null &&
      publication.artifactPath !== expected.requestedArtifactPath) {
    const identityCheck = nullableRecord(record(fixture.capture, "forensic fixture capture").identityCheck);
    if (identityCheck?.stable !== false) throw new Error("forensic fixture publication does not attest identity drift");
  }
  return { classification, exitCode, fixture };
}

function inspectAssayResult(
  root: string,
  event: Record<string, unknown>,
  plans: ReadonlyMap<string, Record<string, unknown>>,
  usedPlans: Set<string>,
  declarationFingerprint: string,
  expected: ExpectedInvocation,
  capture: InspectedCapture,
  fixturePath: string,
): InspectedAssay {
  const classification = string(event.classification, "assay classification");
  if (classification === "skipped") {
    if (capture.classification === "captured" || event.planPath !== null || event.argv !== null ||
        event.artifact !== null || event.artifactPath !== null || stableJson(stringArray(event.observedArtifactPaths, "skipped assay observed artifacts")) !== "[]" ||
        !isSkippedChild(event.child)) {
      throw new Error("skipped assay result is not a clean consequence of a failed capture");
    }
    if (event.requestedArtifactPath !== expected.requestedArtifactPath || stableJson(event.environment) !== stableJson({ LR_ENGINE: "wasm" })) {
      throw new Error("skipped assay result does not bind the declaration");
    }
    const observed = replicationArtifactPublicationPaths(root, expected.requestedArtifactPath);
    if (observed.length !== 0) throw new Error("skipped assay result omitted a published assay artifact");
    return { exitCode: null, artifact: null };
  }
  if (capture.classification !== "captured") {
    throw new Error("an assay was planned or executed after a failed capture");
  }
  if (classification !== "assayed" && classification !== "invalid") {
    throw new Error("assay result has an unsupported classification");
  }
  assertExecutedResult(event, plans, usedPlans, declarationFingerprint, expected);
  const publication = assertPublicationInventory(root, event, expected.requestedArtifactPath, false);
  const exitCode = childExitCode(event);
  const artifact = loadAssayFromEvent(root, event, expected, publication, fixturePath);
  if (classification === "assayed" &&
      (!childCompletedSuccessfully(event) || publication.artifactPath !== expected.requestedArtifactPath ||
       stableJson(publication.paths) !== stableJson([expected.requestedArtifactPath]) || artifact === null)) {
    throw new Error("assayed result lacks one successful normal assay publication");
  }
  if (classification === "invalid" && exitCode === 0 && publication.artifactPath === expected.requestedArtifactPath &&
      stableJson(publication.paths) === stableJson([expected.requestedArtifactPath]) && artifact !== null) {
    throw new Error("invalid assay result is indistinguishable from a successful normal assay");
  }
  return { exitCode, artifact };
}

function assertExecutedResult(
  event: Record<string, unknown>,
  plans: ReadonlyMap<string, Record<string, unknown>>,
  usedPlans: Set<string>,
  declarationFingerprint: string,
  expected: ExpectedInvocation,
): void {
  if (event.declarationFingerprint !== declarationFingerprint || event.stage !== expected.stage || event.id !== expected.id ||
      event.ordinal !== expected.ordinal || event.requestedArtifactPath !== expected.requestedArtifactPath ||
      stableJson(event.environment) !== stableJson({ LR_ENGINE: "wasm" }) || stableJson(event.argv) !== stableJson(expected.argv)) {
    throw new Error(`result event ${string(event._relativePath, "result relative path")} does not match the declared invocation`);
  }
  const planPath = string(event.planPath, "executed result planPath");
  const plan = plans.get(planPath);
  if (plan === undefined || plan.kind !== "plan" || plan.stage !== expected.stage || plan.id !== expected.id ||
      plan.ordinal !== expected.ordinal || plan.declarationFingerprint !== declarationFingerprint ||
      plan.requestedArtifactPath !== expected.requestedArtifactPath || stableJson(plan.argv) !== stableJson(expected.argv) ||
      stableJson(plan.environment) !== stableJson({ LR_ENGINE: "wasm" })) {
    throw new Error(`result event ${string(event._relativePath, "result relative path")} does not match its declared immutable plan`);
  }
  usedPlans.add(planPath);
}

function assertPublicationInventory(
  root: string,
  event: Record<string, unknown>,
  requestedArtifactPath: string,
  includeIdentityDriftSiblings: boolean,
): { artifactPath: string | null; paths: string[] } {
  const paths = stringArray(event.observedArtifactPaths, "result observed artifact paths");
  if (new Set(paths).size !== paths.length || stableJson(paths) !== stableJson([...paths].sort())) {
    throw new Error("result observed artifact paths must be unique and sorted");
  }
  const actual = replicationArtifactPublicationPaths(root, requestedArtifactPath, { includeIdentityDriftSiblings });
  if (stableJson(paths) !== stableJson(actual)) {
    throw new Error("result artifact inventory does not match the output root");
  }
  const artifactPath = nullableString(event.artifactPath, "result artifact path");
  if (artifactPath !== null && !paths.includes(artifactPath)) {
    throw new Error("result authoritative artifact path is absent from its publication inventory");
  }
  return { artifactPath, paths };
}

function loadFixtureFromEvent(
  root: string,
  event: Record<string, unknown>,
  expected: ExpectedInvocation,
  publication: { artifactPath: string | null; paths: string[] },
): Record<string, unknown> | null {
  const metadata = nullableRecord(event.artifact);
  if (publication.artifactPath === null) {
    if (metadata !== null) throw new Error("capture result has metadata without an authoritative artifact path");
    return null;
  }
  if (metadata === null) return null;
  const fixture: unknown = JSON.parse(readFileSync(resolveReplicationPath(root, publication.artifactPath, "capture artifact path"), "utf8"));
  assertPostimpactV3FixtureIntegrity(fixture, "replication fixture");
  if (fixture.schema !== "line.frozen-trajectory-prefix.v3" || metadata.fingerprint !== fixture.fixtureFingerprint) {
    throw new Error("capture result artifact fingerprint does not match the sealed fixture");
  }
  const capture = record(fixture.capture, "fixture capture provenance");
  if (stableJson(capture.argv) !== stableJson(expected.scriptArgv)) {
    throw new Error("fixture capture argv does not match the declared capture invocation");
  }
  return fixture as Record<string, unknown>;
}

function loadAssayFromEvent(
  root: string,
  event: Record<string, unknown>,
  expected: ExpectedInvocation,
  publication: { artifactPath: string | null; paths: string[] },
  fixturePath: string,
): Record<string, unknown> | null {
  const metadata = nullableRecord(event.artifact);
  if (publication.artifactPath === null) {
    if (metadata !== null) throw new Error("assay result has metadata without an authoritative artifact path");
    return null;
  }
  if (metadata === null) return null;
  const assay = readPostimpactAssayArtifact(resolveReplicationPath(root, publication.artifactPath, "assay artifact path"));
  if (metadata.fingerprint !== assay.artifactContentFingerprint) {
    throw new Error("assay result artifact fingerprint does not match the sealed artifact");
  }
  if (stableJson(assay.argv) !== stableJson(expected.scriptArgv)) {
    throw new Error("assay argv does not match the declared assay invocation");
  }
  const provenance = record(assay.provenance, "assay provenance");
  if (provenance.fixturePath !== fixturePath) {
    throw new Error("assay provenance fixture path does not match the declared capture artifact path");
  }
  return assay;
}

function oneResult(
  results: readonly Record<string, unknown>[],
  stage: "capture" | "assay",
  id: string,
  ordinal: number,
): Record<string, unknown> {
  const matches = results.filter((event) => event.stage === stage && event.id === id && event.ordinal === ordinal);
  if (matches.length !== 1) throw new Error(`expected exactly one ${stage} result for ${id}`);
  return matches[0]!;
}

function expectedIdentities(declaration: Record<string, unknown>): LongCarrierReplicationExpectedIdentities {
  const execution = record(declaration.execution, "declaration execution");
  const captureSource = record(execution.captureSourceIdentity, "declaration capture source identity");
  const candidate = record(execution.captureCandidate, "declaration capture candidate");
  const assaySource = record(execution.assaySourceIdentity, "declaration assay source identity");
  const runtime = record(execution.assayRuntime, "declaration assay runtime");
  return {
    captureStudySourceFingerprint: string(captureSource.fingerprint, "capture source fingerprint"),
    captureCandidateFingerprint: string(candidate.candidateFingerprint, "capture candidate fingerprint"),
    assaySourceFingerprint: string(assaySource.fingerprint, "assay source fingerprint"),
    assayRuntimeFingerprint: string(runtime.fingerprint, "assay runtime fingerprint"),
  };
}

function assertExpectedIdentityShape(declaration: Record<string, unknown>): void {
  const expected = expectedIdentities(declaration);
  if (Object.values(expected).some((value) => !isSha256(value))) {
    throw new Error("declaration execution identities must be SHA-256 fingerprints");
  }
}

function childExitCode(event: Record<string, unknown>): number | null {
  const child = record(event.child, "result child");
  const value = child.exitCode;
  if (value === null || (typeof value === "number" && Number.isSafeInteger(value))) return value;
  throw new Error("result child has malformed exit code");
}

function childCompletedSuccessfully(event: Record<string, unknown>): boolean {
  const child = record(event.child, "result child");
  return child.exitCode === 0 && child.signal === null && child.error === null;
}

function isSkippedChild(value: unknown): boolean {
  const child = nullableRecord(value);
  return child !== null && child.exitCode === null && child.signal === null && child.error === null && child.elapsedMs === 0 &&
    child.stdoutSha256 === null && child.stderrSha256 === null && child.stdoutTail === "" && child.stderrTail === "";
}

function record(value: unknown, label: string): Record<string, unknown> {
  const result = nullableRecord(value);
  if (result === null) throw new Error(`${label} must be an object`);
  return result;
}

function nullableRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item === "")) {
    throw new Error(`${label} must be a nonempty-string array`);
  }
  return [...value] as string[];
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return string(value, label);
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") throw new Error(`${label} must be a nonempty string`);
  return value;
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function isGitObjectId(value: string): boolean {
  return /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
}
