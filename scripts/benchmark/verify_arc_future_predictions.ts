/** Compare independently exported future-value predictions with the runtime. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha} from './arc_suite.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const checked=(path:string)=>{const b=readFileSync(path);assert.equal(sha(b),readFileSync(path+'.sha256','utf8').trim().split(/\s+/)[0]);return JSON.parse(b.toString());};
const runtime=resolve(arg('compiler-root')??'.','scripts/v0/optimizer/arc_value.ts');
const {arcFutureValue}=await import(pathToFileURL(runtime).href);
const modelPath=arg('model')!,fixturePath=arg('fixtures')!,model=checked(modelPath),fixtures=checked(fixturePath);
assert.ok(fixtures.length>=32);let maxError=0;
for(const row of fixtures){const error=Math.abs(arcFutureValue(row.features,model)-row.prediction);assert.ok(Number.isFinite(error)&&error<1e-12);maxError=Math.max(maxError,error);}
const result={schema:'line.arc-future-value-parity.v1',modelPath,modelSha256:sha(readFileSync(modelPath)),
  fixturePath,fixtureSha256:sha(readFileSync(fixturePath)),fixtures:fixtures.length,maxError,
  runtimeSha256:sha(readFileSync(runtime)),scriptSha256:sha(readFileSync(import.meta.filename))};
const out=arg('out')!,body=JSON.stringify(result,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');console.log(JSON.stringify(result));
