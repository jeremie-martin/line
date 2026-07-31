import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  readFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { EVALUATOR_FINGERPRINT } from "../golden_suite.ts";
import {
  BASELINE_CACHE_LADDER_SCHEMA,
  BASELINE_CACHE_SCHEMA,
  BASELINE_CACHE_SHARD_SCHEMA,
  CAMPAIGN_BASELINE_REFERENCE_SCHEMA,
} from "./baseline_cache.ts";
import {
  CAMPAIGN_BOOTSTRAP_REQUEST_SCHEMA,
  readCampaignBootstrapRequest,
  sha256,
  validateCampaignBootstrapRequest,
  type CampaignBootstrapRequest,
} from "./campaign_bootstrap_request.ts";
import { requireCurrentDecisionCalibration } from "./calibration_guard.ts";
import {
  createCompilerSnapshot,
  createSnapshotWorkspace,
  disposeSnapshotWorkspace,
  runInWorkspace,
  validateCompilerSnapshot,
} from "./compiler_snapshot.ts";
import {
  assertCompilerSourcesCommitted,
  compilerCandidateIdentity,
} from "./compiler_identity.ts";
import { loadVerifiedArchive } from "./decide.ts";
import { copyFileDurable, writeFileAtomicDurable } from "./durable_fs.ts";
import {
  summarizeDevelopmentBudget,
  type ScoredDevelopmentRun,
} from "./evaluator.ts";
import {
  loadSourceManifest,
  resolveSources,
} from "./model.ts";
import {
  loadSuiteManifest,
  suiteIdentity,
} from "./suite_model.ts";

const ACTIVE_CAMPAIGN_BASELINE = "benchmark/v2/campaign-baseline.json";
const SOURCE_MANIFEST = "benchmark/v2/compat/source-manifest.json";
const HELDOUT_MANIFEST = "benchmark/v2/compat/heldout-manifest.json";
const SUITE_MANIFEST = "benchmark/v2/compat/suite-manifest.json";
const REQUIRED_BUDGET = 750_000;
const REQUIRED_SEEDS = 48;
const REQUIRED_JOBS = 48;
const REQUIRED_CASES = 44;
const REQUIRED_COMPILES = REQUIRED_CASES * REQUIRED_SEEDS;
const REQUIRED_EVALUATOR = "07cf88383150";
const RESULT_SCHEMA = "line.benchmark-v2.campaign-bootstrap-result.v1" as const;

type BootstrapResult = {
  schema: typeof RESULT_SCHEMA;
  status: "complete";
  generatedAt: string;
  label: string;
  request: { path: string; sha256: string };
  scorerBoundary: {
    suiteFingerprint: string;
    scoringProtocolFingerprint: string;
    goldenEvaluatorFingerprint: string;
    crossRulerComparison: false;
  };
  development: {
    archive: string;
    archiveSha256: string;
    compressedArchive: string;
    compressedArchiveSha256: string;
    decisionIndex: string;
    decisionIndexSha256: string;
    summary: string;
    canonicalHeadline: number;
    validRuns: number;
    totalRuns: number;
  };
};

