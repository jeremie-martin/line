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
