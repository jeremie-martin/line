/** Tangent schedules for concrete research geometry. The ordinary arc has no
 * profile. These shapes are constructed before simulation, never drawn over it.
 * Each schedule is its family's row in geometry_families.ts. */
import {GEOMETRY_FAMILIES,type Construction,type GeometryFamily} from './geometry_families.ts';
const families:Readonly<Record<string,GeometryFamily|undefined>>=GEOMETRY_FAMILIES;
/** A shaped family's id names its profile. */
export type MotionProfile = Exclude<Construction, 'arcs' | 'scattered'>;
export const MOTION_PROFILES = Object.keys(families).filter(id=>families[id]!.heading) as MotionProfile[];
export type MotionProfileControls={profile?:MotionProfile;profileStrength?:number;profileStart?:number;rippleCycles?:number;foldAngle?:number};
export function validProfileControls(s:MotionProfileControls):boolean {
  return (s.profile===undefined||MOTION_PROFILES.includes(s.profile))&&
    (s.profileStrength===undefined||!!s.profile&&Number.isFinite(s.profileStrength)&&s.profileStrength>=0&&s.profileStrength<=2)&&
    (s.profileStart===undefined||!!s.profile&&Number.isFinite(s.profileStart)&&s.profileStart>=0&&s.profileStart<=.85)&&
    (s.rippleCycles===undefined||s.profile==='scallops'&&Number.isInteger(s.rippleCycles)&&s.rippleCycles>=1&&s.rippleCycles<=3)&&
    (s.foldAngle===undefined||s.profile==='fold'&&Number.isFinite(s.foldAngle)&&Math.abs(s.foldAngle)<=75);
}
/** Allocate the fold's three faces using the existing entry-duration and easing
 * controls. The corner headings stay deliberate while search can move them. */
export function foldTime(phase:number,first=1/3,bias=0,minimum=.2):number {
  if(phase<=0)return 0;if(phase>=1)return 1;
  if(first===1/3&&bias===0)return phase;
  // The historical schedule gives every face a fifth of the support time.
  // Intentional transfers can instead search an absolute face-duration floor;
  // shrinking a face to a point cannot silently erase an engaged corner.
  // Transfer captures may keep short, substantial entry faces before a long
  // runout. The caller searches this timing; native corner engagement still
  // decides validity. Preserve exact historical arithmetic at the default.
  const remaining=minimum===.2?.4:1-3*minimum;
  const split=1/(1+Math.exp(-bias)),entry=minimum+remaining*first,middle=entry+minimum+remaining*(1-first)*split;
  return phase<1/3?phase*3*entry:phase<2/3?entry+(phase-1/3)*3*(middle-entry):middle+(phase-2/3)*3*(1-middle);
}

export function profileHeading(profile: MotionProfile, base: number, phase: number, strength=1, rippleCycles=2,
  endpoints?:{start:number;exit:number;foldAngle?:number}): number {
  if(phase>=1)return base;
  const heading=families[profile]?.heading;
  if(!heading)throw new Error(`unknown motion profile: ${profile}`);
  return heading(base,Math.max(0,Math.min(1,phase)),strength,rippleCycles,endpoints);
}
