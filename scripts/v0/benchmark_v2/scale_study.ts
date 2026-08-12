import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  appendFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { arch, availableParallelism, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { finished } from "node:stream/promises";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { createGzip } from "node:zlib";
import { applyJolt } from "../../produce/seed.ts";
import { compilerWorkerTimeoutMs } from "../golden_suite.ts";
import { compileHandoff } from "../optimizer/handoff.ts";
import type { CompileStats, DriftReport } from "../types.ts";
import type {
  BudgetTelemetryLevel,
  CompileBudgetTelemetry,
} from "../optimizer/budget_telemetry.ts";
import {
  buildAxisContract,
  scoreV2Report,
  summarizeDevelopmentBudget,
  type ScoredDevelopmentRun,
  type V2RunScore,
} from "./evaluator.ts";
import {
  loadSourceManifest,
  loadSourceSpec,
  resolveSources,
  type ResolvedSource,
} from "./model.ts";
import { fingerprintFiles, loadSuiteManifest, suiteIdentity } from "./suite_model.ts";
import { compilerCandidateIdentity } from "./compiler_identity.ts";
import { latestSuccessfulResults } from "./checkpoint_model.ts";
import {
  assertMultiBudgetExecutionScope,
  FROZEN_SCALE_STUDY_SCHEMA,
  loadMultiBudgetProfile,
  multiBudgetSeeds,
  resolveMultiBudgetSources,
  summarizeScalePanel,
  type LoadedMultiBudgetProfile,
  type ScaleScoredRun,
} from "./scale_profile.ts";
import { scaleAnalysisRun } from "./scale_analysis_projection.ts";

type StudyTask = {
  sourceId: string;
  budget: number;
  seedSlot: number;
  actualSeed: number;
  joltMs: number;
  sourceManifestPath: string;
  budgetTelemetryLevel: BudgetTelemetryLevel;
  searchPolicyBudget?: number;
  repairBudget?: number;
  resumePolicy?: "legacy" | "none" | "remainder-aware";
  nCandExponent?: number;
  nCandPolicy?:
    | "high-budget-three-quarter"
    | "repair-high-budget-three-quarter"
    | "repair-three-quarter"
    | "repair-seven-eighth"
    | "linear-cap-216";
  repairPolicy?: "protected-one-step-bridge" | "optimistic-axis-bound-bridge";
  repairSelectionPolicy?: "reserve-cheapest-repair" | "reserve-cheapest-else-deepest";
};

type StudyWorkerResult = {
  task: StudyTask;
  status: "ok" | "error" | "timeout";
  elapsedMs: number;
  authoredContacts: number;
  report?: DriftReport;
  stats?: CompileStats;
  budgetTelemetry?: CompileBudgetTelemetry | null;
  trackHash?: string;
  error?: string;
};

const STUDY_CHECKPOINT_SCHEMA = "line.benchmark-v2.budget-scale-checkpoint.v1" as const;

if (isMainThread) await main();
else await workerMain(workerData as StudyTask);

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const argument = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  };
  const hasFlag = (name: string): boolean => args.includes(`--${name}`);
  const scaleProfile = argument("scale-profile") === undefined
    ? null
    : loadMultiBudgetProfile(argument("scale-profile")!);
  const budgets = integerList(
    argument("budgets") ?? scaleProfile?.profile.budgets.map((budget) => budget.frames).join(",") ??
      "100000,200000,250000,500000,600000,1000000",
    "budgets",
  );
  const seeds = integerList(
    argument("seeds") ?? (scaleProfile === null
      ? "0"
      : multiBudgetSeeds(scaleProfile.profile, scaleProfile.profile.seedSchedule.defaultSeeds).join(",")),
    "seeds",
    true,
  );
  if (scaleProfile !== null) assertMultiBudgetExecutionScope(scaleProfile.profile, budgets, seeds);
  const jobs = positiveInteger(argument("jobs") ?? String(Math.min(32, Math.max(1, availableParallelism() / 2))), "jobs");
  const budgetTelemetryLevel = telemetryLevel(argument("budget-telemetry") ?? "summary");
  const searchPolicyBudget = optionalPositiveInteger(
    argument("search-policy-budget"),
    "search-policy-budget",
  );
  const repairBudget = optionalPositiveInteger(argument("repair-budget"), "repair-budget");
  const resumePolicy = parseResumePolicy(argument("resume-policy"));
  const nCandExponent = optionalFraction(argument("ncand-exponent"), "ncand-exponent");
  const nCandPolicy = parseNCandPolicy(argument("ncand-policy"));
  const repairPolicy = parseRepairPolicy(argument("repair-policy"));
  const repairSelectionPolicy = parseRepairSelectionPolicy(argument("repair-selection-policy"));
  if (nCandExponent !== undefined && nCandPolicy !== undefined) {
    throw new Error("--ncand-exponent and --ncand-policy are mutually exclusive");
  }
  if (searchPolicyBudget !== undefined && budgets.some((budget) => searchPolicyBudget > budget)) {
    throw new Error("--search-policy-budget may not exceed any requested execution budget");
  }
  if (repairBudget !== undefined && budgets.some((budget) => repairBudget > budget)) {
    throw new Error("--repair-budget may not exceed any requested execution budget");
  }
  const sourceManifestPath = resolve(argument("manifest") ?? "benchmark/v2/compat/source-manifest.json");
  const suiteManifestPath = resolve(argument("suite") ?? "benchmark/v2/compat/suite-manifest.json");
  const outputPath = resolve(argument("out") ?? "generated/benchmark-v2/studies/budget-scale.json");
  const checkpointPath = resolve(argument("checkpoint") ?? `${outputPath}.checkpoint.jsonl`);
  const importCheckpointPath = argument("import-checkpoint") === undefined
    ? undefined
    : resolve(argument("import-checkpoint")!);
  const allSources = resolveSources(loadSourceManifest(sourceManifestPath));
  const suite = loadSuiteManifest(suiteManifestPath, allSources);
  const sources = scaleProfile === null
    ? allSources
    : resolveMultiBudgetSources(scaleProfile.profile, allSources);
  const identity = suiteIdentity(suiteManifestPath, sourceManifestPath, sources);
  const contracts = new Map<string, ReturnType<typeof buildAxisContract>>();
  for (const source of sources) {
    const spec = applyJolt(await loadSourceSpec(source), suite.transform.jolt_ms);
    contracts.set(source.id, buildAxisContract(spec, source.eligibleComponents, source.diagnosticComponents));
  }
  const tasks = budgets.flatMap((budget) => seeds.flatMap((actualSeed, seedSlot) => sources.map((source) => ({
    sourceId: source.id,
    budget,
    seedSlot,
    actualSeed,
    joltMs: suite.transform.jolt_ms,
    budgetTelemetryLevel,
    searchPolicyBudget,
    repairBudget,
    resumePolicy,
    nCandExponent,
    nCandPolicy,
    repairPolicy,
    repairSelectionPolicy,
    sourceManifestPath,
  }))));
  const engine = process.env.LR_ENGINE ?? "typescript";
  const candidate = { ...compilerCandidateIdentity(engine), engine };
  const runtime = {
    node: process.version,
    platform: platform(),
    architecture: arch(),
  };
  const planInput = {
    suiteFingerprint: identity.suiteFingerprint,
    candidateFingerprint: candidate.candidateFingerprint as string,
    runtime,
    budgets,
    seeds,
    joltMs: suite.transform.jolt_ms,
    budgetTelemetryLevel,
    searchPolicyBudget,
    repairBudget,
    resumePolicy,
    nCandExponent,
    nCandPolicy,
    repairPolicy,
    repairSelectionPolicy,
    scaleProfileFingerprint: scaleProfile?.fingerprint,
    sources: sources.map((source) => ({ id: source.id, fingerprint: source.sourceFingerprint })),
  };
  const planFingerprint = studyPlanFingerprint(planInput);
  mkdirSync(dirname(outputPath), { recursive: true });
  const imported = importCheckpointPath === undefined ? [] : await importCheckpoint(
    importCheckpointPath,
    studyPlanFingerprint({
      ...planInput,
      budgets: integerList(argument("import-budgets") ?? "", "import-budgets"),
      seeds: integerList(argument("import-seeds") ?? seeds.join(","), "import-seeds", true),
    }),
    new Set(tasks.map(taskKey)),
  );
  const restored = await loadOrInitializeCheckpoint(
    checkpointPath,
    planFingerprint,
    hasFlag("resume"),
    imported,
  );
  const restoredByKey = new Map(restored.map((result) => [taskKey(result.task), result]));
  const pending = tasks.filter((task) => !restoredByKey.has(taskKey(task)));
  console.log(scaleProfile === null
    ? `Benchmark V2 paired budget-scale study`
    : `Benchmark V2 ${scaleProfile.profile.id} multi-budget benchmark`);
  console.log(
    `  ${tasks.length} compiles; budgets ${budgets.join(", ")}; seeds ${seeds.join(", ")}; ` +
    `${restored.length} restored`,
  );
  const started = performance.now();
  let completed = restored.length;
  const fresh = await runPool(pending, jobs, (result) => {
    appendFileSync(checkpointPath, `${JSON.stringify({ type: "result", result })}\n`);
    completed++;
    if (completed === tasks.length || completed % Math.max(1, sources.length) === 0) {
      const elapsed = (performance.now() - started) / 1000;
      const rate = (completed - restored.length) / Math.max(0.001, elapsed);
      console.log(`  ${completed}/${tasks.length}; ${(100 * completed / tasks.length).toFixed(0)}%; ${rate.toFixed(2)} runs/s`);
    }
  });
  const resultsByKey = new Map([...restored, ...fresh].map((result) => [taskKey(result.task), result]));
  const workerResults = tasks.map((task) => resultsByKey.get(taskKey(task))!);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const scored = workerResults.map((result) => {
    const source = sourceById.get(result.task.sourceId)!;
    const score = result.status === "ok"
      ? scoreV2Report(result.report!, result.authoredContacts, contracts.get(source.id)!, suite)
      : failedScore(result);
    return {
      task: result.task,
      source: {
        id: source.id,
        originFamily: source.originFamily,
        sourceFingerprint: source.sourceFingerprint,
        eligibleComponents: source.eligibleComponents,
        diagnosticComponents: source.diagnosticComponents,
      },
      elapsedMs: result.elapsedMs,
      status: result.status,
      error: result.error,
      authoredContacts: result.authoredContacts,
      report: result.report ?? null,
      trackHash: result.trackHash ?? null,
      score,
      stats: result.stats,
      budgetTelemetry: result.budgetTelemetry ?? null,
      phaseResults: result.status === "ok" ? phases(source, result.report!) : [],
    };
  });
  const scaleRuns = scored.map((row): ScaleScoredRun => ({
    sourceId: row.task.sourceId,
    budget: row.task.budget,
    actualSeed: row.task.actualSeed,
    score: row.score,
  }));
  const scalePanel = scaleProfile === null ? null : summarizeScalePanel(scaleRuns, scaleProfile.profile);
  const summaries = scalePanel?.budgets ?? budgets.map((budget) => summarizeDevelopmentBudget(
    scored.filter((row) => row.task.budget === budget).map((row): ScoredDevelopmentRun => ({
      sourceId: row.task.sourceId,
      budget: row.task.budget,
      seedSlot: row.task.seedSlot,
      actualSeed: row.task.actualSeed,
      score: row.score,
    })),
    budget,
    suite,
  ));
  const report = {
    schema: scaleProfile === null
      ? "line.benchmark-v2.budget-scale-study.v2"
      : FROZEN_SCALE_STUDY_SCHEMA,
    generatedAt: new Date().toISOString(),
    note: scaleProfile === null
      ? "Exploratory paired-seed study. Not a canonical headline or candidate decision."
      : "Frozen compact multi-budget benchmark execution. scaleHeadline is separate from the canonical V2 headline.",
    suiteFingerprint: identity.suiteFingerprint,
    sourceManifestFingerprint: identity.sourceManifestFingerprint,
    scoringProtocolFingerprint: identity.scoringProtocolFingerprint,
    scorerFingerprint: fingerprintFiles([
      "scripts/v0/benchmark_v2/evaluator.ts",
      "scripts/v0/benchmark_v2/score_model.ts",
      "scripts/v0/score.ts",
      ...(scaleProfile === null
        ? []
        : ["scripts/v0/benchmark_v2/scale_profile.ts", relative(scaleProfile.path)]),
    ]),
    transform: suite.transform,
    candidate,
    environment: runtime,
    budgets,
    seeds,
    budgetTelemetryLevel,
    searchPolicyBudget,
    repairBudget,
    resumePolicy,
    nCandExponent,
    nCandPolicy,
    repairPolicy,
    repairSelectionPolicy,
    scaleProfile: scaleProfileReport(scaleProfile),
    scaleHeadline: scalePanel?.scaleHeadline ?? null,
    summaries,
    runs: scored,
  };
  const fullArchive = await writeScaleReportStreaming(outputPath, report);
  const analysisPath = outputPath.endsWith(".json")
    ? outputPath.slice(0, -".json".length) + ".analysis.json"
    : `${outputPath}.analysis.json`;
  await writeScaleReportStreaming(analysisPath, {
    ...report,
    analysisProjection: {
      schema: "line.benchmark-v2.scale-analysis-projection.v1",
      fullArchivePath: relative(outputPath),
      fullArchiveSha256: fullArchive.rawSha256,
      omitted: [
        "raw drift report",
        "compile stats except repair target-search mechanics",
        "repair considered-target observations",
        "repair track-identity hashes",
        "budget-telemetry node events",
      ],
    },
    runs: scored.map(scaleAnalysisRun),
  });
  for (const summary of summaries) {
    const invalid = scored.filter((row) => row.task.budget === summary.budget && !row.score.valid)
      .map((row) => row.task.sourceId);
    console.log(`  ${summary.budget / 1000}k: ${summary.score.toFixed(2)}, valid ${summary.validRuns}/${summary.totalRuns}` +
      (invalid.length === 0 ? "" : `, invalid ${[...new Set(invalid)].join(", ")}`));
  }
  console.log(`  output ${relative(outputPath)}`);
}

