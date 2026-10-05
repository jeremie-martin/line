/** One writer owns a generated directory. A crash leaves an explicit lock;
 * guessing that another process is stale must never overwrite its evidence. */
import {writeFileSync, unlinkSync} from 'node:fs';
import {join} from 'node:path';

export function lockArtifacts(dir: string) {
  const path = join(dir, '.generation.lock');
  try {writeFileSync(path, String(process.pid) + '\n', {flag: 'wx'});}
  catch (e: any) {
    if (e.code !== 'EEXIST') throw e;
    throw new Error(`Generation already owns ${path}. If it was interrupted, verify that the recorded PID has stopped before removing the lock.`);
  }
  return () => unlinkSync(path);
}
