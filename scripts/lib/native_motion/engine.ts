/** Compiler physics API. Immutable versions share a lineage's computed cache;
 * detached versions share a snapshot until mutation. Wrappers uniquely own their
 * native handles and fail explicitly after release. The independent reference
 * adapter is intentionally separate; it must not inherit compiler refactors. */
import {wasm, views, ENTITY_IDS, NENT, POINT_STRIDE, RAW_FRAME_STRIDE, ADD_LINES_CAP, eventValues, windowValues, windowContacts} from './wasm.ts';
import type {RawFrame} from '../detector.ts';
import type {SolidPath} from '../track.ts';

// Capture hot native entry points once at the module boundary.
const {get_last_frame_index, get_rider, get_raw_frame, get_state_map, get_body_motion, get_cached_events, has_contact, get_updates} = wasm;

type Vec2 = {x: number; y: number};
export type BallisticState = {points: Record<string, {x: number; y: number; prevX: number; prevY: number; vx: number; vy: number}>;
  riderMounted: boolean; sledIntact: boolean};
// The prior JSON state comparison identifies signed zero and all nonfinite
// numbers. Compare directly while preserving that observable numeric contract.
const sameStateNumber = (a: number, b: number) => a === b || !Number.isFinite(a) && !Number.isFinite(b);
type LineData = {id?: number; type?: number; x1: number; y1: number; x2: number; y2: number;
  flipped?: boolean; leftExtended?: boolean; rightExtended?: boolean};
const RIDER_POINT_IDS = ENTITY_IDS.slice(2);
const RIDER_SLED_POINTS = RIDER_POINT_IDS.slice(0, 4);
const RIDER_SLED_OFFSET = 6;
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

function rawFrameFrom(frame: number, values: Float64Array, offset: number,
  contacts: Float64Array | undefined, firstContact: number, contactCount: number): RawFrame {
  const pointCount = values[offset + 6];
  const sledContacts = pointCount ? new Array<string>(pointCount) : EMPTY_SLED_CONTACTS;
  for (let i = 0; i < pointCount; i++) sledContacts[i] = ENTITY_IDS[values[offset + 7 + i]];
  const contactLineIds = contactCount ? new Array<number>(contactCount) : EMPTY_CONTACT_LINE_IDS;
  for (let i = 0; i < contactCount; i++) contactLineIds[i] = contacts![firstContact + i];
  return {frame, position: {x: values[offset], y: values[offset + 1]},
    velocity: {x: values[offset + 2], y: values[offset + 3]}, sledContacts, contactLineIds,
    sledBroken: values[offset + 5] !== -1, riderEjected: values[offset + 4] !== -1};
}

function frameIndex(frame: number): number {
  if (frame < 0 || frame !== (frame | 0))
    throw new RangeError('frame must be a nonnegative 32-bit integer');
  return frame;
}

const adoptHandle = Symbol('native engine handle');
type EngineRegistration = {handle: number};
const liveEngines = new Set<EngineRegistration>();
let protectedEngines = new Set<EngineRegistration>();
const finalizer = new FinalizationRegistry<EngineRegistration>(release);
let readingMotion = false;

function assertEngineAvailable(): void {
  if (readingMotion) throw new Error('engine calls are not allowed inside a motion observation');
}

function register(owner: LineRiderEngine, handle: number): EngineRegistration {
  const registration = {handle};
  liveEngines.add(registration);
  finalizer.register(owner, registration, registration);
  return registration;
}

function release(registration: EngineRegistration): void {
  assertEngineAvailable();
  const handle = registration.handle;
  if (handle < 0) return;
  registration.handle = -1;
  finalizer.unregister(registration);
  liveEngines.delete(registration);
  wasm.free_engine(handle);
}

/** Release engines owned by the current scope. Caller-owned engines survive
 * nested compilation; each registration releases its native handle at most once. */
export function disposeEngines(): number {
  let count = 0;
  for (const registration of liveEngines) {
    if (protectedEngines.has(registration)) continue;
    release(registration);
    count++;
  }
  return count;
}

/** A synchronous lifetime boundary. Return plain data; engine wrappers allocated
 * inside the callback are released on success and failure. */
export function withEngineScope<T>(run: () => T & (T extends PromiseLike<unknown> ? never : unknown)): T {
  const previous = protectedEngines;
  protectedEngines = new Set(liveEngines);
  try {
    const result = run();
    if (result && typeof (result as {then?: unknown}).then === 'function')
      throw new TypeError('engine scopes must be synchronous');
    return result;
  } finally {
    disposeEngines();
    protectedEngines = previous;
  }
}

