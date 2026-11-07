// A 60 fps frame strip around a moment: node strip.mjs song=los t0=48.15 n=12 step=1 c=ride m=... crop=x,y,w,h out=FILE
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync, rmSync} from 'node:fs';
const a = Object.fromEntries(process.argv.slice(2).map(s => s.split('=')));
const tmp = `/tmp/claude-1000/strip-${process.pid}`; mkdirSync(tmp, {recursive: true});
const b = await chromium.launch({args: ['--mute-audio']});
try {
  const p = await b.newPage({viewport: {width: 1080, height: 1920}});
  await p.goto(`http://127.0.0.1:8770/generated/concept-lab/?shot=1&song=${a.song ?? 'los'}&c=${a.c ?? 'ride'}&t=0${a.m ? '&m=' + a.m : ''}${a.rides ? '&rides=' + a.rides : ''}`);
  await p.waitForFunction(() => window.__ready === true, null, {timeout: 60000});
  const n = +(a.n ?? 12), step = +(a.step ?? 1), files = [];
  for (let i = 0; i < n; i++) {
    const url = await p.evaluate(t => window.__renderAt(t), +a.t0 + i * step / 60);
    const f = `${tmp}/${String(i).padStart(3, '0')}.png`; writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); files.push(f);
  }
  const [x, y, w, h] = (a.crop ?? '0,0,1080,1920').split(',');
  execFileSync('magick', [...files, '-crop', `${w}x${h}+${x}+${y}`, '+repage', '-resize', a.scale ?? '40%', '+append', a.out]);
  console.log(a.out);
} finally {await b.close(); rmSync(tmp, {recursive: true, force: true});}
