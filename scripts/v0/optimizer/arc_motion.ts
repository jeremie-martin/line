/** Measured arc search: one connected physical support curve per contact interval.
 * The curve's entry, impact-window turn, later slope and release length are
 * corrected using actual engine measurements. No point controls or scenery. */
import { LineRiderEngine as Engine, disposeAllWasmEnginesForStudy as disposeSearch } from '../../lib/native_motion/engine.ts';
import { LineRiderEngine as Judge, disposeAllWasmEnginesForStudy as disposeJudge } from '../../lib/_lr_engine_wasm.ts';
import { getRiderMetered, getPhysicsFrameCount, resetFrameCount, setPhysicsFrameLimit, PhysicsFrameLimitExceeded, extractRawTrajectory, extractRawTrajectoryWindow, detect } from '../../lib/detector.ts';
import { sliceTimeline, effectiveAxes, resolveStartState, buildTrackJson, buildDriftReport, findAuthoredContactNearFrame, validateSpec, sampleGapTargets } from '../core/substrate.ts';
import { measureGapAxes } from '../core/measure.ts';
import { motionArc, type ArcMotionControl } from './arc_geometry.ts';
export { motionArc, type ArcMotionControl } from './arc_geometry.ts';
import { scheduleNativeContacts } from './native_motion_schedule.ts';
import { trimUnusedArcGuides } from './arc_guidance.ts';
import { refineArcTrack } from './arc_refinement.ts';
import { arcResponseStep } from './arc_response.ts';
import { arcArrivalFeatures, arcFutureValue } from './arc_value.ts';
import { authoredSpeedToPx, impactToRawPx, PREROLL, CALIB, type Spec, type TrackLine } from '../types.ts';

import { makeRng } from '../../lib/rng.ts';
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const rad=(x:number)=>x*Math.PI/180;
const deg=(x:number)=>x*180/Math.PI;
export type ArcMotionOptions= {
  budget:number;
  samples?:number;
  diagnostic?:boolean;
  arrivalWeight?:number;
  flow?:boolean;
  startPitch?:number;
  solver?:string;
  channel?:number;
  wave?:boolean;
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
  lookaheadWeight?:number;
  lookaheadWarmStart?:boolean;
  warmStart?:ArcMotionControl;
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
  refineDirect?:boolean;
  refineRebuildSamples?:number;
  refineExpressive?:boolean;
  responseSamples?:number;
  responseDamping?:number;
  refineFollowSamples?:number;
  refineUseAlternatives?:boolean;
  collectValue?:boolean;
  cachePrefixReads?:boolean;
  futureValueModel?:any;
  /** Research: use the learned value at the unresolved continuation boundary. */
  continuationValueWeight?:number;
  valueWeight?:number;
  valueSelection?:boolean};

