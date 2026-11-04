/** Native trajectory observations, separate from the frozen musical judge.
 * Stored velocity is pre-solve. The next stored velocity minus gravity is the
 * current effective velocity; the final sample can use the already-read state.
 * No contact gate: internal motion can follow the final collision by a frame. */
import type {RawFrame, Vec2} from '../../lib/detector.ts';

export const MOTION_OBSERVATION_VERSION='line.motion-observation.v1';
export const NATIVE_GRAVITY=.175;
const speed=(v:Vec2)=>Math.hypot(v.x,v.y);
const direction=(a:Vec2,b:Vec2)=>Math.abs(Math.atan2(a.x*b.y-a.y*b.x,a.x*b.x+a.y*b.y));
const BODY_POINT_IDS=['BUTT','SHOULDER','RHAND','LHAND','LFOOT','RFOOT'] as const;
export type MotionSample={frame:number;incoming:Vec2;effective:Vec2;speedBefore:number;speedAfter:number;
  gravityGain:number;solverGain:number;directionCorrection:number};
export function motionSamples(frames:readonly Pick<RawFrame,'frame'|'velocity'>[],from:number,to:number,terminalEffective?:Vec2):MotionSample[]{
  if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<1||to<from)throw new Error('invalid motion observation window');
  const first=frames[0]?.frame,last=frames.at(-1)?.frame;
  if(first===undefined||last===undefined||from<first||to>last||to===last&&!terminalEffective)throw new Error('motion window requires its next velocity or terminal effective state');
  const samples:MotionSample[]=[];
  let previousSpeed:number|undefined;
  for(let frame=from;frame<=to;frame++){
    const row=frames[frame-first],next=frames[frame-first+1];
    if(row?.frame!==frame||next&&next.frame!==frame+1)throw new Error('motion samples require a contiguous native trajectory');
    const incoming=row.velocity,effective=next?{x:next.velocity.x,y:next.velocity.y-NATIVE_GRAVITY}:terminalEffective!;
    if(!Number.isFinite(incoming.x)||!Number.isFinite(incoming.y)||!Number.isFinite(effective.x)||!Number.isFinite(effective.y))throw new Error('nonfinite motion sample');
    const speedBefore=previousSpeed??Math.hypot(incoming.x,incoming.y-NATIVE_GRAVITY),speedAfter=speed(effective),incomingSpeed=speed(incoming);
    previousSpeed=speedAfter;
    samples.push({frame,incoming,effective,speedBefore,speedAfter,
      gravityGain:incomingSpeed-speedBefore,solverGain:speedAfter-incomingSpeed,
      directionCorrection:.5*(incomingSpeed+speedAfter)*direction(incoming,effective)});
  }
  return samples;
}
export type BurstBand={frames:number;absolute:number;relative:number};
/** Pilot bands anchored in the measured examples; not a universal beauty score.
 * Versioned separately so the calibration can be frozen with V6. */
export const MOTION_BANDS:readonly BurstBand[]=[
  {frames:1,absolute:.75,relative:.1},
  {frames:4,absolute:1.25,relative:.2},
  {frames:10,absolute:2,relative:.3},
];
/** Observe one rolling burst band without computing unrelated passage totals. */
export function motionBurst(samples:readonly MotionSample[],band:BurstBand){
  let gain=0,maximum=0,maxRelative=0,maxExcess=0,excessIntegral=0,peakFrame:number|null=null,exceedanceFrames=0,episodes=0,last=-Infinity;
  for(let i=0;i<samples.length;i++){
    gain+=samples[i].solverGain;if(i>=band.frames)gain-=samples[i-band.frames].solverGain;
    if(i+1<band.frames)continue;
    const before=samples[i-band.frames+1].speedBefore,limit=Math.max(band.absolute,band.relative*before),excess=Math.max(0,gain-limit);
    maximum=Math.max(maximum,gain);maxRelative=Math.max(maxRelative,gain/Math.max(1,before));
    excessIntegral+=excess/band.frames;
    if(excess>maxExcess){maxExcess=excess;peakFrame=samples[i].frame;}
    if(excess>1e-9){exceedanceFrames++;if(samples[i].frame-last>band.frames)episodes++;last=samples[i].frame;}
  }
  return {...band,maximum,maxRelative,maxExcess,excessIntegral,peakFrame,exceedanceFrames,episodes};
}
export function summarizeMotion(samples:readonly MotionSample[],landingFrame:number,bands:readonly BurstBand[]=MOTION_BANDS){
  const bursts=bands.map(band=>motionBurst(samples,band));
  let solverGain=0,gravityGain=0,positiveCorrection=0,absoluteCorrection=0,directionCorrection=0;
  let laterFrames=0,laterAbsoluteCorrection=0,laterDirectionCorrection=0;
  for(const sample of samples){
    const absolute=Math.abs(sample.solverGain);
    solverGain+=sample.solverGain;gravityGain+=sample.gravityGain;
    positiveCorrection+=Math.max(0,sample.solverGain);absoluteCorrection+=absolute;
    directionCorrection+=sample.directionCorrection;
    if(sample.frame>=landingFrame+7){
      laterFrames++;laterAbsoluteCorrection+=absolute;laterDirectionCorrection+=sample.directionCorrection;
    }
  }
  return {schema:MOTION_OBSERVATION_VERSION,frames:samples.length,bursts,
    solverGain,gravityGain,positiveCorrection,absoluteCorrection,directionCorrection,
    laterFrames,laterAbsoluteCorrection,laterDirectionCorrection};
}
export function effectiveBodyVelocity(state:{points:Record<string,{x:number;y:number;prevX:number;prevY:number}>}):Vec2{
  let x=0,y=0;
  for(const id of BODY_POINT_IDS){
    const point=state.points[id];
    x+=(point.x-point.prevX)/BODY_POINT_IDS.length;
    y+=(point.y-point.prevY)/BODY_POINT_IDS.length;
  }
  return {x,y};
}