export async function runCampaignBootstrapCommand(argv = process.argv.slice(2)): Promise<number> {
  assertArguments(argv);
  if (process.env.LR_ENGINE !== "wasm") throw new Error(`campaign bootstrap requires LR_ENGINE=wasm`);
  const argument = (name: string): string | undefined =>
    argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const label = requiredArgument(argument("label"), "label");
  const safeLabel = safeName(label);
  if (safeLabel !== label) throw new Error(`campaign bootstrap label must already be filesystem-safe`);
  const requestPath = resolve(
    argument("request") ?? `benchmark/v2/runs/${safeLabel}-bootstrap-request.json`,
  );
  if (argv.includes("--publish")) {
    return publishCampaignBootstrap(requestPath);
  }

  const budget = exactInteger(argument("budget"), "budget", REQUIRED_BUDGET);
  const seeds = exactInteger(argument("seeds"), "seeds", REQUIRED_SEEDS);
  const jobs = exactInteger(argument("jobs"), "jobs", REQUIRED_JOBS);
  const outPath = resolve(
    argument("out") ?? `generated/benchmark-v2/bootstrap/${safeLabel}-development.json`,
  );
  const resume = argv.includes("--resume");
  mkdirSync(dirname(outPath), { recursive: true });
  mkdirSync(dirname(requestPath), { recursive: true });

  const { identity, sources, suite } = currentSuite();
  if (sources.length !== REQUIRED_CASES) {
    throw new Error(`campaign bootstrap requires ${REQUIRED_CASES} development cases, found ${sources.length}`);
  }
  if (EVALUATOR_FINGERPRINT !== REQUIRED_EVALUATOR) {
    throw new Error(`Golden evaluator fingerprint is ${EVALUATOR_FINGERPRINT}, expected ${REQUIRED_EVALUATOR}`);
  }
  assertCompilerSourcesCommitted();
  assertTrackedWorktreeCommitted();
  const current = compilerCandidateIdentity("wasm");
  if (current.engineArtifactFingerprint === null) throw new Error(`optimized WASM artifact is missing`);

  const request = resume
    ? readCampaignBootstrapRequest(requestPath)
    : createRequest({
      requestPath,
      outPath,
      label,
      budget,
      seeds,
      jobs,
      identity,
      sources: sources.length,
      candidateFingerprint: current.candidateFingerprint,
      engineArtifactFingerprint: current.engineArtifactFingerprint,
    });
  validateCampaignBootstrapRequest(request, {
    label,
    suiteFingerprint: identity.suiteFingerprint,
    scoringProtocolFingerprint: identity.scoringProtocolFingerprint,
    goldenEvaluatorFingerprint: EVALUATOR_FINGERPRINT,
    candidateFingerprint: current.candidateFingerprint,
    engineArtifactFingerprint: current.engineArtifactFingerprint,
    budgets: [budget],
    seedSchedule: request.canonicalSeedSchedule,
    developmentCases: sources.length,
    jobs,
  });
  if (resolve(request.outputPath) !== outPath) {
    throw new Error(`bootstrap request output does not match --out`);
  }

  let workspace: ReturnType<typeof createSnapshotWorkspace> | undefined;
  try {
    workspace = createSnapshotWorkspace(request.candidateSnapshot);
    const run = runInWorkspace(workspace, "development", [
      "--profile=canonical",
      ...runnerBaseArgs(jobs),
      `--bootstrap-request=${requestPath}`,
      `--canonical-seed-base=${request.canonicalSeedBase}`,
      `--seeds-per-budget=${seeds}`,
      `--comparison-budgets=${budget}`,
      `--seed-schedule=${requestPath}`,
      ...(resume ? ["--resume"] : []),
    ], outPath);
    if (run.workerFailures !== 0) {
      throw new Error(`campaign bootstrap has ${run.workerFailures} worker failures; resume the identical request`);
    }
    const result = retainAndValidate(requestPath, request, run.outputPath);
    console.log(`Campaign bootstrap complete: ${result.label}`);
    console.log(`  headline: ${result.development.canonicalHeadline.toFixed(4)}`);
    console.log(`  valid: ${result.development.validRuns}/${result.development.totalRuns}`);
    console.log(`  raw sha256: ${result.development.archiveSha256}`);
    console.log(`  gzip sha256: ${result.development.compressedArchiveSha256}`);
    console.log(`  result: ${relativeToCwd(resultPath(requestPath))}`);
    console.log(`  publication remains blocked until scorer-bound decision calibration is regenerated`);
    return 0;
  } finally {
    if (workspace !== undefined) disposeSnapshotWorkspace(workspace);
  }
}

