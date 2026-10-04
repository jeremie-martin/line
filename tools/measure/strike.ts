/** Adapter from replayed observations (tools/measure/observe.ts) to the strike
 * account in scripts/lib/strike_impact.ts — one implementation for research,
 * compiler and judge. */
import {observeStrikes, observeMotion, STRIKE_V2_CONTRACT, type StrikeFrame} from '../../scripts/lib/strike_impact.ts';
export {detectStrikes, accountStrikes, STRIKE_CONTRACT, STRIKE_V2_CONTRACT, STRIKE_V3_CONTRACT} from '../../scripts/lib/strike_impact.ts';

export function strikeFrames(o: any): StrikeFrame[] {
  const velocities = o.frames.map((f: any) => {
    let x = 0, y = 0; for (const [px, py, qx, qy] of f.points) {x += px - qx; y += py - qy;} return {x: x / 10, y: y / 10};
  });
  // Frame 0 has no preceding velocity; it is never in contact in production rides.
  return [{frame: 0, contact: !!o.observed[0][0], J: 0, bend: 0, solverGain: 0, gravityGain: 0, speedBefore: 0},
    ...observeStrikes(1, velocities, f => !!o.observed[f][0])];
}

/** v2 frames (whole-body impulses) from a replayed observation. */
export function strikeMotionFrames(o: any): StrikeFrame[] {
  const motions = o.frames.map((f: any) => {
    let cx = 0, cy = 0, vx = 0, vy = 0;
    for (const [x, y, px, py] of f.points) {cx += x; cy += y; vx += x - px; vy += y - py;}
    cx /= 10; cy /= 10; vx /= 10; vy /= 10;
    let L = 0, R2 = 0;
    for (const [x, y, px, py] of f.points) {const rx = x - cx, ry = y - cy; L += rx * (y - py - vy) - ry * (x - px - vx); R2 += rx * rx + ry * ry;}
    return {v: {x: vx, y: vy}, L, R: Math.sqrt(R2 / 10)};
  });
  return [{frame: 0, contact: !!o.observed[0][0], J: 0, bend: 0, solverGain: 0, gravityGain: 0, speedBefore: 0, impulse: [0, 0, 0]},
    ...observeMotion(1, motions, f => !!o.observed[f][0], STRIKE_V2_CONTRACT)];
}
