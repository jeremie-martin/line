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
  airborneAt, contactLineIdsAt, findLandingNearFrame, meanSpeedPxOverRange,
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
 * Landing intensity at the gap's terminating beat: the **normal impact speed** —
 * the magnitude of the rider's velocity component perpendicular to the surface it
 * lands on, at contact (= the speed the surface kills/redirects; physically the
 * impulse) — normalized by `CALIB.IMPACT_CAP`. See `Contact.impact` and the
 * `IMPACT` block in types.ts for the semantics.
 *
 * GATED on `gap.targets.impact`: impact is authored per-beat and report-only in v1,
 * so it's worth measuring ONLY where a beat actually requested it. This keeps the
 * reduction zero-cost on every impact-free spec (the common case) — unlike the
 * cheap span-mean axes, this one scans events + line geometry per candidate, so it
 * would otherwise be pure waste in the search hot path.
 *
 * Measured from the INCOMING velocity, not the velocity change: lr-core's collision
 * is a soft spring that bleeds the normal component over several frames, so a
 * Δv-at-contact reads gravity, not the landing. We take the velocity one frame
 * BEFORE the landing (the speed the surface is about to kill), and the surface
 * tangent from the PLACED catch line (exact and in-window, vs. a fragile post-
 * contact velocity-settle direction):
 *   1. find the landing event for this beat (`findLandingNearFrame`, the shared ±1
 *      rule `buildDriftReport`'s contact match also uses);
 *   2. intersect that frame's `contactLineIds` with this gap's placed lines to
 *      identify the landing surface, and average their unit tangents (robust to a
 *      multi-segment catch — the candidate gate guarantees ≥1 owned line fired);
 *   3. project the pre-impact velocity onto the surface normal.
 * Any missing piece (no target, no landing, no usable fired-line geometry, no
 * velocity) ⇒ `undefined`, the same "not defined for this gap" convention every
 * reduction uses. Velocity-only, allocation-light.
 */
const measureImpact: AxisReduction = ({ det, gap, gapLines }) => {
  if (gap.targets.impact === undefined || gapLines.length === 0) return undefined;

  const landing = findLandingNearFrame(det, gap.endFrame);
  if (landing === undefined) return undefined;

  // Surface tangent from the placed catch line(s) the sled fired at the landing.
  const owned = new Set(gapLines.map((l) => l.id));
  const firedOwned = new Set(contactLineIdsAt(det, landing.frame).filter((id) => owned.has(id)));
  let tx = 0, ty = 0;
  for (const line of gapLines) {
    if (!firedOwned.has(line.id)) continue;
    const dx = line.x2 - line.x1, dy = line.y2 - line.y1;
    const len = Math.hypot(dx, dy);
    if (len > 1e-9) { tx += dx / len; ty += dy / len; }
  }
  const tlen = Math.hypot(tx, ty);
  if (tlen <= 1e-9) return undefined; // no usable fired-line geometry — don't guess
  tx /= tlen; ty /= tlen;

  // Pre-impact velocity (frame before the landing); fall back to the landing frame
  // only if that's out of range.
  const vIn = velocityAt(det, landing.frame - 1) ?? velocityAt(det, landing.frame);
  if (vIn === undefined) return undefined;

  // Component of vIn perpendicular to the surface tangent = |v × t̂| = the speed
  // the surface kills. n̂ = (-t̂.y, t̂.x); |v · n̂| = |t̂.x·v.y − t̂.y·v.x|.
  const normalPx = Math.abs(tx * vIn.y - ty * vIn.x);
  return Math.min(1, normalPx / CALIB.IMPACT_CAP);
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
