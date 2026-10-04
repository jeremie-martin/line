/** Blind pair key for the owner: random strong beats (request ≥ 0.6) of two eval
 * runs with saved tracks, same song, seed and beat, sides shuffled; not selected
 * by any measure, so the answers are a fair perceptual check of the change.
 *
 *   node --import tsx tools/report/morning_study.ts --a=<run> --b=<run> --study=<id> [--pairs=16] [--seed=11] */
import {writeFileSync} from 'node:fs';
import {loadRun} from '../eval/summary.ts';
import {makeRng} from '../../scripts/lib/rng.ts';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const a = arg('a')!, b = arg('b')!, study = arg('study')!, n = Number(arg('pairs', '16')), rng = makeRng(Number(arg('seed', '11')));
const A = loadRun(a), B = loadRun(b), pool: any[] = [];
for (const [id, ca] of A.cells) {
  const cb = B.cells.get(id); if (!cb || ca.case.perturbation) continue;
  ca.impact3.perBeat.forEach((r: any[], j: number) => {
    const s = cb.impact3.perBeat[j], frame = ca.beats[j]?.frame ?? Math.round(ca.beats[j].t * 40);
    if (r[0] == null || r[0] < .6 || r[1] == null || s[1] == null || frame < 48) return;
    pool.push({song: ca.case.song, seed: ca.case.seed, beat: j, requested: r[0],
      a: {set: `eval:${a}`, song: ca.case.song, seed: ca.case.seed, frame: frame + r[2], strength: r[1]},
      b: {set: `eval:${b}`, song: cb.case.song, seed: cb.case.seed, frame: frame + s[2], strength: s[1]}});
  });
}
const key: any[] = [];
while (key.length < n && pool.length) {
  const p = pool.splice(Math.floor(rng() * pool.length), 1)[0];
  if (key.filter(k => k.song === p.song).length >= Math.ceil(n / 4)) continue;
  const flip = rng() < .5;
  key.push({pair: key.length + 1, kind: 'random strong beat', song: p.song, requested: p.requested, left: flip ? p.b : p.a, right: flip ? p.a : p.b, leftIs: flip ? b : a});
}
writeFileSync(`labels/studies/${study}.key.json`, JSON.stringify(key, null, 1) + '\n');
console.log(`${study}: ${key.length} pairs (${a} vs ${b})`);
