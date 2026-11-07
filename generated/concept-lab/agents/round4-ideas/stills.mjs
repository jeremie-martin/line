// node stills.mjs OUT song:t:mix:extra ...   (extra is raw query string, e.g. pal=hokusai)
import {chromium} from 'playwright';
const [out, ...jobs] = process.argv.slice(2);
const b = await chromium.launch({args: ['--mute-audio']});
const p = await b.newPage({viewport: {width: 1080, height: 1920}});
const errs = []; p.on('pageerror', e => errs.push(e.message));
for (const j of jobs) {
  const [name, song, t, m, extra] = j.split('|');
  await p.goto(`http://127.0.0.1:8770/generated/concept-lab/agents/round4-ideas/mock/?shot=1&song=${song}&c=ride&t=${t}&m=${m}${extra ? '&' + extra : ''}`);
  await p.waitForFunction(() => window.__ready === true, null, {timeout: 90000}); await p.waitForTimeout(120);
  await p.locator('#stage').screenshot({path: `${out}/${name}.png`});
}
await b.close(); if (errs.length) console.log([...new Set(errs)].join('\n'));
