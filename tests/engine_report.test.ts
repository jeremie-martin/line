import {afterEach, expect, it} from 'vitest';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const directories: string[] = [];
afterEach(() => {for (const dir of directories.splice(0)) rmSync(dir, {recursive: true, force: true});});
function report(record: object) {
  const dir = mkdtempSync(join(tmpdir(), 'engine-report-')); directories.push(dir);
  const path = join(dir, 'result.json'), bytes = JSON.stringify(record);
  writeFileSync(path, bytes);
  const process = spawnSync(globalThis.process.execPath, ['--import', 'tsx', 'tools/measure/engine_ab.ts', `--report=${path}`], {encoding: 'utf8'});
  expect(readFileSync(path, 'utf8')).toBe(bytes); // reporting never rewrites evidence
  return process;
}

it.each([true, false])('reports a saved A/A control with an explicit pass/fail exit (passed=%s)', passed => {
  const r = report({schema: 'line.engine-ab.v2', complete: true, control: true, controlPassed: passed,
    decision: {verdict: passed ? 'INCONCLUSIVE' : 'KEEP'}, cellDecisions: [], performanceQualified: false});
  expect(r.status).toBe(passed ? 0 : 1);
  expect(JSON.parse(r.stdout)).toMatchObject({controlPassed: passed, performanceQualified: false});
});

it('rejects unsupported versions and unfinished historical measurements', () => {
  expect(report({schema: 'line.engine-ab.v1', complete: true}).status).not.toBe(0);
  expect(report({schema: 'line.engine-ab.v2', complete: false}).status).not.toBe(0);
});

const partial = {schema: 'line.engine-ab.v3', complete: false, protocol: {rounds: 12},
  samples: [{round: 0, arm: 1, nsPerFrame: 90}, {round: 0, arm: 0, nsPerFrame: 100},
    {round: 1, arm: 0, nsPerFrame: 200}, {round: 1, arm: 1, nsPerFrame: 220}]};

it('reports unfinished v3 observations without allowing them to qualify a candidate', () => {
  const r = report({...partial, performanceQualified: true, decision: {verdict: 'FASTER'}});
  expect(r.status).toBe(1);
  const output = JSON.parse(r.stdout);
  expect(output).toMatchObject({complete: false, performanceQualified: false,
    progress: {plannedPairs: 12, n: 2, medianDeltaPct: 0, fasterPairs: 1, slowerPairs: 1, tiedPairs: 0}});
  expect(output).not.toHaveProperty('decision');
  expect(output.progress).not.toHaveProperty('intervalPct');
  const empty = report({...partial, samples: []});
  expect(empty.status).toBe(1);
  expect(JSON.parse(empty.stdout).progress).toMatchObject({n: 0, medianDeltaPct: null});
});

it.each([
  {samples: partial.samples.slice(1)},
  {samples: partial.samples.map(s => ({...s, arm: 0}))},
  {samples: partial.samples.map(s => ({...s, round: s.round + 1}))},
])('refuses malformed process pairs in unfinished evidence (%j)', ({samples}) => {
  const r = report({...partial, samples});
  expect(r.status).not.toBe(0);
  expect(r.stdout).toBe('');
});

it.each(['null', 'slowdown'])('v3 reports control failures without qualifying a candidate (%s)', control => {
  const r = report({schema: 'line.engine-ab.v3', complete: true, control, controlPassed: false,
    decision: {verdict: 'INCONCLUSIVE'}, performanceQualified: false});
  expect(r.status).toBe(1);
  expect(JSON.parse(r.stdout).performanceQualified).toBe(false);
});

it('rejects misspelled protocol flags before starting measurements', () => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'tools/measure/engine_ab.ts', '--confidnce=.99'], {encoding: 'utf8'});
  expect(r.status).not.toBe(0);
  expect(r.stderr).toContain('unknown option');
});

it.each([['--confidence'], ['--rounds=12', '--rounds=24'], ['--help=true']])('rejects ambiguous protocol options %j', (...args) => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'tools/measure/engine_ab.ts', ...args], {encoding: 'utf8'});
  expect(r.status).not.toBe(0);
});
