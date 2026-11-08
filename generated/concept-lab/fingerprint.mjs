// Rendering fingerprint: sha1 of about 130 lab frames across the looks, every option, the themes and the old rides. A refactor
// must leave the picture byte-identical: run it before and after, then diff the two files.
//   /usr/bin/node generated/concept-lab/fingerprint.mjs OUT.txt [port]   (needs the lab served on 127.0.0.1:8770, or port)
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const THEMES = ['paper', 'hokusai', 'dune', 'prussian', 'celadon', 'aubergine', 'wisteria', 'black', 'plum', 'oldrose', 'ultramarine', 'aconite'];
export const CASES = [
  ['tomada', 'swatch', '', [0, 0.5, 36.6, 38.27, 40.75]],
  ['tomada', 'swatch', 'top:title', [38.26, 38.3]], ['tomada', 'swatch', 'top:sun,scheme:dune', [38.27]],
  ['lua', 'swatch', 'scheme:wOldRose,line:ink', [36.5]], ['lua', 'swatch', 'scheme:w2Seashell', [36.5]], ['lua', 'swatch', 'scheme:kraft~2', [36.5]],
  ['petrunko', 'swatch', 'scheme:dune,drop:switch,top:sun', [25]], ['lua', 'swatch', 'band:iris', [36.5]],
  ['lua', 'swatch', 'top:sun,sunRider:0.05,sunY:0.15', [36.5]],
  ...THEMES.map(c => ['circus', c, '', [0.5, 20, 40, 45.2, 52]]),
  ...['petrunko', 'lua', 'los', 'batidao', 'burn', 'coma', 'tomada', 'circus'].map(s => [s, 'swatch', '', [3, 15, 30]]),
  ['tomada', 'plain', '', [0, 5, 38.27]], ['los', 'plain', '', [28.9]], ['circus', 'plain', '', [20]],
  ['lua', 'swatch', 'bandHeight:low', [36.5]], ['lua', 'swatch', 'bandHeight:mid', [36.5]], ['lua', 'swatch', 'accent:loud', [36.5]],
  ['los', 'swatch', 'zoom:quiet', [28.9]], ['los', 'swatch', 'line:rail', [28.9]], ['petrunko', 'swatch', 'drop:night', [25, 34.7]],
  ['lua', 'swatch', 'band:fork', [36.5]], ['tomada', 'swatch', 'hits:none', [38.27]], ['circus', 'swatch', 'top:sun,sunRider:0.025,sunY:0.16', [18, 43]],
  ['los', 'swatch', '', [10, 28.9], 'old'],
];
if (import.meta.url === `file://${process.argv[1]}`) {
  const [out, port = '8770'] = process.argv.slice(2), b = await chromium.launch({args: ['--mute-audio']}), lines = [];
  for (const [song, c, m, ts, rides] of CASES) {
    const p = await b.newPage({viewport: {width: 1080, height: 1920}});
    await p.goto(`http://127.0.0.1:${port}/generated/concept-lab/?shot=1&song=${song}&c=${c}&t=0${m ? '&m=' + m : ''}${rides ? '&rides=' + rides : ''}`);
    await p.waitForFunction(() => window.__ready === true || !!window.__loadError, null, {timeout: 90000});
    const state = await p.evaluate(() => ({error: window.__loadError, preset: window.__labState().preset}));
    if (state.error || state.preset !== c) throw new Error(`${song} ${c}: ${state.error ?? 'no such look'}`);
    for (const t of ts) lines.push(`${song}${rides ? '-' + rides : ''} ${c} ${m || '-'} ${t} ${createHash('sha1').update(await p.evaluate(t => window.__renderAt(t), t)).digest('hex').slice(0, 12)}`);
    await p.close();
  }
  await b.close(); writeFileSync(out, lines.join('\n') + '\n'); console.log(lines.length, 'frames');
}
