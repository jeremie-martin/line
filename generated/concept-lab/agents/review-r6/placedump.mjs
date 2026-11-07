// Copy of camdump.mjs, writing into this folder: rider screen y/H for tamed/high/dive (base 6.2, steady tide, = lab 's62'),
// plus the dive placement's internal vy / slow average / fast term.
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const songs = process.argv.slice(2).length ? process.argv.slice(2) : ['los', 'petrunko', 'lua', 'coma', 'tomada', 'batidao', 'burn'];
const b = await chromium.launch({args: ['--mute-audio']});
try {
  const p = await b.newPage(); await p.goto('http://127.0.0.1:8770/generated/concept-lab/camcheck.html'); await p.waitForFunction(() => window.ready);
  for (const song of songs) {
    const out = await p.evaluate(async song => {
      const C = await import('./cam.js'); const data = await (await fetch(`./data/${song}.json`)).json();
      const native = await new Promise(r => {const w = new Worker('/generated/motion-gallery-renderer/worker.js', {type: 'module'}); w.onmessage = ({data}) => r(data); w.postMessage({request: 1, track: data.track, trace: data.trace});});
      const cen = data.trace.frames.map(f => {let x = 0, y = 0; for (let i = 0; i < f.length; i += 2) {x += f[i]; y += f[i + 1];} return {x: 2 * x / f.length, y: 2 * y / f.length};});
      const R = C.rideSignals(cen, native.contacts, data.hits, data.phases, data.duration);
      const res = {n: R.n, vy: R.vel.map(v => +v.y.toFixed(1)), air: R.air.map(a => a ? 1 : 0)};
      for (const pl of ['tamed', 'high', 'dive']) {const c = C.buildPlaced(R, {base: 6.2, place: pl}); res[pl] = c.map((q, f) => +((q.ay + (R.R[f].y - q.y) * q.z) / 1920).toFixed(4));}
      return res;
    }, song);
    writeFileSync(new URL(`pos-${song}.json`, import.meta.url), JSON.stringify(out));
    console.log('wrote', song);
  }
} finally {await b.close();}
