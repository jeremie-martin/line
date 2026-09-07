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
    let magnitude = Math.hypot(dx, dy);
    // A scheduled contact still needs a physical plane when ballistic motion
    // already matches the target. Use a tiny admissible projection, then let
    // the real collision/contact and prefix checks decide whether it works.
    if (!(magnitude > 0.00001)) {
      const pace = Math.hypot(vx, vy);
      if (!(pace > 0)) continue;
      dx = -vx / pace * 0.0001; dy = -vy / pace * 0.0001;
      magnitude = 0.0001;
    }
    const penetration = Math.min(9.5, magnitude);
    let direction: { nx: number; ny: number; tx: number; ty: number } | null = null;
    // A normal plane can project every point up to ten units behind it. Narrow
    // width alone cannot separate vertically aligned sled points. Small physical
    // tilts separate their tangent coordinates without collision masks.
    for (const turn of [0, 0.0001, -0.0001, 0.0003, -0.0003, 0.001, -0.001, 0.003, -0.003, 0.01, -0.01, 0.03, -0.03]) {
      const nx = (-dx * Math.cos(turn) + dy * Math.sin(turn)) / magnitude;
      const ny = (-dx * Math.sin(turn) - dy * Math.cos(turn)) / magnitude;
      const tx = ny, ty = -nx;
      if (nx * vx + ny * vy <= 0.000001) continue;
      const overlaps = points.some((p, i) => {
        if (cluster.includes(i)) return false;
        const perp = (p.x - x) * nx + (p.y - y) * ny + penetration;
        const along = (p.x - x) * tx + (p.y - y) * ty;
        return perp > 0 && perp < 10 && Math.abs(along) <= width / 2 + 0.000001;
      });
      if (!overlaps) { direction = { nx, ny, tx, ty }; break; }
    }
    if (!direction) continue;
    const { nx, ny, tx, ty } = direction;
    const cx = x - nx * penetration, cy = y - ny * penetration;
    lines.push({ id: idStart + lines.length, type: 0,
      x1: cx - tx * width / 2, y1: cy - ty * width / 2,
      x2: cx + tx * width / 2, y2: cy + ty * width / 2,
      flipped: false, leftExtended: false, rightExtended: false });
  }
  return lines;
}
