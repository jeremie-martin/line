import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import type {Spec} from '../scripts/v0/types.ts';

it('improves a complete authored timeline inside a shared construction and repair budget',()=>{
  const spec:Spec={duration:5,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6,4.2].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5,amplitude:()=>.2}};
  const result=compileArcMotion(spec,17,{budget:70000,samples:80,channel:12,radius:24,bidirectional:true,
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

it('preserves the physical prefix and replaces duplicate final-support trials with fresh ones',()=>{
 const spec:Spec={duration:3,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4].map(t=>({t,impact:.7})),axes:{air:()=>.5,speed:()=>.8}};
 const options={budget:300000,samples:80,channel:12,radius:24,bidirectional:true,impactWeight:1,amplitudeWeight:1/3,
  arrivalMode:'speed',arrivalWeight:.3,headingWeight:.3,authoredHorizon:true,guidance:'clearance' as const,guidanceSamples:48,
  expressive:true,collectTrajectoryLoss:true};
 const first=compileArcMotion(spec,17,options);
 const result=compileArcMotion(spec,17,{...options,wholeTrackRefinement:true,refineAttempts:16,refineSamples:64,
  refineGuidanceSamples:96,refineWidth:4,refineMode:'reflow',refineTailSections:1});
 const before=spec.contacts.length;
 expect(result.refinementStats.counts.proposals).toBeGreaterThan(0);
 expect(result.refinementStats.counts.duplicateFinalCandidates).toBeGreaterThan(0);
 expect(result.refinementStats.records.every((r:any)=>r.anchor>=before)).toBe(true);
 const prefix=(lines:any[])=>lines.filter(l=>Math.floor((l.id-1000)/10000)<before);
 expect(prefix(result.track.lines)).toEqual(prefix(first.track.lines));
 expect(result.trajectoryLoss).toBeLessThanOrEqual(first.trajectoryLoss!);
 expect(result.report.contacts.every(c=>c.status==='hit')).toBe(true);
 expect(result.report.off_beat_landings).toEqual([]);expect(result.report.terminus.reason).toBe('endOfSpec');
 expect(result.stats.sim_frames).toBeLessThanOrEqual(options.budget);
});
