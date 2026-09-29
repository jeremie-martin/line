/** Tangent schedules for concrete research geometry. The ordinary arc has no
 * profile. These shapes are constructed before simulation, never drawn over it. */
export const MOTION_PROFILES = ['serpentine', 'terraces', 'scallops'] as const;
export type MotionProfile = typeof MOTION_PROFILES[number];
const rad = (degrees: number) => degrees * Math.PI / 180;
const smooth = (x: number) => {x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};

export function profileHeading(profile: MotionProfile, base: number, phase: number): number {
  if(phase>=1)return base;
  const w=Math.max(0,Math.min(1,phase));
  const amount=24;
  switch(profile) {
    case 'serpentine': return base+rad(amount*1.6)*Math.sin(2*Math.PI*w)*Math.sin(Math.PI*w);
    case 'scallops': return base+rad(amount)*Math.sin(4*Math.PI*w);
    case 'terraces': {
      const p=(w*2)%1;
      const step=smooth((p-.35)/.12)-smooth((p-.65)/.12);
      return base+rad(amount*1.5)*(step-.3)*Math.sin(Math.PI*w);
    }
    default: throw new Error(`unknown motion profile: ${profile}`);
  }
}
