import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { availableParallelism, arch, cpus, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { applyJolt } from "../../produce/seed.ts";
import { compilerWorkerTimeoutMs } from "../golden_suite.ts";
import { compileHandoff } from "../optimizer/handoff.ts";
import type { CompileStats, DriftReport, Spec } from "../types.ts";
import type { CompileBudgetTelemetry } from "../optimizer/budget_telemetry.ts";
import {
  BENCHMARK_EXECUTION_PROTOCOL,
  BENCHMARK_RUN_ARCHIVE_SCHEMA,
  COMPILER_IDENTITY_PROTOCOL,
} from "../../../benchmark/v2/decision-policy.ts";
import {
  auditDataFingerprint,
  auditRuleFingerprint,
  buildAuditReport,
  type AuditReport,
} from "./audit_model.ts";
import {
  buildAxisContract,
  scoreV2Report,
  summarizeDevelopmentBudget,
  summarizeQualificationBudget,
  weightedBudgetHeadline,
  type AxisContract,
  type ScoredDevelopmentRun,
  type V2RunScore,
} from "./evaluator.ts";
import {
  assertNoHeldoutIdentity,
  characterizationDataFingerprint,
  loadHeldoutManifest,
  loadSourceManifest,
  loadSourceSpec,
  resolveHeldoutSources,
  resolveSources,
  type CharacterizationReport,
  type ResolvedSource,
} from "./model.ts";
import {
  loadListeningReview,
  requireApprovedListeningReview,
} from "./listening_review.ts";
import {
  RUNNER_IMPLEMENTATION_SOURCE_FILES,
  canonicalMembers,
  executionPolicyIdentity,
  fingerprintFiles,
  loadSuiteManifest,
  resolvedSeedSchedule,
  sourceInventoryFingerprint,
  suiteIdentity,
  type ResolvedSeedSchedule,
} from "./suite_model.ts";
import { compilerCandidateIdentity } from "./compiler_identity.ts";
import { latestSuccessfulResults } from "./checkpoint_model.ts";
import { syncFile, writeFileAtomicDurable } from "./durable_fs.ts";
import {
  loadRoundProgressReference,
  renderRoundProgress,
  roundProgressLog,
  RoundProgressAccumulator,
} from "./round_progress.ts";
import {
  readCampaignBootstrapRequest,
  validateCampaignBootstrapRequest,
} from "./campaign_bootstrap_request.ts";
import { EVALUATOR_FINGERPRINT } from "../golden_suite.ts";

export const RUN_ARCHIVE_SCHEMA = BENCHMARK_RUN_ARCHIVE_SCHEMA;
export { COMPILER_IDENTITY_PROTOCOL };
const CHECKPOINT_SCHEMA = "line.benchmark-v2.checkpoint.v1" as const;
const SUMMARY_SCHEMA = "line.benchmark-v2.run-summary.v3" as const;
export const DECISION_INDEX_SCHEMA = "line.benchmark-v2.decision-index.v1" as const;
const PARTIAL_RUN_SCHEMA = "line.benchmark-v2.partial-run.v1" as const;
/** At this scale keeping every raw report in arrays at once is needlessly
 * fragile. Larger confirmations assemble their archive directly from the
 * resumable checkpoint, while retaining the small decision projection. */
const STREAMING_ARCHIVE_TASK_THRESHOLD = 20_000;

type RunnerMode = "development" | "qualification";

export type WorkerTask = {
  mode: RunnerMode;
  sourceId: string;
  budget: number;
  seedSlot: number;
  actualSeed: number;
  joltMs: number;
  sourceManifestPath: string;
  heldoutManifestPath: string;
};

type WorkerSuccess = {
  status: "ok";
  task: WorkerTask;
  elapsedMs: number;
  report: DriftReport;
  stats: CompileStats;
  budgetTelemetry: CompileBudgetTelemetry | null;
  trackHash: string;
  authoredContacts: number;
};

type WorkerFailure = {
  status: "error" | "timeout";
  task: WorkerTask;
  elapsedMs: number;
  error: string;
  authoredContacts: number;
};

export type WorkerResult = WorkerSuccess | WorkerFailure;

export type CompletedBenchmarkRun = {
  mode: RunnerMode;
  outputPath: string;
  summaryPath: string;
  decisionIndexPath?: string;
  archiveSha256: string;
  compressedArchiveSha256: string;
  headline: number | null;
  qualificationMonitorScore: number | null;
  workerFailures: number;
  partialThroughSeedSlot?: number;
};

export async function runBenchmarkV2(
  mode: RunnerMode,
  argv = process.argv.slice(2),
): Promise<CompletedBenchmarkRun> {
  const argument = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  };
  const hasFlag = (name: string): boolean => argv.includes(`--${name}`);
  const sourceManifestPath = resolve(argument("manifest") ?? "benchmark/v2/compat/source-manifest.json");
  const heldoutManifestPath = resolve(argument("heldout-manifest") ?? "benchmark/v2/compat/heldout-manifest.json");
  const suiteManifestPath = resolve(argument("suite") ?? "benchmark/v2/compat/suite-manifest.json");
  const characterizationPath = resolve(argument("characterization") ?? "benchmark/v2/evidence/characterization.json");
  const auditPath = resolve(argument("audit") ?? "benchmark/v2/evidence/audit.json");
  const reviewPath = resolve(argument("review") ?? "benchmark/v2/evidence/candidate-review.json");
  const listeningReviewPath = resolve(
    argument("listening-review") ?? "benchmark/v2/evidence/listening-review.json",
  );
  const profileName = (argument("profile") ?? "probe") as "probe" | "canonical";
  if (profileName !== "probe" && profileName !== "canonical") {
    throw new Error(`--profile must be probe or canonical`);
  }
  const jobs = positiveInteger(
    argument("jobs") ?? String(Math.max(1, Math.floor(availableParallelism() / 2))),
    "jobs",
  );
  const outputPath = resolve(argument("out") ?? defaultOutput(mode, profileName));
  const checkpointPath = resolve(argument("checkpoint") ?? `${outputPath}.checkpoint.jsonl`);
  const linkedDevelopmentPath = argument("development-archive") === undefined
    ? undefined
    : resolve(argument("development-archive")!);
  const comparisonRequestPath = argument("comparison-request") === undefined
    ? undefined
    : resolve(argument("comparison-request")!);
  const bootstrapRequestPath = argument("bootstrap-request") === undefined
    ? undefined
    : resolve(argument("bootstrap-request")!);
  const roundProgressReferencePath = argument("round-progress-reference") === undefined
    ? undefined
    : resolve(argument("round-progress-reference")!);
  const roundProgressOutputPath = argument("round-progress-out") === undefined
    ? undefined
    : resolve(argument("round-progress-out")!);
  if (comparisonRequestPath !== undefined && bootstrapRequestPath !== undefined) {
    throw new Error(`--comparison-request and --bootstrap-request are mutually exclusive`);
  }
  if ((roundProgressReferencePath === undefined) !== (roundProgressOutputPath === undefined)) {
    throw new Error(`--round-progress-reference and --round-progress-out must be supplied together`);
  }
  const hasCanonicalRequest =
    comparisonRequestPath !== undefined || bootstrapRequestPath !== undefined;
  /** A cache shard is a canonical run over a contiguous seed-slot tail of the
   * frozen baseline.  It is deliberately distinct from a confirmation: it
   * never carries a candidate verdict and is only admitted through the
   * baseline-cache manifest validator. */
  const baselineCacheShard = hasFlag("baseline-cache-shard");
  const finalizePrefix = hasFlag("finalize-prefix");
  const exploration = hasFlag("exploration");
  const explorationId = argument("exploration-id");
  const canonicalSeedBaseOverride = argument("canonical-seed-base") === undefined
    ? undefined
    : nonNegativeInteger(argument("canonical-seed-base")!, "canonical-seed-base");
  if (
    canonicalSeedBaseOverride !== undefined &&
    (profileName !== "canonical" || (!hasCanonicalRequest && !baselineCacheShard))
  ) {
    throw new Error(`--canonical-seed-base requires a canonical comparison request or baseline-cache shard`);
  }
  const confirmationSeedsPerBudgetOverride = argument("seeds-per-budget") === undefined
    ? undefined
    : Number(argument("seeds-per-budget"));
  const explorationSeedBase = argument("exploration-seed-base") === undefined
    ? undefined
    : nonNegativeInteger(argument("exploration-seed-base")!, "exploration-seed-base");
  const explorationSeedsPerBudget = argument("exploration-seeds-per-budget") === undefined
    ? undefined
    : Number(argument("exploration-seeds-per-budget"));
  const explorationBudgets = argument("exploration-budgets") === undefined
    ? undefined
    : budgetList(argument("exploration-budgets")!, "exploration-budgets");
  const comparisonBudgets = argument("comparison-budgets") === undefined
    ? undefined
    : budgetList(argument("comparison-budgets")!, "comparison-budgets");
  const throughSeedSlot = argument("through-seed-slot") === undefined
    ? undefined
    : Number(argument("through-seed-slot"));
  const fromSeedSlot = argument("from-seed-slot") === undefined
    ? undefined
    : Number(argument("from-seed-slot"));
  const explicitSeedSchedulePath = argument("seed-schedule") === undefined
    ? undefined
    : resolve(argument("seed-schedule")!);
  validateExplorationFlags({
    exploration,
    explorationId,
    mode,
    profileName,
    hasDeclaration: hasCanonicalRequest,
    baselineCacheShard,
    canonicalSeedBaseOverride,
    confirmationSeedsPerBudgetOverride,
    explorationSeedBase,
    explorationSeedsPerBudget,
    explorationBudgets,
    throughSeedSlot,
    fromSeedSlot,
    explicitSeedSchedulePath,
  });
  if (
    explicitSeedSchedulePath !== undefined &&
    (profileName !== "canonical" || (!hasCanonicalRequest && !baselineCacheShard))
  ) {
    throw new Error(`--seed-schedule requires a canonical comparison request or baseline-cache shard`);
  }

  const sourceManifestContents = readFileSync(sourceManifestPath, "utf8");
  const heldoutManifestContents = readFileSync(heldoutManifestPath, "utf8");
  const sourceManifest = loadSourceManifest(sourceManifestPath);
  const heldoutManifest = loadHeldoutManifest(heldoutManifestPath);
  const developmentSources = resolveSources(sourceManifest);
  const qualificationSources = resolveHeldoutSources(heldoutManifest);
  assertNoHeldoutIdentity(developmentSources, qualificationSources);
  const suite = loadSuiteManifest(suiteManifestPath, developmentSources);
  const characterization = JSON.parse(readFileSync(characterizationPath, "utf8")) as CharacterizationReport;
  const audit = JSON.parse(readFileSync(auditPath, "utf8")) as AuditReport;
  const reviewContents = readFileSync(reviewPath, "utf8");
  const review = JSON.parse(reviewContents) as SelectionReview;
  validateEvidence(
    characterization,
    audit,
    sourceManifestContents,
    heldoutManifestContents,
    developmentSources,
    qualificationSources,
  );
  validateSelectionReview(review, characterization, audit, suite);

  const suiteId = suiteIdentity(suiteManifestPath, sourceManifestPath, developmentSources);
  const listeningReview = await loadListeningReview(
    listeningReviewPath,
    suiteId.suiteFingerprint,
    suiteId.sourceManifestFingerprint,
    developmentSources,
  );
  if (profileName === "canonical") requireApprovedListeningReview(listeningReview);
  const profile = suite.profiles[profileName];
  if (comparisonBudgets !== undefined) {
    if (
      !hasCanonicalRequest || baselineCacheShard || exploration ||
      profileName !== "canonical" || mode !== "development"
    ) {
      throw new Error(`--comparison-budgets requires a canonical development comparison request`);
    }
    const canonical = suite.profiles.canonical.budgets;
    if (
      comparisonBudgets.some((budget) => !canonical.includes(budget)) ||
      comparisonBudgets.some((budget, index) =>
        index > 0 && canonical.indexOf(comparisonBudgets[index - 1]) >= canonical.indexOf(budget)
      )
    ) {
      throw new Error(`--comparison-budgets must be an ordered subset of the canonical budget ladder`);
    }
  }
  // An exploration may intentionally use the full canonical budget ladder
  // without becoming a canonical evaluation: it remains development-only,
  // uses fresh exploration seeds, and cannot enter the decision machinery.
  // Keep this deliberately narrow so arbitrary budget studies continue to use
  // scale_study.ts rather than silently changing V2 semantics here.
  if (
    explorationBudgets !== undefined &&
    !sameBudgetLadder(explorationBudgets, suite.profiles.canonical.budgets)
  ) {
    throw new Error(
      `--exploration-budgets must equal the canonical ladder ` +
      `${suite.profiles.canonical.budgets.join(",")}`,
    );
  }
  const effectiveBudgets = comparisonBudgets ?? explorationBudgets ?? profile.budgets;
  const effectiveSeedsPerBudget = explorationSeedsPerBudget ?? confirmationSeedsPerBudgetOverride ?? profile.seeds_per_budget;
  if (!exploration) {
    validateSubsetFlags({
      profileName,
      hasDeclaration: hasCanonicalRequest,
      baselineCacheShard,
      seedsPerBudget: confirmationSeedsPerBudgetOverride,
      throughSeedSlot,
      fromSeedSlot,
      effectiveDepth: effectiveSeedsPerBudget,
    });
  }
  const sources = mode === "qualification" ? qualificationSources : developmentSources;
  if (mode === "development") {
    const selected = canonicalMembers(suite);
    if (selected.length !== sources.length || selected.some((id) => !sources.some((source) => source.id === id))) {
      throw new Error(`development source scope does not match the canonical suite`);
    }
  }
  const schedule = explicitSeedSchedulePath === undefined
    ? resolvedSeedSchedule(
      suite,
      profileName,
      effectiveBudgets,
      effectiveSeedsPerBudget,
      explorationSeedBase ?? canonicalSeedBaseOverride,
    )
    : loadExplicitSeedSchedule(
      explicitSeedSchedulePath,
      profileName,
      effectiveBudgets,
      effectiveSeedsPerBudget,
      canonicalSeedBaseOverride,
    );
  validateFinalizePrefixFlags({
    finalizePrefix,
    throughSeedSlot,
    effectiveDepth: effectiveSeedsPerBudget,
    hasComparisonRequest: comparisonRequestPath !== undefined,
    baselineCacheShard,
    exploration,
    profileName,
    mode,
  });
  if (exploration) {
    const actualSeeds = schedule.byBudget.flatMap((entry) => entry.actualSeeds);
    if (actualSeeds.some((seed) => seed < 3_000_000_000 || seed >= 4_000_000_000)) {
      throw new Error(`exploration seed schedule exceeds its reserved [3000000000, 4000000000) range`);
    }
  }
  const engine = process.env.LR_ENGINE ?? "typescript";
  const implementationFingerprint = fingerprintFiles(RUNNER_IMPLEMENTATION_SOURCE_FILES);
  const executionInput = {
    suiteFingerprint: suiteId.suiteFingerprint,
    executionProtocol: BENCHMARK_EXECUTION_PROTOCOL,
    listeningReviewFingerprint: listeningReview.fingerprint,
    implementationFingerprint,
    engine,
    compiler: "compileHandoff",
    profile: profileName,
    budgets: [...effectiveBudgets],
    seedSchedule: schedule,
    sources: sources.map((source) => ({
      id: source.id,
      role: source.role,
      sourceFingerprint: source.sourceFingerprint,
    })),
    transform: suite.transform,
  };
  const execution = executionPolicyIdentity(executionInput);
  const measuredDepth = throughSeedSlot ?? effectiveSeedsPerBudget;
  const measuredSchedule = seedSchedulePrefix(schedule, measuredDepth);
  const measuredExecution = measuredDepth === effectiveSeedsPerBudget
    ? execution
    : executionPolicyIdentity({ ...executionInput, seedSchedule: measuredSchedule });
  const git = compilerCandidateIdentity(engine);
  if (roundProgressReferencePath !== undefined && (
    comparisonRequestPath === undefined || !finalizePrefix || mode !== "development" ||
    profileName !== "canonical" || throughSeedSlot === undefined || baselineCacheShard || exploration
  )) {
    throw new Error(`round progress is reserved for a governed canonical comparison wave`);
  }
  const roundProgressReference = roundProgressReferencePath === undefined
    ? undefined
    : loadRoundProgressReference(roundProgressReferencePath, suite, {
      candidateFingerprint: git.candidateFingerprint,
      suiteFingerprint: suiteId.suiteFingerprint,
      seedScheduleFingerprint: sha256(JSON.stringify(schedule)),
      maximumDepth: effectiveSeedsPerBudget,
      throughDepth: measuredDepth,
      budgets: effectiveBudgets,
      sources: sources.map((source) => source.id),
    });
  if (bootstrapRequestPath !== undefined) {
    validateCampaignBootstrapRequest(
      readCampaignBootstrapRequest(bootstrapRequestPath),
      {
        suiteFingerprint: suiteId.suiteFingerprint,
        scoringProtocolFingerprint: suiteId.scoringProtocolFingerprint,
        goldenEvaluatorFingerprint: EVALUATOR_FINGERPRINT,
        candidateFingerprint: git.candidateFingerprint,
        engineArtifactFingerprint: git.engineArtifactFingerprint,
        budgets: [...effectiveBudgets],
        seedSchedule: schedule,
        developmentCases: developmentSources.length,
        jobs,
      },
    );
  }
  const runtime = {
    node: process.version,
    platform: platform(),
    architecture: arch(),
  };
  const linkedDevelopment = linkedDevelopmentPath === undefined
    ? undefined
    : archiveLink(linkedDevelopmentPath);
  const comparisonRequest = comparisonRequestPath === undefined
    ? undefined
    : archiveLink(comparisonRequestPath);
  const bootstrapRequest = bootstrapRequestPath === undefined
    ? undefined
    : archiveLink(bootstrapRequestPath);
  if (mode === "qualification" && linkedDevelopment === undefined) {
    throw new Error(`qualification execution requires --development-archive=<frozen canonical archive>`);
  }

  const sourceSpecs = new Map<string, Spec>();
  const contracts = new Map<string, AxisContract>();
  for (const source of sources) {
    const transformed = applyJolt(await loadSourceSpec(source), suite.transform.jolt_ms);
    sourceSpecs.set(source.id, transformed);
    contracts.set(
      source.id,
      buildAxisContract(transformed, source.eligibleComponents, source.diagnosticComponents),
    );
  }

  const tasks = buildWorkerTasks(
    schedule,
    sources,
    mode,
    suite.transform.jolt_ms,
    { sourceManifestPath, heldoutManifestPath },
    throughSeedSlot,
    fromSeedSlot,
  );
  const runPlanFingerprint = checkpointPlanFingerprint({
    executionPolicyFingerprint: execution.executionPolicyFingerprint,
    implementationFingerprint,
    characterizationFingerprint: characterization.dataFingerprint,
    auditFingerprint: audit.auditFingerprint,
    candidateReviewFingerprint: sourceInventoryFingerprint(reviewContents),
    candidateIdentity: {
      candidateFingerprint: git.candidateFingerprint,
      compilerSourceFingerprint: git.compilerSourceFingerprint,
      compilerEnvironment: git.compilerEnvironment,
      engineArtifactFingerprint: git.engineArtifactFingerprint,
    },
    runtime,
    linkedDevelopment,
    comparisonRequest,
    bootstrapRequest,
    ...(baselineCacheShard ? {
      baselineCacheShard: {
        schema: "line.benchmark-v2.baseline-cache-shard-run.v1",
        firstSeedSlot: fromSeedSlot ?? 0,
        endSeedSlotExclusive: throughSeedSlot ?? effectiveSeedsPerBudget,
      },
    } : {}),
  });
  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(checkpointPath), { recursive: true });
  acquireRunLock(outputPath);
  if (throughSeedSlot !== undefined && existsSync(checkpointPath) && !hasFlag("resume")) {
    throw new Error(`wave execution must resume its attempt checkpoint; pass --resume`);
  }
  const streamingArchive = tasks.length > STREAMING_ARCHIVE_TASK_THRESHOLD;
  if (roundProgressReference !== undefined && streamingArchive) {
    throw new Error(`round progress is currently bounded to the active in-memory campaign scope`);
  }
  const restored = streamingArchive
    ? []
    : loadOrInitializeCheckpoint(checkpointPath, runPlanFingerprint, hasFlag("resume"));
  const restoredIndex = streamingArchive
    ? await loadCheckpointResultIndex(checkpointPath, runPlanFingerprint, hasFlag("resume"))
    : undefined;
  invalidatePublishedRunArtifacts(outputPath);
  const restoredByKey = new Map(restored.map((result) => [taskKey(result.task), result]));
  const restoredSuccessKeys = streamingArchive
    ? new Set([...restoredIndex!.latest].flatMap(([key, entry]) => entry.status === "ok" ? [key] : []))
    : new Set(restoredByKey.keys());
  const pending = tasks.filter((task) => !restoredSuccessKeys.has(taskKey(task)));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const scoredProgress = restored.map((result) => scoreWorkerResult(
    result,
    suite,
    sourceById.get(result.task.sourceId)!,
    contracts.get(result.task.sourceId)!,
  ));
  const streamingProgress = streamingArchive
    ? newStreamingProgress(restoredSuccessKeys.size, effectiveBudgets)
    : undefined;
  const roundProgress = roundProgressReference === undefined
    ? undefined
    : new RoundProgressAccumulator(
      roundProgressReference,
      suite,
      scoredProgress.map(compactDecisionRun),
    );
  if (roundProgress !== undefined) {
    writeFileAtomicDurable(
      roundProgressOutputPath!,
      roundProgressLog(roundProgressReference!, roundProgress.allEvents()),
    );
  }
  const startedAt = performance.now();

  console.log(`Benchmark V2 ${mode} ${profileName}${exploration ? ` exploration ${explorationId}` : ""}`);
  console.log(
    `  ${tasks.length} compiles (${sources.length} sources, ${effectiveBudgets.length} budgets, ` +
    `${effectiveSeedsPerBudget} seed slots); ${restoredSuccessKeys.size} restored`,
  );
  console.log(
    `  suite ${suiteId.suiteFingerprint.slice(0, 16)}, policy ` +
    `${execution.executionPolicyFingerprint.slice(0, 16)}, audit ${audit.auditFingerprint.slice(0, 16)}`,
  );
  if (roundProgress !== undefined) {
    console.log(
      `  round progress: one line per complete ${sources.length}-case seed block; ` +
      `${relativeToCwd(roundProgressOutputPath!)}`,
    );
    if (roundProgress.completedDepth > 0) {
      console.log(`  round progress restored through N=${roundProgress.completedDepth}`);
    }
  }

  const fresh = await runWorkerPool(pending, jobs, (result) => {
    appendFileSync(checkpointPath, `${JSON.stringify({ type: "result", result })}\n`);
    const scored = scoreWorkerResult(
      result,
      suite,
      sourceById.get(result.task.sourceId)!,
      contracts.get(result.task.sourceId)!,
    );
    if (streamingProgress !== undefined) {
      recordStreamingProgress(streamingProgress, scored);
      if (streamingProgress.completed === tasks.length || streamingProgress.completed % sources.length === 0) {
        printStreamingProgress(streamingProgress, tasks.length, startedAt, restoredSuccessKeys.size);
      }
    } else {
      scoredProgress.push(scored);
      if (roundProgress !== undefined) {
        const elapsedSeconds = Math.max(0.001, (performance.now() - startedAt) / 1000);
        const freshDone = Math.max(0, scoredProgress.length - restored.length);
        const rate = freshDone / elapsedSeconds;
        const etaSeconds = rate > 0 ? (tasks.length - scoredProgress.length) / rate : 0;
        const workerFailures = scoredProgress.filter((row) => row.status !== "ok").length;
        for (const event of roundProgress.record(compactDecisionRun(scored))) {
          appendFileSync(roundProgressOutputPath!, `${JSON.stringify(event)}\n`);
          console.log(renderRoundProgress(event, {
            waveDepth: measuredDepth,
            workerFailures,
            rate,
            etaSeconds,
          }));
        }
      } else if (scoredProgress.length === tasks.length || scoredProgress.length % sources.length === 0) {
        printProgress(scoredProgress, tasks.length, effectiveBudgets, startedAt, restored.length);
      }
    }
  }, !streamingArchive);
  const finalIndex = streamingArchive
    ? await loadCheckpointResultIndex(checkpointPath, runPlanFingerprint, true)
    : undefined;
  if (finalIndex !== undefined && (
    finalIndex.latest.size !== tasks.length || tasks.some((task) => !finalIndex.latest.has(taskKey(task)))
  )) throw new Error(`checkpoint does not contain the complete declared task scope`);
  const allByKey = streamingArchive
    ? undefined
    : new Map([...restored, ...fresh].map((result) => [taskKey(result.task), result]));
  const results = streamingArchive ? undefined : tasks.map((task) => allByKey!.get(taskKey(task))!);
  const workerFailures = finalIndex === undefined
    ? results!.filter((result) => result.status !== "ok").length
    : [...finalIndex.latest.values()].filter((entry) => entry.status !== "ok").length;
  if (throughSeedSlot !== undefined && throughSeedSlot < effectiveSeedsPerBudget && !finalizePrefix) {
    // Sub-depth wave: leave a partial-run summary (no archive/summary/sidecars)
    // recording progress and the shared checkpoint so a later wave can resume.
    const totalDeclaredTasks =
      schedule.byBudget.reduce((sum, entry) => sum + entry.actualSeeds.length, 0) * sources.length;
    const completedTasks = finalIndex === undefined
      ? results!.filter((result) => result.status === "ok").length
      : [...finalIndex.latest.values()].filter((entry) => entry.status === "ok").length;
    const partialPath = `${outputPath}.partial.json`;
    const partialBytes = Buffer.from(`${JSON.stringify(partialRunSummary({
      mode,
      profile: profileName,
      throughSeedSlot,
      seedsPerBudget: effectiveSeedsPerBudget,
      totalDeclaredTasks,
      completedTasks,
      workerFailures,
      runPlanFingerprint,
      checkpoint: relativeToCwd(checkpointPath),
    }), null, 2)}\n`);
    writeFileSync(partialPath, partialBytes);
    const partialSha256 = sha256(partialBytes);
    console.log(
      `  partial wave through seed slot ${throughSeedSlot}/${effectiveSeedsPerBudget}: ` +
      `${completedTasks}/${totalDeclaredTasks} tasks ok, ${workerFailures} failed; ${relativeToCwd(partialPath)}`,
    );
    if (workerFailures > 0) process.exitCode = 1;
    return {
      mode,
      outputPath: partialPath,
      summaryPath: partialPath,
      archiveSha256: partialSha256,
      compressedArchiveSha256: partialSha256,
      headline: null,
      qualificationMonitorScore: null,
      workerFailures,
      partialThroughSeedSlot: throughSeedSlot,
    };
  }
  const scored = results?.map((result) => scoreWorkerResult(
    result,
    suite,
    sourceById.get(result.task.sourceId)!,
    contracts.get(result.task.sourceId)!,
  ));
  const aggregateRuns: ScoredDevelopmentRun[] = [];
  const decisionRuns: Array<Record<string, any>> = [];
  const addScoredRun = (row: ReturnType<typeof scoreWorkerResult>): void => {
    aggregateRuns.push({
      sourceId: row.task.sourceId,
      budget: row.task.budget,
      seedSlot: row.task.seedSlot,
      actualSeed: row.task.actualSeed,
      score: row.score,
    });
  };
  if (scored !== undefined) {
    for (const row of scored) addScoredRun(row);
  } else {
    for await (const result of latestCheckpointResults(checkpointPath, finalIndex!, runPlanFingerprint)) {
      const row = scoreWorkerResult(
        result,
        suite,
        sourceById.get(result.task.sourceId)!,
        contracts.get(result.task.sourceId)!,
      );
      addScoredRun(row);
      decisionRuns.push(decisionRunProjection(row));
    }
  }
  const developmentSummaries = mode === "development"
    ? effectiveBudgets.map((budget) => summarizeDevelopmentBudget(aggregateRuns, budget, suite))
    : [];
  const headline = developmentSummaries.length === 0
    ? null
    : weightedBudgetHeadline(developmentSummaries, suite.budget_weights);
  const qualificationSummaries = mode === "qualification"
    ? effectiveBudgets.map((budget) => summarizeQualificationBudget(
      aggregateRuns,
      budget,
      sources.map((source) => source.id),
    ))
    : [];
  const qualificationMonitorScore = qualificationSummaries.length === 0
    ? null
    : weightedMonitorScore(qualificationSummaries, suite.budget_weights);
  const generatedAt = new Date().toISOString();
  const archiveCore = {
    schema: RUN_ARCHIVE_SCHEMA,
    mode,
    profile: profileName,
    generatedAt,
    identity: {
      ...suiteId,
      ...measuredExecution,
      candidateReviewFingerprint: sourceInventoryFingerprint(reviewContents),
      listeningReviewFingerprint: listeningReview.fingerprint,
      listeningReviewStatus: listeningReview.review.status,
      characterizationFingerprint: characterization.dataFingerprint,
      auditFingerprint: audit.auditFingerprint,
      heldoutManifestFingerprint: characterization.heldoutManifestFingerprint,
      runPlanFingerprint,
    },
    git,
    environment: {
      ...runtime,
      logicalCpus: cpus().length,
    },
    linkedDevelopment,
    comparisonRequest,
    ...(finalizePrefix ? {
      sequentialAttempt: {
        schema: "line.benchmark-v2.sequential-attempt.v1",
        declaredSeedsPerBudget: effectiveSeedsPerBudget,
        completedSeedsPerBudget: measuredDepth,
        declaredSeedScheduleFingerprint: sha256(JSON.stringify(schedule)),
        measuredSeedScheduleFingerprint: sha256(JSON.stringify(measuredSchedule)),
        runPlanFingerprint,
      },
    } : {}),
    bootstrapRequest,
    ...(baselineCacheShard ? {
      baselineCacheShard: {
        schema: "line.benchmark-v2.baseline-cache-shard-run.v1",
        firstSeedSlot: fromSeedSlot ?? 0,
        endSeedSlotExclusive: throughSeedSlot ?? effectiveSeedsPerBudget,
      },
    } : {}),
    ...(exploration ? {
      exploration: {
        schema: "line.benchmark-v2.exploration-run.v1",
        authority: "exploration-only",
        id: explorationId,
        seedBase: explorationSeedBase,
        seedsPerBudget: explorationSeedsPerBudget,
      },
    } : {}),
    canonicalHeadline: headline,
    qualificationMonitorScore,
    developmentSummaries,
    qualificationSummaries,
    sources: sources.map((source) => sourceArchiveIdentity(source)),
  };
  const failed = workerFailures > 0;
  const archive = scored === undefined
    ? undefined
    : bindDecisionIndexArchive({ ...archiveCore, runs: scored });
  const decisionArchive = scored === undefined
    ? { ...archiveCore, runs: decisionRuns }
    : undefined;
  const streamingBinding = decisionArchive === undefined ? undefined : sha256(JSON.stringify(decisionArchive));
  const archiveChunksToWrite = archive === undefined
    ? checkpointArchiveChunks(
      { ...archiveCore, decisionIndexPayloadSha256: streamingBinding! },
      checkpointPath,
      finalIndex!,
      runPlanFingerprint,
      (result) => scoreWorkerResult(
        result,
        suite,
        sourceById.get(result.task.sourceId)!,
        contracts.get(result.task.sourceId)!,
      ),
    )
    : archiveChunks(archive);
  const { archiveOut, summaryPath, archiveSha256, compressedArchiveSha256 } =
    await writeArchiveArtifacts(outputPath, archiveChunksToWrite, failed);
  const decisionIndexPath = `${archiveOut}.decision-index.json`;
  if (!failed) {
    if (archive !== undefined) writeDecisionIndexArtifacts(archiveOut, archive, archiveSha256, compressedArchiveSha256);
    else writeDecisionIndexProjectionArtifacts(archiveOut, decisionArchive!, archiveSha256, compressedArchiveSha256);
  }
  writeFileAtomicDurable(summaryPath, `${JSON.stringify({
    schema: SUMMARY_SCHEMA,
    mode,
    profile: profileName,
    generatedAt,
    archive: relativeToCwd(archiveOut),
    compressedArchive: relativeToCwd(`${archiveOut}.gz`),
    archiveSha256,
    compressedArchiveSha256,
    suiteFingerprint: suiteId.suiteFingerprint,
    executionPolicyFingerprint: measuredExecution.executionPolicyFingerprint,
    executionProtocol: measuredExecution.executionProtocol,
    implementationFingerprint: measuredExecution.implementationFingerprint,
    listeningReviewFingerprint: listeningReview.fingerprint,
    listeningReviewStatus: listeningReview.review.status,
    seedSchedule: measuredSchedule,
    compilerIdentityProtocol: git.compilerIdentityProtocol,
    compilerSourceFingerprint: git.compilerSourceFingerprint,
    compilerSourceFiles: git.compilerSourceFiles,
    compilerEnvironment: git.compilerEnvironment,
    engineArtifactFingerprint: git.engineArtifactFingerprint,
    candidateFingerprint: git.candidateFingerprint,
    canonicalHeadline: headline,
    qualificationMonitorScore,
    workerFailures,
    developmentSummaries,
    qualificationSummaries,
    linkedDevelopment,
    comparisonRequest,
    ...(finalizePrefix ? {
      sequentialAttempt: {
        schema: "line.benchmark-v2.sequential-attempt.v1",
        declaredSeedsPerBudget: effectiveSeedsPerBudget,
        completedSeedsPerBudget: measuredDepth,
        declaredSeedScheduleFingerprint: sha256(JSON.stringify(schedule)),
        measuredSeedScheduleFingerprint: sha256(JSON.stringify(measuredSchedule)),
        runPlanFingerprint,
      },
    } : {}),
    bootstrapRequest,
    ...(exploration ? {
      exploration: {
        schema: "line.benchmark-v2.exploration-run.v1",
        authority: "exploration-only",
        id: explorationId,
        seedBase: explorationSeedBase,
        seedsPerBudget: explorationSeedsPerBudget,
      },
    } : {}),
  }, null, 2)}\n`);

  for (const budget of effectiveBudgets) {
    const rows = aggregateRuns.filter((row) => row.budget === budget);
    const valid = rows.filter((row) => row.score.valid).length;
    const development = developmentSummaries.find((entry) => entry.budget === budget);
    const qualification = qualificationSummaries.find((entry) => entry.budget === budget);
    console.log(
      `  ${budget}: valid ${valid}/${rows.length}` +
      (development === undefined ? "" : ` canonical ${development.score.toFixed(2)}`) +
      (qualification === undefined ? "" : ` monitor ${qualification.monitorScore.toFixed(2)}`),
    );
  }
  if (headline !== null) console.log(`  canonical headline: ${headline.toFixed(2)}`);
  if (qualificationMonitorScore !== null) console.log(`  qualification monitor: ${qualificationMonitorScore.toFixed(2)}`);
  console.log(`  archive: ${relativeToCwd(archiveOut)} (${archiveSha256.slice(0, 16)})`);
  console.log(`  compressed: ${relativeToCwd(`${archiveOut}.gz`)}`);
  console.log(`  summary: ${relativeToCwd(summaryPath)}`);
  if (!failed) console.log(`  decision index: ${relativeToCwd(decisionIndexPath)}`);
  if (failed) {
    console.error(`  FAILED: ${workerFailures} worker failure(s); archive retained at ${relativeToCwd(archiveOut)}; re-run with --resume to retry the failed tasks`);
    process.exitCode = 1;
  }
  return {
    mode,
    outputPath: archiveOut,
    summaryPath,
    ...(failed ? {} : { decisionIndexPath }),
    archiveSha256,
    compressedArchiveSha256,
    headline,
    qualificationMonitorScore,
    workerFailures,
  };
}

