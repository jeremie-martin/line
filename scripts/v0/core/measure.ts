/**
 * Per-axis measurement ("reduction") registry.
 *
 * Each axis collapses a gap's worth of simulation into one normalized scalar,
 * and each does it DIFFERENTLY (air/speed are means over a frame range; grain is
 * a median of line lengths; contact_style is a contact-duration ratio). Keeping
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
import { airborneAt, contactLineIdsAt, measurementLastFrame, median, speedAt, velocityAt } from "./substrate.ts";

/** Opt-in (LR_CS_ANGLE=1) angle-based contact_style measure. Read once at module
 *  load; off => the original slide-ratio measure (byte-identical). See
 *  PLATEAU_CAMPAIGN_LOG.md "contact_style re-measure". */
const CS_ANGLE = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env?.LR_CS_ANGLE === "1";
/** Author contact_style [0,1] maps onto this achievable contact-angle ceiling
 *  (degrees). Calibrated from measure_contact_style.ts (realized contact angle
 *  spans ~[0,69deg]); using the achievable ceiling makes author 1.0 reachable.
 *  Calibration-derived, not score-tuned. */
const CONTACT_ANGLE_MAX_DEG = 69;

/** Everything a per-gap reduction may need. Each reduction uses the subset it cares about. */
export type GapMeasureCtx = {
  det: Detection;
  gap: Gap;
  /** The catch lines placed for this gap (for geometry axes: grain, contact_style). */
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

/**
 * Per-contact traversed / segment length. For v0's single-Arc-per-gap this is:
 * contiguous in-contact frames after gap.endFrame × mean speed, over the catch's
 * median line length. Approximation preserved verbatim from the original.
 */
const measureContactStyleSlide: AxisReduction = (ctx) => {
  const { det, gap, gapLines } = ctx;
  const lineLens = gapLines.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
  const medianLen = median(lineLens);
  if (medianLen <= 0) return undefined;
  let contactFramesAtArc = 0;
  for (let f = gap.endFrame; f <= measurementLastFrame(det); f++) {
    if (airborneAt(det, f) === false) contactFramesAtArc++;
    else break;
  }
  const meanSpeed = (measureSpeed(ctx) ?? 0) * CALIB.SPEED_CAP || 1;
  const traversed = meanSpeed * contactFramesAtArc;
  return Math.min(1, traversed / medianLen);
};

/**
 * Angle-based contact_style: the angle between the rider's incoming velocity and
 * the catch-line tangent at contact, normalized over the achievable range. Unlike
 * the slide-ratio measure (bimodal: 99% of targets unhittable), this is continuous
 * (~50% of catches land mid-range) and directly controllable (the catch tangent is
 * steerable). Intent-preserving: steep/head-on contact -> high (sticky); glancing/
 * parallel -> low (bounce-through) — the same direction as the slide measure
 * (corr 0.85). See measure_contact_style.ts and PLATEAU_CAMPAIGN_LOG.md.
 */
const measureContactStyleAngle: AxisReduction = ({ det, gap, gapLines }) => {
  if (gapLines.length === 0) return undefined;
  const owned = new Set(gapLines.map((l) => l.id));
  // Contact frame near gap.endFrame where an owned catch line is actually touched.
  let lf = -1;
  for (const f of [gap.endFrame, gap.endFrame - 1, gap.endFrame + 1]) {
    if (contactLineIdsAt(det, f).some((id) => owned.has(id))) { lf = f; break; }
  }
  if (lf < 0) return undefined;
  const inV = velocityAt(det, lf - 1) ?? velocityAt(det, lf);
  if (inV === undefined) return undefined;
  if (Math.hypot(inV.x, inV.y) <= 1e-6) return undefined;
  const cids = contactLineIdsAt(det, lf).filter((id) => owned.has(id));
  const ln = gapLines.find((l) => l.id === cids[0]);
  if (ln === undefined) return undefined;
  const inAngle = (Math.atan2(inV.y, inV.x) * 180) / Math.PI;
  const lineAngle = (Math.atan2(ln.y2 - ln.y1, ln.x2 - ln.x1) * 180) / Math.PI;
  let d = Math.abs(inAngle - lineAngle) % 180; // undirected line vs velocity
  if (d > 90) d = 180 - d;
  return Math.max(0, Math.min(1, d / CONTACT_ANGLE_MAX_DEG));
};

const measureContactStyle: AxisReduction = CS_ANGLE ? measureContactStyleAngle : measureContactStyleSlide;

/** Median catch-line length, normalized by LINE_LENGTH_CAP. */
const measureGrain: AxisReduction = ({ gapLines }) => {
  const lineLens = gapLines.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
  return lineLens.length > 0 ? Math.min(1, median(lineLens) / CALIB.LINE_LENGTH_CAP) : undefined;
};

/** The reduction for each axis. Add a new axis = add one entry. */
export const AXIS_MEASURE: Record<AxisName, AxisReduction> = {
  air: measureAir,
  speed: measureSpeed,
  contact_style: measureContactStyle,
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
