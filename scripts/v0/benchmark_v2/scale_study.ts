import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { arch, availableParallelism, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { gzipSync } from "node:zlib";
import { applyJolt } from "../../produce/seed.ts";
import { compilerWorkerTimeoutMs } from "../golden_suite.ts";
import { compileHandoff } from "../optimizer/handoff.ts";
import type { CompileStats, DriftReport } from "../types.ts";
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

type StudyTask = {
  sourceId: string;
  budget: number;
  seedSlot: number;
  actualSeed: number;
  joltMs: number;
  sourceManifestPath: string;
};

type StudyWorkerResult = {
  task: StudyTask;
  status: "ok" | "error" | "timeout";
  elapsedMs: number;
  authoredContacts: number;
  report?: DriftReport;
  stats?: CompileStats;
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
  const budgets = integerList(argument("budgets") ?? "100000,200000,250000,500000,600000,1000000", "budgets");
  const seeds = integerList(argument("seeds") ?? "0", "seeds", true);
  const jobs = positiveInteger(argument("jobs") ?? String(Math.min(32, Math.max(1, availableParallelism() / 2))), "jobs");
  const sourceManifestPath = resolve(argument("manifest") ?? "benchmark/v2/compat/source-manifest.json");
  const suiteManifestPath = resolve(argument("suite") ?? "benchmark/v2/compat/suite-manifest.json");
  const outputPath = resolve(argument("out") ?? "generated/benchmark-v2/studies/budget-scale.json");
  const checkpointPath = resolve(argument("checkpoint") ?? `${outputPath}.checkpoint.jsonl`);
  const importCheckpointPath = argument("import-checkpoint") === undefined
    ? undefined
    : resolve(argument("import-checkpoint")!);
  const sources = resolveSources(loadSourceManifest(sourceManifestPath));
  const suite = loadSuiteManifest(suiteManifestPath, sources);
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
    sources: sources.map((source) => ({ id: source.id, fingerprint: source.sourceFingerprint })),
  };
  const planFingerprint = studyPlanFingerprint(planInput);
  mkdirSync(dirname(outputPath), { recursive: true });
  const imported = importCheckpointPath === undefined ? [] : importCheckpoint(
    importCheckpointPath,
    studyPlanFingerprint({
      ...planInput,
      budgets: integerList(argument("import-budgets") ?? "", "import-budgets"),
      seeds: integerList(argument("import-seeds") ?? seeds.join(","), "import-seeds", true),
    }),
    new Set(tasks.map(taskKey)),
  );
  const restored = loadOrInitializeCheckpoint(
    checkpointPath,
    planFingerprint,
    hasFlag("resume"),
    imported,
  );
  const restoredByKey = new Map(restored.map((result) => [taskKey(result.task), result]));
  const pending = tasks.filter((task) => !restoredByKey.has(taskKey(task)));
  console.log(`Benchmark V2 paired budget-scale study`);
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
        sourceFingerprint: source.sourceFingerprint,
        eligibleComponents: source.eligibleComponents,
        diagnosticComponents: source.diagnosticComponents,
      },
      elapsedMs: result.elapsedMs,
      status: result.status,
      error: result.error,
      authoredContacts: result.authoredContacts,
      report: result.report ?? null,
      score,
      stats: result.stats,
      phaseResults: result.status === "ok" ? phases(source, result.report!) : [],
    };
  });
  const summaries = budgets.map((budget) => summarizeDevelopmentBudget(
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
    schema: "line.benchmark-v2.budget-scale-study.v1",
    generatedAt: new Date().toISOString(),
    note: "Exploratory paired-seed study. Not a canonical headline or candidate decision.",
    suiteFingerprint: identity.suiteFingerprint,
    sourceManifestFingerprint: identity.sourceManifestFingerprint,
    definitionFingerprint: identity.definitionFingerprint,
    scorerFingerprint: fingerprintFiles([
      "scripts/v0/benchmark_v2/evaluator.ts",
      "scripts/v0/benchmark_v2/score_model.ts",
      "scripts/v0/score.ts",
    ]),
    transform: suite.transform,
    candidate,
    environment: runtime,
    budgets,
    seeds,
    summaries,
    runs: scored,
  };
  const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(outputPath, reportBytes);
  const compressedBytes = gzipSync(reportBytes, { level: 9 });
  writeFileSync(`${outputPath}.gz`, compressedBytes);
  writeFileSync(`${outputPath}.sha256`, `${createHash("sha256").update(reportBytes).digest("hex")}  ${relative(outputPath)}\n`);
  writeFileSync(`${outputPath}.gz.sha256`, `${createHash("sha256").update(compressedBytes).digest("hex")}  ${relative(`${outputPath}.gz`)}\n`);
  for (const summary of summaries) {
    const invalid = scored.filter((row) => row.task.budget === summary.budget && !row.score.valid)
      .map((row) => row.task.sourceId);
    console.log(`  ${summary.budget / 1000}k: ${summary.score.toFixed(2)}, valid ${summary.validRuns}/${summary.totalRuns}` +
      (invalid.length === 0 ? "" : `, invalid ${[...new Set(invalid)].join(", ")}`));
  }
  console.log(`  output ${relative(outputPath)}`);
}