export function writeDecisionIndexArtifacts(
  archivePath: string,
  archive: Record<string, any> & { runs: Array<Record<string, any>> },
  archiveSha256: string,
  compressedArchiveSha256: string,
): string {
  const decisionIndexPath = `${archivePath}.decision-index.json`;
  const decisionArchive = decisionArchiveProjection(archive);
  const payloadSha256 = sha256(JSON.stringify(decisionArchive));
  if (archive.decisionIndexPayloadSha256 !== payloadSha256) {
    throw new Error(`raw archive does not commit to its decision-index payload`);
  }
  const decisionIndexBytes = `${JSON.stringify({
    schema: DECISION_INDEX_SCHEMA,
    payloadSha256,
    archiveSha256,
    compressedArchiveSha256,
    archive: decisionArchive,
  })}\n`;
  writeFileAtomicDurable(decisionIndexPath, decisionIndexBytes);
  writeFileAtomicDurable(
    `${decisionIndexPath}.sha256`,
    `${sha256(decisionIndexBytes)}  ${relativeToCwd(decisionIndexPath)}\n`,
  );
  return decisionIndexPath;
}

function writeDecisionIndexProjectionArtifacts(
  archivePath: string,
  decisionArchive: Record<string, any> & { runs: Array<Record<string, any>> },
  archiveSha256: string,
  compressedArchiveSha256: string,
): string {
  const decisionIndexPath = `${archivePath}.decision-index.json`;
  const payloadSha256 = sha256(JSON.stringify(decisionArchive));
  const decisionIndexBytes = `${JSON.stringify({
    schema: DECISION_INDEX_SCHEMA,
    payloadSha256,
    archiveSha256,
    compressedArchiveSha256,
    archive: decisionArchive,
  })}\n`;
  writeFileAtomicDurable(decisionIndexPath, decisionIndexBytes);
  writeFileAtomicDurable(
    `${decisionIndexPath}.sha256`,
    `${sha256(decisionIndexBytes)}  ${relativeToCwd(decisionIndexPath)}\n`,
  );
  return decisionIndexPath;
}

