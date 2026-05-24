/**
 * Bench v2 — the rebuild.
 *
 * Goals (per /home/holo/.claude/plans/thanks-then-please-plan-dazzling-pancake.md):
 *   1. Exercise the full primitive library across a wide variety of specs
 *      (tempo, rhythm, long-gap, real-music axes).
 *   2. Emit a per-beat CSV so downstream analysis can see WHICH beats failed
 *      for WHICH strategies — not just aggregate mean/p90.
 *   3. Establish a comparable baseline against which Phase 2/3 (optimizer
 *      changes) are measured.
 *
 * Phase 1 constraint: NO modifications to scripts/lib/search.ts or any
 * compiler-side module. Every metric here is reconstructed from public
 * Detection.events + the spec's beatFrames.
 *
 *   npx tsx bench/v2/run.ts
 *   npx tsx bench/v2/run.ts --specs=metronome_60,metronome_120
 *   npx tsx bench/v2/run.ts --strategies=baseline_old,compose_arc_descend_climb
 *   npx tsx bench/v2/run.ts --out=bench/v2/report.md
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { availableParallelism } from "node:os";
import { buildSpecRegistry, type BeatSpec } from "./specs/index.ts";
import {
  STRATEGIES,
  type Strategy,
  type StrategyResult,
} from "../../scripts/bench_music.ts";
import { perBeatAttribution, type PerBeatRecord } from "./attribution.ts";
import {
  driftHistogram,
  renderDriftHistogram,
  perSpacingStats,
  hardBeatMap,
  simsPerHit,
  type DriftHistogram,
  type PerSpacingStats,
  type HardBeatMap,
} from "./metrics.ts";
import {
  geometricMetrics,
  behavioralMetrics,
  coolScore,
  type GeometricMetrics,
  type BehavioralMetrics,
} from "../../scripts/lib/metrics.ts";

// ────────── CLI ──────────

const argv = process.argv.slice(2);
const arg = (n: string) => {
  const m = argv.find((a) => a.startsWith(`--${n}=`));
  return m ? m.slice(n.length + 3) : null;
};
const has = (n: string) => argv.includes(`--${n}`);
const outPath = arg("out") ?? "bench/v2/report.md";
const csvPath = arg("csv") ?? "bench/v2/per_beat.csv";
const jsonlPath = arg("jsonl") ?? "bench/v2/records.jsonl";
const resume = has("resume"); // load existing JSONL and skip done jobs
const fresh = has("fresh");   // truncate JSONL even if it exists
const specsFilter = arg("specs")?.split(",").map((s) => s.trim());
const stratsFilter = arg("strategies")?.split(",").map((s) => s.trim());
const verbose = has("verbose");
const parallelArg = arg("parallel");
const parallel = parallelArg
  ? Math.max(1, Math.min(parseInt(parallelArg, 10), 32))
  : 1;

// Per-job timeout (seconds). When a worker exceeds this on a single job, it's
// terminated and replaced; the job is recorded as a `TIMEOUT` row. Prevents
// pathological cases like compose_drop_iter_search × syncopated_off taking
// 60+ min on a single job and stalling the whole bench. Default 120s — long
// enough for any realistic optimizer run, short enough to bound bench time.
// Set to 0 to disable.
const jobTimeoutArg = arg("job-timeout");
const jobTimeoutSec = jobTimeoutArg !== null ? parseInt(jobTimeoutArg, 10) : 120;

const enabledSpecs = specsFilter ? new Set(specsFilter) : null;
const enabledStrats = stratsFilter ? new Set(stratsFilter) : null;

// ────────── Setup ──────────

const specs = buildSpecRegistry().filter((s) => !enabledSpecs || enabledSpecs.has(s.id));
const strategies = STRATEGIES.filter((s) => !enabledStrats || enabledStrats.has(s.id));

const totalRuns = specs.length * strategies.length;
const cpus = availableParallelism();
console.log(`Bench v2: ${specs.length} specs × ${strategies.length} strategies = ${totalRuns} runs (parallel=${parallel}${parallel > 1 ? `, host has ${cpus} CPUs` : ""})`);

// ────────── Per-run record ──────────

type RunRecord = {
  specId: string;
  specAxis: BeatSpec["axis"];
  strategyId: string;
  elapsedMs: number;
  threwMessage: string | null;
  /** Empty when threw. */
  perBeat: PerBeatRecord[];
  /** Null when threw. */
  geom: GeometricMetrics | null;
  behav: BehavioralMetrics | null;
  cool: number | null;
  /** Optional, when the strategy's StrategyResult includes sims info. */
  totalSims: number | null;
};

