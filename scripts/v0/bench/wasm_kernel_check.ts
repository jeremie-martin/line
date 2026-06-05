/**
 * Phase-0b: run the Rust→WASM per-frame kernel standalone over the synthetic
 * fixture and diff it against the JS engine's recorded exact trajectory
 * (generated/trace/synthetic-200.dump.json). Success = bit-identical (max err 0).
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { buildTrack, loadTrackJson } from "./_fixture.ts";

const WASM = "engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm";
const TRACKS_DIR = "scripts/v0/bench/tracks";
const TRACE_DIR = "generated/trace";

const COMPONENTS = ["pos.x", "pos.y", "prevPos.x", "prevPos.y", "vel.x", "vel.y"];

interface Fixture {
  name: string;
  lines: { x1: number; y1: number; x2: number; y2: number; type: number; flags: number }[];
  start: { x: number; y: number };
  vel: { x: number; y: number };
}

function lineFlags(l: { flipped?: boolean; leftExtended?: boolean; rightExtended?: boolean }): number {
  return (l.flipped ? 1 : 0) | (l.leftExtended ? 2 : 0) | (l.rightExtended ? 4 : 0);
}

function fixtures(): Fixture[] {
  const out: Fixture[] = [];
  // synthetic
  out.push({
    name: "synthetic-200",
    lines: buildTrack(200).map((l) => ({ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, type: l.type, flags: 0 })),
    start: { x: 0, y: 0 },
    vel: { x: 0.4, y: 0 },
  });
  // real tracks
  for (const f of readdirSync(TRACKS_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const json = JSON.parse(readFileSync(resolve(TRACKS_DIR, f), "utf8"));
    const src = loadTrackJson(basename(f).replace(/\.json$/, ""), json);
    out.push({
      name: src.name,
      lines: src.lines.map((l: any) => ({ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, type: l.type ?? 0, flags: lineFlags(l) })),
      start: src.start,
      vel: src.velocity,
    });
  }
  return out;
}

function main() {
  const bytes = readFileSync(resolve(WASM));
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), {});
  const ex = instance.exports as {
    memory: WebAssembly.Memory;
    lines_in_ptr: () => number;
    out_ptr: () => number;
    sim: (n: number, sx: number, sy: number, vx: number, vy: number, frames: number) => number;
  };
  const TOL = [1e-12, 1e-9, 1e-6, 1e-3];
  let anyFail = false;

  for (const fx of fixtures()) {
    const dumpPath = resolve(TRACE_DIR, `${fx.name}.dump.json`);
    const dump = JSON.parse(readFileSync(dumpPath, "utf8")) as { frames: number; ids: string[]; data: number[][] };
    const frames = dump.frames;
    const ids = dump.ids;

    const linesView = new Float64Array(ex.memory.buffer, ex.lines_in_ptr(), fx.lines.length * 6);
    fx.lines.forEach((l, i) => {
      const b = i * 6;
      linesView[b] = l.x1; linesView[b + 1] = l.y1; linesView[b + 2] = l.x2; linesView[b + 3] = l.y2;
      linesView[b + 4] = l.type; linesView[b + 5] = l.flags;
    });
    ex.sim(fx.lines.length, fx.start.x, fx.start.y, fx.vel.x, fx.vel.y, frames);
    const out = new Float64Array(ex.memory.buffer, ex.out_ptr(), (frames + 1) * 60);

    let firstDiff = -1, maxErr = 0, maxAt = "";
    const firstExceed: Record<string, number> = {};
    for (const t of TOL) firstExceed[t.toExponential(0)] = -1;
    for (let f = 0; f <= frames; f++) {
      const ref = dump.data[f];
      let frameMax = 0;
      for (let k = 0; k < 60; k++) {
        const e = Math.abs(ref[k] - out[f * 60 + k]);
        if (e > 0 && firstDiff < 0) firstDiff = f;
        if (e > frameMax) frameMax = e;
        if (e > maxErr) { maxErr = e; maxAt = `${ids[(k / 6) | 0]}.${COMPONENTS[k % 6]}@${f}`; }
      }
      for (const t of TOL) { const key = t.toExponential(0); if (firstExceed[key] < 0 && frameMax > t) firstExceed[key] = f; }
    }

    if (maxErr === 0) {
      console.log(`  OK    ${fx.name.padEnd(16)} BIT-IDENTICAL over ${frames} frames (lines=${fx.lines.length})`);
    } else {
      anyFail = true;
      console.log(`  FAIL  ${fx.name.padEnd(16)} bit-identical through frame ${firstDiff - 1}; max |err|=${maxErr.toExponential(3)} at ${maxAt}`);
      console.log(`        exceeds: ${TOL.map((t) => `>${t.toExponential(0)}@${firstExceed[t.toExponential(0)] < 0 ? "—" : firstExceed[t.toExponential(0)]}`).join("  ")}`);
    }
  }

  console.log("");
  if (anyFail) { console.log("WASM-KERNEL: DIVERGES on ≥1 fixture."); process.exit(1); }
  console.log("WASM-KERNEL: PASS — Rust kernel is bit-identical to the JS engine on all fixtures.");
}

main();