export function bindDecisionIndexArchive<T extends Record<string, any> & { runs: Array<Record<string, any>> }>(
  archive: T,
): T & { decisionIndexPayloadSha256: string } {
  const { runs, ...core } = archive;
  const projected = decisionArchiveProjection(archive);
  return {
    ...core,
    decisionIndexPayloadSha256: sha256(JSON.stringify(projected)),
    runs,
  } as T & { decisionIndexPayloadSha256: string };
}

export function validateDecisionIndexAgainstArchive(
  indexPath: string,
  archive: Record<string, any> & { runs: Array<Record<string, any>> },
): number {
  const bytes = readFileSync(indexPath);
  const sidecar = readFileSync(`${indexPath}.sha256`, "utf8").trim().split(/\s+/)[0];
  if (sidecar !== sha256(bytes)) throw new Error(`decision-index checksum mismatch`);
  const index = JSON.parse(bytes.toString("utf8"));
  if (index.schema !== DECISION_INDEX_SCHEMA) throw new Error(`unsupported decision index`);
  const expected = decisionArchiveProjection(archive);
  if (
    index.payloadSha256 !== sha256(JSON.stringify(expected)) ||
    archive.decisionIndexPayloadSha256 !== index.payloadSha256
  ) throw new Error(`raw archive does not commit to its decision-index payload`);
  if (JSON.stringify(index.archive) !== JSON.stringify(expected)) {
    throw new Error(`decision index differs from its raw archive projection`);
  }
  return expected.runs.length;
}