const records: RunRecord[] = [];
const trackOutDir = resolve("bench/v2/tracks");
mkdirSync(trackOutDir, { recursive: true });
mkdirSync(resolve("bench/v2"), { recursive: true });

// ────────── Resumability via JSONL ──────────
//
// Each completed RunRecord is appended to bench/v2/records.jsonl. If a run
// is killed mid-loop (timeout, OOM, Ctrl+C), the JSONL preserves all completed
// records. On the next invocation with --resume, we read the JSONL and skip
// any (spec, strategy) pairs already present, only running the missing ones.
//
// --fresh truncates the JSONL even if it exists. Default (no flag) is also
// fresh — we don't auto-resume to avoid silent staleness.

const jsonlAbs = resolve(jsonlPath);
const doneKeys = new Set<string>();
if (resume && !fresh && existsSync(jsonlAbs)) {
  const existing = readFileSync(jsonlAbs, "utf8");
  for (const line of existing.split("\n")) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as RunRecord;
      records.push(rec);
      doneKeys.add(`${rec.specId}|${rec.strategyId}`);
    } catch { /* skip malformed lines */ }
  }
  console.log(`Resume: loaded ${records.length} records from ${jsonlAbs}`);
} else {
  // Fresh start — truncate the JSONL.
  writeFileSync(jsonlAbs, "");
}

function appendRecord(rec: RunRecord): void {
  records.push(rec);
  appendFileSync(jsonlAbs, JSON.stringify(rec) + "\n");
}

// ────────── Drive each (spec × strategy) ──────────

/** Convert a spec's beatFrames into the legacy strategy input shape
 *  `{ onsets: [{t}], fps }`. Strategies internally round t*40 back to frames,
 *  so this round-trip preserves the original frames exactly. */
function specToOnsets(spec: BeatSpec): { onsets: Array<{ t: number }>; fps: number } {
  return {
    onsets: spec.beatFrames.map((f) => ({ t: f / 40 })),
    fps: 40,
  };
}

/** A single (spec × strategy) job. */
type Job = { spec: BeatSpec; strat: Strategy };
const jobs: Job[] = [];
for (const spec of specs) for (const strat of strategies) {
  if (doneKeys.has(`${spec.id}|${strat.id}`)) continue;
  jobs.push({ spec, strat });
}
if (resume && doneKeys.size > 0) {
  console.log(`Resume: skipping ${doneKeys.size} already-done jobs; ${jobs.length} remaining`);
}

/** Run one job sequentially in the main thread. Pure compute, no IO except
 *  the track JSON write. Used by the parallel=1 path and as the reference
 *  implementation that the worker version mirrors. */
function runOneInline(job: Job): RunRecord {
  const { spec, strat } = job;
  const beatsInput = specToOnsets(spec);
  const t0 = Date.now();
  let result: StrategyResult | null = null;
  let threwMessage: string | null = null;
  try { result = strat.run(beatsInput); }
  catch (e) { threwMessage = String(e).slice(0, 200); }
  const elapsedMs = Date.now() - t0;

  if (result === null) {
    return {
      specId: spec.id, specAxis: spec.axis, strategyId: strat.id,
      elapsedMs, threwMessage, perBeat: [], geom: null, behav: null, cool: null,
      totalSims: null,
    };
  }
  const perBeat = perBeatAttribution(result.detection, spec.beatFrames);
  const geom = geometricMetrics(result.track);
  const behav = behavioralMetrics(result.detection);
  const cool = coolScore({ ...geom, ...behav });
  const trackPath = resolve(trackOutDir, `${spec.id}__${strat.id}.track.json`);
  writeFileSync(trackPath, JSON.stringify(result.track, null, 2));
  return {
    specId: spec.id, specAxis: spec.axis, strategyId: strat.id,
    elapsedMs, threwMessage: null, perBeat, geom, behav, cool, totalSims: null,
  };
}

/** Format a RunRecord into the one-line progress message. Shared by both paths. */
function fmtProgress(rec: RunRecord, jobIdx: number): string {
  const prefix = `[${String(jobIdx + 1).padStart(3)}/${totalRuns}] ${rec.specId.padEnd(28)} × ${rec.strategyId.padEnd(34)}`;
  if (rec.threwMessage !== null) return `${prefix} THREW: ${rec.threwMessage}`;
  const onBeat5Pct = rec.perBeat.length > 0
    ? (rec.perBeat.filter((r) => r.onBeat5).length / rec.perBeat.length) * 100
    : 0;
  return `${prefix} cool=${(rec.cool ?? 0).toFixed(0).padStart(5)} onBeat5=${onBeat5Pct.toFixed(0).padStart(3)}% surv=${rec.behav?.survived ? "Y" : "N"} (${rec.elapsedMs}ms)`;
}

