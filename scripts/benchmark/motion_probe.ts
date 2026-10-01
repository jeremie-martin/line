/** Matched-plan motion/search pilot. Keep every scheduled result, including failures. */
import {loadCatalog} from '../../benchmark/v6/model.ts';
import {caseSpec} from '../../benchmark/v4/model.ts';
import {mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {compileArcMotion,type ArcMotionOptions} from '../v0/optimizer/arc_motion.ts';
import {repertoireSearchOptions} from '../v0/optimizer/repertoire_search.ts';
import {planRepertoire,validateProductionPlan,type Construction} from '../v0/optimizer/repertoire_policy.ts';
import {planIntentionalRepertoire} from '../v0/optimizer/intentional_repertoire.ts';
import {inspectRepertoireLayout as inspectRepertoire} from '../v0/optimizer/repertoire_layout.ts';
import {arcRailGroups} from '../v0/optimizer/arc_guidance.ts';
import {loadMusicCase} from '../produce/music_artifacts.ts';
import {galleryCompilerIdentity,replayGalleryTrack,writeGalleryJson} from '../gallery/artifacts.ts';
import {motionSamples,summarizeMotion} from '../v0/optimizer/motion_quality.ts';
import {captureArcFork} from '../v0/optimizer/arc_guide_study.ts';
import {extractRawTrajectory,resetFrameCount,setPhysicsFrameLimit} from '../lib/detector.ts';
const {LineRiderEngine:Judge,disposeAllWasmEnginesForStudy:dispose}=
 await import(new URL('../lib/_lr_engine_wasm.ts?motion-probe',import.meta.url).href);
const arg=(k:string,d:string)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const caseId=arg('case',''),song=caseId||arg('song','luna_bala_44s'),seed=Number(arg('seed','101')),budget=Number(arg('budget','3000000'));
const changes=JSON.parse(arg('options','{}')) as Partial<ArcMotionOptions>,label=arg('label','pilot');
if(!/^[a-zA-Z0-9_-]+$/.test(label))throw new Error('invalid probe label');
const out=resolve(arg('out','generated/intentional-motion/search'));mkdirSync(out,{recursive:true});
const id=[song,label,seed,budget].join('-'),compiler=galleryCompilerIdentity(process.cwd());
try{
 const catalog=caseId?loadCatalog():undefined,benchmarkCase=catalog?.cases.find(c=>c.id===caseId);
 if(caseId&&!benchmarkCase)throw new Error('unknown V6 case');
 const music=benchmarkCase?catalog!.music.find(c=>c.id===benchmarkCase.sourceId)!:undefined;
 const {spec,musicCase:c}=music?{spec:caseSpec(music),musicCase:{...music,phases:[],moments:[]}}:await loadMusicCase({song,title:song,moments:[]},-15);
 const boundaries=c.phases.map((p:any)=>p.t0??p.t??p.start).filter((t:any)=>Number.isFinite(t));
 const planner=arg('policy','v1')==='v2'?planIntentionalRepertoire:planRepertoire;
 const plan=benchmarkCase?validateProductionPlan(spec,benchmarkCase.plans[seed]):arg('plan','')?validateProductionPlan(spec,JSON.parse(readFileSync(arg('plan',''),'utf8'))):planner(spec,seed,{},boundaries);
 if(arg('shape','')){
   if(plan.policy!=='line.repertoire-policy.v2')throw new Error('layout pilot requires the contextual policy');
   for(const r of plan.requests.slice(1)){
     const selected=r.section>=3&&r.section<=5;
     r.construction=selected?arg('shape','arcs') as Construction:'arcs';r.guidance=selected?'required':'optional';
     r.railLayout=selected?arg('layout','transfer') as 'paired'|'transfer':'paired';
   }
   plan.phrases=plan.requests.slice(1).map(r=>({first:r.section,count:1,construction:r.construction,guidance:r.guidance,railLayout:r.railLayout}));
   validateProductionPlan(spec,plan);
 }
 const examplePath=arg('examples',''),exampleBytes=examplePath?readFileSync(examplePath):undefined;
 const examples=exampleBytes?JSON.parse(gunzipSync(exampleBytes).toString()):undefined;
 if(examples)assert.equal(examples.schema,'line.construction-examples.v1');
 const policyPath=arg('construction-policies',''),policyBytes=policyPath?readFileSync(policyPath):undefined;
 const policies=policyBytes?JSON.parse(gunzipSync(policyBytes).toString()):undefined;
 if(policies)assert.equal(policies.schema,'line.construction-policies.v1');
 const options={...repertoireSearchOptions(spec,plan,budget-Math.round(spec.duration*40)-21),...changes,
  ...(examples?{constructionExamples:examples.groups}:{}),...(policies?{constructionPolicies:policies.groups}:{})};
 let forkInput:any;
 if(arg('fork','')){
  const path=resolve(arg('fork','')),bytes=readFileSync(path),source=JSON.parse(bytes.toString());
  assert.deepEqual(source.plan,plan,'fork must use exactly the same requested plan');
  const section=Number(arg('section',String(source.rows.length-1)));
  resetFrameCount();setPhysicsFrameLimit(null);
  const captured=captureArcFork(source,section);
  options.budget-=captured.physicsFrames;
  options.fork={...captured.fork,guides:plan.requests[section].guidance!=='forbidden',
   fragmentSections:plan.requests.filter(r=>r.section<section&&r.construction==='scattered').map(r=>r.section),
   ...(source.rows.length===plan.requests.length?{continuation:source.rows.slice(section).map((r:any)=>({control:r.control,incoming:r.incoming,span:r.span}))}:{})};
  options.sectionStyles=Object.fromEntries(Object.entries(options.sectionStyles!).filter(([i])=>Number(i)>=section));
  forkInput={path,sha256:createHash('sha256').update(bytes).digest('hex'),section,preparationFrames:captured.physicsFrames,
   sourceCompilationFrames:source.physicalFrames,prefixSha256:captured.prefixSha256,stateSha256:captured.fork.stateSha256};
 }
 const began=performance.now(),result=compileArcMotion(spec,seed,options),ms=performance.now()-began;
 const replay=replayGalleryTrack(result.track,c as any,true),fragmented=new Set(plan.requests.filter(r=>r.construction==='scattered').map(r=>r.section));
 const roles:Record<number,number[]>={};for(const [i,chains]of arcRailGroups(result.track.lines.filter(l=>!fragmented.has(Math.floor((l.id-1000)/10000)))))roles[i]=(chains[1]??[]).map(l=>l.id);
 for(const i of fragmented)roles[i]=result.rows[i]?.railGuides??[];
 resetFrameCount();setPhysicsFrameLimit(null);
 const engine=new Judge().setStart(result.track.startPosition,result.track.riders[0].startVelocity).addLine(result.track.lines),end=Math.round(spec.duration*40);
 const raw=extractRawTrajectory(engine,end+20),samples=motionSamples(raw.frames,1,end);
 const realization=inspectRepertoire(plan,result.track.lines,roles,replay.collisionIds!,raw.frames.map(f=>f.position));
 const sections=plan.requests.map(r=>({section:r.section,construction:r.construction,guidance:r.guidance,
  summary:summarizeMotion(samples.filter(s=>s.frame>=r.frame&&s.frame<r.next),r.frame)}));
 const motion={full:summarizeMotion(samples,1),opening:summarizeMotion(samples.filter(s=>s.frame<=120),1),sections};
 assert.deepEqual(galleryCompilerIdentity(process.cwd()),compiler,'compiler changed during motion probe');
 if(policyBytes)assert.ok(policyBytes.equals(readFileSync(policyPath)),'construction policies changed during motion probe');
 if(exampleBytes)assert.ok(exampleBytes.equals(readFileSync(examplePath)),'example corpus changed during motion probe');
 writeGalleryJson(out,id+'.json',{id,compiler,song,seed,budget,changes,ms,physicalFrames:result.stats.sim_frames+(forkInput?.preparationFrames??0),
  ...(forkInput?{forkInput,forkEvidence:result.forkEvidence}:{}),
  ...(policyBytes?{constructionPolicies:{path:policyPath,sha256:createHash('sha256').update(policyBytes).digest('hex')}}:{}),
  ...(exampleBytes?{examples:{path:examplePath,sha256:createHash('sha256').update(exampleBytes).digest('hex')}}:{}),
  score:replay.grade.score,valid:replay.grade.score.valid,realization,motion,plan,rows:result.rows,railGuides:roles,
  track:result.track,report:result.report,failure:result.failure,planning:result.planningDecisions,attempts:result.attempts,attemptWork:result.attemptWork,completionFirst:result.completionFirstStats,lookahead:result.lookaheadStats,initializationRecovery:result.initializationRecovery,refinement:result.refinementStats,initialProposalWork:result.initialProposalWork,observedReceiverWork:result.observedReceiverWork,coupledIntervalWork:result.coupledIntervalWork,transitionRevisionWork:result.transitionRevisionWork,constructionImprovement:result.constructionImprovement});
 console.log(JSON.stringify({id,ms,frames:result.stats.sim_frames+(forkInput?.preparationFrames??0),valid:replay.grade.score.valid,score:replay.grade.score.score,
  fulfilled:realization.fulfilledSections,total:realization.requested,bursts:motion.full.bursts.map(b=>({frames:b.frames,max:b.maximum,excess:b.maxExcess,episodes:b.episodes})),failure:result.failure}));
}catch(error){writeGalleryJson(out,id+'.error.json',{id,compiler,error:String(error),stack:error instanceof Error?error.stack:null});throw error;}
finally{dispose();setPhysicsFrameLimit(null);}