function decisionArchiveProjection(
  archive: Record<string, any> & { runs: Array<Record<string, any>> },
): Record<string, any> & { runs: Array<Record<string, any>> } {
  const { decisionIndexPayloadSha256: _binding, ...withoutBinding } = archive;
  return {
    ...withoutBinding,
    runs: archive.runs.map(decisionRunProjection),
  };
}

function decisionRunProjection(row: Record<string, any>): Record<string, any> {
  return {
    status: row.status,
    task: row.task,
    source: row.source,
    authoredContacts: row.authoredContacts,
    score: row.score,
    rawReportSha256: sha256(JSON.stringify(row.report ?? null)),
  };
}

/** Return the self-consistent schedule represented by a completed strict
 * wave. The full declared schedule remains in the immutable request and
 * checkpoint plan; published evidence contains only rows it actually scored. */
export function seedSchedulePrefix(
  schedule: ResolvedSeedSchedule,
  depth: number,
): ResolvedSeedSchedule {
  if (!Number.isSafeInteger(depth) || depth < 1 || depth > schedule.seedsPerBudget) {
    throw new Error(`seed-schedule prefix must be an integer in 1..${schedule.seedsPerBudget}`);
  }
  if (depth === schedule.seedsPerBudget) return schedule;
  return {
    ...schedule,
    seedsPerBudget: depth,
    byBudget: schedule.byBudget.map((entry) => ({
      budget: entry.budget,
      actualSeeds: entry.actualSeeds.slice(0, depth),
    })),
  };
}

