/** Conservative default for independent compiler processes. Explicit --jobs
 * overrides remain available; an override is not a claim that memory is ample. */
import {availableParallelism, totalmem} from 'node:os';

/** Real compiles peak under 1 GiB; the 108 s ride reaches about 1.5 GiB. */
const WORKER_BYTES = 2_000_000_000;

export function defaultWorkerJobs(cpus = availableParallelism(), memoryBytes = totalmem()): number {
  return Math.max(1, Math.min(23, cpus, Math.floor(memoryBytes / WORKER_BYTES)));
}
