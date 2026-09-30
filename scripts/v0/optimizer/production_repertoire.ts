/** Production orchestration with one accountable allowance and no implicit style fallback. */
import {compileArcMotion} from './arc_motion.ts';
import {connectedArcOptions} from './connected_arcs.ts';
import {arcRailGroups} from './arc_guidance.ts';
import {normalizeCompilerTimeline} from './compiler_input.ts';
import {planRepertoire,validateProductionPlan,constructionStyle,type CreativePreferences,type ProductionPlan} from './repertoire_policy.ts';
import {inspectRepertoire} from './repertoire_realization.ts';
import {extractRawTrajectory,resetFrameCount,setPhysicsFrameLimit,getPhysicsFrameCount} from '../../lib/detector.ts';
import type {Spec} from '../types.ts';
const {LineRiderEngine:Judge,disposeAllWasmEnginesForStudy:dispose}=
  await import(new URL('../../lib/_lr_engine_wasm.ts?production-repertoire-audit',import.meta.url).href);
export type RepertoireOptions={budget:number;creative?:CreativePreferences;plan?:ProductionPlan;phraseBoundaries?:number[]};
const complete=(result:any)=>result.report.terminus.reason==='endOfSpec'&&!result.report.off_beat_landings.length&&result.report.contacts.every((c:any)=>c.status==='hit');
export function compileProductionRepertoire(input:Spec,seed:number,options:RepertoireOptions){
  const spec=normalizeCompilerTimeline(input),plan=options.plan?validateProductionPlan(spec,options.plan):planRepertoire(spec,seed,options.creative,options.phraseBoundaries);
  const end=Math.round(spec.duration*40)+20,replay=end+1,budget=options.budget;
  if(!Number.isSafeInteger(budget)||budget<12*replay)throw new Error('repertoire allowance cannot cover construction and independent replay');
  const styles=Object.fromEntries(plan.requests.map(r=>[r.section,constructionStyle(r)]));
  const constructionRequests=Object.fromEntries(plan.requests.map(r=>[r.section,r]));
  const allowance=budget-replay;
  const result=compileArcMotion(spec,seed,{...connectedArcOptions(spec,allowance),policyPreview:false,
    initialRecoverySamples:160,sectionStyles:styles,constructionRequests,collectTrajectoryLoss:true});
  let physicalFrames=result.stats.sim_frames;
  const fragmentSections=plan.requests.filter(r=>r.construction==='scattered'&&r.section<result.rows.length).map(r=>r.section);
  const railGuides:Record<number,number[]>=Object.fromEntries(fragmentSections.map(i=>[i,result.rows[i].railGuides??[]]));
  const searchTotals={samples:result.samples,viable:result.stats.viable_candidate_samples,backtracks:result.backtracks,rebuilds:result.engineRebuilds??result.backtracks+2};
  const work:Array<{stage:string;allowance:number;physicalFrames:number;complete:boolean}>=[{stage:'shared-search',allowance,physicalFrames,complete:complete(result)}];
  const constructionFailure=complete(result)?null:result.failure?.reason??'incomplete';
  const fragmented=new Set(fragmentSections);
  for(const [section,chains]of arcRailGroups(result.track.lines.filter(l=>!fragmented.has(Math.floor((l.id-1000)/10000)))))railGuides[section]=(chains[1]??[]).map(l=>l.id);
  // This independent physical check is compiler work, charged even on unsuccessful requests.
  resetFrameCount();setPhysicsFrameLimit(budget-physicalFrames);
  let realization:ReturnType<typeof inspectRepertoire>;
  try{
    const engine=new Judge().setStart(result.track.startPosition,result.track.riders[0].startVelocity).addLine(result.track.lines);
    extractRawTrajectory(engine,end);
    const collisions=Array.from({length:end+1},(_,f)=>engine.getUpdatesAtFrame(f).filter((u:any)=>u.type==='CollisionUpdate').map((u:any)=>u.id));
    realization=inspectRepertoire(plan,result.track.lines,railGuides,collisions);
    const frames=getPhysicsFrameCount();physicalFrames+=frames;work.push({stage:'realization-replay',allowance:replay,physicalFrames:frames,complete:complete(result)});
  }finally{dispose();setPhysicsFrameLimit(null);}
  if(physicalFrames>budget)throw new Error('production repertoire exceeded its whole-compile allowance');
  return {result:{...result,budget,stats:{...result.stats,sim_frames:physicalFrames}},plan,styles,fragmentSections,railGuides,realization,
    valid:complete(result),qualified:complete(result)&&realization.fulfilled,constructionFailure,physicalFrames,budget,work,searchTotals};
}
