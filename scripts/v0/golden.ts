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

import { compile } from "./compile.ts";
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
  hardBudgetMs,
  headlineCases,
  ldsWorkerTimeoutMs,
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

type Strategy = "legacy" | "lds";
// `budgetUnits` overrides the per-spec default (golden_suite.budgetFor) when set
// — used by --fast / --budget for quick, NON-CANONICAL iteration. null = the
// canonical budget that defines goal_score.
type WorkerInput = SuiteCase & { seed: number; strategy: Strategy; budgetUnits: number | null };
type WorkerOk = {
  kind: "ok";
  specName: string;
  variant: VariantName;
  strategy: Strategy;
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
  strategy: Strategy,
  budgetUnits: number | null,
): Promise<RunResult> {
  const workerPath = fileURLToPath(import.meta.url);
  const input: WorkerInput = { ...testCase, seed, strategy, budgetUnits };
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
    const budget = input.budgetUnits !== null
      ? { kind: "work" as const, units: input.budgetUnits }
      : budgetFor(spec);
    const { report, stats } = input.strategy === "lds"
      ? compileLDS(spec, input.seed, { budget })
      : compile(spec, input.seed);
    parentPort.postMessage({
      kind: "ok",
      specName: input.specName,
      variant: input.variant,
      strategy: input.strategy,
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
  // The LDS compiler is budget-metered (sim-frames), not wall-clock-gated, so
  // it scores on PURE quality (time_multiplier = 1) — the same untimed basis
  // as baselines/greedy_v1.json. The legacy compiler keeps the wall-clock
  // time penalty. (The time_multiplier machinery is retired at cutover.)
  const score: V0TimedContractScore = result.strategy === "lds"
    ? (() => {
        const base = scoreDriftReport(result.report, { totalFrames: ctx.total_frames });
        return {
          ...base,
          score_without_time: base.score,
          time_multiplier: 1,
          elapsed_ms: result.elapsed_ms,
          soft_ms: ctx.soft_ms,
          hard_ms: ctx.hard_ms,
        };
      })()
    : scoreTimedDriftReport(
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

function specContext(spec: Spec, strategy: Strategy, budgetUnits: number | null): ScoreContext {
  const numContacts = spec.contacts.length;
  return {
    soft_ms: softBudgetMs(numContacts),
    hard_ms: hardBudgetMs(numContacts),
    // LDS is much slower than legacy and needs a budget-scaled safety cap, or
    // normal compiles get killed mid-search and falsely scored 0. Scale off the
    // effective budget (override or canonical) so --fast / --budget runs get a
    // proportionally tighter cap, not the full-budget one.
    worker_timeout_ms: strategy === "lds"
      ? ldsWorkerTimeoutMs(budgetUnits ?? budgetFor(spec).units)
      : workerTimeoutMs(numContacts),
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
  strategy: Strategy,
  budgetUnits: number | null,
): Promise<ScoredSpec[]> {
  const contexts = new Map<string, ScoreContext>();
  for (const testCase of cases) {
    const key = `${testCase.specName}/${testCase.variant}`;
    if (!contexts.has(key)) {
      const spec = await loadGoldenSpec(testCase.specName, testCase.variant);
      contexts.set(key, specContext(spec, strategy, budgetUnits));
    }
  }
  const scored: ScoredSpec[] = [];
  for (const seed of seeds) {
    if (!jsonOnly) {
      console.log(`${label} seed=${seed}`);
    }
    for (const testCase of cases) {
      const ctx = contexts.get(`${testCase.specName}/${testCase.variant}`)!;
      const result = await runWithTimeout(testCase, seed, ctx.worker_timeout_ms, strategy, budgetUnits);
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
  // LDS is the shipping compiler; legacy is opt-in (--legacy) for comparison.
  const strategy: Strategy = has("legacy") ? "legacy" : "lds";
  const fast = has("fast");
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
  // LDS suite at the default budget, all specs, all seeds. Anything narrower
  // (--fast / --budget / --specs / --seed / --legacy) is indicative signal for
  // iterating, never the metric of record. The harness labels it as such so a
  // fast probe is never mistaken for the goal.
  const canonical = strategy === "lds"
    && budgetUnits === null
    && filterSet === null
    && debugSeed === null;

  if (!jsonOnly) {
    const fp = evaluatorFingerprint();
    console.log(`evaluator_fingerprint ${fp}${fp === EVALUATOR_FINGERPRINT ? "" : "  ⚠ DRIFTED from committed ruler — scores not comparable to history; see GOAL_LDS.md"}`);
    if (!canonical) {
      console.log(
        `⚠ NON-CANONICAL run (indicative only, NOT goal_score): ` +
          `${strategy === "legacy" ? "legacy " : ""}${fast ? "fast " : ""}` +
          `${budgetUnits !== null ? `budget=${budgetUnits} ` : ""}` +
          `${filterSet ? `specs=${[...filterSet].join(",")} ` : ""}${debugSeed !== null ? `seed=${debugSeed}` : ""}`.trim(),
      );
    }
    console.log(
      `v0 golden benchmark · compiler=${strategy} · ${headline.length} spec${headline.length === 1 ? "" : "s"} × ${seeds.length} seed${seeds.length === 1 ? "" : "s"} · ` +
        `${strategy === "lds" ? `budget=${budgetUnits ?? "default"} physics-frames (untimed score)` : "runtime budget scales per-contact"} · seeds=${seeds.join(",")}`,
    );
    console.log("");
  }

  const scored = await runRows(headline, seeds, jsonOnly, details, "headline", strategy, budgetUnits);
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
    variantRows = await runRows(variants, seeds, jsonOnly, details, "variant", strategy, budgetUnits);
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
