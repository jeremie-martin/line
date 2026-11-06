/** Frozen source arms for engine measurements. Both run in the same disposable
 * cwd with the same runner, inputs and dependencies; only changed source files
 * are swapped between fresh processes, outside the measured interval. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {basename, dirname, join, relative} from 'node:path';

const enginePath = 'scripts/lib/native_motion/engine.wasm';
export const judgePath = 'engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm';
const runnerFiles = ['tools/measure/engine_ab.ts', 'tools/measure/engine_sources.ts',
  'tools/measure/engine_decision.ts', 'tools/measure/engine_workload.ts', 'tools/parity/engine_corpus.ts', 'tools/parity/parity.ts', 'scripts/lib/workers.ts'];
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

const SOURCE_DIRS = ['scripts', 'tools', 'productions', 'vendor', 'engine-rs'];

/** What git ignores in a checkout: audio, renders and other local data. No compile
 * reads them, and they are absent from a commit, so neither arm may contain them. */
function ignoredPaths(root: string): Set<string> {
  if (!existsSync(join(root, '.git'))) return new Set();
  const listed = execFileSync('git', ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '--', ...SOURCE_DIRS],
    {cwd: root, encoding: 'utf8', maxBuffer: 2 ** 28});
  return new Set(listed.split('\n').filter(Boolean).map(path => path.replace(/\/$/, '')));
}

export function snapshotSources(source: string, destination: string, runnerRoot: string): void {
  mkdirSync(destination, {recursive: true});
  const ignored = ignoredPaths(source);
  for (const dir of SOURCE_DIRS)
    cpSync(join(source, dir), join(destination, dir), {recursive: true,
      filter: path => !ignored.has(relative(source, path)) && !['target', 'node_modules', '.cache', '__pycache__'].includes(basename(path))});
  for (const file of ['package.json', 'package-lock.json', 'tsconfig.json'])
    copyFileSync(join(source, file), join(destination, file));
  for (const file of ['.nvmrc', 'rust-toolchain.toml'])
    if (existsSync(join(source, file))) copyFileSync(join(source, file), join(destination, file));
  // The independent judge and measurement runner are fixed in both arms.
  for (const file of [judgePath, ...runnerFiles]) {
    mkdirSync(dirname(join(destination, file)), {recursive: true});
    copyFileSync(join(runnerRoot, file), join(destination, file));
  }
}

function sourceFiles(root: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  function visit(dir: string) {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name), rel = relative(root, path);
      if (statSync(path).isDirectory()) visit(path);
      else if (rel !== enginePath) files.set(rel, readFileSync(path));
    }
  }
  visit(root);
  return files;
}

function identity(files: Map<string, Buffer>): string {
  const digest = createHash('sha256');
  for (const [name, bytes] of files) { digest.update(name + '\0'); digest.update(hash(bytes)); }
  return digest.digest('hex');
}

function sharedInput(name: string): boolean {
  return name === 'package-lock.json' || name === 'tools/parity/cells.json' || name === 'tools/parity/cases.json.gz' ||
    ['productions/', 'vendor/', 'tools/parity/tracks/', 'tools/parity/physics-tracks/', 'engine-rs/src/'].some(prefix => name.startsWith(prefix));
}

/** Freeze bytes before measurements. The candidate directory is also the common
 * execution cwd. Never read live sources again while activating an arm. */
export function sourceOverlay(reference: string, candidate: string) {
  const arms = [sourceFiles(reference), sourceFiles(candidate)];
  const names = [...new Set(arms.flatMap(files => [...files.keys()]))].sort();
  const changed = names.filter(name => !arms[0].get(name)?.equals(arms[1].get(name) ?? Buffer.alloc(0)) ||
    arms[0].has(name) !== arms[1].has(name));
  for (const name of changed) assert(!sharedInput(name), `performance inputs differ: ${name}`);
  let active = 1;
  return {
    sourceSha256: arms.map(identity),
    changed,
    activate(arm: number) {
      assert(arm === 0 || arm === 1);
      if (arm === active) return;
      // Remove first so file/directory replacements cannot retain stale modules.
      for (const name of changed) rmSync(join(candidate, name), {recursive: true, force: true});
      for (const name of changed) {
        const bytes = arms[arm].get(name);
        if (bytes === undefined) continue;
        const path = join(candidate, name);
        mkdirSync(dirname(path), {recursive: true});
        writeFileSync(path, bytes);
      }
      active = arm;
    },
  };
}
