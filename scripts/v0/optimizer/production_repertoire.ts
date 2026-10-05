/** Production orchestration with one accountable allowance and no implicit style fallback. */
import {compileArcMotion} from './arc_motion.ts';
import {repertoireSearchOptions} from './repertoire_search.ts';
import {arcRailGroups} from './arc_guidance.ts';
import {normalizeCompilerTimeline} from './compiler_input.ts';
import {validateProductionPlan,type CreativePreferences,type ProductionPlan} from './repertoire_policy.ts';
import {planIntentionalRepertoire} from './intentional_repertoire.ts';
import {inspectRepertoireLayout as inspectRepertoire} from './repertoire_layout.ts';
import {motionSamples,summarizeMotion} from './motion_quality.ts';
import {extractRawTrajectory,resetFrameCount,setPhysicsFrameLimit,getPhysicsFrameCount} from '../../lib/detector.ts';
import type {Spec} from '../types.ts';
import {impactAccount,type ImpactAccountId} from './impact_accounts.ts';
import {impactSearchProfile} from './contact_impact_profile.ts';
import {validRide} from './ride_validity.ts';
const {LineRiderEngine:Judge,disposeAllWasmEnginesForStudy:dispose}=
  await import(new URL('../../lib/_lr_engine_wasm.ts?production-repertoire-audit',import.meta.url).href);
export type RepertoireOptions={budget:number;creative?:CreativePreferences;plan?:ProductionPlan;phraseBoundaries?:number[];impactContract?:ImpactAccountId};
export function compileProductionRepertoire(input:Spec,seed:number,options:RepertoireOptions){
  const spec=normalizeCompilerTimeline(input),plan=options.plan?validateProductionPlan(spec,options.plan):planIntentionalRepertoire(spec,seed,options.creative,options.phraseBoundaries);
  if(plan.seed!==seed)throw new Error('construction plan and compiler seed differ');
  const end=Math.round(spec.duration*40)+20,replay=end+1,budget=options.budget;
  if(!Number.isSafeInteger(budget)||budget<12*replay)throw new Error('repertoire allowance cannot cover construction and independent replay');
  const allowance=budget-replay,searchOptions=repertoireSearchOptions(spec,plan,allowance,options.impactContract);
  const styles=searchOptions.sectionStyles!;
  const result=compileArcMotion(spec,seed,searchOptions);
  let physicalFrames=result.stats.sim_frames;
  const fragmentSections=plan.requests.filter(r=>r.construction==='scattered'&&r.section<result.rows.length).map(r=>r.section);
  const railGuides:Record<number,number[]>=Object.fromEntries(fragmentSections.map(i=>[i,result.rows[i].railGuides??[]]));
  const searchTotals={samples:result.samples,viable:result.stats.viable_candidate_samples,backtracks:result.backtracks,rebuilds:result.backtracks+2};
  const work:Array<{stage:string;allowance:number;physicalFrames:number;complete:boolean}>=[{stage:'shared-search',allowance,physicalFrames,complete:validRide(result)}];
  const constructionFailure=validRide(result)?null:result.failure?.reason??'incomplete';
  const fragmented=new Set(fragmentSections);
  for(const [section,chains]of arcRailGroups(result.track.lines.filter(l=>!fragmented.has(Math.floor((l.id-1000)/10000)))))railGuides[section]=(chains[1]??[]).map(l=>l.id);
  // This independent physical check is compiler work, charged even on unsuccessful requests.
  resetFrameCount();setPhysicsFrameLimit(budget-physicalFrames);
  let realization:ReturnType<typeof inspectRepertoire>;
  let motion:{full:ReturnType<typeof summarizeMotion>;sections:Array<{section:number;summary:ReturnType<typeof summarizeMotion>}>};
  try{
    const engine=new Judge().setStart(result.track.startPosition,result.track.riders[0].startVelocity).addLine(result.track.lines);
    const raw=extractRawTrajectory(engine,end);
    if(options.impactContract){
      const ruler=impactAccount(options.impactContract),measured=ruler.evaluate(ruler.observe(engine,raw.frames),spec.contacts.map(c=>({frame:Math.round(c.t*40),impact:c.impact})),Math.round(spec.duration*40),result.report.terminus.reason==='endOfSpec');
      if(JSON.stringify(measured)!==JSON.stringify(result.impactEvaluation))throw new Error('production impact replay mismatch');
    }
    const samples=motionSamples(raw.frames,1,Math.round(spec.duration*40));
    motion={full:summarizeMotion(samples,1),sections:plan.requests.map(r=>({section:r.section,
      summary:summarizeMotion(samples.filter(s=>s.frame>=r.frame&&s.frame<r.next),r.frame)}))};
    const collisions=Array.from({length:end+1},(_,f)=>engine.getUpdatesAtFrame(f).filter((u:any)=>u.type==='CollisionUpdate').map((u:any)=>u.id));
    realization=inspectRepertoire(plan,result.track.lines,railGuides,collisions,raw.frames.map(f=>f.position));
    const frames=getPhysicsFrameCount();physicalFrames+=frames;work.push({stage:'realization-replay',allowance:replay,physicalFrames:frames,complete:validRide(result)});
  }finally{dispose();setPhysicsFrameLimit(null);}
  if(physicalFrames>budget)throw new Error('production repertoire exceeded its whole-compile allowance');
  return {result:{...result,budget,stats:{...result.stats,sim_frames:physicalFrames}},plan,styles,fragmentSections,railGuides,realization,motion,
    valid:validRide(result),qualified:validRide(result)&&realization.fulfilled,constructionFailure,physicalFrames,budget,work,searchTotals,
    ...(options.impactContract?{impactSearchProfile:impactSearchProfile(options.impactContract)}:{})};
}
