/** How the compiler lands quiet asks (report only). For saved V8 rides (`--arm`) and, optionally, produced rides
 * (`--rides=DIR,DIR`: scripts/produce output folders): per ask band, how many beats ask for it, the strength the ride's
 * matched hit lands at (median, p90), its bias (got − asked) and rms, and how many of the band's beats land above
 * 0.3. Quiet asks: 0–0.1 and 0.1–0.2. Also, per V8 spec, the share of beats asking 0.2 or less. And the RELATIVE
 * miss the owner asked for (2026-11-14: 0.05 against 0.1 matters though small in absolute terms): the log ratio
 * ln((got + 0.03) / (ask + 0.03)) (0.03 keeps asks near 0 finite), its mean (+: too hard), its median size, the share
 * of beats within a factor 1.5 of the ask, and the share more than twice too hard.
 *   node tools/research/quiet_asks.ts --arm=ARM [--seeds=101,202,303,404] [--rides=DIR,...] */
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
type Beat = {ask: number; got: number | null; spec: string};
const BANDS: Array<[number, number]> = [[0, 1e-9], [1e-9, .1], [.1, .2], [.2, .3], [.3, .45], [.45, .6], [.6, .8], [.8, 1.01]];
const q = (xs: number[], p: number) => xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))] : NaN;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const lr = (b: Beat) => Math.log((b.got! + .03) / (b.ask + .03));
const relative = (hit: Beat[]) => {const r = hit.map(lr); return [(mean(r) >= 0 ? '+' : '') + mean(r).toFixed(2).padStart(5), q(r.map(Math.abs), .5).toFixed(2).padStart(10),
  `${(100 * r.filter(x => Math.abs(x) < Math.log(1.5)).length / Math.max(1, r.length)).toFixed(0)}%`.padStart(11), `${(100 * r.filter(x => x > Math.log(2)).length / Math.max(1, r.length)).toFixed(0)}%`.padStart(8)];};
function table(label: string, beats: Beat[]) {
  console.log(`\n${label}: ${beats.length} beats`);
  console.log('ask'.padEnd(10), 'beats'.padStart(6), 'share'.padStart(6), '| missed', '| got: median'.padStart(13), 'p90'.padStart(6), '| bias'.padStart(8), 'rms'.padStart(6), '| landed > 0.3', '| ln ratio: mean', 'median |·|', 'within ×1.5', 'over ×2');
  for (const [a, b] of BANDS) {
    const g = beats.filter(x => x.ask >= a && x.ask < b); if (!g.length) continue;
    const hit = g.filter(x => x.got !== null), got = hit.map(x => x.got!), err = hit.map(x => x.got! - x.ask);
    console.log((b < 1e-6 ? 'exactly 0' : a > 0 && a < 1e-6 ? '0+–0.10' : `${a.toFixed(2)}–${Math.min(1, b).toFixed(2)}`).padEnd(10), String(g.length).padStart(6), `${(100 * g.length / beats.length).toFixed(0)}%`.padStart(6),
      '|', String(g.length - hit.length).padStart(6), '|', q(got, .5).toFixed(2).padStart(11), q(got, .9).toFixed(2).padStart(6),
      '|', (mean(err) >= 0 ? '+' : '') + mean(err).toFixed(3).padStart(6), Math.sqrt(mean(err.map(e => e * e))).toFixed(3).padStart(6),
      '|', `${(100 * got.filter(x => x > .3).length / Math.max(1, got.length)).toFixed(0)}%`.padStart(8),
      '|', ...relative(hit));
  }
  const quiet = beats.filter(x => x.ask < .3 && x.got !== null);
  console.log(`asks under 0.3 together (${quiet.length}): ln ratio mean, median |·|, within ×1.5, over ×2:`, relative(quiet).map(x => x.trim()).join('  '));
}
const v8: Beat[] = [];
if (arg('arm', '')) {
  const dir = join('generated/eval/arms', arg('arm', ''), 'cells'), seeds = arg('seeds', '101,202,303,404').split(',');
  for (const f of readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`)))) {
    const cell = JSON.parse(readFileSync(join(dir, f), 'utf8')), spec = f.replace(/~\d+\.json$/, '');
    for (const b of cell.impact3?.perBeat ?? []) if (b.requested != null) v8.push({ask: b.requested, got: b.hit ? b.hit.strength : null, spec});
  }
  table(`V8 (${arg('arm', '')})`, v8);
  const specs = [...new Set(v8.map(b => b.spec))].map(s => {const g = v8.filter(b => b.spec === s); return {s, n: g.length, q1: g.filter(b => b.ask < .1).length / g.length, q2: g.filter(b => b.ask < .2).length / g.length};});
  console.log(`\nV8 specs with beats asking under 0.2: ${specs.filter(x => x.q2 > 0).length} of ${specs.length}; with at least 10% of beats under 0.2: ${specs.filter(x => x.q2 >= .1).length}; under 0.1: ${specs.filter(x => x.q1 > 0).length}`);
  for (const x of specs.filter(x => x.q2 >= .05).sort((a, b) => b.q2 - a.q2)) console.log(`  ${x.s.padEnd(55)} under 0.1 ${(100 * x.q1).toFixed(0).padStart(3)}%  under 0.2 ${(100 * x.q2).toFixed(0).padStart(3)}%`);
}
if (arg('rides', '')) {
  const rides: Beat[] = [];
  for (const d of arg('rides', '').split(',')) {
    const f = readdirSync(d).find(x => /-production\.json$/.test(x))!, j = JSON.parse(readFileSync(join(d, f), 'utf8')), e = j.impactEvaluation;
    const got = new Map<number, number>(e.account.matches.map((m: any) => [m.target, e.events[m.event].strength]));
    e.targets.forEach((t: any, k: number) => rides.push({ask: t.impact ?? 0, got: got.get(k) ?? null, spec: d}));
  }
  table(`produced rides (${arg('rides', '').split(',').length})`, rides);
}
process.exit(0);
