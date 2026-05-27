/**
 * v0 golden benchmark — single command, single source of truth for the
 * compiler contract score defined in GOAL.md.
 *
 *   npm run golden
 *   npm run golden -- --json
 *   npm run golden -- --seed=42  # debug a single seed instead of default seeds
 *
 * Runs the reference specs in `specs/golden/` across fixed seeds with a 45s
 * hard cap per spec/seed (enforced via a worker thread; over-budget runs are
 * scored 0). Per-spec score and goal_score formula are from `score.ts` /
 * GOAL.md.
 */

import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { compile } from "./compile.ts";
import type { DriftReport, Spec } from "./types.ts";
import {
  axisDetails,
  scoreDriftReport,
  worstContacts,
  type V0ContractScore,
} from "./score.ts";

const GOLDEN_SPECS = [
  "drums_signature",
  "drums_pendulum",
  "drums_crescendo",
  "dense_sprint",
  "syncopated_switchback",
] as const;

const PER_SPEC_BUDGET_MS = 45_000;
const GOLDEN_SEEDS = [0, 1, 2] as const;

type WorkerInput = { specName: string; seed: number };
type WorkerOk = { kind: "ok"; specName: string; elapsed_ms: number; report: DriftReport };
type WorkerErr = { kind: "error"; specName: string; elapsed_ms: number; message: string };
type WorkerResult = WorkerOk | WorkerErr;
type TimeoutResult = { kind: "timeout"; specName: string; elapsed_ms: number; message: string };
type RunResult = WorkerResult | TimeoutResult;

