import fs from 'node:fs';
import * as I from '../intensity.js';
const d = JSON.parse(fs.readFileSync('analysis/signals.json'));
const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)], worst = a => Math.max(...a);
const R = Object.values(d).map(r => ({speed: r.speed, hits: r.hits.map(h => ({t: h[0], s: h[1]})), duration: r.n / 40}));
const raws = R.map(I.rawSignals);
// Each injection is put at 6 evenly spaced moments in the middle of each ride. Reported: the largest effect it has on the metric.
function perturb(r, at, kind) {
  const c = {...r, speed: [...r.speed], hits: r.hits.slice()};
  if (kind === 'gap') c.hits = c.hits.filter(h => h.t < at || h.t > at + 1.5);
  if (kind === 'slow') for (let f = 0; f < c.speed.length; f++) {const u = (f / 10 - at); if (u >= -0.3 && u <= 1.3) c.speed[f] -= 200 * Math.sin(Math.PI * (u + 0.3) / 1.6) ** 2;}
  if (kind === 'burst') c.hits = [...c.hits, ...[0, .15, .3].map(k => ({t: at + k, s: 0.85}))].sort((a, b) => a.t - b.t);
  return c;
}
function injections(spec) {
  const res = {gap: [], slow: [], burst: []};
  R.forEach((r, i) => {const y0 = I.intensity(raws[i], {...spec});
    for (let k = 1; k <= 6; k++) {const at = r.duration * (0.15 + 0.7 * k / 7);
      for (const kind of Object.keys(res)) {const y = I.intensity(I.rawSignals(perturb(r, at, kind)), {...spec}); let m = 0; for (let f = 0; f < y.length; f++) m = Math.max(m, Math.abs(y[f] - y0[f])); res[kind].push(m);}}});
  return Object.fromEntries(Object.entries(res).map(([k, v]) => [k, [med(v), worst(v)]]));
}
const p = (a) => a.map(v => v.toFixed(2)).join('/');

const rise = y => {let best = 9e9; const n = y.length; for (let a = 0; a < n; a++) if (y[a] < 0.25) for (let b = a + 1; b < Math.min(n, a + 150); b++) if (y[b] > 0.75) {let s = a; while (s + 1 < b && y[s + 1] <= 0.25) s++; best = Math.min(best, (b - s) / 10); break;} return best;};
const row = (label, spec) => {const ys = raws.map(r => I.intensity(r, spec)), inj = injections(spec), rises = ys.map(rise).filter(v => v < 9e8);
  console.log(label.padEnd(26), `${med(ys.map(y => I.swings(y))).toFixed(1)}/${worst(ys.map(y => I.swings(y))).toFixed(1)}`.padEnd(10), worst(ys.map(y => I.maxChange(y, .5))).toFixed(2).padEnd(6), med(rises).toFixed(1).padEnd(6), p(inj.gap).padEnd(11), p(inj.slow).padEnd(11), p(inj.burst).padEnd(11), med(ys.map(I.range)).toFixed(2), worst(ys.map(y => I.share(y, v => v > .9))).toFixed(2));};
console.log('label                      swings    Δ.5s  rise   gap        slow       burst      range  >.9 share');
for (const window of [2, 3, 4, 6]) for (const sigma of [.5, 1, 1.5]) row(`median ${window} σ${sigma}`, {use: 'mean', shape: 'steady', window, sigma, rate: 0.3});
const shared = {speed: [389, 469], power: [0.19, 1.3]};
console.log('\nscale, median 4 σ1');
const b = {use: 'mean', shape: 'steady', window: 4, sigma: 1, rate: 0.3};
row('per song', b); row('shared', {...b, scale: shared});
for (const q of [.5, .75, 1]) row(`per song, min span ×${q}`, {...b, span: {speed: q * 80, power: q * 1.11}});
console.log('\nrate, median 4 σ1, span ×.75');
for (const rate of [.2, .3, .4, .6, 1]) row(`rate ${rate}`, {...b, rate, span: {speed: 60, power: .83}});
console.log('\nshared scale');
const sc = {speed: [389, 469], power: [0.19, 1.3]};
for (const window of [4, 5, 6, 8]) for (const sigma of [.5, 1, 1.5]) row(`median ${window} σ${sigma}`, {use: 'mean', shape: 'steady', window, sigma, rate: 0.3, scale: sc});
console.log('\nmixes on shared, median 5 σ1');
for (const use of ['speed', 'power', 'mean', 'rms', 'max']) row(use, {use, shape: 'steady', window: 5, sigma: 1, rate: .3, scale: sc});
console.log('\nper song, shared, median 5 σ1, mean: range, level');
const names = Object.keys(d);
const spec = {use: 'mean', shape: 'steady', window: 5, sigma: 1, rate: .3, scale: sc};
raws.forEach((r, i) => {const y = I.intensity(r, spec), q = v => I.quantile(y, v).toFixed(2); console.log(names[i].slice(0, 32).padEnd(33), 'p5', q(.05), 'p50', q(.5), 'p95', q(.95), ' swings', I.swings(y).toFixed(1));});
// is the slow rise the filter's or the ride's? the same steepest-rise measure on barely filtered signals
console.log('\nsteepest 25→75 rise, median of rides');
for (const [label, spec] of [['raw-ish speed (σ .5, no median)', {use: 'speed', shape: 'steady', window: 0.1, sigma: .5, rate: 99}], ['raw-ish impact (σ .5)', {use: 'power', shape: 'steady', window: .1, sigma: .5, rate: 99, localise: .5}], ['speed, median 5', {use: 'speed', shape: 'steady', window: 5, sigma: 1, rate: 99}], ['impact, median 5', {use: 'power', shape: 'steady', window: 5, sigma: 1, rate: 99}]]) {const rs = raws.map(r => rise(I.intensity(r, spec))).filter(v => v < 9e8); console.log(label.padEnd(36), med(rs).toFixed(1), 's  (n', rs.length + ')');}
