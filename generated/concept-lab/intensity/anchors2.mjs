import fs from 'node:fs';
import * as I from '../intensity.js';
const d = JSON.parse(fs.readFileSync('analysis/signals.json')), pool = {speed: [], power: []}, names = Object.keys(d);
const raws = Object.values(d).map(r => I.rawSignals({speed: r.speed, hits: r.hits.map(h => ({t: h[0], s: h[1]})), duration: r.n / 40}));
for (const raw of raws) {pool.speed.push(...I.SHAPES.steady.fn(I.gaussian(raw.speed, .3), I.DEFAULTS)); pool.power.push(...I.SHAPES.steady.fn(I.gaussian(raw.power, 1), I.DEFAULTS));}
const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)], worst = a => Math.max(...a), least = a => Math.min(...a);
for (const [lo, hi] of [[.05, .95], [.05, .98], [.05, .995], [.1, .995], [.05, 1]]) {
  const scale = {speed: [I.quantile(pool.speed, lo), I.quantile(pool.speed, hi)], power: [I.quantile(pool.power, lo), I.quantile(pool.power, hi)]};
  const ys = raws.map(r => I.intensity(r, {scale}));
  console.log(`p${lo * 100}–p${hi * 100}`.padEnd(11), 'anchors', scale.speed.map(v => v.toFixed(0)).join('–'), scale.power.map(v => v.toFixed(2)).join('–'), ' >.9 max', worst(ys.map(y => I.share(y, v => v > .9))).toFixed(2), ' med', med(ys.map(y => I.share(y, v => v > .9))).toFixed(2), ' <.1 max', worst(ys.map(y => I.share(y, v => v < .1))).toFixed(2), ' range med/min', med(ys.map(I.range)).toFixed(2), least(ys.map(I.range)).toFixed(2), ' plateau p50 of p95', med(ys.map(y => I.quantile(y, .95))).toFixed(2));
}
