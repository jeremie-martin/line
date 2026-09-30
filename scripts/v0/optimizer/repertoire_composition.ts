/** Realize an ordered composition through shared connected and fragment edits.
 * Earlier realized fragments are locked across later edits. Every stage pays
 * preparation, failed candidates, search and complete replay from one ceiling. */
import {composeArcSections,type CompositionReference,type CompositionSearch,type ArcSectionStyles} from './arc_composition.ts';
import {composeScatteredPhrase} from './contact_composition.ts';
import {resolveComposition,type RepertoirePlan} from './repertoire_plan.ts';
import type {Spec} from '../types.ts';
const complete=(source:CompositionReference)=>source.report.terminus.reason==='endOfSpec'&&!source.report.off_beat_landings.length&&source.report.contacts.every(c=>c.status==='hit');
export function composeRepertoire(spec:Spec,seed:number,source:CompositionReference,plan:RepertoirePlan,budget:number,search:CompositionSearch={initialRecoverySamples:80}){
  if(!complete(source))throw new Error('composition requires a complete valid source');
  if(source.fragmentSections?.length)throw new Error('start a new composition from its connected source');
  if(!Number.isSafeInteger(budget)||budget<20000)throw new Error('invalid composition allowance');
  const phrases=resolveComposition(plan,source.rows,spec.duration),styles:ArcSectionStyles={};
  for(const p of phrases)if(p.recipe!=='scattered')for(const i of p.sections)styles[i]=p.style;
  const scattered=phrases.filter(p=>p.recipe==='scattered'),firstConnected=Math.min(...Object.keys(styles).map(Number));
  const stages:Array<{kind:'connected'|'scattered';section:number;phrase?:typeof phrases[number]}>=[];
  if(Number.isFinite(firstConnected)&&(!scattered.length||firstConnected<scattered[0].sections[0]))stages.push({kind:'connected',section:firstConnected});
  for(const phrase of scattered)stages.push({kind:'scattered',section:phrase.sections[0],phrase});
  // No phrase means the explicitly selected ordinary reference is the result.
  let current=source,spent=0;
  const attempts:any[]=[];
  for(const [index,stage]of stages.entries()){
    const remaining=stages.slice(index),end=Math.round(spec.duration*40)+20;
    const minimum=(s:typeof stage)=>(s.kind==='scattered'?4*(end+1):0)+2*(current.rows[s.kind==='scattered'?s.phrase!.sections.at(-1)!+1:s.section].frame+1)+3*(end+1)+1;
    const futureMinimum=remaining.slice(1).reduce((n,s)=>n+minimum(s),0),available=budget-spent;
    if(available<minimum(stage)+futureMinimum)throw new Error('composition allowance cannot cover remaining stages');
    const weight=(s:typeof stage)=>Math.max(1,end-current.rows[s.section].frame);
    const share=Math.floor(available*weight(stage)/remaining.reduce((n,s)=>n+weight(s),0));
    const allowance=Math.min(available-futureMinimum,Math.max(minimum(stage),share));
    const resume=stage.kind==='scattered'?stage.phrase!.sections.at(-1)!+1:stage.section;
    const laterStyles=Object.fromEntries(Object.entries(styles).filter(([i])=>Number(i)>=resume));
    const result=stage.kind==='connected'?composeArcSections(spec,seed,current,laterStyles,allowance,search):
      composeScatteredPhrase(spec,seed,current,stage.phrase!.sections,[stage.phrase!.fragmentWidth??.003],allowance,laterStyles,search);
    spent+=result.physicalFrames;
    if(spent>budget)throw new Error('composition exceeded its allowance');
    current={...result.result,fragmentSections:result.fragmentSections,railGuides:result.railGuides};
    attempts.push({stage:index,kind:stage.kind,section:stage.section,allowance,physicalFrames:result.physicalFrames,
      preparationFrames:result.preparationFrames,valid:complete(current),failure:result.result.failure,
      proposalDecision:result.result.proposalDecision,initializationRecovery:result.result.initializationRecovery,
      boundaryFrame:result.boundaryFrame,fragmentConstruction:'fragmentConstruction'in result?result.fragmentConstruction:undefined,
      attempts:result.result.attempts});
    if(!complete(current))break;
  }
  const valid=complete(current)&&attempts.length===stages.length;
  return {result:current,valid,physicalFrames:spent,allowance:budget,phrases,styles,attempts,
    fragmentSections:current.fragmentSections??[],railGuides:current.railGuides,
    changedSections:phrases.flatMap(p=>p.sections),boundaryFrame:phrases.length?source.rows[phrases[0].sections[0]].frame-1:null};
}
