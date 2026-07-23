/**
 * Decision-contract migration (RFC C.5).
 *
 * The baseline binds two identities: the INFERENCE identity (code + constants
 * mapping data to verdicts; binds the calibration and every study) and the
 * decision-PROTOCOL identity (eligibility, gating, snapshot/freezing,
 * promotion semantics). This command is the only sanctioned way to move
 * either stamp — replacing the hand-assembled bundle surgery the
 * `decision-contract-r2` re-freeze required.
 *
 * Scopes (file lists set the MINIMUM; behavior escalates):
 *   protocol    — protocol-identity files changed; conformance + re-stamp;
 *                 no study regeneration.
 *   calibration — the calibration artifact itself was regenerated (same
 *                 inference code); verify + re-stamp.
 *   inference   — inference files, certified eval-chain semantics, or
 *                 --alters-decision-behavior=yes: final-decision changes
 *                 require fresh coverage/calibration; eval-chain changes
 *                 require fresh menu/holdout certification.
 * Any change to a suite-definition file refuses outright (suite rollover).
 *
 * Conformance (all scopes): the governance/decision vitest subset must pass,
 * and the decision-conformance fixture must replay exactly — any drift
 * without a `yes` attestation refuses (unattested behavioral change).
 *
 * Every migration appends a machine-readable record to
 * benchmark/v2/migrations.jsonl and atomically re-stamps baseline.json,
 * the confirmation state, and the baseline doc's fingerprint lines.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { benchmarkEvalPolicy } from "../../../benchmark/v2/eval-policy.ts";
import {
  DECISION_INFERENCE_SOURCE_FILES,
  pairedV2DecisionForCalibration,
  type DecisionRun,
} from "./decision_model.ts";
import { DECISION_PROTOCOL_SOURCE_FILES } from "./decision_protocol.ts";
import { EVAL_CHAIN_INFERENCE_SOURCE_FILES } from "./eval_chain_inference.ts";
import { CERTIFICATION_GENERATOR_SOURCE_FILES } from "./certification_identity.ts";
import { appendFileDurable, removeFileDurable, writeFileAtomicDurable } from "./durable_fs.ts";
import { loadValidatedDecisionPairForCalibration } from "./decide.ts";
import { loadSourceManifest, resolveSources } from "./model.ts";
import {
  BENCHMARK_DEFINITION_SOURCE_FILES,
  canonicalMembers,
  fingerprintFiles,
  loadSuiteManifest,
  RUNNER_IMPLEMENTATION_SOURCE_FILES,
  suiteIdentity,
  type SuiteManifest,
} from "./suite_model.ts";
import {
  assertNoAttemptInFlight,
  readAttemptEvents,
  readEraState,
  withAttemptLedgerTransaction,
  type AttemptPaths,
  type EraState,
  type ProtocolRebindEvent,
} from "./attempts.ts";
import { readEvalDeclaration } from "./confirmation.ts";
import {
  baselineCacheManifestFingerprint,
  cacheCoverage,
  readBaselineCache,
} from "./baseline_cache.ts";
import { runnerCompatibilityApproval, type RunnerCompatibilityApproval } from "./runner_compatibility.ts";
import {
  requireCertifiedOperatingPoint,
  requireCurrentDecisionCalibration,
  type DecisionContractIdentity,
} from "./calibration_guard.ts";

export const MIGRATIONS_LEDGER_PATH = "benchmark/v2/migrations.jsonl";
export const CONFORMANCE_FIXTURE_PATH = "benchmark/v2/evidence/decision-conformance.json";
export const MIGRATION_PENDING_PATH = "benchmark/v2/migration-pending.json";
const BASELINE_PUBLICATION_PENDING_PATH = "benchmark/v2/baseline-publication-pending.json";
const MIGRATION_RECORD_SCHEMA = "line.benchmark-v2.migration-record.v1" as const;
const CONFORMANCE_SCHEMA = "line.benchmark-v2.decision-conformance.v1" as const;
const CONFORMANCE_TEST_FILES = [
  "tests/benchmark_v2_governance.test.ts",
  "tests/benchmark_v2_decision.test.ts",
  "tests/benchmark_v2_decide_cli.test.ts",
  "tests/benchmark_v2_numeric_fixtures.test.ts",
  "tests/benchmark_v2_protocol_surface.test.ts",
  "tests/benchmark_v2_attempts.test.ts",
  "tests/benchmark_v2_eval_policy.test.ts",
];

type Scope = "protocol" | "calibration" | "inference";
const SCOPE_ORDER: Scope[] = ["calibration", "protocol", "inference"];

type InFlightRebindPreparation = {
  /** True when preserving the one existing immutable rebind event. */
  continuation: boolean;
  attemptId: string;
  declarationSha256: string;
  baselineLabel: string;
  baselineCandidateFingerprint: string;
  baselineSnapshotSha256: string;
  baselineSuiteFingerprint: string;
  baselineCacheManifestFingerprint: string;
  from: { inference: string; protocol: string; calibration: string };
  runnerCompatibility: RunnerCompatibilityApproval;
};

export type MigrationRecord = {
  schema: typeof MIGRATION_RECORD_SCHEMA;
  migrationId: string;
  performedAt: string;
  operator: string;
  reason: string;
  declaredScope: Scope;
  minimumScopeDetected: Scope | "none";
  effectiveScope: Scope;
  altersDecisionBehavior: { attested: boolean; rationale: string };
  from: Record<string, string | null>;
  to: Record<string, string>;
  changedFiles: Array<{ path: string; fromSha256: string | null; toSha256: string }>;
  fileHashes: Record<string, string>;
  conformance: {
    vitest: "passed" | "skipped";
    fixtures: Array<{ name: string; result: string }>;
    fixture: { beforeSha256: string; afterSha256: string; replaced: boolean };
  };
  restamped: { baselineSha256: string };
  bootstrap: boolean;
};

