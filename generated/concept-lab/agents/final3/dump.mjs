import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const out = process.argv[2];
const b = await chromium.launch({args: ['--mute-audio']});
try {
  const p = await b.newPage(); await p.goto('http://127.0.0.1:8770/generated/concept-lab/camcheck.html'); await p.waitForFunction(() => window.ready);
  const res = {};
  for (const song of ['petrunko','lua','los','batidao','burn','coma']) {
    res[song] = await p.evaluate(async song => {
      const C = await import('./cam.js'), N = await import('./dist/native.js'); const data = await (await fetch(`./data/${song}.json`)).json();
      const native = await new Promise(r => {const w = new Worker('/generated/motion-gallery-renderer/worker.js', {type: 'module'}); w.onmessage = ({data}) => r(data); w.postMessage({request: 1, track: data.track, trace: data.trace});});
      const cen = data.trace.frames.map(f => {let x = 0, y = 0; for (let i = 0; i < f.length; i += 2) {x += f[i]; y += f[i + 1];} return {x: 2 * x / f.length, y: 2 * y / f.length};});
      const hits = data.hits.map(h => {const f0 = Math.round(h.t*40); let fc=null; for (let f=f0+1;f>=f0-6;f--){if(native.contacts[f]?.length) fc=f; else if(fc!==null)break;} return {...h, tc: fc===null?h.t:Math.min(h.t,fc/40), I: C.strength(h.s)};});
      const R = C.rideSignals(cen, native.contacts, hits, data.phases, data.duration), fol = N.follower(data.trace.frames);
      const mk = (z) => cen.map((_, f) => {const c = fol({w: 1080, h: 1920, z}, f); return {z, ax: 540, ay: 672, x: c.x, y: c.y};});
      const cams = {today: mk(5.4), official: mk(6.2), operator: C.buildCamera(R, {base: 6.2, compose: {mode: 'loose'}})};
      for (const pl of Object.keys(C.PLACEMENTS)) cams[pl] = C.buildPlaced(R, {base: 6.2, place: pl});
      for (const t of ['busyWide','busyClose','calmOut','arc']) cams['tamed_'+t] = C.buildPlaced(R, {base: 6.2, place: 'tamed', tide: t});
      const res = {duration: data.duration, n: cen.length, hits: hits.map(h => [+h.tc.toFixed(3), h.s, +h.I.toFixed(3), h.src ?? '']), phases: data.phases, sp: {fps: data.spectrum?.fps, bands: data.spectrum?.bands, T: data.spectrum?.frames?.length}, cx: cen.map(c=>+c.x.toFixed(1)), cy: cen.map(c=>+c.y.toFixed(1)), air: R.air.map(a=>a?1:0), cams: {}, meas: {}};
      for (const [k, c] of Object.entries(cams)) {res.cams[k] = {sx: c.map((q,f)=>+(q.ax+(R.R[f].x-q.x)*q.z).toFixed(1)), sy: c.map((q,f)=>+(q.ay+(R.R[f].y-q.y)*q.z).toFixed(1)), z: c.map(q=>+q.z.toFixed(4))};
        const m = C.measureCamera(R, c); delete m.list; res.meas[k] = m;}
      return res;
    }, song);
    console.log(song, res[song].duration, res[song].n, res[song].hits.length, JSON.stringify(res[song].sp));
  }
  writeFileSync(out, JSON.stringify(res));
} finally {await b.close();}
