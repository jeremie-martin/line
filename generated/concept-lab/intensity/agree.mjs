import fs from 'node:fs';
import * as I from '../../../scripts/video/intensity.js';
const d = JSON.parse(fs.readFileSync('analysis/signals.json'));
const corr = (a, b) => {const n = a.length, ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n; let s = 0, u = 0, v = 0; for (let i = 0; i < n; i++) {s += (a[i] - ma) * (b[i] - mb); u += (a[i] - ma) ** 2; v += (b[i] - mb) ** 2;} return s / Math.sqrt(u * v);};
const rows = [];
for (const [k, r] of Object.entries(d)) {
  const raw = I.rawSignals({speed: r.speed, hits: r.hits.map(h => ({t: h[0], s: h[1]})), duration: r.n / 40}), a = I.intensity(raw, {use: 'speed'}), b = I.intensity(raw, {use: 'power'}), n = a.length;
  const m = (x, t) => {let s = 0; for (let f = t * 10; f < (t + 5) * 10; f++) s += x[f]; return s / 50;}; let best = 0;
  for (let p = 4; p < n / 10 - 12; p++) for (let q = 4; q < n / 10 - 12; q++) if (Math.abs(p - q) >= 8) best = Math.max(best, Math.min(m(a, p) - m(a, q), m(b, q) - m(b, p)));
  rows.push([k, corr(a, b), best]);
}
rows.sort((x, y) => x[1] - y[1]); for (const [k, c, b] of rows) console.log(k.slice(0, 36).padEnd(37), 'corr', c.toFixed(2), ' largest 5 s disagreement', b.toFixed(2));
