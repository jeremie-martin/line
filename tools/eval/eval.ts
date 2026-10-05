/** Paired production evaluation. Plans fix all inputs before workers start;
 * reports require the full panel. A failed worker is a failed run, resumable
 * after its cause is addressed; an incomplete ride is still a recorded result.
 *
 * node --import tsx tools/eval/eval.ts run --name=DIR [--mode=strike3] [--budget=standard|N] [--panel=dev|confirm] [--jobs=24]
 * node --import tsx tools/eval/eval.ts report --name=DIR [--against=DIR] */
import assert from 'node:assert/strict';
import {mkdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {compilerIdentity} from '../../scripts/lib/compiler_identity.ts';
import {lockArtifacts} from '../../scripts/lib/artifact_lock.ts';
import {resolveJoltMs} from '../../scripts/produce/jolt.ts';
import {PANELS, resolveCase, evaluatorIdentity} from './inputs.ts';
import {readPlan, readCells, saveCell, loadRun, atomicWrite, runDir, type RunPlan} from './records.ts';
import {summarize, bootstrap, songValues} from './summary.ts';
import {measureCell} from './measure.ts';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const CONTRACTS = {landing: undefined, strike: 'line.strike.v1', strike2: 'line.strike.v2', strike3: 'line.strike.v3'} as const;
export function validateRunOptions(mode: string, budget: string, jobs: number, panel: string) {
  assert.ok(Object.hasOwn(CONTRACTS, mode), 'unknown compilation mode');
  assert.ok(Object.hasOwn(PANELS, panel), 'unknown evaluation panel');
  assert.ok(Number.isSafeInteger(jobs) && jobs >= 1 && jobs <= 64, 'jobs must be an integer from 1 to 64');
  assert.ok(budget === 'standard' || (Number.isSafeInteger(Number(budget)) && Number(budget) > 0), 'budget must be standard or a positive integer');
}
async function planFor(mode: string, budget: string, panelName: string): Promise<RunPlan> {
  const identity = compilerIdentity('.'), evaluator = evaluatorIdentity(), jolt = resolveJoltMs();
  const panel = await Promise.all(PANELS[panelName].map(async c => (await resolveCase(c, jolt)).planned));
  return {schema: 'line.eval.v2', identity, evaluator, jolt, mode, budget, panelName, panel};
}
async function worker(dir: string, id: string) {
  const plan = readPlan(dir), c = plan.panel.find(c => c.id === id);
  assert.ok(c, 'undeclared worker case');
  assert.deepEqual(compilerIdentity('.'), plan.identity, 'compiler changed before worker started');
  assert.equal(evaluatorIdentity(), plan.evaluator, 'measurement code changed');
  const {spec, music, planned} = await resolveCase(c, plan.jolt);
  assert.deepEqual(planned, c, 'resolved authoring changed');
  const {compileHandoff} = await import('../../scripts/v0/optimizer/handoff.ts');
  const {productionBudget} = await import('../../scripts/v0/optimizer/production_budget.ts');
  const budget = plan.budget === 'standard' ? productionBudget(spec.duration) : Number(plan.budget), began = performance.now();
  const cp = compileHandoff(spec, c.seed, {budget, creative: {}, impactContract: CONTRACTS[plan.mode as keyof typeof CONTRACTS],
    phraseBoundaries: music.phases.map((p: any) => p.t0 ?? p.t ?? p.start).filter(Number.isFinite)});
  const compileMs = performance.now() - began, r = cp.repertoire!;
  const cell = measureCell({c, mode: plan.mode, track: cp.track, spec, music, physicalFrames: r.physicalFrames,
    compileMs, complete: r.valid, fulfilled: r.qualified, motion: r.motion.full});
  assert.deepEqual(compilerIdentity('.'), plan.identity, 'compiler changed during worker');
  assert.equal(evaluatorIdentity(), plan.evaluator, 'measurement code changed during worker');
  assert.deepEqual((await resolveCase(c, plan.jolt)).planned, c, 'authoring changed during worker');
  saveCell(dir, plan, c, cell, cp.track);
}
async function main() {
  const command = process.argv[2];
  if (command === 'worker') {assert.ok(arg('name') && arg('case')); await worker(runDir(arg('name')!), arg('case')!); return;}
  assert.ok(arg('name'), '--name is required');
  if (command === 'run') {
    const budget = arg('budget', 'standard')!, mode = arg('mode', 'strike3')!, panelName = arg('panel', 'dev')!, jobs = Number(arg('jobs', '24'));
    validateRunOptions(mode, budget, jobs, panelName);
    const dir = runDir(arg('name')!), plan = await planFor(mode, budget, panelName);
    mkdirSync(join(dir, 'cells'), {recursive: true});
    const release = lockArtifacts(dir);
    try {
      if (existsSync(join(dir, 'run.json'))) assert.deepEqual(readPlan(dir), plan, 'run inputs or measurement code changed; choose a fresh directory');
      else atomicWrite(join(dir, 'run.json'), JSON.stringify(plan));
      const existing = readCells(dir, plan), queue = plan.panel.filter(c => !existing.has(c.id)), failures: string[] = [], began = performance.now();
      await Promise.all(Array.from({length: Math.min(jobs, queue.length)}, async () => {
        while (queue.length) {
          const c = queue.shift()!;
          try {
            await new Promise<void>((done, fail) => {
              const child = spawn(process.execPath, ['--import', 'tsx', import.meta.filename, 'worker', `--case=${c.id}`, `--name=${dir}`],
                {env: {...process.env, LR_ENGINE: 'wasm'}, stdio: ['ignore', 'ignore', 'inherit']});
              child.once('error', fail); child.once('exit', (code, signal) => code === 0 ? done() : fail(new Error(`worker exited ${code ?? signal}`)));
            });
            console.log(`done  ${c.id}`);
          } catch (e) {failures.push(`${c.id}: ${e}`); console.error(`FAILED ${c.id}: ${e}`);}
        }
      }));
      assert.deepEqual(await planFor(mode, budget, panelName), plan, 'inputs changed during run');
      if (failures.length) throw new Error(`${failures.length} workers failed; run is incomplete and cannot be reported. Resume the same plan after addressing the failures.\n${failures.join('\n')}`);
      assert.deepEqual(readPlan(dir), plan, 'saved run plan changed');
      const result = loadRun(dir);
      console.log(`${arg('name')}: ${result.cells.size}/${plan.panel.length} cells in ${((performance.now() - began) / 1000).toFixed(0)} s`);
    } finally {release();}
  } else if (command === 'report') {
    const a = loadRun(arg('name')!), b = arg('against') ? loadRun(arg('against')!) : undefined;
    for (const [title, filter] of [['authored', (c: any) => !c.case.perturbation], ['perturbed', (c: any) => !!c.case.perturbation]] as const) {
      console.log(`\n${title} — ${arg('name')}${b ? ` vs ${arg('against')} (paired difference)` : ''}`);
      for (const metric of Object.keys(summarize([...a.cells.values()][0]))) {
        const values = songValues(a, metric, filter, b), [m, lo, hi] = bootstrap(values);
        console.log(`${metric.padEnd(42)} ${m.toFixed(3)} [${lo.toFixed(3)}, ${hi.toFixed(3)}] n=${[...values.values()].filter(Number.isFinite).length} songs`);
      }
    }
  } else throw new Error('usage: eval.ts run|report');
}
if (import.meta.filename === process.argv[1]) await main();
