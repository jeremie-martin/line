/**
 * Iteration-time parallel benchmark — runs the 5 official specs concurrently
 * via worker_threads to speed up the dev loop. Same compile() per spec, same
 * SEED=0, same scoring formula as benchmark.ts. Output JSON shape mirrors
 * benchmark.ts so we can diff totals.
 *
 * NOT part of the metric — the official score is benchmark.ts. Use this for
 * fast experimentation, then confirm with benchmark.ts before committing.
 *
 *   npx tsx scripts/v0/_pbench.ts        # JSON to stdout
 */
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BENCHMARK_SPECS = [
  "drums_baseline",
  "drums_aerial",
  "drums_chunky",
  "drums_grounded",
  "drums_speed_test",
] as const;
const SEED = 0;

const __filename = fileURLToPath(import.meta.url);

type WorkerResult = {
  name: string;
  contacts: number;
  hits: number;
  drift: number;
  missing: number;
  off_beats: number;
  died: number;
  axis_error_total: number;
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
  const hits = report.contacts.filter((c: any) => c.status === "hit").length;
  const drift = report.contacts.filter((c: any) => c.status === "drift").length;
  const missing = report.contacts.filter((c: any) => c.status === "missing").length;
  const off_beats = report.off_beat_landings.length;
  const died = report.terminus.reason !== "endOfSpec" ? 1 : 0;
  let axis_error_total = 0;
  for (const sec of report.sections) {
    for (const ax of Object.values(sec.axes) as any[]) axis_error_total += ax.error;
  }
  const score = hits - 5 * axis_error_total - 100 * off_beats - 100 * died;
  const out: WorkerResult = {
    name,
    contacts: report.contacts.length,
    hits, drift, missing, off_beats, died,
    axis_error_total: Number(axis_error_total.toFixed(4)),
    score: Number(score.toFixed(2)),
    elapsed_ms,
  };
  parentPort!.postMessage(out);
} else {
  const runStart = Date.now();
  const promises = BENCHMARK_SPECS.map((name) =>
    new Promise<WorkerResult>((resolveP, rejectP) => {
      const w = new Worker(__filename, { workerData: { name }, execArgv: process.execArgv });
      w.on("message", (m: WorkerResult) => resolveP(m));
      w.on("error", rejectP);
      w.on("exit", (code) => { if (code !== 0) rejectP(new Error(`worker exited ${code}`)); });
    }),
  );
  const perSpec = await Promise.all(promises);
  perSpec.sort((a, b) => BENCHMARK_SPECS.indexOf(a.name as any) - BENCHMARK_SPECS.indexOf(b.name as any));
  const total_score = perSpec.reduce((a, b) => a + b.score, 0);
  const total_elapsed_ms = Date.now() - runStart;
  const total_hits = perSpec.reduce((a, b) => a + b.hits, 0);
  const total_contacts = perSpec.reduce((a, b) => a + b.contacts, 0);
  const total_off_beats = perSpec.reduce((a, b) => a + b.off_beats, 0);
  const total_died = perSpec.reduce((a, b) => a + b.died, 0);
  const total_axis_err = perSpec.reduce((a, b) => a + b.axis_error_total, 0);
  process.stdout.write(JSON.stringify({
    total_score: Number(total_score.toFixed(2)),
    total_hits, total_contacts, total_off_beats, total_died,
    total_axis_error: Number(total_axis_err.toFixed(4)),
    total_elapsed_ms,
    seed: SEED,
    specs: perSpec,
  }, null, 2) + "\n");
}
