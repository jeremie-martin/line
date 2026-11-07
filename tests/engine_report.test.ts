import {afterEach, expect, it} from 'vitest';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const directories: string[] = [];
afterEach(() => {for (const dir of directories.splice(0)) rmSync(dir, {recursive: true, force: true});});
function report(...records: object[]) {
  const dir = mkdtempSync(join(tmpdir(), 'engine-report-')); directories.push(dir);
  const paths = records.map((record, i) => {
    const path = join(dir, `${i}.json`);
    writeFileSync(path, JSON.stringify(record));
    return path;
  });
  const result = spawnSync(process.execPath, ['tools/measure/engine_ab.ts', `--report=${paths.join(',')}`], {encoding: 'utf8'});
  records.forEach((record, i) => expect(readFileSync(paths[i], 'utf8')).toBe(JSON.stringify(record))); // reading never rewrites
  return result;
}
const sample = (round: number, arm: number, nsPerFrame: number) => ({round, arm, cell: 'luna', nsPerFrame, maxRssMb: arm ? 800 : 850});
const samples = Array.from({length: 8}, (_, round) => [sample(round, 0, 1000), sample(round, 1, 900 + round)]).flat();
const run = {schema: 'line.engine-ab.v4', name: 'idea', complete: true, rounds: 8, samples, identical: false,
  decision: {medianDeltaPct: -9.65, intervalPct: [-10, -9.3], verdict: 'FASTER'}};

it('compares saved runs one line each, without a script', () => {
  const r = report(run, {...run, name: 'a-longer-name', identical: true, decision: {...run.decision, verdict: 'INCONCLUSIVE'}});
  expect(r.status).toBe(0);
  const [first, second] = r.stdout.trim().split('\n');
  expect(first).toMatch(/^idea +FASTER +-9\.7% \[-10\.0, -9\.3\]  8 faster, 0 slower  1000 -> 904 ns  memory -50 MB$/);
  expect(second).toMatch(/^a-longer-name +unclear .*\(identical arms\)$/);
});

it('shows an unfinished run as what it has so far', () => {
  const r = report({...run, complete: false, samples: samples.slice(0, 5), decision: undefined});
  expect(r.status).toBe(0);
  expect(r.stdout.trim()).toMatch(/^idea  unfinished 2\/8 pairs, -9\.\d% so far$/);
});

it('refuses runs from an older format', () => {
  expect(report({schema: 'line.engine-ab.v3', complete: true}).status).not.toBe(0);
});

it('rejects a misspelled option before measuring anything', () => {
  const r = spawnSync(process.execPath, ['tools/measure/engine_ab.ts', '--againts=HEAD'], {encoding: 'utf8'});
  expect(r.status).not.toBe(0);
  expect(r.stderr).toContain('againts');
});
