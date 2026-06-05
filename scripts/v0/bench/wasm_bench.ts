/**
 * Quick standalone speed check of the Rust→WASM batch kernel on a synthetic
 * fixture. This is kernel-only throughput for the `sim()` ABI; it is not directly
 * comparable to `npm run perf`, which measures the full TypeScript compiler path.
 * For end-to-end JS vs WASM numbers, compare `npm run perf` with
 * `LR_ENGINE=wasm npm run perf`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildTrack } from "./_fixture.ts";

const WASM = "engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm";

function main() {
  const frames = 1500;
  const reps = 30;
  const warmup = 5;
  const bytes = readFileSync(resolve(WASM));
  const ex = new WebAssembly.Instance(new WebAssembly.Module(bytes), {}).exports as {
    memory: WebAssembly.Memory;
    lines_in_ptr: () => number;
    out_ptr: () => number;
    sim: (n: number, sx: number, sy: number, vx: number, vy: number, frames: number) => number;
  };
  const track = buildTrack(200);
  const lv = new Float64Array(ex.memory.buffer, ex.lines_in_ptr(), track.length * 6);
  track.forEach((l, i) => { const b = i * 6; lv[b] = l.x1; lv[b + 1] = l.y1; lv[b + 2] = l.x2; lv[b + 3] = l.y2; lv[b + 4] = l.type; lv[b + 5] = 0; });

  for (let i = 0; i < warmup; i++) ex.sim(track.length, 0, 0, 0.4, 0, frames);
  const times: number[] = [];
  for (let i = 0; i < reps; i++) {
    const t0 = process.hrtime.bigint();
    ex.sim(track.length, 0, 0, 0.4, 0, frames);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  times.sort((a, b) => a - b);
  const median = times[times.length >> 1];
  const min = times[0];
  const nsPerFrame = (median * 1e6) / frames;
  console.log("");
  console.log(`wasm_bench  frames=${frames}  reps=${reps}`);
  console.log(`  min        ${min.toFixed(3)} ms`);
  console.log(`  median     ${median.toFixed(3)} ms`);
  console.log(`  ns/frame   ${nsPerFrame.toFixed(1)}  (median)`);
  console.log(`  frames/sec ${(frames / (median / 1000)).toFixed(0)}`);
}

main();
