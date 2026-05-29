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

import { compile as compileV0 } from "./compile.ts";
import {
  compile as compileV1,
  defaultBudgetFor as defaultV1BudgetFor,
  minimumRecommendedBudgetFor as minimumRecommendedV1BudgetFor,
  type Budget as V1Budget,
} from "../v1/compile.ts";
import { FPS, type DriftReport, type Spec } from "./types.ts";
import {
  GOLDEN_SEEDS,
  GOLDEN_SPECS,
  REPORT_VARIANTS,
  hardBudgetMs,
  headlineCases,
  loadGoldenSpec,
  softBudgetMs,
  variantCases,
  workerTimeoutMs,
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
  scoreTimedDriftReport,
  shiftedGeometricMean,
  worstContacts,
  type V0TimedContractScore,
} from "./score.ts";

type CompilerChoice = "v0" | "v1";
type WorkerInput = SuiteCase & {
  seed: number;
  compiler: CompilerChoice;
  budgetUnits: number | null;
};
type WorkerOk = {
  kind: "ok";
  specName: string;
  variant: VariantName;
  elapsed_ms: number;
  report: DriftReport;
  stats: unknown;
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

type ScoredSpec = V0TimedContractScore & {
  name: string;
  variant: VariantName;
  seed: number;
  status: "pass" | "fail" | "timeout" | "error";
  worker_timeout_ms: number;
  message: string | null;
  axes: ReturnType<typeof axisDetails>;
  worst_contacts: ReturnType<typeof worstContacts>;
  off_beat_frames: number[];
  compile_stats: unknown | null;
};

type GroupScore = {
  name: string;
  score: number;
  passed: number;
  total: number;
  time_multiplier_mean: number;
};

type CaseRunContext = {
  score: ScoreContext;
  default_work_units: number;
  minimum_work_units: number;
};

type BudgetSweepPoint = {
  label: string;
  scale: number;
};

type BudgetSweepResult = {
  label: string;
  scale: number;
  goal_score: number;
  contract_pass_rate: number;
  passed: number;
  total: number;
  specs: ScoredSpec[];
};

type MonotonicViolation = {
  name: string;
  variant: VariantName;
  seed: number;
  lower_label: string;
  higher_label: string;
  lower_axis_quality: number;
  higher_axis_quality: number;
  delta: number;
};

const V1_TIMEOUT_MS_PER_WORK_UNIT = 1.25;

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseCompiler(): CompilerChoice {
  const raw = arg("compiler") ?? "v0";
  if (raw === "v0" || raw === "v1") return raw;
  throw new Error(`--compiler must be v0 or v1, got ${raw}`);
}

function parseBudgetUnits(): number | null {
  const raw = arg("budget-units");
  if (raw === null) return null;
  const units = Math.trunc(Number(raw));
  if (!Number.isFinite(units) || units < 0) {
    throw new Error(`--budget-units must be a non-negative number, got ${raw}`);
  }
  return units;
}

function parseBudgetSweep(): BudgetSweepPoint[] | null {
  if (!has("budget-sweep")) return null;
  const raw = arg("budget-sweep-scales") ?? "0.25,0.5,1";
  const scales = raw.split(",")
    .map((part) => Number(part.trim()))
    .filter((scale) => Number.isFinite(scale) && scale > 0);
  if (scales.length === 0) {
    throw new Error(`--budget-sweep-scales must contain positive numbers, got ${raw}`);
  }
  scales.sort((a, b) => a - b);
  return scales.map((scale) => ({ label: `${scale}x`, scale }));
}

function selectedSpecNames(): Set<string> | null {
  const raw = arg("specs");
  if (raw === null) return null;
  const names = raw.split(",").map((name) => name.trim()).filter(Boolean);
  const valid = new Set<string>(GOLDEN_SPECS);
  for (const name of names) {
    if (!valid.has(name)) throw new Error(`unknown golden spec ${name}`);
  }
  return new Set(names);
}

function filterCases(cases: SuiteCase[], names: Set<string> | null): SuiteCase[] {
  return names === null ? cases : cases.filter((testCase) => names.has(testCase.specName));
}

async function runWithTimeout(
  testCase: SuiteCase,
  seed: number,
  compiler: CompilerChoice,
  budgetUnits: number | null,
  timeoutMs: number,
): Promise<RunResult> {
  const workerPath = fileURLToPath(import.meta.url);
  const input: WorkerInput = { ...testCase, seed, compiler, budgetUnits };
  return await new Promise<RunResult>((resolvePromise, reject) => {
    const worker = new Worker(workerPath, { workerData: input, execArgv: ["--import", "tsx"] });
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
      worker.terminate().catch(() => {});
      resolvePromise(msg);
    });
    worker.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
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
    const { report, stats } = compileForWorker(spec, input);
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

function compileForWorker(spec: Spec, input: WorkerInput): { report: DriftReport; stats: unknown } {
  if (input.compiler === "v0") return compileV0(spec, input.seed);
  const budget: V1Budget = input.budgetUnits === null
    ? defaultV1BudgetFor(spec)
    : { kind: "work", units: input.budgetUnits };
  return compileV1(spec, { seed: input.seed, budget });
}

type ScoreContext = {
  soft_ms: number;
  hard_ms: number;
  worker_timeout_ms: number;
  total_frames: number;
};

function emptyScore(elapsedMs: number, ctx: ScoreContext): V0TimedContractScore {
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
    score_without_time: 0,
    time_multiplier: 0,
    elapsed_ms: elapsedMs,
    soft_ms: ctx.soft_ms,
    hard_ms: ctx.hard_ms,
  };
}

function scoreResult(
  result: RunResult,
  seed: number,
  ctx: ScoreContext,
  compiler: CompilerChoice,
): ScoredSpec {
  if (result.kind === "timeout") {
    return {
      ...emptyScore(result.elapsed_ms, ctx),
      hard_failures: ["timeout"],
      name: result.specName,
      variant: result.variant,
      seed,
      status: "timeout",
      worker_timeout_ms: ctx.worker_timeout_ms,
      message: result.message,
      axes: [],
      worst_contacts: [],
      off_beat_frames: [],
      compile_stats: null,
    };
  }
  if (result.kind === "error") {
    return {
      ...emptyScore(result.elapsed_ms, ctx),
      hard_failures: ["error"],
      name: result.specName,
      variant: result.variant,
      seed,
      status: "error",
      worker_timeout_ms: ctx.worker_timeout_ms,
      message: result.message,
      axes: [],
      worst_contacts: [],
      off_beat_frames: [],
      compile_stats: null,
    };
  }
  const score = compiler === "v0"
    ? scoreTimedDriftReport(
        result.report,
        { elapsed_ms: result.elapsed_ms, soft_ms: ctx.soft_ms, hard_ms: ctx.hard_ms },
        { totalFrames: ctx.total_frames },
      )
    : scoreWorkBudgetedDriftReport(result.report, result.elapsed_ms, ctx);
  return {
    ...score,
    name: result.specName,
    variant: result.variant,
    seed,
    status: score.contract_passed ? "pass" : "fail",
    worker_timeout_ms: ctx.worker_timeout_ms,
    message: score.hard_failures.length > 0 ? score.hard_failures.join(",") : null,
    axes: axisDetails(result.report),
    worst_contacts: worstContacts(result.report, 3),
    off_beat_frames: result.report.off_beat_landings.slice(0, 5).map((l) => l.frame),
    compile_stats: result.stats,
  };
}

function scoreWorkBudgetedDriftReport(
  report: DriftReport,
  elapsedMs: number,
  ctx: ScoreContext,
): V0TimedContractScore {
  const base = scoreDriftReport(report, { totalFrames: ctx.total_frames });
  return {
    ...base,
    score_without_time: base.score,
    time_multiplier: 1,
    elapsed_ms: elapsedMs,
    soft_ms: ctx.soft_ms,
    hard_ms: ctx.hard_ms,
  };
}

function specContext(spec: Spec): ScoreContext {
  const numContacts = spec.contacts.length;
  return {
    soft_ms: softBudgetMs(numContacts),
    hard_ms: hardBudgetMs(numContacts),
    worker_timeout_ms: workerTimeoutMs(numContacts),
    total_frames: Math.round(spec.duration * FPS),
  };
}

function caseRunContext(spec: Spec): CaseRunContext {
  return {
    score: specContext(spec),
    default_work_units: workUnits(defaultV1BudgetFor(spec)),
    minimum_work_units: workUnits(minimumRecommendedV1BudgetFor(spec)),
  };
}

function workUnits(budget: V1Budget): number {
  if (budget.kind !== "work") {
    throw new Error(`golden v1 requires work budgets, got ${budget.kind}`);
  }
  return Math.max(0, Math.floor(budget.units));
}

function fixedBudget(units: number | null): (context: CaseRunContext) => number | null {
  return () => units;
}

function scaledBudget(point: BudgetSweepPoint): (context: CaseRunContext) => number {
  return (context) => {
    const scaled = Math.floor(context.default_work_units * point.scale);
    return Math.max(context.minimum_work_units, scaled);
  };
}

function timeoutMsForCase(
  compiler: CompilerChoice,
  ctx: CaseRunContext,
  budgetUnits: number | null,
): number {
  if (compiler === "v0") return ctx.score.worker_timeout_ms;
  const units = budgetUnits ?? ctx.default_work_units;
  const workTimeout = Math.ceil(Math.max(0, units) * V1_TIMEOUT_MS_PER_WORK_UNIT);
  return Math.max(ctx.score.worker_timeout_ms, workTimeout);
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

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
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
    time_multiplier_mean: mean(groupRows.map((row) => row.time_multiplier)),
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
      `time=${fmtMs(row.elapsed_ms)}/${fmtMs(row.hard_ms)} x${row.time_multiplier.toFixed(2)}`,
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
      `invalid ${invalid} · timeout ${timeouts} · mean time x${mean(rows.map((row) => row.time_multiplier)).toFixed(2)}`,
  );
  console.log("  spec scores:");
  for (const group of groups) {
    console.log(
      `    ${group.name.padEnd(32)} ${group.score.toFixed(2).padStart(7)} ` +
        `valid=${group.passed}/${group.total} time=x${group.time_multiplier_mean.toFixed(2)}`,
    );
  }

  const worstRows = [...rows].sort((a, b) => a.score - b.score).slice(0, 5);
  console.log("  worst rows:");
  for (const row of worstRows) {
    console.log(
      `    ${caseLabel(row).padEnd(38)} seed=${row.seed} ${row.status.padEnd(7)} ` +
        `score=${row.score.toFixed(2)} axis=${fmtPct(row.axis_quality)} time=x${row.time_multiplier.toFixed(2)}`,
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

async function runRows(
  cases: SuiteCase[],
  seeds: number[],
  compiler: CompilerChoice,
  budgetUnitsForCase: (context: CaseRunContext) => number | null,
  jsonOnly: boolean,
  details: boolean,
  label: string,
): Promise<ScoredSpec[]> {
  const contexts = new Map<string, CaseRunContext>();
  for (const testCase of cases) {
    const key = `${testCase.specName}/${testCase.variant}`;
    if (!contexts.has(key)) {
      const spec = await loadGoldenSpec(testCase.specName, testCase.variant);
      contexts.set(key, caseRunContext(spec));
    }
  }
  const scored: ScoredSpec[] = [];
  for (const seed of seeds) {
    if (!jsonOnly) {
      console.log(`${label} seed=${seed}`);
    }
    for (const testCase of cases) {
      const ctx = contexts.get(`${testCase.specName}/${testCase.variant}`)!;
      const budgetUnits = budgetUnitsForCase(ctx);
      const result = await runWithTimeout(
        testCase,
        seed,
        compiler,
        budgetUnits,
        timeoutMsForCase(compiler, ctx, budgetUnits),
      );
      const row = scoreResult(result, seed, ctx.score, compiler);
      scored.push(row);
      if (!jsonOnly) printRow(row, details);
    }
    if (!jsonOnly) console.log("");
  }
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
    score_without_time: round(row.score_without_time),
    time_multiplier: round(row.time_multiplier, 4),
    elapsed_ms: row.elapsed_ms,
    soft_ms: row.soft_ms,
    hard_ms: row.hard_ms,
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
    score_without_time: round(row.score_without_time),
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
    time_multiplier: round(row.time_multiplier, 4),
  };
}

async function runBudgetSweep(
  cases: SuiteCase[],
  seeds: number[],
  points: readonly BudgetSweepPoint[],
  jsonOnly: boolean,
  details: boolean,
): Promise<BudgetSweepResult[]> {
  const results: BudgetSweepResult[] = [];
  for (const point of points) {
    if (!jsonOnly) {
      console.log("");
      console.log(`budget sweep ${point.label}`);
      console.log("");
    }
    const specs = await runRows(
      cases,
      seeds,
      "v1",
      scaledBudget(point),
      jsonOnly,
      details,
      `budget:${point.label}`,
    );
    const passed = specs.filter((row) => row.status === "pass").length;
    results.push({
      label: point.label,
      scale: point.scale,
      goal_score: suiteScore(specs, (row) => row.name),
      contract_pass_rate: specs.length === 0 ? 0 : passed / specs.length,
      passed,
      total: specs.length,
      specs,
    });
  }
  return results;
}

function budgetSweepViolations(
  results: readonly BudgetSweepResult[],
  tolerance = 1e-12,
): MonotonicViolation[] {
  const byRow = new Map<string, { result: BudgetSweepResult; row: ScoredSpec }[]>();
  for (const result of results) {
    for (const row of result.specs) {
      const key = `${row.name}\u0000${row.variant}\u0000${row.seed}`;
      const bucket = byRow.get(key) ?? [];
      bucket.push({ result, row });
      byRow.set(key, bucket);
    }
  }

  const violations: MonotonicViolation[] = [];
  for (const bucket of byRow.values()) {
    bucket.sort((a, b) => a.result.scale - b.result.scale);
    for (let index = 1; index < bucket.length; index++) {
      const prev = bucket[index - 1];
      const curr = bucket[index];
      const delta = curr.row.axis_quality - prev.row.axis_quality;
      if (delta + tolerance >= 0) continue;
      violations.push({
        name: curr.row.name,
        variant: curr.row.variant,
        seed: curr.row.seed,
        lower_label: prev.result.label,
        higher_label: curr.result.label,
        lower_axis_quality: prev.row.axis_quality,
        higher_axis_quality: curr.row.axis_quality,
        delta,
      });
    }
  }
  return violations;
}

async function runMain(): Promise<void> {
  const jsonOnly = has("json") || has("json-full");
  const details = has("details") || has("json-full");
  const includeVariants = has("variants");
  const compiler = parseCompiler();
  const budgetUnits = parseBudgetUnits();
  const budgetSweep = parseBudgetSweep();
  if (compiler === "v0" && budgetUnits !== null) {
    throw new Error("--budget-units is only valid with --compiler=v1");
  }
  if (budgetSweep !== null && compiler !== "v1") {
    throw new Error("--budget-sweep is only valid with --compiler=v1");
  }
  if (budgetSweep !== null && budgetUnits !== null) {
    throw new Error("--budget-sweep cannot be combined with --budget-units");
  }
  if (budgetSweep !== null && includeVariants) {
    throw new Error("--budget-sweep does not support --variants");
  }
  const rawSeed = arg("seed");
  const debugSeed = rawSeed !== null ? Math.trunc(Number(rawSeed)) : null;
  if (rawSeed !== null && !Number.isFinite(debugSeed)) {
    throw new Error(`--seed must be a number, got ${rawSeed}`);
  }
  const seeds = debugSeed !== null ? [debugSeed] : [...GOLDEN_SEEDS];
  const specNames = selectedSpecNames();
  const headline = filterCases(headlineCases(), specNames);
  const variants = filterCases(variantCases(), specNames);

  if (!jsonOnly) {
    const budgetLabel = compiler === "v1"
      ? budgetSweep !== null
        ? `budget sweep ${budgetSweep.map((point) => point.label).join(",")}`
        : budgetUnits === null ? "default v1 work budget" : `${budgetUnits} work units`
      : "runtime budget scales per-contact";
    console.log(
      `${compiler} golden benchmark · ${headline.length} specs × ${seeds.length} seed${seeds.length === 1 ? "" : "s"} · ` +
        `${budgetLabel} · seeds=${seeds.join(",")}`,
    );
    console.log("");
  }

  if (budgetSweep !== null) {
    const sweepResults = await runBudgetSweep(headline, seeds, budgetSweep, jsonOnly, details);
    const violations = budgetSweepViolations(sweepResults);
    const final = sweepResults.at(-1);
    if (jsonOnly) {
      process.stdout.write(JSON.stringify({
        goal_score: round(final?.goal_score ?? 0),
        contract_pass_rate: round(final?.contract_pass_rate ?? 0, 4),
        scoring: {
          axis_quality_tolerance: AXIS_QUALITY_TOLERANCE,
          sync_tolerance_frames: SYNC_TOLERANCE,
          missing_contact_tolerance: MISSING_CONTACT_TOLERANCE,
          off_beat_tolerance: OFF_BEAT_TOLERANCE,
          aggregation: "shifted_geometric_mean_by_spec",
          json_detail: details ? "detailed" : "compact",
          compiler,
          runtime: "not score-penalized; runtime controlled by v1 work budget",
          budget: {
            kind: "work_sweep",
            scales: budgetSweep.map((point) => point.scale),
            default_when_null: "scripts/v1/defaultBudgetFor(spec)",
            floor: "scripts/v1/minimumRecommendedBudgetFor(spec)",
          },
        },
        seeds,
        seed_count: seeds.length,
        passed: final?.passed ?? 0,
        total: final?.total ?? 0,
        monotonic_violations: violations.map((violation) => ({
          ...violation,
          lower_axis_quality: round(violation.lower_axis_quality, 6),
          higher_axis_quality: round(violation.higher_axis_quality, 6),
          delta: round(violation.delta, 6),
        })),
        budget_sweep: sweepResults.map((result) => ({
          label: result.label,
          scale: result.scale,
          goal_score: round(result.goal_score),
          contract_pass_rate: round(result.contract_pass_rate, 4),
          passed: result.passed,
          total: result.total,
          specs: result.specs.map(details ? detailedJsonRow : compactJsonRow),
        })),
        variants: { enabled: false },
      }, null, 2) + "\n");
    } else {
      for (const result of sweepResults) {
        printSummary(`BUDGET_${result.label}`, result.specs, (row) => row.name);
      }
      console.log(`  monotonic_violations ${violations.length}`);
      for (const violation of violations.slice(0, 10)) {
        console.log(
          `    ${violation.name} seed=${violation.seed} ${violation.lower_label}->${violation.higher_label} ` +
            `${violation.lower_axis_quality.toFixed(4)} -> ${violation.higher_axis_quality.toFixed(4)}`,
        );
      }
    }
    return;
  }

  const scored = await runRows(headline, seeds, compiler, fixedBudget(budgetUnits), jsonOnly, details, "headline");
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
    variantRows = await runRows(variants, seeds, compiler, fixedBudget(budgetUnits), jsonOnly, details, "variant");
    variantScores = groupScores(variantRows, (row) => caseLabel(row));
    variantReportScore = suiteScore(variantRows, (row) => caseLabel(row));
  }

  if (jsonOnly) {
    process.stdout.write(JSON.stringify({
      goal_score: round(goal_score),
      contract_pass_rate: round(contract_pass_rate, 4),
      scoring: {
        axis_quality_tolerance: AXIS_QUALITY_TOLERANCE,
        sync_tolerance_frames: SYNC_TOLERANCE,
        missing_contact_tolerance: MISSING_CONTACT_TOLERANCE,
        off_beat_tolerance: OFF_BEAT_TOLERANCE,
        aggregation: "shifted_geometric_mean_by_spec",
        json_detail: details ? "detailed" : "compact",
        compiler,
        runtime: compiler === "v0"
          ? "per-spec affine in contact count (see golden_suite.softBudgetMs)"
          : "not score-penalized; runtime controlled by v1 work budget",
        budget: compiler === "v1"
          ? { kind: "work", units: budgetUnits, default_when_null: "scripts/v1/defaultBudgetFor(spec)" }
          : { kind: "runtime_ms" },
      },
      seeds,
      seed_count: seeds.length,
      passed,
      total: scored.length,
      spec_scores: specScores.map((group) => ({
        ...group,
        score: round(group.score),
        time_multiplier_mean: round(group.time_multiplier_mean, 4),
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
              time_multiplier_mean: round(group.time_multiplier_mean, 4),
            })),
            specs: variantRows.map(details ? detailedJsonRow : compactJsonRow),
          }
        : { enabled: false },
    }, null, 2) + "\n");
  } else {
    printSummary("GOAL_SCORE", scored, (row) => row.name);
    console.log(`  contract_pass_rate ${fmtPct(contract_pass_rate)} (${passed}/${scored.length})`);
    for (const seed of perSeed) {
      console.log(`  seed=${seed.seed} score=${seed.goal_score.toFixed(2)} valid=${seed.passed}/${seed.total}`);
    }
    if (includeVariants) {
      console.log("");
      printSummary("VARIANT_REPORT_SCORE", variantRows, (row) => caseLabel(row));
      console.log("  variants are report-only and excluded from GOAL_SCORE");
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
