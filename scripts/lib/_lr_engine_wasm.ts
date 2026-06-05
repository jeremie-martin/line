/**
 * WasmLineRiderEngine — a drop-in for vendored lr-core backed by the Rust→WASM
 * kernel (engine-rs). Implements the read surface the compiler/oracle use:
 * setStart / addLine / getStateMapAtFrame / getUpdatesAtFrame / getLastFrameIndex
 * (+ getRider for the detector path). Selected via LR_ENGINE=wasm in _lr_engine.ts.
 *
 * Scope note: addLine currently mutates one handle in place and returns a fresh
 * wrapper over it — correct for the linear add-all-then-read pattern the trace
 * oracle uses, NOT yet for the compiler's beam frontier / mid-stream addLine
 * (that's Phase 2b: forking + exact invalidation + budget parity).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const WASM_URL = new URL("../../engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm", import.meta.url);
// deno-lint-ignore no-explicit-any
const ex: any = new WebAssembly.Instance(new WebAssembly.Module(readFileSync(fileURLToPath(WASM_URL))), {}).exports;

const ENTITY_IDS = [
  "RIDER_MOUNTED", "SLED_INTACT", "PEG", "TAIL", "NOSE", "STRING",
  "BUTT", "SHOULDER", "RHAND", "LHAND", "LFOOT", "RFOOT",
] as const;
const BODY = [6, 7, 8, 9, 10, 11]; // parts.BODY indices: BUTT,SHOULDER,RHAND,LHAND,LFOOT,RFOOT
const NENT = 12;

// shared singletons — the oracle only reads .type/.id/.updated, never mutates
const STEP_UPDATE = { type: "StepUpdate" };
const CONSTRAINT_UPDATE = { type: "ConstraintUpdate" };

// Engines are immutable: setStart/addLine fork a new handle. The compiler holds
// many live engines (beam frontier) and discards transient candidates — free
// their handles when the JS wrapper is GC'd, or a real compile leaks/OOMs.
const FINALIZER = new FinalizationRegistry<number>((h) => ex.free_engine(h));

// Views are re-created after each wasm call: the kernel's Vec growth can call
// memory.grow, which detaches existing ArrayBuffers.
function scratch(): Float64Array {
  return new Float64Array(ex.memory.buffer, ex.scratch_ptr(), NENT * 6 + NENT);
}

// deno-lint-ignore no-explicit-any
export function createLineFromJson(data: any): any {
  return data; // passthrough; the kernel precomputes geometry from raw fields
}

// deno-lint-ignore no-explicit-any
function pointState(sc: Float64Array, i: number): any {
  const o = i * 6;
  return {
    __state__: {
      pos: { x: sc[o], y: sc[o + 1] },
      prevPos: { x: sc[o + 2], y: sc[o + 3] },
      vel: { x: sc[o + 4], y: sc[o + 5] },
    },
    get pos() { return this.__state__.pos; },
    get prevPos() { return this.__state__.prevPos; },
    get vel() { return this.__state__.vel; },
  };
}

// deno-lint-ignore no-explicit-any
function bindingState(sc: Float64Array, i: number): any {
  const fsu = sc[NENT * 6 + i];
  return {
    __state__: { framesSinceUnbind: fsu },
    framesSinceUnbind: fsu,
    isBinded() { return fsu === -1; },
  };
}

export class LineRiderEngine {
  private h: number;
  constructor(handle?: number) {
    this.h = handle ?? ex.create_engine();
    FINALIZER.register(this, this.h);
  }
  // deno-lint-ignore no-explicit-any
  setStart(position: any, velocity: any): LineRiderEngine {
    return new LineRiderEngine(ex.set_start(this.h, position.x, position.y, velocity.x, velocity.y));
  }
  // deno-lint-ignore no-explicit-any
  addLine(line: any): LineRiderEngine {
    const flags = (line.flipped ? 1 : 0) | (line.leftExtended ? 2 : 0) | (line.rightExtended ? 4 : 0);
    return new LineRiderEngine(ex.add_line(this.h, line.id ?? 0, line.type ?? 0, line.x1, line.y1, line.x2, line.y2, flags));
  }
  getLastFrameIndex(): number {
    return ex.get_last_frame_index(this.h);
  }
  // deno-lint-ignore no-explicit-any
  getStateMapAtFrame(frame: number): Map<string, any> {
    ex.get_state_map(this.h, frame);
    const sc = scratch();
    const m = new Map<string, any>();
    for (let i = 0; i < NENT; i++) {
      m.set(ENTITY_IDS[i], i < 2 ? bindingState(sc, i) : pointState(sc, i));
    }
    return m;
  }
  // deno-lint-ignore no-explicit-any
  getUpdatesAtFrame(frame: number): any[] {
    if (frame === 0) return [];
    const n = ex.get_updates(this.h, frame);
    const ev = new Int32Array(2 * n);
    const view = new Float64Array(ex.memory.buffer, ex.events_ptr(), 2 * n);
    for (let k = 0; k < 2 * n; k++) ev[k] = view[k];
    // synthesize lr-core's per-frame update sequence (scarf excluded):
    // StepUpdate, then 6×(22 ConstraintUpdate + collisions of that iteration),
    // then 3 BindJoint ConstraintUpdates.
    const updates: any[] = [STEP_UPDATE];
    let p = 0;
    for (let it = 0; it < 6; it++) {
      for (let c = 0; c < 22; c++) updates.push(CONSTRAINT_UPDATE);
      while (p < n && ev[p * 2] === it) {
        updates.push({ type: "CollisionUpdate", id: ev[p * 2 + 1] });
        p++;
      }
    }
    for (let c = 0; c < 3; c++) updates.push(CONSTRAINT_UPDATE);
    return updates;
  }
  // deno-lint-ignore no-explicit-any
  getRider(frame: number): any {
    ex.get_state_map(this.h, frame);
    const sc = scratch();
    // averageVectors: reduce add in BODY order, then div(6) — matches Rider.getBody
    let px = 0, py = 0, vx = 0, vy = 0;
    for (const i of BODY) { px += sc[i * 6]; py += sc[i * 6 + 1]; vx += sc[i * 6 + 4]; vy += sc[i * 6 + 5]; }
    const n = BODY.length;
    const stateMap = this.getStateMapAtFrame(frame);
    return {
      position: { x: px / n, y: py / n },
      velocity: { x: vx / n, y: vy / n },
      get: (id: string) => stateMap.get(id),
    };
  }
}
