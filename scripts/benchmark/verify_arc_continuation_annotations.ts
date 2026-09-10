/** Verify numeric proposal parity and physical parity with continuation hints disabled. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha} from './arc_suite.ts';
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const read=(path:string)=>{const b=readFileSync(path);assert.equal(sha(b),readFileSync(path+'.sha256','utf8').trim().split(/\s+/)[0]);return JSON.parse(b.toString());};
const basePath=arg('base')!,modelPath=arg('model')!,base=read(basePath),model=read(modelPath),root=arg('compiler-root')!;
let annotatedExamples=0;
const compare=(a:any,b:any)=>{
  if(typeof a!=='object'||a===null){assert.equal(b,a);return;}
  assert.equal(Array.isArray(a),Array.isArray(b));
  if(Array.isArray(a)){assert.equal(b.length,a.length);for(let i=0;i<a.length;i++)compare(a[i],b[i]);return;}
  for(const key of Object.keys(a))compare(a[key],b[key]);
  for(const key of Object.keys(b).filter(k=>!(k in a))){
    assert.ok(['continuationTemplates','continuationAnnotations'].includes(key));
    if(key==='continuationTemplates'&&a.target){
      assert.ok(b[key].length>=1&&b[key].length<=2);
      assert.ok(b[key].every((v:number[])=>v.length===10&&v.every(Number.isFinite)));annotatedExamples++;
    }
  }
};
compare(base,model);assert.ok(annotatedExamples>0);
const {arcControlProposals}=await import(pathToFileURL(resolve(root,'scripts/v0/optimizer/arc_control_policy.ts')).href);
const fixtures=JSON.parse(readFileSync('tests/fixtures/arc_control_policy_predictions.json','utf8'));
let proposalChecks=0;
for(const row of fixtures)for(const count of [12,32]){
  assert.equal(JSON.stringify(arcControlProposals(row.features,20,30,model,count)),JSON.stringify(arcControlProposals(row.features,20,30,base,count)));proposalChecks++;
}
const {compileArcMotion}=await import(pathToFileURL(resolve(root,'scripts/v0/optimizer/arc_motion.ts')).href);
const {connectedArcOptions}=await import(pathToFileURL(resolve(root,'scripts/v0/optimizer/connected_arcs.ts')).href);
const spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
const options={...connectedArcOptions(spec,75000),controlPolicy:base};
const plain=compileArcMotion(spec,17,options),disabled=compileArcMotion(spec,17,{...options,controlPolicy:model,continuationHints:false});
assert.deepEqual(disabled.track,plain.track);assert.deepEqual(disabled.stats,plain.stats);assert.deepEqual(disabled.report,plain.report);
const enabled=compileArcMotion(spec,17,{...options,controlPolicy:model,continuationHints:true});
assert.ok(enabled.continuationHintStats.queries>0);assert.ok(enabled.stats.sim_frames<=options.budget);
assert.equal(enabled.failure,null);assert.ok(enabled.track.lines.every((l:any)=>l.type===0));
const out=arg('out')!,record={schema:'line.arc-continuation-annotation-parity.v1',basePath,modelPath,
  baseSha256:sha(readFileSync(basePath)),modelSha256:sha(readFileSync(modelPath)),annotatedExamples,proposalChecks,
  exactProposalParity:true,disabledPhysicalTrackAndWorkParity:true,disabledPhysicalFrames:disabled.stats.sim_frames,
  enabledHintStats:enabled.continuationHintStats,enabledPhysicalFrames:enabled.stats.sim_frames,
  scriptSha256:sha(readFileSync(import.meta.filename))};
mkdirSync(dirname(out),{recursive:true});const body=JSON.stringify(record,null,2)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');console.log(JSON.stringify(record));
