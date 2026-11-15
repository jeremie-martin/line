// Where do the reversals come from when nothing forbids them? usage: node tools/measure/body/bumpsrc.ts TAG
import fs from 'node:fs'; import {ride, touchedIn} from './late.ts';
import {roughestReversal, REVERSAL_LIMIT} from '../../../scripts/v0/optimizer/ground_smoothness.ts';
const specs = fs.readFileSync('generated/visible/picks.txt', 'utf8').trim().split('\n').map(l => l.split(' ').slice(0, 2)), tag = process.argv[2];
const by: Record<string, {n: number; bump: number; early: number; late: number; sum: number}> = {}; const sizes: number[] = [];
for (const [s, v] of specs) for (const seed of [101, 202, 303]) {
  const r = ride(`generated/visible/${tag}/${s}/${v}/s${seed}`), p = r.p, tg = p.impactEvaluation.targets;
  for (let k = 0; k < tg.length; k++) {const hit = tg[k].frame, nx = k + 1 < tg.length ? tg[k + 1].frame : p.case.durationFrames, {early, late} = touchedIn(r, hit, hit, nx - 3);
    const sec = p.sections.find((x: any) => Math.abs(Math.round(x.start * 40) - hit) <= 3); if (!sec) continue;
    const fam = sec.shape + (sec.guideContactFrames ? ' +rail touched' : '');
    const o = by[fam] ??= {n: 0, bump: 0, early: 0, late: 0, sum: 0}; o.n++;
    const all = roughestReversal(r.lines, new Set([...early, ...late])); if (all <= REVERSAL_LIMIT) continue;
    o.bump++; o.sum += all; sizes.push(all); if (roughestReversal(r.lines, early) > REVERSAL_LIMIT) o.early++; if (roughestReversal(r.lines, late) > REVERSAL_LIMIT) o.late++;}
}
const tot = Object.values(by).reduce((s, o) => s + o.bump, 0);
console.log(tag, ': sections with a reversal above', REVERSAL_LIMIT + '°:', tot);
for (const [k, o] of Object.entries(by).sort((a, b) => b[1].bump - a[1].bump)) console.log(' ', k.padEnd(26), String(o.n).padStart(5), 'sections,', (100 * o.bump / o.n).toFixed(0).padStart(3) + '% with a bump =', (100 * o.bump / tot).toFixed(0).padStart(3) + '% of all bumps; mean', (o.sum / Math.max(1, o.bump)).toFixed(0) + '°; on ground touched in the hit\'s frames', o.early, ', after', o.late);
sizes.sort((a, b) => a - b); console.log('sizes: quartiles', [.25, .5, .75, .9].map(q => sizes[Math.floor(q * sizes.length)].toFixed(0) + '°').join(' '));