function createRequest(input: {
  requestPath: string;
  outPath: string;
  label: string;
  budget: number;
  seeds: number;
  jobs: number;
  identity: ReturnType<typeof suiteIdentity>;
  sources: number;
  candidateFingerprint: string;
  engineArtifactFingerprint: string;
}): CampaignBootstrapRequest {
  if (existsSync(input.requestPath)) {
    throw new Error(`${relativeToCwd(input.requestPath)} already exists; pass --resume`);
  }
  const baselinePath = resolve(ACTIVE_CAMPAIGN_BASELINE);
  const baselineBytes = readFileSync(baselinePath);
  const baseline = JSON.parse(baselineBytes.toString("utf8"));
  const ladder = baseline.canonical_cache?.ladder;
  const sourceBudget = ladder?.byBudget?.find((entry: any) => entry.budget === input.budget);
  if (
    baseline.schema !== CAMPAIGN_BASELINE_REFERENCE_SCHEMA ||
    baseline.status !== "active-campaign-baseline" ||
    ladder?.profile !== "canonical" ||
    !Array.isArray(sourceBudget?.actualSeeds) ||
    sourceBudget.actualSeeds.length < input.seeds
  ) {
    throw new Error(`active campaign baseline does not contain the required literal seed schedule`);
  }
  const schedule = {
    kind: "profile_budget_disjoint_contiguous" as const,
    profile: "canonical" as const,
    seedBase: ladder.seedBase,
    seedsPerBudget: input.seeds,
    byBudget: [{
      budget: input.budget,
      actualSeeds: sourceBudget.actualSeeds.slice(0, input.seeds),
    }],
  };
  const expected = [
    16, 17, 18, 19, 20, 21, 22, 23,
    ...Array.from({ length: 40 }, (_, index) => 608 + index),
  ];
  if (JSON.stringify(schedule.byBudget[0].actualSeeds) !== JSON.stringify(expected)) {
    throw new Error(`active campaign baseline literal seed schedule is not 16..23 followed by 608..647`);
  }
  if (baseline.suite_fingerprint === input.identity.suiteFingerprint) {
    throw new Error(`campaign bootstrap requires a genuine scorer/suite identity boundary`);
  }
  const snapshot = createCompilerSnapshot(input.label, "benchmark/v2/runs");
  const request: CampaignBootstrapRequest = {
    schema: CAMPAIGN_BOOTSTRAP_REQUEST_SCHEMA,
    status: "authorized",
    purpose: "scorer-bound-active-campaign-baseline-bootstrap",
    generatedAt: new Date().toISOString(),
    label: input.label,
    sourceCampaignBaseline: {
      path: relativeToCwd(baselinePath),
      sha256: sha256(baselineBytes),
      label: baseline.label,
      suiteFingerprint: baseline.suite_fingerprint,
      use: "literal-seed-schedule-only",
    },
    scoringBoundary: {
      priorScorer: "net-redirection-arc",
      currentScorer: "accumulated-contacted-frame-impulse",
      goldenEvaluatorFingerprint: EVALUATOR_FINGERPRINT,
      suiteFingerprint: input.identity.suiteFingerprint,
      scoringProtocolFingerprint: input.identity.scoringProtocolFingerprint,
      crossRulerComparison: false,
    },
    authority: {
      profile: "canonical",
      mode: "development",
      budgets: [input.budget],
      seedsPerCase: input.seeds,
      developmentCases: input.sources,
      expectedPaidCompiles: input.sources * input.seeds,
      jobs: input.jobs,
      optimizedWasmOnly: true,
      ordinaryThreeBudgetWorkflow: false,
      deferredBudgetsRecomputed: false,
    },
    canonicalSeedBase: schedule.seedBase,
    seedScheduleFingerprint: sha256(JSON.stringify(schedule)),
    canonicalSeedSchedule: schedule,
    candidateFingerprint: input.candidateFingerprint,
    candidateSnapshot: snapshot,
    outputPath: relativeToCwd(input.outPath),
  };
  writeChecksummedJson(input.requestPath, request);
  return request;
}

