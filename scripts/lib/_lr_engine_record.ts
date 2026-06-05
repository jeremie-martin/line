/**
 * Recording engine — selected via LR_ENGINE=record. Wraps the vendored JS engine
 * (ground truth) and logs the EXACT sequence of engine operations the compiler
 * makes, with instance lineage (each setStart/addLine forks a new instance id).
 * Flushed to generated/trace/compile_ops.json at exit, then replayed through both
 * engines by wasm_replay_check.ts to verify parity on the compiler's REAL access
 * pattern — forking and all. Ops are capped to keep the trace bounded.
 */
import { writeFileSync, mkdirSync } from "node:fs";

// deno-lint-ignore no-explicit-any
const m: any = await import("../../vendor/lr-core/line-rider-engine/index.js");
const isFn = (x: unknown) => typeof x === "function";
const RealEngine = isFn(m.default) ? m.default : isFn(m.default?.default) ? m.default.default : m.default;
const realCreateLine = isFn(m.createLineFromJson) ? m.createLineFromJson : m.default?.createLineFromJson;

const OUT = "generated/trace/compile_ops.json";
const CAP = 600_000;
// deno-lint-ignore no-explicit-any
const ops: any[] = [];
let nextId = 0;
let flushed = false;
// deno-lint-ignore no-explicit-any
function rec(o: any) {
  if (ops.length < CAP) ops.push(o);
}

class RecordEngine {
  // deno-lint-ignore no-explicit-any
  real: any;
  id: number;
  // deno-lint-ignore no-explicit-any
  constructor(real: any, id: number) {
    this.real = real;
    this.id = id;
  }
  // deno-lint-ignore no-explicit-any
  setStart(pos: any, vel: any) {
    const id = nextId++;
    rec({ op: "setStart", parent: this.id, child: id, pos: { x: pos.x, y: pos.y }, vel: { x: vel.x, y: vel.y } });
    return new RecordEngine(this.real.setStart(pos, vel), id);
  }
  // deno-lint-ignore no-explicit-any
  addLine(line: any) {
    const id = nextId++;
    rec({ op: "addLine", parent: this.id, child: id, line: line.toJSON() });
    return new RecordEngine(this.real.addLine(line), id);
  }
  getRider(f: number) {
    rec({ op: "getRider", inst: this.id, frame: f });
    return this.real.getRider(f);
  }
  getStateMapAtFrame(f: number) {
    rec({ op: "state", inst: this.id, frame: f });
    return this.real.getStateMapAtFrame(f);
  }
  getUpdatesAtFrame(f: number) {
    rec({ op: "updates", inst: this.id, frame: f });
    return this.real.getUpdatesAtFrame(f);
  }
  getLastFrameIndex() {
    rec({ op: "lfi", inst: this.id });
    return this.real.getLastFrameIndex();
  }
  // passthroughs (used occasionally; not compared)
  getMaxLineID() { return this.real.getMaxLineID(); }
  // deno-lint-ignore no-explicit-any
  getLine(id: any) { return this.real.getLine(id); }
}

class RecordLineRiderEngine extends RecordEngine {
  constructor() {
    const id = nextId++;
    super(new RealEngine(), id);
    rec({ op: "create", id });
  }
}

function flush() {
  if (flushed) return;
  flushed = true;
  try {
    mkdirSync("generated/trace", { recursive: true });
    writeFileSync(OUT, JSON.stringify({ capped: ops.length >= CAP, count: ops.length, ops }));
    console.error(`[record] wrote ${ops.length} engine ops → ${OUT}${ops.length >= CAP ? " (CAPPED)" : ""}`);
  } catch (_e) { /* best effort */ }
}
process.on("exit", flush);

export const LineRiderEngine = RecordLineRiderEngine;
export const createLineFromJson = realCreateLine;
