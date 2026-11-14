/** What the upper-receiver proposals do inside the search (report only): compiles V8 rides from a worktree whose
 * compiler offers them (`upperReceiverProposals`), and sums the stage's work record, which the eval adapter does not
 * save: proposals dropped because the body was in the way, built, viable, physics frames, and why the rest failed.
 *   node tools/research/upper_work.ts ROOT OUT [--seed=101] [--jobs=N] [--specs=a~b,...]   (ROOT: a worktree of the compiler) */
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
  appendFileSync(join(out, 'rides.jsonl'), JSON.stringify({id, upper: r.upperReceiverWork ?? null, opposing: r.opposingEntryWork ?? null, frames: r.stats.sim_frames}) + '\n');
}

if (process.argv[2] === 'worker') {await one(resolve(process.argv[3]), process.argv[4], arg('spec', ''), Number(arg('seed', '101'))); process.exit(0);}
const root = resolve(process.argv[2]), out = process.argv[3], seed = Number(arg('seed', '101'));
mkdirSync(out, {recursive: true});
if (existsSync(join(out, 'rides.jsonl'))) throw new Error(`${out} already has rides`);
const specs = arg('specs', '') ? arg('specs', '').split(',') : (await v7Cases([seed], '.', SUITE)).map(x => `${x.song}~${x.variant ?? 'spec'}`);
const pool = new WorkerPool(workerJobs(arg('jobs', '')));
await pool.run(specs, spec => pool.worker([import.meta.filename, 'worker', root, out, `--spec=${spec}`, `--seed=${seed}`]));
const lines = readFileSync(join(out, 'rides.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const sum = (pick: (x: any) => any) => {
  const t: any = {attempts: 0, viable: 0, bodyInTheWay: 0, physicsFrames: 0, failures: {}};
  for (const x of lines.map(pick).filter(Boolean)) {
    for (const k of ['attempts', 'viable', 'bodyInTheWay', 'physicsFrames']) t[k] += x[k] ?? 0;
    for (const [k, v] of Object.entries(x.failures ?? {})) t.failures[k] = (t.failures[k] ?? 0) + (v as number);
  }
  return t;
};
for (const [label, t] of [['upper receivers', sum(x => x.upper)], ['mirrored entries', sum(x => x.opposing)]] as const) {
  const offered = t.attempts + t.bodyInTheWay;
  console.log(`${label}: ${lines.length} rides; offered ${offered}, body in the way ${(100 * t.bodyInTheWay / Math.max(1, offered)).toFixed(0)}%, built ${t.attempts}, viable ${(100 * t.viable / Math.max(1, t.attempts)).toFixed(0)}%, ` +
    `physics ${(t.physicsFrames / lines.length / 1e3).toFixed(0)}k frames per ride; failures per built: ` +
    Object.entries(t.failures).filter(([, v]) => (v as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 6)
      .map(([k, v]) => `${k} ${(100 * (v as number) / Math.max(1, t.attempts)).toFixed(0)}%`).join(', '));
}
console.log(`physics per ride: ${(lines.reduce((a, x) => a + x.frames, 0) / lines.length / 1e6).toFixed(2)}M frames`);
process.exit(0);
