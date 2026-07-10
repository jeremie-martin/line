import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism, arch, cpus, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { applyJolt } from "../../produce/seed.ts";
import { compilerWorkerTimeoutMs } from "../golden_suite.ts";
import { compileHandoff } from "../optimizer/handoff.ts";
import type { CompileStats, DriftReport, Spec } from "../types.ts";
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
  HARNESS_SOURCE_FILES,
  canonicalMembers,
  executionPolicyIdentity,
  fingerprintFiles,
  loadSuiteManifest,
  resolvedSeedSchedule,
  sourceInventoryFingerprint,
  suiteIdentity,
} from "./suite_model.ts";

export const RUN_ARCHIVE_SCHEMA = "line.benchmark-v2.run-archive.v2" as const;
const CHECKPOINT_SCHEMA = "line.benchmark-v2.checkpoint.v1" as const;
const SUMMARY_SCHEMA = "line.benchmark-v2.run-summary.v1" as const;

type RunnerMode = "development" | "qualification";

type WorkerTask = {
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
  archiveSha256: string;
  compressedArchiveSha256: string;
  headline: number | null;
  qualificationMonitorScore: number | null;
  workerFailures: number;
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
  const profile = suite.profiles[profileName];
  const sources = mode === "qualification" ? qualificationSources : developmentSources;
  if (mode === "development") {
    const selected = canonicalMembers(suite);
    if (selected.length !== sources.length || selected.some((id) => !sources.some((source) => source.id === id))) {
      throw new Error(`development source scope does not match the canonical suite`);
    }
  }
  const schedule = resolvedSeedSchedule(suite, profile.budgets, profile.seeds_per_budget);
  const engine = process.env.LR_ENGINE ?? "typescript";
  const harnessFingerprint = fingerprintFiles(HARNESS_SOURCE_FILES);
  const execution = executionPolicyIdentity({
    suiteFingerprint: suiteId.suiteFingerprint,
    harnessFingerprint,
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
  const git = gitIdentity(engine);
  const linkedDevelopment = linkedDevelopmentPath === undefined
    ? undefined
    : archiveLink(linkedDevelopmentPath);
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

  const tasks = schedule.byBudget.flatMap(({ budget, actualSeeds }) =>
    actualSeeds.flatMap((actualSeed, seedSlot) => sources.map((source) => ({
      mode,
      sourceId: source.id,
      budget,
      seedSlot,
      actualSeed,
      joltMs: suite.transform.jolt_ms,
      sourceManifestPath,
      heldoutManifestPath,
    })))
  );
  const runPlanFingerprint = sha256(JSON.stringify({
    executionPolicyFingerprint: execution.executionPolicyFingerprint,
    characterizationFingerprint: characterization.dataFingerprint,
    auditFingerprint: audit.auditFingerprint,
    candidateReviewFingerprint: sourceInventoryFingerprint(reviewContents),
    compilerSourceFingerprint: git.compilerSourceFingerprint,
    linkedDevelopment,
  }));
  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(checkpointPath), { recursive: true });
  const restored = loadOrInitializeCheckpoint(checkpointPath, runPlanFingerprint, hasFlag("resume"));
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

  console.log(`Benchmark V2 ${mode} ${profileName}`);
  console.log(
    `  ${tasks.length} compiles (${sources.length} sources, ${profile.budgets.length} budgets, ` +
    `${profile.seeds_per_budget} seed slots); ${restored.length} restored`,
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
  const archive = {
    schema: RUN_ARCHIVE_SCHEMA,
    mode,
    profile: profileName,
    generatedAt: new Date().toISOString(),
    identity: {
      ...suiteId,
      ...execution,
      candidateReviewFingerprint: sourceInventoryFingerprint(reviewContents),
      characterizationFingerprint: characterization.dataFingerprint,
      auditFingerprint: audit.auditFingerprint,
      heldoutManifestFingerprint: characterization.heldoutManifestFingerprint,
      runPlanFingerprint,
    },
    git,
    environment: {
      node: process.version,
      platform: platform(),
      architecture: arch(),
      logicalCpus: cpus().length,
    },
    linkedDevelopment,
    canonicalHeadline: headline,
    qualificationMonitorScore,
    developmentSummaries,
    qualificationSummaries,
    sources: sources.map((source) => sourceArchiveIdentity(source)),
    runs: scored,
  };
  const archiveBytes = Buffer.from(`${JSON.stringify(archive, null, 2)}\n`);
  const archiveSha256 = sha256(archiveBytes);
  const compressedBytes = gzipSync(archiveBytes, { level: 9 });
  const compressedArchiveSha256 = sha256(compressedBytes);
  writeFileSync(outputPath, archiveBytes);
  writeFileSync(`${outputPath}.gz`, compressedBytes);
  writeFileSync(`${outputPath}.sha256`, `${archiveSha256}  ${relativeToCwd(outputPath)}\n`);
  writeFileSync(`${outputPath}.gz.sha256`, `${compressedArchiveSha256}  ${relativeToCwd(`${outputPath}.gz`)}\n`);
  const summaryPath = `${outputPath}.summary.json`;
  writeFileSync(summaryPath, `${JSON.stringify({
    schema: SUMMARY_SCHEMA,
    mode,
    profile: profileName,
    generatedAt: archive.generatedAt,
    archive: relativeToCwd(outputPath),
    compressedArchive: relativeToCwd(`${outputPath}.gz`),
    archiveSha256,
    compressedArchiveSha256,
    suiteFingerprint: suiteId.suiteFingerprint,
    executionPolicyFingerprint: execution.executionPolicyFingerprint,
    compilerSourceFingerprint: git.compilerSourceFingerprint,
    compilerEnvironment: git.compilerEnvironment,
    engineArtifactFingerprint: git.engineArtifactFingerprint,
    candidateFingerprint: git.candidateFingerprint,
    canonicalHeadline: headline,
    qualificationMonitorScore,
    developmentSummaries,
    qualificationSummaries,
    linkedDevelopment,
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
  console.log(`  archive: ${relativeToCwd(outputPath)} (${archiveSha256.slice(0, 16)})`);
  console.log(`  compressed: ${relativeToCwd(`${outputPath}.gz`)}`);
  console.log(`  summary: ${relativeToCwd(summaryPath)}`);
  const workerFailures = results.filter((result) => result.status !== "ok").length;
  if (workerFailures > 0) process.exitCode = 1;
  return {
    mode,
    outputPath,
    summaryPath,
    archiveSha256,
    compressedArchiveSha256,
    headline,
    qualificationMonitorScore,
    workerFailures,
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
      done({
        status: "error",
        task,
        elapsedMs: performance.now() - started,
        error: error.stack ?? error.message,
        authoredContacts: 0,
      });
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

function loadOrInitializeCheckpoint(
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
  const results = lines.slice(1).filter((row) => row.type === "result").map((row) => row.result as WorkerResult);
  const keys = results.map((result) => taskKey(result.task));
  if (new Set(keys).size !== keys.length) throw new Error(`checkpoint contains duplicate tasks`);
  return results;
}

function gitIdentity(engine: string): {
  head: string;
  compilerDiffSha256: string;
  compilerSourceFingerprint: string;
  compilerEnvironment: Record<string, string>;
  engineArtifactFingerprint: string | null;
  candidateFingerprint: string;
  trackedChanges: string[];
} {
  const git = (args: string[]): string => execFileSync("git", args, { encoding: "utf8" }).trimEnd();
  const compilerPaths = ["scripts/v0/optimizer", "scripts/v0/core", "scripts/v0/types.ts", "engine-rs"];
  const compilerDiff = git(["diff", "--binary", "HEAD", "--", ...compilerPaths]);
  const compilerFiles = git([
    "ls-files", "--cached", "--others", "--exclude-standard", "--", ...compilerPaths,
  ]).split("\n").filter(Boolean);
  const compilerSourceFingerprint = fingerprintFiles(compilerFiles);
  const compilerEnvironment = Object.fromEntries(
    Object.entries(process.env)
      .filter(([name, value]) => name.startsWith("LR_") && name !== "LR_ENGINE" && value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)) as Array<[string, string]>,
  );
  const engineArtifactPath = engine === "wasm"
    ? "engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm"
    : null;
  const engineArtifactFingerprint = engineArtifactPath !== null && existsSync(engineArtifactPath)
    ? sha256(readFileSync(engineArtifactPath))
    : null;
  const candidateFingerprint = sha256(JSON.stringify({
    compilerSourceFingerprint,
    compilerEnvironment,
    engine,
    engineArtifactFingerprint,
  }));
  return {
    head: git(["rev-parse", "HEAD"]),
    compilerDiffSha256: sha256(compilerDiff),
    compilerSourceFingerprint,
    compilerEnvironment,
    engineArtifactFingerprint,
    candidateFingerprint,
    trackedChanges: git(["status", "--short"]).split("\n").filter(Boolean),
  };
}

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
