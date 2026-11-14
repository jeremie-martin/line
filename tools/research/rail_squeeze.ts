/** Rails that squeeze the rider (report only). For every gap of saved rides whose rail the rider touches: how close the
 * touched rail pieces lie to the gap's support (the rider stands about 10 px above the line it rides, the sled about 6
 * px: tools/research/rider_height.ts), how many of those frames also touch the support (pinched between the two), and
 * the rider's speed change over the touch against what gravity alone gives (0.175 × the sine of its heading per frame,
 * screen y down). A rider pushed out of a gap smaller than its body gains speed no slope explains: the owner saw it as
 * "a sharp turn at the end, almost an acceleration" (Circus, 12 s). Grouped by the rail's distance to its support.
 *   node tools/research/rail_squeeze.ts [--arm=ARM] [--seeds=101,202,303,404] */
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe} from '../measure/observe.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString()), gapOf = (id: number) => Math.floor((id - 1000) / 10000);
const dir = join('generated/eval/arms', arg('arm', ''), 'cells'), seeds = arg('seeds', '101,202,303,404').split(',');
type L = {id: number; x1: number; y1: number; x2: number; y2: number};
const segDist = (px: number, py: number, l: L) => {
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1, t = Math.max(0, Math.min(1, ((px - l.x1) * dx + (py - l.y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - l.x1 - t * dx, py - l.y1 - t * dy);
};
const rows: Array<{distance: number; pinched: number; frames: number; beyond: number; family: string}> = [];
for (const f of readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`))).sort()) {
  const id = f.slice(0, -5), cell = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const track = gz(join(dir, `${id}.track.json.gz`)), production = gz(join(dir, `${id}.gallery.json.gz`)).production ?? {};
  const requests: any[] = production.plan?.requests ?? [], railGuides = production.railGuides ?? {};
  const frames = observe(track, cell.terminus.frame, cell.case.targets).frames;
  const byId = new Map<number, L>(track.lines.map((l: L) => [l.id, l]));
  const vel = (t: number) => {let x = 0, y = 0; for (const [a, b, pa, pb] of frames[t].points) {x += a - pa; y += b - pb;} return [x / 10, y / 10];};
  for (let g = 1; g < requests.length - 1; g++) {
    const rail = new Set<number>((railGuides[g] ?? []).filter((x: number) => byId.has(x)));
    if (!rail.size) continue;
    const end = Math.min(requests[g + 1].frame, frames.length - 2), touched: number[] = [], pieces = new Set<number>();
    for (let t = requests[g].frame; t < end; t++) for (const [lid] of frames[t].collisions) if (rail.has(lid)) {pieces.add(lid); if (touched.at(-1) !== t) touched.push(t);}
    if (!touched.length) continue;
    const support = track.lines.filter((l: L) => gapOf(l.id) === g && !rail.has(l.id));
    let distance = Infinity;
    for (const p of pieces) {const l = byId.get(p)!; for (const s of support) distance = Math.min(distance, segDist(l.x1, l.y1, s), segDist(l.x2, l.y2, s), segDist((l.x1 + l.x2) / 2, (l.y1 + l.y2) / 2, s));}
    const pinched = touched.filter(t => frames[t].collisions.some(([lid]: number[]) => gapOf(lid) === g && !rail.has(lid))).length;
    const a = Math.max(1, touched[0] - 1), b = Math.min(frames.length - 1, touched.at(-1)! + 1);
    let gravity = 0; for (let t = a; t < b; t++) {const [x, y] = vel(t); gravity += .175 * y / Math.max(.01, Math.hypot(x, y));}
    const [ax, ay] = vel(a), [bx, by] = vel(b);
    rows.push({distance, pinched, frames: touched.length, beyond: Math.hypot(bx, by) - Math.hypot(ax, ay) - gravity, family: requests[g].construction});
  }
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length), pc = (x: number) => `${(100 * x).toFixed(0)}%`;
console.log(`${rows.length} touched rails in ${dir}; speed beyond gravity over the touch (px/frame), by the touched rail's distance to its support`);
console.log('distance'.padEnd(10), 'rails'.padStart(6), 'share'.padStart(6), '| pinched frames', '| beyond gravity: mean', 'gain > 0.3', 'lose > 0.3');
const edges = [0, 4, 6, 8, 10, 12, 16, 24, Infinity];
for (let k = 0; k + 1 < edges.length; k++) {
  const g = rows.filter(r => r.distance >= edges[k] && r.distance < edges[k + 1]);
  if (!g.length) continue;
  console.log(`${edges[k]}–${edges[k + 1] === Infinity ? '' : edges[k + 1]} px`.padEnd(10), String(g.length).padStart(6), pc(g.length / rows.length).padStart(6),
    '|', pc(mean(g.map(r => r.pinched / r.frames))).padStart(13), '|', mean(g.map(r => r.beyond)).toFixed(2).padStart(20),
    pc(g.filter(r => r.beyond > .3).length / g.length).padStart(10), pc(g.filter(r => r.beyond < -.3).length / g.length).padStart(10));
}
for (const fam of ['arcs', 'fold', 'serpentine', 'scallops', 'terraces', 'scattered']) {
  const g = rows.filter(r => r.family === fam); if (!g.length) continue;
  console.log(`${fam.padEnd(11)} ${g.length} touched rails; within 10 px of the support ${pc(g.filter(r => r.distance < 10).length / g.length)}; gain beyond gravity > 0.3: ${pc(g.filter(r => r.beyond > .3).length / g.length)}`);
}
process.exit(0);
