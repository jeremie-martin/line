/** Check independently exported mean predictions before a compiler study. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {arcControlProposals} from '../v0/optimizer/arc_control_policy.ts';
import {sha} from './arc_suite.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const checked=(path:string)=>{const b=readFileSync(path);assert.equal(sha(b),readFileSync(path+'.sha256','utf8').trim());return JSON.parse(b.toString());};
const modelPath=arg('model')!,fixturePath=arg('fixtures')!,model=checked(modelPath),fixtures=checked(fixturePath);
assert.ok(fixtures.length>=24);let maxError=0;
for(const row of fixtures){
  const c=arcControlProposals(row.features,20,30,model.models[0],1)[0];
  const encoded=[(c.entry-20)/30,c.turn/60,(c.exit-20)/60,c.support/30,c.bias,c.offset,c.clearance!/12,c.turnFraction!,c.bend!/30,c.guideFlare!/8];
  assert.equal(row.mean.length,encoded.length);
  for(let i=0;i<encoded.length;i++){
    const error=Math.abs(encoded[i]-row.mean[i]);assert.ok(Number.isFinite(error)&&error<1e-12);maxError=Math.max(maxError,error);
  }
}
const result={schema:'line.arc-policy-mean-parity.v1',modelPath,modelSha256:sha(readFileSync(modelPath)),
  fixturePath,fixtureSha256:sha(readFileSync(fixturePath)),fixtures:fixtures.length,maxError,
  runtimeSha256:sha(readFileSync('scripts/v0/optimizer/arc_control_policy.ts')),scriptSha256:sha(readFileSync(import.meta.filename))};
const out=arg('out')!,body=JSON.stringify(result,null,2)+'\n';mkdirSync(dirname(out),{recursive:true});writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify(result));
