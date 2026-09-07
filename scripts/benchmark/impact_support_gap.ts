/** One rider-scaled interruption in an existing connected solid carrier.
 * Geometry outside the cut is retained; no sampled width or phase is exposed.
 */
import type { TrackLine } from "../v0/types.ts";
type Point = { x: number; y: number };
export function isConnectedSolid(lines: readonly TrackLine[]): boolean {
  return lines.length > 1 && lines.every((l, i) => l.type === 0 &&
    Math.hypot(l.x2 - l.x1, l.y2 - l.y1) > 1e-9 &&
    (i === 0 || (lines[i - 1].x2 === l.x1 && lines[i - 1].y2 === l.y1)));
}
export function interruptSupport(lines: readonly TrackLine[], sledPoints: readonly Point[], speed: number): any {
  if (!isConnectedSolid(lines) || sledPoints.length !== 4 || !(speed > 0) ||
      ![speed, ...sledPoints.flatMap(p => [p.x, p.y])].every(Number.isFinite)) return { available: false, reason: "invalid_carrier_or_state" };
  let extent = 0;
  const segments = lines.map(line => {
    const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
    const result = { line, length, start: extent, end: extent + length };
    extent += length; return result;
  });
  const projected = sledPoints.map(point => {
    let bestDistance = Infinity, bestAlong = 0;
    for (const s of segments) {
      const dx = s.line.x2 - s.line.x1, dy = s.line.y2 - s.line.y1;
      const t = Math.max(0, Math.min(1, ((point.x - s.line.x1) * dx + (point.y - s.line.y1) * dy) / s.length ** 2));
      const distance = (point.x - s.line.x1 - t * dx) ** 2 + (point.y - s.line.y1 - t * dy) ** 2;
      if (distance < bestDistance) { bestDistance = distance; bestAlong = s.start + t * s.length; }
    }
    return bestAlong;
  });
  const minimum = Math.min(...projected), maximum = Math.max(...projected), center = (minimum + maximum) / 2;
  const width = maximum - minimum + speed, low = center - width / 2, high = center + width / 2;
  if (!(low > 0 && high < extent)) return { available: false, reason: "cut_outside_carrier", projected, low, high, extent };
  const pieces: Array<{ line: TrackLine; originalId: number; side: "before" | "after" }> = [];
  for (const s of segments) {
    const pointAt = (distance: number): Point => {
      const t = (distance - s.start) / s.length;
      return { x: s.line.x1 + t * (s.line.x2 - s.line.x1), y: s.line.y1 + t * (s.line.y2 - s.line.y1) };
    };
    if (s.start < low) {
      const end = Math.min(low, s.end), endpoint = end === s.end ? { x: s.line.x2, y: s.line.y2 } : pointAt(end);
      pieces.push({ line: { ...s.line, x2: endpoint.x, y2: endpoint.y,
        rightExtended: end === low ? false : s.line.rightExtended }, originalId: s.line.id, side: "before" });
    }
    if (s.end > high) {
      const start = Math.max(high, s.start), endpoint = start === s.start ? { x: s.line.x1, y: s.line.y1 } : pointAt(start);
      pieces.push({ line: { ...s.line, x1: endpoint.x, y1: endpoint.y,
        leftExtended: start === high ? false : s.line.leftExtended }, originalId: s.line.id, side: "after" });
    }
  }
  const changed = pieces.map((p, i) => ({ ...p.line, id: lines[0].id + i }));
  return { available: true, lines: changed, origins: pieces.map((p, i) => ({ id: changed[i].id, originalId: p.originalId, side: p.side })),
    projected, width, low, high, extent };
}
