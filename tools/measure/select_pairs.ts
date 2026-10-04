/** Chooses blind comparison pairs where two strength measures disagree, plus a
 * few where they agree strongly (consistency checks), from observed rides.
 * Each pair answers "which is the bigger impact?"; sides are randomized and
 * recorded only in the key.
 *
 *   node --import tsx tools/measure/select_pairs.ts --changes=FILE.jsonl --study=<id>
 *       [--a=strike] [--b=strength] [--pairs=20] [--checks=4] [--seed=20261004]
 *
 * --changes is tools/measure/motion_change.ts --out output; --a/--b name its
 * columns. Writes labels/studies/<id>.key.json. */
import {readFileSync, writeFileSync} from 'node:fs';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const A = arg('a', 'strike')!, B = arg('b', 'strength')!, study = arg('study')!;
const nPairs = Number(arg('pairs', '20')), nChecks = Number(arg('checks', '4'));
let seed = Number(arg('seed', '20261004'));
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const rows = readFileSync(arg('changes')!, 'utf8').trim().split('\n').map(l => JSON.parse(l));

// A judged hit must be unambiguous in its clip: visible, inside the song, and no
// other event of more than half its size within ±10 frames (0.25 s).
const byRide = new Map<string, any[]>();
for (const r of rows) (byRide.get(r.id) ?? byRide.set(r.id, []).get(r.id)!).push(r);
const pool = rows.filter(r => Math.max(r[A], r[B]) >= .2 && r.onset >= 48 && r.onset <= 1700 &&
  !byRide.get(r.id)!.some(o => o !== r && Math.abs(o.onset - r.onset) <= 10 && Math.max(o[A], o[B]) > .5 * Math.max(r[A], r[B])));

const used = new Set<any>(), rideUse = new Map<string, number>();
const free = (x: any) => !used.has(x) && (rideUse.get(x.id) ?? 0) < 3;
const take = (x: any) => {used.add(x); rideUse.set(x.id, (rideUse.get(x.id) ?? 0) + 1);};
const pairs: any[] = [];
// Disagreements: A ranks x above y by a clear margin, B ranks y above x.
const candidates: Array<[number, any, any]> = [];
for (let i = 0; i < 6000; i++) {
  const x = pool[Math.floor(rnd() * pool.length)], y = pool[Math.floor(rnd() * pool.length)];
  if (x === y || x.id === y.id) continue;
  const da = x[A] - y[A], db = y[B] - x[B];
  if (da >= .15 && db >= .08) candidates.push([da * db, x, y]);
}
candidates.sort((p, q) => q[0] - p[0]);
for (const [, x, y] of candidates) {
  if (pairs.length >= nPairs) break;
  if (!free(x) || !free(y)) continue;
  take(x); take(y); pairs.push({kind: 'disagree', x, y});
}
// Checks: both measures rank x well above y.
for (let i = 0; i < 20000 && pairs.filter(p => p.kind === 'check').length < nChecks; i++) {
  const x = pool[Math.floor(rnd() * pool.length)], y = pool[Math.floor(rnd() * pool.length)];
  if (x.id === y.id || !free(x) || !free(y)) continue;
  if (x[A] - y[A] >= .4 && x[B] - y[B] >= .3) {take(x); take(y); pairs.push({kind: 'check', x, y});}
}
const order = pairs.map((_, i) => i).sort(() => rnd() - .5);
const hit = (r: any) => ({set: r.set, song: r.song, seed: r.seed, frame: r.onset, [A]: +r[A].toFixed(3), [B]: +r[B].toFixed(3),
  sharpness: +r.sharpness.toFixed(2), spinShare: +r.spinShare.toFixed(2), travel: +r.travel.toFixed(3)});
const key = order.map((i, n) => {
  const p = pairs[i], flip = rnd() < .5;
  return {pair: n + 1, kind: p.kind, measures: [A, B], left: hit(flip ? p.y : p.x), right: hit(flip ? p.x : p.y),
    aPrefers: flip ? 'right' : 'left'};
});
writeFileSync(`labels/studies/${study}.key.json`, JSON.stringify(key, null, 1) + '\n');
console.log(`${study}: ${key.length} pairs (${key.filter(k => k.kind === 'disagree').length} disagreements, ${key.filter(k => k.kind === 'check').length} checks) from a pool of ${pool.length}`);
for (const k of key) console.log(k.pair, k.kind, 'L', k.left.set, k.left.song, k.left.seed, (k.left.frame / 40).toFixed(2), A, k.left[A], B, k.left[B], '| R', k.right.set, k.right.song, k.right.seed, (k.right.frame / 40).toFixed(2), A, k.right[A], B, k.right[B]);
