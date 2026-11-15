/** Which arrival heading goes with a well-landed catch, by the catch's ask (report only). For every catch of saved V8
 * rides (`--arm`, `--seeds`): its ask, the rider's heading just before the contact (+ falling, screen y down), the
 * strength it landed at, and the speed error of the gap it starts (the flight it launches; cell.gaps). Grouped by ask
 * band and arrival heading: how many catches, the median relative miss |ln((got + 0.03) / (ask + 0.03))|, the share
 * within ×1.5, and the mean speed error after. The heading band with the smallest relative miss per ask band, if it
 * rises smoothly with the ask, is a candidate for one continuous arrival law.
 *   node tools/research/arrival_law.ts --arm=ARM [--seeds=101,202,303,404] */
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe} from '../measure/observe.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString());
const dir = join('generated/eval/arms', arg('arm', ''), 'cells'), seeds = arg('seeds', '101,202,303,404').split(',');
const rows: Array<{ask: number; heading: number; miss: number; speedAfter: number}> = [];
for (const f of readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`)))) {
  const id = f.slice(0, -5), cell = JSON.parse(readFileSync(join(dir, f), 'utf8')), track = gz(join(dir, `${id}.track.json.gz`));
  const frames = observe(track, cell.terminus.frame, cell.case.targets).frames;
  const vel = (t: number) => {let x = 0, y = 0; for (const [a, b, pa, pb] of frames[t].points) {x += a - pa; y += b - pb;} return [x / 10, y / 10];};
  (cell.impact3?.perBeat ?? []).forEach((b: any, k: number) => {
    if (!b.hit || b.requested == null || b.hit.contactStart < 2 || b.hit.contactStart >= frames.length) return;
    const [vx, vy] = vel(b.hit.contactStart - 1);
    const sg = (cell.gaps ?? []).find((x: any) => x[0] === k + 1 && x[1] === 'speed');
    rows.push({ask: b.requested, heading: Math.atan2(vy, vx) * 180 / Math.PI, miss: Math.abs(Math.log((b.hit.strength + .03) / (b.requested + .03))),
      speedAfter: sg ? sg[3] - sg[2] : NaN});
  });
}
const q = (xs: number[], p: number) => xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))] : NaN;
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
const ASKS: Array<[number, number]> = [[0, .1], [.1, .2], [.2, .3], [.3, .45], [.45, .6], [.6, .8], [.8, 1.01]];
const HEADS: Array<[number, number]> = [[-90, 0], [0, 10], [10, 20], [20, 30], [30, 45], [45, 60], [60, 180]];
console.log(`${rows.length} catches; cells: catches, median relative miss, within ×1.5, speed error after`);
console.log('ask \\ arrival'.padEnd(13) + HEADS.map(([a, b]) => `${a}…${b}°`.padStart(24)).join(''));
for (const [a, b] of ASKS) {
  const band = rows.filter(r => r.ask >= a && r.ask < b);
  let best = '', bestMiss = Infinity;
  const cells = HEADS.map(([h0, h1]) => {
    const g = band.filter(r => r.heading >= h0 && r.heading < h1);
    if (g.length < 25) return (g.length ? `${g.length} (few)` : '–').padStart(24);
    const m = q(g.map(r => r.miss), .5);
    if (m < bestMiss) {bestMiss = m; best = `${h0}…${h1}°`;}
    return `${g.length} ${m.toFixed(2)} ${(100 * g.filter(r => r.miss < Math.log(1.5)).length / g.length).toFixed(0)}% ${mean(g.map(r => r.speedAfter).filter(Number.isFinite)) >= 0 ? '+' : ''}${mean(g.map(r => r.speedAfter).filter(Number.isFinite)).toFixed(3)}`.padStart(24);
  });
  console.log(`${a.toFixed(2)}–${Math.min(1, b).toFixed(2)}`.padEnd(13) + cells.join('') + `   best ${best}, median heading now ${q(band.map(r => r.heading), .5).toFixed(0)}°`);
}
process.exit(0);
