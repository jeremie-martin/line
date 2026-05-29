/**
 * v0 golden benchmark — single source of truth for the compiler goal.
 *
 *   npm run golden
 *   npm run golden -- --json
 *   npm run golden -- --details
 *   npm run golden -- --seed=42
 *   npm run golden -- --variants
 *
 * Headline score: all entries in GOLDEN_SPECS × fixed seeds [0,1,2].
 * Optional variants are report-only robustness probes and are not included in
 * GOAL_SCORE.
 */

import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { availableParallelism } from "node:os";

/** Per-worker V8 old-space cap (MB). A normal LDS compile stays well under this;
 *  a runaway (a hard spec's engines caching huge trajectories) hits it and the
 *  worker exits, surfacing as a graceful per-run error rather than a process
 *  V8 fatal that kills the whole suite. Generous so it only catches true blowups. */
const WORKER_MEM_CAP_MB = 3072;

/** Default parallelism for the worker pool — leave a core for the OS/main thread,
 *  cap so total peak memory (jobs × WORKER_MEM_CAP_MB) stays sane. Override: --jobs=N. */
const DEFAULT_JOBS = Math.max(1, Math.min(6, availableParallelism() - 1));

import { compileLDS } from "./optimizer/api.ts";
import { FPS, type CompileStats, type DriftReport, type Spec } from "./types.ts";
import {
  EVALUATOR_FINGERPRINT,
  FAST_BUDGET_PHYS,
  FAST_SEED,
  FAST_SPECS,
  GOLDEN_SEEDS,
  GOLDEN_SPECS,
  REPORT_VARIANTS,
  budgetFor,
  headlineCases,
  ldsWorkerTimeoutMs,
  loadGoldenSpec,
  variantCases,
  type SuiteCase,
  type VariantName,
} from "./golden_suite.ts";
import {
  AXIS_QUALITY_TOLERANCE,
  MISSING_CONTACT_TOLERANCE,
  OFF_BEAT_TOLERANCE,
  SYNC_TOLERANCE,
  axisDetails,
  scoreDriftReport,
  shiftedGeometricMean,
  worstContacts,
  type V0ContractScore,
} from "./score.ts";

// `budgetUnits` overrides the per-spec default (golden_suite.budgetFor) when set
// — used by --fast / --budget for quick, NON-CANONICAL iteration. null = the
// canonical budget that defines goal_score.
type WorkerInput = SuiteCase & { seed: number; budgetUnits: number | null };
type WorkerOk = {
  kind: "ok";
  specName: string;
  variant: VariantName;
  elapsed_ms: number;
  report: DriftReport;
  stats: CompileStats;
};
type WorkerErr = {
  kind: "error";
  specName: string;
  variant: VariantName;
  elapsed_ms: number;
  message: string;
};
type WorkerResult = WorkerOk | WorkerErr;
type TimeoutResult = {
  kind: "timeout";
  specName: string;
  variant: VariantName;
  elapsed_ms: number;
  message: string;
};
type RunResult = WorkerResult | TimeoutResult;

type ScoredSpec = V0ContractScore & {
  name: string;
  variant: VariantName;
  seed: number;
  status: "pass" | "fail" | "timeout" | "error";
  worker_timeout_ms: number;
  /** Wall-clock of the compile (informational only — NOT scored; the LDS path
   *  scores on pure quality, and wall-clock is contended under --jobs>1). */
  elapsed_ms: number;
  message: string | null;
  axes: ReturnType<typeof axisDetails>;
  worst_contacts: ReturnType<typeof worstContacts>;
  off_beat_frames: number[];
  compile_stats: CompileStats | null;
};

type GroupScore = {
  name: string;
  score: number;
  passed: number;
  total: number;
};

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** Soft tripwire over the "ruler" — `score.ts` + the golden spec files. Editing
 *  these silently makes scores incomparable to history. The harness prints this
 *  fingerprint every run and warns when it drifts from the committed expected
 *  value (`EVALUATOR_FINGERPRINT`, golden_suite.ts). NOT a hard gate — a visible
 *  signal the agent can react to. Deliberate ruler changes update the constant. */
