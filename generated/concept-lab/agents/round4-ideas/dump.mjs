// Dump per-song contacts, centres and hits for offline analysis.
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const out = process.argv[2];
const b = await chromium.launch({args: ['--mute-audio']});
const p = await b.newPage({viewport: {width: 1080, height: 1920}});
p.on('pageerror', e => console.log('ERR', e.message));
for (const song of ['petrunko','los','lua','batidao','burn','coma']) {
  await p.goto(`http://127.0.0.1:8770/generated/concept-lab/agents/round4-ideas/mock/?shot=1&song=${song}&c=ride&t=1`);
  await p.waitForFunction(() => window.__ready === true, null, {timeout: 90000});
  const d = await p.evaluate(() => {const S = window.__S, n = window.__native;
    return {song: S.key, duration: S.duration, contacts: n.contacts.map(c => c.length), contactIds: n.contacts,
      centres: S.centres, hits: S.hits.map(h => ({t: h.t, tc: h.tc, s: h.s, I: h.I, ang: h.ang, nrm: h.nrm, pos: h.pos, vel: h.vel, chain: h.chain})),
      lines: S.lines.map(l => [l.x1, l.y1, l.x2, l.y2, l.touch === Infinity ? -1 : l.touch, l.ink === Infinity ? -1 : l.ink, l.chain]), phases: S.phases, night: S.night};});
  writeFileSync(`${out}/${song}.json`, JSON.stringify(d)); console.log(song, d.centres.length, d.lines.length, d.hits.length);
}
await b.close();
