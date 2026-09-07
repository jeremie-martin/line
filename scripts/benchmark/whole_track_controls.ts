import type { TrackLine } from "../v0/types.ts";

export type ArrivalFrame = {
  sledX: number; sledY: number; speed: number; angleDeg: number;
  velocity: { x: number; y: number };
};
export type TransportMode = "fixed" | "translate" | "similarity";

/** Transport geometry, never the rider. An identical input preserves every bit. */
export function transportCatch(
  lines: readonly TrackLine[], original: ArrivalFrame, actual: ArrivalFrame,
  mode: TransportMode,
): TrackLine[] {
  if (mode === "fixed" || (original.sledX === actual.sledX && original.sledY === actual.sledY &&
    (mode === "translate" || (original.speed === actual.speed && original.angleDeg === actual.angleDeg)))) {
    return lines.map(line => ({ ...line }));
  }
  const angle = mode === "similarity" ? (actual.angleDeg - original.angleDeg) * Math.PI / 180 : 0;
  const scale = mode === "similarity" && original.speed > 1e-9
    ? Math.max(0.5, Math.min(2, actual.speed / original.speed)) : 1;
  const c = Math.cos(angle) * scale, s = Math.sin(angle) * scale;
  const point = (x: number, y: number) => ({
    x: actual.sledX + c * (x - original.sledX) - s * (y - original.sledY),
    y: actual.sledY + s * (x - original.sledX) + c * (y - original.sledY),
  });
  return lines.map(line => {
    const a = point(line.x1, line.y1), b = point(line.x2, line.y2);
    return { ...line, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
}

/** Native type-1 acceleration is opposite the stored tangent. Reversal plus
 * side/extension exchange preserves the collision half-plane and segment. */
export function setCatchEnergy(
  lines: readonly TrackLine[], velocity: { x: number; y: number }, direction: -1 | 0 | 1,
): TrackLine[] {
  if (direction === 0) return lines.map(line => ({ ...line }));
  return lines.map(line => {
    if (line.type === 2) return { ...line };
    const tangentDot = (line.x2 - line.x1) * velocity.x + (line.y2 - line.y1) * velocity.y;
    if (-tangentDot * direction >= 0) return { ...line, type: 1 };
    return { ...line, type: 1, x1: line.x2, y1: line.y2, x2: line.x1, y2: line.y1,
      flipped: !line.flipped, leftExtended: line.rightExtended, rightExtended: line.leftExtended };
  });
}
