/** Where the contact frames of high-air gaps go (report only). For every gap
 * asked air >= 0.75, the frames the rider touches anything, split into: riding
 * the catch before first leaving it (launch), touches in the middle, and touching
 * the next catch before the beat (arrival); against the frames the ask allows.
 * "Middle" includes the rest of the launch ride: on a line, the rider's points
 * touch on alternate frames, so the first frame without contact is not yet the
 * takeoff. float_feasibility.ts says where the extra contact comes from.
 * node tools/research/float_contacts.ts ARM_DIR [CELLS] */
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {readJson} from '../eval/records.ts';
import {readArmTrack} from '../eval/arms.ts';
import {resolveCase} from '../eval/inputs.ts';
import {observe} from '../measure/observe.ts';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';

const dir = process.argv[2], limit = Number(process.argv[3] ?? 60), arm = {dir} as any;
const rows: Array<{L: number; ask: number; air: number; allowed: number; launch: number; middle: number; arrival: number}> = [];
for (const f of readdirSync(join(dir, 'cells')).filter(f => /\d\.json$/.test(f)).slice(0, limit)) {
  const cell = readJson(join(dir, 'cells', f));
  if (['E', 'H'].includes(cell.case.bench.stratum)) continue;
  const air = new Map(cell.gaps.filter((o: any) => o[1] === 'air' && o[3] !== null && o[2] >= .75).map((o: any) => [o[0], [o[2], o[3]]]));
  if (!air.size) continue;
  const {music} = await resolveCase(cell.case, -15), track = readArmTrack(arm, cell.case.id);
  const obs = observe(track, music.durationFrames, music.contacts), frames = [1, ...cell.beats.map((b: any) => b.frame)];
  for (const [gap, [ask, achieved]] of air as Map<number, [number, number]>) {
    const start = frames[gap], end = frames[gap + 1] ?? music.durationFrames;
    if (start === undefined || end - start < 12) continue;
    const touching = (f: number) => (obs.frames[f]?.collisions.length ?? 0) > 0;
    let launch = 0; while (start + launch < end && touching(start + launch)) launch++;
    let arrival = 0; while (end - 1 - arrival > start + launch && touching(end - 1 - arrival)) arrival++;
    let middle = 0; for (let g = start + launch; g < end - arrival; g++) if (touching(g)) middle++;
    rows.push({L: end - start, ask, air: achieved, allowed: (1 - ask) * (end - start), launch, middle, arrival});
  }
  Engine.retainOnly([]);
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
console.log(`high-air gaps (ask >= 0.75): ${rows.length}`);
for (const [name, lo, hi] of [['12-23 frames', 12, 24], ['24-39 frames', 24, 40], ['40-79 frames', 40, 80], ['80+ frames', 80, 1e9]] as const) {
  const v = rows.filter(r => r.L >= lo && r.L < hi);
  if (!v.length) continue;
  console.log(`  ${name.padEnd(13)} n=${String(v.length).padStart(4)}  air ${mean(v.map(r => r.air)).toFixed(2)} vs ask ${mean(v.map(r => r.ask)).toFixed(2)} | ` +
    `contact frames allowed ${mean(v.map(r => r.allowed)).toFixed(1)}, used ${mean(v.map(r => r.launch + r.middle + r.arrival)).toFixed(1)}: ` +
    `launch ${mean(v.map(r => r.launch)).toFixed(1)}, middle ${mean(v.map(r => r.middle)).toFixed(1)}, arrival ${mean(v.map(r => r.arrival)).toFixed(1)}`);
}