function evaluatorFingerprint(): string {
  const h = createHash("sha256");
  const specDir = resolve("specs/golden");
  const files = [resolve("scripts/v0/score.ts")];
  for (const f of readdirSync(specDir).filter((n) => n.endsWith(".ts")).sort()) {
    files.push(resolve(specDir, f));
  }
  for (const f of files) h.update(readFileSync(f));
  return h.digest("hex").slice(0, 12);
}

async function runWithTimeout(
  testCase: SuiteCase,
  seed: number,
  timeoutMs: number,
  budgetUnits: number | null,
): Promise<RunResult> {
  const workerPath = fileURLToPath(import.meta.url);
  const input: WorkerInput = { ...testCase, seed, budgetUnits };
  return await new Promise<RunResult>((resolvePromise) => {
    // Per-worker heap cap: a runaway compile (e.g. a hard spec whose engines
    // cache huge trajectories) hits this and exits, surfacing as a graceful
    // per-run error below — instead of a V8 fatal that aborts the whole suite.
    const worker = new Worker(workerPath, {
      workerData: input,
      execArgv: process.execArgv,
      resourceLimits: { maxOldGenerationSizeMb: WORKER_MEM_CAP_MB },
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate().catch(() => {});
      resolvePromise({
        kind: "timeout",
        specName: testCase.specName,
        variant: testCase.variant,
        elapsed_ms: timeoutMs,
        message: `TIMEOUT after ${fmtMs(timeoutMs)}`,
      });
    }, timeoutMs);
    worker.on("message", (msg: WorkerResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Terminate on success too (not just timeout): the worker holds a compile's
      // worth of cached-frame memory, and relying on it to self-exit let workers
      // linger and accumulate across runs — the root of the suite-wide OOM. With
      // the bounded pool this caps live memory to ~jobs × WORKER_MEM_CAP_MB.
      worker.terminate().catch(() => {});
      resolvePromise(msg);
    });
    // A worker that throws or OOMs must NOT take down the run — convert it to a
    // graceful error RunResult (scored 0, suite continues). This is the fix for
    // the --json-full V8 fatal: one bad compile fails its own row, not the suite.
    worker.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      resolvePromise({
        kind: "error",
        specName: testCase.specName,
        variant: testCase.variant,
        elapsed_ms: 0,
        message: `worker error: ${String(error).slice(0, 150)}`,
      });
    });
    worker.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({
        kind: "error",
        specName: testCase.specName,
        variant: testCase.variant,
        elapsed_ms: 0,
        message: code === 0 ? "worker exited without result" : `worker exited ${code}`,
      });
    });
  });
}

async function runWorker(): Promise<void> {
  if (!parentPort) throw new Error("golden worker requires parentPort");
  const input = workerData as WorkerInput;
  const t0 = Date.now();
  try {
    const spec = await loadGoldenSpec(input.specName, input.variant);
    const budget = input.budgetUnits !== null
      ? { kind: "work" as const, units: input.budgetUnits }
      : budgetFor(spec);
    const { report, stats } = compileLDS(spec, input.seed, { budget });
    parentPort.postMessage({
      kind: "ok",
      specName: input.specName,
      variant: input.variant,
      elapsed_ms: Date.now() - t0,
      report,
      stats,
    } satisfies WorkerOk);
  } catch (error) {
    parentPort.postMessage({
      kind: "error",
      specName: input.specName,
      variant: input.variant,
      elapsed_ms: Date.now() - t0,
      message: String(error).slice(0, 200),
    } satisfies WorkerErr);
  }
}

type ScoreContext = {
  worker_timeout_ms: number;
  total_frames: number;
};

