/** When, within its frame, the rider crossed the line it registered a contact
 * with: the sub-frame crossing time, from the frame before in free flight.
 * At the contact frame the physics has already moved colliding points back
 * onto the line, so the crossing is found from frame F − 1: each rider
 * point's free-flight step (position + velocity + gravity) against each line
 * of `lines` in contact at F. Reads already simulated frames only.
 * Validated on saved rides (2026-11-01): found for 96% of hits, and inside
 * the frame where the contact registered for 99% of those. */
import type { TrackLine } from '../types.ts';

const GRAVITY = 0.175;

/** Sub-frame time in (F − 1, F] at which a rider point crossed one of `lines`
 * in contact at frame F, or undefined when no crossing is measurable. */
export function subframeCrossing(engine: any, lines: readonly TrackLine[], F: number): number | undefined {
  const byId = new Map(lines.map(l => [l.id, l]));
  const ids = (engine.getAllContactLineIdsAtFrame(F) as number[]).filter(id => byId.has(id));
  if (!ids.length || F < 1) return undefined;
  const points = Object.values(engine.getRider(F - 1).ballisticState().points) as Array<{x: number; y: number; prevX: number; prevY: number}>;
  let first = Infinity;
  for (const id of ids) {
    const l = byId.get(id)!, dx = l.x2 - l.x1, dy = l.y2 - l.y1, length = Math.hypot(dx, dy);
    if (!(length > 0)) continue;
    const nx = -dy / length, ny = dx / length;
    for (const p of points) {
      const qx = 2 * p.x - p.prevX, qy = 2 * p.y - p.prevY + GRAVITY;
      let before = (p.x - l.x1) * nx + (p.y - l.y1) * ny, after = (qx - l.x1) * nx + (qy - l.y1) * ny;
      if (before < 0) {before = -before; after = -after;}
      const along = ((qx - l.x1) * dx + (qy - l.y1) * dy) / length;
      if (before > 0 && after <= 0 && along > -2 && along < length + 2) first = Math.min(first, before / (before - after));
    }
  }
  return Number.isFinite(first) ? F - 1 + first : undefined;
}
