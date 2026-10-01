/** One public compiler route, frozen independent judgment, complete preserved panels. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,existsSync,openSync,closeSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {loadCatalog} from '../../benchmark/v5/model.ts';
import {verifyFrozen} from '../../benchmark/v5/contract.ts';
import {policy} from '../../benchmark/v5/policy.ts';
import {requestScore,summarize} from '../../benchmark/v5/evaluator.ts';
import {caseSpec,sha} from '../../benchmark/v4/model.ts';
import {galleryCompilerIdentity,replayGalleryTrack,writeGalleryJson} from '../gallery/artifacts.ts';
import {inspectRepertoire} from '../v0/optimizer/repertoire_realization.ts';
import {arcRailGroups} from '../v0/optimizer/arc_rail_groups.ts';
const arg=(k:string,d?:string)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const command=process.argv[2],catalog=loadCatalog(),frozen=verifyFrozen();
const read=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim());return JSON.parse(b.toString());};
if(command==='worker'){
 const out=resolve(arg('out')!),runPlan=read(join(out,'plan.json')),id=arg('id')!,seed=Number(arg('seed'));
 assert.ok(runPlan.ids.includes(id)&&runPlan.seeds.includes(seed));
 const c=catalog.cases.find(c=>c.id===id)!,music=catalog.music.find(m=>m.id===c.sourceId)!,spec=caseSpec(music),requested=c.plans[seed];
 const {compileHandoff}=await import(pathToFileURL(join(runPlan.compilerRoot,'scripts/v0/optimizer/handoff.ts')).href);
 const began=performance.now();
 try{
   // Both panels are defined by frozen V1 plans. A later default arrangement
   // policy must not regenerate different requests for this historical task.
   const checkpoint=compileHandoff(spec,seed,{budget:runPlan.budget,constructionPlan:requested});
   const compileMs=performance.now()-began,r=checkpoint.repertoire;
   assert.ok(r,'public compiler did not return repertoire evidence');
   assert.deepEqual(r.plan.requests,requested.requests,'automatic policy changed frozen construction requests');
   assert.ok(checkpoint.stats.sim_frames<=runPlan.budget,'compiler exceeded total allowance');
   const judgeStarted=performance.now(),replay=replayGalleryTrack(checkpoint.track,music,true);
   // Infer connected roles from endpoint geometry, not the compiler's claimed realization.
   const fragments=new Set(requested.requests.filter(r=>r.construction==='scattered').map(r=>r.section));
   const roles:Record<number,number[]>={};
   let geometryError:string|null=null;
   try{for(const [i,chains]of arcRailGroups(checkpoint.track.lines.filter((l:any)=>!fragments.has(Math.floor((l.id-1000)/10000)))))roles[i]=(chains[1]??[]).map(l=>l.id);}
   catch(e){geometryError=String(e);}
   const realization=inspectRepertoire(requested,checkpoint.track.lines,roles,replay.collisionIds!);
   const foreign=checkpoint.track.lines.some((l:any)=>!requested.requests[Math.floor((l.id-1000)/10000)]);
   const valid=replay.grade.score.valid&&!geometryError&&!foreign,scored=c.scoredSections[seed];
   const fulfilled=scored.map(i=>realization.sections[i].fulfilled),musicalScore=replay.grade.score.score;
   const row={id,seed,sourceId:c.sourceId,panel:c.panel,family:c.family,split:c.split,planSha256:sha(readFileSync(join(out,'plan.json'))),
     score:requestScore(musicalScore,valid,fulfilled),musicalScore,valid,fulfilled:fulfilled.filter(Boolean).length,requested:fulfilled.length,
     trackHash:sha(JSON.stringify(checkpoint.track)),scoreDetail:replay.grade.score,observations:replay.grade.observations,
     geometryError,foreignGeometry:foreign,realization,work:r.work,stats:checkpoint.stats,constructionFailure:r.constructionFailure,
     physicalFrames:checkpoint.stats.sim_frames,compileMs,judgeMs:performance.now()-judgeStarted,executionError:null};
   writeGalleryJson(join(out,'tracks'),id+'-'+seed+'.json',checkpoint.track);
   writeGalleryJson(join(out,'cells'),id+'-'+seed+'.json',row);
 }catch(e){
   writeGalleryJson(join(out,'cells'),id+'-'+seed+'.json',{id,seed,sourceId:c.sourceId,panel:c.panel,family:c.family,split:c.split,
     planSha256:sha(readFileSync(join(out,'plan.json'))),score:0,musicalScore:0,valid:false,fulfilled:0,requested:c.scoredSections[seed].length,
     trackHash:null,executionError:String(e),stack:e instanceof Error?e.stack:null,compileMs:performance.now()-began});
 }
}else if(command==='eval'){
 const out=resolve(arg('out')!),compilerRoot=resolve(arg('compiler-root','.')!),split=arg('split','canonical')!;
 assert.ok(['canonical','confirmation'].includes(split));
 const cases=catalog.cases.filter(c=>c.split===split&&(!arg('ids')||arg('ids')!.split(',').includes(c.id)));
 const seeds=split==='canonical'?[...policy.seeds]:[...policy.confirmationSeeds];
 const compiler=galleryCompilerIdentity(compilerRoot),budget=Number(arg('budget',String(policy.budget))),jobs=Number(arg('jobs','8'));
 assert.ok(Number.isSafeInteger(jobs)&&jobs>0&&jobs<=24&&cases.length);
 const plan={schema:'line.benchmark-v5.run-plan.v1',compilerRoot,compiler,judge:frozen,executionSha256:sha(readFileSync(import.meta.filename)),
   ids:cases.map(c=>c.id),seeds,budget,split,profile:arg('ids')||budget!==policy.budget?'diagnostic':split};
 mkdirSync(out,{recursive:true});for(const d of ['cells','tracks','logs'])mkdirSync(join(out,d),{recursive:true});
 if(existsSync(join(out,'plan.json')))assert.deepEqual(read(join(out,'plan.json')),plan,'cached V5 run identity mismatch');else writeGalleryJson(out,'plan.json',plan);
 const planHash=sha(readFileSync(join(out,'plan.json'))),queue=cases.flatMap(c=>seeds.map(seed=>({id:c.id,seed})));let completed=0;
 await Promise.all(Array.from({length:Math.min(jobs,queue.length)},async()=>{
   while(queue.length){
     const {id,seed}=queue.shift()!,name=id+'-'+seed,cell=join(out,'cells',name+'.json');
     if(existsSync(cell)){assert.equal(read(cell).planSha256,planHash);completed++;continue;}
     const fd=openSync(join(out,'logs',name+'.log'),'w');
     try{
       const code=await new Promise<number|null>((done,reject)=>{const child=spawn(process.execPath,['--import','tsx',import.meta.filename,'worker',`--out=${out}`,`--id=${id}`,`--seed=${seed}`],{env:{...process.env,LR_ENGINE:'wasm'},stdio:['ignore',fd,fd]});child.once('error',reject);child.once('exit',done);});
       assert.equal(code,0,`V5 worker failed: ${name}`);
     }finally{closeSync(fd);}
     completed++;if(completed%8===0)console.log(JSON.stringify({completed,total:cases.length*seeds.length}));
   }
 }));
 assert.deepEqual(galleryCompilerIdentity(compilerRoot),compiler,'compiler changed during V5 run');assert.deepEqual(verifyFrozen(),frozen);
 assert.equal(sha(readFileSync(import.meta.filename)),plan.executionSha256,'V5 runner changed during execution');
 const rows=cases.flatMap(c=>seeds.map(seed=>read(join(out,'cells',c.id+'-'+seed+'.json'))));
 for(const row of rows)assert.equal(row.planSha256,planHash);
 const executionErrors=rows.filter(r=>r.executionError).length;
 const summary=cases.some(c=>c.panel==='fixed')&&cases.some(c=>c.panel==='automatic')?summarize(rows,cases,seeds):null;
 writeGalleryJson(out,'run.json',{schema:'line.benchmark-v5.run.v1',plan,summary,executionErrors,rows});
 console.log(JSON.stringify({out,summary,executionErrors}));
}else throw new Error('Usage: v5.ts eval --out=DIR [--compiler-root=DIR] [--split=confirmation] [--jobs=8]');
