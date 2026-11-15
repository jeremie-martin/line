// Does a momentum measure see the rocking that the sled angle shows? Per engagement: undone spin =
// (Σ|s| − |Σ s|)/2 ÷ 7.55, s the spin impulse smoothed over 3 frames. Per section (asked hit to the next): the sum of
// its engagements' undone spin, against the angle rocking of rocking.mjs.
import {accounts} from './recount.ts';
// @ts-ignore
import {rocking} from './rocking.mjs';
const pts: number[][] = []; const V = process.env.V;
for (const dir of process.argv.slice(2)) {
  const a = accounts(dir); if (!a) continue; const fr = a.frames, n = fr.length, rows = rocking(a.p);
  const s = (i: number) => .25 * (fr[i - 1]?.impulse?.[2] ?? 0) + .5 * fr[i].impulse[2] + .25 * (fr[i + 1]?.impulse?.[2] ?? 0);
  const eng: Array<{from: number; to: number; undone: number}> = [];
  for (let i = 1; i < n;) {if (!fr[i].contact) {i++; continue;} let j = i; while (j + 1 < n && fr[j + 1].contact) j++;
    let abs = 0, net = 0; for (let k = i; k <= j; k++) {abs += Math.abs(s(k)); net += s(k);} eng.push({from: i, to: j, undone: (abs - Math.abs(net)) / 2 / 7.55}); i = j + 1;}
  const tg = a.p.impactEvaluation.targets;
  rows.forEach((r: any, k: number) => {const f = tg[k].frame, nx = k + 1 < tg.length ? tg[k + 1].frame : a.p.case.durationFrames;
    const u = eng.filter(e => e.from >= f - 3 && e.from < nx - 3).reduce((x, e) => x + e.undone, 0);
    pts.push([r.rock, u]); if (V && r.t > +V.split(',')[0] && r.t < +V.split(',')[1]) console.log(r.t.toFixed(2), r.shape.padEnd(10), 'angle rocking', r.rock.toFixed(0).padStart(3) + '°', 'undone spin', u.toFixed(2));});
}
const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
let sxy = 0, sx = 0, sy = 0; for (const [x, y] of pts) {sxy += (x - mx) * (y - my); sx += (x - mx) ** 2; sy += (y - my) ** 2;}
console.log(n, 'sections. correlation angle rocking vs undone spin:', (sxy / Math.sqrt(sx * sy)).toFixed(2), ' mean undone spin', my.toFixed(3));
for (const [lo, hi] of [[0, 1], [1, 10], [10, 20], [20, 40], [40, 999]]) {const g = pts.filter(p => p[0] >= lo && p[0] < hi); console.log(`angle rocking ${lo}–${hi}°:`, g.length, 'sections, mean undone spin', (g.reduce((s, p) => s + p[1], 0) / g.length).toFixed(3), ' share ≥0.1:', (100 * g.filter(p => p[1] >= .1).length / g.length).toFixed(0) + '%');}
