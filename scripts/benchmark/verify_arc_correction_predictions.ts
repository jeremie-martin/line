/** Compare correction decoding with independent Python forest predictions. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha} from './arc_suite.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const checked=(path:string)=>{const b=readFileSync(path);assert.equal(sha(b),readFileSync(path+'.sha256','utf8').trim().split(/\s+/)[0]);return JSON.parse(b.toString());};
const runtime=resolve(arg('compiler-root')!,'scripts/v0/optimizer/arc_measured_correction.ts');
const {arcMeasuredCorrections,arcCorrectionControlVector}=await import(pathToFileURL(runtime).href);
const modelPath=arg('model')!,fixturePath=arg('fixtures')!,model=checked(modelPath),fixtures=checked(fixturePath);
assert.ok(fixtures.length>=24);let maxError=0;
for(const row of fixtures){
  const v=row.features.slice(63,73),incoming=20,span=30;
  const c={entry:incoming+30*v[0],turn:60*v[1],exit:incoming+60*v[2],support:span*v[3],
    bias:v[4],offset:v[5],clearance:12*v[6],turnFraction:v[7],bend:30*v[8],guideFlare:8*v[9]};
  const result=arcMeasuredCorrections(row.features.slice(0,63),c,row.features.length===77?row.features.slice(73):[0,0,0,0],incoming,span,model,1)[0];
  const encoded=arcCorrectionControlVector(result,incoming,span);
  assert.equal(row.mean.length,10);
  for(let i=0;i<10;i++){
    const error=Math.abs(encoded[i]-v[i]-row.mean[i]);assert.ok(Number.isFinite(error)&&error<1e-12);maxError=Math.max(maxError,error);
  }
}
const result={schema:'line.arc-correction-parity.v1',modelPath,modelSha256:sha(readFileSync(modelPath)),
  fixturePath,fixtureSha256:sha(readFileSync(fixturePath)),fixtures:fixtures.length,maxError,
  runtimeSha256:sha(readFileSync(runtime)),scriptSha256:sha(readFileSync(import.meta.filename))};
const out=arg('out')!,body=JSON.stringify(result,null,2)+'\n';mkdirSync(dirname(out),{recursive:true});writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify(result));
