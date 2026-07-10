import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import {
  BENCHMARK_EXECUTION_PROTOCOL,
  BENCHMARK_RUN_ARCHIVE_SCHEMA,
  COMPILER_IDENTITY_PROTOCOL,
  benchmarkDecisionPolicy,
} from "../../../benchmark/v2/decision-policy.ts";
import {
  pairedV2Decision,
  type DecisionMode,
  type DecisionProfile,
  type DecisionRun,
  type V2Decision,
} from "./decision_model.ts";
import { V2_RUN_SCORE_SCHEMA } from "./evaluator.ts";
import { loadSourceManifest, resolveSources } from "./model.ts";
import {
  DECISION_SOURCE_FILES,
  canonicalMembers,
  executionPolicyIdentity,
  fingerprintFiles,
  loadSuiteManifest,
  resolvedSeedSchedule,
  suiteIdentity,
} from "./suite_model.ts";

const DECISION_SCHEMA = "line.benchmark-v2.decision.v2" as const;
const BASELINE_SCHEMA = "line.benchmark-v2.baseline-reference.v5" as const;
const DEFAULT_BASELINE_PATH = "benchmark/v2/baseline.json";
const REQUIRED_COMPILER_IDENTITY_FILES = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "scripts/v0/optimizer/handoff.ts",
  "scripts/v0/score.ts",
  "scripts/lib/detector.ts",
  "engine-rs/Cargo.toml",
] as const;

type ParsedArgs = {
  candidatePath: string;
  basePath?: string;
  outPath?: string;
  mode: DecisionMode;
  margin?: number;
  printJson: boolean;
  noGateExit: boolean;
};

type VerifiedArchive = {
  path: string;
  archive: any;
  archiveSha256: string;
  artifactSha256: string;
  compressed: boolean;
};

type BaselineReference = {
  schema: typeof BASELINE_SCHEMA;
  label: string;
  suite_fingerprint: string;
  execution_protocol: typeof BENCHMARK_EXECUTION_PROTOCOL;
  compiler_identity_protocol: typeof COMPILER_IDENTITY_PROTOCOL;
  candidate_fingerprint: string;
  probe: RetainedReference;
  development: RetainedReference;
};

type RetainedReference = {
  archive_sha256: string;
  compressed_archive: string;
  compressed_archive_sha256: string;
};

export type DecisionArtifact = {
  schema: typeof DECISION_SCHEMA;
  generatedAt: string;
  decisionFingerprint: string;
  executionProtocol: typeof BENCHMARK_EXECUTION_PROTOCOL;
  base: ArchiveReference;
  candidate: ArchiveReference;
  implementationFingerprintsMatch: boolean;
  result: V2Decision;
};

type ArchiveReference = {
  path: string;
  archiveSha256: string;
  artifactSha256: string;
  candidateFingerprint: string;
  implementationFingerprint: string;
  headline: number;
};

export function runDecisionCommand(argv = process.argv.slice(2)): number {
  const args = parseArgs(argv);
  const candidate = loadVerifiedArchive(args.candidatePath);
  const profile = archiveProfile(candidate.archive);
  const baselineResolution = args.basePath === undefined
    ? baselineArchive(profile)
    : { path: resolve(args.basePath), expected: undefined, label: "explicit-base", reference: undefined };
  const base = loadVerifiedArchive(baselineResolution.path, baselineResolution.expected);
  if (baselineResolution.reference !== undefined) {
    if (
      base.archive.identity?.suiteFingerprint !== baselineResolution.reference.suite_fingerprint ||
      base.archive.git?.candidateFingerprint !== baselineResolution.reference.candidate_fingerprint
    ) {
      throw new Error(`frozen baseline metadata does not match its retained archive`);
    }
  }
  const { suite, baseRuns, candidateRuns } = validateComparison(base, candidate);
  const result = pairedV2Decision(baseRuns, candidateRuns, suite, {
    profile,
    mode: args.mode,
    margin: args.margin,
  });
  assertStoredHeadline(base.archive, result.baseHeadline, "base");
  assertStoredHeadline(candidate.archive, result.candidateHeadline, "candidate");

  const artifact: DecisionArtifact = {
    schema: DECISION_SCHEMA,
    generatedAt: new Date().toISOString(),
    decisionFingerprint: fingerprintFiles(DECISION_SOURCE_FILES),
    executionProtocol: BENCHMARK_EXECUTION_PROTOCOL,
    base: archiveReference(base),
    candidate: archiveReference(candidate),
    implementationFingerprintsMatch:
      base.archive.identity.implementationFingerprint === candidate.archive.identity.implementationFingerprint,
    result,
  };
  const outPath = resolve(args.outPath ?? defaultOutput(candidate, baselineResolution.label, args.mode, args.margin));
  writeDecisionArtifact(outPath, artifact);
  if (args.printJson) {
    console.log(JSON.stringify(artifact, null, 2));
  } else {
    console.log(renderDecision(artifact, outPath));
  }
  return args.noGateExit ? 0 : outcomeExitCode(result.outcome);
}

