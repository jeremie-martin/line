/** One search configuration for production plans and matched-plan research. */
import {connectedArcOptions} from './connected_arcs.ts';
import {constructionStyle,type ProductionPlan} from './repertoire_policy.ts';
import {INTENTIONAL_REPERTOIRE_POLICY} from './intentional_repertoire.ts';
import type {Spec} from '../types.ts';
import type {ArcMotionOptions} from './arc_motion.ts';
export function repertoireSearchOptions(spec:Spec,plan:ProductionPlan,allowance:number):ArcMotionOptions{
 return {...connectedArcOptions(spec,allowance),policyPreview:false,
  ...(plan.policy===INTENTIONAL_REPERTOIRE_POLICY?{
   motionQuality:{burstWeight:.16,calmWeight:1},constructionProposals:true,
   // The inherited value model predicts future ordinary guided construction.
   // Mixed plans instead use measured continuation and an explicit catch prior.
   valueGuidanceWeight:0,valueWeight:0,continuationValueWeight:0,headingWeight:0,
   arrivalMode:'passive',arrivalWeight:.3,
  }:{}),
  initialRecoverySamples:160,memoryScope:'construction',collectTrajectoryLoss:true,
  sectionStyles:Object.fromEntries(plan.requests.map(r=>[r.section,constructionStyle(r)])),
  constructionRequests:Object.fromEntries(plan.requests.map(r=>[r.section,r])),
 };
}
