// Candidate rocking charge, local to one contact run (so completed runs can be cached):
//  the whole-body rotation rate w (L / N R²) over the run's frames, then 10 more frames at the exit rate (what the
//  rider will do in the next quarter second of air); cut where w changes sign; each reversal later than `skip` frames
//  into the run undoes min(swing before, swing after) degrees. Compared per section with the sled-angle rocking.
import fs from 'node:fs'; import path from 'node:path';
import {LineRiderEngine as Engine} from '../../../scripts/lib/native_motion/engine.ts';
import {extractRawTrajectory} from '../../../scripts/lib/detector.ts';
import {bodyMotion} from '../../../scripts/lib/strike_impact.ts';
// @ts-ignore
import {rocking} from './rocking.mjs';
export function localRock(w: number[], contact: boolean[], skip = 6, ahead = 10) {
  const out: Array<{from: number; to: number; undone: number; at: number}> = [];
  for (let i = 1; i < w.length;) {if (!contact[i]) {i++; continue;} let j = i; while (j + 1 < w.length && contact[j + 1]) j++;
    // swings: maximal same-sign stretches of the rotation rate, from the run's start through the virtual air frames
    const rate = (k: number) => k <= j ? w[k] : w[j + 1] ?? w[j];
    const sw: Array<{deg: number; end: number}> = []; let acc = 0, sign = 0;
    for (let k = i; k <= j + ahead; k++) {const r = rate(k), s = Math.sign(r); if (s !== 0 && sign !== 0 && s !== sign) {sw.push({deg: acc, end: Math.min(k - 1, j)}); acc = 0;} if (s !== 0) sign = s; acc += r;}
    sw.push({deg: acc, end: j});
    let undone = 0, at = i, top = 0;
    for (let q = 1; q < sw.length; q++) {if (sw[q - 1].end < i + skip - 1) continue; const u = Math.min(Math.abs(sw[q - 1].deg), Math.abs(sw[q].deg)); undone += u; if (u > top) {top = u; at = sw[q - 1].end;}}
    out.push({from: i, to: j, undone, at}); i = j + 1;}
  return out;
}
if (process.argv[1].endsWith('localrock.ts')) {
  const V = process.env.V?.split(',').map(Number), pts: number[][] = [];
  for (const dir of process.argv.slice(2)) {
    const f = fs.readdirSync(dir).find(f => f.endsWith('-production.json')); if (!f) continue; const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const engine = new Engine().setStart(p.track.startPosition, p.track.riders[0].startVelocity).addLine(p.track.lines);
    const raw = extractRawTrajectory(engine, p.case.durationFrames + 20), n = raw.frames.length, w: number[] = [], contact: boolean[] = [];
    for (let k = 0; k < n; k++) {const m = bodyMotion(engine.getRider(k).ballisticState()); w.push(m.L / (10 * m.R * m.R) * 180 / Math.PI); contact.push(!!engine.hasContactAtFrame(k));}
    const runs = localRock(w, contact), tg = p.impactEvaluation.targets, rk = rocking(p);
    rk.forEach((r: any, k: number) => {const a = tg[k].frame, nx = k + 1 < tg.length ? tg[k + 1].frame : p.case.durationFrames;
      // sled-angle rocking after the hit's own frames only
      let post = 0; for (let q = 1; q < r.sw.length; q++) if (r.sw[q - 1].to > a + 3) post += Math.min(Math.abs(r.sw[q - 1].deg), Math.abs(r.sw[q].deg));
      const loc = runs.filter(e => e.from >= a - 3 && e.from < nx - 3).reduce((s, e) => s + e.undone, 0);
      pts.push([post, loc]); if (V && r.t >= V[0] && r.t <= V[1]) console.log(r.t.toFixed(2), r.shape.padEnd(10), 'sled rocking after the hit', post.toFixed(0).padStart(3) + '°', ' local charge', loc.toFixed(0).padStart(3) + '°');});
  }
  const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n; let sxy = 0, sx = 0, sy = 0;
  for (const [x, y] of pts) {sxy += (x - mx) * (y - my); sx += (x - mx) ** 2; sy += (y - my) ** 2;}
  console.log(n, 'sections. correlation', (sxy / Math.sqrt(sx * sy)).toFixed(2), ' mean sled', mx.toFixed(1), ' mean local', my.toFixed(1));
  for (const [lo, hi] of [[0, 1], [1, 10], [10, 20], [20, 40], [40, 999]]) {const g = pts.filter(p => p[0] >= lo && p[0] < hi); if (g.length) console.log(`sled rocking ${lo}–${hi}°:`, String(g.length).padStart(5), 'sections, mean local', (g.reduce((s, p) => s + p[1], 0) / g.length).toFixed(1).padStart(5) + '°', ' local ≥10°:', (100 * g.filter(p => p[1] >= 10).length / g.length).toFixed(0) + '%');}
}
