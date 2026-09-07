import type { TrackLine } from "../v0/types.ts";
import { contactPulse } from "./contact_pulse.ts";

/** Point-local native surfaces share a requested normal. Merge coincident
 * points and limit tangential width so a surface can address a point cluster
 * without spanning the entire rider. Physics, including cross contacts, remains
 * the sole judge of whether the proposed collective action is realized.
 */
export function collectiveContactPulse(
  points: ReadonlyArray<{ x: number; y: number }>, velocity: { x: number; y: number },
  normalTurn: number, depth: number, maxWidth: number, idStart: number,
): TrackLine[] {
  const unique: Array<{ x: number; y: number }> = [];
  for (const point of points) if (!unique.some(p => Math.hypot(p.x - point.x, p.y - point.y) < 0.1)) unique.push(point);
  const angle = Math.atan2(velocity.y, velocity.x) + normalTurn;
  const tx = Math.sin(angle), ty = -Math.cos(angle);
  const projected = unique.map(p => p.x * tx + p.y * ty);
  return unique.map((p, i) => {
    const separation = Math.min(...projected.filter((_, j) => i !== j).map(x => Math.abs(x - projected[i])));
    const width = Math.max(0.05, Math.min(maxWidth, separation * 0.8));
    return contactPulse({ ...p, vx: velocity.x, vy: velocity.y }, normalTurn, depth, width, idStart + i);
  });
}
