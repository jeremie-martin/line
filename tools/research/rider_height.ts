/** How tall the rider stands above the line it rides (report only): over saved rides, at every frame where a sled point
 * collides with a main line that holds the rider up, the distance of each body point from that line (along the line's
 * normal, on the rider's side). Reports the highest body point and the highest sled point per frame, as quantiles.
 *   node tools/research/rider_height.ts [--arm=2fee4728896e469a] [--seeds=101] */
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe} from '../measure/observe.ts';
import {pushSide} from '../measure/contact_role.ts';
const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const dir = join('generated/eval/arms', arg('arm', '2fee4728896e469a'), 'cells'), seeds = arg('seeds', '101').split(',');
const tops: number[] = [], sleds: number[] = [];
for (const f of readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`)))) {
  const id = f.slice(0, -5), cell = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const track = JSON.parse(gunzipSync(readFileSync(join(dir, `${id}.track.json.gz`))).toString()), lines = new Map<number, any>(track.lines.map((l: any) => [l.id, l]));
  for (const fr of observe(track, cell.terminus.frame, cell.case.targets).frames) {
    const support = fr.collisions.find(([lid, p]: number[]) => p < 4 && lines.has(lid) && pushSide(lines.get(lid)) === 'up');
    if (!support) continue;
    const l = lines.get(support[0]), dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy) || 1;
    // the rider's side of a line that holds it up is −y (screen up): distance along the up-normal
    const nx = dy / len, ny = -dx / len, s = (nx * 0 + ny * -1) > 0 ? 1 : -1;
    const h = (p: number) => s * ((fr.points[p][0] - l.x1) * nx + (fr.points[p][1] - l.y1) * ny);
    tops.push(Math.max(...[4, 5, 6, 7, 8, 9].map(h))); sleds.push(Math.max(...[0, 1, 2, 3].map(h)));
  }
}
for (const [label, xs] of [['highest body point', tops], ['highest sled point', sleds]] as const) {
  xs.sort((a, b) => a - b);
  const q = (p: number) => xs[Math.floor(p * (xs.length - 1))].toFixed(1);
  console.log(`${xs.length} frames riding a line: ${label} above it, px: p10 ${q(.1)}, p50 ${q(.5)}, p90 ${q(.9)}, p99 ${q(.99)}`);
}
process.exit(0);
