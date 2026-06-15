/**
 * PoC (exploratory, not part of the build) — compile a spec across many seeds at
 * a fixed budget, then report the alignment score AND the Stage-0 coolness /
 * rotation features per seed, plus aggregate stats. Faithful to run.ts's compile
 * (default-export spec, jolt offset 0 ⇒ no contact transform).
 *
 * Parallel via a worker pool, mirroring golden.ts (one seed = one worker job).
 *
 *   LR_ENGINE=wasm node --import tsx \
 *     scripts/v0/poc_tiki_stats.ts --budget=2000000 --seeds=0-15 --jobs=6
 *
 * Note: flags are `--name=value` form only (matches the house parser).
 */
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { compileHandoff } from "./optimizer/handoff.ts";
import { scoreDriftReport } from "./score.ts";
import { extractTrace } from "./core/trace.ts";
import { FPS, type Spec } from "./types.ts";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";

/** Felt-jolt authoring transform, mirroring run.ts (default -15ms; positive
 *  shifts contacts earlier, negative later). The benchmark path compiles
 *  offset-free, so we replicate run.ts's transform here to match the CLI. */
const JOLT_DEFAULT_MS = -15;
function resolveJoltMs(): number {
  const raw = process.env.LR_JOLT_OFFSET_MS;
  const v = raw === undefined || raw === "" ? JOLT_DEFAULT_MS : Number(raw);
  return Number.isFinite(v) ? v : JOLT_DEFAULT_MS;
}
function applyJolt(spec: Spec, ms: number): Spec {
  if (ms === 0) return spec;
  const floorS = K_BOUNCE_LANDING / FPS;
  return { ...spec, contacts: spec.contacts.map((c) => ({ ...c, t: Math.max(floorS, c.t - ms / 1000) })) };
}

type Row = {
  seed: number; score: number; durationFrames: number; lines: number; elapsedMs: number;
  hit: number; total: number; missing: number; offBeat: number;
  netRotationDeg: number; revolutions: number; flipCount: number;
  peakAngularSpeedDegPerFrame: number; airborneArcs: number; totalAirtimeFrames: number;
  peakHeightPx: number; maxSpeed: number;
};
type WorkerInput = { specPath: string; seed: number; budget: number; outDir: string; emitTraces: boolean; jolt: number };
type WorkerMsg = { ok: true; row: Row } | { ok: false; seed: number; message: string };

const WORKER_PATH = fileURLToPath(import.meta.url);
/** Per-worker V8 old-space cap (MB). A 2M compile is larger than golden's 300k. */
const WORKER_MEM_CAP_MB = 4096;

// ───────────────────────── worker: compile one seed ─────────────────────────
async function runWorker(): Promise<void> {
  if (!parentPort) throw new Error("poc worker requires parentPort");
  const inp = workerData as WorkerInput;
  try {
    const specMod = await import(resolve(inp.specPath));
    const baseSpec: Spec = specMod.default;
    if (!baseSpec) throw new Error(`spec ${inp.specPath} has no default export`);
    const spec = applyJolt(baseSpec, inp.jolt);
    const t0 = Date.now();
    const { track, report } = compileHandoff(spec, inp.seed, { budget: inp.budget });
    const elapsedMs = Date.now() - t0;
    const score = scoreDriftReport(report, { totalFrames: track.duration }).score;
    const trace = extractTrace(track);
    const f = trace.features;
    const cs = report.contacts.reduce(
      (a, c) => { a[c.status]++; return a; },
      { hit: 0, drift: 0, missing: 0 } as Record<string, number>,
    );
    if (inp.emitTraces) writeFileSync(resolve(`${inp.outDir}/seed${inp.seed}.trace.json`), JSON.stringify(trace));
    const row: Row = {
      seed: inp.seed, score, durationFrames: trace.durationFrames, lines: track.lines.length, elapsedMs,
      hit: cs.hit, total: report.contacts.length, missing: cs.missing, offBeat: report.off_beat_landings.length,
      netRotationDeg: f.netRotationDeg, revolutions: f.revolutions, flipCount: f.flipCount,
      peakAngularSpeedDegPerFrame: f.peakAngularSpeedDegPerFrame, airborneArcs: f.airborneArcs,
      totalAirtimeFrames: f.totalAirtimeFrames, peakHeightPx: f.peakHeightPx, maxSpeed: f.maxSpeed,
    };
    parentPort.postMessage({ ok: true, row } satisfies WorkerMsg);
  } catch (e) {
    parentPort.postMessage({ ok: false, seed: inp.seed, message: String(e).slice(0, 200) } satisfies WorkerMsg);
  }
}

