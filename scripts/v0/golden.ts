/**
 * v0 golden budget-curve benchmark — single source of truth for compiler work.
 *
 *   LR_ENGINE=wasm npm run golden -- --jobs=6
 *   LR_ENGINE=wasm npm run golden -- --json --jobs=6
 *   LR_ENGINE=wasm npm run golden -- --json-full --jobs=6
 *   LR_ENGINE=wasm npm run golden -- --details --jobs=6
 *   LR_ENGINE=wasm npm run golden -- --seed=42 --jobs=6
 *   LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2,3,4 npm run golden -- --jobs=6
 *   LR_ENGINE=wasm npm run golden -- --specs=tiny_dance,opening_burst --jobs=6
 *   LR_ENGINE=wasm npm run golden -- --budgets=25000,200000 --jobs=6
 *   LR_ENGINE=wasm npm run golden -- --archive-dir=generated/golden-runs/my-run --jobs=6
 *   LR_ENGINE=wasm npm run golden -- --variants --jobs=6
 *
 * Each budget is an INDEPENDENT full run (no anytime sharing): passing N budgets
 * runs N compiles per (spec, seed). The headline metric (see metric.ts) is the
 * budget-value-WEIGHTED AVERAGE of the per-budget suite scores, emitted in the
 * `headline` JSON block. The accept/reject decision is made by
 * `analyze_golden_curve.ts decide` (paired bootstrap with per-budget deltas), not by
 * eyeballing the scalar. Optional variants are report-only robustness probes,
 * excluded from the headline.
 */

import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { availableParallelism } from "node:os";
import { execFileSync } from "node:child_process";

/** Per-worker V8 old-space cap (MB). A runaway compile exits as a graceful row
 * error instead of taking the whole suite down. */
const WORKER_MEM_CAP_MB = 3072;

/** Default parallelism for the worker pool. Override: --jobs=N. */
const DEFAULT_JOBS = Math.max(1, Math.min(6, availableParallelism() - 1));

import { compileHandoff } from "./optimizer/handoff.ts";
import { FPS, type CompileStats, type DriftReport, type Spec } from "./types.ts";
import {
  parseBudgetList,
  weightedBudgetScore,
  type CurvePoint,
} from "./metric.ts";
import {
  DEFAULT_BUDGETS,
  EVALUATOR_FINGERPRINT,
  GOLDEN_SEEDS,
  GOLDEN_SPECS,
  REPORT_VARIANTS,
  budgetWeights,
  compilerWorkerTimeoutMs,
  compilerWorkerTimeoutBudget,
  headlineCases,
  loadGoldenSpec,
  variantCases,
  type GoldenSpecName,
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

const COMPILERS = {
  handoff: compileHandoff,
} as const;

type CompilerName = keyof typeof COMPILERS;

function isCompilerName(value: string): value is CompilerName {
  return Object.hasOwn(COMPILERS, value);
}

type WorkerInput = SuiteCase & {
  seed: number;
  budgets: number[];
  compiler: CompilerName;
  checkpointDir: string;
};
type WorkerCheckpoint = {
  budget: number;
  /** Per-budget compile wall-clock (each budget is an independent run). */
  elapsed_ms: number;
  report: DriftReport;
  stats: CompileStats;
  track_hash: string;
  track_path: string | null;
  report_path: string | null;
};
/** A budget whose independent compile threw — the other budgets in the row still
 *  succeed (per-budget partial failure). */
type BudgetFailure = {
  budget: number;
  /** Wall-clock the failed compile burned before throwing (so partial-row time rollups stay honest). */
  elapsed_ms: number;
  message: string;
};
type WorkerOk = {
  kind: "ok";
  specName: string;
  variant: VariantName;
  elapsed_ms: number;
  checkpoints: WorkerCheckpoint[];
  budgetFailures: BudgetFailure[];
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

type ScoredCheckpoint = V0ContractScore & {
  budget: number;
  name: string;
  variant: VariantName;
  seed: number;
  status: "pass" | "fail" | "timeout" | "error";
  worker_timeout_ms: number;
  /** Whole-compile wall-clock. Informational only. */
  elapsed_ms: number;
  message: string | null;
  track_hash: string | null;
  track_path: string | null;
  report_path: string | null;
  axes: ReturnType<typeof axisDetails>;
  worst_contacts: ReturnType<typeof worstContacts>;
  off_beat_frames: number[];
  compile_stats: CompileStats | null;
};

type ScoredRunRow = {
  name: string;
  variant: VariantName;
  seed: number;
  /** Display-only rollup: sum of the row's per-budget compile wall-clock. */
  elapsed_ms: number;
  worker_timeout_ms: number;
  /** `partial` = some (not all) budgets failed; the row still has one checkpoint
   *  per budget (failed budgets carry an error checkpoint). */
  status: "ok" | "partial" | "timeout" | "error";
  message: string | null;
  checkpoints: ScoredCheckpoint[];
};

type GroupScore = {
  name: string;
  score: number;
  passed: number;
  total: number;
};

type BudgetSummary = {
  budget: number;
  score: number;
  passed: number;
  total: number;
  contract_pass_rate: number;
  changed_tracks: number;
  improved_rows: number;
  plateau_rows: number;
  regressions: number;
  spec_scores: GroupScore[];
};

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function sourceSlice(path: string, startMarker: string, endMarker?: string): string {
  const source = readFileSync(resolve(path), "utf8");
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`could not locate ${startMarker} in ${path}`);
  if (endMarker === undefined) return source.slice(start);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`could not locate ${endMarker} in ${path}`);
  return source.slice(start, end);
}

function speedRulerFingerprintSource(): string {
  return sourceSlice(
    "scripts/v0/types.ts",
    "export const SPEED_RULER",
    "export const SPEED_AXIS",
  );
}

