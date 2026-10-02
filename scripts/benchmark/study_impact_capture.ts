/** Local causal assay: preserve the complete incoming state and measure possible
 * catches with the production geometry and frozen physics/fulfillment checks.
 * A good local catch is not a claim about the unrebuilt remainder of the ride. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {captureArcFork} from '../v0/optimizer/arc_guide_study.ts';
import {createArcEngine} from '../v0/optimizer/arc_engine.ts';
import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy as dispose} from '../lib/native_motion/engine.ts';
import {getRiderMetered,getPhysicsFrameCount,resetFrameCount,setPhysicsFrameLimit,extractRawTrajectory,extractRawTrajectoryWindow,detect} from '../lib/detector.ts';
import {motionArc,type ArcMotionControl} from '../v0/optimizer/arc_geometry.ts';
import {normalizeArcControl} from '../v0/optimizer/arc_motion_control.ts';
import {observedReceiver} from '../v0/optimizer/observed_receiver.ts';
import {arcRailGroups} from '../v0/optimizer/arc_guidance.ts';
import {constructionStyle} from '../v0/optimizer/repertoire_policy.ts';
import {inspectConstructionWindow} from '../v0/optimizer/repertoire_candidate.ts';
import {constructionDeficit} from '../v0/optimizer/repertoire_feasibility.ts';
import {normalizeCompilerTimeline} from '../v0/optimizer/compiler_input.ts';
import {sliceTimeline,effectiveAxes,findAuthoredContactNearFrame} from '../v0/core/substrate.ts';
import {measureGapAxes} from '../v0/core/measure.ts';
import {loadMusicCase} from '../produce/music_artifacts.ts';
import {makeRng} from '../lib/rng.ts';
import {galleryCompilerIdentity} from '../gallery/artifacts.ts';
import {motionSamples,effectiveBodyVelocity} from '../v0/optimizer/motion_quality.ts';
import {motionResiduals,intervalMotionSummary} from '../v0/optimizer/motion_objective.ts';
const arg=(k:string,d:string)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const sha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const sourcePath=resolve(arg('source','')),sourceBytes=readFileSync(sourcePath);
assert.equal(sha(sourceBytes),readFileSync(sourcePath+'.sha256','utf8').trim(),'source artifact identity');
const source=JSON.parse(sourceBytes.toString());
const section=Number(arg('section','15')),out=resolve(arg('out','generated/impact-capture'));
mkdirSync(out,{recursive:true});const compiler=galleryCompilerIdentity(process.cwd());
const {spec}=await loadMusicCase({song:source.song,title:source.song,moments:[]},-15);
const request=source.plan.requests[section],row=source.rows[section];
assert.notEqual(request.construction,'scattered','this assay expects connected geometry');
const timeline=normalizeCompilerTimeline(spec),gaps=sliceTimeline(timeline.contacts.map(c=>Math.round(c.t*40)),Math.round(timeline.duration*40));
for(const g of gaps){g.targets=effectiveAxes(g,timeline);if(g.endsWithContact&&timeline.contacts[g.index].impact!==undefined)g.targets.impact=timeline.contacts[g.index].impact;}
const frame=row.frame,horizon=row.next-1,previous=gaps.find(g=>g.endFrame===request.frame)!;
const outgoing=gaps.find(g=>g.startFrame===request.frame)!;
const style={...constructionStyle(request),channel:12,radius:24,bidirectional:true,observedReceiver:true,compactFoldProposals:true};
resetFrameCount();setPhysicsFrameLimit(null);
const captured=captureArcFork(source,section),engine=createArcEngine(captured.fork.start,captured.fork.lines);
const before=JSON.stringify(getRiderMetered(engine,frame-1).ballisticState()),free=getRiderMetered(engine,frame);
engine.prepareCollisionTrace(frame);getRiderMetered(engine,frame);
const trace=engine.readCollisionTrace()[0],points=['PEG','TAIL','NOSE','STRING'].map(k=>trace[k]);
const prefix=extractRawTrajectory(engine,frame-1),failures:Record<string,number>={},records:any[]=[];
const reject=(reason:string)=>{failures[reason]=(failures[reason]??0)+1;return null;};
const evaluate=(rawControl:ArcMotionControl,label:string)=>{
 try{
 const c=normalizeArcControl(rawControl,{...style,span:row.span});
 let lines,child;
 if(c.receiverFlight!==undefined&&request.railLayout==='transfer'){
  const main=motionArc(points,free.velocity,c,1000+section*10000,false,12,false,24,4,{...style,guides:false});
  const support=engine.addLine(main),receiver=observedReceiver(support,main,frame,horizon,c,Math.max(...main.map(l=>l.id))+1,style);
  if(!receiver)return reject('receiver_no_window');lines=[...main,...receiver.guide];child=support.addLine(receiver.guide);
 }else{lines=motionArc(points,free.velocity,c,1000+section*10000,false,12,false,24,4,style);child=engine.addLine(lines);}
 if(JSON.stringify(getRiderMetered(child,frame-1).ballisticState())!==before)return reject('prefix');
 const state=getRiderMetered(child,horizon).ballisticState();if(!state.riderMounted||!state.sledIntact)return reject('binding');
 const raw={duration:horizon,frames:[...prefix.frames,...extractRawTrajectoryWindow(child,frame,horizon).frames]},det=detect(raw);
 if(det.terminus.reason!=='endOfSpec')return reject(det.terminus.reason);
 if(!findAuthoredContactNearFrame(det,frame,1,frame-source.rows[section-1].frame))return reject('missed');
 if(!raw.frames.slice(-6).every(f=>f.sledContacts.length===0))return reject('late_release');
 const contacts=source.plan.requests.map((r:any)=>r.frame);
 if(det.events.some(e=>e.type==='landing'&&!contacts.some((f:number)=>Math.abs(e.frame-f)<=1)))return reject('offbeat');
 const guides=(arcRailGroups(lines).get(section)?.[1]??[]).map(l=>l.id);
 const fulfillment=inspectConstructionWindow(request,lines,new Set(guides),raw.frames,f=>child.getAllContactLineIdsAtFrame(f));
 const impact=measureGapAxes(det,previous,lines,frame).impact!;
 const achieved=measureGapAxes(det,{...outgoing,startFrame:frame,endFrame:horizon},lines,horizon);
 const motion=intervalMotionSummary(motionSamples(raw.frames,Math.max(1,frame-9),horizon,effectiveBodyVelocity(state)),frame,horizon);
 const motionCost=motionResiduals(motion,previous.targets.impact,{burstWeight:.64,calmWeight:1,calmImpactMultiplier:1.5}).reduce((a,r)=>a+r*r,0);
 const errors:number[]=[];
 for(const key of ['air','speed','amplitude'] as const){
  const target=outgoing.targets[key],actual=achieved[key];
  if(target===undefined)continue;
  if(actual===undefined||!Number.isFinite(actual))return reject('missing_axis');
  errors.push((actual-target)*(key==='amplitude'?Math.sqrt(1/3):1));
 }
 errors.push(impact-previous.targets.impact!);
 const loss=errors.reduce((n,r)=>n+r*r,0)+motionCost;
 const response=label==='baseline'||label==='selected-replay'?motionSamples(raw.frames,frame,horizon,effectiveBodyVelocity(state)).map(s=>({frame:s.frame,impulse:Math.hypot(s.effective.x-s.incoming.x,s.effective.y-s.incoming.y),turn:s.directionCorrection,speedBefore:s.speedBefore,speedAfter:s.speedAfter,contacts:child.getAllContactLineIdsAtFrame(s.frame).map(id=>guides.includes(id)?'guide':'main')})):undefined;
 const record={label,control:c,impact,targetImpact:previous.targets.impact,achieved,loss,motionCost,fulfilled:fulfillment.fulfilled,deficit:constructionDeficit(fulfillment),reasons:fulfillment.reasons,...(response?{response}: {})};
 records.push(record);return record;
 }finally{Engine.retainOnly([engine]);}
};
try{
 const baseline=evaluate(row.control,'baseline');assert.ok(baseline?.fulfilled);assert.ok(Math.abs(baseline.impact-row.impact)<1e-10,'saved landing must replay exactly');
 const rng=makeRng(714),pool=[baseline];
 const insert=(record:any)=>{if(record?.fulfilled){pool.push(record);pool.sort((a,b)=>a.loss-b.loss);if(pool.length>24)pool.pop();}};
 const inspectPath=arg('inspect','');
 if(inspectPath){insert(evaluate(JSON.parse(readFileSync(inspectPath,'utf8')).best[0].control,'selected-replay'));}
 if(!inspectPath)for(const delta of [-40,-30,-20,-15,-10,-5,-2,2,5,10])for(const coupled of [0,-.5,-1])for(const offset of [-.3,0,.3])
  insert(evaluate({...row.control,entry:row.control.entry+delta,turn:row.control.turn+coupled*delta,offset:row.control.offset+offset},'entry-sweep'));
 if(arg('broad','false')==='true')for(const entryDelta of [0,10,20,30,40])for(const turn of [-50,-25,0,25,50])for(const exit of [-35,0,35,70])for(const duration of [.5,1,1.5,2])for(const bias of [-1,0,1])for(const offset of [0,.5])
  insert(evaluate({...row.control,entry:row.incoming-entryDelta,turn,exit,support:row.control.support*duration,bias,offset,turnFraction:.5},'broad'));
 const count=inspectPath?0:Number(arg('samples','2400'));
 for(let k=0;k<count;k++){
  const c={...pool[Math.floor(rng()*pool.length)].control},scale=k<count/2?1:.35;
  const spans={entry:12,turn:30,exit:25,support:Math.max(1,c.support*.4),bias:1,offset:.8,turnFraction:.25,receiverFlight:2,receiverEntry:12,receiverTurn:25,receiverExit:25,receiverDuration:.2};
  for(const key of Object.keys(spans) as Array<keyof typeof spans>){
   const value=c[key];if(value!==undefined&&rng()<.35)c[key]=value+(rng()*2-1)*spans[key]*scale;
  }
  insert(evaluate(c,'random-local'));
 }
 const selectedReplay=evaluate(pool[0].control,'selected-replay');
 assert.deepEqual(galleryCompilerIdentity(process.cwd()),compiler,'compiler changed during assay');
 const data={selectedReplay,sourcePath,sourceSha256:sha(sourceBytes),harnessSha256:sha(readFileSync(import.meta.filename)),
  ...(inspectPath?{inspectionSource:{path:inspectPath,sha256:sha(readFileSync(inspectPath))}}:{}),
  compiler,section,request,incoming:row.incoming,prefixSha256:captured.prefixSha256,stateSha256:captured.fork.stateSha256,physicalFrames:getPhysicsFrameCount(),baseline,failures,best:pool,records};
 const path=resolve(out,source.song+'-'+source.seed+'-'+section+'.json'),bytes=JSON.stringify(data)+'\n';
 writeFileSync(path,bytes);writeFileSync(path+'.sha256',sha(bytes)+'\n');
 console.log(JSON.stringify({source:source.song,seed:source.seed,section,baseline,best:pool[0],physicalFrames:getPhysicsFrameCount(),failures,records:records.length}));
}finally{dispose();setPhysicsFrameLimit(null);}
