/** One search configuration for production plans and matched-plan research. */
import {connectedArcOptions} from './connected_arcs.ts';
import {constructionStyle,type ProductionPlan} from './repertoire_policy.ts';
import {INTENTIONAL_REPERTOIRE_POLICY} from './intentional_repertoire.ts';
import type {Spec} from '../types.ts';
import type {ArcMotionOptions} from './arc_motion.ts';
export function repertoireSearchOptions(spec:Spec,plan:ProductionPlan,allowance:number):ArcMotionOptions{
 return {...connectedArcOptions(spec,allowance),policyPreview:false,
  ...(plan.policy===INTENTIONAL_REPERTOIRE_POLICY?{
   motionQuality:{burstWeight:.16,calmWeight:1},constructionProposals:true,constructionRecovery:true,
   // Preserve ordinary guidance where its physical assumptions apply. Active
   // mixed transitions use native continuation and explicit catch preparation.
   constructionAwareArrival:true,
  }:{}),
  initialRecoverySamples:160,memoryScope:'construction',collectTrajectoryLoss:true,
  sectionStyles:Object.fromEntries(plan.requests.map(r=>[r.section,constructionStyle(r)])),
  constructionRequests:Object.fromEntries(plan.requests.map(r=>[r.section,r])),
 };
}
