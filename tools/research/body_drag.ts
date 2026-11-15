/** Where body drag comes from (report only). Body drag is what the ride guard counts: the rider's butt, shoulder or
 * hands (points 4–7) on a line for 6 frames or more in a row. For each such episode of saved V8 rides (`--arm`,
 * `--seeds`): whether the body is on a rail or on a main line (support, receiver, fragment), how long after the last
 * catch's contact it starts, that catch's ask and kind (floor, upper, rail; contact_role.ts) and its arrival heading,
 * and whether the rider is upside down (the sled's nose-to-tail axis past vertical) when it starts. Several arms side by
 * side, per minute of ride.
 *   node tools/research/body_drag.ts ARM [ARM...] [--seeds=101,202] */
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe} from '../measure/observe.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const arms = process.argv.slice(2).filter(a => !a.startsWith('--')), seeds = arg('seeds', '101,202').split(',');
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString());
const BODY = [4, 5, 6, 7];
for (const arm of arms) {
  const dir = join('generated/eval/arms', arm, 'cells');
  const eps: Array<{frames: number; rail: boolean; after: number; ask: number; kind: string; arrival: number; inverted: boolean}> = [];
  let minutes = 0;
  for (const f of readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`)))) {
    const id = f.slice(0, -5), cell = JSON.parse(readFileSync(join(dir, f), 'utf8')), track = gz(join(dir, `${id}.track.json.gz`));
    const guides = new Set<number>(Object.values(gz(join(dir, `${id}.gallery.json.gz`)).production?.railGuides ?? {}).flat() as number[]);
    const frames = observe(track, cell.terminus.frame, cell.case.targets).frames, last = Math.min(cell.case.durationFrames ?? frames.length - 1, frames.length - 1);
    minutes += last / 40 / 60;
    const beats = (cell.impact3?.perBeat ?? []).filter((b: any) => b.hit).map((b: any) => ({t: b.hit.contactStart, ask: b.requested ?? NaN, kind: b.hit.contact ?? '?'}));
    const vel = (t: number) => {let x = 0, y = 0; for (const [a, b, pa, pb] of frames[t].points) {x += a - pa; y += b - pb;} return [x / 10, y / 10];};
    let run = 0, start = 0, rail = false;
    for (let t = 1; t <= last + 1; t++) {
      const body = t <= last ? frames[t].collisions.filter(([, p]: number[]) => BODY.includes(p)) : [];
      if (body.length) {if (!run) {start = t; rail = false;} run++; if (body.some(([lid]: number[]) => guides.has(lid))) rail = true; continue;}
      if (run >= 6) {
        const b = beats.filter((x: any) => x.t <= start).at(-1), [vx, vy] = b && b.t > 1 ? vel(b.t - 1) : [1, 0];
        const P = frames[start].points, ax = P[2][0] - P[1][0];   // NOSE − TAIL, x: negative means past vertical
        eps.push({frames: run, rail, after: b ? start - b.t : NaN, ask: b?.ask ?? NaN, kind: b?.kind ?? '-', arrival: Math.atan2(vy, vx) * 180 / Math.PI, inverted: ax < 0});
      }
      run = 0;
    }
  }
  const sec = (g: typeof eps) => g.reduce((a, e) => a + e.frames, 0) / 40 / minutes, pc = (g: typeof eps) => `${sec(g).toFixed(2)} s/min (${g.length})`;
  console.log(`${arm}: body drag ${pc(eps)}`);
  console.log(`  on a rail ${pc(eps.filter(e => e.rail))}, main lines only ${pc(eps.filter(e => !e.rail))}; rider upside down at the start ${pc(eps.filter(e => e.inverted))}`);
  console.log(`  starting within 10 frames of a catch ${pc(eps.filter(e => e.after <= 10))}, later ${pc(eps.filter(e => !(e.after <= 10)))}`);
  console.log(`  after a catch asked: quiet <0.3 ${pc(eps.filter(e => e.ask < .3))}, middle ${pc(eps.filter(e => e.ask >= .3 && e.ask < .6))}, strong ≥0.6 ${pc(eps.filter(e => e.ask >= .6))}`);
  console.log(`  after a catch of kind: ${[...new Set(eps.map(e => e.kind))].map(k => `${k} ${pc(eps.filter(e => e.kind === k))}`).join(', ')}`);
  console.log(`  after a catch arriving: under 30° ${pc(eps.filter(e => e.arrival < 30))}, 30–45° ${pc(eps.filter(e => e.arrival >= 30 && e.arrival < 45))}, 45°+ ${pc(eps.filter(e => e.arrival >= 45))}`);
}
process.exit(0);