async function loadOrInitializeCheckpoint(
  path: string,
  planFingerprint: string,
  resume: boolean,
  imported: StudyWorkerResult[],
): Promise<StudyWorkerResult[]> {
  mkdirSync(dirname(path), { recursive: true });
  if (!resume || !existsSync(path)) {
    writeFileSync(path, `${JSON.stringify({ schema: STUDY_CHECKPOINT_SCHEMA, planFingerprint })}\n`);
    for (const result of imported) appendFileSync(path, `${JSON.stringify({ type: "result", result })}\n`);
    return imported;
  }
  return loadCheckpointResults(path, planFingerprint);
}

async function importCheckpoint(
  path: string,
  expectedPlanFingerprint: string,
  targetKeys: Set<string>,
): Promise<StudyWorkerResult[]> {
  const imported = (await loadCheckpointResults(path, expectedPlanFingerprint))
    .filter((result) => targetKeys.has(taskKey(result.task)));
  return imported;
}

async function loadCheckpointResults(
  path: string,
  expectedPlanFingerprint: string,
): Promise<StudyWorkerResult[]> {
  const results: StudyWorkerResult[] = [];
  const lines = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let headerSeen = false;
  for await (const line of lines) {
    if (line === "") continue;
    const entry = JSON.parse(line);
    if (!headerSeen) {
      headerSeen = true;
      if (entry?.schema !== STUDY_CHECKPOINT_SCHEMA ||
          entry.planFingerprint !== expectedPlanFingerprint) {
        throw new Error(`study checkpoint does not match the current catalog, compiler, budgets, and seeds`);
      }
      continue;
    }
    if (entry?.type === "result") results.push(entry.result as StudyWorkerResult);
  }
  if (!headerSeen) {
    throw new Error(`study checkpoint does not match the current catalog, compiler, budgets, and seeds`);
  }
  return latestSuccessfulResults(results, (result) => taskKey(result.task));
}

