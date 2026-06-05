/**
 * WasmLineRiderEngine — a drop-in for vendored lr-core backed by the Rust→WASM
 * kernel (engine-rs). Implements the read surface the compiler/oracle use:
 * setStart / addLine / getStateMapAtFrame / getUpdatesAtFrame / getLastFrameIndex
 * (+ getRider for the detector path). Selected via LR_ENGINE=wasm in _lr_engine.ts.
 *
 * The Rust engine (engine-rs) reproduces lr-core's shared-cache model exactly, so
 * this is a bit-identical drop-in on the compiler's full beam-frontier / mid-stream
 * addLine access pattern (forking + invalidation + physics-frame budget) — proven
 * by wasm:replay (real op-DAG) and wasm:compile (track-hash parity). addLine takes
 * a single line or the compiler's batched array.
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
const NENT = 12;
const LEFT_EXTENDED = 1;
const RIGHT_EXTENDED = 2;
const SLED_POINT_MASK = 0b111100;

// shared singletons — the oracle only reads .type/.id/.updated, never mutates
const STEP_UPDATE = { type: "StepUpdate" };
const CONSTRAINT_UPDATE = { type: "ConstraintUpdate" };

// A collision-free frame's update sequence is always the same: StepUpdate, then
// 6×22 + 3 ConstraintUpdate singletons. Precompute it once and share it (callers
// only read), so the common airborne/no-contact frame allocates nothing.
const NO_COLLISION_UPDATES: any[] = (() => {
  const u: any[] = [STEP_UPDATE];
  for (let it = 0; it < 6; it++) for (let c = 0; c < 22; c++) u.push(CONSTRAINT_UPDATE);
  for (let c = 0; c < 3; c++) u.push(CONSTRAINT_UPDATE);
  return Object.freeze(u) as any[];
})();

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
  if (data.extended) {
    data.leftExtended = !!(LEFT_EXTENDED & data.extended);
    data.rightExtended = !!(RIGHT_EXTENDED & data.extended);
  }
  return data; // passthrough; the kernel precomputes geometry from normalized fields
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
    // The compiler adds an arc as a batch (array). lr-core's addLine([l1..ln])
    // runs _addLine per line against the same (progressively-truncated) frame
    // cache with no recompute in between; adding them one at a time through the
    // ABI with no read in between is the same sequence of _addLine truncations.
    const lines = Array.isArray(line) ? line : [line];
    let h = this.h;
    for (const l of lines) {
      const flags = (l.flipped ? 1 : 0) | (l.leftExtended ? 2 : 0) | (l.rightExtended ? 4 : 0);
      const next = ex.add_line(h, l.id ?? 0, l.type ?? 0, l.x1, l.y1, l.x2, l.y2, flags);
      if (h !== this.h) ex.free_engine(h); // free transient intermediate handles
      h = next;
    }
    return new LineRiderEngine(h);
  }
  getLastFrameIndex(): number {
    return ex.get_last_frame_index(this.h);
  }
  // deno-lint-ignore no-explicit-any
  private stateMapFrom(sc: Float64Array): Map<string, any> {
    const m = new Map<string, any>();
    for (let i = 0; i < NENT; i++) {
      m.set(ENTITY_IDS[i], i < 2 ? bindingState(sc, i) : pointState(sc, i));
    }
    return m;
  }
  // deno-lint-ignore no-explicit-any
  getStateMapAtFrame(frame: number): Map<string, any> {
    ex.get_state_map(this.h, frame);
    return this.stateMapFrom(scratch());
  }
  // deno-lint-ignore no-explicit-any
  getUpdatesAtFrame(frame: number): any[] {
    if (frame === 0) return [];
    const n = ex.get_updates(this.h, frame);
    // Common case: no collisions this frame → the fixed StepUpdate + ConstraintUpdate
    // sequence, shared (read-only) instead of rebuilt.
    if (n === 0) return NO_COLLISION_UPDATES;
    // events are (iter, line_id, point_idx) triples — copy out before any
    // further wasm call can grow/detach the buffer.
    const ev = new Int32Array(3 * n);
    const view = new Float64Array(ex.memory.buffer, ex.events_ptr(), 3 * n);
    for (let k = 0; k < 3 * n; k++) ev[k] = view[k];
    // synthesize lr-core's per-frame update sequence (scarf excluded):
    // StepUpdate, then 6×(22 ConstraintUpdate + collisions of that iteration),
    // then 3 BindJoint ConstraintUpdates. CollisionUpdate carries the line id
    // (.id) and the collided point (.updated:[{id}]) the detector reads.
    const updates: any[] = [STEP_UPDATE];
    let p = 0;
    for (let it = 0; it < 6; it++) {
      for (let c = 0; c < 22; c++) updates.push(CONSTRAINT_UPDATE);
      while (p < n && ev[p * 3] === it) {
        updates.push({ type: "CollisionUpdate", id: ev[p * 3 + 1], updated: [{ id: ENTITY_IDS[ev[p * 3 + 2]] }] });
        p++;
      }
    }
    for (let c = 0; c < 3; c++) updates.push(CONSTRAINT_UPDATE);
    return updates;
  }
  // deno-lint-ignore no-explicit-any
  getRawFrameAtFrame(frame: number): any {
    const n = ex.get_raw_frame(this.h, frame);
    const sc = scratch();
    const sledContacts: string[] = [];
    const contactLineIds: number[] = [];
    let seenPoints = 0;
    if (n > 0) {
      const ev = new Float64Array(ex.memory.buffer, ex.events_ptr(), 3 * n);
      const seenLines = new Set<number>();
      for (let p = 0; p < n; p++) {
        const pointIdx = ev[p * 3 + 2] | 0;
        const bit = 1 << pointIdx;
        if ((SLED_POINT_MASK & bit) === 0) continue;
        if ((seenPoints & bit) === 0) {
          seenPoints |= bit;
          sledContacts.push(ENTITY_IDS[pointIdx]);
        }
        const lineId = ev[p * 3 + 1];
        if (!seenLines.has(lineId)) {
          seenLines.add(lineId);
          contactLineIds.push(lineId);
        }
      }
    }
    return {
      frame,
      position: { x: sc[0], y: sc[1] },
      velocity: { x: sc[2], y: sc[3] },
      sledContacts,
      contactLineIds,
      sledBroken: sc[5] !== -1,
      riderEjected: sc[4] !== -1,
    };
  }
  // deno-lint-ignore no-explicit-any
  getRider(frame: number): any {
    // Lean path: the kernel computes the BODY average + the two binding fsu in
    // Rust (get_rider writes 6 f64 to the head of SCRATCH), so the hot detector
    // loop never rebuilds the 12-entity stateMap. position/velocity are summed in
    // BODY order in Rust → bit-identical to Rider.getBody. get(id) serves the two
    // bindings the detector reads from these fsu; any other id (a point) falls
    // back to the full stateMap (cold path — not hit by the compiler loop).
    ex.get_rider(this.h, frame);
    const sc = scratch();
    const fsuRider = sc[4], fsuSled = sc[5];
    return {
      position: { x: sc[0], y: sc[1] },
      velocity: { x: sc[2], y: sc[3] },
      // deno-lint-ignore no-explicit-any
      get: (id: string): any => {
        if (id === "RIDER_MOUNTED") return { framesSinceUnbind: fsuRider, isBinded: () => fsuRider === -1 };
        if (id === "SLED_INTACT") return { framesSinceUnbind: fsuSled, isBinded: () => fsuSled === -1 };
        return this.getStateMapAtFrame(frame).get(id);
      },
    };
  }
}
