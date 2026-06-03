/**
 * Per-axis measurement ("reduction") registry.
 *
 * Each axis collapses a gap's worth of simulation into one normalized scalar,
 * and each does it DIFFERENTLY (air/speed are means over a frame range; grain is
 * a median of line lengths). Keeping
 * these as a name-keyed map — rather than hardcoded inline — means the achieved
 * value of an axis is defined in exactly one place, and a future axis (e.g.
 * `amplitude`, whose reduction is a per-gap PEAK height, not a mean) is a single
 * new entry here with no caller changes.
 *
 * The bodies are extracted verbatim from the former inline `measureAxes`; the
 * numbers are unchanged (guarded by the byte-identical / golden-parity gates).
 */

import type { Detection } from "../../lib/detector.ts";
import { AXES, type AxisName, type AxisValues, type Gap, type TrackLine, CALIB } from "../types.ts";
import { airborneAt, measurementLastFrame, median, speedAt } from "./substrate.ts";

/** Everything a per-gap reduction may need. Each reduction uses the subset it cares about. */
export type GapMeasureCtx = {
  det: Detection;
  gap: Gap;
  /** The catch lines placed for this gap (for geometry axes: grain). */
  gapLines: TrackLine[];
  /** Inclusive last frame for span axes (air, speed). Defaults to gap.endFrame at the call site. */
  rangeEndFrame: number;
};

/** A reduction returns the achieved axis value, or `undefined` when undefined for this gap. */
export type AxisReduction = (ctx: GapMeasureCtx) => number | undefined;

/** Airborne-frame fraction over [gap.start, rangeEndFrame]. */
const measureAir: AxisReduction = ({ det, gap, rangeEndFrame }) => {
  const a = gap.startFrame;
  const b = Math.min(rangeEndFrame, measurementLastFrame(det));
  let airFrames = 0, total = 0;
  for (let f = a; f <= b; f++) {
    if (airborneAt(det, f)) airFrames++;
    total++;
  }
  return total > 0 ? airFrames / total : undefined;
};

/** Mean |velocity| over [gap.start, rangeEndFrame], normalized by SPEED_CAP. */
const measureSpeed: AxisReduction = ({ det, gap, rangeEndFrame }) => {
  const a = gap.startFrame;
  const b = Math.min(rangeEndFrame, measurementLastFrame(det));
  let speedSum = 0, speedCount = 0;
  for (let f = a; f <= b; f++) {
    const s = speedAt(det, f);
    if (s !== undefined) { speedSum += s; speedCount++; }
  }
  return speedCount > 0 ? speedSum / speedCount / CALIB.SPEED_CAP : undefined;
};

/** Median catch-line length, normalized by LINE_LENGTH_CAP. */
const measureGrain: AxisReduction = ({ gapLines }) => {
  const lineLens = gapLines.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
  return lineLens.length > 0 ? Math.min(1, median(lineLens) / CALIB.LINE_LENGTH_CAP) : undefined;
};

/** The reduction for each axis. Add a new axis = add one entry. */
export const AXIS_MEASURE: Record<AxisName, AxisReduction> = {
  air: measureAir,
  speed: measureSpeed,
  grain: measureGrain,
};

/**
 * Measure all targeted-able axes over a gap. Equivalent to the former inline
 * `measureAxes`: every axis is measured (the cost function only scores the ones
 * actually targeted), absent axes omitted.
 */
export function measureGapAxes(
  det: Detection, gap: Gap, gapLines: TrackLine[], rangeEndFrame = gap.endFrame,
): AxisValues {
  const ctx: GapMeasureCtx = { det, gap, gapLines, rangeEndFrame };
  const out: AxisValues = {};
  for (const name of AXES) {
    const v = AXIS_MEASURE[name](ctx);
    if (v !== undefined) out[name] = v;
  }
  return out;
}