function parseArgs(argv: string[]): ParsedArgs {
  let mode: DecisionMode = "improvement";
  let margin: number | undefined;
  let basePath: string | undefined;
  let candidateFlag: string | undefined;
  let outPath: string | undefined;
  let printJson = false;
  let noGateExit = false;
  const positional: string[] = [];

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      positional.push(arg);
    } else if (arg.startsWith("--mode=")) {
      const value = arg.slice("--mode=".length);
      if (value !== "improvement" && value !== "simplification") {
        throw new Error(`--mode must be improvement or simplification`);
      }
      mode = value;
    } else if (arg.startsWith("--margin=")) {
      margin = finiteNumber(arg.slice("--margin=".length), "--margin");
    } else if (arg.startsWith("--base=")) {
      basePath = arg.slice("--base=".length);
    } else if (arg.startsWith("--candidate=")) {
      candidateFlag = arg.slice("--candidate=".length);
    } else if (arg.startsWith("--out=")) {
      outPath = arg.slice("--out=".length);
    } else if (arg === "--json") {
      printJson = true;
    } else if (arg === "--no-gate-exit") {
      noGateExit = true;
    } else {
      throw new Error(`unsupported decide flag ${arg}`);
    }
  }
  if (candidateFlag !== undefined && positional.length > 0) {
    throw new Error(`provide the candidate as either a positional path or --candidate, not both`);
  }
  const candidatePath = candidateFlag ?? positional[0];
  if (candidatePath === undefined) {
    throw new Error(`usage: benchmark decide CANDIDATE [--base=BASE] [--mode=improvement|simplification] [--margin=POINTS]`);
  }
  if (positional.length > 2) throw new Error(`decide accepts at most candidate and base positional paths`);
  if (positional[1] !== undefined) {
    if (basePath !== undefined) throw new Error(`provide the base as either a second positional path or --base, not both`);
    basePath = positional[1];
  }
  if (mode === "simplification" && (margin === undefined || margin <= 0)) {
    throw new Error(`simplification decisions require --margin=<positive headline points>`);
  }
  if (mode === "improvement" && margin !== undefined) {
    throw new Error(`--margin is only valid in simplification mode`);
  }
  return {
    candidatePath: resolve(candidatePath),
    basePath,
    outPath,
    mode,
    margin,
    printJson,
    noGateExit,
  };
}

