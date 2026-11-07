// The numbers quoted on the morning page. Each injection goes in at 6 moments on each of 22 rides.
import fs from 'node:fs';
import * as I from '../intensity.js';
const d = JSON.parse(fs.readFileSync('analysis/signals.json'));
const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)], worst = a => Math.max(...a);
const names = Object.keys(d), R = Object.values(d).map(r => ({speed: r.speed, hits: r.hits.map(h => ({t: h[0], s: h[1]})), duration: r.n / 40})), raws = R.map(I.rawSignals);
const inject = (r, at, kind) => {const c = {...r, speed: [...r.speed], hits: r.hits.slice()};
  if (kind === 'gap') c.hits = c.hits.filter(h => h.t < at || h.t > at + 1.5);
  if (kind === 'slowdown') for (let f = 0; f < c.speed.length; f++) {const u = f / 10 - at; if (u >= -.3 && u <= 1.3) c.speed[f] -= 200 * Math.sin(Math.PI * (u + .3) / 1.6) ** 2;}
  if (kind === 'burst') c.hits = [...c.hits, ...[0, .15, .3].map(k => ({t: at + k, s: .85}))].sort((a, b) => a.t - b.t);
  return c;};
const out = {};
for (const [name, spec] of Object.entries({Speed: {use: 'speed'}, Impact: {use: 'power'}, Both: {use: 'mean'}, Meter: {use: 'mean', shape: 'meter'}})) {
  const ys = raws.map(r => I.intensity(r, spec)), res = {gap: [], slowdown: [], burst: []};
  R.forEach((r, i) => {for (let k = 1; k <= 6; k++) for (const kind of Object.keys(res)) {const y = I.intensity(I.rawSignals(inject(r, r.duration * (.15 + .7 * k / 7), kind)), spec); let m = 0; y.forEach((v, f) => {m = Math.max(m, Math.abs(v - ys[i][f]));}); res[kind].push(m);}});
  out[name] = {swings: [med(ys.map(y => I.swings(y))), worst(ys.map(y => I.swings(y)))], d05: worst(ys.map(y => I.maxChange(y, .5))), d02: worst(ys.map(y => I.maxChange(y, .2))), top: worst(ys.map(y => I.share(y, v => v > .9))), range: med(ys.map(I.range)), ...Object.fromEntries(Object.entries(res).map(([k, v]) => [k, [med(v), worst(v)]]))};
  console.log(name.padEnd(8), 'swings', out[name].swings.map(v => v.toFixed(1)).join('/'), ' Δ.2s', out[name].d02.toFixed(2), ' Δ.5s', out[name].d05.toFixed(2), ' >.9', out[name].top.toFixed(2), ' range', out[name].range.toFixed(2), ' gap', res.gap && out[name].gap.map(v => v.toFixed(2)).join('/'), ' slow', out[name].slowdown.map(v => v.toFixed(2)).join('/'), ' burst', out[name].burst.map(v => v.toFixed(2)).join('/'));
}
fs.writeFileSync('intensity/final.json', JSON.stringify(out, null, 1));
