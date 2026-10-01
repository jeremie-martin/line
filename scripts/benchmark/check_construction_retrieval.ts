/** Validate trained partitions through the existing production proposal runtime. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {arcControlProposals,arcReferencedControl} from '../v0/optimizer/arc_control_policy.ts';
const path=process.argv[2],bytes=readFileSync(path);
assert.equal(createHash('sha256').update(bytes).digest('hex'),readFileSync(path+'.sha256','utf8').trim());
const model=JSON.parse(gunzipSync(bytes).toString()),checks=JSON.parse(readFileSync(path+'.parity.json','utf8'));
assert.equal(model.schema,'line.construction-policies.v1');
for(const check of checks)assert.deepEqual(arcControlProposals(check.features,0,40,model.groups[check.key],1,'geometry')[0],
 arcReferencedControl(check.reference,0,40),'supervised construction retrieval differs');
console.log(JSON.stringify({checks:checks.length,passed:true}));
