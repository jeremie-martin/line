import type { TrackLine } from "../types.ts";

type Point = { x: number; y: number; vx: number; vy: number; nextVx: number; nextVy: number };

/** Place only ordinary type-0 collision planes. A plane projects position
 * opposite its normal; unlike acceleration material it never changes previous
 * position directly. The solver requires the incoming velocity to enter the
 * plane and penetration strictly between zero and ten physical units.
 */
export function pointwiseNormalProjection(points: readonly Point[],
  targets: readonly { x: number; y: number }[], width: number, idStart: number,
  scale = 1, projectInfeasible = false): TrackLine[] {
  const clusters: number[][] = [];
  for (let i = 0; i < points.length; i++) {
    const cluster = clusters.find(c => Math.hypot(points[c[0]].x - points[i].x, points[c[0]].y - points[i].y) < 0.1);
    if (cluster) cluster.push(i); else clusters.push([i]);
  }
  const lines: TrackLine[] = [];
  for (const cluster of clusters) {
    const mean = (fn: (i: number) => number) => cluster.reduce((s, i) => s + fn(i), 0) / cluster.length;
    const x = mean(i => points[i].x), y = mean(i => points[i].y);
    const vx = mean(i => points[i].vx), vy = mean(i => points[i].vy);
    let dx = scale * mean(i => targets[i].x - points[i].nextVx);
    let dy = scale * mean(i => targets[i].y - points[i].nextVy);
    const dot = vx * dx + vy * dy;
    if (dot >= -0.00001) {
      if (!projectInfeasible) continue;
      const correction = (dot + 0.0001) / Math.max(1e-9, vx * vx + vy * vy);
      dx -= correction * vx; dy -= correction * vy;
    }
    const magnitude = Math.hypot(dx, dy);
    if (!(magnitude > 0.00001)) continue;
    const nx = -dx / magnitude, ny = -dy / magnitude, tx = ny, ty = -nx;
    const penetration = Math.min(9.5, magnitude);
    const cx = x - nx * penetration, cy = y - ny * penetration;
    lines.push({ id: idStart + lines.length, type: 0,
      x1: cx - tx * width / 2, y1: cy - ty * width / 2,
      x2: cx + tx * width / 2, y2: cy + ty * width / 2,
      flipped: false, leftExtended: false, rightExtended: false });
  }
  return lines;
}
