/** Private compiler ABI. The packaged wrapper and binary are rebuilt together.
 * Buffer views borrow WASM memory and are valid only until the next engine call.
 * Keep view refresh and byte layouts here; engine.ts owns handle lifetimes. */
import {readFileSync} from 'node:fs';

interface NativeExports {
  memory: WebAssembly.Memory;
  create_engine(): number;
  free_engine(handle: number): void;
  set_start(handle: number, x: number, y: number, vx: number, vy: number): number;
  add_lines(handle: number, count: number): number;
  add_lines_cap(): number;
  add_ids_ptr(): number;
  add_coords_ptr(): number;
  scratch_ptr(): number;
  events_ptr(): number;
  window_ptr(): number;
  window_contacts_ptr(): number;
  get_last_frame_index(handle: number): number;
  get_state_map(handle: number, frame: number): void;
  get_body_motion(handle: number, frame: number): number;
  get_rider(handle: number, frame: number): void;
  get_updates(handle: number, frame: number): number;
  get_cached_events(handle: number, frame: number): number;
  has_contact(handle: number, frame: number): number;
  // Scratch: six rider values, point count, ordered point ids. EVENTS: line ids.
  get_raw_frame(handle: number, frame: number): number;
  get_candidate_window(handle: number, start: number, end: number): number;
  detach_engine(handle: number): number;
  prepare_collision_trace(handle: number, frame: number): void;
  get_collision_trace(handle: number): number;
  collision_trace_ptr(): number;
  get_contact_positions(handle: number, start: number, end: number): number;
  contact_positions_ptr(): number;
}

export const wasm = new WebAssembly.Instance(new WebAssembly.Module(
  readFileSync(new URL('./engine.wasm', import.meta.url))), {}).exports as unknown as NativeExports;
export const ENTITY_IDS = [
  'RIDER_MOUNTED', 'SLED_INTACT', 'PEG', 'TAIL', 'NOSE', 'STRING',
  'BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT',
] as const;
export const NENT = ENTITY_IDS.length;
export const POINT_STRIDE = 6;
export const WINDOW_STRIDE = 9;
export const ADD_LINES_CAP = wasm.add_lines_cap();

const pointers = {scratch: wasm.scratch_ptr(),
  addIds: wasm.add_ids_ptr(), addCoords: wasm.add_coords_ptr()};
let buffer: ArrayBuffer | undefined;
let cached: {scratch: Float64Array;
  addIds: Int32Array; addCoords: Float64Array};

/** Acquire after the native call: memory.grow detaches all previous views. */
export function views(): typeof cached {
  if (buffer !== wasm.memory.buffer) {
    buffer = wasm.memory.buffer;
    cached = {
      scratch: new Float64Array(buffer, pointers.scratch, NENT * POINT_STRIDE + NENT),
      addIds: new Int32Array(buffer, pointers.addIds, ADD_LINES_CAP * 3),
      addCoords: new Float64Array(buffer, pointers.addCoords, ADD_LINES_CAP * 4),
    };
  }
  return cached;
}

// A vector can move inside the same WASM memory buffer. Check its pointer as well
// as buffer identity; shorter reads can reuse the initialized high-water view.
function outputView(pointer: () => number) {
  let view: Float64Array | undefined;
  return (length: number): Float64Array => {
    const offset = pointer(), memory = wasm.memory.buffer;
    if (!view || view.buffer !== memory || view.byteOffset !== offset || view.length < length)
      view = new Float64Array(memory, offset, length);
    return view;
  };
}
export const eventValues = outputView(wasm.events_ptr);
export const windowValues = outputView(wasm.window_ptr);
export const windowContacts = outputView(wasm.window_contacts_ptr);
