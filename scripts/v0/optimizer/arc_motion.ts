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
import { arcResponseStep, arcSecantUpdate } from './arc_response.ts';
import { ArcControlMemory, arcConstructionMemoryKey, allocateArcProposalSlots, type ArcControlExample } from './arc_memory.ts';
import { arcSpanLoss, arcBoundaryCorrection } from './arc_boundary.ts';
import { arcArrivalFeatures, arcFutureValue, arcValueGuidance } from './arc_value.ts';
import { normalizeCompilerTimeline } from './compiler_input.ts';
import { createArcEngine } from './arc_engine.ts';
import { runArcAttempts } from './arc_attempts.ts';
import { ARC_CORE_KEYS, ARC_EXPRESSIVE_KEYS, normalizeArcControl, arcControlMemoKey, arcControlValue, arcControlStep, arcMethodKeys, arcControlActive, arcControlsSimilar, arcReferencedControl, type ArcControlReference } from './arc_motion_control.ts';
import { authoredSpeedToPx, impactToRawPx, PREROLL, CALIB, type Spec, type TrackLine } from '../types.ts';

import { makeRng } from '../../lib/rng.ts';
import {inspectConstructionWindow} from './repertoire_candidate.ts';
import {constructionStyle,type ConstructionRequest} from './repertoire_policy.ts';
import {contactObserver,extendContactObserver,fragmentInterval} from './contact_interval.ts';
import {motionSamples,summarizeMotion,effectiveBodyVelocity} from './motion_quality.ts';
import {constructionDeficit} from './repertoire_feasibility.ts';
import {motionResiduals,type MotionSearchOptions} from './motion_objective.ts';
// The frozen judge wrapper has an isolate-wide handle registry, not individual
// disposal. A private module instance gives replay its own WASM instance and
// registry without changing judge code or freeing engines retained by callers.
// Keep these handles local to the synchronous replay and dispose them below.
const {LineRiderEngine:Judge,disposeAllWasmEnginesForStudy:disposeJudge} =
  await import(new URL('../../lib/_lr_engine_wasm.ts?arc-compiler-replay',import.meta.url).href);
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const rad=(x:number)=>x*Math.PI/180;
const deg=(x:number)=>x*180/Math.PI;
/** Serialized research fork: no engine handles survive across compilations.
 * Earlier geometry is locked; only the first new section's guide permission
 * changes. Every later section uses the same ordinary continuation search. */
export type ArcMotionFork = {
  section:number; lines:TrackLine[]; rows:any[];
  start:{position:{x:number;y:number};velocity:{x:number;y:number}};
  stateSha256:string; guides:boolean; control?:ArcMotionControl;
  /** Source controls for the rebuilt suffix. They are proposals, never replay
   * shortcuts; each is checked from the newly reached physical state. */
  continuation?:ArcControlReference[];
  /** Later guide permissions shared by both forks; geometry is still searched.
   * The permission at section zero of this suffix is overridden by `guides`. */
  continuationGuides?:boolean[];
  /** Explicitly reconstructed normal-contact sections in a locked research
   * prefix. They need not be connected curves; new sections still use arcs. */
  fragmentSections?:number[];
};
export type ArcMotionOptions= ArcGeometryStyle & {
  budget:number;
  /** Explicit motion research/production mode; absent in frozen ordinary/V5 defaults. */
  motionQuality?:MotionSearchOptions;
  /** Explicit repertoire search options. Production defaults are unchanged. */
  initialRecoverySamples?:number;
  /** Cover contact geometry before a first fully realized candidate exists. */
  constructionProposals?:boolean;
  constructionRecovery?:boolean;
  /** Bounded exploration of better physically valid but not yet realized shapes. */
  constructionImprovementSamples?:number;
  genericProposalFraction?:number;
  constructionAwareArrival?:boolean;
  fork?:ArcMotionFork;
  /** Research composition by support index (startup is zero). Applied to every
   * proposal, lookahead and rebuilt continuation. Omitted sections inherit the
   * global settings; this changes construction, never the musical specification. */
  sectionStyles?:Record<number,ArcSectionStyle>;
  /** Physical construction requirements participate in every proposal and continuation. */
  constructionRequests?:Record<number,ConstructionRequest>;
  /** Reuse the preliminary track as measured controls in general search. */
  previewMemory?:boolean;
  /** Measured controls retrieved by physical state and authored targets. */
  controlExamples?:ArcControlExample[];
  constructionExamples?:Readonly<Record<string,readonly ArcControlExample[]>>;
  /** Preserve distinct expressive geometry in learned and memory proposals. */
  controlDiversity?:'inherited'|'geometry';
  /** Reserve work for improving a completed track inside the same hard limit. */
  constructionBudget?:number;
  /** Reuse measured response directions between complete finite differences. */
  responseSecantSteps?:number;
  wholeTrackRefinement?:boolean;
  /** Rank already simulated complete alternatives by the full authored loss. */
  terminalSelection?:boolean;
  /** Refine completed trajectories using time-weighted, bounded physical loss. */
  terminalOptimization?:boolean;
  /** Keep the inherited five-frame turn representable during refinement. */
  preserveTurnTiming?:boolean;
  refineIndependentExit?:boolean;
  /** Measure the final objective at the authored end; still validate the grace. */
  authoredHorizon?:boolean;
  /** Balance authored span error by time and contact error by event count. */
  timeObjective?:boolean;
  /** Retain useful search pressure beyond the public amplitude cap. */
  amplitudeOverflow?:'raw'|'log';
  /** Explore with overflow gradients, then retain the bounded objective winner. */
  boundedSelection?:boolean;
  /** Predict the next grounded boundary when ranking an outgoing air span. */
  predictAirBoundary?:boolean;
  /** Transfer response matrices in physical units before changing loss weights. */
  rescaleMemoryWeights?:boolean;
  /** Preserve the proposal mix within the slots a local probe can evaluate. */
  budgetedProposals?:boolean;
  /** Correct discrete flight counts using support-length proposals. */
  airProjection?:number;
  /** Minimum distinct release-frame difference in a planning shortlist. */
  releaseDiversity?:number;
  /** Search late-arc easing independently of the initial impact-section easing. */
  independentExit?:boolean;
  exitRefinementOnly?:boolean;
  minExitSupport?:number;
  /** Give unusable response-round remainders back to coordinate exploration. */
  completeGuidanceBudget?:boolean;
  /** Keep learned responses local to their physical geometry and guide permission. */
  memoryScope?:'construction';
  memorySamples?:number;
  memoryResponseSamples?:number;
  /** Replace the preceding truncated span once its contact boundary is measured. */
  completeBoundary?:boolean;
  samples?:number;
  diagnostic?:boolean;
  arrivalWeight?:number;
  flow?:boolean;
  startPitch?:number;
  solver?:string;
  channel?:number;
  wave?:boolean;
  /** Research: straight facets per support frame; ordinary smooth arcs use four. */
  subdivisions?:number;
  radius?:number;
  arrivalMode?:string;
  poseWeight?:number;
  bidirectional?:boolean;
  impactWeight?:number;
  amplitudeWeight?:number;
  qualityRetries?:number;
  headingWeight?:number;
  guidance?:'span'|'clearance'|'full';
  guidanceSamples?:number;
  lookaheadWidth?:number;
  lookaheadSamples?:number;
  /** Explicit local correction allowance for simulated continuation probes. */
  continuationGuidanceSamples?:number;
  continuationResponseSamples?:number;
  /** Propose one demonstrated curve and search only when its physical replay fails. */
  policyRollout?:boolean;
  policyRolloutStrict?:boolean;
  policyPreview?:boolean;
  /** Accept a cold-validated proposal by default; always search only for explicit comparisons. */
  searchAfterPreview?:'failure'|'always';
  /** Early acceptance also requires low measured whole-trajectory error. Infinity is a research ablation. */
  previewMaxRmsError?:number;
  collectTrajectoryLoss?:boolean;
  lookaheadWeight?:number;
  lookaheadWarmStart?:boolean;
  warmStart?:ArcMotionControl;
  warmIncoming?:number;
  pruneGuidance?:boolean;
  lookaheadDepth?:number;
  lookaheadBranching?:number;
  lookaheadObjective?:'local'|'terminal';
  reserveFactor?:number;
  reuseContinuations?:boolean;
  guidanceJoint?:boolean;
  expressive?:boolean;
  localOnly?:boolean;
  arrivalReference?:any;
  boundaryWeight?:number;
  refineAttempts?:number;
  refineSamples?:number;
  refineGuidanceSamples?:number;
  refineWidth?:number;
  refineBoundaryWeight?:number;
  refineSelection?:'regret'|'rate';
  refineMode?:'translate'|'reflow';
  adaptivePlanning?:boolean;
  planningDepth?:number;
  planningWidth?:number;
  planningSamples?:number;
  strictHorizon?:boolean;
  directControls?:ArcMotionControl[];
  /** Research teacher: optimize each visited state, then replay this fixed path. */
  replayControls?:ArcMotionControl[];
  refineDirect?:boolean;
  refineRebuildSamples?:number;
  refineExpressive?:boolean;
  responseSamples?:number;
  responseDamping?:number;
  responseScale?:number;
  refineFollowSamples?:number;
  refineUseAlternatives?:boolean;
  collectValue?:boolean;
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
  valueGuidanceWeight?:number;
  valueSelection?:boolean};