/** Write the large run array incrementally. V8 strings have a ~512 MiB limit,
 * so a telemetry-rich 16-seed scale archive cannot pass through one
 * JSON.stringify(report) call even when the process has ample free memory. */
async function writeScaleReportStreaming(
  outputPath: string,
  report: Record<string, unknown> & { runs: unknown[] },
): Promise<{ rawSha256: string; compressedSha256: string }> {
  const compressedPath = `${outputPath}.gz`;
  const rawOutput = createWriteStream(outputPath, { flags: "w" });
  const compressedOutput = createWriteStream(compressedPath, { flags: "w" });
  const gzip = createGzip({ level: 9 });
  const rawHash = createHash("sha256");
  const compressedHash = createHash("sha256");
  gzip.on("data", (chunk: Buffer) => compressedHash.update(chunk));
  gzip.pipe(compressedOutput);
  const write = async (text: string): Promise<void> => {
    const bytes = Buffer.from(text);
    rawHash.update(bytes);
    if (!rawOutput.write(bytes)) await once(rawOutput, "drain");
    if (!gzip.write(bytes)) await once(gzip, "drain");
  };
  try {
    const { runs, ...metadata } = report;
    const metadataJson = JSON.stringify(metadata, null, 2);
    if (!metadataJson.endsWith("\n}")) throw new Error("scale report metadata is not an object");
    await write(`${metadataJson.slice(0, -2)},\n  "runs": [\n`);
    for (let index = 0; index < runs.length; index++) {
      const row = JSON.stringify(runs[index], null, 2)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n");
      await write(`${index === 0 ? "" : ",\n"}${row}`);
    }
    await write("\n  ]\n}\n");
    rawOutput.end();
    gzip.end();
    await Promise.all([finished(rawOutput), finished(gzip), finished(compressedOutput)]);
  } catch (error) {
    rawOutput.destroy();
    gzip.destroy();
    compressedOutput.destroy();
    throw error;
  }
  const rawSha256 = rawHash.digest("hex");
  const compressedSha256 = compressedHash.digest("hex");
  writeFileSync(
    `${outputPath}.sha256`,
    `${rawSha256}  ${relative(outputPath)}\n`,
  );
  writeFileSync(
    `${compressedPath}.sha256`,
    `${compressedSha256}  ${relative(compressedPath)}\n`,
  );
  return { rawSha256, compressedSha256 };
}

