/**
 * v0 goal metric.
 *
 * Fast, bounded evaluation of the v0 compiler contract:
 *   - hard Contact sync within +/-1 frame,
 *   - no landing on non-beat frames,
 *   - survival,
 *   - measured section axes close to specified section axes,
 *   - runtime capped by a wall-clock budget.
 *
 *   npm run goal
 *   npm run goal -- --json
 *   npm run goal -- --specs=sanity,quick_multi_axis --timeout-scale=3
 *   npm run goal -- --suite=full
 */

import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { compile } from "./v0/compile.ts";
import type { DriftReport, Spec } from "./v0/types.ts";
import { V0_FULL_BENCHMARK_SPECS, V0_GOAL_SPECS, V0_KNOWN_SPECS } from "./v0/bench_specs.ts";
import {
  axisDetails,
  scoreDriftReport,
  worstContacts,
  type V0ContractScore,
} from "./v0/score.ts";

const SEED = 0;
const DEFAULT_TIMEOUT_SCALE = 5;
const DEFAULT_TIMEOUT_MAX_MS = 60_000;

type WorkerInput = {
  specName: string;
  seed: number;
};

type WorkerSuccess = {
  kind: "ok";
  specName: string;
  elapsed_ms: number;
  report: DriftReport;
};

type WorkerFailure = {
  kind: "error";
  specName: string;
  elapsed_ms: number;
  message: string;
};

type WorkerResult = WorkerSuccess | WorkerFailure;

type TimeoutResult = {
  kind: "timeout";
  specName: string;
  elapsed_ms: number;
  message: string;
};

type RunResult = WorkerResult | TimeoutResult;

