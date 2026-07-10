import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pairedV2Decision, type DecisionRun } from "./decision_model.ts";
import { loadSourceManifest, resolveSources } from "./model.ts";
import {
  DECISION_SOURCE_FILES,
  HARNESS_SOURCE_FILES,
  canonicalMembers,
  fingerprintFiles,
  loadSuiteManifest,
  resolvedSeedSchedule,
  suiteIdentity,
} from "./suite_model.ts";

const [baseArgument, candidateArgument] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (baseArgument === undefined || candidateArgument === undefined) {
  throw new Error(`usage: decide.ts <base-archive.json> <candidate-archive.json>`);
}
const basePath = resolve(baseArgument);
const candidatePath = resolve(candidateArgument);
const sourceManifestPath = "benchmark/v2/compat/source-manifest.json";
const suiteManifestPath = "benchmark/v2/compat/suite-manifest.json";
const verifiedBase = loadVerifiedArchive(basePath);
const verifiedCandidate = loadVerifiedArchive(candidatePath);
const base = verifiedBase.archive;
const candidate = verifiedCandidate.archive;
if (base.schema !== "line.benchmark-v2.run-archive.v2" || candidate.schema !== base.schema) {
  throw new Error(`decision requires V2 archive schema v2`);
}
if (base.mode !== "development" || candidate.mode !== "development") {
  throw new Error(`decision requires canonical development archives`);
}
if (base.profile !== candidate.profile) throw new Error(`archives use different profiles`);
if (base.identity?.suiteFingerprint !== candidate.identity?.suiteFingerprint) {
  throw new Error(`archives use different suite fingerprints`);
}
if (base.identity?.executionPolicyFingerprint !== candidate.identity?.executionPolicyFingerprint) {
  throw new Error(`archives use different execution policies`);
}
const sources = resolveSources(loadSourceManifest(sourceManifestPath));
const suite = loadSuiteManifest(suiteManifestPath, sources);
const identity = suiteIdentity(suiteManifestPath, sourceManifestPath, sources);
if (base.identity.suiteFingerprint !== identity.suiteFingerprint) {
  throw new Error(`archives do not match the current suite fingerprint`);
}
validateArchiveScope(base, suite);
validateArchiveScope(candidate, suite);
validateCandidateIdentity(base);
validateCandidateIdentity(candidate);
const toDecisionRuns = (archive: any): DecisionRun[] => archive.runs.map((row: any) => ({
  sourceId: row.task.sourceId,
  budget: row.task.budget,
  seedSlot: row.task.seedSlot,
  actualSeed: row.task.actualSeed,
  score: row.score,
}));
const result = pairedV2Decision(toDecisionRuns(base), toDecisionRuns(candidate), suite);
console.log(JSON.stringify({
  schema: "line.benchmark-v2.decision.v1",
  decisionFingerprint: fingerprintFiles(DECISION_SOURCE_FILES),
  baseArchiveSha256: verifiedBase.sha256,
  candidateArchiveSha256: verifiedCandidate.sha256,
  ...result,
}, null, 2));

function loadVerifiedArchive(path: string): { archive: any; sha256: string } {
  const bytes = readFileSync(path);
  const sidecar = `${path}.sha256`;
  if (!existsSync(sidecar)) throw new Error(`${basename(path)}: missing SHA-256 sidecar`);
  const expected = readFileSync(sidecar, "utf8").trim().split(/\s+/)[0];
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (expected !== actual) throw new Error(`${basename(path)}: archive checksum mismatch`);
  return { archive: JSON.parse(bytes.toString("utf8")), sha256: actual };
}

function validateArchiveScope(archive: any, suite: ReturnType<typeof loadSuiteManifest>): void {
  const profile = suite.profiles[archive.profile as "probe" | "canonical"];
  if (profile === undefined) throw new Error(`archive has unknown profile`);
  if (archive.identity.profile !== archive.profile) throw new Error(`archive profile identity mismatch`);
  const expectedSources = resolveSources(loadSourceManifest(sourceManifestPath)).map((source) => ({
    id: source.id,
    role: source.role,
    sourceFingerprint: source.sourceFingerprint,
  }));
  const policyInput = {
    suiteFingerprint: archive.identity.suiteFingerprint,
    harnessFingerprint: archive.identity.harnessFingerprint,
    engine: archive.identity.engine,
    compiler: archive.identity.compiler,
    profile: archive.identity.profile,
    budgets: archive.identity.budgets,
    seedSchedule: archive.identity.seedSchedule,
    sources: archive.identity.sources,
    transform: archive.identity.transform,
  };
  const recomputedPolicy = createHash("sha256").update(JSON.stringify(policyInput)).digest("hex");
  if (recomputedPolicy !== archive.identity.executionPolicyFingerprint) {
    throw new Error(`archive execution-policy fingerprint is not self-consistent`);
  }
  if (archive.identity.harnessFingerprint !== fingerprintFiles(HARNESS_SOURCE_FILES)) {
    throw new Error(`archive harness does not match the current comparison harness`);
  }
  if (JSON.stringify(archive.identity.sources) !== JSON.stringify(expectedSources)) {
    throw new Error(`archive source identities do not match the current canonical sources`);
  }
  const schedule = resolvedSeedSchedule(suite, profile.budgets, profile.seeds_per_budget);
  if (
    JSON.stringify(archive.identity.budgets) !== JSON.stringify(profile.budgets) ||
    JSON.stringify(archive.identity.seedSchedule) !== JSON.stringify(schedule) ||
    JSON.stringify(archive.identity.transform) !== JSON.stringify(suite.transform)
  ) {
    throw new Error(`archive execution policy does not match the current suite profile`);
  }
  const expected = schedule.byBudget.flatMap(({ budget, actualSeeds }) =>
    actualSeeds.flatMap((actualSeed, seedSlot) => canonicalMembers(suite).map((sourceId) =>
      `${sourceId}\0${budget}\0${seedSlot}\0${actualSeed}`
    ))
  ).sort();
  const actual = archive.runs.map((row: any) =>
    `${row.task.sourceId}\0${row.task.budget}\0${row.task.seedSlot}\0${row.task.actualSeed}`
  ).sort();
  if (
    expected.length !== actual.length || new Set(actual).size !== actual.length ||
    expected.some((value, index) => value !== actual[index])
  ) {
    throw new Error(`archive does not contain the complete expected scope`);
  }
  if (archive.runs.some((row: any) => row.task.joltMs !== suite.transform.jolt_ms)) {
    throw new Error(`archive tasks do not use the frozen transform`);
  }
}

function validateCandidateIdentity(archive: any): void {
  const compilerSourceFingerprint = archive.git?.compilerSourceFingerprint;
  const compilerEnvironment = archive.git?.compilerEnvironment;
  const engineArtifactFingerprint = archive.git?.engineArtifactFingerprint;
  if (
    typeof compilerSourceFingerprint !== "string" ||
    compilerEnvironment === null || typeof compilerEnvironment !== "object" || Array.isArray(compilerEnvironment) ||
    !(typeof engineArtifactFingerprint === "string" || engineArtifactFingerprint === null)
  ) {
    throw new Error(`archive candidate identity is incomplete`);
  }
  const expected = createHash("sha256").update(JSON.stringify({
    compilerSourceFingerprint,
    compilerEnvironment,
    engine: archive.identity.engine,
    engineArtifactFingerprint,
  })).digest("hex");
  if (archive.git.candidateFingerprint !== expected) {
    throw new Error(`archive candidate fingerprint is not self-consistent`);
  }
}
