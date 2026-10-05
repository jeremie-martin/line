/** Adapter from replayed observations (tools/measure/observe.ts) to the strike
 * account in scripts/lib/strike_impact.ts — one implementation for research,
 * compiler and judge. */
import {observeStrikes, observeMotion, bodyMotion, STRIKE_V2_CONTRACT, type StrikeFrame} from '../../scripts/lib/strike_impact.ts';
export {detectStrikes, accountStrikes, STRIKE_CONTRACT, STRIKE_V2_CONTRACT, STRIKE_V3_CONTRACT} from '../../scripts/lib/strike_impact.ts';

export function strikeFrames(o: any): StrikeFrame[] {
  const velocities = o.frames.map((f: any) => {
    let x = 0, y = 0; for (const [px, py, qx, qy] of f.points) {x += px - qx; y += py - qy;} return {x: x / 10, y: y / 10};
  });
  // Frame 0 has no preceding velocity; it is never in contact in production rides.
  return [{frame: 0, contact: !!o.observed[0][0], J: 0, bend: 0, solverGain: 0, gravityGain: 0, speedBefore: 0},
    ...observeStrikes(1, velocities, f => !!o.observed[f][0])];
}

/** v2/v3 frames (whole-body impulses) from a replayed observation, through the
 * product's own bodyMotion so research and compiler share one arithmetic. */
export function strikeMotionFrames(o: any): StrikeFrame[] {
  const ids = ['PEG', 'TAIL', 'NOSE', 'STRING', 'BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT'];
  const motions = o.frames.map((f: any) => bodyMotion({points: Object.fromEntries(f.points.map(([x, y, prevX, prevY]: number[], i: number) => [ids[i], {x, y, prevX, prevY}]))}));
  return [{frame: 0, contact: !!o.observed[0][0], J: 0, bend: 0, solverGain: 0, gravityGain: 0, speedBefore: 0, impulse: [0, 0, 0]},
    ...observeMotion(1, motions, f => !!o.observed[f][0], STRIKE_V2_CONTRACT)];
}
