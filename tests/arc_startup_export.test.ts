import {expect, it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

it.each([57, 67])('attaches an opening library of arbitrary size using the %i-feature contract', count => {
  const dir = mkdtempSync(join(tmpdir(), 'arc-startup-'));
  try {
    const base = {featureSchema: count === 57 ? 'line.arc-control-policy-features.v1' : 'line.arc-horizon-control-policy-features.v1', featureCount: count};
    const startup = {...base, exemplars: Array.from({length: 3}, () => ({features: Array(count).fill(0)})), proximityTrees: [{}]};
    const write = (name: string, value: unknown) => {
      const path = join(dir, name), bytes = JSON.stringify(value);
      writeFileSync(path, bytes); writeFileSync(path + '.sha256', createHash('sha256').update(bytes).digest('hex'));
      return path;
    };
    const out = join(dir, 'out.json');
    execFileSync('python3', ['scripts/benchmark/attach_arc_startup_policy.py', '--base', write('base.json', base),
      '--library-policy', write('library.json', {models: [base, startup]}), '--out', out]);
    const exported = JSON.parse(readFileSync(out, 'utf8'));
    expect(exported.startupModel).toEqual(startup);
    expect(exported.featureCount).toBe(count);
    expect(exported.startupProvenance.catchPolicyUnchanged).toBe(true);
  } finally {rmSync(dir, {recursive: true, force: true});}
});