function validateComparison(
  base: VerifiedArchive,
  candidate: VerifiedArchive,
): { suite: ReturnType<typeof loadSuiteManifest>; baseRuns: DecisionRun[]; candidateRuns: DecisionRun[] } {
  const baseArchive = base.archive;
  const candidateArchive = candidate.archive;
  if (baseArchive.schema !== BENCHMARK_RUN_ARCHIVE_SCHEMA || candidateArchive.schema !== BENCHMARK_RUN_ARCHIVE_SCHEMA) {
    throw new Error(`decision requires ${BENCHMARK_RUN_ARCHIVE_SCHEMA} archives`);
  }
  if (baseArchive.mode !== "development" || candidateArchive.mode !== "development") {
    throw new Error(`decision requires development archives`);
  }
  if (baseArchive.profile !== candidateArchive.profile) throw new Error(`archives use different profiles`);
  if (baseArchive.identity?.suiteFingerprint !== candidateArchive.identity?.suiteFingerprint) {
    throw new Error(`archives use different suite fingerprints`);
  }
  if (baseArchive.identity?.executionProtocol !== candidateArchive.identity?.executionProtocol) {
    throw new Error(`archives use different execution protocols`);
  }
  if (baseArchive.identity?.executionPolicyFingerprint !== candidateArchive.identity?.executionPolicyFingerprint) {
    throw new Error(`archives use different execution policies`);
  }
  if (baseArchive.git?.engineArtifactFingerprint !== candidateArchive.git?.engineArtifactFingerprint) {
    throw new Error(`archives use different engine artifacts`);
  }
  const runtimeIdentity = (archive: any): string => JSON.stringify({
    node: archive.environment?.node,
    platform: archive.environment?.platform,
    architecture: archive.environment?.architecture,
  });
  if (runtimeIdentity(baseArchive) !== runtimeIdentity(candidateArchive)) {
    throw new Error(`archives use different runtime platforms`);
  }

  const sourceManifestPath = "benchmark/v2/compat/source-manifest.json";
  const suiteManifestPath = "benchmark/v2/compat/suite-manifest.json";
  const sources = resolveSources(loadSourceManifest(sourceManifestPath));
  const suite = loadSuiteManifest(suiteManifestPath, sources);
  const identity = suiteIdentity(suiteManifestPath, sourceManifestPath, sources);
  if (baseArchive.identity.suiteFingerprint !== identity.suiteFingerprint) {
    throw new Error(`archives do not match the current suite fingerprint`);
  }
  validateArchiveScope(baseArchive, suite, sources);
  validateArchiveScope(candidateArchive, suite, sources);
  validateCandidateIdentity(baseArchive);
  validateCandidateIdentity(candidateArchive);
  return {
    suite,
    baseRuns: toDecisionRuns(baseArchive),
    candidateRuns: toDecisionRuns(candidateArchive),
  };
}

function validateArchiveScope(
  archive: any,
  suite: ReturnType<typeof loadSuiteManifest>,
  sources: ReturnType<typeof resolveSources>,
): void {
  const profileName = archiveProfile(archive);
  const profile = suite.profiles[profileName];
  if (archive.identity?.engine !== "wasm" || archive.identity?.compiler !== "compileHandoff") {
    throw new Error(`decision-eligible archives require the WASM engine and compileHandoff`);
  }
  if (
    typeof archive.environment?.node !== "string" || typeof archive.environment?.platform !== "string" ||
    typeof archive.environment?.architecture !== "string"
  ) {
    throw new Error(`archive runtime identity is incomplete`);
  }
  if (archive.identity?.profile !== archive.profile) throw new Error(`archive profile identity mismatch`);
  if (archive.identity?.executionProtocol !== BENCHMARK_EXECUTION_PROTOCOL) {
    throw new Error(`archive execution protocol is stale; re-run the benchmark`);
  }
  if (typeof archive.identity?.implementationFingerprint !== "string") {
    throw new Error(`archive implementation fingerprint is incomplete`);
  }
  const expectedSources = sources.map((source) => ({
    id: source.id,
    role: source.role,
    sourceFingerprint: source.sourceFingerprint,
  }));
  const recomputed = executionPolicyIdentity({
    suiteFingerprint: archive.identity.suiteFingerprint,
    executionProtocol: archive.identity.executionProtocol,
    implementationFingerprint: archive.identity.implementationFingerprint,
    engine: archive.identity.engine,
    compiler: archive.identity.compiler,
    profile: archive.identity.profile,
    budgets: archive.identity.budgets,
    seedSchedule: archive.identity.seedSchedule,
    sources: archive.identity.sources,
    transform: archive.identity.transform,
  });
  if (recomputed.executionPolicyFingerprint !== archive.identity.executionPolicyFingerprint) {
    throw new Error(`archive execution-policy fingerprint is not self-consistent`);
  }
  if (JSON.stringify(archive.identity.sources) !== JSON.stringify(expectedSources)) {
    throw new Error(`archive source identities do not match the current canonical sources`);
  }
  const schedule = resolvedSeedSchedule(suite, profileName, profile.budgets, profile.seeds_per_budget);
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
  if (!Array.isArray(archive.runs)) throw new Error(`archive runs are missing`);
  const actual = archive.runs.map((row: any) =>
    `${row.task?.sourceId}\0${row.task?.budget}\0${row.task?.seedSlot}\0${row.task?.actualSeed}`
  ).sort();
  if (
    expected.length !== actual.length || new Set(actual).size !== actual.length ||
    expected.some((value, index) => value !== actual[index])
  ) {
    throw new Error(`archive does not contain the complete expected scope`);
  }
  for (const row of archive.runs) {
    if (row.status !== "ok") throw new Error(`archive contains worker failures and is not decision-eligible`);
    if (row.task.joltMs !== suite.transform.jolt_ms) throw new Error(`archive tasks do not use the frozen transform`);
    if (
      row.score?.schema !== V2_RUN_SCORE_SCHEMA || typeof row.score.valid !== "boolean" ||
      !Number.isFinite(row.score.score) || row.score.score < 0 || row.score.score > 1000
    ) {
      throw new Error(`archive contains malformed run scores`);
    }
  }
}

