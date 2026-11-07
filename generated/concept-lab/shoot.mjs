// Capture concept frames: node generated/concept-lab/shoot.mjs song=petrunko t=10.8 c=today,ride out=DIR [m=...]
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const a = Object.fromEntries(process.argv.slice(2).map(s => s.split('=')));
const out = a.out ?? 'generated/concept-lab/shots'; mkdirSync(out, {recursive: true});
const concepts = (a.c ?? 'today').split(','), times = (a.t ?? '10.8').split(',');
const b = await chromium.launch({args: ['--mute-audio']});
const errors = [];
try {
  const p = await b.newPage({viewport: {width: 1080, height: 1920}});
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  for (const c of concepts) for (const t of times) {
    const url = `http://127.0.0.1:8770/generated/concept-lab/?shot=1&song=${a.song ?? 'petrunko'}&c=${c}&t=${t}${a.m ? '&m=' + a.m : ''}`;
    await p.goto(url); await p.waitForFunction(() => window.__ready === true, null, {timeout: 60000});
    await p.waitForTimeout(150);
    const file = `${out}/${a.song ?? 'petrunko'}-${c}-${t}${a.m ? '-' + a.m.replace(/[:,]/g, '_') : ''}.png`;
    await p.locator('#stage').screenshot({path: file}); console.log(file);
  }
} finally {await b.close();}
if (errors.length) {console.error(errors.join('\n')); process.exit(1);}
