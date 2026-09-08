import {expect,it} from 'vitest';
import {normalizeCompilerTimeline} from '../scripts/v0/optimizer/compiler_input.ts';
import {compileHandoff} from '../scripts/v0/optimizer/handoff.ts';
import {compileConnectedArcs} from '../scripts/v0/optimizer/connected_arcs.ts';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import type {Spec} from '../scripts/v0/types.ts';
const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map((t,i)=>({t,impact:.2+.08*i})),axes:{air:()=>.5,speed:()=>.5}};

it.each([NaN,Infinity,-Infinity,0,-1])('rejects duration %s before any frame-by-frame validation',duration=>{
  expect(()=>compileHandoff({...spec,duration},17,{budget:30000})).toThrow('Spec.duration');
});
it.each([NaN,Infinity,-Infinity])('rejects contact time %s before backend routing can drop it',t=>{
  expect(()=>compileHandoff({...spec,contacts:[{t}]},17,{budget:30000})).toThrow('Contact.t must be finite');
});
it('sorts contacts with their impact targets without mutating the authored input',()=>{
  const reversed={...spec,contacts:spec.contacts.slice().reverse()};
  const saved=reversed.contacts.slice();
  const normal=compileHandoff(spec,17,{budget:30000});
  const result=compileHandoff(reversed,17,{budget:30000});
  expect(result.track).toEqual(normal.track);expect(result.report).toEqual(normal.report);
  expect(result.stats).toEqual(normal.stats);expect(reversed.contacts).toEqual(saved);
  expect(normalizeCompilerTimeline(spec)).toBe(spec);
});
it('validates telemetry consistently before doing physical search',()=>{
  const options={budget:30000,budgetTelemetry:'invalid' as any};
  expect(()=>compileHandoff(spec,17,options)).toThrow('budgetTelemetry');
  expect(()=>compileConnectedArcs(spec,17,options)).toThrow('budgetTelemetry');
});
it('rejects a replay-only arc allowance with a compiler-level explanation',()=>{
  expect(()=>compileArcMotion(spec,17,{budget:362})).toThrow('construction work');
});

it('preserves early authored contacts in the fallback report',()=>{
  const early={...spec,contacts:[{t:.025,impact:.4},...spec.contacts]};
  const result=compileHandoff(early,17,{budget:30000});
  expect(result.report.contacts.map(c=>c.t_target)).toEqual(early.contacts.map(c=>c.t));
});