function studyPlanFingerprint(input: {
  suiteFingerprint: string;
  candidateFingerprint: string;
  runtime: { node: string; platform: string; architecture: string };
  budgets: number[];
  seeds: number[];
  joltMs: number;
  budgetTelemetryLevel: BudgetTelemetryLevel;
  searchPolicyBudget?: number;
  repairBudget?: number;
  resumePolicy?: "legacy" | "none" | "remainder-aware";
  nCandExponent?: number;
  nCandPolicy?:
    | "high-budget-three-quarter"
    | "repair-high-budget-three-quarter"
    | "repair-three-quarter"
    | "repair-seven-eighth"
    | "linear-cap-216";
  repairPolicy?: "protected-one-step-bridge" | "optimistic-axis-bound-bridge";
  repairSelectionPolicy?: "reserve-cheapest-repair" | "reserve-cheapest-else-deepest";
  scaleProfileFingerprint?: string;
  sources: Array<{ id: string; fingerprint: string }>;
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function scaleProfileReport(binding: LoadedMultiBudgetProfile | null): Record<string, unknown> | null {
  if (binding === null) return null;
  return {
    path: relative(binding.path),
    fingerprint: binding.fingerprint,
    definition: binding.profile,
  };
}

function taskKey(task: StudyTask): string {
  return [
    task.sourceId,
    task.budget,
    task.seedSlot,
    task.actualSeed,
    task.searchPolicyBudget ?? "inherit",
    task.repairBudget ?? "inherit",
    task.resumePolicy ?? "legacy",
    task.nCandExponent ?? "production",
    task.nCandPolicy ?? "production",
    task.repairPolicy ?? "production",
    task.repairSelectionPolicy ?? "production",
  ].join("\0");
}

async function runPool(
  tasks: StudyTask[],
  jobs: number,
  onResult: (result: StudyWorkerResult) => void,
): Promise<StudyWorkerResult[]> {
  const results = new Array<StudyWorkerResult>(tasks.length);
  let next = 0;
  const run = async (): Promise<void> => {
    for (;;) {
      const index = next++;
      if (index >= tasks.length) return;
      const result = await runTask(tasks[index]);
      results[index] = result;
      onResult(result);
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, tasks.length) }, run));
  return results;
}