function runSeedWorker(input: WorkerInput): Promise<WorkerMsg> {
  return new Promise((res) => {
    const worker = new Worker(WORKER_PATH, {
      workerData: input,
      // Inherit the tsx loader (--import tsx) but drop memory flags V8 rejects in
      // worker execArgv; cap memory via resourceLimits instead (golden's approach).
      execArgv: process.execArgv.filter(
        (a) => !a.startsWith("--max-old-space-size") && !a.startsWith("--max-semi-space-size"),
      ),
      resourceLimits: { maxOldGenerationSizeMb: WORKER_MEM_CAP_MB, maxYoungGenerationSizeMb: 128 },
    });
    let settled = false;
    const done = (m: WorkerMsg) => { if (settled) return; settled = true; worker.terminate().catch(() => {}); res(m); };
    worker.on("message", (m: WorkerMsg) => done(m));
    worker.on("error", (e) => done({ ok: false, seed: input.seed, message: `worker error: ${String(e).slice(0, 150)}` }));
    worker.on("exit", (code) => done({ ok: false, seed: input.seed, message: code === 0 ? "exited without result" : `exited ${code}` }));
  });
}

/** Bounded-concurrency pool: at most `jobs` workers in flight. */
async function runPool<T>(items: T[], jobs: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(jobs, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(lanes);
}

// ───────────────────────────────── main ─────────────────────────────────────
function arg(name: string, argv: string[]): string | null {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
}
function parseSeeds(s: string): number[] {
  if (s.includes(",")) return s.split(",").map(Number);
  const [a, b] = s.split("-").map(Number);
  const o: number[] = [];
  for (let i = a; i <= (b ?? a); i++) o.push(i);
  return o;
}

async function runMain(): Promise<void> {
  const argv = process.argv.slice(2);
  const specPath = arg("spec", argv) ?? "scripts/v0/specs/tiki_tiki_48s.ts";
  const budget = Number(arg("budget", argv) ?? "2000000");
  const seeds = parseSeeds(arg("seeds", argv) ?? "0-15");
  const outDir = arg("outdir", argv) ?? "generated/tiki_poc";
  const emitTraces = arg("traces", argv) !== "0";
  const rawJobs = arg("jobs", argv);
  const defaultJobs = Math.max(1, Math.floor(availableParallelism() / 2));
  const jobs = Math.max(1, Math.min(rawJobs !== null ? Number(rawJobs) : defaultJobs, seeds.length));
  const jolt = resolveJoltMs();

  mkdirSync(resolve(outDir), { recursive: true });
  console.log(
    `compiling ${specPath} @ budget ${budget} over ${seeds.length} seeds [${seeds.join(",")}]  ` +
      `jolt=${jolt}ms  jobs=${jobs} (of ${availableParallelism()} cpus, ${WORKER_MEM_CAP_MB}MB each)\n`,
  );

  const rows: Row[] = [];
  const failures: { seed: number; message: string }[] = [];
  const wall0 = Date.now();
  let done = 0;
  await runPool(seeds, jobs, async (seed) => {
    const msg = await runSeedWorker({ specPath, seed, budget, outDir, emitTraces, jolt });
    done++;
    if (msg.ok) {
      rows.push(msg.row);
      console.log(`[${String(done).padStart(2)}/${seeds.length}] seed ${String(seed).padStart(2)} done  score ${msg.row.score.toFixed(1)}  ${msg.row.flipCount} flips  (${(msg.row.elapsedMs / 1000).toFixed(1)}s)`);
    } else {
      failures.push({ seed, message: msg.message });
      console.log(`[${String(done).padStart(2)}/${seeds.length}] seed ${String(seed).padStart(2)} FAILED: ${msg.message}`);
    }
  });
  const wallMs = Date.now() - wall0;

  rows.sort((a, b) => a.seed - b.seed);
  console.log(`\n=== per-seed (${rows.length} ok${failures.length ? `, ${failures.length} failed` : ""}) ===`);
  for (const r of rows) {
    console.log(
      `seed ${String(r.seed).padStart(2)}  score ${r.score.toFixed(1).padStart(6)}  ${r.hit}/${r.total} hit  ` +
        `rot net ${r.netRotationDeg.toFixed(0).padStart(5)}°  ${r.revolutions.toFixed(2)}rev  flips ${r.flipCount}  ` +
        `peakω ${r.peakAngularSpeedDegPerFrame.toFixed(1)}°/f  air ${(r.totalAirtimeFrames / FPS).toFixed(1)}s  (${(r.elapsedMs / 1000).toFixed(1)}s)`,
    );
  }

  function stats(xs: number[]) {
    const s = [...xs].sort((a, b) => a - b);
    const n = s.length;
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    return { mean, sd, min: s[0], max: s[n - 1], median: med };
  }
  const fmt = (k: keyof Row, d = 1) => {
    const s = stats(rows.map((r) => r[k] as number));
    return `mean ${s.mean.toFixed(d)}  sd ${s.sd.toFixed(d)}  min ${s.min.toFixed(d)}  med ${s.median.toFixed(d)}  max ${s.max.toFixed(d)}`;
  };
  function corr(xs: number[], ys: number[]) {
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    return sxy / Math.sqrt(sxx * syy || 1);
  }

  if (rows.length > 0) {
    console.log(`\n=== ${rows.length} seeds @ budget ${budget}  (wall ${(wallMs / 1000).toFixed(0)}s, jobs=${jobs}) ===`);
    console.log(`score        ${fmt("score")}`);
    console.log(`net rot °    ${fmt("netRotationDeg", 0)}`);
    console.log(`revolutions  ${fmt("revolutions", 2)}`);
    console.log(`flipCount    ${fmt("flipCount", 0)}`);
    console.log(`peak ω °/f   ${fmt("peakAngularSpeedDegPerFrame")}`);
    console.log(`airtime f    ${fmt("totalAirtimeFrames", 0)}`);
    console.log(`max speed    ${fmt("maxSpeed")}`);

    const byScore = [...rows].sort((a, b) => b.score - a.score);
    const byNetRot = [...rows].sort((a, b) => Math.abs(b.netRotationDeg) - Math.abs(a.netRotationDeg));
    const byFlips = [...rows].sort((a, b) => b.flipCount - a.flipCount || b.revolutions - a.revolutions);
    const byPeak = [...rows].sort((a, b) => b.peakAngularSpeedDegPerFrame - a.peakAngularSpeedDegPerFrame);
    console.log(`\nbest score        : seed ${byScore[0].seed} (${byScore[0].score.toFixed(1)})`);
    console.log(`most rotation(net): seed ${byNetRot[0].seed} (${byNetRot[0].netRotationDeg.toFixed(0)}°, ${byNetRot[0].revolutions.toFixed(2)} rev, score ${byNetRot[0].score.toFixed(1)})`);
    console.log(`most flips        : seed ${byFlips[0].seed} (${byFlips[0].flipCount} flips, ${byFlips[0].revolutions.toFixed(2)} rev)`);
    console.log(`fastest spin      : seed ${byPeak[0].seed} (${byPeak[0].peakAngularSpeedDegPerFrame.toFixed(1)}°/f)`);
    const sc = rows.map((r) => r.score);
    console.log(`\ncorr(score, revolutions) = ${corr(sc, rows.map((r) => r.revolutions)).toFixed(2)}`);
    console.log(`corr(score, flipCount)   = ${corr(sc, rows.map((r) => r.flipCount)).toFixed(2)}`);
  }

  writeFileSync(resolve(`${outDir}/summary.json`), JSON.stringify({ specPath, budget, jolt, seeds, jobs, wallMs, rows, failures }, null, 2));
  console.log(`\nsummary → ${outDir}/summary.json   traces → ${outDir}/seed*.trace.json`);
}

if (!isMainThread) {
  await runWorker();
} else {
  await runMain();
}
