import {expect,it} from 'vitest';
import {arcControlProposals,ARC_POLICY_SCHEMA} from '../scripts/v0/optimizer/arc_control_policy.ts';

it('retains unmatched examples and their stable distance ties',()=>{
  const features=Array(57).fill(0);features[0]=1;
  const tree={left:[1,-1,-1],right:[2,-1,-1],feature:[0,-2,-2],threshold:[0,0,0]};
  const model={featureSchema:ARC_POLICY_SCHEMA,featureCount:57,proximityTrees:[tree],exemplars:[
    {features,target:Array(10).fill(1),proximityLeaves:[2]},
    {features:features.slice(),target:Array(10).fill(2),proximityLeaves:[2]}]};
  expect(arcControlProposals(Array(57).fill(0),0,20,model,2).map(c=>c.turn)).toEqual([60,120]);
});

it('rebuilds memberships when a caller replaces the artifact arrays',()=>{
  const query=Array(57).fill(0),far=query.slice();far[0]=1;
  const tree={left:[1,-1,-1],right:[2,-1,-1],feature:[0,-2,-2],threshold:[0,0,0]};
  const model={featureSchema:ARC_POLICY_SCHEMA,featureCount:57,proximityTrees:[tree],exemplars:[
    {features:far,target:Array(10).fill(1),proximityLeaves:[2]}]};
  expect(arcControlProposals(query,0,20,model,1)[0].turn).toBe(60);
  model.exemplars=[{features:query,target:Array(10).fill(2),proximityLeaves:[1]},...model.exemplars];
  expect(arcControlProposals(query,0,20,model,1)[0].turn).toBe(120);
  model.exemplars=[{features:query,target:Array(10).fill(2),proximityLeaves:[]}];
  expect(()=>arcControlProposals(query,0,20,model,1)).toThrow('proximity mismatch');
});
