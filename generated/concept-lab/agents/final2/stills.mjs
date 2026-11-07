// Reviewer stills: node stills.mjs out=DIR song=lua t=27,30 cs=ride,graphite [m=...] [scale=30%]
// Writes one horizontal contact sheet per (song, t): presets side by side.
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
const a = Object.fromEntries(process.argv.slice(2).map(s => s.split('=')));
const out = a.out ?? 'generated/concept-lab/agents/final2/shots'; mkdirSync(out + '/raw', {recursive: true});
const ts = a.t.split(',').map(Number), cs = a.cs.split(',');
const b = await chromium.launch({args: ['--mute-audio']});
try {
  const files = Object.fromEntries(ts.map(t => [t, []]));
  for (const c of cs) {
    const [preset, m] = c.split('+');
    const p = await b.newPage({viewport: {width: 1080, height: 1920}});
    await p.goto(`http://127.0.0.1:8770/generated/concept-lab/?shot=1&song=${a.song}&c=${preset}&t=0${m ? '&m=' + m : a.m ? '&m=' + a.m : ''}`);
    await p.waitForFunction(() => window.__ready === true, null, {timeout: 90000});
    for (const t of ts) {
      const url = await p.evaluate(t => window.__renderAt(t), t);
      const f = `${out}/raw/${a.song}-${c.replace(/[:,+]/g, '_')}-${t}.png`; writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); files[t].push(f);
    }
    await p.close();
  }
  for (const t of ts) {
    const f = `${out}/${a.tag ?? 'sheet'}-${a.song}-${t}.png`;
    execFileSync('magick', [...files[t], '-resize', a.scale ?? '25%', '-bordercolor', '#888', '-border', '2', '+append', f]);
    console.log(f);
  }
} finally {await b.close();}
