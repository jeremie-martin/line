import {expect,it} from 'vitest';
import {refineArcPair} from '../scripts/v0/optimizer/arc_pair_response.ts';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import type {Spec} from '../scripts/v0/types.ts';

it('solves a coupled response while retaining a valid incumbent at a feasibility boundary',()=>{
 let calls=0;
 const measure=(coordinates:number[])=>{
  calls++;const [a,b]=coordinates;if(a<0||b<0)return null;
  const residuals=[a+b-3,a-b-1];return {coordinates,residuals,value:residuals.reduce((s,v)=>s+v*v,0),payload:null};
 };
 const initial=measure([.1,.1])!;calls=0;
 const result=refineArcPair(initial,[.5,.5],42,measure);
 expect(result.best.value).toBeLessThan(1e-6);expect(calls).toBe(result.proposals);expect(calls).toBeLessThanOrEqual(42);
 expect(result.best.coordinates.every(v=>v>=0)).toBe(true);
 const blocked=refineArcPair(initial,[1,1],14,()=>null);expect(blocked.best).toBe(initial);
});

it('adjusts adjacent native intervals without losing timing, normal lines or the shared physics limit',()=>{
 const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
 const result=compileArcMotion(spec,17,{budget:300000,samples:80,channel:12,radius:24,
  impactWeight:1,amplitudeWeight:1/3,arrivalMode:'speed',arrivalWeight:.3,headingWeight:.3,
  lookaheadWidth:3,lookaheadSamples:24,completeBoundary:true,
  guidance:'clearance',guidanceSamples:24,coupledIntervalSamples:64});
 expect(result.report.contacts.every(c=>c.status==='hit')).toBe(true);
 expect(result.report.off_beat_landings).toHaveLength(0);expect(result.report.terminus.reason).toBe('endOfSpec');
 expect(result.track.lines.every(l=>l.type===0)).toBe(true);expect(result.stats.sim_frames).toBeLessThanOrEqual(300000);
 expect(result.coupledIntervalWork.some(w=>w.accepted>0)).toBe(true);
 expect(result.coupledIntervalWork.every(w=>w.after<=w.before)).toBe(true);
});