function validateCandidateIdentity(archive: any): void {
  const compilerIdentityProtocol = archive.git?.compilerIdentityProtocol;
  const compilerSourceFingerprint = archive.git?.compilerSourceFingerprint;
  const compilerSourceFiles = archive.git?.compilerSourceFiles;
  const compilerEnvironment = archive.git?.compilerEnvironment;
  const engineArtifactFingerprint = archive.git?.engineArtifactFingerprint;
  if (compilerIdentityProtocol !== COMPILER_IDENTITY_PROTOCOL) {
    throw new Error(`archive compiler identity protocol is stale; re-run the benchmark`);
  }
  if (
    typeof compilerSourceFingerprint !== "string" ||
    !Array.isArray(compilerSourceFiles) || compilerSourceFiles.length === 0 ||
    compilerSourceFiles.some((path: unknown) => typeof path !== "string") ||
    new Set(compilerSourceFiles).size !== compilerSourceFiles.length ||
    compilerEnvironment === null || typeof compilerEnvironment !== "object" || Array.isArray(compilerEnvironment) ||
    typeof engineArtifactFingerprint !== "string"
  ) {
    throw new Error(`archive candidate identity is incomplete`);
  }
  if (REQUIRED_COMPILER_IDENTITY_FILES.some((path) => !compilerSourceFiles.includes(path))) {
    throw new Error(`archive compiler source boundary is incomplete; re-run the benchmark`);
  }
  const expected = sha256(JSON.stringify({
    compilerIdentityProtocol,
    compilerSourceFingerprint,
    compilerEnvironment,
    engine: archive.identity.engine,
    engineArtifactFingerprint,
  }));
  if (archive.git.candidateFingerprint !== expected) {
    throw new Error(`archive candidate fingerprint is not self-consistent`);
  }
}

function toDecisionRuns(archive: any): DecisionRun[] {
  return archive.runs.map((row: any) => ({
    sourceId: row.task.sourceId,
    budget: row.task.budget,
    seedSlot: row.task.seedSlot,
    actualSeed: row.task.actualSeed,
    score: { score: row.score.score, valid: row.score.valid },
  }));
}

