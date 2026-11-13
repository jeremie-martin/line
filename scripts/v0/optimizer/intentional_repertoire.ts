/** Context-sensitive seeded arrangement. Frozen V1 plans remain reproducible. */
import {createHash} from 'node:crypto';
import {makeRng} from '../../lib/rng.ts';
import {planRepertoire,creativePreferences,validateProductionPlan,type CreativePreferences,type ProductionPlan,type Construction,type Guidance} from './repertoire_policy.ts';
import {repertoireContexts,repertoireMusicHash,type ContextSpec} from './repertoire_context.ts';
export const INTENTIONAL_REPERTOIRE_POLICY='line.repertoire-policy.v2';
const smoothstep=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
export function planIntentionalRepertoire(spec:ContextSpec,seed:number,input:CreativePreferences={},boundaries:number[]=[]):ProductionPlan{
  // V1 supplies validated timeline and boundary semantics, never a selected physical ride.
  const scaffold=planRepertoire(spec,seed,input,boundaries),preferences=creativePreferences(input),contexts=repertoireContexts(spec);
  const hash=createHash('sha256').update(JSON.stringify([INTENTIONAL_REPERTOIRE_POLICY,seed,'diversity'])).digest('hex');
  const rng=makeRng(parseInt(hash.slice(0,8),16)),requests=scaffold.requests.map(r=>({...r,context:contexts[r.section]}));
  const boundarySections=new Set(boundaries.map(t=>requests.find(r=>r.section>0&&r.frame>=Math.round(t*40))?.section));
  const phrases:ProductionPlan['phrases']=[];let previous='';
  for(let first=1;first<requests.length;){
    let count=Math.min(rng()<.5?2:3,requests.length-first);
    for(let offset=1;offset<count;offset++){
      const a=contexts[first],b=contexts[first+offset];
      if(boundarySections.has(first+offset)||Math.abs(a.quiet-b.quiet)>.4||Math.abs((a.speed??.5)-(b.speed??.5))>.2){count=offset;break;}
    }
    const quiet=contexts.slice(first,first+count).reduce((n,c)=>n+c.quiet,0)/count;
    const {repertoire,variation,guidedBalance}=preferences;
    const scatter=repertoire.includes('scattered')?.15*variation*(1-.8*quiet):0;
    // Calmness adjusts a preference, not a hard ban on functional guidance.
    const guided=guidedBalance*(1-.82*quiet),connected=repertoire.filter(c=>c!=='scattered');
    const choices:Array<{construction:Construction;guidance:Guidance;weight:number}>=[];
    // Strong catches land harder and keep more speed with a guide offered (V8: open arcs 0.15 short of strong asks and
    // 0.054 slow after them; arcs offered a guide 0.10 and 0.029). In a strong phrase the open arcs' share becomes arcs
    // offered a guide, phased in over the phrase's mean ask from 0.4 (none) to 0.8 (all).
    const strong=contexts.slice(first,first+count).reduce((n,c)=>n+smoothstep(((c.impact??0)-.4)/.4),0)/count;
    const open=repertoire.includes('arcs')?(1-scatter)*(1-guided):0;
    if(open)choices.push({construction:'arcs',guidance:'forbidden',weight:open*(1-strong)});
    for(const construction of connected){
      const fraction=construction==='arcs'?1-variation+variation/connected.length:variation/connected.length;
      // A guide is offered, never required: the search uses it where it helps the
      // catch (most shaped sections do) instead of buying a forced touch, the main
      // source of unwanted impacts (REWORK.md, November 1).
      choices.push({construction,guidance:'optional',weight:(1-scatter)*guided*fraction+(construction==='arcs'?open*strong:0)});
    }
    choices.push({construction:'scattered',guidance:'optional',weight:scatter});
    for(const c of choices)if(c.construction+':'+c.guidance===previous)c.weight*=.25;
    const total=choices.reduce((n,c)=>n+c.weight,0);if(!(total>0))throw new Error('creative preferences leave no eligible construction');
    let draw=rng()*total,selected=choices.at(-1)!;
    for(const c of choices){draw-=c.weight;if(draw<0){selected=c;break;}}
    const {construction,guidance}=selected,railLayout='paired' as const;
    phrases.push({first,count,construction,guidance,railLayout,choices});
    for(let i=first;i<first+count;i++)requests[i]={...requests[i],construction,guidance,railLayout};
    previous=construction+':'+guidance;first+=count;
  }
  return validateProductionPlan(spec,{...scaffold,policy:INTENTIONAL_REPERTOIRE_POLICY,musicalSha256:repertoireMusicHash(spec),phrases,requests});
}

/** Splits each phrase where its sections' requests no longer agree (a phrase
 * has one construction, guidance and rail layout): the plan of a realized ride
 * after the search simplified a section's request (arc_sequence.ts). */
export function splitPhrases(phrases:ProductionPlan['phrases'],requests:ProductionPlan['requests']){
  const split:ProductionPlan['phrases']=[];
  for(const p of phrases)for(let i=p.first;i<p.first+p.count;i++){
    const last=split.at(-1),r=requests[i];
    if(last&&i>p.first&&r.construction===last.construction&&r.guidance===last.guidance&&r.railLayout===last.railLayout)last.count++;
    else split.push({...p,first:i,count:1,construction:r.construction,guidance:r.guidance,railLayout:r.railLayout});
  }
  return split;
}
