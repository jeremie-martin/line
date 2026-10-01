/** Matched-plan motion/search pilot. Keep every scheduled result, including failures. */
import {mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {compileArcMotion,type ArcMotionOptions} from '../v0/optimizer/arc_motion.ts';
import {connectedArcOptions} from '../v0/optimizer/connected_arcs.ts';
import {planRepertoire,constructionStyle,validateProductionPlan,type Construction} from '../v0/optimizer/repertoire_policy.ts';
import {planIntentionalRepertoire} from '../v0/optimizer/intentional_repertoire.ts';
import {inspectRepertoireLayout as inspectRepertoire} from '../v0/optimizer/repertoire_layout.ts';
import {arcRailGroups} from '../v0/optimizer/arc_guidance.ts';
import {loadMusicCase} from '../produce/music_artifacts.ts';
import {galleryCompilerIdentity,replayGalleryTrack,writeGalleryJson} from '../gallery/artifacts.ts';
import {motionSamples,summarizeMotion} from '../v0/optimizer/motion_quality.ts';
import {extractRawTrajectory,resetFrameCount,setPhysicsFrameLimit} from '../lib/detector.ts';
const {LineRiderEngine:Judge,disposeAllWasmEnginesForStudy:dispose}=
 await import(new URL('../lib/_lr_engine_wasm.ts?motion-probe',import.meta.url).href);
const arg=(k:string,d:string)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const song=arg('song','luna_bala_44s'),seed=Number(arg('seed','101')),budget=Number(arg('budget','3000000'));
const changes=JSON.parse(arg('options','{}')) as Partial<ArcMotionOptions>,label=arg('label','pilot');
if(!/^[a-zA-Z0-9_-]+$/.test(label))throw new Error('invalid probe label');
const out=resolve(arg('out','generated/intentional-motion/search'));mkdirSync(out,{recursive:true});
const id=[song,label,seed,budget].join('-'),compiler=galleryCompilerIdentity(process.cwd());
try{
 const {spec,musicCase:c}=await loadMusicCase({song,title:song,moments:[]},-15);
 const boundaries=c.phases.map((p:any)=>p.t0??p.t??p.start).filter((t:any)=>Number.isFinite(t));
 const planner=arg('policy','v1')==='v2'?planIntentionalRepertoire:planRepertoire;
 const plan=arg('plan','')?validateProductionPlan(spec,JSON.parse(readFileSync(arg('plan',''),'utf8'))):planner(spec,seed,{},boundaries);
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
 const styles=Object.fromEntries(plan.requests.map(r=>[r.section,constructionStyle(r)]));
 const options={...connectedArcOptions(spec,budget-Math.round(spec.duration*40)-21),policyPreview:false,
  initialRecoverySamples:160,memoryScope:'construction' as const,sectionStyles:styles,
  constructionRequests:Object.fromEntries(plan.requests.map(r=>[r.section,r])),collectTrajectoryLoss:true,...changes};
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
 writeGalleryJson(out,id+'.json',{id,compiler,song,seed,budget,changes,ms,physicalFrames:result.stats.sim_frames,
  score:replay.grade.score,valid:replay.grade.score.valid,realization,motion,plan,rows:result.rows,railGuides:roles,
  track:result.track,report:result.report,failure:result.failure,planning:result.planningDecisions,lookahead:result.lookaheadStats});
 console.log(JSON.stringify({id,ms,frames:result.stats.sim_frames,valid:replay.grade.score.valid,score:replay.grade.score.score,
  fulfilled:realization.fulfilledSections,total:realization.requested,bursts:motion.full.bursts.map(b=>({frames:b.frames,max:b.maximum,excess:b.maxExcess,episodes:b.episodes})),failure:result.failure}));
}catch(error){writeGalleryJson(out,id+'.error.json',{id,compiler,error:String(error),stack:error instanceof Error?error.stack:null});throw error;}
finally{dispose();setPhysicsFrameLimit(null);}
