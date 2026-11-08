// The vendored Line Rider code the picture uses, unchanged: the rider artwork and its sprite mapping, and the native replay
// (worker.js) that checks the saved trace against the engine. Bundled by scripts/gallery/build_renderer.mjs into
// generated/renderer/native.js; the picture itself (picture.js) stays plain modules.
import {loadSpriteSheet} from './sprites.js';
const {render: drawSprites, setupSprites} = require('native:806');
const EntityGenerator = require('native:823');

/** The rider artwork as the native renderer's mipmapped atlas (rasterized once). */
export async function loadSheet(url) {
  return setupSprites({spriteSvg: await loadSpriteSheet(url), hq: false});
}
/** A rider painter: (context, camera {x, y, z, w, h, r}, sheet, rider, frame); it clears `context` before drawing. */
export function riderPainter() {
  const generator = new EntityGenerator(0);
  return (context, camera, sheet, rider, frame) => {
    const entity = generator.makeRider({getRawRiders: () => [rider]}, undefined, frame, 1);
    drawSprites(context, camera, sheet, [entity]);
  };
}
/** The native replay of a saved ride: per physics frame the rider's points and the lines it touches. An abort of `signal`
 * terminates the worker at once (a synchronous replay cannot read a cancel message), so a superseded ride stops costing CPU. */
export function replay(track, trace, signal) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const worker = new Worker(new URL('./worker.js', import.meta.url), {type: 'module'});
    const stop = () => {worker.terminate(); signal?.removeEventListener('abort', abort);};
    const abort = () => {stop(); reject(signal.reason);};
    signal?.addEventListener('abort', abort, {once: true});
    worker.onmessage = ({data}) => {stop(); data.error ? reject(new Error(data.error)) : resolve(data);};
    worker.onerror = e => {stop(); reject(new Error(e.message || 'replay failed'));};
    worker.postMessage({request: 1, track, trace});
  });
}
