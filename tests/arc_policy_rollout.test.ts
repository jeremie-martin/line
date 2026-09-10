import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {connectedArcOptions} from '../scripts/v0/optimizer/connected_arcs.ts';
import type {Spec} from '../scripts/v0/types.ts';
const target=[0,-.2,-.3,.5,0,.1,1,.4,0,0];
const tree={left:[-1],right:[-1],feature:[0],threshold:[0],value:[target]};
const model={featureSchema:'line.arc-control-policy-features.v1',featureCount:57,trees:[tree,tree]};
const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
const options={...connectedArcOptions(spec,75000),controlPolicy:{...model,startupModel:model},lookaheadWidth:0};
it('preserves physical tracks and frame accounting with rollout mode disabled',()=>{
  const plain=compileArcMotion(spec,17,options),disabled=compileArcMotion(spec,17,{...options,policyRollout:false});
  expect(disabled.track).toEqual(plain.track);expect(disabled.stats).toEqual(plain.stats);
});
it('meters and validates demonstrated proposals across a complete trajectory',()=>{
  const result=compileArcMotion(spec,17,{...options,policyRollout:true});
  expect(result.policyRolloutStats.proposals).toBeGreaterThan(0);expect(result.policyRolloutStats.physicsFrames).toBeGreaterThan(0);
  expect(result.policyRolloutStats.accepted).toBeGreaterThan(0);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(options.budget);expect(result.failure).toBeNull();
  expect(result.report.contacts.every(c=>c.status==='hit')).toBe(true);expect(result.track.lines.every(l=>l.type===0)).toBe(true);
});
it('falls back to physical search when extreme proposed curves are rejected',()=>{
  const badTree={...tree,value:[[2,2,2,.99,2,3,.5,.85,2,2]]},bad={...model,trees:[badTree,badTree]};
  const result=compileArcMotion(spec,17,{...options,controlPolicy:{...bad,startupModel:bad},policyRollout:true});
  expect(result.policyRolloutStats.fallbacks).toBeGreaterThan(0);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(options.budget);expect(result.failure).toBeNull();
  expect(result.report.contacts.every(c=>c.status==='hit')).toBe(true);
});
