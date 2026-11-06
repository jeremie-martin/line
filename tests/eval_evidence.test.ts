import {afterEach, expect, it} from 'vitest';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, copyFileSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {spawnSync, execFileSync} from 'node:child_process';
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
    budget: '100000', panelName: 'v7', panel: Array.from({length: count}, (_, k) => ({id: `song~${k}`, song: 'song', seed: k,
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
  for (const budget of ['0', '-1', '1.5', 'Infinity', 'NaN', '1junk']) expect(() => validateRunOptions(budget, 'dev')).toThrow();
  expect(() => validateRunOptions('standard', 'dev')).toThrow();
});
it('failed workers make the actual CLI fail, retaining a resumable plan but no successful report', () => {
  // Run the real CLI and compiler with tiny, entirely local authoring assets.
  // A separate git root keeps input identity/resume checks real without editing
  // production files or depending on untracked music downloads.
  const root = temporary(), dir = join(root, 'run'), cli = resolve('tools/eval/eval.ts');
  for (const name of ['scripts', 'tools', 'engine-rs', 'node_modules'])
    symlinkSync(resolve(name), join(root, name), 'dir');
  for (const name of ['package.json', 'package-lock.json']) copyFileSync(name, join(root, name));
  const audio = Buffer.alloc(44 + 16000, 128); // two seconds of silent 8-bit PCM
  audio.write('RIFF', 0); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8);
  audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(8000, 24); audio.writeUInt32LE(8000, 28);
  audio.writeUInt16LE(1, 32); audio.writeUInt16LE(8, 34);
  audio.write('data', 36); audio.writeUInt32LE(16000, 40);
  for (const song of ['luna_bala_44s', 'amor_na_praia_46s', 'tiki_tiki_48s', 'amour_de_ma_vie_44s']) {
    const songDir = join(root, 'productions', song); mkdirSync(join(songDir, 'variants'), {recursive: true});
    writeFileSync(join(songDir, 'variants', 'sealed-fixture.ts'), `export const bench = {stratum: 'P1', pattern: 'fixture', windows: [[.5, 1.5]]};
export default {duration:2,preroll:0,contacts:[{t:.6,impact:.4},{t:1.2,impact:.5}],axes:{air:()=>.5,speed:()=>.5}};`);
    writeFileSync(join(songDir, 'select.json'), JSON.stringify({audio: 'audio.wav'}));
    writeFileSync(join(songDir, 'audio.wav'), audio);
    writeFileSync(join(songDir, 'audio.json'), '{}');
    writeFileSync(join(songDir, 'spec.ts'), 'export default {duration:2,preroll:0,contacts:[{t:.6,impact:.4},{t:1.2,impact:.5}],axes:{air:()=>.5,speed:()=>.5}};');
  }
  const env = {...process.env, GIT_DIR: join(root, '.git'), GIT_WORK_TREE: root, GIT_INDEX_FILE: join(root, '.git/index')};
  const git = (...args: string[]) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], {cwd: root, env, stdio: 'pipe'});
  git('init', '-q');
  git('add', '--', 'scripts', 'tools', 'engine-rs', 'package.json', 'package-lock.json', 'productions');
  git('commit', '-qm', 'Controlled evaluation inputs');
  const args = [cli, 'run', `--name=${dir}`, '--panel=sealed', '--sealed', '--budget=1', '--jobs=2'];
  const r = spawnSync(process.execPath, args, {cwd: root, env, encoding: 'utf8', maxBuffer: 2e6});
  expect(r.status).toBe(1); expect(r.stderr).toContain('12 workers failed');
  expect(r.stderr).toContain('budget');
  expect(r.stderr).not.toContain('ENOENT');
  expect(() => loadRun(dir)).toThrow(/incomplete evaluation/);
  const plan = readPlan(dir);
  expect(plan.panel).toHaveLength(12);
  expect(readCells(dir, plan).size).toBe(0);
  const resumed = spawnSync(process.execPath, args,
    {cwd: root, env: {...env, LR_JOLT_OFFSET_MS: String(plan.jolt + 100)}, encoding: 'utf8', maxBuffer: 2e6});
  expect(resumed.status).toBe(1); expect(resumed.stderr).toContain('run inputs or measurement code changed');
  expect(digest(readPlan(dir))).toBe(digest(plan));
}, 60000);

it('a directory has one writer and can be reacquired after release', async () => {
  const {lockArtifacts} = await import('../scripts/lib/artifact_lock.ts');
  const dir = temporary(), release = lockArtifacts(dir);
  expect(() => lockArtifacts(dir)).toThrow(/already owns/);
  release(); const again = lockArtifacts(dir); again();
});