function retainAndValidate(
  requestPath: string,
  request: CampaignBootstrapRequest,
  rawOutputPath: string,
): BootstrapResult {
  const retainedRaw = resolve(`benchmark/v2/runs/${request.label}-development.json`);
  const retainedGzip = `${retainedRaw}.gz`;
  const retainedIndex = `${retainedRaw}.decision-index.json`;
  const retainedSummary = resolve(`benchmark/v2/runs/${request.label}-development.summary.json`);
  const sourceIndex = `${rawOutputPath}.decision-index.json`;
  const sourceSummary = `${rawOutputPath}.summary.json`;
  for (const path of [
    rawOutputPath,
    `${rawOutputPath}.gz`,
    `${rawOutputPath}.sha256`,
    `${rawOutputPath}.gz.sha256`,
    sourceIndex,
    `${sourceIndex}.sha256`,
    sourceSummary,
  ]) {
    if (!existsSync(path)) throw new Error(`completed bootstrap is missing ${relativeToCwd(path)}`);
  }
  copyFileDurable(rawOutputPath, retainedRaw);
  copyFileDurable(`${rawOutputPath}.gz`, retainedGzip);
  copyFileDurable(sourceIndex, retainedIndex);
  copyFileDurable(`${sourceIndex}.sha256`, `${retainedIndex}.sha256`);

  const sourceSummaryValue = JSON.parse(readFileSync(sourceSummary, "utf8"));
  const rawSha256 = sha256File(retainedRaw);
  const compressedSha256 = sha256File(retainedGzip);
  if (
    rawSha256 !== sourceSummaryValue.archiveSha256 ||
    compressedSha256 !== sourceSummaryValue.compressedArchiveSha256
  ) throw new Error(`retained bootstrap archive checksums differ from the completed run`);
  writeFileAtomicDurable(
    `${retainedRaw}.sha256`,
    `${rawSha256}  ${relativeToCwd(retainedRaw)}\n`,
  );
  writeFileAtomicDurable(
    `${retainedGzip}.sha256`,
    `${compressedSha256}  ${relativeToCwd(retainedGzip)}\n`,
  );
  writeFileAtomicDurable(
    `${retainedGzip}.archive.sha256`,
    `${rawSha256}  ${relativeToCwd(retainedRaw)}\n`,
  );
  writeFileAtomicDurable(retainedSummary, `${JSON.stringify({
    ...sourceSummaryValue,
    archive: relativeToCwd(retainedRaw),
    compressedArchive: relativeToCwd(retainedGzip),
    retainedDecisionIndex: relativeToCwd(retainedIndex),
  }, null, 2)}\n`);

  const verified = loadVerifiedArchive(retainedRaw);
  const archive = verified.archive;
  const { identity, sources, suite } = currentSuite();
  validateCampaignBootstrapRequest(request, {
    label: request.label,
    suiteFingerprint: identity.suiteFingerprint,
    scoringProtocolFingerprint: identity.scoringProtocolFingerprint,
    goldenEvaluatorFingerprint: EVALUATOR_FINGERPRINT,
    candidateFingerprint: archive.git?.candidateFingerprint,
    engineArtifactFingerprint: archive.git?.engineArtifactFingerprint,
    budgets: [REQUIRED_BUDGET],
    seedSchedule: archive.identity?.seedSchedule,
    developmentCases: sources.length,
    jobs: request.authority.jobs,
  });
  if (
    archive.schema !== "line.benchmark-v2.run-archive.v5" ||
    archive.mode !== "development" ||
    archive.profile !== "canonical" ||
    archive.identity?.engine !== "wasm" ||
    archive.identity?.suiteFingerprint !== identity.suiteFingerprint ||
    archive.identity?.scoringProtocolFingerprint !== identity.scoringProtocolFingerprint ||
    JSON.stringify(archive.identity?.budgets) !== JSON.stringify([REQUIRED_BUDGET]) ||
    JSON.stringify(archive.identity?.seedSchedule) !== JSON.stringify(request.canonicalSeedSchedule) ||
    archive.bootstrapRequest?.sha256 !== sha256File(requestPath) ||
    archive.git?.candidateFingerprint !== request.candidateFingerprint ||
    archive.git?.engineArtifactFingerprint !== request.candidateSnapshot.engineArtifactFingerprint ||
    !Array.isArray(archive.runs) ||
    archive.runs.length !== REQUIRED_COMPILES ||
    archive.runs.some((row: any) => row.status !== "ok")
  ) {
    throw new Error(`completed bootstrap archive does not match the authorized scorer-bound request`);
  }
  const keys = new Set(archive.runs.map((row: any) =>
    `${row.task.sourceId}/${row.task.budget}/${row.task.seedSlot}/${row.task.actualSeed}`
  ));
  if (keys.size !== REQUIRED_COMPILES) throw new Error(`bootstrap archive has duplicate development rows`);
  const scoredRuns: ScoredDevelopmentRun[] = archive.runs.map((row: any) => ({
    sourceId: row.task.sourceId,
    budget: row.task.budget,
    seedSlot: row.task.seedSlot,
    actualSeed: row.task.actualSeed,
    score: row.score,
  }));
  const recomputed = summarizeDevelopmentBudget(scoredRuns, REQUIRED_BUDGET, suite);
  if (
    recomputed.totalRuns !== REQUIRED_COMPILES ||
    recomputed.validRuns !== REQUIRED_COMPILES ||
    recomputed.score !== archive.canonicalHeadline ||
    archive.developmentSummaries?.length !== 1 ||
    archive.developmentSummaries[0].score !== recomputed.score
  ) {
    throw new Error(`bootstrap headline, validity, or development scope did not recompute exactly`);
  }
  const result: BootstrapResult = {
    schema: RESULT_SCHEMA,
    status: "complete",
    generatedAt: new Date().toISOString(),
    label: request.label,
    request: { path: relativeToCwd(requestPath), sha256: sha256File(requestPath) },
    scorerBoundary: {
      suiteFingerprint: identity.suiteFingerprint,
      scoringProtocolFingerprint: identity.scoringProtocolFingerprint,
      goldenEvaluatorFingerprint: EVALUATOR_FINGERPRINT,
      crossRulerComparison: false,
    },
    development: {
      archive: relativeToCwd(retainedRaw),
      archiveSha256: rawSha256,
      compressedArchive: relativeToCwd(retainedGzip),
      compressedArchiveSha256: compressedSha256,
      decisionIndex: relativeToCwd(retainedIndex),
      decisionIndexSha256: sha256File(retainedIndex),
      summary: relativeToCwd(retainedSummary),
      canonicalHeadline: recomputed.score,
      validRuns: recomputed.validRuns,
      totalRuns: recomputed.totalRuns,
    },
  };
  writeChecksummedJson(resultPath(requestPath), result);
  return result;
}

