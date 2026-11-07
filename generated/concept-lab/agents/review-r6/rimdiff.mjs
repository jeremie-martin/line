// Where does titleCut change pixels OUTSIDE the title box (i.e. the rim is not invisible)? Diff title vs titleCut renders.
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const [song, extra = '', step = '1'] = process.argv.slice(2);
const b = await chromium.launch({args: ['--mute-audio']});
const mk = async top => {const p = await b.newPage({viewport: {width: 1080, height: 1920}});
  await p.goto(`http://127.0.0.1:8770/generated/concept-lab/?shot=1&song=${song}&c=lagoon&t=0&m=size:s62,place:tamed,ends:none,hit:strong,top:${top}${extra}`);
  await p.waitForFunction(() => window.__ready === true, null, {timeout: 90000}); return p;};
try {
  const [A, B] = [await mk('title'), await mk('titleCut')]; const dur = await A.evaluate(() => window.__duration); const rows = [];
  let worst = null;
  for (let t = 1; t < dur; t += +step) {
    const px = await Promise.all([A, B].map(p => p.evaluate(async t => {await window.__renderAt(t); const g = document.querySelector('canvas').getContext('2d'); return Array.from(g.getImageData(0, 300, 1080, 1620).data);}, t)));
    let n = 0; for (let i = 0; i < px[0].length; i += 4) if (Math.abs(px[0][i] - px[1][i]) + Math.abs(px[0][i + 1] - px[1][i + 1]) + Math.abs(px[0][i + 2] - px[1][i + 2]) > 40) n++;
    rows.push([t, n]); if (!worst || n > worst[1]) worst = [t, n];
  }
  console.log(song, extra, 'frames with >200 changed px below the title:', rows.filter(r => r[1] > 200).length, '/', rows.length, 'worst', worst);
  const f = async (p, n) => writeFileSync(new URL(`shots/rim-${song}-${n}-${worst[0]}.png`, import.meta.url), Buffer.from((await p.evaluate(t => window.__renderAt(t), worst[0])).split(',')[1], 'base64'));
  await f(A, 'title'); await f(B, 'titleCut');
} finally {await b.close();}
