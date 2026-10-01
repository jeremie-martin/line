/** One search configuration for production plans and matched-plan research. */
import {readFileSync} from 'node:fs';
import {connectedArcOptions,parseArcPolicyArtifact} from './connected_arcs.ts';
import {constructionStyle,type ProductionPlan} from './repertoire_policy.ts';
import {INTENTIONAL_REPERTOIRE_POLICY} from './intentional_repertoire.ts';
import type {Spec} from '../types.ts';
import type {ArcMotionOptions} from './arc_motion.ts';
const artifactUrl=new URL('./repertoire_policy_model.json',import.meta.url);
let constructionArtifact:{policies:NonNullable<ArcMotionOptions['constructionPolicies']>;examples:NonNullable<ArcMotionOptions['constructionExamples']>}|undefined;
function loadConstructionArtifact(){
 if(!constructionArtifact){
  const model=parseArcPolicyArtifact(readFileSync(artifactUrl),artifactUrl);
  if(model.schema!=='line.construction-policies.v1'||!model.groups||typeof model.groups!=='object')throw new Error('invalid construction policy artifact');
  const examples=Object.fromEntries(Object.entries(model.groups).map(([key,group]:[string,any])=>{
   if(group.featureCount!==57||!Array.isArray(group.exemplars))throw new Error('invalid construction policy group');
   return [key,group.exemplars.map((r:any)=>({...r.controlReference,features:r.features}))];
  }));
  constructionArtifact={policies:model.groups,examples};
 }
 return constructionArtifact;
}
export function repertoireSearchOptions(spec:Spec,plan:ProductionPlan,allowance:number):ArcMotionOptions{
 const artifact=plan.policy===INTENTIONAL_REPERTOIRE_POLICY?loadConstructionArtifact():undefined;
 return {...connectedArcOptions(spec,allowance),policyPreview:false,
  ...(plan.policy===INTENTIONAL_REPERTOIRE_POLICY?{
   motionQuality:{burstWeight:.64,calmWeight:1,calmImpactMultiplier:1.5},constructionProposals:true,constructionRecovery:true,
   // Preserve ordinary guidance where its physical assumptions apply. Active
   // mixed transitions use native continuation and explicit catch preparation.
   constructionAwareArrival:true,observedReceiver:true,compactFoldProposals:true,
   memorySamples:16,policySamples:16,constructionExamples:artifact!.examples,constructionPolicies:artifact!.policies,
  }:{}),
  initialRecoverySamples:160,memoryScope:'construction',collectTrajectoryLoss:true,
  sectionStyles:Object.fromEntries(plan.requests.map(r=>[r.section,constructionStyle(r)])),
  constructionRequests:Object.fromEntries(plan.requests.map(r=>[r.section,r])),
 };
}
