import type { TrackLine } from "../types.ts";

type Point = { x: number; y: number; vx: number; vy: number; nextVx: number; nextVy: number };

/** Native point-local forces aimed at a common next-frame velocity. Coincident
 * points share one surface; their individual identity is never a collision mask.
 * Actual collision ordering, coverage, and binding response remain physical.
 */
export function pointwiseEnergyPulse(
  points: readonly Point[], desired: { x: number; y: number }, baseline: { x: number; y: number },
  coherent: boolean, depth: number, maxWidth: number, idStart: number,
  options: { layerCap?: number; pointGains?: readonly number[]; spacing?: number; forceScale?: number;
    pointTargets?: readonly { x: number; y: number }[] } = {},
): TrackLine[] {
  const clusters: Point[][] = [];
  for (const point of points) {
    const cluster = clusters.find(c => Math.hypot(c[0].x - point.x, c[0].y - point.y) < 0.1);
    if (cluster) cluster.push(point); else clusters.push([point]);
  }
  const mean = (c: Point[], key: keyof Point) => c.reduce((s, p) => s + p[key], 0) / c.length;
  const controls = clusters.map(cluster => {
    const x = mean(cluster, "x"), y = mean(cluster, "y");
    const targetX = cluster.reduce((s, p) => s + (options.pointTargets?.[points.indexOf(p)]?.x ?? desired.x), 0) / cluster.length;
    const targetY = cluster.reduce((s, p) => s + (options.pointTargets?.[points.indexOf(p)]?.y ?? desired.y), 0) / cluster.length;
    const dx = (targetX - (coherent ? mean(cluster, "nextVx") : baseline.x)) * (options.forceScale ?? 1);
    const dy = (targetY - (coherent ? mean(cluster, "nextVy") : baseline.y)) * (options.forceScale ?? 1);
    const magnitude = Math.hypot(dx, dy);
    if (!(magnitude > 0.05)) return null;
    const tx = dx / magnitude, ty = dy / magnitude;
    const sign = -ty * mean(cluster, "vx") + tx * mean(cluster, "vy") >= 0 ? 1 : -1;
    const nx = -ty * sign, ny = tx * sign;
    if (nx * mean(cluster, "vx") + ny * mean(cluster, "vy") < 1e-6) return null;
    const separation = Math.min(...clusters.filter(c => c !== cluster)
      .map(c => Math.abs((mean(c, "x") - x) * tx + (mean(c, "y") - y) * ty)));
    const gain = cluster.reduce((s, p) => s + (options.pointGains?.[points.indexOf(p)] ?? 1), 0) / cluster.length;
    return { x, y, tx, ty, nx, ny, sign, width: Math.max(Math.min(0.05, maxWidth), Math.min(maxWidth, separation * 0.8)),
      layers: Math.min(options.layerCap ?? Infinity, Math.max(1, Math.round(magnitude / (0.1 * Math.max(0.5, gain))))) };
  }).filter((c): c is NonNullable<typeof c> => c !== null);
  const lines: TrackLine[] = [];
  for (let layer = Math.max(0, ...controls.map(c => c.layers)) - 1; layer >= 0; layer--) for (const c of controls) {
    if (layer >= c.layers) continue;
    const x = c.x - c.nx * (depth + layer * (options.spacing ?? 0.001)), y = c.y - c.ny * (depth + layer * (options.spacing ?? 0.001));
    lines.push({ id: idStart + lines.length, type: 1, x1: x - c.tx * c.width / 2, y1: y - c.ty * c.width / 2,
      x2: x + c.tx * c.width / 2, y2: y + c.ty * c.width / 2, flipped: c.sign < 0,
      leftExtended: false, rightExtended: false });
  }
  return lines;
}
