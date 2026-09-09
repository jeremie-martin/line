/** Independent necessary detector-timing constraints for benchmark authoring.
 * Three grounded samples in the five-frame persistence window must precede
 * six airborne samples for a normal landing. This is necessary, not a physical
 * sufficiency claim. A witness uses only the judge's existing +/-1 tolerance. */
import assert from 'node:assert/strict';
import {MIN_LANDING_AIRBORNE_FRAMES,PERSISTENCE_FRAMES,PERSISTENCE_RATIO} from '../lib/detector.ts';
const grounded=Math.ceil(PERSISTENCE_FRAMES*PERSISTENCE_RATIO);
const minimum=(gap:number)=>grounded+(gap>MIN_LANDING_AIRBORNE_FRAMES?MIN_LANDING_AIRBORNE_FRAMES:1);

export function persistentContactTiming(frames:readonly number[]):number[]|null{
  let states=new Map<number,number[]>([[0,[]]]),previousAuthored=0;
  for(const frame of frames){
    const next=new Map<number,number[]>();
    for(const offset of [0,-1,1])for(const [previous,path] of states){
      const actual=frame+offset;if(actual-previous<minimum(frame-previousAuthored))continue;
      if(!next.has(actual))next.set(actual,[...path,actual]);
    }
    if(!next.size)return null;states=next;previousAuthored=frame;
  }
  return states.values().next().value??[];
}

/** Minimize authored movement, then actual timing movement. The bounded repair
 * cannot change an event between detector-limited bounce and normal landing. */
export function repairPersistentContactTiming(frames:readonly number[]):number[]{
  if(persistentContactTiming(frames))return [...frames];
  type Path={authored:number[];actual:number[];edits:number;offsets:number};
  let states=new Map<string,Path>([['0:0',{authored:[],actual:[],edits:0,offsets:0}]]);
  for(let i=0;i<frames.length;i++){
    const next=new Map<string,Path>(),originalGap=frames[i]-(frames[i-1]??0);
    for(const shift of [0,-1,1])for(const offset of [0,-1,1])for(const path of states.values()){
      const authored=frames[i]+shift,actual=authored+offset,gap=authored-(path.authored.at(-1)??0);
      if(gap<=0||(gap>MIN_LANDING_AIRBORNE_FRAMES)!==(originalGap>MIN_LANDING_AIRBORNE_FRAMES))continue;
      if(actual-(path.actual.at(-1)??0)<minimum(gap))continue;
      const candidate={authored:[...path.authored,authored],actual:[...path.actual,actual],edits:path.edits+Math.abs(shift),offsets:path.offsets+Math.abs(offset)};
      const key=authored+':'+actual,old=next.get(key);
      if(!old||candidate.edits<old.edits||candidate.edits===old.edits&&candidate.offsets<old.offsets)next.set(key,candidate);
    }
    assert.ok(next.size,'contact program cannot be repaired within one authored frame per contact');states=next;
  }
  const best=[...states.values()].sort((a,b)=>a.edits-b.edits||a.offsets-b.offsets)[0];
  assert.ok(persistentContactTiming(best.authored));return best.authored;
}
