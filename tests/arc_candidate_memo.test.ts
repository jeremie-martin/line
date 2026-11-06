import {expect,it,vi} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {withSequenceObserver} from '../scripts/v0/optimizer/arc_sequence.ts';
import type {MeasuredCandidate} from '../scripts/v0/optimizer/arc_candidates.ts';
import type {Spec} from '../scripts/v0/types.ts';
import futureValueModel from '../scripts/v0/optimizer/arc_value_model.json' with {type: 'json'};
import {createArcCompileContext} from '../scripts/v0/optimizer/arc_compile_context.ts';
import {openInterval,resolveIntervalOptions} from '../scripts/v0/optimizer/arc_interval_state.ts';
import {evaluate} from '../scripts/v0/optimizer/arc_evaluate.ts';
import {detect,DetectionContinuation,resetFrameCount,setPhysicsFrameLimit,type RawTrajectory} from '../scripts/lib/detector.ts';
import {withEngineScope} from '../scripts/lib/native_motion/engine.ts';
const spec:Spec={duration:4,preroll:5,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
const options={budget:200000,samples:100,channel:12,radius:24,impactWeight:1,amplitudeWeight:1/3,arrivalWeight:.3,headingWeight:.3,guidance:'clearance' as const,guidanceSamples:24};
it.each([false,true])('keeps owned candidate facts through memo reuse, cleanup and interruption (future value: %s)',async futureValue=>{
  const retained: Array<{candidate: MeasuredCandidate; snapshot: MeasuredCandidate}> = [];
  const r=await withSequenceObserver((index, offers, _chosen, ctx)=>{
    for(const interval of new Set(offers.map(o=>o.interval))){
      if(!interval.best)continue;
      const candidate=interval.best.candidate;
      if(futureValue){
        expect(candidate.valueFeatures).toHaveLength(73);
        expect(candidate.valueFeatures!.slice(47)).toStrictEqual(ctx.futureValueFeatures(index));
        Object.freeze(candidate.valueFeatures);
      }
      expect(interval.candidates).toContain(candidate);
      expect(candidate).not.toHaveProperty('child');
      // Later reuse and cleanup may replace live handles, never measured facts.
      Object.freeze(candidate);
      retained.push({candidate,snapshot:structuredClone(candidate)});
    }
  },async()=>compileArcMotion(spec,17,{...options,budget:6000,...(futureValue?{futureValueModel}:{})}));
  expect(r.candidateMemo.hits).toBeGreaterThan(0);
  expect(r.stats.sim_frames).toBeLessThanOrEqual(6000);
  expect(r.track.lines.every(l=>l.type===0)).toBe(true);
  expect(r.report.contacts).toHaveLength(spec.contacts.length);
  expect(retained.length).toBeGreaterThan(0);
  for(const {candidate,snapshot} of retained)expect(candidate).toStrictEqual(snapshot);
});

it('preserves full observations and owned facts when geometry invalidates part of a prefix',()=>{
  const compiled=compileArcMotion(spec,17,options);
  expect(compiled.failure).toBeNull();
  resetFrameCount();setPhysicsFrameLimit(null);
  withEngineScope(()=>{
    const ctx=createArcCompileContext(spec,options),index=1;
    const engine=ctx.lineage.rebuild(compiled.track.lines.filter(l=>Math.floor((l.id-1000)/10000)<index));
    const s=openInterval(ctx,engine,index,resolveIntervalOptions(ctx,index,{}),ctx.memoryFor(index),[])!;
    const prefix=structuredClone(s.prefixRaw),control=compiled.rows[index].control;
    Object.freeze(s.prefixRaw.frames);
    let observed:RawTrajectory | undefined;
    const resume=DetectionContinuation.prototype.withDetection;
    const spy=vi.spyOn(DetectionContinuation.prototype,'withDetection').mockImplementation(function(raw,consume){
      observed=structuredClone(raw);
      const expected=detect(raw);
      return resume.call(this,raw,det=>{expect(det).toStrictEqual(expected);return consume(det);});
    });
    try {
      const first=evaluate(s,control)!;
      expect(first).not.toBeNull();
      const facts=structuredClone(first.candidate);
      Object.freeze(first.candidate);
      s.memo.clear();
      // Moving between nearby supports invalidates the last prefix frame,
      // while its boundary state still matches. Revisit detection's lookahead.
      for(const delta of [-.125,.125,-.25,.25,-.5,.5,-1,1,-2,2]){
        const changed=evaluate(s,{...control,offset:control.offset+delta});
        if(changed)expect(observed).toStrictEqual({duration:s.horizon,frames:changed.child.getCachedRawFrames(0,s.horizon)});
      }
      expect(s.detectionFrames).toBeLessThan(s.frame);
      const checkpoint=s.detection;
      const repeated=evaluate(s,control)!;
      expect(repeated).not.toBeNull();
      expect(s.detection).toBe(checkpoint);
      expect(observed).toStrictEqual({duration:s.horizon,frames:repeated.child.getCachedRawFrames(0,s.horizon)});
      expect(s.prefixRaw).toStrictEqual(prefix);
      expect(first.candidate).toStrictEqual(facts);
      expect(repeated.candidate).toStrictEqual(facts);
    } finally {spy.mockRestore();}
  });
});
