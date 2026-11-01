/** Validation of the seed-block uncertainty (tools/eval/uncertainty.ts) before
 * its numbers are shown in reports. Report only.
 *  1. The t distribution against known quantiles.
 *  2. Simulated comparisons with no true change, at 3, 4, 6 and 8 blocks:
 *     interval coverage, and how often the directional support exceeds 0.95
 *     or falls below 0.05 (5% each if calibrated); normal and heavy-tailed blocks.
 *  3. The same on real rides: one compiler's 8 seeds split into two pretend
 *     arms (every split and pairing), so the true change is zero.
 *  4. A real comparison read at 4 and at 8 seeds.
 * node --import tsx tools/research/validate_uncertainty.ts NULL_ARM [CANDIDATE_ARM REFERENCE_ARM] */
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {readJson} from '../eval/records.ts';
import {headline, specKey} from '../eval/summary.ts';
import {V7_SUITE} from '../eval/inputs.ts';
const suite = readJson(V7_SUITE);
import {seedBlocks, studentTQuantile, studentTCdf} from '../eval/uncertainty.ts';
import {makeRng} from '../../scripts/lib/rng.ts';

const out = (s = '') => console.log(s);
out('1. t quantiles (expected 12.706, 3.182, 2.365, 1.960) and cdf');
out(`   ${[1, 3, 7, Infinity].map(df => studentTQuantile(.975, df).toFixed(3)).join(', ')}; cdf(3.182, 3) = ${studentTCdf(3.182, 3).toFixed(4)}`);

const rng = makeRng(7), normal = () => {const u = 1 - rng(), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);};
const t3 = () => normal() / Math.sqrt([normal(), normal(), normal()].reduce((a, x) => a + x * x, 0) / 3);
out('\n2. Simulated, no true change (20,000 comparisons each): interval covers 0 | support > 0.95 | support < 0.05');
for (const [name, draw] of [['normal blocks', normal], ['heavy-tailed blocks (t, 3 df)', t3]] as const) for (const n of [3, 4, 6, 8]) {
  let cover = 0, high = 0, low = 0;
  for (let i = 0; i < 20000; i++) {
    const r = seedBlocks(Array.from({length: n}, draw)) as any;
    if (r.interval[0] <= 0 && 0 <= r.interval[1]) cover++;
    if (r.support > .95) high++; if (r.support < .05) low++;
  }
  out(`   ${name.padEnd(30)} n=${n}: ${(cover / 200).toFixed(1)}% | ${(high / 200).toFixed(1)}% | ${(low / 200).toFixed(1)}%`);
}

/** Saved cells of one arm, by seed: the V7 headline of each seed block. */
function blockHeadlines(armDir: string) {
  const cells = readdirSync(join(armDir, 'cells')).filter(f => /\d\.json$/.test(f)).map(f => readJson(join(armDir, 'cells', f)))
    .filter(c => c.case.bench && c.case.variant !== undefined);
  // The blocks are the frozen suite's specs, whatever else the arm holds.
  const specs = suite.specs.map((x: any) => `${x.song}~${x.variant ?? 'spec'}`);
  cells.splice(0, cells.length, ...cells.filter(c => specs.includes(specKey(c.case))));
  const seeds = [...new Set(cells.map(c => c.case.seed))].sort((a, b) => a - b)
    .filter(seed => specs.every((spec: string) => cells.some(c => c.case.seed === seed && specKey(c.case) === spec)));
  return new Map(seeds.map(seed => {
    const own = cells.filter(c => c.case.seed === seed), strata = [...new Set(own.map(c => c.case.bench.stratum))];
    return [seed, headline({dir: armDir, run: {panel: own.map(c => c.case)} as any, cells: new Map(own.map(c => [c.case.id, c]))}, strata).strata];
  }));
}
const choose = <T,>(xs: T[], k: number): T[][] => k === 0 ? [[]] : xs.flatMap((x, i) => choose(xs.slice(i + 1), k - 1).map(r => [x, ...r]));
const orders = <T,>(xs: T[]): T[][] => xs.length <= 1 ? [xs] : xs.flatMap((x, i) => orders([...xs.slice(0, i), ...xs.slice(i + 1)]).map(r => [x, ...r]));

const nullArm = process.argv[2], h = blockHeadlines(nullArm), seeds = [...h.keys()];
out(`\n3. Real rides, no true change: ${seeds.length} seed blocks of one compiler (${nullArm})`);
out(`   per-seed V7 headline: ${seeds.map(s => `${s}: ${h.get(s)!.toFixed(1)}`).join(', ')}`);
for (const n of [3, 4]) {
  let total = 0, cover = 0, high = 0, low = 0;
  for (const a of choose(seeds, n)) for (const b of choose(seeds.filter(s => !a.includes(s)), n)) for (const order of orders(b)) {
    const r = seedBlocks(a.map((s, i) => h.get(s)! - h.get(order[i])!)) as any;
    total++; if (r.interval[0] <= 0 && 0 <= r.interval[1]) cover++; if (r.support > .95) high++; if (r.support < .05) low++;
  }
  out(`   n=${n}: ${total} splits and pairings: interval covers 0 ${(100 * cover / total).toFixed(1)}% | support > 0.95 ${(100 * high / total).toFixed(1)}% | < 0.05 ${(100 * low / total).toFixed(1)}%`);
}

if (process.argv[3]) {
  const c = blockHeadlines(process.argv[3]), r = blockHeadlines(process.argv[4]), both = [...c.keys()].filter(s => r.has(s));
  out(`\n4. A real comparison (${process.argv[3]} against ${process.argv[4]}), read at 4 and at ${both.length} seed blocks`);
  for (const n of [4, both.length]) {
    const x = seedBlocks(both.slice(0, n).map(s => c.get(s)! - r.get(s)!)) as any;
    out(`   ${n} blocks: mean ${x.mean.toFixed(2)}, 95% interval [${x.interval[0].toFixed(2)}, ${x.interval[1].toFixed(2)}], support ${x.support.toFixed(3)}; blocks ${x.blocks.map((d: number) => d.toFixed(1)).join(', ')}`);
  }
}
