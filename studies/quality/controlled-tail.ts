/** Synchronize cold resource replays of one expensive catalog case. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {lockArtifacts} from '../../scripts/lib/artifact_lock.ts';
const main='/home/wyss/line',out='/tmp/line-quality-review-20261006/generated/controlled-tail';
const roots={baseline:'/tmp/line-quality-catalog-baseline-20261006',q62:'/tmp/line-quality-final-candidate-20261006',final:'/tmp/line-quality-native-scope-20261006'};
const sourceDirs={baseline:'/tmp/line-quality-catalog-panel-20261006/baseline',q62:'/tmp/line-quality-catalog-panel-20261006/candidate',final:'/tmp/line-quality-passive-catalog-20261006/candidate'};
const at=(root:string,p:string)=>import(pathToFileURL(join(root,p)).href),digest=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const id='stretch_supported_speed_change',seed=101;
if(process.argv[2]==='worker'){
 const label=process.argv[3] as keyof typeof roots,root=roots[label],plan=JSON.parse(readFileSync(out+'/plan.json','utf8'));
 const {compilerIdentity}=await at(root,'scripts/lib/compiler_identity.ts');assert.deepEqual(compilerIdentity(root),plan.identities[label]);
 const {loadCases,caseSpec}=await at(root,'benchmark/v4/model.ts'),source=loadCases().find((c:any)=>c.id===id);assert.equal(digest(source),plan.inputSha256);
 const spec=caseSpec(source),{compileHandoff}=await at(root,'scripts/v0/optimizer/handoff.ts'),{productionBudget}=await at(root,'scripts/v0/optimizer/production_budget.ts');
 writeFileSync(out+'/'+label+'.ready','ready');while(!existsSync(out+'/start'))await new Promise(r=>setTimeout(r,10));
 const began=performance.now(),cpu=process.cpuUsage();
 const cp=compileHandoff(spec,seed,{budget:productionBudget(spec.duration),creative:{},impactContract:'line.strike.v3',phraseBoundaries:source.phases.map((p:any)=>p.start).filter(Number.isFinite)});
 const used=process.cpuUsage(cpu),compileMs=performance.now()-began,maxRssKiB=process.resourceUsage().maxRSS;
 assert.equal(digest(cp.track),plan.expected[label].trackHash);assert.equal(cp.repertoire.physicalFrames,plan.expected[label].physicalFrames);
 assert.deepEqual(compilerIdentity(root),plan.identities[label]);
 const record={label,cpuMs:(used.user+used.system)/1000,compileMs,maxRssKiB,trackHash:digest(cp.track),physicalFrames:cp.repertoire.physicalFrames,exactTrackAndWork:true};
 writeFileSync(out+'/'+label+'.json',JSON.stringify(record)+'\n');console.log(record);
}else{
 for(const dir of ['/tmp/line-quality-catalog-panel-20261006','/tmp/line-quality-passive-catalog-20261006'])assert.ok(!existsSync(dir+'/.generation.lock'),'wait for catalog');
 mkdirSync(out,{recursive:true});const release=lockArtifacts(out);try{assert.ok(!existsSync(out+'/plan.json'));
 const identities=Object.fromEntries(await Promise.all(Object.entries(roots).map(async([k,r])=>[k,(await at(r,'scripts/lib/compiler_identity.ts')).compilerIdentity(r)])));
 const expected=Object.fromEntries(Object.entries(sourceDirs).map(([k,d])=>[k,JSON.parse(readFileSync(join(d,`${id}~${seed}.json`),'utf8'))]));
 assert.ok(Object.values(expected).every((c:any)=>c.inputSha256===(expected.baseline as any).inputSha256));
 const plan={schema:'line.quality-controlled-tail.v1',at:new Date().toISOString(),id,seed,roots,identities,inputSha256:(expected.baseline as any).inputSha256,
  expected:Object.fromEntries(Object.entries(expected).map(([k,c]:any)=>[k,{trackHash:c.trackHash,physicalFrames:c.physicalFrames,sourcePlanSha256:c.planSha256}])),
  concurrentWorkers:3,studySha256:createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex')};
 writeFileSync(out+'/plan.json',JSON.stringify(plan)+'\n');let failure:Error|undefined;
 const jobs=Object.entries(roots).map(([k,r])=>new Promise<void>((ok,fail)=>{
  const child=spawn(process.execPath,['--import','tsx',import.meta.filename,'worker',k],{cwd:r,env:{...process.env,LR_ENGINE:'wasm'},stdio:'inherit'});
  child.once('error',fail);child.once('exit',(code,signal)=>code===0?ok():fail(Error(String(code??signal))));
 }).catch(e=>{failure=e}));
 while(!failure&&!Object.keys(roots).every(k=>existsSync(out+'/'+k+'.ready')))await new Promise(r=>setTimeout(r,20));
 writeFileSync(out+'/start',new Date().toISOString());await Promise.all(jobs);if(failure)throw failure;
 const records=Object.fromEntries(Object.keys(roots).map(k=>[k,JSON.parse(readFileSync(out+'/'+k+'.json','utf8'))]));
 writeFileSync(main+'/docs/research/quality-20261005-controlled-tail.json',JSON.stringify({...plan,records,finished:new Date().toISOString(),interpretation:'Synchronized three-process diagnostic of one predeclared costly case; exact saved tracks and work, not a universal performance estimate.'},null,2)+'\n');
 }finally{release()}
}