export type PendingMigration = {
  schema: "line.benchmark-v2.migration-publication.v1";
  previousMigrationId: string | null;
  baselinePath: string;
  baselineBeforeSha256: string;
  baselineBytes: string;
  fixturePath: string;
  fixtureBeforeSha256: string;
  fixtureBytes: string | null;
  record: MigrationRecord;
  protocolRebind?: ProtocolRebindEvent;
  /** An already-rebound attempt allowed this protocol-only publication. */
  inFlightRebindContinuationAttemptId?: string;
};

export type MigrationPublicationOptions = {
  attemptPaths?: AttemptPaths;
  pendingPath?: string;
  conflictingPendingPath?: string;
  migrationsLedgerPath?: string;
  fixturePath?: string;
  restampBaselineDoc?: (baseline: any) => void;
  afterJournal?: () => void;
  afterFixture?: () => void;
  afterBaseline?: () => void;
  afterLedgerAppend?: () => void;
};

export async function runMigrationCommand(argv = process.argv.slice(2)): Promise<number> {
  const argument = (name: string): string | undefined =>
    argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const json = argv.includes("--json");
  if (existsSync(BASELINE_PUBLICATION_PENDING_PATH)) {
    throw new Error(`baseline publication is incomplete; rerun baseline or rebaseline before migrating`);
  }
  const recovered = recoverPendingMigration();
  if (recovered !== null) {
    const summary = {
      migrationId: recovered.migrationId,
      recovered: true,
      effectiveScope: recovered.effectiveScope,
      to: recovered.to,
      nextCommand: "npm run benchmark -- eval",
    };
    console.log(json ? JSON.stringify(summary, null, 2)
      : `recovered migration ${recovered.migrationId}; nextCommand: ${summary.nextCommand}`);
    return 0;
  }
  const recordFixtures = argv.includes("--record-fixtures");
  if (recordFixtures) {
    throw new Error(
      `--record-fixtures was removed: fixture replacement is staged and published only by an approved ` +
      `inference migration with --alters-decision-behavior=yes`,
    );
  }
  const declaredScope = argument("scope") as Scope | undefined;
  const behavior = argument("alters-decision-behavior");
  const reason = argument("reason");
  const operator = argument("operator") ?? process.env.USER ?? "";
  const rebindAttemptId = argument("rebind-inflight");
  const approve = argv.includes("--approve");
  if (declaredScope === undefined || !SCOPE_ORDER.includes(declaredScope)) {
    throw new Error(`--scope must be protocol|calibration|inference`);
  }
  if (behavior !== "yes" && behavior !== "no") {
    throw new Error(`--alters-decision-behavior=yes|no is required (the behavioral attestation)`);
  }
  if (!approve || reason === undefined || reason.trim() === "" || operator.trim() === "") {
    throw new Error(`migration requires --approve, --reason=..., and an operator (--operator= or $USER)`);
  }

  // Ordinary migrations may not run while an attempt is in flight.  The
  // explicit rebind spelling is the sole exception, and is narrowed further
  // once the current contract/cache/runner proof are available below.
  let inFlightAttemptId: string | null = null;
  if (existsSync("benchmark/v2/attempts.jsonl")) {
    const era = readEraState();
    inFlightAttemptId = era.inFlightAttemptId;
    if (era.inFlightAttemptId !== null && rebindAttemptId === undefined) {
      throw new Error(`an eval attempt is in flight (${era.inFlightAttemptId}); migrations require no attempt in flight`);
    }
    if (rebindAttemptId !== undefined && era.inFlightAttemptId !== rebindAttemptId) {
      throw new Error(
        `--rebind-inflight=${rebindAttemptId} requires that exact attempt to be in flight ` +
        `(in flight: ${era.inFlightAttemptId ?? "none"})`,
      );
    }
  } else if (rebindAttemptId !== undefined) {
    throw new Error(`--rebind-inflight requires an attempts ledger and an in-flight attempt`);
  }
  if (rebindAttemptId !== undefined && (declaredScope !== "protocol" || behavior !== "no")) {
    throw new Error(`--rebind-inflight is limited to --scope=protocol --alters-decision-behavior=no`);
  }

  // File-hash diff against the last ledger record.
  const allFiles = [...new Set([
    ...DECISION_INFERENCE_SOURCE_FILES,
    ...EVAL_CHAIN_INFERENCE_SOURCE_FILES,
    ...CERTIFICATION_GENERATOR_SOURCE_FILES,
    ...DECISION_PROTOCOL_SOURCE_FILES,
    ...BENCHMARK_DEFINITION_SOURCE_FILES,
    CONFORMANCE_FIXTURE_PATH,
  ])].sort();
  const fileHashes = Object.fromEntries(allFiles.map((path) => [path, sha256File(path)]));
  const lastRecord = readLastRecord();
  const bootstrap = lastRecord === null;
  const sourceManifestPath = "benchmark/v2/compat/source-manifest.json";
  const suiteManifestPath = "benchmark/v2/compat/suite-manifest.json";
  const sources = resolveSources(loadSourceManifest(sourceManifestPath));
  const identity = suiteIdentity(suiteManifestPath, sourceManifestPath, sources);
  const baselinePath = "benchmark/v2/baseline.json";
  const baselineBeforeBytes = readFileSync(baselinePath);
  const baselineBeforeSha256 = sha256(baselineBeforeBytes);
  const baseline = JSON.parse(baselineBeforeBytes.toString("utf8"));
  const suiteRolloverAnchor = !bootstrap &&
    lastRecord.to.suite !== identity.suiteFingerprint &&
    baseline.suite_fingerprint === identity.suiteFingerprint;
  const changedFiles = bootstrap ? [] : allFiles
    .filter((path) => lastRecord.fileHashes[path] !== fileHashes[path])
    .map((path) => ({ path, fromSha256: lastRecord.fileHashes[path] ?? null, toSha256: fileHashes[path] }));
  if (
    !bootstrap && lastRecord.fileHashes[CONFORMANCE_FIXTURE_PATH] !== undefined &&
    lastRecord.fileHashes[CONFORMANCE_FIXTURE_PATH] !== fileHashes[CONFORMANCE_FIXTURE_PATH]
  ) {
    throw new Error(
      `decision-conformance fixture changed outside a migration; restore the ledgered fixture before proceeding`,
    );
  }

  const definitionChanged = changedFiles.some((file) =>
    (BENCHMARK_DEFINITION_SOURCE_FILES as readonly string[]).includes(file.path));
  if (definitionChanged && !suiteRolloverAnchor) {
    throw new Error(
      `a suite-definition file changed (${changedFiles.filter((f) =>
        (BENCHMARK_DEFINITION_SOURCE_FILES as readonly string[]).includes(f.path)).map((f) => f.path).join(", ")}); ` +
      `that is a suite rollover, not a contract migration — batch it with the next intentional suite change`,
    );
  }
  const detectedMinimumScope = detectMinimumScope(changedFiles.map((file) => file.path));
  const minimumScope: Scope | "none" = detectedMinimumScope === "suite"
    ? "inference"
    : detectedMinimumScope;
  let effectiveScope: Scope = declaredScope;
  if (behavior === "yes") effectiveScope = "inference";
  if (minimumScope !== "none" && SCOPE_ORDER.indexOf(effectiveScope) < SCOPE_ORDER.indexOf(minimumScope)) {
    throw new Error(`declared scope ${declaredScope} is below the detected minimum ${minimumScope}; re-declare (deliberate upward escalation is allowed)`);
  }

  // Freshness: the guards verify final-decision coverage/calibration and, for
  // inference scope, every certified eval-chain operating point. Only the
  // evidence whose fingerprint changed needs regeneration.
  let contract: DecisionContractIdentity;
  try {
    contract = requireCurrentDecisionCalibration(identity.suiteFingerprint);
    if (effectiveScope === "inference") {
      for (const point of benchmarkEvalPolicy.operatingPoints) {
        requireCertifiedOperatingPoint(
          point.mode,
          point.margin,
          point.depth,
          identity.suiteFingerprint,
        );
      }
    }
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n` +
      `regenerate first (in order):\n` +
      `  node --import tsx scripts/benchmark/study_decision_coverage.ts   # inference scope only\n` +
      `  node --import tsx scripts/benchmark/calibrate_decisions.ts\n` +
      `  node --import tsx scripts/benchmark/validate_independent_reference.ts  # inference scope: menu + holdout`,
    );
  }

  // Ledger/baseline divergence guard (skipped at bootstrap).
  if (!bootstrap && !suiteRolloverAnchor) {
    const stampedInference = baseline.decision_inference_fingerprint ?? null;
    const stampedProtocol = baseline.decision_protocol_fingerprint ?? null;
    if (lastRecord.to.inference !== stampedInference || lastRecord.to.protocol !== stampedProtocol) {
      throw new Error(`migrations ledger and baseline stamps diverge — the baseline was edited outside the migration command`);
    }
  }
  if (baseline.suite_fingerprint !== identity.suiteFingerprint) {
    throw new Error(`current suite fingerprint differs from the baseline; suite changes are a rollover, not a migration`);
  }

  const rebind = rebindAttemptId === undefined
    ? null
    : prepareInFlightProtocolRebind({
      attemptId: rebindAttemptId,
      inFlightAttemptId,
      baseline,
      baselinePath,
      contract,
      suiteFingerprint: identity.suiteFingerprint,
    });

  // Conformance: vitest subset + fixture replay.
  console.log(`conformance: vitest subset (${CONFORMANCE_TEST_FILES.length} files)...`);
  execFileSync("npx", ["vitest", "run", ...CONFORMANCE_TEST_FILES], {
    stdio: process.env.LINE_BENCHMARK_JSON_STDOUT === "1"
      ? ["inherit", process.stderr, process.stderr]
      : "inherit",
  });
  const fixtureBeforeBytes = readFileSync(CONFORMANCE_FIXTURE_PATH);
  const fixtureBeforeSha256 = sha256(fixtureBeforeBytes);
  const fixtureResults = await replayConformanceFixture();
  const drifted = fixtureResults.filter((result) => result.result !== "matched");
  if (drifted.length > 0 && behavior === "no") {
    throw new Error(
      `unattested behavioral drift: ${drifted.map((d) => d.name).join(", ")} — ` +
      `declare --alters-decision-behavior=yes (inference scope) if the change is intentional`,
    );
  }
  const replacementFixtureBytes = drifted.length > 0
    ? conformanceFixtureBytes(await computeFixtureCases())
    : null;
  const fixtureAfterSha256 = replacementFixtureBytes === null
    ? fixtureBeforeSha256
    : sha256(replacementFixtureBytes);
  fileHashes[CONFORMANCE_FIXTURE_PATH] = fixtureAfterSha256;
  if (replacementFixtureBytes !== null) {
    const existingChange = changedFiles.find((file) => file.path === CONFORMANCE_FIXTURE_PATH);
    if (existingChange === undefined) {
      changedFiles.push({
        path: CONFORMANCE_FIXTURE_PATH,
        fromSha256: fixtureBeforeSha256,
        toSha256: fixtureAfterSha256,
      });
      changedFiles.sort((a, b) => a.path.localeCompare(b.path));
    } else {
      existingChange.toSha256 = fixtureAfterSha256;
    }
  }

  // Re-stamp decision identities without discarding a v10 canonical-cache
  // manifest.  A migration changes the decision contract; it is not licence
  // to erase immutable baseline evidence or its content-addressed shards.
  const from = {
    inference: baseline.decision_inference_fingerprint ?? null,
    protocol: baseline.decision_protocol_fingerprint ?? null,
    calibration: baseline.decision_calibration_fingerprint ?? null,
    legacyDecisionFingerprint: baseline.decision_fingerprint ?? null,
    suite: baseline.suite_fingerprint,
  };
  delete baseline.decision_fingerprint;
  baseline.schema = baseline.canonical_cache === undefined
    ? "line.benchmark-v2.baseline-reference.v9"
    : "line.benchmark-v2.baseline-reference.v10";
  baseline.decision_inference_fingerprint = contract.inferenceFingerprint;
  baseline.decision_protocol_fingerprint = contract.protocolFingerprint;
  baseline.decision_calibration_fingerprint = contract.calibrationFingerprint;
  const baselineBytes = `${JSON.stringify(baseline, null, 2)}\n`;

  const record: MigrationRecord = {
    schema: MIGRATION_RECORD_SCHEMA,
    migrationId: `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")}-${createHash("sha256")
      .update(baselineBytes).digest("hex").slice(0, 8)}`,
    performedAt: new Date().toISOString(),
    operator,
    reason,
    declaredScope,
    minimumScopeDetected: minimumScope,
    effectiveScope,
    altersDecisionBehavior: { attested: behavior === "yes", rationale: reason },
    from,
    to: {
      inference: contract.inferenceFingerprint,
      protocol: contract.protocolFingerprint,
      calibration: contract.calibrationFingerprint,
      suite: identity.suiteFingerprint,
    },
    changedFiles,
    fileHashes,
    conformance: {
      vitest: "passed",
      fixtures: fixtureResults.map((result) =>
        replacementFixtureBytes !== null && result.result === "drifted"
          ? { ...result, result: "re-recorded" }
          : result
      ),
      fixture: {
        beforeSha256: fixtureBeforeSha256,
        afterSha256: fixtureAfterSha256,
        replaced: replacementFixtureBytes !== null,
      },
    },
    restamped: {
      baselineSha256: createHash("sha256").update(baselineBytes).digest("hex"),
    },
    bootstrap,
  };
  const protocolRebind = rebind === null || rebind.continuation ? undefined : protocolRebindEvent({
    preparation: rebind,
    record,
    to: {
      inference: contract.inferenceFingerprint,
      protocol: contract.protocolFingerprint,
      calibration: contract.calibrationFingerprint,
    },
    reason,
    operator,
  });
  publishMigration({
    record,
    previousMigrationId: lastRecord?.migrationId ?? null,
    baselinePath,
    baselineBeforeSha256,
    baselineBytes,
    baseline,
    fixtureBeforeSha256,
    fixtureBytes: replacementFixtureBytes,
    protocolRebind,
    ...(rebind?.continuation === true
      ? { inFlightRebindContinuationAttemptId: rebind.attemptId }
      : {}),
  });
  const summary = {
    migrationId: record.migrationId,
    effectiveScope,
    changedFiles: changedFiles.map((file) => file.path),
    to: record.to,
    nextCommand: "npm run benchmark -- eval",
  };
  console.log(json ? JSON.stringify(summary, null, 2)
    : `migrated (${effectiveScope}): ${record.migrationId}\n  inference ${contract.inferenceFingerprint.slice(0, 12)}  protocol ${contract.protocolFingerprint.slice(0, 12)}  calibration ${contract.calibrationFingerprint.slice(0, 12)}\n  nextCommand: ${summary.nextCommand}`);
  return 0;
}

