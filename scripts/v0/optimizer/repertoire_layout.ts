/** New-layout checks. The frozen V5 realization module remains untouched. */
import {inspectConstruction} from './repertoire_realization.ts';
import type {ConstructionRequest,ProductionPlan} from './repertoire_policy.ts';
import type {TrackLine} from '../types.ts';
const length=(l:TrackLine)=>Math.hypot(l.x2-l.x1,l.y2-l.y1);
export function inspectLayout(request:ConstructionRequest,lines:TrackLine[],guideIds:ReadonlySet<number>,collisions:readonly (readonly number[])[]){
  if(request.railLayout!=='transfer')return inspectConstruction(request,lines,guideIds,collisions);
  const base=inspectConstruction({...request,construction:'arcs'},lines,guideIds,collisions),reasons=[...base.reasons];
  const main=lines.filter(l=>!guideIds.has(l.id)),guide=lines.filter(l=>guideIds.has(l.id));
  const mainIds=new Set(main.map(l=>l.id)),touched=new Set(collisions.flat());
  const mainFrames=collisions.flatMap((ids,f)=>ids.some(id=>mainIds.has(id))?[f]:[]);
  const lastMain=mainFrames.at(-1)??-1;
  const receivingFrames=collisions.flatMap((ids,f)=>f>lastMain&&ids.some(id=>guideIds.has(id))?[f]:[]);
  const firstReceive=receivingFrames[0]??-1;
  const freeBetween=lastMain<0||firstReceive<0?0:collisions.slice(lastMain+1,firstReceive).filter(ids=>!ids.length).length;
  // At a contacted receiving segment, all of the support must lie behind the
  // receiver along its forward tangent. A still-present parallel floor fails.
  const receiver=guide.filter(l=>collisions.slice(Math.max(0,firstReceive)).some(ids=>ids.includes(l.id)));
  const vertices=main.flatMap(l=>[{x:l.x1,y:l.y1},{x:l.x2,y:l.y2}]);
  const receivingClearance=Math.max(0,...receiver.map(l=>{
    const n=length(l),tx=(l.x1-l.x2)/n,ty=(l.y1-l.y2)/n,mx=(l.x1+l.x2)/2,my=(l.y1+l.y2)/2;
    return vertices.length?Math.min(...vertices.map(p=>(mx-p.x)*tx+(my-p.y)*ty)):0;
  }));
  if(lastMain<0||receivingFrames.length<2||freeBetween<1||receivingClearance<6)reasons.push('missing-separated-transfer');
  const chains=[main.slice(1),[...guide].reverse().map(l=>({...l,x1:l.x2,y1:l.y2,x2:l.x1,y2:l.y1}))];
  const corners=chains.flatMap(chain=>chain.slice(1).map((l,i)=>{
    const p=chain[i],a=Math.atan2(p.y2-p.y1,p.x2-p.x1),b=Math.atan2(l.y2-l.y1,l.x2-l.x1);
    return {turn:Math.atan2(Math.sin(b-a),Math.cos(b-a))*180/Math.PI,
      engaged:touched.has(p.id)&&touched.has(l.id)};
  }));
  const turning=corners.reduce((n,c)=>n+Math.abs(c.turn),0),engagedTurns=corners.filter(c=>c.engaged&&Math.abs(c.turn)>=12).length;
  const signs=corners.filter(c=>Math.abs(c.turn)>.05).map(c=>Math.sign(c.turn));
  const reversals=signs.slice(1).filter((s,i)=>s!==signs[i]).length;
  const directions=new Map(lines.map(l=>{const sign=guideIds.has(l.id)?-1:1,n=length(l);
    return [l.id,{x:sign*(l.x2-l.x1)/n,y:sign*(l.y2-l.y1)/n}];}));
  const contactHeadings=collisions.flatMap(ids=>{
    const unique=[...new Set(ids)].filter(id=>directions.has(id));if(!unique.length)return [];
    const v=unique.reduce((a,id)=>({x:a.x+directions.get(id)!.x,y:a.y+directions.get(id)!.y}),{x:0,y:0});
    return Math.hypot(v.x,v.y)>1e-9?[Math.atan2(v.y,v.x)]:[];
  });
  const contactTurns=contactHeadings.slice(1).map((a,i)=>Math.atan2(Math.sin(a-contactHeadings[i]),Math.cos(a-contactHeadings[i]))*180/Math.PI);
  const contactTurning=contactTurns.reduce((n,a)=>n+Math.abs(a),0);
  // Accumulate runs, so a smooth turn sampled in small increments still counts.
  const runs:number[]=[];for(const turn of contactTurns){if(Math.abs(turn)<.05)continue;
    if(runs.length&&Math.sign(runs.at(-1)!)===Math.sign(turn))runs[runs.length-1]+=turn;else runs.push(turn);}
  const meaningfulRuns=runs.filter(turn=>Math.abs(turn)>=8);
  const contactReversals=meaningfulRuns.slice(1).filter((t,i)=>Math.sign(t)!==Math.sign(meaningfulRuns[i])).length;
  if(request.construction!=='arcs'){
    if(main.slice(1).reduce((n,l)=>n+length(l),0)+guide.reduce((n,l)=>n+length(l),0)<24||turning<20)reasons.push('insubstantial-shape');
    if(request.construction==='fold'&&engagedTurns<2)reasons.push('missing-engaged-transfer-corners');
    if(request.construction!=='fold'&&(reversals<2||contactTurning<20||contactReversals<1||chains.some(chain=>!chain.some(l=>touched.has(l.id)))))reasons.push('missing-engaged-transfer-reversals');
  }
  return {...base,construction:request.construction,fulfilled:!reasons.length,reasons,turning,turnReversals:reversals,
    transfer:{lastMain,firstReceive,receivingFrames:receivingFrames.length,freeBetween,receivingClearance,engagedTurns,contactTurning,contactReversals}};
}
export function inspectRepertoireLayout(plan:ProductionPlan,lines:TrackLine[],railGuides:Record<number,number[]>,collisions:readonly (readonly number[])[]){
  const sections=plan.requests.map(r=>inspectLayout(r,lines.filter(l=>Math.floor((l.id-1000)/10000)===r.section),
    new Set(railGuides[r.section]??[]),collisions.slice(r.frame,r.next)));
  return {schema:'line.repertoire-realization.v2',fulfilled:sections.every(s=>s.fulfilled),
    requested:sections.length,fulfilledSections:sections.filter(s=>s.fulfilled).length,sections};
}
