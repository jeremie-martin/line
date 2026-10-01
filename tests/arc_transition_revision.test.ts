import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import type {Spec} from '../scripts/v0/types.ts';

it('revisits a preceding native construction with a valid combined result and one shared budget',()=>{
 const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map((t,i)=>({t,impact:i%2?.7:.2})),axes:{air:()=>.5,speed:()=>.5}};
 const options={budget:300000,samples:80,channel:12,radius:24,bidirectional:true,
  impactWeight:1,amplitudeWeight:1/3,arrivalMode:'speed',arrivalWeight:.3,headingWeight:.3,
  lookaheadWidth:3,lookaheadSamples:24,lookaheadDepth:1,reuseContinuations:true,completeBoundary:true,
  memoCandidates:true,reuseEvaluations:true,guidance:'clearance' as const,guidanceSamples:24};
 const result=compileArcMotion(spec,17,{...options,transitionRevision:{errorThreshold:0,width:3,samples:48,guidanceSamples:48,responseSamples:40}});
 expect(result.report.contacts.every(c=>c.status==='hit')).toBe(true);
 expect(result.report.off_beat_landings).toHaveLength(0);expect(result.report.terminus.reason).toBe('endOfSpec');
 expect(result.track.lines.every(l=>l.type===0)).toBe(true);
 expect(result.stats.sim_frames).toBeLessThanOrEqual(options.budget);
 expect(result.transitionRevisionWork.some(r=>r.accepted)).toBe(true);
 expect(result.transitionRevisionWork.every(r=>r.after<=r.before&&r.physicsFrames>0)).toBe(true);
 expect(result.transitionRevisionWork.reduce((n,r)=>n+r.physicsFrames,0)).toBeLessThan(result.stats.sim_frames);
 // The final cold native replay inside compileArcMotion must agree exactly with
 // the independent judge after both earlier geometry and current state changed.
 expect(result.rows).toHaveLength(spec.contacts.length+1);
 expect(new Set(result.track.lines.map(l=>l.id)).size).toBe(result.track.lines.length);
});

it('rejects a non-finite or unbounded revision request before compiling',()=>{
 const spec:Spec={duration:2,contacts:[],axes:{air:()=>.5}};
 for(const transitionRevision of [{width:13},{errorThreshold:NaN},{samples:-1}])
  expect(()=>compileArcMotion(spec,1,{budget:10000,transitionRevision})).toThrow('invalid transition revision');
});
