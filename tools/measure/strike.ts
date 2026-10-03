/** Adapter from replayed observations (tools/measure/observe.ts) to the strike
 * account in scripts/lib/strike_impact.ts — one implementation for research,
 * compiler and judge. */
import {observeStrikes, type StrikeFrame} from '../../scripts/lib/strike_impact.ts';
export {detectStrikes, accountStrikes, STRIKE_CONTRACT} from '../../scripts/lib/strike_impact.ts';

export function strikeFrames(o: any): StrikeFrame[] {
  const velocities = o.frames.map((f: any) => {
    let x = 0, y = 0; for (const [px, py, qx, qy] of f.points) {x += px - qx; y += py - qy;} return {x: x / 10, y: y / 10};
  });
  // Frame 0 has no preceding velocity; it is never in contact in production rides.
  return [{frame: 0, contact: !!o.observed[0][0], J: 0, bend: 0, solverGain: 0, gravityGain: 0, speedBefore: 0},
    ...observeStrikes(1, velocities, f => !!o.observed[f][0])];
}
