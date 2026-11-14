/** Why rail-free ridable twins win or lose inside the search (report only): compiles V8 rides from a worktree whose
 * compiler offers them (`ridableTwins`, branch exp/ridable) and reads the stage's work record, which the eval adapter
 * does not save: twins built, viable, why the rest failed, and how each viable twin ranks against its original (the
 * railed candidate it copies) and the interval's best, split into the local cost and the priors.
 *   node tools/research/ridable_work.ts ROOT OUT [--seed=101] [--jobs=N] [--specs=a~b,...]   (ROOT: a worktree of the compiler) */
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
  appendFileSync(join(out, 'rides.jsonl'), JSON.stringify({id, twins: r.ridableTwinWork ?? null, frames: r.stats.sim_frames}) + '\n');
}

if (process.argv[2] === 'worker') {await one(resolve(process.argv[3]), process.argv[4], arg('spec', ''), Number(arg('seed', '101'))); process.exit(0);}
const root = resolve(process.argv[2]), out = process.argv[3], seed = Number(arg('seed', '101'));
mkdirSync(out, {recursive: true});
if (existsSync(join(out, 'rides.jsonl'))) throw new Error(`${out} already has rides`);
const specs = arg('specs', '') ? arg('specs', '').split(',') : (await v7Cases([seed], '.', SUITE)).map(x => `${x.song}~${x.variant ?? 'spec'}`);
const pool = new WorkerPool(workerJobs(arg('jobs', '')));
await pool.run(specs, spec => pool.worker([import.meta.filename, 'worker', root, out, `--spec=${spec}`, `--seed=${seed}`]));
const lines = readFileSync(join(out, 'rides.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const T = lines.map(x => x.twins).filter(Boolean), rows = T.flatMap((t: any) => t.rows), att = T.reduce((a: number, t: any) => a + t.attempts, 0);
const fails: Record<string, number> = {}; for (const t of T) for (const [k, v] of Object.entries(t.failures)) fails[k] = (fails[k] ?? 0) + (v as number);
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))] ?? NaN, f = (x: number) => x.toFixed(3);
console.log(`${lines.length} rides; twins built ${att}, viable ${rows.length} (${(100 * rows.length / Math.max(1, att)).toFixed(0)}%); failures per built: ` +
  Object.entries(fails).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${(100 * v / att).toFixed(0)}%`).join(', '));
for (const [label, g] of [['early twins', rows.filter((r: number[]) => r[0] === 0)], ['twins of the refined best', rows.filter((r: number[]) => r[0] === 1)]] as const) {
  if (!g.length) continue;
  console.log(`${label}: ${g.length}; original had a rail ${(100 * g.filter((r: number[]) => r[5]).length / g.length).toFixed(0)}%; ranks better than its original ${(100 * g.filter((r: number[]) => r[1] < 0).length / g.length).toFixed(0)}%, ` +
    `better than the best so far ${(100 * g.filter((r: number[]) => r[4] < 0).length / g.length).toFixed(0)}%`);
  for (const [k, name] of [[1, 'rank − original'], [2, '  local cost − original'], [3, '  priors − original'], [4, 'rank − best so far']] as const)
    console.log(`  ${name.padEnd(26)} p10 ${f(q(g.map((r: number[]) => r[k]), .1))}  p25 ${f(q(g.map((r: number[]) => r[k]), .25))}  median ${f(q(g.map((r: number[]) => r[k]), .5))}  p75 ${f(q(g.map((r: number[]) => r[k]), .75))}  p90 ${f(q(g.map((r: number[]) => r[k]), .9))}`);
}
console.log(`physics per ride: ${(lines.reduce((a, x) => a + x.frames, 0) / lines.length / 1e6).toFixed(2)}M frames; twins ${(T.reduce((a: number, t: any) => a + t.physicsFrames, 0) / lines.length / 1e3).toFixed(0)}k`);
process.exit(0);
