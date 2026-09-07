import type { TrackLine } from "../v0/types.ts";

export type ArrivalFrame = {
  sledX: number; sledY: number; speed: number; angleDeg: number;
  velocity: { x: number; y: number };
};
export type TransportMode = "fixed" | "translate" | "similarity" | "restore";
export type CatchControl = { energy: -1 | 0 | 1; turn: number; logScale: number };

/** Continuous catch controls about the measured arrival reference. */
export function shapeCatch(lines: readonly TrackLine[], frame: ArrivalFrame, control: CatchControl): TrackLine[] {
  if (control.turn === 0 && control.logScale === 0) return lines.map(line => ({ ...line }));
  const scale = Math.exp(control.logScale), c = Math.cos(control.turn) * scale, s = Math.sin(control.turn) * scale;
  const point = (x: number, y: number) => ({ x: frame.sledX + c * (x - frame.sledX) - s * (y - frame.sledY),
    y: frame.sledY + s * (x - frame.sledX) + c * (y - frame.sledY) });
  return lines.map(line => { const a = point(line.x1, line.y1), b = point(line.x2, line.y2);
    return { ...line, x1: a.x, y1: a.y, x2: b.x, y2: b.y }; });
}

/** Transport geometry, never the rider. An identical input preserves every bit. */
export function transportCatch(
  lines: readonly TrackLine[], original: ArrivalFrame, actual: ArrivalFrame,
  mode: TransportMode,
): TrackLine[] {
  if (mode === "fixed" || (original.sledX === actual.sledX && original.sledY === actual.sledY &&
    (mode === "translate" || (original.speed === actual.speed && original.angleDeg === actual.angleDeg)))) {
    return lines.map(line => ({ ...line }));
  }
  const angle = mode !== "translate" ? (actual.angleDeg - original.angleDeg) * Math.PI / 180 : 0;
  const scale = mode !== "translate" && original.speed > 1e-9
    ? Math.max(0.5, Math.min(2, actual.speed / original.speed)) : 1;
  const c = Math.cos(angle) * scale, s = Math.sin(angle) * scale;
  if (mode !== "restore") {
    const point = (x: number, y: number) => ({
      x: actual.sledX + c * (x - original.sledX) - s * (y - original.sledY),
      y: actual.sledY + s * (x - original.sledX) + c * (y - original.sledY),
    });
    return lines.map(line => { const a = point(line.x1, line.y1), b = point(line.x2, line.y2);
      return { ...line, x1: a.x, y1: a.y, x2: b.x, y2: b.y }; });
  }
  const lengths = lines.map(l => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
  const starts: number[] = []; let length = 0, closest = Infinity, captureDistance = 0;
  lines.forEach((l, i) => {
    starts.push(length);
    if (lengths[i] > 0) {
      const t = Math.max(0, Math.min(1, ((original.sledX - l.x1) * (l.x2 - l.x1) +
        (original.sledY - l.y1) * (l.y2 - l.y1)) / lengths[i] ** 2));
      const d = Math.hypot(original.sledX - l.x1 - t * (l.x2 - l.x1), original.sledY - l.y1 - t * (l.y2 - l.y1));
      if (d < closest) { closest = d; captureDistance = length + t * lengths[i]; }
    }
    length += lengths[i];
  });
  const restoreEnd = starts.at(-1) ?? length;
  const point = (x: number, y: number, distance: number) => {
    const u = mode === "restore" && restoreEnd > captureDistance
      ? Math.max(0, Math.min(1, (distance - captureDistance) / (restoreEnd - captureDistance))) : 0;
    const weight = 1 - u * u * (3 - 2 * u);
    const dx = x - original.sledX, dy = y - original.sledY;
    return { x: actual.sledX + dx + weight * (c * dx - s * dy - dx),
      y: actual.sledY + dy + weight * (s * dx + c * dy - dy) };
  };
  return lines.map((line, i) => {
    const a = point(line.x1, line.y1, starts[i]), b = point(line.x2, line.y2, starts[i] + lengths[i]);
    return { ...line, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
}

/** Native type-1 propulsion follows the stored tangent. The kernel adds its
 * opposite vector to previous position, hence subtracts it from velocity.
 * Reversal plus side/extension exchange preserves the collision half-plane. */
export function setCatchEnergy(
  lines: readonly TrackLine[], velocity: { x: number; y: number }, direction: -1 | 0 | 1,
): TrackLine[] {
  if (direction === 0) return lines.map(line => ({ ...line }));
  return lines.map(line => {
    if (line.type === 2) return { ...line };
    const tangentDot = (line.x2 - line.x1) * velocity.x + (line.y2 - line.y1) * velocity.y;
    if (tangentDot * direction >= 0) return { ...line, type: 1 };
    return { ...line, type: 1, x1: line.x2, y1: line.y2, x2: line.x1, y2: line.y1,
      flipped: !line.flipped, leftExtended: line.rightExtended, rightExtended: line.leftExtended };
  });
}
