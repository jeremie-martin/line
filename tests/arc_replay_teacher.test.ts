import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {connectedArcOptions} from '../scripts/v0/optimizer/connected_arcs.ts';
import type {Spec} from '../scripts/v0/types.ts';

it('queries counterfactual teacher arcs while preserving the complete student track',()=>{
  const spec:Spec={duration:8,preroll:5,jitter:0,contacts:[1,2,2.3,3.2,4.4,5].map(t=>({t,impact:.4})),axes:{air:()=>.5,speed:()=>.5,amplitude:()=>.2}};
  const student=compileArcMotion(spec,16,connectedArcOptions(spec,180000));
  expect(student.failure).toBeNull();
  const teacher=compileArcMotion(spec,16,{...connectedArcOptions(spec,500000),samples:240,guidanceSamples:144,responseSamples:115,
    replayControls:student.rows.map(row=>row.control),collectValue:true});
  expect(teacher.failure).toBeNull();
  expect(teacher.track).toEqual(student.track);
  expect(teacher.stats.sim_frames).toBeLessThanOrEqual(500000);
  expect(teacher.teacherRows).toHaveLength(student.rows.length);
  expect(teacher.teacherRows.some(row=>JSON.stringify(row.control)!==JSON.stringify(row.forcedControl))).toBe(true);
  for(const [i,row] of teacher.teacherRows.entries()){
    expect(row.features).toHaveLength(57);expect(row.features.every(Number.isFinite)).toBe(true);
    expect(row.forcedControl).toEqual(student.rows[i].control);expect(row.physicalIntervalValidated).toBe(true);
  }
});
