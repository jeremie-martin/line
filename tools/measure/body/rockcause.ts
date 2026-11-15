// Where does rocking come from? Per section (asked hit to the next), against the sled's rocking:
//  und   = the ground reversing its bend under the rider: heading swings (≥4°) undone inside each contact
//  mis   = sled misaligned with its path at touchdown: |sled angle − heading 2 frames after the first contact|
//  nc    = number of separate contacts
import {accounts} from './recount.ts';
// @ts-ignore
import {rocking, swings} from './rocking.mjs';
const rows: any[] = [];
for (const dir of process.argv.slice(2)) {
  const a = accounts(dir); if (!a) continue; const F: number[][] = a.p.trace.frames, fr = a.frames, n = Math.min(F.length, fr.length);
  const com = F.map(f => {let x = 0, y = 0; for (let k = 0; k < 10; k++) {x += f[2 * k]; y += f[2 * k + 1];} return [x / 10, y / 10];});
  let prev = 0; const head = com.map((c, i) => {if (!i) return 0; let h = Math.atan2(c[1] - com[i - 1][1], c[0] - com[i - 1][0]) * 180 / Math.PI; while (h - prev > 180) h -= 360; while (h - prev < -180) h += 360; prev = h; return h;});
  const sled = F.map(f => Math.atan2(f[5] - f[3], f[4] - f[2]) * 180 / Math.PI);
  const tg = a.p.impactEvaluation.targets, rk = rocking(a.p);
  rk.forEach((r: any, k: number) => {
    const f = tg[k].frame, nx = k + 1 < tg.length ? tg[k + 1].frame : a.p.case.durationFrames; let und = 0, nc = 0, mis = -1, cf = 0;
    for (let i = Math.max(2, f - 2); i < Math.min(n, nx - 3);) {if (!fr[i].contact) {i++; continue;} let j = i; while (j + 1 < n && fr[j + 1].contact) j++;
      nc++; cf += j - i + 1; const sw = swings(head, i, Math.min(j + 1, n - 1)); for (let q = 1; q < sw.length; q++) und += Math.min(Math.abs(sw[q - 1].deg), Math.abs(sw[q].deg));
      if (mis < 0 && i + 2 < n) {let d = sled[i - 1] - head[i + 2]; d = ((d % 360) + 540) % 360 - 180; mis = Math.abs(d);} i = j + 1;}
    rows.push({rock: r.rock, und, mis: Math.max(0, mis), nc, cf, shape: r.shape, ask: r.ask});
  });
}
const cor = (x: (r: any) => number, y: (r: any) => number, set = rows) => {const n = set.length, mx = set.reduce((s, r) => s + x(r), 0) / n, my = set.reduce((s, r) => s + y(r), 0) / n;
  let sxy = 0, sx = 0, sy = 0; for (const r of set) {sxy += (x(r) - mx) * (y(r) - my); sx += (x(r) - mx) ** 2; sy += (y(r) - my) ** 2;} return (sxy / Math.sqrt(sx * sy)).toFixed(2);};
console.log(rows.length, 'sections. rocking correlates with: ground bend reversals', cor(r => r.rock, r => r.und), '| misaligned touchdown', cor(r => r.rock, r => r.mis), '| separate contacts', cor(r => r.rock, r => r.nc), '| contact frames', cor(r => r.rock, r => r.cf), '| ask', cor(r => r.rock, r => r.ask));
const grp = (name: string, f: (r: any) => boolean) => {const g = rows.filter(f); console.log(name.padEnd(46), String(g.length).padStart(5), 'sections', (100 * g.length / rows.length).toFixed(0).padStart(3) + '%', ' mean rocking', (g.reduce((s, r) => s + r.rock, 0) / g.length).toFixed(1).padStart(5) + '°', ' share of all rocking', (100 * g.reduce((s, r) => s + r.rock, 0) / rows.reduce((s, r) => s + r.rock, 0)).toFixed(0) + '%');};
grp('ground does not reverse (<4°), aligned (<15°)', r => r.und < 4 && r.mis < 15);
grp('ground does not reverse, misaligned 15–40°', r => r.und < 4 && r.mis >= 15 && r.mis < 40);
grp('ground does not reverse, misaligned ≥40°', r => r.und < 4 && r.mis >= 40);
grp('ground reverses 4–15°', r => r.und >= 4 && r.und < 15);
grp('ground reverses ≥15°', r => r.und >= 15);
grp('one contact', r => r.nc === 1); grp('two contacts', r => r.nc === 2); grp('three or more contacts', r => r.nc >= 3);
for (const s of ['arcs', 'terraces', 'fold', 'scallops', 'serpentine', 'fragments']) {const g = rows.filter(r => r.shape === s); console.log(s.padEnd(11), 'ground reverses ≥4° in', (100 * g.filter(r => r.und >= 4).length / g.length).toFixed(0) + '%', ' misaligned ≥15° in', (100 * g.filter(r => r.mis >= 15).length / g.length).toFixed(0) + '%', ' ≥2 contacts in', (100 * g.filter(r => r.nc >= 2).length / g.length).toFixed(0) + '%');}
