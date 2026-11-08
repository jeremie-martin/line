// How hard is the ride going right now? One pure module, used by the picture, the lab and its analysis, and independent of
// anything drawn with it. A ride gives two honest signals: how fast the rider is going, and how much impact it is taking
// per second (impact rate × strength as one sum, so a few big hits and many small ones are the same kind of thing).
// Everything is offline: the whole ride is known, so lag is a design choice here, not a cost.
export const FS = 10; // Hz: nothing here needs more
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
/** The shared, absolute strength curve: the same for every song, no ranks. */
export const strength = s => Math.pow(clamp((s - 0.2) / 0.65, 0, 1), 1.4);

/** Zero-phase gaussian, edges held. σ in seconds. No overshoot, so it cannot ring or blink. */
export function gaussian(a, sigma) {
  const n = a.length, s = sigma * FS, r = Math.ceil(3 * s), k = []; for (let i = -r; i <= r; i++) k.push(Math.exp(-i * i / (2 * s * s)));
  const w = k.reduce((x, y) => x + y), out = new Float64Array(n);
  for (let f = 0; f < n; f++) {let v = 0; for (let i = -r; i <= r; i++) v += a[clamp(f + i, 0, n - 1)] * k[i + r]; out[f] = v / w;}
  return out;
}
/** Sliding median over `seconds`: ignores anything shorter than half the window, in either direction, and keeps real edges sharp. */
export function median(a, seconds) {const h = Math.round(seconds * FS / 2), n = a.length, o = new Float64Array(n), w = []; for (let f = 0; f < n; f++) {w.length = 0; for (let i = f - h; i <= f + h; i++) w.push(a[clamp(i, 0, n - 1)]); w.sort((x, y) => x - y); o[f] = w[h];} return o;}
/** Causal envelope: rises with time constant `rise`, falls with `fall` (seconds). Reacts to what just happened, as a level meter does. */
export function envelope(a, rise, fall) {const o = new Float64Array(a.length); o[0] = a[0]; for (let f = 1; f < a.length; f++) {const x = a[f], y = o[f - 1], tau = x > y ? rise : fall; o[f] = y + (x - y) * (1 - Math.exp(-1 / (tau * FS)));} return o;}
/** Hard ceiling on change, per second, without lag: forward and backward passes, averaged. */
export function slew(a, rate) {
  const lim = (src, dir) => {const o = Float64Array.from(src), d = rate / FS, n = o.length, [i0, i1, st] = dir > 0 ? [1, n, 1] : [n - 2, -1, -1]; for (let f = i0; st > 0 ? f < i1 : f > i1; f += st) o[f] = clamp(o[f], o[f - st] - d, o[f - st] + d); return o;};
  const u = lim(a, 1), v = lim(a, -1); return Float64Array.from(u, (x, f) => (x + v[f]) / 2);
}
const quantile = (a, q) => {const s = Float64Array.from(a).sort(); return s[Math.floor(q * (s.length - 1))];};
export const scaleTo = (a, lo, hi) => Float64Array.from(a, v => clamp((v - lo) / Math.max(1e-9, hi - lo), 0, 1));

/** Ride → the two raw signals on the FS grid. speed: u/s, already on the FS grid. hits: [{t (s), s (measured strength)}]. */
export function rawSignals({speed, hits, duration}) {
  const n = Math.round(duration * FS), v = Float64Array.from({length: n}, (_, f) => speed[Math.min(f, speed.length - 1)]), p = new Float64Array(n);
  for (const h of hits) {const f = Math.round(h.t * FS); if (f >= 0 && f < n) p[f] += strength(h.s) * FS;} // strength per second
  return {speed: v, power: p};
}
export const SHAPES = {
  // Ignores short events in both directions and keeps real changes; the small gaussian only rounds the corners. Zero phase, so no lag.
  steady: {label: 'Steady', fn: (x, o) => gaussian(median(x, o.window), o.sigma)},
  // For contrast: reacts after the fact, like a level meter. Rises in about a second, falls over several.
  meter: {label: 'Meter', fn: (x, o) => envelope(median(x, 2), o.rise, o.fall)},
};
// Chosen from sweeps on 22 rides (intensity/sweep.mjs), against the owner's stated limits. window: 6 s, σ: 1 s, ceiling 0.3 per second.
// ANCHORS are the p5 and p99.5 of each shaped signal over all 22 rides: one scale for every song, so a flat song stays flat, and a song's plateau sits near 0.8 with room above it.
export const ANCHORS = {speed: [334, 493], power: [0.16, 1.41]};
export const DEFAULTS = {window: 6, sigma: 1, rise: 0.7, fall: 4, rate: 0.3, localise: 1};
/** The whole metric, 0–1 on the FS grid. spec: {use: 'speed'|'power'|'mean', shape, scale: anchors or 'song', ...parameters}. */
export function intensity(raw, spec = {}) {
  const o = {...DEFAULTS, shape: 'steady', use: 'mean', scale: ANCHORS, ...spec}, shape = SHAPES[o.shape].fn;
  const local = {speed: gaussian(raw.speed, 0.3), power: gaussian(raw.power, o.localise)}; // what "right now" means for each signal
  const part = k => {const y = shape(local[k], o), [lo, hi] = o.scale === 'song' ? [quantile(y, 0.05), quantile(y, 0.95)] : o.scale[k]; return scaleTo(y, lo, hi);};
  const out = o.use === 'mean' ? (a => {const b = part('power'); return a.map((v, f) => (v + b[f]) / 2);})(part('speed')) : part(o.use);
  return slew(out, o.rate); // the ceiling on change is on the final 0–1 scale
}
// ── measures: what the metric does, read as a filter. Guardrails, not goals. ───────────────────────────
export function swings(x, frac = 0.15) {
  const lo = quantile(x, 0.05), hi = quantile(x, 0.95), th = frac * Math.max(hi - lo, 1e-6); let n = 0, d = 0, ref = x[0];
  for (const v of x) {if (d >= 0 && v > ref) {ref = v; if (!d) d = 1;} else if (d <= 0 && v < ref) {ref = v; if (!d) d = -1;} if (d === 1 && v < ref - th) {n++; d = -1; ref = v;} else if (d === -1 && v > ref + th) {n++; d = 1; ref = v;}}
  return n / (x.length / FS / 60);
}
export const maxChange = (x, seconds) => {const k = Math.round(seconds * FS); let m = 0; for (let f = k; f < x.length; f++) m = Math.max(m, Math.abs(x[f] - x[f - k])); return m;};
export const range = x => quantile(x, 0.95) - quantile(x, 0.05);
export const share = (x, test) => x.reduce((a, v) => a + (test(v) ? 1 : 0), 0) / x.length;
export {quantile};
