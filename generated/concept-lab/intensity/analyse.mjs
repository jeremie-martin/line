import fs from 'node:fs';
import * as I from '../../../scripts/video/intensity.js';
const d = JSON.parse(fs.readFileSync('analysis/signals.json'));
const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)], worst = a => Math.max(...a), least = a => Math.min(...a);
const rides = Object.entries(d).map(([k, r]) => [k, I.rawSignals({speed: r.speed, hits: r.hits.map(h => ({t: h[0], s: h[1]})), duration: r.n / 40})]);
// shared anchors: the population's p5 and p95 of each shaped signal, so that songs can be compared with each other
const anchors = (spec) => {const pool = k => rides.flatMap(([, raw]) => [...I.SHAPES[spec.shape ?? 'slow'].fn(I.gaussian(raw[k], k === 'speed' ? 0.3 : 1), {...I.DEFAULTS, ...spec})]); const out = {}; for (const k of ['speed', 'power']) {const p = pool(k); out[k] = [I.quantile(p, 0.05), I.quantile(p, 0.95)];} return out;};
const CANDS = {
  'speed alone': {use: 'speed'}, 'impact alone': {use: 'power'}, 'mean': {use: 'mean'}, 'rms': {use: 'rms'}, 'max': {use: 'max'},
  'mean, meter': {use: 'mean', shape: 'meter'}, 'impact, meter': {use: 'power', shape: 'meter'}, 'speed, meter': {use: 'speed', shape: 'meter'},
};
console.log('candidate          range(med/min)  swings/min(med/max)  Δ0.5s(max)  Δ2s(max)  >.9 share(max)  <.1 share(max)');
for (const [name, spec] of Object.entries(CANDS)) {
  const ys = rides.map(([, raw]) => I.intensity(raw, spec));
  console.log(name.padEnd(18), I.range(ys[0]) && `${med(ys.map(I.range)).toFixed(2)} / ${least(ys.map(I.range)).toFixed(2)}`.padEnd(15), `${med(ys.map(y => I.swings(y))).toFixed(1)} / ${worst(ys.map(y => I.swings(y))).toFixed(1)}`.padEnd(20), worst(ys.map(y => I.maxChange(y, .5))).toFixed(3).padEnd(11), worst(ys.map(y => I.maxChange(y, 2))).toFixed(2).padEnd(9), worst(ys.map(y => I.share(y, v => v > .9))).toFixed(2).padEnd(15), worst(ys.map(y => I.share(y, v => v < .1))).toFixed(2));
}
console.log('\nper-song range of the mean when speed and impact disagree:');
for (const k of ['no_batidao_slowed_selection', 'passo_bem_solto_slowed_selection', 'amor_na_praia_selection', 'luna_bala_original_selection']) {const raw = rides.find(r => r[0] === k)[1]; console.log(k.padEnd(36), ['mean', 'rms', 'max'].map(u => u + ' ' + I.range(I.intensity(raw, {use: u})).toFixed(2)).join('   '));}
console.log('\nshared anchors', JSON.stringify(anchors({})));