type ScoredSpec = V0ContractScore & {
  name: string;
  seed: number;
  status: "pass" | "fail" | "timeout" | "error";
  elapsed_ms: number;
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
function has(name: string): boolean { return process.argv.includes(`--${name}`); }

async function loadSpec(name: string): Promise<Spec> {
  const mod = await import(resolve(`specs/golden/${name}.ts`));
  return mod.default as Spec;
}

async function runWithTimeout(specName: string, seed: number, budgetMs: number): Promise<RunResult> {
  const workerPath = fileURLToPath(import.meta.url);
  const input: WorkerInput = { specName, seed };
  return await new Promise<RunResult>((resolvePromise, reject) => {
    const worker = new Worker(workerPath, { workerData: input, execArgv: process.execArgv });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate().catch(() => {});
      resolvePromise({ kind: "timeout", specName, elapsed_ms: budgetMs, message: `TIMEOUT after ${fmtMs(budgetMs)}` });
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
        kind: "error", specName, elapsed_ms: 0,
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
    const spec = await loadSpec(input.specName);
    const { report } = compile(spec, input.seed);
    parentPort.postMessage({
      kind: "ok", specName: input.specName, elapsed_ms: Date.now() - t0, report,
    } satisfies WorkerOk);
  } catch (error) {
    parentPort.postMessage({
      kind: "error", specName: input.specName, elapsed_ms: Date.now() - t0,
      message: String(error).slice(0, 200),
    } satisfies WorkerErr);
  }
}

function emptyScore(): V0ContractScore {
  return {
    score: 0, passed: false, hard_failures: [],
    contacts: 0, hits: 0, drift: 0, missing: 0, sync_score: 0,
    off_beat_landings: 0, died: 0,
    axis_count: 0, axis_error_total: 0, axis_error_mean: 0, axis_error_max: 0, axis_score: 0,
  };
}

function scoreResult(result: RunResult, seed: number): ScoredSpec {
  if (result.kind === "timeout") {
    return {
      ...emptyScore(), hard_failures: ["timeout"],
      name: result.specName, seed, status: "timeout",
      elapsed_ms: result.elapsed_ms, message: result.message,
      axes: [], worst_contacts: [], off_beat_frames: [],
    };
  }
  if (result.kind === "error") {
    return {
      ...emptyScore(), hard_failures: ["error"],
      name: result.specName, seed, status: "error",
      elapsed_ms: result.elapsed_ms, message: result.message,
      axes: [], worst_contacts: [], off_beat_frames: [],
    };
  }
  const score = scoreDriftReport(result.report);
  return {
    ...score,
    name: result.specName,
    seed,
    status: score.passed ? "pass" : "fail",
    elapsed_ms: result.elapsed_ms,
    message: score.hard_failures.length > 0 ? score.hard_failures.join(",") : null,
    axes: axisDetails(result.report),
    worst_contacts: worstContacts(result.report, 3),
    off_beat_frames: result.report.off_beat_landings.slice(0, 5).map((l) => l.frame),
  };
}

function fmtMs(ms: number): string { return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`; }
function fmtPct(n: number): string { return `${(n * 100).toFixed(0)}%`; }

function formatWorstAxes(axes: ScoredSpec["axes"]): string {
  if (axes.length === 0) return "";
  const top = [...axes].sort((a, b) => b.error - a.error).slice(0, 4);
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

async function runMain(): Promise<void> {
  const jsonOnly = has("json");
  const rawSeed = arg("seed");
  const debugSeed = rawSeed !== null ? Math.trunc(Number(rawSeed)) : null;
  if (rawSeed !== null && !Number.isFinite(debugSeed)) {
    throw new Error(`--seed must be a number, got ${rawSeed}`);
  }
  const seeds = debugSeed !== null ? [debugSeed] : [...GOLDEN_SEEDS];

  if (!jsonOnly) {
    console.log(
      `v0 golden benchmark · ${GOLDEN_SPECS.length} specs × ${seeds.length} seed${seeds.length === 1 ? "" : "s"} · ` +
        `${fmtMs(PER_SPEC_BUDGET_MS)}/spec-seed hard cap · seeds=${seeds.join(",")}`,
    );
    console.log("");
  }

  const scored: ScoredSpec[] = [];
  for (const seed of seeds) {
    if (!jsonOnly) {
      console.log(`seed=${seed}`);
    }
    for (const name of GOLDEN_SPECS) {
      const result = await runWithTimeout(name, seed, PER_SPEC_BUDGET_MS);
      const row = scoreResult(result, seed);
      scored.push(row);

      if (!jsonOnly) {
        console.log(
          `${row.name.padEnd(22)} ${row.status.toUpperCase().padEnd(7)} ` +
            `score=${row.score.toFixed(0).padStart(4)}  ` +
            `sync=${fmtPct(row.sync_score).padStart(4)} (${row.hits}/${row.contacts}, drift=${row.drift}, miss=${row.missing}, off=${row.off_beat_landings})  ` +
            `axis=${fmtPct(row.axis_score).padStart(4)} (meanErr=${row.axis_error_mean.toFixed(2)}, maxErr=${row.axis_error_max.toFixed(2)})  ` +
            `time=${fmtMs(row.elapsed_ms)}/${fmtMs(PER_SPEC_BUDGET_MS)}`,
        );
        const worstAxes = formatWorstAxes(row.axes);
        if (worstAxes) console.log(`  worst axes:     ${worstAxes}`);
        const worstC = formatWorstContacts(row);
        if (worstC) console.log(`  worst contacts: ${worstC}`);
        if (row.off_beat_frames.length > 0) {
          console.log(`  off-beat:       frames ${row.off_beat_frames.join(", ")}`);
        }
        if (row.message) console.log(`  note:           ${row.message}`);
        console.log("");
      }
    }
  }

  const goal_score = scored.reduce((s, r) => s + r.score, 0) / scored.length;
  const passed = scored.filter((r) => r.status === "pass").length;
  const perSeed = seeds.map((seed) => {
    const rows = scored.filter((row) => row.seed === seed);
    return {
      seed,
      goal_score: Number((rows.reduce((s, r) => s + r.score, 0) / rows.length).toFixed(2)),
      passed: rows.filter((row) => row.status === "pass").length,
      total: rows.length,
    };
  });

  if (jsonOnly) {
    process.stdout.write(JSON.stringify({
      goal_score: Number(goal_score.toFixed(2)),
      seeds,
      seed_count: seeds.length,
      passed,
      total: scored.length,
      budget_ms: PER_SPEC_BUDGET_MS,
      per_seed: perSeed,
      specs: scored.map((row) => ({
        ...row,
        score: Number(row.score.toFixed(2)),
        sync_score: Number(row.sync_score.toFixed(4)),
        axis_score: Number(row.axis_score.toFixed(4)),
        axis_error_total: Number(row.axis_error_total.toFixed(4)),
        axis_error_mean: Number(row.axis_error_mean.toFixed(4)),
        axis_error_max: Number(row.axis_error_max.toFixed(4)),
      })),
    }, null, 2) + "\n");
  } else {
    console.log(`GOAL_SCORE ${goal_score.toFixed(2)} · passed ${passed}/${scored.length}`);
    for (const seed of perSeed) {
      console.log(`  seed=${seed.seed} score=${seed.goal_score.toFixed(2)} passed=${seed.passed}/${seed.total}`);
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
