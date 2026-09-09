/** Pin a complete student trajectory for counterfactual teaching at its prefixes. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {loadArcCases,requestedArcSuite,sha} from './arc_suite.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const checked=(path:string)=>{const b=readFileSync(path);assert.equal(sha(b),readFileSync(path+'.sha256','utf8').trim());return JSON.parse((path.endsWith('.gz')?gunzipSync(b):b).toString());};
const suite=requestedArcSuite(),input=resolve(arg('input')!),out=resolve(arg('out')!),run=checked(resolve(input,'run.json.gz')),cases=loadArcCases(suite);
assert.equal(run.plan.suite??'v3',suite);assert.deepEqual(run.plan.sources,cases.map(c=>c.id));
assert.equal(run.rows.length,cases.length);assert.ok(run.rows.every((r:any)=>r.score.valid));
const controls=Object.fromEntries(cases.map(c=>{
  const path=resolve(input,c.id+'.json.gz'),row=checked(path),summary=run.rows.find((r:any)=>r.sourceId===c.id);
  assert.equal(row.planSha256,sha(readFileSync(resolve(input,'plan.json'))));
  assert.equal(row.trackHash,sha(JSON.stringify(row.track)));assert.equal(row.trackHash,summary.trackHash);
  assert.equal(row.rows.length,c.contacts.length+1);
  return [c.id,{trackHash:row.trackHash,sourceSha256:sha(readFileSync(path)),controls:row.rows.map((r:any)=>r.control)}];
}));
const result={schema:'line.arc-replay-controls.v1',suite,input,runSha256:sha(readFileSync(resolve(input,'run.json.gz'))),
  scriptSha256:sha(readFileSync(import.meta.filename)),studentHeadline:run.summary.headline,cases:controls,
  note:'Counterfactual teaching must reproduce these student tracks exactly. A replayed headline is the student score, not an improved teacher rollout.'};
const body=JSON.stringify(result)+'\n';mkdirSync(dirname(out),{recursive:true});writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify({cases:cases.length,controls:Object.values(controls).reduce((s,c)=>s+c.controls.length,0),out}));