type ScoredSpec = V0ContractScore & {
  name: string;
  status: "pass" | "fail" | "timeout" | "error";
  elapsed_ms: number;
  budget_ms: number;
  message: string | null;
  axes: ReturnType<typeof axisDetails>;
  worst_contacts: ReturnType<typeof worstContacts>;
  off_beat_frames: number[];
};

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function positiveNumber(raw: string | null, fallback: number, name: string): number {
  if (raw === null) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive number`);
  }
  return parsed;
}

function specDurationMs(spec: Spec): number {
  return spec.duration * 1000;
}

async function loadSpec(name: string): Promise<Spec> {
  const mod = await import(resolve(`scripts/v0/specs/${name}.ts`));
  return mod.default as Spec;
}

async function runWithTimeout(specName: string, seed: number, budgetMs: number): Promise<RunResult> {
  const workerPath = fileURLToPath(import.meta.url);
  const input: WorkerInput = { specName, seed };

  return await new Promise<RunResult>((resolvePromise, reject) => {
    const worker = new Worker(workerPath, {
      workerData: input,
      execArgv: process.execArgv,
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate().catch(() => {});
      resolvePromise({
        kind: "timeout",
        specName,
        elapsed_ms: budgetMs,
        message: `TIMEOUT after ${fmtMs(budgetMs)}`,
      });
    }, budgetMs);

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
        specName,
        elapsed_ms: 0,
        message: code === 0 ? "worker exited without result" : `worker exited ${code}`,
      });
    });
  });
}

async function runWorker(): Promise<void> {
  if (!parentPort) throw new Error("goal_metric worker requires parentPort");
  const input = workerData as WorkerInput;
  const t0 = Date.now();
  try {
    const spec = await loadSpec(input.specName);
    const { report } = compile(spec, input.seed);
    parentPort.postMessage({
      kind: "ok",
      specName: input.specName,
      elapsed_ms: Date.now() - t0,
      report,
    } satisfies WorkerSuccess);
  } catch (error) {
    parentPort.postMessage({
      kind: "error",
      specName: input.specName,
      elapsed_ms: Date.now() - t0,
      message: String(error).slice(0, 200),
    } satisfies WorkerFailure);
  }
}

function scoreResult(result: RunResult, budgetMs: number): ScoredSpec {
  const empty: Omit<V0ContractScore, "hard_failures"> & { hard_failures: string[] } = {
    score: 0,
    passed: false,
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
    axis_score: 0,
  };

  if (result.kind === "timeout") {
    return {
      ...empty,
      hard_failures: ["timeout"],
      name: result.specName,
      status: "timeout",
      elapsed_ms: result.elapsed_ms,
      budget_ms: budgetMs,
      message: result.message,
      axes: [],
      worst_contacts: [],
      off_beat_frames: [],
    };
  }
  if (result.kind === "error") {
    return {
      ...empty,
      hard_failures: ["error"],
      name: result.specName,
      status: "error",
      elapsed_ms: result.elapsed_ms,
      budget_ms: budgetMs,
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
    status: score.passed ? "pass" : "fail",
    elapsed_ms: result.elapsed_ms,
    budget_ms: budgetMs,
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

function formatAxes(axes: ScoredSpec["axes"]): string {
  if (axes.length === 0) return "axes: none";
  return "axes: " + axes.map((a) =>
    `s${a.section_index}.${a.axis} ${a.target.toFixed(2)}->${a.achieved.toFixed(2)} err=${a.error.toFixed(2)}`,
  ).join(", ");
}

function formatWorstContacts(spec: ScoredSpec): string | null {
  if (spec.worst_contacts.length === 0) return null;
  return "worst contacts: " + spec.worst_contacts.map((c) => {
    if (c.status === "missing") return `t=${c.t_target.toFixed(2)} missing`;
    const sign = c.frame_error !== null && c.frame_error > 0 ? "+" : "";
    return `t=${c.t_target.toFixed(2)} err=${sign}${c.frame_error}f`;
  }).join(", ");
}

async function runMain(): Promise<void> {
  const jsonOnly = has("json");
  const seed = Math.trunc(positiveNumber(arg("seed"), SEED, "seed"));
  const timeoutScale = positiveNumber(arg("timeout-scale"), DEFAULT_TIMEOUT_SCALE, "timeout-scale");
  const timeoutSecArg = arg("timeout-sec");
  const timeoutSec = positiveNumber(timeoutSecArg, 0, "timeout-sec");
  const suite = arg("suite") ?? "goal";
  const specArg = arg("specs");
  const specNames = specArg
    ? specArg.split(",").map((s) => s.trim()).filter(Boolean)
    : suite === "full"
      ? [...V0_FULL_BENCHMARK_SPECS]
      : [...V0_GOAL_SPECS];

  if (suite !== "goal" && suite !== "full") {
    throw new Error(`Unknown suite: ${suite}. Expected "goal" or "full".`);
  }

  const unknown = specNames.filter((name) => !V0_KNOWN_SPECS.includes(name as any));
  if (unknown.length > 0) {
    throw new Error(`Unknown v0 benchmark spec(s): ${unknown.join(", ")}`);
  }

  if (!jsonOnly) {
    console.log(`v0 goal metric: seed=${seed}`);
    console.log(`specs: ${specNames.join(", ")}`);
    console.log(`timeout: ${timeoutSecArg ? `${timeoutSec}s` : `min(${timeoutScale}x video duration, ${fmtMs(DEFAULT_TIMEOUT_MAX_MS)})`} per spec`);
    console.log("");
  }

  const scored: ScoredSpec[] = [];
  for (const name of specNames) {
    const spec = await loadSpec(name);
    const budgetMs = timeoutSecArg
      ? timeoutSec * 1000
      : Math.min(specDurationMs(spec) * timeoutScale, DEFAULT_TIMEOUT_MAX_MS);
    const result = await runWithTimeout(name, seed, budgetMs);
    const row = scoreResult(result, budgetMs);
    scored.push(row);

    if (!jsonOnly) {
      const status = row.status.toUpperCase();
      console.log(
        `${row.name.padEnd(18)} ${status.padEnd(7)} ` +
          `score=${row.score.toFixed(0).padStart(4)} ` +
          `sync=${fmtPct(row.sync_score).padStart(4)} ` +
          `hits=${String(row.hits).padStart(2)}/${String(row.contacts).padEnd(2)} ` +
          `drift=${String(row.drift).padStart(2)} miss=${String(row.missing).padStart(2)} ` +
          `off=${String(row.off_beat_landings).padStart(2)} ` +
          `axis=${fmtPct(row.axis_score).padStart(4)} meanErr=${row.axis_error_mean.toFixed(3)} ` +
          `time=${fmtMs(row.elapsed_ms)}/${fmtMs(row.budget_ms)}`,
      );
      if (row.axes.length > 0) console.log(`  ${formatAxes(row.axes)}`);
      const worst = formatWorstContacts(row);
      if (worst) console.log(`  ${worst}`);
      if (row.off_beat_frames.length > 0) {
        console.log(`  off-beat frames: ${row.off_beat_frames.join(", ")}`);
      }
      if (row.message) console.log(`  ${row.message}`);
    }
  }

  const goal_score = scored.reduce((sum, row) => sum + row.score, 0) / Math.max(scored.length, 1);
  const failed_specs = scored.filter((row) => row.status !== "pass").length;
  const result = {
    goal_score: Number(goal_score.toFixed(2)),
    seed,
    failed_specs,
    specs: scored.map((row) => ({
      ...row,
      score: Number(row.score.toFixed(2)),
      sync_score: Number(row.sync_score.toFixed(4)),
      axis_score: Number(row.axis_score.toFixed(4)),
      axis_error_total: Number(row.axis_error_total.toFixed(4)),
      axis_error_mean: Number(row.axis_error_mean.toFixed(4)),
      axis_error_max: Number(row.axis_error_max.toFixed(4)),
    })),
  };

  if (jsonOnly) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    console.log("");
    console.log(`GOAL_SCORE ${result.goal_score.toFixed(2)}  failed=${failed_specs}/${scored.length}`);
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
