/**
 * Phase-2b gate: budget / invalidation parity. Drives BOTH the vendored JS
 * engine and the WASM engine through the same mid-stream addLine sequence and
 * compares getLastFrameIndex() — the value that drives the compiler's
 * physics-frame budget. State must stay identical between the two engines; the
 * truncation point after addLine must MATCH lr-core (it currently won't — the
 * WASM engine conservatively invalidates everything; this harness defines the
 * exact target for the real invalidation logic).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadTrackJson } from "./_fixture.ts";
import { LineRiderEngine as WasmEngine, createLineFromJson as wasmLine } from "../../lib/_lr_engine_wasm.ts";

const TRACK = "scripts/v0/bench/tracks/long_track.json";

async function jsEngineApi() {
  // deno-lint-ignore no-explicit-any
  const m: any = await import("../../../vendor/lr-core/line-rider-engine/index.js");
  const isFn = (x: unknown) => typeof x === "function";
  const Engine = isFn(m.default) ? m.default : isFn(m.default?.default) ? m.default.default : m.default;
  const createLine = isFn(m.createLineFromJson) ? m.createLineFromJson : m.default?.createLineFromJson;
  return { Engine, createLine };
}

// deno-lint-ignore no-explicit-any
function riderSig(engine: any, f: number): string {
  // body position from getRider — a compact bit-exact signature for agreement
  const r = engine.getRider(f);
  return `${r.position.x},${r.position.y},${r.velocity.x},${r.velocity.y}`;
}

async function main() {
  const js = await jsEngineApi();
  const json = JSON.parse(readFileSync(resolve(TRACK), "utf8"));
  const src = loadTrackJson("long_track", json);
  const lines = src.lines;

  // pick a mid-track line to re-add (rider has already ridden past it → its cells
  // contain earlier-frame entities → lr-core invalidates back to that frame).
  const midLine = { ...lines[Math.floor(lines.length / 2)], id: 100000 };
  const READ = 1800;

  // deno-lint-ignore no-explicit-any
  const run = (Engine: any, createLine: any) => {
    let e = new Engine().setStart(src.start, src.velocity);
    for (const l of lines) e = e.addLine(createLine(l));
    const lfiBeforeRead = e.getLastFrameIndex();
    e.getStateMapAtFrame(READ);                 // simulate forward
    const lfiAfterRead = e.getLastFrameIndex();
    const sigBefore = riderSig(e, READ);
    e = e.addLine(createLine(midLine));         // mid-stream addLine
    const lfiAfterAdd = e.getLastFrameIndex();  // ← the invalidation/truncation point
    e.getStateMapAtFrame(READ);                 // re-simulate with the new line
    const sigAfter = riderSig(e, READ);
    return { lfiBeforeRead, lfiAfterRead, lfiAfterAdd, sigBefore, sigAfter };
  };

  const j = run(js.Engine, js.createLine);
  const w = run(WasmEngine, wasmLine);

  console.log("");
  console.log(`budget parity (long_track, read frame ${READ})`);
  console.log(`                        JS        WASM`);
  console.log(`  lfi after add-all     ${String(j.lfiBeforeRead).padEnd(9)} ${w.lfiBeforeRead}`);
  console.log(`  lfi after read(${READ})  ${String(j.lfiAfterRead).padEnd(9)} ${w.lfiAfterRead}`);
  console.log(`  lfi after addLine     ${String(j.lfiAfterAdd).padEnd(9)} ${w.lfiAfterAdd}   ← truncation point (must match)`);
  console.log("");
  const stateOk = j.sigBefore === w.sigBefore && j.sigAfter === w.sigAfter;
  const budgetOk = j.lfiAfterRead === w.lfiAfterRead && j.lfiAfterAdd === w.lfiAfterAdd;
  console.log(`  state agreement (JS vs WASM):  ${stateOk ? "OK (bit-identical before & after)" : "MISMATCH"}`);
  console.log(`  budget/truncation parity:      ${budgetOk ? "OK" : `GAP — WASM truncates to ${w.lfiAfterAdd}, lr-core to ${j.lfiAfterAdd}`}`);
  console.log("");
  if (stateOk && budgetOk) {
    console.log("WASM-BUDGET: PASS — invalidation + budget match lr-core.");
  } else if (stateOk) {
    console.log("WASM-BUDGET: state identical; budget parity is the remaining Phase-2b work (expected).");
    process.exit(2); // known gap, not a regression
  } else {
    console.log("WASM-BUDGET: STATE MISMATCH — investigate.");
    process.exit(1);
  }
}

main();