function prepareInFlightProtocolRebind(input: {
  attemptId: string;
  inFlightAttemptId: string | null;
  baseline: any;
  baselinePath: string;
  contract: DecisionContractIdentity;
  suiteFingerprint: string;
}): InFlightRebindPreparation {
  if (input.inFlightAttemptId !== input.attemptId) {
    throw new Error(`protocol rebind requires the named attempt to remain in flight`);
  }
  const events = readAttemptEvents();
  const declare = events.find((event: any) =>
    event.type === "declare" && event.attemptId === input.attemptId,
  );
  if (declare === undefined) throw new Error(`protocol rebind cannot find the active attempt declaration`);
  const { declaration, declarationSha256 } = readEvalDeclaration(resolve(declare.declarationPath));
  if (declarationSha256 !== declare.declarationSha256 || declaration.baselineCache === undefined) {
    throw new Error(`protocol rebind requires an intact fixed-N cache-backed declaration`);
  }
  const from = {
    inference: declaration.baselineInferenceFingerprint,
    protocol: declaration.baselineProtocolFingerprint,
    calibration: declaration.baselineCalibrationFingerprint,
  };
  if (
    from.inference !== input.baseline.decision_inference_fingerprint ||
    from.calibration !== input.baseline.decision_calibration_fingerprint ||
    input.contract.inferenceFingerprint !== from.inference ||
    input.contract.calibrationFingerprint !== from.calibration ||
    declaration.baselineLabel !== input.baseline.label ||
    declaration.baselineCandidateFingerprint !== input.baseline.candidate_fingerprint ||
    declaration.baselineSnapshotSha256 !== input.baseline.compiler_snapshot?.archiveSha256 ||
    declaration.baselineSuiteFingerprint !== input.suiteFingerprint
  ) {
    throw new Error(`protocol rebind requires unchanged baseline, suite, inference, and calibration identities`);
  }
  const cache = readBaselineCache(input.baselinePath);
  if (
    cache.cache.baselineLabel !== declaration.baselineLabel ||
    cache.cache.candidateFingerprint !== declaration.baselineCandidateFingerprint ||
    cache.cache.suiteFingerprint !== declaration.baselineSuiteFingerprint ||
    baselineCacheManifestFingerprint(cache.cache) !== declaration.baselineCache.manifestFingerprint ||
    cacheCoverage(cache.cache) < declaration.depth
  ) {
    throw new Error(`protocol rebind requires the immutable declared baseline-cache prefix`);
  }
  const currentRunner = fingerprintFiles(RUNNER_IMPLEMENTATION_SOURCE_FILES);
  const rebinds = events.filter((event): event is ProtocolRebindEvent =>
    event.type === "protocol-rebind" && event.attemptId === input.attemptId,
  );
  if (rebinds.length > 1) {
    throw new Error(`protocol rebind continuation requires exactly one immutable rebind event`);
  }
  const existing = rebinds[0];
  if (existing !== undefined) {
    if (
      existing.declarationSha256 !== declarationSha256 ||
      existing.baselineLabel !== declaration.baselineLabel ||
      existing.baselineCandidateFingerprint !== declaration.baselineCandidateFingerprint ||
      existing.baselineSnapshotSha256 !== declaration.baselineSnapshotSha256 ||
      existing.baselineSuiteFingerprint !== declaration.baselineSuiteFingerprint ||
      existing.baselineCacheManifestFingerprint !== declaration.baselineCache.manifestFingerprint ||
      existing.from.inference !== from.inference ||
      existing.from.protocol !== from.protocol ||
      existing.from.calibration !== from.calibration ||
      existing.to.inference !== input.baseline.decision_inference_fingerprint ||
      existing.to.calibration !== input.baseline.decision_calibration_fingerprint ||
      existing.to.protocol === from.protocol ||
      existing.to.inference !== input.contract.inferenceFingerprint ||
      existing.to.calibration !== input.contract.calibrationFingerprint ||
      existing.runnerCompatibility.fromImplementationFingerprint !== input.baseline.development?.implementation_fingerprint
    ) {
      throw new Error(`protocol rebind continuation does not preserve this attempt's immutable decision inputs`);
    }
    const recordedApproval = runnerCompatibilityApproval(
      existing.runnerCompatibility.fromImplementationFingerprint,
      existing.runnerCompatibility.toImplementationFingerprint,
      input.suiteFingerprint,
    );
    const currentApproval = runnerCompatibilityApproval(
      existing.runnerCompatibility.fromImplementationFingerprint,
      currentRunner,
      input.suiteFingerprint,
    );
    if (
      recordedApproval === null ||
      recordedApproval.evidence.path !== existing.runnerCompatibility.evidencePath ||
      recordedApproval.evidence.sha256 !== existing.runnerCompatibility.evidenceSha256 ||
      currentApproval === null
    ) {
      throw new Error(`protocol rebind continuation requires a direct current runner-compatibility approval`);
    }
    return {
      continuation: true,
      attemptId: input.attemptId,
      declarationSha256,
      baselineLabel: declaration.baselineLabel,
      baselineCandidateFingerprint: declaration.baselineCandidateFingerprint,
      baselineSnapshotSha256: declaration.baselineSnapshotSha256,
      baselineSuiteFingerprint: declaration.baselineSuiteFingerprint,
      baselineCacheManifestFingerprint: declaration.baselineCache.manifestFingerprint,
      from,
      runnerCompatibility: currentApproval,
    };
  }
  if (
    from.protocol !== input.baseline.decision_protocol_fingerprint ||
    input.contract.protocolFingerprint !== from.protocol
  ) {
    throw new Error(`protocol rebind requires unchanged baseline, suite, inference, and calibration identities`);
  }
  const mismatchedShards = cache.cache.shards.filter(
    (shard) => shard.implementationFingerprint !== currentRunner,
  );
  if (
    mismatchedShards.length !== 1 ||
    mismatchedShards[0].firstSeedSlot !== 0 ||
    mismatchedShards[0].endSeedSlotExclusive !== 48 ||
    mismatchedShards[0].implementationFingerprint !== input.baseline.development?.implementation_fingerprint
  ) {
    throw new Error(`protocol rebind is limited to one retained [0,48) runner-compatibility anchor`);
  }
  const approval = runnerCompatibilityApproval(
    mismatchedShards[0].implementationFingerprint,
    currentRunner,
    input.suiteFingerprint,
  );
  if (approval === null) throw new Error(`protocol rebind requires a direct runner-compatibility approval`);
  return {
    continuation: false,
    attemptId: input.attemptId,
    declarationSha256,
    baselineLabel: declaration.baselineLabel,
    baselineCandidateFingerprint: declaration.baselineCandidateFingerprint,
    baselineSnapshotSha256: declaration.baselineSnapshotSha256,
    baselineSuiteFingerprint: declaration.baselineSuiteFingerprint,
    baselineCacheManifestFingerprint: declaration.baselineCache.manifestFingerprint,
    from,
    runnerCompatibility: approval,
  };
}

