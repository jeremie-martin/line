/** Measured arc search: one connected physical support curve per contact interval.
 * The curve's entry, impact-window turn, later slope and release length are
 * corrected using actual engine measurements. No point controls or scenery. */
import { createHash } from 'node:crypto';
import { LineRiderEngine as Engine, disposeAllWasmEnginesForStudy as disposeSearch } from '../../lib/native_motion/engine.ts';
import { getRiderMetered, getPhysicsFrameCount, resetFrameCount, setPhysicsFrameLimit, PhysicsFrameLimitExceeded, extractRawTrajectory, extractRawTrajectoryWindow, detect } from '../../lib/detector.ts';
import { sliceTimeline, effectiveAxes, resolveStartState, buildTrackJson, buildDriftReport, findAuthoredContactNearFrame, validateSpec, sampleGapTargets } from '../core/substrate.ts';
import { measureGapAxes, measureAmplitudePeakPx } from '../core/measure.ts';
import { validProfileControls } from './motion_profiles.ts';
import { motionArc, arcMainSteps, type ArcMotionControl, type ArcGeometryStyle, type ArcSectionStyle } from './arc_geometry.ts';
export { motionArc, type ArcMotionControl } from './arc_geometry.ts';
import { scheduleNativeContacts } from './native_motion_schedule.ts';
import { trimUnusedArcGuides, arcRailGroups } from './arc_guidance.ts';
import { refineArcTrack, arcWholeTrajectoryObjective, arcDetectedTrajectoryObjective } from './arc_refinement.ts';
import { arcPolicyArrival, arcControlProposals } from './arc_control_policy.ts';
import { arcResponseStep } from './arc_response.ts';
import { ArcControlMemory, arcConstructionMemoryKey, allocateArcProposalSlots, type ArcControlExample } from './arc_memory.ts';
import { arcSpanLoss, arcBoundaryCorrection } from './arc_boundary.ts';
import { arcArrivalFeatures, arcFutureValue, arcValueGuidance } from './arc_value.ts';
import { normalizeCompilerTimeline } from './compiler_input.ts';
import { createArcEngine } from './arc_engine.ts';
import { createArcCompileContext } from './arc_compile_context.ts';
import { finalizeArcTrack, disposeJudge } from './arc_finalize.ts';
import { arcAttemptTelemetry } from './arc_attempts.ts';
import { searchInterval as searchArcInterval } from './arc_interval.ts';
import { ARC_CORE_KEYS, ARC_EXPRESSIVE_KEYS, normalizeArcControl, arcControlMemoKey, arcControlValue, arcControlStep, arcMethodKeys, arcControlActive, arcControlsSimilar } from './arc_motion_control.ts';
import { authoredSpeedToPx, impactToRawPx, PREROLL, CALIB, type Spec, type TrackLine } from '../types.ts';

