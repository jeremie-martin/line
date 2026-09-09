/** Independent analytical checks for response-bound research implementations. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const arg=(key:string)=>process.argv.find(x=>x.startsWith(`--${key}=`))?.slice(key.length+3);
const path=resolve(arg('compiler-root')!,'scripts/v0/optimizer/arc_response.ts');
const {arcMeasuredResponseColumn,arcResponseStep,arcBoundedResponseStep}=await import(pathToFileURL(path).href);
const origin=[2,3],sample=(x:number)=>({step:x,residuals:[2+3*x,3-2*x]});
for(const probes of [[sample(0),sample(-1)],[sample(.2),sample(-1)],[sample(.5),null],[sample(1),sample(-1)]]){
  const actual=arcMeasuredResponseColumn(origin,probes);actual.forEach((v:number,i:number)=>assert.ok(Math.abs(v-[3,-2][i])<1e-12));
}
assert.deepEqual(arcMeasuredResponseColumn(origin,[sample(0),sample(0)]),[0,0]);
const jac=[[1,1],[0,1]],residual=[-2,0],damping=.0002;
const free=arcResponseStep(jac,residual,damping),step=arcBoundedResponseStep(jac,residual,damping,[[0,1],[-3,3]]);
assert.ok(step&&Math.abs(step[0]-1)<1e-12&&Math.abs(step[1]-1/(2+damping))<1e-9);
const loss=(x:number[])=>jac.reduce((sum,row,i)=>sum+(row.reduce((v,a,j)=>v+a*x[j],residual[i]))**2,0)+damping*x.reduce((sum,v)=>sum+v*v,0);
const clipped=[Math.min(1,Math.max(0,free[0])),Math.min(3,Math.max(-3,free[1]))];
assert.ok(loss(step)<loss(clipped)-.4);
assert.deepEqual(arcBoundedResponseStep(jac,residual,damping,[[-10,10],[-10,10]]),free);
assert.equal(arcBoundedResponseStep(jac,residual,damping,[[2,1],[-3,3]]),null);
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const record={schema:'line.arc-response-bounds-check.v1',compilerPath:path,sha256:sha(readFileSync(path)),linearDerivativeCases:5,constrainedStep:step,clippedLoss:loss(clipped),constrainedLoss:loss(step),unchangedInteriorStep:true};
if(arg('out')){const b=JSON.stringify(record,null,2)+'\n';writeFileSync(arg('out')!,b);writeFileSync(arg('out')!+'.sha256',sha(b)+'\n');}
console.log(JSON.stringify(record));