function protocolRebindEvent(input: {
  preparation: InFlightRebindPreparation;
  record: MigrationRecord;
  to: { inference: string; protocol: string; calibration: string };
  reason: string;
  operator: string;
}): ProtocolRebindEvent {
  const { preparation, record } = input;
  return {
    schema: "line.benchmark-v2.attempt-event.v1",
    at: record.performedAt,
    type: "protocol-rebind",
    attemptId: preparation.attemptId,
    declarationSha256: preparation.declarationSha256,
    baselineLabel: preparation.baselineLabel,
    baselineCandidateFingerprint: preparation.baselineCandidateFingerprint,
    baselineSnapshotSha256: preparation.baselineSnapshotSha256,
    baselineSuiteFingerprint: preparation.baselineSuiteFingerprint,
    from: preparation.from,
    to: input.to,
    baselineCacheManifestFingerprint: preparation.baselineCacheManifestFingerprint,
    migrationId: record.migrationId,
    runnerCompatibility: {
      fromImplementationFingerprint: preparation.runnerCompatibility.fromImplementationFingerprint,
      toImplementationFingerprint: preparation.runnerCompatibility.toImplementationFingerprint,
      suiteFingerprint: preparation.runnerCompatibility.suiteFingerprint,
      evidencePath: preparation.runnerCompatibility.evidence.path,
      evidenceSha256: preparation.runnerCompatibility.evidence.sha256,
    },
    reason: input.reason,
    operator: input.operator,
  };
}