import { makeRng } from '../../lib/rng.ts';
import {inspectConstructionWindow} from './repertoire_candidate.ts';
import type {ConstructionRequest} from './repertoire_policy.ts';
import {contactObserver,extendContactObserver,fragmentInterval} from './contact_interval.ts';
import {motionSamples,effectiveBodyVelocity,MOTION_BANDS} from './motion_quality.ts';
import {constructionDeficit} from './repertoire_feasibility.ts';
import {motionResiduals,intervalMotionSummary,type MotionSearchOptions} from './motion_objective.ts';
import {refineArcPair,type PairMeasurement} from './arc_pair_response.ts';
import {observedReceiver} from './observed_receiver.ts';
import {CONTACT_IMPACT_CONTRACT, contactImpactPrefix, continueContactImpacts, accountContactImpacts} from '../../lib/contact_impact.ts';
import {impactFrames, evaluateMusicalImpacts, impactSearchResiduals, engagementGainResiduals, validateImpactSearchOptions, type ImpactSearchOptions} from './impact_search.ts';
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const rad=(x:number)=>x*Math.PI/180;
const deg=(x:number)=>x*180/Math.PI;
/** Per-section construction style: the geometry fields constructionStyle() emits. */
export type SectionStyle=Omit<ArcSectionStyle,'subdivisions'|'alignedFoldEntry'>;
export type ArcMotionOptions= Omit<ArcGeometryStyle,'contour'|'alignedFoldEntry'> & {
  budget:number;
  /** Explicit experimental ruler; absent means the qualified landing contract. */
  impactContract?:typeof CONTACT_IMPACT_CONTRACT.id;
  impactSearch?:ImpactSearchOptions;
  /** Prepare physical contact before its authored response time. Musical
   * targets and construction requests remain at their original timestamps. */
  impactPreparationFrames?:number;
  opposingEntryProposals?:number;
  /** Explicit motion research/production mode; absent in frozen ordinary/V5 defaults. */
  motionQuality?:MotionSearchOptions;
  /** Explicit repertoire search options. Production defaults are unchanged. */
  initialRecoverySamples?:number;
  /** Cover contact geometry before a first fully realized candidate exists. */
  constructionProposals?:boolean;
  constructionRecovery?:boolean;
  observedReceiver?:boolean;
  compactFoldProposals?:boolean;
  /** Native joint adjustment of neighboring supports, within the shared budget. */
  coupledIntervalSamples?:number;
  constructionAwareArrival?:boolean;
  /** Research composition by support index (startup is zero). Applied to every
   * proposal, lookahead and rebuilt continuation. Omitted sections inherit the
   * global settings; this changes construction, never the musical specification. */
  sectionStyles?:Record<number,SectionStyle>;
  /** Physical construction requirements participate in every proposal and continuation. */
  constructionRequests?:Record<number,ConstructionRequest>;
  constructionExamples?:Readonly<Record<string,readonly ArcControlExample[]>>;
  constructionPolicies?:Readonly<Record<string,any>>;
  /** Preserve distinct expressive geometry in learned and memory proposals. */
  controlDiversity?:'inherited'|'geometry';
  wholeTrackRefinement?:boolean;
  /** Rank already simulated complete alternatives by the full authored loss. */
  terminalSelection?:boolean;
  /** Keep the inherited five-frame turn representable during refinement. */
  preserveTurnTiming?:boolean;
  /** Measure the final objective at the authored end; still validate the grace. */
  authoredHorizon?:boolean;
  /** Retain useful search pressure beyond the public amplitude cap. */
  amplitudeOverflow?:'raw'|'log';
  /** Preserve the proposal mix within the slots a local probe can evaluate. */
  budgetedProposals?:boolean;
  /** Give unusable response-round remainders back to coordinate exploration. */
  completeGuidanceBudget?:boolean;
  /** Keep learned responses local to their physical geometry and guide permission. */
  memoryScope?:'construction';
  memorySamples?:number;
  memoryResponseSamples?:number;
  /** Replace the preceding truncated span once its contact boundary is measured. */
  completeBoundary?:boolean;
  samples?:number;
  arrivalWeight?:number;
  channel?:number;
  radius?:number;
  arrivalMode?:string;
  bidirectional?:boolean;
  impactWeight?:number;
  amplitudeWeight?:number;
  qualityRetries?:number;
  /** Revisit the preceding choice using a stronger measured current interval. */
  transitionRevision?:{errorThreshold?:number;width?:number;samples?:number;guidanceSamples?:number;responseSamples?:number};
  headingWeight?:number;
  guidance?:'span'|'clearance'|'full';
  guidanceSamples?:number;
  lookaheadWidth?:number;
  lookaheadSamples?:number;
  collectTrajectoryLoss?:boolean;
  warmStart?:ArcMotionControl;
  warmIncoming?:number;
  pruneGuidance?:boolean;
  lookaheadObjective?:'local'|'terminal';
  reserveFactor?:number;
  reuseContinuations?:boolean;
  guidanceJoint?:boolean;
  expressive?:boolean;
  localOnly?:boolean;
  arrivalReference?:any;
  refineAttempts?:number;
  refineSamples?:number;
  refineGuidanceSamples?:number;
  refineWidth?:number;
  refineMode?:'translate'|'reflow';
  adaptivePlanning?:boolean;
  strictHorizon?:boolean;
  directControls?:ArcMotionControl[];
  /** Spend remaining work on the ending without reconstructing a long suffix. */
  refineTailSections?:number;
  responseSamples?:number;
  cachePrefixReads?:boolean;
  /** Reuse completed evaluations only within the same physical search prefix. */
  memoCandidates?:boolean;
  /** Reuse complete measurements across searches with identical geometry prefixes. */
  reuseEvaluations?:boolean;
  controlPolicy?:any;
  policySamples?:number;
  /** Reduce local work if observed construction cost outgrows remaining capacity. */
  budgetAdaptiveLocal?:boolean;
  futureValueModel?:any;
  /** Research: use the learned value at the unresolved continuation boundary. */
  continuationValueWeight?:number;
  valueWeight?:number;
  /** Blend learned arrival value into local geometry optimization as well as ranking. */
  valueGuidanceWeight?:number};

export function compileArcMotion(spec:Spec,seed:number,options:ArcMotionOptions){
  const result=compileArcMotionOnce(spec,seed,options);
  return {...result,...arcAttemptTelemetry(result,options),budget:options.budget};
}

