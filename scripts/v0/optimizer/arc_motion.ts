/** Research compiler: one connected physical support curve per contact interval.
 * The curve's entry, impact-window turn, later slope and release length are
 * corrected using actual engine measurements. No point controls or scenery. */
import { LineRiderEngine as Engine, disposeAllWasmEnginesForStudy as disposeSearch } from '../../lib/native_motion/engine.ts';
import { LineRiderEngine as Judge, disposeAllWasmEnginesForStudy as disposeJudge } from '../../lib/_lr_engine_wasm.ts';
import { getRiderMetered, getPhysicsFrameCount, resetFrameCount, setPhysicsFrameLimit, PhysicsFrameLimitExceeded, extractRawTrajectory, detect } from '../../lib/detector.ts';
import { sliceTimeline, effectiveAxes, resolveStartState, buildTrackJson, buildDriftReport, findAuthoredContactNearFrame, validateSpec, sampleGapTargets } from '../core/substrate.ts';
import { measureGapAxes } from '../core/measure.ts';
import { makeSolidLine } from '../arc.ts';
import { scheduleNativeContacts } from './native_motion_schedule.ts';
import { authoredSpeedToPx, impactToRawPx, PREROLL, CALIB, type Spec, type TrackLine } from '../types.ts';

import { makeRng } from '../../lib/rng.ts';
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const rad=(x:number)=>x*Math.PI/180;
const deg=(x:number)=>x*180/Math.PI;
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export type ArcMotionControl={entry:number; turn:number; exit:number; support:number; bias:number; offset:number;
  clearance?:number; guideStart?:number; guideEnd?:number};

/** Integrate a smooth tangent schedule into one contiguous polyline. All
 * subdivisions approximate the same physical curve; none isolates a point. */
export function motionArc(points:any[], velocity:{x:number;y:number}, c:ArcMotionControl, id:number, flow=false, channel=0, wave=false, radius=0):TrackLine[]{
  const entry=rad(c.entry), n={x:Math.sin(entry),y:-Math.cos(entry)}, t={x:Math.cos(entry),y:Math.sin(entry)};
  const point=points.reduce((a,b)=>a.x*n.x+a.y*n.y<b.x*n.x+b.y*n.y?a:b);
  const speed=Math.hypot(velocity.x,velocity.y), approach=Math.max(20,speed*1.5);
  const anchor={x:point.x+n.x*c.offset,y:point.y+n.y*c.offset};
  let x=anchor.x-approach*t.x,y=anchor.y-approach*t.y;
  const lines:TrackLine[]=[];
  lines.push(makeSolidLine(id++,x,y,anchor.x,anchor.y));x=anchor.x;y=anchor.y;
  let v=Math.max(2,velocity.x*t.x+velocity.y*t.y),previousAngle=entry;
  const steps=Math.max(4,Math.ceil(c.support*4)),dt=c.support/steps;
  for(let k=0;k<steps;k++){
    const time=(k+.5)*dt, first=Math.min(wave?6:5,c.support*.5);
    const u=clamp(time/first,0,1), w=clamp((time-first)/Math.max(.01,c.support-first),0,1);
    const easing=(z:number)=>c.bias>=0?Math.pow(z,1+c.bias):1-Math.pow(1-z,1-c.bias);
    let a=rad(time<first?c.entry+c.turn*(wave?Math.sin(Math.PI*u):easing(u)):lerp(c.entry+(wave?0:c.turn),c.exit,easing(w)));
    if(radius>0)a=clamp(a,previousAngle-v*dt/radius,previousAngle+v*dt/radius);
    if(flow){
      // A passive supporting surface cannot turn downward faster than free
      // fall without releasing. Limit the opposite turn to a finite load.
      a=clamp(a,previousAngle-3/Math.max(2,v)*dt,previousAngle+Math.max(0,.7*.175*Math.cos(previousAngle)/Math.max(2,v))*dt);
    }
    previousAngle=a;
    v=Math.max(1,v+.175*Math.sin(a)*dt);
    const xx=x+Math.cos(a)*v*dt, yy=y+Math.sin(a)*v*dt;
    lines.push(makeSolidLine(id++,x,y,xx,yy));x=xx;y=yy;
  }
  const clearance=c.clearance??channel;
  if(clearance>0&&(c.guideEnd??1)>(c.guideStart??0)){
    const vertices=lines.map(l=>({x:l.x1,y:l.y1}));vertices.push({x:lines.at(-1)!.x2,y:lines.at(-1)!.y2});
    const roof=vertices.slice(2).map((p,i)=>{
      const index=i+2,prev=vertices[index-1],next=vertices[Math.min(index+1,vertices.length-1)];
      const a=Math.atan2(next.y-prev.y,next.x-prev.x);
      return{x:p.x+clearance*Math.sin(a),y:p.y-clearance*Math.cos(a)};
    });
    const distances=[0];for(let i=1;i<roof.length;i++)distances.push(distances.at(-1)!+Math.hypot(roof[i].x-roof[i-1].x,roof[i].y-roof[i-1].y));
    const length=distances.at(-1)!,from=clamp(c.guideStart??0,0,1)*length,to=clamp(c.guideEnd??1,0,1)*length;
    // Every guide remains one substantial connected curve, including when its
    // endpoints move between subdivision vertices. Zero coverage is a single arc.
    if((c.guideStart===undefined&&c.guideEnd===undefined)||to-from>=24){
      const clipped=roof.filter((_,i)=>distances[i]>=from&&distances[i]<=to);
      const at=(distance:number)=>{let i=1;while(i<distances.length-1&&distances[i]<distance)i++;const t=(distance-distances[i-1])/Math.max(1e-12,distances[i]-distances[i-1]);return{x:lerp(roof[i-1].x,roof[i].x,t),y:lerp(roof[i-1].y,roof[i].y,t)};};
      if(from>0&&!distances.includes(from))clipped.unshift(at(from));
      if(to<length&&!distances.includes(to))clipped.push(at(to));
      clipped.reverse();
      for(let i=1;i<clipped.length;i++)lines.push(makeSolidLine(id++,clipped[i-1].x,clipped[i-1].y,clipped[i].x,clipped[i].y));
    }
  }
  return lines;
}