/** Sequential driver — equivalent to parallel=1. */
function runSequential(): void {
  for (let i = 0; i < jobs.length; i++) {
    const rec = runOneInline(jobs[i]);
    appendRecord(rec);
    console.log(fmtProgress(rec, i));
  }
}

/** Parallel driver — N worker_threads, job-queue pull pattern. Each worker
 *  pulls the next job when it returns a result. Even load even when job
 *  costs vary wildly (long_gaps × baseline_old vs metronome_60 × compose_swooping).
 *
 *  Per-job timeout: a worker that doesn't respond within `jobTimeoutSec` is
 *  terminated and replaced; the job is logged as TIMEOUT. Prevents pathological
 *  single-job hangs from stalling the whole bench. */
function runParallel(n: number): Promise<void> {
  return new Promise<void>((resolveAll, rejectAll) => {
    let nextJobIdx = 0;
    let completed = 0;
    /** Slot state. Each slot owns one Worker; on timeout the slot's worker is
     *  replaced. activeJob is the (spec, strat) currently running in this slot. */
    type Slot = {
      worker: Worker;
      activeJob: Job | null;
      timer: NodeJS.Timeout | null;
    };
    const slots: Slot[] = [];
    const workerUrl = new URL("./worker.ts", import.meta.url);

    function spawnWorker(slot: Slot): void {
      const w = new Worker(workerUrl, { execArgv: ["--import", "tsx/esm"] });
      w.on("error", (e) => rejectAll(e));
      w.on("message", (msg) => onMessage(slot, msg));
      slot.worker = w;
    }

    function onMessage(slot: Slot, msg: { type: string; [k: string]: unknown }): void {
      if (msg.type === "ready") {
        sendNext(slot);
        return;
      }
      if (msg.type === "result") {
        if (slot.timer) { clearTimeout(slot.timer); slot.timer = null; }
        slot.activeJob = null;
        const spec = specs.find((s) => s.id === msg.specId);
        const rec: RunRecord = {
          specId: msg.specId as string,
          specAxis: spec?.axis ?? "tempo",
          strategyId: msg.strategyId as string,
          elapsedMs: msg.elapsedMs as number,
          threwMessage: msg.threwMessage as string | null,
          perBeat: msg.perBeat as PerBeatRecord[],
          geom: msg.geom as GeometricMetrics | null,
          behav: msg.behav as BehavioralMetrics | null,
          cool: msg.cool as number | null,
          totalSims: null,
        };
        appendRecord(rec);
        console.log(fmtProgress(rec, completed));
        completed++;
        if (completed === jobs.length) {
          for (const s of slots) s.worker.terminate();
          resolveAll();
          return;
        }
        sendNext(slot);
      }
    }

    function sendNext(slot: Slot): void {
      if (nextJobIdx >= jobs.length) return; // queue drained — slot stays idle
      const job = jobs[nextJobIdx++];
      slot.activeJob = job;
      slot.worker.postMessage({
        specId: job.spec.id,
        strategyId: job.strat.id,
        trackOutDir,
      });
      if (jobTimeoutSec > 0) {
        slot.timer = setTimeout(() => onTimeout(slot), jobTimeoutSec * 1000);
      }
    }

    function onTimeout(slot: Slot): void {
      const job = slot.activeJob;
      if (!job) return;
      // Terminate the hung worker; record the job as TIMEOUT; spawn a replacement.
      slot.worker.terminate().catch(() => { /* worker already dead */ });
      const rec: RunRecord = {
        specId: job.spec.id,
        specAxis: job.spec.axis,
        strategyId: job.strat.id,
        elapsedMs: jobTimeoutSec * 1000,
        threwMessage: `TIMEOUT after ${jobTimeoutSec}s`,
        perBeat: [],
        geom: null, behav: null, cool: null,
        totalSims: null,
      };
      appendRecord(rec);
      console.log(fmtProgress(rec, completed));
      completed++;
      slot.activeJob = null;
      slot.timer = null;
      if (completed === jobs.length) {
        for (const s of slots) s.worker.terminate();
        resolveAll();
        return;
      }
      // Replace the worker; it'll send `ready` on init then pick up next job.
      spawnWorker(slot);
    }

    for (let i = 0; i < n; i++) {
      const slot: Slot = { worker: null as unknown as Worker, activeJob: null, timer: null };
      slots.push(slot);
      spawnWorker(slot);
    }
  });
}

