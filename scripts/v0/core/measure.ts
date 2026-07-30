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
  type AxisName,
  type AxisValues,
  type Gap,
  type TrackLine,
  CALIB,
  IMPACT_WINDOW,
  normImpact,
  speedPxToAuthored,
} from "../types.ts";
import { netDyToElevation } from "../types.ts";
import {
  airborneAt, contactRedirArcPxAtLanding, findAuthoredContactNearFrame, meanSpeedPxOverRange,
  measurementLastFrame, median, speedAt, velocityAt,
} from "./substrate.ts";

/** Everything a per-gap reduction may need. Each reduction uses the subset it cares about. */
export type GapMeasureCtx = {
  det: Detection;
  gap: Gap;
  /** The catch lines placed for this gap (for geometry axes: grain). */
  gapLines: readonly TrackLine[];
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
const measureGrain: AxisReduction = ({ gapLines }) =>
  measureGrainFromLines(gapLines);

/** Geometry-only grain reduction for consumers without a simulation context. */
export function measureGrainFromLines(gapLines: readonly TrackLine[]): number | undefined {
  const lineLens = gapLines.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
  return lineLens.length > 0 ? Math.min(1, median(lineLens) / CALIB.LINE_LENGTH_CAP) : undefined;
}

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
 * NOT because position is unavailable - `POOL_MODE` is a hard `true` and every
 * candidate detection populates `position`. The integral form IS the
 * fingerprinted definition of this axis, so reading `position` directly would
 * change the float-op sequence and move a scored quantity. Do not "simplify" it.
 * `velocity` is always present, and the integral of vy
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

/**
 * Landing intensity at the gap's terminating beat: the rider's **redirection
 * IMPULSE** (`substrate.ts contactRedirArcPxAtLanding` — `cArc = Σ v̄·|Δθ|`, per-frame
 * CoM heading change × midpoint speed accumulated over CONTACTED frames of the
 * `IMPACT_WINDOW` episode, "how hard the ground bends the path" / "claquage"; airborne
 * bending never counts), mapped to felt [0,1] by `normImpact` (0 = perfectly smooth,
 * 1 = very strong). See `Contact.impact` and the `REDIRARC`/`IMPACT` blocks in types.ts.
 *
 * GATED on `gap.targets.impact`: impact is authored per-beat, so it's worth
 * measuring ONLY where a beat requested it (the cheap span-mean axes don't scan
 * events, so it'd otherwise be hot-path waste — though redir is CoM-velocity-only
 * and cheap). The metric is CoM-only: it needs NO catch-line geometry (this makes it
 * immune to sled rotation / limb whip, which look violent but aren't felt), so
 * `gapLines` is unused here. `undefined` when not targeted / no landing event near
 * the beat — the "not defined here" convention.
 */
const measureImpact: AxisReduction = ({ det, gap }) => {
  if (gap.targets.impact === undefined) return undefined;
  const landing = findAuthoredContactNearFrame(
    det,
    gap.endFrame,
    1,
    gap.endFrame - gap.startFrame,
  );
  if (landing === undefined) return undefined;
  const px = contactRedirArcPxAtLanding(det, landing.frame, IMPACT_WINDOW);
  return px === undefined ? undefined : normImpact(px);
};

/** The reduction for each axis. Add a new axis = add one entry. */
export const AXIS_MEASURE: Record<AxisName, AxisReduction> = {
  air: measureAir,
  speed: measureSpeed,
  grain: measureGrain,
  elevation: measureElevation,
  amplitude: measureAmplitude,
  impact: measureImpact,
};

/**
 * Measure all targeted-able axes over a gap. Equivalent to the former inline
 * `measureAxes`: every axis is measured (the cost function only scores the ones
 * actually targeted), absent axes omitted.
 */
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
      lineLens[i] = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
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
      const speed = Math.hypot(v0.x, v0.y);
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

export type BallisticAxisPrefixSummary = {
  startFrame: number;
  prefixEndFrame: number;
  airFrames: number;
  speedSumPx: number;
  speedFrames: number;
  dy: number;
  v0SpeedPx: number;
};

export function summarizeBallisticAxisPrefix(
  det: Detection,
  gap: Pick<Gap, "startFrame">,
  prefixEndFrame: number,
): BallisticAxisPrefixSummary | null {
  const startFrame = gap.startFrame;
  const prefixEnd = Math.max(startFrame, Math.min(prefixEndFrame, measurementLastFrame(det)));
  let airFrames = 0;
  let speedSumPx = 0;
  let speedFrames = 0;
  let dy = 0;
  for (let f = startFrame; f <= prefixEnd; f++) {
    if (airborneAt(det, f)) airFrames++;
    const v = velocityAt(det, f);
    if (v !== undefined) {
      const speed = Math.hypot(v.x, v.y);
      if (Number.isFinite(speed)) {
        speedSumPx += speed;
        speedFrames++;
      }
    }
    if (f > startFrame) {
      if (v === undefined) return null;
      dy += v.y;
    }
  }
  const v0 = velocityAt(det, startFrame);
  if (v0 === undefined) return null;
  const v0SpeedPx = Math.hypot(v0.x, v0.y);
  if (!Number.isFinite(v0SpeedPx)) return null;
  return {
    startFrame,
    prefixEndFrame: prefixEnd,
    airFrames,
    speedSumPx,
    speedFrames,
    dy,
    v0SpeedPx,
  };
}
