/**
 * Captured-trace replay — the highest-fidelity Phase-2b gate. Reads the engine
 * op DAG recorded from a REAL compile (LR_ENGINE=record → generated/trace/
 * compile_ops.json) and replays it through BOTH the vendored JS engine and the
 * WASM engine, reconstructing every instance by lineage and asserting parity on
 * every read (state / updates / lfi). Pinpoints the FIRST divergent op in the
 * compiler's actual access pattern — forking and all.
 *
 * Record a trace first:  LR_ENGINE=record npm run cbench -- --spec=mini_burst --budget=4000 --reps=1 --warmup=0
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { LineRiderEngine as WasmEngine, createLineFromJson as wasmLine } from "../../lib/_lr_engine_wasm.ts";

const OPS = "generated/trace/compile_ops.json";
const isScarf = (id: unknown) => typeof id === "string" && id.startsWith("SCARF");

async function jsApi() {
  // deno-lint-ignore no-explicit-any
  const m: any = await import("../../../vendor/lr-core/line-rider-engine/index.js");
  const isFn = (x: unknown) => typeof x === "function";
  const Engine = isFn(m.default) ? m.default : isFn(m.default?.default) ? m.default.default : m.default;
  const createLine = isFn(m.createLineFromJson) ? m.createLineFromJson : m.default?.createLineFromJson;
  return { Engine, createLine };
}

// deno-lint-ignore no-explicit-any
function extractState(engine: any, f: number): string {
  const sm = engine.getStateMapAtFrame(f);
  const ids = [...sm.keys()].filter((id) => !isScarf(id)).sort();
  const out: number[] = [];
  for (const id of ids) {
    const e = sm.get(id);
    const st = e.__state__ ?? e;
    if (st.pos) out.push(st.pos.x, st.pos.y, st.prevPos.x, st.prevPos.y, st.vel.x, st.vel.y);
    else out.push(st.framesSinceUnbind);
  }
  return out.join(",");
}
// deno-lint-ignore no-explicit-any
function extractUpdates(engine: any, f: number): string {
  return engine.getUpdatesAtFrame(f).filter((u: any) => !isScarf(u?.id)).map((u: any) => `${u.type}:${typeof u.id === "number" ? u.id : ""}`).join("|");
}
// deno-lint-ignore no-explicit-any
function riderSig(engine: any, f: number): string {
  const r = engine.getRider(f);
  return `${r.position.x},${r.position.y},${r.velocity.x},${r.velocity.y}`;
}

// deno-lint-ignore no-explicit-any
function readResult(engine: any, op: any): string {
  switch (op.op) {
    case "state": return extractState(engine, op.frame);
    case "updates": return extractUpdates(engine, op.frame);
    case "lfi": return "L" + engine.getLastFrameIndex();
    case "getRider": return riderSig(engine, op.frame);
  }
  return "";
}

async function main() {
  if (!existsSync(resolve(OPS))) {
    console.log(`No recorded ops at ${OPS}. Record first, e.g.:`);
    console.log(`  LR_ENGINE=record npm run cbench -- --spec=mini_burst --budget=4000 --reps=1 --warmup=0`);
    process.exit(1);
  }
  const { count, capped, ops } = JSON.parse(readFileSync(resolve(OPS), "utf8"));
  const js = await jsApi();

  // deno-lint-ignore no-explicit-any
  const jsInst: any[] = [];
  // deno-lint-ignore no-explicit-any
  const wInst: any[] = [];
  const fail = { state: 0, updates: 0, lfi: 0, getRider: 0 };
  let firstFail = "";
  let reads = 0;

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op.op === "create") {
      jsInst[op.id] = new js.Engine();
      wInst[op.id] = new WasmEngine();
    } else if (op.op === "setStart") {
      jsInst[op.child] = jsInst[op.parent].setStart(op.pos, op.vel);
      wInst[op.child] = wInst[op.parent].setStart(op.pos, op.vel);
    } else if (op.op === "addLine") {
      jsInst[op.child] = jsInst[op.parent].addLine(js.createLine(op.line));
      wInst[op.child] = wInst[op.parent].addLine(wasmLine(op.line));
    } else {
      // read op
      reads++;
      const a = readResult(jsInst[op.inst], op);
      const b = readResult(wInst[op.inst], op);
      if (a !== b) {
        fail[op.op as keyof typeof fail]++;
        if (!firstFail) {
          firstFail = `op#${i} ${op.op} inst=${op.inst}${op.frame !== undefined ? ` frame=${op.frame}` : ""}\n        js  =${a.slice(0, 90)}\n        wasm=${b.slice(0, 90)}`;
        }
      }
    }
  }

  console.log("");
  console.log(`wasm_replay_check  ops=${count}${capped ? " (CAPPED)" : ""}  reads=${reads}`);
  console.log(`  STATE   mismatches: ${fail.state}`);
  console.log(`  UPDATES mismatches: ${fail.updates}`);
  console.log(`  RIDER   mismatches: ${fail.getRider}`);
  console.log(`  LFI     mismatches: ${fail.lfi}`);
  if (firstFail) console.log(`  first divergence: ${firstFail}`);
  console.log("");
  const total = fail.state + fail.updates + fail.getRider + fail.lfi;
  if (total === 0) {
    console.log("WASM-REPLAY: PASS — bit-identical on the compiler's real op DAG (forking + invalidation + budget).");
  } else {
    console.log("WASM-REPLAY: gaps above — the Phase-2b target on the REAL compiler access pattern.");
    process.exit(2);
  }
}

main();