if (jobs.length === 0) {
  console.log(`No jobs to run (all ${records.length} present in resume). Re-rendering report.`);
} else if (parallel > 1) {
  await runParallel(parallel);
} else {
  runSequential();
}

// Stabilize record order so report.md and per_beat.csv diffs are independent of
// parallel completion order. Sort by (specs.indexOf(spec), strategies.indexOf(strat))
// so the report sections come out in spec-registry / strategy-registry order.
const specOrder = new Map(specs.map((s, i) => [s.id, i]));
const stratOrder = new Map(strategies.map((s, i) => [s.id, i]));
records.sort((a, b) => {
  const sd = (specOrder.get(a.specId) ?? 0) - (specOrder.get(b.specId) ?? 0);
  if (sd !== 0) return sd;
  return (stratOrder.get(a.strategyId) ?? 0) - (stratOrder.get(b.strategyId) ?? 0);
});

// ────────── Write per-beat CSV ──────────

{
  const lines: string[] = [];
  lines.push("spec_id,spec_axis,strategy_id,beat_idx,target_frame,spacing_to_prev_frames,actual_event_frame,signed_offset_frames,matched_event_type,on_beat_1,on_beat_2,on_beat_5,on_beat_10");
  for (const rec of records) {
    if (rec.perBeat.length === 0) continue; // skip THREW rows (no beats)
    for (const b of rec.perBeat) {
      const spacing = Number.isFinite(b.spacingToPrevFrames) ? b.spacingToPrevFrames : "";
      lines.push([
        rec.specId, rec.specAxis, rec.strategyId,
        b.beatIdx, b.targetFrame, spacing,
        b.actualEventFrame ?? "", b.signedOffsetFrames ?? "",
        b.matchedEventType ?? "",
        b.onBeat1 ? 1 : 0, b.onBeat2 ? 1 : 0, b.onBeat5 ? 1 : 0, b.onBeat10 ? 1 : 0,
      ].join(","));
    }
  }
  writeFileSync(resolve(csvPath), lines.join("\n") + "\n");
  console.log(`Per-beat CSV written: ${resolve(csvPath)} (${lines.length - 1} rows)`);
}

// ────────── Build the markdown report ──────────

const md: string[] = [];
md.push(`# Bench v2 report`);
md.push(``);
md.push(`Generated: ${new Date().toISOString()}`);
md.push(``);
md.push(`${specs.length} specs × ${strategies.length} strategies = ${records.length} runs.`);
md.push(``);

// ── Cross-spec strategy summary ──
md.push(`## Strategy summary (aggregated across all specs)`);
md.push(``);
md.push(`| strategy | runs | survived | mean cool | mean onBeat5% | mean ms |`);
md.push(`|---|---|---|---|---|---|`);
for (const strat of strategies) {
  const recs = records.filter((r) => r.strategyId === strat.id);
  const surv = recs.filter((r) => r.behav?.survived).length;
  const goodRecs = recs.filter((r) => r.cool !== null);
  const meanCool = goodRecs.length > 0
    ? goodRecs.reduce((s, r) => s + (r.cool ?? 0), 0) / goodRecs.length
    : 0;
  const meanOnBeat5 = goodRecs.length > 0
    ? goodRecs.reduce((s, r) => {
        if (r.perBeat.length === 0) return s;
        return s + (r.perBeat.filter((b) => b.onBeat5).length / r.perBeat.length) * 100;
      }, 0) / goodRecs.length
    : 0;
  const meanMs = recs.length > 0 ? recs.reduce((s, r) => s + r.elapsedMs, 0) / recs.length : 0;
  md.push(
    `| ${strat.id} | ${recs.length} | ${surv}/${recs.length} | ${meanCool.toFixed(0)} | ${meanOnBeat5.toFixed(1)}% | ${meanMs.toFixed(0)} |`,
  );
}
md.push(``);