function effectiveAxesFingerprintSource(): string {
  return sourceSlice(
    "scripts/v0/core/substrate.ts",
    "export function effectiveAxes",
    "// ─────────── Cross-gap target sampling",
  );
}

function driftReportFingerprintSource(): string {
  return sourceSlice(
    "scripts/v0/core/substrate.ts",
    "export function buildDriftReport",
    "export function measureAxisOverRange",
  );
}

function axisMeasurementFingerprintSource(): string {
  return sourceSlice(
    "scripts/v0/core/measure.ts",
    "/** Airborne-frame fraction over [gap.start, rangeEndFrame]. */",
  );
}

function evaluatorFingerprint(): string {
  const h = createHash("sha256");
  const specDir = resolve("specs/golden");
  h.update(readFileSync(resolve("scripts/v0/score.ts")));
  h.update("\0speed-ruler\0");
  h.update(speedRulerFingerprintSource());
  h.update("\0effective-axes\0");
  h.update(effectiveAxesFingerprintSource());
  h.update("\0axis-measurement\0");
  h.update(axisMeasurementFingerprintSource());
  h.update("\0drift-report\0");
  h.update(driftReportFingerprintSource());
  for (const f of readdirSync(specDir).filter((n) => n.endsWith(".ts")).sort()) {
    h.update("\0golden-spec\0");
    h.update(readFileSync(resolve(specDir, f)));
  }
  return h.digest("hex").slice(0, 12);
}

function trackHash(track: unknown): string {
  return createHash("sha256").update(JSON.stringify(track)).digest("hex");
}

function gitMetadata(): { commit: string | null; dirty: boolean | null } {
  try {
    const commit = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const status = execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return { commit, dirty: status.trim().length > 0 };
  } catch {
    return { commit: null, dirty: null };
  }
}

function defaultArchiveDir(): string {
  const git = gitMetadata();
  const suffix = git.commit === null ? "nogit" : `${git.commit}${git.dirty ? "-dirty" : ""}`;
  const stamp = new Date().toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace("T", "-");
  return resolve("generated/golden-runs", `${stamp}-${suffix}-${process.pid}`);
}

function artifactStem(input: WorkerInput, budget: number): string {
  return `${input.specName}_${input.variant}_seed${input.seed}_b${budget}`;
}

function writeCheckpointArtifacts(
  input: WorkerInput,
  budget: number,
  track: unknown,
  report: DriftReport,
): { track_path: string; report_path: string } {
  const stem = resolve(input.checkpointDir, artifactStem(input, budget));
  const trackPath = `${stem}.track.json`;
  const reportPath = `${stem}.report.json`;
  mkdirSync(dirname(trackPath), { recursive: true });
  writeFileSync(trackPath, JSON.stringify(track, null, 2));
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return { track_path: trackPath, report_path: reportPath };
}

