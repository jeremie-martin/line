import {hypot2} from '../../lib/hypot2.ts';
/** Coherent normal-line geometry shared by construction and refinement studies.
 * This module only builds curves; it does not simulate or select candidates. */
import {profileHeading,foldTime,validProfileControls,type MotionProfileControls} from './motion_profiles.ts';
import { solidPathLines } from '../arc.ts';
import type {SolidPath} from '../../lib/track.ts';
import type { TrackLine } from '../types.ts';
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const rad=(x:number)=>x*Math.PI/180;
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
// Per-step helpers live at module scope: a closure created inside the step
// loop is a fresh function every step.
const easing=(z:number,bias:number)=>bias>=0?Math.pow(z,1+bias):1-Math.pow(1-z,1-bias);
const foldStation=(station:number,onset:number,amount:number,c:ArcMotionControl)=>station<=onset?station:lerp(station,
  onset+(1-onset)*foldTime((station-onset)/(1-onset),c.turnFraction??1/3,c.foldBias??c.bias,
    lerp(.2,Math.min(.2,2/c.support),c.foldTiming??0)),amount);
export type ArcGeometryStyle=MotionProfileControls&{guides?:boolean;faces?:number;
  railLayout?:'paired'|'transfer';independentGuide?:boolean;alignedFoldEntry?:boolean};
export type ArcSectionStyle=ArcGeometryStyle&{subdivisions?:number};
export type ArcMotionControl={entry:number; turn:number; exit:number; support:number; bias:number; offset:number;
  /** Active normal of the receiving surface: +1 ordinary, -1 opposing.
   * This is a physical construction choice, not a distinct impact category. */
  contactSide?:number;
  /** Which rider points a receiver met from the opposing side is placed against (contactSide −1 only): absent, every
   * point (the body can touch first); 1, the sled's four points; 2, the sled's front (NOSE, STRING). Absent for an
   * ordinary surface, which is always placed against the sled. */
  receiverAnchor?:number;
  clearance?:number; guideStart?:number; guideEnd?:number; turnFraction?:number; bend?:number; guideFlare?:number;
  guideTilt?:number;mainEnd?:number;foldBend?:number;foldTiming?:number;foldBias?:number;
  receiverFlight?:number;receiverEntry?:number;receiverTurn?:number;receiverExit?:number;receiverDuration?:number};

/** Explicit timing must be able to represent the inherited five-frame turn. */
export function normalizeArcTurnFraction(fraction:number,support:number):number{
  return clamp(fraction,Math.min(.1,5/support),.85);
}

/** A fixed number of long physical faces is independent of support duration.
 * The inherited subdivision density remains the default for smooth curves. */
export function arcMainSteps(support:number,subdivisions=4,faces?:number):number {
  if(!Number.isFinite(subdivisions)||subdivisions<=0||subdivisions>4)throw new Error('arc subdivisions must be in (0, 4]');
  if(faces!==undefined&&(!Number.isSafeInteger(faces)||faces<2||faces>24))throw new Error('arc faces must be an integer in [2, 24]');
  return faces??Math.max(4,Math.ceil(support*subdivisions));
}

/** Where a catch is placed: each rider point half a frame after the beat
 * frame's first collision pass, so the line is crossed in the middle of the
 * beat frame. Placed at the pass itself, crossings fell near the frame's start
 * (median −0.4 frame from its middle) and a fifth of strong hits tipped into
 * the frame before (docs/research/compiler-ideas-20261101.md). The compiler
 * (arc_interval_state.ts) and the construction verifier
 * (scripts/gallery/verify_construction.ts) both build receivers with it. */
export function catchReceivers<P extends {x:number;y:number;vx:number;vy:number}>(trace:Record<string,P>):Record<string,P>{
  return Object.fromEntries(Object.entries(trace).map(([key,p])=>[key,{...p,x:p.x+.5*p.vx,y:p.y+.5*p.vy}]));
}
/** The receivers a catch's line is placed against: the sled's four points for an ordinary surface; for a surface met
 * from the opposing side (contactSide −1), every rider point (the body can touch first) unless `receiverAnchor` names
 * the sled (1) or its front (2). */