function emptyScore(): V0ContractScore {
  return {
    score: 0,
    contract_passed: false,
    passed: false,
    valid_contract: false,
    hard_failures: [],
    contacts: 0,
    hits: 0,
    drift: 0,
    missing: 0,
    sync_score: 0,
    drift_quality: 0,
    missing_quality: 0,
    sync_quality: 0,
    off_beat_landings: 0,
    off_beat_quality: 0,
    died: 0,
    survival_quality: 0,
    axis_count: 0,
    axis_error_total: 0,
    axis_error_mean: 0,
    axis_error_max: 0,
    axis_error_rms: 0,
    axis_loss: 0,
    axis_quality: 0,
    axis_score: 0,
  };
}

function scoreResult(result: RunResult, seed: number, ctx: ScoreContext): ScoredSpec {
  if (result.kind === "timeout" || result.kind === "error") {
    return {
      ...emptyScore(),
      hard_failures: [result.kind],
      name: result.specName,
      variant: result.variant,
      seed,
      status: result.kind,
      worker_timeout_ms: ctx.worker_timeout_ms,
      elapsed_ms: result.elapsed_ms,
      message: result.message,
      axes: [],
      worst_contacts: [],
      off_beat_frames: [],
      compile_stats: null,
    };
  }
  // The LDS compiler is budget-metered (sim-frames), not wall-clock-gated, so it
  // scores on PURE quality — wall-clock never enters the score (the same untimed
  // basis as baselines/greedy_v1.json). `elapsed_ms` is recorded for display only.
  const score = scoreDriftReport(result.report, { totalFrames: ctx.total_frames });
  return {
    ...score,
    name: result.specName,
    variant: result.variant,
    seed,
    status: score.contract_passed ? "pass" : "fail",
    worker_timeout_ms: ctx.worker_timeout_ms,
    elapsed_ms: result.elapsed_ms,
    message: score.hard_failures.length > 0 ? score.hard_failures.join(",") : null,
    axes: axisDetails(result.report),
    worst_contacts: worstContacts(result.report, 3),
    off_beat_frames: result.report.off_beat_landings.slice(0, 5).map((l) => l.frame),
    compile_stats: result.stats,
  };
}

function specContext(spec: Spec, budgetUnits: number | null, concurrency: number): ScoreContext {
  return {
    // Budget-scaled hang-detection cap (the LDS compile is budget-metered, not
    // wall-clock-gated, so a tight static cap would falsely time it out and score
    // it 0). Scale off the effective budget (override or canonical) so --fast /
    // --budget runs get a proportionally tighter cap; and by `concurrency`, since
    // N-way contention stretches each compile's wall-clock (its sim-frame budget
    // is unchanged) — the timeout is only a safety net, so erring generous is fine.
    worker_timeout_ms: ldsWorkerTimeoutMs(budgetUnits ?? budgetFor(spec).units) * concurrency,
    total_frames: Math.round(spec.duration * FPS),
  };
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function round(n: number, places = 2): number {
  return Number(n.toFixed(places));
}

function caseLabel(row: Pick<ScoredSpec, "name" | "variant">): string {
  return row.variant === "base" ? row.name : `${row.name}/${row.variant}`;
}

function groupScores(rows: ScoredSpec[], keyOf: (row: ScoredSpec) => string): GroupScore[] {
  const groups = new Map<string, ScoredSpec[]>();
  for (const row of rows) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([name, groupRows]) => ({
    name,
    score: shiftedGeometricMean(groupRows.map((row) => row.score)),
    passed: groupRows.filter((row) => row.status === "pass").length,
    total: groupRows.length,
  }));
}

function suiteScore(rows: ScoredSpec[], keyOf: (row: ScoredSpec) => string): number {
  return shiftedGeometricMean(groupScores(rows, keyOf).map((group) => group.score));
}

