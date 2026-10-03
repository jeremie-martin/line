import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {connectedArcOptions} from '../scripts/v0/optimizer/connected_arcs.ts';
import type {Spec} from '../scripts/v0/types.ts';

it('selects a complete ending among the already simulated final alternatives',()=>{
  const spec:Spec={duration:8,preroll:5,jitter:0,contacts:[1,2,2.3,3.2,4.4,5].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5,amplitude:()=>.2}};
  const after=compileArcMotion(spec,16,connectedArcOptions(spec,180000));
  expect(after.failure).toBeNull();
  expect(after.report.contacts.every(c=>c.status==='hit')).toBe(true);expect(after.report.off_beat_landings).toEqual([]);
  expect(after.terminalSelectionStats.candidates).toBeGreaterThan(0);
  expect(after.terminalSelectionStats.finalLoss).toBeLessThanOrEqual(after.terminalSelectionStats.initialLoss);
});
