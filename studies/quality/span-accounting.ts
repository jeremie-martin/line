/** Reconcile interval estimates on frozen saved tracks; not a metric change. */
import {writeFileSync,mkdirSync} from 'node:fs';
import {loadRun,readTrack} from '../../tools/eval/records.ts';
import {resolveCase} from '../../tools/eval/inputs.ts';
import {createArcCompileContext} from '../../scripts/v0/optimizer/arc_compile_context.ts';
import {connectedArcOptions} from '../../scripts/v0/optimizer/connected_arcs.ts';
import {createArcEngine} from '../../scripts/v0/optimizer/arc_engine.ts';
import {extractRawTrajectory,detect,resetFrameCount} from '../../scripts/lib/detector.ts';
import {objectiveAxes} from '../../scripts/v0/optimizer/arc_interval_state.ts';
import {arcSpanLoss} from '../../scripts/v0/optimizer/arc_boundary.ts';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';
const run=loadRun('/home/wyss/line/generated/eval/quality-20261005-baseline'),out:any[]=[];
for(const c of run.run.panel){
 const {spec}=await resolveCase(c,run.run.jolt);
 const ctx=createArcCompileContext(spec,c.seed,{...connectedArcOptions(spec,10_000_000),impactContract:'line.strike.v3',impactPreparationFrames:2});
 const track=readTrack(run.dir,c.id),engine=createArcEngine({position:track.startPosition,velocity:track.riders[0].startVelocity},track.lines);
 resetFrameCount();const raw=extractRawTrajectory(engine,ctx.end),full=detect(raw);
 const rows:any[]=[];
 for(let i=0;i<ctx.contacts.length;i++){
  const frame=ctx.contacts[i].frame,next=ctx.contacts[i+1]?.frame??ctx.end+1,horizon=next-1,objectiveEnd=Math.min(horizon,ctx.duration);
  const detected=detect({duration:horizon,frames:raw.frames.slice(0,horizon+1)}),before=detect({duration:frame-1,frames:raw.frames.slice(0,frame)});
  const planned=ctx.planned.find(g=>g.startFrame===(i===0?0:frame));
  const authored=ctx.gaps[ctx.contacts[i].gap+1];
  const loss=(d:any,g:any,end:number)=>g?arcSpanLoss(objectiveAxes(d,g,end),g.targets,1/3):0;
  const outgoing=loss(detected,planned,objectiveEnd),aligned=loss(detected,authored,objectiveEnd);
  const sampled=authored?{...authored,targets:planned?.targets??authored.targets}:undefined;
  const windowOnly=loss(detected,sampled,objectiveEnd);
  const previous=i>0?ctx.gaps[ctx.contacts[i].gap]:undefined;
  const replacement=previous?loss(detected,previous,previous.endFrame):0,subtraction=loss(before,previous,frame-1);
  const sampledPrevious=previous?{...previous,targets:ctx.planned.find(g=>g.index===previous.index)?.targets??previous.targets}:undefined;
  const searchReplacement=sampledPrevious?loss(detected,sampledPrevious,sampledPrevious.endFrame):0,searchSubtraction=loss(before,sampledPrevious,frame-1);
  rows.push({windowOnly,searchReplacement,searchSubtraction,i,frame,authoredStart:authored?.startFrame,plannedStart:planned?.startFrame,outgoing,aligned,replacement,subtraction});
 }
 const expected=ctx.gaps.reduce((s,g)=>s+arcSpanLoss(objectiveAxes(full,g,g.endFrame),g.targets,1/3),0);
 const old=rows.reduce((s,r)=>s+r.outgoing+r.replacement-r.subtraction,0),aligned=rows.reduce((s,r)=>s+r.aligned+r.replacement-r.subtraction,0);
 const expectedSearch=ctx.gaps.reduce((sum,g)=>sum+arcSpanLoss(objectiveAxes(full,g,g.endFrame),ctx.planned.find(p=>p.index===g.index)?.targets??g.targets,1/3),0);
 const windowOnly=rows.reduce((sum,r)=>sum+r.windowOnly+r.replacement-r.subtraction,0);
 const consistent=rows.reduce((sum,r)=>sum+r.windowOnly+r.searchReplacement-r.searchSubtraction,0);
 const r={id:c.id,jitter:spec.jitter??.05,expected,expectedSearch,old,aligned,windowOnly,consistent,oldMismatch:old-expected,alignedMismatch:aligned-expected,consistentMismatch:consistent-expectedSearch,rows};out.push(r);
 console.log(JSON.stringify({...r,rows:undefined}));Engine.retainOnly([]);
}
mkdirSync('generated/quality-spans',{recursive:true});writeFileSync('generated/quality-spans/accounting.json',JSON.stringify(out));
