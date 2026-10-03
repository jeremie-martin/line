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
import { arcAttemptTelemetry } from './arc_attempts.ts';
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
// The frozen judge wrapper has an isolate-wide handle registry, not individual
// disposal. A private module instance gives replay its own WASM instance and
// registry without changing judge code or freeing engines retained by callers.
// Keep these handles local to the synchronous replay and dispose them below.
const {LineRiderEngine:Judge,disposeAllWasmEnginesForStudy:disposeJudge} =
  await import(new URL('../../lib/_lr_engine_wasm.ts?arc-compiler-replay',import.meta.url).href);
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
  const frames=spec.contacts.map(c=>Math.round(c.t*40));
  const impactTargets=spec.contacts.map((c,i)=>({frame:frames[i],impact:c.impact}));
  const gaps=sliceTimeline(frames,duration);
  for(const g of gaps){g.targets=effectiveAxes(g,spec);if(g.endsWithContact&&spec.contacts[g.index].impact!==undefined)g.targets.impact=spec.contacts[g.index].impact;}
  const rng=makeRng(seed);
  const preparation=options.impactPreparationFrames??0;
  const planned=scheduleNativeContacts(gaps.map(g=>({...g,
    startFrame:g.startFrame?g.startFrame-preparation:0,endFrame:g.endsWithContact?g.endFrame-preparation:g.endFrame,
    targets:{...g.targets,...sampleGapTargets(g.targets,spec.jitter??CALIB.SIGMA,rng)}})));
  const fixed=spec.start||(spec.preroll??PREROLL.DEFAULT_S)<=0?resolveStartState(spec):null;
  const speed=authoredSpeedToPx(gaps[0].targets.speed??.55);
  const pitch=rad(8.59436692696);
  const start=fixed??{position:{x:0,y:0},velocity:{x:speed*Math.cos(pitch),y:speed*Math.sin(pitch)}};

  type Prefix={parent?:Prefix;lines?:TrackLine[];key?:string};
  const hasFragments=Object.values(options.constructionRequests??{}).some(r=>r.construction==='scattered');
  const trackPrefixes=options.reuseEvaluations||hasFragments;
  const prefixes=new WeakMap<Engine,Prefix>(),rootPrefix:Prefix={key:'root'};
  const memoContexts=new Map<string,Map<string,any>>();
  const prefixKey=(node:Prefix):string=>node.key??=createHash('sha256').update(prefixKey(node.parent!)+'\n'+JSON.stringify(node.lines,(_key,value)=>Object.is(value,-0)?'-0':value)).digest('hex');
  const addArc=(parent:Engine,geometry:TrackLine[])=>{
    const child=parent.addLine(geometry),prefix=prefixes.get(parent);
    if(trackPrefixes&&prefix)prefixes.set(child,{parent:prefix,lines:geometry});
    return child;
  };
  const detachArc=(source:Engine)=>{
    const child=source.detach(),prefix=prefixes.get(source);
    if(prefix)prefixes.set(child,prefix);return child;
  };
  const rebuildArc=(geometry:TrackLine[])=>{
    const result=createArcEngine(start,geometry);
    if(trackPrefixes){
      let prefix=rootPrefix;const groups:TrackLine[][]=[];
      for(const line of geometry){
        const group=Math.floor((line.id-1000)/10000),last=groups.at(-1);
        if(!last||Math.floor((last[0].id-1000)/10000)!==group)groups.push([line]);else last.push(line);
      }
      for(const lines of groups)prefix={parent:prefix,lines};prefixes.set(result,prefix);
    }
    return result;
  };
  // Share immutable observed prefixes across intervals and search branches.
  // No whole source ride or repeated suffix is needed to build scattered contacts.
  const observers=new WeakMap<Prefix,any>();
  if(hasFragments)observers.set(rootPrefix,contactObserver(start));
  const observerFor=(engine:Engine)=>{
    const prefix=prefixes.get(engine);if(!prefix)throw new Error('contact construction requires physical prefix lineage');
    const missing:Prefix[]=[];let current=prefix;
    while(!observers.has(current)){missing.push(current);if(!current.parent)throw new Error('missing contact observer root');current=current.parent;}
    let observer=observers.get(current);
    for(const p of missing.reverse()){observer=extendContactObserver(observer,p.lines!);observers.set(p,observer);}
    return observer;
  };
  let engine:any=rebuildArc([]);
  const lines:TrackLine[]=[],rows:any[]=[],steps:any[]=[];let failure:any=null,raw:any=null;let backtracks=0;
  let samples=0,viableCandidates=0,memoHits=0,memoRejectedHits=0;const qualityRetries=new Map<number,number>();
  let refinementStats:any=null, terminalSelectionStats:any=null, observedConstructionRate=0;
  let searchBudgetExhausted=false;
  const budgetInterruptions:Array<{phase:'local'|'planning'|'continuation'|'revision';index:number;frame:number;viable:number;retained:boolean}>=[];
  const planningDecisions:any[]=[];
  const reportFor=(trajectory:any,geometry:TrackLine[])=>buildDriftReport(detect(trajectory),spec,gaps,frames,duration,[],gaps.map(g=>({lines:geometry.filter(l=>Math.floor((l.id-1000)/10000)===g.index+1)})) as any,gaps.map(g=>g.targets));
  const lookaheadStats={probes:0,changedChoices:0,failedProbes:0,physicsFrames:0,continuationNodes:0,maxDepth:0};
  const transitionRevisionWork:Array<{index:number;error:number;proposals:number;viable:number;accepted:boolean;before:number;after:number;physicsFrames:number}>=[];
  const fragmentStats={intervals:0,probes:0,observationFrames:0,replayFrames:0};
  const coupledIntervalWork:Array<{index:number;proposals:number;viable:number;accepted:number;physicsFrames:number;before:number;after:number}>=[];
  const observedReceiverWork={attempts:0,viable:0,physicsFrames:0,failures:{} as Record<string,number>};
  const opposingEntryWork={attempts:0,viable:0,physicsFrames:0,failures:{} as Record<string,number>};
  const initialProposalWork=Object.fromEntries(['center','learned','memory','response','generic','compactFold','compactProfile'].map(k=>[k,{attempts:0,viable:0,physicsFrames:0}]));
  const initializationRecovery:Array<{index:number;frame:number;proposals:number;viable:number;physicalFrames:number}>=[];
  const constructionImprovement:Array<{index:number;frame:number;proposals:number;viable:number;physicalFrames:number;before:number|null;after:number|null}>=[];
  const controlMemory=new ArcControlMemory(),constructionMemories=new Map<string,ArcControlMemory>();
  const memoryFor=(index:number)=>{
    if(options.memoryScope!=='construction')return controlMemory;
    const style={...options,...options.sectionStyles?.[index]};
    const key=arcConstructionMemoryKey(style);
    let memory=constructionMemories.get(key);if(!memory){
      memory=new ArcControlMemory();
      for(const example of options.constructionExamples?.[key]??[])memory.rememberControl(example);
      constructionMemories.set(key,memory);
    }return memory;
  };
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
      rows.push({...old,...choice.meta,control:choice.c,cost:choice.cost,spent:getPhysicsFrameCount()});steps.push(step);backtracks++;
      if(options.reuseContinuations&&choice.futureControl)pendingControl={index:rows.length,control:choice.futureControl};
      return rows.length-1;
    }
    return null;
  };
  setPhysicsFrameLimit(budget-2*(end+1));
  const contacts=[{frame:1,gap:-1},...planned.filter(g=>g.endsWithContact).map(g=>({frame:g.endFrame,gap:g.index}))];
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
    const futureFeatures=(arrival:number[],i:number,count=2)=>{
      const features=[...arrival];
      for(let k=1;k<=count;k++){
        const contact=contacts[i+k],target=contact?planned.find(g=>g.startFrame===contact.frame)?.targets:undefined;
        features.push(contact?((contacts[i+k+1]?.frame??end+1)-contact.frame)/40:0,contact?(gaps[contact.gap]?.targets.impact??-1):-1,target?.air??-1,target?.speed??-1,target?.amplitude??-1);
      }
      return features;
    };
    // A selected continuation must carry its own measured residuals and motion,
    // not inherit those of the previously preferred local geometry. Engine
    // wrappers are rebuilt separately because search cleanup can free them.
    const restoreCandidate=(candidate:any,child:Engine)=>({...candidate.measurement,child,
      lines:candidate.lines,c:candidate.c,cost:candidate.cost,localCost:candidate.localCost});
    const searchInterval=(engine:Engine,i:number,overrides:Partial<ArcMotionOptions>={},protectedEngines:Engine[]=[])=>{
      const options={...compileOptions,...overrides,...compileOptions.sectionStyles?.[i]};
      const constructionPolicy=i>0?options.constructionPolicies?.[arcConstructionMemoryKey(options)]:undefined;
      if(constructionPolicy)options.controlPolicy=constructionPolicy;
      const nextRequest=options.constructionRequests?.[i+1];
      if(options.constructionAwareArrival&&nextRequest&&(nextRequest.context?.quiet??0)<.5&&(nextRequest.guidance==='forbidden'||nextRequest.railLayout==='transfer')){
        options.futureValueModel=undefined;
        if(options.arrivalMode!=='kinetic')options.arrivalMode='passive';options.headingWeight=0;
      }
      const controlMemory=memoryFor(i);
      const {frame,gap}=contacts[i],next=contacts[i+1]?.frame??end+1,horizon=next-1;
      if(horizon<=frame+2)return null;
      const outgoing=planned.find(g=>g.startFrame===(i===0?0:frame))??{index:gaps.length,startFrame:frame,endFrame:horizon,endsWithContact:false,targets:{}};
      const targets=outgoing.targets;
      const objectiveEnd=options.authoredHorizon?Math.min(horizon,duration):horizon;
      const beforeState=getRiderMetered(engine,frame-1).ballisticState(),before=JSON.stringify(beforeState);
      const free=getRiderMetered(engine,frame),velocity=free.velocity;
      engine.prepareCollisionTrace(frame);getRiderMetered(engine,frame);
      const trace=engine.readCollisionTrace()[0];
      const points=['PEG','TAIL','NOSE','STRING'].map(key=>trace[key]);
      const prefixRaw=options.cachePrefixReads||options.impactContract?extractRawTrajectory(engine,frame-1):null;
      const prefixImpactFrames=options.impactContract?impactFrames(engine,prefixRaw!.frames,beforeState):undefined;
      const impactPrefix=prefixImpactFrames?contactImpactPrefix(prefixImpactFrames):undefined;
      const localImpactTargets=options.impactContract?impactTargets.filter(t=>t.frame>=frame-CONTACT_IMPACT_CONTRACT.matchFrames&&t.frame<=horizon+CONTACT_IMPACT_CONTRACT.matchFrames):[];
      const currentImpactTarget=localImpactTargets.findIndex(t=>t===impactTargets[gap]);
      const incoming=deg(Math.atan2(velocity.y,velocity.x)),pace=Math.hypot(velocity.x,velocity.y);
      // A final authored contact can have no scored tail. Its support still
      // needs room to realize the impact and survive the unscored grace.
      const span=objectiveEnd>frame||i===0?objectiveEnd-(i===0?0:frame):horizon-frame;
      // The authored objective ends with the music; the final construction still
      // has the existing physical survival horizon. Do not clamp a requested
      // shape to two frames just because its last impact is near the song end.
      const constructionSpan=options.constructionRequests&&i===contacts.length-1?horizon-frame:span;
      const releaseFrames=options.impactSearch?.releaseFrames??6;
      const support=clamp((1-(targets.air??.5))*(constructionSpan+1),3,Math.max(3,constructionSpan-releaseFrames));
      const impact=gap>=0?gaps[gap].targets.impact:undefined;
      if(impact!==undefined&&options.motionQuality?.calmImpactMultiplier!==undefined)
        options.impactWeight=(options.impactWeight??2)*(1+(options.motionQuality.calmImpactMultiplier-1)*Math.max(0,1-impact/.2));
      const turn=impact===undefined?5:deg(impactToRawPx(impact)/Math.max(3,pace));
      let best:any=null;const candidates:any[]=[];const failures:Record<string,number>={};
      type Near={c:ArcMotionControl;deficit:number};
      const near:Near[]=[];
      const rememberNear=(candidate:Near)=>{
        const similar=near.findIndex(n=>arcControlsSimilar(n.c,candidate.c));
        if(similar>=0){if(near[similar].deficit<=candidate.deficit)return;near.splice(similar,1);}
        near.push(candidate);near.sort((a,b)=>a.deficit-b.deficit);near.length=Math.min(near.length,12);
      };

      let memo=options.memoCandidates?new Map<string,any>():null;
      const prefix=prefixes.get(engine);
      if(options.reuseEvaluations&&prefix&&!options.arrivalReference&&(!options.futureValueModel||options.futureValueModel===compileOptions.futureValueModel)){
        const context=prefixKey(prefix)+'|'+JSON.stringify([i,options.channel,options.radius,options.faces,options.profile,options.profileStrength,options.profileStart,options.rippleCycles,options.foldAngle,options.guides,options.railLayout,options.independentGuide,
          options.amplitudeWeight,options.impactWeight,options.arrivalWeight,options.arrivalMode,options.headingWeight,options.completeBoundary,options.authoredHorizon,options.amplitudeOverflow,options.terminalSelection,options.valueGuidanceWeight,options.constructionRequests?.[i],options.motionQuality,options.impactContract,options.impactSearch,!!options.futureValueModel,!!options.observedReceiver]);
        const saved=memoContexts.get(context);
        if(saved){memo=saved;memoContexts.delete(context);}else memo=new Map();
        memoContexts.set(context,memo!);
        while(memoContexts.size>32)memoContexts.delete(memoContexts.keys().next().value!);
      }
      const objectiveAxes=(det:ReturnType<typeof detect>,g:typeof gaps[number],rangeEnd:number)=>{
        const axes=measureGapAxes(det,g,[],rangeEnd);
        if(options.amplitudeOverflow&&g.targets.amplitude!==undefined&&axes.amplitude===1){
          const rawAmplitude=measureAmplitudePeakPx(det,g,rangeEnd)!/CALIB.AMPLITUDE_CAP;
          axes.amplitude=options.amplitudeOverflow==='raw'?rawAmplitude:1+Math.log(rawAmplitude);
        }
        return axes;
      };
      const priorGap=i>0?gaps[contacts[i].gap]:undefined;
      const priorAxes=options.completeBoundary&&priorGap
        ?objectiveAxes(detect(prefixRaw??extractRawTrajectory(engine,frame-1)),priorGap,frame-1):undefined;
      const priorLoss=priorAxes&&priorGap?arcSpanLoss(priorAxes,priorGap.targets,options.amplitudeWeight??1):0;
      const controlContext={...options,span:constructionSpan,releaseReserveFrames:options.impactSearch?.releaseFrames};
      const evaluateCandidate=(c:ArcMotionControl,fragments?:{lines:TrackLine[];guideIds:number[]})=>{
        c=normalizeArcControl(c,controlContext);
        const key=memo?arcControlMemoKey(c,options.channel)+(fragments?'|fragments':''):'';
        samples++;
        const saved=memo?.get(key);
        if(saved){
          memoHits++;
          if(saved.reason){if(saved.near)rememberNear(saved.near);memoRejectedHits++;failures[saved.reason]=(failures[saved.reason]??0)+1;return null;}
          viableCandidates++;candidates.push({...saved.candidate,c});
          // Never reuse saved wrappers: retainOnly may already have freed them.
          // Rebuild from validated geometry; subsequent simulations stay metered.
          // A measurement from an earlier search must compete in this search.
          const result={...saved.result,c,child:addArc(engine,saved.result.lines)};
          if(!best||result.optimizationCost<best.optimizationCost)best=result;
          return result;
        }
        const reject=(reason:string,near?:Near)=>{if(options.observedReceiver&&c.receiverFlight!==undefined)observedReceiverWork.failures[reason]=(observedReceiverWork.failures[reason]??0)+1;memo?.set(key,{reason,near});failures[reason]=(failures[reason]??0)+1;return null;};
        let added:TrackLine[],child:Engine;
        if(options.observedReceiver&&c.receiverFlight!==undefined&&options.railLayout==='transfer'&&!fragments){
          const main=motionArc(points,velocity,c,1000+i*10000,false,options.channel,false,options.radius,undefined,{...options,guides:false});
          const supportEngine=addArc(engine,main),id=Math.max(...main.map(l=>l.id))+1;
          const receiver=observedReceiver(supportEngine,main,frame,Math.min(horizon,duration),c,id,options,i===contacts.length-1);
          if(!receiver)return reject('receiver_no_window');
          added=[...main,...receiver.guide];child=addArc(supportEngine,receiver.guide);
          const parent=prefixes.get(engine);if(parent)prefixes.set(child,{parent,lines:added});
        }else{
          const receivers=c.contactSide===-1?Object.values(trace):points;
          added=fragments?.lines??motionArc(receivers,velocity,c,1000+i*10000,false,options.channel,false,options.radius,undefined,options);
          child=addArc(engine,added);
        }
        if(!added.length)return null;
        const prefixReusable=prefixRaw&&child.getLastFrameIndex()>=frame-1;
        if(added.length>=10000)throw new Error('arc geometry id range exhausted');
        if(JSON.stringify(getRiderMetered(child,frame-1).ballisticState())!==before)return reject('prefix');
        const state=getRiderMetered(child,horizon).ballisticState();
        if(!state.riderMounted||!state.sledIntact)return reject('binding');
        const raw=prefixReusable?{duration:horizon,frames:[...prefixRaw!.frames,...extractRawTrajectoryWindow(child,frame,horizon).frames]}:extractRawTrajectory(child,horizon),det=detect(raw);
        if(det.terminus.reason!=='endOfSpec')return reject(det.terminus.reason);
        if(!options.impactContract&&i>0&&!findAuthoredContactNearFrame(det,frame,1,frame-contacts[i-1].frame))return reject('missed');
        if(i===0&&!raw.frames.slice(1,4).some(f=>f.sledContacts.length))return reject('startup');
        if(!options.impactContract&&det.events.some(e=>e.type==='landing'&&!frames.some(f=>Math.abs(e.frame-f)<=1)))return reject('offbeat');
        if(i<contacts.length-1&&releaseFrames>0&&!raw.frames.slice(-releaseFrames).every(f=>f.sledContacts.length===0))return reject('late_release');
        const observedImpacts=options.impactContract?impactFrames(child,raw.frames.slice(frame),state):undefined;
        const impactEvents=observedImpacts?continueContactImpacts(impactPrefix!,observedImpacts)
          .filter(e=>e.onset>=frame-CONTACT_IMPACT_CONTRACT.matchFrames&&e.onset<=Math.min(duration,horizon)):undefined;
        const impactAccount=impactEvents?accountContactImpacts(impactEvents,localImpactTargets):undefined;
        const impactMatch=impactAccount?.matches.find(m=>m.target===currentImpactTarget);
        if(options.impactContract&&i>0&&!impactMatch)return reject('missed_impact');
        const request=options.constructionRequests?.[i];
        if(request&&(request.construction==='scattered'?!!fragments:request.guidance==='required'||request.construction!=='arcs')){
          const guideIds=fragments?.guideIds??(arcRailGroups(added).get(i)![1]??[]).map(l=>l.id);
          const allContacts=request.context||request.railLayout==='transfer'?(frame:number)=>child.getAllContactLineIdsAtFrame(frame):undefined;
          const fulfillment=inspectConstructionWindow(request,added,new Set(guideIds),raw.frames,allContacts);
          if(!fulfillment.fulfilled){
            const nearby=options.constructionRecovery?{c,deficit:constructionDeficit(fulfillment)}:undefined;
            const reason='construction:'+fulfillment.reasons.join(',');
            if(nearby)rememberNear(nearby);return reject(reason,nearby);
          }
        }
        const achieved=measureGapAxes(det,{...outgoing,startFrame:i===0?0:frame,endFrame:objectiveEnd},added,objectiveEnd);
        const measuredObjective=options.amplitudeOverflow?objectiveAxes(det,{...outgoing,startFrame:i===0?0:frame},objectiveEnd):achieved;
        const residuals:number[]=['air','speed','amplitude'].map(key=>targets[key as keyof typeof targets]===undefined?0:((measuredObjective as any)[key]-(targets as any)[key])*Math.sqrt(key==='amplitude'?(options.amplitudeWeight??1):1));
        let cost=residuals.reduce((s,x)=>s+x*x,0);
        let actualImpact:number|undefined;
        if(impact!==undefined){actualImpact=impactEvents&&impactMatch?impactEvents[impactMatch.event].strength:measureGapAxes(det,gaps[gap],added,frame).impact;if(actualImpact===undefined)return reject('impact');cost+=(options.impactWeight??2)*(actualImpact-impact)**2;}
        residuals.push(impact===undefined?0:Math.sqrt(options.impactWeight??2)*(actualImpact!-impact));
        if(impactEvents&&impactAccount){
          const extra=impactSearchResiduals(impactEvents,impactAccount,currentImpactTarget<0?undefined:currentImpactTarget,
            frame-CONTACT_IMPACT_CONTRACT.matchFrames,i<contacts.length-1?next-CONTACT_IMPACT_CONTRACT.matchFrames:duration+1,options.impactSearch);
          extra.push(...engagementGainResiduals([...impactPrefix!.pending,...observedImpacts!],frame,Math.min(duration,horizon),options.impactSearch));
          residuals.push(...extra);cost+=extra.reduce((s,r)=>s+r*r,0);
        }
        if(options.completeBoundary&&priorGap){
          const actual=options.amplitudeOverflow?objectiveAxes(det,priorGap,priorGap.endFrame):measureGapAxes(det,priorGap,added,priorGap.endFrame);
          const correction=arcBoundaryCorrection(actual,priorGap.targets,priorLoss,options.amplitudeWeight??1,cost);
          residuals.push(...correction.residuals);cost=correction.cost;
        }
        const motion=options.motionQuality?intervalMotionSummary(motionSamples(raw.frames,
          Math.max(1,frame-Math.max(...MOTION_BANDS.map(b=>b.frames))+1),horizon,effectiveBodyVelocity(state)),frame,horizon):undefined;
        // Startup has no preceding impact, but the next authored landing still
        // provides musical context. Do not silently exempt its internal motion.
        const motionImpact=impact??request?.context?.nextImpact??undefined;
        const motionErrors=motion?motionResiduals(motion,motionImpact,options.motionQuality!):[];
        const motionCost=motionErrors.reduce((n,r)=>n+r*r,0);
        residuals.push(...motionErrors);cost+=motionCost;
        const localCost=cost,priorStart=residuals.length;
        const finalVelocity=raw.frames.at(-1)!.velocity;
        if(i<contacts.length-1&&finalVelocity.x<1)return reject('unusable_arrival');
        // Keep future catches physically accessible; this is an optimizer prior,
        // never a change to the scored result.
        cost+=.01*Math.max(0,-finalVelocity.x/Math.max(1,pace))**2;
        if(i<contacts.length-1&&(options.arrivalWeight??0)>0){
          const nextImpact=gaps[contacts[i+1].gap].targets.impact??0;
          const nextSpeed=authoredSpeedToPx(planned[contacts[i+1].gap+1]?.targets.speed??targets.speed??.55);
          const passive=options.arrivalMode==='kinetic'||options.arrivalMode==='passive'&&options.constructionRequests?.[i+1]?.guidance==='forbidden';
          // A passive catch redirects incoming speed into the next surface.
          // Prepare kinetic headroom for an unguided landing; the experimental
          // kinetic mode also tests this preparation before guided constructions.
          // This is a proposal prior; actual native continuation decides merit.
          const impulse=impactToRawPx(nextImpact),arrivalSpeed=passive?Math.hypot(nextSpeed,impulse):nextSpeed;
          const desiredArrival=clamp(15+deg(passive?Math.atan2(impulse,nextSpeed):impulse/nextSpeed),20,70);
          const weight=Math.sqrt(options.arrivalWeight??0), r1=options.arrivalMode==='speed'?0:weight*(deg(Math.atan2(finalVelocity.y,finalVelocity.x))-desiredArrival)/45,r2=weight*(Math.hypot(finalVelocity.x,finalVelocity.y)-arrivalSpeed)/7.2;
          residuals.push(r1,r2);cost+=r1*r1+r2*r2;
        }
        if(i<contacts.length-1&&(options.headingWeight??0)>0){
          const angle=deg(Math.atan2(finalVelocity.y,finalVelocity.x));
          const r=Math.sqrt(options.headingWeight!)*Math.max(0,Math.abs(angle-15)-30)/30;
          residuals.push(r);cost+=r*r;
        }
        const tail=state.points.TAIL,nose=state.points.NOSE,dx=nose.x-tail.x,dy=nose.y-tail.y;
        const angularRate=(dx*(nose.vy-tail.vy)-dy*(nose.vx-tail.vx))/Math.max(1,dx*dx+dy*dy);
        if(options.arrivalReference){
          const target=options.arrivalReference,weight=Math.sqrt(1/10);
          const here=state.points.PEG,there=target.state.points.PEG;
          for(const key of Object.keys(state.points)){
            const a=state.points[key],b=target.state.points[key];
            for(const r of [weight*((a.x-here.x)-(b.x-there.x))/18,weight*((a.y-here.y)-(b.y-there.y))/18,weight*(a.vx-b.vx)/7.2,weight*(a.vy-b.vy)/7.2]){residuals.push(r);cost+=r*r;}
          }
        }
        const terminalImpacts=options.impactContract&&options.terminalSelection&&i===contacts.length-1?
          evaluateMusicalImpacts([...prefixImpactFrames!,...observedImpacts!],impactTargets,duration,true):undefined;
        const terminalLoss=options.terminalSelection&&i===contacts.length-1?arcDetectedTrajectoryObjective(det,gaps,options.amplitudeWeight,terminalImpacts).loss+motionCost/contacts.length:undefined;
        const release=raw.frames.slice().reverse().find(f=>f.sledContacts.length)?.frame;
        const finalState=state.points;
        const heading=deg(Math.atan2(finalVelocity.y,finalVelocity.x)),endSpeed=Math.hypot(finalVelocity.x,finalVelocity.y);
        const pose=deg(Math.atan2(finalState.NOSE.y-finalState.TAIL.y,finalState.NOSE.x-finalState.TAIL.x));
        viableCandidates++;
        const valueFeatures=options.futureValueModel?futureFeatures(arcArrivalFeatures(state,heading,endSpeed,pose,angularRate,horizon-(release??frame)),i):undefined;
        const predictedFuture=options.futureValueModel?arcFutureValue(valueFeatures!,options.futureValueModel):undefined;
        const guided=arcValueGuidance(cost,localCost,residuals,priorStart,predictedFuture,
          i<contacts.length-1?options.valueGuidanceWeight??0:0);
        const result={child,lines:added,c,cost,localCost,residuals:guided.residuals,optimizationCost:guided.cost,
          achieved,actualImpact,terminalLoss,release,railGuides:fragments?.guideIds,motion,motionCost,localResiduals:residuals.slice(0,priorStart),arrivalResiduals:residuals.slice(priorStart)};
        const {child:_child,...measurement}=result;
        candidates.push({lines:added,c,cost,localCost,measurement,
          searchCost:cost,residuals,heading,endSpeed,pose,valueFeatures,predictedFuture,terminalLoss,meta:{achieved,impact:actualImpact,release:result.release,lines:added.length,railGuides:fragments?.guideIds,motion,motionCost}});
        // Interrupted evaluations never reach this cache insertion.
        if(memo){const {child:_child,...measurement}=result;memo.set(key,{result:measurement,candidate:{...candidates.at(-1)}});}
        if(!best||guided.cost<best.optimizationCost)best=result;
        return result;
      };
      const evaluate=(c:ArcMotionControl,fragments?:{lines:TrackLine[];guideIds:number[]})=>{
        const observed=!!options.observedReceiver&&c.receiverFlight!==undefined&&!fragments;
        if(!observed)return evaluateCandidate(c,fragments);
        const began=getPhysicsFrameCount();observedReceiverWork.attempts++;
        try{const result=evaluateCandidate(c,fragments);if(result)observedReceiverWork.viable++;return result;}
        finally{observedReceiverWork.physicsFrames+=getPhysicsFrameCount()-began;}
      };
      // These describe the immutable incoming prefix already measured above.
      // Reusing them avoids a new physics read after committing the search budget.
      const arrivalFeatures=arcPolicyArrival(beforeState,velocity),inputFeatures=futureFeatures(arrivalFeatures,i-1);
      // Only the learned proposal receives the longer authored window. Keep
      // response-memory and future-value inputs in their original units.
      const policyInputFeatures=options.controlPolicy?.featureCount===67?futureFeatures(arrivalFeatures,i-1,4):inputFeatures;
      let center:ArcMotionControl|undefined;
      try {
      if(options.directControls){for(const control of options.directControls)evaluate(control);}
      else {
      // Guide permission, not an inactive clearance setting, determines which
      // initialization is physically appropriate for an unguided support.
      const guidedInitialization=options.guides!==false&&!!options.channel;
      center=guidedInitialization?{entry:incoming-.5,turn:-turn,exit:clamp(incoming-turn,-70,70),support,bias:0,offset:.1}:{entry:incoming-Math.min(12,turn*.3),turn:-Math.min(35,turn*.7),exit:clamp(incoming-25,-40,45),support,bias:0,offset:.1};
      if(options.bidirectional&&guidedInitialization&&incoming<15){center.turn=Math.abs(center.turn);center.exit=clamp(incoming+turn,-70,70);}
      const max=options.samples??160,initial=options.localOnly?0:Math.min(80,Math.ceil(max/2));
      // Calm landing emphasis changes impact units between adjacent intervals.
      // Store those weights even without time weighting so response reuse can
      // recover physical residuals before applying this interval's weights.
      const responseAxisWeights=options.motionQuality?.calmImpactMultiplier!==undefined?['air','speed','amplitude'].map(key=>key==='amplitude'?(options.amplitudeWeight??1):1).concat(options.impactWeight??2):undefined;
      const remembered=controlMemory.proposeControls(inputFeatures,incoming,span,options.memorySamples??0,options.controlDiversity,options.constructionProposals&&options.railLayout==='transfer'?'both':'relative');
      const responses=controlMemory.proposeResponses(inputFeatures,incoming,span,
        [targets.air,targets.speed,targets.amplitude,impact],options.memoryResponseSamples??0,
        {amplitude:options.amplitudeWeight??1,impact:options.impactWeight??2,damping:.0002,axisWeights:responseAxisWeights},options.controlDiversity);
      // Startup has a different physical-state distribution from a later catch.
      // Its optional learned proposals still pass the ordinary interval search.
      const proposalModel=i===0?options.controlPolicy?.startupModel:options.controlPolicy;
      const requested=[proposalModel?options.policySamples??8:0,remembered.length,responses.length];
      // The inherited model already covers ordinary arcs. Reserve new geometry
      // proposals where its training constructor differs from this request.
      const novelConstructor=!!options.profile||options.railLayout==='transfer';
      const reservedGeneric=options.constructionProposals?Math.ceil(initial*(novelConstructor?.25:0)):0;
      const counts=options.budgetedProposals?allocateArcProposalSlots(requested,Math.max(0,initial-1-reservedGeneric)):requested;
      const policy=counts[0]?arcControlProposals(policyInputFeatures,incoming,span,proposalModel,counts[0],options.controlDiversity):[];
      const learnedEnd=policy.length,memoryEnd=learnedEnd+Math.min(remembered.length,counts[1]);
      policy.push(...remembered.slice(0,counts[1]),...responses.slice(0,counts[2]));
      if(options.warmStart){
        evaluate(options.warmStart);
        if(options.warmIncoming!==undefined&&options.warmIncoming!==incoming)
          evaluate({...options.warmStart,entry:options.warmStart.entry+incoming-options.warmIncoming,
            exit:options.warmStart.exit+incoming-options.warmIncoming});
      }
      const genericInitial=(k:number)=>{
        const frac=(n:number)=>((k+1)*n)%1;
        const control:ArcMotionControl={entry:incoming-(guidedInitialization&&k%2===0?(-1+frac(.61803398875)*6):(2+frac(.61803398875)*Math.min(32,turn+10))),turn:(options.bidirectional&&k%4<2?1:-1)*frac(.41421356237)*Math.min(60,turn+25),exit:-45+frac(.73205080757)*110,support:support*(.45+frac(.2360679775)*1.2),bias:-1.5+3*frac(.6457513111),offset:-.25+frac(.3166247903)*1.5,
          ...(options.railLayout==='transfer'?{mainEnd:.3+.65*frac(.6931471806)}:{})};
        if(options.constructionProposals&&options.guides!==false&&options.independentGuide&&k%4!==0){
          // Contact geometry is needed to FIND feasible constructions, not only
          // to refine an already valid one. Keep every fourth inherited sample.
          control.clearance=8+14*frac(.7548776662);
          control.guideTilt=-18+36*frac(.5698402910);
          control.turnFraction=.15+.65*frac(.2718281828);
          if(options.railLayout==='transfer'&&k%3===1)
            control.support=2*Math.pow(Math.max(1,(constructionSpan-4)/2),frac(.4384471872));
          if(options.profile==='fold'){
            control.foldBend=(k%2?1:-1)*(20+35*frac(.3247179572));
            if(options.railLayout==='transfer')control.foldTiming=k%2?1:frac(.6931471806);
            // The first folded face is entry+turn; target that face's approach
            // directly rather than inheriting a smooth arc's five-frame turn.
            control.entry=incoming-control.turn-(1+frac(.61803398875)*Math.min(25,turn+5));
          }
        }
        if(options.observedReceiver&&options.railLayout==='transfer'&&k%2===1){
          control.receiverFlight=1+Math.floor(5*frac(.2718281828));
          control.receiverEntry=-5+30*frac(.7548776662);
          control.receiverTurn=-40+80*frac(.5698402910);
          control.receiverExit=-60+130*frac(.3247179572);
          control.receiverDuration=.25+.7*frac(.4384471872);
        }
        return control;
      };
      for(let k=0;k<initial;k++){
        const stream=k===0?'center':k<=learnedEnd?'learned':k<=memoryEnd?'memory':k<=policy.length?'response':'generic';
        const accounting=initialProposalWork[stream],began=getPhysicsFrameCount();accounting.attempts++;
        try{if(evaluate(k>0&&k<=policy.length?policy[k-1]:k===0?center:genericInitial(k)))accounting.viable++;}
        finally{accounting.physicsFrames+=getPhysicsFrameCount()-began;}
        if(k%10===9)Engine.retainOnly([...protectedEngines,...(best?[engine,best.child]:[engine])]);
      }
      if(i>0&&initial>0&&options.railLayout!=='transfer'&&(options.opposingEntryProposals??0)>0){
        // Offer the same curve constructor from the opposite contact side.
        // Both sides compete under the same musical/physical checks; there is
        // no scheduled upper-hit request or different strength definition.
        const began=getPhysicsFrameCount(),beforeFailures={...failures};
        try{for(let k=0;k<options.opposingEntryProposals!;k++){
          const c=k===0?center:genericInitial(k);opposingEntryWork.attempts++;
          if(evaluate({...c,contactSide:-1,entry:2*incoming-c.entry,turn:-c.turn,exit:2*incoming-c.exit,
            ...(c.foldBend===undefined?{}:{foldBend:-c.foldBend}),...(c.guideTilt===undefined?{}:{guideTilt:-c.guideTilt})}))opposingEntryWork.viable++;
          if(k%8===7)Engine.retainOnly([...protectedEngines,...(best?[engine,best.child]:[engine])]);
        }}finally{
          opposingEntryWork.physicsFrames+=getPhysicsFrameCount()-began;
          for(const [key,count]of Object.entries(failures))opposingEntryWork.failures[key]=(opposingEntryWork.failures[key]??0)+count-(beforeFailures[key]??0);
        }
      }
      if(options.compactFoldProposals&&options.profile==='fold'&&options.railLayout==='transfer'&&initial>0){
        const anchor=best?.c??near[0]?.c??center;
        if(anchor)for(let k=0;k<16;k++){
          const frac=(n:number)=>((k+1)*n)%1,duration=Math.max(2,support*(.65+.7*frac(.4384471872)));
          const control={...anchor,support:duration,foldTiming:1,turnFraction:Math.min(5,duration*.2)/duration,
            foldBias:-2-4*frac(.6931471806),foldBend:-20-35*frac(.3247179572),exit:-20+40*frac(.7548776662),mainEnd:.4+.55*frac(.5698402910)};
          const accounting=initialProposalWork.compactFold,began=getPhysicsFrameCount();accounting.attempts++;
          try{if(evaluate(control))accounting.viable++;}
          finally{accounting.physicsFrames+=getPhysicsFrameCount()-began;}
        }
        Engine.retainOnly([...protectedEngines,engine,...(best?[best.child]:[])]);
      }
      if(options.observedReceiver&&options.railLayout==='transfer'&&initial>0){
        const anchor=best?.c??near[0]?.c??center;
        if(anchor)for(let k=0;k<12;k++){
          const frac=(n:number)=>((k+1)*n)%1;
          evaluate({...anchor,receiverFlight:1+Math.floor(5*frac(.2718281828)),receiverEntry:-5+30*frac(.7548776662),
            receiverTurn:-40+80*frac(.5698402910),receiverExit:-60+130*frac(.3247179572),receiverDuration:.25+.7*frac(.4384471872)});
        }
        Engine.retainOnly([...protectedEngines,engine,...(best?[best.child]:[])]);
      }
      if(!best&&initial>0&&(options.initialRecoverySamples??0)>0){
        const began=getPhysicsFrameCount(),record={index:i,frame,proposals:0,viable:0,physicalFrames:0,bestConstructionDeficit:null as number|null,failures:{}};
        initializationRecovery.push(record);
        try{
          for(let k=1;k<=options.initialRecoverySamples!;k++){
            let proposal=genericInitial(k);
            if(options.constructionRecovery&&near.length&&k%3!==0){
              const keys=arcMethodKeys('response',true,false,options.guides,options);
              const trial=Math.floor(k*2/3),key=keys[Math.floor(trial/2)%keys.length];
              const anchor=near[Math.floor(trial/(2*keys.length))%Math.min(4,near.length)].c;
              const step=arcControlStep(key,'coordinate',anchor.support)*Math.pow(.65,Math.floor(trial/(6*keys.length)));
              proposal={...anchor,[key]:arcControlValue(anchor,key,options.channel)+(trial%2?-1:1)*step};
            }
            record.proposals++;if(evaluate(proposal))record.viable++;
            if(k%10===0)Engine.retainOnly([...protectedEngines,...(best?[engine,best.child]:[engine])]);
          }
        }finally{record.physicalFrames=getPhysicsFrameCount()-began;record.bestConstructionDeficit=near[0]?.deficit??null;record.failures={...failures};}
      }
      if(best){
        const keys=ARC_CORE_KEYS;
        for(let k=initial;k<max;k++){
          const key=keys[Math.floor((k-initial)/2)%keys.length],round=Math.floor((k-initial)/(2*keys.length)),sign=k%2===0?-1:1;
          const candidate={...best.c,[key]:best.c[key]+sign*arcControlStep(key,'coordinate',options.constructionProposals?best.c.support:support)*Math.pow(.65,Math.floor(round/2))};
          evaluate(candidate);
          if(k%10===9)Engine.retainOnly([...protectedEngines,engine,best.child]);
        }
      }
      if(best&&options.guidance){
        const origin=best;
        const receiverActive=options.observedReceiver&&best.c.receiverFlight!==undefined;
        const irrelevantGuide=new Set(['clearance','guideStart','guideEnd','guideTilt','guideFlare']);
        const responseKeys=arcMethodKeys('response',!!options.expressive,false,options.guides,
          {...options,observedReceiver:receiverActive}).filter(key=>!receiverActive||!irrelevantGuide.has(key));
        const wantedResponse=Math.min(options.guidanceSamples??48,options.responseSamples??0);
        const responseRound=2*responseKeys.length+3;
        const responseAllowance=options.completeGuidanceBudget?Math.floor(wantedResponse/responseRound)*responseRound:wantedResponse>=responseRound?wantedResponse:0;
        const count=(options.guidanceSamples??48)-responseAllowance;
        let keys:(keyof ArcMotionControl)[]=options.guidance==='span'?['guideStart','guideEnd']:options.guidance==='clearance'?['clearance']:['clearance','guideStart','guideEnd'];
        if(options.guidanceJoint)keys.push(...ARC_CORE_KEYS);
        if(options.expressive)keys.push(...ARC_EXPRESSIVE_KEYS);
        if(options.independentGuide)keys.push('guideTilt');
        if(options.observedReceiver&&best.c.receiverFlight!==undefined)
          keys.push('receiverFlight','receiverEntry','receiverTurn','receiverExit','receiverDuration');
        keys=keys.filter(key=>arcControlActive(key,options.guides,options));
        if(receiverActive)keys=keys.filter(key=>!irrelevantGuide.has(key));
        const broad=options.guidanceJoint?Math.min(24,Math.ceil(count/3)):count/2;
        for(let k=0;keys.length&&k<count;k++){
          const frac=(n:number)=>((k+1)*n)%1;
          let c:ArcMotionControl;
          if(k<broad){
            c={...origin.c};
            if(options.guidance!=='span')c.clearance=k===0?12:8+16*frac(.61803398875);
            if(options.expressive&&k>0){c.turnFraction=.15+.65*frac(.2718281828);c.bend=-35+70*frac(.1415926535);c.guideFlare=-12+24*frac(.5772156649);}
            if(options.independentGuide&&k>0)c.guideTilt=-15+30*frac(.9159655941);
            if(options.railLayout==='transfer'&&k>0)c.mainEnd=.3+.6*frac(.6931471806);
            if(options.guidance!=='clearance'){
              c.guideStart=k%3===0?0:frac(.41421356237)*.7;
              c.guideEnd=k===0?0:k%3===1?1:Math.max(c.guideStart,frac(.73205080757));
            }
          }else{
            const key=keys[Math.floor(k/2)%keys.length],step=arcControlStep(key,'coordinate',options.constructionProposals?best.c.support:support);
            c={...best.c,[key]:arcControlValue(best.c,key,options.channel)+(k%2===0?-1:1)*step*Math.pow(.6,Math.floor((k-broad)/(keys.length*4)))};
          }
          evaluate(c);if(k%8===7)Engine.retainOnly([...protectedEngines,engine,best.child]);
        }
        let responseUsed=0, trust=1;
        while(responseUsed+2*responseKeys.length+3<=responseAllowance){
          const origin=best,scale=(key:keyof ArcMotionControl)=>arcControlStep(key,'response',options.constructionProposals?origin.c.support:support);
          const value=(key:keyof ArcMotionControl)=>arcControlValue(origin.c,key,options.channel);
          const jac=origin.residuals.map(()=>Array(responseKeys.length).fill(0));
          responseKeys.forEach((key,d)=>{
            const step=scale(key)*trust;
            const a=evaluate({...origin.c,[key]:value(key)+step}),b=evaluate({...origin.c,[key]:value(key)-step});responseUsed+=2;
            for(let r=0;r<jac.length;r++)jac[r][d]=a&&b?(a.residuals[r]-b.residuals[r])/2:a?a.residuals[r]-origin.residuals[r]:b?origin.residuals[r]-b.residuals[r]:0;
          });
          if((options.memoryResponseSamples??0)>0){
            controlMemory.rememberResponse({features:inputFeatures,incoming,span,
              control:{...origin.c,...Object.fromEntries(responseKeys.map(key=>[key,value(key)]))},
              targets:[targets.air,targets.speed,targets.amplitude,impact],keys:responseKeys.slice(),
              jac:jac.slice(0,4),residuals:origin.residuals.slice(0,4),
              axisWeights:responseAxisWeights,
              scale:responseKeys.map(key=>scale(key)*trust),
              loss:origin.residuals.slice(0,4).reduce((sum:number,v:number)=>sum+v*v,0)});
          }
          const delta=arcResponseStep(jac,origin.residuals,.0002);
          for(const fraction of [1,.5,.25]){
            if(delta){const c={...origin.c};responseKeys.forEach((key,d)=>c[key]=value(key)+fraction*scale(key)*trust*clamp(delta[d],-3,3));evaluate(c);}responseUsed++;
          }
          const improving=best.optimizationCost<origin.optimizationCost-1e-12;
          if(!improving)trust*=.5;
          Engine.retainOnly([...protectedEngines,engine,best.child]);
        }
      }
      }
      } catch(error) {
        if(!(error instanceof PhysicsFrameLimitExceeded))throw error;
        searchBudgetExhausted=true;
        budgetInterruptions.push({phase:'local',index:i,frame,viable:candidates.length,retained:!!best});
        // Every retained candidate already passed the complete interval replay.
        // Discard only the interrupted probe, preserving the best valid geometry.
        Engine.retainOnly([...protectedEngines,engine,...(best?[best.child]:[])]);
        if(!best)throw error;
      }
      if(best&&options.constructionRequests?.[i]?.construction==='scattered'){
        fragmentStats.intervals++;
        const source=candidates.slice().sort((a,b)=>a.cost-b.cost).slice(0,4);
        candidates.length=0;best=null;
        const observer=observerFor(engine);
        for(const proposal of source){
          const began=getPhysicsFrameCount();fragmentStats.probes++;
          const fragments=fragmentInterval(observer,proposal.lines,frame,horizon);
          const observed=getPhysicsFrameCount();fragmentStats.observationFrames+=observed-began;
          const result=evaluate(proposal.c,fragments);
          fragmentStats.replayFrames+=getPhysicsFrameCount()-observed;
          if(result){
            const prefix=prefixes.get(result.child)!;
            observers.set(prefix,extendContactObserver(observer,fragments.lines));
            break;
          }
        }
      }
      return {best,candidates,failures,frame,next,horizon,gap,outgoing,targets,incoming,pace,center,support,span,inputFeatures};
    };
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
        searchBudgetExhausted=true;
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
        localScale=clamp(available/(Math.max(nominal*.7,observedConstructionRate||nominal)*1.1),.05,1);
        overrides.samples=Math.max(12,Math.floor((options.samples??160)*localScale));
        overrides.guidanceSamples=Math.floor((options.guidanceSamples??48)*localScale);
        overrides.responseSamples=Math.floor((options.responseSamples??0)*localScale);
      }
      let interval=searchInterval(engine,i,overrides);
      if(interval){const rate=(getPhysicsFrameCount()-localStart)/Math.max(1,interval.next-interval.frame)/localScale;observedConstructionRate=observedConstructionRate ? .8*observedConstructionRate+.2*rate : rate;}
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
        const reserve=(end-interval.frame)*Math.max((options.samples??160)+(options.guidanceSamples??0),observedConstructionRate);
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
            searchBudgetExhausted=true;
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
        const constructionReserveRate=(options.adaptivePlanning?Math.max(nominalRate,observedConstructionRate):nominalRate)*(options.reserveFactor??1.1);
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
          planningDecisions.push({index:i,frame,observedConstructionRate,constructionReserveRate,localAllowance,width,probeSamples,depth});
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
          searchBudgetExhausted=true;
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
        const remaining=Math.max(1,end-frame),reserve=remaining*Math.max((options.samples??160)+(options.guidanceSamples??0),observedConstructionRate);
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
            searchBudgetExhausted=true;Engine.retainOnly([engine,original.child]);
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
        terminalSelectionStats={candidates:candidates.length,initialLoss:original.terminalLoss,finalLoss:selected.terminalLoss,changed};
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
      engine=refined.engine;refinementStats=refined.stats;
    }
  }catch(error){if(!(error instanceof PhysicsFrameLimitExceeded))throw error;searchBudgetExhausted=true;failure={reason:'budget'};}
  if(failure&&deepestPrefix.rows.length>rows.length){
    lines.splice(0,lines.length,...deepestPrefix.lines);rows.splice(0,rows.length,...deepestPrefix.rows);
  }
  const constructionFrames=getPhysicsFrameCount();
  setPhysicsFrameLimit(budget);
  const coldEngine=createArcEngine(start,lines);
  raw=extractRawTrajectory(coldEngine,end);
  // Structured rails are indivisible: guide-only pruning would tear their contours.
  const fragments=new Set(Object.values(options.constructionRequests??{}).filter(r=>r.construction==='scattered').map(r=>r.section));
  const guidanceReduction=options.pruneGuidance?trimUnusedArcGuides(lines,coldEngine,end,0,fragments):null;
  if(guidanceReduction){
    const requests=Object.values(options.constructionRequests??{}).filter(r=>r.context||r.railLayout==='transfer');
    if(requests.length){
      const contacts=raw.frames.map((f:{frame:number;position:{x:number;y:number}})=>({position:f.position,contactLineIds:coldEngine.getAllContactLineIdsAtFrame(f.frame)}));
      const restore=new Set<number>();
      for(const request of requests){
        if(request.construction==='scattered')continue;
        const original=lines.filter(l=>Math.floor((l.id-1000)/10000)===request.section);
        const proposed=guidanceReduction.lines.filter(l=>Math.floor((l.id-1000)/10000)===request.section);
        if(original.length===proposed.length)continue;
        const guides=new Set((arcRailGroups(original).get(request.section)?.[1]??[]).map(l=>l.id));
        if(inspectConstructionWindow(request,original,guides,contacts).fulfilled&&!inspectConstructionWindow(request,proposed,guides,contacts).fulfilled)restore.add(request.section);
      }
      if(restore.size){
        const kept=new Set(guidanceReduction.lines.map(l=>l.id));
        guidanceReduction.lines=lines.filter(l=>restore.has(Math.floor((l.id-1000)/10000))||kept.has(l.id));
        const spans=guidanceReduction.stats.spans.map(s=>restore.has(s.group)?{...s,after:s.before,lengthAfter:s.lengthBefore}:s);
        Object.assign(guidanceReduction.stats,{spans,retainedForConstruction:[...restore],removedSegments:lines.length-guidanceReduction.lines.length,
          removedGuides:spans.filter(s=>s.before>0&&s.after===0).length,
          shortenedGuides:spans.filter(s=>s.after>0&&s.after<s.before).length,
          lengthAfter:spans.reduce((n,s)=>n+s.lengthAfter,0)});
      }
    }
    lines.splice(0,lines.length,...guidanceReduction.lines);
  }
  const finalImpactFrames=options.impactContract?impactFrames(coldEngine,raw.frames):undefined;
  disposeSearch();
  try{
    const base=new Judge().setStart(start.position,start.velocity),judge=lines.length?base.addLine(lines):base;
    const replay=extractRawTrajectory(judge,end);
    if(JSON.stringify(replay)!==JSON.stringify(raw))throw new Error('fixed-engine replay mismatch');
    if(finalImpactFrames&&JSON.stringify(impactFrames(judge,replay.frames))!==JSON.stringify(finalImpactFrames))throw new Error('fixed-engine impact observation mismatch');
  }finally{disposeJudge();setPhysicsFrameLimit(null);}
  const report=reportFor(raw,lines);
  const impactEvaluation=finalImpactFrames?evaluateMusicalImpacts(finalImpactFrames,impactTargets,duration,report.terminus.reason==='endOfSpec'):undefined;
  const trajectoryLoss=options.collectTrajectoryLoss?arcWholeTrajectoryObjective(raw,report,gaps,options.amplitudeWeight).loss:undefined;
  const impactTrajectoryLoss=impactEvaluation?arcWholeTrajectoryObjective(raw,report,gaps,options.amplitudeWeight,impactEvaluation).loss:undefined;
  let selectionLoss=impactTrajectoryLoss??trajectoryLoss;
  if(selectionLoss!==undefined&&finalImpactFrames)for(const [i,contact]of contacts.entries()){
    const next=contacts[i+1]?.frame??duration+1;
    selectionLoss+=engagementGainResiduals(finalImpactFrames,contact.frame,next-1,options.impactSearch).reduce((n,v)=>n+v*v,0)/contacts.length;
  }
  if(selectionLoss!==undefined&&options.motionQuality){
    const observed=motionSamples(raw.frames,1,duration);
    for(const [i,contact]of contacts.entries()){
      const next=contacts[i+1]?.frame??duration+1,request=options.constructionRequests?.[i];
      const samples=observed.filter(s=>s.frame>=contact.frame&&s.frame<next);
      if(!samples.length)continue;
      const impact=contact.gap>=0?gaps[contact.gap].targets.impact:request?.context?.nextImpact??undefined;
      selectionLoss+=motionResiduals(intervalMotionSummary(observed,contact.frame,next-1),impact,options.motionQuality).reduce((n,r)=>n+r*r,0)/contacts.length;
    }
  }
  return{track:buildTrackJson(lines,end,start),report,...(hasFragments?{fragmentStats}:{}),...(options.initialRecoverySamples?{initializationRecovery}:{}),stats:{viable_candidate_samples:viableCandidates,sim_frames:getPhysicsFrameCount(),gap_commits:report.contacts.filter(c=>c.status==='hit').length},rows,initialProposalWork,observedReceiverWork,...(options.opposingEntryProposals?{opposingEntryWork}:{}),coupledIntervalWork,transitionRevisionWork,constructionImprovement,failure,budget:budget,searchBudgetExhausted,budgetInterruptions,candidateMemo:{hits:memoHits,rejectedHits:memoRejectedHits},samples,backtracks,qualityRetries:Object.fromEntries(qualityRetries),lookaheadStats,trajectoryLoss,selectionLoss,planningDecisions,refinementStats,terminalSelectionStats,...(impactEvaluation?{impactEvaluation,impactTrajectoryLoss}:{}),guidanceReduction:guidanceReduction?.stats??null,constructionFrames};
  }finally{disposeSearch();disposeJudge();setPhysicsFrameLimit(null);}
}
