/** How varied the flights of saved rides are (report only), to check that a change does not make rides uniform. For
 * every gap of V8 rides (`--arm`, `--seeds`): the launch heading (the rider's centre velocity just after it last
 * touches the gap's own lines), the arrival heading into the next catch (just before it), the flight's length in
 * frames, and the next beat's ask. Headings + up, − down. Reported: quantiles over all gaps; the spread within a ride
 * (standard deviation of each ride's arrival headings, then the median over rides); the share of launches upward by
 * more than 10°; by the next ask (quiet under 0.3, strong 0.6 and up). Several arms side by side.
 *   node tools/research/flight_variety.ts ARM [ARM...] [--seeds=101,202,303,404] */
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {observe} from '../measure/observe.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const arms = process.argv.slice(2).filter(a => !a.startsWith('--')), seeds = arg('seeds', '101,202,303,404').split(',');
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString()), gapOf = (id: number) => Math.floor((id - 1000) / 10000);
const deg = (r: number) => r * 180 / Math.PI;
const q = (xs: number[], p: number) => xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))] : NaN;
const sd = (xs: number[]) => {const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);};
for (const arm of arms) {
  const dir = join('generated/eval/arms', arm, 'cells'), rows: Array<{launch: number; arrival: number; flight: number; ask: number}> = [], perRide: number[] = [];
  for (const f of readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`)))) {
    const id = f.slice(0, -5), cell = JSON.parse(readFileSync(join(dir, f), 'utf8')), track = gz(join(dir, `${id}.track.json.gz`));
    const requests: any[] = gz(join(dir, `${id}.gallery.json.gz`)).production?.plan?.requests ?? [];
    const frames = observe(track, cell.terminus.frame, cell.case.targets).frames, pb = cell.impact3.perBeat;
    const vel = (t: number) => {let x = 0, y = 0; for (const [a, b, pa, pbb] of frames[t].points) {x += a - pa; y += b - pbb;} return [x / 10, y / 10];};
    const ride: number[] = [];
    for (let g = 1; g + 1 < requests.length; g++) {
      const from = requests[g].frame, next = requests[g + 1].frame;
      if (next >= frames.length - 1) break;
      let release = -1;
      for (let t = from; t < next; t++) if (frames[t].collisions.some(([lid]: number[]) => gapOf(lid) === g)) release = t;
      if (release < 0 || next - release < 3) continue;
      const [lx, ly] = vel(release + 1), [ax, ay] = vel(next - 1);
      const r = {launch: -deg(Math.atan2(ly, lx)), arrival: -deg(Math.atan2(ay, ax)), flight: next - release, ask: pb[g]?.requested ?? NaN};
      rows.push(r); ride.push(r.arrival);
    }
    if (ride.length > 3) perRide.push(sd(ride));
  }
  const line = (label: string, g: typeof rows) => g.length && console.log(`  ${label.padEnd(22)} ${String(g.length).padStart(5)} flights | launch p10/50/90 ${[.1, .5, .9].map(p => q(g.map(r => r.launch), p).toFixed(0)).join('/')}°, upward >10° ${(100 * g.filter(r => r.launch > 10).length / g.length).toFixed(0)}% | arrival p10/50/90 ${[.1, .5, .9].map(p => q(g.map(r => r.arrival), p).toFixed(0)).join('/')}° | flight p10/50/90 ${[.1, .5, .9].map(p => q(g.map(r => r.flight), p).toFixed(0)).join('/')} frames`);
  console.log(`${arm}: spread of arrival headings within a ride, median ${q(perRide, .5).toFixed(1)}° (p10 ${q(perRide, .1).toFixed(1)}, p90 ${q(perRide, .9).toFixed(1)})`);
  line('all', rows); line('before a quiet beat', rows.filter(r => r.ask < .3)); line('before a strong beat', rows.filter(r => r.ask >= .6));
}
process.exit(0);
