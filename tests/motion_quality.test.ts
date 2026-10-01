import {describe,it,expect} from 'vitest';
import {motionSamples,summarizeMotion,NATIVE_GRAVITY} from '../scripts/v0/optimizer/motion_quality.ts';

describe('native motion observations',()=>{
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