function pointState(sc: Float64Array, i: number): any {
  const o = i * 6;
  return pointStateFrom(sc[o], sc[o + 1], sc[o + 2], sc[o + 3], sc[o + 4], sc[o + 5]);
}

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

function bindingState(sc: Float64Array, i: number): any {
  const fsu = sc[NENT * 6 + i];
  return {
    __state__: { framesSinceUnbind: fsu },
    framesSinceUnbind: fsu,
    isBinded() { return fsu === -1; },
  };
}

export class LineRiderEngine {
  private registration: EngineRegistration;
  private get h(): number {
    assertEngineAvailable();
    const handle = this.registration.handle;
    if (handle < 0) throw new Error('engine has been disposed');
    return handle;
  }
  constructor();
  /** @internal Only native operations hold the adoption token. */
  constructor(handle: number, key: typeof adoptHandle);
  constructor(handle?: number, key?: typeof adoptHandle) {
    assertEngineAvailable();
    if (handle !== undefined && key !== adoptHandle)
      throw new Error('native handles can only be adopted by engine operations');
    this.registration = register(this, handle ?? wasm.create_engine());
  }

  private static fromHandle(handle: number): LineRiderEngine {
    return new LineRiderEngine(handle, adoptHandle);
  }

  dispose(): void { release(this.registration); }

  prepareCollisionTrace(frame: number): void {
    if (!Number.isSafeInteger(frame) || frame < 1) throw new Error("invalid trace frame");
    wasm.prepare_collision_trace(this.h, frameIndex(frame));
  }
  readCollisionTrace(): Array<Record<string, { x: number; y: number; prevx: number; prevy: number; vx: number; vy: number }>> {
    if (wasm.get_collision_trace(this.h) !== 6) throw new Error("collision trace is incomplete");
    const data = new Float64Array(wasm.memory.buffer, wasm.collision_trace_ptr(), 6 * NENT * 6);
    return Array.from({ length: 6 }, (_, iteration) => Object.fromEntries(RIDER_POINT_IDS.map(id => {
      const k = (iteration * NENT + ENTITY_IDS.indexOf(id)) * 6;
      return [id, { x: data[k], y: data[k + 1], prevx: data[k + 2], prevy: data[k + 3], vx: data[k + 4], vy: data[k + 5] }];
    })));
  }
  detach(): LineRiderEngine { return LineRiderEngine.fromHandle(wasm.detach_engine(this.h)); }
  static retainOnly(engines: readonly LineRiderEngine[]): void {
    const keep = new Set(engines.map(engine => {
      engine.h; // reject disposed owners before releasing anything
      return engine.registration;
    }));
    for (const registration of liveEngines)
      if (!keep.has(registration) && !protectedEngines.has(registration)) release(registration);
  }
  setStart(position: Vec2, velocity: Vec2): LineRiderEngine {
    return LineRiderEngine.fromHandle(wasm.set_start(this.h, position.x, position.y, velocity.x, velocity.y));
  }
  /** Both input forms share chunking and transient-handle ownership. */
  private addBatch(count: number, write: (from: number, size: number, ids: Int32Array, coords: Float64Array) => void): LineRiderEngine {
    let h = this.h;
    if (!count) return this;
    for (let from = 0; from < count; from += ADD_LINES_CAP) {
      const n = Math.min(ADD_LINES_CAP, count - from);
      const {addIds, addCoords} = views();
      write(from, n, addIds, addCoords);
      const next = wasm.add_lines(h, n);
      if (h !== this.h) wasm.free_engine(h);
      h = next;
    }
    return LineRiderEngine.fromHandle(h);
  }
  addLine(line: LineData | readonly LineData[]): LineRiderEngine {
    const lines = Array.isArray(line) ? line : [line as LineData];
    return this.addBatch(lines.length, (from, size, ids, coords) => {
      for (let k = 0; k < size; k++) {
        const l = lines[from + k];
        ids[k * 3] = l.id ?? 0;
        ids[k * 3 + 1] = l.type ?? 0;
        ids[k * 3 + 2] = (l.flipped ? 1 : 0) | (l.leftExtended ? 2 : 0) | (l.rightExtended ? 4 : 0);
        coords[k * 4] = l.x1; coords[k * 4 + 1] = l.y1;
        coords[k * 4 + 2] = l.x2; coords[k * 4 + 3] = l.y2;
      }
    });
  }
  /** Register connected ordinary solid lines without allocating per-line objects.
   * The native version owns the copied geometry; vertices need not stay alive. */
  addSolidPaths(paths: readonly SolidPath[]): LineRiderEngine {
    const count = paths.reduce((n, p) => n + Math.max(0, p.points.length - 1), 0);
    let path = 0, point = 1;
    return this.addBatch(count, (_from, size, ids, coords) => {
      for (let k = 0; k < size; k++, point++) {
        while (point >= paths[path].points.length) { path++; point = 1; }
        const {id, points} = paths[path], a = points[point - 1], b = points[point];
        ids[k * 3] = id + point - 1; ids[k * 3 + 1] = 0; ids[k * 3 + 2] = 0;
        coords[k * 4] = a.x; coords[k * 4 + 1] = a.y;
        coords[k * 4 + 2] = b.x; coords[k * 4 + 3] = b.y;
      }
    });
  }
  /** Collision positions from an already evaluated window. Never advances physics.
   * Copy across the ABI so another engine read cannot overwrite this observation. */
  getCachedContactPositions(startFrame: number, endFrame: number): Float64Array {
    if (!Number.isSafeInteger(startFrame) || !Number.isSafeInteger(endFrame) || startFrame < 0 || endFrame < startFrame)
      throw new Error('invalid cached contact window');
    const count = wasm.get_contact_positions(this.h, frameIndex(startFrame), frameIndex(endFrame));
    if (count < 0) throw new Error('contact window must already be simulated');
    return new Float64Array(wasm.memory.buffer, wasm.contact_positions_ptr(), count * 3).slice();
  }

