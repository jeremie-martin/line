/**
 * The worker_threads harness for compile+measure. Lifted from sweep_stands.ts's
 * proven pattern: one Worker per seed, mem-capped, settle-once. This same file is
 * the worker entry point (WORKER_PATH = itself) — when loaded off the main thread
 * it runs the seed and posts back metrics (and optionally writes the track JSON).
 *
 * Compile+measure is pure CPU/WASM, so it parallelises cleanly across workers.
 * The render stage does NOT run here (it needs a real browser); produce.ts drives
 * rendering on the main process.
 */
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runSeed } from "./seed.ts";
import type { SeedMetrics } from "./measure.ts";

const WORKER_PATH = fileURLToPath(import.meta.url);
const WORKER_MEM_CAP_MB = 2560;

export type SeedWorkerInput = {
  specPath: string;
  seed: number;
  budget: number;
  jolt: number;
  /** When set, the worker writes the compiled track JSON here (for the render stage). */
  trackOutPath: string | null;
  /** When set, the worker writes the drift report JSON here (for overlay data). */
  reportOutPath: string | null;
  /** Optional compact compile-budget telemetry sidecar. */
  budgetTelemetryOutPath?: string | null;
};
export type SeedWorkerMsg =
  | {
    ok: true;
    seed: number;
    metrics: SeedMetrics;
    trackPath: string | null;
    reportPath: string | null;
    budgetTelemetryPath: string | null;
  }
  | { ok: false; seed: number; message: string };

async function runWorker(): Promise<void> {
  if (!parentPort) throw new Error("worker requires parentPort");
  const inp = workerData as SeedWorkerInput;
  try {
    const { track, report, budgetTelemetry, metrics } = await runSeed(inp);
    let trackPath: string | null = null;
    let reportPath: string | null = null;
    let budgetTelemetryPath: string | null = null;
    if (inp.trackOutPath) {
      writeFileSync(inp.trackOutPath, JSON.stringify(track));
      trackPath = inp.trackOutPath;
    }
    if (inp.reportOutPath) {
      writeFileSync(inp.reportOutPath, JSON.stringify(report));
      reportPath = inp.reportOutPath;
    }
    if (inp.budgetTelemetryOutPath) {
      if (budgetTelemetry === null) {
        throw new Error("production compile did not emit budget telemetry");
      }
      writeFileSync(inp.budgetTelemetryOutPath, JSON.stringify(budgetTelemetry));
      budgetTelemetryPath = inp.budgetTelemetryOutPath;
    }
    parentPort.postMessage({
      ok: true,
      seed: inp.seed,
      metrics,
      trackPath,
      reportPath,
      budgetTelemetryPath,
    } satisfies SeedWorkerMsg);
  } catch (e) {
    parentPort.postMessage({ ok: false, seed: inp.seed, message: String(e).slice(0, 200) } satisfies SeedWorkerMsg);
  }
}

/** Spawn one mem-capped worker for a single seed; resolves with its message. */
export function spawnSeedWorker(input: SeedWorkerInput): Promise<SeedWorkerMsg> {
  return new Promise((res) => {
    const worker = new Worker(WORKER_PATH, {
      workerData: input,
      execArgv: process.execArgv.filter((a) => !a.startsWith("--max-old-space-size") && !a.startsWith("--max-semi-space-size")),
      resourceLimits: { maxOldGenerationSizeMb: WORKER_MEM_CAP_MB, maxYoungGenerationSizeMb: 128 },
    });
    let settled = false;
    const done = (m: SeedWorkerMsg) => { if (settled) return; settled = true; worker.terminate().catch(() => {}); res(m); };
    worker.on("message", (m: SeedWorkerMsg) => done(m));
    worker.on("error", (e) => done({ ok: false, seed: input.seed, message: `worker error: ${String(e).slice(0, 150)}` }));
    worker.on("exit", (code) => done({ ok: false, seed: input.seed, message: code === 0 ? "exited without result" : `exited ${code}` }));
  });
}

/** Bounded N-lane pool over a fixed item list (used by characterize). produce.ts
 *  uses spawnSeedWorker directly so it can draw seeds from an unbounded cursor. */
export async function runPool<T>(items: T[], jobs: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(jobs, items.length)) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(lanes);
}

if (!isMainThread) await runWorker();
