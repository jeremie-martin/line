/** Bookkeeping for `compare`: arms, their saved cells, and named references.
 *
 * An arm is one compiler (by content, not by commit) under one setting
 * (mode, allowance, creative preferences, jolt). Its cells live in
 * generated/eval/arms/<key>/ and are reused by any panel that declares the
 * same resolved case. A saved cell is compatible when its resolved inputs
 * equal today's; when only the measurement code changed, its track is
 * remeasured (compiler outputs carried over), never recompiled. A reference is
 * a name for a commit, in generated/eval/references/<name>.json. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, copyFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {ENGINE_PATH} from '../../scripts/lib/compiler_identity.ts';
import {digest, evaluatorIdentity} from './inputs.ts';
import {atomicWrite, readJson, type PlannedCase} from './records.ts';
import {measureCell} from './measure.ts';
import type {ArmSettings} from './compile.ts';
import {gunzipSync, gzipSync} from 'node:zlib';

const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
/** What the compiler is made of. Specs and songs (productions/) are inputs,
 * checked per case; tools/ is measurement and bookkeeping. */
export const COMPILER_PATHS = ['scripts', 'benchmark', 'engine-rs/src', 'package.json', 'package-lock.json', 'tsconfig.json'];
const git = (root: string, ...args: string[]) => execFileSync('git', ['-C', root, ...args], {encoding: 'buffer', maxBuffer: 1 << 30});
const EMPTY = sha('');

/** The compiler's content at `root`: the committed trees of COMPILER_PATHS,
 * any uncommitted or untracked change to them, and the native engine bytes.
 * A documentation-only commit leaves it unchanged. */
export function compilerContent(root: string) {
  const head = git(root, 'rev-parse', 'HEAD').toString().trim();
  const trees = Object.fromEntries(COMPILER_PATHS.map(p => [p, git(root, 'rev-parse', `HEAD:${p}`).toString().trim()]));
  const untracked = git(root, 'ls-files', '--others', '--exclude-standard', '-z', '--', ...COMPILER_PATHS).toString().split('\0').filter(Boolean).sort();
  const changes = createHash('sha256').update(git(root, 'diff', '--binary', 'HEAD', '--', ...COMPILER_PATHS));
  for (const path of untracked) changes.update(path + '\0').update(readFileSync(join(root, path)));
  const dirtySha256 = changes.digest('hex'), engineSha256 = sha(readFileSync(join(root, ENGINE_PATH)));
  const key = digest({trees, dirtySha256, engineSha256});
  return {key, head, clean: dirtySha256 === EMPTY, dirtySha256, engineSha256};
}
/** Content of a commit, without checking it out. */
export function commitContent(commit: string, engineSha256: string) {
  const trees = Object.fromEntries(COMPILER_PATHS.map(p => [p, git('.', 'rev-parse', `${commit}:${p}`).toString().trim()]));
  return {key: digest({trees, dirtySha256: EMPTY, engineSha256}), head: commit, clean: true, dirtySha256: EMPTY, engineSha256};
}
export const resolveCommit = (ref: string) => git('.', 'rev-parse', '--verify', `${ref}^{commit}`).toString().trim();

/** A checkout of `commit` the workers compile from. Only the compiler comes
 * from it: songs, audio and measurement come from this checkout. Ignored build
 * outputs it needs (node_modules, the native engine) are linked from here. */
export function worktreeFor(commit: string) {
  const dir = resolve('generated/eval/worktrees', commit.slice(0, 12));
  if (!existsSync(join(dir, '.git'))) {
    mkdirSync(resolve('generated/eval/worktrees'), {recursive: true});
    execFileSync('git', ['worktree', 'add', '--detach', '--quiet', dir, commit]);
  }
  assert.equal(git(dir, 'rev-parse', 'HEAD').toString().trim(), commit, `${dir} is not at ${commit}: remove it with \`git worktree remove ${dir}\``);
  if (!existsSync(join(dir, 'node_modules'))) symlinkSync(resolve('node_modules'), join(dir, 'node_modules'));
  const engine = join(dir, ENGINE_PATH);
  if (!existsSync(engine)) {mkdirSync(join(engine, '..'), {recursive: true}); symlinkSync(resolve(ENGINE_PATH), engine);}
  return dir;
}

