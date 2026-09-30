/** Bounded research traversal of same-state guide choices. Production does not
 * call this. All branches and prefix verification share a declared total cost. */
import {createHash} from 'node:crypto';
import {compileArcMotion,type ArcMotionFork,type ArcMotionOptions} from './arc_motion.ts';
import {connectedArcOptions} from './connected_arcs.ts';
import {createArcEngine} from './arc_engine.ts';
import {disposeAllWasmEnginesForStudy as dispose} from '../../lib/native_motion/engine.ts';
import {getPhysicsFrameCount,getRiderMetered} from '../../lib/detector.ts';
import {guideFootprint,measuredGuideAlternative,compareGuideFootprint,guideCoverageFrontier} from './arc_guide_choice.ts';
import {arcRailGroups} from './arc_guidance.ts';
import type {Spec} from '../types.ts';
type Result=ReturnType<typeof compileArcMotion>;
const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function captureArcFork(result:Pick<Result,'track'|'rows'>,section:number){
  const row=result.rows[section];
  if(!row||!Number.isSafeInteger(section)||section<0)throw new Error('invalid fork section');
  const start={position:result.track.startPosition,velocity:result.track.riders![0].startVelocity};
  const lines=result.track.lines.filter(l=>Math.floor((l.id-1000)/10000)<section);
  const began=getPhysicsFrameCount(),frame=row.frame-1;
  try{
    const full=createArcEngine(start,result.track.lines),prefix=createArcEngine(start,lines);
    const expected=getRiderMetered(full,frame).ballisticState(),actual=getRiderMetered(prefix,frame).ballisticState();
    if(sha(expected)!==sha(actual))throw new Error('removing the future changed the incoming physical state');
    const fork:ArcMotionFork={section,start,lines,rows:result.rows.slice(0,section),stateSha256:sha(actual),guides:true,control:row.control};
    return {fork,physicsFrames:getPhysicsFrameCount()-began,prefixSha256:sha(lines),frame};
  }finally{dispose();}
}

export type GuideStudyOptions={
  /** Keep one path, both extremes, or accuracy plus the lowest marginal
   * target-error cost per removed guided section. Select from all measured tracks. */
  exploration?:'least-guidance'|'accuracy-and-guidance'|'balanced'|'coverage'|'coverage-focused';
  coverageWidth?:number;
  /** Rebuild later geometry with the source's guide permissions, rather than
   * granting guides again everywhere beyond the chosen section. */
  preserveGuidePattern?:boolean;
  /** Geometry-only override; facets use the same search and fork contract. */
  geometry?:Pick<ArcMotionOptions,'subdivisions'>;
  /** Reuse measured source controls as physically adapted proposals. */
  sourceMemory?:boolean;
  /** Seed each rebuilt section directly from the corresponding source curve. */
  sourceContinuation?:boolean;
  /** Search an independent unguided complete ride before branching. */
  unguidedReference?:boolean;
};

