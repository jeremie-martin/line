/** Agreement between candidate impact measures and the owner's blind labels.
 *
 *   node --import tsx tools/measure/analyze_labels.ts --study=impact-2026-10 [--split=design|holdout|all]
 *
 * Use the design split while developing a definition; read the holdout split
 * once, for the final decision. Reports Spearman rank correlation for ordinal
 * labels (strength, clarity, hit count) and, for timing, the mean offset of each
 * candidate anchor within each label category. */
import {readFileSync, existsSync} from 'node:fs';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const study = arg('study', 'impact-2026-10'), split = arg('split', 'design');
const file = `labels/studies/${study}.jsonl`;
if (!existsSync(file)) throw new Error(`no labels yet: ${file}`);
const key = new Map<string, any>(JSON.parse(readFileSync(`labels/studies/${study}.key.json`, 'utf8')).map((k: any) => [k.clip, k]));
const latest = new Map<string, any>();
for (const line of readFileSync(file, 'utf8').trim().split('\n')) {const r = JSON.parse(line); latest.set(r.clip, r);}
const rows = [...latest.values()].filter(r => !r.skipped).map(r => ({label: r.answers, key: key.get(r.clip)}))
  .filter(r => split === 'all' || r.key.split === split);

const rank = (xs: number[]) => {
  const order = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), ranks = new Array(xs.length);
  for (let i = 0; i < order.length;) {let j = i; while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    for (let k = i; k <= j; k++) ranks[order[k][1]] = (i + j) / 2; i = j + 1;}
  return ranks;
};
const spearman = (a: number[], b: number[]) => {
  const keep = a.map((x, i) => Number.isFinite(x) && Number.isFinite(b[i])), x = rank(a.filter((_, i) => keep[i])), y = rank(b.filter((_, i) => keep[i]));
  const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) {sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2;}
  return {rho: sxy / Math.sqrt(sxx * syy), n};
};
const ordinal = (q: string, value: string) => ({
  strength: ['none', 'very soft', 'soft', 'medium', 'hard', 'very hard'], clarity: ['messy', 'a bit messy', 'clean'], hits: ['0', '1', '2', '3+'],
} as Record<string, string[]>)[q].indexOf(value);
const m = (r: any) => r.key.measures;
const report = (title: string, labelOf: (r: any) => number, candidates: Record<string, (r: any) => number>) => {
  console.log(`\n${title}`);
  const y = rows.map(labelOf);
  for (const [name, f] of Object.entries(candidates)) {const {rho, n} = spearman(rows.map(f), y); console.log(`  ${name.padEnd(28)} rho ${rho.toFixed(3)}  (n=${n})`);}
};
console.log(`${study}: ${rows.length} labeled clips in split "${split}"`);
report('Strength of the hit on the beat (none … very hard)', r => ordinal('strength', r.label.strength), {
  'requested impact': r => r.key.requested, 'frozen landing impact': r => m(r).frozen ?? 0,
  'contact-impact v1': r => m(r).v1?.strength ?? 0, 'v1 + renewal fix': r => m(r).r1?.strength ?? 0,
  'external impulse (peak)': r => m(r).impulse.hit, 'largest point jolt': r => m(r).impulse.maxJolt});
report('Clarity (messy … clean)', r => ordinal('clarity', r.label.clarity), {
  '−competitor / hit impulse': r => -m(r).impulse.competitor / Math.max(1e-9, m(r).impulse.hit), '−strong extra hits (R1)': r => -m(r).extrasR1.filter((e: any) => e.strength >= .25).length,
  '−hidden contacted bend': r => -m(r).hiddenBend, '−competing impulse': r => -m(r).impulse.competitor});
report('Distinct hits seen in the clip', r => ordinal('hits', r.label.hits), {
  'R1 events (matched + extras)': r => (m(r).r1 ? 1 : 0) + m(r).extrasR1.length, 'R1 strong events': r => (m(r).r1 ? 1 : 0) + m(r).extrasR1.filter((e: any) => e.strength >= .25).length});
console.log('\nTiming: mean anchor offset (ms) by label');
for (const category of ['early', 'on the beat', 'late']) {
  const g = rows.filter(r => r.label.timing === category), mean = (f: (r: any) => number | null | undefined) => {
    const xs = g.map(f).filter((x): x is number => Number.isFinite(x)); return xs.length ? (xs.reduce((s, x) => s + x, 0) / xs.length * 25).toFixed(0) : '—';};
  console.log(`  ${category.padEnd(12)} n=${String(g.length).padStart(3)}  onset ${mean(r => m(r).r1?.onset)}  peak ${mean(r => m(r).r1?.peak)}  centroid ${mean(r => m(r).r1?.centroid)}  impulse peak ${mean(r => m(r).impulse.at)}`);
}