async function runWithTimeout(
  testCase: SuiteCase,
  seed: number,
  timeoutMs: number,
  budgets: number[],
  compiler: CompilerName,
  checkpointDir: string,
): Promise<RunResult> {
  const workerPath = fileURLToPath(import.meta.url);
  const input: WorkerInput = {
    ...testCase,
    seed,
    budgets,
    compiler,
    checkpointDir,
  };
  return await new Promise<RunResult>((resolvePromise) => {
    const worker = new Worker(workerPath, {
      workerData: input,
      execArgv: process.execArgv,
      // Enlarge V8 young-gen for the compile isolate: this workload is
      // scavenge-heavy (frame clones, CollisionUpdate, transient arrays), so a
      // larger young-gen cuts minor-GC frequency for ~6% faster compiles. Output
      // is unaffected (GC is transparent). maxYoungGenerationSizeMb is the worker-
      // sanctioned knob (--max-semi-space-size is rejected in worker execArgv);
      // note it sets TOTAL young-gen, so 128 ≈ --max-semi-space-size=64 (the two
      // semi-spaces). Measured −6.3% at 128, only −1.8% at 64. ~+0.77GB / 6 workers.
      resourceLimits: {
        maxOldGenerationSizeMb: WORKER_MEM_CAP_MB,
        maxYoungGenerationSizeMb: 128,
      },
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
      worker.terminate().catch(() => {});
      resolvePromise(msg);
    });
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
    const compile = COMPILERS[input.compiler];
    // Load spec + WASM once, then run each budget as an INDEPENDENT full compile.
    // Per-budget try/catch so one budget's failure doesn't lose the others.
    const checkpoints: WorkerCheckpoint[] = [];
    const budgetFailures: BudgetFailure[] = [];
    for (const budget of input.budgets) {
      const cb0 = Date.now();
      try {
        const checkpoint = compile(spec, input.seed, { budget });
        const elapsed_ms = Date.now() - cb0;
        const hash = trackHash(checkpoint.track);
        // Per-checkpoint track/report artifacts dominate archive size (~2 files ×
        // specs × seeds × budgets). For large budget-curve sweeps where only the
        // aggregated stats (golden.json rows) are needed, `GOLDEN_NO_ARTIFACTS=1`
        // skips them — the row keeps null paths and the dataset is unaffected.
        const paths = process.env.GOLDEN_NO_ARTIFACTS === "1"
          ? { track_path: null, report_path: null }
          : writeCheckpointArtifacts(input, budget, checkpoint.track, checkpoint.report);
        checkpoints.push({
          budget,
          elapsed_ms,
          report: checkpoint.report,
          stats: checkpoint.stats,
          track_hash: hash,
          ...paths,
        });
      } catch (error) {
        budgetFailures.push({ budget, elapsed_ms: Date.now() - cb0, message: String(error).slice(0, 200) });
      }
    }

    parentPort.postMessage({
      kind: "ok",
      specName: input.specName,
      variant: input.variant,
      elapsed_ms: Date.now() - t0,
      checkpoints,
      budgetFailures,
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

function failedCheckpoint(
  name: string,
  variant: VariantName,
  seed: number,
  budget: number,
  status: "timeout" | "error",
  message: string,
  elapsed_ms: number,
  ctx: ScoreContext,
): ScoredCheckpoint {
  return {
    ...emptyScore(),
    hard_failures: [status],
    budget,
    name,
    variant,
    seed,
    status,
    worker_timeout_ms: ctx.worker_timeout_ms,
    elapsed_ms,
    message,
    track_hash: null,
    track_path: null,
    report_path: null,
    axes: [],
    worst_contacts: [],
    off_beat_frames: [],
    compile_stats: null,
  };
}

/** Whole-row failure (worker timeout/crash): one error checkpoint per budget. */
function errorCheckpoint(
  result: TimeoutResult | WorkerErr,
  seed: number,
  budget: number,
  ctx: ScoreContext,
): ScoredCheckpoint {
  return failedCheckpoint(
    result.specName,
    result.variant,
    seed,
    budget,
    result.kind,
    result.message,
    result.elapsed_ms,
    ctx,
  );
}

function scoreCheckpoint(
  result: WorkerOk,
  checkpoint: WorkerCheckpoint,
  seed: number,
  ctx: ScoreContext,
): ScoredCheckpoint {
  const score = scoreDriftReport(checkpoint.report, { totalFrames: ctx.total_frames });
  return {
    ...score,
    budget: checkpoint.budget,
    name: result.specName,
    variant: result.variant,
    seed,
    status: score.contract_passed ? "pass" : "fail",
    worker_timeout_ms: ctx.worker_timeout_ms,
    elapsed_ms: checkpoint.elapsed_ms,
    message: score.hard_failures.length > 0 ? score.hard_failures.join(",") : null,
    track_hash: checkpoint.track_hash,
    track_path: checkpoint.track_path,
    report_path: checkpoint.report_path,
    axes: axisDetails(checkpoint.report),
    worst_contacts: worstContacts(checkpoint.report, 3),
    off_beat_frames: checkpoint.report.off_beat_landings.slice(0, 5).map((l) => l.frame),
    compile_stats: checkpoint.stats,
  };
}

function scoreRunResult(
  result: RunResult,
  seed: number,
  budgets: number[],
  ctx: ScoreContext,
): ScoredRunRow {
  if (result.kind === "timeout" || result.kind === "error") {
    return {
      name: result.specName,
      variant: result.variant,
      seed,
      elapsed_ms: result.elapsed_ms,
      worker_timeout_ms: ctx.worker_timeout_ms,
      status: result.kind,
      message: result.message,
      checkpoints: budgets.map((budget) => errorCheckpoint(result, seed, budget, ctx)),
    };
  }
  // Reassemble one checkpoint per budget: a successful compile is scored; a
  // per-budget failure (or a missing budget) gets a synthesized error checkpoint,
  // so row.checkpoints.length === budgets.length stays invariant.
  const okByBudget = new Map(result.checkpoints.map((c) => [c.budget, c]));
  const failByBudget = new Map(result.budgetFailures.map((f) => [f.budget, f]));
  const checkpoints = budgets.map((budget) => {
    const ok = okByBudget.get(budget);
    if (ok) return scoreCheckpoint(result, ok, seed, ctx);
    const fail = failByBudget.get(budget);
    const message = fail ? fail.message : "missing checkpoint";
    return failedCheckpoint(result.specName, result.variant, seed, budget, "error", message, fail?.elapsed_ms ?? 0, ctx);
  });
  // Single source of truth: a budget failed iff it has no ok checkpoint. The count and
  // the enumerated list both derive from this, so they can never disagree (covers both
  // thrown failures and any missing-from-both budget).
  const failedBudgets = budgets.filter((budget) => !okByBudget.has(budget));
  return {
    name: result.specName,
    variant: result.variant,
    seed,
    // Display-only rollup: total per-budget compile wall-clock for the row, including
    // time burned by budgets that failed before throwing.
    elapsed_ms:
      result.checkpoints.reduce((sum, c) => sum + c.elapsed_ms, 0) +
      result.budgetFailures.reduce((sum, f) => sum + f.elapsed_ms, 0),
    worker_timeout_ms: ctx.worker_timeout_ms,
    status: failedBudgets.length > 0 ? "partial" : "ok",
    message: failedBudgets.length > 0
      ? `${failedBudgets.length}/${budgets.length} budgets failed: ${failedBudgets.map(fmtBudget).join(",")}`
      : null,
    checkpoints,
  };
}

function specContext(
  spec: Spec,
  budgets: number[],
  concurrency: number,
): ScoreContext {
  const timeoutBudget = compilerWorkerTimeoutBudget(budgets);
  return {
    worker_timeout_ms: compilerWorkerTimeoutMs(timeoutBudget) * concurrency,
    total_frames: Math.round(spec.duration * FPS),
  };
}

function fmtBudget(budget: number): string {
  return budget % 1000 === 0 ? `${budget / 1000}k` : String(budget);
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

function caseLabel(row: Pick<ScoredCheckpoint, "name" | "variant">): string {
  return row.variant === "base" ? row.name : `${row.name}/${row.variant}`;
}

function rowId(row: Pick<ScoredCheckpoint, "name" | "variant" | "seed">): string {
  return `${row.name}/${row.variant}/seed=${row.seed}`;
}

function flattenCheckpoints(rows: ScoredRunRow[]): ScoredCheckpoint[] {
  return rows.flatMap((row) => row.checkpoints);
}

function rowsForBudget(rows: ScoredRunRow[], budget: number): ScoredCheckpoint[] {
  return rows.map((row) => {
    const checkpoint = row.checkpoints.find((c) => c.budget === budget);
    if (checkpoint === undefined) {
      throw new Error(`${rowId(row)} missing checkpoint for budget ${budget}`);
    }
    return checkpoint;
  });
}

function groupScores(rows: ScoredCheckpoint[], keyOf: (row: ScoredCheckpoint) => string): GroupScore[] {
  const groups = new Map<string, ScoredCheckpoint[]>();
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

function suiteScore(rows: ScoredCheckpoint[], keyOf: (row: ScoredCheckpoint) => string): number {
  return shiftedGeometricMean(groupScores(rows, keyOf).map((group) => group.score));
}

function summarizeBudgets(rows: ScoredRunRow[], budgets: number[]): BudgetSummary[] {
  const prevByRow = new Map<string, ScoredCheckpoint>();
  return budgets.map((budget) => {
    const budgetRows = rowsForBudget(rows, budget);
    let changed_tracks = 0;
    let improved_rows = 0;
    let plateau_rows = 0;
    let regressions = 0;
    for (const row of budgetRows) {
      const id = rowId(row);
      const prev = prevByRow.get(id);
      if (prev !== undefined) {
        if (prev.track_hash !== null && row.track_hash !== null && prev.track_hash !== row.track_hash) {
          changed_tracks++;
        }
        if (row.track_hash !== null && row.track_hash === prev.track_hash) plateau_rows++;
        if (row.score > prev.score + 1e-9) improved_rows++;
        if (row.score + 1e-9 < prev.score) regressions++;
      }
      prevByRow.set(id, row);
    }
    const passed = budgetRows.filter((row) => row.status === "pass").length;
    return {
      budget,
      score: suiteScore(budgetRows, (row) => row.name),
      passed,
      total: budgetRows.length,
      contract_pass_rate: budgetRows.length === 0 ? 0 : passed / budgetRows.length,
      changed_tracks,
      improved_rows,
      plateau_rows,
      regressions,
      spec_scores: groupScores(budgetRows, (row) => row.name),
    };
  });
}

function formatWorstAxes(axes: ScoredCheckpoint["axes"]): string {
  if (axes.length === 0) return "";
  const top = [...axes].sort((a, b) => Math.abs(b.error) - Math.abs(a.error)).slice(0, 4);
  return top.map((a) => {
    const delta = a.achieved - a.target;
    const sign = delta >= 0 ? "+" : "";
    return `g${a.gap_index}.${a.axis}=${a.achieved.toFixed(2)}(${sign}${delta.toFixed(2)})`;
  }).join("  ");
}

function formatWorstContacts(spec: ScoredCheckpoint): string | null {
  if (spec.worst_contacts.length === 0) return null;
  return spec.worst_contacts.map((c) => {
    if (c.status === "missing") return `t=${c.t_target.toFixed(2)}miss`;
    const sign = c.frame_error !== null && c.frame_error > 0 ? "+" : "";
    return `t=${c.t_target.toFixed(2)}${sign}${c.frame_error}f`;
  }).join("  ");
}

function printRunRow(row: ScoredRunRow, details: boolean): void {
  const last = row.checkpoints[row.checkpoints.length - 1];
  console.log(
    `${caseLabel(last).padEnd(32)} seed=${String(row.seed).padEnd(2)} ` +
      `${last.status.toUpperCase().padEnd(7)} max=${fmtBudget(last.budget).padStart(4)} ` +
      `score=${last.score.toFixed(0).padStart(4)} valid=${last.contract_passed ? "yes" : "no"} ` +
      `sim=${String(last.compile_stats?.sim_frames ?? 0).padStart(6)} t=${fmtMs(row.elapsed_ms)}`,
  );
  if (details || row.status !== "ok") {
    console.log(
      `  budgets:        ` +
        row.checkpoints.map((c) => `${fmtBudget(c.budget)}=${c.score.toFixed(0)}`).join("  "),
    );
    const worstAxes = formatWorstAxes(last.axes);
    if (worstAxes) console.log(`  worst axes:     ${worstAxes}`);
    const worstC = formatWorstContacts(last);
    if (worstC) console.log(`  worst contacts: ${worstC}`);
    if (last.off_beat_frames.length > 0) {
      console.log(`  off-beat:       frames ${last.off_beat_frames.join(", ")}`);
    }
    if (row.message) console.log(`  note:           ${row.message}`);
  }
}

function printBudgetCurve(label: string, rows: ScoredRunRow[], budgets: number[], canonical: boolean): void {
  const summaries = summarizeBudgets(rows, budgets);
  const flat = flattenCheckpoints(rows);
  const passed = flat.filter((row) => row.status === "pass").length;
  const timeouts = flat.filter((row) => row.status === "timeout").length;
  const invalid = flat.filter((row) => row.status === "fail" || row.status === "error").length;

  console.log(
    `${canonical ? label : `${label} (indicative)`} · ` +
      `valid ${passed}/${flat.length} · invalid ${invalid} · timeout ${timeouts}`,
  );
  console.log("  budget curve:");
  for (const summary of summaries) {
    console.log(
      `    ${fmtBudget(summary.budget).padStart(5)} ` +
        `score=${summary.score.toFixed(2).padStart(7)} ` +
        `valid=${String(summary.passed).padStart(2)}/${summary.total} ` +
        `changed=${String(summary.changed_tracks).padStart(2)} ` +
        `improved=${String(summary.improved_rows).padStart(2)} ` +
        `plateau=${String(summary.plateau_rows).padStart(2)} ` +
        `regress=${String(summary.regressions).padStart(2)}`,
    );
  }

  const lastBudget = budgets[budgets.length - 1];
  const worstRows = rowsForBudget(rows, lastBudget).sort((a, b) => a.score - b.score).slice(0, 5);
  console.log(`  worst rows at ${fmtBudget(lastBudget)}:`);
  for (const row of worstRows) {
    console.log(
      `    ${caseLabel(row).padEnd(38)} seed=${row.seed} ${row.status.padEnd(7)} ` +
        `score=${row.score.toFixed(2)} axis=${fmtPct(row.axis_quality)}`,
    );
  }
}

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
  budgets: number[],
  jsonOnly: boolean,
  details: boolean,
  label: string,
  jobs: number,
  compiler: CompilerName,
  checkpointDir: string,
): Promise<ScoredRunRow[]> {
  const contexts = new Map<string, ScoreContext>();
  for (const testCase of cases) {
    const key = `${testCase.specName}/${testCase.variant}`;
    if (!contexts.has(key)) {
      const spec = await loadGoldenSpec(testCase.specName, testCase.variant);
      contexts.set(key, specContext(spec, budgets, jobs));
    }
  }
  const tasks = seeds.flatMap((seed) => cases.map((testCase) => ({ seed, testCase })));
  let done = 0;
  const header =
    `${label}: ${tasks.length} compile${tasks.length === 1 ? "" : "s"}, ` +
    `${budgets.length} checkpoint${budgets.length === 1 ? "" : "s"}, ` +
    `${Math.min(jobs, tasks.length)} parallel`;
  if (!jsonOnly) {
    console.log(header);
  } else {
    // stdout must stay pure JSON under --json; emit a liveness heartbeat to stderr so
    // long background runs show progress instead of nothing until completion.
    process.stderr.write(`${header}\n`);
  }
  const scored = await runPool(tasks, jobs, async ({ seed, testCase }) => {
    const ctx = contexts.get(`${testCase.specName}/${testCase.variant}`)!;
    const result = await runWithTimeout(
      testCase,
      seed,
      ctx.worker_timeout_ms,
      budgets,
      compiler,
      checkpointDir,
    );
    const row = scoreRunResult(result, seed, budgets, ctx);
    done++;
    if (!jsonOnly) {
      process.stdout.write(`  [${String(done).padStart(2)}/${tasks.length}] `);
      printRunRow(row, details);
    } else {
      process.stderr.write(`\r  [${String(done).padStart(2)}/${tasks.length}] compiled`);
    }
    return row;
  });
  if (!jsonOnly) console.log("");
  else process.stderr.write("\n");
  return scored;
}

function compactStats(stats: CompileStats | null): object | null {
  if (stats === null) return null;
  return {
    candidates_sampled: stats.candidates_sampled,
    candidates_viable: stats.candidates_viable,
    sim_frames: stats.sim_frames,
    budget_exhausted: stats.budget_exhausted,
    leaves_considered: stats.leaves_considered,
    improvements: stats.improvements,
    polish_variants_tried: stats.polish_variants_tried,
    polish_variants_changed: stats.polish_variants_changed,
    polish_variants_adopted: stats.polish_variants_adopted,
    search_nodes_expanded: stats.search_nodes_expanded,
    frontier_max_size: stats.frontier_max_size,
    handoff_frontier_size: stats.handoff_frontier_size,
    handoff_pass_frontier_size: stats.handoff_pass_frontier_size,
    handoff_fallback_frontier_size: stats.handoff_fallback_frontier_size,
    handoff_frontier_min_gap: stats.handoff_frontier_min_gap,
    handoff_frontier_max_gap: stats.handoff_frontier_max_gap,
    handoff_deepest_seen_gap: stats.handoff_deepest_seen_gap,
    handoff_frontier_oldest_gap_lag: stats.handoff_frontier_oldest_gap_lag,
    handoff_frontier_mean_gap_lag: stats.handoff_frontier_mean_gap_lag,
    handoff_frontier_far_back_count: stats.handoff_frontier_far_back_count,
    handoff_far_back_pulses: stats.handoff_far_back_pulses,
    handoff_partial_evaluations: stats.handoff_partial_evaluations,
    handoff_full_evaluations: stats.handoff_full_evaluations,
    handoff_evaluations_by_phase: stats.handoff_evaluations_by_phase,
    handoff_full_evaluations_by_phase: stats.handoff_full_evaluations_by_phase,
    handoff_improvements_by_phase: stats.handoff_improvements_by_phase,
    handoff_unique_full_evaluations: stats.handoff_unique_full_evaluations,
    handoff_duplicate_evaluations: stats.handoff_duplicate_evaluations,
    handoff_duplicate_full_evaluations: stats.handoff_duplicate_full_evaluations,
    handoff_duplicate_evaluations_by_phase: stats.handoff_duplicate_evaluations_by_phase,
    handoff_duplicate_full_evaluations_by_phase:
      stats.handoff_duplicate_full_evaluations_by_phase,
    handoff_tail_completion_attempts: stats.handoff_tail_completion_attempts,
    handoff_tail_completion_successes: stats.handoff_tail_completion_successes,
    handoff_tail_completion_improvements: stats.handoff_tail_completion_improvements,
    handoff_tail_completion_attempts_by_remaining_contacts:
      stats.handoff_tail_completion_attempts_by_remaining_contacts,
    handoff_tail_completion_successes_by_remaining_contacts:
      stats.handoff_tail_completion_successes_by_remaining_contacts,
    handoff_tail_completion_improvements_by_remaining_contacts:
      stats.handoff_tail_completion_improvements_by_remaining_contacts,
    handoff_start_options: stats.handoff_start_options,
    handoff_start_rank: stats.handoff_start_rank,
    handoff_start_speed: stats.handoff_start_speed,
    handoff_start_angle_deg: stats.handoff_start_angle_deg,
    handoff_start_ranks_seen: stats.handoff_start_ranks_seen,
    handoff_start_ranks_with_fits: stats.handoff_start_ranks_with_fits,
    handoff_previews: stats.handoff_previews,
    handoff_preview_contacts: stats.handoff_preview_contacts,
    handoff_preview_survivors: stats.handoff_preview_survivors,
    handoff_reuse_attempts: stats.handoff_reuse_attempts,
    handoff_reuse_successes: stats.handoff_reuse_successes,
    handoff_brake_attempts: stats.handoff_brake_attempts,
    handoff_brake_successes: stats.handoff_brake_successes,
    handoff_axis_quality_attempts: stats.handoff_axis_quality_attempts,
    handoff_axis_quality_successes: stats.handoff_axis_quality_successes,
    handoff_axis_quality_by_axis: stats.handoff_axis_quality_by_axis,
    handoff_axis_quality_air_attempts: stats.handoff_axis_quality_air_attempts,
    handoff_axis_quality_air_successes: stats.handoff_axis_quality_air_successes,
    handoff_rescue_attempts: stats.handoff_rescue_attempts,
    handoff_rescue_successes: stats.handoff_rescue_successes,
    handoff_skips: stats.handoff_skips,
    handoff_skip_branches: stats.handoff_skip_branches,
    handoff_deferred_skips: stats.handoff_deferred_skips,
    handoff_search_seed: stats.handoff_search_seed,
    handoff_selected_candidate_rank_count: stats.handoff_selected_candidate_rank_count,
    handoff_selected_candidate_rank_mean: stats.handoff_selected_candidate_rank_mean,
    handoff_selected_candidate_rank_max: stats.handoff_selected_candidate_rank_max,
    handoff_selected_candidate_nonzero_ranks: stats.handoff_selected_candidate_nonzero_ranks,
    handoff_selected_candidate_by_source: stats.handoff_selected_candidate_by_source,
    handoff_selected_axis_quality_by_axis: stats.handoff_selected_axis_quality_by_axis,
    handoff_selected_candidate_pool_count: stats.handoff_selected_candidate_pool_count,
    handoff_selected_candidate_reuse_count: stats.handoff_selected_candidate_reuse_count,
    handoff_selected_candidate_brake_count: stats.handoff_selected_candidate_brake_count,
    handoff_selected_candidate_axis_quality_count:
      stats.handoff_selected_candidate_axis_quality_count,
    handoff_candidate_release_count: stats.handoff_candidate_release_count,
    handoff_candidate_release_speed_mean: stats.handoff_candidate_release_speed_mean,
    handoff_candidate_release_speed_min: stats.handoff_candidate_release_speed_min,
    handoff_candidate_release_speed_max: stats.handoff_candidate_release_speed_max,
    handoff_candidate_release_speed_std: stats.handoff_candidate_release_speed_std,
    handoff_candidate_release_grounded_mean: stats.handoff_candidate_release_grounded_mean,
    handoff_candidate_release_grounded_min: stats.handoff_candidate_release_grounded_min,
    handoff_candidate_release_grounded_max: stats.handoff_candidate_release_grounded_max,
    handoff_candidate_release_zero_grounded_count:
      stats.handoff_candidate_release_zero_grounded_count,
    handoff_candidate_release_airborne_count: stats.handoff_candidate_release_airborne_count,
    handoff_candidate_preview_count: stats.handoff_candidate_preview_count,
    handoff_candidate_preview_zero_next_count: stats.handoff_candidate_preview_zero_next_count,
    handoff_candidate_preview_first_survivors_mean:
      stats.handoff_candidate_preview_first_survivors_mean,
    handoff_candidate_preview_first_survivors_min:
      stats.handoff_candidate_preview_first_survivors_min,
    handoff_candidate_preview_first_survivors_max:
      stats.handoff_candidate_preview_first_survivors_max,
    arc_placement: stats.arc_placement,
  };
}

function compactJsonCheckpoint(row: ScoredCheckpoint): object {
  return {
    budget: row.budget,
    status: row.status,
    score: round(row.score),
    contract_passed: row.contract_passed,
    hard_failures: row.hard_failures,
    contacts: row.contacts,
    hits: row.hits,
    drift: row.drift,
    missing: row.missing,
    axis_quality: round(row.axis_quality, 4),
    axis_loss: round(row.axis_loss, 4),
    axis_error_rms: round(row.axis_error_rms, 4),
    elapsed_ms: row.elapsed_ms,
    track_hash: row.track_hash,
    track_path: row.track_path,
    report_path: row.report_path,
    compile_stats: compactStats(row.compile_stats),
    message: row.message,
  };
}

function detailedJsonCheckpoint(row: ScoredCheckpoint): object {
  return {
    ...compactJsonCheckpoint(row),
    sync_score: round(row.sync_score, 4),
    drift_quality: round(row.drift_quality, 4),
    missing_quality: round(row.missing_quality, 4),
    sync_quality: round(row.sync_quality, 4),
    off_beat_landings: row.off_beat_landings,
    off_beat_quality: round(row.off_beat_quality, 4),
    survival_quality: round(row.survival_quality, 4),
    axis_score: round(row.axis_score, 4),
    axis_error_total: round(row.axis_error_total, 4),
    axis_error_mean: round(row.axis_error_mean, 4),
    axis_error_max: round(row.axis_error_max, 4),
    axes: row.axes,
    worst_contacts: row.worst_contacts,
    off_beat_frames: row.off_beat_frames,
    compile_stats: row.compile_stats,
  };
}

function jsonRunRow(row: ScoredRunRow, detailed: boolean): object {
  return {
    name: row.name,
    variant: row.variant,
    seed: row.seed,
    status: row.status,
    elapsed_ms: row.elapsed_ms,
    message: row.message,
    checkpoints: row.checkpoints.map(detailed ? detailedJsonCheckpoint : compactJsonCheckpoint),
  };
}

function jsonBudgetSummary(summary: BudgetSummary): object {
  return {
    budget: summary.budget,
    score: round(summary.score),
    passed: summary.passed,
    total: summary.total,
    contract_pass_rate: round(summary.contract_pass_rate, 4),
    changed_tracks: summary.changed_tracks,
    improved_rows: summary.improved_rows,
    plateau_rows: summary.plateau_rows,
    regressions: summary.regressions,
    spec_scores: summary.spec_scores.map((group) => ({
      ...group,
      score: round(group.score),
    })),
  };
}

function normalizeBudgets(raw: string | null): number[] {
  const source = raw ?? [...DEFAULT_BUDGETS].join(",");
  // Reuse the canonical comma-split + Number(not parseInt) validator (rejects "50k"
  // loudly instead of silently truncating); golden adds dedup + sort on top.
  const budgets = parseBudgetList(source);
  if (budgets.length === 0) throw new Error("--budgets must contain at least one positive number");
  const seen = new Set<number>();
  for (const budget of budgets) {
    if (seen.has(budget)) throw new Error(`--budgets contains duplicate budget ${budget}`);
    seen.add(budget);
  }
  return budgets.sort((a, b) => a - b);
}

function normalizeSeedOverride(raw: string | undefined): number[] | null {
  if (raw === undefined || raw.trim() === "") return null;
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error("GOLDEN_SEEDS_OVERRIDE must contain at least one seed");
  const seeds = parts.map((part) => {
    const value = Math.trunc(Number(part));
    if (!Number.isFinite(value)) {
      throw new Error(`GOLDEN_SEEDS_OVERRIDE values must be numbers, got ${part}`);
    }
    return value;
  });
  const seen = new Set<number>();
  for (const seed of seeds) {
    if (seen.has(seed)) throw new Error(`GOLDEN_SEEDS_OVERRIDE contains duplicate seed ${seed}`);
    seen.add(seed);
  }
  return seeds;
}

function sameBudgets(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((budget, i) => budget === b[i]);
}

async function runMain(): Promise<void> {
  if (arg("budget") !== null) {
    throw new Error("--budget has been removed from golden; use --budgets=50000");
  }
  if (has("fast")) {
    throw new Error("--fast has been removed from golden; use --specs, --seed, and --budgets for targeted probes");
  }
  if (has("screen")) {
    throw new Error("--screen has been removed from golden; use tiny probes or full canonical runs");
  }

  if (has("verify-checkpoints")) {
    throw new Error("--verify-checkpoints has been removed: every budget is now an independent standalone run");
  }
  if (arg("score-budgets") !== null || arg("alpha") !== null) {
    throw new Error("--score-budgets/--alpha are removed: the headline is the budget-value-weighted average over the run's budgets");
  }
  const jsonOnly = has("json") || has("json-full");
  const details = has("details") || has("json-full");
  const includeVariants = has("variants");
  const source = gitMetadata();
  const archiveDir = resolve(arg("archive-dir") ?? defaultArchiveDir());
  const checkpointDir = resolve(archiveDir, "checkpoints");
  const budgets = normalizeBudgets(arg("budgets"));
  // The headline scores over ALL of the run's budgets, weighted by budget value.
  const weightByBudget = budgetWeights(budgets);

  const rawSeed = arg("seed");
  const debugSeed = rawSeed !== null ? Math.trunc(Number(rawSeed)) : null;
  if (rawSeed !== null && !Number.isFinite(debugSeed)) {
    throw new Error(`--seed must be a number, got ${rawSeed}`);
  }
  const seedOverride = normalizeSeedOverride(process.env.GOLDEN_SEEDS_OVERRIDE);
  if (seedOverride !== null && rawSeed !== null) {
    throw new Error("use either --seed or GOLDEN_SEEDS_OVERRIDE, not both");
  }

  const rawCompiler = arg("compiler");
  let compiler: CompilerName = "handoff";
  if (rawCompiler !== null) {
    if (!isCompilerName(rawCompiler)) {
      throw new Error(`--compiler must be "handoff", got ${rawCompiler}`);
    }
    compiler = rawCompiler;
  }

  const rawJobs = arg("jobs");
  if (rawJobs !== null && (!Number.isInteger(Number(rawJobs)) || Number(rawJobs) < 1)) {
    throw new Error(`--jobs must be a positive integer, got ${rawJobs}`);
  }
  const jobs = rawJobs !== null ? Number(rawJobs) : DEFAULT_JOBS;

  const seeds = seedOverride ?? (debugSeed !== null ? [debugSeed] : [...GOLDEN_SEEDS]);
  const specFilter = arg("specs");
  const filterSet = specFilter ? new Set(specFilter.split(",").filter(Boolean)) : null;
  const keep = (c: SuiteCase) => filterSet === null || filterSet.has(c.specName);
  const headlineFiltered = headlineCases().filter(keep);
  // Allow --specs to name specs OUTSIDE the headline GOLDEN_SPECS registry (e.g.
  // the fragile/excluded `opening_burst`) by loading them directly from disk.
  // This keeps the headline benchmark untouched while letting a focused campaign
  // target excluded/fragile specs. Only base variant; --specs typo surfaces as a
  // clear load error from loadGoldenSpec.
  const present = new Set(headlineFiltered.map((c) => c.specName));
  const extraCases: SuiteCase[] = filterSet
    ? [...filterSet]
        .filter((name) => !present.has(name as GoldenSpecName))
        .map((name) => ({ specName: name as GoldenSpecName, variant: "base" as const }))
    : [];
  const headline = [...headlineFiltered, ...extraCases];
  const variants = variantCases().filter(keep);

  const canonical =
    filterSet === null &&
    debugSeed === null &&
    seedOverride === null &&
    sameBudgets(budgets, DEFAULT_BUDGETS);
  // A non-canonical run is a lower-power preview: comparable via `decide` on the
  // shared budgets/seeds, but never promotable on its own.
  const tier: "canonical" | "probe" = canonical ? "canonical" : "probe";

  if (!jsonOnly) {
    const fp = evaluatorFingerprint();
    console.log(
      `evaluator_fingerprint ${fp}` +
        (fp === EVALUATOR_FINGERPRINT
          ? ""
          : "  DRIFTED from committed ruler; scores are not comparable to history"),
    );
    if (jobs > 1) {
      console.log("note: per-row t= readings are wall-clock under contention (informational; not scored). Use --jobs=1 for clean timing.");
    }
    if (!canonical) {
      console.log(
        `NON-CANONICAL run (indicative): ` +
          `${compiler !== "handoff" ? `compiler=${compiler} ` : ""}` +
          `budgets=${budgets.join(",")} ` +
          `${filterSet ? `specs=${[...filterSet].join(",")} ` : ""}` +
          `${debugSeed !== null ? `seed=${debugSeed}` : ""}`.trim(),
      );
    }
    console.log(`archive: ${archiveDir}`);
    console.log(`checkpoint artifacts: ${checkpointDir}`);
    console.log(
      `v0 golden budget curve · ${headline.length} spec${headline.length === 1 ? "" : "s"} × ` +
        `${seeds.length} seed${seeds.length === 1 ? "" : "s"} × ${budgets.length} budgets · ` +
        `jobs=${jobs} · compiler=${compiler} · budgets=${budgets.map(fmtBudget).join(",")} · ` +
        `seeds=${seeds.join(",")}`,
    );
    console.log("");
  }

  const scored = await runRows(
    headline,
    seeds,
    budgets,
    jsonOnly,
    details,
    "headline",
    jobs,
    compiler,
    checkpointDir,
  );

  const headlineSummaries = summarizeBudgets(scored, budgets);
  const headlinePoints: CurvePoint[] = budgets.map((b) => ({
    budget: b,
    score: headlineSummaries.find((s) => s.budget === b)?.score ?? 0,
  }));
  const headlineScoreValue = weightedBudgetScore(headlinePoints, weightByBudget);

  let variantRows: ScoredRunRow[] = [];
  let variantSummaries: BudgetSummary[] = [];
  let variantHeadlineScore = 0;
  if (includeVariants) {
    if (!jsonOnly) {
      console.log("");
      console.log("report-only variants");
      console.log("");
    }
    variantRows = await runRows(
      variants,
      seeds,
      budgets,
      jsonOnly,
      details,
      "variant",
      jobs,
      compiler,
      checkpointDir,
    );
    variantSummaries = summarizeBudgets(variantRows, budgets);
    variantHeadlineScore = weightedBudgetScore(
      budgets.map((b) => ({ budget: b, score: variantSummaries.find((s) => s.budget === b)?.score ?? 0 })),
      weightByBudget,
    );
  }

  const output = {
    canonical,
    compiler,
    evaluator_fingerprint: evaluatorFingerprint(),
    source,
    archive: {
      dir: archiveDir,
      json_path: resolve(archiveDir, "golden.json"),
      checkpoint_dir: checkpointDir,
    },
    headline: {
      kind: "weighted_budget_average",
      tier,
      n_seeds: seeds.length,
      score: round(headlineScoreValue),
      weight_by_budget: weightByBudget.map((w) => ({ budget: w.budget, weight: round(w.weight, 6) })),
      budgets: [...budgets],
      // Per-budget validity is a diagnostic; it does not gate the decision.
      validity: headlineSummaries.map((s) => ({ budget: s.budget, pass_rate: round(s.contract_pass_rate, 4) })),
    },
    budgets,
    scoring: {
      axis_quality_tolerance: AXIS_QUALITY_TOLERANCE,
      sync_tolerance_frames: SYNC_TOLERANCE,
      missing_contact_tolerance: MISSING_CONTACT_TOLERANCE,
      off_beat_tolerance: OFF_BEAT_TOLERANCE,
      aggregation: "shifted_geometric_mean_by_budget_then_spec",
      json_detail: details ? "detailed" : "compact",
      budget_unit: "simulated rider frames (untimed; wall-clock never scored)",
    },
    scope: {
      headline_specs: headline.length,
      seeds,
      seed_count: seeds.length,
      row_count: scored.length,
      checkpoint_count: flattenCheckpoints(scored).length,
    },
    budget_scores: headlineSummaries.map(jsonBudgetSummary),
    rows: scored.map((row) => jsonRunRow(row, details)),
    variants: includeVariants
      ? {
          enabled: true,
          headline_score: round(variantHeadlineScore),
          variants: [...REPORT_VARIANTS],
          budget_scores: variantSummaries.map(jsonBudgetSummary),
          rows: variantRows.map((row) => jsonRunRow(row, details)),
        }
      : { enabled: false },
  };
  const jsonText = JSON.stringify(output, null, 2) + "\n";
  mkdirSync(archiveDir, { recursive: true });
  writeFileSync(output.archive.json_path, jsonText);

  if (jsonOnly) {
    process.stdout.write(jsonText);
  } else {
    printBudgetCurve("budget curve", scored, budgets, canonical);
    {
      const bmax = headlineSummaries[headlineSummaries.length - 1];
      console.log(
        `  HEADLINE ${round(headlineScoreValue)} · weighted-avg over budgets=${budgets.map(fmtBudget).join(",")} ` +
          `(weights∝budget) · tier=${tier} · validity@${fmtBudget(bmax.budget)}=${bmax.passed}/${bmax.total}`,
      );
    }
    if (includeVariants) {
      console.log("");
      printBudgetCurve("variant budget curve", variantRows, budgets, false);
      console.log("  variants probe generalization (perturbed timing/stretch); excluded from HEADLINE.");
    }
    console.log("");
    console.log(`archived golden JSON -> ${output.archive.json_path}`);
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
