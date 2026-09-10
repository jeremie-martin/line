/** Independent Python prediction fixtures for an explicit research runtime. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {sha} from './arc_suite.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const checked=(path:string)=>{const b=readFileSync(path);assert.equal(sha(b),readFileSync(path+'.sha256','utf8').trim());return JSON.parse(b.toString());};
const runtime=resolve(arg('runtime')!),modelPath=arg('model')!,fixturePath=arg('fixtures')!;
const {arcProposalQuality}=await import(pathToFileURL(runtime).href),model=checked(modelPath),fixtures=checked(fixturePath);
assert.ok(fixtures.length>=64);let maxError=0;
for(const fixture of fixtures){
  const actual=arcProposalQuality(fixture.features,model),error=Math.abs(actual-fixture.value);
  assert.ok(Number.isFinite(error)&&error<1e-12);maxError=Math.max(maxError,error);
}
const result={schema:'line.arc-proposal-ranker-parity.v1',modelPath,modelSha256:sha(readFileSync(modelPath)),
  runtime,runtimeSha256:sha(readFileSync(runtime)),fixturePath,fixtureSha256:sha(readFileSync(fixturePath)),
  fixtures:fixtures.length,maxError,scriptSha256:sha(readFileSync(import.meta.filename))};
const out=arg('out')!,body=JSON.stringify(result,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify(result));
