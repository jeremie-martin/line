/** Fresh-checkout physics gate: compiler backend vs the independent reference.
 * No generated fingerprints to record or accidentally bless. */
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {LineRiderEngine as Native, disposeEngines as disposeNative} from '../../scripts/lib/native_motion/engine.ts';
import {LineRiderEngine as Reference, disposeAllWasmEnginesForStudy as disposeReference} from '../../scripts/lib/_lr_engine_wasm.ts';
import {bodyMotion} from '../../scripts/lib/strike_impact.ts';

const directory = new URL('./tracks/', import.meta.url);
const files = readdirSync(directory).filter(name => name.endsWith('.json.gz')).sort();
assert(files.length > 0, 'missing committed engine fixtures');
let frames = 0, collisions = 0;
for (const file of files) {
  const track = JSON.parse(gunzipSync(readFileSync(new URL(file, directory))).toString());
  const engines = [Native, Reference].map(Engine => new Engine()
    .setStart(track.startPosition, track.riders[0].startVelocity).addLine(track.lines));
  try {
    const expectedMotion: number[] = [], expectedRaw = [];
    for (let f = 0; f <= track.duration; f++) {
      const states = engines.map(e => [...e.getStateMapAtFrame(f)].map(([id, state]: [string, any]) => [id, state.__state__]));
      assert.deepEqual(states[0], states[1], `${file}, frame ${f}: state`);
      const events = engines.map(e => e.getUpdatesAtFrame(f).filter((u: any) => u.type === 'CollisionUpdate')
        .map((u: any) => [u.id, u.updated.map((p: any) => p.id)]));
      assert.deepEqual(events[0], events[1], `${file}, frame ${f}: collision order`);
      const native = engines[0] as Native;
      const raw = engines[1].getRawFrameAtFrame(f);
      expectedRaw.push(raw);
      assert.deepEqual(native.getRawFrameAtFrame(f), raw, `${file}, frame ${f}: raw frame`);
      const points = Object.fromEntries(states[1].slice(2).map(([id, state]: any) => [id, {
        x: state.pos.x, y: state.pos.y, prevX: state.prevPos.x, prevY: state.prevPos.y,
      }]));
      const motion = bodyMotion({points});
      expectedMotion.push(motion.v.x, motion.v.y, motion.L, motion.R, events[1].length > 0 ? 1 : 0);
      assert.deepEqual(native.bodyMotionAt(f), motion, `${file}, frame ${f}: body motion`);
      assert.equal(native.hasContactAtFrame(f), events[1].length > 0, `${file}, frame ${f}: contact presence`);
      assert.deepEqual(native.getAllContactLineIdsAtFrame(f), [...new Set(events[1].map((e: any) => e[0]))],
        `${file}, frame ${f}: contact ids`);
      assert.equal(native.getLastFrameIndex(), f, `${file}, frame ${f}: observations cannot simulate`);
      collisions += events[0].length;
      frames++;
    }
    assert.deepEqual((engines[0] as Native).getCachedRawFrames(0, track.duration), expectedRaw, `${file}: cached raw window`);
    assert.deepEqual([...(engines[0] as Native).getCachedMotionWindow(0, track.duration)], expectedMotion, `${file}: packed motion window`);
  } finally {
    disposeNative(); disposeReference();
  }
  console.log(`same  ${file}`);
}
console.log(`PASS  ${files.length} tracks, ${frames} frame states, ${collisions} ordered collisions`);
console.log(`PASS  ${frames} raw-frame, body-motion and cached-contact observations`);