export function compileArcMotion(spec:Spec,seed:number,options:ArcMotionOptions):ReturnType<typeof compileArcMotionOnce>&{policyPreviewStats?:any;engineRebuilds?:number;attempts:ReturnType<typeof runArcAttempts>['records'];proposalDecision:ReturnType<typeof runArcAttempts>['proposalDecision'];firstCompletionFrame:number|null}{
  const attempts=runArcAttempts(spec,seed,options,compileArcMotionOnce);
  const diagnostics={attempts:attempts.records,proposalDecision:attempts.proposalDecision,firstCompletionFrame:attempts.firstCompletionFrame};
  if(attempts.results.length===1){
    const result=attempts.results[0],proposal=attempts.records[0].name==='proposal';
    return {...result,...diagnostics,budget:options.budget,...(proposal?{policyPreviewStats:{
      previewFrames:result.stats.sim_frames,searchFrames:0,totalFrames:result.stats.sim_frames,
      previewLoss:result.trajectoryLoss,searchLoss:null,selected:'preview',
      previewComplete:attempts.records[0].complete,searchComplete:null}}:{})};
  }
  const [preview,searched]=attempts.results;
  const previewFrames=preview.stats.sim_frames,total=searched.stats.sim_frames;
  const chosen=attempts.results[attempts.selected];
  const backtracks=preview.backtracks+searched.backtracks;
  const qualityRetries={...preview.qualityRetries};
  for(const [index,count] of Object.entries(searched.qualityRetries))qualityRetries[index]=(qualityRetries[index]??0)+count;
  return {...chosen,...diagnostics,budget:options.budget,constructionFrames:searched.constructionFrames,
    samples:preview.samples+searched.samples,backtracks,engineRebuilds:backtracks+4,qualityRetries,
    searchBudgetExhausted:preview.searchBudgetExhausted||searched.searchBudgetExhausted,
    budgetInterruptions:[...preview.budgetInterruptions.map(r=>({...r,attempt:'preview'})),...searched.budgetInterruptions.map(r=>({...r,attempt:'search'}))],
    candidateMemo:{hits:preview.candidateMemo.hits+searched.candidateMemo.hits,rejectedHits:preview.candidateMemo.rejectedHits+searched.candidateMemo.rejectedHits},
    stats:{...chosen.stats,sim_frames:total,viable_candidate_samples:preview.stats.viable_candidate_samples+searched.stats.viable_candidate_samples},
    policyPreviewStats:{previewFrames,searchFrames:total-previewFrames,totalFrames:total,
      previewLoss:preview.trajectoryLoss,searchLoss:searched.trajectoryLoss,selected:chosen===preview?'preview':'search',
      previewComplete:attempts.records[0].complete,searchComplete:attempts.records[1].complete}};
}