function runTask(task: StudyTask): Promise<StudyWorkerResult> {
  return new Promise((done) => {
    const started = performance.now();
    const worker = new Worker(new URL(import.meta.url), { workerData: task, resourceLimits: { maxOldGenerationSizeMb: 3072 } });
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      const result: StudyWorkerResult = {
        task,
        status: "timeout",
        elapsedMs: performance.now() - started,
        authoredContacts: 0,
        error: "worker exceeded timeout",
      };
      void worker.terminate().then(() => done(result), () => done(result));
    }, compilerWorkerTimeoutMs(task.budget));
    worker.once("message", (result: StudyWorkerResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      void worker.terminate().then(() => done(result), () => done(result));
    });
    worker.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const result: StudyWorkerResult = {
        task,
        status: "error",
        elapsedMs: performance.now() - started,
        authoredContacts: 0,
        error: error.stack ?? error.message,
      };
      void worker.terminate().then(() => done(result), () => done(result));
    });
  });
}

async function workerMain(task: StudyTask): Promise<void> {
  const started = performance.now();
  let authoredContacts = 0;
  try {
    if (task.nCandExponent === undefined) delete process.env.LR_STUDY_NCAND_EXPONENT;
    else process.env.LR_STUDY_NCAND_EXPONENT = String(task.nCandExponent);
    if (task.nCandPolicy === undefined) delete process.env.LR_STUDY_NCAND_POLICY;
    else process.env.LR_STUDY_NCAND_POLICY = task.nCandPolicy;
    if (task.repairPolicy === undefined) delete process.env.LR_REPAIR_REJECTED_LOCAL_BRIDGE;
    else process.env.LR_REPAIR_REJECTED_LOCAL_BRIDGE = task.repairPolicy ===
        "optimistic-axis-bound-bridge"
      ? "optimistic-axis-bound"
      : "1";
    if (task.repairSelectionPolicy === undefined) delete process.env.LR_REPAIR_SELECTION_POLICY;
    else process.env.LR_REPAIR_SELECTION_POLICY = task.repairSelectionPolicy;
    const sources = resolveSources(loadSourceManifest(task.sourceManifestPath));
    const source = sources.find((entry) => entry.id === task.sourceId);
    if (source === undefined) throw new Error(`${task.sourceId}: source unavailable`);
    const base = await loadSourceSpec(source);
    authoredContacts = base.contacts.length;
    const spec = applyJolt(base, task.joltMs);
    const { track, report, stats, budgetTelemetry } = compileHandoff(spec, task.actualSeed, {
      budget: task.budget,
      budgetTelemetry: task.budgetTelemetryLevel,
      searchPolicyBudget: task.searchPolicyBudget,
      repairBudget: task.repairBudget,
      resumePolicy: task.resumePolicy,
    });
    const trackHash = createHash("sha256").update(JSON.stringify(track)).digest("hex");
    parentPort!.postMessage({ task, status: "ok", elapsedMs: performance.now() - started, authoredContacts, report, stats, budgetTelemetry, trackHash } satisfies StudyWorkerResult);
  } catch (error) {
    parentPort!.postMessage({
      task,
      status: "error",
      elapsedMs: performance.now() - started,
      authoredContacts,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    } satisfies StudyWorkerResult);
  }
}

