import {afterEach, expect, it} from 'vitest';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {digest, evaluatorIdentity} from '../tools/eval/inputs.ts';
import {atomicWrite, saveCell, loadRun, readCells, readPlan, assertPairedRuns, type RunPlan} from '../tools/eval/records.ts';
import {validateRunOptions} from '../tools/eval/eval.ts';

const dirs: string[] = [];
afterEach(() => {for (const d of dirs.splice(0)) rmSync(d, {recursive: true, force: true});});
const temporary = () => {const d = mkdtempSync(join(tmpdir(), 'line-evidence-test-')); dirs.push(d); return d;};
it('measurement identity follows indirect rules and both engine artifacts', () => {
  const root = temporary();
  const put = (path: string, content: string) => {mkdirSync(dirname(join(root, path)), {recursive: true}); writeFileSync(join(root, path), content);};
  put('tools/eval/measure.ts', "export {value} from '../../benchmark/rule.ts'");
  put('benchmark/rule.ts', 'export const value = 1');
  put('tools/eval/inputs.ts', 'export {}'); put('tools/measure/observe.ts', 'export {}');
  put('scripts/lib/_lr_engine_wasm.ts', 'export {}'); put('package-lock.json', '{}');
  const engines = ['scripts/lib/native_motion/engine.wasm', 'engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm'];
  for (const p of engines) put(p, 'engine');
  const original = evaluatorIdentity(root);
  put('benchmark/rule.ts', 'export const value = 2'); expect(evaluatorIdentity(root)).not.toBe(original);
  put('benchmark/rule.ts', 'export const value = 1'); expect(evaluatorIdentity(root)).toBe(original);
  for (const p of engines) {put(p, 'new engine'); expect(evaluatorIdentity(root)).not.toBe(original); put(p, 'engine');}
});
function fixture(count = 2) {
  const dir = temporary(); mkdirSync(join(dir, 'cells'));
  const plan: RunPlan = {schema: 'line.eval.v2', identity: {head: 'compiler'}, evaluator: 'a'.repeat(64), jolt: -15,
    mode: 'strike3', budget: '100000', panelName: 'dev', panel: Array.from({length: count}, (_, k) => ({id: `song~${k}`, song: 'song', seed: k,
      perturbation: null, input: {jolt: -15, specSha256: 's', audioSha256: 'a', analysisSha256: 'b', resolvedSha256: 'c'},
      targets: [{frame: 40, t: 1, impact: .7}], authoredTargets: [{frame: 39, impact: .7}]}))};
  atomicWrite(join(dir, 'run.json'), JSON.stringify(plan));
  const track = {lines: [], riders: []};
  const save = (n: number, complete = true) => saveCell(dir, plan, plan.panel[n], {complete, fulfilled: complete,
    impact3: {perBeat: [{requested: .7, hit: null}]}, beats: [{frame: 40, t: 1, requested: .7}]}, track);
  return {dir, plan, save};
}
it('never publishes an incomplete panel, even if both comparisons omit the same cases', () => {
  const f = fixture(); f.save(0);
  expect(() => loadRun(f.dir)).toThrow(/incomplete evaluation/);
  const partial = {dir: f.dir, run: f.plan, cells: readCells(f.dir, f.plan)};
  expect(() => assertPairedRuns(partial, partial)).toThrow(/incomplete paired panel/);
  f.save(1, false);
  const run = loadRun(f.dir);
  expect(run.cells.size).toBe(2); expect([...run.cells.values()].filter(c => c.complete)).toHaveLength(1);
});
it('rejects duplicate declarations, undeclared files, transplanted cells, and changed tracks', () => {
  const f = fixture(1); f.save(0);
  const p = join(f.dir, 'cells/song~0.json'), cell = JSON.parse(readFileSync(p, 'utf8'));
  copyFileSync(p, join(f.dir, 'cells/extra.json'));
  expect(() => loadRun(f.dir)).toThrow(/undeclared/); rmSync(join(f.dir, 'cells/extra.json'));
  writeFileSync(p, JSON.stringify({...cell, planSha256: 'wrong'})); expect(() => loadRun(f.dir)).toThrow(/another run/);
  writeFileSync(p, JSON.stringify({...cell, trackHash: 'wrong'})); expect(() => loadRun(f.dir)).toThrow(/saved track differs/);
  atomicWrite(join(f.dir, 'run.json'), JSON.stringify({...f.plan, panel: [f.plan.panel[0], f.plan.panel[0]]}));
  expect(() => readPlan(f.dir)).toThrow(/duplicate/);
});
it('pairs actual resolved inputs and measurement code, while permitting different compilers', () => {
  const f = fixture(1); f.save(0); const a = loadRun(f.dir), b = structuredClone(a);
  b.run.identity.head = 'other'; expect(() => assertPairedRuns(a, b)).not.toThrow();
  b.run.panel[0].input.jolt = 100; expect(() => assertPairedRuns(a, b)).toThrow(/resolved inputs/);
  b.run.panel[0].input.jolt = -15; b.run.evaluator = 'b'.repeat(64);
  expect(() => assertPairedRuns(a, b)).toThrow(/measurement code/);
});
it('rejects invalid execution options before starting workers', () => {
  for (const jobs of [0, -1, 1.5, NaN, Infinity, 65]) expect(() => validateRunOptions('strike3', '1000', jobs, 'dev')).toThrow();
  for (const budget of ['0', '-1', '1.5', 'Infinity', 'NaN', '1junk']) expect(() => validateRunOptions('strike3', budget, 1, 'dev')).toThrow();
  expect(() => validateRunOptions('unknown', 'standard', 1, 'dev')).toThrow();
});
it('failed workers make the actual CLI fail, retaining a resumable plan but no successful report', () => {
  const dir = join(temporary(), 'run');
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'tools/eval/eval.ts', 'run', `--name=${dir}`, '--budget=1', '--jobs=8'], {encoding: 'utf8', maxBuffer: 2e6});
  expect(r.status).toBe(1); expect(r.stderr).toContain('24 workers failed');
  expect(() => loadRun(dir)).toThrow(/incomplete evaluation/);
  const plan = readPlan(dir);
  const resumed = spawnSync(process.execPath, ['--import', 'tsx', 'tools/eval/eval.ts', 'run', `--name=${dir}`, '--budget=1', '--jobs=8'],
    {env: {...process.env, LR_JOLT_OFFSET_MS: String(plan.jolt + 100)}, encoding: 'utf8', maxBuffer: 2e6});
  expect(resumed.status).toBe(1); expect(resumed.stderr).toContain('run inputs or measurement code changed');
  expect(digest(readPlan(dir))).toBe(digest(plan));
}, 60000);

it('a directory has one writer and can be reacquired after release', async () => {
  const {lockArtifacts} = await import('../scripts/lib/artifact_lock.ts');
  const dir = temporary(), release = lockArtifacts(dir);
  expect(() => lockArtifacts(dir)).toThrow(/already owns/);
  release(); const again = lockArtifacts(dir); again();
});
