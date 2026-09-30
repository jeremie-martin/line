import {it,expect} from 'vitest';
import {compileHandoff} from '../scripts/v0/optimizer/handoff.ts';
import type {Spec} from '../scripts/v0/types.ts';
const spec:Spec={duration:3,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5}};
it('routes creative production explicitly and meters every stage, including final replay',()=>{
  const first=compileHandoff(spec,101,{budget:50000,creative:{variation:0}}),r=first.repertoire!;
  expect(r.plan.requests).toHaveLength(6);
  expect(r.physicalFrames).toBe(r.work.reduce((n,s)=>n+s.physicalFrames,0));
  expect(r.physicalFrames).toBeLessThanOrEqual(50000);
  expect(first.stats.sim_frames).toBe(r.physicalFrames);
  expect(first.budgetTelemetry?.compile.total_spent_frames).toBe(r.physicalFrames);
  expect(first.budgetTelemetry?.compile.hard_overrun_frames).toBe(0);
  expect(r.work.at(-1)!.stage).toBe('realization-replay');
  expect(first.track.lines.every(l=>l.type===0)).toBe(true);
  const repeat=compileHandoff(spec,101,{budget:50000,creative:{variation:0},budgetTelemetry:'off'});
  expect(repeat.track).toEqual(first.track);expect(repeat.stats.sim_frames).toBe(first.stats.sim_frames);expect(repeat.budgetTelemetry).toBeNull();
});
it('rejects incompatible diagnostic routes instead of silently running legacy search',()=>{
  expect(()=>compileHandoff(spec,101,{budget:50000,creative:{},polish:false})).toThrow('legacy search options');
});

it('realizes a shaped final impact near the music boundary using the existing physical outro',async()=>{
  const {planRepertoire}=await import('../scripts/v0/optimizer/repertoire_policy.ts');
  const ending={...spec,contacts:[.6,1.2,1.8,2.4,2.95].map(t=>({t,impact:.4}))};
  const plan=planRepertoire(ending,101);
  for(const r of plan.requests){r.construction='arcs';r.guidance='optional';}
  Object.assign(plan.requests.at(-1)!,{construction:'scallops',guidance:'required'});
  plan.phrases=plan.requests.slice(1).map(r=>({first:r.section,count:1,construction:r.construction,guidance:r.guidance}));
  const compiled=compileHandoff(ending,101,{budget:120000,constructionPlan:plan}),r=compiled.repertoire!;
  expect(r.valid).toBe(true);expect(r.realization.sections.at(-1)!.fulfilled).toBe(true);
  expect(r.result.rows.at(-1)!.control.support).toBeGreaterThan(2);
  expect(r.physicalFrames).toBeLessThanOrEqual(120000);
});
it('can end with actual contact fragments and preserves caller-owned judge engines',async()=>{
  const {LineRiderEngine}=await import('../scripts/lib/_lr_engine_wasm.ts');
  const caller=new LineRiderEngine().setStart({x:87,y:-20},{x:3,y:0});const before=caller.getRider(10).ballisticState();
  const r=compileHandoff(spec,101,{budget:180000,creative:{repertoire:['scattered']}}).repertoire!;
  expect(r.valid).toBe(true);expect(r.realization.fulfilled).toBe(true);
  expect(r.fragmentSections).toContain(r.plan.requests.length-1);
  expect(r.work.map(w=>w.stage)).toEqual(['shared-search','realization-replay']);
  expect(r.physicalFrames).toBeLessThanOrEqual(180000);
  expect(caller.getRider(10).ballisticState()).toEqual(before);
});
