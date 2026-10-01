/** Tangent schedules for concrete research geometry. The ordinary arc has no
 * profile. These shapes are constructed before simulation, never drawn over it. */
export const MOTION_PROFILES = ['serpentine', 'terraces', 'scallops', 'fold'] as const;
export type MotionProfile = typeof MOTION_PROFILES[number];
export type MotionProfileControls={profile?:MotionProfile;profileStrength?:number;profileStart?:number;rippleCycles?:number;foldAngle?:number};
export function validProfileControls(s:MotionProfileControls):boolean {
  return (s.profile===undefined||MOTION_PROFILES.includes(s.profile))&&
    (s.profileStrength===undefined||!!s.profile&&Number.isFinite(s.profileStrength)&&s.profileStrength>=0&&s.profileStrength<=2)&&
    (s.profileStart===undefined||!!s.profile&&Number.isFinite(s.profileStart)&&s.profileStart>=0&&s.profileStart<=.85)&&
    (s.rippleCycles===undefined||s.profile==='scallops'&&Number.isInteger(s.rippleCycles)&&s.rippleCycles>=1&&s.rippleCycles<=3)&&
    (s.foldAngle===undefined||s.profile==='fold'&&Number.isFinite(s.foldAngle)&&Math.abs(s.foldAngle)<=75);
}
const rad = (degrees: number) => degrees * Math.PI / 180;
const smooth = (x: number) => {x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};

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
  const w=Math.max(0,Math.min(1,phase));
  const amount=24*strength;
  switch(profile) {
    case 'fold': {
      if(!endpoints)throw new Error('fold requires its entry and exit headings');
      const target=w<1/3?endpoints.start:w<2/3?(endpoints.start+endpoints.exit)/2+rad(endpoints.foldAngle??50):endpoints.exit;
      return strength===1?target:base+strength*(target-base);
    }
    case 'serpentine': return base+rad(amount*1.6)*Math.sin(2*Math.PI*w)*Math.sin(Math.PI*w);
    case 'scallops': return base+rad(amount)*Math.sin(2*rippleCycles*Math.PI*w);
    case 'terraces': {
      const p=(w*2)%1;
      const step=smooth((p-.35)/.12)-smooth((p-.65)/.12);
      return base+rad(amount*1.5)*(step-.3)*Math.sin(Math.PI*w);
    }
    default: throw new Error(`unknown motion profile: ${profile}`);
  }
}