function loadOrInitializeCheckpoint(
  path: string,
  planFingerprint: string,
  resume: boolean,
  imported: StudyWorkerResult[],
): StudyWorkerResult[] {
  mkdirSync(dirname(path), { recursive: true });
  if (!resume || !existsSync(path)) {
    writeFileSync(path, `${JSON.stringify({ schema: STUDY_CHECKPOINT_SCHEMA, planFingerprint })}\n`);
    for (const result of imported) appendFileSync(path, `${JSON.stringify({ type: "result", result })}\n`);
    return imported;
  }
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  if (lines[0]?.schema !== STUDY_CHECKPOINT_SCHEMA || lines[0].planFingerprint !== planFingerprint) {
    throw new Error(`study checkpoint does not match the current catalog, compiler, budgets, and seeds`);
  }
  const results = lines.slice(1)
    .filter((entry) => entry.type === "result")
    .map((row) => row.result as StudyWorkerResult);
  return latestSuccessfulResults(results, (result) => taskKey(result.task));
}

function importCheckpoint(
  path: string,
  expectedPlanFingerprint: string,
  targetKeys: Set<string>,
): StudyWorkerResult[] {
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  if (lines[0]?.schema !== STUDY_CHECKPOINT_SCHEMA || lines[0].planFingerprint !== expectedPlanFingerprint) {
    throw new Error(`import checkpoint does not match the declared source plan and current suite/compiler`);
  }
  const imported = lines.slice(1)
    .filter((row) => row.type === "result")
    .map((row) => row.result as StudyWorkerResult)
    .filter((result) => targetKeys.has(taskKey(result.task)));
  return latestSuccessfulResults(imported, (result) => taskKey(result.task));
}

function studyPlanFingerprint(input: {
  suiteFingerprint: string;
  candidateFingerprint: string;
  runtime: { node: string; platform: string; architecture: string };
  budgets: number[];
  seeds: number[];
  joltMs: number;
  sources: Array<{ id: string; fingerprint: string }>;
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function taskKey(task: StudyTask): string {
  return `${task.sourceId}\0${task.budget}\0${task.seedSlot}\0${task.actualSeed}`;
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
      done({ task, status: "error", elapsedMs: performance.now() - started, authoredContacts: 0, error: error.stack ?? error.message });
    });
  });
}

async function workerMain(task: StudyTask): Promise<void> {
  const started = performance.now();
  let authoredContacts = 0;
  try {
    const sources = resolveSources(loadSourceManifest(task.sourceManifestPath));
    const source = sources.find((entry) => entry.id === task.sourceId);
    if (source === undefined) throw new Error(`${task.sourceId}: source unavailable`);
    const base = await loadSourceSpec(source);
    authoredContacts = base.contacts.length;
    const spec = applyJolt(base, task.joltMs);
    const { report, stats } = compileHandoff(spec, task.actualSeed, { budget: task.budget });
    parentPort!.postMessage({ task, status: "ok", elapsedMs: performance.now() - started, authoredContacts, report, stats } satisfies StudyWorkerResult);
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

function positiveInteger(text: string, name: string): number {
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
}

function relative(path: string): string {
  return path.startsWith(`${process.cwd()}/`) ? path.slice(process.cwd().length + 1) : path;
}
