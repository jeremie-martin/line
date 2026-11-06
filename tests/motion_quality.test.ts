import {describe,it,expect} from 'vitest';
import {motionSamples,summarizeMotion,NATIVE_GRAVITY} from '../scripts/v0/optimizer/motion_quality.ts';

describe('native motion observations',()=>{
  it('restarting a sample window preserves exact observations at every split',()=>{
    const values=[-Number.MAX_VALUE,-1e100,-1,-Number.MIN_VALUE,-0,0,Number.MIN_VALUE,1,1e100,Number.MAX_VALUE];
    const frames=Array.from({length:42},(_,frame)=>({frame,velocity:{x:values[frame%values.length],y:values[(frame*3+1)%values.length]}}));
    const whole=motionSamples(frames,1,40);
    for(let cut=0;cut<whole.length;cut++)
      expect(whole.slice(0,cut).concat(motionSamples(frames,cut+1,40))).toStrictEqual(whole);
  });
  it('subtracts gravity along the actual steered path and retains a delayed final response',()=>{
    const frames=[{frame:0,velocity:{x:4,y:-2}},
      {frame:1,velocity:{x:4,y:-2+NATIVE_GRAVITY}},
      {frame:2,velocity:{x:5,y:-1+NATIVE_GRAVITY}},
      {frame:3,velocity:{x:5,y:-1+2*NATIVE_GRAVITY}}];
    const xs=motionSamples(frames,1,3,{x:6,y:0});
    expect(xs[1].solverGain).toBeCloseTo(0,12);
    expect(xs[0].directionCorrection).toBeGreaterThan(0);
    expect(xs.reduce((n,x)=>n+x.solverGain+x.gravityGain,0)).toBeCloseTo(6-Math.hypot(4,-2),12);
    expect(xs[2].solverGain).toBeGreaterThan(.8);
  });
  it('does not classify undeformed free fall as a solver boost',()=>{
    const fs=Array.from({length:121},(_,frame)=>({frame,velocity:{x:4,y:-2+frame*NATIVE_GRAVITY}}));
    const xs=motionSamples(fs,1,119),summary=summarizeMotion(xs,1);
    expect(Math.max(...xs.map(x=>Math.abs(x.solverGain)))).toBeLessThan(1e-12);
    expect(summary.bursts.every(b=>b.episodes===0)).toBe(true);
  });
  it('detects sustained boosts and checks motion after the impact window',()=>{
    const fs=Array.from({length:22},(_,frame)=>({frame,velocity:{x:5+.5*Math.max(0,frame-9),y:frame*NATIVE_GRAVITY}}));
    const summary=summarizeMotion(motionSamples(fs,1,20),1);
    expect(summary.bursts.find(b=>b.frames===4)!.maxExcess).toBeGreaterThan(0);
    expect(summary.laterAbsoluteCorrection).toBeGreaterThan(4);
    expect(summary.bursts.find(b=>b.frames===4)!.episodes).toBe(1);
  });
  it('rejects incomplete, discontinuous and nonfinite observation windows',()=>{
    const fs=[{frame:1,velocity:{x:1,y:0}},{frame:3,velocity:{x:1,y:0}}];
    expect(()=>motionSamples(fs,1,2)).toThrow();
    expect(()=>motionSamples(fs,1,3)).toThrow();
    expect(()=>motionSamples([{frame:1,velocity:{x:NaN,y:0}}],1,1,{x:1,y:0})).toThrow();
  });
});

// The mutable search rule must be able to observe calm correction during the
// landing window too. Frozen motion summaries and musical impact stay unchanged.
it('can search calm landing corrections without penalizing energetic contact',async()=>{
 const {motionResiduals}=await import('../scripts/v0/optimizer/motion_objective.ts');
 const summary=summarizeMotion([],1);summary.frames=10;summary.absoluteCorrection=2;
 expect(motionResiduals(summary,.02,{burstWeight:0,calmWeight:1}).at(-1)).toBe(0);
 expect(motionResiduals(summary,.02,{burstWeight:0,calmWeight:1,calmLanding:true}).at(-1)).toBeGreaterThan(0);
 expect(motionResiduals(summary,.8,{burstWeight:0,calmWeight:1,calmLanding:true}).at(-1)).toBe(0);
});

it('retains exact frame-local speeds when reusing the preceding effective speed',()=>{
  let seed=0x16319a21;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  for(const scale of [0,1e-200,1,1e100,1e200]){
    const frames=Array.from({length:42},(_,frame)=>({frame,velocity:{x:(random()-.5)*scale,y:(random()-.5)*scale}}));
    const samples=motionSamples(frames,3,41,{x:7,y:-2});
    for(const sample of samples){
      const incoming=frames[sample.frame].velocity;
      expect(sample.speedBefore).toBe(Math.hypot(incoming.x,incoming.y-NATIVE_GRAVITY));
    }
  }
});
