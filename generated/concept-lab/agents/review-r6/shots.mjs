// node shots.mjs song c m t1,t2 [base]  -> PNGs in ./shots ; base defaults to the live lab
import {chromium} from 'playwright';
import {mkdirSync, writeFileSync} from 'node:fs';
const [song, c, m, ts, base = ''] = process.argv.slice(2);
const dir = new URL('shots/', import.meta.url); mkdirSync(dir, {recursive: true});
const b = await chromium.launch({args: ['--mute-audio']}); const errors = [];
try {
  const p = await b.newPage({viewport: {width: 1080, height: 1920}});
  p.on('pageerror', e => errors.push(e.message)); p.on('console', x => x.type() === 'error' && errors.push(x.text()));
  await p.goto(`http://127.0.0.1:8770/generated/concept-lab/${base}?shot=1&song=${song}&c=${c}&t=0${m ? '&m=' + m : ''}`);
  await p.waitForFunction(() => window.__ready === true, null, {timeout: 90000});
  for (const t of ts.split(',')) {
    const url = await p.evaluate(t => window.__renderAt(+t), t);
    const f = `${song}-${c}-${(m || 'none').replace(/[:,]/g, '_')}-${t}${base ? '-' + base.replace(/\W/g, '') : ''}.png`;
    writeFileSync(new URL(f, dir), Buffer.from(url.split(',')[1], 'base64')); console.log(f);
  }
} finally {await b.close();}
if (errors.length) console.error('ERRORS:', errors.join('\n'));
