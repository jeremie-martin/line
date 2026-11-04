/** Exercise the actual command in a minimal checkout. No filesystem mocks and
 * no renaming the developer's judge artifact to simulate a fresh installation. */
import {afterEach, expect, it} from 'vitest';
import {appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {referenceWasm, type EngineReference} from '../tools/parity/engine_fingerprints.ts';
import {sha256} from '../tools/parity/engine_corpus.ts';

const root = fileURLToPath(new URL('../', import.meta.url)), directories: string[] = [];
afterEach(() => {for (const path of directories.splice(0)) rmSync(path, {recursive: true, force: true});});
function checkout() {
  const dir = mkdtempSync(join(tmpdir(), 'engine-quick-')); directories.push(dir);
  for (const file of ['package.json', 'tools/parity/engine_quick.ts', 'tools/parity/engine_fingerprints.ts',
    'tools/parity/engine_corpus.ts', 'tools/parity/engine-reference.json', 'tools/parity/tracks',
    'scripts/lib/rng.ts', 'scripts/lib/native_motion/engine.wasm']) {
    mkdirSync(dirname(join(dir, file)), {recursive: true});
    cpSync(join(root, file), join(dir, file), {recursive: true});
  }
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'));
  // Harmless generator/corpus edits must not require re-blessing saved physics.
  for (const file of ['engine_fingerprints.ts', 'engine_corpus.ts'])
    appendFileSync(join(dir, 'tools/parity', file), '\n// Source formatting does not change the evidence contract.\n');
  return dir;
}
const run = (cwd: string, ...args: string[]) => spawnSync(process.execPath,
  ['--import', 'tsx', 'tools/parity/engine_quick.ts', ...args], {cwd, encoding: 'utf8'});

it('checks saved physics with an absent or unusable local judge and preserves the fixture', () => {
  const dir = checkout(), fixture = join(dir, 'tools/parity/engine-reference.json'), before = readFileSync(fixture);
  const judge = join(dir, 'engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm');
  for (const available of [false, true]) {
    if (available) {mkdirSync(dirname(judge), {recursive: true}); writeFileSync(judge, 'not a WASM module');}
    const checked = run(dir);
    expect(checked.status, checked.stderr).toBe(0);
    expect(checked.stdout).toContain('65 cases, 68827 exact frame states, 432018 ordered collisions');
    const output = join(dir, `new-${available}.json`), generation = run(dir, `--write-reference=${output}`);
    expect(generation.status).not.toBe(0); // generation still needs a usable oracle
    expect(existsSync(output)).toBe(false);
    expect(readFileSync(fixture)).toEqual(before);
  }
  // A semantic change in a corpus dependency is caught by the actual inputs,
  // even though none of the provenance hashes is used as a compatibility gate.
  const rng = join(dir, 'scripts/lib/rng.ts');
  writeFileSync(rng, readFileSync(rng, 'utf8').replace('let s = seed | 0;', 'let s = (seed + 1) | 0;'));
  const changedInputs = run(dir);
  expect(changedInputs.status).not.toBe(0);
  expect(changedInputs.stderr).toContain('stale or incomplete engine corpus');
  expect(readFileSync(fixture)).toEqual(before);
});
it('records a differently encoded oracle only when explicitly generating new evidence', () => {
  const dir = checkout(), fixture = join(dir, 'tools/parity/engine-reference.json'), before = readFileSync(fixture);
  const saved = JSON.parse(before.toString()) as EngineReference;
  // A valid custom section changes binary identity without changing physics.
  const section = Buffer.from([1, 120, 1]); // custom-section name "x", one data byte
  const oracle = Buffer.concat([readFileSync(referenceWasm), Buffer.from([0, section.length]), section]);
  expect(WebAssembly.validate(oracle)).toBe(true);
  const judge = join(dir, 'engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm');
  mkdirSync(dirname(judge), {recursive: true}); writeFileSync(judge, oracle);
  expect(sha256(oracle)).not.toBe(saved.provenance.oracleSha256);
  const checked = run(dir);
  expect(checked.status, checked.stderr).toBe(0);
  const output = join(dir, 'new.json'), generation = run(dir, `--write-reference=${output}`);
  expect(generation.status, generation.stderr).toBe(0);
  const generated = JSON.parse(readFileSync(output, 'utf8')) as EngineReference;
  expect(generated.cases).toEqual(saved.cases);
  expect(generated.provenance.oracleSha256).toBe(sha256(oracle));
  for (const [key, file] of [['generatorSha256', 'engine_fingerprints.ts'], ['corpusSha256', 'engine_corpus.ts']] as const)
    expect(generated.provenance[key]).toBe(sha256(readFileSync(join(dir, 'tools/parity', file))));
  const noOverwrite = run(dir, `--write-reference=${fixture}`);
  expect(noOverwrite.status).not.toBe(0);
  expect(noOverwrite.stderr).toContain('EEXIST');
  expect(readFileSync(fixture)).toEqual(before);
});
