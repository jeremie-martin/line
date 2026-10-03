import {expect,it} from 'vitest';
import {normalizeCompilerTimeline} from '../scripts/v0/optimizer/compiler_input.ts';
import {compileHandoff} from '../scripts/v0/optimizer/handoff.ts';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import type {Spec} from '../scripts/v0/types.ts';
const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map((t,i)=>({t,impact:.2+.08*i})),axes:{air:()=>.5,speed:()=>.5}};

it.each([NaN,Infinity,-Infinity,0,-1])('rejects duration %s before any frame-by-frame validation',duration=>{
  expect(()=>compileHandoff({...spec,duration},17,{budget:30000,creative:{}})).toThrow('Spec.duration');
});
it.each([NaN,Infinity,-Infinity])('rejects contact time %s before backend routing can drop it',t=>{
  expect(()=>compileHandoff({...spec,contacts:[{t}]},17,{budget:30000,creative:{}})).toThrow('Contact.t must be finite');
});
it('sorts contacts with their impact targets without mutating the authored input',()=>{
  const reversed={...spec,contacts:spec.contacts.slice().reverse()};
  const saved=reversed.contacts.slice();
  const normal=compileHandoff(spec,17,{budget:30000,creative:{}});
  const result=compileHandoff(reversed,17,{budget:30000,creative:{}});
  expect(result.track).toEqual(normal.track);expect(result.report).toEqual(normal.report);
  expect(result.stats).toEqual(normal.stats);expect(reversed.contacts).toEqual(saved);
  expect(normalizeCompilerTimeline(spec)).toBe(spec);
  expect(normal.work.physicalFrames).toBe(normal.stats.sim_frames);
});
it('rejects unknown compile options before doing physical search',()=>{
  expect(()=>compileHandoff(spec,17,{budget:30000,creative:{},budgetTelemetry:'summary'} as any)).toThrow('unknown compile options: budgetTelemetry');
});
it('rejects a replay-only arc allowance with a compiler-level explanation',()=>{
  expect(()=>compileArcMotion(spec,17,{budget:362})).toThrow('construction work');
});
