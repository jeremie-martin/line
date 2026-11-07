// e = C.strength(h.s) per song: how often punch/recoil reach which fraction of full (e^4.4).
import * as C from '../../cam.js';
import {readFileSync} from 'node:fs';
const dir = new URL('../../data/', import.meta.url);
for (const s of ['petrunko', 'lua', 'los', 'coma', 'tomada', 'batidao', 'burn']) {
  const d = JSON.parse(readFileSync(new URL(s + '.json', dir)));
  const e = d.hits.map(h => ({t: h.t, e: C.strength(h.s)})).sort((a, b) => b.e - a.e);
  const f = x => Math.pow(x, 4.4);
  console.log(s, 'n', e.length, 'maxE', e[0].e.toFixed(3), '@', e[0].t.toFixed(2), 'maxBig', f(e[0].e).toFixed(3), 'punch%', (4.5 * f(e[0].e)).toFixed(2),
    '#e>=0.7', e.filter(x => x.e >= 0.7).length, '#big>=0.5', e.filter(x => f(x.e) >= 0.5).length, 'top3', e.slice(0, 3).map(x => `${x.t.toFixed(1)}:${x.e.toFixed(2)}`).join(' '));
}
