/** Chooses blind pairs for "is a clean upper hit felt as strong as the strike measures it?": each pair sets a clean
 * upper hit (a strong beat caught on a line's underside, no rail touched; tools/measure/contact_role.ts) against a floor
 * hit of the same measured strength (within 0.03) on a similar ask, from rides `npm run compare` saved. A few check
 * pairs (two hits of one kind, strengths 0.35 or more apart) test that the clips are readable. Sides are random and
 * recorded only in the key; build the clips with tools/measure/pair_study.ts.
 *
 *   node tools/measure/select_upper_pairs.ts --arm=<arm id> --study=<id> [--pairs=14] [--checks=4] [--seed=20261114]
 *
 * With --neutral=FILE (tools/research/gravity_neutral.ts --out, same arm) it builds the held-out check of the
 * gravity-neutral strength instead: 8 pairs where today's strength calls the floor hit bigger (by 0.03–0.10) and the
 * gravity-neutral one the clean upper hit (by 0.02 or more); 6 pairs where both call the floor hit bigger by 0.10–0.25
 * (does the eye credit a catch from above beyond the correction?); 4 checks of two floor hits 0.45 or more apart. */
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {digest} from '../eval/inputs.ts';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const arm = arg('arm')!, study = arg('study')!, nPairs = Number(arg('pairs', '14')), nChecks = Number(arg('checks', '4'));
assert.match(study, /^[a-z0-9-]+$/);
let seed = Number(arg('seed', '20261114'));
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffle = <T>(xs: T[]) => {for (let i = xs.length - 1; i > 0; i--) {const j = Math.floor(rnd() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]];} return xs;};

