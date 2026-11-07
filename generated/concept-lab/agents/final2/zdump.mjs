// Reviewer: per-frame zoom + cuts per director, written to argv[2] as JSON. node zdump.mjs OUT songs...
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const [out, ...songs] = process.argv.slice(2);
const b = await chromium.launch({args: ['--mute-audio']});
try {
  const p = await b.newPage(); await p.goto('http://127.0.0.1:8770/generated/concept-lab/camcheck.html'); await p.waitForFunction(() => window.ready);
  const res = {};
  for (const song of songs) res[song] = await p.evaluate(async song => {
    const C = await import('./cam.js'); const data = await (await fetch(`./data/${song}.json`)).json();
    const native = await new Promise(r => {const w = new Worker('/generated/motion-gallery-renderer/worker.js', {type: 'module'}); w.onmessage = ({data}) => r(data); w.postMessage({request: 1, track: data.track, trace: data.trace});});
    const cen = data.trace.frames.map(f => {let x = 0, y = 0; for (let i = 0; i < f.length; i += 2) {x += f[i]; y += f[i + 1];} return {x: 2 * x / f.length, y: 2 * y / f.length};});
    const R = C.rideSignals(cen, native.contacts, data.hits, data.phases, data.duration);
    const r = {fps: 40, sect: R.sect.map(s => +s.t0.toFixed(2))};
    for (const d of ['director', 'flight', 'build', 'lookback', 'tripod', 'breathe']) {
      const cam = C.buildCamera(R, {base: 6.2, director: d});
      r[d] = {z: cam.map(c => +c.z.toFixed(3)), cuts: cam.cuts.map(c => ({t: +(c.t ?? c.f / 40).toFixed(2), shot: !!c.shot, dlz: c.dlz}))};
    }
    return r;
  }, song);
  writeFileSync(out, JSON.stringify(res));
} finally {await b.close();}
