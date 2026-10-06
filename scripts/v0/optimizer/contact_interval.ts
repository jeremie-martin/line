/** Construct fragments from the carrier's original native collision records.
 * This is pure geometry; emitted fragments still undergo a complete physical search. */
import {contactFragments} from './contact_fragments.ts';
import type {TrackLine} from '../types.ts';
export function fragmentInterval(lines:TrackLine[],positions:Float64Array,width=.003){
  const footprints=new Map<number,number[]>(),byId=new Map(lines.map(l=>[l.id,l]));
  for(let i=0;i<positions.length;i+=3){
    const l=byId.get(positions[i]);if(!l)continue;
    const dx=l.x2-l.x1,dy=l.y2-l.y1,t=((positions[i+1]-l.x1)*dx+(positions[i+2]-l.y1)*dy)/(dx*dx+dy*dy);
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
