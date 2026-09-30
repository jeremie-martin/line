import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sha} from '../v4/model.ts';
import {verifyFrozen as verifyV4} from '../v4/contract.ts';
export const files=['benchmark/v5/policy.ts','benchmark/v5/model.ts','benchmark/v5/evaluator.ts','benchmark/v5/contract.ts',
  'benchmark/v5/catalog.json.gz','benchmark/v5/catalog.lock.json','scripts/v0/optimizer/repertoire_realization.ts',
  'scripts/v0/optimizer/arc_rail_groups.ts'];
export function judgeIdentity(){return {v4:verifyV4(),files:Object.fromEntries(files.map(p=>[p,sha(readFileSync(p))]))};}
export function verifyFrozen(){
  const frozen=JSON.parse(readFileSync('benchmark/v5/frozen.json','utf8'));
  assert.deepEqual(judgeIdentity(),frozen.judge,'frozen V5 evaluation changed');return frozen;
}
