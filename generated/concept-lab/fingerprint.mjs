// Rendering fingerprint: sha1 of lab frames across production: every collection theme, drop pairings, every option value a look
// can take, the plain look and the old rides. A refactor must leave the picture byte-identical: run it before and after, then diff
// the two files. A ride set (rides.js) draws every case that names none from that set, labelled as usual, so the two files still
// diff line by line.
//   /usr/bin/node generated/concept-lab/fingerprint.mjs OUT.txt [port] [rides]   (needs the lab served on 127.0.0.1:8770, or port)
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {COLLECTION} from '../../scripts/video/collection.js';
// a pairing as choose.js builds it: the light theme's look under the pair's scheme, switching at the drop
const pair = (light, dark) => `scheme:${COLLECTION[light].id}+${COLLECTION[dark]?.id ?? `drop-${dark}`},drop:switch`;
export const CASES = [
  ...Object.keys(COLLECTION).map(c => ['circus', c, '', [0.5, 18, 40, 44.65, 52]]),
  ['circus', 'silverRust', pair('silverRust', 'jungleMoon'), [18, 44.6]], ['circus', 'paperPrint', pair('paperPrint', 'blackAndWhite'), [44.6]],
  ['circus', 'paper', pair('paper', 'blackIris'), [44.6]], ['petrunko', 'hokusai', pair('hokusai', 'cobaltChartreuse'), [25, 34.7]],
  ...['petrunko', 'lua', 'los', 'batidao', 'burn', 'coma', 'tomada', 'circus'].map(s => [s, 'swatch', '', [3, 15, 30]]),
  ['tomada', 'swatch', '', [0, 0.5, 36.6, 38.27, 40.75]], ['tomada', 'swatch', 'top:title', [38.26, 38.3]], ['circus', 'swatch', 'top:sun', [18, 43]],
  ['tomada', 'plain', '', [0, 5, 38.27]], ['los', 'plain', '', [28.9]], ['circus', 'plain', '', [20]],
  ['lua', 'swatch', 'band:fork', [36.5]], ['lua', 'swatch', 'band:iris', [36.5]], ['lua', 'swatch', 'band:iris,irisWeight:bold', [36.5]],
  ['lua', 'swatch', 'band:none', [36.5]], ['lua', 'swatch', 'accent:loud', [36.5]], ['lua', 'swatch', 'paper:plain', [36.5]],
  ['los', 'swatch', 'zoom:quiet', [12, 28.9, 40]], ['los', 'swatch', 'line:rail', [12, 28.9, 40]], ['los', 'swatch', 'line:ink', [12, 28.9]],
  ['los', 'swatch', 'ends:none', [0.5]], ['tomada', 'swatch', 'hits:none', [38.27]],
  ['los', 'swatch', '', [10, 28.9], 'old'],
];
if (import.meta.url === `file://${process.argv[1]}`) {
  const [out, port = '8770', all = ''] = process.argv.slice(2), b = await chromium.launch({args: ['--mute-audio']}), lines = [];
  for (const [song, c, m, ts, rides] of CASES) {
    const p = await b.newPage({viewport: {width: 1080, height: 1920}}), set = rides ?? all;
    await p.goto(`http://127.0.0.1:${port}/generated/concept-lab/?shot=1&song=${song}&c=${c}&t=0${m ? '&m=' + encodeURIComponent(m) : ''}${set ? '&rides=' + set : ''}`);
    await p.waitForFunction(() => window.__ready === true || !!window.__loadError, null, {timeout: 90000});
    const state = await p.evaluate(() => ({error: window.__loadError, preset: window.__labState().preset}));
    if (state.error || state.preset !== c) throw new Error(`${song} ${c}: ${state.error ?? 'no such look'}`);
    for (const t of ts) lines.push(`${song}${rides ? '-' + rides : ''} ${c} ${m || '-'} ${t} ${createHash('sha1').update(await p.evaluate(t => window.__renderAt(t), t)).digest('hex').slice(0, 12)}`);
    await p.close();
  }
  await b.close(); writeFileSync(out, lines.join('\n') + '\n'); console.log(lines.length, 'frames');
}
