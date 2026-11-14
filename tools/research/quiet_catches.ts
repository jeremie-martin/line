/** Where quiet catches get their extra strength (report only). For every beat of saved V8 rides asking under 0.3 and
 * caught, from a replay: the rider's speed just before the contact, the incidence (the angle between its velocity and
 * the line it touches first, 0 = tangent), how many frames it flew before (no contact at all), the gap's family, and
 * the heading turn over the strike's window (contact start to 6 frames after), the sled's angle to that line (its
 * tail→nose axis; 0 = flat on it), the rider's spin before the contact (deg/frame, from the angular momentum), and the
 * travel part of the strength alone (the largest 2-frame contact impulse of the centre of mass, ÷ 7.55, spin left out,
 * over the strike's 6 frames). Overshoot = strength − ask. Groups
 * show which of these goes with the overshoot. Screen y down.
 *   node tools/research/quiet_catches.ts --arm=ARM [--seeds=101,202,303,404] [--max-ask=0.3] */
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe} from '../measure/observe.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString());
const dir = join('generated/eval/arms', arg('arm', ''), 'cells'), seeds = arg('seeds', '101,202,303,404').split(','), maxAsk = Number(arg('max-ask', '.3'));
const deg = (r: number) => r * 180 / Math.PI;
const rows: any[] = [];
for (const f of readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`))).sort()) {
  const id = f.slice(0, -5), cell = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const beats = (cell.impact3?.perBeat ?? []).map((b: any, k: number) => ({b, k})).filter(({b}: any) => b.hit && b.requested != null && b.requested < maxAsk);
  if (!beats.length) continue;
  const track = gz(join(dir, `${id}.track.json.gz`)), frames = observe(track, cell.terminus.frame, cell.case.targets).frames;
  const byId = new Map<number, any>(track.lines.map((l: any) => [l.id, l])), sections = cell.geometry?.sections ?? [];
  const vel = (t: number) => {let x = 0, y = 0; for (const [a, b, pa, pb] of frames[t].points) {x += a - pa; y += b - pb;} return [x / 10, y / 10];};
  for (const {b, k} of beats) {
    const c0 = b.hit.contactStart; if (c0 < 2 || c0 + 7 >= frames.length) continue;
    const first = frames[c0].collisions.map(([lid]: number[]) => byId.get(lid)).find(Boolean); if (!first) continue;
    const [vx, vy] = vel(c0 - 1), speed = Math.hypot(vx, vy);
    const lineAngle = Math.atan2(first.y2 - first.y1, first.x2 - first.x1), moveAngle = Math.atan2(vy, vx);
    let incidence = Math.abs(deg(moveAngle - lineAngle)) % 180; if (incidence > 90) incidence = 180 - incidence;
    let flew = 0; for (let t = c0 - 1; t > 0 && !frames[t].collisions.length; t--) flew++;
    const [ax, ay] = vel(c0 + 6), turn = Math.abs(((deg(Math.atan2(ay, ax) - moveAngle) + 540) % 360) - 180);
    const P = (t: number, i: number) => frames[t].points[i];
    const sledAngle = Math.atan2(P(c0, 2)[1] - P(c0, 1)[1], P(c0, 2)[0] - P(c0, 1)[0]);
    let pose = Math.abs(deg(sledAngle - lineAngle)) % 360; if (pose > 180) pose = 360 - pose;
    // spin: the angle swept by the tail→nose axis per frame over the 3 frames before contact
    const axis = (t: number) => Math.atan2(P(t, 2)[1] - P(t, 1)[1], P(t, 2)[0] - P(t, 1)[0]);
    const spin = Math.abs(((deg(axis(c0 - 1) - axis(c0 - 4)) + 540) % 360) - 180) / 3;
    let travel = 0;
    for (let t = c0; t < c0 + 6; t++) {const [x0, y0] = vel(t - 1), [x2, y2] = vel(t + 1); travel = Math.max(travel, Math.hypot(x2 - x0, y2 - y0 - 2 * .175));}
    rows.push({pose, spin, travel: travel / 7.55, ride: id, ask: b.requested, got: b.hit.strength, over: b.hit.strength - b.requested, speed, incidence, flew, turn,
      family: sections[k + 1]?.family ?? '?', contact: b.hit.contact});
  }
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length), q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
const line = (label: string, g: any[]) => g.length && console.log(`${label.padEnd(30)} ${String(g.length).padStart(5)} | overshoot mean ${mean(g.map(r => r.over)).toFixed(3).padStart(6)}, p90 ${q(g.map(r => r.over), .9).toFixed(3).padStart(6)} | over 0.1: ${(100 * g.filter(r => r.over > .1).length / g.length).toFixed(0).padStart(3)}% | speed ${mean(g.map(r => r.speed)).toFixed(1)}, incidence ${q(g.map(r => r.incidence), .5).toFixed(0)}°, flew ${q(g.map(r => r.flew), .5)} f, turn ${q(g.map(r => r.turn), .5).toFixed(0)}°, pose ${q(g.map(r => r.pose), .5).toFixed(0)}°, spin ${q(g.map(r => r.spin), .5).toFixed(1)}°/f, travel part ${mean(g.map(r => r.travel)).toFixed(3)} of strength ${mean(g.map(r => r.got)).toFixed(3)}`);
console.log(`${rows.length} caught beats asking under ${maxAsk} (${new Set(rows.map(r => r.ride)).size} rides)`);
line('all', rows);
for (const [a, b] of [[0, .1], [.1, .2], [.2, .3]]) line(`ask ${a}–${b}`, rows.filter(r => r.ask >= a && r.ask < b));
console.log('-- by incidence (angle between the arrival and the line touched)');
for (const [a, b] of [[0, 3], [3, 6], [6, 10], [10, 20], [20, 90]]) line(`incidence ${a}–${b}°`, rows.filter(r => r.incidence >= a && r.incidence < b));
console.log('-- by frames flown before the contact');
for (const [a, b] of [[0, 1], [1, 5], [5, 15], [15, 40], [40, 9999]]) line(`flew ${a}–${b} frames`, rows.filter(r => r.flew >= a && r.flew < b));
console.log('-- by arrival speed (px/frame)');
for (const [a, b] of [[0, 5], [5, 8], [8, 11], [11, 99]]) line(`speed ${a}–${b}`, rows.filter(r => r.speed >= a && r.speed < b));
console.log('-- by the sled\'s angle to the line at contact');
for (const [a, b] of [[0, 5], [5, 10], [10, 20], [20, 40], [40, 181]]) line(`pose ${a}–${b}°`, rows.filter(r => r.pose >= a && r.pose < b));
console.log('-- by spin before contact');
for (const [a, b] of [[0, .5], [.5, 1], [1, 2], [2, 4], [4, 99]]) line(`spin ${a}–${b}°/f`, rows.filter(r => r.spin >= a && r.spin < b));
console.log('-- by family of the catching gap, and contact kind');
for (const fam of [...new Set(rows.map(r => r.family))]) line(`family ${fam}`, rows.filter(r => r.family === fam));
for (const k of [...new Set(rows.map(r => r.contact))]) line(`contact ${k}`, rows.filter(r => r.contact === k));
process.exit(0);
