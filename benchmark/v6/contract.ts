/** V6 is frozen by its outputs, not by the bytes of its sources.
 *
 * `npm run parity:judge -- --all` must reproduce every stored V6 score exactly;
 * that is the freeze. Source hashes are recorded for provenance only, so shared
 * code (types, detector, layout checks) can be cleaned without breaking the
 * benchmark, while any change in what the judge computes is still caught. */
import {readFileSync} from 'node:fs';
import {sha} from '../v4/model.ts';

export const enginePath = 'engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm';
export const judgeFiles = [
  'benchmark/v6/policy.ts', 'benchmark/v6/model.ts', 'benchmark/v6/evaluator.ts', 'benchmark/v6/replay.ts',
  'benchmark/v6/catalog.json.gz', 'benchmark/v6/catalog.lock.json',
  'benchmark/v5/policy.ts', 'benchmark/v5/model.ts', 'benchmark/v5/evaluator.ts',
  'benchmark/v4/model.ts', 'benchmark/v4/policy.ts', 'benchmark/v4/evaluator.ts',
  'benchmark/v3/model.ts', 'benchmark/v3/policy.ts', 'benchmark/v3/evaluator.ts',
  'scripts/v0/core/substrate.ts', 'scripts/v0/core/measure.ts', 'scripts/v0/types.ts', 'scripts/v0/score.ts',
  'scripts/lib/_lr_engine.ts', 'scripts/lib/_lr_engine_wasm.ts', 'scripts/lib/detector.ts', 'scripts/lib/update_types.ts',
  'scripts/v0/optimizer/repertoire_realization.ts', 'scripts/v0/optimizer/arc_rail_groups.ts',
  'scripts/v0/optimizer/repertoire_layout.ts', 'scripts/v0/optimizer/motion_quality.ts'];

/** Provenance record for run plans: which judge sources and engine produced a result. */
export function judgeIdentity() {
  return {freeze: 'line.benchmark-v6.output-parity.v1', engineSha256: sha(readFileSync(enginePath)),
    files: Object.fromEntries(judgeFiles.map(path => [path, sha(readFileSync(path))]))};
}
