import {afterEach, expect, it} from 'vitest';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {sourceOverlay} from '../tools/measure/engine_sources.ts';
const directories: string[] = [];
function directory() { const dir = mkdtempSync(join(tmpdir(), 'engine-source-')); directories.push(dir); return dir; }
function put(dir: string, name: string, value: string) {
  const path = join(dir, name); mkdirSync(dirname(path), {recursive: true}); writeFileSync(path, value);
}
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, {recursive: true, force: true}); });

it('replays frozen additions, removals and changes in one cwd without rereading live sources', () => {
  const reference = directory(), candidate = directory();
  put(reference, 'old/module.ts', 'old'); put(reference, 'wrapper.ts', 'reference');
  put(candidate, 'new/module.ts', 'new'); put(candidate, 'wrapper.ts', 'candidate');
  put(reference, 'stable.ts', 'same'); put(candidate, 'stable.ts', 'same');
  const overlay = sourceOverlay(reference, candidate);
  expect(overlay.sourceSha256[0]).not.toBe(overlay.sourceSha256[1]);
  expect(overlay.changed).toEqual(['new/module.ts', 'old/module.ts', 'wrapper.ts']);
  put(reference, 'wrapper.ts', 'changed after freeze');
  for (let i = 0; i < 2; i++) {
    overlay.activate(0);
    expect(readFileSync(join(candidate, 'wrapper.ts'), 'utf8')).toBe('reference');
    expect(existsSync(join(candidate, 'new/module.ts'))).toBe(false);
    expect(readFileSync(join(candidate, 'old/module.ts'), 'utf8')).toBe('old');
    overlay.activate(1);
    expect(readFileSync(join(candidate, 'wrapper.ts'), 'utf8')).toBe('candidate');
    expect(existsSync(join(candidate, 'old/module.ts'))).toBe(false);
    expect(readFileSync(join(candidate, 'new/module.ts'), 'utf8')).toBe('new');
    expect(readFileSync(join(candidate, 'stable.ts'), 'utf8')).toBe('same');
  }
});

it('treats identical source as a control independently of the swapped binary', () => {
  const reference = directory(), candidate = directory();
  for (const dir of [reference, candidate]) put(dir, 'wrapper.ts', 'same');
  put(reference, 'scripts/lib/native_motion/engine.wasm', 'base wasm');
  put(candidate, 'scripts/lib/native_motion/engine.wasm', 'new wasm');
  const overlay = sourceOverlay(reference, candidate);
  expect(overlay.changed).toEqual([]);
  expect(overlay.sourceSha256[0]).toBe(overlay.sourceSha256[1]);
  overlay.activate(0);
  expect(readFileSync(join(candidate, 'scripts/lib/native_motion/engine.wasm'), 'utf8')).toBe('new wasm');
});

it.each(['tools/parity/cells.json', 'tools/parity/tracks/track.json.gz', 'productions/a/input.json',
  'vendor/lr-core/kernel.js', 'engine-rs/src/kernel.rs', 'package-lock.json'])(
  'rejects changed measurement input %s', name => {
    const reference = directory(), candidate = directory();
    put(reference, name, 'base'); put(candidate, name, 'different');
    expect(() => sourceOverlay(reference, candidate)).toThrow(`performance inputs differ: ${name}`);
  });
