/**
 * Arc → TrackLine[] geometric expansion.
 *
 * An Arc is a parametric polyline. We expand it into `segments` short line
 * segments, walking from `anchor` along the curve. The tangent angle at
 * normalized position `t ∈ [0, 1]` along the arc is interpolated from
 * `startAngleDeg` to `endAngleDeg` under a curve-bias easing.
 *
 * curveBias semantics (TODO calibrate):
 *   bias = 0  → linear interpolation (circular-ish)
 *   bias > 0  → eased near start, sharper near end
 *   bias < 0  → sharper near start, eased near end
 */

import type { Arc, TrackLine } from "./types.ts";

export function arcToLines(arc: Arc, idStart: number): TrackLine[] {
  if (arc.segments < 1) {
    throw new Error(`Arc.segments must be >= 1, got ${arc.segments}`);
  }
  const lines: TrackLine[] = [];
  const segLen = arc.length / arc.segments;
  let x = arc.anchor.x;
  let y = arc.anchor.y;

  for (let i = 0; i < arc.segments; i++) {
    // Use midpoint of the segment's parametric range for the segment's angle.
    // Produces smoother polyline approximation than start-of-segment sampling.
    const tMid = (i + 0.5) / arc.segments;
    const ft = applyCurveBias(tMid, arc.curveBias);
    const angleDeg =
      arc.startAngleDeg + (arc.endAngleDeg - arc.startAngleDeg) * ft;
    const a = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(a) * segLen;
    const dy = Math.sin(a) * segLen;
    lines.push(makeSolidLine(idStart + i, x, y, x + dx, y + dy));
    x += dx;
    y += dy;
  }
  return lines;
}

function applyCurveBias(t: number, bias: number): number {
  // bias ∈ [-1, +1]; bias=0 is identity.
  if (bias === 0) return t;
  if (bias > 0) {
    // Power easing with exponent 1+bias: eases the start.
    return Math.pow(t, 1 + bias);
  }
  // bias < 0: reflect — eases the end.
  return 1 - Math.pow(1 - t, 1 - bias);
}

/** Build a TrackLine with collidable physics (type 0 = solid). */
export function makeSolidLine(
  id: number, x1: number, y1: number, x2: number, y2: number,
): TrackLine {
  return {
    id,
    type: 0,
    x1, y1, x2, y2,
    flipped: false,
    leftExtended: false,
    rightExtended: false,
  };
}
