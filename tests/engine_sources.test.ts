import {execFileSync} from 'node:child_process';
import {afterEach, expect, it} from 'vitest';
import {mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {changedSources, enginePath, snapshotSources} from '../tools/measure/engine_sources.ts';
const directories: string[] = [];
function directory() { const dir = mkdtempSync(join(tmpdir(), 'engine-source-')); directories.push(dir); return dir; }
function put(dir: string, name: string, value: string) {
  const path = join(dir, name); mkdirSync(dirname(path), {recursive: true}); writeFileSync(path, value);
}
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, {recursive: true, force: true}); });

it('lists additions, removals and changes, ignoring the engine binary each arm carries', () => {
  const reference = directory(), candidate = directory();
  put(reference, 'old/module.ts', 'old'); put(reference, 'wrapper.ts', 'reference');
  put(candidate, 'new/module.ts', 'new'); put(candidate, 'wrapper.ts', 'candidate');
  put(reference, 'stable.ts', 'same'); put(candidate, 'stable.ts', 'same');
  put(reference, enginePath, 'base wasm'); put(candidate, enginePath, 'new wasm');
  expect(changedSources(reference, candidate)).toEqual(['new/module.ts', 'old/module.ts', 'wrapper.ts']);
});

it.each(['tools/parity/cells.json', 'tools/parity/cases.json.gz', 'tools/parity/tracks/track.json.gz', 'productions/a/input.json',
  'vendor/lr-core/kernel.js', 'engine-rs/src/kernel.rs'])(
  'rejects changed measurement input %s', name => {
    const reference = directory(), candidate = directory();
    put(reference, name, 'base'); put(candidate, name, 'different');
    expect(() => changedSources(reference, candidate)).toThrow(`performance inputs differ: ${name}`);
  });

it('allows a lockfile change: both arms run the same node_modules', () => {
  const reference = directory(), candidate = directory();
  put(reference, 'package-lock.json', 'old'); put(candidate, 'package-lock.json', 'new');
  expect(changedSources(reference, candidate)).toEqual(['package-lock.json']);
});

it('snapshots what a commit contains, leaving ignored local data behind', () => {
  const source = directory(), destination = join(directory(), 'snapshot'), git = (...args: string[]) => execFileSync('git', args, {cwd: source});
  git('init', '-q');
  put(source, '.gitignore', '*.mp3\n*_selection/\n');
  put(source, 'productions/song/spec.ts', 'spec'); put(source, 'productions/song/audio.mp3', 'audio');
  put(source, 'productions/song_selection/take.wav', 'take');
  for (const dir of ['scripts', 'tools', 'vendor', 'engine-rs']) put(source, `${dir}/file.ts`, 'file');
  for (const file of ['package.json', 'package-lock.json', 'tsconfig.json']) put(source, file, '{}');
  const runner = directory();
  for (const file of ['tools/parity/parity.ts', 'scripts/lib/workers.ts', 'engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm']) put(runner, file, 'runner');
  snapshotSources(source, destination, runner);
  expect(existsSync(join(destination, 'productions/song/spec.ts'))).toBe(true);
  expect(existsSync(join(destination, 'productions/song/audio.mp3'))).toBe(false);
  expect(existsSync(join(destination, 'productions/song_selection'))).toBe(false);
});
