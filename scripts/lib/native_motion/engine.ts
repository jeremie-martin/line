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

const WASM_URL = new URL("./engine.wasm", import.meta.url);
// deno-lint-ignore no-explicit-any
const ex: any = new WebAssembly.Instance(new WebAssembly.Module(readFileSync(fileURLToPath(WASM_URL))), {}).exports;
const GET_CANDIDATE_WINDOW = ex.get_candidate_window;

const ENTITY_IDS = [
  "RIDER_MOUNTED", "SLED_INTACT", "PEG", "TAIL", "NOSE", "STRING",
  "BUTT", "SHOULDER", "RHAND", "LHAND", "LFOOT", "RFOOT",
] as const;
const NENT = 12;
const LEFT_EXTENDED = 1;
const RIGHT_EXTENDED = 2;
const SLED_POINT_MASK = 0b111100;
const SCRATCH_LEN = NENT * 6 + NENT;
const SCRATCH_PTR = ex.scratch_ptr();
const OUT_LEN = (2400 + 1) * 60;
const OUT_PTR = ex.out_ptr();
const EVENTS_LEN = 49152;
const EVENTS_PTR = ex.events_ptr();
const RIDER_POINT_IDS = [
  "PEG",
  "TAIL",
  "NOSE",
  "STRING",
  "BUTT",
  "SHOULDER",
  "RHAND",
  "LHAND",
  "LFOOT",
  "RFOOT",
] as const;
const RIDER_SLED_POINTS = RIDER_POINT_IDS.slice(0, 4);
const RIDER_SLED_OFFSET = 6;
const RIDER_POINT_STRIDE = 6;
const CANDIDATE_WINDOW_STRIDE = 9;
const EMPTY_SLED_CONTACTS = Object.freeze([]) as unknown as string[];
const EMPTY_CONTACT_LINE_IDS = Object.freeze([]) as unknown as number[];

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
type EngineRegistration = { handle: number };
const LIVE_ENGINES = new Set<EngineRegistration>();
const FINALIZER = new FinalizationRegistry<EngineRegistration>((registration) => {
  LIVE_ENGINES.delete(registration);
  ex.free_engine(registration.handle);
});

/**
 * Release every engine handle in this isolate after a self-contained study
 * compile. Production code must not call this while it still owns an engine.
 * Repeated calls and later FinalizationRegistry callbacks are safe because the
 * Rust ABI treats freeing an invalid/already-freed handle as a no-op.
 */
export function disposeAllWasmEnginesForStudy(): number {
  const count = LIVE_ENGINES.size;
  for (const registration of LIVE_ENGINES) {
    FINALIZER.unregister(registration);
    ex.free_engine(registration.handle);
  }
  LIVE_ENGINES.clear();
  return count;
}

// The scratch address is static. Only the backing ArrayBuffer can change after
// memory.grow, so reuse the view until the buffer identity changes.
let scratchBuffer: ArrayBuffer | undefined;
let scratchView: Float64Array | undefined;
function scratch(): Float64Array {
  const buffer = ex.memory.buffer;
  if (buffer !== scratchBuffer) {
    scratchBuffer = buffer;
    scratchView = new Float64Array(buffer, SCRATCH_PTR, SCRATCH_LEN);
  }
  return scratchView as Float64Array;
}

let outBuffer: ArrayBuffer | undefined;
let outView: Float64Array | undefined;
function out(): Float64Array {
  const buffer = ex.memory.buffer;
  if (buffer !== outBuffer) {
    outBuffer = buffer;
    outView = new Float64Array(buffer, OUT_PTR, OUT_LEN);
  }
  return outView as Float64Array;
}

let eventsBuffer: ArrayBuffer | undefined;
let eventsView: Float64Array | undefined;
function events(): Float64Array {
  const buffer = ex.memory.buffer;
  if (buffer !== eventsBuffer) {
    eventsBuffer = buffer;
    eventsView = new Float64Array(buffer, EVENTS_PTR, EVENTS_LEN);
  }
  return eventsView as Float64Array;
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
  return pointStateFrom(sc[o], sc[o + 1], sc[o + 2], sc[o + 3], sc[o + 4], sc[o + 5]);
}

