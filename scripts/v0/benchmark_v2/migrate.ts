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
 *   inference   — inference files changed OR --alters-decision-behavior=yes:
 *                 the coverage study must be regenerated FIRST, then the
 *                 calibration; this is a rule change re-earning its
 *                 certification, and the record says so.
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
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DECISION_INFERENCE_SOURCE_FILES,
  pairedV2DecisionForCalibration,
  type DecisionRun,
} from "./decision_model.ts";
import { DECISION_PROTOCOL_SOURCE_FILES } from "./decision_protocol.ts";
import { loadValidatedDecisionPairForCalibration } from "./decide.ts";
import { loadSourceManifest, resolveSources } from "./model.ts";
import {
  BENCHMARK_DEFINITION_SOURCE_FILES,
  canonicalMembers,
  loadSuiteManifest,
  suiteIdentity,
  type SuiteManifest,
} from "./suite_model.ts";
import { initializeConfirmationStateFromBaseline, readConfirmationState } from "./confirmation.ts";
import { requireCurrentDecisionCalibration, type DecisionContractIdentity } from "./calibration_guard.ts";

export const MIGRATIONS_LEDGER_PATH = "benchmark/v2/migrations.jsonl";
export const CONFORMANCE_FIXTURE_PATH = "benchmark/v2/evidence/decision-conformance.json";
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
  conformance: { vitest: "passed" | "skipped"; fixtures: Array<{ name: string; result: string }> };
  restamped: { baselineSha256: string; confirmationStateSha256: string };
  bootstrap: boolean;
};

export async function runMigrationCommand(argv = process.argv.slice(2)): Promise<number> {
  const argument = (name: string): string | undefined =>
    argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const recordFixtures = argv.includes("--record-fixtures");
  if (recordFixtures) {
    await recordConformanceFixture();
    return 0;
  }
  const declaredScope = argument("scope") as Scope | undefined;
  const behavior = argument("alters-decision-behavior");
  const reason = argument("reason");
  const operator = argument("operator") ?? process.env.USER ?? "";
  const approve = argv.includes("--approve");
  const json = argv.includes("--json");
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
  const statePath = "benchmark/v2/confirmation-state.json";
  if (existsSync(statePath)) {
    const status = JSON.parse(readFileSync(statePath, "utf8")).status;
    if (status === "running" || status === "evidence-ready") {
      throw new Error(`a canonical attempt is in flight (${status}); migrations require no attempt in flight`);
    }
  }

  // File-hash diff against the last ledger record.
  const allFiles = [...new Set([
    ...DECISION_INFERENCE_SOURCE_FILES,
    ...DECISION_PROTOCOL_SOURCE_FILES,
    ...BENCHMARK_DEFINITION_SOURCE_FILES,
  ])].sort();
  const fileHashes = Object.fromEntries(allFiles.map((path) => [path, sha256File(path)]));
  const lastRecord = readLastRecord();
  const bootstrap = lastRecord === null;
  const changedFiles = bootstrap ? [] : allFiles
    .filter((path) => lastRecord.fileHashes[path] !== fileHashes[path])
    .map((path) => ({ path, fromSha256: lastRecord.fileHashes[path] ?? null, toSha256: fileHashes[path] }));

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

  // Freshness: the guard verifies calibration (inference-bound) and coverage.
  // For inference scope the operator must already have regenerated coverage
  // then calibration; the guard's errors name exactly what is stale.
  const sourceManifestPath = "benchmark/v2/compat/source-manifest.json";
  const suiteManifestPath = "benchmark/v2/compat/suite-manifest.json";
  const sources = resolveSources(loadSourceManifest(sourceManifestPath));
  const identity = suiteIdentity(suiteManifestPath, sourceManifestPath, sources);
  let contract: DecisionContractIdentity;
  try {
    contract = requireCurrentDecisionCalibration(identity.suiteFingerprint);
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n` +
      `regenerate first (in order):\n` +
      `  node --import tsx scripts/benchmark/study_decision_coverage.ts   # inference scope only\n` +
      `  node --import tsx scripts/benchmark/calibrate_decisions.ts`,
    );
  }

  // Ledger/baseline divergence guard (skipped at bootstrap).
  const baselinePath = "benchmark/v2/baseline.json";
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
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
  execFileSync("npx", ["vitest", "run", ...CONFORMANCE_TEST_FILES], { stdio: "inherit" });
  const fixtureResults = await replayConformanceFixture(behavior === "yes");
  const drifted = fixtureResults.filter((result) => result.result !== "matched");
  if (drifted.length > 0 && behavior === "no") {
    throw new Error(
      `unattested behavioral drift: ${drifted.map((d) => d.name).join(", ")} — ` +
      `declare --alters-decision-behavior=yes (inference scope) if the change is intentional`,
    );
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
  writeAtomic(baselinePath, baselineBytes);
  const state = initializeConfirmationStateFromBaseline(baselinePath);
  restampBaselineDoc(baseline);

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
    conformance: { vitest: "passed", fixtures: fixtureResults },
    restamped: {
      baselineSha256: createHash("sha256").update(baselineBytes).digest("hex"),
      confirmationStateSha256: sha256File("benchmark/v2/confirmation-state.json"),
    },
    bootstrap,
  };
  appendFileSync(MIGRATIONS_LEDGER_PATH, `${JSON.stringify(record)}\n`);
  const summary = {
    migrationId: record.migrationId,
    effectiveScope,
    changedFiles: changedFiles.map((file) => file.path),
    to: record.to,
    stateStatus: state.status,
    nextCommand: "npm run benchmark -- probe",
  };
  console.log(json ? JSON.stringify(summary, null, 2)
    : `migrated (${effectiveScope}): ${record.migrationId}\n  inference ${contract.inferenceFingerprint.slice(0, 12)}  protocol ${contract.protocolFingerprint.slice(0, 12)}  calibration ${contract.calibrationFingerprint.slice(0, 12)}\n  state: ${state.status}\n  nextCommand: ${summary.nextCommand}`);
  return 0;
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