function publishCampaignBootstrap(requestPath: string): number {
  const request = readChecksummedJson<CampaignBootstrapRequest>(requestPath);
  const result = readChecksummedJson<BootstrapResult>(resultPath(requestPath));
  if (
    result.schema !== RESULT_SCHEMA ||
    result.status !== "complete" ||
    result.label !== request.label ||
    result.request.sha256 !== sha256File(requestPath)
  ) throw new Error(`campaign bootstrap result does not match its authorized request`);
  validateCompilerSnapshot(request.candidateSnapshot);
  assertCompilerSourcesCommitted();
  const { identity, sources } = currentSuite();
  const current = compilerCandidateIdentity("wasm");
  validateCampaignBootstrapRequest(request, {
    label: request.label,
    suiteFingerprint: identity.suiteFingerprint,
    scoringProtocolFingerprint: identity.scoringProtocolFingerprint,
    goldenEvaluatorFingerprint: EVALUATOR_FINGERPRINT,
    candidateFingerprint: current.candidateFingerprint,
    engineArtifactFingerprint: current.engineArtifactFingerprint,
    budgets: [REQUIRED_BUDGET],
    seedSchedule: request.canonicalSeedSchedule,
    developmentCases: sources.length,
    jobs: REQUIRED_JOBS,
  });
  const decision = requireCurrentDecisionCalibration(identity.suiteFingerprint);
  const verified = loadVerifiedArchive(resolve(result.development.archive));
  const archive = verified.archive;
  if (
    verified.archiveSha256 !== result.development.archiveSha256 ||
    sha256File(resolve(result.development.compressedArchive)) !==
      result.development.compressedArchiveSha256 ||
    archive.canonicalHeadline !== result.development.canonicalHeadline ||
    archive.runs.length !== REQUIRED_COMPILES ||
    archive.runs.some((row: any) => row.status !== "ok") ||
    JSON.stringify(archive.identity.seedSchedule) !==
      JSON.stringify(request.canonicalSeedSchedule)
  ) throw new Error(`retained bootstrap evidence failed publication validation`);
  const budgetSummary = archive.developmentSummaries[0];
  const schedule = request.canonicalSeedSchedule;
  const campaign = {
    schema: CAMPAIGN_BASELINE_REFERENCE_SCHEMA,
    status: "active-campaign-baseline",
    label: request.label,
    generated_at: new Date().toISOString(),
    scope: {
      profile: "canonical",
      budgets: [REQUIRED_BUDGET],
      seeds: REQUIRED_SEEDS,
      target_headline: 650,
      deferred_budgets: [250_000, 500_000],
      compiler_scale_contract:
        "Compiler mechanisms must remain continuous and meaningful beyond the measured budget, including 150k and 1M-3M; benchmark budget identity must not enter compiler behavior.",
    },
    catalog_fingerprint: JSON.parse(readFileSync("benchmark/v2/catalog.lock.json", "utf8")).fingerprint,
    suite_fingerprint: identity.suiteFingerprint,
    scoring_protocol_fingerprint: identity.scoringProtocolFingerprint,
    golden_evaluator_fingerprint: EVALUATOR_FINGERPRINT,
    execution_protocol: archive.identity.executionProtocol,
    listening_review_fingerprint: archive.identity.listeningReviewFingerprint,
    listening_review_status: archive.identity.listeningReviewStatus,
    engine: archive.identity.engine,
    compiler_identity_protocol: archive.git.compilerIdentityProtocol,
    compiler_source_fingerprint: archive.git.compilerSourceFingerprint,
    compiler_source_files: archive.git.compilerSourceFiles,
    compiler_environment: archive.git.compilerEnvironment,
    engine_artifact_fingerprint: archive.git.engineArtifactFingerprint,
    candidate_fingerprint: archive.git.candidateFingerprint,
    decision_inference_fingerprint: decision.inferenceFingerprint,
    decision_protocol_fingerprint: decision.protocolFingerprint,
    decision_calibration_fingerprint: decision.calibrationFingerprint,
    compiler_snapshot: request.candidateSnapshot,
    development: {
      execution_policy_fingerprint: archive.identity.executionPolicyFingerprint,
      implementation_fingerprint: archive.identity.implementationFingerprint,
      archive_sha256: result.development.archiveSha256,
      compressed_archive: result.development.compressedArchive,
      compressed_archive_sha256: result.development.compressedArchiveSha256,
      canonical_headline: result.development.canonicalHeadline,
      seed_schedule: schedule,
      budgets: [{
        budget: REQUIRED_BUDGET,
        score: budgetSummary.score,
        valid_runs: budgetSummary.validRuns,
        total_runs: budgetSummary.totalRuns,
      }],
    },
    canonical_cache: {
      schema: BASELINE_CACHE_SCHEMA,
      baselineLabel: request.label,
      candidateFingerprint: archive.git.candidateFingerprint,
      suiteFingerprint: identity.suiteFingerprint,
      ladder: {
        schema: BASELINE_CACHE_LADDER_SCHEMA,
        profile: "canonical",
        seedBase: schedule.seedBase,
        maximumSeedsPerBudget: REQUIRED_SEEDS,
        byBudget: schedule.byBudget,
      },
      shards: [{
        schema: BASELINE_CACHE_SHARD_SCHEMA,
        firstSeedSlot: 0,
        endSeedSlotExclusive: REQUIRED_SEEDS,
        archive: result.development.archive,
        archiveSha256: result.development.archiveSha256,
        compressedArchive: result.development.compressedArchive,
        compressedArchiveSha256: result.development.compressedArchiveSha256,
        executionPolicyFingerprint: archive.identity.executionPolicyFingerprint,
        implementationFingerprint: archive.identity.implementationFingerprint,
      }],
    },
    scorer_bound_bootstrap: {
      request: result.request.path,
      request_sha256: result.request.sha256,
      result: relativeToCwd(resultPath(requestPath)),
      result_sha256: sha256File(resultPath(requestPath)),
      prior_scorer: request.scoringBoundary.priorScorer,
      current_scorer: request.scoringBoundary.currentScorer,
      cross_ruler_comparison: false,
      old_baseline_delta_reported: false,
      used_prior_baseline_for: "literal-seed-schedule-only",
    },
    monitoring: {
      qualification:
        "not run for this scorer-bound 750k development bootstrap; the deferred 250k/500k evidence remains unchanged",
    },
  };
  writeFileAtomicDurable(ACTIVE_CAMPAIGN_BASELINE, `${JSON.stringify(campaign, null, 2)}\n`);
  console.log(`Published scorer-bound active campaign baseline ${request.label}`);
  console.log(`  headline: ${result.development.canonicalHeadline.toFixed(4)}`);
  console.log(`  valid: ${result.development.validRuns}/${result.development.totalRuns}`);
  console.log(`  no cross-ruler comparison or old-baseline delta was computed`);
  return 0;
}

