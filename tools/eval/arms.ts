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
import {existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {ENGINE_PATH} from '../../scripts/lib/compiler_identity.ts';
import {digest, evaluatorIdentity} from './inputs.ts';
import {atomicWrite, readJson, type PlannedCase} from './records.ts';
import {measureCell} from './measure.ts';
import {ADAPTER_SHA256, type ArmSettings} from './compile.ts';
import {gunzipSync, gzipSync} from 'node:zlib';

const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
/** What the compiler is made of: the directories its import closure and its
 * runtime-loaded models come from (handoff.ts: scripts/v0, scripts/lib,
 * vendor/lr-core), the native engine source, and dependencies through the
 * lockfile. Specs and songs (productions/) are inputs, checked per case;
 * tools/, the producer and the gallery do not compile anything. */
export const COMPILER_PATHS = ['scripts/v0', 'scripts/lib', 'vendor', 'engine-rs/src', 'package-lock.json', 'tsconfig.json'];
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
/** Content of a commit, without checking it out. A commit is compiled from a
 * worktree with this checkout's built engine and node_modules, so it must have
 * the same engine source and lockfile; otherwise its rides would mix versions. */
export function commitContent(commit: string, engineSha256: string) {
  const same = (path: string) => git('.', 'rev-parse', `${commit}:${path}`).toString().trim() === git('.', 'rev-parse', `HEAD:${path}`).toString().trim()
    && git('.', 'status', '--porcelain', '--', path).toString().trim() === '';
  for (const path of ['engine-rs/src', 'package-lock.json'])
    assert.ok(same(path), `${commit.slice(0, 8)} has another ${path} than this checkout's build; it cannot be compiled faithfully here (check out and build it, or compare within one build)`);
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
/** An arm: the compiler's content, the compile adapter (tools/eval/compile.ts)
 * and the setting. A change to any of them is a different arm. */
export function armKey(contentKey: string, settings: ArmSettings, jolt: number, adapter = ADAPTER_SHA256) {
  return digest({contentKey, adapter, mode: settings.mode, budget: settings.budget, creative: settings.creative ?? {}, jolt}).slice(0, 16);
}
export function openArm(root: string, label: string, content: ReturnType<typeof compilerContent>, settings: ArmSettings, jolt: number): Arm {
  const key = armKey(content.key, settings, jolt), dir = resolve('generated/eval/arms', key);
  mkdirSync(join(dir, 'cells'), {recursive: true});
  // Several commits can share one compiler content (a documentation commit
  // changes nothing); the arm lists the ones it has seen, for provenance.
  const meta = {schema: 'line.eval-arm.v2', contentKey: content.key, adapterSha256: ADAPTER_SHA256,
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
export const galleryPath = (arm: Arm, id: string) => join(arm.dir, 'cells', id + '.gallery.json.gz');
export const readArmGallery = (arm: Arm, id: string) => existsSync(galleryPath(arm, id)) ? JSON.parse(gunzipSync(readFileSync(galleryPath(arm, id))).toString()) : null;
export function saveArmCell(arm: Arm, c: PlannedCase, cell: any, track: any, evaluator: string, provenance: any, gallery?: any) {
  atomicWrite(trackPath(arm, c.id), gzipSync(JSON.stringify(track)));
  if (gallery) atomicWrite(galleryPath(arm, c.id), gzipSync(JSON.stringify(gallery)));
  atomicWrite(cellPath(arm, c.id), JSON.stringify({...cell, case: c, mode: arm.settings.mode, trackHash: digest(track), evaluator, provenance}));
}
export type CellState = {cell: any; remeasured?: true} | {stale: string} | null;
/** A saved cell of `arm` for case `c`: reused when its resolved inputs equal
 * today's, remeasured in place when only the measurement code differs
 * (`remeasured`); `stale` (with the reason) when the inputs changed; null when absent. */
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
  return {cell: readJson(cellPath(arm, c.id)), remeasured: true};
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

export {evaluatorIdentity};
