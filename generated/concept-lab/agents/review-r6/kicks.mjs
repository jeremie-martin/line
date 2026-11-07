// Same-direction upper bound: how often does the Held kick sum alone exceed 36 (Held's cap), so that the 'recoil'/'big' bundles
// (cap 56) show a bigger kick than Held even with no recoil term? Also the recoil lobes for one e=1 hit.
import * as C from '../../cam.js';
import {readFileSync} from 'node:fs';
const excess = e => Math.pow(e, 2.2), held = (age, w) => {const hold = (1 + 2 * w) / 60, L = 0.1 + 0.1 * w; return age < 0 ? 0 : age < hold ? 1 : Math.pow(Math.max(0, 1 - (age - hold) / L), 2);};
for (const s of ['petrunko', 'lua', 'los', 'coma', 'tomada', 'batidao', 'burn']) {
  const hs = JSON.parse(readFileSync(new URL(`../../data/${s}.json`, import.meta.url))).hits.map(h => ({t: h.t, e: C.strength(h.s)}));
  let over = 0, n = 0, mx = 0, ex = 0;
  for (let t = 0; t < 61; t += 1 / 60) {n++; let k = 0; for (const h of hs) {const age = t - h.t; if (age >= 0 && age <= 0.6) {const w = excess(h.e); k += (10 + 26 * w) * held(age, w);}}
    if (k > 36) {over++; ex = Math.max(ex, Math.min(k, 56) - 36);} mx = Math.max(mx, k);}
  console.log(s, `frames where same-direction kick sum > 36: ${over}/${n}; max sum ${mx.toFixed(1)}; max extra vs Held under cap 56: ${ex.toFixed(1)} px`);
}
const w = 1; let row = []; for (let a = 0; a <= 0.6; a += 0.025) row.push(`${a.toFixed(3)}:${(30 * w * Math.exp(-a / 0.13) * Math.sin(2 * Math.PI * 5 * a)).toFixed(1)}`); console.log('recoil e=1 px:', row.join(' '));