export function publishMigration(input: {
  record: MigrationRecord;
  previousMigrationId: string | null;
  baselinePath: string;
  baselineBeforeSha256: string;
  baselineBytes: string;
  baseline: any;
  fixtureBeforeSha256: string;
  fixtureBytes: string | null;
  protocolRebind?: ProtocolRebindEvent;
  inFlightRebindContinuationAttemptId?: string;
}, options: MigrationPublicationOptions = {}): void {
  const pendingPath = options.pendingPath ?? MIGRATION_PENDING_PATH;
  const conflictingPendingPath = options.conflictingPendingPath ?? BASELINE_PUBLICATION_PENDING_PATH;
  const migrationsLedgerPath = options.migrationsLedgerPath ?? MIGRATIONS_LEDGER_PATH;
  const fixturePath = options.fixturePath ?? CONFORMANCE_FIXTURE_PATH;
  const restamp = options.restampBaselineDoc ?? restampBaselineDoc;
  withAttemptLedgerTransaction(options.attemptPaths, (transaction) => {
    assertMigrationAttemptAllowance(
      transaction.state,
      input.protocolRebind,
      input.inFlightRebindContinuationAttemptId,
      "migration publication",
      transaction.assertAllowed,
    );
    if (existsSync(conflictingPendingPath)) {
      throw new Error(`baseline publication became pending while migration conformance was running; recover it first`);
    }
    if (sha256(readFileSync(input.baselinePath)) !== input.baselineBeforeSha256) {
      throw new Error(`baseline changed while migration conformance was running; restart the migration`);
    }
    const currentLastRecord = readLastRecord(migrationsLedgerPath);
    if ((currentLastRecord?.migrationId ?? null) !== input.previousMigrationId) {
      throw new Error(`migration ledger changed while conformance was running; restart the migration`);
    }
    if (sha256(readFileSync(fixturePath)) !== input.fixtureBeforeSha256) {
      throw new Error(`conformance fixture changed while migration conformance was running; restart the migration`);
    }
    const pending: PendingMigration = {
      schema: "line.benchmark-v2.migration-publication.v1",
      previousMigrationId: input.previousMigrationId,
      baselinePath: input.baselinePath,
      baselineBeforeSha256: input.baselineBeforeSha256,
      baselineBytes: input.baselineBytes,
      fixturePath,
      fixtureBeforeSha256: input.fixtureBeforeSha256,
      fixtureBytes: input.fixtureBytes,
      record: input.record,
      ...(input.protocolRebind === undefined ? {} : { protocolRebind: input.protocolRebind }),
      ...(input.inFlightRebindContinuationAttemptId === undefined
        ? {}
        : { inFlightRebindContinuationAttemptId: input.inFlightRebindContinuationAttemptId }),
    };
    writeAtomic(pendingPath, `${JSON.stringify(pending, null, 2)}\n`);
    options.afterJournal?.();
    if (input.fixtureBytes !== null) writeAtomic(fixturePath, input.fixtureBytes);
    options.afterFixture?.();
    writeAtomic(input.baselinePath, input.baselineBytes);
    options.afterBaseline?.();
    restamp(input.baseline);
    appendFileDurable(migrationsLedgerPath, `${JSON.stringify(input.record)}\n`);
    options.afterLedgerAppend?.();
    if (input.protocolRebind !== undefined) transaction.append(input.protocolRebind);
    removeFileDurable(pendingPath);
  });
}

