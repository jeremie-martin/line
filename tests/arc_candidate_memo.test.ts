import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {withSequenceObserver} from '../scripts/v0/optimizer/arc_sequence.ts';
import type {MeasuredCandidate} from '../scripts/v0/optimizer/arc_candidates.ts';
import type {Spec} from '../scripts/v0/types.ts';
import futureValueModel from '../scripts/v0/optimizer/arc_value_model.json' with {type: 'json'};
const spec:Spec={duration:4,preroll:5,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
const options={budget:200000,samples:100,channel:12,radius:24,impactWeight:1,amplitudeWeight:1/3,arrivalWeight:.3,headingWeight:.3,guidance:'clearance' as const,guidanceSamples:24};
it.each([false,true])('keeps owned candidate facts through memo reuse, cleanup and interruption (future value: %s)',async futureValue=>{
  const retained: Array<{candidate: MeasuredCandidate; snapshot: MeasuredCandidate}> = [];
  const r=await withSequenceObserver((index, offers, _chosen, ctx)=>{
    for(const interval of new Set(offers.map(o=>o.interval))){
      if(!interval.best)continue;
      const candidate=interval.best.candidate;
      if(futureValue){
        expect(candidate.valueFeatures).toHaveLength(73);
        expect(candidate.valueFeatures!.slice(47)).toStrictEqual(ctx.futureValueFeatures(index));
        Object.freeze(candidate.valueFeatures);
      }
      expect(interval.candidates).toContain(candidate);
      expect(candidate).not.toHaveProperty('child');
      // Later reuse and cleanup may replace live handles, never measured facts.
      Object.freeze(candidate);
      retained.push({candidate,snapshot:structuredClone(candidate)});
    }
  },async()=>compileArcMotion(spec,17,{...options,budget:6000,...(futureValue?{futureValueModel}:{})}));
  expect(r.candidateMemo.hits).toBeGreaterThan(0);
  expect(r.stats.sim_frames).toBeLessThanOrEqual(6000);
  expect(r.track.lines.every(l=>l.type===0)).toBe(true);
  expect(r.report.contacts).toHaveLength(spec.contacts.length);
  expect(retained.length).toBeGreaterThan(0);
  for(const {candidate,snapshot} of retained)expect(candidate).toStrictEqual(snapshot);
});
