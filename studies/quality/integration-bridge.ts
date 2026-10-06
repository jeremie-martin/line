/** Bridge the qualified implementation to the exact four musical review tracks. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {loadRun} from '../../tools/eval/records.ts';
const main='/home/wyss/line',out=main+'/generated/quality-integration-20261006';
const at=(file:string)=>import(pathToFileURL(join(main,file)).href);
const {compilerIdentity}=await at('scripts/lib/compiler_identity.ts');
const source=loadRun('/tmp/line-quality-passive-final-20261006/generated/eval/quality-passive-final');
const cases=[...source.cells.values()].filter(c=>!c.case.perturbation&&c.case.seed===3001);
assert.equal(cases.length,4);
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
if(process.argv[2]==='worker'){
 const plan=JSON.parse(readFileSync(out+'/plan.json','utf8')),cell=cases.find(c=>c.case.id===process.argv[3]);assert.ok(cell);
 assert.deepEqual(compilerIdentity(main),plan.compiler);
 const {resolveCase}=await at('tools/eval/inputs.ts');
 const {spec,music,planned}=await resolveCase(cell.case,source.run.jolt);assert.deepEqual(planned,cell.case);
 const {compileHandoff}=await at('scripts/v0/optimizer/handoff.ts'),{productionBudget}=await at('scripts/v0/optimizer/production_budget.ts');
 const cp=compileHandoff(spec,cell.case.seed,{budget:productionBudget(spec.duration),creative:{},impactContract:'line.strike.v3',
  phraseBoundaries:music.phases.map((p:any)=>p.t0??p.t??p.start).filter(Number.isFinite)});
 const hash=digest(cp.track);assert.equal(hash,cell.trackHash);assert.equal(cp.repertoire.physicalFrames,cell.physicalFrames);
 assert.equal(cp.repertoire.valid,cell.complete);assert.equal(cp.repertoire.qualified,cell.fulfilled);
 assert.ok(cp.track.lines.every((l:any)=>l.type===0));assert.deepEqual(compilerIdentity(main),plan.compiler);
 writeFileSync(out+'/'+cell.case.id+'.json',JSON.stringify({id:cell.case.id,trackHash:hash,physicalFrames:cell.physicalFrames,
  complete:cp.repertoire.valid,fulfilled:cp.repertoire.qualified,input:cell.case.input,exactTrackAndWork:true})+'\n');
 console.log(cell.case.id,'exact track and work');
}else{
 mkdirSync(out,{recursive:true});const plan={schema:'line.quality-integration-bridge.v1',compiler:compilerIdentity(main),sourcePlan:source.run,
  cases:cases.map(c=>c.case.id),studySha256:createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex')};
 assert.ok(!existsSync(out+'/plan.json'),'fresh integration output is required');writeFileSync(out+'/plan.json',JSON.stringify(plan)+'\n');
 const outcomes=await Promise.allSettled(cases.map(c=>new Promise<void>((ok,fail)=>{
  const p=spawn(process.execPath,['--import','tsx',import.meta.filename,'worker',c.case.id],{cwd:main,env:{...process.env,LR_ENGINE:'wasm'},stdio:'inherit'});
  p.once('error',fail);p.once('exit',(code,signal)=>code===0?ok():fail(Error(String(code??signal))));
 })));
 for(const result of outcomes)assert.equal(result.status,'fulfilled',JSON.stringify(result));
 assert.deepEqual(compilerIdentity(main),plan.compiler);
 const records=cases.map(c=>JSON.parse(readFileSync(out+'/'+c.case.id+'.json','utf8')));
 writeFileSync(main+'/docs/research/quality-20261005-integration.json',JSON.stringify({...plan,at:new Date().toISOString(),records},null,2)+'\n');
 console.log('All four integrated musical review tracks and work counts match exactly');
}
