import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sha} from '../v4/model.ts';
import {verifyFrozen as verifyV5} from '../v5/contract.ts';
export const files=['benchmark/v6/policy.ts','benchmark/v6/model.ts','benchmark/v6/evaluator.ts','benchmark/v6/contract.ts','benchmark/v6/replay.ts',
 'benchmark/v6/catalog.json.gz','benchmark/v6/catalog.lock.json',
 'scripts/v0/optimizer/repertoire_layout.ts','scripts/v0/optimizer/motion_quality.ts'];
export function judgeIdentity(){return {v5:verifyV5(),files:Object.fromEntries(files.map(p=>[p,sha(readFileSync(p))]))};}
export function verifyFrozen(){const frozen=JSON.parse(readFileSync('benchmark/v6/frozen.json','utf8'));
 assert.deepEqual(judgeIdentity(),frozen.judge,'frozen V6 evaluation changed');return frozen;}
