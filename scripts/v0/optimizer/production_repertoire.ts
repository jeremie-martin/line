/** Production orchestration with one accountable allowance and no implicit style fallback. */
import {compileArcMotion} from './arc_motion.ts';
import {connectedArcOptions} from './connected_arcs.ts';
import {composeScatteredPhrase,composeContactSections} from './contact_composition.ts';
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
  const scatter=plan.phrases.filter(p=>p.construction==='scattered');
  const sourceBudget=scatter.length?Math.floor((budget-replay)*.55):budget-replay;
  let result=compileArcMotion(spec,seed,{...connectedArcOptions(spec,sourceBudget),policyPreview:false,
    initialRecoverySamples:80,sectionStyles:styles,collectTrajectoryLoss:true});
  let physicalFrames=result.stats.sim_frames,fragmentSections:number[]=[],railGuides:Record<number,number[]>={};
  const searchTotals={samples:result.samples,viable:result.stats.viable_candidate_samples,backtracks:result.backtracks,rebuilds:result.engineRebuilds??result.backtracks+2};
  const work:Array<{stage:string;allowance:number;physicalFrames:number;complete:boolean}>=[{stage:'connected',allowance:sourceBudget,physicalFrames,complete:complete(result)}];
  let constructionFailure:string|null=null;
  for(const [i,phrase]of scatter.entries()){
    if(!complete(result)){constructionFailure='connected-source-incomplete';break;}
    const sections=Array.from({length:phrase.count},(_,k)=>phrase.first+k),resume=sections.at(-1)!+1;
    const remaining=budget-replay-physicalFrames,allowance=Math.floor(remaining/(scatter.length-i));
    const source={...result,fragmentSections,railGuides};
    const minimum=resume<plan.requests.length?7*replay+2*(plan.requests[resume].frame+1):4*replay;
    if(allowance<=minimum){constructionFailure='fragment-allowance';break;}
    if(resume<plan.requests.length){
      const edit=composeScatteredPhrase(spec,seed,source,sections,[.003],allowance,
        Object.fromEntries(Object.entries(styles).filter(([index])=>Number(index)>=resume)),{initialRecoverySamples:80});
      result=edit.result;fragmentSections=edit.fragmentSections;railGuides=edit.railGuides;
      searchTotals.samples+=result.samples;searchTotals.viable+=result.stats.viable_candidate_samples;
      searchTotals.backtracks+=result.backtracks;searchTotals.rebuilds+=(result.engineRebuilds??result.backtracks+2)+2;
      physicalFrames+=edit.physicalFrames;work.push({stage:`scattered:${phrase.first}`,allowance,physicalFrames:edit.physicalFrames,complete:complete(result)});
    }else{
      const edit=composeContactSections(spec,source,{sections,widths:[.003],budget:allowance});
      result={...result,track:edit.track,report:edit.report,trajectoryLoss:edit.trajectoryLoss};
      fragmentSections=[...fragmentSections,...sections];railGuides=edit.railGuides;
      searchTotals.rebuilds+=4;
      physicalFrames+=edit.physicalFrames;work.push({stage:`scattered:${phrase.first}`,allowance,physicalFrames:edit.physicalFrames,complete:complete(result)});
    }
  }
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
