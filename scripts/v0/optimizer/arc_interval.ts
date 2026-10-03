/** Search of one support interval: proposes, measures and locally refines
 * connected arc geometry from the physical state at the interval start. */
import { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { getRiderMetered, getPhysicsFrameCount, PhysicsFrameLimitExceeded, extractRawTrajectory, extractRawTrajectoryWindow, detect } from '../../lib/detector.ts';
import { findAuthoredContactNearFrame } from '../core/substrate.ts';
import { measureGapAxes, measureAmplitudePeakPx } from '../core/measure.ts';
import { motionArc, type ArcMotionControl } from './arc_geometry.ts';
import { arcRailGroups } from './arc_guidance.ts';
import { arcDetectedTrajectoryObjective } from './arc_refinement.ts';
import { arcPolicyArrival, arcControlProposals } from './arc_control_policy.ts';
import { arcResponseStep } from './arc_response.ts';
import { arcConstructionMemoryKey, allocateArcProposalSlots } from './arc_memory.ts';
import { arcSpanLoss, arcBoundaryCorrection } from './arc_boundary.ts';
import { arcArrivalFeatures, arcFutureValue, arcValueGuidance } from './arc_value.ts';
import { ARC_CORE_KEYS, ARC_EXPRESSIVE_KEYS, normalizeArcControl, arcControlMemoKey, arcControlValue, arcControlStep, arcMethodKeys, arcControlActive, arcControlsSimilar } from './arc_motion_control.ts';
import { authoredSpeedToPx, impactToRawPx, CALIB, type TrackLine } from '../types.ts';
import { inspectConstructionWindow } from './repertoire_candidate.ts';
import { extendContactObserver, fragmentInterval } from './contact_interval.ts';
import { motionSamples, effectiveBodyVelocity, MOTION_BANDS } from './motion_quality.ts';
import { constructionDeficit } from './repertoire_feasibility.ts';
import { motionResiduals, intervalMotionSummary } from './motion_objective.ts';
import { observedReceiver } from './observed_receiver.ts';
import { CONTACT_IMPACT_CONTRACT, contactImpactPrefix, continueContactImpacts, accountContactImpacts } from '../../lib/contact_impact.ts';
import { impactFrames, evaluateMusicalImpacts, impactSearchResiduals, engagementGainResiduals } from './impact_search.ts';
import type { ArcMotionOptions } from './arc_motion.ts';
import type { ArcCompileContext } from './arc_compile_context.ts';
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const deg=(x:number)=>x*180/Math.PI;

export function searchInterval(ctx:ArcCompileContext,engine:Engine,i:number,overrides:Partial<ArcMotionOptions>={},protectedEngines:Engine[]=[]){
  const {options:compileOptions,contacts,end,planned,gaps,duration,frames,impactTargets,memoryFor,futureFeatures,work,lineage}=ctx;
  const {prefixes,prefixKey,memoContexts,observers,observerFor}=lineage;
  const addArc=lineage.add;
  const {observedReceiverWork,initialProposalWork,opposingEntryWork,initializationRecovery,budgetInterruptions,fragmentStats}=work;
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
    work.samples++;
    const saved=memo?.get(key);
    if(saved){
      work.memoHits++;
      if(saved.reason){if(saved.near)rememberNear(saved.near);work.memoRejectedHits++;failures[saved.reason]=(failures[saved.reason]??0)+1;return null;}
      work.viableCandidates++;candidates.push({...saved.candidate,c});
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
    work.viableCandidates++;
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
    work.searchBudgetExhausted=true;
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
}
