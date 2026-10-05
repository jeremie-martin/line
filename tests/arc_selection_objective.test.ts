import {expect,it} from 'vitest';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import type {Spec} from '../scripts/v0/types.ts';
for(const refineAttempts of [0,3])it(`uses one complete objective for terminal selection, refinement and final replay (${refineAttempts} repairs)`,()=>{
 const spec:Spec={duration:4,preroll:5,jitter:0,contacts:[.6,1.2,1.8,2.4,3,3.6].map(t=>({t,impact:.4})),axes:{air:()=>.45,speed:()=>.55}};
 const result=compileArcMotion(spec,17,{budget:400_000,samples:64,channel:12,radius:24,guidance:'clearance',guidanceSamples:32,
  impactWeight:1,amplitudeWeight:1/3,arrivalWeight:.3,completeBoundary:true,impactContract:'line.strike.v3',impactPreparationFrames:2,
  impactSearch:{engagementGainWeight:.05},motionQuality:{burstWeight:.64,calmWeight:1,calmImpactMultiplier:1.5},refineAttempts,refineTailSections:1});
 expect(result.failure).toBeNull();expect(Number.isFinite(result.selectionLoss)).toBe(true);
 expect(result.terminalSelectionStats).not.toBeNull();
 if(refineAttempts){
  expect(result.refinementStats.initialLoss).toBeCloseTo(result.terminalSelectionStats.finalLoss,12);
  expect(result.refinementStats.finalLoss).toBeCloseTo(result.selectionLoss,12);
  expect(result.selectionLoss).toBeLessThanOrEqual(result.refinementStats.initialLoss+1e-12);
 }else expect(result.terminalSelectionStats.finalLoss).toBeCloseTo(result.selectionLoss,12);
},30_000);
