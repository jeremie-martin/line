/** Interval-local contact reconstruction from native collision observations.
 * Every emitted fragment is subsequently validated by physical replay. */
import type {LineRiderEngine as Engine} from '../../lib/native_motion/engine.ts';
import {getRiderMetered} from '../../lib/detector.ts';
import {contactFragments} from './contact_fragments.ts';
import type {TrackLine} from '../types.ts';
/** Record the carrier's exact native collision positions. Replaying the
 * requested window is explicit and metered; no independent JS history exists. */
export function fragmentInterval(base:Engine,lines:TrackLine[],frame:number,horizon:number,width=.003){
  const footprints=new Map<number,number[]>(),byId=new Map(lines.map(l=>[l.id,l]));
  const observer=base.addLine(lines);
  observer.prepareContactTrace(frame,horizon);
  let observed:Array<{line:number;x:number;y:number}>;
  try{getRiderMetered(observer,horizon);}finally{observed=observer.endContactTrace();}
  for(const hit of observed){
    const l=byId.get(hit.line);if(!l)continue;
    const dx=l.x2-l.x1,dy=l.y2-l.y1,t=((hit.x-l.x1)*dx+(hit.y-l.y1)*dy)/(dx*dx+dy*dy);
    const values=footprints.get(l.id)??[];values.push(t);footprints.set(l.id,values);
  }
  let firstGuide=lines.length;
  for(let i=1;i<lines.length;i++)if(lines[i-1].x2!==lines[i].x1||lines[i-1].y2!==lines[i].y1){firstGuide=i;break;}
  const fragments:TrackLine[]=[],guideIds:number[]=[];
  for(const [i,line]of lines.entries())for(const f of contactFragments([line],new Map(footprints.has(line.id)?[[line.id,footprints.get(line.id)!]]:[]),width)){
    const id=lines[0].id+fragments.length;if(fragments.length>=10000)throw new Error('contact interval exceeds its segment namespace');
    fragments.push({...f,id});if(i>=firstGuide)guideIds.push(id);
  }
  return {lines:fragments,guideIds};
}
