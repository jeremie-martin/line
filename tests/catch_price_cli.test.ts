import {afterEach, expect, it} from 'vitest';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const directories: string[] = [];
const temporary = () => {const path = mkdtempSync(join(tmpdir(), 'catch-study-')); directories.push(path); return path;};
afterEach(() => {for (const path of directories.splice(0)) rmSync(path, {recursive: true, force: true});});
const run = (out: string, ...args: string[]) => spawnSync(process.execPath,
  ['tools/research/catch_price.ts', 'run', out, ...args], {encoding: 'utf8'});

it('preserves existing evidence rather than mixing changed seeds or study policies on resume', () => {
  const out = temporary(), path = join(out, 'probes.jsonl');
  writeFileSync(path, 'old evidence\n');
  const result = run(out, '--seed=202');
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('fresh output directory');
  expect(readFileSync(path, 'utf8')).toBe('old evidence\n');
  expect(existsSync(join(out, 'study.json'))).toBe(false);
});
it('records the new preparation policy and propagates a failed worker', () => {
  const out = join(temporary(), 'new');
  const result = run(out, '--jobs=1', '--specs=missing~spec');
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('unknown study case');
  expect(result.stderr).toContain('worker exited 1');
  expect(JSON.parse(readFileSync(join(out, 'study.json'), 'utf8'))).toMatchObject({schema: 'line.catch-price.v2', seed: 101});
  expect(existsSync(join(out, 'rides.jsonl'))).toBe(false);
});
it('rejects zero workers before creating a misleading empty study', () => {
  const out = join(temporary(), 'new');
  expect(run(out, '--jobs=0').stderr).toContain('--jobs must be an integer from 1 to 64');
  expect(existsSync(out)).toBe(false);
});