function formatWorstAxes(axes: ScoredSpec["axes"]): string {
  if (axes.length === 0) return "";
  const top = [...axes].sort((a, b) => Math.abs(b.error) - Math.abs(a.error)).slice(0, 4);
  return top.map((a) => {
    const delta = a.achieved - a.target;
    const sign = delta >= 0 ? "+" : "";
    return `s${a.section_index}.${a.axis}=${a.achieved.toFixed(2)}(${sign}${delta.toFixed(2)})`;
  }).join("  ");
}

function formatWorstContacts(spec: ScoredSpec): string | null {
  if (spec.worst_contacts.length === 0) return null;
  return spec.worst_contacts.map((c) => {
    if (c.status === "missing") return `t=${c.t_target.toFixed(2)}miss`;
    const sign = c.frame_error !== null && c.frame_error > 0 ? "+" : "";
    return `t=${c.t_target.toFixed(2)}${sign}${c.frame_error}f`;
  }).join("  ");
}

function printRow(row: ScoredSpec, details: boolean): void {
  console.log(
    `${caseLabel(row).padEnd(38)} ${row.status.toUpperCase().padEnd(7)} ` +
      `score=${row.score.toFixed(0).padStart(4)}  ` +
      `sync=${fmtPct(row.sync_score).padStart(4)} (${row.hits}/${row.contacts}, drift=${row.drift}, miss=${row.missing}, off=${row.off_beat_landings})  ` +
      `axis=${fmtPct(row.axis_quality).padStart(4)} (loss=${row.axis_loss.toFixed(2)}, maxErr=${row.axis_error_max.toFixed(2)})  ` +
      `t=${fmtMs(row.elapsed_ms)}`,
  );
  if (details || row.status !== "pass") {
    const worstAxes = formatWorstAxes(row.axes);
    if (worstAxes) console.log(`  worst axes:     ${worstAxes}`);
    const worstC = formatWorstContacts(row);
    if (worstC) console.log(`  worst contacts: ${worstC}`);
    if (row.off_beat_frames.length > 0) {
      console.log(`  off-beat:       frames ${row.off_beat_frames.join(", ")}`);
    }
    if (row.message) console.log(`  note:           ${row.message}`);
  }
}

function printSummary(label: string, rows: ScoredSpec[], keyOf: (row: ScoredSpec) => string): void {
  const score = suiteScore(rows, keyOf);
  const passed = rows.filter((row) => row.status === "pass").length;
  const timeouts = rows.filter((row) => row.status === "timeout").length;
  const invalid = rows.filter((row) => row.status === "fail" || row.status === "error").length;
  const groups = groupScores(rows, keyOf);

  console.log(
    `${label} ${score.toFixed(2)} · valid ${passed}/${rows.length} · ` +
      `invalid ${invalid} · timeout ${timeouts}`,
  );
  console.log("  spec scores:");
  for (const group of groups) {
    console.log(
      `    ${group.name.padEnd(32)} ${group.score.toFixed(2).padStart(7)} ` +
        `valid=${group.passed}/${group.total}`,
    );
  }

  const worstRows = [...rows].sort((a, b) => a.score - b.score).slice(0, 5);
  console.log("  worst rows:");
  for (const row of worstRows) {
    console.log(
      `    ${caseLabel(row).padEnd(38)} seed=${row.seed} ${row.status.padEnd(7)} ` +
        `score=${row.score.toFixed(2)} axis=${fmtPct(row.axis_quality)}`,
    );
  }

  const worstAxes = rows.flatMap((row) =>
    row.axes.map((axis) => ({ row, axis })),
  ).sort((a, b) => Math.abs(b.axis.error) - Math.abs(a.axis.error)).slice(0, 5);
  if (worstAxes.length > 0) {
    console.log("  worst axes:");
    for (const { row, axis } of worstAxes) {
      const delta = axis.achieved - axis.target;
      const sign = delta >= 0 ? "+" : "";
      console.log(
        `    ${caseLabel(row).padEnd(38)} seed=${row.seed} ` +
          `s${axis.section_index}.${axis.axis}=${axis.achieved.toFixed(2)}(${sign}${delta.toFixed(2)})`,
      );
    }
  }
}

