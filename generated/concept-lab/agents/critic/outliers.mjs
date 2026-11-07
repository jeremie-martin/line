import {chromium} from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://127.0.0.1:8770/generated/concept-lab/?shot=1&song=los&c=ride&t=1');
for (const song of ['petrunko', 'lua', 'los']) {
  const r = await p.evaluate(async song => {
    const d = await (await fetch(`/generated/concept-lab/data/${song}.json`)).json();
    const w = new Worker('/generated/motion-gallery-renderer/worker.js', {type: 'module'});
    const n = await new Promise(res => {w.onmessage = e => res(e.data); w.postMessage({request: 1, track: d.track, trace: d.trace});});
    const C = n.contacts, out = [];
    for (const h of d.hits) {const f0 = Math.round(h.t * 40); const row = []; for (let f = f0 - 7; f <= f0 + 3; f++) row.push(C[f]?.length ? '#' : '.');
      if (C[f0 - 2]?.length || !C[f0 - 1]?.length && !C[f0]?.length) out.push(h.t + ' ' + h.s + ' ' + h.src + ' ' + row.join(''));}
    // how frames align: compare native frame centre with trace centre
    const tf = d.trace.frames[100], nf = n.frames[100];
    return {out, trace100: tf.slice(0, 4), native100: nf.points.slice(0, 2).map(q => [q.pos.x, q.pos.y]), nFrames: n.frames.length, tFrames: d.trace.frames.length, nContacts: C.length};
  }, song);
  console.log(song, JSON.stringify(r, null, 0));
}
await b.close();
