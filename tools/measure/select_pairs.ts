/** Chooses blind comparison pairs where two strength measures disagree, plus a
 * few where they agree strongly (consistency checks), from observed rides.
 * Each pair answers "which is the bigger impact?"; sides are randomized and
 * recorded only in the key.
 *
 *   node --import tsx tools/measure/select_pairs.ts --changes=FILE.jsonl --study=<id>
 *       [--plan='[["strike","strength",20]]'] [--checks=4] [--exclude=KEY.json,...] [--seed=20261004]
 *
 * --changes is tools/measure/motion_change.ts --out output. Each plan entry
 * [a, b, n, margin = 0.08] asks for n pairs where columns a and b disagree by at
 * least margin each way; checks are pairs
 * where the first entry's two columns agree strongly. Hits used by --exclude
 * keys are never reused. Writes labels/studies/<id>.key.json. */
import {readFileSync, writeFileSync} from 'node:fs';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const study = arg('study')!, nChecks = Number(arg('checks', '4'));
const plan: Array<[string, string, number, number?]> = JSON.parse(arg('plan', '[["strike","strength",20]]')!);
const [A, B] = plan[0];
let seed = Number(arg('seed', '20261004'));
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const rows = readFileSync(arg('changes')!, 'utf8').trim().split('\n').map(l => JSON.parse(l));

// A judged hit must be unambiguous in its clip: visible, inside the song, and no
// other event of more than half its size within ±10 frames (0.25 s).
const byRide = new Map<string, any[]>();
for (const r of rows) (byRide.get(r.id) ?? byRide.set(r.id, []).get(r.id)!).push(r);
const excluded = new Set((arg('exclude', '') || '').split(',').filter(Boolean).flatMap(path =>
  JSON.parse(readFileSync(path, 'utf8')).flatMap((p: any) => [p.left, p.right].filter(h => typeof h === 'object').map((h: any) => `${h.set}~${h.song}~${h.seed}~${h.frame}`))));
const pool = rows.filter(r => !excluded.has(`${r.set}~${r.song}~${r.seed}~${r.onset}`) && Math.max(r[A], r[B]) >= .2 && r.onset >= 48 && r.onset <= 1700 &&
  !byRide.get(r.id)!.some(o => o !== r && Math.abs(o.onset - r.onset) <= 10 && Math.max(o[A], o[B]) > .5 * Math.max(r[A], r[B])));

const used = new Set<any>(), rideUse = new Map<string, number>();
const free = (x: any) => !used.has(x) && (rideUse.get(x.id) ?? 0) < 3;
const take = (x: any) => {used.add(x); rideUse.set(x.id, (rideUse.get(x.id) ?? 0) + 1);};
const pairs: any[] = [];
// Disagreements: a ranks x above y by a clear margin, b ranks y above x.
for (const [a, b, n, margin = .08] of plan) {
  const candidates: Array<[number, any, any]> = [];
  for (let i = 0; i < 6000; i++) {
    const x = pool[Math.floor(rnd() * pool.length)], y = pool[Math.floor(rnd() * pool.length)];
    if (x === y || x.id === y.id) continue;
    const da = x[a] - y[a], db = y[b] - x[b];
    if (da >= margin && db >= margin) candidates.push([da * db, x, y]);
  }
  candidates.sort((p, q) => q[0] - p[0]);
  let added = 0;
  for (const [, x, y] of candidates) {
    if (added >= n) break;
    if (!free(x) || !free(y)) continue;
    take(x); take(y); pairs.push({kind: 'disagree', measures: [a, b], x, y}); added++;
  }
}
// Checks: both measures rank x well above y.
for (let i = 0; i < 20000 && pairs.filter(p => p.kind === 'check').length < nChecks; i++) {
  const x = pool[Math.floor(rnd() * pool.length)], y = pool[Math.floor(rnd() * pool.length)];
  if (x.id === y.id || !free(x) || !free(y)) continue;
  if (x[A] - y[A] >= .4 && x[B] - y[B] >= .3) {take(x); take(y); pairs.push({kind: 'check', measures: [A, B], x, y});}
}
const order = pairs.map((_, i) => i).sort(() => rnd() - .5);
const hit = (r: any) => ({set: r.set, song: r.song, seed: r.seed, frame: r.onset, strike: +r.strike.toFixed(3), strength: +r.strength.toFixed(3),
  travel: +r.travel.toFixed(3), whole: +r.whole.toFixed(3), sharpness: +r.sharpness.toFixed(2), spinShare: +r.spinShare.toFixed(2)});
const key = order.map((i, n) => {
  const p = pairs[i], flip = rnd() < .5;
  return {pair: n + 1, kind: p.kind, measures: p.measures, left: hit(flip ? p.y : p.x), right: hit(flip ? p.x : p.y),
    aPrefers: flip ? 'right' : 'left'};
});
writeFileSync(`labels/studies/${study}.key.json`, JSON.stringify(key, null, 1) + '\n');
console.log(`${study}: ${key.length} pairs (${key.filter(k => k.kind === 'disagree').length} disagreements, ${key.filter(k => k.kind === 'check').length} checks) from a pool of ${pool.length}`);
for (const k of key) {const [a, b] = k.measures; console.log(k.pair, k.kind, a, 'vs', b, '| L', k.left.set, k.left.song, (k.left.frame / 40).toFixed(2), a, k.left[a], b, k.left[b], '| R', k.right.set, k.right.song, (k.right.frame / 40).toFixed(2), a, k.right[a], b, k.right[b]);}
