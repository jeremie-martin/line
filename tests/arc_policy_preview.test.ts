import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {getPhysicsFrameCount} from '../scripts/lib/detector.ts';
import {connectedArcOptions} from '../scripts/v0/optimizer/connected_arcs.ts';
import type {Spec} from '../scripts/v0/types.ts';
const target=[0,-.2,-.3,.5,0,.1,1,.4,0,0],tree={left:[-1],right:[-1],feature:[0],threshold:[0],value:[target]};
const model={featureSchema:'line.arc-control-policy-features.v1',featureCount:57,trees:[tree,tree]};
const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
const options={...connectedArcOptions(spec,75000),policyPreview:undefined,controlPolicy:{...model,rolloutPolicy:{...model,startupModel:model}}};
it('preserves ordinary compilation when complete-track proposals are disabled',()=>{
  const plain=compileArcMotion(spec,17,options),disabled=compileArcMotion(spec,17,{...options,policyPreview:false});
  expect(disabled.track).toEqual(plain.track);expect(disabled.stats).toEqual(plain.stats);
});
it('charges both complete attempts and their cold replays to one actual physics counter',()=>{
  const result=compileArcMotion(spec,17,{...options,policyPreview:true}),proof=result.policyPreviewStats;
  expect(proof.previewFrames).toBeGreaterThan(0);expect(proof.searchFrames).toBeGreaterThan(0);
  expect(proof.previewFrames+proof.searchFrames).toBe(getPhysicsFrameCount());
  expect(result.stats.sim_frames).toBe(getPhysicsFrameCount());expect(result.stats.sim_frames).toBeLessThanOrEqual(options.budget);
  expect(result.trajectoryLoss).toBe(Math.min(proof.previewLoss,proof.searchLoss));
  expect(result.failure).toBeNull();expect(result.report.contacts.every(c=>c.status==='hit')).toBe(true);
  expect(result.track.lines.every(l=>l.type===0)).toBe(true);
});
it('retains general search after a strict proposal fails without resetting or refunding its work',()=>{
  const badTree={...tree,value:[[2,2,2,.99,2,3,.5,.85,2,2]]},bad={...model,trees:[badTree,badTree]};
  const result=compileArcMotion(spec,17,{...options,policyPreview:true,controlPolicy:{...model,rolloutPolicy:{...bad,startupModel:bad}}});
  expect(result.policyPreviewStats.previewComplete).toBe(false);expect(result.policyPreviewStats.selected).toBe('search');
  expect(result.policyPreviewStats.previewFrames).toBeGreaterThan(0);expect(result.stats.sim_frames).toBe(getPhysicsFrameCount());
  expect(result.stats.sim_frames).toBeLessThanOrEqual(options.budget);expect(result.failure).toBeNull();
});