export type Arm = {key: string; dir: string; root: string; label: string; content: ReturnType<typeof compilerContent>; settings: ArmSettings; jolt: number};
export function armKey(contentKey: string, settings: ArmSettings, jolt: number) {
  return digest({contentKey, mode: settings.mode, budget: settings.budget, creative: settings.creative ?? {}, jolt}).slice(0, 16);
}
export function openArm(root: string, label: string, content: ReturnType<typeof compilerContent>, settings: ArmSettings, jolt: number): Arm {
  const key = armKey(content.key, settings, jolt), dir = resolve('generated/eval/arms', key);
  mkdirSync(join(dir, 'cells'), {recursive: true});
  // Several commits can share one compiler content (a documentation commit
  // changes nothing); the arm lists the ones it has seen, for provenance.
  const meta = {schema: 'line.eval-arm.v1', contentKey: content.key,
    engineSha256: content.engineSha256, mode: settings.mode, budget: settings.budget, creative: settings.creative ?? {}, jolt};
  const commit = content.clean ? content.head : 'uncommitted changes on ' + content.head;
  if (existsSync(join(dir, 'arm.json'))) {
    const {commits, ...saved} = readJson(join(dir, 'arm.json'));
    assert.deepEqual(saved, meta, `${dir}/arm.json does not describe this arm`);
    if (!commits.includes(commit)) atomicWrite(join(dir, 'arm.json'), JSON.stringify({...meta, commits: [...commits, commit]}, null, 1));
  } else atomicWrite(join(dir, 'arm.json'), JSON.stringify({...meta, commits: [commit]}, null, 1));
  return {key, dir, root, label, content, settings, jolt};
}

const cellPath = (arm: Arm, id: string) => join(arm.dir, 'cells', id + '.json');
export const trackPath = (arm: Arm, id: string) => join(arm.dir, 'cells', id + '.track.json.gz');
export const readArmTrack = (arm: Arm, id: string) => JSON.parse(gunzipSync(readFileSync(trackPath(arm, id))).toString());
export function saveArmCell(arm: Arm, c: PlannedCase, cell: any, track: any, evaluator: string, provenance: any) {
  atomicWrite(trackPath(arm, c.id), gzipSync(JSON.stringify(track)));
  atomicWrite(cellPath(arm, c.id), JSON.stringify({...cell, case: c, mode: arm.settings.mode, trackHash: digest(track), evaluator, provenance}));
}
export type CellState = {cell: any} | {stale: string} | null;
/** A saved cell of `arm` for case `c`: reused when its resolved inputs equal
 * today's, remeasured in place when only the measurement code differs;
 * `stale` (with the reason) when the inputs changed; null when absent. */
export async function savedCell(arm: Arm, c: PlannedCase, evaluator: string, resolved: () => Promise<{spec: any; music: any}>): Promise<CellState> {
  if (!existsSync(cellPath(arm, c.id))) return null;
  const cell = readJson(cellPath(arm, c.id));
  if (JSON.stringify(cell.case) !== JSON.stringify(c)) return {stale: describeInputChange(cell.case, c)};
  const track = readArmTrack(arm, c.id);
  assert.equal(digest(track), cell.trackHash, `${cellPath(arm, c.id)}: saved track differs from its cell`);
  if (cell.evaluator === evaluator) return {cell};
  // Same compiler, same inputs, newer measurement code: replay the saved track.
  const {spec, music} = await resolved(), prior = cell;
  const remeasured = measureCell({c, mode: arm.settings.mode, spec, music, track, physicalFrames: prior.physicalFrames, compileMs: prior.compileMs,
    complete: prior.complete, fulfilled: prior.fulfilled, motion: prior.motion, geometry: prior.geometry});
  saveArmCell(arm, c, remeasured, track, evaluator, {...prior.provenance, remeasuredFrom: prior.evaluator});
  return {cell: readJson(cellPath(arm, c.id))};
}
function describeInputChange(old: any, now: any) {
  const keys = [...new Set([...Object.keys(old), ...Object.keys(now)])].filter(k => JSON.stringify(old[k]) !== JSON.stringify(now[k]));
  return `inputs changed (${keys.join(', ')})`;
}

