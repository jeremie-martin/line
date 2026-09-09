import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {connectedArcOptions} from '../scripts/v0/optimizer/connected_arcs.ts';
import type {Spec} from '../scripts/v0/types.ts';

it('selects a complete ending without consuming additional physics work',()=>{
  const spec:Spec={duration:8,preroll:5,jitter:0,contacts:[1,2,2.3,3.2,4.4,5].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5,amplitude:()=>.2}};
  const options={...connectedArcOptions(spec,180000),terminalSelection:false},before=compileArcMotion(spec,16,options),after=compileArcMotion(spec,16,{...options,terminalSelection:true});
  expect(before.failure).toBeNull();expect(after.failure).toBeNull();
  expect(after.report.contacts.every(c=>c.status==='hit')).toBe(true);expect(after.report.off_beat_landings).toEqual([]);
  expect(after.stats.sim_frames).toBe(before.stats.sim_frames);
  expect(after.rows.slice(0,-1)).toEqual(before.rows.slice(0,-1));
  expect(after.terminalSelectionStats.candidates).toBeGreaterThan(0);
  expect(after.terminalSelectionStats.finalLoss).toBeLessThanOrEqual(after.terminalSelectionStats.initialLoss);
});
