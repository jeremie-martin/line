import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {createArcEngine} from '../scripts/v0/optimizer/arc_engine.ts';
import {disposeEngines} from '../scripts/lib/native_motion/engine.ts';
import {extractRawTrajectory,detect,resetFrameCount,setPhysicsFrameLimit} from '../scripts/lib/detector.ts';
import {measureGapAxes} from '../scripts/v0/core/measure.ts';
import {sliceTimeline} from '../scripts/v0/core/substrate.ts';
import {objectiveAxes,uncappedObjectiveAxes} from '../scripts/v0/optimizer/arc_interval_state.ts';
import {CALIB,type Spec,type Gap} from '../scripts/v0/types.ts';

it('reuses capped span measurements without losing excess amplitude or including survival grace',()=>{
  const det=detect({duration:120,frames:Array.from({length:121},(_,frame)=>({
    frame,position:{x:frame*5,y:-10*frame+.0875*frame*frame},velocity:{x:5,y:-10+.175*frame},
    sledContacts:frame%7===0?['PEG']:[],contactLineIds:[],sledBroken:false,riderEjected:false,
  }))});
  const lines=[{id:1,type:0,x1:0,y1:0,x2:20,y2:0}];
  for(const end of [20,80]) for(const amplitude of [undefined,.5]) {
    const gap:Gap={index:0,startFrame:0,endFrame:120,endsWithContact:false,targets:{amplitude}};
    const achieved=Object.freeze(measureGapAxes(det,{...gap,endFrame:end},lines,end));
    const objective=uncappedObjectiveAxes(det,gap,end,achieved),reference=objectiveAxes(det,gap,end);
    for(const axis of ['air','speed','amplitude'] as const) expect(objective[axis]).toBe(reference[axis]);
    expect(achieved.amplitude).toBeCloseTo(Math.min(1,.175*end*end/8/CALIB.AMPLITUDE_CAP),12);
    if(end===80&&amplitude!==undefined) expect(objective.amplitude).toBeGreaterThan(1);
    if(end===20||amplitude!==undefined) expect(objective.amplitude).not.toBe(objectiveAxes(det,gap,120).amplitude);
  }
});

it('measures the authored ending while physically validating the complete survival grace',()=>{
  const spec:Spec={duration:4,preroll:5,contacts:[.6,1.2,1.8,2.4,3].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
  const result=compileArcMotion(spec,17,{budget:65000,samples:100,channel:12,radius:24,
    impactWeight:1,amplitudeWeight:1/3,arrivalWeight:.3,headingWeight:.3});
  expect(result.failure).toBeNull();
  // The scored account decides whether every beat was hit (the legacy landing report predates it).
  expect(result.impactEvaluation.valid).toBe(true);
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
  }finally{disposeEngines();}
});