/** Named references: a name for a commit, plus a note. */
const refDir = () => resolve('generated/eval/references');
export type Reference = {name: string; commit: string; note?: string; setAt: string};
export function setReference(name: string, commit: string, note?: string) {
  assert.match(name, /^[A-Za-z0-9._-]+$/, 'reference names use letters, digits, dot, dash and underscore');
  mkdirSync(refDir(), {recursive: true});
  const ref: Reference = {name, commit, ...(note ? {note} : {}), setAt: new Date().toISOString()};
  atomicWrite(join(refDir(), name + '.json'), JSON.stringify(ref, null, 1));
  return ref;
}
export function getReference(name: string): Reference {
  const path = join(refDir(), name + '.json');
  assert.ok(existsSync(path), `no reference named ${name}; set one with \`npm run compare -- reference set ${name} --from=<commit>\``);
  return readJson(path);
}
export const listReferences = (): Reference[] => existsSync(refDir())
  ? readdirSync(refDir()).filter(f => f.endsWith('.json')).map(f => readJson(join(refDir(), f))) : [];

/** Bring an `eval` run into the arm store, when its compiler can be identified
 * exactly: a clean commit, or a commit whose only difference was untracked
 * files that are byte-identical today (verified against the recorded digest).
 * Cells keep their measurement identity and are remeasured on first use. */
export function importRun(runDirPath: string) {
  const plan = readJson(join(runDirPath, 'run.json')), id = plan.identity;
  assert.ok(id?.head && id?.dirtySha256 && id?.engineSha256, 'the run records no compiler identity');
  assert.equal(id.engineSha256, sha(readFileSync(ENGINE_PATH)), 'the run used other native physics');
  if (id.dirtySha256 !== EMPTY) {
    const PATHS = ['scripts', 'benchmark', 'engine-rs/src', 'productions', 'package.json', 'package-lock.json', 'tsconfig.json'];
    const untracked = git('.', 'ls-files', '--others', '--exclude-standard', '-z', '--', ...PATHS).toString().split('\0').filter(Boolean).sort();
    const h = createHash('sha256');
    for (const path of untracked) h.update(path + '\0').update(readFileSync(path));
    assert.ok(untracked.length === id.untracked && h.digest('hex') === id.dirtySha256,
      'the run was compiled with uncommitted changes that cannot be identified; recompile it instead');
  }
  const content = commitContent(id.head, id.engineSha256), settings = {mode: plan.mode, budget: plan.budget, ...(plan.creative ? {creative: plan.creative} : {})};
  const arm = openArm('.', `import ${id.head.slice(0, 8)}`, content, settings, plan.jolt);
  let copied = 0, kept = 0;
  for (const c of plan.panel) {
    const from = join(runDirPath, 'cells', c.id);
    if (!existsSync(from + '.json')) continue;
    if (existsSync(cellPath(arm, c.id))) {kept++; continue;}
    const cell = readJson(from + '.json');
    copyFileSync(from + '.track.json.gz', trackPath(arm, c.id));
    const {planSha256: _p, ...rest} = cell;
    atomicWrite(cellPath(arm, c.id), JSON.stringify({...rest, evaluator: plan.evaluator, provenance: {importedFrom: runDirPath, commit: id.head}}));
    copied++;
  }
  return {arm, copied, kept};
}
export {evaluatorIdentity};
