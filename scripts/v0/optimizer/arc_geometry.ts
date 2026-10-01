/** Coherent normal-line geometry shared by construction and refinement studies.
 * This module only builds curves; it does not simulate or select candidates. */
import {railContours, type RailContour} from './rail_contours.ts';
import {profileHeading,foldTime,validProfileControls,type MotionProfileControls} from './motion_profiles.ts';
import { makeSolidLine } from '../arc.ts';
import type { TrackLine } from '../types.ts';
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const rad=(x:number)=>x*Math.PI/180;
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export type ArcGeometryStyle=MotionProfileControls&{guides?:boolean;contour?:RailContour;faces?:number;
  railLayout?:'paired'|'transfer';independentGuide?:boolean};
export type ArcSectionStyle=Omit<ArcGeometryStyle,'contour'>&{subdivisions?:number};
export type ArcMotionControl={entry:number; turn:number; exit:number; support:number; bias:number; offset:number;
  clearance?:number; guideStart?:number; guideEnd?:number; turnFraction?:number; bend?:number; guideFlare?:number; exitBias?:number;
  guideTilt?:number;mainEnd?:number;foldBend?:number;foldTiming?:number};

/** Explicit timing must be able to represent the inherited five-frame turn. */
export function normalizeArcTurnFraction(fraction:number,support:number,preserveImplicit=false):number{
  return clamp(fraction,preserveImplicit?Math.min(.1,5/support):.1,.85);
}

/** A fixed number of long physical faces is independent of support duration.
 * The inherited subdivision density remains the default for smooth curves. */
export function arcMainSteps(support:number,subdivisions=4,faces?:number):number {
  if(!Number.isFinite(subdivisions)||subdivisions<=0||subdivisions>4)throw new Error('arc subdivisions must be in (0, 4]');
  if(faces!==undefined&&(!Number.isSafeInteger(faces)||faces<2||faces>24))throw new Error('arc faces must be an integer in [2, 24]');
  return faces??Math.max(4,Math.ceil(support*subdivisions));
}

/** Integrate a tangent schedule into one contiguous polyline. Fewer subdivisions
 * make angular facets; their actual geometry must be searched and replayed. */
