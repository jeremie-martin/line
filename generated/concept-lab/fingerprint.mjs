// Rendering fingerprint: sha1 of about 150 frames across looks, defaults, old options, palettes, themes and old rides.
// A refactor must leave the picture byte-identical: run it before and after, then diff the two files.
//   /usr/bin/node generated/concept-lab/fingerprint.mjs before.txt   (needs the lab served on 127.0.0.1:8770)
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const THEMES = ['t-paper', 't-hokusai', 't-dune', 't-prussian', 't-celadon', 't-aubergine', 't-wisteria', 't-black', 't-plum', 't-oldrose', 't-ultramarine', 't-aconite'];
const CASES = [
  ['tomada', 'swatch', '', [0, 0.5, 36.6, 38.27, 40.75]],
  ['tomada', 'swatch', 'top:title', [38.26, 38.3]], ['tomada', 'swatch', 'top:sun,scheme:dune', [38.27]],
  ['petrunko', 'paper', '', [5, 22.45, 34.7]], ['petrunko', 'hokusai', '', [10, 34.7]], ['lua', 'lagoon', '', [8.6, 36.5]],
  ['los', 'black', '', [28.9, 50]], ['petrunko', 'dune', '', [34.7]], ['petrunko', 'plum', '', [34.7]], ['los', 'today', '', [30, 49.8]],
  ['tomada', 'swatch', 'hit:strong', [38.27]], ['tomada', 'swatch', 'hit:refined', [38.27]], ['tomada', 'swatch', 'hit:ghost', [38.4]],
  ['tomada', 'swatch', 'hit:heldGhost', [38.4]], ['tomada', 'swatch', 'hit:punch', [38.27]], ['tomada', 'swatch', 'hit:recoil', [38.27]],
  ['tomada', 'swatch', 'hit:big', [38.27]], ['tomada', 'swatch', 'hit:impact', [38.27]], ['tomada', 'swatch', 'hit:todayW', [38.27]], ['tomada', 'swatch', 'hit:shake', [38.27]],
  ['tomada', 'swatch', 'hit:parts,shk:today,spl:today,fls:today,drv:trauma,spw:ride', [38.27]],
  ['tomada', 'swatch', 'hit:parts,shk:blow,spl:blow,fls:bloom,drv:graded', [38.27]], ['tomada', 'swatch', 'spl:radial,shk:kick,fls:todayRare', [38.27]],
  ['tomada', 'swatch', 'resp:old,crv:e,amp:1', [38.27]], ['tomada', 'swatch', 'resp:old,crv:w,ampS:2,flg:80', [38.27]], ['tomada', 'swatch', 'resp:old,crv:mid,flg:s60', [38.27]],
  ['tomada', 'swatch', 'pulse:ride', [38.27]], ['tomada', 'swatch', 'pulse:none,top:title', [38.27]], ['tomada', 'swatch', 'rsp:soft30,rsh:lin16,rfl:r80', [38.27]],
  ['tomada', 'swatch', 'rsp:zero40,rfl:s55', [38.27]], ['tomada', 'swatch', 'rsp:ease40,rfl:rise55,rsh:lin20', [38.27]], ['tomada', 'swatch', 'tsp:0.4,tpl:1,top:title', [38.27]],
  ['lua', 'swatch', 'scheme:wOldRose,ink:ink', [36.5]], ['lua', 'swatch', 'scheme:w2Seashell', [36.5]], ['lua', 'swatch', 'scheme:kraft~2', [36.5]],
  ['petrunko', 'swatch', 'scheme:dune,night:switch,top:sun', [25]], ['los', 'swatch', 'place:tamed', [28.9]], ['los', 'swatch', 'grain:on', [28.9]],
  ['los', 'swatch', 'place:official,size:today', [28.9]], ['los', 'swatch', 'place:dive,tide:fit', [28.9]], ['los', 'swatch', 'place:followLow,tide:breath', [28.9]],
  ['los', 'swatch', 'place:loose,tide:quietI,drive:speed', [28.9]], ['los', 'swatch', 'ends:closing,bandIn:fade', [1, 55]], ['los', 'swatch', 'bandIn:quick', [1]],
  ['lua', 'swatch', 'music:iris', [36.5]], ['lua', 'swatch', 'music:bars3', [36.5]], ['lua', 'xray', '', [36.5]], ['lua', 'swatch', 'music:blocks,redBy:standing', [36.5]],
  ['lua', 'swatch', 'music:redblocks,redBy:level,bandY:high', [36.5]], ['lua', 'swatch', 'music:stems,bandY:mid', [36.5]], ['lua', 'swatch', 'top:vignette,bg:white', [36.5]],
  ['lua', 'swatch', 'top:titleCut', [36.5]], ['lua', 'swatch', 'top:sun,sunRider:0.05,sunY:0.15', [36.5]],
  ...THEMES.map(c => ['circus', c, '', [0.5, 20, 40, 45.2, 52]]),
  ...['petrunko', 'lua', 'los', 'batidao', 'burn', 'coma', 'tomada', 'circus'].map(s => ['%' + s, 'swatch', '', [3, 15, 30]]),
];
const out = process.argv[2], b = await chromium.launch({args: ['--mute-audio']}), lines = [];
for (let [song, c, m, ts] of CASES) {
  let extra = '';
  if (song.startsWith('%')) song = song.slice(1);
  const p = await b.newPage({viewport: {width: 1080, height: 1920}});
  await p.goto(`http://127.0.0.1:8770/generated/concept-lab/?shot=1&song=${song}&c=${c}&t=0${m ? '&m=' + m : ''}${extra}`);
  await p.waitForFunction(() => window.__ready === true, null, {timeout: 90000});
  for (const t of ts) lines.push(`${song} ${c} ${m || '-'} ${t} ${createHash('sha1').update(await p.evaluate(t => window.__renderAt(t), t)).digest('hex').slice(0, 12)}`);
  await p.close();
}
// old rides
{
  const p = await b.newPage({viewport: {width: 1080, height: 1920}});
  await p.goto(`http://127.0.0.1:8770/generated/concept-lab/?shot=1&song=los&c=swatch&t=0&rides=old`);
  await p.waitForFunction(() => window.__ready === true, null, {timeout: 90000});
  for (const t of [10, 28.9]) lines.push(`los-old swatch - ${t} ${createHash('sha1').update(await p.evaluate(t => window.__renderAt(t), t)).digest('hex').slice(0, 12)}`);
  await p.close();
}
await b.close(); writeFileSync(out, lines.join('\n') + '\n'); console.log(lines.length, 'frames');
