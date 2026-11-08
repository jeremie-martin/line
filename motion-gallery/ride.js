/** A saved ride for the review player, drawn by the video picture (scripts/video/picture.js): its scene from the review server
 * (the same scene.ts a video of it is drawn from), its native replay and its contact inspection. The last few rides are kept,
 * so moving back and forth along a collection is immediate. */
import * as N from '/generated/renderer/native.js';
import {inspectRailContacts} from '/generated/renderer/inspect.js';
import {createPicture} from '/scripts/video/picture.js';
const cache = new Map();
let sheet;
/** record: the verified saved record; url: where it was loaded from; digest: its sha256 from the manifest. */
export async function prepareRide(record, url, digest, signal) {
  signal?.throwIfAborted();
  let entry = cache.get(digest);
  if (!entry) {
    const path = new URL(url, location.href).pathname;
    const response = await fetch(`/api/scene?ride=${encodeURIComponent(path)}&sha256=${digest}`, {signal});
    if (!response.ok) throw new Error(`Scene unavailable: ${(await response.json().catch(() => ({}))).error ?? response.status}`);
    const scene = await response.json();
    const replay = await N.replay(scene.track, scene.trace);
    signal?.throwIfAborted();
    entry = {scene, replay, inspection: inspectRailContacts(record, replay.contacts)};
  }
  cache.delete(digest); cache.set(digest, entry);
  while (cache.size > 8) cache.delete(cache.keys().next().value);
  return entry;
}
/** The picture of a prepared ride on `canvas`. */
export async function pictureFor(canvas, entry) {
  sheet ??= N.loadSheet().catch(error => {sheet = undefined; throw error;});
  return createPicture(canvas, entry.scene, entry.replay, await sheet, N.riderPainter());
}
