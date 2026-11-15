/** Per-gap axis reductions, from the trajectory alone. Objectives can measure individual axes through the registry
 * below. */
import type { Detection } from "../../lib/detector.ts";
import {
  type AxisName,
  type AxisValues,
  type Gap,
  CALIB,
  IMPACT_WINDOW,
  normImpact,
  speedPxToAuthored,
} from "../types.ts";
import {
  airborneAt, contactRedirArcPxAtLanding, findAuthoredContactNearFrame, meanSpeedPxOverRange,
  measurementLastFrame, speedAt, velocityAt,
} from "./substrate.ts";

/** Everything a per-gap reduction may need. Each reduction uses the subset it cares about. */
export type GapMeasureCtx = {
  det: Detection;
  gap: Gap;
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

/**
 * Peak upward bow of the trajectory above the straight chord from the gap's
 * takeoff to its landing, normalized by `CALIB.AMPLITUDE_CAP`. This is the jump
 * arc's sagitta: how *high* the rider soared, orthogonal to `air` (which is how *long* it stayed aloft). Frames
 * below the chord contribute nothing (clamped at 0 = no upward arc).
 *
 * Vertical displacement is reconstructed by integrating `vy` from the gap start.
 * Position is available, but the integral form is the fingerprinted definition:
 * reading position directly would change the float-op sequence of a scored axis.
 * `velocity` is always present, and the integral of vy
 * is exactly the chord-relative height we need. Two passes, no allocation; this
 * runs per candidate, so it stays as cheap as `measureAir`/`measureSpeed`.
 */
export function measureAmplitudePeakPx(
  det: Detection,
  gap: Gap,
  rangeEndFrame = gap.endFrame,
): number | undefined {
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
  return peak;
}

const measureAmplitude: AxisReduction = ({ det, gap, rangeEndFrame }) => {
  const peak = measureAmplitudePeakPx(det, gap, rangeEndFrame);
  return peak === undefined ? undefined : Math.min(1, peak / CALIB.AMPLITUDE_CAP);
};

/**
 * Landing intensity at the gap's terminating beat: the rider's **redirection
 * IMPULSE** (`substrate.ts contactRedirArcPxAtLanding` — `cArc = Σ v̄·|Δθ|`, per-frame
 * CoM heading change × midpoint speed accumulated over CONTACTED frames of the
 * `IMPACT_WINDOW` episode, "how hard the ground bends the path" / "claquage"; airborne
 * bending never counts), mapped to felt [0,1] by `normImpact` (0 = perfectly smooth,
 * 1 = very strong). See `Contact.impact` and the `IMPACT_RULER`/`IMPACT` blocks in types.ts.
 *
 * GATED on `gap.targets.impact`: impact is authored per-beat, so it's worth
 * measuring ONLY where a beat requested it (the cheap span-mean axes don't scan
 * events, so it'd otherwise be hot-path waste — though redir is CoM-velocity-only
 * and cheap). The metric is CoM-only: it needs NO catch-line geometry (this makes it
 * immune to sled rotation / limb whip, which look violent but aren't felt), so
 * `gapLines` is unused here. `undefined` when not targeted / no landing event near
 * the beat — the "not defined here" convention.
 */
function measureImpact(det: Detection, gap: Gap): number | undefined {
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
}

/** Individual reductions for consumers that need only selected axes. */
export const AXIS_MEASURE: Record<AxisName, AxisReduction> = {
  air: measureAir,
  speed: measureSpeed,
  amplitude: measureAmplitude,
  impact: ({det, gap}) => measureImpact(det, gap),
};

/** Every axis of a gap, in the canonical order, undefined axes left out. The shared scan preserves each reduction's
 * arithmetic order. */
export function measureGapAxes(
  det: Detection,
  gap: Gap,
  rangeEndFrame = gap.endFrame,
): AxisValues {
  const out: AxisValues = {};

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

  const span = b - a;
  if (span > 0) {
    const v0 = velocityAt(det, a);
    if (v0 !== undefined && Number.isFinite(dyTotal)) {
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

  const impact = measureImpact(det, gap);
  if (impact !== undefined) out.impact = impact;
  return out;
}