/**
 * Builds the full worker-task cross product from a resolved seed schedule, then
 * (optionally) keeps only the leading `throughSeedSlot` seed slots per budget.
 * Wave-based execution runs a growing prefix of the declared schedule while all
 * waves share one attempt checkpoint. With no `throughSeedSlot` this is the full
 * declared task list, identical to the historical inline construction.
 */
export function buildWorkerTasks(
  schedule: ResolvedSeedSchedule,
  sources: Array<{ id: string }>,
  mode: RunnerMode,
  joltMs: number,
  manifests: { sourceManifestPath: string; heldoutManifestPath: string },
  throughSeedSlot?: number,
  fromSeedSlot = 0,
): WorkerTask[] {
  const tasks = schedule.byBudget.flatMap(({ budget, actualSeeds }) =>
    actualSeeds.flatMap((actualSeed, seedSlot) => sources.map((source) => ({
      mode,
      sourceId: source.id,
      budget,
      seedSlot,
      actualSeed,
      joltMs,
      sourceManifestPath: manifests.sourceManifestPath,
      heldoutManifestPath: manifests.heldoutManifestPath,
    })))
  );
  return tasks.filter((task) =>
    task.seedSlot >= fromSeedSlot && (throughSeedSlot === undefined || task.seedSlot < throughSeedSlot)
  );
}

/**
 * Guards canonical subset flags. They require either an explicit comparison
 * request or a baseline-cache shard.
 */
export function validateSubsetFlags(input: {
  profileName: "probe" | "canonical";
  hasDeclaration: boolean;
  baselineCacheShard: boolean;
  seedsPerBudget: number | undefined;
  throughSeedSlot: number | undefined;
  fromSeedSlot: number | undefined;
  effectiveDepth: number;
}): void {
  const { profileName, hasDeclaration, baselineCacheShard, seedsPerBudget, throughSeedSlot, fromSeedSlot, effectiveDepth } = input;
  if (seedsPerBudget === undefined && throughSeedSlot === undefined && fromSeedSlot === undefined) return;
  if (profileName !== "canonical" || (!hasDeclaration && !baselineCacheShard)) {
    throw new Error(`--seeds-per-budget, --through-seed-slot, and --from-seed-slot require a canonical comparison request or baseline-cache shard`);
  }
  if (seedsPerBudget !== undefined && (!Number.isSafeInteger(seedsPerBudget) || seedsPerBudget < 1)) {
    throw new Error(`seeds-per-budget must be a positive integer`);
  }
  if (throughSeedSlot !== undefined) {
    if (!Number.isSafeInteger(throughSeedSlot) || throughSeedSlot < 1) {
      throw new Error(`through-seed-slot must be a positive integer`);
    }
    if (throughSeedSlot > effectiveDepth) {
      throw new Error(`--through-seed-slot=${throughSeedSlot} exceeds seeds-per-budget=${effectiveDepth}`);
    }
  }
  if (fromSeedSlot !== undefined) {
    if (!baselineCacheShard) {
      throw new Error(`--from-seed-slot is reserved for a baseline-cache shard`);
    }
    if (!Number.isSafeInteger(fromSeedSlot) || fromSeedSlot < 0) {
      throw new Error(`from-seed-slot must be a non-negative integer`);
    }
    if (fromSeedSlot >= effectiveDepth) {
      throw new Error(`--from-seed-slot=${fromSeedSlot} must be below seeds-per-budget=${effectiveDepth}`);
    }
    if (throughSeedSlot === undefined) {
      throw new Error(`--from-seed-slot requires --through-seed-slot`);
    }
    if (fromSeedSlot >= throughSeedSlot) {
      throw new Error(`--from-seed-slot must be below --through-seed-slot`);
    }
  }
  if (baselineCacheShard && (fromSeedSlot === undefined || throughSeedSlot === undefined)) {
    throw new Error(`--baseline-cache-shard requires --from-seed-slot and --through-seed-slot`);
  }
}

/** `--finalize-prefix` is intentionally internal: only eval may turn a
 * completed strict candidate wave into checksummed decision evidence. */
export function validateFinalizePrefixFlags(input: {
  finalizePrefix: boolean;
  throughSeedSlot: number | undefined;
  effectiveDepth: number;
  hasComparisonRequest: boolean;
  baselineCacheShard: boolean;
  exploration: boolean;
  profileName: "probe" | "canonical";
  mode: RunnerMode;
}): void {
  if (!input.finalizePrefix) return;
  if (
    input.throughSeedSlot === undefined || input.throughSeedSlot > input.effectiveDepth ||
    !input.hasComparisonRequest || input.baselineCacheShard || input.exploration ||
    input.profileName !== "canonical" || input.mode !== "development"
  ) throw new Error(`--finalize-prefix requires a canonical development comparison wave`);
}

export function validateExplorationFlags(input: {
  exploration: boolean;
  explorationId: string | undefined;
  mode: RunnerMode;
  profileName: "probe" | "canonical";
  hasDeclaration: boolean;
  baselineCacheShard: boolean;
  canonicalSeedBaseOverride: number | undefined;
  confirmationSeedsPerBudgetOverride: number | undefined;
  explorationSeedBase: number | undefined;
  explorationSeedsPerBudget: number | undefined;
  explorationBudgets?: readonly number[];
  throughSeedSlot: number | undefined;
  fromSeedSlot: number | undefined;
  explicitSeedSchedulePath: string | undefined;
}): void {
  const hasExplorationArgument =
    input.explorationId !== undefined || input.explorationSeedBase !== undefined ||
    input.explorationSeedsPerBudget !== undefined || input.explorationBudgets !== undefined;
  if (!input.exploration) {
    if (hasExplorationArgument) throw new Error(`exploration arguments require --exploration`);
    return;
  }
  if (
    input.mode !== "development" || input.profileName !== "probe" || input.hasDeclaration || input.baselineCacheShard ||
    input.canonicalSeedBaseOverride !== undefined || input.confirmationSeedsPerBudgetOverride !== undefined ||
    input.throughSeedSlot !== undefined || input.fromSeedSlot !== undefined || input.explicitSeedSchedulePath !== undefined
  ) {
    throw new Error(`exploration is development-only and cannot use canonical confirmation or wave arguments`);
  }
  if (input.explorationId === undefined || !/^[a-zA-Z0-9][a-zA-Z0-9_.\/-]{0,127}$/.test(input.explorationId)) {
    throw new Error(`--exploration-id must be a non-empty stable identifier`);
  }
  if (
    input.explorationSeedBase === undefined || input.explorationSeedsPerBudget === undefined ||
    !Number.isSafeInteger(input.explorationSeedsPerBudget) || input.explorationSeedsPerBudget < 2 ||
    input.explorationSeedsPerBudget > 64
  ) {
    throw new Error(`exploration requires a seed base and 2..64 seeds per budget`);
  }
  if (input.explorationSeedBase < 3_000_000_000 || input.explorationSeedBase >= 4_000_000_000) {
    throw new Error(`exploration seed bases must be in the reserved [3000000000, 4000000000) range`);
  }
}

