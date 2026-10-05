import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {createArcCompileContext} from '../scripts/v0/optimizer/arc_compile_context.ts';
import {openInterval,resolveIntervalOptions} from '../scripts/v0/optimizer/arc_interval_state.ts';
import {arcSpanLoss} from '../scripts/v0/optimizer/arc_boundary.ts';
import {resetFrameCount,setPhysicsFrameLimit} from '../scripts/lib/detector.ts';
import {LineRiderEngine as Engine} from '../scripts/lib/native_motion/engine.ts';
import type {Spec} from '../scripts/v0/types.ts';
for(const jitter of [0,.05])it(`replaces precisely the earlier span estimate when construction leads its beat; jitter=${jitter}`,()=>{
 const spec:Spec={duration:4,preroll:5,jitter,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),
  axes:{air:t=>.45+.04*Math.sin(t),speed:t=>.55+.03*Math.cos(t)}};
 const options={budget:250_000,samples:64,channel:12,radius:24,guidance:'clearance' as const,guidanceSamples:32,
  impactWeight:1,amplitudeWeight:1/3,arrivalWeight:.3,completeBoundary:true,
  impactContract:'line.strike.v3' as const,impactPreparationFrames:2};
 const result=compileArcMotion(spec,17,options);expect(result.failure).toBeNull();expect(result.rows).toHaveLength(7);
 const ctx=createArcCompileContext(spec,17,options);resetFrameCount();setPhysicsFrameLimit(null);
 try{for(let i=1;i<ctx.contacts.length;i++){
  const prefix=ctx.lineage.rebuild(result.track.lines.filter(l=>Math.floor((l.id-1000)/10000)<i));
  const local=resolveIntervalOptions(ctx,i,{}),opened=openInterval(ctx,prefix,i,local,ctx.memoryFor(i),[])!;
  const previous=ctx.planned.find(g=>g.index===ctx.contacts[i].gap)!;
  expect(opened.priorLoss).toBeCloseTo(arcSpanLoss(result.rows[i-1].achieved,previous.targets,options.amplitudeWeight),12);
  Engine.retainOnly([]);
 }}finally{Engine.retainOnly([]);setPhysicsFrameLimit(null)}
},30_000);
