/** Small, reproducible production policy. Musical targets are never randomized here. */
import {createHash} from 'node:crypto';
import {makeRng} from '../../lib/rng.ts';
import type {Spec} from '../types.ts';
import type {ArcSectionStyle} from './arc_geometry.ts';

export const REPERTOIRE_POLICY='line.repertoire-policy.v1';
export const constructions=['arcs','fold','serpentine','scallops','terraces','scattered'] as const;
export type Construction=typeof constructions[number];
export type Guidance='required'|'forbidden'|'optional';
export type CreativePreferences={repertoire?:Construction[];variation?:number;guidedBalance?:number};
export type ConstructionRequest={section:number;frame:number;next:number;construction:Construction;guidance:Guidance};
export type ProductionPlan={schema:'line.production-plan.v1';policy:string;seed:number;timelineSha256:string;
  phraseBoundaries:number[];
  preferences:Required<CreativePreferences>;phrases:Array<{first:number;count:number;construction:Construction;guidance:Guidance}>;
  requests:ConstructionRequest[]};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function supportTimeline(spec:Pick<Spec,'duration'|'contacts'>){
  const frames=[1,...spec.contacts.map(c=>Math.round(c.t*40))];
  return frames.map((frame,section)=>({section,frame,next:frames[section+1]??Math.round(spec.duration*40)+21}));
}
export function creativePreferences(input:CreativePreferences={}):Required<CreativePreferences>{
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['repertoire','variation','guidedBalance'].includes(k)))throw new Error('invalid creative preferences');
  const repertoire=input.repertoire??[...constructions],variation=input.variation??1,guidedBalance=input.guidedBalance??11/17;
  if(!Array.isArray(repertoire)||!repertoire.length||new Set(repertoire).size!==repertoire.length||repertoire.some(x=>!constructions.includes(x)))throw new Error('invalid repertoire');
  if(![variation,guidedBalance].every(x=>Number.isFinite(x)&&x>=0&&x<=1))throw new Error('creative amounts must be in [0, 1]');
  return {repertoire:[...repertoire],variation,guidedBalance};
}
export function constructionStyle(r:ConstructionRequest):ArcSectionStyle{
  const base={guides:r.guidance!=='forbidden'};
  switch(r.construction){
    case 'fold':return {...base,profile:'fold',profileStart:0,profileStrength:1,faces:3,foldAngle:30};
    case 'serpentine':return {...base,profile:'serpentine',profileStart:0,profileStrength:.8};
    case 'scallops':return {...base,profile:'scallops',profileStart:0,profileStrength:1,rippleCycles:1};
    case 'terraces':return {...base,profile:'terraces',profileStart:0,profileStrength:.8};
    default:return base;
  }
}
export function planRepertoire(spec:Pick<Spec,'duration'|'contacts'>,seed:number,input:CreativePreferences={},phraseBoundaries:number[]=[]):ProductionPlan{
  if(!Number.isSafeInteger(seed)||seed<0||seed>2147483647)throw new Error('seed must be a non-negative 31-bit integer');
  const preferences=creativePreferences(input),timeline=supportTimeline(spec);
  if(!Array.isArray(phraseBoundaries)||phraseBoundaries.some((t,i)=>!Number.isFinite(t)||t<0||t>spec.duration||(i>0&&t<=phraseBoundaries[i-1])))throw new Error('phrase boundaries must be ordered musical times');
  const boundarySections=new Set(phraseBoundaries.map(t=>timeline.find(r=>r.section>0&&r.frame>=Math.round(t*40))?.section).filter((i):i is number=>i!==undefined));
  const rng=makeRng(parseInt(hash([REPERTOIRE_POLICY,seed,'diversity']).slice(0,8),16));
  const requests:ConstructionRequest[]=[{...timeline[0],construction:'arcs',guidance:'optional'}];
  const phrases:ProductionPlan['phrases']=[];
  let previous='';
  for(let first=1;first<timeline.length;){
    const choices:Array<{construction:Construction;guidance:Guidance;weight:number}>=[];
    const {variation,guidedBalance,repertoire}=preferences;
    // Weights are renormalized over the explicitly allowed repertoire.
    const scattered=repertoire.includes('scattered')?.15*variation:0;
    if(repertoire.includes('arcs'))choices.push({construction:'arcs',guidance:'forbidden',weight:(1-scattered)*(1-guidedBalance)});
    const connected=repertoire.filter(x=>x!=='scattered');
    for(const construction of connected){
      const fraction=construction==='arcs'?1-variation+variation/connected.length:variation/connected.length;
      choices.push({construction,guidance:'required',weight:(1-scattered)*guidedBalance*fraction});
    }
    choices.push({construction:'scattered',guidance:'optional',weight:scattered});
    for(const c of choices)if(c.construction+':'+c.guidance===previous)c.weight*=.25;
    const total=choices.reduce((n,c)=>n+c.weight,0);if(!(total>0))throw new Error('creative preferences leave no eligible construction');
    let draw=rng()*total,selected=choices.at(-1)!;
    for(const c of choices){draw-=c.weight;if(draw<0){selected=c;break;}}
    let count=Math.min(rng()<.5?2:3,timeline.length-first);
    for(let offset=1;offset<count;offset++)if(boundarySections.has(first+offset)){count=offset;break;}
    const {construction,guidance}=selected;phrases.push({first,count,construction,guidance});
    for(let section=first;section<first+count;section++)requests.push({...timeline[section],construction,guidance});
    previous=construction+':'+guidance;first+=count;
  }
  return {schema:'line.production-plan.v1',policy:REPERTOIRE_POLICY,seed,timelineSha256:hash(timeline),phraseBoundaries:[...phraseBoundaries],preferences,phrases,requests};
}
/** Fixed benchmark requests use exactly the same realization route as automatic plans. */
export function validateProductionPlan(spec:Pick<Spec,'duration'|'contacts'>,input:ProductionPlan):ProductionPlan{
  const timeline=supportTimeline(spec);
  if(input?.schema!=='line.production-plan.v1'||input.policy!==REPERTOIRE_POLICY||input.timelineSha256!==hash(timeline)||
    !Array.isArray(input.requests)||input.requests.length!==timeline.length)throw new Error('production plan does not match musical timeline');
  creativePreferences(input.preferences);
  if(!Number.isSafeInteger(input.seed)||input.seed<0||input.seed>2147483647)throw new Error('invalid plan seed');
  for(const [i,r]of input.requests.entries())if(!r||r.section!==i||r.frame!==timeline[i].frame||r.next!==timeline[i].next||
    !constructions.includes(r.construction)||!['required','forbidden','optional'].includes(r.guidance)||
    (r.construction==='scattered'&&r.guidance!=='optional'))throw new Error('invalid construction request');
  let first=1;
  if(!Array.isArray(input.phrases))throw new Error('missing production phrases');
  for(const p of input.phrases){
    if(p.first!==first||!Number.isSafeInteger(p.count)||p.count<1||first+p.count>timeline.length||
      input.requests.slice(first,first+p.count).some(r=>r.construction!==p.construction||r.guidance!==p.guidance))throw new Error('phrases do not match support requests');
    first+=p.count;
  }
  if(first!==timeline.length)throw new Error('phrases do not cover musical timeline');
  return structuredClone(input);
}
