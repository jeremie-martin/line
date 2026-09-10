import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {ARC_POLICY_SCHEMA} from '../scripts/v0/optimizer/arc_control_policy.ts';
import type {Spec} from '../scripts/v0/types.ts';

it('resolves a policy factory once and reproduces direct-artifact physics',()=>{
  const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
  const tree={left:[-1],right:[-1],feature:[-2],threshold:[-2],value:[[0,0,0,.5,0,0,1,.4,0,0]]};
  const model={featureSchema:ARC_POLICY_SCHEMA,featureCount:57,trees:[tree,tree]};
  const options={budget:40000,samples:32,channel:12,radius:24,bidirectional:true,
    impactWeight:1,amplitudeWeight:1/3,arrivalWeight:.3,headingWeight:.3,
    guidance:'clearance' as const,guidanceJoint:true,guidanceSamples:48,responseSamples:46,
    expressive:true,policySamples:8,controlPolicy:model};
  const direct=compileArcMotion(spec,17,options);let calls=0;
  const lazy=compileArcMotion(spec,17,{...options,controlPolicy:()=>{calls++;return model;}});
  expect(calls).toBe(1);expect(lazy.track).toEqual(direct.track);
  expect(lazy.stats.sim_frames).toBe(direct.stats.sim_frames);
  expect(lazy.report.contacts.every(c=>c.status==='hit')).toBe(true);
});
