/**
 * Iteration-time parallel benchmark — runs the 5 official specs concurrently
 * via worker_threads to speed up the dev loop. Same compile() per spec, same
 * DriftReport contract score as benchmark.ts.
 *
 * NOT part of the metric — the official score is benchmark.ts. Use this for
 * fast experimentation, then confirm with benchmark.ts before committing.
 *
 *   npx tsx scripts/v0/_pbench.ts        # JSON to stdout
 */
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { V0_FULL_BENCHMARK_SPECS } from "./bench_specs.ts";
import { scoreDriftReport } from "./score.ts";

const SEED = 0;

const __filename = fileURLToPath(import.meta.url);

type WorkerResult = {
  name: string;
  contacts: number;
  hits: number;
  drift: number;
  missing: number;
  off_beat_landings: number;
  died: number;
  axis_error_total: number;
  axis_error_mean: number;
  axis_score: number;
  sync_score: number;
  passed: boolean;
  hard_failures: string[];
  score: number;
  elapsed_ms: number;
};

if (!isMainThread) {
  const { name } = workerData as { name: string };
  const { compile } = await import("./compile.ts");
  const specMod = await import(resolve(`scripts/v0/specs/${name}.ts`));
  const spec = specMod.default;
  const t0 = Date.now();
  const { report } = compile(spec, SEED);
  const elapsed_ms = Date.now() - t0;
  const s = scoreDriftReport(report);
  const out: WorkerResult = {
    name,
    contacts: report.contacts.length,
    hits: s.hits,
    drift: s.drift,
    missing: s.missing,
    off_beat_landings: s.off_beat_landings,
    died: s.died,
    axis_error_total: Number(s.axis_error_total.toFixed(4)),
    axis_error_mean: Number(s.axis_error_mean.toFixed(4)),
    axis_score: Number(s.axis_score.toFixed(4)),
    sync_score: Number(s.sync_score.toFixed(4)),
    passed: s.passed,
    hard_failures: s.hard_failures,
    score: Number(s.score.toFixed(2)),
    elapsed_ms,
  };
  parentPort!.postMessage(out);
} else {
  const runStart = Date.now();
  const promises = V0_FULL_BENCHMARK_SPECS.map((name) =>
    new Promise<WorkerResult>((resolveP, rejectP) => {
      const w = new Worker(__filename, { workerData: { name }, execArgv: process.execArgv });
      w.on("message", (m: WorkerResult) => resolveP(m));
      w.on("error", rejectP);
      w.on("exit", (code) => { if (code !== 0) rejectP(new Error(`worker exited ${code}`)); });
    }),
  );
  const perSpec = await Promise.all(promises);
  perSpec.sort((a, b) => V0_FULL_BENCHMARK_SPECS.indexOf(a.name as any) - V0_FULL_BENCHMARK_SPECS.indexOf(b.name as any));
  const goal_score = perSpec.reduce((a, b) => a + b.score, 0) / Math.max(perSpec.length, 1);
  const total_elapsed_ms = Date.now() - runStart;
  const total_hits = perSpec.reduce((a, b) => a + b.hits, 0);
  const total_contacts = perSpec.reduce((a, b) => a + b.contacts, 0);
  const total_off_beats = perSpec.reduce((a, b) => a + b.off_beat_landings, 0);
  const total_died = perSpec.reduce((a, b) => a + b.died, 0);
  const total_axis_err = perSpec.reduce((a, b) => a + b.axis_error_total, 0);
  const failed_specs = perSpec.filter((s) => !s.passed).length;
  process.stdout.write(JSON.stringify({
    goal_score: Number(goal_score.toFixed(2)),
    total_hits, total_contacts, total_off_beats, total_died,
    total_axis_error: Number(total_axis_err.toFixed(4)),
    total_elapsed_ms,
    failed_specs,
    seed: SEED,
    specs: perSpec,
  }, null, 2) + "\n");
}