function currentSuite() {
  const sources = resolveSources(loadSourceManifest(SOURCE_MANIFEST));
  const suite = loadSuiteManifest(SUITE_MANIFEST, sources);
  const identity = suiteIdentity(SUITE_MANIFEST, SOURCE_MANIFEST, sources);
  return { identity, sources, suite };
}

function runnerBaseArgs(jobs: number): string[] {
  return [
    `--manifest=${resolve(SOURCE_MANIFEST)}`,
    `--heldout-manifest=${resolve(HELDOUT_MANIFEST)}`,
    `--suite=${resolve(SUITE_MANIFEST)}`,
    `--characterization=${resolve("benchmark/v2/evidence/characterization.json")}`,
    `--audit=${resolve("benchmark/v2/evidence/audit.json")}`,
    `--review=${resolve("benchmark/v2/evidence/candidate-review.json")}`,
    `--listening-review=${resolve("benchmark/v2/evidence/listening-review.json")}`,
    `--jobs=${jobs}`,
  ];
}

function assertArguments(argv: string[]): void {
  const booleans = new Set(["resume", "publish"]);
  const values = new Set(["label", "budget", "seeds", "jobs", "out", "request"]);
  for (const arg of argv) {
    if (!arg.startsWith("--")) throw new Error(`campaign bootstrap does not accept positional argument ${arg}`);
    const equals = arg.indexOf("=");
    const name = arg.slice(2, equals === -1 ? undefined : equals);
    if (equals === -1 && booleans.has(name)) continue;
    if (equals !== -1 && values.has(name) && arg.slice(equals + 1) !== "") continue;
    throw new Error(`unsupported campaign bootstrap flag ${arg}`);
  }
}

