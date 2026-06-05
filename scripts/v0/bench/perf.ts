/**
 * perf — the single compiler-performance metric to optimize.
 *
 * Compiles a fixed, deterministic spec set under the currently-selected engine
 * (LR_ENGINE: unset = vendored lr-core, wasm = Rust→WASM), with warmup + many
 * repetitions, and reports the headline number with proper statistics:
 *
 *     ns / physics-frame  —  wall-clock per physics frame the compiler actually
 *     simulated. Work-normalized (independent of which specs / how much search),
 *     so it's a pure engine-speed metric. LOWER IS BETTER — optimize this.
 *
 * Like hyperfine, it warms up (JIT + caches) before timing, then reports
 * mean ± σ and min … max across the timed runs so you can tell a real change
 * from noise.
 *
 *   npm run perf                       # mini_burst @ 50k, 50 runs
 *   npm run perf -- --reps=10          # faster signal
 *   npm run perf -- --specs=mini_burst,tiny_dance
 *   LR_ENGINE=wasm npm run perf        # measure the WASM engine instead
 */
import { loadGoldenSpec } from "../golden_suite.ts";
import { compileHandoff } from "../optimizer/handoff.ts";

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
function fmt(n: number, d = 0): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
}

async function main() {
  const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
  const specs = arg("specs", "mini_burst").split(",");
  const budget = Number(arg("budget", "50000"));
  const seed = Number(arg("seed", "0"));
  const reps = Number(arg("reps", "50"));
  const warmup = Number(arg("warmup", "3"));
  const engine = process.env.LR_ENGINE === "wasm" ? "wasm" : "js";

  // Load + sanity once. Frame counts are deterministic, so capture them here.
  const loaded: { name: string; spec: unknown; frames: number; sig: string }[] = [];
  let totalFrames = 0;
  for (const name of specs) {
    // deno-lint-ignore no-explicit-any
    const spec = await loadGoldenSpec(name as any, "base" as any);
    loaded.push({ name, spec, frames: 0, sig: "" });
  }

  // Warmup: full set, untimed (JIT, caches, GC settle).
  for (let i = 0; i < warmup; i++) {
    for (const l of loaded) compileHandoff(l.spec as never, seed, { budgets: [budget] });
  }

  // Timed runs. Per rep we record each spec's ms and the rep's overall
  // ns/physics-frame, so the headline statistics are computed on the metric
  // itself (mean ± σ of the thing we actually optimize).
  const perSpecMs: number[][] = loaded.map(() => []);
  const nsPerFrameSamples: number[] = [];

  for (let r = 0; r < reps; r++) {
    let repMs = 0;
    let repFrames = 0;
    for (let s = 0; s < loaded.length; s++) {
      const l = loaded[s];
      const t0 = process.hrtime.bigint();
      const res = compileHandoff(l.spec as never, seed, { budgets: [budget] });
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      const cp = res.checkpoints[res.checkpoints.length - 1];
      const frames = cp.stats?.sim_frames ?? 0;
      const sig = `${cp.track?.lines?.length ?? -1}:${frames}`;
      if (l.sig === "") { l.sig = sig; l.frames = frames; }
      else if (sig !== l.sig) throw new Error(`${l.name}: nondeterministic compile (${sig} !== ${l.sig})`);
      perSpecMs[s].push(ms);
      repMs += ms;
      repFrames += frames;
    }
    nsPerFrameSamples.push((repMs * 1e6) / repFrames);
  }
  totalFrames = loaded.reduce((a, l) => a + l.frames, 0);

  const headMean = mean(nsPerFrameSamples);
  const headStd = stddev(nsPerFrameSamples);
  const headMin = Math.min(...nsPerFrameSamples);
  const headMax = Math.max(...nsPerFrameSamples);

  console.log("");
  console.log(`perf  engine=${engine}  budget=${budget}  seed=${seed}  runs=${reps} (+${warmup} warmup)`);
  console.log("");

  // Per-spec timing breakdown (mean ± σ).
  for (let s = 0; s < loaded.length; s++) {
    const l = loaded[s];
    const ms = perSpecMs[s];
    console.log(
      `  ${l.name.padEnd(14)} ${fmt(mean(ms), 1).padStart(9)} ms ± ${fmt(stddev(ms), 1).padStart(7)}` +
        `   [${fmt(Math.min(...ms), 1)} … ${fmt(Math.max(...ms), 1)}]   ${fmt(l.frames).padStart(9)} frames`,
    );
  }
  console.log("");
  console.log(`  Total frames:  ${fmt(totalFrames)} physics-frames (deterministic across runs)`);
  console.log("");
  console.log(`  ►  ${fmt(headMean, 1)} ns/physics-frame  ± ${fmt(headStd, 1)}   (engine=${engine}, lower is better)`);
  console.log(`     range  [${fmt(headMin, 1)} … ${fmt(headMax, 1)}]   median ${fmt(median(nsPerFrameSamples), 1)}`);
  console.log("");
  console.log(`PERF ${JSON.stringify({
    engine, budget, specs: specs.length, runs: reps, total_frames: totalFrames,
    ns_per_frame_mean: headMean, ns_per_frame_std: headStd,
    ns_per_frame_min: headMin, ns_per_frame_max: headMax,
    ns_per_frame_median: median(nsPerFrameSamples),
  })}`);
}

main();
