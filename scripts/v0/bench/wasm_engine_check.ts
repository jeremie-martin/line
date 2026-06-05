/**
 * Phase-2 check: drive the STATEFUL handle-based engine through its lr-core-like
 * interface (create_engine → set_start → add_line ×N → lazy get_state_map(f)) and
 * confirm the lazily-computed per-frame state is bit-identical to the recorded
 * dumps on all fixtures. Also confirms lazy compute + monotonic getLastFrameIndex.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { buildTrack, loadTrackJson } from "./_fixture.ts";

const WASM = "engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm";
const TRACKS_DIR = "scripts/v0/bench/tracks";
const TRACE_DIR = "generated/trace";

// dump id order → entity index in the engine
const DUMP_IDX: Record<string, number> = {
  BUTT: 6, LFOOT: 10, LHAND: 9, NOSE: 4, PEG: 2, RFOOT: 11, RHAND: 8, SHOULDER: 7, STRING: 5, TAIL: 3,
};
const COMPONENTS = ["pos.x", "pos.y", "prevPos.x", "prevPos.y", "vel.x", "vel.y"];

function flags(l: any): number {
  return (l.flipped ? 1 : 0) | (l.leftExtended ? 2 : 0) | (l.rightExtended ? 4 : 0);
}

interface Fx { name: string; lines: any[]; start: { x: number; y: number }; vel: { x: number; y: number } }

function fixtures(): Fx[] {
  const out: Fx[] = [];
  out.push({ name: "synthetic-200", lines: buildTrack(200), start: { x: 0, y: 0 }, vel: { x: 0.4, y: 0 } });
  for (const f of readdirSync(TRACKS_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const json = JSON.parse(readFileSync(resolve(TRACKS_DIR, f), "utf8"));
    const src = loadTrackJson(basename(f).replace(/\.json$/, ""), json);
    out.push({ name: src.name, lines: src.lines, start: src.start, vel: src.velocity });
  }
  return out;
}

function main() {
  const bytes = readFileSync(resolve(WASM));
  const ex = new WebAssembly.Instance(new WebAssembly.Module(bytes), {}).exports as any;
  const scratch = () => new Float64Array(ex.memory.buffer, ex.scratch_ptr(), 12 * 6 + 12);
  let anyFail = false;

  for (const fx of fixtures()) {
    const dump = JSON.parse(readFileSync(resolve(TRACE_DIR, `${fx.name}.dump.json`), "utf8")) as { frames: number; ids: string[]; data: number[][] };
    const order = dump.ids.map((id) => DUMP_IDX[id]);

    // set_start/add_line now FORK (return a new handle) — chain them.
    let h = ex.create_engine();
    h = ex.set_start(h, fx.start.x, fx.start.y, fx.vel.x, fx.vel.y);
    for (const l of fx.lines) h = ex.add_line(h, l.id ?? 0, l.type ?? 0, l.x1, l.y1, l.x2, l.y2, flags(l));

    // fresh engine: only frame 0 cached
    const lfi0 = ex.get_last_frame_index(h);

    let firstDiff = -1, maxErr = 0, maxAt = "";
    for (let f = 0; f <= dump.frames; f++) {
      ex.get_state_map(h, f); // lazily computes up to f
      const sc = scratch();
      const ref = dump.data[f];
      for (let k = 0; k < 60; k++) {
        const idx = order[(k / 6) | 0];
        const comp = k % 6;
        const got = sc[idx * 6 + comp];
        const e = Math.abs(ref[k] - got);
        if (e > 0 && firstDiff < 0) firstDiff = f;
        if (e > maxErr) { maxErr = e; maxAt = `${dump.ids[(k / 6) | 0]}.${COMPONENTS[comp]}@${f}`; }
      }
    }
    const lfiN = ex.get_last_frame_index(h);
    ex.free_engine(h);

    const lazyOk = lfi0 === 0 && lfiN === dump.frames;
    if (maxErr === 0 && lazyOk) {
      console.log(`  OK    ${fx.name.padEnd(16)} BIT-IDENTICAL over ${dump.frames} frames (lazy: lfi ${lfi0}→${lfiN})`);
    } else {
      anyFail = true;
      if (maxErr !== 0) console.log(`  FAIL  ${fx.name.padEnd(16)} bit-identical through frame ${firstDiff - 1}; max |err|=${maxErr.toExponential(3)} at ${maxAt}`);
      if (!lazyOk) console.log(`  FAIL  ${fx.name.padEnd(16)} lazy compute wrong: lfi ${lfi0}→${lfiN} (expected 0→${dump.frames})`);
    }
  }

  console.log("");
  if (anyFail) { console.log("WASM-ENGINE: DIVERGES."); process.exit(1); }
  console.log("WASM-ENGINE: PASS — stateful lazy engine is bit-identical to the JS engine on all fixtures.");
}

main();