function phases(source: ResolvedSource, report: DriftReport): any[] {
  const phases = source.caseMetadata?.phases ?? [];
  if (phases.length === 0) return [];
  return phases.map((phase) => {
    const indexes = report.contacts.map((contact, index) => ({ contact, index }))
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

function failedScore(result: StudyWorkerResult): V2RunScore {
  return {
    schema: "line.benchmark-v2.run-score.v2",
    score: 0,
    valid: false,
    scoringMode: "axis_quality",
    hardFailures: [`${result.status}:${result.error}`],
    contacts: { authored: result.authoredContacts, reported: 0, hit: 0, drift: 0, missing: result.authoredContacts },
    offBeatLandings: 0,
    terminus: { frame: 0, reason: result.status },
    weightedAxisRms: null,
    expectedObservations: {},
    components: {},
    diagnostics: {},
  };
}

function integerList(text: string, name: string, allowZero = false): number[] {
  const values = text.split(",").map((value) => Number(value));
  if (values.length === 0 || values.some((value) => !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1))) {
    throw new Error(`--${name} must be a comma-separated integer list`);
  }
  if (new Set(values).size !== values.length) throw new Error(`--${name} contains duplicates`);
  return values;
}

function telemetryLevel(value: string): BudgetTelemetryLevel {
  if (value === "off" || value === "summary" || value === "trace") return value;
  throw new Error("--budget-telemetry must be off, summary, or trace");
}

function positiveInteger(text: string, name: string): number {
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
}

function optionalPositiveInteger(text: string | undefined, name: string): number | undefined {
  return text === undefined ? undefined : positiveInteger(text, name);
}

function optionalBoundedInteger(
  text: string | undefined,
  name: string,
  minimum: number,
  maximum: number,
): number | undefined {
  if (text === undefined) return undefined;
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`--${name} must be an integer in [${minimum}, ${maximum}]`);
  }
  return value;
}

