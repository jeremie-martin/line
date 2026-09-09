import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sha} from './model.ts';
export const enginePath='engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm';
export const judgeFiles=[
  'benchmark/v4/contract.ts','benchmark/v4/model.ts','benchmark/v4/policy.ts','benchmark/v4/evaluator.ts',
  'benchmark/v4/catalog.lock.json','benchmark/v4/specifications.json.gz',
  'benchmark/v3/model.ts','benchmark/v3/policy.ts','benchmark/v3/evaluator.ts',
  'benchmark/v3/catalog.lock.json','benchmark/v3/specifications.json.gz',
  'scripts/v0/core/substrate.ts','scripts/v0/core/measure.ts','scripts/v0/types.ts','scripts/v0/score.ts',
  'scripts/lib/_lr_engine.ts','scripts/lib/_lr_engine_wasm.ts','scripts/lib/detector.ts','scripts/lib/update_types.ts'];
export function judgeIdentity(){
  const lock=JSON.parse(readFileSync('benchmark/v4/catalog.lock.json','utf8'));
  return {inputSha256:lock.specificationsSha256,engineSha256:sha(readFileSync(enginePath)),
    files:Object.fromEntries(judgeFiles.map(path=>[path,sha(readFileSync(path))]))};
}
export function verifyFrozen(){
  const bytes=readFileSync('benchmark/v4/frozen.json');
  assert.equal(sha(bytes),readFileSync('benchmark/v4/frozen.json.sha256','utf8').trim());
  const frozen=JSON.parse(bytes.toString()),current=judgeIdentity();
  assert.deepEqual(current,frozen.judge,'frozen V4 judge changed');
  assert.equal(sha(JSON.stringify(current)),frozen.suiteFingerprint);
  return current;
}
