/** Two-dimensional Euclidean norm without temporary argument storage.
 * Scale before squaring to avoid overflow and underflow. Preserve input order:
 * for two finite terms the compensated sum used by Math.hypot has zero initial
 * compensation, so this is the same binary64 calculation. Nonfinite inputs
 * retain the builtin's infinity and NaN behavior; the zero vector yields +0.
 */
export function hypot2(x: number, y: number): number {
  const ax = Math.abs(x), ay = Math.abs(y), scale = Math.max(ax, ay);
  if (!Number.isFinite(scale)) return Math.hypot(x, y);
  if (scale === 0) return 0;
  const nx = ax / scale, ny = ay / scale;
  return Math.sqrt(nx * nx + ny * ny) * scale;
}
