// node shots.mjs OUTDIR  JSON-jobs: [{song,c,m,ts:[..],tag}]; writes OUTDIR/<tag>_<song>_<c>_<i>.png
import {chromium} from 'playwright';
import {writeFileSync, readFileSync} from 'node:fs';
const [out, jobsFile] = process.argv.slice(2), jobs = JSON.parse(readFileSync(jobsFile));
const b = await chromium.launch({args: ['--mute-audio']});
const errs = [];
await Promise.all(Array.from({length: 4}, async (_, w) => {
  for (let i = w; i < jobs.length; i += 4) {
    const j = jobs[i], p = await b.newPage({viewport: {width: 1080, height: 1920}});
    p.on('pageerror', e => errs.push(`${j.song} ${j.c}: ${e.message}`));
    await p.goto(`http://127.0.0.1:8770/generated/concept-lab/?shot=1&song=${j.song}&c=${j.c}&t=0${j.m ? '&m=' + j.m : ''}`);
    await p.waitForFunction(() => window.__ready === true, null, {timeout: 90000});
    for (let k = 0; k < j.ts.length; k++) {
      const url = await p.evaluate(t => window.__renderAt(t), j.ts[k]);
      writeFileSync(`${out}/${j.tag}_${j.song}_${j.c}_${String(k).padStart(3, '0')}.png`, Buffer.from(url.split(',')[1], 'base64'));
    }
    await p.close();
  }
}));
await b.close();
console.log('errors', errs);
