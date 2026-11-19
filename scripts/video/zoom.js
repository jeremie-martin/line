// The zoom written for a song: keyframes on one fixed scale. A keyframe is {t, wide}: song seconds, and how wide the picture
// is from 0 (closest) to 1 (widest). The scale is the same for every song and is never stretched to a lane's own range: 0.5 is
// the steady zoom of a song without lanes, and the widest shows RANGE times more than the closest. The two ends are ZOOM: the
// magnification at the closest and at the widest, against the camera's base picture (1): at 1.075 everything is 7.5 % larger
// than in the base picture, at 0.79 the picture shows 27 % more of the scene (1 / 0.79). Between them the scale is geometric, so
// equal steps of `wide` look like equal steps; the steady zoom is their geometric middle (0.92: about 8.5 % more than the base).
// The owner set the two ends on the zoom range page (generated/concept-lab/zoom-range.html). Between keyframes the zoom
// eases in and out (a cubic), so two keyframes of the same value hold it. A song's lanes live in productions/<song>/zooms.ts;
// a ride is given one of them from its id (choose.js). Pure: no DOM.
import {FPS} from './timing.js';
import {clamp} from './math.js';
export const ZOOM = {closest: 1.075, widest: 0.79};
export const RANGE = ZOOM.closest / ZOOM.widest;
const cubic = x => (x = clamp(x, 0, 1), x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
/** The zoom as a multiple of the camera's base zoom for a wideness: 1.075 at 0, 0.92 at 0.5, 0.79 at 1. `ends`: other ends
 * than ZOOM, to try them (the zoom range page). */
export const zoomOfWide = (wide, ends = ZOOM) => ends.closest * Math.pow(ends.widest / ends.closest, clamp(wide, 0, 1));
/** Wideness at song time t for keyframes sorted by time; held before the first and after the last. */
export function wideAt(keyframes, t) {
  if (!keyframes?.length) return 0.5;
  if (t <= keyframes[0].t) return keyframes[0].wide;
  for (let i = 1; i < keyframes.length; i++) if (t <= keyframes[i].t) {
    const a = keyframes[i - 1], b = keyframes[i];
    return a.wide + (b.wide - a.wide) * cubic((t - a.t) / Math.max(1e-6, b.t - a.t));
  }
  return keyframes.at(-1).wide;
}
/** The zoom per physics frame, as a multiple of the camera's base zoom; without keyframes, the steady zoom throughout.
 * offset: ride time minus song time (s). */
export function laneScale(keyframes, frames, offset = 0, ends = ZOOM) {
  return Float64Array.from({length: frames}, (_, f) => zoomOfWide(wideAt(keyframes, f / FPS - offset), ends));
}
