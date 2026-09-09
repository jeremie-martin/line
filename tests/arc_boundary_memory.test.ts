import {expect,it} from 'vitest';
import {arcBoundaryCorrection,arcSpanLoss} from '../scripts/v0/optimizer/arc_boundary.ts';
import {ArcControlMemory,allocateArcProposalSlots,type ArcResponseExample} from '../scripts/v0/optimizer/arc_memory.ts';

it('keeps learned, remembered and response proposals represented in short lookahead probes',()=>{
  // A 32-sample probe has 16 initial evaluations; the analytic center uses one.
  expect(allocateArcProposalSlots([12,4,4],15)).toEqual([9,3,3]);
  expect(allocateArcProposalSlots([24,4,4],15)).toEqual([11,2,2]);
  expect(allocateArcProposalSlots([12,0,4],15)).toEqual([11,0,4]);
  expect(allocateArcProposalSlots([12,4,4],79)).toEqual([12,4,4]);
  expect(allocateArcProposalSlots([12,4,4],0)).toEqual([0,0,0]);
  for(let slots=0;slots<=25;slots++){
    const counts=allocateArcProposalSlots([12,4,4],slots);
    expect(counts.reduce((a,b)=>a+b,0)).toBe(Math.min(20,slots));
    expect(counts.every((n,i)=>Number.isSafeInteger(n)&&n>=0&&n<=[12,4,4][i])).toBe(true);
  }
});

it('replaces the truncated span without counting it twice or changing summation order',()=>{
  const targets={air:.3,speed:.6,amplitude:.2},before={air:.4,speed:.65,amplitude:.15};
  const actual={air:.35,speed:.62,amplitude:.18},weight=1/3;
  const prior=arcSpanLoss(before,targets,weight),start=prior+.0123;
  let expected=start;
  for(const key of ['air','speed','amplitude'] as const){
    const residual=(actual[key]-targets[key])*Math.sqrt(key==='amplitude'?weight:1);
    expected+=residual*residual;
  }
  expected-=prior;
  const result=arcBoundaryCorrection(actual,targets,prior,weight,start);
  expect(result.cost).toBe(expected);
  expect(result.cost).toBeCloseTo(.0123+arcSpanLoss(actual,targets,weight),15);
  expect(result.residuals).toHaveLength(3);
});

it('adapts stored controls to incoming direction and interval length without sharing compile state',()=>{
  const memory=new ArcControlMemory(),features=Array(57).fill(0);
  memory.rememberControl({features,incoming:10,span:20,control:{entry:8,turn:20,exit:15,support:12,bias:0,offset:.1}});
  expect(memory.proposeControls(features,30,40,1)[0]).toEqual({entry:28,turn:20,exit:35,support:24,bias:0,offset:.1});
  expect(new ArcControlMemory().proposeControls(features,30,40,1)).toEqual([]);
  expect(memory.proposeControls(features,30,40,0)).toEqual([]);
});

it('transfers a measured coupled response to a changed target',()=>{
  const memory=new ArcControlMemory(),features=Array(57).fill(0);
  const example:ArcResponseExample={features,incoming:10,span:20,
    control:{entry:8,turn:20,exit:15,support:12,bias:0,offset:.1},
    targets:[.3,.6,undefined,undefined],keys:['entry','support'],
    jac:[[1,1],[1,-1],[0,0],[0,0]],residuals:[0,0,0,0],scale:[2,3],loss:0};
  memory.rememberResponse(example);
  const proposal=memory.proposeResponses(features,30,40,[.5,.7,undefined,undefined],1,
    {amplitude:1/3,impact:1,damping:0})[0];
  // J delta = [0.2, 0.1], so delta = [0.15, 0.05]. Support also scales with span.
  expect(proposal.entry).toBeCloseTo(28+.15*2,14);
  expect(proposal.support).toBeCloseTo(24+.05*3*2,14);
  expect(example.control.entry).toBe(8);
  expect(example.control.support).toBe(12);
});

it('transfers a weighted response through physical residual units before applying new weights',()=>{
  const memory=new ArcControlMemory(),features=Array(57).fill(0);
  const example:ArcResponseExample={features,incoming:10,span:20,
    control:{entry:8,turn:20,exit:15,support:12,bias:0,offset:.1},
    targets:[.3,.6,undefined,undefined],keys:['entry','support'],
    jac:[[2,2],[3,-3],[0,0],[0,0]],residuals:[.2,-.3,0,0],scale:[2,3],loss:.13,
    axisWeights:[4,9,1/3,1]};
  memory.rememberResponse(example);
  const proposal=memory.proposeResponses(features,30,40,[.5,.7,undefined,undefined],1,
    {amplitude:1/3,impact:1,damping:0,axisWeights:[16,.25,1/3,1]})[0];
  // Stored physical measurements are .4/.5; solve J delta = [.1,.2].
  expect(proposal.entry).toBeCloseTo(28+.15*2,12);
  expect(proposal.support).toBeCloseTo(24-.05*3*2,12);
  expect(example.jac).toEqual([[2,2],[3,-3],[0,0],[0,0]]);
});