/**
 * A fixed-N cache-backed comparison must use a literal schedule, not the old
 * depth-relative `seedBase + budgetIndex * N` formula.  Keeping the schedule
 * in a small immutable JSON artifact makes every prefix explicit and lets a
 * 37-seed candidate be compared to the first 37 rows of a 300-seed baseline
 * without silently remapping the later budget blocks.
 */
function loadExplicitSeedSchedule(
  path: string,
  profile: "probe" | "canonical",
  budgets: readonly number[],
  seedsPerBudget: number,
  canonicalSeedBaseOverride: number | undefined,
): ResolvedSeedSchedule {
  if (profile !== "canonical") throw new Error(`--seed-schedule is canonical-only`);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const value = (raw.canonicalSeedSchedule ?? raw) as ResolvedSeedSchedule;
  if (
    value?.kind !== "profile_budget_disjoint_contiguous" || value.profile !== "canonical" ||
    !Number.isSafeInteger(value.seedBase) || value.seedBase < 0 ||
    value.seedsPerBudget !== seedsPerBudget || !Array.isArray(value.byBudget) ||
    value.byBudget.length !== budgets.length
  ) throw new Error(`--seed-schedule=${path} is malformed or does not match the requested canonical depth`);
  if (canonicalSeedBaseOverride !== undefined && value.seedBase !== canonicalSeedBaseOverride) {
    throw new Error(`--canonical-seed-base does not match --seed-schedule`);
  }
  const seen = new Set<number>();
  for (const [index, budget] of budgets.entries()) {
    const entry = value.byBudget[index];
    if (
      entry?.budget !== budget || !Array.isArray(entry.actualSeeds) ||
      entry.actualSeeds.length !== seedsPerBudget ||
      entry.actualSeeds.some((seed) => !Number.isSafeInteger(seed) || seed < 0 || seen.has(seed))
    ) throw new Error(`--seed-schedule=${path} is not a disjoint complete schedule for budget ${budget}`);
    for (const seed of entry.actualSeeds) seen.add(seed);
  }
  return value;
}

/**
 * The on-disk summary a sub-depth wave leaves in place of an archive: it records
 * how far the attempt has progressed and where its shared checkpoint lives, so a
 * later wave can resume and eventually assemble the full archive.
 */
export function partialRunSummary(input: {
  mode: RunnerMode;
  profile: "probe" | "canonical";
  throughSeedSlot: number;
  seedsPerBudget: number;
  totalDeclaredTasks: number;
  completedTasks: number;
  workerFailures: number;
  runPlanFingerprint: string;
  checkpoint: string;
}): {
  schema: typeof PARTIAL_RUN_SCHEMA;
  mode: RunnerMode;
  profile: "probe" | "canonical";
  throughSeedSlot: number;
  seedsPerBudget: number;
  totalDeclaredTasks: number;
  completedTasks: number;
  workerFailures: number;
  runPlanFingerprint: string;
  checkpoint: string;
} {
  return {
    schema: PARTIAL_RUN_SCHEMA,
    mode: input.mode,
    profile: input.profile,
    throughSeedSlot: input.throughSeedSlot,
    seedsPerBudget: input.seedsPerBudget,
    totalDeclaredTasks: input.totalDeclaredTasks,
    completedTasks: input.completedTasks,
    workerFailures: input.workerFailures,
    runPlanFingerprint: input.runPlanFingerprint,
    checkpoint: input.checkpoint,
  };
}

type SelectionReview = {
  status: string;
  characterization_fingerprint: string;
  audit_fingerprint: string;
  decisions: Array<{ id: string; disposition: string }>;
};

function validateSelectionReview(
  review: SelectionReview,
  characterization: CharacterizationReport,
  audit: AuditReport,
  suite: ReturnType<typeof loadSuiteManifest>,
): void {
  const selected = canonicalMembers(suite).sort();
  const reviewed = review.decisions
    .filter((decision) => decision.disposition === "selected")
    .map((decision) => decision.id)
    .sort();
  if (
    review.status !== "canonical-selected-without-compiler-results" ||
    review.characterization_fingerprint !== characterization.dataFingerprint ||
    review.audit_fingerprint !== audit.auditFingerprint ||
    selected.length !== reviewed.length || selected.some((id, index) => id !== reviewed[index])
  ) {
    throw new Error(`candidate selection review is stale or incomplete`);
  }
}

export function validateEvidence(
  characterization: CharacterizationReport,
  audit: AuditReport,
  sourceManifestContents: string,
  heldoutManifestContents: string,
  development: ResolvedSource[],
  qualification: ResolvedSource[],
): void {
  if (characterization.dataFingerprint !== characterizationDataFingerprint(characterization)) {
    throw new Error(`characterization content fingerprint is stale`);
  }
  if (characterization.manifestFingerprint !== sourceInventoryFingerprint(sourceManifestContents)) {
    throw new Error(`characterization source manifest fingerprint is stale`);
  }
  if (characterization.heldoutManifestFingerprint !== sourceInventoryFingerprint(heldoutManifestContents)) {
    throw new Error(`characterization qualification manifest fingerprint is stale`);
  }
  if (audit.auditFingerprint !== auditDataFingerprint(audit)) {
    throw new Error(`audit content fingerprint is stale`);
  }
  if (audit.auditRuleFingerprint !== auditRuleFingerprint()) {
    throw new Error(`audit rule fingerprint is stale`);
  }
  const recomputedAudit = buildAuditReport(characterization);
  if (
    audit.characterizationFingerprint !== characterization.dataFingerprint ||
    recomputedAudit.auditFingerprint !== audit.auditFingerprint || audit.hardFailures.length > 0
  ) {
    throw new Error(`static audit is stale or failing`);
  }
  const characterized = new Map(characterization.sources.map((source) => [source.id, source]));
  for (const source of [...development, ...qualification]) {
    const actual = characterized.get(source.id);
    if (
      actual === undefined || actual.role !== source.role ||
      actual.module !== source.module || actual.scoreSource !== source.scoreSource ||
      actual.sourceFingerprint !== source.sourceFingerprint
    ) {
      throw new Error(`${source.id}: stale characterization identity`);
    }
    if (!source.eligibleComponents.includes("sync") || !source.eligibleComponents.includes("survival")) {
      throw new Error(`${source.id}: sync and survival must be explicitly eligible`);
    }
  }
}

async function runWorkerPool(
  tasks: WorkerTask[],
  jobs: number,
  onResult: (result: WorkerResult) => void,
  collectResults = true,
): Promise<WorkerResult[]> {
  const results = collectResults ? new Array<WorkerResult>(tasks.length) : [];
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next++;
      if (index >= tasks.length) return;
      const result = await runTask(tasks[index]);
      if (collectResults) results[index] = result;
      onResult(result);
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, tasks.length) }, worker));
  return results;
}

function runTask(task: WorkerTask): Promise<WorkerResult> {
  return new Promise((done) => {
    const started = performance.now();
    const worker = new Worker(new URL(import.meta.url), {
      workerData: task,
      resourceLimits: { maxOldGenerationSizeMb: 3072 },
    });
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      const result: WorkerFailure = {
        status: "timeout",
        task,
        elapsedMs: performance.now() - started,
        error: `worker exceeded timeout`,
        authoredContacts: 0,
      };
      void worker.terminate().then(() => done(result), () => done(result));
    }, compilerWorkerTimeoutMs(task.budget));
    worker.once("message", (result: WorkerResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      // Do not release this pool slot until the thread and its engine memory are gone.
      void worker.terminate().then(() => done(result), () => done(result));
    });
    worker.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const result: WorkerResult = {
        status: "error",
        task,
        elapsedMs: performance.now() - started,
        error: error.stack ?? error.message,
        authoredContacts: 0,
      };
      // Do not release this pool slot until the thread and its engine memory are gone.
      void worker.terminate().then(() => done(result), () => done(result));
    });
  });
}

function scoreWorkerResult(
  result: WorkerResult,
  suite: ReturnType<typeof loadSuiteManifest>,
  source: ResolvedSource,
  contract: AxisContract,
): WorkerResult & {
  source: ReturnType<typeof sourceArchiveIdentity>;
  score: V2RunScore;
  phaseResults: ReturnType<typeof phaseResults>;
} {
  const score = result.status === "ok"
    ? scoreV2Report(result.report, result.authoredContacts, contract, suite)
    : errorRunScore(result.authoredContacts, result.status, result.error);
  return {
    ...result,
    source: sourceArchiveIdentity(source),
    score,
    phaseResults: result.status === "ok" ? phaseResults(source, result.report) : [],
  };
}

