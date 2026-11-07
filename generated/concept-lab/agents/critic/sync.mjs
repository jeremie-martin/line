// Critic: check hit times vs native contact frames, and hit-position fallback rate.
import {chromium} from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://127.0.0.1:8770/generated/concept-lab/?shot=1&song=los&c=ride&t=1');
for (const song of ['petrunko', 'lua', 'los']) {
  const r = await p.evaluate(async song => {
    const d = await (await fetch(`/generated/concept-lab/data/${song}.json`)).json();
    const w = new Worker('/generated/motion-gallery-renderer/worker.js', {type: 'module'});
    const n = await new Promise(res => {w.onmessage = e => res(e.data); w.postMessage({request: 1, track: d.track, trace: d.trace});});
    const C = n.contacts, out = {offsets: {}, none: 0, fallback: 0, lines: d.track.lines.length, touched: 0, airFrac: 0, contactRuns: 0};
    const touched = new Set(); C.forEach(c => c.forEach(x => touched.add(x))); out.touched = touched.size;
    out.airFrac = C.filter(c => !c?.length).length / C.length;
    // onset frames: contact after >=3 air frames
    const onsets = []; let airRun = 99;
    C.forEach((c, f) => {if (c?.length) {if (airRun >= 3) onsets.push(f); airRun = 0;} else airRun++;});
    out.onsets = onsets.length; out.hits = d.hits.length;
    for (const h of d.hits) {
      const f0 = Math.round(h.t * 40);
      let best = null; for (const o of onsets) if (best === null || Math.abs(o - f0) < Math.abs(best - f0)) best = o;
      const off = best - f0; out.offsets[off] = (out.offsets[off] ?? 0) + 1;
      let found = false; for (let f = f0 - 1; f <= f0 + 4; f++) if (C[f]?.length) {found = true; break;}
      if (!found) out.fallback++;
    }
    // contact frames not near any hit (unscored touches)
    const hf = d.hits.map(h => Math.round(h.t * 40));
    out.unscoredOnsets = onsets.filter(o => !hf.some(f => Math.abs(f - o) <= 2)).length;
    return out;
  }, song);
  console.log(song, JSON.stringify(r));
}
await b.close();