export type ArcMotionOptions={budget:number;samples?:number;diagnostic?:boolean;arrivalWeight?:number;flow?:boolean;startPitch?:number;solver?:string;channel?:number;wave?:boolean;radius?:number;arrivalMode?:string;poseWeight?:number;bidirectional?:boolean;impactWeight?:number;amplitudeWeight?:number;qualityRetries?:number;headingWeight?:number;guidance?:'span'|'clearance'|'full';guidanceSamples?:number;lookaheadWidth?:number;lookaheadSamples?:number;lookaheadWeight?:number};

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
  const lookaheadStats={probes:0,changedChoices:0,failedProbes:0,physicsFrames:0};
  const backtrack=()=>{
    while(steps.length){
      const step=steps.pop(),old=rows.pop();lines.length=step.lineStart;
      if(!step.choices.length)continue;
      const choice=step.choices.shift();
      lines.push(...choice.lines);
      disposeSearch();engine=new Engine().setStart(start.position,start.velocity).addLine(lines);
      rows.push({...old,...choice.meta,control:choice.c,cost:choice.cost,spent:getPhysicsFrameCount()});steps.push(step);backtracks++;
      return rows.length-1;
    }
    return null;
  };
  setPhysicsFrameLimit(budget-2*(end+1));
  const contacts=[{frame:1,gap:-1},...planned.filter(g=>g.endsWithContact).map(g=>({frame:g.endFrame,gap:g.index}))];
  try{
    const compileOptions=options;
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
        const added=motionArc(points,velocity,c,1000+i*10000,options.flow,options.channel,options.wave,options.radius),child=engine.addLine(added);samples++;
        if(added.length>=10000)throw new Error('arc geometry id range exhausted');
        const reject=(reason:string)=>{failures[reason]=(failures[reason]??0)+1;return null;};
        if(JSON.stringify(getRiderMetered(child,frame-1).ballisticState())!==before)return reject('prefix');
        const state=getRiderMetered(child,horizon).ballisticState();
        if(!state.riderMounted||!state.sledIntact)return reject('binding');
        const raw=extractRawTrajectory(child,horizon),det=detect(raw);
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
        const result={child,lines:added,c,cost,localCost,residuals,achieved,actualImpact,release:raw.frames.slice().reverse().find(f=>f.sledContacts.length)?.frame};
        const finalState=state.points;
        const heading=deg(Math.atan2(finalVelocity.y,finalVelocity.x)),endSpeed=Math.hypot(finalVelocity.x,finalVelocity.y);
        const pose=deg(Math.atan2(finalState.NOSE.y-finalState.TAIL.y,finalState.NOSE.x-finalState.TAIL.x));
        viableCandidates++;
        candidates.push({lines:added,c,cost,localCost,heading,endSpeed,pose,meta:{achieved,impact:actualImpact,release:result.release,lines:added.length}});
        if(!best||cost<best.cost)best=result;
        return result;
      };
      const center:ArcMotionControl=options.flow||options.channel?{entry:incoming-.5,turn:-turn/(options.wave?2:1),exit:clamp(incoming-turn,-70,70),support,bias:0,offset:.1}:{entry:incoming-Math.min(12,turn*.3),turn:-Math.min(35,turn*.7),exit:clamp(incoming-25,-40,45),support,bias:0,offset:.1};
      if(options.bidirectional&&options.channel&&incoming<15){center.turn=Math.abs(center.turn);center.exit=clamp(incoming+turn,-70,70);}
      const max=options.samples??160,initial=Math.min(80,Math.ceil(max/2));
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
        const origin=best, count=options.guidanceSamples??48;
        const keys:('clearance'|'guideStart'|'guideEnd')[]=options.guidance==='span'?['guideStart','guideEnd']:options.guidance==='clearance'?['clearance']:['clearance','guideStart','guideEnd'];
        for(let k=0;k<count;k++){
          const frac=(n:number)=>((k+1)*n)%1;
          let c:ArcMotionControl;
          if(k<count/2){
            c={...origin.c};
            if(options.guidance!=='span')c.clearance=k===0?12:8+16*frac(.61803398875);
            if(options.guidance!=='clearance'){
              c.guideStart=k%3===0?0:frac(.41421356237)*.7;
              c.guideEnd=k===0?0:k%3===1?1:Math.max(c.guideStart,frac(.73205080757));
            }
          }else{
            const key=keys[Math.floor(k/2)%keys.length],step=key==='clearance'?2:.15;
            c={...best.c,[key]:(best.c[key]??(key==='clearance'?options.channel??12:key==='guideEnd'?1:0))+(k%2===0?-1:1)*step*Math.pow(.6,Math.floor((k-count/2)/(keys.length*4)))};
          }
          evaluate(c);if(k%8===7)Engine.retainOnly([...protectedEngines,engine,best.child]);
        }
      }
      return {best,candidates,failures,frame,next,horizon,gap,outgoing,targets,incoming,pace,center,support};
    };
    for(let i=0;i<contacts.length;i++){
      const interval=searchInterval(engine,i);
      if(!interval){failure={frame:contacts[i].frame,reason:'contact_spacing'};break;}
      let {best}=interval;
      const {candidates,failures,frame,next,horizon,gap,outgoing,targets,incoming,pace,center,support}=interval;
      let lookahead:any=null;
      if(best&&(options.lookaheadWidth??0)>1&&i+1<contacts.length){
        const width=options.lookaheadWidth!, probeSamples=options.lookaheadSamples??32;
        const shortlist:any[]=[];
        for(const candidate of candidates.slice().sort((a,b)=>a.cost-b.cost)){
          if(shortlist.every(a=>Math.abs(a.heading-candidate.heading)>4||Math.abs(a.endSpeed-candidate.endSpeed)>.4||Math.abs(a.pose-candidate.pose)>7||Math.abs(a.meta.release-candidate.meta.release)>2))shortlist.push(candidate);
          if(shortlist.length>=width)break;
        }
        const original=best, startFrames=getPhysicsFrameCount(), probes:any[]=[];
        let winner:any=null;
        for(const candidate of shortlist){
          const futureEnd=contacts[i+2]?.frame??end+1;
          const reserve=(end-frame)*((options.samples??160)+(options.guidance?options.guidanceSamples??48:0))*1.1;
          if(getPhysicsFrameCount()+reserve+(futureEnd-next)*probeSamples*1.4>budget-2*(end+1))break;
          const branch=engine.addLine(candidate.lines);
          const future=searchInterval(branch,i+1,{samples:probeSamples,guidanceSamples:Math.min(12,options.guidanceSamples??48)},[engine,original.child]);
          lookaheadStats.probes++;
          if(!future?.best)lookaheadStats.failedProbes++;
          const value=future?.best?candidate.cost+(options.lookaheadWeight??1)*future.best.localCost:Infinity;
          probes.push({control:candidate.c,currentCost:candidate.cost,futureCost:future?.best?.localCost??null,value:Number.isFinite(value)?value:null});
          if(future?.best&&(!winner||value<winner.value))winner={candidate,value,futureControl:future.best.c};
          Engine.retainOnly([engine,original.child]);
        }
        if(winner&&JSON.stringify(winner.candidate.c)!==JSON.stringify(original.c)){
          const c=winner.candidate;
          best={...original,child:engine.addLine(c.lines),lines:c.lines,c:c.c,cost:c.cost,localCost:c.localCost,achieved:c.meta.achieved,actualImpact:c.meta.impact,release:c.meta.release};
          lookaheadStats.changedChoices++;
        }
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
      for(const candidate of candidates.sort((a,b)=>a.cost-b.cost)){
        if(alternatives.every(a=>Math.abs(a.heading-candidate.heading)>4||Math.abs(a.endSpeed-candidate.endSpeed)>.4||Math.abs(a.pose-candidate.pose)>7||Math.abs(a.meta.release-candidate.meta.release)>2))alternatives.push(candidate);
        if(alternatives.length>=12)break;
      }
      steps.push({lineStart:lines.length,choices:alternatives.filter(a=>JSON.stringify(a.c)!==JSON.stringify(best.c))});
      lines.push(...best.lines);engine=best.child.detach();Engine.retainOnly([engine]);
      rows.push({frame,next,cost:best.cost,control:best.c,achieved:best.achieved,impact:best.actualImpact,release:best.release,lines:best.lines.length,failures,lookahead,spent:getPhysicsFrameCount()});
      if(options.diagnostic)process.stderr.write(JSON.stringify(rows.at(-1))+'\n');
    }
  }catch(error){if(!(error instanceof PhysicsFrameLimitExceeded))throw error;failure={reason:'budget'};}
  const constructionFrames=getPhysicsFrameCount();
  setPhysicsFrameLimit(budget);raw=extractRawTrajectory(new Engine().setStart(start.position,start.velocity).addLine(lines),end);disposeSearch();
  try{const replay=extractRawTrajectory(new Judge().setStart(start.position,start.velocity).addLine(lines),end);if(JSON.stringify(replay)!==JSON.stringify(raw))throw new Error('fixed-engine replay mismatch');}finally{disposeJudge();setPhysicsFrameLimit(null);}
  const report=buildDriftReport(detect(raw),spec,gaps,frames,duration,[],gaps.map(g=>({lines:lines.filter(l=>Math.floor((l.id-1000)/10000)===g.index+1)})) as any,gaps.map(g=>g.targets));
  return{track:buildTrackJson(lines,end,start),report,stats:{viable_candidate_samples:viableCandidates,sim_frames:getPhysicsFrameCount(),gap_commits:report.contacts.filter(c=>c.status==='hit').length},rows,failure,budget,samples,backtracks,qualityRetries:Object.fromEntries(qualityRetries),lookaheadStats,constructionFrames};
  }finally{disposeSearch();disposeJudge();setPhysicsFrameLimit(null);}
}
