import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {connectedArcOptions} from '../scripts/v0/optimizer/connected_arcs.ts';
import {createArcEngine} from '../scripts/v0/optimizer/arc_engine.ts';
import {detect,extractRawTrajectory,getRiderMetered,setPhysicsFrameLimit} from '../scripts/lib/detector.ts';
import {effectiveAxes,sliceTimeline} from '../scripts/v0/core/substrate.ts';
import {measureGapAxes} from '../scripts/v0/core/measure.ts';
import type {Spec} from '../scripts/v0/types.ts';

it('refines the ending with elapsed-time span weights and event-weighted impact',()=>{
  const spec:Spec={duration:8,preroll:5,jitter:0,
    contacts:[1,2,2.3,3.2,4.4,5].map(t=>({t,impact:.4})),
    axes:{air:()=>.5,speed:()=>.5,amplitude:()=>.2}};
  const budget=180000;
  const options={...connectedArcOptions(spec,budget),lookaheadWidth:0,terminalOptimization:true};
  const result=compileArcMotion(spec,16,options);
  expect(result.failure).toBeNull();
  expect(result.report.contacts.every(c=>c.status==='hit')).toBe(true);
  expect(result.report.off_beat_landings).toEqual([]);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(budget);
  expect(result.track.lines.every(l=>l.type===0)).toBe(true);
  setPhysicsFrameLimit(null);
  const start={position:result.track.startPosition,velocity:result.track.riders[0].startVelocity};
  const engine=createArcEngine(start,result.track.lines);
  const det=detect(extractRawTrajectory(engine,340));
  const last=result.rows.at(-1)!;
  const before=detect(extractRawTrajectory(engine,last.frame-1));
  const gaps=sliceTimeline(spec.contacts.map(c=>Math.round(c.t*40)),320);
  for(const g of gaps){g.targets=effectiveAxes(g,spec);if(g.endsWithContact)g.targets.impact=spec.contacts[g.index].impact;}
  const tail=gaps.at(-1)!,previous=gaps.at(-2)!;
  const actualTail=measureGapAxes(det,tail,[],320);
  const actualPrevious=measureGapAxes(det,previous,[],previous.endFrame);
  const truncatedPrevious=measureGapAxes(before,previous,[],previous.endFrame-1);
  let expected=0;
  for(const axis of ['air','speed','amplitude'] as const){
    const axisWeight=axis==='amplitude'?1/3:1;
    // All three span axes are authored for the full eight seconds in this fixture.
    const scale=spec.contacts.length*axisWeight/320;
    expected+=scale*(tail.endFrame-tail.startFrame)*(actualTail[axis]!-tail.targets[axis]!)**2;
    expected+=scale*(previous.endFrame-previous.startFrame)*
      ((actualPrevious[axis]!-previous.targets[axis]!)**2-(truncatedPrevious[axis]!-previous.targets[axis]!)**2);
  }
  expected+=(actualPrevious.impact!-previous.targets.impact!)**2;
  expect(getRiderMetered(engine,340).velocity.x).toBeGreaterThan(0);
  expect(last.cost).toBeCloseTo(expected,12);
});
