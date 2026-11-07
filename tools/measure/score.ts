/** The compiler's speed in one number: nanoseconds per charged physics frame on
 * real compiles, one at a time, each in a fresh process. Lower is better.
 *
 *   taskset -c 4-7 npm run perf:score
 *
 * Compiles PERF_CELLS three times each and reports the median of each, then their
 * mean. Every compile must reproduce its committed track and charged work. Scores
 * compare only on one machine and one Node, so the report names both; give it two
 * performance cores, since V8's background threads need somewhere to run. Run it alone
 * on a quiet machine. Use perf:engine to decide whether a change helped: only a paired
 * comparison can separate a small gain from a machine's drift. */
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {cpus, tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cellIndices, PERF_CELLS} from './engine_decision.ts';

const REPEATS = 3;
const root = fileURLToPath(new URL('../../', import.meta.url)), dir = mkdtempSync(join(tmpdir(), 'perf-score-'));
const {cells} = JSON.parse(readFileSync(join(root, 'tools/parity/cells.json'), 'utf8'));
const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1];
try {
  const results = cellIndices(cells, PERF_CELLS).map((index, i) => {
    const seconds = Array.from({length: REPEATS}, () => {
      const out = join(dir, 'cell.json');
      execFileSync(process.execPath, ['tools/parity/parity.ts', 'worker', `--cell=${index}`, `--out=${out}`],
        {cwd: root, stdio: ['ignore', 'ignore', 'inherit'], env: {...process.env, LR_ENGINE: 'wasm'}});
      const {trackHash, physicalFrames, compileMs} = JSON.parse(readFileSync(out, 'utf8'));
      if (trackHash !== cells[index].trackHash || physicalFrames !== cells[index].physicalFrames)
        throw new Error(`${PERF_CELLS[i]}: track or charged work changed, so this score would not be comparable`);
      return compileMs / 1000;
    });
    const typical = median(seconds);
    console.log(`${PERF_CELLS[i]}: ${typical.toFixed(2)} s (${seconds.map(s => s.toFixed(2)).join(', ')})`);
    return {seconds: typical, nsPerFrame: typical * 1e9 / cells[index].physicalFrames};
  });
  const score = results.reduce((sum, r) => sum + r.nsPerFrame, 0) / results.length;
  console.log(`\nscore: ${Math.round(score)} ns per charged frame (${cpus()[0].model}, Node ${process.version}; every track exact)`);
} finally {
  rmSync(dir, {recursive: true, force: true});
}
