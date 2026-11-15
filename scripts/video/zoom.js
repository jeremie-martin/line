// The zoom written for a song: keyframes on one fixed scale. A keyframe is {t, wide}: song seconds, and how wide the picture
// is from 0 (closest) to 1 (widest). The scale is the same for every song and is never stretched to a lane's own range: 0.5 is
// the steady zoom of a song without lanes, and the widest shows RANGE times more than the closest. Between keyframes the zoom
// eases in and out (a cubic), so two keyframes of the same value hold it. A song's lanes live in productions/<song>/zooms.ts;
// a ride is given one of them from its id (choose.js). Pure: no DOM.
import {FPS} from './timing.js';
export const RANGE = 1.4;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const cubic = x => (x = clamp(x, 0, 1), x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
/** The zoom as a multiple of the steady zoom for a wideness: 1.18 at 0, 1 at 0.5, 0.85 at 1. */
export const zoomOfWide = wide => Math.pow(RANGE, 0.5 - clamp(wide, 0, 1));
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
/** The zoom per physics frame, as a multiple of the steady zoom. offset: ride time minus song time (s). */
export function laneScale(keyframes, frames, offset = 0) {
  return Float64Array.from({length: frames}, (_, f) => zoomOfWide(wideAt(keyframes, f / FPS - offset)));
}