function optionalFraction(text: string | undefined, name: string): number | undefined {
  if (text === undefined) return undefined;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new Error(`--${name} must be a finite number in (0, 1]`);
  }
  return value;
}

function parseResumePolicy(
  value: string | undefined,
): "legacy" | "none" | "remainder-aware" | undefined {
  if (value === undefined) return undefined;
  if (value === "legacy" || value === "none" || value === "remainder-aware") return value;
  throw new Error("--resume-policy must be legacy, none, or remainder-aware");
}

function parseNCandPolicy(
  value: string | undefined,
):
  | "high-budget-three-quarter"
  | "repair-high-budget-three-quarter"
  | "repair-three-quarter"
  | "repair-seven-eighth"
  | "linear-cap-216"
  | undefined {
  if (value === undefined) return undefined;
  if (
    value === "high-budget-three-quarter" ||
    value === "repair-high-budget-three-quarter" ||
    value === "repair-three-quarter" ||
    value === "repair-seven-eighth" ||
    value === "linear-cap-216"
  ) return value;
  throw new Error(
    "--ncand-policy must be high-budget-three-quarter, " +
      "repair-high-budget-three-quarter, repair-three-quarter, repair-seven-eighth, " +
      "or linear-cap-216",
  );
}

function parseRepairPolicy(
  value: string | undefined,
): "protected-one-step-bridge" | "optimistic-axis-bound-bridge" | undefined {
  if (value === undefined) return undefined;
  if (value === "protected-one-step-bridge" || value === "optimistic-axis-bound-bridge") {
    return value;
  }
  throw new Error(
    "--repair-policy must be protected-one-step-bridge or optimistic-axis-bound-bridge",
  );
}

function parseRepairSelectionPolicy(
  value: string | undefined,
): "reserve-cheapest-repair" | "reserve-cheapest-else-deepest" | undefined {
  if (value === undefined) return undefined;
  if (value === "reserve-cheapest-repair" || value === "reserve-cheapest-else-deepest") {
    return value;
  }
  throw new Error(
    "--repair-selection-policy must be reserve-cheapest-repair or " +
      "reserve-cheapest-else-deepest",
  );
}

function relative(path: string): string {
  return path.startsWith(`${process.cwd()}/`) ? path.slice(process.cwd().length + 1) : path;
}
