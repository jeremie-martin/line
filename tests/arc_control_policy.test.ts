import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {arcPolicyArrival,arcControlProposals} from '../scripts/v0/optimizer/arc_control_policy.ts';
import fixtures from './fixtures/arc_control_policy_predictions.json' with {type:'json'};
const model:any=JSON.parse(readFileSync(new URL('./fixtures/arc_control_policy_legacy.json',import.meta.url),'utf8'));

it('matches independently exported Python ensemble predictions after control decoding',()=>{
  for(const row of fixtures){
    const incoming=20,span=30,c=arcControlProposals(row.features,incoming,span,model.models[0],1)[0];
    const encoded=[(c.entry-incoming)/30,c.turn/60,(c.exit-incoming)/60,c.support/span,c.bias,c.offset,c.clearance!/12,c.turnFraction!,c.bend!/30,c.guideFlare!/8];
    encoded.forEach((value,index)=>expect(value).toBeCloseTo(row.mean[index],13));
    expect(arcControlProposals(row.features,incoming,span,model.models[0],8)).toHaveLength(8);
  }
  expect(()=>arcControlProposals(fixtures[0].features.slice(1),20,30,model,8)).toThrow('feature mismatch');
  expect(()=>arcControlProposals(fixtures[0].features.map(()=>NaN),20,30,model,8)).toThrow('feature mismatch');
});

it('matches independently computed nearest measured controls and rescales their geometry',()=>{
  for(const row of fixtures){
    const actual=arcControlProposals(row.features,20,30,model.models[1],4);
    expect(actual).toHaveLength(row.examples.length);
    actual.forEach((control,index)=>Object.entries(row.examples[index]).forEach(([key,value])=>
      expect(control[key as keyof typeof control]).toBeCloseTo(value,12)));
    const expanded=arcControlProposals(row.features,20,30,model.models[1],24);
    expect(expanded).toHaveLength(row.expandedExamples.length);
    expanded.forEach((control,index)=>Object.entries(row.expandedExamples[index]).forEach(([key,value])=>
      expect(control[key as keyof typeof control]).toBeCloseTo(value,12)));
    const changed=arcControlProposals(row.features,35,60,model.models[1],1)[0];
    expect(changed.entry).toBeCloseTo(actual[0].entry+15,12);
    expect(changed.exit).toBeCloseTo(actual[0].exit+15,12);
    expect(changed.support).toBeCloseTo(actual[0].support*2,12);
  }
  expect(arcControlProposals(fixtures[0].features,20,30,model,0)).toEqual([]);
  expect(()=>arcControlProposals(fixtures[0].features,20,30,model,-1)).toThrow('count');
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

it('supports an explicit physical-feature metric for measured proposals',()=>{
  const query=Array(57).fill(0),bodyDifferent=query.slice(),targetDifferent=query.slice();
  bodyDifferent[7]=1;targetDifferent[47]=1;
  const fixture={featureSchema:model.featureSchema,featureCount:57,exemplars:[
    {features:bodyDifferent,target:Array(10).fill(0)},
    {features:targetDifferent,target:Array(10).fill(1)}]};
  expect(arcControlProposals(query,20,30,fixture,1)[0].entry).toBe(20);
  const weights=Array(57).fill(1);weights[7]=5;
  expect(arcControlProposals(query,20,30,{...fixture,featureWeights:weights},1)[0].entry).toBe(50);
  expect(()=>arcControlProposals(query,20,30,{...fixture,featureWeights:[1]},1)).toThrow('weights mismatch');
});

it('retrieves by supervised neighborhood before physical distance',()=>{
  const query=Array(57).fill(0),near=query.slice(),far=query.slice();
  near[0]=.01;far[1]=20;
  const tree={left:[1,-1,-1],right:[2,-1,-1],feature:[0,-2,-2],threshold:[.005,0,0]};
  const fixture={featureSchema:model.featureSchema,featureCount:57,proximityTrees:[tree],exemplars:[
    {features:near,target:Array(10).fill(0),proximityLeaves:[2]},
    {features:far,target:Array(10).fill(1),proximityLeaves:[1]}]};
  expect(arcControlProposals(query,20,30,fixture,1)[0].entry).toBe(50);
  expect(()=>arcControlProposals(query,20,30,{...fixture,exemplars:[{...fixture.exemplars[0],proximityLeaves:[]}]},1))
    .toThrow('proximity mismatch');
});
