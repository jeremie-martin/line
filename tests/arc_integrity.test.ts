import {expect,it} from 'vitest';
import {compileArcMotion,motionArc} from '../scripts/v0/optimizer/arc_motion.ts';
import {createArcEngine} from '../scripts/v0/optimizer/arc_engine.ts';
import {disposeAllWasmEnginesForStudy as dispose} from '../scripts/lib/native_motion/engine.ts';
import {getRiderMetered,resetFrameCount,setPhysicsFrameLimit} from '../scripts/lib/detector.ts';
import type {Spec} from '../scripts/v0/types.ts';
const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
const options={samples:32,channel:12,radius:24,bidirectional:true,impactWeight:1,amplitudeWeight:1/3,arrivalMode:'speed',arrivalWeight:.3,headingWeight:.3};

it('retains a fully completed recursive branch when a sibling exhausts the allowance',()=>{
  const r=compileArcMotion(spec,17,{...options,budget:6000,lookaheadWidth:3,lookaheadSamples:8,lookaheadDepth:2,strictHorizon:true,reserveFactor:0,guidance:'clearance',guidanceSamples:32});
  expect(r.budgetInterruptions).toContainEqual({phase:'continuation',index:2,frame:48,viable:1,retained:true});
  expect(r.rows.some(row=>row.lookahead?.probes.some((p:any)=>p.depth===2&&p.value!==null))).toBe(true);
  expect(r.failure?.reason).toBe('budget');expect(r.stats.sim_frames).toBeLessThanOrEqual(6000);
});
it('keeps completed intervals after every remaining backtracking alternative fails',()=>{
  const input={...spec,duration:2.5,contacts:[.6,1.2,1.35,1.95].map(t=>({t,impact:.4}))};
  const r=compileArcMotion(input,17,{...options,samples:16,budget:20000});
  expect(r.failure?.reason).toBe('no_arc');expect(r.backtracks).toBeGreaterThan(0);
  expect(r.rows).toHaveLength(2);expect(r.report.contacts[0].status).toBe('hit');
  expect(r.report.contacts.some(c=>c.status!=='hit')).toBe(true);
  expect(r.track.lines.length).toBeGreaterThan(0);expect(r.stats.sim_frames).toBeLessThanOrEqual(20000);
});
it('keeps accepted reflow controls synchronized with the geometry used by later repairs',()=>{
  const r=compileArcMotion(spec,17,{...options,budget:200000,samples:24,qualityRetries:2,guidance:'clearance',guidanceSamples:24,refineAttempts:4,refineMode:'reflow',refineWidth:3,refineFollowSamples:12});
  expect(r.refinementStats.counts.accepted).toBeGreaterThan(0);
  expect(r.report.contacts.every(c=>c.status==='hit')).toBe(true);
  expect(r.refinementStats.finalLoss).toBeLessThanOrEqual(r.refinementStats.initialLoss);
  resetFrameCount();setPhysicsFrameLimit(null);
  try{for(let i=0;i<r.rows.length;i++){
    const group=(l:any)=>Math.floor((l.id-1000)/10000);
    const engine=createArcEngine({position:r.track.startPosition,velocity:r.track.riders[0].startVelocity},r.track.lines.filter(l=>group(l)<i));
    const row=r.rows[i],velocity=getRiderMetered(engine,row.frame).velocity;
    engine.prepareCollisionTrace(row.frame);getRiderMetered(engine,row.frame);
    const trace=engine.readCollisionTrace()[0],points=['PEG','TAIL','NOSE','STRING'].map(k=>trace[k]);
    const actual=r.track.lines.filter(l=>group(l)===i);
    expect(motionArc(points,velocity,row.control,1000+i*10000,false,12,false,24)).toEqual(actual);
    expect(row.lines).toBe(actual.length);dispose();
  }}finally{dispose();}
});