/**
 * A protocol migration normally requires a quiet ledger.  The sole exception
 * is an active fixed-N attempt that has already received its one immutable
 * rebind event; a later archive-only repair may carry that same attempt
 * forward, but may neither append nor replace the event.
 */
function assertMigrationAttemptAllowance(
  state: EraState,
  protocolRebind: ProtocolRebindEvent | undefined,
  continuationAttemptId: string | undefined,
  operation: string,
  assertAllowed: (event: ProtocolRebindEvent) => void,
): void {
  if (protocolRebind !== undefined && continuationAttemptId !== undefined) {
    throw new Error(`migration cannot append and continue a protocol rebind in the same publication`);
  }
  if (protocolRebind !== undefined) {
    assertAllowed(protocolRebind);
    return;
  }
  if (continuationAttemptId === undefined) {
    assertNoAttemptInFlight(state, operation);
    return;
  }
  if (state.inFlightAttemptId !== continuationAttemptId) {
    throw new Error(
      `${operation} continuation requires active attempt ${continuationAttemptId} ` +
      `(in flight: ${state.inFlightAttemptId ?? "none"})`,
    );
  }
  const attempt = state.attempts.find((candidate) => candidate.attemptId === continuationAttemptId);
  if (attempt?.protocolRebindCount !== 1) {
    throw new Error(`${operation} continuation requires exactly one immutable protocol rebind`);
  }
}

