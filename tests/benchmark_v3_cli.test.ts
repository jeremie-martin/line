import { describe, test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const cli = (...args: string[]) => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/benchmark/v3.ts', 'compare', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const candidate = 'benchmark/v3/runs/initial-after.json.gz';
describe('V3 archived comparison boundary', () => {
  test('a published compressed baseline compares to itself at exactly zero', () => {
    const result = JSON.parse(cli(`--candidate=${candidate}`));
    expect(result.delta).toBe(0); expect(result.validAfter).toBe(176);
  });
  test('a hash-valid but incomplete panel cannot publish a comparison', () => {
    const dir = mkdtempSync(join(tmpdir(), 'line-v3-incomplete-'));
    try {
      const run = JSON.parse(gunzipSync(readFileSync(candidate)).toString()); run.rows.pop();
      const path = join(dir, 'run.json'), body = JSON.stringify(run);
      writeFileSync(path, body); writeFileSync(path + '.sha256', createHash('sha256').update(body).digest('hex'));
      expect(() => cli(`--candidate=${path}`)).toThrow(/incomplete/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test('altered seed plans are rejected even when file hashes are valid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'line-v3-seeds-'));
    try {
      const run = JSON.parse(gunzipSync(readFileSync(candidate)).toString()); run.plan.seeds = [16, 18];
      const path = join(dir, 'run.json'), body = JSON.stringify(run);
      writeFileSync(path, body); writeFileSync(path + '.sha256', createHash('sha256').update(body).digest('hex'));
      expect(() => cli(`--candidate=${path}`)).toThrow(/seed mismatch/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
