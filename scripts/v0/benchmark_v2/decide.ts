import { createHash } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
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
  studentTQuantile,
  type DecisionMode,
  type DecisionProfile,
  type DecisionRun,
  type V2Decision,
} from "./decision_model.ts";
import {
  V2_RUN_SCORE_SCHEMA,
  buildAxisContract,
  scoreV2Report,
  type AxisContract,
} from "./evaluator.ts";
import {
  loadSourceManifest,
  loadSourceSpec,
  resolveSources,
} from "./model.ts";
import { applyJolt } from "../../produce/seed.ts";
import {
  runnerCompatibilityApproval,
  type RunnerCompatibilityApproval,
} from "./runner_compatibility.ts";
import {
  loadListeningReview,
  requireApprovedListeningReview,
} from "./listening_review.ts";
import {
  canonicalMembers,
  executionPolicyIdentity,
  fingerprintFiles,
  loadSuiteManifest,
  resolvedSeedSchedule,
  suiteIdentity,
  type ResolvedSeedSchedule,
} from "./suite_model.ts";
import {
  baselineCacheManifestFingerprint,
  loadBaselineCacheEvidence,
  seedScheduleAtDepth,
  type BaselineCacheView,
} from "./baseline_cache.ts";
import { DECISION_INFERENCE_PROTOCOL_FINGERPRINT } from "./decision_model.ts";
import { decisionProtocolFingerprint } from "./decision_protocol.ts";

const DECISION_SCHEMA = "line.benchmark-v2.decision.v4" as const;
const BASELINE_CACHE_REFERENCE_SCHEMA = "line.benchmark-v2.baseline-reference.v10" as const;
const DEFAULT_BASELINE_PATH = "benchmark/v2/baseline.json";
const PROBE_BASELINE_SCHEMA = "line.benchmark-v2.probe-baseline-reference.v1" as const;
const DEFAULT_PROBE_BASELINE_PATH = "benchmark/v2/probe-baseline.json";
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
  indexed: boolean;
};

type BaselineReference = {
  schema: typeof BASELINE_CACHE_REFERENCE_SCHEMA | typeof PROBE_BASELINE_SCHEMA;
  label: string;
  status: "canonical-baseline" | "provisional-listening-review-required" | "screening-baseline";
  suite_fingerprint: string;
  execution_protocol: typeof BENCHMARK_EXECUTION_PROTOCOL;
  compiler_identity_protocol: typeof COMPILER_IDENTITY_PROTOCOL;
  listening_review_status: "approved" | "awaiting-human-review" | "rejected";
  candidate_fingerprint: string;
  decision_inference_fingerprint?: string;
  decision_protocol_fingerprint?: string;
  decision_calibration_fingerprint?: string;
  probe: RetainedReference;
  development: RetainedReference;
};

type RetainedReference = {
  archive_sha256: string;
  compressed_archive?: string;
  compressed_archive_sha256?: string;
};

export type DecisionArtifact = {
  schema: typeof DECISION_SCHEMA;
  generatedAt: string;
  decisionInferenceFingerprint: string;
  decisionProtocolFingerprint: string;
  executionProtocol: typeof BENCHMARK_EXECUTION_PROTOCOL;
  base: ArchiveReference;
  candidate: ArchiveReference;
  implementationFingerprintsMatch: boolean;
  runnerCompatibilityApproval: RunnerCompatibilityApproval | null;
  baselineCache?: {
    manifestPath: string;
    manifestFingerprint: string;
    coverageDepth: number;
    budgets: number[];
    shardRanges: Array<{ firstSeedSlot: number; endSeedSlotExclusive: number }>;
    compatibilityApprovals: RunnerCompatibilityApproval[];
  };
  result: V2Decision;
  hint: string | null;
  nextCommand: string;
};

type ArchiveReference = {
  path: string;
  archiveSha256: string;
  artifactSha256: string;
  candidateFingerprint: string;
  implementationFingerprint: string;
  headline: number;
};

