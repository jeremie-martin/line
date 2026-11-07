/** Frozen source arms for compiler measurements: what each arm runs, and what must be
 * the same in both. A fixed runner and shared `node_modules` keep the comparison about
 * the source. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {basename, dirname, join, relative} from 'node:path';

export const enginePath = 'scripts/lib/native_motion/engine.wasm';
/** Fixed in both arms. A compile replays its final track on the judge as its own check. */
const runnerFiles = ['tools/parity/parity.ts', 'scripts/lib/workers.ts', 'engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm'];

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
  for (const file of runnerFiles) {
    mkdirSync(dirname(join(destination, file)), {recursive: true});
    copyFileSync(join(runnerRoot, file), join(destination, file));
  }
}

function sourceFiles(root: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  function visit(dir: string) {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name), rel = relative(root, path);
      if (name === 'node_modules') continue;
      if (statSync(path).isDirectory()) visit(path);
      else if (rel !== enginePath) files.set(rel, readFileSync(path));
    }
  }
  visit(root);
  return files;
}

function sharedInput(name: string): boolean {
  return name === 'tools/parity/cells.json' || name === 'tools/parity/cases.json.gz' ||
    ['productions/', 'vendor/', 'tools/parity/tracks/', 'tools/parity/physics-tracks/', 'engine-rs/src/'].some(prefix => name.startsWith(prefix));
}

/** Files that differ between the arms; a measurement input may not be among them. */
export function changedSources(reference: string, candidate: string): string[] {
  const arms = [sourceFiles(reference), sourceFiles(candidate)];
  const names = [...new Set(arms.flatMap(files => [...files.keys()]))].sort();
  const changed = names.filter(name => !arms[0].get(name)?.equals(arms[1].get(name) ?? Buffer.alloc(0)) ||
    arms[0].has(name) !== arms[1].has(name));
  for (const name of changed) assert(!sharedInput(name), `performance inputs differ: ${name}`);
  return changed;
}