function assertTrackedWorktreeCommitted(): void {
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
    encoding: "utf8",
  }).trim();
  if (dirty !== "") throw new Error(`all tracked source/governance changes must be committed before campaign bootstrap`);
}

function exactInteger(raw: string | undefined, name: string, expected: number): number {
  if (raw === undefined || !/^\d+$/.test(raw) || Number(raw) !== expected) {
    throw new Error(`campaign bootstrap requires explicit --${name}=${expected}`);
  }
  return expected;
}

function requiredArgument(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === "") throw new Error(`campaign bootstrap requires --${name}=VALUE`);
  return value;
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, "-");
}

function resultPath(requestPath: string): string {
  return requestPath.replace(/-bootstrap-request\.json$/, "-bootstrap-result.json");
}

function writeChecksummedJson(path: string, value: unknown): void {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  writeFileAtomicDurable(path, bytes);
  writeFileAtomicDurable(`${path}.sha256`, `${sha256(bytes)}  ${relativeToCwd(path)}\n`);
}

function readChecksummedJson<T>(path: string): T {
  const bytes = readFileSync(path);
  const sidecar = readFileSync(`${path}.sha256`, "utf8").trim().split(/\s+/)[0];
  if (sidecar !== sha256(bytes)) throw new Error(`${basename(path)} checksum mismatch`);
  return JSON.parse(bytes.toString("utf8")) as T;
}

function sha256File(path: string): string {
  const descriptor = openSync(path, "r");
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const length = readSync(descriptor, buffer, 0, buffer.length, null);
      if (length === 0) break;
      hash.update(buffer.subarray(0, length));
    }
    return hash.digest("hex");
  } finally {
    closeSync(descriptor);
  }
}

function relativeToCwd(path: string): string {
  const absolute = resolve(path);
  const prefix = `${process.cwd()}/`;
  return absolute.startsWith(prefix) ? absolute.slice(prefix.length) : absolute;
}