export async function runDecisionCommand(argv = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);
  const candidate = loadVerifiedArchive(args.candidatePath);
  assertNotExplorationArchive(candidate.archive);
  const profile = archiveProfile(candidate.archive);
  if (profile === "canonical") {
    // Canonical evidence is judged inside its predeclared eval attempt; a
    // standalone re-decide would double-judge the same draw.
    throw new Error(`canonical comparisons are produced directly by \`npm run benchmark -- eval --seeds=N\``);
  }
  const baselineResolution = args.basePath === undefined
    ? baselineArchive(profile)
    : { path: resolve(args.basePath), expected: undefined, label: "explicit-base", reference: undefined };
  const base = loadVerifiedArchive(baselineResolution.path, baselineResolution.expected);
  assertNotExplorationArchive(base.archive);
  if (baselineResolution.reference !== undefined) {
    if (
      base.archive.identity?.suiteFingerprint !== baselineResolution.reference.suite_fingerprint ||
      base.archive.git?.candidateFingerprint !== baselineResolution.reference.candidate_fingerprint
    ) {
      throw new Error(`frozen baseline metadata does not match its retained archive`);
    }
  }
  const { suite, baseRuns, candidateRuns, compatibilityApproval } = await validateComparison(base, candidate);
  const result = pairedV2Decision(baseRuns, candidateRuns, suite, {
    profile,
    mode: args.mode,
    margin: args.margin,
  });
  assertStoredHeadline(base.archive, result.baseHeadline, "base");
  assertStoredHeadline(candidate.archive, result.candidateHeadline, "candidate");
  const hint = underPoweredHint(result, suite.profiles[profile].seeds_per_budget);
  const nextCommand = nextCommandFor(result);

  const artifact: DecisionArtifact = {
    schema: DECISION_SCHEMA,
    generatedAt: new Date().toISOString(),
    decisionInferenceFingerprint: DECISION_INFERENCE_PROTOCOL_FINGERPRINT,
    decisionProtocolFingerprint: decisionProtocolFingerprint(),
    executionProtocol: BENCHMARK_EXECUTION_PROTOCOL,
    base: archiveReference(base),
    candidate: archiveReference(candidate),
    implementationFingerprintsMatch:
      base.archive.identity.implementationFingerprint === candidate.archive.identity.implementationFingerprint,
    runnerCompatibilityApproval: compatibilityApproval,
    result,
    hint,
    nextCommand,
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

export async function loadValidatedDecisionPairForCalibration(
  basePath: string,
  candidatePath: string,
): Promise<{
  suite: ReturnType<typeof loadSuiteManifest>;
  baseRuns: DecisionRun[];
  candidateRuns: DecisionRun[];
}> {
  const base = loadVerifiedArchive(basePath);
  const candidate = loadVerifiedArchive(candidatePath);
  assertNotExplorationArchive(base.archive);
  assertNotExplorationArchive(candidate.archive);
  const { suite, baseRuns, candidateRuns } = await validateComparison(base, candidate, "calibration");
  return { suite, baseRuns, candidateRuns };
}

/**
 * Read a canonical two-snapshot study against its explicitly declared seed
 * schedule. This is intentionally separate from `runDecisionCommand`: active
 * campaign verdicts still belong to `eval`, while a disjoint confirmation
 * block needs the same archive, scorer, source, runtime, and identity checks
 * without pretending its fresh seeds are the campaign's original ladder.
 */
export async function loadValidatedCanonicalStudyPair(
  basePath: string,
  candidatePath: string,
  schedule: ResolvedSeedSchedule,
): Promise<{
  suite: ReturnType<typeof loadSuiteManifest>;
  baseRuns: DecisionRun[];
  candidateRuns: DecisionRun[];
}> {
  const base = loadVerifiedArchive(basePath);
  const candidate = loadVerifiedArchive(candidatePath);
  assertNotExplorationArchive(base.archive);
  assertNotExplorationArchive(candidate.archive);
  const { suite, baseRuns, candidateRuns } = await validateComparison(
    base,
    candidate,
    "decision",
    schedule.seedsPerBudget,
    schedule,
  );
  return { suite, baseRuns, candidateRuns };
}

/** Clone the frozen suite with the canonical allocation set to an eval depth. */
export function suiteAtDepth(
  suite: ReturnType<typeof loadSuiteManifest>,
  depth: number,
  budgets = suite.profiles.canonical.budgets,
): ReturnType<typeof loadSuiteManifest> {
  if (!Number.isSafeInteger(depth) || depth < 1) throw new Error(`eval depth must be a positive integer`);
  const clone = structuredClone(suite);
  clone.profiles.canonical.seeds_per_budget = depth;
  clone.profiles.canonical.budgets = [...budgets];
  return clone;
}

/**
 * Fixed-N comparison against immutable baseline-cache shards. Ordinary
 * `decide` remains a two-archive tool; this path records cache provenance and
 * never pretends the cached baseline was freshly compiled.
 */
export async function evalDecisionAgainstBaselineCache(
  cache: BaselineCacheView,
  candidatePath: string,
  options: {
    mode: DecisionMode;
    margin: number | null;
    depth: number;
    request?: {
      path: string;
      sha256: string;
      seedScheduleFingerprint: string;
      candidateFingerprint: string;
    };
  },
): Promise<{ artifact: DecisionArtifact; candidate: VerifiedArchive }> {
  const candidate = loadVerifiedArchive(candidatePath);
  assertNotExplorationArchive(candidate.archive);
  if (archiveProfile(candidate.archive) !== "canonical") throw new Error(`cache-backed eval verdicts require a canonical candidate archive`);
  if (options.request !== undefined) {
    assertComparisonRequestLink(candidate.archive, {
      label: "candidate arm",
      candidateFingerprint: options.request.candidateFingerprint,
      requestPath: options.request.path,
      requestSha256: options.request.sha256,
      seedScheduleFingerprint: options.request.seedScheduleFingerprint,
      depth: options.depth,
    });
  }
  const evidence = loadBaselineCacheEvidence(cache, options.depth);
  const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
  const suite = loadSuiteManifest("benchmark/v2/compat/suite-manifest.json", sources);
  const identity = suiteIdentity("benchmark/v2/compat/suite-manifest.json", "benchmark/v2/compat/source-manifest.json", sources);
  if (cache.cache.suiteFingerprint !== identity.suiteFingerprint || candidate.archive.identity?.suiteFingerprint !== identity.suiteFingerprint) {
    throw new Error(`cache-backed comparison does not match the current suite`);
  }
  const listeningReview = await loadListeningReview(
    "benchmark/v2/evidence/listening-review.json",
    identity.suiteFingerprint,
    identity.sourceManifestFingerprint,
    sources,
  );
  requireApprovedListeningReview(listeningReview);
  const contracts = new Map<string, AxisContract>();
  for (const source of sources) {
    const spec = applyJolt(await loadSourceSpec(source), suite.transform.jolt_ms);
    contracts.set(source.id, buildAxisContract(spec, source.eligibleComponents, source.diagnosticComponents));
  }
  const schedule = seedScheduleAtDepth(cache.cache, options.depth);
  const budgets = schedule.byBudget.map((entry) => entry.budget);
  const budgetSet = new Set(budgets);
  validateArchiveScope(
    candidate.archive,
    suite,
    sources,
    contracts,
    listeningReview.fingerprint,
    options.depth,
    candidate.indexed,
    schedule,
    undefined,
    budgets,
  );
  validateCandidateIdentity(candidate.archive);

  const approvals: RunnerCompatibilityApproval[] = [];
  const baseRuns: DecisionRun[] = [];
  for (const { shard, archive, indexed } of evidence) {
    const shardSchedule = shard.budgetProjection === undefined
      ? seedScheduleAtDepth(cache.cache, shard.endSeedSlotExclusive)
      : archive.identity.seedSchedule as ResolvedSeedSchedule;
    validateArchiveScope(
      archive,
      suite,
      sources,
      contracts,
      listeningReview.fingerprint,
      shardSchedule.seedsPerBudget,
      indexed,
      shardSchedule,
      {
        firstSeedSlot: shard.firstSeedSlot,
        // Validate the immutable shard exactly as stored, even when the
        // requested comparison consumes only a prefix of it. The decision
        // rows are sliced to `options.depth` below.
        endSeedSlotExclusive: shard.endSeedSlotExclusive,
      },
      shard.budgetProjection === undefined ? budgets : archive.identity.budgets,
    );
    validateCandidateIdentity(archive);
    if (archive.identity?.executionProtocol !== candidate.archive.identity?.executionProtocol) {
      throw new Error(`baseline cache shard uses a different execution protocol`);
    }
    if (archive.git?.engineArtifactFingerprint !== candidate.archive.git?.engineArtifactFingerprint) {
      throw new Error(`baseline cache shard uses a different engine artifact`);
    }
    const runtime = (value: any): string => JSON.stringify({
      node: value.environment?.node,
      platform: value.environment?.platform,
      architecture: value.environment?.architecture,
    });
    if (runtime(archive) !== runtime(candidate.archive)) throw new Error(`baseline cache shard uses a different runtime platform`);
    // Runner fingerprints remain visible provenance, but an operational
    // harness change must not make cached baseline scores unusable for an
    // ordinary descriptive comparison. Suite, engine, runtime, schedule,
    // source scope, and every row checksum are still validated above.
    try {
      const approval = runnerCompatibilityApproval(
        archive.identity.implementationFingerprint,
        candidate.archive.identity.implementationFingerprint,
        identity.suiteFingerprint,
      );
      if (approval !== null && !approvals.some((entry) => JSON.stringify(entry) === JSON.stringify(approval))) approvals.push(approval);
    } catch {
      // No approval is required for the lean comparison path.
    }
    baseRuns.push(...toDecisionRuns(archive).filter((row) =>
      row.seedSlot < options.depth && budgetSet.has(row.budget)
    ));
  }
  const candidateRuns = toDecisionRuns(candidate.archive).filter((row) => budgetSet.has(row.budget));
  const result = pairedV2Decision(baseRuns, candidateRuns, suiteAtDepth(suite, options.depth, budgets), {
    profile: "canonical",
    mode: options.mode,
    margin: options.mode === "simplification" ? options.margin ?? undefined : undefined,
  });
  assertStoredHeadline(candidate.archive, result.candidateHeadline, "candidate");
  const manifestFingerprint = baselineCacheManifestFingerprint(cache.cache);
  const first = evidence[0].archive;
  const artifact: DecisionArtifact = {
    schema: DECISION_SCHEMA,
    generatedAt: new Date().toISOString(),
    decisionInferenceFingerprint: DECISION_INFERENCE_PROTOCOL_FINGERPRINT,
    decisionProtocolFingerprint: decisionProtocolFingerprint(),
    executionProtocol: BENCHMARK_EXECUTION_PROTOCOL,
    base: {
      path: relativeToCwd(cache.baselinePath),
      archiveSha256: manifestFingerprint,
      artifactSha256: manifestFingerprint,
      candidateFingerprint: cache.cache.candidateFingerprint,
      implementationFingerprint: first.identity.implementationFingerprint,
      headline: result.baseHeadline,
    },
    candidate: archiveReference(candidate),
    implementationFingerprintsMatch: evidence.every(({ archive }) =>
      archive.identity.implementationFingerprint === candidate.archive.identity.implementationFingerprint
    ),
    runnerCompatibilityApproval: approvals[0] ?? null,
    baselineCache: {
      manifestPath: relativeToCwd(cache.baselinePath),
      manifestFingerprint,
      coverageDepth: options.depth,
      budgets,
      shardRanges: evidence.map(({ shard }) => ({
        firstSeedSlot: shard.firstSeedSlot,
        endSeedSlotExclusive: shard.endSeedSlotExclusive,
      })),
      compatibilityApprovals: approvals,
    },
    result,
    hint: underPoweredHint(result, options.depth),
    nextCommand: nextCommandFor(result),
  };
  return { artifact, candidate };
}

export function assertComparisonRequestLink(
  archive: any,
  expected: {
    label: string;
    candidateFingerprint: string;
    requestPath: string;
    requestSha256: string;
    seedScheduleFingerprint: string;
    depth: number;
  },
): void {
  if (archive.git?.candidateFingerprint !== expected.candidateFingerprint) {
    throw new Error(`${expected.label} did not reproduce its frozen compiler snapshot identity`);
  }
  const link = archive.comparisonRequest;
  if (
    link === undefined || resolve(link.path) !== resolve(expected.requestPath) ||
    link.sha256 !== expected.requestSha256
  ) {
    throw new Error(`${expected.label} is not linked to the immutable comparison request`);
  }
  const schedule = archive.identity?.seedSchedule;
  if (sha256(JSON.stringify(schedule)) !== expected.seedScheduleFingerprint) {
    throw new Error(`${expected.label} did not run the requested seed schedule`);
  }
  if (schedule?.seedsPerBudget !== expected.depth) {
    throw new Error(`${expected.label} depth does not match the request`);
  }
}

async function validateComparison(
  base: VerifiedArchive,
  candidate: VerifiedArchive,
  purpose: "decision" | "calibration" = "decision",
  depthOverride?: number,
  explicitSchedule?: ResolvedSeedSchedule,
): Promise<{
  suite: ReturnType<typeof loadSuiteManifest>;
  baseRuns: DecisionRun[];
  candidateRuns: DecisionRun[];
  compatibilityApproval: RunnerCompatibilityApproval | null;
}> {
  const baseArchive = base.archive;
  const candidateArchive = candidate.archive;
  if (baseArchive?.exploration !== undefined || candidateArchive?.exploration !== undefined) {
    throw new Error(`exploration archives are descriptive only and cannot enter a decision`);
  }
  if (baseArchive.schema !== BENCHMARK_RUN_ARCHIVE_SCHEMA || candidateArchive.schema !== BENCHMARK_RUN_ARCHIVE_SCHEMA) {
    throw new Error(`decision requires ${BENCHMARK_RUN_ARCHIVE_SCHEMA} archives`);
  }
  if (baseArchive.mode !== "development" || candidateArchive.mode !== "development") {
    throw new Error(`decision requires development archives`);
  }
  if (baseArchive.profile !== candidateArchive.profile) throw new Error(`archives use different profiles`);
  if (purpose === "calibration" && baseArchive.profile !== "probe") {
    throw new Error(`retained empirical calibration controls must use probe archives`);
  }
  if (baseArchive.identity?.suiteFingerprint !== candidateArchive.identity?.suiteFingerprint) {
    throw new Error(`archives use different suite fingerprints`);
  }
  if (baseArchive.identity?.executionProtocol !== candidateArchive.identity?.executionProtocol) {
    throw new Error(`archives use different execution protocols`);
  }
  if (
    purpose === "calibration" &&
    baseArchive.identity?.executionPolicyFingerprint !== candidateArchive.identity?.executionPolicyFingerprint
  ) {
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
  const listeningReview = await loadListeningReview(
    "benchmark/v2/evidence/listening-review.json",
    identity.suiteFingerprint,
    identity.sourceManifestFingerprint,
    sources,
  );
  if (archiveProfile(candidateArchive) === "canonical") {
    requireApprovedListeningReview(listeningReview);
  }
  if (baseArchive.identity.suiteFingerprint !== identity.suiteFingerprint) {
    throw new Error(`archives do not match the current suite fingerprint`);
  }
  const contracts = new Map<string, AxisContract>();
  for (const source of sources) {
    const spec = applyJolt(await loadSourceSpec(source), suite.transform.jolt_ms);
    contracts.set(
      source.id,
      buildAxisContract(spec, source.eligibleComponents, source.diagnosticComponents),
    );
  }
  const requiredListeningReview = purpose === "decision" ? listeningReview.fingerprint : null;
  validateArchiveScope(
    baseArchive,
    suite,
    sources,
    contracts,
    requiredListeningReview,
    depthOverride,
    base.indexed,
    explicitSchedule,
    undefined,
    explicitSchedule?.byBudget.map((entry) => entry.budget),
  );
  validateArchiveScope(
    candidateArchive,
    suite,
    sources,
    contracts,
    requiredListeningReview,
    depthOverride,
    candidate.indexed,
    explicitSchedule,
    undefined,
    explicitSchedule?.byBudget.map((entry) => entry.budget),
  );
  validateCandidateIdentity(baseArchive);
  validateCandidateIdentity(candidateArchive);
  let compatibilityApproval: RunnerCompatibilityApproval | null = null;
  try {
    compatibilityApproval = runnerCompatibilityApproval(
      baseArchive.identity.implementationFingerprint,
      candidateArchive.identity.implementationFingerprint,
      identity.suiteFingerprint,
    );
  } catch {
    if (purpose === "calibration") throw new Error(`calibration archives require approved runner compatibility`);
  }
  return {
    suite,
    baseRuns: toDecisionRuns(baseArchive),
    candidateRuns: toDecisionRuns(candidateArchive),
    compatibilityApproval,
  };
}

function assertNotExplorationArchive(archive: any): void {
  if (archive?.exploration !== undefined) {
    throw new Error(`exploration archives are descriptive only and cannot enter a decision`);
  }
}

function validateArchiveScope(
  archive: any,
  suite: ReturnType<typeof loadSuiteManifest>,
  sources: ReturnType<typeof resolveSources>,
  contracts: Map<string, AxisContract>,
  listeningReviewFingerprint: string | null,
  depthOverride?: number,
  indexed = false,
  explicitSchedule?: ResolvedSeedSchedule,
  seedSlotRange?: { firstSeedSlot: number; endSeedSlotExclusive: number },
  expectedBudgets = suite.profiles[archiveProfile(archive)].budgets,
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
    listeningReviewFingerprint: archive.identity.listeningReviewFingerprint,
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
  if (
    listeningReviewFingerprint !== null &&
    archive.identity.listeningReviewFingerprint !== listeningReviewFingerprint
  ) {
    throw new Error(`archive listening-review evidence is stale`);
  }
  if (JSON.stringify(archive.identity.sources) !== JSON.stringify(expectedSources)) {
    throw new Error(`archive source identities do not match the current canonical sources`);
  }
  const customCanonicalSeedBase = profileName === "canonical" && archive.comparisonRequest !== undefined
    ? archive.identity?.seedSchedule?.seedBase
    : undefined;
  // A requested comparison depth replaces the manifest allocation; the caller
  // cross-checks the override against the immutable comparison request.
  if (depthOverride !== undefined && profileName !== "canonical") {
    throw new Error(`depth-parameterized scope validation applies to canonical archives only`);
  }
  const schedule = explicitSchedule ?? resolvedSeedSchedule(
    suite,
    profileName,
    expectedBudgets,
    depthOverride ?? profile.seeds_per_budget,
    customCanonicalSeedBase,
  );
  if (
    JSON.stringify(archive.identity.budgets) !== JSON.stringify(expectedBudgets) ||
    JSON.stringify(archive.identity.seedSchedule) !== JSON.stringify(schedule) ||
    JSON.stringify(archive.identity.transform) !== JSON.stringify(suite.transform)
  ) {
    throw new Error(`archive execution policy does not match the current suite profile`);
  }
  const firstSeedSlot = seedSlotRange?.firstSeedSlot ?? 0;
  const endSeedSlotExclusive = seedSlotRange?.endSeedSlotExclusive ?? schedule.seedsPerBudget;
  if (
    !Number.isSafeInteger(firstSeedSlot) || !Number.isSafeInteger(endSeedSlotExclusive) ||
    firstSeedSlot < 0 || endSeedSlotExclusive <= firstSeedSlot || endSeedSlotExclusive > schedule.seedsPerBudget
  ) throw new Error(`archive seed-slot range is invalid`);
  const expected = schedule.byBudget.flatMap(({ budget, actualSeeds }) =>
    actualSeeds.flatMap((actualSeed, seedSlot) =>
      seedSlot < firstSeedSlot || seedSlot >= endSeedSlotExclusive ? [] : canonicalMembers(suite).map((sourceId) =>
      `${sourceId}\0${budget}\0${seedSlot}\0${actualSeed}`
      )
    )
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
    const source = sources.find((entry) => entry.id === row.task.sourceId)!;
    if (
      row.source?.id !== source.id || row.source?.sourceFingerprint !== source.sourceFingerprint ||
      JSON.stringify(row.source?.eligibleComponents) !== JSON.stringify(source.eligibleComponents) ||
      JSON.stringify(row.source?.diagnosticComponents) !== JSON.stringify(source.diagnosticComponents)
    ) {
      throw new Error(`${row.task.sourceId}: archived run source identity is stale or incomplete`);
    }
    if (!Number.isSafeInteger(row.authoredContacts)) {
      throw new Error(`${row.task.sourceId}: archived authored-contact count is missing`);
    }
    if (indexed) {
      if (typeof row.rawReportSha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.rawReportSha256)) {
        throw new Error(`${row.task.sourceId}: decision index is not bound to its raw report`);
      }
    } else {
      if (row.report === null || typeof row.report !== "object") {
        throw new Error(`${row.task.sourceId}: archived raw report is missing`);
      }
      const rescored = scoreV2Report(
        row.report,
        row.authoredContacts,
        contracts.get(row.task.sourceId)!,
        suite,
      );
      if (JSON.stringify(rescored) !== JSON.stringify(row.score)) {
        throw new Error(`${row.task.sourceId}: stored score does not match its raw report and axis contract`);
      }
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

export function loadVerifiedArchive(path: string, expected?: RetainedReference): VerifiedArchive {
  const absolute = resolve(path);
  const artifactSha256 = sha256FileStreaming(absolute);
  const compressed = absolute.endsWith(".gz");
  const expectedArtifactSha = compressed ? expected?.compressed_archive_sha256 : expected?.archive_sha256;
  const sidecarSha = readSidecarSha(absolute);
  if (expectedArtifactSha === undefined && sidecarSha === undefined) {
    throw new Error(`${basename(absolute)}: missing SHA-256 integrity sidecar`);
  }
  for (const trusted of [expectedArtifactSha, sidecarSha]) {
    if (trusted !== undefined && trusted !== artifactSha256) {
      throw new Error(`${basename(absolute)}: archive checksum mismatch`);
    }
  }
  // Only an uncompressed archive can expose its embedded payload commitment
  // without inflating the complete raw evidence. Compressed historical or
  // standalone inputs deliberately use the full rescoring path below.
  const indexPath = compressed
    ? undefined
    : decisionIndexCandidates(absolute).find((candidate) => existsSync(candidate));
  if (indexPath !== undefined) {
    const indexBytes = readFileSync(indexPath);
    const indexSidecarSha = readSidecarSha(indexPath);
    if (indexSidecarSha === undefined || indexSidecarSha !== sha256(indexBytes)) {
      throw new Error(`${basename(indexPath)}: decision-index checksum mismatch or missing sidecar`);
    }
    const index = JSON.parse(indexBytes.toString("utf8"));
    if (
      index.schema !== "line.benchmark-v2.decision-index.v1" || typeof index.archiveSha256 !== "string" ||
      typeof index.payloadSha256 !== "string"
    ) {
      throw new Error(`${basename(indexPath)}: unsupported decision index`);
    }
    if (compressed ? index.compressedArchiveSha256 !== artifactSha256 : index.archiveSha256 !== artifactSha256) {
      throw new Error(`${basename(indexPath)}: decision index does not describe its archive`);
    }
    if (
      expected?.archive_sha256 !== undefined && expected.archive_sha256 !== index.archiveSha256 ||
      expected?.compressed_archive_sha256 !== undefined &&
        expected.compressed_archive_sha256 !== index.compressedArchiveSha256
    ) {
      throw new Error(`${basename(indexPath)}: decision index does not match the retained reference`);
    }
    const computedPayloadSha256 = sha256(JSON.stringify(index.archive));
    const rawPayloadSha256 = readRawDecisionIndexCommitment(absolute);
    if (computedPayloadSha256 !== index.payloadSha256 || rawPayloadSha256 !== index.payloadSha256) {
      throw new Error(`${basename(indexPath)}: decision index is detached from its raw archive`);
    }
    return {
      path: absolute,
      archive: index.archive,
      archiveSha256: index.archiveSha256,
      artifactSha256,
      compressed,
      indexed: true,
    };
  }
  const artifactBytes = readFileSync(absolute);
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
    indexed: false,
  };
}

function readRawDecisionIndexCommitment(path: string): string {
  const descriptor = openSync(path, "r");
  try {
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let prefix = "";
    let position = 0;
    while (position < 16 * 1024 * 1024) {
      const length = readSync(descriptor, buffer, 0, buffer.length, position);
      if (length === 0) break;
      position += length;
      prefix += buffer.subarray(0, length).toString("utf8");
      const match = prefix.match(/"decisionIndexPayloadSha256"\s*:\s*"([a-f0-9]{64})"/);
      if (match !== null) return match[1];
      if (/"runs"\s*:\s*\[/.test(prefix)) break;
    }
    throw new Error(`${basename(path)}: raw archive has no decision-index commitment before runs`);
  } finally {
    closeSync(descriptor);
  }
}

function sha256FileStreaming(path: string): string {
  const descriptor = openSync(path, "r");
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let position = 0;
    while (true) {
      const length = readSync(descriptor, buffer, 0, buffer.length, position);
      if (length === 0) break;
      hash.update(buffer.subarray(0, length));
      position += length;
    }
    return hash.digest("hex");
  } finally {
    closeSync(descriptor);
  }
}

function decisionIndexCandidates(archivePath: string): string[] {
  if (!archivePath.endsWith(".gz")) return [`${archivePath}.decision-index.json`];
  return [
    `${archivePath.slice(0, -3)}.decision-index.json`,
    `${archivePath.replace(/\.json\.gz$/, "")}.decision-index.json`,
  ];
}

function baselineArchive(profile: DecisionProfile): {
  path: string;
  expected: RetainedReference;
  label: string;
  reference: BaselineReference;
} {
  for (const [pendingPath, recovery] of [
    ["benchmark/v2/migration-pending.json", "rerun the migration command"],
    ["benchmark/v2/baseline-publication-pending.json", "rerun baseline or rebaseline"],
  ] as const) {
    if (existsSync(pendingPath)) {
      throw new Error(`baseline publication state is incomplete; ${recovery} before deciding`);
    }
  }
  const path = profile === "probe" ? DEFAULT_PROBE_BASELINE_PATH : DEFAULT_BASELINE_PATH;
  const baseline = JSON.parse(readFileSync(path, "utf8")) as BaselineReference;
  const schemaAllowed = profile === "probe"
    ? baseline.schema === PROBE_BASELINE_SCHEMA
    : baseline.schema === BASELINE_CACHE_REFERENCE_SCHEMA;
  if (
    !schemaAllowed || baseline.execution_protocol !== BENCHMARK_EXECUTION_PROTOCOL ||
    baseline.compiler_identity_protocol !== COMPILER_IDENTITY_PROTOCOL
  ) {
    throw new Error(`the frozen baseline predates the V2 decision protocol; establish a new baseline`);
  }
  if (
    profile === "canonical" &&
    (
      baseline.status !== "canonical-baseline" || baseline.listening_review_status !== "approved" ||
      !isSha256(baseline.decision_inference_fingerprint) || !isSha256(baseline.decision_protocol_fingerprint) ||
      !isSha256(baseline.decision_calibration_fingerprint)
    )
  ) {
    throw new Error(`canonical baseline is not approved or lacks its frozen decision contract`);
  }
  const expected = profile === "probe" ? baseline.probe : baseline.development;
  if (expected.compressed_archive === undefined || expected.compressed_archive_sha256 === undefined) {
    throw new Error(`frozen baseline archive reference is incomplete`);
  }
  return { path: resolve(expected.compressed_archive), expected, label: baseline.label, reference: baseline };
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
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

/**
 * Positive-but-unresolved verdicts get an indicative resolution estimate:
 * the seed depth at which an effect of the observed size would typically
 * clear the one-sided bound at 80% power. Output-only; no policy weight.
 */
export function underPoweredHint(result: V2Decision, seedsPerBudget: number): string | null {
  const unresolved = result.outcome === "unresolved" || result.outcome === "inconclusive";
  if (!result.uncertainty.seed.available) return null;
  const se = result.uncertainty.seed.standardError;
  const df = result.uncertainty.seed.degreesOfFreedom ?? Infinity;
  const distance = result.delta - result.threshold;
  if (!unresolved || distance <= 0 || se <= 0) return null;
  const requiredSe = distance / (studentTQuantile(1 - result.criticalAlpha, df) + 0.8416212335729143);
  const suggestedDepth = Math.ceil(seedsPerBudget * (se / requiredSe) ** 2);
  if (suggestedDepth <= seedsPerBudget) return null;
  return `delta ${formatSigned(result.delta)} is positive but under-powered at ${seedsPerBudget} seeds/budget; ` +
    `a comparison around ${suggestedDepth} seeds/budget may resolve it if the baseline cache covers that prefix`;
}

export function nextCommandFor(result: V2Decision): string {
  const modeFlags = result.mode === "simplification"
    ? ` --mode=simplify --margin=${result.margin}`
    : "";
  switch (result.outcome) {
    case "advance":
      return `npm run benchmark -- eval --seeds=100${modeFlags}`;
    case "accept":
      return `npm run benchmark -- rebaseline --from=COMPARISON --label=accepted-candidate`;
    case "unresolved":
    case "inconclusive":
      return result.authority === "screening"
        ? `npm run benchmark -- eval --seeds=100${modeFlags}`
        : `npm run benchmark -- eval --seeds=100${modeFlags}  # choose a larger N if needed`;
    default:
      return `npm run benchmark -- eval`;
  }
}

export function renderDecision(artifact: DecisionArtifact, outPath: string): string {
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
  const inferenceLines = central.available
    ? [
      `  ${(central.centralLevel * 100).toFixed(0)}% coverage-target seed-block interval ` +
        `(${(central.centralCriticalLevel * 100).toFixed(0)}% t critical): ` +
        `[${formatSigned(central.centralLo)}, ${formatSigned(central.centralHi)}]`,
      `  one-sided bounds: lower ${formatSigned(central.lowerBound)}, upper ${formatSigned(central.upperBound)}`,
      `  formal seed-block SE: ${result.uncertainty.seed.standardError.toFixed(2)} ` +
        `(df ${result.uncertainty.seed.degreesOfFreedom?.toFixed(1) ?? "infinite"})`,
    ]
    : [
      "  seed-block inference: unavailable (one seed block; descriptive diagnostic only)",
    ];
  const confidenceText = (confidence: V2Decision["confidence"]): string =>
    confidence.available
      ? `[${formatSigned(confidence.centralLo)}, ${formatSigned(confidence.centralHi)}]`
      : "[descriptive only]";
  const lines = [
    `Benchmark V2 decision - ${result.profile} ${result.authority}`,
    `  policy: ${result.mode}; ${thresholdText}; ${(central.oneSidedLevel * 100).toFixed(0)}% coverage target ` +
      `using a ${(central.oneSidedCriticalLevel * 100).toFixed(0)}% one-sided t critical`,
    `  headline: ${result.baseHeadline.toFixed(2)} -> ${result.candidateHeadline.toFixed(2)} ` +
      `(delta ${formatSigned(result.delta)})`,
    ...inferenceLines,
    `  sensitivity SE: crossed ${result.uncertainty.jointSensitivity.standardError.toFixed(2)}, ` +
      `catalog ${result.uncertainty.catalogSensitivity.standardError.toFixed(2)}`,
    `  validity: ${result.validity.baseValid}/${result.validity.total} -> ` +
      `${result.validity.candidateValid}/${result.validity.total} ` +
      `(gained ${result.validity.gained}, lost ${result.validity.lost})`,
    "  budgets (delta; stress-calibrated coverage-target interval):",
    ...result.perBudget.map((entry) =>
      `    ${(entry.budget / 1000).toFixed(0).padStart(4)}k  ${formatSigned(entry.delta)}  ` +
      `${confidenceText(entry.confidence)}  ` +
      `valid ${entry.baseValid}->${entry.candidateValid}/${entry.total}`
    ),
    "  strata (delta; stress-calibrated coverage-target interval):",
    ...result.perStratum.map((entry) =>
      `    ${entry.stratum.padEnd(20)} ${formatSigned(entry.delta)}  ` +
      confidenceText(entry.confidence)
    ),
    ...caseLines,
    `  OUTCOME: ${result.outcome.toUpperCase()}` +
      (result.authority === "screening" ? " (legacy probe-archive diagnostic)" : ""),
    ...(artifact.hint === null ? [] : [`  hint: ${artifact.hint}`]),
    `  artifact: ${relativeToCwd(outPath)}`,
    `  nextCommand: ${artifact.nextCommand}`,
  ];
  if (!artifact.implementationFingerprintsMatch) {
    lines.splice(
      lines.findIndex((line) => line.startsWith("  OUTCOME:")),
      0,
      artifact.runnerCompatibilityApproval === null
        ? `  runner provenance differs; execution identities are reported for review`
        : `  runner compatibility: approved by ${artifact.runnerCompatibilityApproval.reviewedBy}`,
    );
  }
  return lines.join("\n");
}

export function writeDecisionArtifact(path: string, artifact: DecisionArtifact): void {
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

/**
 * The frozen decision exit-code contract (protocol-fingerprinted):
 *   0 = favorable verdict (advance / accept)
 *   2 = unresolved or inconclusive (evidence did not resolve the question)
 *   3 = unfavorable verdict (stop / reject)
 *   1 = invalid invocation or integrity failure (thrown before any verdict)
 *   4 = reserved for the eval chain's futility stop (never emitted here)
 * Agents may branch on these codes without parsing output.
 */
export const DECISION_EXIT_CODES = Object.freeze({
  favorable: 0,
  invalid: 1,
  unresolved: 2,
  unfavorable: 3,
  futilityStop: 4,
} as const);

export function outcomeExitCode(outcome: V2Decision["outcome"]): number {
  if (outcome === "advance" || outcome === "accept") return DECISION_EXIT_CODES.favorable;
  if (outcome === "unresolved" || outcome === "inconclusive") return DECISION_EXIT_CODES.unresolved;
  return DECISION_EXIT_CODES.unfavorable;
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
    process.exitCode = await runDecisionCommand();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