function phaseResults(source: ResolvedSource, report: DriftReport): Array<{
  id: string;
  start: number;
  end: number;
  authoredContacts: number;
  hitContacts: number;
  complete: boolean;
}> {
  const phases = source.caseMetadata?.phases ?? [];
  if (phases.length === 0) return [];
  return phases.map((phase) => {
    const indexes = report.contacts
      .map((contact, index) => ({ contact, index }))
      .filter(({ contact }) => contact.t_target >= phase.start && contact.t_target < phase.end);
    return {
      id: phase.id,
      start: phase.start,
      end: phase.end,
      authoredContacts: indexes.length,
      hitContacts: indexes.filter(({ contact }) => contact.status === "hit").length,
      complete: indexes.length > 0 && indexes.every(({ contact }) => contact.status === "hit"),
    };
  });
}

function errorRunScore(authored: number, status: string, message: string): V2RunScore {
  return {
    schema: "line.benchmark-v2.run-score.v2",
    score: 0,
    valid: false,
    scoringMode: "axis_quality",
    hardFailures: [`${status}:${message}`],
    contacts: { authored, reported: 0, hit: 0, drift: 0, missing: authored },
    offBeatLandings: 0,
    terminus: { frame: 0, reason: status },
    weightedAxisRms: null,
    expectedObservations: {},
    components: {},
    diagnostics: {},
  };
}

function compactDecisionRun(
  row: WorkerResult & { score: V2RunScore },
): {
  sourceId: string;
  budget: number;
  seedSlot: number;
  actualSeed: number;
  score: { score: number; valid: boolean };
} {
  return {
    sourceId: row.task.sourceId,
    budget: row.task.budget,
    seedSlot: row.task.seedSlot,
    actualSeed: row.task.actualSeed,
    score: { score: row.score.score, valid: row.score.valid },
  };
}

function sourceArchiveIdentity(source: ResolvedSource): {
  id: string;
  role: string;
  originFamily: string;
  module?: string;
  scoreSource?: string;
  sourceFiles: string[];
  sourceFingerprint: string;
  parentId?: string;
  eligibleComponents: string[];
  diagnosticComponents: string[];
} {
  return {
    id: source.id,
    role: source.role,
    originFamily: source.originFamily,
    ...(source.module === undefined ? {} : { module: source.module }),
    ...(source.scoreSource === undefined ? {} : { scoreSource: source.scoreSource }),
    sourceFiles: [...source.sourceFiles],
    sourceFingerprint: source.sourceFingerprint,
    parentId: source.parentId,
    eligibleComponents: [...source.eligibleComponents],
    diagnosticComponents: [...source.diagnosticComponents],
  };
}

function printProgress(
  rows: Array<WorkerResult & { score: V2RunScore }>,
  total: number,
  budgets: number[],
  startedAt: number,
  restored: number,
): void {
  const freshDone = Math.max(0, rows.length - restored);
  const elapsedSeconds = Math.max(0.001, (performance.now() - startedAt) / 1000);
  const rate = freshDone / elapsedSeconds;
  const remaining = total - rows.length;
  const etaSeconds = rate > 0 ? remaining / rate : 0;
  const valid = rows.filter((row) => row.score.valid).length;
  const budgetText = budgets.map((budget) => {
    const current = rows.filter((row) => row.task.budget === budget);
    return `${budget / 1000}k ${current.length} rows`;
  }).join(" | ");
  console.log(
    `  [${rows.length}/${total}] valid ${valid}, ${rate.toFixed(2)} runs/s, ETA ${formatDuration(etaSeconds)}; ${budgetText}`,
  );
}

type StreamingProgress = {
  completed: number;
  valid: number;
  byBudget: Map<number, { count: number }>;
};

function newStreamingProgress(restored: number, budgets: readonly number[]): StreamingProgress {
  return {
    completed: restored,
    valid: 0,
    byBudget: new Map(budgets.map((budget) => [budget, { count: 0 }])),
  };
}

function recordStreamingProgress(
  progress: StreamingProgress,
  row: WorkerResult & { score: V2RunScore },
): void {
  progress.completed++;
  if (row.score.valid) progress.valid++;
  const budget = progress.byBudget.get(row.task.budget)!;
  budget.count++;
}

function printStreamingProgress(
  progress: StreamingProgress,
  total: number,
  startedAt: number,
  restored: number,
): void {
  const freshDone = Math.max(0, progress.completed - restored);
  const elapsedSeconds = Math.max(0.001, (performance.now() - startedAt) / 1000);
  const rate = freshDone / elapsedSeconds;
  const remaining = total - progress.completed;
  const etaSeconds = rate > 0 ? remaining / rate : 0;
  const budgetText = [...progress.byBudget.entries()].map(([budget, summary]) =>
    `${budget / 1000}k ${summary.count} rows`
  ).join(" | ");
  console.log(
    `  [${progress.completed}/${total}] valid ${progress.valid}, ${rate.toFixed(2)} runs/s, ETA ${formatDuration(etaSeconds)}; ` +
    `${budgetText}`,
  );
}

export function checkpointPlanFingerprint(plan: Record<string, unknown>): string {
  return sha256(JSON.stringify(plan));
}

export function loadOrInitializeCheckpoint(
  path: string,
  runPlanFingerprint: string,
  resume: boolean,
): WorkerResult[] {
  if (!resume || !existsSync(path)) {
    writeFileSync(path, `${JSON.stringify({ schema: CHECKPOINT_SCHEMA, runPlanFingerprint })}\n`);
    return [];
  }
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const header = lines[0];
  if (header?.schema !== CHECKPOINT_SCHEMA || header.runPlanFingerprint !== runPlanFingerprint) {
    throw new Error(`checkpoint does not match the current run plan`);
  }
  const results = lines.slice(1)
    .filter((entry) => entry.type === "result")
    .map((row) => row.result as WorkerResult);
  return latestSuccessfulResults(results, (result) => taskKey(result.task));
}

export type CheckpointResultIndex = {
  latest: Map<string, { ordinal: number; status: WorkerResult["status"] }>;
};

/** Index only task identity and final status, never every raw report.  This
 * is the resume/assembly path for deep confirmations whose checkpoint is too
 * large to split into one in-memory string. */
export async function loadCheckpointResultIndex(
  path: string,
  runPlanFingerprint: string,
  resume: boolean,
): Promise<CheckpointResultIndex> {
  if (!resume || !existsSync(path)) {
    writeFileSync(path, `${JSON.stringify({ schema: CHECKPOINT_SCHEMA, runPlanFingerprint })}\n`);
    return { latest: new Map() };
  }
  const latest = new Map<string, { ordinal: number; status: WorkerResult["status"] }>();
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  let headerSeen = false;
  let ordinal = 0;
  for await (const line of lines) {
    if (line === "") continue;
    const entry = JSON.parse(line);
    if (!headerSeen) {
      headerSeen = true;
      if (entry?.schema !== CHECKPOINT_SCHEMA || entry.runPlanFingerprint !== runPlanFingerprint) {
        throw new Error(`checkpoint does not match the current run plan`);
      }
      continue;
    }
    if (entry?.type !== "result") continue;
    const result = entry.result as WorkerResult;
    latest.set(taskKey(result.task), { ordinal, status: result.status });
    ordinal++;
  }
  if (!headerSeen) throw new Error(`checkpoint does not match the current run plan`);
  return { latest };
}

export async function* latestCheckpointResults(
  path: string,
  index: CheckpointResultIndex,
  runPlanFingerprint: string,
): AsyncGenerator<WorkerResult> {
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  let headerSeen = false;
  let ordinal = 0;
  for await (const line of lines) {
    if (line === "") continue;
    const entry = JSON.parse(line);
    if (!headerSeen) {
      headerSeen = true;
      if (entry?.schema !== CHECKPOINT_SCHEMA || entry.runPlanFingerprint !== runPlanFingerprint) {
        throw new Error(`checkpoint does not match the current run plan`);
      }
      continue;
    }
    if (entry?.type !== "result") continue;
    const result = entry.result as WorkerResult;
    const key = taskKey(result.task);
    if (index.latest.get(key)?.ordinal === ordinal) yield result;
    ordinal++;
  }
}

export { compilerCandidateIdentity } from "./compiler_identity.ts";

function archiveLink(path: string): { path: string; sha256: string } {
  return { path: relativeToCwd(path), sha256: sha256FileStreaming(path) };
}

/** Link metadata must remain valid for deep fixed-N archives, which can be
 * larger than Node's 2 GiB Buffer limit. */
