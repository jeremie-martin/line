// The owner's second motion review: fresh stretches, to check the smooth-ground rule on clips it was not fitted on and
// to place its limit. Sources (seed 202, plain look): the baseline without terraces and folds, the rule at 10°, the
// rule at 15°. Classes: baseline with a lip (turning after the hit above 15°), baseline with a bump (reversal after the
// hit above 12°), baseline within the rule, the rule's rides, and lips of 10–15° from the looser limit. Blind page;
// the key goes to labels/studies/<study>.key.json.   node tools/measure/body/study2.ts
import fs from 'node:fs';
import {ride, touchedIn} from './late.ts';
import {roughestReversal, sharpestTurn} from '../../../scripts/v0/optimizer/ground_smoothness.ts';
const STUDY = 'motion-2026-11b';
const SPECS = [['valhalla_40s', 'still-drop'], ['valhalla_40s', 'phrases-climb'], ['trouble_50s', 'cycle'], ['trouble_50s', 'stop-go'], ['amor_na_praia_46s', 'chord-bars'],
  ['bones_selection', 'second-hit'], ['bones_selection', 'singer'], ['petrunko_selection', 'figure']];
const WANT: Record<string, number> = {'baseline lip': 8, 'baseline bump': 6, 'baseline within the rule': 6, 'rule': 10, 'lip 10–15°': 8};
let seed = 20261116; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
type C = {id: string; video: string; spec: string; from: number; to: number; focus: [number, number]; contact: Array<[number, number]>; hits: Array<{t: number; impact: number}>;
  cls: string; source: string; family: string; context: string; ask: number; lateTurn: number; lateReversal: number};
const cands: C[] = [];
for (const [s, v] of SPECS) for (const tag of ['notf3', 'after3', 'after3-15']) {
  const r = ride(`generated/visible/${tag}/${s}/${v}/s202`), p = r.p, tg = p.impactEvaluation.targets as Array<{frame: number; impact: number}>, dur = p.case.durationFrames / 40;
  for (let k = 0; k + 1 < tg.length; k++) {
    const f = tg[k].frame, nx = tg[k + 1].frame, t0 = f / 40, t1 = nx / 40; if (t1 - t0 < .3 || t1 - t0 > 2.2) continue;
    const {late} = touchedIn(r, f, f, nx - 3), lt = sharpestTurn(r.lines, late), lr = roughestReversal(r.lines, late);
    const cls = tag === 'notf3' ? (lt > 15 ? 'baseline lip' : lr > 12 ? 'baseline bump' : lt <= 8 && lr <= 8 ? 'baseline within the rule' : '') : tag === 'after3' ? 'rule' : lt > 10 && lt <= 15 && lr <= 10 ? 'lip 10–15°' : '';
    if (!cls) continue;
    const contact: Array<[number, number]> = [];
    for (let i = Math.max(1, f - 2); i < nx - 2;) {if (!r.raw.frames[i].contactLineIds.length) {i++; continue;} let j = i; while (j + 1 < nx - 2 && r.raw.frames[j + 1].contactLineIds.length) j++;
      const last = contact.at(-1); if (last && i / 40 - last[1] <= .1) last[1] = +((j + 1) / 40).toFixed(3); else contact.push([+(i / 40).toFixed(3), +((j + 1) / 40).toFixed(3)]); i = j + 1;}
    if (!contact.length) continue;
    let from = t0 - 1, to = t1 + .6; if (to - from < 2.4) {const add = (2.4 - (to - from)) / 2; from -= add; to += add;} if (from < .6 || to > dur - .6) continue;
    const hits = tg.filter(t => t.frame / 40 >= from && t.frame / 40 <= to).map(t => ({t: +(t.frame / 40).toFixed(3), impact: t.impact})), asks = hits.map(h => h.impact);
    const context = Math.max(...asks) <= .3 ? 'calm' : asks.reduce((x, y) => x + y, 0) / asks.length >= .5 ? 'intense' : 'mixed';
    const sec = p.sections.find((x: any) => Math.abs(Math.round(x.start * 40) - f) <= 3);
    cands.push({id: '', video: `/generated/videos/round2/${tag}--${s}-${v}.mp4`, spec: `${s}-${v}`, from: +from.toFixed(3), to: +to.toFixed(3), focus: [contact[0][0], contact.at(-1)![1]], contact, hits,
      cls, source: tag, family: sec?.shape ?? '?', context, ask: tg[k].impact, lateTurn: +lt.toFixed(1), lateReversal: +lr.toFixed(1)});
  }
}
const chosen: C[] = [];
for (const [cls, want] of Object.entries(WANT)) {
  const pool = cands.filter(c => c.cls === cls).map(c => [rnd(), c] as const).sort((a, b) => a[0] - b[0]).map(x => x[1]), got: C[] = [];
  // spread over specs and over calm/intense, never two overlapping stretches of one video
  for (const pass of [0, 1, 2]) for (const c of pool) {
    if (got.length >= want || got.includes(c)) continue;
    if (pass === 0 && (got.some(g => g.spec === c.spec) || got.filter(g => g.context === c.context).length >= Math.ceil(want / 2))) continue;
    if (pass === 1 && got.filter(g => g.spec === c.spec).length >= 2) continue;
    if (chosen.concat(got).some(g => g.video === c.video && c.from < g.to + .5 && g.from < c.to + .5)) continue;
    got.push(c);
  }
  chosen.push(...got); console.log(cls.padEnd(26), 'candidates', String(pool.length).padStart(4), ' chosen', got.length, ' calm', got.filter(g => g.context === 'calm').length, 'intense', got.filter(g => g.context === 'intense').length);
}
const order = chosen.map(c => [rnd(), c] as const).sort((a, b) => a[0] - b[0]).map(x => x[1]); order.forEach((c, i) => c.id = 'n' + String(i + 1).padStart(2, '0'));
fs.mkdirSync(`generated/label-studies/${STUDY}`, {recursive: true});
fs.writeFileSync(`generated/label-studies/${STUDY}/manifest.json`, JSON.stringify({study: STUDY, questions: [{id: 'unasked', options: ['clean', 'little', 'clearly', 'badly']}],
  clips: order.map(({id, video, from, to, focus, contact, hits}) => ({id, video, from, to, focus, contact, hits}))}, null, 1));
fs.writeFileSync(`labels/studies/${STUDY}.key.json`, JSON.stringify({study: STUDY, clips: order.map(({id, video, focus, cls, source, family, context, ask, lateTurn, lateReversal}) => ({id, video, focus, cls, source, family, context, ask, lateTurn, lateReversal}))}, null, 1));
console.log(order.length, 'clips,', order.reduce((s, c) => s + c.to - c.from, 0).toFixed(0), 's in one pass');