export function motionArc(points:any[], velocity:{x:number;y:number}, c:ArcMotionControl, id:number, flow=false, channel=0, wave=false, radius=0, subdivisions=4,style?:ArcGeometryStyle):TrackLine[]{
  const {profile,contour}=style??{};
  if(!validProfileControls(style??{}))throw new Error('invalid profile controls');
  const steps=arcMainSteps(c.support,subdivisions,style?.faces);
  const entry=rad(c.entry), n={x:Math.sin(entry),y:-Math.cos(entry)}, t={x:Math.cos(entry),y:Math.sin(entry)};
  const point=points.reduce((a,b)=>a.x*n.x+a.y*n.y<b.x*n.x+b.y*n.y?a:b);
  const speed=Math.hypot(velocity.x,velocity.y), approach=Math.max(20,speed*1.5);
  const anchor={x:point.x+n.x*c.offset,y:point.y+n.y*c.offset};
  let x=anchor.x-approach*t.x,y=anchor.y-approach*t.y;
  const lines:TrackLine[]=[];
  lines.push(makeSolidLine(id++,x,y,anchor.x,anchor.y));x=anchor.x;y=anchor.y;
  let v=Math.max(2,velocity.x*t.x+velocity.y*t.y),previousAngle=entry;
  const uniformDt=c.support/steps;
  for(let k=0;k<steps;k++){
    const first=c.turnFraction===undefined?Math.min(wave?6:5,c.support*.5):c.support*c.turnFraction;
    const profileFirst=style?.profileStart===undefined?first:c.support*style.profileStart;
    let dt=uniformDt,time=(k+.5)*dt;
    if(profile==='fold'&&(style?.profileStrength??1)>0){
      const onset=profileFirst/c.support,amount=Math.min(1,style?.profileStrength??1);
      const at=(station:number)=>station<=onset?station:lerp(station,
        onset+(1-onset)*foldTime((station-onset)/(1-onset),c.turnFraction??1/3,c.bias,
          lerp(.2,Math.min(.2,2/c.support),c.foldTiming??0)),amount);
      const from=at(k/steps),to=at((k+1)/steps);
      dt=c.support*(to-from);time=c.support*(from+to)/2;
    }
    const u=clamp(time/first,0,1), w=clamp((time-first)/Math.max(.01,c.support-first),0,1);
    const easing=(z:number,bias=c.bias)=>bias>=0?Math.pow(z,1+bias):1-Math.pow(1-z,1-bias);
    let a=rad(time<first?c.entry+c.turn*(wave?Math.sin(Math.PI*u):easing(u)):lerp(c.entry+(wave?0:c.turn),c.exit,easing(w,c.exitBias??c.bias)));
    if(c.bend!==undefined&&time>=first)a+=rad(c.bend)*Math.sin(Math.PI*w);
    if(profile&&time>=profileFirst)a=profileHeading(profile,a,
      profile==='fold'?clamp(((k+.5)*uniformDt-profileFirst)/Math.max(.01,c.support-profileFirst),0,1):
      style?.profileStart===undefined?w:clamp((time-profileFirst)/Math.max(.01,c.support-profileFirst),0,1),style?.profileStrength,style?.rippleCycles,
      {start:rad(c.entry+c.turn),exit:rad(c.exit),foldAngle:c.foldBend??style?.foldAngle});
    // Fixed angular folds have actual corners. Applying a smooth-curve radius
    // per face would weaken their angle whenever search shortened that face.
    // Their full corner geometry must pass physical evaluation instead.
    const angularFold=profile==='fold'&&style?.faces!==undefined&&(style?.profileStrength??1)>0&&time>=profileFirst;
    if(radius>0&&!angularFold)a=clamp(a,previousAngle-v*dt/radius,previousAngle+v*dt/radius);
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
  const mainCount=lines.length,clearance=c.clearance??channel;
  if(style?.guides!==false&&clearance>0&&(c.guideEnd??1)>(c.guideStart??0)){
    const vertices=lines.map(l=>({x:l.x1,y:l.y1}));vertices.push({x:lines.at(-1)!.x2,y:lines.at(-1)!.y2});
    const roof=vertices.slice(2).map((p,i)=>{
      const index=i+2,prev=vertices[index-1],next=vertices[Math.min(index+1,vertices.length-1)];
      const a=Math.atan2(next.y-prev.y,next.x-prev.x);
      const separation=c.guideFlare===undefined?clearance:clamp(clearance+c.guideFlare*i/Math.max(1,vertices.length-3),6,30);
      return{x:p.x+separation*Math.sin(a),y:p.y-separation*Math.cos(a)};
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
      if(style?.independentGuide&&c.guideTilt){
        const pivot=clipped[Math.floor(clipped.length/2)],a=rad(c.guideTilt),co=Math.cos(a),si=Math.sin(a);
        for(const p of clipped){const x=p.x-pivot.x,y=p.y-pivot.y;p.x=pivot.x+co*x-si*y;p.y=pivot.y+si*x+co*y;}
      }
      clipped.reverse();
      for(let i=1;i<clipped.length;i++)lines.push(makeSolidLine(id++,clipped[i-1].x,clipped[i-1].y,clipped[i].x,clipped[i].y));
    }
  }
  if(style?.railLayout==='transfer'){
    const main=lines.slice(0,mainCount),extent=clamp(c.mainEnd??.7,.2,1);
    let remaining=main.slice(1).reduce((n,l)=>n+Math.hypot(l.x2-l.x1,l.y2-l.y1),0)*extent;
    const retained=[main[0]];
    for(const line of main.slice(1)){
      const length=Math.hypot(line.x2-line.x1,line.y2-line.y1);if(remaining<=1e-9)break;
      if(remaining>=length){retained.push(line);remaining-=length;}
      else{retained.push({...line,x2:lerp(line.x1,line.x2,remaining/length),y2:lerp(line.y1,line.y2,remaining/length)});break;}
    }
    return [...retained,...lines.slice(mainCount)];
  }
  return contour?railContours(lines,contour,id):lines;
}
