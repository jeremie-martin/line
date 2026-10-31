/** The ride camera of the review pages: the finished videos' playback camera
 * (the mirror's follower step, module 560, with its default settings, as the
 * video exporter uses it), centred on the body centre, the mean of the ten
 * traced points, instead of a single point. A point on the sled or body circles
 * the centre when the rider spins, and a camera on it carries that circling
 * into the whole world; the centre stays smooth through a spin
 * (docs/research/camera-20261031.md).
 *
 * Pure: `step` is the mirror's follower step, passed in so this module needs no
 * bundler. */

/** Mean of a traced frame's points, given as [x0, y0, x1, y1, …]. */
export function bodyCentre(frame) {
  let x = 0, y = 0;
  for (let i = 0; i < frame.length; i += 2) {x += frame[i]; y += frame[i + 1];}
  return {x: 2 * x / frame.length, y: 2 * y / frame.length};
}

/** Camera position for every frame, as the mirror's follower computes it: each
 * frame steps from the previous camera towards that frame's centre, so a seek
 * shows what continuous playback from the start would show. */
export function followPath(step, centres, {width, height, zoom}) {
  const path = new Float64Array(centres.length * 2);
  let camera = step(centres[0], centres[0], {zoom, width, height});
  for (let f = 0; f < centres.length; f++) {
    if (f) camera = step(camera, centres[f], {zoom, width, height});
    path[2 * f] = camera.x; path[2 * f + 1] = camera.y;
  }
  return path;
}

/** Camera for frames of one ride: `at(view, frame)` with view {w, h, z} in CSS
 * pixels and zoom, frame fractional. Recomputes the path when the view changes,
 * and interpolates between frames as the mirror does. */
export function createCamera(step, centres) {
  let key, path;
  return (view, frame) => {
    const k = `${view.w}x${view.h}@${view.z}`;
    if (k !== key) {key = k; path = followPath(step, centres, {width: view.w, height: view.h, zoom: view.z});}
    const at = Math.max(0, Math.min(frame, centres.length - 1)), f = Math.floor(at), g = Math.min(f + 1, centres.length - 1), t = at - f;
    return {x: path[2 * f] + (path[2 * g] - path[2 * f]) * t, y: path[2 * f + 1] + (path[2 * g + 1] - path[2 * f + 1]) * t};
  };
}
