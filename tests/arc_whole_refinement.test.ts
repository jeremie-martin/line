import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import type {Spec} from '../scripts/v0/types.ts';

it('improves a complete authored timeline inside a shared construction and repair budget',()=>{
  const spec:Spec={duration:5,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6,4.2].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5,amplitude:()=>.2}};
  const result=compileArcMotion(spec,17,{budget:70000,constructionBudget:35000,samples:80,channel:12,radius:24,bidirectional:true,
    impactWeight:1,amplitudeWeight:1/3,arrivalMode:'speed',arrivalWeight:.3,headingWeight:.3,authoredHorizon:true,
    guidance:'clearance',guidanceSamples:24,expressive:true,wholeTrackRefinement:true,
    refineAttempts:4,refineSamples:24,refineGuidanceSamples:48,refineWidth:3,refineMode:'translate'});
  expect(result.failure).toBeNull();expect(result.report.contacts.every(c=>c.status==='hit')).toBe(true);
  expect(result.report.off_beat_landings).toEqual([]);expect(result.report.terminus.reason).toBe('endOfSpec');
  expect(result.stats.sim_frames).toBeLessThanOrEqual(70000);
  expect(result.refinementStats.frames).toBeGreaterThan(0);
  expect(result.refinementStats.counts.proposals).toBeGreaterThan(0);
  expect(result.refinementStats.finalLoss).toBeLessThanOrEqual(result.refinementStats.initialLoss);
});
