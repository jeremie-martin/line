import {expect,it} from 'vitest';
import {arcBoundaryCorrection,arcSpanLoss} from '../scripts/v0/optimizer/arc_boundary.ts';
import {ArcControlMemory,arcConstructionMemoryKey,allocateArcProposalSlots,type ArcResponseExample} from '../scripts/v0/optimizer/arc_memory.ts';

it('separates demonstrations across layouts, profiles and guide permission',()=>{
 const base={guides:true,railLayout:'paired' as const,independentGuide:true};
 const variants=[base,{...base,profile:'fold' as const,faces:3},{...base,railLayout:'transfer' as const},{...base,guides:false}];
 expect(new Set(variants.map(arcConstructionMemoryKey)).size).toBe(variants.length);
 expect(arcConstructionMemoryKey({...base})).toBe(arcConstructionMemoryKey(base));
});

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

it('can preserve demonstrated support duration when only the following flight grows',()=>{
 const memory=new ArcControlMemory(),control={entry:10,turn:20,exit:30,support:12,bias:0,offset:0};
 memory.rememberControl({control,features:[0],incoming:15,span:24});
 const proposals=memory.proposeControls([0],25,240,4,'both');
 expect(proposals.map(c=>c.support)).toEqual([120,12]);
 expect(proposals.every(c=>c.entry===20&&c.exit===40)).toBe(true);
 expect(memory.proposeControls([0],25,240,4).map(c=>c.support)).toEqual([120]);
});

it('does not retain a calm passage impact preference when reusing its response elsewhere',()=>{
 const memory=new ArcControlMemory(),features=Array(57).fill(0);
 memory.rememberResponse({features,incoming:10,span:20,
  control:{entry:8,turn:20,exit:15,support:12,bias:0,offset:.1},
  targets:[.3,undefined,undefined,.4],keys:['entry'],jac:[[1],[0],[0],[2]],
  residuals:[.2,0,0,-.4],scale:[1],loss:.2,axisWeights:[1,1,1/3,4]});
 const proposal=memory.proposeResponses(features,10,20,[.3,undefined,undefined,.4],1,
  {amplitude:1/3,impact:1,damping:0,axisWeights:[1,1,1/3,1]})[0];
 // Physical air/impact errors are opposite and equal. Their equally weighted
 // compromise stays put, although the original fourfold impact weight would move.
 expect(proposal.entry).toBeCloseTo(8,14);
});

it('preserves exact response proposals when explicit weight metadata does not change the units',()=>{
 const plain=new ArcControlMemory(),explicit=new ArcControlMemory(),features=Array(57).fill(0);
 const example:ArcResponseExample={features,incoming:10,span:20,
  control:{entry:8,turn:20,exit:15,support:12,bias:0,offset:.1},
  targets:[.3,.6,.28,.11],keys:['entry','support'],
  jac:[[.8,1.2],[1.3,-.7],[.17,.11],[.19,-.13]],residuals:[.1273,-.0841,.03782,-.011973],scale:[2,3],loss:.1};
 plain.rememberResponse(example);
 explicit.rememberResponse({...example,axisWeights:[1,1,1/3,1.5]});
 const weights={amplitude:1/3,impact:1.5,damping:.0002},wanted=[.27,.71,.37,.18];
 expect(explicit.proposeResponses(features,20,32,wanted,1,{...weights,axisWeights:[1,1,1/3,1.5]}))
  .toEqual(plain.proposeResponses(features,20,32,wanted,1,weights));
});

it('retrieves exactly the stable sorted proposals through ties, duplicates, updates and nonfinite distances', async()=>{
 const {arcReferencedControl,arcControlsSimilar}=await import('../scripts/v0/optimizer/arc_motion_control.ts');
 const {makeRng}=await import('../scripts/lib/rng.ts');
 const rng=makeRng(8419),memory=new ArcControlMemory(),examples:any[]=[];
 for(let batch=0;batch<6;batch++){
  for(let i=0;i<40;i++){
   const source=examples.length&&i%3===0?examples[Math.floor(rng()*examples.length)]:undefined;
   const example=source??{features:Array.from({length:57},(_,k)=>batch===4&&k===56?Infinity:batch===5&&k===55?NaN:Math.floor(rng()*4)),incoming:0,span:10,
    control:{entry:Math.floor(rng()*4),turn:Math.floor(rng()*4),exit:Math.floor(rng()*4),support:5,bias:0,offset:0}};
   examples.push(example);memory.rememberControl(example);
  }
  for(const features of [Array(57).fill(1),Array(57).fill(2),Array(57).fill(1e308),[1],Array(57).fill(Infinity),Array(57).fill(NaN)])
   for(const count of [0,1,4,30,300])for(const duration of ['relative','both'] as const){
    const ordered=examples.map(m=>({m,d:m.features.reduce((sum:number,v:number,k:number)=>sum+(v-features[k])**2*(k>=47?4:k<7?2:1),0)})).sort((a,b)=>a.d-b.d);
    const expected:any[]=[];
    if(count>0)outer:for(const {m}of ordered){
     for(const span of duration==='both'?[30,m.span]:[30]){
      const c=arcReferencedControl(m,12,span);
      if(expected.some(p=>arcControlsSimilar(c,p)))continue;
      expected.push(c);if(expected.length>=count)break outer;
     }
    }
    expect(memory.proposeControls(features,12,30,count,duration)).toEqual(expected);
   }
 }
});