export function receiverPoints<P>(receivers:Record<string,P>,c:Pick<ArcMotionControl,'contactSide'|'receiverAnchor'>):P[]{
  if(c.contactSide!==-1||c.receiverAnchor===1)return ['PEG','TAIL','NOSE','STRING'].map(key=>receivers[key]);
  if(c.receiverAnchor===2)return ['NOSE','STRING'].map(key=>receivers[key]);
  return Object.values(receivers);
}

/** Integrate a tangent schedule into one contiguous polyline. Fewer subdivisions
 * make angular facets; their actual geometry must be searched and replayed. */
export function motionArc(...args: Parameters<typeof motionArcPaths>): TrackLine[] {
  return solidPathLines(motionArcPaths(...args));
}

/** Native candidate evaluation can register these vertices directly. */
export function motionArcPaths(points:any[], velocity:{x:number;y:number}, c:ArcMotionControl, id:number, channel=0, radius=0, subdivisions=4,style?:ArcGeometryStyle):SolidPath[]{
  const {profile}=style??{};
  if(!validProfileControls(style??{}))throw new Error('invalid profile controls');
  const steps=arcMainSteps(c.support,subdivisions,style?.faces);
  const alignedFold=style?.alignedFoldEntry&&profile==='fold'&&style.profileStart===0&&(style.profileStrength??1)===1;
  const entry=rad(c.entry+(alignedFold?c.turn:0)), n={x:Math.sin(entry),y:-Math.cos(entry)}, t={x:Math.cos(entry),y:Math.sin(entry)};
  const side=c.contactSide??1;
  if(side!==1&&side!==-1)throw new Error('invalid receiving surface side');
  const point=points.reduce((a,b)=>side*(a.x*n.x+a.y*n.y)<side*(b.x*n.x+b.y*n.y)?a:b);
  const speed=hypot2(velocity.x,velocity.y), approach=Math.max(20,speed*1.5);
  const anchor={x:point.x+side*n.x*c.offset,y:point.y+side*n.y*c.offset};
  // The straight lead-in never rises into the rider's arrival path (for a surface met from above, never drops into it):
  // laid back from the anchor along whichever of the entry and the arrival heading keeps it on the far side of the path,
  // so the rider cannot pass through it from behind just before the catch (docs/research/geometry-hygiene-20261031.md).
  // (A rider arriving backward, more than a right angle from the entry, keeps the entry.)
  const arrival=entry+Math.atan2(Math.sin(Math.atan2(velocity.y,velocity.x)-entry),Math.cos(Math.atan2(velocity.y,velocity.x)-entry));
  const lead=Math.abs(arrival-entry)>Math.PI/2?entry:side===1?Math.min(entry,arrival):Math.max(entry,arrival);
  let x=anchor.x-approach*Math.cos(lead),y=anchor.y-approach*Math.sin(lead);
  // Work in connected vertices; materialize each physical line only once,
  // after clipping and orientation have settled its endpoints.
  let main = [{x,y},anchor];
  let guide: Array<{x:number;y:number}> = [];
  x=anchor.x;y=anchor.y;
  let v=Math.max(2,velocity.x*t.x+velocity.y*t.y),previousAngle=entry;
  const uniformDt=c.support/steps;
  const first=c.turnFraction===undefined?Math.min(5,c.support*.5):c.support*c.turnFraction;
  const profileFirst=style?.profileStart===undefined?first:c.support*style.profileStart;
  const profileContext={start:rad(c.entry+c.turn),exit:rad(c.exit),foldAngle:c.foldBend??style?.foldAngle};
  for(let k=0;k<steps;k++){
    let dt=uniformDt,time=(k+.5)*dt;
    if(profile==='fold'&&(style?.profileStrength??1)>0){
      const onset=profileFirst/c.support,amount=Math.min(1,style?.profileStrength??1);
      const from=foldStation(k/steps,onset,amount,c),to=foldStation((k+1)/steps,onset,amount,c);
      dt=c.support*(to-from);time=c.support*(from+to)/2;
    }
    const u=clamp(time/first,0,1), w=clamp((time-first)/Math.max(.01,c.support-first),0,1);
    let a=rad(time<first?c.entry+c.turn*easing(u,c.bias):lerp(c.entry+c.turn,c.exit,easing(w,c.bias)));
    if(c.bend!==undefined&&time>=first)a+=rad(c.bend)*Math.sin(Math.PI*w);
    if(profile&&time>=profileFirst)a=profileHeading(profile,a,
      profile==='fold'?clamp(((k+.5)*uniformDt-profileFirst)/Math.max(.01,c.support-profileFirst),0,1):
      style?.profileStart===undefined?w:clamp((time-profileFirst)/Math.max(.01,c.support-profileFirst),0,1),style?.profileStrength,style?.rippleCycles,
      profileContext);
    // Fixed angular folds have actual corners. Applying a smooth-curve radius
    // per face would weaken their angle whenever search shortened that face.
    // Their full corner geometry must pass physical evaluation instead.
    const angularFold=profile==='fold'&&style?.faces!==undefined&&(style?.profileStrength??1)>0&&time>=profileFirst;
    if(radius>0&&!angularFold)a=clamp(a,previousAngle-v*dt/radius,previousAngle+v*dt/radius);
    previousAngle=a;
    const sine=Math.sin(a);
    v=Math.max(1,v+.175*sine*dt);
    const xx=x+Math.cos(a)*v*dt, yy=y+sine*v*dt;
    main.push({x:xx,y:yy});x=xx;y=yy;
  }
  const mainCount=main.length-1,clearance=c.clearance??channel;
  if(style?.guides!==false&&clearance>0&&(c.guideEnd??1)>(c.guideStart??0)){
    const vertices=main;
    const roof=vertices.slice(2).map((p,i)=>{
      const index=i+2,prev=vertices[index-1],next=vertices[Math.min(index+1,vertices.length-1)];
      const a=Math.atan2(next.y-prev.y,next.x-prev.x);
      const separation=c.guideFlare===undefined?clearance:clamp(clearance+c.guideFlare*i/Math.max(1,vertices.length-3),6,30);
      return{x:p.x+side*separation*Math.sin(a),y:p.y-side*separation*Math.cos(a)};
    });
    const distances=[0];for(let i=1;i<roof.length;i++)distances.push(distances.at(-1)!+hypot2(roof[i].x-roof[i-1].x,roof[i].y-roof[i-1].y));
    const length=distances.at(-1)!,from=clamp(c.guideStart??0,0,1)*length,to=clamp(c.guideEnd??1,0,1)*length;
    // Every guide remains one substantial connected curve, including when its
    // endpoints move between subdivision vertices. Zero coverage is a single arc.
    if((c.guideStart===undefined&&c.guideEnd===undefined)||to-from>=24){
      let clipped=roof;
      if(from!==0||to!==length){
        clipped=roof.filter((_,i)=>distances[i]>=from&&distances[i]<=to);
        const at=(distance:number)=>{let i=1;while(i<distances.length-1&&distances[i]<distance)i++;const t=(distance-distances[i-1])/Math.max(1e-12,distances[i]-distances[i-1]);return{x:lerp(roof[i-1].x,roof[i].x,t),y:lerp(roof[i-1].y,roof[i].y,t)};};
        if(from>0&&!distances.includes(from))clipped.unshift(at(from));
        if(to<length&&!distances.includes(to))clipped.push(at(to));
      }
      if(style?.independentGuide&&c.guideTilt){
        const pivot=clipped[Math.floor(clipped.length/2)],a=rad(c.guideTilt),co=Math.cos(a),si=Math.sin(a);
        for(const p of clipped){const x=p.x-pivot.x,y=p.y-pivot.y;p.x=pivot.x+co*x-si*y;p.y=pivot.y+si*x+co*y;}
      }
      guide=clipped.reverse();
    }
  }
  if(style?.railLayout==='transfer'){
    const extent=clamp(c.mainEnd??.7,.2,1);
    let length=0;
    for(let i=1;i<main.length-1;i++)length+=hypot2(main[i+1].x-main[i].x,main[i+1].y-main[i].y);
    let remaining=length*extent;
    const retained=[main[0],main[1]];
    for(let i=1;i<main.length-1;i++){
      const from=main[i],to=main[i+1],length=hypot2(to.x-from.x,to.y-from.y);
      if(remaining<=1e-9)break;
      if(remaining>=length){retained.push(to);remaining-=length;}
      else{retained.push({x:lerp(from.x,to.x,remaining/length),y:lerp(from.y,to.y,remaining/length)});break;}
    }
    main=retained;
  }
  if(side===-1){main.reverse();guide.reverse();}
  // Guide ids retain the original full-main offset even when a transfer
  // shortens its main support; orientation never changes the id range.
  return [{id, points: main}, {id: id + mainCount, points: guide}];
}
