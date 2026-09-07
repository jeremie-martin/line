import type { TrackLine } from "../v0/types.ts";

/** A finite native contact aimed from an observed point state. Its normal faces
 * the point's flow at a signed angle; penetration is a geometric proposal,
 * never a forced state. The exact engine judges timing, all body points,
 * collision persistence, and the subsequent track.
 */
export function contactPulse(
  point: { x: number; y: number; vx: number; vy: number },
  normalTurn: number, depth: number, width: number, id: number,
): TrackLine {
  if (![point.x, point.y, point.vx, point.vy, normalTurn, depth, width].every(Number.isFinite) ||
      !(depth > 0 && depth < 10 && width > 0)) throw new Error("invalid contact pulse");
  const angle = Math.atan2(point.vy, point.vx) + normalTurn;
  const nx = Math.cos(angle), ny = Math.sin(angle), tx = ny, ty = -nx;
  const cx = point.x - nx * depth, cy = point.y - ny * depth;
  return { id, type: 0, x1: cx - tx * width / 2, y1: cy - ty * width / 2,
    x2: cx + tx * width / 2, y2: cy + ty * width / 2,
    flipped: false, leftExtended: false, rightExtended: false };
}
