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
  expect(()=>compileHandoff(spec,101,{budget:180000,creative:{},impactContract:'unknown' as any})).toThrow('unknown impact contract');
});

it('measures a real opposing receiver on its body-contact onset without changing the incoming history',async()=>{
  const {createArcEngine}=await import('../scripts/v0/optimizer/arc_engine.ts');
  const {motionArc}=await import('../scripts/v0/optimizer/arc_geometry.ts');
  const {extractRawTrajectory,detect}=await import('../scripts/lib/detector.ts');
  const {impactFrames,evaluateMusicalImpacts}=await import('../scripts/v0/optimizer/impact_search.ts');
  const {findAuthoredContactNearFrame}=await import('../scripts/v0/core/substrate.ts');
  const start={position:{x:0,y:0},velocity:{x:6,y:-3}},base=createArcEngine(start,[]);
  base.prepareCollisionTrace(10);const free=base.getRider(10),trace=base.readCollisionTrace()[0];
  const lines=motionArc(Object.values(trace),free.velocity,
    {entry:0,turn:15,exit:35,support:8,bias:0,offset:.2,contactSide:-1},1000,false,0,false,24,4,{guides:false});
  const engine=createArcEngine(start,lines),raw=extractRawTrajectory(engine,25);
  expect(engine.getRider(9).ballisticState()).toEqual(base.getRider(9).ballisticState());
  expect(raw.frames.every(f=>!f.riderEjected&&!f.sledBroken)).toBe(true);
  expect(raw.frames[11].sledContacts).toEqual([]);expect(engine.hasContactAtFrame(11)).toBe(true);
  expect(findAuthoredContactNearFrame(detect(raw),11,1)).toBeUndefined();
  const measured=evaluateMusicalImpacts(impactFrames(engine,raw.frames),[{frame:11,impact:.55}],25,true);
  expect(measured.valid).toBe(true);expect(measured.account.matches[0].offset).toBe(0);
  expect(measured.events[0].strength).toBeGreaterThan(.5);expect(measured.account.unmatchedEvents).toEqual([]);
  expect(lines.every(l=>l.type===0)).toBe(true);
});