/** Run `items` through `worker` with at most `concurrency` in flight at once.
 *  Results are returned in INPUT order (independent of completion order), so
 *  scores and printed output stay deterministic regardless of parallelism. */
async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runner = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, runner));
  return results;
}

async function runRows(
  cases: SuiteCase[],
  seeds: number[],
  jsonOnly: boolean,
  details: boolean,
  label: string,
  budgetUnits: number | null,
  jobs: number,
): Promise<ScoredSpec[]> {
  const contexts = new Map<string, ScoreContext>();
  for (const testCase of cases) {
    const key = `${testCase.specName}/${testCase.variant}`;
    if (!contexts.has(key)) {
      const spec = await loadGoldenSpec(testCase.specName, testCase.variant);
      // Scale the hang-detection timeout by parallelism: under N-way contention a
      // compile's WALL-CLOCK stretches (its sim-frame budget is unchanged), and a
      // single-core-calibrated cap would falsely time it out and score it 0.
      contexts.set(key, specContext(spec, budgetUnits, jobs));
    }
  }
  // Flatten to a (seed, case) task list and run through the bounded pool.
  const tasks = seeds.flatMap((seed) => cases.map((testCase) => ({ seed, testCase })));
  let done = 0;
  if (!jsonOnly) console.log(`${label}: ${tasks.length} run${tasks.length === 1 ? "" : "s"}, ${Math.min(jobs, tasks.length)} parallel`);
  const scored = await runPool(tasks, jobs, async ({ seed, testCase }) => {
    const ctx = contexts.get(`${testCase.specName}/${testCase.variant}`)!;
    const result = await runWithTimeout(testCase, seed, ctx.worker_timeout_ms, budgetUnits);
    const row = scoreResult(result, seed, ctx);
    if (!jsonOnly) {
      done++;
      process.stdout.write(`  [${String(done).padStart(2)}/${tasks.length}] `);
      printRow({ ...row, name: `${caseLabel(row)} seed=${seed}` }, details);
    }
    return row;
  });
  if (!jsonOnly) console.log("");
  return scored;
}

function compactJsonRow(row: ScoredSpec): object {
  return {
    name: row.name,
    variant: row.variant,
    seed: row.seed,
    status: row.status,
    score: round(row.score),
    contract_passed: row.contract_passed,
    hard_failures: row.hard_failures,
    contacts: row.contacts,
    hits: row.hits,
    drift: row.drift,
    missing: row.missing,
    sync_score: round(row.sync_score, 4),
    drift_quality: round(row.drift_quality, 4),
    missing_quality: round(row.missing_quality, 4),
    sync_quality: round(row.sync_quality, 4),
    off_beat_landings: row.off_beat_landings,
    off_beat_quality: round(row.off_beat_quality, 4),
    died: row.died,
    survival_quality: round(row.survival_quality, 4),
    axis_count: row.axis_count,
    axis_quality: round(row.axis_quality, 4),
    axis_loss: round(row.axis_loss, 4),
    axis_error_rms: round(row.axis_error_rms, 4),
    axis_error_mean: round(row.axis_error_mean, 4),
    axis_error_max: round(row.axis_error_max, 4),
    elapsed_ms: row.elapsed_ms,
    compile_stats: row.compile_stats,
    message: row.message,
    worst_contacts: row.worst_contacts,
    off_beat_frames: row.off_beat_frames,
  };
}

function detailedJsonRow(row: ScoredSpec): ScoredSpec {
  return {
    ...row,
    score: round(row.score),
    sync_score: round(row.sync_score, 4),
    drift_quality: round(row.drift_quality, 4),
    missing_quality: round(row.missing_quality, 4),
    sync_quality: round(row.sync_quality, 4),
    off_beat_quality: round(row.off_beat_quality, 4),
    survival_quality: round(row.survival_quality, 4),
    axis_score: round(row.axis_score, 4),
    axis_quality: round(row.axis_quality, 4),
    axis_loss: round(row.axis_loss, 4),
    axis_error_total: round(row.axis_error_total, 4),
    axis_error_mean: round(row.axis_error_mean, 4),
    axis_error_max: round(row.axis_error_max, 4),
    axis_error_rms: round(row.axis_error_rms, 4),
  };
}

