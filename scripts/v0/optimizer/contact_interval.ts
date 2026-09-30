/** Interval-local contact reconstruction. Observation uses the reference JS
 * collision operation; every emitted fragment is subsequently physically searched. */
import {getRiderMetered} from '../../lib/detector.ts';
import {contactFragments} from './contact_fragments.ts';
import type {TrackLine} from '../types.ts';
const core=await import(new URL('../../../vendor/lr-core/line-rider-engine/index.js',import.meta.url).href);
const Observer=typeof core.default==='function'?core.default:core.default.default;
const createLine=core.createLineFromJson??core.default.createLineFromJson;
export function contactObserver(start:{position:{x:number;y:number};velocity:{x:number;y:number}}){return new Observer().setStart(start.position,start.velocity);}
export function extendContactObserver(base:any,lines:TrackLine[]){return lines.length?base.addLine(lines.map(l=>createLine({...l}))):base;}
export function fragmentInterval(base:any,lines:TrackLine[],frame:number,horizon:number,width=.003){
  getRiderMetered(base,frame-1);
  const footprints=new Map<number,number[]>();let active=true,observer=base;
  try{
    for(const l of lines){
      const line=createLine({...l}),collide=line.collide.bind(line);
      line.collide=(point:any)=>{
        const next=collide(point);
        if(active&&next){const dx=l.x2-l.x1,dy=l.y2-l.y1,t=((next.pos.x-l.x1)*dx+(next.pos.y-l.y1)*dy)/(dx*dx+dy*dy);
          const values=footprints.get(l.id)??[];values.push(t);footprints.set(l.id,values);}
        return next;
      };
      observer=observer.addLine(line);
    }
    getRiderMetered(observer,horizon);
  }finally{active=false;}
  let firstGuide=lines.length;
  for(let i=1;i<lines.length;i++)if(lines[i-1].x2!==lines[i].x1||lines[i-1].y2!==lines[i].y1){firstGuide=i;break;}
  const fragments:TrackLine[]=[],guideIds:number[]=[];
  for(const [i,line]of lines.entries())for(const f of contactFragments([line],new Map(footprints.has(line.id)?[[line.id,footprints.get(line.id)!]]:[]),width)){
    const id=lines[0].id+fragments.length;if(fragments.length>=10000)throw new Error('contact interval exceeds its segment namespace');
    fragments.push({...f,id});if(i>=firstGuide)guideIds.push(id);
  }
  return {lines:fragments,guideIds};
}
