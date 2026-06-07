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
import {
  AXES,
  type AxisName,
  type AxisValues,
  type Gap,
  type TrackLine,
  CALIB,
  speedPxToAuthored,
} from "../types.ts";
import { netDyToElevation } from "../types.ts";
import {
  airborneAt, meanSpeedPxOverRange, measurementLastFrame, median, velocityAt,
} from "./substrate.ts";

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

/** Mean |velocity| over [gap.start, rangeEndFrame], mapped to authored speed units. */
const measureSpeed: AxisReduction = ({ det, gap, rangeEndFrame }) => {
  const speedPx = meanSpeedPxOverRange(det, gap.startFrame, rangeEndFrame);
  return speedPx !== null ? speedPxToAuthored(speedPx) : undefined;
};

/** Median catch-line length, normalized by LINE_LENGTH_CAP. */
const measureGrain: AxisReduction = ({ gapLines }) => {
  const lineLens = gapLines.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
  return lineLens.length > 0 ? Math.min(1, median(lineLens) / CALIB.LINE_LENGTH_CAP) : undefined;
};

/**
 * Altitude trend over [gap.start, rangeEndFrame], on the relative climb-effort
 * scale: net vertical displacement (Δy = ∫vy, reconstructed from velocity since
 * the candidate detection drops `position`) normalized against the speed-relative
 * elevation band for this gap (entering speed × gap length). 0.5 = level, →1 the
 * steepest climb this speed supports, →0 the steepest plunge. See types.ts
 * `netDyToElevation` / `elevationBand` — the same band the launch generator uses,
 * so achieved and target share one model.
 */
const measureElevation: AxisReduction = ({ det, gap, rangeEndFrame }) => {
  const a = gap.startFrame;
  const b = Math.min(rangeEndFrame, measurementLastFrame(det));
  if (b <= a) return undefined;
  const v0 = velocityAt(det, a);
  if (v0 === undefined) return undefined;
  const speed = Math.hypot(v0.x, v0.y);
  let dy = 0;
  for (let f = a + 1; f <= b; f++) {
    const v = velocityAt(det, f);
    if (v === undefined) return undefined;
    dy += v.y;
  }
  return netDyToElevation(dy, speed, b - a);
};

/**
 * Peak upward bow of the trajectory above the straight chord from the gap's
 * takeoff to its landing, normalized by `CALIB.AMPLITUDE_CAP`. This is the jump
 * arc's sagitta: how *high* the rider soared, independent of net `elevation`
 * trend and orthogonal to `air` (which is how *long* it stayed aloft). Frames
 * below the chord contribute nothing (clamped at 0 = no upward arc).
 *
 * Vertical displacement is reconstructed by integrating `vy` from the gap start:
 * the compiler's candidate-window detections drop the per-frame `position` array
 * to save allocation, but `velocity` is always present, and the integral of vy
 * is exactly the chord-relative height we need. Two passes, no allocation; this
 * runs per candidate, so it stays as cheap as `measureAir`/`measureSpeed`.
 */
const measureAmplitude: AxisReduction = ({ det, gap, rangeEndFrame }) => {
  const a = gap.startFrame;
  const b = Math.min(rangeEndFrame, measurementLastFrame(det));
  const span = b - a;
  if (span <= 0) return undefined;
  // Pass 1: net vertical displacement over the gap (≈ y[b] − y[a]).
  let total = 0;
  for (let f = a + 1; f <= b; f++) {
    const v = velocityAt(det, f);
    if (v === undefined) return undefined;
    total += v.y;
  }
  // Pass 2: peak height above the takeoff→landing chord. Up is −y, so the rider
  // is above the chord when its displacement is *below* the chord's value.
  let dy = 0, peak = 0;
  for (let f = a + 1; f <= b; f++) {
    dy += velocityAt(det, f)!.y;
    const chord = ((f - a) / span) * total;
    const above = chord - dy;
    if (above > peak) peak = above;
  }
  return Math.min(1, peak / CALIB.AMPLITUDE_CAP);
};

/** The reduction for each axis. Add a new axis = add one entry. */
export const AXIS_MEASURE: Record<AxisName, AxisReduction> = {
  air: measureAir,
  speed: measureSpeed,
  grain: measureGrain,
  elevation: measureElevation,
  amplitude: measureAmplitude,
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
