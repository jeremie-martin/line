/**
 * Shared verification helpers for retained Benchmark V2 study evidence.
 *
 * Mirrors the checks study_decision_coverage.ts performs on its coverage
 * reference so every study consumes compile archives through the same
 * retained-evidence standard: checksum sidecar required, suite/scorer
 * identity current, compiler identity self-consistent, complete scope, and
 * every stored score rescored from its raw report.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { COMPILER_IDENTITY_PROTOCOL } from "../../benchmark/v2/decision-policy.ts";
import { scoreV2Report, type AxisContract } from "../v0/benchmark_v2/evaluator.ts";
import type { ResolvedSource } from "../v0/benchmark_v2/model.ts";
import type { SuiteIdentity, SuiteManifest } from "../v0/benchmark_v2/suite_model.ts";

export type VerifiedArtifact = {
  path: string;
  bytes: Buffer;
  artifactSha256: string;
  rawSha256: string;
};

export type StudyCell = { score: number; valid: boolean };

export const SCALE_STUDY_SCHEMAS = [
  "line.benchmark-v2.budget-scale-study.v1",
  "line.benchmark-v2.budget-scale-study.v2",
  "line.benchmark-v2.budget-scale-study.v3",
] as const;

export function readVerifiedArtifact(path: string): VerifiedArtifact {
  // Compile archives carry `<path>.sha256` sidecars; byte-stable study
  // artifacts carry `<stem>.provenance.json` sidecars whose artifactSha256
  // pins the same bytes. Either form is an acceptable checksum witness.
  const shaSidecar = `${path}.sha256`;
  const provenanceSidecar = `${path.replace(/\.json(\.gz)?$/, "")}.provenance.json`;
  if (!existsSync(path) || (!existsSync(shaSidecar) && !existsSync(provenanceSidecar))) {
    throw new Error(`${path}: retained artifact and checksum sidecar are required`);
  }
  const artifact = readFileSync(path);
  const artifactSha256 = sha256(artifact);
  const expected = existsSync(shaSidecar)
    ? readFileSync(shaSidecar, "utf8").trim().split(/\s+/)[0]
    : JSON.parse(readFileSync(provenanceSidecar, "utf8")).artifactSha256;
  if (artifactSha256 !== expected) throw new Error(`${path}: artifact checksum mismatch`);
  const bytes = path.endsWith(".gz") ? gunzipSync(artifact) : artifact;
  return { path, bytes, artifactSha256, rawSha256: sha256(bytes) };
}

export function verifyScaleStudyArchive(
  archive: any,
  options: {
    label: string;
    identity: SuiteIdentity;
    suite: SuiteManifest;
    sources: ResolvedSource[];
    contracts: Map<string, AxisContract>;
    scorerFingerprint: string;
    members: string[];
    expectedBudgets?: number[];
    expectedSeeds?: number[];
    rescore?: typeof scoreV2Report;
  },
): Map<string, StudyCell> {
  const rescore = options.rescore ?? scoreV2Report;
  if (
    !SCALE_STUDY_SCHEMAS.includes(archive?.schema) ||
    archive.suiteFingerprint !== options.identity.suiteFingerprint ||
    archive.sourceManifestFingerprint !== options.identity.sourceManifestFingerprint ||
    archive.scoringProtocolFingerprint !== options.identity.scoringProtocolFingerprint ||
    archive.scorerFingerprint !== options.scorerFingerprint ||
    JSON.stringify(archive.transform) !== JSON.stringify(options.suite.transform)
  ) {
    throw new Error(`${options.label}: archive does not match the current suite, sources, transform, and scorer`);
  }
  validateStudyCompilerIdentity(archive.candidate, options.label);
  const budgets: number[] = options.expectedBudgets ?? archive.budgets;
  const seeds: number[] = options.expectedSeeds ?? archive.seeds;
  if (
    !Array.isArray(budgets) || budgets.length === 0 || !Array.isArray(seeds) || seeds.length === 0 ||
    new Set(seeds).size !== seeds.length ||
    JSON.stringify(archive.budgets) !== JSON.stringify(budgets) ||
    JSON.stringify(archive.seeds) !== JSON.stringify(seeds)
  ) {
    throw new Error(`${options.label}: archive budgets/seeds do not match the expected schedule`);
  }
  const bySource = new Map(options.sources.map((source) => [source.id, source]));
  const cells = new Map<string, StudyCell>();
  for (const row of archive.runs ?? []) {
    const source = bySource.get(row.task?.sourceId);
    if (
      source === undefined || row.status !== "ok" || row.report === null || row.report === undefined ||
      row.source?.sourceFingerprint !== source.sourceFingerprint || !Number.isSafeInteger(row.authoredContacts)
    ) {
      throw new Error(`${options.label}: archive contains an invalid raw run (${row.task?.sourceId ?? "unknown"})`);
    }
    const key = cellKey(source.id, row.task.budget, row.task.actualSeed);
    if (cells.has(key)) throw new Error(`${options.label}: duplicate cell ${key.replaceAll("\0", "/")}`);
    const rescored = rescore(row.report, row.authoredContacts, options.contracts.get(source.id)!, options.suite);
    if (JSON.stringify(rescored) !== JSON.stringify(row.score)) {
      throw new Error(`${options.label}: ${source.id} stored score does not match its raw report`);
    }
    cells.set(key, { score: row.score.score, valid: row.score.valid === true });
  }
  for (const budget of budgets) {
    for (const seed of seeds) {
      for (const sourceId of options.members) {
        if (!cells.has(cellKey(sourceId, budget, seed))) {
          throw new Error(`${options.label}: archive is missing ${sourceId}/${budget}/${seed}`);
        }
      }
    }
  }
  const expectedCount = budgets.length * seeds.length * options.members.length;
  if (cells.size !== expectedCount) {
    throw new Error(`${options.label}: archive scope has ${cells.size} cells; expected ${expectedCount}`);
  }
  return cells;
}

/**
 * Mechanically attest that an arm's compiler differs from the baseline's by
 * exactly one declared LR_ knob: identical sources, engine, and engine
 * artifact; environment equal except the single declared key/value.
 */
