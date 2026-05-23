/**
 * Circular arc → polyline. Pure geometry helper used by halfPipe / loop.
 *
 * Convention: screen coords with +y DOWN (same as everything else in this
 * project and lr-core). `arcLines` returns a sequence of TrackLine segments
 * that together approximate a circular arc.
 *
 * Parameterization:
 *   center, radius — the circle's center and radius
 *   startAngleRad, endAngleRad — start/end angles measured from +x axis,
 *       in the math sense (CCW with +y up; but since our +y is DOWN, what
 *       looks like CCW on screen is CW in this math). Either way, the arc
 *       sweeps from start to end going in the direction implied by the
 *       sign of `endAngleRad - startAngleRad`.
 *   segments — discretization
 *   lineIdStart — first id; subsequent lines are contiguous
 *
 * Caller is responsible for tangency to surrounding geometry (this helper
 * just draws the arc).
 */

import { type TrackLine } from "./primitive.ts";

export function arcLines(p: {
  center: { x: number; y: number };
  radius: number;
  startAngleRad: number;
  endAngleRad: number;
  segments: number;
  lineIdStart: number;
}): TrackLine[] {
  const { center, radius, startAngleRad, endAngleRad, segments, lineIdStart } = p;
  if (segments < 1) return [];

  const lines: TrackLine[] = [];
  let prevX = center.x + radius * Math.cos(startAngleRad);
  let prevY = center.y + radius * Math.sin(startAngleRad);
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const a = startAngleRad + (endAngleRad - startAngleRad) * t;
    const x = center.x + radius * Math.cos(a);
    const y = center.y + radius * Math.sin(a);
    lines.push({
      id: lineIdStart + i - 1,
      type: 0,
      x1: prevX,
      y1: prevY,
      x2: x,
      y2: y,
      flipped: false,
      leftExtended: false,
      rightExtended: false,
    });
    prevX = x;
    prevY = y;
  }
  return lines;
}

/**
 * Helper: compute the angle of a point relative to a center.
 * Returns radians in (-π, π].
 */
export function angleOf(center: { x: number; y: number }, point: { x: number; y: number }): number {
  return Math.atan2(point.y - center.y, point.x - center.x);
}
