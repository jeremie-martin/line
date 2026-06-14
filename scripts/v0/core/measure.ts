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
  ELEVATION,
  IMPACT_WINDOW,
  normImpact,
  speedPxToAuthored,
} from "../types.ts";
import { netDyToElevation } from "../types.ts";
import {
  airborneAt, findLandingNearFrame, meanSpeedPxOverRange, redirArcPxAtLanding,
  measurementLastFrame, median, velocityAt,
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

/**
 * Landing intensity at the gap's terminating beat: the rider's **velocity REDIRECTION
 * ARC** (`substrate.ts redirArcPxAtLanding` — `redirArc = v·Δθ`, incoming CoM speed ×
 * net heading change over the `IMPACT_WINDOW`-frame episode, "how hard the catch bends
 * the path" / "claquage"), mapped to felt [0,1] by `normImpact` (0 = soft, 1 = very
 * strong). See `Contact.impact` and the `REDIRARC`/`IMPACT` blocks in types.ts.
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
  const landing = findLandingNearFrame(det, gap.endFrame);
  if (landing === undefined) return undefined;
  const px = redirArcPxAtLanding(det, landing.frame, IMPACT_WINDOW);
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

export type BallisticAxisSuffix = {
  frame: number;
  vx: number;
  vy: number;
};

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

export function completeBallisticSpanAxesFromSummary(
  summary: BallisticAxisPrefixSummary,
  rangeEndFrame: number,
  suffix: BallisticAxisSuffix,
): AxisValues {
  const out: AxisValues = {};
  const prefixEnd = Math.max(summary.startFrame, Math.min(rangeEndFrame, Math.round(summary.prefixEndFrame)));
  const prefixFrames = Math.max(0, prefixEnd - summary.startFrame + 1);
  const suffixFrames = Math.max(0, rangeEndFrame - prefixEnd);
  const totalFrames = prefixFrames + suffixFrames;
  if (totalFrames > 0) {
    const prefixAirFrames = Math.max(0, Math.min(prefixFrames, summary.airFrames));
    out.air = (prefixAirFrames + suffixFrames) / totalFrames;
  }

  let speedSumPx = summary.speedSumPx;
  let speedFrames = Math.max(0, Math.min(prefixFrames, summary.speedFrames));
  for (let f = prefixEnd + 1; f <= rangeEndFrame; f++) {
    speedSumPx += ballisticSpeedAt(suffix, f);
    speedFrames++;
  }
  if (speedFrames > 0) out.speed = speedPxToAuthored(speedSumPx / speedFrames);

  if (rangeEndFrame > summary.startFrame && Number.isFinite(summary.v0SpeedPx)) {
    let dy = summary.dy;
    for (let f = prefixEnd + 1; f <= rangeEndFrame; f++) dy += ballisticVyAt(suffix, f);
    out.elevation = netDyToElevation(dy, Math.max(0, summary.v0SpeedPx), rangeEndFrame - summary.startFrame);
  }
  return out;
}

/**
 * Measure the same axis vector as `measureGapAxes`, but allow the requested
 * range to extend past the simulated detector window. Frames through
 * `suffix.frame` are measured from lr-core; later frames are completed by the
 * contact-free ballistic model from the suffix velocity. The caller owns the
 * "is this actually free flight?" audit (`cleanAirborneSuffix` in arc_probe);
 * dirty rows deliberately still produce the modeled output so the harness can
 * measure all-row vs clean-only error.
 */
export function measureGapAxesWithBallisticSuffix(
  det: Detection,
  gap: Gap,
  gapLines: TrackLine[],
  rangeEndFrame: number,
  suffix: BallisticAxisSuffix | null,
): AxisValues {
  const last = measurementLastFrame(det);
  if (suffix === null || rangeEndFrame <= last) {
    return measureGapAxes(det, gap, gapLines, rangeEndFrame);
  }

  const prefixEnd = Math.min(last, suffix.frame);
  const out = measureGapAxes(det, gap, gapLines, prefixEnd);
  const summary = summarizeBallisticAxisPrefix(det, gap, prefixEnd);
  const completed = summary === null ? {} : completeBallisticSpanAxesFromSummary(summary, rangeEndFrame, suffix);
  const amplitude = measureAmplitudeWithSuffix(det, gap.startFrame, rangeEndFrame, prefixEnd, suffix);
  if (completed.air !== undefined) out.air = completed.air;
  if (completed.speed !== undefined) out.speed = completed.speed;
  if (completed.elevation !== undefined) out.elevation = completed.elevation;
  if (amplitude !== undefined) out.amplitude = amplitude;
  return out;
}

function measureAmplitudeWithSuffix(
  det: Detection,
  startFrame: number,
  rangeEndFrame: number,
  prefixEnd: number,
  suffix: BallisticAxisSuffix,
): number | undefined {
  const span = rangeEndFrame - startFrame;
  if (span <= 0) return undefined;
  const total = integratedDyWithSuffix(det, startFrame, rangeEndFrame, prefixEnd, suffix);
  if (total === null) return undefined;
  let dy = 0, peak = 0;
  for (let f = startFrame + 1; f <= rangeEndFrame; f++) {
    const vy = f <= prefixEnd ? velocityAt(det, f)?.y : ballisticVyAt(suffix, f);
    if (vy === undefined) return undefined;
    dy += vy;
    const chord = ((f - startFrame) / span) * total;
    const above = chord - dy;
    if (above > peak) peak = above;
  }
  return Math.min(1, peak / CALIB.AMPLITUDE_CAP);
}

function integratedDyWithSuffix(
  det: Detection,
  startFrame: number,
  rangeEndFrame: number,
  prefixEnd: number,
  suffix: BallisticAxisSuffix,
): number | null {
  let dy = 0;
  for (let f = startFrame + 1; f <= rangeEndFrame; f++) {
    const vy = f <= prefixEnd ? velocityAt(det, f)?.y : ballisticVyAt(suffix, f);
    if (vy === undefined) return null;
    dy += vy;
  }
  return dy;
}

function ballisticVyAt(suffix: BallisticAxisSuffix, frame: number): number {
  return suffix.vy + ELEVATION.GRAVITY_PX_PER_FRAME2 * Math.max(0, frame - suffix.frame);
}

function ballisticSpeedAt(suffix: BallisticAxisSuffix, frame: number): number {
  return Math.hypot(suffix.vx, ballisticVyAt(suffix, frame));
}
