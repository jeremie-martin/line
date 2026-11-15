// The zoom under study: how close the picture is over the ride, as a multiple of today's steady zoom per physics frame.
// Every source gives a "wideness" between 0 and 1 over the ride; the zoom is then
//   close × RANGE^(−amount × (wideness − 0.5)),
// so `amount` 0 is a steady zoom and `amount` 1 lets the widest moment show 2.5 times more than the closest.
// Pure: no DOM. Frames are physics frames (40 per second); intensity samples come at 10 per second.
export const ZOOM_DEFAULT = Object.freeze({source: 'steady', close: 1, amount: 0.5, ease: 1.5, flip: false});
export const SOURCES = {
  steady: ['Steady', 'Today: one zoom for the whole ride.'],
  song: ['Written in the spec', 'The zoom keyframes the song\'s specification carries, when it has any.'],
  sections: ['By section', 'One zoom per section of the song, from how intense the ride is there; it changes at the section\'s start.'],
  intensity: ['Follows intensity', 'Wide when the ride is intense, close when it is calm, moving all the time.'],
  speed: ['Follows speed', 'Wide when the rider is fast, close when it is slow.'],
};
export const RANGE = 2.5;
const FPS = 40, FS = 10, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smoothstep = x => {x = clamp(x, 0, 1); return x * x * (3 - 2 * x);};
function gaussian(a, sigma) {
  if (!(sigma > 0)) return Float64Array.from(a);
  const R = Math.ceil(2.5 * sigma), k = []; for (let i = -R; i <= R; i++) k.push(Math.exp(-i * i / (2 * sigma * sigma)));
  return Float64Array.from(a, (_, f) => {let s = 0, w = 0; for (let i = 0; i < k.length; i++) {s += a[clamp(f + i - R, 0, a.length - 1)] * k[i]; w += k[i];} return s / w;});
}
/** Rescale to 0–1 between the 5th and 95th percentiles (the whole range when `full`). */
function unit(a, full = false) {
  const s = Float64Array.from(a).sort(), lo = s[full ? 0 : Math.floor(0.05 * (s.length - 1))], hi = s[full ? s.length - 1 : Math.ceil(0.95 * (s.length - 1))];
  return Float64Array.from(a, v => hi > lo ? clamp((v - lo) / (hi - lo), 0, 1) : 0.5);
}
/** Wideness per physics frame. ride = {frames, level (10/s), speed (per frame), phases [{t0,t1}] in ride seconds, keyframes [{t,zoom}] | null}. */
export function wideness(ride, p = ZOOM_DEFAULT) {
  const n = ride.frames, levelAt = f => ride.level[clamp(Math.round(f / FPS * FS), 0, ride.level.length - 1)];
  if (p.source === 'intensity') return unit(gaussian(Float64Array.from({length: n}, (_, f) => levelAt(f)), p.ease * FPS));
  if (p.source === 'speed') return unit(gaussian(ride.speed, p.ease * FPS));
  if (p.source === 'sections') {
    const mean = ride.phases.map(ph => {let s = 0, c = 0; for (let f = Math.round(ph.t0 * FPS); f < Math.min(n, Math.round(ph.t1 * FPS)); f++) {s += levelAt(f); c++;} return c ? s / c : 0;});
    const w = unit(mean, true), out = new Float64Array(n);
    for (let f = 0; f < n; f++) {
      const t = f / FPS; let i = ride.phases.findIndex(ph => t < ph.t1); if (i < 0) i = ride.phases.length - 1;
      // the change is centred on the section's start and takes `ease` seconds
      const prev = i > 0 ? w[i - 1] : w[i], next = i < w.length - 1 ? w[i + 1] : w[i], h = Math.max(0.05, p.ease / 2);
      const a = t - ride.phases[i].t0, b = ride.phases[i].t1 - t;
      out[f] = a < h && i > 0 ? prev + (w[i] - prev) * smoothstep(0.5 + a / (2 * h)) : b < h && i < w.length - 1 ? w[i] + (next - w[i]) * smoothstep(0.5 - b / (2 * h)) : w[i];
    }
    return out;
  }
  if (p.source === 'song' && ride.keyframes?.length > 1) {
    const k = ride.keyframes, cubic = x => (x = clamp(x, 0, 1), x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2), lz = new Float64Array(n);
    for (let f = 0; f < n; f++) {
      const t = f / FPS; let i = 0; while (i < k.length - 2 && t > k[i + 1].t) i++;
      const a = k[i], b = k[i + 1], u = cubic((t - a.t) / Math.max(1e-6, b.t - a.t));
      lz[f] = -(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * u); // a small zoom is wide
    }
    return unit(lz, true);
  }
  return new Float64Array(n).fill(0.5);
}
/** The zoom per physics frame, as a multiple of today's. */
export function zoomScale(ride, p = ZOOM_DEFAULT) {
  const w = wideness(ride, p), sign = p.flip ? -1 : 1;
  return Float64Array.from(w, v => p.close * Math.pow(RANGE, -sign * p.amount * (v - 0.5)));
}
