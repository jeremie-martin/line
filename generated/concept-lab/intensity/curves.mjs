import fs from 'node:fs';
import * as I from '../intensity.js';
// Exports the six lab songs' curves for the page's chart: Both, Speed, Impact, every 0.5 s.
const out = {}, FPS = 40;
for (const key of ['petrunko', 'lua', 'los', 'batidao', 'burn', 'coma', 'tomada']) {
  const d = JSON.parse(fs.readFileSync(`data/${key}.json`)), fr = d.trace.frames, c = fr.map(f => {let x = 0, y = 0; for (let i = 0; i < f.length; i += 2) {x += f[i]; y += f[i + 1];} return [2 * x / f.length, 2 * y / f.length];});
  const sp = c.map((_, f) => {const a = c[Math.max(0, f - 1)], b = c[Math.min(c.length - 1, f + 1)], k = Math.min(c.length - 1, f + 1) - Math.max(0, f - 1) || 1; return Math.hypot(b[0] - a[0], b[1] - a[1]) / k * FPS;}).filter((_, f) => f % 4 === 0);
  const raw = I.rawSignals({speed: sp, hits: d.hits.map(h => ({t: h.t, s: h.s})), duration: d.duration}), p = a => [...a].filter((_, f) => f % 5 === 0).map(v => +v.toFixed(3));
  out[key] = {title: d.title, duration: d.duration, both: p(I.intensity(raw)), speed: p(I.intensity(raw, {use: 'speed'})), impact: p(I.intensity(raw, {use: 'power'}))};
  const b = out[key].both, q = v => [...b].sort((x, y) => x - y)[Math.floor(v * (b.length - 1))]; console.log(key.padEnd(9), 'p5', q(.05), 'p50', q(.5), 'p95', q(.95));
}
fs.writeFileSync('intensity/curves.json', JSON.stringify(out));
