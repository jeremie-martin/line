/** Shared deterministic workloads for engine diagnostics and the paired decision gate. */
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {savedEngineTracks} from '../parity/engine_corpus.ts';
export const tracks = savedEngineTracks();
// ABI kept private here: the production wrapper and engine selection are unchanged.
type Exports = Record<string, any> & {memory: WebAssembly.Memory};
export function instance(module: WebAssembly.Module): Exports {
  return new WebAssembly.Instance(module, {}).exports as Exports;
}
function addBatch(ex: Exports, handle: number, lines: any[]) {
  const ids = new Int32Array(ex.memory.buffer, ex.add_ids_ptr(), lines.length * 3);
  const coords = new Float64Array(ex.memory.buffer, ex.add_coords_ptr(), lines.length * 4);
  lines.forEach((l, i) => {
    ids[i * 3] = l.id; ids[i * 3 + 1] = l.type;
    ids[i * 3 + 2] = (l.flipped ? 1 : 0) | (l.leftExtended ? 2 : 0) | (l.rightExtended ? 4 : 0);
    coords[i * 4] = l.x1; coords[i * 4 + 1] = l.y1;
    coords[i * 4 + 2] = l.x2; coords[i * 4 + 3] = l.y2;
  });
  return ex.add_lines(handle, lines.length);
}
function add(ex: Exports, handle: number, lines: any[]) {
  for (let start = 0; start < lines.length; start += ex.add_lines_cap()) {
    const next = addBatch(ex, handle, lines.slice(start, start + ex.add_lines_cap()));
    ex.free_engine(handle);
    handle = next;
  }
  return handle;
}
function start(ex: Exports, track: any) {
  const root = ex.create_engine(), p = track.startPosition, v = track.riders[0].startVelocity;
  const handle = ex.set_start(root, p.x, p.y, v.x, v.y);
  ex.free_engine(root);
  return handle;
}
export type Workload = 'register' | 'replay' | 'branches';
export function run(ex: Exports, workload: Workload, verify = false) {
  const digest = createHash('sha256');
  let frames = 0;
  const observe = (h: number, f: number) => {
    const before = ex.get_last_frame_index(h);
    frames += Math.max(0, f - before);
    ex.get_state_map(h, f);
    if (verify) {
      digest.update(String(before));
      digest.update(new Uint8Array(ex.memory.buffer, ex.scratch_ptr(), 84 * 8));
      const count = ex.get_updates(h, f);
      digest.update(String(count));
      digest.update(new Uint8Array(ex.memory.buffer, ex.events_ptr(), count * 3 * 8));
      const contacts = ex.get_contact_positions(h, f, f);
      assert(contacts >= 0);
      digest.update(String(contacts));
      digest.update(new Uint8Array(ex.memory.buffer, ex.contact_positions_ptr(), contacts * 3 * 8));
    }
  };
  for (const {track} of tracks) {
    let root = start(ex, track);
    if (workload !== 'branches') {
      root = add(ex, root, track.lines);
      ex.get_last_frame_index(root); // forces registration, even without stepping
      if (workload === 'replay') {
        if (verify) for (let f = 0; f <= track.duration; f++) observe(root, f);
        else observe(root, track.duration);
      }
    } else {
      // Sibling versions add real track suffixes; switching back forces removal,
      // invalidation, lazy history materialization, and re-simulation.
      const split = Math.min(100, track.lines.length);
      root = add(ex, root, track.lines.slice(0, split));
      observe(root, 120);
      for (let i = 0; i < 12; i++) {
        const branch = addBatch(ex, root, [{id: 1000000 + i, type: i % 2, x1: -50, y1: 20 + i, x2: 350, y2: 40 + i}]);
        const child = add(ex, branch, track.lines.slice(split, split + 100 + i * 20));
        observe(child, 180);
        if (verify) for (let f = 0; f <= 180; f++) observe(child, f);
        ex.free_engine(child);
        observe(root, 120);
      }
      // A detached prefix must not retain pointers into its source grid.
      const detached = ex.detach_engine(root);
      ex.free_engine(root);
      root = detached;
      observe(root, 200);
    }
    ex.free_engine(root);
  }
  return {frames, fingerprint: verify ? digest.digest('hex') : null};
}
export const workloads: Workload[] = ['register', 'replay', 'branches'];
