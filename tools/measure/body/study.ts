// Builds the owner's motion review: short stretches of the 20 handcrafted videos, one asked hit to the next, stratified by
// construction family × calm/intense × how much unasked motion my measures see. The page (motion-review/) is blind:
// the measures go to labels/studies/<study>.key.json, which it never loads.
//   node tools/measure/body/study.ts
import fs from 'node:fs';
import {accounts} from './recount.ts';
// @ts-ignore
import {rocking} from './rocking.mjs';
const STUDY = 'motion-2026-11', PER_CELL = 2;
const picks = fs.readFileSync('generated/visible/picks.txt', 'utf8').trim().split('\n').map(l => l.split(' '));
let seed = 20261115; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
type Cand = {id: string; video: string; song: string; from: number; to: number; focus: [number, number]; hits: Array<{t: number; impact: number}>;
  family: string; context: string; level: string; ask: number; seen: number; rest: number; rock: number};
const cands: Cand[] = [];
for (const [song, variant, s] of picks) {
  const dir = `generated/handcraft/${song}/${variant}/s${s}`, a = accounts(dir); if (!a) continue;
  const {p, frames} = a, n = frames.length, tg = p.impactEvaluation.targets as Array<{frame: number; impact: number}>, dur = p.case.durationFrames / 40;
  const M = new Float64Array(n); for (let i = 1; i + 1 < n; i++) {const x = frames[i].impulse, y = frames[i + 1].impulse; M[i] = Math.hypot(x[0] + y[0], x[1] + y[1], x[2] + y[2]) / 7.55;}
  const rk = rocking(p);
  for (let k = 0; k + 1 < tg.length; k++) {
    const f = tg[k].frame, nx = tg[k + 1].frame, t0 = f / 40, t1 = nx / 40;
    if (t1 - t0 < .3 || t1 - t0 > 2.2) continue;
    let seen = 0, rest = 0; for (let i = Math.max(1, f - 2); i <= f + 3; i++) seen = Math.max(seen, M[i]); for (let i = f + 4; i <= nx - 3; i++) rest = Math.max(rest, M[i]);
    const r = rk[k]; let rock = 0; for (let q = 1; q < r.sw.length; q++) if (r.sw[q - 1].to > f + 3) rock += Math.min(Math.abs(r.sw[q - 1].deg), Math.abs(r.sw[q].deg));
    let from = t0 - 1, to = t1 + .6; if (to - from < 2.4) {const add = (2.4 - (to - from)) / 2; from -= add; to += add;}
    if (from < .6 || to > dur - .6) continue;
    const hits = tg.filter(t => t.frame / 40 >= from && t.frame / 40 <= to).map(t => ({t: +(t.frame / 40).toFixed(3), impact: t.impact}));
    const asks = hits.map(h => h.impact), mean = asks.reduce((x, y) => x + y, 0) / asks.length;
    const context = Math.max(...asks) <= .3 ? 'calm' : mean >= .5 ? 'intense' : 'mixed'; if (context === 'mixed') continue;
    const level = rock >= 20 || rest >= Math.max(.2, seen) ? 'high' : rock < 6 && rest < (context === 'calm' ? .1 : .15) ? 'low' : 'middle'; if (level === 'middle') continue;
    const sec = p.sections.find((x: any) => Math.abs(Math.round(x.start * 40) - f) <= 3); if (!sec) continue;
    cands.push({id: '', video: `/generated/videos/handcraft/${song}-${variant}.mp4`, song, from: +from.toFixed(3), to: +to.toFixed(3), focus: [+t0.toFixed(3), +t1.toFixed(3)], hits,
      family: sec.shape, context, level, ask: tg[k].impact, seen: +seen.toFixed(3), rest: +rest.toFixed(3), rock: +rock.toFixed(1)});
  }
}
// per cell, PER_CELL clips: random, from different songs first, never two overlapping stretches of one video
const chosen: Cand[] = [], cells = new Map<string, Cand[]>();
for (const c of cands) {const k = `${c.family}|${c.context}|${c.level}`; (cells.get(k) ?? cells.set(k, []).get(k)!).push(c);}
for (const [k, list] of [...cells].sort()) {
  const pool = list.map(c => [rnd(), c] as const).sort((x, y) => x[0] - y[0]).map(x => x[1]), got: Cand[] = [];
  for (const pass of [0, 1]) for (const c of pool) {
    if (got.length >= PER_CELL || got.includes(c)) continue;
    if (pass === 0 && got.some(g => g.song === c.song)) continue;
    if (chosen.concat(got).some(g => g.video === c.video && c.from < g.to + .5 && g.from < c.to + .5)) continue;
    got.push(c);
  }
  chosen.push(...got); console.log(k.padEnd(28), 'candidates', String(list.length).padStart(4), ' chosen', got.length);
}
const order = chosen.map(c => [rnd(), c] as const).sort((x, y) => x[0] - y[0]).map(x => x[1]); order.forEach((c, i) => c.id = 'm' + String(i + 1).padStart(2, '0'));
fs.mkdirSync(`generated/label-studies/${STUDY}`, {recursive: true});
fs.writeFileSync(`generated/label-studies/${STUDY}/manifest.json`, JSON.stringify({study: STUDY,
  questions: [{id: 'unasked', options: ['clean', 'little', 'clearly', 'badly']}],
  clips: order.map(({id, video, from, to, focus, hits}) => ({id, video, from, to, focus, hits}))}, null, 1));
fs.writeFileSync(`labels/studies/${STUDY}.key.json`, JSON.stringify({study: STUDY, builtFrom: 'generated/handcraft (line.strike.v3 rides), picks of generated/visible/picks.txt',
  clips: order.map(({id, video, focus, family, context, level, ask, seen, rest, rock}) => ({id, video, focus, family, context, level, ask, seen, rest, rock}))}, null, 1));
console.log(order.length, 'clips,', order.reduce((s, c) => s + c.to - c.from, 0).toFixed(0), 's of video in one pass');
