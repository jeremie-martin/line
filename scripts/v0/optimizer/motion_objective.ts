/** Search decisions remain independent of the frozen motion observations. */
import type {summarizeMotion} from './motion_quality.ts';
export type MotionSearchOptions={burstWeight:number;calmWeight?:number;calmLanding?:boolean;calmImpactMultiplier?:number};
/** Search residuals are research parameters, not the benchmark definition.
 * Leave the first musical residuals unchanged for existing response memories. */
export function motionResiduals(summary:ReturnType<typeof summarizeMotion>,impact:number|undefined,options:MotionSearchOptions):number[]{
  const residuals=summary.bursts.map(b=>Math.sqrt(options.burstWeight)*b.maxExcess/b.absolute);
  const calm=Math.max(0,1-(impact??1)/.2),frames=Math.max(1,summary.laterFrames);
  const weight=Math.sqrt((options.calmWeight??0)*calm);
  residuals.push(weight*Math.max(0,summary.laterDirectionCorrection/frames-.15),
    weight*Math.max(0,options.calmLanding?summary.absoluteCorrection/Math.max(1,summary.frames)-.025:summary.laterAbsoluteCorrection/frames-.04));
  return residuals;
}
