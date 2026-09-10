/** Independent prediction fixtures and analytic-control-gradient checks. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha} from './arc_suite.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const checked=(path:string)=>{const b=readFileSync(path);assert.equal(sha(b),readFileSync(path+'.sha256','utf8').trim().split(/\s+/)[0]);return JSON.parse(b.toString());};
const runtime=resolve(arg('compiler-root')!,'scripts/v0/optimizer/arc_response_network.ts');
const {arcNetworkPrediction}=await import(pathToFileURL(runtime).href);
const modelPath=arg('model')!,fixturePath=arg('fixtures')!,model=checked(modelPath),fixtures=checked(fixturePath);
assert.equal(fixtures.length,32);let maxPredictionError=0,maxGradientError=0,gradients=0;
for(const [index,row] of fixtures.entries()){
  const actual=arcNetworkPrediction(row.features,model);
  actual.residuals.forEach((v:number,j:number)=>{const error=Math.abs(v-row.residuals[j]);assert.ok(error<1e-12);maxPredictionError=Math.max(maxPredictionError,error);});
  if(index<4)for(let j=0;j<10;j++){
    const a=row.features.slice(),b=row.features.slice();a[63+j]+=1e-6;b[63+j]-=1e-6;
    const plus=arcNetworkPrediction(a,model).residuals,minus=arcNetworkPrediction(b,model).residuals;
    for(let r=0;r<4;r++){const error=Math.abs(actual.jacobian[r][j]-(plus[r]-minus[r])/2e-6);assert.ok(error<1e-6);maxGradientError=Math.max(maxGradientError,error);gradients++;}
  }
}
const result={schema:'line.arc-response-network-parity.v1',modelPath,modelSha256:sha(readFileSync(modelPath)),
  fixturePath,fixtureSha256:sha(readFileSync(fixturePath)),fixtures:fixtures.length,maxPredictionError,
  analyticGradientsComparedWithFiniteDifferences:gradients,maxGradientError,
  runtimeSha256:sha(readFileSync(runtime)),scriptSha256:sha(readFileSync(import.meta.filename))};
const out=arg('out')!,body=JSON.stringify(result,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');console.log(JSON.stringify(result));
