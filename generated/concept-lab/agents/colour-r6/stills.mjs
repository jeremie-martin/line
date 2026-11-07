// Stills per scheme from the private mock copy (mock/ = lab.js snapshot + ./schemes.js candidates).
// /usr/bin/node stills.mjs schemes=graphite,riso song=petrunko t=10.8 m=music:redbars out=stills
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const a = Object.fromEntries(process.argv.slice(2).map(s => s.split('=')));
const out = a.out ?? 'stills'; mkdirSync(out, {recursive: true});
const b = await chromium.launch({args: ['--mute-audio']}), errors = [];
try {
  const p = await b.newPage({viewport: {width: 1080, height: 1920}});
  p.on('pageerror', e => errors.push(e.message));
  for (const s of a.schemes.split(',')) for (const t of (a.t ?? '10.8').split(',')) {
    const m = `scheme:${s}` + (a.m ? ',' + a.m : '');
    await p.goto(`http://127.0.0.1:8770/generated/concept-lab/agents/colour-r6/mock/?shot=1&song=${a.song ?? 'petrunko'}&c=${a.c ?? 'ride'}&t=${t}&m=${m}`);
    await p.waitForFunction(() => window.__ready === true, null, {timeout: 60000}); await p.waitForTimeout(150);
    const f = `${out}/${s}-${a.song ?? 'petrunko'}-${t}.png`; await p.locator('#stage').screenshot({path: f}); console.log(f);
  }
} finally {await b.close();}
if (errors.length) {console.error(errors.join('\n')); process.exit(1);}