export function compileArcMotion(spec:Spec,seed:number,options:ArcMotionOptions){
  if(!Number.isSafeInteger(seed)||!Number.isSafeInteger(options.budget)||options.budget<=0)throw new Error('invalid arc compiler input');
  validateSpec(spec);
  resetFrameCount();const budget=options.budget,duration=Math.round(spec.duration*40),end=duration+20;
  if(budget<2*(end+1))throw new Error('arc budget cannot cover two complete replays');
  try{
  const frames=spec.contacts.map(c=>Math.round(c.t*40));
  const gaps=sliceTimeline(frames,duration);
  for(const g of gaps){g.targets=effectiveAxes(g,spec);if(g.endsWithContact&&spec.contacts[g.index].impact!==undefined)g.targets.impact=spec.contacts[g.index].impact;}
  const rng=makeRng(seed);
  const planned=scheduleNativeContacts(gaps.map(g=>({...g,targets:{...g.targets,...sampleGapTargets(g.targets,spec.jitter??CALIB.SIGMA,rng)}})));
  const fixed=spec.start||(spec.preroll??PREROLL.DEFAULT_S)<=0?resolveStartState(spec):null;
  const speed=authoredSpeedToPx(gaps[0].targets.speed??.55);
  const pitch=rad(options.startPitch??8.59436692696);
  const start=fixed??{position:{x:0,y:0},velocity:{x:speed*Math.cos(pitch),y:speed*Math.sin(pitch)}};
  let engine:any=new Engine().setStart(start.position,start.velocity);
  const lines:TrackLine[]=[],rows:any[]=[],steps:any[]=[];let failure:any=null,raw:any=null;let backtracks=0;
  let samples=0,viableCandidates=0;const qualityRetries=new Map<number,number>();
  let refinementStats:any=null, observedConstructionRate=0;
  let searchBudgetExhausted=false;
  const budgetInterruptions:Array<{phase:'local'|'planning';index:number;frame:number;viable:number;retained:boolean}>=[];
  const planningDecisions:any[]=[];
  const reportFor=(trajectory:any,geometry:TrackLine[])=>buildDriftReport(detect(trajectory),spec,gaps,frames,duration,[],gaps.map(g=>({lines:geometry.filter(l=>Math.floor((l.id-1000)/10000)===g.index+1)})) as any,gaps.map(g=>g.targets));
  const lookaheadStats={probes:0,changedChoices:0,failedProbes:0,physicsFrames:0,continuationNodes:0,maxDepth:0};
  let pendingControl:{index:number;control:ArcMotionControl}|null=null;
  const backtrack=()=>{
    pendingControl=null;
    while(steps.length){
      const step=steps.pop(),old=rows.pop();lines.length=step.lineStart;
      if(!step.choices.length)continue;
      const choice=step.choices.shift();
      lines.push(...choice.lines);
      disposeSearch();engine=new Engine().setStart(start.position,start.velocity).addLine(lines);
      rows.push({...old,...choice.meta,control:choice.c,cost:choice.cost,spent:getPhysicsFrameCount()});steps.push(step);backtracks++;
      if(options.reuseContinuations&&choice.futureControl)pendingControl={index:rows.length,control:choice.futureControl};
      return rows.length-1;
    }
    return null;
  };
  setPhysicsFrameLimit(budget-2*(end+1));
  const contacts=[{frame:1,gap:-1},...planned.filter(g=>g.endsWithContact).map(g=>({frame:g.endFrame,gap:g.index}))];
  try{
    const compileOptions=options;
    const futureFeatures=(arrival:number[],i:number)=>{
      const features=[...arrival];
      for(let k=1;k<=2;k++){
        const contact=contacts[i+k],target=contact?planned.find(g=>g.startFrame===contact.frame)?.targets:undefined;
        features.push(contact?((contacts[i+k+1]?.frame??end+1)-contact.frame)/40:0,contact?(gaps[contact.gap]?.targets.impact??-1):-1,target?.air??-1,target?.speed??-1,target?.amplitude??-1);
      }
      return features;
    };
    const searchInterval=(engine:Engine,i:number,overrides:Partial<ArcMotionOptions>={},protectedEngines:Engine[]=[])=>{
      const options={...compileOptions,...overrides};
      const {frame,gap}=contacts[i],next=contacts[i+1]?.frame??end+1,horizon=next-1;
      if(horizon<=frame+2)return null;
      const outgoing=planned.find(g=>g.startFrame===(i===0?0:frame))??{index:gaps.length,startFrame:frame,endFrame:horizon,endsWithContact:false,targets:{}};
      const targets=outgoing.targets;
      const before=JSON.stringify(getRiderMetered(engine,frame-1).ballisticState());
      const free=getRiderMetered(engine,frame),velocity=free.velocity;
      engine.prepareCollisionTrace(frame);getRiderMetered(engine,frame);
      const trace=engine.readCollisionTrace()[0];
      const points=['PEG','TAIL','NOSE','STRING'].map(key=>trace[key]);
      const prefixRaw=options.cachePrefixReads?extractRawTrajectory(engine,frame-1):null;
      const incoming=deg(Math.atan2(velocity.y,velocity.x)),pace=Math.hypot(velocity.x,velocity.y);
      const span=horizon-(i===0?0:frame);
      const support=clamp((1-(targets.air??.5))*(span+1),3,Math.max(3,span-6));
      const impact=gap>=0?gaps[gap].targets.impact:undefined;
      const turn=impact===undefined?5:deg(impactToRawPx(impact)/Math.max(3,pace));
      let best:any=null;const candidates:any[]=[];const failures:Record<string,number>={};
      const evaluate=(c:ArcMotionControl)=>{
        c={...c,entry:clamp(c.entry,-75,85),turn:clamp(c.turn,-120,options.bidirectional?120:15),exit:clamp(c.exit,-80,85),support:clamp(c.support,2,Math.max(2,span-4)),bias:clamp(c.bias,-2,2),offset:clamp(c.offset,-2,3)};
        if(c.clearance!==undefined)c.clearance=clamp(c.clearance,6,30);
        if(c.guideStart!==undefined)c.guideStart=clamp(c.guideStart,0,1);
        if(c.guideEnd!==undefined)c.guideEnd=clamp(c.guideEnd,0,1);
        if(c.turnFraction!==undefined)c.turnFraction=clamp(c.turnFraction,.1,.85);
        if(c.bend!==undefined)c.bend=clamp(c.bend,-60,60);
        if(c.guideFlare!==undefined)c.guideFlare=clamp(c.guideFlare,-16,16);
        const added=motionArc(points,velocity,c,1000+i*10000,options.flow,options.channel,options.wave,options.radius),child=engine.addLine(added);samples++;
        const prefixReusable=prefixRaw&&child.getLastFrameIndex()>=frame-1;
        if(added.length>=10000)throw new Error('arc geometry id range exhausted');
        const reject=(reason:string)=>{failures[reason]=(failures[reason]??0)+1;return null;};
        if(JSON.stringify(getRiderMetered(child,frame-1).ballisticState())!==before)return reject('prefix');
        const state=getRiderMetered(child,horizon).ballisticState();
        if(!state.riderMounted||!state.sledIntact)return reject('binding');
        const raw=prefixReusable?{duration:horizon,frames:[...prefixRaw!.frames,...extractRawTrajectoryWindow(child,frame,horizon).frames]}:extractRawTrajectory(child,horizon),det=detect(raw);
        if(det.terminus.reason!=='endOfSpec')return reject(det.terminus.reason);
        if(i>0&&!findAuthoredContactNearFrame(det,frame,1,frame-contacts[i-1].frame))return reject('missed');
        if(i===0&&!raw.frames.slice(1,4).some(f=>f.sledContacts.length))return reject('startup');
        if(det.events.some(e=>e.type==='landing'&&!frames.some(f=>Math.abs(e.frame-f)<=1)))return reject('offbeat');
        if(i<contacts.length-1&&!raw.frames.slice(-6).every(f=>f.sledContacts.length===0))return reject('late_release');
        const achieved=measureGapAxes(det,{...outgoing,startFrame:i===0?0:frame,endFrame:horizon},added,horizon);
        const residuals:number[]=['air','speed','amplitude'].map(key=>targets[key as keyof typeof targets]===undefined?0:((achieved as any)[key]-(targets as any)[key])*Math.sqrt(key==='amplitude'?(options.amplitudeWeight??1):1));
        let cost=residuals.reduce((s,x)=>s+x*x,0);
        let actualImpact:number|undefined;
        if(impact!==undefined){actualImpact=measureGapAxes(det,gaps[gap],added,frame).impact;if(actualImpact===undefined)return reject('impact');cost+=(options.impactWeight??2)*(actualImpact-impact)**2;}
        residuals.push(impact===undefined?0:Math.sqrt(options.impactWeight??2)*(actualImpact!-impact));
        const localCost=cost;
        const finalVelocity=raw.frames.at(-1)!.velocity;
        if(i<contacts.length-1&&finalVelocity.x<1)return reject('unusable_arrival');
        // Keep future catches physically accessible; this is an optimizer prior,
        // never a change to the scored result.
        cost+=.01*Math.max(0,-finalVelocity.x/Math.max(1,pace))**2;
        if(i<contacts.length-1&&(options.arrivalWeight??0)>0){
          const nextImpact=gaps[contacts[i+1].gap].targets.impact??0;
          const nextSpeed=authoredSpeedToPx(planned[contacts[i+1].gap+1]?.targets.speed??targets.speed??.55);
          const desiredArrival=clamp(15+deg(impactToRawPx(nextImpact)/nextSpeed),20,70);
          const weight=Math.sqrt(options.arrivalWeight??0), r1=options.arrivalMode==='speed'?0:weight*(deg(Math.atan2(finalVelocity.y,finalVelocity.x))-desiredArrival)/45,r2=weight*(Math.hypot(finalVelocity.x,finalVelocity.y)-nextSpeed)/7.2;
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
        const result={child,lines:added,c,cost,localCost,residuals,achieved,actualImpact,release:raw.frames.slice().reverse().find(f=>f.sledContacts.length)?.frame};
        const finalState=state.points;
        const heading=deg(Math.atan2(finalVelocity.y,finalVelocity.x)),endSpeed=Math.hypot(finalVelocity.x,finalVelocity.y);
        const pose=deg(Math.atan2(finalState.NOSE.y-finalState.TAIL.y,finalState.NOSE.x-finalState.TAIL.x));
        viableCandidates++;
        const valueFeatures=options.collectValue||options.futureValueModel?futureFeatures(arcArrivalFeatures(state,heading,endSpeed,pose,angularRate,horizon-(result.release??frame)),i):undefined;
        const predictedFuture=options.futureValueModel?arcFutureValue(valueFeatures!,options.futureValueModel):undefined;
        candidates.push({lines:added,c,cost,localCost,heading,endSpeed,pose,valueFeatures,predictedFuture,meta:{achieved,impact:actualImpact,release:result.release,lines:added.length}});
        if(!best||cost<best.cost)best=result;
        return result;
      };
      let center:ArcMotionControl|undefined;
      try {
      if(options.directControls){for(const control of options.directControls)evaluate(control);return {best,candidates,failures,frame,next,horizon,gap,outgoing,targets,incoming,pace,support};}
      center=options.flow||options.channel?{entry:incoming-.5,turn:-turn/(options.wave?2:1),exit:clamp(incoming-turn,-70,70),support,bias:0,offset:.1}:{entry:incoming-Math.min(12,turn*.3),turn:-Math.min(35,turn*.7),exit:clamp(incoming-25,-40,45),support,bias:0,offset:.1};
      if(options.bidirectional&&options.channel&&incoming<15){center.turn=Math.abs(center.turn);center.exit=clamp(incoming+turn,-70,70);}
      const max=options.samples??160,initial=options.localOnly?0:Math.min(80,Math.ceil(max/2));
      if(options.warmStart)evaluate(options.warmStart);
      for(let k=0;k<initial;k++){
        const frac=(n:number)=>((k+1)*n)%1;
        evaluate(k===0?center:{entry:incoming-((options.flow||options.channel)&&k%2===0?(-1+frac(.61803398875)*6):(2+frac(.61803398875)*Math.min(32,turn+10))),turn:(options.bidirectional&&k%4<2?1:-1)*frac(.41421356237)*Math.min(options.flow?110:60,turn+25),exit:-45+frac(.73205080757)*110,support:support*(.45+frac(.2360679775)*1.2),bias:-1.5+3*frac(.6457513111),offset:-.25+frac(.3166247903)*1.5});
        if(k%10===9)Engine.retainOnly([...protectedEngines,...(best?[engine,best.child]:[engine])]);
      }
      if(best){
        const keys=['entry','turn','exit','support','bias','offset'] as const;
        let local=initial;
        if(options.solver==='newton'){
          for(let iteration=0;iteration<4&&local+15<max;iteration++){
            const origin=best, scale=[2,5,6,Math.max(1,support*.1),.25,.2];
            const jac=origin.residuals.map(()=>Array(6).fill(0));
            for(let d=0;d<6;d++){
              const key=keys[d], a=evaluate({...origin.c,[key]:origin.c[key]+scale[d]}),b=evaluate({...origin.c,[key]:origin.c[key]-scale[d]});local+=2;
              for(let r=0;r<jac.length;r++)jac[r][d]=a&&b?(a.residuals[r]-b.residuals[r])/2:a?a.residuals[r]-origin.residuals[r]:b?origin.residuals[r]-b.residuals[r]:0;
            }
            const matrix=Array.from({length:6},(_,a)=>Array.from({length:7},(_,b)=>b===6?-jac.reduce((sum:number,row:number[],r:number)=>sum+row[a]*origin.residuals[r],0):jac.reduce((sum:number,row:number[])=>sum+row[a]*row[b],0)+(a===b?.002:0)));
            for(let d=0;d<6;d++){
              let pivot=d;for(let r=d+1;r<6;r++)if(Math.abs(matrix[r][d])>Math.abs(matrix[pivot][d]))pivot=r;
              [matrix[d],matrix[pivot]]=[matrix[pivot],matrix[d]];
              const v=matrix[d][d];if(Math.abs(v)<1e-12)continue;
              for(let c=d;c<7;c++)matrix[d][c]/=v;
              for(let r=0;r<6;r++)if(r!==d){const f=matrix[r][d];for(let c=d;c<7;c++)matrix[r][c]-=f*matrix[d][c];}
            }
            for(const damping of [1,.5,.25]){
              const c={...origin.c};keys.forEach((key,d)=>c[key]+=damping*scale[d]*clamp(matrix[d][6],-4,4));evaluate(c);local++;
            }
            Engine.retainOnly([...protectedEngines,engine,best.child]);
          }
        }
        for(let k=local;k<max;k++){
          const key=keys[Math.floor((k-initial)/2)%keys.length],round=Math.floor((k-initial)/12),sign=k%2===0?-1:1;
          const steps={entry:3,turn:8,exit:10,support:Math.max(1,support*.18),bias:.5,offset:.4};
          const candidate={...best.c,[key]:best.c[key]+sign*steps[key]*Math.pow(.65,Math.floor(round/2))};
          evaluate(candidate);
          if(k%10===9)Engine.retainOnly([...protectedEngines,engine,best.child]);
        }
      }
      if(best&&options.guidance){
        const origin=best;
        const responseKeys:(keyof ArcMotionControl)[]=['entry','turn','exit','support','bias','offset','clearance'];
        if(options.expressive)responseKeys.push('turnFraction','bend','guideFlare');
        const wantedResponse=Math.min(options.guidanceSamples??48,options.responseSamples??0);
        const responseAllowance=wantedResponse>=2*responseKeys.length+3?wantedResponse:0;
        const count=(options.guidanceSamples??48)-responseAllowance;
        const keys:(keyof ArcMotionControl)[]=options.guidance==='span'?['guideStart','guideEnd']:options.guidance==='clearance'?['clearance']:['clearance','guideStart','guideEnd'];
        if(options.guidanceJoint)keys.push('entry','turn','exit','support','bias','offset');
        if(options.expressive)keys.push('turnFraction','bend','guideFlare');
        const broad=options.guidanceJoint?Math.min(24,Math.ceil(count/3)):count/2;
        for(let k=0;k<count;k++){
          const frac=(n:number)=>((k+1)*n)%1;
          let c:ArcMotionControl;
          if(k<broad){
            c={...origin.c};
            if(options.guidance!=='span')c.clearance=k===0?12:8+16*frac(.61803398875);
            if(options.expressive&&k>0){c.turnFraction=.15+.65*frac(.2718281828);c.bend=-35+70*frac(.1415926535);c.guideFlare=-12+24*frac(.5772156649);}
            if(options.guidance!=='clearance'){
              c.guideStart=k%3===0?0:frac(.41421356237)*.7;
              c.guideEnd=k===0?0:k%3===1?1:Math.max(c.guideStart,frac(.73205080757));
            }
          }else{
            const key=keys[Math.floor(k/2)%keys.length],step={clearance:2,guideStart:.15,guideEnd:.15,entry:3,turn:8,exit:10,support:Math.max(1,support*.18),bias:.5,offset:.4,turnFraction:.12,bend:10,guideFlare:4}[key];
            c={...best.c,[key]:(best.c[key]??(key==='clearance'?options.channel??12:key==='guideEnd'?1:key==='turnFraction'?Math.min(5,best.c.support*.5)/best.c.support:0))+(k%2===0?-1:1)*step*Math.pow(.6,Math.floor((k-broad)/(keys.length*4)))};
          }
          evaluate(c);if(k%8===7)Engine.retainOnly([...protectedEngines,engine,best.child]);
        }
        let responseUsed=0, trust=1;
        while(responseUsed+2*responseKeys.length+3<=responseAllowance){
          const origin=best,scale={entry:2,turn:5,exit:6,support:Math.max(.6,support*.1),bias:.25,offset:.2,clearance:1.5,turnFraction:.08,bend:7,guideFlare:2.5};
          const value=(key:keyof ArcMotionControl)=>origin.c[key]??(key==='clearance'?options.channel??12:key==='turnFraction'?Math.min(5,origin.c.support*.5)/origin.c.support:0);
          const jac=origin.residuals.map(()=>Array(responseKeys.length).fill(0));
          responseKeys.forEach((key,d)=>{
            const step=scale[key as keyof typeof scale]*trust;
            const a=evaluate({...origin.c,[key]:value(key)+step}),b=evaluate({...origin.c,[key]:value(key)-step});responseUsed+=2;
            for(let r=0;r<jac.length;r++)jac[r][d]=a&&b?(a.residuals[r]-b.residuals[r])/2:a?a.residuals[r]-origin.residuals[r]:b?origin.residuals[r]-b.residuals[r]:0;
          });
          const delta=arcResponseStep(jac,origin.residuals,options.responseDamping??.0002);
          for(const fraction of [1,.5,.25]){
            if(delta){const c={...origin.c};responseKeys.forEach((key,d)=>c[key]=value(key)+fraction*scale[key as keyof typeof scale]*trust*clamp(delta[d],-3,3));evaluate(c);}responseUsed++;
          }
          if(best.cost>=origin.cost-1e-12)trust*=.5;
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
      return {best,candidates,failures,frame,next,horizon,gap,outgoing,targets,incoming,pace,center,support};
    };
    const valueRank=(c:any)=>c.predictedFuture===undefined?c.cost:c.cost+(options.valueWeight??.5)*(c.localCost+c.predictedFuture-c.cost);
    const distinct=(candidates:any[],width:number)=>{
      const result:any[]=[];
      for(const candidate of candidates.slice().sort((a,b)=>valueRank(a)-valueRank(b))){
        if(result.every(a=>Math.abs(a.heading-candidate.heading)>4||Math.abs(a.endSpeed-candidate.endSpeed)>.4||Math.abs(a.pose-candidate.pose)>7||Math.abs(a.meta.release-candidate.meta.release)>2))result.push(candidate);
        if(result.length>=width)break;
      }
      return result;
    };
    const continuation=(base:Engine,index:number,depth:number,probeSamples:number,protectedEngines:Engine[]):any=>{
      const searched=searchInterval(base,index,{samples:probeSamples,guidanceSamples:Math.min(12,options.guidanceSamples??48)},protectedEngines);
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
      let winner:any=null;
      for(const candidate of distinct(searched.candidates,options.lookaheadBranching??2)){
        const branch=base.addLine(candidate.lines);
        const tail=continuation(branch,index+1,depth-1,probeSamples,[...protectedEngines,base,anchor.child]);
        if(tail){
          const value=candidate.localCost+(options.lookaheadWeight??1)*tail.value;
          if(!winner||value<winner.value)winner={value,localValue:value,control:candidate.c,depth:1+tail.depth};
        }
        Engine.retainOnly([...protectedEngines,base,anchor.child]);
      }
      return winner??(options.strictHorizon?null:{value:anchor.cost,localValue:anchor.localCost,control:anchor.c,depth:1});
    };
    for(let i=0;i<contacts.length;i++){
      const localStart=getPhysicsFrameCount();
      const interval=searchInterval(engine,i,pendingControl?.index===i?{warmStart:pendingControl.control}:{});
      if(interval){const rate=(getPhysicsFrameCount()-localStart)/Math.max(1,interval.next-interval.frame);observedConstructionRate=observedConstructionRate ? .8*observedConstructionRate+.2*rate : rate;}
      pendingControl=null;
      if(!interval){failure={frame:contacts[i].frame,reason:'contact_spacing'};break;}
      let {best}=interval;
      const {candidates,failures,frame,next,horizon,gap,outgoing,targets,incoming,pace,center,support}=interval;
      let lookahead:any=null;
      if(best&&(options.lookaheadWidth??0)>1&&i+1<contacts.length){
        let width=options.lookaheadWidth!, probeSamples=options.lookaheadSamples??32,depth=Math.max(1,options.lookaheadDepth??1);
        const nominalRate=(options.samples??160)+(options.guidance?options.guidanceSamples??48:0);
        const constructionReserveRate=(options.adaptivePlanning?Math.max(nominalRate,observedConstructionRate):nominalRate)*(options.reserveFactor??1.1);
        if(options.adaptivePlanning){
          const remaining=Math.max(1,end-frame),rate=(budget-getPhysicsFrameCount()-2*(end+1))/remaining;
          const localAllowance=Math.max(0,rate-constructionReserveRate)*(next-frame);
          for(let d=Math.min(options.planningDepth??2,contacts.length-i-1);d>=1;d--){
            let framesPerProbe=0;
            for(let k=0;k<d;k++)framesPerProbe+=Math.pow(options.lookaheadBranching??2,k)*((contacts[i+k+2]?.frame??end+1)-contacts[i+k+1].frame)*1.4;
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
          for(let d=0;d<depth&&i+d+1<contacts.length;d++)probeAllowance+=Math.pow(options.lookaheadBranching??2,d)*((contacts[i+d+2]?.frame??end+1)-contacts[i+d+1].frame)*probeSamples*1.4;
          if(getPhysicsFrameCount()+reserve+probeAllowance>budget-2*(end+1))break;
          const branch=engine.addLine(candidate.lines);
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
          best={...original,child:engine.addLine(c.lines),lines:c.lines,c:c.c,cost:c.cost,localCost:c.localCost,achieved:c.meta.achieved,actualImpact:c.meta.impact,release:c.meta.release};
          lookaheadStats.changedChoices++;
        }
        if(winner&&options.lookaheadWarmStart!==false)pendingControl={index:i+1,control:winner.futureControl};
        lookaheadStats.physicsFrames+=getPhysicsFrameCount()-startFrames;
        lookahead={probes,selected:winner?.candidate.c??original.c};
      }
      if(best&&(options.qualityRetries??0)>0&&targets.speed!==undefined&&Math.abs(best.achieved.speed-targets.speed)>.3&&
        (qualityRetries.get(frame)??0)<options.qualityRetries!&&getPhysicsFrameCount()+(end-frame)*(options.samples??160)*1.1<budget-2*(end+1)){
        qualityRetries.set(frame,(qualityRetries.get(frame)??0)+1);
        const retry=steps.some(s=>s.choices.length)?backtrack():null;if(retry!==null){i=retry;continue;}
      }
      if(!best){failure={frame,reason:'no_arc',failures,incoming,pace,center};const retry=backtrack();if(retry!==null){i=retry;continue;}break;}
      failure=null;
      const alternatives:any[]=[];
      const planRank=(c:any)=>c.lookaheadValue===undefined?1:Number.isFinite(c.lookaheadValue)?0:2;
      for(const candidate of candidates.sort((a,b)=>options.reuseContinuations?(planRank(a)-planRank(b)||((a.lookaheadValue??a.cost)-(b.lookaheadValue??b.cost))):a.cost-b.cost)){
        if(alternatives.every(a=>Math.abs(a.heading-candidate.heading)>4||Math.abs(a.endSpeed-candidate.endSpeed)>.4||Math.abs(a.pose-candidate.pose)>7||Math.abs(a.meta.release-candidate.meta.release)>2))alternatives.push(candidate);
        if(alternatives.length>=12)break;
      }
      steps.push({lineStart:lines.length,choices:alternatives.filter(a=>JSON.stringify(a.c)!==JSON.stringify(best.c))});
      lines.push(...best.lines);engine=best.child.detach();Engine.retainOnly([engine]);
      rows.push({frame,next,cost:best.cost,control:best.c,achieved:best.achieved,impact:best.actualImpact,release:best.release,lines:best.lines.length,failures,lookahead,spent:getPhysicsFrameCount()});
      if(options.diagnostic)process.stderr.write(JSON.stringify(rows.at(-1))+'\n');
    }
    if(!failure&&(options.refineAttempts??0)>0&&rows.length===contacts.length){
      const refined=refineArcTrack({engine,lines,rows,alternatives:steps.map(s=>s.choices),contacts,end,start,budget,options,search:searchInterval,report:reportFor});
      lines.splice(0,lines.length,...refined.lines);rows.splice(0,rows.length,...refined.rows);
      engine=refined.engine;refinementStats=refined.stats;
    }
  }catch(error){if(!(error instanceof PhysicsFrameLimitExceeded))throw error;searchBudgetExhausted=true;failure={reason:'budget'};}
  const constructionFrames=getPhysicsFrameCount();
  setPhysicsFrameLimit(budget);
  const coldEngine=new Engine().setStart(start.position,start.velocity).addLine(lines);
  raw=extractRawTrajectory(coldEngine,end);
  const guidanceReduction=options.pruneGuidance?trimUnusedArcGuides(lines,coldEngine,end):null;
  if(guidanceReduction)lines.splice(0,lines.length,...guidanceReduction.lines);
  disposeSearch();
  try{const replay=extractRawTrajectory(new Judge().setStart(start.position,start.velocity).addLine(lines),end);if(JSON.stringify(replay)!==JSON.stringify(raw))throw new Error('fixed-engine replay mismatch');}finally{disposeJudge();setPhysicsFrameLimit(null);}
  const report=reportFor(raw,lines);
  return{track:buildTrackJson(lines,end,start),report,stats:{viable_candidate_samples:viableCandidates,sim_frames:getPhysicsFrameCount(),gap_commits:report.contacts.filter(c=>c.status==='hit').length},rows,failure,budget,searchBudgetExhausted,budgetInterruptions,samples,backtracks,qualityRetries:Object.fromEntries(qualityRetries),lookaheadStats,planningDecisions,refinementStats,guidanceReduction:guidanceReduction?.stats??null,constructionFrames};
  }finally{disposeSearch();disposeJudge();setPhysicsFrameLimit(null);}
}
