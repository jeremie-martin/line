import { expect, it } from 'vitest';
import { compileArcMotion, motionArc } from '../scripts/v0/optimizer/arc_motion.ts';
import { trimUnusedArcGuides } from '../scripts/v0/optimizer/arc_guidance.ts';
import { LineRiderEngine as Engine, disposeAllWasmEnginesForStudy } from '../scripts/lib/_lr_engine_wasm.ts';
import { extractRawTrajectory, resetFrameCount, setPhysicsFrameLimit } from '../scripts/lib/detector.ts';
import type { Spec, TrackLine } from '../scripts/v0/types.ts';

const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
const options={budget:65000,samples:100,channel:12,radius:24,bidirectional:true,impactWeight:1,amplitudeWeight:1/3,arrivalMode:'speed',arrivalWeight:.3,headingWeight:.3,qualityRetries:2};
const chains=(lines:TrackLine[])=>{const result:TrackLine[][]=[[]];for(const l of lines){const p=result.at(-1)!.at(-1);if(p&&(p.x2!==l.x1||p.y2!==l.y1))result.push([]);result.at(-1)!.push(l);}return result;};

it('expresses single, partial and paired guidance as substantial connected normal curves',()=>{
  const control={entry:5,turn:55,exit:20,support:18,bias:0,offset:.1};
  const points=[{x:0,y:0},{x:10,y:0}],velocity={x:8,y:1};
  const single=motionArc(points,velocity,{...control,guideEnd:0},1000,false,12,false,24);
  const paired=motionArc(points,velocity,control,1000,false,12,false,24);
  const partial=motionArc(points,velocity,{...control,clearance:16,guideStart:.2,guideEnd:.8},1000,false,12,false,24);
  expect(chains(single)).toHaveLength(1);expect(chains(paired)).toHaveLength(2);expect(chains(partial)).toHaveLength(2);
  expect(chains(partial)[0]).toEqual(single);
  expect(chains(partial)[1].length).toBeLessThan(chains(paired)[1].length);
  for(const l of partial)expect(l.type).toBe(0);
  expect(chains(partial)[1].reduce((s,l)=>s+Math.hypot(l.x2-l.x1,l.y2-l.y1),0)).toBeGreaterThanOrEqual(24);
});

it('removes redundant rails with exact physical replay and unchanged frame charging',()=>{
  const full=compileArcMotion(spec,17,options),trimmed=compileArcMotion(spec,17,{...options,pruneGuidance:true});
  expect(trimmed.guidanceReduction!.removedSegments).toBeGreaterThan(0);
  expect(trimmed.track.lines.length).toBeLessThan(full.track.lines.length);
  expect(trimmed.report).toEqual(full.report);
  expect(trimmed.stats.sim_frames).toBe(full.stats.sim_frames);
  const replay=(track:any)=>extractRawTrajectory(new Engine().setStart(track.startPosition,track.riders[0].startVelocity).addLine(track.lines),track.duration);
  resetFrameCount();setPhysicsFrameLimit(null);
  try{expect(replay(trimmed.track)).toEqual(replay(full.track));}finally{disposeAllWasmEnginesForStudy();}
});

it('requires an already metered complete trajectory before inspecting collisions',()=>{
  expect(()=>trimUnusedArcGuides([],{getLastFrameIndex:()=>0},20)).toThrow('metered full replay');
});

it('charges lookahead, carries a complete physical contract and reproduces selected geometry',()=>{
  const config={...options,guidance:'full' as const,guidanceSamples:24,lookaheadWidth:3,lookaheadSamples:24,pruneGuidance:true};
  const a=compileArcMotion(spec,17,config),b=compileArcMotion(spec,17,config);
  expect(a.lookaheadStats.probes).toBeGreaterThan(0);expect(a.lookaheadStats.physicsFrames).toBeGreaterThan(0);
  expect(a.stats.sim_frames).toBeLessThanOrEqual(options.budget);expect(a.failure).toBeNull();
  expect(a.report.contacts.every(c=>c.status==='hit')).toBe(true);expect(a.report.off_beat_landings).toHaveLength(0);
  expect(a.report.terminus.reason).toBe('endOfSpec');expect(a.track).toEqual(b.track);expect(a.stats).toEqual(b.stats);
});

it('evaluates a deeper continuation tree with joint guide refinement inside the same meter',()=>{
  const result=compileArcMotion(spec,18,{...options,guidance:'full',guidanceSamples:24,guidanceJoint:true,lookaheadWidth:3,lookaheadSamples:20,lookaheadDepth:2,lookaheadBranching:2,lookaheadObjective:'terminal',reuseContinuations:true,pruneGuidance:true});
  expect(result.lookaheadStats.maxDepth).toBe(2);
  expect(result.lookaheadStats.continuationNodes).toBeGreaterThan(result.lookaheadStats.probes);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(options.budget);
  expect(result.failure).toBeNull();expect(result.report.contacts.every(c=>c.status==='hit')).toBe(true);
  expect(result.report.off_beat_landings).toHaveLength(0);
});
