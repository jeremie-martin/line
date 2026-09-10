import {expect,it,vi} from 'vitest';
const seen=vi.hoisted(()=>[] as number[][]);
vi.mock('../scripts/v0/optimizer/arc_control_policy.ts',async original=>{
  const m=await original<typeof import('../scripts/v0/optimizer/arc_control_policy.ts')>();
  return {...m,arcControlProposals:(features:number[],...args:any[])=>{seen.push(features.slice());return (m.arcControlProposals as any)(features,...args);}};
});
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {arcControlProposals,ARC_POLICY_SCHEMA,ARC_HORIZON_POLICY_SCHEMA} from '../scripts/v0/optimizer/arc_control_policy.ts';
import {ARC_VALUE_FEATURE_SCHEMA} from '../scripts/v0/optimizer/arc_value.ts';
import type {Spec} from '../scripts/v0/types.ts';
const empty={featureSchema:ARC_POLICY_SCHEMA,featureCount:57,exemplars:[]};
const long={featureSchema:ARC_HORIZON_POLICY_SCHEMA,featureCount:67,models:[empty,{featureSchema:ARC_HORIZON_POLICY_SCHEMA,featureCount:67,exemplars:[]}],proposalWeights:[1,0]};
const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:t=>t>=1.8?.8:.2}};
const options={budget:40000,samples:40,channel:12,radius:24,bidirectional:true,impactWeight:1,amplitudeWeight:1/3,arrivalWeight:.3,headingWeight:.3,guidance:'clearance' as const,guidanceJoint:true,guidanceSamples:92,responseSamples:92,expressive:true,completeBoundary:true,memorySamples:4,memoryResponseSamples:4,futureValueModel:{featureSchema:ARC_VALUE_FEATURE_SCHEMA,featureCount:57,model:{initial:0,trees:[]}}};
it('keeps old proposals, memory, future-value inputs and physical work unchanged in an inactive longer-window mixture',()=>{
  const a=compileArcMotion(spec,17,{...options,controlPolicy:empty});seen.length=0;
  const b=compileArcMotion(spec,17,{...options,controlPolicy:long});
  expect(b.track).toEqual(a.track);expect(b.stats).toEqual(a.stats);
  expect(seen.length).toBe(6);expect(seen.every(f=>f.length===67)).toBe(true);
  expect(seen[0][50]).toBeCloseTo(.2);expect(seen[0][55]).toBeCloseTo(.2+.6/25);expect(seen[0][60]).toBeCloseTo(.8);expect(seen[0][65]).toBeCloseTo(.8);
  expect(seen.at(-1)!.slice(52)).toEqual([0,-1,-1,-1,-1,0,-1,-1,-1,-1,0,-1,-1,-1,-1]);
});
it('uses future target dimensions while preserving old-component decoding',()=>{
  const value=[0,.2,0,.5,0,.1,1,.4,0,0],tree={left:[1,-1,-1],right:[2,-1,-1],feature:[60,-1,-1],threshold:[.5,0,0],value:[value,value,value.slice()]};
  tree.value[2]=value.map((x,i)=>i===1?-.2:x);
  const model={featureSchema:ARC_HORIZON_POLICY_SCHEMA,featureCount:67,trees:[tree,tree]};
  const f=Array(67).fill(0),a=arcControlProposals(f,20,24,model,1);f[60]=1;const b=arcControlProposals(f,20,24,model,1);expect(a[0].turn).toBe(12);expect(b[0].turn).toBe(-12);
  expect(()=>arcControlProposals(Array(58).fill(0),0,24,empty,1)).toThrow('feature');
});
