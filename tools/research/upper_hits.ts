/** How today's clean upper hits happen (report only): every strong beat (ask 0.6 or more) caught with a clean upper hit
 * or a floor hit (tools/measure/contact_role.ts), from rides `npm run compare` saved, replayed once. For each hit: the
 * gap that catches it (the one starting at the beat: its family, rail, and whether its receiver was built from the
 * opposing side, `contactSide` −1), how the rider arrives (speed, heading, rising or falling, frames in the air), how
 * the contact builds (which points touch first, how many in the first four frames, frames to the strike's peak, the
 * angle between the arrival and the line), the strike's strength against the ask, head-down, and what follows (speed
 * eight frames later, the next beat's strength against its ask). Screen y points down: a positive heading falls.
 *
 *   node tools/research/upper_hits.ts [--arm=2fee4728896e469a] [--seeds=101,202,303,404] [--out=FILE.jsonl] */
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe, POINTS} from '../measure/observe.ts';
import {pushSide, type Line} from '../measure/contact_role.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const dir = join('generated/eval/arms', arg('arm', '2fee4728896e469a'), 'cells'), seeds = arg('seeds', '101,202,303,404').split(',');
const SLED = new Set([0, 1, 2, 3]), deg = (r: number) => r * 180 / Math.PI;
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString());

/** The rider's mean velocity over its points at a frame (px/frame). */
function velocity(frame: any): [number, number] {
  let vx = 0, vy = 0;
  for (const [x, y, px, py] of frame.points) {vx += x - px; vy += y - py;}
  return [vx / frame.points.length, vy / frame.points.length];
}
/** The angle between a direction and a line, 0–90 degrees. */
function incidence([vx, vy]: [number, number], l: Line) {
  const a = Math.abs(Math.atan2(vy, vx) - Math.atan2(l.y2 - l.y1, l.x2 - l.x1)) % Math.PI;
  return deg(Math.min(a, Math.PI - a));
}

/** As upper_survival.ts: the body's offset below the sled's centre (negative = above) and the sled's pitch against the
 * arrival heading, the frame before the catch. */
