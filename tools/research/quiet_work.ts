/** Why quiet asks land too hard inside the search (report only): compiles V8 rides from a worktree whose compiler
 * records, for every interval asking under 0.3 (branch exp/quiet-probe), the chosen (best-ranked) candidate's strength
 * and the viable candidate whose strength is closest to the ask, with its rank against the best. If softer candidates
 * exist and lose by small margins, the search's pricing decides; if none exist, the proposals do.
 *   node tools/research/quiet_work.ts ROOT OUT [--seed=101] [--jobs=N] [--specs=a~b,...]   (ROOT: a worktree of the compiler) */
import {appendFileSync, mkdirSync, readFileSync, existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join, resolve} from 'node:path';
import {v7Cases, resolveCase} from '../eval/inputs.ts';
import {allowanceFor, compileOptions} from '../eval/compile.ts';
import {WorkerPool, workerJobs} from '../../scripts/lib/workers.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const SUITE = 'tools/eval/suites/v8.json';

async function one(root: string, out: string, id: string, seed: number) {
  const c = (await v7Cases([seed], '.', SUITE)).find(x => `${x.song}~${x.variant ?? 'spec'}` === id)!;
  const {spec, music, planned} = await resolveCase(c);
  const [{compileHandoff}, {productionBudget}] = await Promise.all([
    import(pathToFileURL(join(root, 'scripts/v0/optimizer/handoff.ts')).href),
    import(pathToFileURL(join(root, 'scripts/v0/optimizer/production_budget.ts')).href)]);
  const budget = allowanceFor('standard', spec.duration, productionBudget);
  const cp = compileHandoff(spec, planned.seed, await compileOptions(root, spec, planned.seed, budget, {}, music, planned.bench?.construction));
  const r = cp.repertoire!.result;
  appendFileSync(join(out, 'rides.jsonl'), JSON.stringify({id, quiet: r.quietWork ?? [], frames: r.stats.sim_frames}) + '\n');
}

if (process.argv[2] === 'worker') {await one(resolve(process.argv[3]), process.argv[4], arg('spec', ''), Number(arg('seed', '101'))); process.exit(0);}
const root = resolve(process.argv[2]), out = process.argv[3], seed = Number(arg('seed', '101'));
mkdirSync(out, {recursive: true});
if (existsSync(join(out, 'rides.jsonl'))) throw new Error(`${out} already has rides`);
const specs = arg('specs', '') ? arg('specs', '').split(',') : (await v7Cases([seed], '.', SUITE)).map(x => `${x.song}~${x.variant ?? 'spec'}`);
const pool = new WorkerPool(workerJobs(arg('jobs', '')));
await pool.run(specs, spec => pool.worker([import.meta.filename, 'worker', root, out, `--spec=${spec}`, `--seed=${seed}`]));
const lines = readFileSync(join(out, 'rides.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const rows = lines.flatMap(x => x.quiet);
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))] ?? NaN, mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
console.log(`${lines.length} rides, ${rows.length} intervals asking under 0.3 (the search's best, before the sequence picks among retained prefixes)`);
for (const [a, b] of [[0, .1], [.1, .2], [.2, .3]]) {
  const g = rows.filter((r: number[]) => r[1] >= a && r[1] < b); if (!g.length) continue;
  const over = g.filter((r: number[]) => r[2] - r[1] > .06), alt = over.filter((r: number[]) => Math.abs(r[4] - r[1]) < .03);
  console.log(`ask ${a}–${b}: ${g.length}; best's strength median ${q(g.map((r: number[]) => r[2]), .5).toFixed(3)} (bias ${mean(g.map((r: number[]) => r[2] - r[1])).toFixed(3)}); ` +
    `closest viable median ${q(g.map((r: number[]) => r[4]), .5).toFixed(3)} (bias ${mean(g.map((r: number[]) => r[4] - r[1])).toFixed(3)}); viable per interval ${q(g.map((r: number[]) => r[6]), .5)}, within 0.03 of the ask ${q(g.map((r: number[]) => r[7]), .5)}`);
  console.log(`  best more than 0.06 over: ${over.length} (${(100 * over.length / g.length).toFixed(0)}%); of those a viable candidate within 0.03 of the ask: ${alt.length} (${(100 * alt.length / Math.max(1, over.length)).toFixed(0)}%), ` +
    `its rank behind the best: median ${q(alt.map((r: number[]) => r[5]), .5).toFixed(3)}, p25 ${q(alt.map((r: number[]) => r[5]), .25).toFixed(3)}, p75 ${q(alt.map((r: number[]) => r[5]), .75).toFixed(3)}`);
}
const alts = rows.filter((r: number[]) => r[1] < .2 && r[2] - r[1] > .06 && Math.abs(r[4] - r[1]) < .03 && r.length > 8);
console.log(`\nasks under 0.2, best over by more than 0.06, a candidate within 0.03 exists (${alts.length}): what the soft candidate pays, mean (median)`);
const names = ['rank', 'local cost', 'priors (future and arrival)', '  air residual²', '  speed residual²', '  amplitude residual²', '  impact residual²', '  other residuals²'];
const cols = [5, 8, 9, 10, 11, 12, 13, 14];
names.forEach((n, k) => console.log(`  ${n.padEnd(30)} ${mean(alts.map((r: number[]) => r[cols[k]])).toFixed(3).padStart(7)} (${q(alts.map((r: number[]) => r[cols[k]]), .5).toFixed(3)})`));
console.log(`  residual vector length: median ${q(alts.map((r: number[]) => r[15]), .5)}; per index from 4 (timing, extra hits, engagement gain, then boundary correction if any, motion, priors), mean squared difference:`);
console.log('  ' + Array.from({length: 12}, (_, k) => `[${4 + k}] ${mean(alts.map((r: number[]) => r[21 + k])).toFixed(3)}`).join('  '));
const sp = alts.map((r: number[]) => r[16] - r[17]), ai = alts.map((r: number[]) => r[18] - r[19]);
console.log(`  signed speed residual (got − asked, the flight after): soft ${mean(alts.map((r: number[]) => r[16])).toFixed(3)}, best ${mean(alts.map((r: number[]) => r[17])).toFixed(3)}; soft faster in ${(100 * sp.filter(x => x > 0).length / sp.length).toFixed(0)}%`);
console.log(`  signed air residual: soft ${mean(alts.map((r: number[]) => r[18])).toFixed(3)}, best ${mean(alts.map((r: number[]) => r[19])).toFixed(3)}; soft flies more in ${(100 * ai.filter(x => x > 0).length / ai.length).toFixed(0)}%; asked speed median ${q(alts.map((r: number[]) => r[20]), .5).toFixed(2)}`);
process.exit(0);