it('preserves weighted feature arithmetic across arrival, point-state and future boundaries', async () => {
 const {arcFeatureDistance}=await import('../scripts/v0/optimizer/arc_value.ts');
 const {makeRng}=await import('../scripts/lib/rng.ts');
 const rng=makeRng(57219);
 for(const length of [0,1,6,7,8,46,47,48,57,67])for(let trial=0;trial<100;trial++){
  const a=Array.from({length},()=>rng()*20-10),b=Array.from({length},()=>rng()*20-10);
  const weights=Array.from({length},()=>rng()*4);
  for(const w of [undefined,weights,new Array<number>(length)]){
   const expected=a.reduce((sum,v,k)=>sum+(v-b[k])**2*(w?.[k]??(k>=47?4:k<7?2:1)),0);
   expect(arcFeatureDistance(a,b,w)).toBe(expected);
  }
 }
});

it('expands exact seeded neighborhoods through duplicates while reading local updates afresh', async () => {
 const {arcReferencedControl,arcControlsSimilar}=await import('../scripts/v0/optimizer/arc_motion_control.ts');
 const {makeRng}=await import('../scripts/lib/rng.ts');
 const rng=makeRng(39215);
 for(const scale of [1e-200,1,1e200])for(const width of [7,57,67]){
  const make=(i:number)=>({features:Array.from({length:width},()=>Math.floor(rng()*8)*scale),incoming:0,span:10,
   control:{entry:i%5,turn:i%7,exit:i%3,support:5,bias:0,offset:0}});
  const model=Array.from({length:171},(_,i)=>make(i)),local=[make(192),make(193)];
  const memory=new ArcControlMemory(model);for(const row of local)memory.rememberControl(row);
  for(const query of [model[0].features,Array(width).fill(scale),Array(width).fill(Infinity),[NaN]]){
   const ordered=[...model,...local].map(m=>({m,d:m.features.reduce((sum,v,k)=>sum+(v-query[k])**2*(k>=47?4:k<7?2:1),0)})).sort((a,b)=>a.d-b.d);
   for(const count of [1,16,33,300])for(const duration of ['relative','both'] as const){
    const expected:any[]=[];
    outer:for(const {m} of ordered)for(const span of duration==='both'?[30,m.span]:[30]){
     const control=arcReferencedControl(m,12,span);
     if(expected.some(p=>arcControlsSimilar(p,control)))continue;
     expected.push(control);if(expected.length>=count)break outer;
    }
    expect(memory.proposeControls(query,12,30,count,duration)).toEqual(expected);
   }
   local[0].features[0]=NaN;
  }
 }
});

it('bounds only distances that cannot enter the retained neighborhood', async () => {
 const {arcFeatureDistance}=await import('../scripts/v0/optimizer/arc_value.ts');
 const {makeRng}=await import('../scripts/lib/rng.ts');
 const rng=makeRng(58321);
 for(let i=0;i<1000;i++){
  const a=Array.from({length:57},()=>rng()*20-10),b=Array.from({length:57},()=>rng()*20-10);
  const exact=arcFeatureDistance(a,b);
  const bits=new BigUint64Array(new Float64Array([exact]).buffer);
  if(exact>0&&Number.isFinite(exact))bits[0]--;
  const below=exact===0?-Number.MIN_VALUE:new Float64Array(bits.buffer)[0];
  for(const limit of [0,exact/2,below,exact,exact*2,Infinity]){
   const bounded=arcFeatureDistance(a,b,undefined,limit);
   if(exact<=limit)expect(bounded).toBe(exact);
   else expect(bounded>limit).toBe(true);
  }
 }
});

it('forks model, locally learned controls and responses into independently owned study state', () => {
  const example: ArcResponseExample = {features: [0], incoming: 10, span: 20,
    control: {entry: 8, turn: 20, exit: 15, support: 12, bias: 0, offset: .1},
    targets: [.3], keys: ['entry'], jac: [[1]], residuals: [0], scale: [2], loss: 0};
  const source = new ArcControlMemory([example]);
  source.rememberControl({...example, features: [1], control: {...example.control, turn: 40}});
  source.rememberResponse(example);
  const copy = source.fork(), controls = copy.proposeControls([0], 10, 20, 10);
  const weights = {amplitude: 1/3, impact: 1, damping: 0};
  const responses = copy.proposeResponses([0], 10, 20, [.5], 1, weights);
  expect(controls).toEqual(source.proposeControls([0], 10, 20, 10));
  expect(responses).toEqual(source.proposeResponses([0], 10, 20, [.5], 1, weights));
  // Mutating caller-owned examples after the fork cannot reach the copy.
  example.control.entry = 99; example.jac[0][0] = 5;
  source.rememberControl({...example, control: {...example.control, turn: 60}});
  expect(copy.proposeControls([0], 10, 20, 10)).toEqual(controls);
  expect(copy.proposeResponses([0], 10, 20, [.5], 1, weights)).toEqual(responses);
  copy.rememberControl({...example, control: {...example.control, turn: 80}});
  expect(source.proposeControls([0], 10, 20, 10).some(c => c.turn === 80)).toBe(false);
});
