/** Musical context derived exclusively from authored targets; no song identities. */
import {createHash} from 'node:crypto';
import type {Spec} from '../types.ts';
export type ContextSpec=Pick<Spec,'duration'|'contacts'>&Partial<Pick<Spec,'axes'>>;
export type RepertoireContext={impact:number|null;speed:number|null;nextImpact:number|null;nextSpeed:number|null;quiet:number};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
function averageSpeed(spec:ContextSpec,from:number,to:number):number|null{
  const curve=spec.axes?.speed;if(!curve)return null;
  let sum=0,count=0;
  for(let frame=from;frame<=Math.min(to,Math.round(spec.duration*40));frame++){
    const v=curve(frame/40);if(v!==undefined){sum+=v;count++;}
  }
  return count?sum/count:null;
}
export function repertoireContexts(spec:ContextSpec):RepertoireContext[]{
  const starts=[1,...spec.contacts.map(c=>Math.round(c.t*40))],end=Math.round(spec.duration*40);
  const speeds=starts.map((f,i)=>averageSpeed(spec,f,(starts[i+1]??end)-1));
  return starts.map((_,i)=>{
    const impact=i?spec.contacts[i-1].impact??null:null,speed=speeds[i];
    const nextImpact=spec.contacts[i]?.impact??null,nextSpeed=speeds[i+1]??speed;
    // Unknown impact is not a claim of calm; fast low-impact riding remains possible.
    const quiet=impact===null?0:clamp((.22-impact)/.18)*(speed===null?1:clamp((.8-speed)/.35));
    return {impact,speed,nextImpact,nextSpeed,quiet};
  });
}
export function repertoireMusicHash(spec:ContextSpec):string{
  const samples=Array.from({length:Math.round(spec.duration*40)+1},(_,f)=>
    ['air','speed','amplitude'].map(k=>spec.axes?.[k as keyof NonNullable<ContextSpec['axes']>]?.(f/40)??null));
  return createHash('sha256').update(JSON.stringify([spec.duration,spec.contacts,samples])).digest('hex');
}