export function assertKnobOnlyDelta(
  baselineCandidate: any,
  armCandidate: any,
  knob: string,
  value: string,
  label: string,
): void {
  if (
    baselineCandidate?.compilerSourceFingerprint !== armCandidate?.compilerSourceFingerprint ||
    baselineCandidate?.engine !== armCandidate?.engine ||
    baselineCandidate?.engineArtifactFingerprint !== armCandidate?.engineArtifactFingerprint
  ) {
    throw new Error(`${label}: arm compiler sources/engine differ from the baseline beyond the declared knob`);
  }
  const base = { ...(baselineCandidate?.compilerEnvironment ?? {}) };
  const arm = { ...(armCandidate?.compilerEnvironment ?? {}) };
  if (arm[knob] !== value) {
    throw new Error(`${label}: arm environment does not set ${knob}=${value}`);
  }
  delete arm[knob];
  delete base[knob];
  if (JSON.stringify(sortedEntries(base)) !== JSON.stringify(sortedEntries(arm))) {
    throw new Error(`${label}: arm environment differs from the baseline beyond ${knob}`);
  }
}

export function validateStudyCompilerIdentity(candidate: any, label: string): void {
  if (
    candidate?.compilerIdentityProtocol !== COMPILER_IDENTITY_PROTOCOL ||
    !Array.isArray(candidate.compilerSourceFiles) || candidate.compilerSourceFiles.length === 0 ||
    candidate.compilerEnvironment === null || typeof candidate.compilerEnvironment !== "object" ||
    typeof candidate.compilerSourceFingerprint !== "string" ||
    typeof candidate.engineArtifactFingerprint !== "string"
  ) {
    throw new Error(`${label}: archive compiler identity is incomplete`);
  }
  const expected = sha256(Buffer.from(JSON.stringify({
    compilerIdentityProtocol: candidate.compilerIdentityProtocol,
    compilerSourceFingerprint: candidate.compilerSourceFingerprint,
    compilerEnvironment: candidate.compilerEnvironment,
    engine: candidate.engine,
    engineArtifactFingerprint: candidate.engineArtifactFingerprint,
  })));
  if (candidate.candidateFingerprint !== expected) {
    throw new Error(`${label}: archive compiler identity is not self-consistent`);
  }
}

export function cellKey(sourceId: string, budget: number, actualSeed: number): string {
  return `${sourceId}\0${budget}\0${actualSeed}`;
}

function sortedEntries(value: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}
