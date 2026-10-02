/** Post-selection capability check on the complete frozen V6 input catalog.
 * The experimental account changes the task: these are NOT V6 scores. The
 * original runner separately checks compatibility under the historical task. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,existsSync,openSync,closeSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {loadCatalog} from '../../benchmark/v6/model.ts';
import {verifyFrozen} from '../../benchmark/v6/contract.ts';
import {policy} from '../../benchmark/v6/policy.ts';
import {caseSpec,sha} from '../../benchmark/v4/model.ts';
import {CONTACT_IMPACT_CONTRACT} from '../lib/contact_impact.ts';
import {galleryCompilerIdentity,writeGalleryJson,replayGalleryTrack} from './artifacts.ts';
import {contactImpactGrade} from './contact_impact_grade.ts';
import {inspectRepertoireLayout} from '../v0/optimizer/repertoire_layout.ts';
import {arcRailGroups} from '../v0/optimizer/arc_rail_groups.ts';
const arg=(k:string,d?:string)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3)??d;
const out=resolve(arg('out')!),catalog=loadCatalog();
const checked=(p:string)=>{const b=readFileSync(p);assert.equal(sha(b),readFileSync(p+'.sha256','utf8').trim());return JSON.parse(b.toString());};
const observed=(track:any,music:any)=>{
 const replay=replayGalleryTrack(track,music,true,CONTACT_IMPACT_CONTRACT.id),impact=replay.impactEvaluation!;
 const grade=contactImpactGrade(replay.grade,impact),a=impact.account;
 return {replay,impact,grade,summary:{quality:grade.score.score,valid:grade.score.valid,loss:a.loss,strengthMse:a.strengthMse,timingMse:a.timingMse,
   extraMse:a.extraMse,missing:a.missingTargets.length,targets:music.contacts.length,
   extraAboveQuarterScale:a.unmatchedEvents.filter(i=>impact.events[i].strength>=.25).length,
   gainExcessSum:impact.speedGains.reduce((n,g)=>n+Math.max(0,g.strongest.gain-Math.max(.75,.1*g.strongest.speedBefore)),0),components:grade.score.components}};
};
if(process.argv[2]==='worker'){
 const plan=checked(join(out,'plan.json')),id=arg('id')!,seed=Number(arg('seed')),c=catalog.cases.find(c=>c.id===id)!;
 assert.ok(plan.ids.includes(id)&&plan.seeds.includes(seed));
 const music=catalog.music.find(m=>m.id===c.sourceId)!,request=c.plans[seed],name=`${id}-${seed}`;
 const baselineTrack=checked(join(plan.baseline,'tracks',name+'.json')),baseline=observed(baselineTrack,music);
 const initial={id,seed,sourceId:c.sourceId,panel:c.panel,family:c.family,planSha256:sha(readFileSync(join(out,'plan.json'))),baseline:baseline.summary};
 const began=performance.now();
 try{
  const {compileHandoff}=await import(pathToFileURL(join(plan.compilerRoot,'scripts/v0/optimizer/handoff.ts')).href);
  const cp=compileHandoff(caseSpec(music),seed,{budget:plan.budget,impactContract:CONTACT_IMPACT_CONTRACT.id,
    ...(c.panel==='automatic'?{creative:request.preferences}:{constructionPlan:request})}),r=cp.repertoire;
  const compileMs=performance.now()-began;assert.ok(r);assert.deepEqual(r.plan.requests,request.requests,'fixed requests changed');
  assert.ok(cp.stats.sim_frames<=plan.budget);const result=observed(cp.track,music);
  assert.deepEqual(result.impact,r.result.impactEvaluation,'cold shared account differs');
  const fragments=new Set(request.requests.filter(r=>r.construction==='scattered').map(r=>r.section)),roles:Record<number,number[]>={};
  for(const [i,chains]of arcRailGroups(cp.track.lines.filter((l:any)=>!fragments.has(Math.floor((l.id-1000)/10000)))))roles[i]=(chains[1]??[]).map(l=>l.id);
  for(const i of fragments)roles[i]=r.result.rows[i]?.railGuides??[];
  const positions=result.replay.trace.frames.map((f:number[])=>({x:(f[8]+f[10]+f[12]+f[14]+f[16]+f[18])/6,y:(f[9]+f[11]+f[13]+f[15]+f[17]+f[19])/6}));
  const fulfillment=inspectRepertoireLayout(request,cp.track.lines,roles,result.replay.collisionIds!,positions);
  assert.equal(fulfillment.fulfilled,r.realization.fulfilled,'cold fulfillment differs');
  const candidate={...result.summary,quality:fulfillment.fulfilled?result.summary.quality:0,fulfilled:fulfillment.fulfilled};
  const row={...initial,candidate,physicalFrames:cp.stats.sim_frames,compileMs,trackHash:sha(JSON.stringify(cp.track)),
    failure:r.result.failure,constructionFailure:r.constructionFailure,executionError:null};
  writeGalleryJson(join(out,'tracks'),name+'.json',cp.track);
  writeGalleryJson(join(out,'accounts'),name+'.json',{candidate:result.impact,baseline:baseline.impact,fulfillment});
  writeGalleryJson(join(out,'cells'),name+'.json',row);
 }catch(e){writeGalleryJson(join(out,'cells'),name+'.json',{...initial,candidate:{quality:0,valid:false,fulfilled:false},executionError:String(e),stack:e instanceof Error?e.stack:null,compileMs:performance.now()-began});}
}else{
 const compilerRoot=resolve(arg('compiler-root')!),baseline=resolve(arg('baseline','generated/intentional-motion/v6-candidate-8')!),jobs=Number(arg('jobs','16'));
 assert.ok(Number.isSafeInteger(jobs)&&jobs>0&&jobs<=24);const ids=catalog.cases.filter(c=>c.split==='canonical').map(c=>c.id),seeds=[...policy.seeds];
 const plan={schema:'line.contact-impact-complete-panel-plan.v1',compilerRoot,compiler:galleryCompilerIdentity(compilerRoot),baseline,
  baselineRunSha256:sha(readFileSync(join(baseline,'run.json'))),ids,seeds,budget:policy.budget,contract:CONTACT_IMPACT_CONTRACT,judge:verifyFrozen(),
  harnessSha256:sha(readFileSync(import.meta.filename)),purpose:'Frozen post-selection capability stress on known catalog inputs. Experimental quality, not V6 headline. All outcomes retained; no selection from this evaluation.'};
 mkdirSync(out,{recursive:true});for(const d of ['cells','tracks','logs','accounts'])mkdirSync(join(out,d),{recursive:true});
 if(existsSync(join(out,'plan.json')))assert.deepEqual(checked(join(out,'plan.json')),plan);else writeGalleryJson(out,'plan.json',plan);
 const planSha=sha(readFileSync(join(out,'plan.json'))),queue=ids.flatMap(id=>seeds.map(seed=>({id,seed})));let completed=0;
 await Promise.all(Array.from({length:jobs},async()=>{while(queue.length){const {id,seed}=queue.shift()!,name=`${id}-${seed}`,path=join(out,'cells',name+'.json');
  if(existsSync(path)){assert.equal(checked(path).planSha256,planSha);completed++;continue;}
  const fd=openSync(join(out,'logs',name+'.log'),'w');try{
   const code=await new Promise((done,reject)=>{const child=spawn(process.execPath,['--import','tsx',import.meta.filename,'worker',`--out=${out}`,`--id=${id}`,`--seed=${seed}`],{env:{...process.env,LR_ENGINE:'wasm'},stdio:['ignore',fd,fd]});child.once('error',reject);child.once('exit',done);});assert.equal(code,0,`worker failed ${name}`);
  }finally{closeSync(fd);}completed++;if(completed%12===0)console.log(JSON.stringify({completed,total:ids.length*seeds.length}));
 }}));
 assert.deepEqual(galleryCompilerIdentity(compilerRoot),plan.compiler);assert.deepEqual(verifyFrozen(),plan.judge);assert.equal(sha(readFileSync(import.meta.filename)),plan.harnessSha256);
 const rows=ids.flatMap(id=>seeds.map(seed=>checked(join(out,'cells',`${id}-${seed}.json`))));for(const r of rows)assert.equal(r.planSha256,planSha);
 const summary={scheduled:rows.length,validFulfilled:rows.filter(r=>r.candidate.valid&&r.candidate.fulfilled).length,executionErrors:rows.filter(r=>r.executionError).length,
  meanExperimentalQuality:rows.reduce((n,r)=>n+r.candidate.quality,0)/rows.length,meanBaselineExperimentalQuality:rows.reduce((n,r)=>n+r.baseline.quality,0)/rows.length};
 writeGalleryJson(out,'run.json',{schema:'line.contact-impact-complete-panel.v1',plan,summary,rows});console.log(JSON.stringify(summary));
}
