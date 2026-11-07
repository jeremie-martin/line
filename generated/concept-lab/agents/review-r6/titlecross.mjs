// For each time step: does any drawn line pixel (non-paper) fall in the title box? Rendered with top:none so only lines count.
import {chromium} from 'playwright';
const [song, step = '0.25', from = '0', to = '999'] = process.argv.slice(2);
const b = await chromium.launch({args: ['--mute-audio']});
try {
  const p = await b.newPage({viewport: {width: 1080, height: 1920}});
  await p.goto(`http://127.0.0.1:8770/generated/concept-lab/?shot=1&song=${song}&c=lagoon&t=0&m=size:s62,place:tamed,top:none,ends:none,hit:none,music:none,bg:white`);
  await p.waitForFunction(() => window.__ready === true, null, {timeout: 90000});
  const res = await p.evaluate(async ([step, from, to]) => {
    const cv = document.querySelector('canvas'), g = cv.getContext('2d'), out = [];
    for (let t = from; t < Math.min(to, window.__duration); t += step) {
      await window.__renderAt(t);
      const d = g.getImageData(0.07 * 1080, 0.04 * 1920, 0.62 * 1080, 200).data; let n = 0;
      const bg = [d[0], d[1], d[2]]; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 60) n++;
      out.push([+t.toFixed(2), n]);
    }
    return out;
  }, [+step, +from, +to]);
  const hit = res.filter(r => r[1] > 50);
  console.log(song, `${hit.length}/${res.length} sampled frames have line pixels in the title box:`, hit.map(r => r[0]).join(' '));
} finally {await b.close();}
