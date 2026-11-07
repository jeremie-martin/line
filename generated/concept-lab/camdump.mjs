// Dump per-frame rider screen position for several cameras: node generated/concept-lab/camdump.mjs song [tag] [data dir]
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const song = process.argv[2] ?? 'los', tag = process.argv[3] ?? '', dir = process.argv[4] ?? 'data';
const b = await chromium.launch({args: ['--mute-audio']});
try {
  const p = await b.newPage(); await p.goto('http://127.0.0.1:8770/generated/concept-lab/camcheck.html'); await p.waitForFunction(() => window.ready);
  const out = await p.evaluate(async ({song, dir}) => {
    const C = await import('./cam.js'), N = await import('./dist/native.js'); const data = await (await fetch(`./${dir}/${song}.json`)).json();
    const native = await new Promise(r => {const w = new Worker('/generated/motion-gallery-renderer/worker.js', {type: 'module'}); w.onmessage = ({data}) => r(data); w.postMessage({request: 1, track: data.track, trace: data.trace});});
    const cen = data.trace.frames.map(f => {let x = 0, y = 0; for (let i = 0; i < f.length; i += 2) {x += f[i]; y += f[i + 1];} return {x: 2 * x / f.length, y: 2 * y / f.length};});
    const R = C.rideSignals(cen, native.contacts, data.hits, data.phases, data.duration), fol = N.follower(data.trace.frames);
    const cams = {today: cen.map((_, f) => {const c = fol({w: 1080, h: 1920, z: 5.4}, f); return {z: 5.4, ax: 540, ay: 672, x: c.x, y: c.y};}), operator: C.buildCamera(R, {base: 6.2, compose: {mode: 'loose'}})};
    for (const pl of Object.keys(C.PLACEMENTS)) cams[pl] = C.buildPlaced(R, {base: 6.2, place: pl});
    const res = {hits: data.hits.map(h => [h.t, h.s]), vel: R.vel.map(v => [Math.round(v.x), Math.round(v.y)]), air: R.air.map(a => a ? 1 : 0), z: cams.tamed.map(c => +c.z.toFixed(3))};
    for (const [k, c] of Object.entries(cams)) res[k] = c.map((q, f) => [+(q.ax + (R.R[f].x - q.x) * q.z).toFixed(1), +(q.ay + (R.R[f].y - q.y) * q.z).toFixed(1)]);
    return res;
  }, {song, dir});
  writeFileSync(`generated/concept-lab/analysis/pos-${song}${tag}.json`, JSON.stringify(out));
} finally {await b.close();}
