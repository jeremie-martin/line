/** What a rail does in the ride (report only). For every gap of rides `npm run compare` saved, replayed once: whether its
 * rail is touched, and when: in the catch (the hit's first three frames), on the support after it, or in the last
 * frames before the rider leaves the support (the release); how many frames; and for the catch that gap makes (the beat
 * at its start): the strength against the ask, and the rider's speed 8 frames after the catch against before it.
 * Railed and rail-free gaps are compared within the same ask band and family, so what the rail buys is read in like
 * for like. Screen y down; speeds in px/frame.
 *   node tools/research/rail_job.ts [--arm=ARM] [--seeds=101,202,303,404] */
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe} from '../measure/observe.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString()), gapOf = (id: number) => Math.floor((id - 1000) / 10000);
const dir = join('generated/eval/arms', arg('arm', ''), 'cells'), seeds = arg('seeds', '101,202,303,404').split(',');
const speed = (fr: any) => {let vx = 0, vy = 0; for (const [x, y, px, py] of fr.points) {vx += x - px; vy += y - py;} return Math.hypot(vx, vy) / fr.points.length;};
const rows: any[] = [];
for (const f of readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`))).sort()) {
  const id = f.slice(0, -5), cell = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const track = gz(join(dir, `${id}.track.json.gz`)), production = gz(join(dir, `${id}.gallery.json.gz`)).production ?? {};
  const guides = new Set<number>(Object.values(production.railGuides ?? {}).flat() as number[]);
  const requests: any[] = production.plan?.requests ?? [], sections = cell.geometry.sections;
  const frames = observe(track, cell.terminus.frame, cell.case.targets).frames, perBeat = cell.impact3.perBeat;
  for (let g = 1; g < requests.length; g++) {
    const r = requests[g], s = sections[g], b = perBeat[g - 1];
    if (!s || !b?.hit || b.requested == null) continue;
    const start = b.hit.contactStart, end = Math.min(r.next, frames.length - 1);
    // the last frame the rider touches this gap's main line: its release
    let release = start;
    for (let t = start; t < end; t++) if (frames[t].collisions.some(([lid]: number[]) => gapOf(lid) === g && !guides.has(lid))) release = t;
    const on = (t: number) => frames[t]?.collisions.some(([lid]: number[]) => gapOf(lid) === g && guides.has(lid));
    let atCatch = 0, onSupport = 0, atRelease = 0;
    for (let t = start; t <= Math.max(release, start); t++) if (on(t)) {if (t < start + 3) atCatch++; else if (t > release - 4) atRelease++; else onSupport++;}
    const vBefore = speed(frames[Math.max(1, start - 1)]), vAfter = speed(frames[Math.min(frames.length - 1, start + 8)]);
    // the flight this gap launches: its own air and speed asked against got (cell.gaps rows: [gap, axis, asked, got])
    const axis = (k: string) => {const x = cell.gaps.find((q: any) => q[0] === g && q[1] === k); return x ? x[3] - x[2] : NaN;};
    // how the support bends over its last third: its heading turn (screen y down: + bends downward, convex under a rider
    // on top; − bends upward, concave), from the gap's main pieces in id order
    const main = track.lines.filter((l: any) => gapOf(l.id) === g && !guides.has(l.id)).sort((a: any, b: any) => a.id - b.id);
    const hd = (l: any) => Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180 / Math.PI;
    const endBend = main.length >= 6 ? ((hd(main.at(-1)) - hd(main[Math.floor(main.length * 2 / 3)]) + 540) % 360) - 180 : NaN;
    // how hard the end asks to be held: at the release, the rider's speed² × the support's curvature there (the heading
    // turn per px over the pieces around the release point) against gravity's push into the support (g × cos of the
    // slope). Above 1 the rider would leave the curve unless held; at or below 1 gravity holds it.
    let hold = NaN;
    const relLine = frames[release]?.collisions.map(([lid]: number[]) => main.find((m: any) => m.id === lid)).find(Boolean);
    if (relLine) {
      const k = main.indexOf(relLine), a = main[Math.max(0, k - 2)], c = main[Math.min(main.length - 1, k + 2)];
      const turn = ((hd(c) - hd(a) + 540) % 360) - 180, span = main.slice(Math.max(0, k - 2), Math.min(main.length, k + 3)).reduce((n: number, l: any) => n + Math.hypot(l.x2 - l.x1, l.y2 - l.y1), 0);
      const curvature = (turn * Math.PI / 180) / Math.max(1, span), slope = hd(relLine) * Math.PI / 180, v = speed(frames[release]);
      hold = (v * v * curvature) / (.175 * Math.max(.05, Math.cos(slope)));
    }
    rows.push({hold, endBend, airError: axis('air'), speedError: axis('speed'), ride: id, gap: g, family: s.family, guidance: s.guidance, railKept: !!cell.character?.railDrawn?.[g], ask: b.requested,
      bias: b.hit.strength - b.requested, keep: vAfter / Math.max(.1, vBefore), atCatch, onSupport, atRelease, touched: atCatch + onSupport + atRelease > 0,
      support: Math.max(0, release - start)});
  }
}
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN, pc = (x: number) => `${(100 * x).toFixed(0)}%`;
const band = (a: number) => a >= .6 ? 'strong' : a >= .3 ? 'middle' : 'quiet';
const touched = rows.filter(r => r.touched);
console.log(`${new Set(rows.map(r => r.ride)).size} rides, ${rows.length} gaps with a catch; rail touched in ${touched.length} (${pc(touched.length / rows.length)})`);
console.log(`when the rail is touched: in the catch ${pc(touched.filter(r => r.atCatch).length / touched.length)}, on the support ${pc(touched.filter(r => r.onSupport).length / touched.length)}, at the release ${pc(touched.filter(r => r.atRelease).length / touched.length)}; frames touched: catch ${mean(touched.map(r => r.atCatch)).toFixed(1)}, support ${mean(touched.map(r => r.onSupport)).toFixed(1)}, release ${mean(touched.map(r => r.atRelease)).toFixed(1)}`);
console.log('like for like (same family and ask band): rail touched against no rail touched');
console.log('family'.padEnd(12), 'ask'.padEnd(7), 'n rail'.padStart(7), 'n none'.padStart(7), '| bias rail', 'none', '| speed kept rail', 'none', '| catch-only rail share', '| the flight it launches: air error rms rail none | speed error rms rail none');
for (const fam of ['arcs', 'fold', 'serpentine', 'scallops', 'terraces', 'scattered']) for (const ab of ['strong', 'middle', 'quiet']) {
  const g = rows.filter(r => r.family === fam && band(r.ask) === ab), yes = g.filter(r => r.touched), no = g.filter(r => !r.touched);
  if (yes.length < 30 || no.length < 30) continue;
  const rms = (xs: number[]) => Math.sqrt(mean(xs.filter(Number.isFinite).map(x => x * x)));
  console.log(fam.padEnd(12), ab.padEnd(7), String(yes.length).padStart(7), String(no.length).padStart(7), '|', mean(yes.map(r => r.bias)).toFixed(3).padStart(9), mean(no.map(r => r.bias)).toFixed(3),
    '|', mean(yes.map(r => r.keep)).toFixed(3).padStart(15), mean(no.map(r => r.keep)).toFixed(3), '|', pc(yes.filter(r => r.atCatch && !r.onSupport && !r.atRelease).length / yes.length).padStart(10),
    '| flight air rms', rms(yes.map(r => r.airError)).toFixed(3), rms(no.map(r => r.airError)).toFixed(3), '| speed rms', rms(yes.map(r => r.speedError)).toFixed(3), rms(no.map(r => r.speedError)).toFixed(3));
}
// the support's end bend, for arcs: rail touched at the release against no rail touched
const arcs = rows.filter(r => r.family === 'arcs' && Number.isFinite(r.endBend));
for (const [label, g] of [['rail touched at the release', arcs.filter(r => r.atRelease)], ['no rail touched', arcs.filter(r => !r.touched)]] as const) {
  const q = (p: number) => [...g.map(r => r.endBend)].sort((a, b) => a - b)[Math.floor(p * (g.length - 1))];
  console.log(`arcs, ${label}: ${g.length}; the support's bend over its last third: p10 ${q(.1).toFixed(0)}°, median ${q(.5).toFixed(0)}°, p90 ${q(.9).toFixed(0)}°; bending downward (convex) ${pc(g.filter(r => r.endBend > 2).length / g.length)}, upward ${pc(g.filter(r => r.endBend < -2).length / g.length)}`);
}
// how hard the end asks to be held at the release (above 1: the rider would leave the curve unless held)
for (const [label, g] of [['arcs, rail touched at the release', arcs.filter(r => r.atRelease && Number.isFinite(r.hold))], ['arcs, no rail touched', arcs.filter(r => !r.touched && Number.isFinite(r.hold))]] as const) {
  const q = (p: number) => [...g.map(r => r.hold)].sort((a, b) => a - b)[Math.floor(p * (g.length - 1))];
  console.log(`${label}: ${g.length}; speed² × curvature / (g cos slope) at the release: p10 ${q(.1).toFixed(2)}, median ${q(.5).toFixed(2)}, p90 ${q(.9).toFixed(2)}; above 1 ${pc(g.filter(r => r.hold > 1).length / g.length)}`);
}
process.exit(0);
