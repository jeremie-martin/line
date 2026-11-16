import {expect,it} from 'vitest';
import {arcPolicyArrival,arcControlProposals,ARC_POLICY_SCHEMA} from '../scripts/v0/optimizer/arc_control_policy.ts';
import {arcControlsSimilar} from '../scripts/v0/optimizer/arc_motion_control.ts';
const model={featureSchema:ARC_POLICY_SCHEMA,featureCount:57,exemplars:[]};

it('validates features and refuses retired policy formats',()=>{
  const features=Array(57).fill(0);
  for(const bad of [features.slice(1),features.concat(0),Array(67).fill(0),features.map(()=>NaN)])
    expect(()=>arcControlProposals(bad,20,30,model,1)).toThrow('feature mismatch');
  for(const retired of [{trees:[{}]},{residualBase:model,residualModel:model}])
    expect(()=>arcControlProposals(features,20,30,{featureSchema:ARC_POLICY_SCHEMA,featureCount:57,...retired},1)).toThrow('unsupported arc policy format');
  expect(arcControlProposals(features,20,30,model,0)).toEqual([]);
  expect(()=>arcControlProposals(features,20,30,model,-1)).toThrow('count');
});

it('uses relative body state rather than absolute track position',()=>{
  const ids=['PEG','TAIL','NOSE','STRING','BUTT','SHOULDER','RHAND','LHAND','LFOOT','RFOOT'];
  const state={points:Object.fromEntries(ids.map((id,i)=>[id,{x:2*i,y:-i,vx:4+i/10,vy:3}]))};
  const moved={points:Object.fromEntries(Object.entries(state.points).map(([id,p])=>[id,{...p,x:p.x+12000,y:p.y-7000}]))};
  expect(arcPolicyArrival(state,{x:6,y:2})).toHaveLength(47);
  expect(arcPolicyArrival(moved,{x:6,y:2})).toEqual(arcPolicyArrival(state,{x:6,y:2}));
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

it('preserves stable retained neighborhoods for ties, weighted distances and unordered rows',()=>{
  let seed=0x832ac128;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  for(let trial=0;trial<80;trial++){
    const features=Array.from({length:57},()=>Math.floor(random()*3));
    const weights=trial%2?Array.from({length:57},()=>Math.floor(random()*3)):undefined;
    const count=[1,3,8,24][trial%4],limit=Math.max(24,count*8);
    const exemplars=Array.from({length:200},(_,i)=>({
      features:Array.from({length:57},(_,j)=>i%7===0?features[j]:Math.floor(random()*3)),
      target:Array.from({length:10},()=>random()*10),
    }));
    if(trial%5===0)exemplars[trial].features[0]=NaN;
    if(trial%7===0)exemplars[trial+1].features[1]=Infinity;
    const retained:Array<{distance:number;row:typeof exemplars[number]}>=[];
    for(const row of exemplars){
      const distance=row.features.reduce((sum,x,j)=>sum+(x-features[j])**2*(weights?.[j]??(j<7?2:j<47?1:4)),0);
      if(retained.length===limit&&distance>=retained.at(-1)!.distance)continue;
      retained.push({distance,row});retained.sort((a,b)=>a.distance-b.distance);
      if(retained.length>limit)retained.pop();
    }
    const expected:ReturnType<typeof arcControlProposals>=[];
    for(const {row:{target:v}} of retained){
      const c={entry:20+30*v[0],turn:60*v[1],exit:20+60*v[2],support:30*v[3],bias:v[4],offset:v[5],clearance:12*v[6],turnFraction:v[7],bend:30*v[8],guideFlare:8*v[9]};
      if(expected.some(p=>arcControlsSimilar(c,p)))continue;
      expected.push(c);if(expected.length===count)break;
    }
    expect(arcControlProposals(features,20,30,{featureSchema:model.featureSchema,featureCount:57,featureWeights:weights,exemplars},count)).toEqual(expected);
  }
});
