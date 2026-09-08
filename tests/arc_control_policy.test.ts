import {expect,it} from 'vitest';
import {arcPolicyArrival,arcControlProposals} from '../scripts/v0/optimizer/arc_control_policy.ts';
import model from '../scripts/v0/optimizer/arc_control_policy_model.json' with {type:'json'};
import fixtures from './fixtures/arc_control_policy_predictions.json' with {type:'json'};

it('matches independently exported Python ensemble predictions after control decoding',()=>{
  for(const row of fixtures){
    const incoming=20,span=30,c=arcControlProposals(row.features,incoming,span,model,1)[0];
    const encoded=[(c.entry-incoming)/30,c.turn/60,(c.exit-incoming)/60,c.support/span,c.bias,c.offset,c.clearance!/12,c.turnFraction!,c.bend!/30,c.guideFlare!/8];
    encoded.forEach((value,index)=>expect(value).toBeCloseTo(row.mean[index],13));
    expect(arcControlProposals(row.features,incoming,span,model,8)).toHaveLength(8);
  }
  expect(()=>arcControlProposals(fixtures[0].features.slice(1),20,30,model,8)).toThrow('feature mismatch');
  expect(()=>arcControlProposals(fixtures[0].features.map(()=>NaN),20,30,model,8)).toThrow('feature mismatch');
});

it('uses relative body state rather than absolute track position',()=>{
  const ids=['PEG','TAIL','NOSE','STRING','BUTT','SHOULDER','RHAND','LHAND','LFOOT','RFOOT'];
  const state={points:Object.fromEntries(ids.map((id,i)=>[id,{x:2*i,y:-i,vx:4+i/10,vy:3}]))};
  const moved={points:Object.fromEntries(Object.entries(state.points).map(([id,p])=>[id,{...p,x:p.x+12000,y:p.y-7000}]))};
  expect(arcPolicyArrival(state,{x:6,y:2})).toHaveLength(47);
  expect(arcPolicyArrival(moved,{x:6,y:2})).toEqual(arcPolicyArrival(state,{x:6,y:2}));
});

it('matches the training library at float32 decision boundaries',()=>{
  const tree={left:[1,-1,-1],right:[2,-1,-1],feature:[0,-2,-2],
    threshold:[1+2**-25,-2,-2],value:[[],Array(10).fill(0),Array(10).fill(1)]};
  const fixture={featureSchema:model.featureSchema,featureCount:57,trees:[tree,tree]};
  const features=Array(57).fill(0);features[0]=1+2**-24;
  expect(features[0]).toBeGreaterThan(tree.threshold[0]);
  expect(arcControlProposals(features,20,30,fixture,1)[0].entry).toBe(20);
});