/** Complete or clean up a publication interrupted after its durable journal. */
export function recoverPendingMigration(options: MigrationPublicationOptions = {}): MigrationRecord | null {
  const pendingPath = options.pendingPath ?? MIGRATION_PENDING_PATH;
  const conflictingPendingPath = options.conflictingPendingPath ?? BASELINE_PUBLICATION_PENDING_PATH;
  const migrationsLedgerPath = options.migrationsLedgerPath ?? MIGRATIONS_LEDGER_PATH;
  const restamp = options.restampBaselineDoc ?? restampBaselineDoc;
  if (!existsSync(pendingPath)) return null;
  const pending = JSON.parse(readFileSync(pendingPath, "utf8")) as PendingMigration;
  if (
    pending.schema !== "line.benchmark-v2.migration-publication.v1" ||
    pending.record?.schema !== MIGRATION_RECORD_SCHEMA ||
    sha256(pending.baselineBytes) !== pending.record.restamped.baselineSha256 ||
    (pending.fixtureBytes !== null && sha256(pending.fixtureBytes) !== pending.record.conformance.fixture.afterSha256)
  ) {
    throw new Error(`pending migration publication is malformed; inspect ${pendingPath}`);
  }
  return withAttemptLedgerTransaction(options.attemptPaths, (transaction) => {
    const recordedRebind = pending.protocolRebind === undefined
      ? undefined
      : transaction.events.find((event) =>
        event.type === "protocol-rebind" && event.migrationId === pending.protocolRebind!.migrationId,
      );
    assertMigrationAttemptAllowance(
      transaction.state,
      recordedRebind === undefined ? pending.protocolRebind : undefined,
      pending.inFlightRebindContinuationAttemptId,
      "migration recovery",
      transaction.assertAllowed,
    );
    if (existsSync(conflictingPendingPath)) {
      throw new Error(`baseline publication is also pending; inspect both journals before recovery`);
    }
    const last = readLastRecord(migrationsLedgerPath);
    const lastId = last?.migrationId ?? null;
    if (lastId !== pending.previousMigrationId && lastId !== pending.record.migrationId) {
      throw new Error(`pending migration no longer follows the migration ledger; inspect before recovery`);
    }
    const baselineSha = sha256(readFileSync(pending.baselinePath));
    const targetBaselineSha = pending.record.restamped.baselineSha256;
    if (baselineSha !== pending.baselineBeforeSha256 && baselineSha !== targetBaselineSha) {
      throw new Error(`baseline changed outside the pending migration; inspect before recovery`);
    }
    const fixtureSha = sha256(readFileSync(pending.fixturePath));
    const targetFixtureSha = pending.record.conformance.fixture.afterSha256;
    if (fixtureSha !== pending.fixtureBeforeSha256 && fixtureSha !== targetFixtureSha) {
      throw new Error(`conformance fixture changed outside the pending migration; inspect before recovery`);
    }
    if (fixtureSha !== targetFixtureSha) {
      if (pending.fixtureBytes === null) throw new Error(`pending migration lacks its fixture replacement bytes`);
      writeAtomic(pending.fixturePath, pending.fixtureBytes);
    }
    if (baselineSha !== targetBaselineSha) writeAtomic(pending.baselinePath, pending.baselineBytes);
    restamp(JSON.parse(pending.baselineBytes));
    if (lastId !== pending.record.migrationId) {
      appendFileDurable(migrationsLedgerPath, `${JSON.stringify(pending.record)}\n`);
    }
    if (pending.protocolRebind !== undefined && !transaction.events.some((event) =>
      event.type === "protocol-rebind" && event.migrationId === pending.protocolRebind!.migrationId,
    )) {
      transaction.append(pending.protocolRebind);
    }
    removeFileDurable(pendingPath);
    return pending.record;
  });
}

// ── Conformance fixture ──────────────────────────────────────────────────────

type FixtureCase = {
  name: string;
  kind: "retained-pair" | "synthetic";
  base?: { path: string; sha256: string };
  candidate?: { path: string; sha256: string };
  construction?: "correlated_seed_adversary" | "uniform_gain_15" | "noninferiority_margin5";
  options: { profile: "probe" | "canonical"; mode: "improvement" | "simplification"; margin?: number };
  expected: {
    outcome: string;
    delta: number;
    lowerBound: number;
    upperBound: number;
    baseHeadline: number;
    candidateHeadline: number;
  };
};

const RETAINED_PAIRS: Array<{ name: string; base: string; candidate: string }> = [
  {
    name: "identical_probe",
    base: "benchmark/v2/runs/calibration-v2.6-probe-baseline.json.gz",
    candidate: "benchmark/v2/runs/calibration-v2.6-probe-baseline.json.gz",
  },
  {
    name: "broad_degradation_probe",
    base: "benchmark/v2/runs/calibration-v2.6-probe-baseline.json.gz",
    candidate: "benchmark/v2/runs/calibration-v2.6-quality-ncand-1-probe.json.gz",
  },
  {
    name: "impact_contract_failure_probe",
    base: "benchmark/v2/runs/calibration-v2.6-probe-baseline.json.gz",
    candidate: "benchmark/v2/runs/calibration-v2.6-impact-off-probe.json.gz",
  },
];
const EXPECTED_FIXTURE_NAMES = [
  ...RETAINED_PAIRS.map((pair) => pair.name),
  "correlated_seed_adversary",
  "uniform_gain_15",
  "noninferiority_margin5",
].sort();

async function computeFixtureCases(): Promise<FixtureCase[]> {
  const cases: FixtureCase[] = [];
  for (const pair of RETAINED_PAIRS) {
    const validated = await loadValidatedDecisionPairForCalibration(pair.base, pair.candidate);
    const decision = pairedV2DecisionForCalibration(validated.baseRuns, validated.candidateRuns, validated.suite, {
      profile: "probe", mode: "improvement", bootstrapSeed: 0,
    });
    cases.push({
      name: pair.name,
      kind: "retained-pair",
      base: { path: pair.base, sha256: sha256File(pair.base) },
      candidate: { path: pair.candidate, sha256: sha256File(pair.candidate) },
      options: { profile: "probe", mode: "improvement" },
      expected: expectedOf(decision),
    });
  }
  const suite = conformanceSuite();
  for (const construction of ["correlated_seed_adversary", "uniform_gain_15", "noninferiority_margin5"] as const) {
    const { base, candidate, options } = syntheticCase(suite, construction);
    const decision = pairedV2DecisionForCalibration(base, candidate, suite, { ...options, bootstrapSeed: 0 });
    cases.push({ name: construction, kind: "synthetic", construction, options, expected: expectedOf(decision) });
  }
  return cases;
}

function conformanceFixtureBytes(cases: FixtureCase[]): string {
  const fixture = {
    schema: CONFORMANCE_SCHEMA,
    note: "Expected decision outcomes for the migration conformance replay. Re-recorded only by an inference-scope migration with an attested behavior change.",
    cases,
  };
  return `${JSON.stringify(fixture, null, 2)}\n`;
}

