import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import type {Spec} from '../scripts/v0/types.ts';
const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
const options={budget:200000,samples:100,channel:12,radius:24,impactWeight:1,amplitudeWeight:1/3,arrivalWeight:.3,headingWeight:.3,lookaheadWidth:0,guidance:'clearance' as const,guidanceSamples:24};
it('keeps the hard limit and cold replay checks with planning and reuse enabled',()=>{
  const r=compileArcMotion(spec,17,{...options,budget:6000,lookaheadWidth:3,lookaheadSamples:8});
  expect(r.candidateMemo.hits).toBeGreaterThan(0);
  expect(r.stats.sim_frames).toBeLessThanOrEqual(6000);
  expect(r.track.lines.every(l=>l.type===0)).toBe(true);
  expect(r.report.contacts).toHaveLength(spec.contacts.length);
});
