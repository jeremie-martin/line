/** Blind comparisons use the exact matched hit and arrival observation saved by
 * evaluation. Sampling never has a second, subtly different posture detector.
 * Existing studies are immutable: use a fresh --study identifier. */
import assert from 'node:assert/strict';
import {existsSync, writeFileSync} from 'node:fs';
import {loadRun, assertPairedRuns, type Run} from '../eval/records.ts';
import {digest} from '../eval/inputs.ts';
import {makeRng} from '../../scripts/lib/rng.ts';

export function selectPairs(A: Run, B: Run, a: string, b: string, n = 16, poseN = 0, seed = 11) {
  assertPairedRuns(A, B);
  assert.ok([n, poseN, seed].every(Number.isSafeInteger) && n >= 0 && poseN >= 0 && n + poseN > 0, 'invalid study size or seed');
  const rng = makeRng(seed), pool: any[] = [], key: any[] = [];
  const hit = (c: any, r: any, run: string, beat: number) => ({set: `eval:${run}`, song: c.case.song, seed: c.case.seed, beat,
    frame: r.hit.onset, strength: r.hit.strength, contactStart: r.hit.contactStart, headDown: r.hit.headDown,
    trackHash: c.trackHash, inputHash: digest(c.case.input)});
  for (const [id, ca] of A.cells) {
    if (ca.case.perturbation) continue;
    const cb = B.cells.get(id)!;
    ca.impact3.perBeat.forEach((r: any, j: number) => {
      const s = cb.impact3.perBeat[j];
      if (r.requested == null || r.requested < .6 || !r.hit || !s.hit || ca.beats[j].frame < 48) return;
      pool.push({song: ca.case.song, requested: r.requested, a: hit(ca, r, a, j), b: hit(cb, s, b, j)});
    });
  }
  const take = (p: any, kind: string) => {
    pool.splice(pool.indexOf(p), 1);
    const flip = rng() < .5;
    key.push({pair: key.length + 1, kind, song: p.song, requested: p.requested,
      left: flip ? p.b : p.a, right: flip ? p.a : p.b, leftIs: flip ? b : a,
      ...(kind === 'head-down vs upright' ? {poseAt: 'contactStart'} : {})});
  };
  const poses = pool.filter(p => p.a.headDown !== p.b.headDown);
  assert.ok(poses.length >= poseN, 'not enough posture contrasts at first contact');
  for (let i = 0; i < poseN; i++) take(poses.splice(Math.floor(rng() * poses.length), 1)[0], 'head-down vs upright');
  while (key.length < n + poseN && pool.length) {
    const p = pool[Math.floor(rng() * pool.length)];
    if (key.filter(k => k.song === p.song && k.kind === 'random strong beat').length >= Math.ceil(n / 4)) {pool.splice(pool.indexOf(p), 1); continue;}
    take(p, 'random strong beat');
  }
  assert.equal(key.length, n + poseN, 'not enough matched strong beats for the declared study');
  for (let i = key.length - 1; i > 0; i--) {const j = Math.floor(rng() * (i + 1)); [key[i], key[j]] = [key[j], key[i]];}
  return key.map((k, i) => ({...k, pair: i + 1}));
}
if (import.meta.filename === process.argv[1]) {
  const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
  const a = arg('a')!, b = arg('b')!, study = arg('study')!;
  assert.match(study, /^[a-z0-9-]+$/);
  const path = `labels/studies/${study}.key.json`;
  assert.ok(!existsSync(path), 'study already exists; preserve its clips and answers and use a fresh study id');
  const key = selectPairs(loadRun(a), loadRun(b), a, b, Number(arg('pairs', '16')), Number(arg('pose-pairs', '0')), Number(arg('seed', '11')));
  writeFileSync(path, JSON.stringify(key, null, 1) + '\n', {flag: 'wx'});
  console.log(`${study}: ${key.length} pairs; posture at first contact, impact judgment at onset`);
}