function loadVerifiedArchive(path: string, expected?: RetainedReference): VerifiedArchive {
  const absolute = resolve(path);
  const artifactBytes = readFileSync(absolute);
  const artifactSha256 = sha256(artifactBytes);
  const compressed = absolute.endsWith(".gz");
  const expectedArtifactSha = compressed ? expected?.compressed_archive_sha256 : expected?.archive_sha256;
  const sidecarSha = readSidecarSha(absolute);
  if (expectedArtifactSha === undefined && sidecarSha === undefined) {
    throw new Error(`${basename(absolute)}: missing trusted SHA-256 evidence`);
  }
  for (const trusted of [expectedArtifactSha, sidecarSha]) {
    if (trusted !== undefined && trusted !== artifactSha256) {
      throw new Error(`${basename(absolute)}: archive checksum mismatch`);
    }
  }
  const archiveBytes = compressed ? gunzipSync(artifactBytes) : artifactBytes;
  const archiveSha256 = sha256(archiveBytes);
  if (expected?.archive_sha256 !== undefined && expected.archive_sha256 !== archiveSha256) {
    throw new Error(`${basename(absolute)}: decompressed archive checksum mismatch`);
  }
  return {
    path: absolute,
    archive: JSON.parse(archiveBytes.toString("utf8")),
    archiveSha256,
    artifactSha256,
    compressed,
  };
}

function baselineArchive(profile: DecisionProfile): {
  path: string;
  expected: RetainedReference;
  label: string;
  reference: BaselineReference;
} {
  const baseline = JSON.parse(readFileSync(DEFAULT_BASELINE_PATH, "utf8")) as BaselineReference;
  if (
    baseline.schema !== BASELINE_SCHEMA || baseline.execution_protocol !== BENCHMARK_EXECUTION_PROTOCOL ||
    baseline.compiler_identity_protocol !== COMPILER_IDENTITY_PROTOCOL
  ) {
    throw new Error(`the frozen baseline predates the V2 decision protocol; establish a new baseline`);
  }
  const expected = profile === "probe" ? baseline.probe : baseline.development;
  return { path: resolve(expected.compressed_archive), expected, label: baseline.label, reference: baseline };
}

function archiveProfile(archive: any): DecisionProfile {
  if (archive?.profile !== "probe" && archive?.profile !== "canonical") {
    throw new Error(`archive profile must be probe or canonical`);
  }
  return archive.profile;
}

function archiveReference(verified: VerifiedArchive): ArchiveReference {
  return {
    path: relativeToCwd(verified.path),
    archiveSha256: verified.archiveSha256,
    artifactSha256: verified.artifactSha256,
    candidateFingerprint: verified.archive.git.candidateFingerprint,
    implementationFingerprint: verified.archive.identity.implementationFingerprint,
    headline: verified.archive.canonicalHeadline,
  };
}

function assertStoredHeadline(archive: any, recomputed: number, label: string): void {
  if (!Number.isFinite(archive.canonicalHeadline) || Math.abs(archive.canonicalHeadline - recomputed) > 0.0001) {
    throw new Error(`${label} archive stored headline does not match the decision scorer`);
  }
}