function setting(frame: any, heading: number) {
  const p = (k: string) => frame.points[POINTS.indexOf(k)], sled = ['PEG', 'TAIL', 'NOSE', 'STRING'].map(p);
  const cy = sled.reduce((a: number, q: number[]) => a + q[1], 0) / 4;
  const pitch = deg(Math.atan2(p('NOSE')[1] - p('TAIL')[1], p('NOSE')[0] - p('TAIL')[0])) - heading;
  return {bodyBelow: p('SHOULDER')[1] - cy, pitch: ((pitch + 540) % 360) - 180};
}
const rows: any[] = [];
for (const f of readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`))).sort()) {
  const id = f.slice(0, -5), cell = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const gallery = gz(join(dir, `${id}.gallery.json.gz`)), track = gz(join(dir, `${id}.track.json.gz`));
  const lines = new Map<number, Line>(track.lines.map((l: Line) => [l.id, l])), sections = cell.geometry.sections;
  const obs = observe(track, cell.terminus.frame, cell.case.targets), frames = obs.frames, perBeat = cell.impact3.perBeat;
  perBeat.forEach((b: any, j: number) => {
    const h = b.hit;
    if (!h || b.requested == null || b.requested < .6 || !['upper', 'floor'].includes(h.contact)) return;
    const start = h.contactStart, s = sections[j + 1], control = gallery.result.rows[j + 1]?.control ?? {};
    if (!s || start < 2 || start + 8 >= frames.length) return;
    const before = velocity(frames[start - 1]), after = velocity(frames[start + 8]), through = velocity(frames[start + 2]);
    let air = 0; for (let t = start - 1; t > 0 && !frames[t].collisions.length; t--) air++;
    const first = frames[start].collisions, points = new Set<number>();
    for (let t = start; t < start + 4; t++) for (const [, p] of frames[t].collisions) points.add(p);
    // the first main line touched that pushes the way the hit is classified (down for upper, up for floor)
    const want = h.contact === 'upper' ? 'down' : 'up';
    const line = first.map(([lid]: number[]) => lines.get(lid)).find((l: Line | undefined) => l && pushSide(l) === want);
    const next = perBeat[j + 1];
    rows.push({ride: id, beat: j, kind: h.contact, ask: b.requested, strength: h.strength, family: s.family, guidance: s.guidance,
      rail: !!cell.character?.railDrawn?.[j + 1], opposing: control.contactSide === -1,
      ...setting(frames[start - 1], deg(Math.atan2(before[1], before[0]))),
      speedIn: Math.hypot(...before), heading: deg(Math.atan2(before[1], before[0])), rising: before[1] < 0, air,
      sledFirst: first.some(([, p]: number[]) => SLED.has(p)), firstPoints: [...new Set(first.map(([, p]: number[]) => POINTS[p]))],
      points4: points.size, build: h.peakFrame - start, incidence: line ? incidence(before, line) : null, headDown: !!h.headDown,
      speedOut: Math.hypot(...after), fallingOut: after[1] > 0,
      // the change of motion over the strike's window (contact start to two frames after) and the turn it makes
      dv: Math.hypot(through[0] - before[0], through[1] - before[1]),
      // the same change less what gravity alone would have done (0.175 px/frame² over the 3 frames): the contact's own push
      push: Math.hypot(through[0] - before[0], through[1] - before[1] - 3 * .175), turn: Math.abs(deg(Math.atan2(through[1], through[0]) - Math.atan2(before[1], before[0]))),
      nextBias: next?.hit && next.requested != null ? next.hit.strength - next.requested : null, nextStrong: next?.requested >= .6});
  });
}
if (arg('out', '')) writeFileSync(arg('out', ''), rows.map(r => JSON.stringify(r)).join('\n') + '\n');

const mean = (xs: number[]) => {const v = xs.filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;};
const share = (xs: boolean[]) => xs.length ? xs.filter(Boolean).length / xs.length : NaN;
const f2 = (x: number) => Number.isFinite(x) ? x.toFixed(2) : '—', pc = (x: number) => Number.isFinite(x) ? `${(100 * x).toFixed(0)}%` : '—';
function summary(label: string, rs: any[]) {
  return [label.padEnd(34), String(rs.length).padStart(5), f2(mean(rs.map(r => r.ask))), f2(mean(rs.map(r => r.strength))),
    f2(mean(rs.map(r => r.strength - r.ask))), f2(mean(rs.map(r => r.speedIn))), pc(share(rs.map(r => r.rising))), f2(mean(rs.map(r => r.air))),
    pc(share(rs.map(r => r.sledFirst))), f2(mean(rs.map(r => r.points4))), f2(mean(rs.map(r => r.build))), f2(mean(rs.map(r => r.incidence))),
    pc(share(rs.map(r => r.headDown))), f2(mean(rs.map(r => r.speedOut / r.speedIn))), pc(share(rs.map(r => r.fallingOut))),
    f2(mean(rs.map(r => r.dv))), f2(mean(rs.map(r => r.push))), f2(mean(rs.map(r => r.turn))), f2(mean(rs.map(r => r.strength / r.push))),
    f2(mean(rs.filter(r => r.nextStrong).map(r => r.nextBias)))].join('  ');
}
console.log(`${rows.length} strong hits (ask 0.6+) caught clean from above or on a floor; ${dir}`);
console.log(['hits'.padEnd(34), '    n', ' ask', ' got', 'bias', 'v in', 'rise', ' air', 'sled1', 'pts4', 'build', 'incid',
  'hdown', 'v out/in', 'fall out', '  dv', 'push', 'turn', 'got/push', 'next strong bias'].join('  '));
const up = rows.filter(r => r.kind === 'upper'), floor = rows.filter(r => r.kind === 'floor');
console.log(summary('clean upper', up));
console.log(summary('floor', floor));
console.log(summary('clean upper, receiver from opposing side', up.filter(r => r.opposing)));
console.log(summary('clean upper, receiver from the usual side', up.filter(r => !r.opposing)));
for (const fam of [...new Set(up.map(r => r.family))]) console.log(summary(`clean upper, ${fam}`, up.filter(r => r.family === fam)));
console.log(summary('clean upper, rising arrival', up.filter(r => r.rising)));
console.log(summary('clean upper, falling arrival', up.filter(r => !r.rising)));
console.log(summary('floor, same asks as upper (0.6-0.9)', floor.filter(r => r.ask < .9)));
// what touches first in a clean upper hit
const firsts = new Map<string, number>();
for (const r of up) for (const p of r.firstPoints) firsts.set(p, (firsts.get(p) ?? 0) + 1);
console.log('clean upper, points touching in the first frame:', [...firsts].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${pc(n / up.length)}`).join(' · '));
const ff = new Map<string, number>();
for (const r of floor) for (const p of r.firstPoints) ff.set(p, (ff.get(p) ?? 0) + 1);
console.log('clean upper (survived): body above the sled', pc(share(up.map(r => r.bodyBelow < 0))), '· pitch', f2(mean(up.map(r => r.pitch))));
console.log('floor, points touching in the first frame:', [...ff].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${pc(n / floor.length)}`).join(' · '));
process.exit(0);
