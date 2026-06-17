/**
 * Sweep a spec across many seeds, rank by the LONGEST tail/nose-STAND, and emit the
 * per-seed stand spans so the winners can be rendered with the detected stands
 * annotated (visual verification that `computeStands` matches what a human calls a
 * "stand"). Reuses poc_tiki_stats's worker-pool pattern and the same offset-free
 * compile + run.ts jolt transform.
 *
 *   LR_ENGINE=wasm node --import tsx scripts/v0/sweep_stands.ts \
 *     --spec=scripts/v0/specs/luna_bala_44s.ts --budget=1000000 --seeds=0-99 \
 *     --jobs=8 --top=10 --outdir=generated/luna_stands
 *
 * Writes <outdir>/seedN.track.json for each seed and <outdir>/summary.json
 * (rows ranked by longest stand, each with its stand spans in seconds).
 */
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { compileHandoff } from "./optimizer/handoff.ts";
import { scoreDriftReport } from "./score.ts";
import { extractTrace } from "./core/trace.ts";
import { computeStands } from "../lib/rotation.ts";
import { FPS, type Spec } from "./types.ts";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";

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

type StandSpan = {
  startS: number; endS: number; durS: number;
  side: "tail" | "nose"; landings: number; meanUprightDeg: number; inBandPct: number;
};
type Row = {
  seed: number; score: number; hit: number; total: number;
  longestStandS: number; standCount: number; totalStandS: number;
  revolutions: number; flipCount: number;
  stands: StandSpan[];
};
type WorkerInput = { specPath: string; seed: number; budget: number; outDir: string; jolt: number };
type WorkerMsg = { ok: true; row: Row } | { ok: false; seed: number; message: string };

const WORKER_PATH = fileURLToPath(import.meta.url);
const WORKER_MEM_CAP_MB = 2560;

async function runWorker(): Promise<void> {
  if (!parentPort) throw new Error("worker requires parentPort");
  const inp = workerData as WorkerInput;
  try {
    const specMod = await import(resolve(inp.specPath));
    const spec = applyJolt(specMod.default as Spec, inp.jolt);
    const { track, report } = compileHandoff(spec, inp.seed, { budget: inp.budget });
    writeFileSync(resolve(`${inp.outDir}/seed${inp.seed}.track.json`), JSON.stringify(track));

    const trace = extractTrace(track);
    const sled = trace.frames.map((s) => (s.sledPoseDeg == null ? NaN : s.sledPoseDeg));
    const air = trace.frames.map((s) => s.airborne);
    const stands = computeStands(sled, air);

    const spans: StandSpan[] = stands.map((e) => ({
      startS: e.startFrame / FPS,
      endS: e.endFrame / FPS,
      durS: e.lengthFrames / FPS,
      side: e.side,
      landings: e.landings,
      meanUprightDeg: e.meanUprightDeg,
      inBandPct: e.inBandFraction * 100,
    }));
    const cs = report.contacts.reduce((a, c) => { a[c.status]++; return a; }, { hit: 0, drift: 0, missing: 0 } as Record<string, number>);
    const row: Row = {
      seed: inp.seed,
      score: scoreDriftReport(report, { totalFrames: track.duration }).score,
      hit: cs.hit, total: report.contacts.length,
      longestStandS: spans.reduce((m, s) => Math.max(m, s.durS), 0),
      standCount: spans.length,
      totalStandS: spans.reduce((a, s) => a + s.durS, 0),
      revolutions: trace.features.revolutions,
      flipCount: trace.features.flipCount,
      stands: spans,
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
      execArgv: process.execArgv.filter((a) => !a.startsWith("--max-old-space-size") && !a.startsWith("--max-semi-space-size")),
      resourceLimits: { maxOldGenerationSizeMb: WORKER_MEM_CAP_MB, maxYoungGenerationSizeMb: 128 },
    });
    let settled = false;
    const done = (m: WorkerMsg) => { if (settled) return; settled = true; worker.terminate().catch(() => {}); res(m); };
    worker.on("message", (m: WorkerMsg) => done(m));
    worker.on("error", (e) => done({ ok: false, seed: input.seed, message: `worker error: ${String(e).slice(0, 150)}` }));
    worker.on("exit", (code) => done({ ok: false, seed: input.seed, message: code === 0 ? "exited without result" : `exited ${code}` }));
  });
}

async function runPool<T>(items: T[], jobs: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(jobs, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(lanes);
}

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
  const specPath = arg("spec", argv) ?? "scripts/v0/specs/luna_bala_44s.ts";
  const budget = Number(arg("budget", argv) ?? "1000000");
  const seeds = parseSeeds(arg("seeds", argv) ?? "0-99");
  const outDir = arg("outdir", argv) ?? "generated/luna_stands";
  const top = Number(arg("top", argv) ?? "10");
  const rawJobs = arg("jobs", argv);
  const jobs = Math.max(1, Math.min(rawJobs !== null ? Number(rawJobs) : Math.floor(availableParallelism() / 2), seeds.length));
  const jolt = resolveJoltMs();

  mkdirSync(resolve(outDir), { recursive: true });
  console.log(`sweep ${specPath} @ ${budget} over ${seeds.length} seeds  jolt=${jolt}ms  jobs=${jobs}\n`);

  const rows: Row[] = [];
  const failures: { seed: number; message: string }[] = [];
  const wall0 = Date.now();
  let done = 0;
  await runPool(seeds, jobs, async (seed) => {
    const msg = await runSeedWorker({ specPath, seed, budget, outDir, jolt });
    done++;
    if (msg.ok) {
      rows.push(msg.row);
      console.log(`[${String(done).padStart(3)}/${seeds.length}] seed ${String(seed).padStart(3)}  ${msg.row.hit}/${msg.row.total} hit  longest stand ${msg.row.longestStandS.toFixed(2)}s  (${msg.row.standCount} stands, ${msg.row.revolutions.toFixed(1)} rev)`);
    } else {
      failures.push({ seed, message: msg.message });
      console.log(`[${String(done).padStart(3)}/${seeds.length}] seed ${String(seed).padStart(3)}  FAILED: ${msg.message}`);
    }
  });

  const ranked = [...rows].sort((a, b) => b.longestStandS - a.longestStandS);
  const winners = ranked.slice(0, top);
  console.log(`\n=== top ${winners.length} by longest stand (wall ${((Date.now() - wall0) / 1000).toFixed(0)}s, ${rows.length} ok, ${failures.length} failed) ===`);
  for (const r of winners) {
    console.log(`seed ${String(r.seed).padStart(3)}  longest ${r.longestStandS.toFixed(2)}s  total ${r.totalStandS.toFixed(2)}s  ${r.standCount} stands  ${r.hit}/${r.total} hit  score ${r.score.toFixed(0)}`);
    for (const s of [...r.stands].sort((a, b) => b.durS - a.durS).slice(0, 4)) {
      console.log(`     ${s.startS.toFixed(2)}–${s.endS.toFixed(2)}s  ${s.durS.toFixed(2)}s  ${s.side}  ${s.landings} landings  ${s.meanUprightDeg.toFixed(0)}° from flat  ${s.inBandPct.toFixed(0)}% locked`);
    }
  }

  writeFileSync(resolve(`${outDir}/summary.json`), JSON.stringify({ specPath, budget, jolt, seeds, jobs, top, winners, rows: ranked, failures }, null, 2));
  console.log(`\nsummary → ${outDir}/summary.json   tracks → ${outDir}/seed*.track.json`);
}

if (!isMainThread) await runWorker();
else await runMain();
