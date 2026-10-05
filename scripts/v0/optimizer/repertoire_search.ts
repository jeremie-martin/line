/** One search configuration for production plans and matched-plan research. */
import {readFileSync} from 'node:fs';
import {connectedArcOptions,parseArcPolicyArtifact} from './connected_arcs.ts';
import {constructionStyle,type ProductionPlan} from './repertoire_policy.ts';
import {INTENTIONAL_REPERTOIRE_POLICY} from './intentional_repertoire.ts';
import type {Spec} from '../types.ts';
import type {ArcMotionOptions} from './arc_motion.ts';
const ARTIFACTS={
  // The V6-era policies (trained in part on the evaluation songs): v1/v2 and landing modes.
  v6:new URL('./repertoire_policy_model.json',import.meta.url),
  // Rebuilt under line.strike.v3 on songs disjoint from the evaluation panel.
  v3:new URL('./repertoire_policy_model_v3.json',import.meta.url),
};
export type ConstructionModel=keyof typeof ARTIFACTS;
const constructionArtifacts:Partial<Record<ConstructionModel,{policies:NonNullable<ArcMotionOptions['constructionPolicies']>;examples:NonNullable<ArcMotionOptions['constructionExamples']>}>>={};
export function constructionSearchModelData(model:any){
 if(model.schema!=='line.construction-policies.v1'||!model.groups||typeof model.groups!=='object')throw new Error('invalid construction policy artifact');
 const inherited=Object.fromEntries(Object.entries(model.groups).map(([key,group]:[string,any])=>{
  if(group.featureCount!==57||!Array.isArray(group.exemplars))throw new Error('invalid construction policy group');
  return [key,group.exemplars.map((r:any)=>({...r.controlReference,features:r.features}))];
 }));
 const examples=model.memoryGroups?Object.fromEntries(Object.entries(model.memoryGroups).map(([key,entries]:[string,any])=>{
  if(!Array.isArray(entries))throw new Error('invalid construction memory group');
  return [key,entries.map((entry:any)=>{
   const value=typeof entry==='number'?Number.isSafeInteger(entry)&&entry>=0?inherited[key]?.[entry]:undefined:entry;
   if(!value?.control||!['entry','turn','exit','support','bias','offset'].every(k=>Number.isFinite(value.control[k]))||
    !Object.values(value.control).every(v=>typeof v==='number'&&Number.isFinite(v))||
    value.features?.length!==57||!value.features.every(Number.isFinite)||!Number.isFinite(value.incoming)||!Number.isFinite(value.span)||!(value.span>0))throw new Error('invalid construction memory reference');
   return value;
  })];
 })):inherited;
 return {policies:model.groups,examples};
}
export function loadConstructionArtifact(which:ConstructionModel='v6'){
  if(!constructionArtifacts[which]){
    const model=parseArcPolicyArtifact(readFileSync(ARTIFACTS[which]),ARTIFACTS[which]);
    constructionArtifacts[which]=constructionSearchModelData(model);
  }
  return constructionArtifacts[which]!;
}
export function repertoireSearchOptions(spec:Spec,plan:ProductionPlan,allowance:number):ArcMotionOptions{
 if(plan.policy!==INTENTIONAL_REPERTOIRE_POLICY)throw new Error('the compiler realizes intentional repertoire plans only');
 const artifact=loadConstructionArtifact();
 return {...connectedArcOptions(spec,allowance),
  motionQuality:{burstWeight:.64,calmWeight:1,calmImpactMultiplier:1.5},
  transitionRevision:{errorThreshold:.12},
  // Preserve the complete ride while using spare work to improve its ending.
  refineTailSections:1,refineAttempts:12,refineSamples:64,refineGuidanceSamples:96,refineWidth:4,
  memorySamples:16,policySamples:16,constructionExamples:artifact.examples,constructionPolicies:artifact.policies,
  initialRecoverySamples:160,
  sectionStyles:Object.fromEntries(plan.requests.map(r=>[r.section,constructionStyle(r)])),
  constructionRequests:Object.fromEntries(plan.requests.map(r=>[r.section,r])),
 };
}
