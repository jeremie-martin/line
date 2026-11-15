// The ground the rider touches after a hit's own frames: its sharpest turning within W px (any direction) and its
// roughest reversal, against the owner's answers and at the sharp ends he named.
import fs from 'node:fs'; import path from 'node:path';
import {LineRiderEngine as Engine} from '../../../scripts/lib/native_motion/engine.ts';
import {extractRawTrajectory} from '../../../scripts/lib/detector.ts';
import {roughestReversal} from '../../../scripts/v0/optimizer/ground_smoothness.ts';
// @ts-ignore
import {rows} from './answers.mjs';
type L = {id: number; x1: number; y1: number; x2: number; y2: number};
export function sharpestTurn(lines: readonly L[], touched: ReadonlySet<number>, W = 30) {
  let worst = 0;
  for (let first = 0; first < lines.length;) {
    let last = first; while (last + 1 < lines.length && lines[last + 1].x1 === lines[last].x2 && lines[last + 1].y1 === lines[last].y2) last++;
    const h: number[] = [], d: number[] = [], on: boolean[] = []; let along = 0;
    for (let k = first; k <= last; k++) {const l = lines[k], len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1); let a = Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180 / Math.PI;
      if (h.length) {while (a - h.at(-1)! > 180) a -= 360; while (a - h.at(-1)! < -180) a += 360;} h.push(a); d.push(along + len / 2); on.push(touched.has(l.id)); along += len;}
    for (let i = 0; i < h.length; i++) {if (!on[i]) continue; let lo = h[i], hi = h[i];
      for (let k = i; k >= 0 && d[i] - d[k] <= W / 2; k--) {lo = Math.min(lo, h[k]); hi = Math.max(hi, h[k]);}
      for (let k = i; k < h.length && d[k] - d[i] <= W / 2; k++) {lo = Math.min(lo, h[k]); hi = Math.max(hi, h[k]);}
      worst = Math.max(worst, hi - lo);}
    first = last + 1;
  }
  return worst;
}
const cache = new Map<string, any>();
export function ride(dir: string) {
  if (cache.has(dir)) return cache.get(dir);
  const f = fs.readdirSync(dir).find(f => f.endsWith('-production.json'))!, p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const engine = new Engine().setStart(p.track.startPosition, p.track.riders[0].startVelocity).addLine(p.track.lines);
  const raw = extractRawTrajectory(engine, p.case.durationFrames + 20); const r = {p, raw, lines: [...p.track.lines].sort((a: L, b: L) => a.id - b.id) as L[]}; cache.set(dir, r); return r;
}
/** Lines touched in [a, b] frames, split at `skip` frames after the hit at frame `hit`. */
export function touchedIn(r: any, hit: number, a: number, b: number, skip = 6) {
  const early = new Set<number>(), late = new Set<number>();
  for (let i = a; i <= b && i < r.raw.frames.length; i++) for (const id of r.raw.frames[i].contactLineIds) (i <= hit + skip - 1 ? early : late).add(id);
  return {early, late};
}
if (process.argv[1].endsWith('late.ts')) {
  const picks = fs.readFileSync('generated/visible/picks.txt', 'utf8').trim().split('\n').map(l => l.split(' '));
  const out: any[] = [];
  for (const row of rows) {const name = row.video.split('/').pop().replace('.mp4', ''), pk = picks.find(p => `${p[0]}-${p[1]}` === name)!;
    const r = ride(`generated/handcraft/${pk[0]}/${pk[1]}/s${pk[2]}`), tg = r.p.impactEvaluation.targets, hit = tg.reduce((best: any, t: any) => Math.abs(t.frame / 40 - row.focus[0]) < Math.abs(best.frame / 40 - row.focus[0]) ? t : best).frame;
    const {early, late} = touchedIn(r, hit, hit - 2, Math.round(row.focus[1] * 40)), all = new Set([...early, ...late]);
    out.push({...row, lateTurn: sharpestTurn(r.lines, late), earlyTurn: sharpestTurn(r.lines, early), rev: roughestReversal(r.lines, all), lateRev: roughestReversal(r.lines, late)});}
  const cor = (f: (r: any) => number) => {const n = out.length, mx = out.reduce((s, r) => s + f(r), 0) / n, my = out.reduce((s, r) => s + r.score, 0) / n; let a = 0, b = 0, c = 0;
    for (const r of out) {a += (f(r) - mx) * (r.score - my); b += (f(r) - mx) ** 2; c += (r.score - my) ** 2;} return (a / Math.sqrt(b * c)).toFixed(2);};
  console.log('correlation with the answer: reversal (all touched)', cor(r => r.rev), '| reversal (touched after the hit)', cor(r => r.lateRev), '| turning within 30 px after the hit', cor(r => r.lateTurn), '| turning at the hit', cor(r => r.earlyTurn));
  for (const k of ['clean', 'little', 'clearly']) {const g = out.filter(r => r.ans === k); console.log(k.padEnd(8), 'reversal:', g.map(r => r.rev.toFixed(0)).sort((a, b) => +a - +b).join(' '), ' | late turning:', g.map(r => r.lateTurn.toFixed(0)).sort((a, b) => +a - +b).join(' '));}
  const rule = (name: string, f: (r: any) => boolean) => {const hit = out.filter(r => f(r)), miss = out.filter(r => !f(r));
    console.log(name.padEnd(58), 'flagged', String(hit.length).padStart(2), '(clean', hit.filter(r => r.score === 0).length + ', little', hit.filter(r => r.score === 1).length + ', clearly', hit.filter(r => r.score === 2).length + ')',
      ' passed', String(miss.length).padStart(2), '(clean', miss.filter(r => r.score === 0).length + ', little', miss.filter(r => r.score === 1).length + ', clearly', miss.filter(r => r.score === 2).length + ')',
      (miss.filter(r => r.score > 0).map((r: any) => r.id + ':' + r.family).join(' ')));};
  rule('turning after the hit > 8° within 30 px', r => r.lateTurn > 8);
  rule('reversal ≥ 12° within 60 px', r => r.rev >= 12);
  rule('either', r => r.lateTurn > 8 || r.rev >= 12);
  rule('reversal after the hit ≥ 12°', r => r.lateRev >= 12);
  rule('after the hit only: turning > 8° or reversal ≥ 12°', r => r.lateTurn > 8 || r.lateRev >= 12);
  rule('after the hit only: turning > 10° or reversal > 10°', r => r.lateTurn > 10 || r.lateRev > 10);
  rule('all touched: turning(late) > 10° or reversal > 10°', r => r.lateTurn > 10 || r.rev > 10);
  for (const W of [60]) {const t = (r: any) => {const name = r.video.split('/').pop().replace('.mp4', ''), pk = picks.find(p => `${p[0]}-${p[1]}` === name)!, rr = ride(`generated/handcraft/${pk[0]}/${pk[1]}/s${pk[2]}`),
      tg = rr.p.impactEvaluation.targets, hit = tg.reduce((best: any, t: any) => Math.abs(t.frame / 40 - r.focus[0]) < Math.abs(best.frame / 40 - r.focus[0]) ? t : best).frame; return sharpestTurn(rr.lines, touchedIn(rr, hit, hit - 2, Math.round(r.focus[1] * 40)).late, W);};
    for (const lim of [10, 14, 18]) rule(`turning after the hit > ${lim}° within ${W} px`, r => t(r) > lim);}
  const named: Array<[string, number, string]> = [['generated/handcraft/valhalla_40s/still-drop/s303', 4.15, 'today, lip at 5 s'], ['generated/handcraft/valhalla_40s/still-drop/s303', 6.75, 'today, lip at 7 s'],
    ['generated/visible/notf-g10/valhalla_40s/still-drop/s303', 23.275, 'smooth, 23.3 s'], ['generated/visible/notf-g10/valhalla_40s/still-drop/s303', 23.6, 'smooth, 23.6 s'], ['generated/visible/notf-g10/valhalla_40s/still-drop/s303', 23.9, 'smooth, 23.9 s']];
  for (const [dir, t, name] of named) {const r = ride(dir), tg = r.p.impactEvaluation.targets, k = tg.findIndex((x: any) => Math.abs(x.frame / 40 - t) < .06), hit = tg[k].frame, nx = tg[k + 1].frame;
    const {early, late} = touchedIn(r, hit, hit - 2, nx - 3); console.log(name.padEnd(22), 'turning within 30 px: at the hit', sharpestTurn(r.lines, early).toFixed(0) + '°', ' after it', sharpestTurn(r.lines, late).toFixed(0) + '°', ' reversal', roughestReversal(r.lines, new Set([...early, ...late])).toFixed(0) + '°');}
}