function renderDecision(artifact: DecisionArtifact, outPath: string): string {
  const result = artifact.result;
  const central = result.confidence;
  const thresholdText = result.mode === "improvement"
    ? "improvement threshold 0.00"
    : `non-inferiority threshold ${formatSigned(result.threshold)}`;
  const orderedCases = [...result.perCase].sort((a, b) => a.delta - b.delta);
  const caseLines = [
    "  largest case regressions:",
    ...orderedCases.slice(0, 5).map((entry) =>
      `    ${entry.sourceId.padEnd(45)} ${formatSigned(entry.delta)} ` +
      `(valid ${entry.baseValid}->${entry.candidateValid}/${entry.total})`
    ),
    "  largest case improvements:",
    ...orderedCases.slice(-5).reverse().map((entry) =>
      `    ${entry.sourceId.padEnd(45)} ${formatSigned(entry.delta)} ` +
      `(valid ${entry.baseValid}->${entry.candidateValid}/${entry.total})`
    ),
  ];
  const lines = [
    `Benchmark V2 decision - ${result.profile} ${result.authority}`,
    `  policy: ${result.mode}; ${thresholdText}; ${(central.oneSidedLevel * 100).toFixed(0)}% one-sided confidence`,
    `  headline: ${result.baseHeadline.toFixed(2)} -> ${result.candidateHeadline.toFixed(2)} ` +
      `(delta ${formatSigned(result.delta)})`,
    `  ${(central.centralLevel * 100).toFixed(0)}% seed-block t interval: ` +
      `[${formatSigned(central.centralLo)}, ${formatSigned(central.centralHi)}]`,
    `  one-sided bounds: lower ${formatSigned(central.lowerBound)}, upper ${formatSigned(central.upperBound)}`,
    `  formal seed-block SE: ${result.uncertainty.seed.standardError.toFixed(2)} ` +
      `(df ${result.uncertainty.seed.degreesOfFreedom?.toFixed(1) ?? "infinite"})`,
    `  sensitivity SE: crossed ${result.uncertainty.jointSensitivity.standardError.toFixed(2)}, ` +
      `catalog ${result.uncertainty.catalogSensitivity.standardError.toFixed(2)}`,
    `  validity: ${result.validity.baseValid}/${result.validity.total} -> ` +
      `${result.validity.candidateValid}/${result.validity.total} ` +
      `(gained ${result.validity.gained}, lost ${result.validity.lost})`,
    "  budgets (delta; 95% seed-block t interval):",
    ...result.perBudget.map((entry) =>
      `    ${(entry.budget / 1000).toFixed(0).padStart(4)}k  ${formatSigned(entry.delta)}  ` +
      `[${formatSigned(entry.confidence.centralLo)}, ${formatSigned(entry.confidence.centralHi)}]  ` +
      `valid ${entry.baseValid}->${entry.candidateValid}/${entry.total}`
    ),
    "  strata (delta; 95% seed-block t interval):",
    ...result.perStratum.map((entry) =>
      `    ${entry.stratum.padEnd(20)} ${formatSigned(entry.delta)}  ` +
      `[${formatSigned(entry.confidence.centralLo)}, ${formatSigned(entry.confidence.centralHi)}]`
    ),
    ...caseLines,
    `  OUTCOME: ${result.outcome.toUpperCase()}` +
      (result.authority === "screening" ? " (screening only; canonical evidence is required)" : ""),
    `  artifact: ${relativeToCwd(outPath)}`,
  ];
  if (!artifact.implementationFingerprintsMatch) {
    lines.splice(lines.length - 2, 0, "  note: runner implementation bytes differ; the explicit execution protocol is unchanged");
  }
  return lines.join("\n");
}

function writeDecisionArtifact(path: string, artifact: DecisionArtifact): void {
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  writeFileSync(`${path}.sha256`, `${sha256(bytes)}  ${relativeToCwd(path)}\n`);
}

function defaultOutput(
  candidate: VerifiedArchive,
  baselineLabel: string,
  mode: DecisionMode,
  margin: number | undefined,
): string {
  const stem = basename(candidate.path).replace(/\.json(?:\.gz)?$/, "");
  const safeBaseline = baselineLabel.replace(/[^a-zA-Z0-9_.-]+/g, "-");
  const policy = mode === "improvement" ? mode : `${mode}-margin-${String(margin).replace(".", "p")}`;
  return `generated/benchmark-v2/decisions/${stem}-${candidate.archiveSha256.slice(0, 8)}-vs-${safeBaseline}-${policy}.json`;
}

function outcomeExitCode(outcome: V2Decision["outcome"]): number {
  if (outcome === "advance" || outcome === "accept") return 0;
  if (outcome === "unresolved" || outcome === "inconclusive") return 2;
  return 3;
}

function readSidecarSha(path: string): string | undefined {
  const sidecar = `${path}.sha256`;
  return existsSync(sidecar) ? readFileSync(sidecar, "utf8").trim().split(/\s+/)[0] : undefined;
}

function finiteNumber(raw: string, label: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function relativeToCwd(path: string): string {
  const absoluteCwd = `${process.cwd()}/`;
  return path.startsWith(absoluteCwd) ? path.slice(absoluteCwd.length) : path;
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = runDecisionCommand();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
