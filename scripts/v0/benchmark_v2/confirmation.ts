/**
 * Eval-attempt declarations and the baseline decision contract.
 *
 * The one-shot canonical confirmation machinery (confirmation state file,
 * single promotion slot, consume-on-decide) was retired at the eval-chain
 * cutover after the live validation (docs/benchmark-v2-validation.md):
 * `benchmark/v2/baseline.json` is the sole record of the baseline contract,
 * and `benchmark/v2/attempts.jsonl` is the sole ledger of attempts and
 * seed epochs.
 */

import { createHash, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  validateCompilerSnapshot,
  type CompilerSnapshot,
  type SnapshotBenchmarkRun,
} from "./compiler_snapshot.ts";
import { type DecisionContractIdentity } from "./calibration_guard.ts";

export const EVAL_DECLARATION_SCHEMA = "line.benchmark-v2.eval-declaration.v6" as const;
export const DEFAULT_BASELINE_PATH = "benchmark/v2/baseline.json";
const MIGRATION_PENDING_PATH = "benchmark/v2/migration-pending.json";
const BASELINE_PUBLICATION_PENDING_PATH = "benchmark/v2/baseline-publication-pending.json";

export type ConfirmationMode = "improvement" | "simplification";

export type SeedLedgerEntry = {
  attemptId: string;
  canonicalSeedBase: number;
  seedCount: number;
  seedScheduleFingerprint: string;
};

/** The baseline block the eval chain declares against, read from the frozen
 *  baseline of record. */
export type BaselineContract = {
  label: string;
  suiteFingerprint: string;
  candidateFingerprint: string;
  listeningReviewFingerprint: string;
  compilerSnapshot: CompilerSnapshot;
  inferenceFingerprint: string;
  protocolFingerprint: string;
  calibrationFingerprint: string;
};

export type EvalDeclaration = {
  schema: typeof EVAL_DECLARATION_SCHEMA;
  attemptId: string;
  declaredAt: string;
  baselineLabel: string;
  baselineCandidateFingerprint: string;
  baselineSuiteFingerprint: string;
  baselineSnapshotSha256: string;
  baselineInferenceFingerprint: string;
  baselineProtocolFingerprint: string;
  baselineCalibrationFingerprint: string;
  candidateFingerprint: string;
  candidateSnapshot: CompilerSnapshot;
  canonicalSeedBase: number;
  seedScheduleFingerprint: string;
  mode: ConfirmationMode;
  margin: number | null;
  operatingPointId: string;
  depth: number;
  criticalAlpha: number;
  futilitySchedule: number[];
  futilityAlpha: number;
  eraBudgetSpend: number;
  retryAcknowledged: boolean;
  certificationFingerprint: string;
  statement: string;
};

/** Read and validate the frozen baseline of record as the decision contract
 *  every attempt declares against. */
export function readBaselineContract(baselinePath = DEFAULT_BASELINE_PATH): BaselineContract {
  if (existsSync(MIGRATION_PENDING_PATH)) {
    throw new Error(`migration publication is incomplete; rerun the migration command to recover it`);
  }
  if (existsSync(BASELINE_PUBLICATION_PENDING_PATH)) {
    throw new Error(`baseline publication is incomplete; rerun baseline or rebaseline to recover it`);
  }
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  if (
    baseline.schema !== "line.benchmark-v2.baseline-reference.v9" ||
    baseline.status !== "canonical-baseline"
  ) {
    throw new Error(`unsupported baseline reference; establish a new baseline`);
  }
  if (baseline.listening_review_status !== "approved") {
    throw new Error(`the baseline of record lacks an approved listening review`);
  }
  for (const field of [
    baseline.candidate_fingerprint,
    baseline.suite_fingerprint,
    baseline.listening_review_fingerprint,
    baseline.decision_inference_fingerprint,
    baseline.decision_protocol_fingerprint,
    baseline.decision_calibration_fingerprint,
  ]) {
    if (!isFingerprint(field)) throw new Error(`the baseline of record has an incomplete decision contract`);
  }
  if (baseline.compiler_snapshot === undefined) {
    throw new Error(`the baseline of record has no compiler snapshot`);
  }
  if (resolve(baselinePath) === resolve(DEFAULT_BASELINE_PATH)) {
    assertMigrationLedgerMatchesBaseline(baseline);
  }
  validateCompilerSnapshot(baseline.compiler_snapshot);
  return {
    label: baseline.label,
    suiteFingerprint: baseline.suite_fingerprint,
    candidateFingerprint: baseline.candidate_fingerprint,
    listeningReviewFingerprint: baseline.listening_review_fingerprint,
    compilerSnapshot: baseline.compiler_snapshot,
    inferenceFingerprint: baseline.decision_inference_fingerprint,
    protocolFingerprint: baseline.decision_protocol_fingerprint,
    calibrationFingerprint: baseline.decision_calibration_fingerprint,
  };
}

