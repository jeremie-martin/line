// How much colour split a viewer actually sees, per split option: render each strong hit's frame at its peak, measure the
// colour fringe (max−min of RGB, per pixel, on a neutral paper), subtract the frame without split, average over hits.
// node generated/concept-lab/splitmeasure.mjs song=tomada opts=today,blow
import {chromium} from 'playwright';
const a = Object.fromEntries(process.argv.slice(2).map(s => s.split('=')));
const song = a.song ?? 'tomada', opts = (a.opts ?? 'today,blow').split(','), base = 'hit:parts,drv:held,shk:none,fls:none,night:off,music:redbars,scheme:graphite';
const b = await chromium.launch({args: ['--mute-audio']});
try {
  const out = {};
  for (const spl of ['none', ...opts]) {
    const p = await b.newPage({viewport: {width: 1080, height: 1920}});
    await p.goto(`http://127.0.0.1:8770/generated/concept-lab/?shot=1&song=${song}&c=paper&t=0&m=${base},spl:${spl}${a.extra ? ',' + a.extra : ''}`);
    await p.waitForFunction(() => window.__ready === true, null, {timeout: 60000});
    out[spl] = await p.evaluate(async () => {
      const data = await (await fetch(`./data/${new URLSearchParams(location.search).get('song')}.json`)).json();
      const ts = data.hits.filter(h => h.s >= 0.45 && h.t > 3 && h.t < data.duration - 4).map(h => h.t + 0.03);
      const c = document.createElement('canvas'); c.width = 270; c.height = 480; const g = c.getContext('2d', {willReadFrequently: true});
      const vals = [];
      for (const t of ts) {
        const img = new Image(); img.src = await window.__renderAt(t); await img.decode();
        g.drawImage(img, 0, 0, 270, 480); const d = g.getImageData(0, 0, 270, 480).data; let s = 0;
        for (let i = 0; i < d.length; i += 4) s += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
        vals.push(s / (270 * 480));
      }
      return vals;
    });
    await p.close();
  }
  const mean = v => v.reduce((x, y) => x + y, 0) / v.length;
  for (const o of opts) {const d = out[o].map((v, i) => v - out.none[i]); console.log(song, o.padEnd(8), 'visible fringe', mean(d).toFixed(3), 'over', d.length, 'hits');}
} finally {await b.close();}
