/** Search decisions remain independent of the frozen motion observations. */
import {summarizeMotion,motionBurst,MOTION_BANDS,type MotionSample} from './motion_quality.ts';
export type MotionSearchOptions={burstWeight:number;calmWeight?:number;calmLanding?:boolean;calmImpactMultiplier?:number};
/** A landing does not reset a speed burst. Include preceding history only for
 * windows ending inside this interval; calm-passage totals remain local. */
export function intervalMotionSummary(samples:readonly MotionSample[],from:number,to:number){
  // Native samples are contiguous, so each window is one index range.
  const first=samples[0]?.frame??0,window=(start:number)=>samples.slice(Math.max(0,start-first),Math.max(0,to-first+1));
  return {...summarizeMotion(window(from),from,[]),bursts:MOTION_BANDS.map(band=>motionBurst(window(from-band.frames+1),band))};
}
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
