/** How the rider meets the track, per arm (report only; unvalidated against the owner's eye).
 * Replays each saved ride frame by frame (tools/measure/observe.ts) and classifies every
 * collision by the line touched and the side it is touched from:
 *   - from above (an upper hit): the line lies above the touching point and pushes it down;
 *   - on a guide: the line is one of the section's rail guides;
 *   - sled or body: which rider points touch.
 * Per ride it reports, per minute of ride or as shares:
 *   upper-hit beats    beats whose matched hit touches a line from above, rails included (strong beats apart)
 *   clean upper hits   strong beats caught on a line's underside with no rail touched (contact_role.ts)
 *   upper contact      seconds per minute with any contact from above
 *   guide contact      seconds per minute touching a guide
 *   riding             share of time with the sled on a line; long ride-outs = unbroken sled
 *                      contact of 1 s or more (seconds per minute)
 *   air                share of time with no contact; flights of 1 s or more per minute
 *   body contact       seconds per minute with body points touching (BUTT, SHOULDER, hands: the body-drag guard's points)
 * Then each arm against the first, paired by ride (bootstrap over rides).
 *   node tools/research/ride_character.ts NAME=ARM_DIR NAME2=ARM_DIR2 ... [--jobs=N] */
import {readFileSync, readdirSync, writeFileSync, mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {gunzipSync} from 'node:zlib';
import {observe} from '../measure/observe.ts';
import {WorkerPool, workerJobs} from '../../scripts/lib/workers.ts';
import {pushSide, hitKind} from '../measure/contact_role.ts';

const SLED = [0, 1, 2, 3], BODY = [4, 5, 6, 7]; // BODY as the body-drag guard and the reports count it

function character(armDir: string, ride: string) {
  const cell = JSON.parse(readFileSync(join(armDir, 'cells', `${ride}.json`), 'utf8'));
  const gallery = JSON.parse(gunzipSync(readFileSync(join(armDir, 'cells', `${ride}.gallery.json.gz`))).toString('utf8'));
  const track = gallery.result.track, targets = cell.case.targets, duration = cell.terminus?.frame ?? targets.at(-1).frame + 40;
  const lines = new Map<number, any>(track.lines.map((l: any) => [l.id, l]));
  const guides = new Set<number>(Object.values(gallery.production?.railGuides ?? {}).flat() as number[]);
  const obs = observe(track, duration, targets);
  const last = Math.min(duration, obs.frames.length - 1);
  // Contact kinds and push sides: tools/measure/contact_role.ts (the reports' definition). "From above" here is any line
  // pushing the rider down, rails included; a clean upper hit touches no rail (hitKind).
  const fromAbove = (lineId: number) => {const l = lines.get(lineId); return !!l && pushSide(l) === 'down';};
  const collisions = obs.frames.map((fr: any) => fr.collisions);
  let upper = 0, guide = 0, sled = 0, air = 0, body = 0, longRide = 0, longFlight = 0, run = 0, flight = 0;
  const upperFrames = new Set<number>();
  for (let f = 1; f <= last; f++) {
    const c = obs.frames[f].collisions;
    const up = c.some(([id]: number[]) => fromAbove(id));
    if (up) { upper++; upperFrames.add(f); }
    if (c.some(([id]: number[]) => guides.has(id))) guide++;
    const onSled = c.some(([, k]: number[]) => SLED.includes(k));
    if (c.some(([, k]: number[]) => BODY.includes(k))) body++;
    if (onSled) sled++;
    run = onSled ? run + 1 : 0; if (run === 40) longRide += 40; else if (run > 40) longRide++;
    flight = c.length ? 0 : flight + 1; if (!c.length) air++;
    if (flight === 40) longFlight++;
  }
  const perMinute = (frames: number) => frames / 40 / (last / 40 / 60);
  const beats = cell.impact3?.perBeat ?? [];
  const hitAbove = (b: any) => b.hit && [0, 1, 2].some(d => upperFrames.has(b.hit.contactStart + d));
  const clean = (b: any) => b.hit && hitKind(collisions, b.hit.contactStart, lines, guides) === 'upper';
  const hit = beats.filter((b: any) => b.hit), strong = hit.filter((b: any) => b.requested >= .6);
  return {ride, song: ride.split('~')[0],
    upperBeats: hit.filter(hitAbove).length / Math.max(1, hit.length), upperStrong: strong.filter(hitAbove).length / Math.max(1, strong.length),
    cleanStrong: strong.filter(clean).length / Math.max(1, strong.length),
    upperContact: perMinute(upper), guideContact: perMinute(guide), riding: sled / last, longRides: perMinute(longRide),
    air: air / last, longFlights: longFlight / (last / 40 / 60), bodyContact: perMinute(body)};
}

const FIELDS: Array<[string, string, (v: number) => string]> = [
  ['upperBeats', 'beats hit from above, rails included', v => `${(100 * v).toFixed(1)}%`],
  ['upperStrong', 'strong beats hit from above, rails included', v => `${(100 * v).toFixed(1)}%`],
  ['cleanStrong', 'strong beats, clean upper hits', v => `${(100 * v).toFixed(1)}%`],
  ['upperContact', 'contact from above, s/min', v => v.toFixed(2)],
  ['guideContact', 'guide contact, s/min', v => v.toFixed(2)],
  ['riding', 'time with the sled on a line', v => `${(100 * v).toFixed(1)}%`],
  ['longRides', 'ride-outs of 1 s or more, s/min', v => v.toFixed(2)],
  ['air', 'time in the air', v => `${(100 * v).toFixed(1)}%`],
  ['longFlights', 'flights of 1 s or more, per min', v => v.toFixed(2)],
  ['bodyContact', 'body contact, s/min', v => v.toFixed(2)],
];

const args = process.argv.slice(2);
if (args[0] === 'worker') {
  const [, armDir, ride, out] = args;
  writeFileSync(out, JSON.stringify(character(armDir, ride)));
} else {
  const arms = Object.fromEntries(args.filter(a => a.includes('=') && !a.startsWith('--')).map(a => a.split('=', 2)));
  const jobs = args.find(a => a.startsWith('--jobs='))?.slice(7);
  const rides = Object.values(arms).map(d => new Set(readdirSync(join(d as string, 'cells')).filter(f => f.endsWith('.gallery.json.gz')).map(f => f.slice(0, -16))))
    .reduce((a, b) => new Set([...a].filter(x => b.has(x))));
  const tmp = mkdtempSync(join(tmpdir(), 'ride-character-')), pool = new WorkerPool(workerJobs(jobs));
  const queue = Object.entries(arms).flatMap(([name, dir]) => [...rides].sort().map(ride => ({name, dir: dir as string, ride, out: join(tmp, `${name}~${ride}.json`)})));
  await pool.run(queue, q => pool.worker([import.meta.filename, 'worker', q.dir, q.ride, q.out]));
  const results: Record<string, Record<string, any>> = {};
  for (const q of queue) (results[q.name] ??= {})[q.ride] = JSON.parse(readFileSync(q.out, 'utf8'));
  const names = Object.keys(arms), mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log(`${rides.size} rides per arm\n${'measure'.padEnd(36)}${names.map(n => n.padStart(14)).join('')}`);
  for (const [key, label, fmt] of FIELDS) console.log(label.padEnd(36) + names.map(n => fmt(mean(Object.values(results[n]).map((r: any) => r[key]))).padStart(14)).join(''));
  let seed = 1; const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  for (const n of names.slice(1)) {
    console.log(`\n${n} against ${names[0]}, paired by ride (mean difference, bootstrap 95% over rides)`);
    for (const [key, label] of FIELDS) {
      const d = [...rides].map(r => results[n][r][key] - results[names[0]][r][key]);
      const boots = Array.from({length: 2000}, () => mean(Array.from({length: d.length}, () => d[Math.floor(rand() * d.length)]))).sort((a, b) => a - b);
      const scale = (key.startsWith('upper') || key === 'cleanStrong') && !key.endsWith('Contact') || key === 'riding' || key === 'air' ? 100 : 1, unit = scale === 100 ? ' pts' : '';
      console.log(`  ${label.padEnd(34)} ${(scale * mean(d)).toFixed(2).padStart(7)}${unit} [${(scale * boots[50]).toFixed(2)}, ${(scale * boots[1949]).toFixed(2)}]`);
    }
  }
}
