/** Coherent normal-line geometry shared by construction and refinement studies.
 * This module only builds curves; it does not simulate or select candidates. */
import { makeSolidLine } from '../arc.ts';
import type { TrackLine } from '../types.ts';
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const rad=(x:number)=>x*Math.PI/180;
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export type ArcMotionControl={entry:number; turn:number; exit:number; support:number; bias:number; offset:number;
  clearance?:number; guideStart?:number; guideEnd?:number; turnFraction?:number; bend?:number; guideFlare?:number; exitBias?:number};

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
    const time=(k+.5)*dt, first=c.turnFraction===undefined?Math.min(wave?6:5,c.support*.5):c.support*c.turnFraction;
    const u=clamp(time/first,0,1), w=clamp((time-first)/Math.max(.01,c.support-first),0,1);
    const easing=(z:number,bias=c.bias)=>bias>=0?Math.pow(z,1+bias):1-Math.pow(1-z,1-bias);
    let a=rad(time<first?c.entry+c.turn*(wave?Math.sin(Math.PI*u):easing(u)):lerp(c.entry+(wave?0:c.turn),c.exit,easing(w,c.exitBias??c.bias)));
    if(c.bend!==undefined&&time>=first)a+=rad(c.bend)*Math.sin(Math.PI*w);
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
      clipped.reverse();
      for(let i=1;i<clipped.length;i++)lines.push(makeSolidLine(id++,clipped[i-1].x,clipped[i-1].y,clipped[i].x,clipped[i].y));
    }
  }
  return lines;
}