async function recordConformanceFixture(): Promise<void> {
  const cases = await computeFixtureCases();
  const fixture = {
    schema: CONFORMANCE_SCHEMA,
    note: "Expected decision outcomes for the migration conformance replay. Re-recorded only by an inference-scope migration with an attested behavior change.",
    cases,
  };
  mkdirSync(dirname(CONFORMANCE_FIXTURE_PATH), { recursive: true });
  writeFileSync(CONFORMANCE_FIXTURE_PATH, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`recorded ${cases.length} conformance cases -> ${CONFORMANCE_FIXTURE_PATH}`);
}

async function replayConformanceFixture(reRecordOnDrift: boolean): Promise<Array<{ name: string; result: string }>> {
  if (!existsSync(CONFORMANCE_FIXTURE_PATH)) {
    throw new Error(`decision-conformance fixture is missing; record it with \`benchmark migrate --record-fixtures\``);
  }
  const fixture = JSON.parse(readFileSync(CONFORMANCE_FIXTURE_PATH, "utf8"));
  if (fixture.schema !== CONFORMANCE_SCHEMA) throw new Error(`unsupported conformance fixture`);
  const current = await computeFixtureCases();
  const currentByName = new Map(current.map((c) => [c.name, c]));
  const results: Array<{ name: string; result: string }> = [];
  let drift = false;
  for (const recorded of fixture.cases as FixtureCase[]) {
    const replay = currentByName.get(recorded.name);
    if (replay === undefined) {
      results.push({ name: recorded.name, result: "missing" });
      drift = true;
      continue;
    }
    const matched = JSON.stringify(replay.expected) === JSON.stringify(recorded.expected);
    results.push({ name: recorded.name, result: matched ? "matched" : "drifted" });
    if (!matched) drift = true;
  }
  if (drift && reRecordOnDrift) {
    await recordConformanceFixture();
    return results.map((r) => r.result === "drifted" ? { ...r, result: "re-recorded" } : r);
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
  if (changedPaths.some((path) => (DECISION_INFERENCE_SOURCE_FILES as readonly string[]).includes(path))) return "inference";
  if (changedPaths.some((path) => (DECISION_PROTOCOL_SOURCE_FILES as readonly string[]).includes(path))) return "protocol";
  return "none";
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
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = await runMigrationCommand();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