async function runMain(): Promise<void> {
  const jsonOnly = has("json") || has("json-full");
  const details = has("details") || has("json-full");
  const includeVariants = has("variants");
  const rawSeed = arg("seed");
  const debugSeed = rawSeed !== null ? Math.trunc(Number(rawSeed)) : null;
  if (rawSeed !== null && !Number.isFinite(debugSeed)) {
    throw new Error(`--seed must be a number, got ${rawSeed}`);
  }
  const fast = has("fast");
  // Worker parallelism (--jobs=N). Runs are isolated workers, so parallelism is
  // safe and does not affect scores (each compile is independent + deterministic).
  const rawJobs = arg("jobs");
  if (rawJobs !== null && (!Number.isInteger(Number(rawJobs)) || Number(rawJobs) < 1)) {
    throw new Error(`--jobs must be a positive integer, got ${rawJobs}`);
  }
  const jobs = rawJobs !== null ? Number(rawJobs) : DEFAULT_JOBS;
  // --budget=N overrides the canonical per-spec budget; --fast implies a small
  // reduced budget. Either makes the run NON-CANONICAL (indicative, not goal_score).
  const rawBudget = arg("budget");
  if (rawBudget !== null && (!Number.isFinite(Number(rawBudget)) || Number(rawBudget) <= 0)) {
    throw new Error(`--budget must be a positive number, got ${rawBudget}`);
  }
  const budgetUnits: number | null = rawBudget !== null
    ? Math.trunc(Number(rawBudget))
    : (fast ? FAST_BUDGET_PHYS : null);
  // --fast defaults to one seed and the FAST_SPECS subset unless overridden.
  const seeds = debugSeed !== null
    ? [debugSeed]
    : (fast ? [FAST_SEED] : [...GOLDEN_SEEDS]);
  // Optional --specs=a,b filter (fast iteration; does not change scoring).
  const specFilter = arg("specs");
  const filterSet = specFilter
    ? new Set(specFilter.split(","))
    : (fast ? new Set<string>(FAST_SPECS) : null);
  const keep = (c: SuiteCase) => filterSet === null || filterSet.has(c.specName);
  const headline = headlineCases().filter(keep);
  const variants = variantCases().filter(keep);

  // A run is CANONICAL — i.e. it defines goal_score — only when it is the full
  // suite at the default budget, all specs, all seeds. Anything narrower
  // (--fast / --budget / --specs / --seed) is indicative signal for iterating,
  // never the metric of record. The harness labels it so a fast probe is never
  // mistaken for the goal.
  const canonical = budgetUnits === null && filterSet === null && debugSeed === null;

  if (!jsonOnly) {
    const fp = evaluatorFingerprint();
    console.log(`evaluator_fingerprint ${fp}${fp === EVALUATOR_FINGERPRINT ? "" : "  ⚠ DRIFTED from committed ruler — scores not comparable to history; see GOAL_LDS.md"}`);
    if (jobs > 1) {
      console.log("note: per-row t= readings are wall-clock under contention (informational; not scored). Use --jobs=1 for clean timing.");
    }
    if (!canonical) {
      console.log(
        `⚠ NON-CANONICAL run (indicative only, NOT goal_score): ` +
          `${fast ? "fast " : ""}${budgetUnits !== null ? `budget=${budgetUnits} ` : ""}` +
          `${filterSet ? `specs=${[...filterSet].join(",")} ` : ""}${debugSeed !== null ? `seed=${debugSeed}` : ""}`.trim(),
      );
    }
    console.log(
      `v0 golden benchmark · ${headline.length} spec${headline.length === 1 ? "" : "s"} × ${seeds.length} seed${seeds.length === 1 ? "" : "s"} · jobs=${jobs} · ` +
        `budget=${budgetUnits ?? "default"} physics-frames (untimed score) · seeds=${seeds.join(",")}`,
    );
    console.log("");
  }

  const scored = await runRows(headline, seeds, jsonOnly, details, "headline", budgetUnits, jobs);
  const specScores = groupScores(scored, (row) => row.name);
  const goal_score = suiteScore(scored, (row) => row.name);
  const passed = scored.filter((row) => row.status === "pass").length;
  const contract_pass_rate = scored.length === 0 ? 0 : passed / scored.length;
  const perSeed = seeds.map((seed) => {
    const rows = scored.filter((row) => row.seed === seed);
    const seedPassed = rows.filter((row) => row.status === "pass").length;
    return {
      seed,
      goal_score: round(suiteScore(rows, (row) => row.name)),
      passed: seedPassed,
      total: rows.length,
      contract_pass_rate: round(rows.length === 0 ? 0 : seedPassed / rows.length, 4),
    };
  });

  let variantRows: ScoredSpec[] = [];
  let variantScores: GroupScore[] = [];
  let variantReportScore = 0;
  if (includeVariants) {
    if (!jsonOnly) {
      console.log("");
      console.log("report-only variants");
      console.log("");
    }
    variantRows = await runRows(variants, seeds, jsonOnly, details, "variant", budgetUnits, jobs);
    variantScores = groupScores(variantRows, (row) => caseLabel(row));
    variantReportScore = suiteScore(variantRows, (row) => caseLabel(row));
  }

  if (jsonOnly) {
    process.stdout.write(JSON.stringify({
      canonical,
      evaluator_fingerprint: evaluatorFingerprint(),
      goal_score: round(goal_score),
      contract_pass_rate: round(contract_pass_rate, 4),
      budget_units: budgetUnits,
      scoring: {
        axis_quality_tolerance: AXIS_QUALITY_TOLERANCE,
        sync_tolerance_frames: SYNC_TOLERANCE,
        missing_contact_tolerance: MISSING_CONTACT_TOLERANCE,
        off_beat_tolerance: OFF_BEAT_TOLERANCE,
        aggregation: "shifted_geometric_mean_by_spec",
        json_detail: details ? "detailed" : "compact",
        budget_unit: "simulated rider frames (untimed; wall-clock never scored)",
      },
      seeds,
      seed_count: seeds.length,
      passed,
      total: scored.length,
      spec_scores: specScores.map((group) => ({
        ...group,
        score: round(group.score),
      })),
      per_seed: perSeed,
      specs: scored.map(details ? detailedJsonRow : compactJsonRow),
      variants: includeVariants
        ? {
            enabled: true,
            report_score: round(variantReportScore),
            variants: [...REPORT_VARIANTS],
            case_scores: variantScores.map((group) => ({
              ...group,
              score: round(group.score),
            })),
            specs: variantRows.map(details ? detailedJsonRow : compactJsonRow),
          }
        : { enabled: false },
    }, null, 2) + "\n");
  } else {
    printSummary(canonical ? "GOAL_SCORE" : "SCORE (indicative, NOT goal_score)", scored, (row) => row.name);
    console.log(`  contract_pass_rate ${fmtPct(contract_pass_rate)} (${passed}/${scored.length})`);
    for (const seed of perSeed) {
      console.log(`  seed=${seed.seed} score=${seed.goal_score.toFixed(2)} valid=${seed.passed}/${seed.total}`);
    }
    if (includeVariants) {
      console.log("");
      printSummary("VARIANT_REPORT_SCORE", variantRows, (row) => caseLabel(row));
      console.log("  variants probe generalization (perturbed timing/stretch); excluded from GOAL_SCORE.");
      console.log("  Large base-vs-variant gaps = overfitting to exact spec timings.");
    }
  }
}

if (!isMainThread) {
  await runWorker();
} else {
  await runMain().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
