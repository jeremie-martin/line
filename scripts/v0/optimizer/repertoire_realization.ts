/** Geometry and ordered physical-contact evidence, independent of search costs. */
import type {TrackLine} from '../types.ts';
import type {ConstructionRequest,ProductionPlan} from './repertoire_policy.ts';
export type SectionRealization=ReturnType<typeof inspectConstruction>;
const length=(l:TrackLine)=>Math.hypot(l.x2-l.x1,l.y2-l.y1);
export function inspectConstruction(request:ConstructionRequest,lines:TrackLine[],guideIds:ReadonlySet<number>,collisions:readonly (readonly number[])[]){
  const main=lines.filter(l=>!guideIds.has(l.id)),guide=lines.filter(l=>guideIds.has(l.id));
  const touched=new Set(collisions.flat()),mainFrames=collisions.flatMap((ids,f)=>ids.some(id=>main.some(l=>l.id===id))?[f]:[]);
  const guideFrames=collisions.flatMap((ids,f)=>ids.some(id=>guideIds.has(id))?[f]:[]);
  const connected=main.every((l,i)=>i===0||(main[i-1].x2===l.x1&&main[i-1].y2===l.y1));
  // The approach segment precedes the shaped schedule and cannot satisfy its traversal.
  const shaped=connected?main.slice(1):main,totalLength=shaped.reduce((s,l)=>s+length(l),0);
  let distance=0;
  const progresses=new Map(shaped.map(l=>{const p=(distance+length(l)/2)/Math.max(1e-12,totalLength);distance+=length(l);return [l.id,p];}));
  // Contact on an opposing rail can be the mechanism that carries the rider
  // through a bend. Attribute it to the nearest main-rail location; requiring
  // lower-rail contact throughout would reject the behavior we intend to build.
  for(const l of guide){
    const x=(l.x1+l.x2)/2,y=(l.y1+l.y2)/2;let closest=Infinity,progress=0,offset=0;
    for(const m of shaped){
      const dx=m.x2-m.x1,dy=m.y2-m.y1,len=length(m),t=Math.max(0,Math.min(1,((x-m.x1)*dx+(y-m.y1)*dy)/Math.max(1e-12,len*len)));
      const d=Math.hypot(x-m.x1-t*dx,y-m.y1-t*dy);
      if(d<closest){closest=d;progress=(offset+t*len)/Math.max(1e-12,totalLength);}offset+=len;
    }
    if(closest<=40)progresses.set(l.id,progress);
  }
  const visits=collisions.flatMap((ids,frame)=>ids.filter(id=>progresses.has(id)).map(id=>({frame,progress:progresses.get(id)!})));
  const firstAt=(lo:number,hi:number,after=-1)=>visits.find(v=>v.frame>=after&&v.progress>=lo&&v.progress<=hi)?.frame??null;
  const early=firstAt(0,.35),middle=firstAt(.35,.65,early??Infinity),late=firstAt(.65,1,middle??Infinity);
  const headings=shaped.map(l=>Math.atan2(l.y2-l.y1,l.x2-l.x1));
  const turns=headings.slice(1).map((a,i)=>Math.atan2(Math.sin(a-headings[i]),Math.cos(a-headings[i]))*180/Math.PI);
  const turning=turns.reduce((n,v)=>n+Math.abs(v),0);
  const signs=turns.filter(v=>Math.abs(v)>.05).map(Math.sign);
  const turnReversals=signs.slice(1).filter((s,i)=>s!==signs[i]).length;
  const reasons:string[]=[];
  if(!lines.length||lines.some(l=>l.type!==0||!Number.isFinite(length(l))||length(l)<=0))reasons.push('invalid-normal-geometry');
  if(request.construction!=='scattered'&&!main.length)reasons.push('missing-main-rail');
  if(request.construction==='scattered'){
    const fragmentChain=lines.every((l,i)=>i===0||(lines[i-1].x2===l.x1&&lines[i-1].y2===l.y1));
    if(fragmentChain||lines.filter(l=>touched.has(l.id)).length<3||lines.some(l=>length(l)>1))reasons.push('missing-contact-fragmentation');
  }else{
    if(!connected)reasons.push('disconnected-main-rail');
    if(request.guidance==='forbidden'&&guide.length)reasons.push('forbidden-guide');
    if(request.guidance==='required'&&(!guide.length||!guideFrames.length))reasons.push('unused-or-missing-guide');
    if(request.construction!=='arcs'){
      if(totalLength<24||turning<20)reasons.push('insubstantial-shape');
      if(early===null||middle===null||late===null)reasons.push('bypassed-shape');
      if(request.construction==='fold'&&(shaped.length!==3||turns.some(t=>Math.abs(t)<12)))reasons.push('missing-fold-corners');
      if(request.construction!=='fold'&&turnReversals<2)reasons.push('missing-shaped-reversals');
    }
  }
  return {section:request.section,construction:request.construction,guidance:request.guidance,fulfilled:!reasons.length,reasons,
    mainSegments:main.length,guideSegments:guide.length,mainContactFrames:mainFrames.length,guideContactFrames:guideFrames.length,
    mainLength:totalLength,guideLength:guide.reduce((n,l)=>n+length(l),0),turning,turnReversals,orderedTraversal:[early,middle,late],
    contactedMainSegments:main.filter(l=>touched.has(l.id)).length};
}
export function inspectRepertoire(plan:ProductionPlan,lines:TrackLine[],railGuides:Record<number,number[]>,collisions:readonly (readonly number[])[]){
  const sections=plan.requests.map(r=>inspectConstruction(r,lines.filter(l=>Math.floor((l.id-1000)/10000)===r.section),
    new Set(railGuides[r.section]??[]),collisions.slice(r.frame,r.next)));
  return {schema:'line.repertoire-realization.v1',fulfilled:sections.every(s=>s.fulfilled),
    requested:sections.length,fulfilledSections:sections.filter(s=>s.fulfilled).length,sections};
}
