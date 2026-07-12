import { createHash } from "node:crypto";
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, arch, cpus, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { applyJolt } from "../../produce/seed.ts";
import { compilerWorkerTimeoutMs } from "../golden_suite.ts";
import { compileHandoff } from "../optimizer/handoff.ts";
import type { CompileStats, DriftReport, Spec } from "../types.ts";
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
import { requireCurrentDecisionCalibration } from "./calibration_guard.ts";
import { latestSuccessfulResults } from "./checkpoint_model.ts";
import { syncFile, writeFileAtomicDurable } from "./durable_fs.ts";

export const RUN_ARCHIVE_SCHEMA = BENCHMARK_RUN_ARCHIVE_SCHEMA;
export { COMPILER_IDENTITY_PROTOCOL };
const CHECKPOINT_SCHEMA = "line.benchmark-v2.checkpoint.v1" as const;
const SUMMARY_SCHEMA = "line.benchmark-v2.run-summary.v3" as const;
export const DECISION_INDEX_SCHEMA = "line.benchmark-v2.decision-index.v1" as const;
const PARTIAL_RUN_SCHEMA = "line.benchmark-v2.partial-run.v1" as const;

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

type WorkerResult = WorkerSuccess | WorkerFailure;

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
  const confirmationDeclarationPath = argument("confirmation-declaration") === undefined
    ? undefined
    : resolve(argument("confirmation-declaration")!);
  const exploration = hasFlag("exploration");
  const explorationId = argument("exploration-id");
  const canonicalSeedBaseOverride = argument("canonical-seed-base") === undefined
    ? undefined
    : nonNegativeInteger(argument("canonical-seed-base")!, "canonical-seed-base");
  if (canonicalSeedBaseOverride !== undefined && (profileName !== "canonical" || confirmationDeclarationPath === undefined)) {
    throw new Error(`--canonical-seed-base is reserved for a predeclared canonical confirmation`);
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
  const throughSeedSlot = argument("through-seed-slot") === undefined
    ? undefined
    : Number(argument("through-seed-slot"));
  validateExplorationFlags({
    exploration,
    explorationId,
    mode,
    profileName,
    hasDeclaration: confirmationDeclarationPath !== undefined,
    canonicalSeedBaseOverride,
    confirmationSeedsPerBudgetOverride,
    explorationSeedBase,
    explorationSeedsPerBudget,
    throughSeedSlot,
  });

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
  if (profileName === "canonical") requireCurrentDecisionCalibration(suiteId.suiteFingerprint);
  const listeningReview = await loadListeningReview(
    listeningReviewPath,
    suiteId.suiteFingerprint,
    suiteId.sourceManifestFingerprint,
    developmentSources,
  );
  if (profileName === "canonical") requireApprovedListeningReview(listeningReview);
  const profile = suite.profiles[profileName];
  const effectiveSeedsPerBudget = explorationSeedsPerBudget ?? confirmationSeedsPerBudgetOverride ?? profile.seeds_per_budget;
  if (!exploration) {
    validateSubsetFlags({
      profileName,
      hasDeclaration: confirmationDeclarationPath !== undefined,
      seedsPerBudget: confirmationSeedsPerBudgetOverride,
      throughSeedSlot,
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
  const schedule = resolvedSeedSchedule(
    suite,
    profileName,
    profile.budgets,
    effectiveSeedsPerBudget,
    explorationSeedBase ?? canonicalSeedBaseOverride,
  );
  if (exploration) {
    const actualSeeds = schedule.byBudget.flatMap((entry) => entry.actualSeeds);
    if (actualSeeds.some((seed) => seed < 3_000_000_000 || seed >= 4_000_000_000)) {
      throw new Error(`exploration seed schedule exceeds its reserved [3000000000, 4000000000) range`);
    }
  }
  const engine = process.env.LR_ENGINE ?? "typescript";
  const implementationFingerprint = fingerprintFiles(RUNNER_IMPLEMENTATION_SOURCE_FILES);
  const execution = executionPolicyIdentity({
    suiteFingerprint: suiteId.suiteFingerprint,
    executionProtocol: BENCHMARK_EXECUTION_PROTOCOL,
    listeningReviewFingerprint: listeningReview.fingerprint,
    implementationFingerprint,
    engine,
    compiler: "compileHandoff",
    profile: profileName,
    budgets: [...profile.budgets],
    seedSchedule: schedule,
    sources: sources.map((source) => ({
      id: source.id,
      role: source.role,
      sourceFingerprint: source.sourceFingerprint,
    })),
    transform: suite.transform,
  });
  const git = compilerCandidateIdentity(engine);
  const runtime = {
    node: process.version,
    platform: platform(),
    architecture: arch(),
  };
  const linkedDevelopment = linkedDevelopmentPath === undefined
    ? undefined
    : archiveLink(linkedDevelopmentPath);
  const confirmationDeclaration = confirmationDeclarationPath === undefined
    ? undefined
    : archiveLink(confirmationDeclarationPath);
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
    confirmationDeclaration,
  });
  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(checkpointPath), { recursive: true });
  acquireRunLock(outputPath);
  if (throughSeedSlot !== undefined && existsSync(checkpointPath) && !hasFlag("resume")) {
    throw new Error(`wave execution must resume its attempt checkpoint; pass --resume`);
  }
  const restored = loadOrInitializeCheckpoint(checkpointPath, runPlanFingerprint, hasFlag("resume"));
  invalidatePublishedRunArtifacts(outputPath);
  const restoredByKey = new Map(restored.map((result) => [taskKey(result.task), result]));
  const pending = tasks.filter((task) => !restoredByKey.has(taskKey(task)));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const scoredProgress = restored.map((result) => scoreWorkerResult(
    result,
    suite,
    sourceById.get(result.task.sourceId)!,
    contracts.get(result.task.sourceId)!,
  ));
  const startedAt = performance.now();

  console.log(`Benchmark V2 ${mode} ${profileName}${exploration ? ` exploration ${explorationId}` : ""}`);
  console.log(
    `  ${tasks.length} compiles (${sources.length} sources, ${profile.budgets.length} budgets, ` +
    `${effectiveSeedsPerBudget} seed slots); ${restored.length} restored`,
  );
  console.log(
    `  suite ${suiteId.suiteFingerprint.slice(0, 16)}, policy ` +
    `${execution.executionPolicyFingerprint.slice(0, 16)}, audit ${audit.auditFingerprint.slice(0, 16)}`,
  );

  const fresh = await runWorkerPool(pending, jobs, (result) => {
    appendFileSync(checkpointPath, `${JSON.stringify({ type: "result", result })}\n`);
    const scored = scoreWorkerResult(
      result,
      suite,
      sourceById.get(result.task.sourceId)!,
      contracts.get(result.task.sourceId)!,
    );
    scoredProgress.push(scored);
    if (scoredProgress.length === tasks.length || scoredProgress.length % sources.length === 0) {
      printProgress(scoredProgress, tasks.length, profile.budgets, startedAt, restored.length);
    }
  });
  const allByKey = new Map([...restored, ...fresh].map((result) => [taskKey(result.task), result]));
  const results = tasks.map((task) => allByKey.get(taskKey(task))!);
  const workerFailures = results.filter((result) => result.status !== "ok").length;
  if (throughSeedSlot !== undefined && throughSeedSlot < effectiveSeedsPerBudget) {
    // Sub-depth wave: leave a partial-run summary (no archive/summary/sidecars)
    // recording progress and the shared checkpoint so a later wave can resume.
    const totalDeclaredTasks =
      schedule.byBudget.reduce((sum, entry) => sum + entry.actualSeeds.length, 0) * sources.length;
    const completedTasks = results.filter((result) => result.status === "ok").length;
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
  const scored = results.map((result) => scoreWorkerResult(
    result,
    suite,
    sourceById.get(result.task.sourceId)!,
    contracts.get(result.task.sourceId)!,
  ));
  const aggregateRuns: ScoredDevelopmentRun[] = scored.map((row) => ({
    sourceId: row.task.sourceId,
    budget: row.task.budget,
    seedSlot: row.task.seedSlot,
    actualSeed: row.task.actualSeed,
    score: row.score,
  }));
  const developmentSummaries = mode === "development"
    ? profile.budgets.map((budget) => summarizeDevelopmentBudget(aggregateRuns, budget, suite))
    : [];
  const headline = developmentSummaries.length === 0
    ? null
    : weightedBudgetHeadline(developmentSummaries, suite.budget_weights);
  const qualificationSummaries = mode === "qualification"
    ? profile.budgets.map((budget) => summarizeQualificationBudget(
      aggregateRuns,
      budget,
      sources.map((source) => source.id),
    ))
    : [];
  const qualificationMonitorScore = qualificationSummaries.length === 0
    ? null
    : weightedMonitorScore(qualificationSummaries, suite.budget_weights);
  const archive = bindDecisionIndexArchive({
    schema: RUN_ARCHIVE_SCHEMA,
    mode,
    profile: profileName,
    generatedAt: new Date().toISOString(),
    identity: {
      ...suiteId,
      ...execution,
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
    confirmationDeclaration,
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
    runs: scored,
  });
  const failed = workerFailures > 0;
  const { archiveOut, summaryPath, archiveSha256, compressedArchiveSha256 } =
    await writeArchiveArtifacts(outputPath, archiveChunks(archive), failed);
  const decisionIndexPath = `${archiveOut}.decision-index.json`;
  if (!failed) writeDecisionIndexArtifacts(archiveOut, archive, archiveSha256, compressedArchiveSha256);
  writeFileAtomicDurable(summaryPath, `${JSON.stringify({
    schema: SUMMARY_SCHEMA,
    mode,
    profile: profileName,
    generatedAt: archive.generatedAt,
    archive: relativeToCwd(archiveOut),
    compressedArchive: relativeToCwd(`${archiveOut}.gz`),
    archiveSha256,
    compressedArchiveSha256,
    suiteFingerprint: suiteId.suiteFingerprint,
    executionPolicyFingerprint: execution.executionPolicyFingerprint,
    executionProtocol: execution.executionProtocol,
    implementationFingerprint: execution.implementationFingerprint,
    listeningReviewFingerprint: listeningReview.fingerprint,
    listeningReviewStatus: listeningReview.review.status,
    seedSchedule: schedule,
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
    confirmationDeclaration,
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

  for (const budget of profile.budgets) {
    const rows = scored.filter((row) => row.task.budget === budget);
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
    runs: archive.runs.map((row) => ({
      status: row.status,
      task: row.task,
      source: row.source,
      authoredContacts: row.authoredContacts,
      score: row.score,
      rawReportSha256: sha256(JSON.stringify(row.report)),
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
  return throughSeedSlot === undefined
    ? tasks
    : tasks.filter((task) => task.seedSlot < throughSeedSlot);
}

/**
 * Guards the wave-execution flags. `--seeds-per-budget` and `--through-seed-slot`
 * are reserved for a predeclared canonical confirmation, exactly like
 * `--canonical-seed-base`: both require the canonical profile and a confirmation
 * declaration. The through-slot must be a positive integer no deeper than the
 * effective seed depth.
 */
export function validateSubsetFlags(input: {
  profileName: "probe" | "canonical";
  hasDeclaration: boolean;
  seedsPerBudget: number | undefined;
  throughSeedSlot: number | undefined;
  effectiveDepth: number;
}): void {
  const { profileName, hasDeclaration, seedsPerBudget, throughSeedSlot, effectiveDepth } = input;
  if (seedsPerBudget === undefined && throughSeedSlot === undefined) return;
  if (profileName !== "canonical" || !hasDeclaration) {
    throw new Error(`--seeds-per-budget and --through-seed-slot are reserved for a predeclared canonical confirmation`);
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
}

export function validateExplorationFlags(input: {
  exploration: boolean;
  explorationId: string | undefined;
  mode: RunnerMode;
  profileName: "probe" | "canonical";
  hasDeclaration: boolean;
  canonicalSeedBaseOverride: number | undefined;
  confirmationSeedsPerBudgetOverride: number | undefined;
  explorationSeedBase: number | undefined;
  explorationSeedsPerBudget: number | undefined;
  throughSeedSlot: number | undefined;
}): void {
  const hasExplorationArgument =
    input.explorationId !== undefined || input.explorationSeedBase !== undefined ||
    input.explorationSeedsPerBudget !== undefined;
  if (!input.exploration) {
    if (hasExplorationArgument) throw new Error(`exploration arguments require --exploration`);
    return;
  }
  if (
    input.mode !== "development" || input.profileName !== "probe" || input.hasDeclaration ||
    input.canonicalSeedBaseOverride !== undefined || input.confirmationSeedsPerBudgetOverride !== undefined ||
    input.throughSeedSlot !== undefined
  ) {
    throw new Error(`exploration is development-only and cannot use canonical confirmation or wave arguments`);
  }
  if (input.explorationId === undefined || !/^[a-zA-Z0-9][a-zA-Z0-9_.\/-]{0,127}$/.test(input.explorationId)) {
    throw new Error(`--exploration-id must be a non-empty stable identifier`);
  }
  if (
    input.explorationSeedBase === undefined || input.explorationSeedsPerBudget === undefined ||
    !Number.isSafeInteger(input.explorationSeedsPerBudget) || input.explorationSeedsPerBudget < 2 ||
    input.explorationSeedsPerBudget > 16
  ) {
    throw new Error(`exploration requires a seed base and 2..16 seeds per budget`);
  }
  if (input.explorationSeedBase < 3_000_000_000 || input.explorationSeedBase >= 4_000_000_000) {
    throw new Error(`exploration seed bases must be in the reserved [3000000000, 4000000000) range`);
  }
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
): Promise<WorkerResult[]> {
  const results = new Array<WorkerResult>(tasks.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next++;
      if (index >= tasks.length) return;
      const result = await runTask(tasks[index]);
      results[index] = result;
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
    const meanScore = current.length === 0
      ? 0
      : current.reduce((sum, row) => sum + row.score.score, 0) / current.length;
    return `${budget / 1000}k ${current.length}:${meanScore.toFixed(1)}`;
  }).join(" | ");
  console.log(
    `  [${rows.length}/${total}] valid ${valid}, ${rate.toFixed(2)} runs/s, ETA ${formatDuration(etaSeconds)}; ${budgetText}`,
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

export { compilerCandidateIdentity } from "./compiler_identity.ts";

function archiveLink(path: string): { path: string; sha256: string } {
  return { path: relativeToCwd(path), sha256: sha256(readFileSync(path)) };
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
 * serialization removes the WRITE-side cap at any depth; the read side stays
 * a single-string parse and is comfortable through depth 48 (a streaming
 * reader is v2 debt for deeper rows).
 */
export function* archiveChunks(archive: Record<string, unknown> & { runs: unknown[] }): Generator<string> {
  const skeleton = `${JSON.stringify({ ...archive, runs: [] }, null, 2)}\n`;
  const marker = `"runs": []`;
  const markerIndex = skeleton.lastIndexOf(marker);
  if (markerIndex < 0) throw new Error(`archive skeleton lost its runs marker`);
  yield skeleton.slice(0, markerIndex + marker.length - 1);
  for (let index = 0; index < archive.runs.length; index++) {
    yield `${index === 0 ? "" : ","}\n    ${JSON.stringify(archive.runs[index])}`;
  }
  if (archive.runs.length > 0) yield "\n  ";
  yield skeleton.slice(markerIndex + marker.length - 1);
}

/**
 * A failed run must never look complete on disk: the archive lands at a
 * .failed path with NO checksum sidecars (decision loaders require the
 * sidecar, so it cannot be consumed accidentally); the checkpoint is kept
 * so --resume retries the failures.
 */
export async function writeArchiveArtifacts(
  outputPath: string,
  chunks: Iterable<string | Buffer>,
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
  for (const chunk of chunks) {
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
 * processes; it is removed on any exit.
 */
export function acquireRunLock(outputPath: string): void {
  const lockPath = `${outputPath}.lock`;
  const payload = `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`;
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
  process.on("exit", () => {
    rmSync(lockPath, { force: true });
  });
}

function readLockHolder(lockPath: string): { pid: number; startedAt: string } {
  const holder = JSON.parse(readFileSync(lockPath, "utf8"));
  if (!Number.isInteger(holder.pid) || typeof holder.startedAt !== "string") {
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
    const { track, report, stats } = compileHandoff(spec, task.actualSeed, { budget: task.budget });
    const trackHash = sha256(JSON.stringify(track));
    parentPort!.postMessage({
      status: "ok",
      task,
      elapsedMs: performance.now() - started,
      report,
      stats,
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
