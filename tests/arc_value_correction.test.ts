import {expect,it} from 'vitest';
import {arcFutureValue,ARC_VALUE_FEATURE_SCHEMA} from '../scripts/v0/optimizer/arc_value.ts';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import type {Spec} from '../scripts/v0/types.ts';
const base={featureSchema:ARC_VALUE_FEATURE_SCHEMA,featureCount:57,model:{initial:.5,trees:[]}};
const corrected={featureSchema:ARC_VALUE_FEATURE_SCHEMA,featureCount:57,residualBase:base,
  residualInput:'features-plus-log1p-base',residualStrength:.5,residualModel:{initial:-.2,trees:[]}};
it('applies a bounded log-value correction and preserves the prior exactly at zero strength',()=>{
  const features=Array(57).fill(0);
  expect(arcFutureValue(features,corrected)).toBeCloseTo(Math.expm1(.4)/100,14);
  expect(arcFutureValue(features,{...corrected,residualStrength:0})).toBe(arcFutureValue(features,base));
  const split={leaf:[false,true,true],left:[1,0,0],right:[2,0,0],feature:[57,0,0],threshold:[.4,0,0],value:[0,1,-1]};
  expect(arcFutureValue(features,{...corrected,residualModel:{initial:0,trees:[split]}})).toBe(0);
  for(const residualStrength of [-1,Infinity,2])expect(()=>arcFutureValue(features,{...corrected,residualStrength})).toThrow('correction');
});
it('reproduces physical tracks and frame accounting with a zero-strength wrapper',()=>{
  const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
  const options={budget:40000,samples:32,channel:12,radius:24,bidirectional:true,impactWeight:1,amplitudeWeight:1/3,
    arrivalWeight:.3,headingWeight:.3,guidance:'clearance' as const,guidanceJoint:true,guidanceSamples:48,responseSamples:46,
    expressive:true,completeBoundary:true,valueGuidanceWeight:.25,futureValueModel:base};
  const plain=compileArcMotion(spec,17,options),zero=compileArcMotion(spec,17,{...options,futureValueModel:{...corrected,residualStrength:0}});
  expect(zero.track).toEqual(plain.track);expect(zero.stats).toEqual(plain.stats);
  const enabled=compileArcMotion(spec,17,{...options,futureValueModel:corrected});
  expect(enabled.failure).toBeNull();expect(enabled.report.contacts.every(c=>c.status==='hit')).toBe(true);
  expect(enabled.stats.sim_frames).toBeLessThanOrEqual(options.budget);expect(enabled.track.lines.every(l=>l.type===0)).toBe(true);
});
