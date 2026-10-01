import {expect,it} from 'vitest';
import {intervalMotionSummary} from '../scripts/v0/optimizer/motion_objective.ts';
import {summarizeMotion,type MotionSample} from '../scripts/v0/optimizer/motion_quality.ts';

const sample=(frame:number,solverGain:number):MotionSample=>({frame,solverGain,
 incoming:{x:5,y:0},effective:{x:5+solverGain,y:0},speedBefore:5,speedAfter:5+solverGain,
 gravityGain:0,directionCorrection:0});

it('observes a burst split across adjacent construction intervals',()=>{
 const samples=Array.from({length:8},(_,i)=>sample(i+1,i>=2&&i<6?.4:0));
 const local=summarizeMotion(samples.filter(s=>s.frame>=5),5);
 expect(local.bursts[1].maxExcess).toBe(0);
 const measured=intervalMotionSummary(samples,5,8);
 expect(measured.bursts[1].maxExcess).toBeCloseTo(.35,12);
 expect(measured.bursts[1].peakFrame).toBe(6);
 expect(measured.frames).toBe(local.frames);
 expect(measured.absoluteCorrection).toBe(local.absoluteCorrection);
 expect(measured.laterAbsoluteCorrection).toBe(local.laterAbsoluteCorrection);
});

it('excludes windows ending before the interval and handles startup history',()=>{
 const samples=Array.from({length:16},(_,i)=>sample(i+1,i===0?5:0));
 expect(summarizeMotion(samples,1).bursts.every(b=>b.maxExcess>0)).toBe(true);
 expect(intervalMotionSummary(samples,11,16).bursts.every(b=>b.maxExcess===0)).toBe(true);
 expect(intervalMotionSummary(samples,1,16)).toEqual(summarizeMotion(samples,1));
});
