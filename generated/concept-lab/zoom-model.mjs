// The zoom under study: written for the song, as keyframes on one fixed scale.
// A keyframe is {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest). The scale is the same
// for every song: 0.5 is today's steady zoom, and the widest shows RANGE times more than the closest. Between keyframes the
// zoom eases in and out (a cubic), so two keyframes of the same value hold it. Pure: no DOM.
export const RANGE = 1.4;
const FPS = 40, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const cubic = x => (x = clamp(x, 0, 1), x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
/** The zoom as a multiple of today's for a wideness: 1.18 at 0, 1 at 0.5, 0.85 at 1. */
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
/** The zoom per physics frame, as a multiple of today's. offset: ride time minus song time (s). */
export function laneScale(keyframes, frames, offset = 0) {
  return Float64Array.from({length: frames}, (_, f) => zoomOfWide(wideAt(keyframes, f / FPS - offset)));
}
/** The older specs wrote zooms in the first renderer's units (1.55 to 2.9 over all of them, a small number being wide). One fixed
 * conversion for every spec, so their lanes can be looked at on today's scale. */
export const legacyWide = zoom => clamp((Math.log(2.9) - Math.log(zoom)) / (Math.log(2.9) - Math.log(1.55)), 0, 1);
/** Keyframes that hold `values[i]` through section i and change over `change` seconds around each section's start. */
export function bySection(sections, values, change = 1.2) {
  return sections.flatMap((s, i) => {
    const h = Math.min(change / 2, (s.t1 - s.t0) / 2 - 0.01), a = {t: i ? s.t0 + h : s.t0, wide: values[i]}, b = {t: i < sections.length - 1 ? s.t1 - h : s.t1, wide: values[i]};
    return [a, b];
  });
}
/** Keyframes that start each section at `values[i]` and close in by `by` until its end, opening again at the next start. */
export function pushIn(sections, values, by = 0.3, change = 0.8) {
  return sections.flatMap((s, i) => {
    const h = Math.min(change / 2, (s.t1 - s.t0) / 2 - 0.01);
    return [{t: i ? s.t0 + h : s.t0, wide: clamp(values[i], 0, 1)}, {t: i < sections.length - 1 ? s.t1 - h : s.t1, wide: clamp(values[i] - by, 0, 1)}];
  });
}
