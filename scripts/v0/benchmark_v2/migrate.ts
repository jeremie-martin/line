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
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
import { loadValidatedDecisionPairForCalibration } from "./decide.ts";
import { loadSourceManifest, resolveSources } from "./model.ts";
import {
  BENCHMARK_DEFINITION_SOURCE_FILES,
  canonicalMembers,
  loadSuiteManifest,
  suiteIdentity,
  type SuiteManifest,
} from "./suite_model.ts";
import {
  assertNoAttemptInFlight,
  readEraState,
  withAttemptLedgerTransaction,
} from "./attempts.ts";
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

type MigrationRecord = {
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

type PendingMigration = {
  schema: "line.benchmark-v2.migration-publication.v1";
  previousMigrationId: string | null;
  baselinePath: string;
  baselineBeforeSha256: string;
  baselineBytes: string;
  fixturePath: string;
  fixtureBeforeSha256: string;
  fixtureBytes: string | null;
  record: MigrationRecord;
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

  // No attempt may be in flight.
  if (existsSync("benchmark/v2/attempts.jsonl")) {
    const era = readEraState();
    if (era.inFlightAttemptId !== null) {
      throw new Error(`an eval attempt is in flight (${era.inFlightAttemptId}); migrations require no attempt in flight`);
    }
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
  if (definitionChanged) {
    throw new Error(
      `a suite-definition file changed (${changedFiles.filter((f) =>
        (BENCHMARK_DEFINITION_SOURCE_FILES as readonly string[]).includes(f.path)).map((f) => f.path).join(", ")}); ` +
      `that is a suite rollover, not a contract migration — batch it with the next intentional suite change`,
    );
  }
  const minimumScope = detectMinimumScope(changedFiles.map((file) => file.path));
  if (minimumScope === "suite") throw new Error(`unreachable: definition changes refuse above`);
  let effectiveScope: Scope = declaredScope;
  if (behavior === "yes") effectiveScope = "inference";
  if (minimumScope !== "none" && SCOPE_ORDER.indexOf(effectiveScope) < SCOPE_ORDER.indexOf(minimumScope)) {
    throw new Error(`declared scope ${declaredScope} is below the detected minimum ${minimumScope}; re-declare (deliberate upward escalation is allowed)`);
  }

  // Freshness: the guards verify final-decision coverage/calibration and, for
  // inference scope, every certified eval-chain operating point. Only the
  // evidence whose fingerprint changed needs regeneration.
  const sourceManifestPath = "benchmark/v2/compat/source-manifest.json";
  const suiteManifestPath = "benchmark/v2/compat/suite-manifest.json";
  const sources = resolveSources(loadSourceManifest(sourceManifestPath));
  const identity = suiteIdentity(suiteManifestPath, sourceManifestPath, sources);
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
  const baselinePath = "benchmark/v2/baseline.json";
  const baselineBeforeBytes = readFileSync(baselinePath);
  const baselineBeforeSha256 = sha256(baselineBeforeBytes);
  const baseline = JSON.parse(baselineBeforeBytes.toString("utf8"));
  if (!bootstrap) {
    const stampedInference = baseline.decision_inference_fingerprint ?? null;
    const stampedProtocol = baseline.decision_protocol_fingerprint ?? null;
    if (lastRecord.to.inference !== stampedInference || lastRecord.to.protocol !== stampedProtocol) {
      throw new Error(`migrations ledger and baseline stamps diverge — the baseline was edited outside the migration command`);
    }
  }
  if (baseline.suite_fingerprint !== identity.suiteFingerprint) {
    throw new Error(`current suite fingerprint differs from the baseline; suite changes are a rollover, not a migration`);
  }

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

  // Re-stamp baseline (v8 -> v9 upgrade on bootstrap), state, and the doc.
  const from = {
    inference: baseline.decision_inference_fingerprint ?? null,
    protocol: baseline.decision_protocol_fingerprint ?? null,
    calibration: baseline.decision_calibration_fingerprint ?? null,
    legacyDecisionFingerprint: baseline.decision_fingerprint ?? null,
    suite: baseline.suite_fingerprint,
  };
  delete baseline.decision_fingerprint;
  baseline.schema = "line.benchmark-v2.baseline-reference.v9";
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
  publishMigration({
    record,
    previousMigrationId: lastRecord?.migrationId ?? null,
    baselinePath,
    baselineBeforeSha256,
    baselineBytes,
    baseline,
    fixtureBeforeSha256,
    fixtureBytes: replacementFixtureBytes,
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

function publishMigration(input: {
  record: MigrationRecord;
  previousMigrationId: string | null;
  baselinePath: string;
  baselineBeforeSha256: string;
  baselineBytes: string;
  baseline: any;
  fixtureBeforeSha256: string;
  fixtureBytes: string | null;
}): void {
  withAttemptLedgerTransaction(undefined, (transaction) => {
    assertNoAttemptInFlight(transaction.state, "migration publication");
    if (existsSync(BASELINE_PUBLICATION_PENDING_PATH)) {
      throw new Error(`baseline publication became pending while migration conformance was running; recover it first`);
    }
    if (sha256(readFileSync(input.baselinePath)) !== input.baselineBeforeSha256) {
      throw new Error(`baseline changed while migration conformance was running; restart the migration`);
    }
    const currentLastRecord = readLastRecord();
    if ((currentLastRecord?.migrationId ?? null) !== input.previousMigrationId) {
      throw new Error(`migration ledger changed while conformance was running; restart the migration`);
    }
    if (sha256(readFileSync(CONFORMANCE_FIXTURE_PATH)) !== input.fixtureBeforeSha256) {
      throw new Error(`conformance fixture changed while migration conformance was running; restart the migration`);
    }
    const pending: PendingMigration = {
      schema: "line.benchmark-v2.migration-publication.v1",
      previousMigrationId: input.previousMigrationId,
      baselinePath: input.baselinePath,
      baselineBeforeSha256: input.baselineBeforeSha256,
      baselineBytes: input.baselineBytes,
      fixturePath: CONFORMANCE_FIXTURE_PATH,
      fixtureBeforeSha256: input.fixtureBeforeSha256,
      fixtureBytes: input.fixtureBytes,
      record: input.record,
    };
    writeAtomic(MIGRATION_PENDING_PATH, `${JSON.stringify(pending, null, 2)}\n`);
    if (input.fixtureBytes !== null) writeAtomic(CONFORMANCE_FIXTURE_PATH, input.fixtureBytes);
    writeAtomic(input.baselinePath, input.baselineBytes);
    restampBaselineDoc(input.baseline);
    appendFileSync(MIGRATIONS_LEDGER_PATH, `${JSON.stringify(input.record)}\n`);
    rmSync(MIGRATION_PENDING_PATH, { force: true });
  });
}

/** Complete or clean up a publication interrupted after its durable journal. */
function recoverPendingMigration(): MigrationRecord | null {
  if (!existsSync(MIGRATION_PENDING_PATH)) return null;
  const pending = JSON.parse(readFileSync(MIGRATION_PENDING_PATH, "utf8")) as PendingMigration;
  if (
    pending.schema !== "line.benchmark-v2.migration-publication.v1" ||
    pending.record?.schema !== MIGRATION_RECORD_SCHEMA ||
    sha256(pending.baselineBytes) !== pending.record.restamped.baselineSha256 ||
    (pending.fixtureBytes !== null && sha256(pending.fixtureBytes) !== pending.record.conformance.fixture.afterSha256)
  ) {
    throw new Error(`pending migration publication is malformed; inspect ${MIGRATION_PENDING_PATH}`);
  }
  return withAttemptLedgerTransaction(undefined, (transaction) => {
    assertNoAttemptInFlight(transaction.state, "migration recovery");
    if (existsSync(BASELINE_PUBLICATION_PENDING_PATH)) {
      throw new Error(`baseline publication is also pending; inspect both journals before recovery`);
    }
    const last = readLastRecord();
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
    restampBaselineDoc(JSON.parse(pending.baselineBytes));
    if (lastId !== pending.record.migrationId) {
      appendFileSync(MIGRATIONS_LEDGER_PATH, `${JSON.stringify(pending.record)}\n`);
    }
    rmSync(MIGRATION_PENDING_PATH, { force: true });
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
    base: "benchmark/v2/runs/calibration-v2.4-probe-baseline.json.gz",
    candidate: "benchmark/v2/runs/calibration-v2.4-probe-baseline.json.gz",
  },
  {
    name: "broad_degradation_probe",
    base: "benchmark/v2/runs/calibration-v2.4-probe-baseline.json.gz",
    candidate: "benchmark/v2/runs/calibration-v2.4-quality-ncand-1-probe.json.gz",
  },
  {
    name: "impact_contract_failure_probe",
    base: "benchmark/v2/runs/calibration-v2.4-probe-baseline.json.gz",
    candidate: "benchmark/v2/runs/calibration-v2.4-impact-off-probe.json.gz",
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

function readLastRecord(): MigrationRecord | null {
  if (!existsSync(MIGRATIONS_LEDGER_PATH)) return null;
  const lines = readFileSync(MIGRATIONS_LEDGER_PATH, "utf8").trim().split("\n").filter((line) => line !== "");
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
  writeFileSync(docPath, doc);
}

function writeAtomic(path: string, contents: string): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(`${absolute}.tmp`, contents);
  renameSync(`${absolute}.tmp`, absolute);
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
