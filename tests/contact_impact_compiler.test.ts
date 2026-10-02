import {it,expect} from 'vitest';
import {compileHandoff} from '../scripts/v0/optimizer/handoff.ts';
import {CONTACT_IMPACT_CONTRACT} from '../scripts/lib/contact_impact.ts';
import {replayGalleryTrack} from '../scripts/gallery/artifacts.ts';
import {contactImpactGrade} from '../scripts/gallery/contact_impact_grade.ts';
import {sliceTimeline,effectiveAxes,axesAtFrame} from '../scripts/v0/core/substrate.ts';
import type {Spec} from '../scripts/v0/types.ts';
const spec:Spec={duration:3,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
it('uses the same impact account in automatic construction, replay and review without rerolling the arrangement',()=>{
  const ordinary=compileHandoff(spec,101,{budget:180000,creative:{}}).repertoire!;
  const checkpoint=compileHandoff(spec,101,{budget:180000,creative:{},impactContract:CONTACT_IMPACT_CONTRACT.id}),r=checkpoint.repertoire!;
  expect(r.plan).toEqual(ordinary.plan);
  expect(r.result.impactEvaluation?.valid).toBe(true);
  expect(r.realization.fulfilled).toBe(true);
  expect(r.result.track.lines.every(l=>l.type===0)).toBe(true);
  expect(r.physicalFrames).toBe(r.work.reduce((n,w)=>n+w.physicalFrames,0));
  expect(r.physicalFrames).toBeLessThanOrEqual(180000);
  const contacts=spec.contacts.map(c=>({frame:Math.round(c.t*40),impact:c.impact}));
  const gaps=sliceTimeline(contacts.map(c=>c.frame),120);
  const c={durationFrames:120,contacts,air:gaps.map(g=>({gap:g.index,target:effectiveAxes(g,spec).air})),
    samples:{speed:Array.from({length:121},(_,f)=>axesAtFrame(f,spec).speed)}} as any;
  const replay=replayGalleryTrack(r.result.track,c,true,CONTACT_IMPACT_CONTRACT.id);
  expect(replay.impactEvaluation).toEqual(r.result.impactEvaluation);
  const grade=contactImpactGrade(replay.grade,replay.impactEvaluation!);
  expect(grade.score.valid).toBe(true);
  expect(grade.score.weightedAxisRms).toBeCloseTo(Math.sqrt(r.result.impactTrajectoryLoss!),12);
  expect(new Set(grade.contacts.map(c=>c.actualFrame)).size).toBe(contacts.length);
  const repeat=compileHandoff(spec,101,{budget:180000,creative:{},impactContract:CONTACT_IMPACT_CONTRACT.id}).repertoire!;
  expect(repeat.result.track).toEqual(r.result.track);
  expect(repeat.physicalFrames).toBe(r.physicalFrames);
});
it('rejects unknown measurement contracts explicitly',()=>{
  expect(()=>compileHandoff(spec,101,{budget:180000,impactContract:'unknown' as any})).toThrow('unknown impact contract');
});
