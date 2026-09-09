import {expect,it} from 'vitest';
import {arcControlProposals,ARC_POLICY_SCHEMA} from '../scripts/v0/optimizer/arc_control_policy.ts';

const forest=(value:number[])=>({featureSchema:ARC_POLICY_SCHEMA,featureCount:57,
  trees:[0,1].map(()=>({left:[-1],right:[-1],feature:[-2],threshold:[-2],value:[value]}))});

it('adds learned corrections in relative control units without duplicating the incoming heading',()=>{
  const base=[.1,-.2,.3,.6,.2,.1,1,.3,-.1,.2];
  const delta=[-.02,.04,.05,-.1,.1,-.05,.2,-.05,.03,-.1];
  const model={featureSchema:ARC_POLICY_SCHEMA,featureCount:57,
    residualBase:forest(base),residualModel:forest(delta),residualStrength:.5};
  for(const [incoming,span] of [[20,30],[-15,80]]){
    const result=arcControlProposals(Array(57).fill(0),incoming,span,model,1)[0];
    const expected={entry:incoming+30*.09,turn:60*(-.18),exit:incoming+60*.325,
      support:span*.55,bias:.25,offset:.075,clearance:13.2,turnFraction:.275,bend:30*(-.085),guideFlare:8*.15};
    for(const [key,value] of Object.entries(expected))expect(result[key as keyof typeof result]).toBeCloseTo(value,12);
  }
});

it('keeps the base mean exact at zero correction and validates strength',()=>{
  const base=forest([.1,-.2,.3,.6,.2,.1,1,.3,-.1,.2]);
  const model={featureSchema:ARC_POLICY_SCHEMA,featureCount:57,
    residualBase:base,residualModel:forest(Array(10).fill(1)),residualStrength:0};
  const features=Array(57).fill(0),expected=arcControlProposals(features,20,30,base,1)[0];
  expect(arcControlProposals(features,20,30,model,3)).toEqual([expected,expected,expected]);
  expect(arcControlProposals(features,20,30,model,0)).toEqual([]);
  for(const residualStrength of [-1,NaN,Infinity])
    expect(()=>arcControlProposals(features,20,30,{...model,residualStrength},1)).toThrow('strength');
});
