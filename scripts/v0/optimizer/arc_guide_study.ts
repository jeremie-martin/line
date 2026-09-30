/** Bounded research traversal of same-state guide choices. Production does not
 * call this. All branches and prefix verification share a declared total cost. */
import {createHash} from 'node:crypto';
import {compileArcMotion,type ArcMotionFork,type ArcMotionOptions} from './arc_motion.ts';
import {connectedArcOptions} from './connected_arcs.ts';
import {createArcEngine} from './arc_engine.ts';
import {disposeAllWasmEnginesForStudy as dispose} from '../../lib/native_motion/engine.ts';
import {getPhysicsFrameCount,getRiderMetered} from '../../lib/detector.ts';
import {guideFootprint,measuredGuideAlternative,compareGuideFootprint} from './arc_guide_choice.ts';
import type {Spec} from '../types.ts';
type Result=ReturnType<typeof compileArcMotion>;
const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function captureArcFork(result:Result,section:number){
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

export function studyGuideChoices(spec:Spec,seed:number,budget:number){
  if(!Number.isSafeInteger(budget)||budget<20000)throw new Error('guide study needs a valid total allowance');
  const end=Math.round(spec.duration*40)+20;
  const referenceBudget=Math.min(250000,Math.floor(budget/4));
  // Shared proposal/search policy, explicit full search, same channel and shape
  // on both branches. Disabling guides changes geometry and active dimensions.
  const common:ArcMotionOptions={...connectedArcOptions(spec,referenceBudget),policyPreview:false,collectTrajectoryLoss:true};
  const candidates:Array<{id:string;valid:boolean;qualityRms:number|null;usage:ReturnType<typeof guideFootprint>;result:Result;compileMs:number}>=[];
  let spent=0,preparationFrames=0;
  const run=(id:string,allowance:number,fork?:ArcMotionFork)=>{
    const started=performance.now();
    const result=compileArcMotion(spec,seed,{...common,budget:allowance,...(fork?{fork}:{})});
    const compileMs=performance.now()-started;
    if(result.stats.sim_frames>allowance)throw new Error('guide branch exceeded its allowance');
    spent+=result.stats.sim_frames;
    const valid=result.report.terminus.reason==='endOfSpec'&&!result.report.off_beat_landings.length&&result.report.contacts.every(c=>c.status==='hit');
    const qualityRms=valid&&Number.isFinite(result.trajectoryLoss)?Math.sqrt(result.trajectoryLoss!):null;
    const candidate={id,valid,qualityRms,usage:guideFootprint(result.track.lines),result,compileMs};
    candidates.push(candidate);return candidate;
  };
  let source=run('reference',referenceBudget);
  const decisions:any[]=[];
  const sections=source.result.rows.length;
  if(measuredGuideAlternative(source))for(let section=0;section<sections;section++){
    // Cold prefix checks are charged too; reserve enough for both complete replays.
    const preparationCeiling=2*(source.result.rows[section].frame+1);
    const minimum=3*(end+1)+1;
    if(spent+preparationCeiling+2*minimum>budget)break;
    const captured=captureArcFork(source.result,section);
    spent+=captured.physicsFrames;preparationFrames+=captured.physicsFrames;
    const weights=source.result.rows.slice(section).map(r=>end-r.frame+1+end/2);
    const allowance=Math.max(minimum,Math.floor((budget-spent)*weights[0]/weights.reduce((a,b)=>a+b,0)/2));
    const single=run(`fork-${section}-single`,allowance,{...captured.fork,guides:false});
    const guided=run(`fork-${section}-guided`,allowance,{...captured.fork,guides:true});
    for(const candidate of [single,guided]){
      const evidence=candidate.result.forkEvidence;
      if(!evidence||evidence.stateSha256!==captured.fork.stateSha256||evidence.prefixSha256!==captured.prefixSha256)
        throw new Error('guide alternatives did not start from the same prefix and physical state');
      const prefix=candidate.result.track.lines.filter(l=>Math.floor((l.id-1000)/10000)<section);
      if(sha(prefix)!==captured.prefixSha256)throw new Error('guide fork changed locked geometry');
    }
    if(single.result.track.lines.some(l=>Math.floor((l.id-1000)/10000)===section)&&
      guideFootprint(single.result.track.lines.filter(l=>Math.floor((l.id-1000)/10000)===section)).guideSections)
      throw new Error('forbidden guide emitted at the fork');
    // Walk toward fewer guides to collect alternatives, retaining every measured
    // result. Delivery uses a separate explicit quality ceiling over this pool.
    const next=[source,single,guided].filter(measuredGuideAlternative).sort(compareGuideFootprint)[0];
    decisions.push({section,frame:captured.frame,source:source.id,single:single.id,guided:guided.id,next:next.id,
      prefixSha256:captured.prefixSha256,stateSha256:captured.fork.stateSha256,
      allowancePerBranch:allowance,preparationFrames:captured.physicsFrames,
      physicalFrames:captured.physicsFrames+single.result.stats.sim_frames+guided.result.stats.sim_frames,
      outcome:single.valid&&guided.valid?'both-completed':single.valid?'only-single-completed':guided.valid?'only-guided-completed':'neither-completed'});
    source=next;
  }
  if(spent>budget)throw new Error('guide study exceeded its total allowance');
  return {candidates,decisions,physicalFrames:spent,preparationFrames,referenceBudget,
    policy:{preview:false,guideChannel:common.channel,exploration:'fewest-guide-sections-then-length',selection:'bounded-measured-rms-then-fewest-guide-sections-then-length'}};
}
