import {afterEach, expect, it, vi} from 'vitest';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const clock = vi.hoisted(() => ({ms: 0}));
vi.mock('../scripts/v0/optimizer/handoff.ts', () => ({compileHandoff: () => {
  clock.ms += 40;
  return {stats: {sim_frames: 100}, track: {toJSON() {
    clock.ms += 1000; // deliberately expensive hashing/output serialization
    return {lines: []};
  }}};
}}));
import {compileWorker} from '../tools/parity/parity.ts';

const directories: string[] = [];
afterEach(() => {vi.restoreAllMocks(); for (const dir of directories.splice(0)) rmSync(dir, {recursive: true, force: true});});

it('measures compile CPU and wall time before hashing, serialization and resource capture', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'compile-measurement-')); directories.push(dir);
  const out = join(dir, 'cell.json');
  clock.ms = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock.ms);
  vi.spyOn(process, 'cpuUsage').mockImplementation(previous => ({user: clock.ms * 1000 - (previous?.user ?? 0), system: 0}));
  await compileWorker(61, out, true);
  const result = JSON.parse(readFileSync(out, 'utf8'));
  expect(result.compileMs).toBe(40);
  expect(result.compileCpuMs).toBe(40);
  expect(result.physicalFrames).toBe(100);
  expect(clock.ms).toBeGreaterThan(1000);
  expect(result.resources.wasmLinearMemoryBytes).toBeGreaterThan(0);
  expect(result.resources.heapUsed).toBeGreaterThan(0);
  expect(result.resources.rss).toBeGreaterThan(0);
  expect(result.resources.processMaxRssBytes).toBeGreaterThan(0);
});
