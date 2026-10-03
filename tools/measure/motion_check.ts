/** Motion check for a review library against the previous one, with the rules of
 * the October 1 motion qualification (benchmark/v6/policy.ts): burst burden must
 * fall by half, the owner's three reported acceleration windows must have no
 * 100 ms burst excess, and the Luna/Tiki openings must stay within 1.35x the
 * ordinary reference's corrections.
 *
 *   node --import tsx tools/measure/motion_check.ts --library=DIR --previous=DIR */
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';
import {extractRawTrajectory} from '../../scripts/lib/detector.ts';
import {motionSamples, summarizeMotion} from '../../scripts/v0/optimizer/motion_quality.ts';
import {productionSongs, productionSeeds, reportedWindows} from '../../benchmark/v6/production_qualification.ts';
import {policy} from '../../benchmark/v6/policy.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const cell = (dir: string, song: string, seed: number, method: string) => {
  const path = join(dir, `${song}-${seed}`, `${song}-${seed}-${method}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
};
function motion(track: any, durationFrames: number) {
  const engine = new Engine().setStart(track.startPosition, track.riders[0].startVelocity).addLine(track.lines);
  const raw = extractRawTrajectory(engine, durationFrames + 1), samples = motionSamples(raw.frames, 1, durationFrames);
  return {samples, full: summarizeMotion(samples, 1)};
}
const window = (samples: any[], from: number, to: number) => summarizeMotion(samples.filter(s => s.frame >= from * 40 && s.frame < to * 40), Math.round(from * 40));
const burden = (rows: any[], frames: number) => rows.reduce((n, r) => n + r.full.bursts.find((b: any) => b.frames === frames).excessIntegral, 0) /
  (rows.reduce((n, r) => n + r.duration, 0) / 40);
const library = arg('library')!, previous = arg('previous')!;
const rows: Record<string, any[]> = {next: [], old: [], ordinary: []};
for (const song of productionSongs) for (const seed of productionSeeds) {
  for (const [key, dir, method] of [['next', library, 'production'], ['old', previous, 'production'], ['ordinary', previous, 'baseline']] as const) {
    const c = cell(dir, song, seed, method);
    if (!c) {if (key !== 'ordinary') throw new Error(`missing ${key} ${song} ${seed}`); continue;}
    const duration = c.case?.durationFrames ?? c.durationFrames ?? Math.round(c.track.duration);
    rows[key].push({song, seed, duration, ...motion(c.track, duration)});
  }
}
let failures = 0;
for (const frames of [1, 4, 10]) {
  const before = burden(rows.old, frames), after = burden(rows.next, frames), passed = after <= before * (1 - policy.qualification.burstExcessReduction) + 1e-9;
  failures += passed ? 0 : 1;
  console.log(`burst burden ${String(frames).padStart(2)}-frame: previous ${before.toFixed(5)} -> ${after.toFixed(5)} (ratio ${(after / before).toFixed(2)})  ${passed ? 'pass' : 'FAIL'}`);
}
for (const w of reportedWindows) {
  const r = rows.next.find(r => r.song === w.song && r.seed === w.seed)!, band = window(r.samples, w.from, w.to).bursts.find((b: any) => b.frames === 4)!;
  const passed = band.maxExcess <= 1e-9; failures += passed ? 0 : 1;
  console.log(`reported window ${w.song} #${w.seed} ${w.from}-${w.to}s: max 100 ms excess ${band.maxExcess.toFixed(4)}  ${passed ? 'pass' : 'FAIL'}`);
}
for (const song of ['luna_bala_44s', 'tiki_tiki_48s'])
  for (const metric of ['absoluteCorrection', 'directionCorrection'] as const) {
    const opening = (r: any) => window(r.samples, 0, 2.4)[metric];
    const mean = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / xs.length;
    const ordinary = rows.ordinary.filter(r => r.song === song), next = rows.next.filter(r => r.song === song);
    if (!ordinary.length) {console.log(`opening ${song} ${metric}: no ordinary reference`); continue;}
    const reference = mean(ordinary.map(opening)), actual = mean(next.map(opening)), passed = actual <= reference * policy.qualification.quietReferenceMultiplier + 1e-9;
    failures += passed ? 0 : 1;
    console.log(`opening ${song} ${metric}: ordinary ${reference.toFixed(3)} new ${actual.toFixed(3)} (limit x${policy.qualification.quietReferenceMultiplier})  ${passed ? 'pass' : 'FAIL'}`);
  }
console.log(failures ? `${failures} check(s) failed` : 'all motion checks pass');
