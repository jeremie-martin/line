import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {judgeIdentity} from '../../benchmark/v4/contract.ts';
import {sha} from '../../benchmark/v4/model.ts';
assert.ok(!existsSync('benchmark/v4/frozen.json'),'V4 is already frozen');
const bytes=readFileSync('benchmark/v4/static-audit.json');assert.equal(sha(bytes),readFileSync('benchmark/v4/static-audit.json.sha256','utf8').trim());
const audit=JSON.parse(bytes.toString());assert.equal(audit.cases,176);assert.equal(audit.unchangedV3Cases,88);
assert.equal(audit.compilerOutcomesConsulted,false);assert.equal(audit.unchangedScoringAndBudget,true);
assert.equal(audit.necessaryPersistentTimingFeasible,true);
const judge=judgeIdentity(),body=JSON.stringify({schema:'line.benchmark-v4.freeze.v1',status:'frozen-before-baseline-evaluation',
  judge,suiteFingerprint:sha(JSON.stringify(judge)),staticAuditSha256:sha(bytes)},null,2)+'\n';
writeFileSync('benchmark/v4/frozen.json',body);writeFileSync('benchmark/v4/frozen.json.sha256',sha(body)+'\n');
console.log('V4 frozen before compiler evaluation.');