async function replayConformanceFixture(): Promise<Array<{ name: string; result: string }>> {
  if (!existsSync(CONFORMANCE_FIXTURE_PATH)) {
    throw new Error(`decision-conformance fixture is missing; restore the governed fixture before migrating`);
  }
  const fixture = JSON.parse(readFileSync(CONFORMANCE_FIXTURE_PATH, "utf8"));
  if (fixture.schema !== CONFORMANCE_SCHEMA) throw new Error(`unsupported conformance fixture`);
  assertConformanceFixtureCases(fixture.cases);
  const current = await computeFixtureCases();
  const currentByName = new Map(current.map((c) => [c.name, c]));
  const results: Array<{ name: string; result: string }> = [];
  for (const recorded of fixture.cases as FixtureCase[]) {
    const replay = currentByName.get(recorded.name);
    if (replay === undefined) {
      results.push({ name: recorded.name, result: "missing" });
      continue;
    }
    const matched = JSON.stringify(replay.expected) === JSON.stringify(recorded.expected);
    results.push({ name: recorded.name, result: matched ? "matched" : "drifted" });
  }
  console.log(`conformance fixtures: ${results.map((r) => `${r.name}=${r.result}`).join(", ")}`);
  return results;
}

function expectedOf(decision: any): FixtureCase["expected"] {
  return {
    outcome: decision.outcome,
    delta: decision.delta,
    lowerBound: decision.confidence.lowerBound,
    upperBound: decision.confidence.upperBound,
    baseHeadline: decision.baseHeadline,
    candidateHeadline: decision.candidateHeadline,
  };
}

function conformanceSuite(): SuiteManifest {
  const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
  return loadSuiteManifest("benchmark/v2/compat/suite-manifest.json", sources);
}

function syntheticCase(
  suite: SuiteManifest,
  construction: "correlated_seed_adversary" | "uniform_gain_15" | "noninferiority_margin5",
): { base: DecisionRun[]; candidate: DecisionRun[]; options: FixtureCase["options"] } {
  const profile = construction === "noninferiority_margin5" ? "canonical" : "probe";
  const config = suite.profiles[profile];
  const members = canonicalMembers(suite);
  const base: DecisionRun[] = [];
  const candidate: DecisionRun[] = [];
  const adversary = [-10, -10, 30];
  for (const [budgetIndex, budget] of config.budgets.entries()) {
    for (let seedSlot = 0; seedSlot < config.seeds_per_budget; seedSlot++) {
      const actualSeed = suite.seed_policy.profile_seed_bases[profile] + budgetIndex * config.seeds_per_budget + seedSlot;
      for (const sourceId of members) {
        const effect = construction === "correlated_seed_adversary" ? adversary[seedSlot % adversary.length]
          : construction === "uniform_gain_15" ? 15
          : -2;
        const task = { sourceId, budget, seedSlot, actualSeed };
        base.push({ ...task, score: { score: 500, valid: true } });
        candidate.push({ ...task, score: { score: 500 + effect, valid: true } });
      }
    }
  }
  return {
    base,
    candidate,
    options: construction === "noninferiority_margin5"
      ? { profile, mode: "simplification", margin: 5 }
      : { profile, mode: "improvement" },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function detectMinimumScope(changedPaths: string[]): Scope | "none" | "suite" {
  if (changedPaths.some((path) => (BENCHMARK_DEFINITION_SOURCE_FILES as readonly string[]).includes(path))) return "suite";
  if (changedPaths.includes(CONFORMANCE_FIXTURE_PATH)) return "inference";
  if (changedPaths.some((path) => (EVAL_CHAIN_INFERENCE_SOURCE_FILES as readonly string[]).includes(path))) return "inference";
  if (changedPaths.some((path) => (CERTIFICATION_GENERATOR_SOURCE_FILES as readonly string[]).includes(path))) return "inference";
  if (changedPaths.some((path) => (DECISION_INFERENCE_SOURCE_FILES as readonly string[]).includes(path))) return "inference";
  if (changedPaths.some((path) => (DECISION_PROTOCOL_SOURCE_FILES as readonly string[]).includes(path))) return "protocol";
  return "none";
}

export function assertConformanceFixtureCases(cases: unknown): asserts cases is FixtureCase[] {
  if (!Array.isArray(cases)) throw new Error(`decision-conformance fixture cases must be an array`);
  const names = cases.map((entry) => (entry as FixtureCase)?.name).sort();
  if (new Set(names).size !== names.length || JSON.stringify(names) !== JSON.stringify(EXPECTED_FIXTURE_NAMES)) {
    throw new Error(
      `decision-conformance fixture must contain exactly the six unique governed cases: ` +
      `${EXPECTED_FIXTURE_NAMES.join(", ")}`,
    );
  }
}

export { syntheticCase, conformanceSuite };

function readLastRecord(path = MIGRATIONS_LEDGER_PATH): MigrationRecord | null {
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, "utf8").trim().split("\n").filter((line) => line !== "");
  if (lines.length === 0) return null;
  const record = JSON.parse(lines[lines.length - 1]);
  if (record.schema !== MIGRATION_RECORD_SCHEMA) throw new Error(`unsupported migration record in ledger`);
  return record;
}

function restampBaselineDoc(baseline: any): void {
  const docPath = "docs/benchmark-v2-baseline.md";
  if (!existsSync(docPath)) return;
  let doc = readFileSync(docPath, "utf8");
  doc = doc.replace(/^Decision rule: `.*`\.$/m, `Inference rule: \`${baseline.decision_inference_fingerprint}\`.`);
  doc = doc.replace(/^Inference rule: `.*`\.$/m, `Inference rule: \`${baseline.decision_inference_fingerprint}\`.`);
  doc = doc.replace(/^Decision calibration: `.*`\.$/m,
    `Decision protocol: \`${baseline.decision_protocol_fingerprint}\`.\nDecision calibration: \`${baseline.decision_calibration_fingerprint}\`.`);
  doc = doc.replace(/^Decision protocol: `.*`\.\nDecision protocol: `.*`\.$/m,
    `Decision protocol: \`${baseline.decision_protocol_fingerprint}\`.`);
  writeFileAtomicDurable(docPath, doc);
}

function writeAtomic(path: string, contents: string): void {
  writeFileAtomicDurable(path, contents);
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = await runMigrationCommand();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
