/**
 * perf — the single compiler-performance metric to optimize.
 *
 * Compiles a fixed, deterministic spec set under the currently-selected engine
 * (LR_ENGINE: unset = vendored lr-core, wasm = Rust→WASM), with warmup + reps for
 * stable timing, and reports ONE headline number:
 *
 *     ns / physics-frame  —  wall-clock per physics frame the compiler actually
 *     simulated. Work-normalized (independent of which specs / how much search),
 *     so it's a pure engine-speed metric. LOWER IS BETTER — optimize this.
 *
 *   npm run perf                       # default specs/budget
 *   npm run perf -- --reps=5           # more reps for tighter stats
 *   LR_ENGINE=wasm npm run perf        # measure the WASM engine instead
 */
import { loadGoldenSpec } from "../golden_suite.ts";
import { compileHandoff } from "../optimizer/handoff.ts";

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
}
function fmt(n: number, d = 0): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
}

async function main() {
  const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
  const specs = arg("specs", "mini_burst,tiny_dance").split(",");
  const budget = Number(arg("budget", "20000"));
  const seed = Number(arg("seed", "0"));
  const reps = Number(arg("reps", "3"));
  const warmup = Number(arg("warmup", "1"));
  const engine = process.env.LR_ENGINE === "wasm" ? "wasm" : "js";

  let totalMs = 0;
  let totalFrames = 0;
  const rows: { name: string; ms: number; frames: number }[] = [];

  for (const name of specs) {
    // deno-lint-ignore no-explicit-any
    const spec = await loadGoldenSpec(name as any, "base" as any);
    let frames = 0;
    let sig = "";
    for (let i = 0; i < warmup; i++) compileHandoff(spec, seed, { budgets: [budget] });
    const times: number[] = [];
    for (let i = 0; i < reps; i++) {
      const t0 = process.hrtime.bigint();
      const res = compileHandoff(spec, seed, { budgets: [budget] });
      times.push(Number(process.hrtime.bigint() - t0) / 1e6);
      const cp = res.checkpoints[res.checkpoints.length - 1];
      frames = cp.stats?.sim_frames ?? 0;
      const s = `${cp.track?.lines?.length ?? -1}:${frames}`;
      if (i === 0) sig = s;
      else if (s !== sig) throw new Error(`${name}: nondeterministic compile (${s} !== ${sig})`);
    }
    const ms = median(times);
    totalMs += ms;
    totalFrames += frames;
    rows.push({ name, ms, frames });
  }

  const nsPerFrame = (totalMs * 1e6) / totalFrames;

  console.log("");
  console.log(`perf  engine=${engine}  specs=${specs.length}  budget=${budget}  seed=${seed}  reps=${reps}`);
  for (const r of rows) {
    console.log(`  ${r.name.padEnd(14)} ${fmt(r.ms).padStart(8)} ms   ${fmt(r.frames).padStart(10)} frames   ${fmt((r.ms * 1e6) / r.frames, 1).padStart(8)} ns/frame`);
  }
  console.log(`  ${"TOTAL".padEnd(14)} ${fmt(totalMs).padStart(8)} ms   ${fmt(totalFrames).padStart(10)} frames`);
  console.log("");
  console.log(`  ►  ${fmt(nsPerFrame, 1)} ns/physics-frame   (engine=${engine}, lower is better)`);
  console.log(`PERF ${JSON.stringify({ engine, budget, specs: specs.length, total_ms: totalMs, total_frames: totalFrames, ns_per_frame: nsPerFrame })}`);
}

main();