function compileArcMotionOnce(spec:Spec,seed:number,options:ArcMotionOptions,continueMeter=false){
  if(options.initialRecoverySamples!==undefined&&(!Number.isSafeInteger(options.initialRecoverySamples)||options.initialRecoverySamples<0||options.initialRecoverySamples>320))throw new Error('invalid initialization recovery allowance');
  if(options.constructionImprovementSamples!==undefined&&(!Number.isSafeInteger(options.constructionImprovementSamples)||options.constructionImprovementSamples<0||options.constructionImprovementSamples>4096))throw new Error('invalid construction improvement allowance');
  if(options.genericProposalFraction!==undefined&&(!Number.isFinite(options.genericProposalFraction)||options.genericProposalFraction<0||options.genericProposalFraction>1))throw new Error('invalid generic proposal fraction');
  if(!Number.isSafeInteger(seed)||!Number.isSafeInteger(options.budget)||options.budget<=0)throw new Error('invalid arc compiler input');
  if(!validProfileControls(options))throw new Error('invalid profile controls');
  arcMainSteps(1,options.subdivisions,options.faces);
  spec=normalizeCompilerTimeline(spec);
  validateSpec(spec);
  if(!continueMeter)resetFrameCount();const finalBudget=options.budget,budget=options.constructionBudget??finalBudget,duration=Math.round(spec.duration*40),end=duration+20;
  if(!Number.isSafeInteger(budget)||budget>finalBudget)throw new Error('invalid arc construction budget');
  if(duration<1)throw new Error('arc duration must cover at least one frame');
  if(budget<=2*(end+1))throw new Error('arc budget must cover two complete replays and construction work');
  if(options.fork&&(options.replayControls||options.directControls||options.policyRollout||(options.refineAttempts??0)>0||options.contour))
    throw new Error('arc forks require ordinary connected continuation search');
  try{
  if(typeof options.controlPolicy==='function')options={...options,controlPolicy:options.controlPolicy()};
  const frames=spec.contacts.map(c=>Math.round(c.t*40));
  const gaps=sliceTimeline(frames,duration);
  for(const g of gaps){g.targets=effectiveAxes(g,spec);if(g.endsWithContact&&spec.contacts[g.index].impact!==undefined)g.targets.impact=spec.contacts[g.index].impact;}
  const impactCount=Math.max(1,gaps.filter(g=>g.targets.impact!==undefined).length);
  const axisFrames=Object.fromEntries(['air','speed','amplitude'].map(axis=>[axis,gaps.reduce((n,g)=>n+(g.targets[axis as keyof typeof g.targets]===undefined?0:g.endFrame-g.startFrame),0)]));
  const rng=makeRng(seed);
  const planned=scheduleNativeContacts(gaps.map(g=>({...g,targets:{...g.targets,...sampleGapTargets(g.targets,spec.jitter??CALIB.SIGMA,rng)}})));
  const fixed=spec.start||(spec.preroll??PREROLL.DEFAULT_S)<=0?resolveStartState(spec):null;
  const speed=authoredSpeedToPx(gaps[0].targets.speed??.55);
  const pitch=rad(options.startPitch??8.59436692696);
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
  const lines:TrackLine[]=[],rows:any[]=[],steps:any[]=[],teacherRows:any[]=[];let failure:any=null,raw:any=null;let backtracks=0;
  let samples=0,viableCandidates=0,memoHits=0,memoRejectedHits=0;const qualityRetries=new Map<number,number>();
  let refinementStats:any=null, terminalSelectionStats:any=null, observedConstructionRate=0;
  let searchBudgetExhausted=false;
  let forkEvidence:{section:number;frame:number;prefixSha256:string;stateSha256:string}|null=null;
  const resumeAt=options.fork?.section??0;
  const budgetInterruptions:Array<{phase:'local'|'planning'|'continuation';index:number;frame:number;viable:number;retained:boolean}>=[];
  const planningDecisions:any[]=[];
  const reportFor=(trajectory:any,geometry:TrackLine[])=>buildDriftReport(detect(trajectory),spec,gaps,frames,duration,[],gaps.map(g=>({lines:geometry.filter(l=>Math.floor((l.id-1000)/10000)===g.index+1)})) as any,gaps.map(g=>g.targets));
  const lookaheadStats={probes:0,changedChoices:0,failedProbes:0,physicsFrames:0,continuationNodes:0,maxDepth:0};
  const fragmentStats={intervals:0,probes:0,observationFrames:0,replayFrames:0};
  const policyRolloutStats={proposals:0,accepted:0,fallbacks:0,physicsFrames:0};
  const initialProposalWork=Object.fromEntries(['center','learned','memory','response','generic'].map(k=>[k,{attempts:0,viable:0,physicsFrames:0}]));
  const initializationRecovery:Array<{index:number;frame:number;proposals:number;viable:number;physicalFrames:number}>=[];
  const constructionImprovement:Array<{index:number;frame:number;proposals:number;viable:number;physicalFrames:number;before:number|null;after:number|null}>=[];
  const controlMemory=new ArcControlMemory(),constructionMemories=new Map<string,ArcControlMemory>();
  const memoryFor=(index:number)=>{
    if(options.memoryScope!=='construction')return controlMemory;
    // A locked research prefix cannot carry section-style overrides, but its
    // demonstrated controls still belong to the original requested constructor.
    const request=options.constructionRequests?.[index];
    const style={...options,...(options.sectionStyles?.[index]??(request?constructionStyle(request):{}))};
    const key=arcConstructionMemoryKey(style);
    let memory=constructionMemories.get(key);if(!memory){
      memory=new ArcControlMemory();
      for(const example of options.constructionExamples?.[key]??[])memory.rememberControl(example);
      constructionMemories.set(key,memory);
    }return memory;
  };
  for(const example of options.controlExamples??[])controlMemory.rememberControl(example);
  let pendingControl:{index:number;control:ArcMotionControl}|null=null;
  let deepestPrefix={lines:[] as TrackLine[],rows:[] as any[]};
  const backtrack=()=>{
    // Save completed intervals before destructively walking to an earlier fork.
    if(rows.length>deepestPrefix.rows.length)deepestPrefix={lines:lines.slice(),rows:rows.slice()};
    pendingControl=null;
    while(steps.length>resumeAt){
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
    if(options.directControls||options.replayControls)
      throw new Error('section styles require ordinary connected search');
    for(const [key,style] of Object.entries(options.sectionStyles)){
      const index=Number(key);
      if(!Number.isSafeInteger(index)||String(index)!==key||index<resumeAt||index>=contacts.length||
        !style||typeof style!=='object'||Array.isArray(style)||Object.keys(style).some(k=>!['guides','subdivisions','faces','profile','profileStrength','profileStart','rippleCycles','foldAngle','railLayout','independentGuide','alignedFoldEntry'].includes(k))||
        (style.railLayout!==undefined&&!['paired','transfer'].includes(style.railLayout))||
        (style.independentGuide!==undefined&&typeof style.independentGuide!=='boolean')||
        (style.guides!==undefined&&typeof style.guides!=='boolean')||
        !validProfileControls({...options,...style})||
        (style.subdivisions!==undefined&&(!Number.isFinite(style.subdivisions)||style.subdivisions<=0||style.subdivisions>4)))
        throw new Error('invalid section style or locked prefix override');
      arcMainSteps(1,style.subdivisions??options.subdivisions,style.faces??options.faces);
      const permission=options.fork&&(index===options.fork.section?options.fork.guides:options.fork.continuationGuides?.[index-options.fork.section]);
      if(permission!==undefined&&style.guides!==undefined&&permission!==style.guides)
        throw new Error('conflicting section style and fork guide permissions');
    }
  }
  if(options.replayControls&&options.replayControls.length!==contacts.length)throw new Error('replay controls do not cover the complete timeline');
  try{
    if(options.fork){
      const fork=options.fork;
      if(!Number.isSafeInteger(resumeAt)||resumeAt<0||resumeAt>=contacts.length||fork.rows.length!==resumeAt||
        JSON.stringify(fork.start)!==JSON.stringify(start)||typeof fork.guides!=='boolean')throw new Error('invalid arc fork prefix');
      if(fork.continuation&&fork.continuation.length!==contacts.length-resumeAt)throw new Error('arc fork controls do not cover the continuation');
      if(fork.continuationGuides&&(fork.continuationGuides.length!==contacts.length-resumeAt||fork.continuationGuides.some(g=>typeof g!=='boolean')))
        throw new Error('arc fork guide permissions do not cover the continuation');
      const fragments=new Set(fork.fragmentSections??[]);
      if(fragments.size!==(fork.fragmentSections??[]).length||[...fragments].some(i=>!Number.isSafeInteger(i)||i<0||i>=resumeAt))throw new Error('invalid fragment prefix sections');
      const groupIds=new Set(fork.lines.map(l=>Math.floor((l.id-1000)/10000)));
      arcRailGroups(fork.lines.filter(l=>!fragments.has(Math.floor((l.id-1000)/10000))));
      if(fork.lines.some(l=>l.type!==0)||new Set(fork.lines.map(l=>l.id)).size!==fork.lines.length||
        groupIds.size!==resumeAt||[...groupIds].some(i=>i<0||i>=resumeAt)||fork.rows.some((r,i)=>r.frame!==contacts[i].frame))
        throw new Error('arc fork prefix does not match the timeline');
      lines.push(...fork.lines);rows.push(...fork.rows.map(r=>({...r,spent:0})));
      for(let i=0;i<resumeAt;i++)steps.push({lineStart:0,choices:[]});
      disposeSearch();engine=rebuildArc(lines);
      const frame=contacts[resumeAt].frame-1;
      const stateSha256=createHash('sha256').update(JSON.stringify(getRiderMetered(engine,frame).ballisticState())).digest('hex');
      if(stateSha256!==fork.stateSha256)throw new Error('arc fork incoming state mismatch');
      forkEvidence={section:resumeAt,frame,prefixSha256:createHash('sha256').update(JSON.stringify(lines)).digest('hex'),stateSha256};
      if((options.memorySamples??0)>0)for(const [index,row] of rows.entries())if(row.frame>1)memoryFor(index).rememberControl({features:row.features,incoming:row.incoming,span:row.next-row.frame-1,control:row.control});
    }
    const compileOptions=options;
    const futureFeatures=(arrival:number[],i:number,count=2)=>{
      const features=[...arrival];
      for(let k=1;k<=count;k++){
        const contact=contacts[i+k],target=contact?planned.find(g=>g.startFrame===contact.frame)?.targets:undefined;
        features.push(contact?((contacts[i+k+1]?.frame??end+1)-contact.frame)/40:0,contact?(gaps[contact.gap]?.targets.impact??-1):-1,target?.air??-1,target?.speed??-1,target?.amplitude??-1);
      }
      return features;
    };
    const searchInterval=(engine:Engine,i:number,overrides:Partial<ArcMotionOptions>={},protectedEngines:Engine[]=[])=>{
      const options={...compileOptions,...overrides,...compileOptions.sectionStyles?.[i]};
      const nextRequest=options.constructionRequests?.[i+1];
      if(options.constructionAwareArrival&&nextRequest&&(nextRequest.context?.quiet??0)<.5&&(nextRequest.guidance==='forbidden'||nextRequest.railLayout==='transfer')){
        options.futureValueModel=undefined;
        options.arrivalMode='passive';options.headingWeight=0;
      }
      const controlMemory=memoryFor(i);
      if(options.fork?.continuationGuides&&i>=options.fork.section)options.guides=options.fork.continuationGuides[i-options.fork.section];
      if(options.fork&&i===options.fork.section)options.guides=options.fork.guides;
      // Once the timeline is complete, no future state needs a surrogate.
      // Time weights make the varying span/impact terms proportional to the
      // complete authored objective. Keep response-memory units consistent.
      if(options.terminalOptimization&&i===contacts.length-1){
        options.timeObjective=true;options.rescaleMemoryWeights=true;
        options.authoredHorizon=true;options.completeBoundary=true;
        options.amplitudeOverflow=undefined;options.predictAirBoundary=false;
      }
      const spanWeight=(g:typeof gaps[number],axis:string)=>options.timeObjective?impactCount*(g.endFrame-g.startFrame)/Math.max(1,axisFrames[axis]):1;
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
      const prefixRaw=options.cachePrefixReads?extractRawTrajectory(engine,frame-1):null;
      const incoming=deg(Math.atan2(velocity.y,velocity.x)),pace=Math.hypot(velocity.x,velocity.y);
      // A final authored contact can have no scored tail. Its support still
      // needs room to realize the impact and survive the unscored grace.
      const span=objectiveEnd>frame||i===0?objectiveEnd-(i===0?0:frame):horizon-frame;
      // The authored objective ends with the music; the final construction still
      // has the existing physical survival horizon. Do not clamp a requested
      // shape to two frames just because its last impact is near the song end.
      const constructionSpan=options.constructionRequests&&i===contacts.length-1?horizon-frame:span;
      const support=clamp((1-(targets.air??.5))*(constructionSpan+1),3,Math.max(3,constructionSpan-6));
      const impact=gap>=0?gaps[gap].targets.impact:undefined;
      if(impact!==undefined&&options.motionQuality?.calmImpactMultiplier!==undefined)
        options.impactWeight=(options.impactWeight??2)*(1+(options.motionQuality.calmImpactMultiplier-1)*Math.max(0,1-impact/.2));
      const turn=impact===undefined?5:deg(impactToRawPx(impact)/Math.max(3,pace));
      let best:any=null;const candidates:any[]=[];const failures:Record<string,number>={};
      type Near={c:ArcMotionControl;deficit:number;loss?:number};
      const near:Near[]=[],promising:Near[]=[];
      const rememberNear=(candidate:Near)=>{
        if(candidate.loss!==undefined){
          const merit=(r:Near)=>r.loss!+.04*r.deficit*r.deficit;
          const similar=promising.findIndex(n=>arcControlsSimilar(n.c,candidate.c));
          if(similar<0||merit(candidate)<merit(promising[similar])){
            if(similar>=0)promising.splice(similar,1);
            promising.push(candidate);promising.sort((a,b)=>merit(a)-merit(b));promising.length=Math.min(12,promising.length);
          }
        }
        const similar=near.findIndex(n=>arcControlsSimilar(n.c,candidate.c));
        if(similar>=0){if(near[similar].deficit<=candidate.deficit)return;near.splice(similar,1);}
        near.push(candidate);near.sort((a,b)=>a.deficit-b.deficit);near.length=Math.min(near.length,12);
      };

      let memo=options.memoCandidates?new Map<string,any>():null;
      const prefix=prefixes.get(engine);
      if(options.reuseEvaluations&&prefix&&!options.arrivalReference&&(!options.futureValueModel||options.futureValueModel===compileOptions.futureValueModel)){
        const context=prefixKey(prefix)+'|'+JSON.stringify([i,options.flow,options.channel,options.wave,options.radius,options.subdivisions,options.faces,options.profile,options.profileStrength,options.profileStart,options.rippleCycles,options.foldAngle,options.contour,options.guides,options.railLayout,options.independentGuide,
          options.amplitudeWeight,options.impactWeight,options.arrivalWeight,options.arrivalMode,options.headingWeight,options.poseWeight,options.collectValue,options.completeBoundary,options.authoredHorizon,options.timeObjective,options.amplitudeOverflow,options.predictAirBoundary,options.boundedSelection,options.terminalSelection,options.valueGuidanceWeight,options.constructionRequests?.[i],options.motionQuality,!!options.futureValueModel,!!options.constructionImprovementSamples,!!options.alignedFoldEntry]);
        const saved=memoContexts.get(context);
        if(saved){memo=saved;memoContexts.delete(context);}else memo=new Map();
        memoContexts.set(context,memo!);
        while(memoContexts.size>32)memoContexts.delete(memoContexts.keys().next().value!);
      }
      const objectiveAxes=(det:ReturnType<typeof detect>,g:typeof gaps[number],rangeEnd:number)=>{
        const axes=measureGapAxes(det,g,[],rangeEnd);
        if(options.predictAirBoundary&&g.endsWithContact&&rangeEnd===g.endFrame-1&&axes.air!==undefined){
          const samples=rangeEnd-g.startFrame+1;axes.air*=samples/(samples+1);
        }
        if(options.amplitudeOverflow&&g.targets.amplitude!==undefined&&axes.amplitude===1){
          const rawAmplitude=measureAmplitudePeakPx(det,g,rangeEnd)!/CALIB.AMPLITUDE_CAP;
          axes.amplitude=options.amplitudeOverflow==='raw'?rawAmplitude:1+Math.log(rawAmplitude);
        }
        return axes;
      };
      const priorGap=i>0?gaps[contacts[i].gap]:undefined;
      const priorAxes=options.completeBoundary&&priorGap
        ?objectiveAxes(detect(prefixRaw??extractRawTrajectory(engine,frame-1)),priorGap,frame-1):undefined;
      const weightedSpanLoss=(achieved:any,g:typeof gaps[number])=>['air','speed','amplitude'].reduce((sum,key)=>{
        const value=achieved[key],target=g.targets[key as keyof typeof g.targets];
        return sum+(value===undefined||target===undefined?0:(value-target)**2*(key==='amplitude'?(options.amplitudeWeight??1):1)*spanWeight(g,key));
      },0);
      const priorLoss=priorAxes&&priorGap?(options.timeObjective?weightedSpanLoss(priorAxes,priorGap):arcSpanLoss(priorAxes,priorGap.targets,options.amplitudeWeight??1)):0;
      const amplitudeExcess=(achieved:any,g:typeof gaps[number])=>{
        const value=achieved.amplitude,target=g.targets.amplitude;
        return value===undefined||target===undefined||value<=1?0:
          ((value-target)**2-(1-target)**2)*(options.amplitudeWeight??1)*spanWeight(g,'amplitude');
      };
      const controlContext={...options,span:constructionSpan};
      const evaluate=(c:ArcMotionControl,fragments?:{lines:TrackLine[];guideIds:number[]})=>{
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
        const added=fragments?.lines??motionArc(points,velocity,c,1000+i*10000,options.flow,options.channel,options.wave,options.radius,options.subdivisions,options);
        if(!added.length)return null;
        const child=addArc(engine,added);
        const prefixReusable=prefixRaw&&child.getLastFrameIndex()>=frame-1;
        if(added.length>=10000)throw new Error('arc geometry id range exhausted');
        const reject=(reason:string,near?:Near)=>{memo?.set(key,{reason,near});failures[reason]=(failures[reason]??0)+1;return null;};
        if(JSON.stringify(getRiderMetered(child,frame-1).ballisticState())!==before)return reject('prefix');
        const state=getRiderMetered(child,horizon).ballisticState();
        if(!state.riderMounted||!state.sledIntact)return reject('binding');
        const raw=prefixReusable?{duration:horizon,frames:[...prefixRaw!.frames,...extractRawTrajectoryWindow(child,frame,horizon).frames]}:extractRawTrajectory(child,horizon),det=detect(raw);
        if(det.terminus.reason!=='endOfSpec')return reject(det.terminus.reason);
        if(i>0&&!findAuthoredContactNearFrame(det,frame,1,frame-contacts[i-1].frame))return reject('missed');
        if(i===0&&!raw.frames.slice(1,4).some(f=>f.sledContacts.length))return reject('startup');
        if(det.events.some(e=>e.type==='landing'&&!frames.some(f=>Math.abs(e.frame-f)<=1)))return reject('offbeat');
        if(i<contacts.length-1&&!raw.frames.slice(-6).every(f=>f.sledContacts.length===0))return reject('late_release');
        const request=options.constructionRequests?.[i];
        let unfinished:{reason:string;near:Near}|undefined;
        if(request&&(request.construction==='scattered'?!!fragments:request.guidance==='required'||request.construction!=='arcs')){
          const guideIds=fragments?.guideIds??(arcRailGroups(added).get(i)![1]??[]).map(l=>l.id);
          const allContacts=request.context||request.railLayout==='transfer'?(frame:number)=>child.getAllContactLineIdsAtFrame(frame):undefined;
          const fulfillment=inspectConstructionWindow(request,added,new Set(guideIds),raw.frames,allContacts);
          if(!fulfillment.fulfilled){
            const nearby=options.constructionRecovery?{c,deficit:constructionDeficit(fulfillment)}:undefined;
            const reason='construction:'+fulfillment.reasons.join(',');
            if(options.constructionImprovementSamples){unfinished={reason,near:{c,deficit:constructionDeficit(fulfillment)}};}
            else{if(nearby)rememberNear(nearby);return reject(reason,nearby);}
          }
        }
        const achieved=measureGapAxes(det,{...outgoing,startFrame:i===0?0:frame,endFrame:objectiveEnd},added,objectiveEnd);
        const measuredObjective=options.amplitudeOverflow||options.predictAirBoundary?objectiveAxes(det,{...outgoing,startFrame:i===0?0:frame},objectiveEnd):achieved;
        const residuals:number[]=['air','speed','amplitude'].map(key=>targets[key as keyof typeof targets]===undefined?0:((measuredObjective as any)[key]-(targets as any)[key])*Math.sqrt((key==='amplitude'?(options.amplitudeWeight??1):1)*spanWeight(outgoing,key)));
        let overflowPenalty=options.boundedSelection?amplitudeExcess(measuredObjective,outgoing):0;
        let cost=residuals.reduce((s,x)=>s+x*x,0);
        let actualImpact:number|undefined;
        if(impact!==undefined){actualImpact=measureGapAxes(det,gaps[gap],added,frame).impact;if(actualImpact===undefined)return reject('impact');cost+=(options.impactWeight??2)*(actualImpact-impact)**2;}
        residuals.push(impact===undefined?0:Math.sqrt(options.impactWeight??2)*(actualImpact!-impact));
        if(options.completeBoundary&&priorGap){
          const actual=options.amplitudeOverflow?objectiveAxes(det,priorGap,priorGap.endFrame):measureGapAxes(det,priorGap,added,priorGap.endFrame);
          if(options.boundedSelection)overflowPenalty+=amplitudeExcess(actual,priorGap)-amplitudeExcess(priorAxes,priorGap);
          if(options.timeObjective){
            for(const key of ['air','speed','amplitude'] as const){
              if(actual[key]===undefined||priorGap.targets[key]===undefined)continue;
              const r=(actual[key]!-priorGap.targets[key]!)*Math.sqrt((key==='amplitude'?(options.amplitudeWeight??1):1)*spanWeight(priorGap,key));
              residuals.push(r);cost+=r*r;
            }
            cost-=priorLoss;
          }else{
            const correction=arcBoundaryCorrection(actual,priorGap.targets,priorLoss,options.amplitudeWeight??1,cost);
            residuals.push(...correction.residuals);cost=correction.cost;
          }
        }
        const motion=options.motionQuality?summarizeMotion(motionSamples(raw.frames,Math.max(1,frame),horizon,effectiveBodyVelocity(state)),frame):undefined;
        // Startup has no preceding impact, but the next authored landing still
        // provides musical context. Do not silently exempt its internal motion.
        const motionImpact=impact??request?.context?.nextImpact??undefined;
        const motionErrors=motion?motionResiduals(motion,motionImpact,options.motionQuality!):[];
        const motionCost=motionErrors.reduce((n,r)=>n+r*r,0);
        residuals.push(...motionErrors);cost+=motionCost;
        if(unfinished){unfinished.near.loss=cost;rememberNear(unfinished.near);return reject(unfinished.reason,unfinished.near);}
        const localCost=cost,priorStart=residuals.length;
        const finalVelocity=raw.frames.at(-1)!.velocity;
        if(i<contacts.length-1&&finalVelocity.x<1)return reject('unusable_arrival');
        // Keep future catches physically accessible; this is an optimizer prior,
        // never a change to the scored result.
        cost+=.01*Math.max(0,-finalVelocity.x/Math.max(1,pace))**2;
        if(i<contacts.length-1&&(options.arrivalWeight??0)>0){
          const nextImpact=gaps[contacts[i+1].gap].targets.impact??0;
          const nextSpeed=authoredSpeedToPx(planned[contacts[i+1].gap+1]?.targets.speed??targets.speed??.55);
          const passive=options.arrivalMode==='passive'&&options.constructionRequests?.[i+1]?.guidance==='forbidden';
          // A passive catch redirects incoming speed into the next surface.
          // Prepare kinetic headroom instead of asking an unguided landing to
          // both dissipate a strong impulse and retain the incoming speed.
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
        const arrivalPose=Math.atan2(dy,dx),headingAngle=Math.atan2(finalVelocity.y,finalVelocity.x);
        const angularRate=(dx*(nose.vy-tail.vy)-dy*(nose.vx-tail.vx))/Math.max(1,dx*dx+dy*dy);
        if(i<contacts.length-1&&(options.poseWeight??0)>0){
          const difference=Math.atan2(Math.sin(arrivalPose-headingAngle),Math.cos(arrivalPose-headingAngle));
          const r1=Math.sqrt(options.poseWeight??0)*difference/(Math.PI/3),r2=Math.sqrt((options.poseWeight??0)*.2)*angularRate/.15;
          residuals.push(r1,r2);cost+=r1*r1+r2*r2;
        }
        if(options.arrivalReference){
          const target=options.arrivalReference,weight=Math.sqrt((options.boundaryWeight??1)/10);
          const here=state.points.PEG,there=target.state.points.PEG;
          for(const key of Object.keys(state.points)){
            const a=state.points[key],b=target.state.points[key];
            for(const r of [weight*((a.x-here.x)-(b.x-there.x))/18,weight*((a.y-here.y)-(b.y-there.y))/18,weight*(a.vx-b.vx)/7.2,weight*(a.vy-b.vy)/7.2]){residuals.push(r);cost+=r*r;}
          }
        }
        const terminalLoss=options.terminalSelection&&i===contacts.length-1?arcDetectedTrajectoryObjective(det,gaps,options.amplitudeWeight).loss+motionCost/contacts.length:undefined;
        const release=raw.frames.slice().reverse().find(f=>f.sledContacts.length)?.frame;
        const finalState=state.points;
        const heading=deg(Math.atan2(finalVelocity.y,finalVelocity.x)),endSpeed=Math.hypot(finalVelocity.x,finalVelocity.y);
        const pose=deg(Math.atan2(finalState.NOSE.y-finalState.TAIL.y,finalState.NOSE.x-finalState.TAIL.x));
        viableCandidates++;
        const valueFeatures=options.collectValue||options.futureValueModel?futureFeatures(arcArrivalFeatures(state,heading,endSpeed,pose,angularRate,horizon-(release??frame)),i):undefined;
        const predictedFuture=options.futureValueModel?arcFutureValue(valueFeatures!,options.futureValueModel):undefined;
        const guided=arcValueGuidance(cost,localCost,residuals,priorStart,predictedFuture,
          i<contacts.length-1?options.valueGuidanceWeight??0:0);
        const result={child,lines:added,c,cost,localCost,residuals:guided.residuals,optimizationCost:guided.cost,
          achieved,actualImpact,terminalLoss,release,railGuides:fragments?.guideIds,motion,motionCost};
        candidates.push({lines:added,c,cost:cost-overflowPenalty,localCost:localCost-overflowPenalty,
          searchCost:cost,residuals,heading,endSpeed,pose,valueFeatures,predictedFuture,terminalLoss,meta:{achieved,impact:actualImpact,release:result.release,lines:added.length,railGuides:fragments?.guideIds,motion,motionCost}});
        // Interrupted evaluations never reach this cache insertion.
        if(memo){const {child:_child,...measurement}=result;memo.set(key,{result:measurement,candidate:{...candidates.at(-1)}});}
        if(!best||guided.cost<best.optimizationCost)best=result;
        return result;
      };
      // These describe the immutable incoming prefix already measured above.
      // Reusing them avoids a new physics read after committing the search budget.
      const arrivalFeatures=arcPolicyArrival(beforeState,velocity),inputFeatures=futureFeatures(arrivalFeatures,i-1);
      // Only the learned proposal receives the longer authored window. Keep
      // response-memory and future-value inputs in their original units.
      const policyInputFeatures=options.controlPolicy?.featureCount===67?futureFeatures(arrivalFeatures,i-1,4):inputFeatures;
      let center:ArcMotionControl|undefined;
      const selectBounded=()=>{
        if(!options.boundedSelection||!best)return;
        const selected=candidates.reduce((a,b)=>a.cost<=b.cost?a:b);
        const child=JSON.stringify(selected.c)===JSON.stringify(best.c)?best.child:addArc(engine,selected.lines);
        best={...best,child,lines:selected.lines,c:selected.c,cost:selected.cost,
          localCost:selected.localCost,residuals:selected.residuals,achieved:selected.meta.achieved,
          actualImpact:selected.meta.impact,release:selected.meta.release};
      };
      try {
      if(options.directControls){for(const control of options.directControls)evaluate(control);selectBounded();}
      else {
      if(options.policyRollout){
        const model=i===0?options.controlPolicy?.startupModel:options.controlPolicy;
        const began=getPhysicsFrameCount();
        try{
          if(model)for(const control of arcControlProposals(policyInputFeatures,incoming,span,model,1,options.controlDiversity)){
            policyRolloutStats.proposals++;
            if(evaluate(control)){
              policyRolloutStats.accepted++;
              return {best,candidates,failures,frame,next,horizon,gap,outgoing,targets,incoming,pace,support,span,inputFeatures};
            }
          }
        }finally{policyRolloutStats.physicsFrames+=getPhysicsFrameCount()-began;}
        policyRolloutStats.fallbacks++;
        if(options.policyRolloutStrict)return {best,candidates,failures,frame,next,horizon,gap,outgoing,targets,incoming,pace,support,span,inputFeatures};
      }
      // Guide permission, not an inactive clearance setting, determines which
      // initialization is physically appropriate for an unguided support.
      const guidedInitialization=options.guides!==false&&!!options.channel;
      center=options.flow||guidedInitialization?{entry:incoming-.5,turn:-turn/(options.wave?2:1),exit:clamp(incoming-turn,-70,70),support,bias:0,offset:.1}:{entry:incoming-Math.min(12,turn*.3),turn:-Math.min(35,turn*.7),exit:clamp(incoming-25,-40,45),support,bias:0,offset:.1};
      if(options.bidirectional&&guidedInitialization&&incoming<15){center.turn=Math.abs(center.turn);center.exit=clamp(incoming+turn,-70,70);}
      const max=options.samples??160,initial=options.localOnly?0:Math.min(80,Math.ceil(max/2));
      const responseAxisWeights=options.rescaleMemoryWeights?['air','speed','amplitude'].map(key=>spanWeight(outgoing,key)*(key==='amplitude'?(options.amplitudeWeight??1):1)).concat(options.impactWeight??2):undefined;
      const remembered=controlMemory.proposeControls(inputFeatures,incoming,span,options.memorySamples??0,options.controlDiversity,options.constructionProposals&&options.railLayout==='transfer'?'both':'relative');
      const responses=controlMemory.proposeResponses(inputFeatures,incoming,span,
        [targets.air,targets.speed,targets.amplitude,impact],options.memoryResponseSamples??0,
        {amplitude:options.amplitudeWeight??1,impact:options.impactWeight??2,damping:options.responseDamping??.0002,axisWeights:responseAxisWeights},options.controlDiversity);
      // Startup has a different physical-state distribution from a later catch.
      // Its optional learned proposals still pass the ordinary interval search.
      const proposalModel=i===0?options.controlPolicy?.startupModel:options.controlPolicy;
      const requested=[proposalModel?options.policySamples??8:0,remembered.length,responses.length];
      // The inherited model already covers ordinary arcs. Reserve new geometry
      // proposals where its training constructor differs from this request.
      const novelConstructor=!!options.profile||options.railLayout==='transfer';
      const reservedGeneric=options.constructionProposals?Math.ceil(initial*(options.genericProposalFraction??(novelConstructor?.25:0))):0;
      const counts=options.budgetedProposals?allocateArcProposalSlots(requested,Math.max(0,initial-1-reservedGeneric)):requested;
      const policy=counts[0]?arcControlProposals(policyInputFeatures,incoming,span,proposalModel,counts[0],options.controlDiversity):[];
      const learnedEnd=policy.length,memoryEnd=learnedEnd+Math.min(remembered.length,counts[1]);
      policy.push(...remembered.slice(0,counts[1]),...responses.slice(0,counts[2]));
      const reference=options.fork?.continuation?.[i-options.fork.section];
      if(reference){
        evaluate(reference.control);
        evaluate(arcReferencedControl(reference,incoming,span));
      }
      if(options.warmStart){
        evaluate(options.warmStart);
        if(options.warmIncoming!==undefined&&options.warmIncoming!==incoming)
          evaluate({...options.warmStart,entry:options.warmStart.entry+incoming-options.warmIncoming,
            exit:options.warmStart.exit+incoming-options.warmIncoming});
      }
      const genericInitial=(k:number)=>{
        const frac=(n:number)=>((k+1)*n)%1;
        const control:ArcMotionControl={entry:incoming-((options.flow||guidedInitialization)&&k%2===0?(-1+frac(.61803398875)*6):(2+frac(.61803398875)*Math.min(32,turn+10))),turn:(options.bidirectional&&k%4<2?1:-1)*frac(.41421356237)*Math.min(options.flow?110:60,turn+25),exit:-45+frac(.73205080757)*110,support:support*(.45+frac(.2360679775)*1.2),bias:-1.5+3*frac(.6457513111),offset:-.25+frac(.3166247903)*1.5,
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
        return control;
      };
      for(let k=0;k<initial;k++){
        const stream=k===0?'center':k<=learnedEnd?'learned':k<=memoryEnd?'memory':k<=policy.length?'response':'generic';
        const accounting=initialProposalWork[stream],began=getPhysicsFrameCount();accounting.attempts++;
        try{if(evaluate(k>0&&k<=policy.length?policy[k-1]:k===0?center:genericInitial(k)))accounting.viable++;}
        finally{accounting.physicsFrames+=getPhysicsFrameCount()-began;}
        if(k%10===9)Engine.retainOnly([...protectedEngines,...(best?[engine,best.child]:[engine])]);
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
      if(promising.length&&(options.constructionImprovementSamples??0)>0){
        const began=getPhysicsFrameCount(),record={index:i,frame,proposals:0,viable:0,physicalFrames:0,before:best?.localCost??null,after:best?.localCost??null};
        constructionImprovement.push(record);
        const keys=arcMethodKeys('response',true,false,options.guides,options);
        try{
          for(let k=0;k<options.constructionImprovementSamples!;k++){
            let proposal=genericInitial(initial+(options.initialRecoverySamples??0)+k+1);
            if(k%4!==3){
              const trial=k-Math.floor(k/4),key=keys[Math.floor(trial/2)%keys.length];
              const anchor=promising[Math.floor(trial/(2*keys.length))%Math.min(4,promising.length)].c;
              const step=arcControlStep(key,'coordinate',anchor.support)*Math.pow(.7,Math.floor(trial/(8*keys.length)));
              proposal={...anchor,[key]:arcControlValue(anchor,key,options.channel)+(trial%2?-1:1)*step};
            }
            record.proposals++;if(evaluate(proposal))record.viable++;
            if(k%10===9)Engine.retainOnly([...protectedEngines,engine,...(best?[best.child]:[])]);
          }
        }finally{record.physicalFrames=getPhysicsFrameCount()-began;record.after=best?.localCost??null;}
      }
      if(best){
        const keys=ARC_CORE_KEYS;
        let local=initial;
        if(options.solver==='newton'){
          for(let iteration=0;iteration<4&&local+2*keys.length+3<max;iteration++){
            const origin=best, scale=keys.map(key=>arcControlStep(key,'newton',options.constructionProposals?origin.c.support:support));
            const jac=origin.residuals.map(()=>Array(keys.length).fill(0));
            for(let d=0;d<keys.length;d++){
              const key=keys[d], a=evaluate({...origin.c,[key]:origin.c[key]+scale[d]}),b=evaluate({...origin.c,[key]:origin.c[key]-scale[d]});local+=2;
              for(let r=0;r<jac.length;r++)jac[r][d]=a&&b?(a.residuals[r]-b.residuals[r])/2:a?a.residuals[r]-origin.residuals[r]:b?origin.residuals[r]-b.residuals[r]:0;
            }
            const delta=arcResponseStep(jac,origin.residuals,.002);
            for(const damping of [1,.5,.25]){
              if(delta){const c={...origin.c};keys.forEach((key,d)=>c[key]=arcControlValue(c,key,options.channel)+damping*scale[d]*clamp(delta[d],-4,4));evaluate(c);}local++;
            }
            Engine.retainOnly([...protectedEngines,engine,best.child]);
          }
        }
        for(let k=local;k<max;k++){
          const key=keys[Math.floor((k-initial)/2)%keys.length],round=Math.floor((k-initial)/(2*keys.length)),sign=k%2===0?-1:1;
          const candidate={...best.c,[key]:best.c[key]+sign*arcControlStep(key,'coordinate',options.constructionProposals?best.c.support:support)*Math.pow(.65,Math.floor(round/2))};
          evaluate(candidate);
          if(k%10===9)Engine.retainOnly([...protectedEngines,engine,best.child]);
        }
      }
      if(best&&options.guidance){
        const origin=best;
        const exitEnabled=options.independentExit&&best.c.support>=(options.minExitSupport??0);
        const responseKeys=arcMethodKeys('response',!!options.expressive,!!exitEnabled,options.guides,options);
        const wantedResponse=Math.min(options.guidanceSamples??48,options.responseSamples??0);
        const responseRound=2*responseKeys.length+3;
        const responseAllowance=options.completeGuidanceBudget?Math.floor(wantedResponse/responseRound)*responseRound:wantedResponse>=responseRound?wantedResponse:0;
        const count=(options.guidanceSamples??48)-responseAllowance;
        let keys:(keyof ArcMotionControl)[]=options.guidance==='span'?['guideStart','guideEnd']:options.guidance==='clearance'?['clearance']:['clearance','guideStart','guideEnd'];
        if(options.guidanceJoint)keys.push(...ARC_CORE_KEYS);
        if(options.expressive)keys.push(...ARC_EXPRESSIVE_KEYS);
        if(options.independentGuide)keys.push('guideTilt');
        if(exitEnabled)keys.push('exitBias');
        keys=keys.filter(key=>arcControlActive(key,options.guides,options));
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
            if(exitEnabled)c.exitBias=k>0?-2+4*frac(.9159655941):c.exitBias??c.bias;
            if(options.guidance!=='clearance'){
              c.guideStart=k%3===0?0:frac(.41421356237)*.7;
              c.guideEnd=k===0?0:k%3===1?1:Math.max(c.guideStart,frac(.73205080757));
            }
          }else{
            const key=keys[Math.floor(k/2)%keys.length],step=arcControlStep(key,'coordinate',options.constructionProposals?best.c.support:support);
            c={...best.c,...(exitEnabled?{exitBias:best.c.exitBias??best.c.bias}:{}),[key]:arcControlValue(best.c,key,options.channel)+(k%2===0?-1:1)*step*Math.pow(.6,Math.floor((k-broad)/(keys.length*4)))};
          }
          evaluate(c);if(k%8===7)Engine.retainOnly([...protectedEngines,engine,best.child]);
        }
        let responseUsed=0, trust=options.responseScale??1;
        let secant:{jac:number[][];trust:number;uses:number}|null=null;
        while(responseUsed+(secant?3:2*responseKeys.length+3)<=responseAllowance){
          const origin=exitEnabled?{...best,c:{...best.c,exitBias:best.c.exitBias??best.c.bias}}:best,scale=(key:keyof ArcMotionControl)=>arcControlStep(key,'response',options.constructionProposals?origin.c.support:support);
          const value=(key:keyof ArcMotionControl)=>arcControlValue(origin.c,key,options.channel);
          const reused=secant!==null;
          const jac=reused?secant!.jac:origin.residuals.map(()=>Array(responseKeys.length).fill(0));
          if(reused)trust=secant!.trust;
          if(!reused)responseKeys.forEach((key,d)=>{
            const step=scale(key)*trust;
            const a=evaluate({...origin.c,[key]:value(key)+step}),b=evaluate({...origin.c,[key]:value(key)-step});responseUsed+=2;
            for(let r=0;r<jac.length;r++)jac[r][d]=a&&b?(a.residuals[r]-b.residuals[r])/2:a?a.residuals[r]-origin.residuals[r]:b?origin.residuals[r]-b.residuals[r]:0;
          });
          if(!reused&&(options.memoryResponseSamples??0)>0){
            controlMemory.rememberResponse({features:inputFeatures,incoming,span,
              control:{...origin.c,...Object.fromEntries(responseKeys.map(key=>[key,value(key)]))},
              targets:[targets.air,targets.speed,targets.amplitude,impact],keys:responseKeys.slice(),
              jac:jac.slice(0,4),residuals:origin.residuals.slice(0,4),
              axisWeights:responseAxisWeights,
              scale:responseKeys.map(key=>scale(key)*trust),
              loss:origin.residuals.slice(0,4).reduce((sum:number,v:number)=>sum+v*v,0)});
          }
          const delta=arcResponseStep(jac,origin.residuals,options.responseDamping??.0002);
          for(const fraction of [1,.5,.25]){
            if(delta){const c={...origin.c};responseKeys.forEach((key,d)=>c[key]=value(key)+fraction*scale(key)*trust*clamp(delta[d],-3,3));evaluate(c);}responseUsed++;
          }
          const improving=best.optimizationCost<origin.optimizationCost-1e-12;
          const previousUses:number=secant?.uses??0;
          if(improving&&(options.responseSecantSteps??0)>0&&previousUses<options.responseSecantSteps!){
            const displacement=responseKeys.map(key=>((best.c[key]??value(key))-value(key))/(scale(key)*trust));
            const updated=arcSecantUpdate(jac,displacement,best.residuals.map((v:number,r:number)=>v-origin.residuals[r]));
            secant=updated?{jac:updated,trust,uses:previousUses+1}:null;
          }else secant=null;
          if(!improving)trust*=.5;
          Engine.retainOnly([...protectedEngines,engine,best.child]);
        }
      }
      for(let pass=0;best&&targets.air!==undefined&&pass<(options.airProjection??0);pass++){
        const origin=best,measuredSamples=objectiveEnd-(i===0?0:frame)+1;
        const airborne=origin.achieved.air*measuredSamples;
        const wanted=Math.round(targets.air*(outgoing.endFrame-outgoing.startFrame+1));
        const counts=outgoing.endsWithContact?[wanted,wanted-1]:[wanted];
        const first=origin.c.turnFraction===undefined?Math.min(options.wave?6:5,origin.c.support*.5):origin.c.support*origin.c.turnFraction;
        for(const count of counts)for(const fraction of [.6,1,1.4]){
          const delta=clamp((airborne-count)*fraction,-Math.max(2,.2*span),Math.max(2,.2*span));
          if(Math.abs(delta)<.05)continue;
          const adjusted=Math.max(2,origin.c.support+delta);
          evaluate({...origin.c,support:adjusted,turnFraction:first/adjusted});
        }
        Engine.retainOnly([...protectedEngines,engine,best.child]);
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
      selectBounded();
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
      Math.abs(a.pose-b.pose)>7||Math.abs(a.meta.release-b.meta.release)>(options.releaseDiversity??2);
    const distinct=(candidates:any[],width:number)=>{
      const result:any[]=[];
      for(const candidate of candidates.slice().sort((a,b)=>valueRank(a)-valueRank(b))){
        if(result.every(a=>distinctArrival(a,candidate)))result.push(candidate);
        if(result.length>=width)break;
      }
      return result;
    };
    const continuation=(base:Engine,index:number,depth:number,probeSamples:number,protectedEngines:Engine[]):any=>{
      const searched=searchInterval(base,index,{samples:probeSamples,
        constructionImprovementSamples:0,
        guidanceSamples:options.continuationGuidanceSamples??Math.min(12,options.guidanceSamples??48),
        responseSamples:options.continuationResponseSamples??options.responseSamples},protectedEngines);
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
      for(const candidate of distinct(searched.candidates,options.lookaheadBranching??2)){
        const branch=addArc(base,candidate.lines);
        const tail=continuation(branch,index+1,depth-1,probeSamples,[...protectedEngines,base,anchor.child]);
        if(tail){
          completed++;
          const value=candidate.localCost+(options.lookaheadWeight??1)*tail.value;
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
    for(let i=resumeAt;i<contacts.length;i++){
      let terminalChildLines:TrackLine[]|null=null;
      const localStart=getPhysicsFrameCount();
      const overrides:Partial<ArcMotionOptions>=pendingControl?.index===i?{warmStart:pendingControl.control}:{};
      if(options.fork&&i===resumeAt&&options.fork.control)overrides.warmStart=options.fork.control;
      if(options.replayControls)overrides.warmStart=options.replayControls[i];
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
      const interval=searchInterval(engine,i,overrides);
      if(interval){const rate=(getPhysicsFrameCount()-localStart)/Math.max(1,interval.next-interval.frame)/localScale;observedConstructionRate=observedConstructionRate ? .8*observedConstructionRate+.2*rate : rate;}
      pendingControl=null;
      if(!interval){failure={frame:contacts[i].frame,reason:'contact_spacing'};break;}
      let {best}=interval;
      const {candidates,failures,frame,next,horizon,gap,outgoing,targets,incoming,pace,center,support}=interval;
      let lookahead:any=null;
      if(best&&(options.lookaheadWidth??0)>1&&i+1<contacts.length){
        let width=options.lookaheadWidth!, probeSamples=options.lookaheadSamples??32,depth=Math.max(1,options.lookaheadDepth??1);
        const probeRate=()=>options.continuationGuidanceSamples===undefined?1.4:
          1+options.continuationGuidanceSamples/probeSamples;
        const nominalRate=(options.samples??160)+(options.guidance?options.guidanceSamples??48:0);
        const constructionReserveRate=(options.adaptivePlanning?Math.max(nominalRate,observedConstructionRate):nominalRate)*(options.reserveFactor??1.1);
        if(options.adaptivePlanning){
          const remaining=Math.max(1,end-frame),rate=(budget-getPhysicsFrameCount()-2*(end+1))/remaining;
          const localAllowance=Math.max(0,rate-constructionReserveRate)*(next-frame);
          for(let d=Math.min(options.planningDepth??2,contacts.length-i-1);d>=1;d--){
            let framesPerProbe=0;
            for(let k=0;k<d;k++)framesPerProbe+=Math.pow(options.lookaheadBranching??2,k)*((contacts[i+k+2]?.frame??end+1)-contacts[i+k+1].frame)*(probeRate()+6*(options.airProjection??0)/probeSamples);
            const affordable=localAllowance/Math.max(1,framesPerProbe);
            if(affordable<width*probeSamples)continue;
            width=Math.max(width,Math.min(options.planningWidth??5,Math.floor(affordable/probeSamples)));
            probeSamples=Math.max(probeSamples,Math.min(options.planningSamples??48,Math.floor(affordable/width)));
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
          for(let d=0;d<depth&&i+d+1<contacts.length;d++)probeAllowance+=Math.pow(options.lookaheadBranching??2,d)*((contacts[i+d+2]?.frame??end+1)-contacts[i+d+1].frame)*probeSamples*(probeRate()+6*(options.airProjection??0)/probeSamples);
          if(getPhysicsFrameCount()+reserve+probeAllowance>budget-2*(end+1))break;
          const branch=addArc(engine,candidate.lines);
          const future=continuation(branch,i+1,depth,probeSamples,[engine,original.child]);
          lookaheadStats.probes++;
          if(!future)lookaheadStats.failedProbes++;
          lookaheadStats.maxDepth=Math.max(lookaheadStats.maxDepth,future?.depth??0);
          const terminal=options.lookaheadObjective==='terminal'||depth>1;
          let value=future?(terminal?candidate.localCost:candidate.cost)+(options.lookaheadWeight??1)*(terminal?future.value:future.localValue):Infinity;
          if(future&&options.valueSelection&&candidate.predictedFuture!==undefined)value+=(options.valueWeight??.5)*(candidate.localCost+candidate.predictedFuture-value);
          if(options.reuseContinuations){candidate.lookaheadValue=value;candidate.futureControl=future?.control;}
          probes.push({control:candidate.c,currentCost:candidate.cost,localCost:candidate.localCost,futureCost:future?.value??null,depth:future?.depth??0,value:Number.isFinite(value)?value:null,valueFeatures:options.collectValue?candidate.valueFeatures:undefined,predictedFuture:candidate.predictedFuture});
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
          best={...original,child:addArc(engine,c.lines),lines:c.lines,c:c.c,cost:c.cost,localCost:c.localCost,achieved:c.meta.achieved,actualImpact:c.meta.impact,release:c.meta.release};
          lookaheadStats.changedChoices++;
        }
        if(winner&&options.lookaheadWarmStart!==false)pendingControl={index:i+1,control:winner.futureControl};
        lookaheadStats.physicsFrames+=getPhysicsFrameCount()-startFrames;
        lookahead={probes,selected:winner?.candidate.c??original.c};
      }
      // A quality retry resumes at an earlier fork and rebuilds its engine.
      // Estimate from that boundary, including its cold prefix, rather than
      // granting a retry using only the shorter suffix at the current contact.
      let retryIndex=steps.length-1;
      while(retryIndex>=0&&!steps[retryIndex].choices.length)retryIndex--;
      const retryFrame=retryIndex<0?frame:rows[retryIndex].frame;
      if(best&&!options.replayControls&&(options.qualityRetries??0)>0&&targets.speed!==undefined&&Math.abs(best.achieved.speed-targets.speed)>.3&&
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
          best={...best,lines:selected.lines,c:selected.c,cost:selected.cost,localCost:selected.localCost,
            achieved:selected.meta.achieved,actualImpact:selected.meta.impact,release:selected.meta.release};
        }
      }
      if(options.replayControls){
        const forced=candidates.find(c=>JSON.stringify(c.c)===JSON.stringify(options.replayControls![i]));
        if(!forced)throw new Error('replayed control failed physical interval validation at '+i);
        const objectiveEnd=options.authoredHorizon?Math.min(horizon,duration):horizon;
        const span=objectiveEnd>frame||i===0?objectiveEnd-(i===0?0:frame):horizon-frame;
        teacherRows.push({index:i,frame,features:interval.inputFeatures,
          incoming,span,control:best.c,localCost:best.localCost,cost:best.cost,
          physicalIntervalValidated:true,forcedControl:forced.c,lookahead});
        terminalChildLines=forced.lines;
        best={...best,lines:forced.lines,c:forced.c,cost:forced.cost,localCost:forced.localCost,
          achieved:forced.meta.achieved,actualImpact:forced.meta.impact,release:forced.meta.release};
        pendingControl=null;
      }
      failure=null;
      const alternatives:any[]=[];
      const planRank=(c:any)=>c.lookaheadValue===undefined?1:Number.isFinite(c.lookaheadValue)?0:2;
      for(const candidate of candidates.sort((a,b)=>options.reuseContinuations?(planRank(a)-planRank(b)||((a.lookaheadValue??a.cost)-(b.lookaheadValue??b.cost))):a.cost-b.cost)){
        if(alternatives.every(a=>distinctArrival(a,candidate)))alternatives.push(candidate);
        if(alternatives.length>=12)break;
      }
      steps.push({lineStart:lines.length,choices:alternatives.filter(a=>JSON.stringify(a.c)!==JSON.stringify(best.c))});
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
      if(options.diagnostic)process.stderr.write(JSON.stringify(rows.at(-1))+'\n');
    }
    if(!failure&&(options.refineAttempts??0)>0&&rows.length===contacts.length){
      setPhysicsFrameLimit(finalBudget-2*(end+1));
      const requests=Object.values(options.constructionRequests??{});
      const validate=requests.length?(candidate:Engine,geometry:TrackLine[],raw:any,candidateRows:any[])=>requests.every(request=>{
        const section=geometry.filter(l=>Math.floor((l.id-1000)/10000)===request.section);
        const guideIds=request.construction==='scattered'?candidateRows[request.section]?.railGuides??[]:(arcRailGroups(section).get(request.section)?.[1]??[]).map(l=>l.id);
        return inspectConstructionWindow(request,section,new Set<number>(guideIds),raw.frames,
          request.context||request.railLayout==='transfer'?(frame:number)=>candidate.getAllContactLineIdsAtFrame(frame):undefined).fulfilled;
      }):undefined;
      const objective=options.wholeTrackRefinement?(raw:any,report:any)=>{
        const whole=arcWholeTrajectoryObjective(raw,report,gaps,options.amplitudeWeight);
        if(options.motionQuality&&Number.isFinite(whole.loss)){
          const observed=motionSamples(raw.frames,1,duration);
          for(const request of requests){
            const samples=observed.filter(s=>s.frame>=request.frame&&s.frame<request.next);
            if(!samples.length)continue;
            const impact=request.context?.impact??(request.section?gaps[request.section-1]?.targets.impact:request.context?.nextImpact)??undefined;
            const extra=motionResiduals(summarizeMotion(samples,request.frame),impact,options.motionQuality).reduce((n,v)=>n+v*v,0)/contacts.length;
            whole.loss+=extra;whole.regrets[request.section]+=extra;
          }
        }
        return whole;
      }:undefined;
      const refined=refineArcTrack({engine,lines,rows,alternatives:steps.map(s=>s.choices),contacts,end,start,budget:finalBudget,options,search:searchInterval,report:reportFor,
        objective,validate,from:resumeAt,engines:requests.length?{create:rebuildArc,add:addArc,detach:detachArc}:undefined});
      lines.splice(0,lines.length,...refined.lines);rows.splice(0,rows.length,...refined.rows);
      engine=refined.engine;refinementStats=refined.stats;
    }
  }catch(error){if(!(error instanceof PhysicsFrameLimitExceeded))throw error;searchBudgetExhausted=true;failure={reason:'budget'};}
  if(failure&&deepestPrefix.rows.length>rows.length){
    lines.splice(0,lines.length,...deepestPrefix.lines);rows.splice(0,rows.length,...deepestPrefix.rows);
  }
  const constructionFrames=getPhysicsFrameCount();
  setPhysicsFrameLimit(finalBudget);
  const coldEngine=createArcEngine(start,lines);
  raw=extractRawTrajectory(coldEngine,end);
  // Structured rails are indivisible: guide-only pruning would tear their contours.
  const fragments=new Set(Object.values(options.constructionRequests??{}).filter(r=>r.construction==='scattered').map(r=>r.section));
  const guidanceReduction=options.pruneGuidance&&!options.contour?trimUnusedArcGuides(lines,coldEngine,end,resumeAt,fragments):null;
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
  disposeSearch();
  try{const base=new Judge().setStart(start.position,start.velocity);const replay=extractRawTrajectory(lines.length?base.addLine(lines):base,end);if(JSON.stringify(replay)!==JSON.stringify(raw))throw new Error('fixed-engine replay mismatch');}finally{disposeJudge();setPhysicsFrameLimit(null);}
  const report=reportFor(raw,lines);
  const trajectoryLoss=options.collectTrajectoryLoss?arcWholeTrajectoryObjective(raw,report,gaps,options.amplitudeWeight).loss:undefined;
  return{track:buildTrackJson(lines,end,start),report,...(hasFragments?{fragmentStats}:{}),...(options.initialRecoverySamples?{initializationRecovery}:{}),stats:{viable_candidate_samples:viableCandidates,sim_frames:getPhysicsFrameCount(),gap_commits:report.contacts.filter(c=>c.status==='hit').length},rows,teacherRows,initialProposalWork,constructionImprovement,failure,budget:finalBudget,searchBudgetExhausted,budgetInterruptions,candidateMemo:{hits:memoHits,rejectedHits:memoRejectedHits},samples,backtracks,qualityRetries:Object.fromEntries(qualityRetries),lookaheadStats,policyRolloutStats,trajectoryLoss,planningDecisions,refinementStats,terminalSelectionStats,guidanceReduction:guidanceReduction?.stats??null,constructionFrames,...(forkEvidence?{forkEvidence}:{})};
  }finally{disposeSearch();disposeJudge();setPhysicsFrameLimit(null);}
}