// A judged hit must stand alone in its clip: a strong ask, no other authored beat within 12 frames (0.3 s), and room
// for the clip inside the ride.
const dir = join('generated/eval/arms', arm, 'cells'), hits: any[] = [];
for (const f of readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f)).sort()) {
  const cell = JSON.parse(readFileSync(join(dir, f), 'utf8')), targets = cell.case.targets;
  if (!cell.complete || !cell.character) continue;
  cell.impact3.perBeat.forEach((b: any, j: number) => {
    const h = b.hit, frame = targets[j].frame;
    if (!h || b.requested == null || b.requested < .6 || !['upper', 'floor'].includes(h.contact)) return;
    if ((targets[j - 1] && frame - targets[j - 1].frame < 12) || (targets[j + 1] && targets[j + 1].frame - frame < 12)) return;
    if (h.onset < 48 || h.onset > cell.terminus.frame - 60) return;
    hits.push({set: `arm:${arm}`, cell: f.slice(0, -5), song: cell.case.song, seed: cell.case.seed, beat: j, frame: h.onset,
      strength: h.strength, requested: b.requested, contact: h.contact, headDown: h.headDown, trackHash: cell.trackHash, inputHash: digest(cell.case.input)});
  });
}
const neutralFile = arg('neutral', '');
if (neutralFile) {
  const neutral = new Map<string, number>();
  for (const l of readFileSync(neutralFile, 'utf8').trim().split('\n')) {
    const r = JSON.parse(l);
    if (Math.abs(r.old - r.saved) <= 1e-3) neutral.set(`${r.ride}~${r.beat}`, r.neutral);
  }
  for (const h of hits) h.neutral = neutral.get(`${h.cell}~${h.beat}`);
  const ok = hits.filter(h => h.neutral !== undefined);
  const used = new Set<string>(), perSong = new Map<string, number>();
  const free = (h: any) => !used.has(h.cell) && (perSong.get(h.song) ?? 0) < 2;
  const take = (...hs: any[]) => hs.forEach(h => {used.add(h.cell); perSong.set(h.song, (perSong.get(h.song) ?? 0) + 1);});
  const pairs: any[] = [];
  const block = (kind: string, n: number, first: (h: any) => boolean, second: (a: any, h: any) => boolean) => {
    let made = 0;
    for (const a of shuffle(ok.filter(first))) {
      if (made >= n) break;
      if (!free(a)) continue;
      const b = shuffle(ok.filter(h => free(h) && h.cell !== a.cell && second(a, h)))[0];
      if (!b) continue;
      take(a, b); pairs.push({kind, upper: a, floor: b}); made++;
    }
    assert.ok(made === n, `${kind}: only ${made} of ${n} pairs`);
  };
  block('disagree', 8, h => h.contact === 'upper', (u, f) => f.contact === 'floor' && f.strength - u.strength >= .03 && f.strength - u.strength <= .1 &&
    u.neutral - f.neutral >= .02 && Math.abs(f.requested - u.requested) <= .15);
  block('floor-bigger', 6, h => h.contact === 'upper', (u, f) => f.contact === 'floor' && f.neutral - u.neutral >= .1 && f.neutral - u.neutral <= .25 &&
    Math.abs(f.requested - u.requested) <= .15);
  block('check', 4, h => h.contact === 'floor', (a, b) => b.contact === 'floor' && Math.abs(a.strength - b.strength) >= .45);
  const key = shuffle(pairs).map((p, i) => {
    const firstLeft = rnd() < .5;
    return {pair: i + 1, kind: p.kind, left: firstLeft ? p.upper : p.floor, right: firstLeft ? p.floor : p.upper,
      note: p.kind === 'check' ? 'two floor hits far apart' : `clean upper on the ${firstLeft ? 'left' : 'right'}`};
  });
  writeFileSync(`labels/studies/${study}.key.json`, JSON.stringify(key, null, 1));
  console.log(`${study}: ${key.length} pairs (${['disagree', 'floor-bigger', 'check'].map(k => `${k} ${key.filter((p: any) => p.kind === k).length}`).join(', ')}) from ${ok.length} hits with both strengths`);
  process.exit(0);
}
const used = new Set<string>(), perSong = new Map<string, number>();
const free = (h: any) => !used.has(h.cell) && (perSong.get(h.song) ?? 0) < 2;
const take = (...hs: any[]) => hs.forEach(h => {used.add(h.cell); perSong.set(h.song, (perSong.get(h.song) ?? 0) + 1);});
const pairs: any[] = [];
for (const u of shuffle(hits.filter(h => h.contact === 'upper'))) {
  if (pairs.length >= nPairs) break;
  if (!free(u)) continue;
  const f = shuffle(hits.filter(h => h.contact === 'floor' && free(h) && h.cell !== u.cell && Math.abs(h.strength - u.strength) <= .03 && Math.abs(h.requested - u.requested) <= .1))[0];
  if (!f) continue;
  take(u, f); pairs.push({kind: 'upper-vs-floor', upper: u, floor: f});
}
for (const a of shuffle(hits.filter(h => free(h)))) {
  if (pairs.filter(p => p.kind === 'check').length >= nChecks) break;
  if (!free(a)) continue;
  const b = shuffle(hits.filter(h => free(h) && h.cell !== a.cell && h.contact === a.contact && Math.abs(h.strength - a.strength) >= .35))[0];
  if (!b) continue;
  take(a, b); pairs.push({kind: 'check', upper: a, floor: b});
}
assert.ok(pairs.length >= nPairs, `only ${pairs.length} pairs found`);
const key = shuffle(pairs).map((p, i) => {
  const upperLeft = rnd() < .5;
  return {pair: i + 1, kind: p.kind, left: upperLeft ? p.upper : p.floor, right: upperLeft ? p.floor : p.upper,
    note: p.kind === 'check' ? 'same kind, strengths far apart' : `clean upper on the ${upperLeft ? 'left' : 'right'}`};
});
writeFileSync(`labels/studies/${study}.key.json`, JSON.stringify(key, null, 1));
console.log(`${study}: ${key.length} pairs (${key.filter(p => p.kind === 'check').length} checks) from ${hits.length} eligible hits; labels/studies/${study}.key.json`);
