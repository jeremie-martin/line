/** Small saved physics oracle: binary64 states and ordered collision triples,
 * hashed in blocks. A mismatch names the case/frame range; live differential
 * verification remains the detailed oracle and wrapper check. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {engineCorpus, sha256, type PhysicsTrack} from './engine_corpus.ts';

export const referenceWasm = new URL('../../engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm', import.meta.url);
export const nativeWasm = new URL('../../scripts/lib/native_motion/engine.wasm', import.meta.url);
export const fixturePath = new URL('./engine-reference.json', import.meta.url);
const blockFrames = 256;
/** Compatibility is defined by the bytes we compare, not by the build that
 * originally produced them. Change this contract when the encoding changes. */
const format = Object.freeze({schema: 'line.engine-reference.v2', blockFrames,
  encoding: '84 little-endian binary64 state values, uint32 collision count, ordered binary64 (iteration,line,point) triples per frame'});
type Exports = {
  memory: WebAssembly.Memory;
  create_engine(): number; free_engine(handle: number): void;
  set_start(handle: number, x: number, y: number, vx: number, vy: number): number;
  add_line(handle: number, id: number, type: number, x1: number, y1: number, x2: number, y2: number, flags: number): number;
  add_lines(handle: number, count: number): number; add_lines_cap(): number;
  add_ids_ptr(): number; add_coords_ptr(): number;
  get_state_map(handle: number, frame: number): void; scratch_ptr(): number;
  get_updates(handle: number, frame: number): number; events_ptr(): number;
};

export function fingerprint(module: WebAssembly.Module, track: PhysicsTrack) {
  const ex = new WebAssembly.Instance(module, {}).exports as unknown as Exports;
  let handle = ex.create_engine();
  const replace = (next: number) => {ex.free_engine(handle); handle = next;};
  const position = track.startPosition, velocity = track.riders[0].startVelocity;
  replace(ex.set_start(handle, position.x, position.y, velocity.x, velocity.y));
  let collisions = 0;
  const blocks: {endFrame: number; sha256: string}[] = [];
  let digest = createHash('sha256');
  const countBytes = Buffer.alloc(4);
  try {
    const flags = (l: PhysicsTrack['lines'][number]) => (l.flipped ? 1 : 0) |
      (l.leftExtended || (l.extended ?? 0) & 1 ? 2 : 0) | (l.rightExtended || (l.extended ?? 0) & 2 ? 4 : 0);
    // The independent oracle predates native batch registration.
    if (ex.add_line) {
      for (const l of track.lines) replace(ex.add_line(handle, l.id, l.type, l.x1, l.y1, l.x2, l.y2, flags(l)));
    } else for (let start = 0; start < track.lines.length; start += ex.add_lines_cap()) {
      const lines = track.lines.slice(start, start + ex.add_lines_cap());
      const ids = new Int32Array(ex.memory.buffer, ex.add_ids_ptr(), lines.length * 3);
      const coords = new Float64Array(ex.memory.buffer, ex.add_coords_ptr(), lines.length * 4);
      lines.forEach((l, i) => {
        ids.set([l.id, l.type, flags(l)], i * 3);
        coords.set([l.x1, l.y1, l.x2, l.y2], i * 4);
      });
      replace(ex.add_lines(handle, lines.length));
    }
    for (let frame = 0; frame <= track.duration; frame++) {
      ex.get_state_map(handle, frame);
      // WASM is little endian. Hash the exact bytes, including signed zero;
      // never JSON-round floating point or include uninitialized ABI padding.
      digest.update(new Uint8Array(ex.memory.buffer, ex.scratch_ptr(), 84 * 8));
      const count = ex.get_updates(handle, frame);
      assert(count >= 0 && count < 16384, 'reference event buffer might be truncated');
      countBytes.writeUInt32LE(count);
      digest.update(countBytes);
      digest.update(new Uint8Array(ex.memory.buffer, ex.events_ptr(), count * 3 * 8));
      collisions += count;
      if ((frame + 1) % blockFrames === 0 || frame === track.duration) {
        blocks.push({endFrame: frame, sha256: digest.digest('hex')});
        digest = createHash('sha256');
      }
    }
  } finally {ex.free_engine(handle);}
  return {frames: track.duration + 1, collisions, blocks};
}

/** Only generation reads the oracle and source bytes. Provenance records what
 * produced this evidence; it is never a requirement on a future checkout. */
export function referenceFingerprints() {
  const bytes = readFileSync(referenceWasm), module = new WebAssembly.Module(bytes);
  return {format, provenance: {
    oracleSha256: sha256(bytes),
    generatorSha256: sha256(readFileSync(new URL('./engine_fingerprints.ts', import.meta.url))),
    corpusSha256: sha256(readFileSync(new URL('./engine_corpus.ts', import.meta.url))),
  }, cases: engineCorpus().map(({name, inputSha256, track}) => ({name, inputSha256, ...fingerprint(module, track)}))};
}
export type EngineReference = ReturnType<typeof referenceFingerprints>;

export function verifyFingerprints(reference: EngineReference, module = new WebAssembly.Module(readFileSync(nativeWasm))) {
  assert.deepEqual(reference.format, format, 'unsupported engine reference format');
  const expected = reference.cases;
  const cases = engineCorpus();
  assert.deepEqual(expected.map(c => [c.name, c.inputSha256]), cases.map(c => [c.name, c.inputSha256]), 'stale or incomplete engine corpus');
  let frames = 0, collisions = 0;
  cases.forEach(({name, track}, index) => {
    const actual = fingerprint(module, track), saved = expected[index];
    assert.equal(actual.blocks.length, saved.blocks.length, `${name}: missing blocks`);
    actual.blocks.forEach((block, i) => assert.deepEqual(block, saved.blocks[i],
      `${name}, frames ${i * blockFrames}..${block.endFrame}: physics mismatch; run npm run verify:engine`));
    assert.equal(actual.frames, saved.frames, `${name}: frame count`);
    assert.equal(actual.collisions, saved.collisions, `${name}: collision count`);
    frames += actual.frames; collisions += actual.collisions;
  });
  return {cases: cases.length, frames, collisions};
}