function compileArcMotionOnce(spec:Spec,seed:number,options:ArcMotionOptions){
  if(options.refineTailSections!==undefined&&(!Number.isSafeInteger(options.refineTailSections)||options.refineTailSections<1))throw new Error('invalid refinement tail window');
  const revision=options.transitionRevision?{errorThreshold:.12,width:3,samples:48,guidanceSamples:96,responseSamples:88,...options.transitionRevision}:undefined;
  if(revision&&(!Number.isFinite(revision.errorThreshold)||revision.errorThreshold<0||
    ![revision.width,revision.samples,revision.guidanceSamples,revision.responseSamples].every(v=>Number.isSafeInteger(v)&&v>=0)||revision.width>12))throw new Error('invalid transition revision');
  if(options.initialRecoverySamples!==undefined&&(!Number.isSafeInteger(options.initialRecoverySamples)||options.initialRecoverySamples<0||options.initialRecoverySamples>320))throw new Error('invalid initialization recovery allowance');
  if(options.coupledIntervalSamples!==undefined&&(!Number.isSafeInteger(options.coupledIntervalSamples)||options.coupledIntervalSamples<0||options.coupledIntervalSamples>512))throw new Error('invalid coupled interval allowance');
  if(!Number.isSafeInteger(seed)||!Number.isSafeInteger(options.budget)||options.budget<=0)throw new Error('invalid arc compiler input');
  if(!validProfileControls(options))throw new Error('invalid profile controls');
  if(options.impactContract!==undefined&&options.impactContract!==CONTACT_IMPACT_CONTRACT.id)throw new Error('unknown impact contract');
  validateImpactSearchOptions(options.impactSearch);
  if(options.impactSearch&&!options.impactContract)throw new Error('impact search options require their measurement contract');
  if(options.opposingEntryProposals!==undefined&&(!options.impactContract||!Number.isSafeInteger(options.opposingEntryProposals)||options.opposingEntryProposals<0||options.opposingEntryProposals>64))throw new Error('invalid opposing-entry allowance');
  if(options.impactPreparationFrames!==undefined&&(!options.impactContract||!Number.isSafeInteger(options.impactPreparationFrames)||options.impactPreparationFrames<0||options.impactPreparationFrames>2))throw new Error('invalid impact preparation');
  arcMainSteps(1,undefined,options.faces);
  spec=normalizeCompilerTimeline(spec);
  validateSpec(spec);
  resetFrameCount();const budget=options.budget,duration=Math.round(spec.duration*40),end=duration+20;
  if(duration<1)throw new Error('arc duration must cover at least one frame');
  if(budget<=2*(end+1))throw new Error('arc budget must cover two complete replays and construction work');
  try{
  const ctx=createArcCompileContext(spec,seed,options);
  const {frames,impactTargets,gaps,planned,start,contacts,hasFragments,lineage,work,memoryFor,futureFeatures,reportFor}=ctx;
  const {prefixes,memoContexts,prefixKey,observers,observerFor}=lineage;
  const addArc=lineage.add,detachArc=lineage.detach,rebuildArc=lineage.rebuild;
  const {budgetInterruptions,planningDecisions,lookaheadStats,transitionRevisionWork,fragmentStats,coupledIntervalWork,observedReceiverWork,
    opposingEntryWork,initialProposalWork,initializationRecovery,constructionImprovement,qualityRetries}=work;
  let engine:any=rebuildArc([]);
  const lines:TrackLine[]=[],rows:any[]=[],steps:any[]=[];let failure:any=null;
  let pendingControl:{index:number;control:ArcMotionControl}|null=null;
  let deepestPrefix={lines:[] as TrackLine[],rows:[] as any[]};
  const backtrack=()=>{
    // Save completed intervals before destructively walking to an earlier fork.
    if(rows.length>deepestPrefix.rows.length)deepestPrefix={lines:lines.slice(),rows:rows.slice()};
    pendingControl=null;
    while(steps.length>0){
      const step=steps.pop(),old=rows.pop();lines.length=step.lineStart;
      if(!step.choices.length)continue;
      const choice=step.choices.shift();
      lines.push(...choice.lines);
      disposeSearch();engine=rebuildArc(lines);
      rows.push({...old,...choice.meta,control:choice.c,cost:choice.cost,spent:getPhysicsFrameCount()});steps.push(step);work.backtracks++;
      if(options.reuseContinuations&&choice.futureControl)pendingControl={index:rows.length,control:choice.futureControl};
      return rows.length-1;
    }
    return null;
  };
  setPhysicsFrameLimit(budget-2*(end+1));
  if(options.sectionStyles){
    if(typeof options.sectionStyles!=='object'||Array.isArray(options.sectionStyles))throw new Error('invalid section styles');
    for(const [key,style] of Object.entries(options.sectionStyles)){
      const index=Number(key);
      if(!Number.isSafeInteger(index)||String(index)!==key||index<0||index>=contacts.length||
        !style||typeof style!=='object'||Array.isArray(style)||Object.keys(style).some(k=>!['guides','faces','profile','profileStrength','profileStart','rippleCycles','foldAngle','railLayout','independentGuide'].includes(k))||
        (style.railLayout!==undefined&&!['paired','transfer'].includes(style.railLayout))||
        (style.independentGuide!==undefined&&typeof style.independentGuide!=='boolean')||
        (style.guides!==undefined&&typeof style.guides!=='boolean')||
        !validProfileControls({...options,...style}))
        throw new Error('invalid section style');
      arcMainSteps(1,undefined,style.faces??options.faces);
    }
  }
  try{
    const compileOptions=options;
    // A selected continuation must carry its own measured residuals and motion,
    // not inherit those of the previously preferred local geometry. Engine
    // wrappers are rebuilt separately because search cleanup can free them.
    const restoreCandidate=(candidate:any,child:Engine)=>({...candidate.measurement,child,
      lines:candidate.lines,c:candidate.c,cost:candidate.cost,localCost:candidate.localCost});
    const searchInterval=(engine:Engine,i:number,overrides:Partial<ArcMotionOptions>={},protectedEngines:Engine[]=[])=>
      searchArcInterval(ctx,engine,i,overrides,protectedEngines);
    const valueRank=(c:any)=>c.predictedFuture===undefined?c.cost:c.cost+(options.valueWeight??.5)*(c.localCost+c.predictedFuture-c.cost);
    const distinctArrival=(a:any,b:any)=>Math.abs(a.heading-b.heading)>4||Math.abs(a.endSpeed-b.endSpeed)>.4||
      Math.abs(a.pose-b.pose)>7||Math.abs(a.meta.release-b.meta.release)>2;
    const distinct=(candidates:any[],width:number)=>{
      const result:any[]=[];
      for(const candidate of candidates.slice().sort((a,b)=>valueRank(a)-valueRank(b))){
        if(result.every(a=>distinctArrival(a,candidate)))result.push(candidate);
        if(result.length>=width)break;
      }
      return result;
    };
    const continuationGuidance=Math.min(12,options.guidanceSamples??48);
    const continuation=(base:Engine,index:number,depth:number,probeSamples:number,protectedEngines:Engine[]):any=>{
      const searched=searchInterval(base,index,{samples:probeSamples,
        guidanceSamples:continuationGuidance,
        responseSamples:options.responseSamples},protectedEngines);
      lookaheadStats.continuationNodes++;
      if(!searched?.best)return null;
      const anchor=searched.best;
      if(depth<=1||index+1>=contacts.length){
        // A leaf has an exactly simulated local interval and unresolved future
        // work. Blend its heuristic arrival prior with the learned future loss.
        // Completed timelines have no remaining value to predict.
        if((options.continuationValueWeight??0)>0&&index+1<contacts.length&&options.futureValueModel){
          const weight=options.continuationValueWeight!;
          let winner:any=null;
          for(const candidate of searched.candidates){
            const value=candidate.predictedFuture===undefined?candidate.cost:
              candidate.cost+weight*(candidate.localCost+candidate.predictedFuture-candidate.cost);
            if(!winner||value<winner.value)winner={value,localValue:candidate.localCost,control:candidate.c,depth:1};
          }
          if(winner)return winner;
        }
        return{value:anchor.cost,localValue:anchor.localCost,control:anchor.c,depth:1};
      }
      let winner:any=null, completed=0;
      try {
      for(const candidate of distinct(searched.candidates,2)){
        const branch=addArc(base,candidate.lines);
        const tail=continuation(branch,index+1,depth-1,probeSamples,[...protectedEngines,base,anchor.child]);
        if(tail){
          completed++;
          const value=candidate.localCost+tail.value;
          if(!winner||value<winner.value)winner={value,localValue:value,control:candidate.c,depth:1+tail.depth};
        }
        Engine.retainOnly([...protectedEngines,base,anchor.child]);
      }
      } catch(error) {
        if(!(error instanceof PhysicsFrameLimitExceeded))throw error;
        work.searchBudgetExhausted=true;
        budgetInterruptions.push({phase:'continuation',index,frame:contacts[index].frame,viable:completed,retained:!!winner});
        Engine.retainOnly([...protectedEngines,base,anchor.child]);
        // A completed branch remains usable when exploration of a sibling stops.
        // Without one, propagate the interruption instead of inventing a horizon.
        if(!winner)throw error;
      }
      return winner??(options.strictHorizon?null:{value:anchor.cost,localValue:anchor.localCost,control:anchor.c,depth:1});
    };
    for(let i=0;i<contacts.length;i++){
      let terminalChildLines:TrackLine[]|null=null;
      const localStart=getPhysicsFrameCount();
      const overrides:Partial<ArcMotionOptions>=pendingControl?.index===i?{warmStart:pendingControl.control}:{};
      // Normalize the observed rate back to the full local allocation, so an
      // emergency reduction does not falsely make later full searches look cheap.
      let localScale=1;
      if(options.budgetAdaptiveLocal){
        const nominal=(options.samples??160)+(options.guidance?options.guidanceSamples??48:0);
        const remaining=Math.max(1,end-contacts[i].frame),available=(budget-getPhysicsFrameCount()-2*(end+1))/remaining;
        localScale=clamp(available/(Math.max(nominal*.7,work.observedConstructionRate||nominal)*1.1),.05,1);
        overrides.samples=Math.max(12,Math.floor((options.samples??160)*localScale));
        overrides.guidanceSamples=Math.floor((options.guidanceSamples??48)*localScale);
        overrides.responseSamples=Math.floor((options.responseSamples??0)*localScale);
      }
      let interval=searchInterval(engine,i,overrides);
      if(interval){const rate=(getPhysicsFrameCount()-localStart)/Math.max(1,interval.next-interval.frame)/localScale;work.observedConstructionRate=work.observedConstructionRate ? .8*work.observedConstructionRate+.2*rate : rate;}
      pendingControl=null;
      if(!interval){failure={frame:contacts[i].frame,reason:'contact_spacing'};break;}
      const previous=steps[i-1];
      if(revision&&revision.width>0&&i>0&&interval.best&&previous?.selected&&previous.choices.length){
        const measured=interval.best,target=interval.targets;
        const errors=['air','speed','amplitude'].flatMap(key=>target[key as keyof typeof target]===undefined?[]:
          [measured.achieved[key]-target[key as keyof typeof target]!]);
        const impact=interval.gap>=0?gaps[interval.gap].targets.impact:undefined;
        if(impact!==undefined&&measured.actualImpact!==undefined)errors.push(measured.actualImpact-impact);
        const error=Math.sqrt(errors.reduce((n,v)=>n+v*v,0)/Math.max(1,errors.length));
        const reserve=(end-interval.frame)*Math.max((options.samples??160)+(options.guidanceSamples??0),work.observedConstructionRate);
        const estimate=interval.frame+(interval.next-interval.frame)*(revision.samples+revision.guidanceSamples+96);
        if(error>revision.errorThreshold&&getPhysicsFrameCount()+estimate+reserve<budget-2*(end+1)){
          const began=getPhysicsFrameCount(),original=interval,base=rebuildArc(lines.slice(0,previous.lineStart));
          const before=previous.selected.measurement.localCost+measured.cost;
          const record={index:i,error,proposals:0,viable:0,accepted:false,before,after:before,physicsFrames:0};
          let winner:{previous:any;interval:NonNullable<typeof interval>;value:number}|null=null;
          try{
            for(const choice of previous.choices.slice(0,revision.width)){
              if(getPhysicsFrameCount()+estimate+reserve>=budget-2*(end+1))break;
              record.proposals++;
              const branch=addArc(base,choice.lines);
              const trial=searchInterval(branch,i,{samples:revision.samples,guidanceSamples:revision.guidanceSamples,
                responseSamples:revision.responseSamples,initialRecoverySamples:Math.min(64,options.initialRecoverySamples??0),
                warmStart:measured.c,warmIncoming:original.incoming},[engine,measured.child,base]);
              if(trial?.best){
                record.viable++;const value=choice.measurement.localCost+trial.best.cost;
                if(value<(winner?.value??before)-1e-12)winner={previous:choice,interval:trial,value};
              }
              // Keep only engine-free measurements of alternatives. A winner is
              // rebuilt below; all repeat simulation remains on the shared meter.
              Engine.retainOnly([engine,measured.child,base]);
            }
          }catch(error){
            if(!(error instanceof PhysicsFrameLimitExceeded))throw error;
            work.searchBudgetExhausted=true;
            budgetInterruptions.push({phase:'revision',index:i,frame:interval.frame,viable:record.viable,retained:true});
          }
          if(winner){
            const selected=winner.previous,branch=addArc(base,selected.lines),revised=winner.interval;
            revised.best={...revised.best,child:addArc(branch,revised.best.lines)};
            lines.splice(previous.lineStart,lines.length-previous.lineStart,...selected.lines);
            rows[i-1]={...rows[i-1],control:selected.c,cost:selected.cost,...selected.meta,lookahead:null};
            previous.choices=[previous.selected,...previous.choices.filter((c:any)=>c!==selected)];previous.selected=selected;
            engine=branch;interval=revised;record.accepted=true;record.after=winner.value;
          }
          Engine.retainOnly([engine,interval.best.child]);
          record.physicsFrames=getPhysicsFrameCount()-began;transitionRevisionWork.push(record);
        }
      }
      let {best}=interval;
      const {candidates,failures,frame,next,horizon,gap,outgoing,targets,incoming,pace,center,support}=interval;
      let lookahead:any=null;
      if(best&&(options.lookaheadWidth??0)>1&&i+1<contacts.length){
        let width=options.lookaheadWidth!, probeSamples=options.lookaheadSamples??32,depth=1;
        // Estimated evaluations per continuation sample, counting its local correction.
        const probeRate=1.4;
        const nominalRate=(options.samples??160)+(options.guidance?options.guidanceSamples??48:0);
        const constructionReserveRate=(options.adaptivePlanning?Math.max(nominalRate,work.observedConstructionRate):nominalRate)*(options.reserveFactor??1.1);
        if(options.adaptivePlanning){
          const remaining=Math.max(1,end-frame),rate=(budget-getPhysicsFrameCount()-2*(end+1))/remaining;
          const localAllowance=Math.max(0,rate-constructionReserveRate)*(next-frame);
          for(let d=Math.min(2,contacts.length-i-1);d>=1;d--){
            let framesPerProbe=0;
            for(let k=0;k<d;k++)framesPerProbe+=Math.pow(2,k)*((contacts[i+k+2]?.frame??end+1)-contacts[i+k+1].frame)*probeRate;
            const affordable=localAllowance/Math.max(1,framesPerProbe);
            if(affordable<width*probeSamples)continue;
            width=Math.max(width,Math.min(5,Math.floor(affordable/probeSamples)));
            probeSamples=Math.max(probeSamples,Math.min(48,Math.floor(affordable/width)));
            depth=d;break;
          }
          planningDecisions.push({index:i,frame,observedConstructionRate:work.observedConstructionRate,constructionReserveRate,localAllowance,width,probeSamples,depth});
        }
        let shortlist=distinct(candidates,options.reuseContinuations?Math.max(12,width):width);
        if(options.futureValueModel){const original=candidates.find(c=>JSON.stringify(c.c)===JSON.stringify(best.c));if(original)shortlist=[original,...shortlist.filter(c=>c!==original)];}
        const original=best, startFrames=getPhysicsFrameCount(), probes:any[]=[];
        let winner:any=null;
        try {
        for(const candidate of shortlist){
          if(probes.length>=width&&winner)break;
          const reserve=options.adaptivePlanning?(end-frame)*constructionReserveRate:(end-frame)*nominalRate*(options.reserveFactor??1.1);
          let probeAllowance=0;
          for(let d=0;d<depth&&i+d+1<contacts.length;d++)probeAllowance+=Math.pow(2,d)*((contacts[i+d+2]?.frame??end+1)-contacts[i+d+1].frame)*probeSamples*probeRate;
          if(getPhysicsFrameCount()+reserve+probeAllowance>budget-2*(end+1))break;
          const branch=addArc(engine,candidate.lines);
          const future=continuation(branch,i+1,depth,probeSamples,[engine,original.child]);
          lookaheadStats.probes++;
          if(!future)lookaheadStats.failedProbes++;
          lookaheadStats.maxDepth=Math.max(lookaheadStats.maxDepth,future?.depth??0);
          const terminal=options.lookaheadObjective==='terminal'||depth>1;
          let value=future?(terminal?candidate.localCost:candidate.cost)+(terminal?future.value:future.localValue):Infinity;
          if(options.reuseContinuations){candidate.lookaheadValue=value;candidate.futureControl=future?.control;}
          probes.push({control:candidate.c,currentCost:candidate.cost,localCost:candidate.localCost,futureCost:future?.value??null,depth:future?.depth??0,value:Number.isFinite(value)?value:null,predictedFuture:candidate.predictedFuture});
          if(future&&(!winner||value<winner.value))winner={candidate,value,futureControl:future.control};
          Engine.retainOnly([engine,original.child]);
        }
        } catch(error) {
          if(!(error instanceof PhysicsFrameLimitExceeded))throw error;
          work.searchBudgetExhausted=true;
          budgetInterruptions.push({phase:'planning',index:i,frame,viable:probes.length,retained:true});
          Engine.retainOnly([engine,original.child]);
        }
        if(winner&&JSON.stringify(winner.candidate.c)!==JSON.stringify(original.c)){
          const c=winner.candidate;
          best=restoreCandidate(c,addArc(engine,c.lines));
          lookaheadStats.changedChoices++;
        }
        if(winner)pendingControl={index:i+1,control:winner.futureControl};
        lookaheadStats.physicsFrames+=getPhysicsFrameCount()-startFrames;
        lookahead={probes,selected:winner?.candidate.c??original.c};
      }
      if(best&&pendingControl?.index===i+1&&(options.coupledIntervalSamples??0)>0){
        const original=best,initialNext=pendingControl.control;
        const remaining=Math.max(1,end-frame),reserve=remaining*Math.max((options.samples??160)+(options.guidanceSamples??0),work.observedConstructionRate);
        const estimated=(options.coupledIntervalSamples!+1)*Math.max(1,(contacts[i+2]?.frame??end+1)-frame);
        if(getPhysicsFrameCount()+reserve+estimated<budget-2*(end+1)){
          const styles=[i,i+1].map(index=>({...options,...options.sectionStyles?.[index]}));
          const initialControls=[original.c,initialNext] as ArcMotionControl[];
          const dimensions=initialControls.flatMap((c,which)=>arcMethodKeys('response',!!options.expressive,false,styles[which].guides,
            {...styles[which],observedReceiver:!!options.observedReceiver&&c.receiverFlight!==undefined}).map(key=>({which,key})));
          const coordinates=(controls:ArcMotionControl[])=>dimensions.map(({which,key})=>arcControlValue(controls[which],key,options.channel));
          const scales=dimensions.map(({which,key})=>arcControlStep(key,'response',initialControls[which].support));
          const began=getPhysicsFrameCount();let winner:any=null;
          const record={index:i,proposals:0,viable:0,accepted:0,physicsFrames:0,before:Infinity,after:Infinity};
          const measure=(values:number[],unchanged?:ArcMotionControl[]):PairMeasurement<any>|null=>{
            record.proposals++;
            const controls=unchanged??initialControls.map(c=>({...c}));if(!unchanged)dimensions.forEach(({which,key},d)=>controls[which][key]=values[d]);
            try{
              const a=searchInterval(engine,i,{directControls:[controls[0]]},[engine,original.child]);
              if(!a?.best)return null;
              const b=searchInterval(a.best.child,i+1,{directControls:[controls[1]]},[engine,original.child,a.best.child]);
              if(!b?.best)return null;
              // The second interval replaces the first interval's incomplete
              // outgoing span. Keep impact, previous-boundary and motion terms;
              // include only the final interval's arrival prior.
              const residuals=[...a.best.localResiduals.slice(3),...b.best.localResiduals,...b.best.arrivalResiduals];
              const measured={coordinates:coordinates([a.best.c,b.best.c]),residuals,
                value:a.best.localCost+b.best.cost,payload:{root:a.best,candidate:a.candidates.find(c=>JSON.stringify(c.c)===JSON.stringify(a.best.c)),next:b.best.c}};
              record.viable++;
              if(!winner||measured.value<winner.value-1e-12){winner=measured;record.accepted++;}
              return measured;
            }finally{Engine.retainOnly([engine,original.child]);}
          };
          try{
            const initial=measure(coordinates(initialControls),initialControls);
            if(initial){
              record.before=initial.value;record.accepted=0;
              refineArcPair(initial,scales,options.coupledIntervalSamples!,measure);
              record.after=winner.value;
              if(winner.value<initial.value-1e-12){
                const {root,candidate,next}=winner.payload;
                candidates.push(candidate);best={...root,child:addArc(engine,root.lines)};
                pendingControl={index:i+1,control:next};
              }
            }
          }catch(error){
            if(!(error instanceof PhysicsFrameLimitExceeded))throw error;
            work.searchBudgetExhausted=true;Engine.retainOnly([engine,original.child]);
          }finally{record.physicsFrames=getPhysicsFrameCount()-began;coupledIntervalWork.push(record);}
        }
      }
      // A quality retry resumes at an earlier fork and rebuilds its engine.
      // Estimate from that boundary, including its cold prefix, rather than
      // granting a retry using only the shorter suffix at the current contact.
      let retryIndex=steps.length-1;
      while(retryIndex>=0&&!steps[retryIndex].choices.length)retryIndex--;
      const retryFrame=retryIndex<0?frame:rows[retryIndex].frame;
      if(best&&(options.qualityRetries??0)>0&&targets.speed!==undefined&&Math.abs(best.achieved.speed-targets.speed)>.3&&
        (qualityRetries.get(frame)??0)<options.qualityRetries!&&getPhysicsFrameCount()+retryFrame+(end-retryFrame)*(options.samples??160)*1.1<budget-2*(end+1)){
        qualityRetries.set(frame,(qualityRetries.get(frame)??0)+1);
        const retry=steps.some(s=>s.choices.length)?backtrack():null;if(retry!==null){i=retry;continue;}
      }
      if(!best){failure={frame,reason:'no_arc',failures,incoming,pace,center};const retry=backtrack();if(retry!==null){i=retry;continue;}break;}
      if(options.terminalSelection&&i===contacts.length-1){
        const original=candidates.find(c=>JSON.stringify(c.c)===JSON.stringify(best.c));
        // Infinity is a measured invalid complete trajectory (for example a
        // reconstructed prefix lost an earlier landing), not a missing value.
        // Preserve that failed outcome for the final judge instead of crashing.
        if(!original||candidates.some(c=>typeof c.terminalLoss!=='number'||Number.isNaN(c.terminalLoss)))throw new Error('missing complete-trajectory candidate loss');
        const selected=candidates.reduce((a,b)=>b.terminalLoss<a.terminalLoss-1e-15?b:a,original);
        const changed=selected!==original;
        work.terminalSelectionStats={candidates:candidates.length,initialLoss:original.terminalLoss,finalLoss:selected.terminalLoss,changed};
        if(changed){
          terminalChildLines=selected.lines;
          best=restoreCandidate(selected,best.child);
        }
      }
      failure=null;
      const alternatives:any[]=[];
      const planRank=(c:any)=>c.lookaheadValue===undefined?1:Number.isFinite(c.lookaheadValue)?0:2;
      for(const candidate of candidates.sort((a,b)=>options.reuseContinuations?(planRank(a)-planRank(b)||((a.lookaheadValue??a.cost)-(b.lookaheadValue??b.cost))):a.cost-b.cost)){
        if(alternatives.every(a=>distinctArrival(a,candidate)))alternatives.push(candidate);
        if(alternatives.length>=12)break;
      }
      steps.push({lineStart:lines.length,selected:candidates.find(c=>c.lines===best.lines),choices:alternatives.filter(a=>JSON.stringify(a.c)!==JSON.stringify(best.c))});
      if((options.memorySamples??0)>0&&i>0){
        memoryFor(i).rememberControl({features:interval.inputFeatures,incoming,span:horizon-frame,control:best.c});
      }
      // Incoming features were captured before candidate construction, which
      // can invalidate cached prefix frames even for a validated child.
      if(terminalChildLines)best.child=addArc(engine,terminalChildLines);
      lines.push(...best.lines);engine=detachArc(best.child);Engine.retainOnly([engine]);
      const selectedMeta=candidates.find(c=>c.lines===best.lines)?.meta;
      rows.push({frame,next,incoming,span:interval.span,features:interval.inputFeatures,cost:best.cost,control:best.c,achieved:best.achieved,impact:best.actualImpact,release:best.release,lines:best.lines.length,railGuides:selectedMeta?.railGuides??best.railGuides,
        ...(options.motionQuality?{motion:selectedMeta?.motion??best.motion,motionCost:selectedMeta?.motionCost??best.motionCost}:{}),failures,lookahead,spent:getPhysicsFrameCount()});
    }
    if(!failure&&(options.refineAttempts??0)>0&&rows.length===contacts.length){
      setPhysicsFrameLimit(budget-2*(end+1));
      const requests=Object.values(options.constructionRequests??{});
      const validate=requests.length?(candidate:Engine,geometry:TrackLine[],raw:any,candidateRows:any[])=>requests.every(request=>{
        const section=geometry.filter(l=>Math.floor((l.id-1000)/10000)===request.section);
        const guideIds=request.construction==='scattered'?candidateRows[request.section]?.railGuides??[]:(arcRailGroups(section).get(request.section)?.[1]??[]).map(l=>l.id);
        return inspectConstructionWindow(request,section,new Set<number>(guideIds),raw.frames,
          request.context||request.railLayout==='transfer'?(frame:number)=>candidate.getAllContactLineIdsAtFrame(frame):undefined).fulfilled;
      }):undefined;
      const objective=options.wholeTrackRefinement?(raw:any,report:any,candidate:Engine)=>{
        const physical=options.impactContract?impactFrames(candidate,raw.frames):undefined;
        const impacts=physical?evaluateMusicalImpacts(physical,impactTargets,duration,report.terminus.reason==='endOfSpec'):undefined;
        const whole=arcWholeTrajectoryObjective(raw,report,gaps,options.amplitudeWeight,impacts);
        if(physical&&Number.isFinite(whole.loss))for(const request of requests){
          const extra=engagementGainResiduals(physical,request.frame,request.next-1,options.impactSearch).reduce((n,v)=>n+v*v,0)/contacts.length;
          whole.loss+=extra;whole.regrets[request.section]+=extra;
        }
        if(options.motionQuality&&Number.isFinite(whole.loss)){
          const observed=motionSamples(raw.frames,1,duration);
          for(const request of requests){
            const samples=observed.filter(s=>s.frame>=request.frame&&s.frame<request.next);
            if(!samples.length)continue;
            const impact=request.context?.impact??(request.section?gaps[request.section-1]?.targets.impact:request.context?.nextImpact)??undefined;
            const extra=motionResiduals(intervalMotionSummary(observed,request.frame,request.next-1),impact,options.motionQuality).reduce((n,v)=>n+v*v,0)/contacts.length;
            whole.loss+=extra;whole.regrets[request.section]+=extra;
          }
        }
        return whole;
      }:undefined;
      const refined=refineArcTrack({engine,lines,rows,alternatives:steps.map(s=>s.choices),contacts,end,start,budget:budget,options,search:searchInterval,report:reportFor,
        objective,validate,engines:requests.length?{create:rebuildArc,add:addArc,detach:detachArc}:undefined});
      lines.splice(0,lines.length,...refined.lines);rows.splice(0,rows.length,...refined.rows);
      engine=refined.engine;work.refinementStats=refined.stats;
    }
  }catch(error){if(!(error instanceof PhysicsFrameLimitExceeded))throw error;work.searchBudgetExhausted=true;failure={reason:'budget'};}
  return finalizeArcTrack(ctx,{lines,rows,failure,deepestPrefix});
  }finally{disposeSearch();disposeJudge();setPhysicsFrameLimit(null);}
}
