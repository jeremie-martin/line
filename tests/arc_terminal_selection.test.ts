import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {connectedArcOptions} from '../scripts/v0/optimizer/connected_arcs.ts';
import type {Spec} from '../scripts/v0/types.ts';

it('selects a complete ending among the already simulated final alternatives',()=>{
  const spec:Spec={duration:8,preroll:5,contacts:[1,2,2.3,3.2,4.4,5].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5,amplitude:()=>.2}};
  // 200000: an allowance whose ride has no off-beat landing (re-derived for the beam slot and
  // strong-catch effort, 2026-11-07; it was 180000).
  const after=compileArcMotion(spec,16,connectedArcOptions(spec,200000));
  expect(after.failure).toBeNull();
  // The scored account, not the legacy landing report: a catch reached by a short hop can be a
  // valid matched impact without a legacy sled landing (2026-11-07).
  expect(after.impactEvaluation.valid).toBe(true);
  expect(after.terminalSelectionStats.candidates).toBeGreaterThan(0);
  expect(after.terminalSelectionStats.finalLoss).toBeLessThanOrEqual(after.terminalSelectionStats.initialLoss);
});
