import {expect, it} from 'vitest';
import {defaultWorkerJobs} from '../tools/lib/worker_jobs.ts';

it('bounds compiler workers by both CPU availability and memory', () => {
  expect(defaultWorkerJobs(20, 16_000_000_000)).toBe(4);
  expect(defaultWorkerJobs(2, 64_000_000_000)).toBe(2);
  expect(defaultWorkerJobs(64, 62_000_000_000)).toBe(15);
  expect(defaultWorkerJobs(128, 256_000_000_000)).toBe(23);
  expect(defaultWorkerJobs(1, 1_000_000_000)).toBe(1);
});
