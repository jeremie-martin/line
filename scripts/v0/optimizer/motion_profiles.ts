/** Tangent schedules for concrete research geometry. The ordinary arc has no
 * profile. These shapes are constructed before simulation, never drawn over it. */
export const MOTION_PROFILES = ['serpentine', 'terraces', 'scallops'] as const;
export type MotionProfile = typeof MOTION_PROFILES[number];
export type MotionProfileControls={profile?:MotionProfile;profileStrength?:number;profileStart?:number;rippleCycles?:number};
export function validProfileControls(s:MotionProfileControls):boolean {
  return (s.profile===undefined||MOTION_PROFILES.includes(s.profile))&&
    (s.profileStrength===undefined||!!s.profile&&Number.isFinite(s.profileStrength)&&s.profileStrength>=0&&s.profileStrength<=2)&&
    (s.profileStart===undefined||!!s.profile&&Number.isFinite(s.profileStart)&&s.profileStart>=0&&s.profileStart<=.85)&&
    (s.rippleCycles===undefined||s.profile==='scallops'&&Number.isInteger(s.rippleCycles)&&s.rippleCycles>=1&&s.rippleCycles<=3);
}
const rad = (degrees: number) => degrees * Math.PI / 180;
const smooth = (x: number) => {x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};

export function profileHeading(profile: MotionProfile, base: number, phase: number, strength=1, rippleCycles=2): number {
  if(phase>=1)return base;
  const w=Math.max(0,Math.min(1,phase));
  const amount=24*strength;
  switch(profile) {
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
