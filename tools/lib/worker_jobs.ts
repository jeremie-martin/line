/** Conservative default for independent compiler processes. Explicit --jobs
 * overrides remain available; an override is not a claim that memory is ample. */
import {availableParallelism, totalmem} from 'node:os';

export function defaultWorkerJobs(cpus = availableParallelism(), memoryBytes = totalmem()): number {
  return Math.max(1, Math.min(23, cpus, Math.floor(memoryBytes / 4_000_000_000)));
}
