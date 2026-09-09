import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {createArcEngine} from '../scripts/v0/optimizer/arc_engine.ts';
import {disposeAllWasmEnginesForStudy} from '../scripts/lib/native_motion/engine.ts';
import {extractRawTrajectory,detect,resetFrameCount,setPhysicsFrameLimit} from '../scripts/lib/detector.ts';
import {measureGapAxes} from '../scripts/v0/core/measure.ts';
import {sliceTimeline} from '../scripts/v0/core/substrate.ts';
import type {Spec} from '../scripts/v0/types.ts';

it('measures the authored ending while physically validating the complete survival grace',()=>{
  const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
  const result=compileArcMotion(spec,17,{budget:65000,samples:100,channel:12,radius:24,bidirectional:true,
    impactWeight:1,amplitudeWeight:1/3,arrivalMode:'speed',arrivalWeight:.3,headingWeight:.3,authoredHorizon:true});
  expect(result.failure).toBeNull();
  expect(result.report.contacts.every(c=>c.status==='hit')).toBe(true);
  expect(result.report.off_beat_landings).toEqual([]);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(65000);
  resetFrameCount();setPhysicsFrameLimit(null);
  try{
    const engine=createArcEngine({position:result.track.startPosition,velocity:result.track.riders[0].startVelocity},result.track.lines);
    const det=detect(extractRawTrajectory(engine,180));
    expect(det.terminus.reason).toBe('endOfSpec');expect(det.terminus.frame).toBe(180);
    const tail=sliceTimeline(spec.contacts.map(c=>Math.round(c.t*40)),160).at(-1)!;
    const expected=measureGapAxes(det,tail,[],160),grace=measureGapAxes(det,tail,[],180),actual=result.rows.at(-1)!.achieved;
    expect(actual.air).toBe(expected.air);expect(actual.speed).toBe(expected.speed);expect(actual.amplitude).toBe(expected.amplitude);
    expect(actual.air).not.toBe(grace.air);
  }finally{disposeAllWasmEnginesForStudy();}
});
