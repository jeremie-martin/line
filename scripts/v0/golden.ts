/**
 * v0 golden benchmark — single source of truth for the compiler goal.
 *
 *   npm run golden
 *   npm run golden -- --json
 *   npm run golden -- --details
 *   npm run golden -- --seed=42
 *   npm run golden -- --variants
 *
 * Headline score: 8 hand-authored golden specs × fixed seeds [0,1,2].
 * Optional variants are report-only robustness probes and are not included in
 * GOAL_SCORE.
 */

import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";

import { compile } from "./compile.ts";
import type { DriftReport } from "./types.ts";
import {
  GOLDEN_SEEDS,
  GOLDEN_SPECS,
  REPORT_VARIANTS,
  WORKER_TIMEOUT_MS,
  budgetFor,
  headlineCases,
  loadGoldenSpec,
  variantCases,
  type SuiteCase,
  type VariantName,
} from "./golden_suite.ts";
import {
  AXIS_QUALITY_TOLERANCE,
  axisDetails,
  scoreDriftReport,
  shiftedGeometricMean,
  worstContacts,
  type V0ContractScore,
} from "./score.ts";

type WorkerStrategy = "legacy" | "lds";
type WorkerInput = SuiteCase & { seed: number; strategy: WorkerStrategy };
type WorkerOk = {
  kind: "ok";
  specName: string;
  variant: VariantName;
  elapsed_ms: number;
  report: DriftReport;
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
  elapsed_ms: number;
  worker_timeout_ms: number;
  message: string | null;
  axes: ReturnType<typeof axisDetails>;
  worst_contacts: ReturnType<typeof worstContacts>;
  off_beat_frames: number[];
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

function runtimeScale(): number {
  const raw = arg("runtime-scale");
  if (raw === null) return 1;
  const scale = Number(raw);
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error(`--runtime-scale must be a positive number, got ${raw}`);
  }
  return scale;
}

function workerTimeoutMs(): number {
  return Math.round(WORKER_TIMEOUT_MS * runtimeScale());
}

async function runWithTimeout(testCase: SuiteCase, seed: number): Promise<RunResult> {
  const workerPath = fileURLToPath(import.meta.url);
  const strategy: WorkerStrategy = has("lds") ? "lds" : "legacy";
  const input: WorkerInput = { ...testCase, seed, strategy };
  const timeoutMs = workerTimeoutMs();
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
    const { report } = input.strategy === "lds"
      ? compile(spec, { seed: input.seed, strategy: input.strategy, budget: budgetFor(spec) })
      : compile(spec, input.seed);
    parentPort.postMessage({
      kind: "ok",
      specName: input.specName,
      variant: input.variant,
      elapsed_ms: Date.now() - t0,
      report,
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

function emptyScore(): V0ContractScore {
  return {
    score: 0,
    passed: false,
    valid_contract: false,
    hard_failures: [],
    contacts: 0,
    hits: 0,
    drift: 0,
    missing: 0,
    sync_score: 0,
    off_beat_landings: 0,
    died: 0,
    axis_count: 0,
    axis_error_total: 0,
    axis_error_mean: 0,
    axis_error_max: 0,
    axis_loss: 0,
    axis_quality: 0,
    axis_score: 0,
  };
}

function scoreResult(result: RunResult, seed: number): ScoredSpec {
  if (result.kind === "timeout") {
    return {
      ...emptyScore(),
      hard_failures: ["timeout"],
      name: result.specName,
      variant: result.variant,
      seed,
      status: "timeout",
      elapsed_ms: result.elapsed_ms,
      worker_timeout_ms: workerTimeoutMs(),
      message: result.message,
      axes: [],
      worst_contacts: [],
      off_beat_frames: [],
    };
  }
  if (result.kind === "error") {
    return {
      ...emptyScore(),
      hard_failures: ["error"],
      name: result.specName,
      variant: result.variant,
      seed,
      status: "error",
      elapsed_ms: result.elapsed_ms,
      worker_timeout_ms: workerTimeoutMs(),
      message: result.message,
      axes: [],
      worst_contacts: [],
      off_beat_frames: [],
    };
  }
  const score = scoreDriftReport(result.report);
  return {
    ...score,
    name: result.specName,
    variant: result.variant,
    seed,
    status: score.passed ? "pass" : "fail",
    elapsed_ms: result.elapsed_ms,
    worker_timeout_ms: workerTimeoutMs(),
    message: score.hard_failures.length > 0 ? score.hard_failures.join(",") : null,
    axes: axisDetails(result.report),
    worst_contacts: worstContacts(result.report, 3),
    off_beat_frames: result.report.off_beat_landings.slice(0, 5).map((l) => l.frame),
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
      `time=${fmtMs(row.elapsed_ms)}/${fmtMs(row.worker_timeout_ms)}`,
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

async function runRows(
  cases: SuiteCase[],
  seeds: number[],
  jsonOnly: boolean,
  details: boolean,
  label: string,
): Promise<ScoredSpec[]> {
  const scored: ScoredSpec[] = [];
  for (const seed of seeds) {
    if (!jsonOnly) {
      console.log(`${label} seed=${seed}`);
    }
    for (const testCase of cases) {
      const result = await runWithTimeout(testCase, seed);
      const row = scoreResult(result, seed);
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
    passed: row.passed,
    valid_contract: row.valid_contract,
    hard_failures: row.hard_failures,
    contacts: row.contacts,
    hits: row.hits,
    drift: row.drift,
    missing: row.missing,
    sync_score: round(row.sync_score, 4),
    off_beat_landings: row.off_beat_landings,
    died: row.died,
    axis_count: row.axis_count,
    axis_quality: round(row.axis_quality, 4),
    axis_loss: round(row.axis_loss, 4),
    axis_error_mean: round(row.axis_error_mean, 4),
    axis_error_max: round(row.axis_error_max, 4),
    elapsed_ms: row.elapsed_ms,
    worker_timeout_ms: row.worker_timeout_ms,
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
    axis_score: round(row.axis_score, 4),
    axis_quality: round(row.axis_quality, 4),
    axis_loss: round(row.axis_loss, 4),
    axis_error_total: round(row.axis_error_total, 4),
    axis_error_mean: round(row.axis_error_mean, 4),
    axis_error_max: round(row.axis_error_max, 4),
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
        `worker timeout ${fmtMs(workerTimeoutMs())} · ` +
        `seeds=${seeds.join(",")}`,
    );
    console.log("");
  }

  const scored = await runRows(headline, seeds, jsonOnly, details, "headline");
  const specScores = groupScores(scored, (row) => row.name);
  const goal_score = suiteScore(scored, (row) => row.name);
  const passed = scored.filter((row) => row.status === "pass").length;
  const perSeed = seeds.map((seed) => {
    const rows = scored.filter((row) => row.seed === seed);
    return {
      seed,
      goal_score: round(suiteScore(rows, (row) => row.name)),
      passed: rows.filter((row) => row.status === "pass").length,
      total: rows.length,
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
      scoring: {
        axis_quality_tolerance: AXIS_QUALITY_TOLERANCE,
        aggregation: "shifted_geometric_mean_by_spec",
        json_detail: details ? "detailed" : "compact",
        runtime: {
          worker_timeout_ms: workerTimeoutMs(),
          scale: runtimeScale(),
        },
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
    printSummary("GOAL_SCORE", scored, (row) => row.name);
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
