/** Fresh-checkout physics gate: compiler backend vs the independent reference.
 * No generated fingerprints to record or accidentally bless. */
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {LineRiderEngine as Native, disposeAllWasmEnginesForStudy as disposeNative} from '../../scripts/lib/native_motion/engine.ts';
import {LineRiderEngine as Reference, disposeAllWasmEnginesForStudy as disposeReference} from '../../scripts/lib/_lr_engine_wasm.ts';

const directory = new URL('./tracks/', import.meta.url);
const files = readdirSync(directory).filter(name => name.endsWith('.json.gz')).sort();
assert(files.length > 0, 'missing committed engine fixtures');
let frames = 0, collisions = 0;
for (const file of files) {
  const track = JSON.parse(gunzipSync(readFileSync(new URL(file, directory))).toString());
  const engines = [Native, Reference].map(Engine => new Engine()
    .setStart(track.startPosition, track.riders[0].startVelocity).addLine(track.lines));
  try {
    for (let f = 0; f <= track.duration; f++) {
      const states = engines.map(e => [...e.getStateMapAtFrame(f)].map(([id, state]: [string, any]) => [id, state.__state__]));
      assert.deepEqual(states[0], states[1], `${file}, frame ${f}: state`);
      const events = engines.map(e => e.getUpdatesAtFrame(f).filter((u: any) => u.type === 'CollisionUpdate')
        .map((u: any) => [u.id, u.updated.map((p: any) => p.id)]));
      assert.deepEqual(events[0], events[1], `${file}, frame ${f}: collision order`);
      collisions += events[0].length;
      frames++;
    }
  } finally {
    disposeNative(); disposeReference();
  }
  console.log(`same  ${file}`);
}
console.log(`PASS  ${files.length} tracks, ${frames} frame states, ${collisions} ordered collisions`);
