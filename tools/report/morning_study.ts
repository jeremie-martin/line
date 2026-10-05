/** Blind pair key for the owner: random strong beats (request ≥ 0.6) of two eval
 * runs with saved tracks, same song, seed and beat, sides shuffled; not selected
 * by any measure, so the answers are a fair perceptual check of the change.
 *
 * With --pose-pairs=N it adds N pairs where exactly one side arrives head-down or
 * backward (sled axis past vertical, or against the travel), the check the
 * upright-arrival change needs: its eval row is judged by the same geometric test.
 *
 *   node --import tsx tools/report/morning_study.ts --a=<run> --b=<run> --study=<id> [--pairs=16] [--pose-pairs=6] [--seed=11] */
import {writeFileSync, readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe} from '../measure/observe.ts';
import {loadRun} from '../eval/summary.ts';
import {makeRng} from '../../scripts/lib/rng.ts';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const a = arg('a')!, b = arg('b')!, study = arg('study')!, n = Number(arg('pairs', '16')), poseN = Number(arg('pose-pairs', '0')), rng = makeRng(Number(arg('seed', '11')));
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
// Head-down or backward at the hit's onset (as the eval guard row defines it).
const observed = new Map<string, any>();
const headDown = (h: any) => {
  const id = `${h.set}~${h.song}~${h.seed}`;
  if (!observed.has(id)) observed.set(id, observe(JSON.parse(gunzipSync(readFileSync(join('generated/eval', h.set.slice(5), 'cells', `${h.song}~${h.seed}.track.json.gz`))).toString()), 2000, []));
  const fr = observed.get(id).frames, P = fr[h.frame].points, ax = P[2][0] - P[1][0], ay = P[2][1] - P[1][1];
  let vx = 0, vy = 0; for (const [x, y, px, py] of fr[h.frame - 1].points) {vx += x - px; vy += y - py;}
  return Math.abs(Math.atan2(ay, ax)) > Math.PI / 2 || ax * vx + ay * vy < 0;
};
const key: any[] = [];
if (poseN) {
  const posePool = pool.filter(p => headDown(p.a) !== headDown(p.b));
  while (key.length < poseN && posePool.length) {
    const p = posePool.splice(Math.floor(rng() * posePool.length), 1)[0], flip = rng() < .5;
    pool.splice(pool.indexOf(p), 1);
    key.push({pair: key.length + 1, kind: 'head-down vs upright', song: p.song, requested: p.requested, left: flip ? p.b : p.a, right: flip ? p.a : p.b, leftIs: flip ? b : a,
      headDown: {left: headDown(flip ? p.b : p.a), right: headDown(flip ? p.a : p.b)}});
  }
}
while (key.length < n + poseN && pool.length) {
  const p = pool.splice(Math.floor(rng() * pool.length), 1)[0];
  if (key.filter(k => k.song === p.song && k.kind === 'random strong beat').length >= Math.ceil(n / 4)) continue;
  const flip = rng() < .5;
  key.push({pair: key.length + 1, kind: 'random strong beat', song: p.song, requested: p.requested, left: flip ? p.b : p.a, right: flip ? p.a : p.b, leftIs: flip ? b : a});
}
// Shuffle the blocks together so the owner cannot tell which question a pair asks.
for (let i = key.length - 1; i > 0; i--) {const j = Math.floor(rng() * (i + 1)); [key[i], key[j]] = [key[j], key[i]];}
key.forEach((k, i) => k.pair = i + 1);
writeFileSync(`labels/studies/${study}.key.json`, JSON.stringify(key, null, 1) + '\n');
console.log(`${study}: ${key.length} pairs (${key.filter(k => k.kind !== 'random strong beat').length} head-down vs upright; ${a} vs ${b})`);