// ── Per-spec sections ──
for (const spec of specs) {
  const specRecs = records.filter((r) => r.specId === spec.id);
  if (specRecs.length === 0) continue;
  md.push(`## ${spec.id}  _(axis: ${spec.axis}, ${spec.beatFrames.length} beats)_`);
  md.push(``);
  md.push(`_${spec.description}_`);
  md.push(``);

  // Per-strategy table.
  md.push(`### Per-strategy metrics`);
  md.push(``);
  md.push(`| strategy | survived | cool | onBeat1% | onBeat2% | onBeat5% | onBeat10% | median |Δ| | mean |Δ| | ms |`);
  md.push(`|---|---|---|---|---|---|---|---|---|---|`);
  for (const rec of specRecs) {
    if (rec.threwMessage !== null) {
      md.push(`| ${rec.strategyId} | THREW | — | — | — | — | — | — | — | ${rec.elapsedMs} |`);
      continue;
    }
    const pb = rec.perBeat;
    const beats = pb.length || 1;
    const pct = (n: number) => ((pb.filter((b) => b.signedOffsetFrames !== null && Math.abs(b.signedOffsetFrames) <= n).length / beats) * 100).toFixed(1);
    const absOffsets = pb.filter((b) => b.signedOffsetFrames !== null).map((b) => Math.abs(b.signedOffsetFrames!));
    absOffsets.sort((a, b) => a - b);
    const median = absOffsets.length > 0 ? absOffsets[Math.floor(absOffsets.length / 2)] : 0;
    const mean = absOffsets.length > 0 ? absOffsets.reduce((s, x) => s + x, 0) / absOffsets.length : 0;
    md.push(
      `| ${rec.strategyId} | ${rec.behav?.survived ? "✓" : "✗"} | ${(rec.cool ?? 0).toFixed(0)} ` +
        `| ${pct(1)} | ${pct(2)} | ${pct(5)} | ${pct(10)} ` +
        `| ${median.toFixed(1)} | ${mean.toFixed(1)} | ${rec.elapsedMs} |`,
    );
  }
  md.push(``);

  // Per-spacing breakdown (only if spec has varied spacing — skip for pure metronomes).
  const validRecs = specRecs.filter((r) => r.threwMessage === null && r.perBeat.length > 0);
  if (validRecs.length > 0) {
    // Use union of all spacing-bucket activity to decide whether to render.
    let hasMultipleBuckets = false;
    for (const rec of validRecs) {
      const ps = perSpacingStats(rec.perBeat);
      const populated = ps.filter((b) => b.beats > 0).length;
      if (populated > 1) { hasMultipleBuckets = true; break; }
    }
    if (hasMultipleBuckets) {
      md.push(`### Per-spacing on-beat% (only for specs with mixed spacings)`);
      md.push(``);
      md.push(`| strategy | ≤20f | 20-40f | 40-80f | >80f |`);
      md.push(`|---|---|---|---|---|`);
      for (const rec of validRecs) {
        const ps = perSpacingStats(rec.perBeat);
        const cell = (i: number) =>
          ps[i].beats > 0 ? `${ps[i].onBeat5Pct.toFixed(0)}% (${ps[i].beats})` : "—";
        md.push(`| ${rec.strategyId} | ${cell(0)} | ${cell(1)} | ${cell(2)} | ${cell(3)} |`);
      }
      md.push(``);
    }
  }

  // Drift histograms.
  md.push(`### Drift histograms (ASCII, |signedOffset| frames; last bucket = ≥25f or unmatched)`);
  md.push(``);
  md.push("```");
  for (const rec of validRecs) {
    const h = driftHistogram(rec.perBeat);
    md.push(`${rec.strategyId}  (onBeat5: ${h.onBeat5Count}/${h.total})`);
    md.push(renderDriftHistogram(h, 25));
    md.push("");
  }
  md.push("```");
  md.push(``);

  // Hard-beat / easy-beat map.
  const allPerBeats = validRecs.map((r) => r.perBeat);
  const hbm = hardBeatMap(allPerBeats);
  if (hbm.totalBeats > 0) {
    md.push(`### Cross-strategy beat map`);
    md.push(``);
    md.push(`- **Hard beats** (every strategy missed at >5f): ${hbm.hardBeatIndices.length}/${hbm.totalBeats} → indices ${formatIndexList(hbm.hardBeatIndices)}`);
    md.push(`- **Easy beats** (every strategy hit at ≤1f): ${hbm.easyBeatIndices.length}/${hbm.totalBeats} → indices ${formatIndexList(hbm.easyBeatIndices)}`);
    md.push(``);
  }
}

function formatIndexList(ixs: number[]): string {
  if (ixs.length === 0) return "_(none)_";
  if (ixs.length <= 10) return ixs.join(", ");
  return ixs.slice(0, 10).join(", ") + ` … (+${ixs.length - 10} more)`;
}

writeFileSync(resolve(outPath), md.join("\n"));
console.log(`Report written: ${resolve(outPath)}`);
