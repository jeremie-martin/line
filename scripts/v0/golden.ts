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

import { compile } from "./compile.ts";
import { FPS, type CompileStats, type DriftReport, type Spec } from "./types.ts";
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
  scoreTimedDriftReport,
  shiftedGeometricMean,
  worstContacts,
  type V0TimedContractScore,
} from "./score.ts";

type WorkerInput = SuiteCase & { seed: number };
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
  compile_stats: CompileStats | null;
};

type GroupScore = {
  name: string;
  score: number;
  passed: number;
  total: number;
  time_multiplier_mean: number;
};

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function runWithTimeout(
  testCase: SuiteCase,
  seed: number,
  timeoutMs: number,
): Promise<RunResult> {
  const workerPath = fileURLToPath(import.meta.url);
  const input: WorkerInput = { ...testCase, seed };
  return await new Promise<RunResult>((resolvePromise, reject) => {
    const worker = new Worker(workerPath, { workerData: input, execArgv: process.execArgv });
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
    const { report, stats } = compile(spec, input.seed);
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

function scoreResult(result: RunResult, seed: number, ctx: ScoreContext): ScoredSpec {
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
  const score = scoreTimedDriftReport(
    result.report,
    { elapsed_ms: result.elapsed_ms, soft_ms: ctx.soft_ms, hard_ms: ctx.hard_ms },
    { totalFrames: ctx.total_frames },
  );
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

function specContext(spec: Spec): ScoreContext {
  const numContacts = spec.contacts.length;
  return {
    soft_ms: softBudgetMs(numContacts),
    hard_ms: hardBudgetMs(numContacts),
    worker_timeout_ms: workerTimeoutMs(numContacts),
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
  jsonOnly: boolean,
  details: boolean,
  label: string,
): Promise<ScoredSpec[]> {
  const contexts = new Map<string, ScoreContext>();
  for (const testCase of cases) {
    const key = `${testCase.specName}/${testCase.variant}`;
    if (!contexts.has(key)) {
      const spec = await loadGoldenSpec(testCase.specName, testCase.variant);
      contexts.set(key, specContext(spec));
    }
  }
  const scored: ScoredSpec[] = [];
  for (const seed of seeds) {
    if (!jsonOnly) {
      console.log(`${label} seed=${seed}`);
    }
    for (const testCase of cases) {
      const ctx = contexts.get(`${testCase.specName}/${testCase.variant}`)!;
      const result = await runWithTimeout(testCase, seed, ctx.worker_timeout_ms);
      const row = scoreResult(result, seed, ctx);
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

async function runMain(): Promise<void> {
  const jsonOnly = has("json") || has("json-full");
  const details = has("details") || has("json-full");
  const includeVariants = has("variants");
  const rawSeed = arg("seed");
  const debugSeed = rawSeed !== null ? Math.trunc(Number(rawSeed)) : null;
  if (rawSeed !== null && !Number.isFinite(debugSeed)) {
    throw new Error(`--seed must be a number, got ${rawSeed}`);
  }
  const seeds = debugSeed !== null ? [debugSeed] : [...GOLDEN_SEEDS];
  const headline = headlineCases();
  const variants = variantCases();

  if (!jsonOnly) {
    console.log(
      `v0 golden benchmark · ${GOLDEN_SPECS.length} specs × ${seeds.length} seed${seeds.length === 1 ? "" : "s"} · ` +
        `runtime budget scales per-contact · seeds=${seeds.join(",")}`,
    );
    console.log("");
  }

  const scored = await runRows(headline, seeds, jsonOnly, details, "headline");
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
    variantRows = await runRows(variants, seeds, jsonOnly, details, "variant");
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
        runtime: "per-spec affine in contact count (see golden_suite.softBudgetMs)",
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
