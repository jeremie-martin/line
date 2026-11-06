/** The one way this repository runs independent compiles in parallel: each in
 * its own process, so a compile's memory and engines never meet another's.
 * A compile itself stays sequential. --jobs overrides the default count; an
 * override is not a claim that memory is ample. */
import {spawn, type ChildProcess, type SpawnOptions} from 'node:child_process';
import {availableParallelism, totalmem} from 'node:os';

/** Real compiles peak under 1 GiB; the 108 s ride reaches about 1.5 GiB. */
const WORKER_BYTES = 2_000_000_000;

export function defaultWorkerJobs(cpus = availableParallelism(), memoryBytes = totalmem()): number {
  return Math.max(1, Math.min(23, cpus, Math.floor(memoryBytes / WORKER_BYTES)));
}

/** A --jobs value, or the default when absent. */
export function workerJobs(value?: string): number {
  const jobs = value === undefined ? defaultWorkerJobs() : Number(value);
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > 64) throw new Error('--jobs must be an integer from 1 to 64');
  return jobs;
}

export class WorkerPool {
  private readonly children = new Set<ChildProcess>();
  readonly jobs: number;
  stopped = false;

  constructor(jobs: number) {
    this.jobs = jobs;
  }

  /** Runs `task` over `items` in order, `jobs` at a time. A task handles the
   * failures it expects; anything it throws stops the pool, waits for the other
   * lanes and is rethrown, so no worker outlives the caller's cleanup. */
  async run<T>(items: readonly T[], task: (item: T) => Promise<void>): Promise<void> {
    let next = 0, failed = false, failure: unknown;
    await Promise.all(Array.from({length: Math.min(this.jobs, items.length)}, async () => {
      while (next < items.length && !this.stopped) {
        try {
          await task(items[next++]);
        } catch (error) {
          if (!failed) {failed = true; failure = error;}
          this.stop();
        }
      }
    }));
    if (failed) throw failure;
  }

  /** One Node worker; resolves on exit code 0. Compiles always use the WASM engine. */
  worker(args: readonly string[], options: SpawnOptions = {}): Promise<void> {
    return new Promise((done, fail) => {
      const child = spawn(process.execPath, args, {stdio: ['ignore', 'ignore', 'inherit'], ...options,
        env: {...process.env, LR_ENGINE: 'wasm', ...options.env}});
      this.children.add(child);
      child.once('error', error => {this.children.delete(child); fail(error);});
      child.once('exit', (code, signal) => {
        this.children.delete(child);
        if (code === 0) done(); else fail(new Error(`worker exited ${code ?? signal}`));
      });
    });
  }

  /** Stop scheduling and interrupt running workers. Finished work stays saved. */
  stop(signal: NodeJS.Signals = 'SIGINT'): void {
    this.stopped = true;
    for (const child of this.children) child.kill(signal);
  }
}