function assertMigrationLedgerMatchesBaseline(baseline: any): void {
  const path = "benchmark/v2/migrations.jsonl";
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").trim().split("\n").filter(Boolean);
  if (lines.length === 0) return;
  const latest = JSON.parse(lines.at(-1)!);
  if (
    latest.to?.inference !== baseline.decision_inference_fingerprint ||
    latest.to?.protocol !== baseline.decision_protocol_fingerprint ||
    latest.to?.calibration !== baseline.decision_calibration_fingerprint
  ) {
    throw new Error(`baseline decision contract does not match the latest migration record`);
  }
}

export function assertCurrentDecisionContract(
  baseline: BaselineContract,
  current: DecisionContractIdentity,
): void {
  if (
    baseline.inferenceFingerprint !== current.inferenceFingerprint ||
    baseline.calibrationFingerprint !== current.calibrationFingerprint
  ) {
    throw new Error(`inference or calibration contract differs from the baseline; regenerate calibration and run \`benchmark migrate\``);
  }
  if (baseline.protocolFingerprint !== current.protocolFingerprint) {
    throw new Error(`decision-protocol identity changed; run \`benchmark migrate --scope=protocol\` to re-stamp the contract`);
  }
}

/**
 * Freeze an eval attempt before any confirmation compile: candidate snapshot,
 * operating point, fresh epoch, and the exact certification evidence that
 * authorized the point. The declaration is immutable; every later stage
 * (waves, looks, resume, verdict) revalidates against it.
 */
export function declareEvalAttempt(input: {
  attemptId: string;
  baseline: BaselineContract;
  decisionContract: DecisionContractIdentity;
  candidateFingerprint: string;
  candidateSnapshot: CompilerSnapshot;
  canonicalSeedBase: number;
  seedScheduleFingerprint: string;
  mode: ConfirmationMode;
  margin: number | null;
  operatingPointId: string;
  depth: number;
  criticalAlpha: number;
  futilitySchedule: number[];
  futilityAlpha: number;
  eraBudgetSpend: number;
  retryAcknowledged: boolean;
  certificationFingerprint: string;
  declarationDir: string;
}): { declaration: EvalDeclaration; declarationPath: string; declarationSha256: string } {
  validateCompilerSnapshot(input.baseline.compilerSnapshot);
  validateCompilerSnapshot(input.candidateSnapshot);
  const attemptId = input.attemptId;
  const declaration: EvalDeclaration = {
    schema: EVAL_DECLARATION_SCHEMA,
    attemptId,
    declaredAt: new Date().toISOString(),
    baselineLabel: input.baseline.label,
    baselineCandidateFingerprint: input.baseline.candidateFingerprint,
    baselineSuiteFingerprint: input.baseline.suiteFingerprint,
    baselineSnapshotSha256: input.baseline.compilerSnapshot.archiveSha256,
    baselineInferenceFingerprint: input.decisionContract.inferenceFingerprint,
    baselineProtocolFingerprint: input.decisionContract.protocolFingerprint,
    baselineCalibrationFingerprint: input.decisionContract.calibrationFingerprint,
    candidateFingerprint: input.candidateFingerprint,
    candidateSnapshot: input.candidateSnapshot,
    canonicalSeedBase: input.canonicalSeedBase,
    seedScheduleFingerprint: input.seedScheduleFingerprint,
    mode: input.mode,
    margin: input.mode === "simplification" ? input.margin : null,
    operatingPointId: input.operatingPointId,
    depth: input.depth,
    criticalAlpha: input.criticalAlpha,
    futilitySchedule: [...input.futilitySchedule],
    futilityAlpha: input.futilityAlpha,
    eraBudgetSpend: input.eraBudgetSpend,
    retryAcknowledged: input.retryAcknowledged,
    certificationFingerprint: input.certificationFingerprint,
    statement: input.mode === "improvement"
      ? `This candidate, operating point ${input.operatingPointId}, and fresh seed epoch are frozen before either paired arm runs.`
      : `This candidate, margin ${input.margin}, operating point ${input.operatingPointId}, and fresh seed epoch are frozen before either paired arm runs.`,
  };
  const declarationPath = resolve(input.declarationDir, `${attemptId}.json`);
  if (existsSync(declarationPath)) throw new Error(`eval declaration ${declarationPath} already exists`);
  writeAtomic(declarationPath, declaration);
  return {
    declaration,
    declarationPath,
    declarationSha256: sha256(readFileSync(declarationPath)),
  };
}

export function freshAttemptId(): string {
  return `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")}-${randomBytes(4).toString("hex")}`;
}

export function readEvalDeclaration(path: string): { declaration: EvalDeclaration; declarationSha256: string } {
  const bytes = readFileSync(resolve(path));
  const declaration = JSON.parse(bytes.toString("utf8")) as EvalDeclaration;
  if (declaration.schema !== EVAL_DECLARATION_SCHEMA) throw new Error(`unsupported eval declaration`);
  return { declaration, declarationSha256: sha256(bytes) };
}

export function retainSnapshotRun(
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

function isFingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
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
