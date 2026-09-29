/** Material-side contours built before candidate simulation. Every edge is an
 * ordinary physical line. The supporting curve remains part of each structure. */
import {makeSolidLine} from '../arc.ts';
import type {TrackLine} from '../types.ts';
export const RAIL_CONTOURS=['ribbon','teeth','petals'] as const;
export type RailContour=typeof RAIL_CONTOURS[number];
type Point={x:number;y:number};

export function railContours(lines:TrackLine[],kind:RailContour,id:number):TrackLine[]{
  if(!RAIL_CONTOURS.includes(kind))throw new Error(`unknown rail contour: ${kind}`);
  const out=[...lines];
  const chains:TrackLine[][]=[];
  for(const l of lines){
    if(l.type!==0||!Number.isFinite(Math.hypot(l.x2-l.x1,l.y2-l.y1))||Math.hypot(l.x2-l.x1,l.y2-l.y1)<=0)throw new Error('contours require finite, nondegenerate normal lines');
    const previous=chains.at(-1)?.at(-1);
    if(!previous||previous.x2!==l.x1||previous.y2!==l.y1||previous.flipped!==l.flipped)chains.push([l]);
    else chains.at(-1)!.push(l);
  }
  for(const chain of chains){
    const distances=[0];for(const l of chain)distances.push(distances.at(-1)!+Math.hypot(l.x2-l.x1,l.y2-l.y1));
    const length=distances.at(-1)!;
    const at=(distance:number)=>{
      let lo=0,hi=chain.length-1;
      while(lo<hi){const mid=(lo+hi)>>>1;if(distances[mid+1]<distance)lo=mid+1;else hi=mid;}
      const i=lo;
      const l=chain[i],d=distances[i+1]-distances[i],t=(distance-distances[i])/d,s=l.flipped?-1:1;
      return {x:l.x1+(l.x2-l.x1)*t,y:l.y1+(l.y2-l.y1)*t,nx:-(l.y2-l.y1)/d*s,ny:(l.x2-l.x1)/d*s};
    };
    const add=(a:Point,b:Point,n:{nx:number;ny:number})=>{
      if(Math.hypot(b.x-a.x,b.y-a.y)<1e-6)return;
      const l=makeSolidLine(id++,a.x,a.y,b.x,b.y);
      // Faces point into the same material half-space as their supporting rail;
      // a reversed back face must not push the rider through the front face.
      const material=-(b.y-a.y)*n.nx+(b.x-a.x)*n.ny;
      const forward=-(b.y-a.y)*n.ny-(b.x-a.x)*n.nx;
      l.flipped=material< -1e-9 || (Math.abs(material)<=1e-9 && forward>0);out.push(l);
    };
    const count=Math.max(1,Math.round(length/28));
    for(let k=0;k<count;k++){
      const start=length*k/count,end=length*(k+1)/count,steps=kind==='teeth'?2:8;
      let previous:Point=at(start);
      if(kind==='ribbon'){
        const n=at(start),p={x:n.x+n.nx*12,y:n.y+n.ny*12};if(k===0)add(previous,p,n);previous=p;
      }
      for(let j=1;j<=steps;j++){
        const u=j/steps,n=at(start+(end-start)*u);
        const depth=kind==='ribbon'?12:j===steps?0:kind==='teeth'?20*(1-Math.abs(2*u-1)):14*Math.sin(Math.PI*u);
        const p={x:n.x+n.nx*depth,y:n.y+n.ny*depth};add(previous,p,n);previous=p;
      }
      if(kind==='ribbon')add(previous,at(end),at(end));
    }
  }
  return out;
}
