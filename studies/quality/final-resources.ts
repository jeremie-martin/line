/** Matched final-production resource sample, with saved tracks as invariants. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {loadRun,assertPairedRuns} from '../../tools/eval/records.ts';
import {lockArtifacts} from '../../scripts/lib/artifact_lock.ts';
const main='/home/wyss/line',out='/tmp/line-quality-review-20261006/generated/final-resources';
const roots={baseline:'/tmp/line-quality-final-baseline-20261006',candidate:'/tmp/line-quality-native-scope-20261006'};
const sourceRoot='/tmp/line-quality-passive-final-20261006/generated/eval/';
const runs={baseline:loadRun(sourceRoot+'quality-passive-baseline-remeasured'),candidate:loadRun(sourceRoot+'quality-passive-final')};assertPairedRuns(runs.baseline,runs.candidate);
const ids=['luna_bala_44s~3001','amor_na_praia_46s~3001','tiki_tiki_48s~3001','amour_de_ma_vie_44s~3001','luna_bala_44s~3001~p13','amour_de_ma_vie_44s~3001~p13'];
const at=(root:string,p:string)=>import(pathToFileURL(join(root,p)).href),hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
if(process.argv[2]==='worker'){
 const label=process.argv[3] as keyof typeof roots,id=process.argv[4],root=roots[label],run=runs[label],cell=run.cells.get(id);assert.ok(cell&&ids.includes(id));
 const plan=JSON.parse(readFileSync(out+'/plan.json','utf8')),{compilerIdentity}=await at(root,'scripts/lib/compiler_identity.ts');assert.deepEqual(compilerIdentity(root),plan.identities[label]);
 const {resolveCase}=await at(root,'tools/eval/inputs.ts'),{spec,music,planned}=await resolveCase(cell.case,run.run.jolt);assert.deepEqual(planned,cell.case);
 const {compileHandoff}=await at(root,'scripts/v0/optimizer/handoff.ts'),{productionBudget}=await at(root,'scripts/v0/optimizer/production_budget.ts');
 writeFileSync(out+'/'+id+'.'+label+'.ready','ready');while(!existsSync(out+'/'+id+'.start'))await new Promise(r=>setTimeout(r,10));
 const cpu=process.cpuUsage(),start=performance.now(),cp=compileHandoff(spec,cell.case.seed,{budget:productionBudget(spec.duration),creative:{},impactContract:'line.strike.v3',phraseBoundaries:music.phases.map((p:any)=>p.t0??p.t??p.start).filter(Number.isFinite)});
 const used=process.cpuUsage(cpu),wallMs=performance.now()-start,maxRssKiB=process.resourceUsage().maxRSS;
 assert.equal(hash(cp.track),cell.trackHash);assert.equal(cp.repertoire.physicalFrames,cell.physicalFrames);assert.deepEqual(compilerIdentity(root),plan.identities[label]);
 writeFileSync(out+'/'+id+'.'+label+'.json',JSON.stringify({id,label,trackHash:cell.trackHash,physicalFrames:cell.physicalFrames,cpuMs:(used.user+used.system)/1000,wallMs,maxRssKiB,exactTrackAndWork:true})+'\n');
}else{
 assert.ok(existsSync(main+'/docs/research/quality-20261005-controlled-tail.json'),'finish Q69 first');mkdirSync(out,{recursive:true});const release=lockArtifacts(out);
 try{
  assert.ok(!existsSync(out+'/plan.json'));const plan={schema:'line.quality-final-resources.v1',at:new Date().toISOString(),roots,ids,
   identities:Object.fromEntries(await Promise.all(Object.entries(roots).map(async([k,r])=>[k,(await at(r,'scripts/lib/compiler_identity.ts')).compilerIdentity(r)]))),
   sourcePlans:Object.fromEntries(Object.entries(runs).map(([k,r])=>[k,r.run])),concurrentPairs:2,studySha256:createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex')};
  writeFileSync(out+'/plan.json',JSON.stringify(plan)+'\n');const queue=[...ids],failures:string[]=[];
  await Promise.all(Array.from({length:2},async()=>{while(queue.length){const id=queue.shift()!;let failure:Error|undefined;
   const jobs=Object.entries(roots).map(([label,root])=>new Promise<void>((ok,fail)=>{
    const p=spawn(process.execPath,['--import','tsx',import.meta.filename,'worker',label,id],{cwd:root,env:{...process.env,LR_ENGINE:'wasm'},stdio:'inherit'});
    p.once('error',fail);p.once('exit',(c,s)=>c===0?ok():fail(Error(String(c??s))));
   }).catch(e=>{failure=e}));
   while(!failure&&!Object.keys(roots).every(k=>existsSync(out+'/'+id+'.'+k+'.ready')))await new Promise(r=>setTimeout(r,20));
   writeFileSync(out+'/'+id+'.start',new Date().toISOString());await Promise.all(jobs);if(failure)failures.push(id+': '+failure);else console.log(id,'both saved tracks and work exact');
  }}));assert.deepEqual(failures,[]);
  const cases=ids.map(id=>({id,...Object.fromEntries(Object.keys(roots).map(k=>[k,JSON.parse(readFileSync(out+'/'+id+'.'+k+'.json','utf8'))]))}));
  const totals=Object.fromEntries(Object.keys(roots).map(k=>[k,Object.fromEntries(['cpuMs','wallMs','maxRssKiB','physicalFrames'].map(key=>[key,cases.reduce((s,c:any)=>s+c[k][key],0)]))]));
  const ratios=Object.fromEntries(['cpuMs','maxRssKiB','physicalFrames'].map(k=>[k,totals.candidate[k]/totals.baseline[k]]));
  const compactPlan={...plan,sourcePlans:Object.fromEntries(Object.entries(plan.sourcePlans).map(([k,p]:any)=>[k,{schema:p.schema,identity:p.identity,evaluator:p.evaluator,jolt:p.jolt,mode:p.mode,budget:p.budget,panelName:p.panelName,planSha256:hash(p),panelSha256:hash(p.panel),declaredCases:p.panel.length}])),fullPlanArchiveSource:out+'/plan.json'};
  writeFileSync(main+'/docs/research/quality-20261005-final-resources.json',JSON.stringify({...compactPlan,finished:new Date().toISOString(),cases,totals,ratios,
   interpretation:'Six fixed musical inputs; every compiler reproduces its own saved track and work. Process CPU and peak RSS, with two synchronized pairs running concurrently. Summed peak RSS is a comparison across cases, not simultaneous machine memory. No universal speed claim.'},null,2)+'\n');console.log(ratios);
 }finally{release()}
}
