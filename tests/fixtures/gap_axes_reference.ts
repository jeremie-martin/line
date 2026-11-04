/** Frozen full-axis implementation from 4d2346e8, before separating reporting geometry. */
import type {Detection} from '../../scripts/lib/detector.ts';
import {hypot2} from '../../scripts/lib/hypot2.ts';
import {CALIB, speedPxToAuthored, netDyToElevation, type AxisValues, type Gap, type TrackLine} from '../../scripts/v0/types.ts';
import {airborneAt, speedAt, velocityAt, measurementLastFrame} from '../../scripts/v0/core/substrate.ts';
import {AXIS_MEASURE} from '../../scripts/v0/core/measure.ts';
const measureImpact = AXIS_MEASURE.impact;

export function measureGapAxes(
  det: Detection,
  gap: Gap,
  gapLines: readonly TrackLine[],
  rangeEndFrame = gap.endFrame,
): AxisValues {
  const out: AxisValues = {};

  // Hot all-axis path: preserve AXES output order while sharing the common frame
  // scan across air/speed/elevation/amplitude. AXIS_MEASURE remains the per-axis
  // registry for callers that need individual reductions.
  const a = gap.startFrame;
  const b = Math.min(rangeEndFrame, measurementLastFrame(det));
  let airFrames = 0;
  let totalFrames = 0;
  let speedSumPx = 0;
  let speedFrames = 0;
  let dyTotal = 0;

  for (let f = a; f <= b; f++) {
    if (airborneAt(det, f)) airFrames++;
    totalFrames++;

    const speed = speedAt(det, f);
    if (speed !== undefined) {
      speedSumPx += speed;
      speedFrames++;
    }

    if (f > a) {
      const v = velocityAt(det, f);
      if (v !== undefined) dyTotal += v.y;
      else dyTotal = NaN;
    }
  }

  if (totalFrames > 0) out.air = airFrames / totalFrames;
  if (speedFrames > 0) out.speed = speedPxToAuthored(speedSumPx / speedFrames);

  if (gapLines.length > 0) {
    const lineLens = new Array<number>(gapLines.length);
    for (let i = 0; i < gapLines.length; i++) {
      const line = gapLines[i];
      lineLens[i] = hypot2(line.x2 - line.x1, line.y2 - line.y1);
    }
    lineLens.sort((a, b) => a - b);
    const m = lineLens.length >> 1;
    const grainMedian = lineLens.length % 2 ? lineLens[m] : (lineLens[m - 1] + lineLens[m]) / 2;
    out.grain = Math.min(1, grainMedian / CALIB.LINE_LENGTH_CAP);
  }

  const span = b - a;
  if (span > 0) {
    const v0 = velocityAt(det, a);
    if (v0 !== undefined && Number.isFinite(dyTotal)) {
      const speed = hypot2(v0.x, v0.y);
      out.elevation = netDyToElevation(dyTotal, speed, span);

      let dy = 0, peak = 0;
      for (let f = a + 1; f <= b; f++) {
        dy += velocityAt(det, f)!.y;
        const chord = ((f - a) / span) * dyTotal;
        const above = chord - dy;
        if (above > peak) peak = above;
      }
      out.amplitude = Math.min(1, peak / CALIB.AMPLITUDE_CAP);
    }
  }

  const impact = measureImpact({ det, gap, gapLines, rangeEndFrame });
  if (impact !== undefined) out.impact = impact;
  return out;
}
