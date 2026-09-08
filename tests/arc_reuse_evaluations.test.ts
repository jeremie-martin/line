import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import type {Spec} from '../scripts/v0/types.ts';
const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
const options={budget:200000,samples:100,channel:12,radius:24,bidirectional:true,impactWeight:1,amplitudeWeight:1/3,arrivalMode:'speed',arrivalWeight:.3,headingWeight:.3,lookaheadWidth:3,lookaheadSamples:24,lookaheadDepth:2,strictHorizon:true,reuseContinuations:true,memoCandidates:true,guidance:'clearance' as const,guidanceSamples:24};
it.each([
  ['ordinary',{}],['different start',{start:{vx:6,vy:1,y:-200}}],['jitter',{jitter:.02}],
] as const)('reuses exact physical prefixes across searches without changing decisions: %s',(_name,change)=>{
  const input={...spec,...change};
  const reference=compileArcMotion(input,17,options);
  const cached=compileArcMotion(input,17,{...options,reuseEvaluations:true});
  expect(cached.track).toEqual(reference.track);
  expect(cached.report).toEqual(reference.report);
  expect(cached.samples).toBe(reference.samples);
  expect(cached.stats.viable_candidate_samples).toBe(reference.stats.viable_candidate_samples);
  expect(cached.candidateMemo.hits).toBeGreaterThan(reference.candidateMemo.hits);
  expect(cached.stats.sim_frames).toBeLessThan(reference.stats.sim_frames);
});