export function studyGuideChoices(spec:Spec,seed:number,budget:number,options:GuideStudyOptions={}){
  if(options.exploration&&!['least-guidance','accuracy-and-guidance','balanced','coverage','coverage-focused'].includes(options.exploration))throw new Error('unknown guide exploration policy');
  if(options.coverageWidth!==undefined&&(!Number.isSafeInteger(options.coverageWidth)||options.coverageWidth<2||options.exploration!=='coverage'))throw new Error('invalid guide coverage width');
  if(options.unguidedReference&&(!options.exploration||options.exploration==='least-guidance'))throw new Error('two starting tracks require two-path exploration');
  if(!Number.isSafeInteger(budget)||budget<20000)throw new Error('guide study needs a valid total allowance');
  const end=Math.round(spec.duration*40)+20;
  const referenceBudget=Math.min(250000,Math.floor(budget/4));
  // Shared proposal/search policy, explicit full search, same channel and shape
  // on both branches. Disabling guides changes geometry and active dimensions.
  const common:ArcMotionOptions={...connectedArcOptions(spec,referenceBudget),...options.geometry,policyPreview:false,collectTrajectoryLoss:true};
  const candidates:Array<{id:string;valid:boolean;qualityRms:number|null;usage:ReturnType<typeof guideFootprint>;result:Result;compileMs:number}>=[];
  let spent=0,preparationFrames=0;
  const run=(id:string,allowance:number,fork?:ArcMotionFork,source?:typeof candidates[number],overrides:Partial<ArcMotionOptions>={})=>{
    const started=performance.now();
    const result=compileArcMotion(spec,seed,{...common,...overrides,budget:allowance,...(fork?{fork}:{}),
      ...(options.sourceMemory&&source?{controlExamples:source.result.rows.map(r=>({features:r.features,incoming:r.incoming,span:r.span,control:r.control}))}:{})});
    const compileMs=performance.now()-started;
    if(result.stats.sim_frames>allowance)throw new Error('guide branch exceeded its allowance');
    spent+=result.stats.sim_frames;
    const valid=result.report.terminus.reason==='endOfSpec'&&!result.report.off_beat_landings.length&&result.report.contacts.every(c=>c.status==='hit');
    const qualityRms=valid&&Number.isFinite(result.trajectoryLoss)?Math.sqrt(result.trajectoryLoss!):null;
    const candidate={id,valid,qualityRms,usage:guideFootprint(result.track.lines),result,compileMs};
    candidates.push(candidate);return candidate;
  };
  const reference=run('reference',referenceBudget);
  const references=[reference];
  if(options.unguidedReference)references.push(run('reference-single',referenceBudget,undefined,undefined,{guides:false}));
  let frontier=references.filter(measuredGuideAlternative);
  const decisions:any[]=[],rounds:Array<{section:number;before:string[];after:string[]}>=[];
  const sections=frontier[0]?.result.rows.length??0;
  if(frontier.length)for(let section=0;section<sections;section++){
    const before=frontier.map(c=>c.id);
    for(const [slot,source] of frontier.entries()){
      // Prefix checks and both complete replays are paid by the shared allowance.
      const preparationCeiling=2*(source.result.rows[section].frame+1);
      const minimum=3*(end+1)+1;
      if(spent+preparationCeiling+2*minimum>budget)break;
      const captured=captureArcFork(source.result,section);
      if(options.preserveGuidePattern){
        const groups=arcRailGroups(source.result.track.lines);
        captured.fork.continuationGuides=source.result.rows.slice(section).map((_,index)=>!!groups.get(section+index)?.[1]?.length);
      }
      if(options.sourceContinuation)captured.fork.continuation=source.result.rows.slice(section).map(r=>({incoming:r.incoming,span:r.span,control:r.control}));
      spent+=captured.physicsFrames;preparationFrames+=captured.physicsFrames;
      const weights=source.result.rows.slice(section).map(r=>end-r.frame+1+end/2);
      const width=options.exploration==='coverage'?(options.coverageWidth??3):options.exploration&&options.exploration!=='least-guidance'?2:1;
      const remainingWeight=weights[0]*(frontier.length-slot)+width*weights.slice(1).reduce((a,b)=>a+b,0);
      const allowance=Math.max(minimum,Math.floor((budget-spent)*weights[0]/remainingWeight/2));
      const name=frontier.length===1?`fork-${section}`:`fork-${section}-path-${slot}`;
      const single=run(`${name}-single`,allowance,{...captured.fork,guides:false},source);
      const guided=run(`${name}-guided`,allowance,{...captured.fork,guides:true},source);
      for(const candidate of [single,guided]){
        const evidence=candidate.result.forkEvidence;
        if(!evidence||evidence.stateSha256!==captured.fork.stateSha256||evidence.prefixSha256!==captured.prefixSha256)
          throw new Error('guide alternatives did not start from the same prefix and physical state');
        const prefix=candidate.result.track.lines.filter(l=>Math.floor((l.id-1000)/10000)<section);
        if(sha(prefix)!==captured.prefixSha256)throw new Error('guide fork changed locked geometry');
        if(captured.fork.continuationGuides){
          const groups=arcRailGroups(candidate.result.track.lines);
          for(let i=1;i<captured.fork.continuationGuides.length;i++)if(!captured.fork.continuationGuides[i]&&groups.get(section+i)?.[1]?.length)
            throw new Error('guide fork changed a later forbidden permission');
        }
      }
      if(guideFootprint(single.result.track.lines.filter(l=>Math.floor((l.id-1000)/10000)===section)).guideSections)
        throw new Error('forbidden guide emitted at the fork');
      const next=[source,single,guided].filter(measuredGuideAlternative).sort(compareGuideFootprint)[0];
      decisions.push({section,frame:captured.frame,source:source.id,single:single.id,guided:guided.id,preferredFromPair:next.id,
        ...(captured.fork.continuationGuides?{continuationGuides:captured.fork.continuationGuides}:{}),
        prefixSha256:captured.prefixSha256,stateSha256:captured.fork.stateSha256,
        allowancePerBranch:allowance,preparationFrames:captured.physicsFrames,
        physicalFrames:captured.physicsFrames+single.result.stats.sim_frames+guided.result.stats.sim_frames,
        outcome:single.valid&&guided.valid?'both-completed':single.valid?'only-single-completed':guided.valid?'only-guided-completed':'neither-completed'});
    }
    const valid=candidates.filter(measuredGuideAlternative);
    const sparse=valid.slice().sort(compareGuideFootprint)[0];
    frontier=[sparse];
    if(options.exploration==='coverage')frontier=guideCoverageFrontier(valid,options.coverageWidth??3);
    else if(options.exploration==='coverage-focused'){
      const [accurate,sparse,middle]=guideCoverageFrontier(valid,3);
      // The sparse endpoint remains available for delivery. Spend the second
      // path's allowance on a useful intermediate whenever one has been found.
      frontier=middle?[accurate,middle]:sparse?[accurate,sparse]:[accurate];
    }
    else if(options.exploration&&options.exploration!=='least-guidance'){
      const accurate=valid.slice().sort((a,b)=>a.qualityRms!-b.qualityRms!||compareGuideFootprint(a,b))[0];
      const step=(candidate:typeof accurate)=>(candidate.qualityRms!-accurate.qualityRms!)/(accurate.usage.guideSections-candidate.usage.guideSections);
      const alternative=options.exploration==='balanced'?
        valid.filter(c=>c.usage.guideSections<accurate.usage.guideSections).sort((a,b)=>step(a)-step(b)||compareGuideFootprint(a,b))[0]??sparse:sparse;
      frontier=accurate.id!==alternative.id?[accurate,alternative]:[accurate];
    }
    rounds.push({section,before,after:frontier.map(c=>c.id)});
  }
  if(spent>budget)throw new Error('guide study exceeded its total allowance');
  return {candidates,decisions,rounds,physicalFrames:spent,preparationFrames,referenceBudget,references:references.map(r=>r.id),
    policy:{preview:false,guideChannel:common.channel,exploration:options.exploration??'least-guidance',coverageWidth:options.exploration==='coverage'?(options.coverageWidth??3):null,preserveGuidePattern:!!options.preserveGuidePattern,geometry:options.geometry??{},sourceMemory:!!options.sourceMemory,sourceContinuation:!!options.sourceContinuation,unguidedReference:!!options.unguidedReference,selection:'bounded-measured-rms-then-fewest-guide-sections-then-length'}};
}