  getLastFrameIndex(): number {
    return get_last_frame_index(this.h);
  }
  private stateMapFrom(sc: Float64Array): Map<string, any> {
    const m = new Map<string, any>();
    for (let i = 0; i < NENT; i++) {
      m.set(ENTITY_IDS[i], i < 2 ? bindingState(sc, i) : pointState(sc, i));
    }
    return m;
  }
  getStateMapAtFrame(frame: number): Map<string, any> {
    get_state_map(this.h, frameIndex(frame));
    return this.stateMapFrom(views().scratch);
  }
  getUpdatesAtFrame(frame: number): any[] {
    const handle = this.h;
    frameIndex(frame);
    if (frame === 0) return [];
    const n = get_updates(handle, frame);
    // Common case: no collisions this frame → the fixed StepUpdate + ConstraintUpdate
    // sequence, shared (read-only) instead of rebuilt.
    if (n === 0) return NO_COLLISION_UPDATES;
    // events are (iter, line_id, point_idx) triples — copy out before any
    // further wasm call can grow/detach the buffer.
    const ev = new Int32Array(3 * n);
    const view = eventValues(n * 3);
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
  getRawFrameAtFrame(frame: number): RawFrame {
    const n = get_raw_frame(this.h, frameIndex(frame));
    return rawFrameFrom(frame, views().scratch, 0, n ? eventValues(n) : undefined, 0, n);
  }
  /** All-point contact observations read cached events and never step physics. */
  getAllContactLineIdsAtFrame(frame: number): number[] {
    const n = get_cached_events(this.h, frameIndex(frame));
    if (n < 0) throw new Error('observation requires an already simulated frame');
    const ev = eventValues(n * 3), ids = new Set<number>();
    for (let p = 0; p < n; p++) ids.add(ev[p * 3 + 1]);
    return [...ids];
  }
  hasContactAtFrame(frame: number): boolean {
    const contact = has_contact(this.h, frameIndex(frame));
    if (contact < 0) throw new Error('observation requires an already simulated frame');
    return contact > 0;
  }
  /** Owned raw observations of an already simulated window. Native transport
   * views are consumed here; callers keep ordinary independent frame objects. */
  getCachedRawFrames(start: number, end: number): RawFrame[] {
    const count = wasm.get_raw_window(this.h, frameIndex(start), frameIndex(end));
    if (count < 0) throw new Error('observation requires an already simulated window');
    const length = end - start + 1, values = windowValues(length * RAW_FRAME_STRIDE);
    const contacts = windowContacts(count), frames: RawFrame[] = [];
    for (let i = 0; i < length; i++) {
      const offset = i * RAW_FRAME_STRIDE;
      frames.push(rawFrameFrom(start + i, values, offset, contacts, values[offset + 11], values[offset + 12]));
    }
    return frames;
  }
  /** Read cached [vx, vy, angular momentum, radius, contact] records in a
   * synchronous scope. Return owned results; do not retain the borrowed view.
   * Engine calls (including on other engines) are blocked until the read ends. */
  readCachedMotionWindow<T>(start: number, end: number,
    consume: (values: ArrayLike<number>) => T & (T extends PromiseLike<unknown> ? never : unknown)): T {
    if (!wasm.get_motion_window(this.h, frameIndex(start), frameIndex(end)))
      throw new Error('observation requires an already simulated window');
    const values = windowValues((end - start + 1) * 5).subarray(0, (end - start + 1) * 5);
    readingMotion = true;
    try {
      const result = consume(values);
      if (result && typeof (result as {then?: unknown}).then === 'function')
        throw new TypeError('motion observation callbacks must be synchronous');
      return result;
    } finally {
      readingMotion = false;
    }
  }
  /** Whole-body motion of an already simulated frame without allocating point
   * states: centre-of-mass velocity, angular momentum about the centre (unit masses)
   * and radius of gyration. Same arithmetic, in the same order, as bodyMotion() in
   * scripts/lib/strike_impact.ts over ballisticState(), so results are identical. */
  bodyMotionAt(frame: number): {v: {x: number; y: number}; L: number; R: number} {
    if (!get_body_motion(this.h, frameIndex(frame)))
      throw new Error('observation requires an already simulated frame');
    const state = views().scratch;
    return {v: {x: state[0], y: state[1]}, L: state[2], R: state[3]};
  }

  matchesBallisticStateAtFrame(frame: number, expected: BallisticState): boolean {
    get_state_map(this.h, frameIndex(frame));
    const state = views().scratch;
    if ((state[NENT * POINT_STRIDE] === -1) !== expected.riderMounted ||
        (state[NENT * POINT_STRIDE + 1] === -1) !== expected.sledIntact) return false;
    for (let index = 0; index < RIDER_POINT_IDS.length; index++) {
      const offset = (index + 2) * POINT_STRIDE, point = expected.points[RIDER_POINT_IDS[index]];
      if (!sameStateNumber(state[offset], point.x) || !sameStateNumber(state[offset + 1], point.y) ||
          !sameStateNumber(state[offset + 2], point.prevX) || !sameStateNumber(state[offset + 3], point.prevY) ||
          !sameStateNumber(state[offset + 4], point.vx) || !sameStateNumber(state[offset + 5], point.vy)) return false;
    }
    return true;
  }

  getBallisticStateAtFrame(frame: number): BallisticState {
    get_state_map(this.h, frameIndex(frame));
    const state = views().scratch;
    const points: BallisticState['points'] = {};
    for (let index = 0; index < RIDER_POINT_IDS.length; index++) {
      const offset = (index + 2) * POINT_STRIDE;
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
      riderMounted: state[NENT * POINT_STRIDE] === -1,
      sledIntact: state[NENT * POINT_STRIDE + 1] === -1,
    };
  }

  getRider(frame: number): any {
    // Lean path: the kernel computes the BODY average + the two binding fsu in
    // Rust (get_rider writes 6 f64 to the head of SCRATCH), so the hot detector
    // loop never rebuilds the 12-entity stateMap. position/velocity are summed in
    // BODY order in Rust → bit-identical to Rider.getBody. get(id) serves the two
    // bindings and four ordinary sled probes. `ballisticState()` lazily copies
    // all ten point/previous-point states from this same already-computed frame;
    // other point reads retain the cold full-stateMap fallback.
    get_rider(this.h, frameIndex(frame));
    const sc = views().scratch;
    const fsuRider = sc[4], fsuSled = sc[5];
    const peg = RIDER_SLED_OFFSET;
    const tail = peg + POINT_STRIDE;
    const nose = tail + POINT_STRIDE;
    const stringPoint = nose + POINT_STRIDE;
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
      ballisticState: (): BallisticState => this.getBallisticStateAtFrame(frame),
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
  /** Whether the rider is mounted and the sled intact at `frame`, simulating up
   * to it if needed. Allocates nothing; callers meter through detector.ts. */
  isBoundAtFrame(frame: number): boolean {
    get_rider(this.h, frameIndex(frame));
    const sc = views().scratch;
    return sc[4] === -1 && sc[5] === -1;
  }
  /** Stop newly simulated frames at the first broken binding. */
  advanceWhileBound(frame: number): boolean {
    return wasm.advance_while_bound(this.h, frameIndex(frame)) !== 0;
  }
}