// deno-lint-ignore no-explicit-any
function pointStateFrom(px: number, py: number, prevx: number, prevy: number, vx: number, vy: number): any {
  return {
    __state__: {
      pos: { x: px, y: py },
      prevPos: { x: prevx, y: prevy },
      vel: { x: vx, y: vy },
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
  prepareCollisionTrace(frame: number): void {
    if (!Number.isSafeInteger(frame) || frame < 1) throw new Error("invalid trace frame");
    ex.prepare_collision_trace(this.h, frame);
  }
  readCollisionTrace(): Array<Record<string, { x: number; y: number; prevx: number; prevy: number; vx: number; vy: number }>> {
    if (ex.collision_trace_count() !== 6) throw new Error("collision trace is incomplete");
    const data = new Float64Array(ex.memory.buffer, ex.collision_trace_ptr(), 6 * NENT * 6);
    return Array.from({ length: 6 }, (_, iteration) => Object.fromEntries(RIDER_POINT_IDS.map(id => {
      const k = (iteration * NENT + ENTITY_IDS.indexOf(id)) * 6;
      return [id, { x: data[k], y: data[k + 1], prevx: data[k + 2], prevy: data[k + 3], vx: data[k + 4], vy: data[k + 5] }];
    })));
  }
  detach(): LineRiderEngine { return new LineRiderEngine(ex.detach_engine(this.h)); }
  static retainOnly(engines: readonly LineRiderEngine[]): void {
    const keep = new Set(engines.map(e => e.h));
    for (const registration of LIVE_ENGINES) if (!keep.has(registration.handle)) {
      FINALIZER.unregister(registration); ex.free_engine(registration.handle);
      LIVE_ENGINES.delete(registration);
    }
  }
  constructor(handle?: number) {
    this.h = handle ?? ex.create_engine();
    const registration = { handle: this.h };
    LIVE_ENGINES.add(registration);
    FINALIZER.register(this, registration, registration);
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
      if (h !== this.h) ex.free_engine(h); // free unwrapped transient handles
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
    const view = events();
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
    let sledContacts: string[] | undefined;
    let contactLineIds: number[] | undefined;
    let seenPoints = 0;
    if (n > 0) {
      const ev = events();
      for (let p = 0; p < n; p++) {
        const pointIdx = ev[p * 3 + 2] | 0;
        const bit = 1 << pointIdx;
        if ((SLED_POINT_MASK & bit) === 0) continue;
        if ((seenPoints & bit) === 0) {
          seenPoints |= bit;
          sledContacts ??= [];
          sledContacts.push(ENTITY_IDS[pointIdx]);
        }
        const lineId = ev[p * 3 + 1];
        contactLineIds ??= [];
        if (!contactLineIds.includes(lineId)) {
          contactLineIds.push(lineId);
        }
      }
    }
    return {
      frame,
      position: { x: sc[0], y: sc[1] },
      velocity: { x: sc[2], y: sc[3] },
      sledContacts: sledContacts ?? EMPTY_SLED_CONTACTS,
      contactLineIds: contactLineIds ?? EMPTY_CONTACT_LINE_IDS,
      sledBroken: sc[5] !== -1,
      riderEjected: sc[4] !== -1,
    };
  }
  getCandidateWindow(startFrame: number, endFrame: number): any | null {
    if (typeof GET_CANDIDATE_WINDOW !== "function") return null;
    const start = Math.max(0, Math.trunc(startFrame));
    const end = Math.trunc(endFrame);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    const frames = end - start + 1;
    if (frames * CANDIDATE_WINDOW_STRIDE > OUT_LEN) return null;
    const contactCount = GET_CANDIDATE_WINDOW(this.h, start, end);
    if (contactCount < 0) return null;
    return {
      startFrame: start,
      duration: end,
      frames,
      stride: CANDIDATE_WINDOW_STRIDE,
      data: out(),
      contacts: events(),
      contactCount,
    };
  }
  // deno-lint-ignore no-explicit-any
  getRider(frame: number): any {
    // Lean path: the kernel computes the BODY average + the two binding fsu in
    // Rust (get_rider writes 6 f64 to the head of SCRATCH), so the hot detector
    // loop never rebuilds the 12-entity stateMap. position/velocity are summed in
    // BODY order in Rust → bit-identical to Rider.getBody. get(id) serves the two
    // bindings and four ordinary sled probes. `ballisticState()` lazily copies
    // all ten point/previous-point states from this same already-computed frame;
    // other point reads retain the cold full-stateMap fallback.
    ex.get_rider(this.h, frame);
    const sc = scratch();
    const fsuRider = sc[4], fsuSled = sc[5];
    const peg = RIDER_SLED_OFFSET;
    const tail = peg + RIDER_POINT_STRIDE;
    const nose = tail + RIDER_POINT_STRIDE;
    const stringPoint = nose + RIDER_POINT_STRIDE;
    const pegPx = sc[peg], pegPy = sc[peg + 1];
    const pegPrevx = sc[peg + 2], pegPrevy = sc[peg + 3], pegVx = sc[peg + 4], pegVy = sc[peg + 5];
    const tailPx = sc[tail], tailPy = sc[tail + 1];
    const tailPrevx = sc[tail + 2], tailPrevy = sc[tail + 3], tailVx = sc[tail + 4], tailVy = sc[tail + 5];
    const nosePx = sc[nose], nosePy = sc[nose + 1];
    const nosePrevx = sc[nose + 2], nosePrevy = sc[nose + 3], noseVx = sc[nose + 4], noseVy = sc[nose + 5];
    const stringPx = sc[stringPoint], stringPy = sc[stringPoint + 1];
    const stringPrevx = sc[stringPoint + 2], stringPrevy = sc[stringPoint + 3];
    const stringVx = sc[stringPoint + 4], stringVy = sc[stringPoint + 5];
    let stateMap: Map<string, any> | undefined;
    return {
      position: { x: sc[0], y: sc[1] },
      velocity: { x: sc[2], y: sc[3] },
      ballisticState: () => {
        // Refresh scratch because the rider object may outlive another ABI read.
        // The frame is cached, so this advances zero physics frames.
        ex.get_state_map(this.h, frame);
        const state = scratch();
        const points: Record<string, {
          x: number;
          y: number;
          prevX: number;
          prevY: number;
          vx: number;
          vy: number;
        }> = {};
        for (let index = 0; index < RIDER_POINT_IDS.length; index++) {
          const offset = (index + 2) * RIDER_POINT_STRIDE;
          points[RIDER_POINT_IDS[index]] = {
            x: state[offset],
            y: state[offset + 1],
            prevX: state[offset + 2],
            prevY: state[offset + 3],
            vx: state[offset + 4],
            vy: state[offset + 5],
          };
        }
        return {
          points,
          riderMounted: state[NENT * RIDER_POINT_STRIDE] === -1,
          sledIntact: state[NENT * RIDER_POINT_STRIDE + 1] === -1,
        };
      },
      // deno-lint-ignore no-explicit-any
      get: (id: string): any => {
        if (id === "RIDER_MOUNTED") return { framesSinceUnbind: fsuRider, isBinded: () => fsuRider === -1 };
        if (id === "SLED_INTACT") return { framesSinceUnbind: fsuSled, isBinded: () => fsuSled === -1 };
        if (id === RIDER_SLED_POINTS[0]) return pointStateFrom(pegPx, pegPy, pegPrevx, pegPrevy, pegVx, pegVy);
        if (id === RIDER_SLED_POINTS[1]) return pointStateFrom(tailPx, tailPy, tailPrevx, tailPrevy, tailVx, tailVy);
        if (id === RIDER_SLED_POINTS[2]) return pointStateFrom(nosePx, nosePy, nosePrevx, nosePrevy, noseVx, noseVy);
        if (id === RIDER_SLED_POINTS[3]) return pointStateFrom(stringPx, stringPy, stringPrevx, stringPrevy, stringVx, stringVy);
        stateMap ??= this.getStateMapAtFrame(frame);
        return stateMap.get(id);
      },
    };
  }
  getSledPointPositionsAtFrame(frame: number, out: number[] = []): number[] {
    ex.get_rider(this.h, frame);
    const sc = scratch();
    out[0] = sc[RIDER_SLED_OFFSET];
    out[1] = sc[RIDER_SLED_OFFSET + 1];
    out[2] = sc[RIDER_SLED_OFFSET + RIDER_POINT_STRIDE];
    out[3] = sc[RIDER_SLED_OFFSET + RIDER_POINT_STRIDE + 1];
    out[4] = sc[RIDER_SLED_OFFSET + RIDER_POINT_STRIDE * 2];
    out[5] = sc[RIDER_SLED_OFFSET + RIDER_POINT_STRIDE * 2 + 1];
    out[6] = sc[RIDER_SLED_OFFSET + RIDER_POINT_STRIDE * 3];
    out[7] = sc[RIDER_SLED_OFFSET + RIDER_POINT_STRIDE * 3 + 1];
    out.length = 8;
    return out;
  }
}
