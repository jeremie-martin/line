import {hypot2} from '../../lib/hypot2.ts';
/** Geometry and ordered physical-contact evidence, independent of search costs. */
import type {TrackLine} from '../types.ts';
import type {ConstructionRequest,ProductionPlan} from './repertoire_policy.ts';
const length=(l:TrackLine)=>hypot2(l.x2-l.x1,l.y2-l.y1);
const GUIDE_REACH=40,CELL=32,INDEXED_PAIRS=50_000;
/** Progress along `shaped` of each guide midpoint's nearest shaped segment
 * (the lowest index on ties, as a forward scan keeps the first), for guides
 * within GUIDE_REACH px. Each segment's direction, length and preceding length
 * are computed once, in order. Segments are bucketed by the CELL-sized cells
 * their bounding boxes cover (v/CELL is exact), and each guide visits rings of
 * cells until the ring is farther than the nearest distance so far (at most
 * GUIDE_REACH) by a margin far above the rounding of any distance; a segment
 * whose own box is that far is skipped too. Unvisited and skipped segments
 * therefore cannot be nearer or tie. Small inspections (at most INDEXED_PAIRS
 * guide/segment pairs, where building the grid costs more than it saves) and
 * geometry the grid cannot index visit every segment, still skipping boxes. */
export function guideProgress(guide:readonly TrackLine[],shaped:readonly TrackLine[],totalLength:number){
  if(!guide.length)return [];
  let offset=0;
  const segments=shaped.map(m=>{const len=length(m),s={m,dx:m.x2-m.x1,dy:m.y2-m.y1,len,offset,
    minX:Math.min(m.x1,m.x2),maxX:Math.max(m.x1,m.x2),minY:Math.min(m.y1,m.y2),maxY:Math.max(m.y1,m.y2)};offset+=len;return s;});
  const cell=(v:number)=>Math.floor(v/CELL);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const s of segments){minX=Math.min(minX,s.minX);minY=Math.min(minY,s.minY);maxX=Math.max(maxX,s.maxX);maxY=Math.max(maxY,s.maxY);}
  const x0=cell(minX),y0=cell(minY),width=cell(maxX)-x0+1,height=cell(maxY)-y0+1;
  const indexed=guide.length*segments.length>INDEXED_PAIRS&&width*height<=4*segments.length+1024&&
    guide.every(l=>Number.isFinite(l.x1+l.x2+l.y1+l.y2));
  const cells:number[][]=[];
  if(indexed)segments.forEach((s,i)=>{
    for(let cx=cell(s.minX);cx<=cell(s.maxX);cx++)for(let cy=cell(s.minY);cy<=cell(s.maxY);cy++)(cells[(cx-x0)*height+cy-y0]??=[]).push(i);
  });
  const progresses:Array<[number,number]>=[];
  let x=0,y=0,closest=Infinity,progress=0,best=-1;
  const visit=(i:number)=>{
    const {m,dx,dy,len,offset,minX,maxX,minY,maxY}=segments[i];
    const bx=Math.max(minX-x,0,x-maxX),by=Math.max(minY-y,0,y-maxY),reach=closest*(1+1e-9)+1e-6;
    if(bx*bx+by*by>reach*reach)return;
    const t=Math.max(0,Math.min(1,((x-m.x1)*dx+(y-m.y1)*dy)/Math.max(1e-12,len*len)));
    const d=hypot2(x-m.x1-t*dx,y-m.y1-t*dy);
    if(d<closest||d===closest&&i<best){closest=d;best=i;progress=(offset+t*len)/Math.max(1e-12,totalLength);}
  };
  for(const l of guide){
    x=(l.x1+l.x2)/2;y=(l.y1+l.y2)/2;closest=Infinity;progress=0;best=-1;
    if(!indexed)for(let i=0;i<segments.length;i++)visit(i);
    else{
      // A cell r rings away is at least (r-1)*CELL from the midpoint.
      const px=cell(x)-x0,py=cell(y)-y0;
      for(let r=0;(r-1)*CELL<=Math.min(closest,GUIDE_REACH)*(1+1e-9)+1e-6;r++)
        for(let cx=Math.max(0,px-r);cx<=Math.min(width-1,px+r);cx++)for(let cy=Math.max(0,py-r);cy<=Math.min(height-1,py+r);cy++)
          if(Math.max(Math.abs(cx-px),Math.abs(cy-py))===r)for(const i of cells[cx*height+cy]??[])visit(i);
    }
    if(closest<=GUIDE_REACH)progresses.push([l.id,progress]);
  }
  return progresses;
}
export function inspectConstruction(request:ConstructionRequest,lines:readonly TrackLine[],guideIds:ReadonlySet<number>,collisions:readonly (readonly number[])[]){
  const main:TrackLine[]=[],guide:TrackLine[]=[],mainIds=new Set<number>();
  for(const line of lines){
    if(guideIds.has(line.id))guide.push(line);
    else{main.push(line);mainIds.add(line.id);}
  }
  const touched=new Set<number>();
  let mainContactFrames=0,guideContactFrames=0;
  for(const ids of collisions){
    let mainContact=false,guideContact=false;
    for(const id of ids){
      touched.add(id);
      // The previous main-line comparison used ===, which never matches NaN.
      mainContact ||= !Number.isNaN(id)&&mainIds.has(id);
      guideContact ||= guideIds.has(id);
    }
    if(mainContact)mainContactFrames++;
    if(guideContact)guideContactFrames++;
  }
  const connected=main.every((l,i)=>i===0||(main[i-1].x2===l.x1&&main[i-1].y2===l.y1));
  // The approach segment precedes the shaped schedule and cannot satisfy its traversal.
  const shaped=connected?main.slice(1):main,shapeLengths=shaped.map(length);
  const totalLength=shapeLengths.reduce((sum,len)=>sum+len,0);
  let distance=0;
  const progresses=new Map(shaped.map((l,i)=>{const len=shapeLengths[i],p=(distance+len/2)/Math.max(1e-12,totalLength);distance+=len;return [l.id,p];}));
  // Contact on an opposing rail can be the mechanism that carries the rider
  // through a bend. Attribute it to the nearest main-rail location; requiring
  // lower-rail contact throughout would reject the behavior we intend to build.
  // Only contacted guide lines are visited, so only theirs are attributed.
  for(const [id,progress] of guideProgress(guide.filter(l=>touched.has(l.id)),shaped,totalLength))progresses.set(id,progress);
  const firstAt=(lo:number,hi:number,after=0)=>{
    for(let frame=after;frame<collisions.length;frame++)for(const id of collisions[frame]){
      const progress=progresses.get(id);
      if(progress!==undefined&&progress>=lo&&progress<=hi)return frame;
    }
    return null;
  };
  const early=firstAt(0,.35),middle=firstAt(.35,.65,early??Infinity),late=firstAt(.65,1,middle??Infinity);
  const headings=shaped.map(l=>Math.atan2(l.y2-l.y1,l.x2-l.x1));
  const turns=headings.slice(1).map((a,i)=>Math.atan2(Math.sin(a-headings[i]),Math.cos(a-headings[i]))*180/Math.PI);
  const turning=turns.reduce((n,v)=>n+Math.abs(v),0);
  const signs=turns.filter(v=>Math.abs(v)>.05).map(Math.sign);
  const turnReversals=signs.slice(1).filter((s,i)=>s!==signs[i]).length;
  const reasons:string[]=[];
  if(!lines.length||lines.some(l=>{if(l.type!==0)return true;const len=length(l);return !Number.isFinite(len)||len<=0;}))reasons.push('invalid-normal-geometry');
  if(request.construction!=='scattered'&&!main.length)reasons.push('missing-main-rail');
  if(request.construction==='scattered'){
    const fragmentChain=lines.every((l,i)=>i===0||(lines[i-1].x2===l.x1&&lines[i-1].y2===l.y1));
    if(fragmentChain||lines.filter(l=>touched.has(l.id)).length<3||lines.some(l=>length(l)>1))reasons.push('missing-contact-fragmentation');
  }else{
    if(!connected)reasons.push('disconnected-main-rail');
    if(request.guidance==='forbidden'&&guide.length)reasons.push('forbidden-guide');
    if(request.guidance==='required'&&(!guide.length||!guideContactFrames))reasons.push('unused-or-missing-guide');
    if(request.construction!=='arcs'){
      if(totalLength<24||turning<20)reasons.push('insubstantial-shape');
      if(early===null||middle===null||late===null)reasons.push('bypassed-shape');
      if(request.construction==='fold'&&(shaped.length!==3||turns.some(t=>Math.abs(t)<12)))reasons.push('missing-fold-corners');
      if(request.construction!=='fold'&&turnReversals<2)reasons.push('missing-shaped-reversals');
    }
  }
  return {section:request.section,construction:request.construction,guidance:request.guidance,fulfilled:!reasons.length,reasons,
    mainSegments:main.length,guideSegments:guide.length,mainContactFrames,guideContactFrames,
    mainLength:totalLength,guideLength:guide.reduce((n,l)=>n+length(l),0),turning,turnReversals,orderedTraversal:[early,middle,late],
    contactedMainSegments:main.filter(l=>touched.has(l.id)).length};
}
export function inspectRepertoire(plan:ProductionPlan,lines:readonly TrackLine[],railGuides:Record<number,number[]>,collisions:readonly (readonly number[])[]){
  const sections=plan.requests.map(r=>inspectConstruction(r,lines.filter(l=>Math.floor((l.id-1000)/10000)===r.section),
    new Set(railGuides[r.section]??[]),collisions.slice(r.frame,r.next)));
  return {schema:'line.repertoire-realization.v1',fulfilled:sections.every(s=>s.fulfilled),
    requested:sections.length,fulfilledSections:sections.filter(s=>s.fulfilled).length,sections};
}
