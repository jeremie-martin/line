import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import type {Spec} from '../scripts/v0/types.ts';
it('uses one complete objective for terminal selection and final replay',()=>{
 const spec:Spec={duration:4,preroll:5,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.45,speed:()=>.55}};
 const result=compileArcMotion(spec,17,{budget:400_000,samples:64,channel:12,radius:24,guidance:'clearance',guidanceSamples:32,
  impactWeight:1,amplitudeWeight:1/3,arrivalWeight:.3,completeBoundary:true,impactPreparationFrames:2,
  impactSearch:{engagementGainWeight:.05},motionQuality:{burstWeight:.64,calmWeight:1,calmImpactMultiplier:1.5}});
 expect(result.failure).toBeNull();expect(Number.isFinite(result.selectionLoss)).toBe(true);
 expect(result.terminalSelectionStats).not.toBeNull();
 expect(result.terminalSelectionStats.finalLoss).toBeCloseTo(result.selectionLoss,12);
},30_000);
