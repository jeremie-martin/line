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

import type { TrackLine } from "./types.ts";

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

/** Materialize a connected path only when a consumer needs individual lines. */
export function solidPathLines(paths: readonly import('../lib/track.ts').SolidPath[]): TrackLine[] {
  const lines: TrackLine[] = [];
  for (const {id, points} of paths) for (let i = 1; i < points.length; i++)
    lines.push(makeSolidLine(id + i - 1, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y));
  return lines;
}
