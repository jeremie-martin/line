import {expect, it} from 'vitest';
import {defaultWorkerJobs, workerJobs, WorkerPool} from '../scripts/lib/workers.ts';

it('bounds compiler workers by both CPU availability and memory', () => {
  expect(defaultWorkerJobs(20, 16_000_000_000)).toBe(8);
  expect(defaultWorkerJobs(2, 64_000_000_000)).toBe(2);
  expect(defaultWorkerJobs(64, 62_000_000_000)).toBe(23);
  expect(defaultWorkerJobs(128, 256_000_000_000)).toBe(23);
  expect(defaultWorkerJobs(1, 1_000_000_000)).toBe(1);
});

it('validates an explicit job count', () => {
  expect(workerJobs('3')).toBe(3);
  for (const value of ['0', '65', '1.5', 'many']) expect(() => workerJobs(value)).toThrow('--jobs');
});

it('runs every item in order, never more than jobs at a time', async () => {
  const pool = new WorkerPool(2), started: number[] = [];
  let running = 0, peak = 0;
  await pool.run([1, 2, 3, 4, 5], async item => {
    started.push(item); peak = Math.max(peak, ++running);
    await new Promise(done => setTimeout(done, 2));
    running--;
  });
  expect(started).toEqual([1, 2, 3, 4, 5]);
  expect(peak).toBe(2);
  expect(pool.stopped).toBe(false);
});

it('stops scheduling after a failure, lets other lanes finish and rethrows it', async () => {
  const pool = new WorkerPool(2), started: number[] = [];
  let finished = 0;
  await expect(pool.run([1, 2, 3, 4], async item => {
    started.push(item);
    if (item === 1) throw new Error('first');
    await new Promise(done => setTimeout(done, 5));
    finished++;
  })).rejects.toThrow('first');
  expect(started).toEqual([1, 2]);
  expect(finished).toBe(1);
  expect(pool.stopped).toBe(true);
});

it('reports worker exit codes and interrupts running workers', async () => {
  const pool = new WorkerPool(1);
  await pool.worker(['-e', '']);
  await expect(pool.worker(['-e', 'process.exit(3)'])).rejects.toThrow('worker exited 3');
  const running = pool.worker(['-e', 'setTimeout(() => {}, 60000)']);
  pool.stop();
  await expect(running).rejects.toThrow('worker exited SIGINT');
});
