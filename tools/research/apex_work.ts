/** How accurately apex launches aim (report only): compiles V8 rides from a worktree whose compiler records, for each
 * apex-launch twin it evaluates (branch exp/apex-aim), the arrival heading aimed at and the one achieved, the flight
 * length before and after, and the twin's rank against its original.
 *   node tools/research/apex_work.ts ROOT OUT [--seed=101] [--jobs=N] [--specs=a~b,...]   (ROOT: a worktree of the compiler) */
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
  appendFileSync(join(out, 'rides.jsonl'), JSON.stringify({id, apex: r.apexLaunchWork ?? null, frames: r.stats.sim_frames}) + '\n');
}

if (process.argv[2] === 'worker') {await one(resolve(process.argv[3]), process.argv[4], arg('spec', ''), Number(arg('seed', '101'))); process.exit(0);}
const root = resolve(process.argv[2]), out = process.argv[3], seed = Number(arg('seed', '101'));
mkdirSync(out, {recursive: true});
if (existsSync(join(out, 'rides.jsonl'))) throw new Error(`${out} already has rides`);
const specs = arg('specs', '') ? arg('specs', '').split(',') : (await v7Cases([seed], '.', SUITE)).map(x => `${x.song}~${x.variant ?? 'spec'}`);
const pool = new WorkerPool(workerJobs(arg('jobs', '')));
await pool.run(specs, spec => pool.worker([import.meta.filename, 'worker', root, out, `--spec=${spec}`, `--seed=${seed}`]));
const lines = readFileSync(join(out, 'rides.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const rows = lines.flatMap(x => x.apex?.rows ?? []);
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))] ?? NaN, f1 = (x: number) => x.toFixed(1);
console.log(`${lines.length} rides; apex-launch twins viable ${rows.length} of ${lines.reduce((a, x) => a + (x.apex?.attempts ?? 0), 0)} built`);
for (const fr of [...new Set(rows.map((r: number[]) => r[0]))].sort()) {
  const g = rows.filter((r: number[]) => r[0] === fr), miss = g.map((r: number[]) => r[3] - r[2]), moved = g.map((r: number[]) => r[3] - r[1]), want = g.map((r: number[]) => r[2] - r[1]);
  console.log(`fraction ${fr}: ${g.length}; arrival heading (+ falling): original median ${f1(q(g.map((r: number[]) => r[1]), .5))}°, aimed ${f1(q(g.map((r: number[]) => r[2]), .5))}°, achieved ${f1(q(g.map((r: number[]) => r[3]), .5))}°`);
  console.log(`  achieved − aimed: p10 ${f1(q(miss, .1))}  median ${f1(q(miss, .5))}  p90 ${f1(q(miss, .9))}; share of the aimed change realised: median ${(q(moved.map((m, k) => m / (Math.abs(want[k]) > 1 ? want[k] : NaN)).filter(Number.isFinite), .5)).toFixed(2)}`);
  console.log(`  flight frames before ${f1(q(g.map((r: number[]) => r[4]), .5))}, after ${f1(q(g.map((r: number[]) => r[5]), .5))}; rank − original: median ${q(g.map((r: number[]) => r[6]), .5).toFixed(3)}, better than original ${(100 * g.filter((r: number[]) => r[6] < 0).length / g.length).toFixed(0)}%`);
}
process.exit(0);
