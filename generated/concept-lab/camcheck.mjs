// Camera honesty and framing across songs. Usage: node generated/concept-lab/camcheck.mjs [songs...]
import {chromium} from 'playwright';
const songs = process.argv.slice(2).length ? process.argv.slice(2) : ['petrunko', 'lua', 'los', 'batidao', 'burn', 'coma'];
const Z0 = 5.4;
const configs = process.env.TIDES ? ['steady', 'busyWide', 'busyClose', 'calmOut', 'arc'].map(t => ({name: t, base: 6.2, place: 'tamed', tide: t})) : [{name: 'today', kind: 'today'}, ...['pinnedLeft', 'pinnedRight', 'tamed', 'calm'].map(p => ({name: p, base: 6.2, place: p}))];
const b = await chromium.launch({args: ['--mute-audio']});
try {
  const p = await b.newPage(); p.on('pageerror', e => console.error('pageerror', e.message));
  await p.goto('http://127.0.0.1:8770/generated/concept-lab/camcheck.html'); await p.waitForFunction(() => window.ready);
  const rows = await p.evaluate(([s, c]) => window.run(s, c), [songs, configs]);
  console.log('song      camera       events/min worst  x p5/50/95        y p5/50/95        xTravel yTravel  zoom/min z-range   maxrate');
  for (const r of rows) console.log(r.song.padEnd(9), r.cfg.padEnd(12), String(r.perMin).padEnd(10), String(r.worst).padEnd(6), r.fr.x.join('/').padEnd(17), r.fr.y.join('/').padEnd(17), String(r.fr.xTravel).padEnd(7), String(r.fr.yTravel).padEnd(8), String(r.zoomTravel).padEnd(8), `${r.zMin}-${r.zMax}`.padEnd(10), r.fr.zRate);
} finally {await b.close();}
