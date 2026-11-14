/** What each rail changes (report only): for every gap of saved rides whose rail the rider touches, replay the ride with
 * that one rail removed and compare, up to the next beat: whether the rider still holds together; where it leaves the
 * support (frames earlier or later); and at the next beat, how far the rider's speed and heading differ from the ride's.
 * A rail whose removal changes nothing is redundant; one whose removal throws the rider off or sends the flight
 * elsewhere is doing a job. Grouped by family, by the catch's ask and by when the rail is touched.
 *   node tools/research/rail_counterfactual.ts [--arm=ARM] [--seeds=101] */
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {LineRiderEngine as Engine, disposeEngines} from '../../scripts/lib/native_motion/engine.ts';
import {observe} from '../measure/observe.ts';
import {extractRawTrajectory} from '../../scripts/lib/detector.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString()), gapOf = (id: number) => Math.floor((id - 1000) / 10000);
const dir = join('generated/eval/arms', arg('arm', ''), 'cells'), seeds = arg('seeds', '101').split(',');
const NAMES = ['PEG', 'TAIL', 'NOSE', 'STRING', 'BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT'];

/** The rider's centre velocity at frame f of an engine, and whether it is still bound to the sled. */
function stateAt(engine: any, f: number) {
  const st = engine.getRider(f).ballisticState();
  let vx = 0, vy = 0;
  for (const n of NAMES) {vx += st.points[n].x - st.points[n].prevX; vy += st.points[n].y - st.points[n].prevY;}
  return {v: [vx / 10, vy / 10], intact: st.riderMounted && st.sledIntact};
}

const rows: any[] = [];
for (const f of readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`))).sort()) {
  const id = f.slice(0, -5), cell = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const track = gz(join(dir, `${id}.track.json.gz`)), production = gz(join(dir, `${id}.gallery.json.gz`)).production ?? {};
  const guides = new Set<number>(Object.values(production.railGuides ?? {}).flat() as number[]);
  const requests: any[] = production.plan?.requests ?? [], frames = observe(track, cell.terminus.frame, cell.case.targets).frames;
  const start = track.startPosition ?? track.riders[0].startPosition, velocity = track.riders[0].startVelocity;
  for (let g = 1; g < requests.length - 1; g++) {
    const r = requests[g], to = Math.min(r.next, frames.length - 2), from = r.frame;
    const touchedAt: number[] = [];
    for (let t = from; t <= to; t++) if (frames[t].collisions.some(([lid]: number[]) => gapOf(lid) === g && guides.has(lid))) touchedAt.push(t);
    if (!touchedAt.length) continue;
    const without = track.lines.filter((l: any) => !(gapOf(l.id) === g && guides.has(l.id)));
    const engine = new Engine().setStart(start, velocity).addLine(without);
    extractRawTrajectory(engine, to + 1);   // simulate up to the next beat before reading frames
    // the rider leaves the support: its last frame touching this gap's main line, with and without the rail
    const leaves = (touches: (t: number) => boolean) => {let last = -1; for (let t = from; t <= to; t++) if (touches(t)) last = t; return last;};
    const relWith = leaves(t => frames[t].collisions.some(([lid]: number[]) => gapOf(lid) === g && !guides.has(lid)));
    let intact = true;
    const relWithout = leaves(t => {
      const ids: number[] = engine.getAllContactLineIdsAtFrame(t);
      if (!stateAt(engine, t).intact) intact = false;
      return ids.some(lid => gapOf(lid) === g && !guides.has(lid));
    });
    const a = stateAt(engine, to), fr = frames[to];
    let vx = 0, vy = 0; for (const [x, y, px, py] of fr.points) {vx += x - px; vy += y - py;} vx /= fr.points.length; vy /= fr.points.length;
    const speedWith = Math.hypot(vx, vy), speedWithout = Math.hypot(a.v[0], a.v[1]);
    const headingDiff = Math.abs(((Math.atan2(a.v[1], a.v[0]) - Math.atan2(vy, vx)) * 180 / Math.PI + 540) % 360 - 180);
    const b = cell.impact3.perBeat[g - 1];
    rows.push({ride: id, gap: g, family: cell.geometry.sections[g]?.family, ask: b?.requested ?? null, intact: intact && a.intact,
      releaseShift: relWithout - relWith, speedRatio: speedWithout / Math.max(.1, speedWith), headingDiff,
      when: touchedAt.some(t => t >= relWith - 3 && t <= relWith) ? 'release' : touchedAt[0] < from + 4 ? 'catch' : 'support'});
    disposeEngines();
  }
}
const pc = (x: number) => `${(100 * x).toFixed(0)}%`;
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
const summary = (label: string, g: any[]) => {
  if (!g.length) return;
  const ok = g.filter(r => r.intact), matters = ok.filter(r => Math.abs(r.speedRatio - 1) > .05 || r.headingDiff > 5);
  console.log(`${label.padEnd(30)} ${String(g.length).padStart(5)} rails | rider thrown off without it ${pc(1 - ok.length / g.length)} | leaves the support earlier ${pc(ok.filter(r => r.releaseShift < 0).length / Math.max(1, ok.length))} (median ${q(ok.map(r => r.releaseShift), .5)} f) | next beat: heading off by median ${q(ok.map(r => r.headingDiff), .5).toFixed(1)}°, speed ×${q(ok.map(r => r.speedRatio), .5).toFixed(2)} | changes the flight (>5° or >5%) ${pc(matters.length / Math.max(1, ok.length))}`);
};
console.log(`${new Set(rows.map(r => r.ride)).size} rides; each touched rail removed alone, the ride replayed up to the next beat`);
summary('all touched rails', rows);
for (const w of ['catch', 'support', 'release']) summary(`touched first at the ${w}`, rows.filter(r => r.when === w));
for (const fam of ['arcs', 'fold', 'serpentine', 'scallops', 'terraces', 'scattered']) summary(fam, rows.filter(r => r.family === fam));
for (const [label, f] of [['strong asks', (r: any) => r.ask >= .6], ['middle asks', (r: any) => r.ask >= .3 && r.ask < .6], ['quiet asks', (r: any) => r.ask < .3]] as const) summary(label, rows.filter(f));
process.exit(0);
