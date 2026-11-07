// node shoot.mjs OUTDIR scheme1,scheme2 [song:t,...]  -> OUTDIR/<scheme>-<song>.png
import {chromium} from 'playwright';
import {writeFileSync, mkdirSync} from 'node:fs';
const [out, list, mo = 'lua:36.5,los:45,petrunko:28', extra = ''] = process.argv.slice(2); mkdirSync(out, {recursive: true});
const b = await chromium.launch({args: ['--mute-audio']});
try {
  const p = await b.newPage({viewport: {width: 1080, height: 1920}});
  for (const m of mo.split(',')) {
    const [song, t] = m.split(':');
    for (const s of list.split(',')) {
      await p.goto(`http://127.0.0.1:8770/generated/concept-lab/agents/palettes-r7/mock/?shot=1&song=${song}&c=swatch&t=${t}&m=scheme:${s}${extra}`);
      await p.waitForFunction(() => window.__ready === true, null, {timeout: 90000});
      const url = await p.evaluate(t => window.__renderAt(t), +t);
      writeFileSync(`${out}/${s}-${song}.png`, Buffer.from(url.split(',')[1], 'base64'));
    }
  }
} finally {await b.close();}
