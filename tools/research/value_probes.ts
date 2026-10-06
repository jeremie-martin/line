/** Independent native continuation labels from frozen production prefixes.
 * Collection never relies on a production search hook. Its own hard meter is
 * reported separately, and interrupted probes are not labelled as failures. */
import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy} from '../../scripts/lib/native_motion/engine.ts';
import {resetFrameCount,setPhysicsFrameLimit,getPhysicsFrameCount,getRiderMetered,PhysicsFrameLimitExceeded} from '../../scripts/lib/detector.ts';
import {createArcCompileContext} from '../../scripts/v0/optimizer/arc_compile_context.ts';
import {normalizeCompilerTimeline} from '../../scripts/v0/optimizer/compiler_input.ts';
import {searchInterval} from '../../scripts/v0/optimizer/arc_interval.ts';
import {arcArrivalFeatures,arcFutureValue} from '../../scripts/v0/optimizer/arc_value.ts';
import {distinctCandidates} from '../../scripts/v0/optimizer/arc_candidates.ts';
import type {ArcMotionOptions} from '../../scripts/v0/optimizer/arc_options.ts';
import type {Spec,TrackLine} from '../../scripts/v0/types.ts';

export const VALUE_COLLECTION = Object.freeze({anchors:24,width:4,samples:24,depth:2});
export function collectFutureProbes(spec:Spec,seed:number,options:ArcMotionOptions,lines:TrackLine[],committedRows:any[],budget:number){
 const ctx=createArcCompileContext(normalizeCompilerTimeline(spec),seed,options),rows:any[]=[];
 const {contacts,lineage}=ctx,eligible=Math.min(committedRows.length,contacts.length-1);
 const anchors=[...new Set(Array.from({length:Math.min(VALUE_COLLECTION.anchors,eligible)},(_,i)=>
  Math.round(i*Math.max(0,eligible-1)/Math.max(1,Math.min(VALUE_COLLECTION.anchors,eligible)-1))))];
 resetFrameCount();setPhysicsFrameLimit(budget);
 const local=(engine:Engine,index:number,protectedEngines:Engine[],warmStart?:any)=>{
  const found=searchInterval(ctx,engine,index,{samples:VALUE_COLLECTION.samples,guidanceSamples:12,responseSamples:0,
   initialRecoverySamples:0,...(warmStart?{warmStart}:{})},protectedEngines);
  if(!found?.best&&ctx.work.searchBudgetExhausted)throw new PhysicsFrameLimitExceeded(budget,getPhysicsFrameCount()+1);
  return found;
 };
 const continueFrom=(base:Engine,index:number,depth:number,protectedEngines:Engine[]):number|null=>{
  const found=local(base,index,protectedEngines);if(!found?.best)return null;
  if(depth===1||index===contacts.length-1)return found.best.cost;
  let best:number|null=null;
  for(const c of distinctCandidates(options,found.candidates,2)){
   const child=lineage.add(base,c.lines),tail=continueFrom(child,index+1,depth-1,[...protectedEngines,base]);
   if(tail!==null)best=Math.min(best??Infinity,c.localCost+tail);
   Engine.retainOnly([...protectedEngines,base]);
  }
  return best;
 };
 let interrupted=false;
 try{for(const i of anchors){
  const prefix=lines.filter(l=>Math.floor((l.id-1000)/10000)<i),base=lineage.rebuild(prefix);
  const found=local(base,i,[base],committedRows[i]?.control);if(!found?.best){Engine.retainOnly([]);continue;}
  const candidates=distinctCandidates(options,found.candidates,VALUE_COLLECTION.width);
  for(const c of candidates){
   const branch=lineage.add(base,c.lines),depth=Math.min(VALUE_COLLECTION.depth,contacts.length-i-1);
   const state=getRiderMetered(branch,found.horizon).ballisticState(),nose=state.points.NOSE,tail=state.points.TAIL;
   const dx=nose.x-tail.x,dy=nose.y-tail.y,spin=(dx*(nose.vy-tail.vy)-dy*(nose.vx-tail.vx))/Math.max(1,dx*dx+dy*dy);
   const features=c.valueFeatures??ctx.futureValueFeatures(arcArrivalFeatures(state,c.heading,c.endSpeed,c.pose,spin,found.horizon-(c.meta.release??found.frame)),i);
   const future=continueFrom(branch,i+1,depth,[base]);
   rows.push({index:i,contacts:contacts.length,features:features.slice(0,57),geometry:features.slice(57),localCost:c.localCost,
    pureFuture:future,depth,requestedDepth:depth,predictedFuture:c.predictedFuture??(options.futureValueModel?arcFutureValue(features,options.futureValueModel):null)});
   Engine.retainOnly([base]);
  }
  Engine.retainOnly([]);
 }}catch(error){if(!(error instanceof PhysicsFrameLimitExceeded))throw error;interrupted=true;}
 finally{disposeAllWasmEnginesForStudy();setPhysicsFrameLimit(null);}
 if(eligible>0&&!rows.length)throw new Error('no complete continuation probes collected');
 return {probes:rows,physicalFrames:getPhysicsFrameCount(),interrupted,anchors:anchors.length};
}
