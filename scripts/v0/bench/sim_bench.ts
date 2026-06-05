/**
 * sim_bench — isolated, single-core per-frame physics benchmark.
 *
 * Measures the raw cost of advancing the lr-core rider one frame, with NO
 * search/optimizer involvement: build a fixed track (see _fixture.ts) and force
 * the engine to integrate frames [0..N]. This isolates the "primitive" the
 * optimizer spends nearly all its time in.
 *
 * Run single-core:   taskset -c 0 npm run bench
 * CPU profile:       npm run bench:prof   (writes generated/prof/sim.cpuprofile)
 *
 * Emits a human table plus a machine-greppable `BENCH {…}` NDJSON line.
 */
import { PerformanceObserver, constants as perfConstants } from "node:perf_hooks";
import { buildEngine, buildTrack } from "./_fixture.ts";

// ── GC instrumentation: total time + count by kind (quantifies the alloc cost) ──
let gcTotalMs = 0;
let gcCount = 0;
let gcMajorMs = 0;
const gcObserver = new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    gcTotalMs += e.duration;
    gcCount++;
    // deno-lint-ignore no-explicit-any
    if ((e as any).detail?.kind === perfConstants.NODE_PERFORMANCE_GC_MAJOR) gcMajorMs += e.duration;
  }
});
gcObserver.observe({ entryTypes: ["gc"] });

// deno-lint-ignore no-explicit-any
function simulate(engine: any, frames: number): number {
  const stateMap = engine.getStateMapAtFrame(frames);
  let sum = 0;
  for (const state of stateMap.values()) {
    if (state && state.pos) sum += state.pos.x + state.pos.y;
  }
  return sum;
}

function fmt(n: number, d = 2): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
}

// gc PerformanceObserver entries are delivered on event-loop turns, so we must
// yield to flush buffered entries before reading the counters.
const flushGc = () => new Promise<void>((r) => setImmediate(r));

async function main() {
  const args = new Map<string, string>();
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args.set(m[1], m[2]);
  }
  const frames = Number(args.get("frames") ?? 1500);
  const segments = Number(args.get("segments") ?? 200);
  const warmup = Number(args.get("warmup") ?? 5);
  const reps = Number(args.get("reps") ?? 20);

  const track = buildTrack(segments);

  let checksum = 0;
  for (let i = 0; i < warmup; i++) {
    checksum = simulate(buildEngine(track), frames);
    await flushGc(); // let warmup GC entries drain before we reset
  }

  // Reset GC counters after warmup so we measure steady-state allocation cost.
  gcTotalMs = 0;
  gcCount = 0;
  gcMajorMs = 0;
  let peakRssBytes = 0;
  let peakHeapBytes = 0;

  const times: number[] = [];
  let lastChecksum = checksum;
  for (let i = 0; i < reps; i++) {
    const engine = buildEngine(track);
    const t0 = process.hrtime.bigint();
    const cs = simulate(engine, frames);
    const t1 = process.hrtime.bigint();
    times.push(Number(t1 - t0) / 1e6);
    const mem = process.memoryUsage();
    if (mem.rss > peakRssBytes) peakRssBytes = mem.rss;
    if (mem.heapUsed > peakHeapBytes) peakHeapBytes = mem.heapUsed;
    if (i === 0) lastChecksum = cs;
    else if (cs !== lastChecksum) throw new Error(`nondeterministic checksum: ${cs} !== ${lastChecksum}`);
    await flushGc(); // drain this rep's GC entries while between reps
  }

  times.sort((a, b) => a - b);
  const min = times[0];
  const median = times[Math.floor(times.length / 2)];
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const max = times[times.length - 1];
  const nsPerFrame = (median * 1e6) / frames;
  const framesPerSec = frames / (median / 1000);
  const totalSimMs = times.reduce((a, b) => a + b, 0);
  const gcPct = totalSimMs > 0 ? (100 * gcTotalMs) / totalSimMs : 0;
  const mb = (b: number) => b / (1024 * 1024);
  // bytes allocated per frame: heap churn is dominated by GC; approximate
  // allocation pressure via gc time share is already shown; peak heap shows retention.

  console.log("");
  console.log(`sim_bench  frames=${frames}  segments=${segments}  reps=${reps}  warmup=${warmup}`);
  console.log(`  checksum     ${lastChecksum}`);
  console.log(`  min          ${fmt(min)} ms`);
  console.log(`  median       ${fmt(median)} ms`);
  console.log(`  mean         ${fmt(mean)} ms`);
  console.log(`  max          ${fmt(max)} ms`);
  console.log(`  ns/frame     ${fmt(nsPerFrame, 1)}  (median)`);
  console.log(`  frames/sec   ${fmt(framesPerSec, 0)}  (median)`);
  console.log(`  ── memory / gc (over ${reps} reps) ──`);
  console.log(`  gc time      ${fmt(gcTotalMs)} ms  (${fmt(gcPct, 1)}% of sim;  major ${fmt(gcMajorMs)} ms)`);
  console.log(`  gc count     ${gcCount}  (${fmt(gcCount / reps, 1)}/rep)`);
  console.log(`  peak heap    ${fmt(mb(peakHeapBytes), 1)} MB  (retained per ${frames}-frame run)`);
  console.log(`  peak rss     ${fmt(mb(peakRssBytes), 1)} MB`);
  console.log(
    `BENCH ${JSON.stringify({
      frames, segments, reps,
      checksum: lastChecksum,
      min_ms: min, median_ms: median, mean_ms: mean,
      ns_per_frame: nsPerFrame, frames_per_sec: framesPerSec,
      gc_ms: gcTotalMs, gc_pct: gcPct, gc_count: gcCount, gc_major_ms: gcMajorMs,
      peak_heap_mb: mb(peakHeapBytes), peak_rss_mb: mb(peakRssBytes),
    })}`,
  );
}

main();