function sha256FileStreaming(path: string): string {
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

function weightedMonitorScore(
  summaries: Array<{ budget: number; monitorScore: number }>,
  weights: Array<{ budget: number; weight: number }>,
): number {
  const byBudget = new Map(summaries.map((entry) => [entry.budget, entry.monitorScore]));
  return round(weights.reduce((sum, entry) => sum + entry.weight * (byBudget.get(entry.budget) ?? 0), 0));
}

function taskKey(task: WorkerTask): string {
  return `${task.sourceId}\0${task.budget}\0${task.seedSlot}\0${task.actualSeed}`;
}

function positiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function budgetList(value: string, label: string): number[] {
  const budgets = value.split(",").map((entry) => Number(entry.trim()));
  if (
    budgets.length === 0 ||
    budgets.some((budget) => !Number.isSafeInteger(budget) || budget < 1) ||
    new Set(budgets).size !== budgets.length
  ) {
    throw new Error(`${label} must be a comma-separated list of distinct positive integers`);
  }
  return budgets;
}

function sameBudgetLadder(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((budget, index) => budget === right[index]);
}

function nonNegativeInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative integer`);
  return parsed;
}

/**
 * Serialize a run archive as a chunk stream: the skeleton stays pretty-printed
 * but each run row is one compact line. A depth-48 archive is ~380 MB — a
 * single pretty-printed JSON.stringify (~640 MB) exceeds V8's string cap and
 * crashed the first depth-48 attempt (live-validation V3 finding). Chunked
 * serialization removes the write-side cap at any depth. Deep confirmations
 * also publish a compact, checksummed decision index, so decision reads never
 * need to materialize the raw archive.
 */
export function* archiveChunks(archive: Record<string, unknown> & { runs: unknown[] }): Generator<string> {
  const { prefix, suffix } = archiveRunBoundary(archive);
  yield prefix;
  for (let index = 0; index < archive.runs.length; index++) {
    yield `${index === 0 ? "" : ","}\n    ${JSON.stringify(archive.runs[index])}`;
  }
  if (archive.runs.length > 0) yield "\n  ";
  yield suffix;
}

function archiveRunBoundary(archive: Record<string, unknown>): { prefix: string; suffix: string } {
  const skeleton = `${JSON.stringify({ ...archive, runs: [] }, null, 2)}\n`;
  const marker = `"runs": []`;
  const markerIndex = skeleton.lastIndexOf(marker);
  if (markerIndex < 0) throw new Error(`archive skeleton lost its runs marker`);
  return {
    prefix: skeleton.slice(0, markerIndex + marker.length - 1),
    suffix: skeleton.slice(markerIndex + marker.length - 1),
  };
}

export async function* checkpointArchiveChunks(
  archive: Record<string, unknown>,
  checkpointPath: string,
  index: CheckpointResultIndex,
  runPlanFingerprint: string,
  score: (result: WorkerResult) => Record<string, unknown>,
): AsyncGenerator<string> {
  const { prefix, suffix } = archiveRunBoundary(archive);
  yield prefix;
  let rowCount = 0;
  for await (const result of latestCheckpointResults(checkpointPath, index, runPlanFingerprint)) {
    const row = score(result);
    yield `${rowCount === 0 ? "" : ","}\n    ${JSON.stringify(row)}`;
    rowCount++;
  }
  if (rowCount > 0) yield "\n  ";
  yield suffix;
}

/**
 * A failed run must never look complete on disk: the archive lands at a
 * .failed path with NO checksum sidecars (decision loaders require the
 * sidecar, so it cannot be consumed accidentally); the checkpoint is kept
 * so --resume retries the failures.
 */
export async function writeArchiveArtifacts(
  outputPath: string,
  chunks: Iterable<string | Buffer> | AsyncIterable<string | Buffer>,
  failed: boolean,
): Promise<{ archiveOut: string; summaryPath: string; archiveSha256: string; compressedArchiveSha256: string }> {
  const archiveOut = failed ? `${outputPath}.failed` : outputPath;
  const archiveHash = createHash("sha256");
  const compressedHash = createHash("sha256");
  const gzip = createGzip({ level: 9 });
  const fileStream = createWriteStream(archiveOut);
  const compressedStream = createWriteStream(`${archiveOut}.gz`);
  gzip.on("data", (block: Buffer) => compressedHash.update(block));
  const gzipDone = pipeline(gzip, compressedStream);
  const write = (stream: NodeJS.WritableStream, block: Buffer): Promise<void> =>
    new Promise((resolveWrite, rejectWrite) => {
      stream.write(block, (error) => error ? rejectWrite(error) : resolveWrite());
    });
  for await (const chunk of chunks) {
    const block = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    archiveHash.update(block);
    await write(fileStream, block);
    await write(gzip, block);
  }
  await new Promise<void>((resolveEnd, rejectEnd) => fileStream.end((error?: Error) => error ? rejectEnd(error) : resolveEnd()));
  gzip.end();
  await gzipDone;
  syncFile(archiveOut);
  syncFile(`${archiveOut}.gz`);
  const archiveSha256 = archiveHash.digest("hex");
  const compressedArchiveSha256 = compressedHash.digest("hex");
  if (!failed) {
    writeFileAtomicDurable(`${outputPath}.sha256`, `${archiveSha256}  ${relativeToCwd(outputPath)}\n`);
    writeFileAtomicDurable(`${outputPath}.gz.sha256`, `${compressedArchiveSha256}  ${relativeToCwd(`${outputPath}.gz`)}\n`);
  }
  return {
    archiveOut,
    summaryPath: failed ? `${outputPath}.failed.summary.json` : `${outputPath}.summary.json`,
    archiveSha256,
    compressedArchiveSha256,
  };
}

/**
 * Once a locked run is ready to execute, its output path must no longer name
 * evidence from an earlier invocation. Otherwise a failed rerun would leave
 * the old checksummed success eligible for comparison beside the new .failed
 * artifact.
 */
export function invalidatePublishedRunArtifacts(outputPath: string): void {
  for (const path of [
    outputPath,
    `${outputPath}.gz`,
    `${outputPath}.sha256`,
    `${outputPath}.gz.sha256`,
    `${outputPath}.summary.json`,
    `${outputPath}.decision-index.json`,
    `${outputPath}.decision-index.json.sha256`,
  ]) {
    rmSync(path, { force: true });
  }
}

/**
 * Two concurrent runs sharing one --out would interleave the same checkpoint
 * JSONL and clobber each other's archives. An exclusive pid lockfile refuses
 * the second run while the first is alive and steals stale locks from dead
 * processes. The returned release function supports a parent operation that
 * spans child runs; otherwise the lock is removed on process exit.
 */
export function acquireRunLock(outputPath: string): () => void {
  const lockPath = `${outputPath}.lock`;
  const payload = `${JSON.stringify({
    pid: process.pid,
    startedAt: new Date().toISOString(),
    token: randomUUID(),
  })}\n`;
  try {
    writeFileSync(lockPath, payload, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const holder = readLockHolder(lockPath);
    if (processIsAlive(holder.pid)) {
      throw new Error(`another benchmark run (pid ${holder.pid}, started ${holder.startedAt}) is writing ${relativeToCwd(outputPath)}; pass a distinct --out=`);
    }

    // Serialize stale-lock reclamation separately. Without this guard, two
    // contenders can both observe the dead pid and one can overwrite/remove
    // the live lock just acquired by the other.
    const takeoverPath = `${lockPath}.takeover`;
    try {
      writeFileSync(takeoverPath, payload, { flag: "wx" });
    } catch (takeoverError) {
      if ((takeoverError as NodeJS.ErrnoException).code !== "EEXIST") throw takeoverError;
      throw new Error(`another process is reclaiming the stale benchmark lock for ${relativeToCwd(outputPath)}; retry shortly`);
    }
    try {
      const current = readLockHolder(lockPath);
      if (processIsAlive(current.pid)) {
        throw new Error(`another benchmark run (pid ${current.pid}, started ${current.startedAt}) is writing ${relativeToCwd(outputPath)}; pass a distinct --out=`);
      }
      rmSync(lockPath, { force: true });
      writeFileSync(lockPath, payload, { flag: "wx" });
    } finally {
      rmSync(takeoverPath, { force: true });
    }
  }
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    try {
      // Never remove a successor's lock if the file was replaced between
      // acquisition and cleanup.
      if (readFileSync(lockPath, "utf8") === payload) rmSync(lockPath, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  };
  const releaseOnExit = (): void => release();
  process.once("exit", releaseOnExit);
  return () => {
    process.off("exit", releaseOnExit);
    release();
  };
}

function readLockHolder(lockPath: string): { pid: number; startedAt: string; token?: string } {
  const holder = JSON.parse(readFileSync(lockPath, "utf8"));
  if (
    !Number.isInteger(holder.pid) || typeof holder.startedAt !== "string" ||
    (holder.token !== undefined && typeof holder.token !== "string")
  ) {
    throw new Error(`benchmark lock ${relativeToCwd(lockPath)} is malformed; inspect it before retrying`);
  }
  return holder;
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function defaultOutput(mode: RunnerMode, profile: string): string {
  return `generated/benchmark-v2/${mode}-${profile}.json`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  return `${Math.floor(seconds / 60)}m${Math.ceil(seconds % 60)}s`;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function relativeToCwd(path: string): string {
  const cwd = `${process.cwd()}/`;
  return path.startsWith(cwd) ? path.slice(cwd.length) : path;
}

async function workerMain(task: WorkerTask): Promise<void> {
  const started = performance.now();
  let authoredContacts = 0;
  try {
    const sources = task.mode === "qualification"
      ? resolveHeldoutSources(loadHeldoutManifest(task.heldoutManifestPath))
      : resolveSources(loadSourceManifest(task.sourceManifestPath));
    const source = sources.find((entry) => entry.id === task.sourceId);
    if (source === undefined) throw new Error(`${task.sourceId}: source unavailable in ${task.mode} worker`);
    const baseSpec = await loadSourceSpec(source);
    authoredContacts = baseSpec.contacts.length;
    const spec = applyJolt(baseSpec, task.joltMs);
    const { track, report, stats, budgetTelemetry } = compileHandoff(spec, task.actualSeed, {
      budget: task.budget,
      budgetTelemetry: "summary",
    });
    const trackHash = sha256(JSON.stringify(track));
    parentPort!.postMessage({
      status: "ok",
      task,
      elapsedMs: performance.now() - started,
      report,
      stats,
      budgetTelemetry,
      trackHash,
      authoredContacts,
    } satisfies WorkerSuccess);
  } catch (error) {
    parentPort!.postMessage({
      status: "error",
      task,
      elapsedMs: performance.now() - started,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
      authoredContacts,
    } satisfies WorkerFailure);
  }
}

if (!isMainThread) await workerMain(workerData as WorkerTask);
