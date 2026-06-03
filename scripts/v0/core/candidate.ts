/**
 * v0 candidate-generation core — the per-gap candidate sampler, anchor-Y
 * bisection, hard-gate evaluation, and axis measurement used by the handoff
 * compiler.
 * These functions depend only on `../../lib/*`, `../types.ts`, `../arc.ts`,
 * and `./substrate.ts`, so they carry no compiler-only state.
 */

import {
  detect, extractRawTrajectory, extractRawTrajectoryWindow, getRiderMetered,
  K_BOUNCE_LANDING, PERSISTENCE_FRAMES,
  type Detection, type DetEvent,
} from "../../lib/detector.ts";
import { arcToLines, makeSolidLine } from "../arc.ts";
import {
  hasPreTargetSledProximity,
  impactAnchorEnabled,
  impactAnchorFallbackBisectEnabled,
  recordImpactAnchorDirectAttempt,
  recordImpactAnchorDirectFailure,
  recordImpactAnchorDirectLanding,
  recordImpactAnchorFallbackAttempt,
  recordImpactAnchorFallbackLanding,
  recordImpactAnchorPreclearReject,
  recordImpactAnchorSample,
  sampleImpactAnchoredArc,
} from "../arc_placement.ts";
import {
  AXES,
  type AxisValues,
  type Arc, type TrackLine, type Gap,
  CALIB, FPS,
  hasExactlyTargetAxes,
  type CandidateSampleMode,
} from "../types.ts";
import {
  type GapFit,
  clamp,
  median,
  engineLineFromTrackLine,
  contactLineIdsAt,
} from "./substrate.ts";
import { measureGapAxes } from "./measure.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;

/** Uphill start-angle band (degrees, negative = uphill in Y-down) for brake-mode
 *  catches: the rider rides up the arc's front to bleed speed before contact. */
const BRAKE_START_ANGLE_MIN = -28;
const BRAKE_START_ANGLE_MAX = -6;
const AIR_SUPPORT_LENGTH_MIN = 100;
const AIR_SUPPORT_START_ANGLE_MIN = -8;
const AIR_SUPPORT_START_ANGLE_MAX = 14;
const AIR_SUPPORT_END_ANGLE_MIN = -6;
const AIR_SUPPORT_END_ANGLE_MAX = 10;
const AIR_SUPPORT_CURVE_BIAS_MAX = 0.35;

const AIR_POLISH_CONTINUATION_LENGTHS = [50, 300] as const;

type WindowDetection = Detection & { frameOffset?: number };

// deno-lint-ignore no-explicit-any
export function detectWindow(engine: any, startFrame: number, endFrame: number): Detection {
  const start = Math.max(0, startFrame);
  const det = detect(extractRawTrajectoryWindow(engine, start, endFrame)) as WindowDetection;
  det.frameOffset = start;
  return det;
}

export function makeAirPolishCandidates(
  lineId: number,
  source: TrackLine,
): { line: TrackLine; continuation: boolean }[] {
  const lines: { line: TrackLine; continuation: boolean }[] = [];
  const dx = source.x2 - source.x1;
  const dy = source.y2 - source.y1;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    for (const length of AIR_POLISH_CONTINUATION_LENGTHS) {
      lines.push({
        line: makeSolidLine(
          lineId,
          source.x2,
          source.y2,
          source.x2 + (dx / len) * length,
          source.y2 + (dy / len) * length,
        ),
        continuation: true,
      });
    }
  }
  return lines;
}

export function makeContinuationLines(lineId: number, source: TrackLine): TrackLine[] {
  return makeAirPolishCandidates(lineId, source)
    .filter((candidate) => candidate.continuation)
    .map((candidate) => candidate.line);
}

type TargetState = {
  sledX: number;
  sledY: number;
  velocity: { x: number; y: number };
  speed: number;
  angleDeg: number;
};

export function readTargetState(
  // deno-lint-ignore no-explicit-any
  engine: any,
  frame: number,
  fallbackX: number,
  fallbackY: number,
): TargetState {
  const rider = getRiderMetered(engine, frame);
  let sledX = fallbackX;
  let sledY = fallbackY;
  for (const name of SLED_POINTS) {
    const p = rider.get(name);
    if (p?.pos && p.pos.y > sledY) {
      sledY = p.pos.y;
      sledX = p.pos.x;
    }
  }
  const velocity = rider.velocity ?? { x: 0, y: 0 };
  const speed = Math.hypot(velocity.x, velocity.y);
  const angleDeg = (Math.atan2(velocity.y, velocity.x) * 180) / Math.PI;
  return { sledX, sledY, velocity, speed, angleDeg };
}

const CATCH_TEMPLATES = [
  { startDelta: -8,  end: 45, segments: 14, segmentLength: 34, lead: 9,  offset: 13 },
  { startDelta: -8,  end: 45, segments: 14, segmentLength: 34, lead: 9,  offset: -4 },
  { startDelta: -8,  end: 45, segments: 14, segmentLength: 34, lead: 9,  offset: 4 },
  { startDelta: -8,  end: 45, segments: 14, segmentLength: 34, lead: 9,  offset: -8 },
  { startDelta: -3,  end: 47, segments: 15, segmentLength: 33, lead: 3,  offset: -6 },
  { startDelta: -3,  end: 47, segments: 15, segmentLength: 33, lead: 3,  offset: 7 },
  { startDelta: -3,  end: 47, segments: 15, segmentLength: 33, lead: 3,  offset: 4 },
  { startDelta: -3,  end: 47, segments: 15, segmentLength: 33, lead: 3,  offset: 13 },
  { startDelta: -10, end: 2,  segments: 20, segmentLength: 30, lead: 17, offset: 13 },
  { startDelta: -10, end: 2,  segments: 20, segmentLength: 30, lead: 17, offset: 4 },
  { startDelta: -10, end: 30, segments: 16, segmentLength: 35, lead: 1,  offset: 16 },
  { startDelta: -12, end: 3,  segments: 18, segmentLength: 26, lead: 12, offset: 10 },
  { startDelta: -7,  end: 14, segments: 18, segmentLength: 46, lead: 13, offset: 13 },
  { startDelta: -5,  end: 25, segments: 12, segmentLength: 35, lead: 8,  offset: 0 },
  { startDelta: -15, end: -5, segments: 22, segmentLength: 28, lead: 16, offset: 8 },
  { startDelta: -10, end: 45, segments: 12, segmentLength: 40, lead: 12, offset: -10 },
] as const;

export function sampleArcParams(
  rng: () => number,
  refX: number,
  refY: number,
  targets: AxisValues,
  targetState: TargetState,
  attempt: number,
  gap: Gap,
  /** Sampling mode for compiler-owned extra streams. Normal mode is the
   *  deterministic K-prefix. Brake mode samples uphill-entry catches to bleed
   *  overspeed. Air-support mode samples shallow, longer catches that may keep
   *  the rider riding through low-air spans. */
  mode: CandidateSampleMode = "normal",
): Arc {
  const steepTemplateIndex = steepCatchTemplateIndex(attempt);
  if (mode === "normal" && steepTemplateIndex !== null && shouldUseSteepCatch(targetState, gap)) {
    return sampleSteepCatchArc(targetState, CATCH_TEMPLATES[steepTemplateIndex]);
  }

  const A = CALIB.ARC;
  // Wide uniform sampling within parameter bounds. Anchor X is offset around
  // the predicted rider x at landing frame; anchor Y is a STARTING value that
  // will be bisected for Contact precision.
  const lengthMin = mode === "air_support"
    ? Math.min(A.LENGTH_MAX, AIR_SUPPORT_LENGTH_MIN)
    : A.LENGTH_MIN;
  const lengthRange = A.LENGTH_MAX - lengthMin;
  const length = lengthMin + rng() * lengthRange;
  // Segments. When `grain` is targeted, derive segment count directly from
  // length / desired-median-line-length so the resulting arc is much more
  // likely to hit the grain target. Sprinkle some uniform sampling for variety.
  const segRoll = rng();
  let segments: number;
  if (targets.grain !== undefined && segRoll < 0.7) {
    // grain = median(line_length) / LINE_LENGTH_CAP. Solve for segment count.
    // Reuse the gate roll for a small, historically biased jitter so we do not
    // collapse to one shape without consuming another RNG draw.
    const targetSegLen = Math.max(3, targets.grain * CALIB.LINE_LENGTH_CAP);
    const jitter = Math.floor(segRoll * 3) - 1; // mostly -1/0, rare +1
    const ideal = Math.round(length / targetSegLen) + jitter;
    segments = Math.max(A.SEGMENTS_MIN, Math.min(A.SEGMENTS_MAX, ideal));
  } else {
    segments = A.SEGMENTS_MIN + Math.floor(segRoll * (A.SEGMENTS_MAX - A.SEGMENTS_MIN + 1));
  }

  // Brake mode samples an uphill (negative) start angle so the rider decelerates
  // riding up the arc's front before contacting near impactT (~middle); normal
  // mode uses the calibrated downhill-catch start band.
  const startAngleDeg = mode === "brake"
    ? BRAKE_START_ANGLE_MIN + rng() * (BRAKE_START_ANGLE_MAX - BRAKE_START_ANGLE_MIN)
    : mode === "air_support"
    ? AIR_SUPPORT_START_ANGLE_MIN +
      rng() * (AIR_SUPPORT_START_ANGLE_MAX - AIR_SUPPORT_START_ANGLE_MIN)
    : A.START_ANGLE_MIN_DEG + rng() * (A.START_ANGLE_MAX_DEG - A.START_ANGLE_MIN_DEG);
  const endAngleDeg = mode === "air_support"
    ? AIR_SUPPORT_END_ANGLE_MIN +
      rng() * (AIR_SUPPORT_END_ANGLE_MAX - AIR_SUPPORT_END_ANGLE_MIN)
    : A.END_ANGLE_MIN_DEG + rng() * (A.END_ANGLE_MAX_DEG - A.END_ANGLE_MIN_DEG);
  const curveBias = mode === "air_support"
    ? (rng() - 0.5) * 2 * AIR_SUPPORT_CURVE_BIAS_MAX
    : -1 + 2 * rng();

  if (impactAnchorEnabled()) {
    recordImpactAnchorSample(mode);
    return sampleImpactAnchoredArc(
      rng, targetState, length, startAngleDeg, endAngleDeg, segments, curveBias,
    );
  }

  // Wide uniform sampling within parameter bounds. Anchor X is offset around
  // the predicted rider x at landing frame; anchor Y is a STARTING value that
  // will be bisected for Contact precision.
  const anchorXOffset = A.ANCHOR_X_OFFSET_MIN
    + rng() * (A.ANCHOR_X_OFFSET_MAX - A.ANCHOR_X_OFFSET_MIN);
  const anchorYOffset = A.ANCHOR_Y_OFFSET_MIN
    + rng() * (A.ANCHOR_Y_OFFSET_MAX - A.ANCHOR_Y_OFFSET_MIN);

  return {
    anchor: { x: refX - length / 2 + anchorXOffset, y: refY + anchorYOffset },
    length,
    startAngleDeg,
    endAngleDeg,
    segments,
    curveBias,
  };
}

function shouldUseSteepCatch(targetState: { speed: number; angleDeg: number }, gap: Gap): boolean {
  const gapFrames = gap.endFrame - gap.startFrame;
  return gapFrames >= 60 && (targetState.speed >= 10 || targetState.angleDeg >= 55);
}

export function usesSteepCatchTemplateAttempt(
  targetState: { speed: number; angleDeg: number },
  gap: Gap,
  attempt: number,
): boolean {
  return steepCatchTemplateIndex(attempt) !== null && shouldUseSteepCatch(targetState, gap);
}

export function sampleArcParamsRngDraws(
  targetState: { speed: number; angleDeg: number },
  gap: Gap,
  attempt: number,
  mode: CandidateSampleMode = "normal",
): number {
  if (mode === "normal" && usesSteepCatchTemplateAttempt(targetState, gap, attempt)) return 0;
  return impactAnchorEnabled() ? 8 : 7;
}

export function steepCatchTemplateIndex(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt % 2 !== 0) return null;
  const index = attempt / 2;
  return index < CATCH_TEMPLATES.length ? index : null;
}

function sampleSteepCatchArc(
  targetState: TargetState,
  template: typeof CATCH_TEMPLATES[number],
): Arc {
  const startAngleDeg = clamp(targetState.angleDeg + template.startDelta, 20, 88);
  const endAngleDeg = clamp(template.end, -15, 55);
  const a0 = (startAngleDeg * Math.PI) / 180;
  const dx0 = Math.cos(a0);
  const dy0 = Math.sin(a0);
  const perpX = -dy0;
  const perpY = dx0;
  return {
    anchor: {
      x: targetState.sledX - dx0 * template.lead + perpX * template.offset,
      y: targetState.sledY - dy0 * template.lead + perpY * template.offset,
    },
    length: template.segments * template.segmentLength,
    startAngleDeg,
    endAngleDeg,
    segments: template.segments,
    curveBias: 0,
  };
}

export function tryCandidate(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  candArc: Arc,
  lineIdStart: number,
  allContactFrames: number[],
  axisMeasureEnd: number,
  searchTargets: AxisValues,
  useWindowDetection: boolean,
  sampleMode?: CandidateSampleMode,
): GapFit | null {
  // Impact-anchored placement (LR_ARC_PLACEMENT=impact_anchor): the arc is
  // already translated so its intended impact point lies on the predicted sled
  // position at the target frame, so we validate it DIRECTLY (no anchor-Y
  // bisection). A pre-target sled-proximity check rejects candidates likely to
  // collide before the contact. Optional bisection fallback (gated by
  // LR_IMPACT_ANCHOR_FALLBACK_BISECT=1) rescues direct failures.
  if (impactAnchorEnabled()) {
    const directLines = arcToLines(candArc, lineIdStart);
    recordImpactAnchorDirectAttempt(sampleMode);
    if (hasPreTargetSledProximity(baseEngine, gap, directLines)) {
      recordImpactAnchorPreclearReject(sampleMode);
      return null;
    }

    const direct = evaluateCandidateLines(
      baseEngine, gap, candArc, directLines, lineIdStart, axisMeasureEnd,
      allContactFrames, searchTargets, useWindowDetection,
    );
    if (direct !== null) {
      recordImpactAnchorDirectLanding(sampleMode);
      return direct;
    }
    recordImpactAnchorDirectFailure(sampleMode);

    if (!impactAnchorFallbackBisectEnabled()) return null;
    recordImpactAnchorFallbackAttempt(sampleMode);
    const fallback = tryCandidateWithBisection(
      baseEngine, gap, candArc, lineIdStart, allContactFrames, axisMeasureEnd,
      searchTargets, useWindowDetection,
    );
    if (fallback !== null) recordImpactAnchorFallbackLanding(sampleMode);
    return fallback;
  }

  return tryCandidateWithBisection(
    baseEngine, gap, candArc, lineIdStart, allContactFrames, axisMeasureEnd,
    searchTargets, useWindowDetection,
  );
}

function tryCandidateWithBisection(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  candArc: Arc,
  lineIdStart: number,
  allContactFrames: number[],
  axisMeasureEnd: number,
  searchTargets: AxisValues,
  useWindowDetection: boolean,
): GapFit | null {
  // Bisect anchor Y for Contact precision.
  const bisected = bisectAnchorY(
    baseEngine, candArc, gap.endFrame, lineIdStart, useWindowDetection,
  );
  if (bisected === null) return null;

  return evaluateCandidateLines(
    baseEngine, gap, bisected.arc, bisected.lines, lineIdStart, axisMeasureEnd,
    allContactFrames, searchTargets, useWindowDetection,
  );
}

function evaluateCandidateLines(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  arc: Arc,
  lines: TrackLine[],
  lineIdStart: number,
  axisMeasureEnd: number,
  allContactFrames: number[],
  searchTargets: AxisValues,
  useWindowDetection: boolean,
): GapFit | null {
  let best = evaluateGapFit(
    baseEngine, gap, lines, axisMeasureEnd, allContactFrames,
    searchTargets, useWindowDetection,
  );
  if (best === null) return null;

  if (shouldTryCandidateRideOut(gap, axisMeasureEnd)) {
    const rideOutId = lineIdStart + lines.length;
    for (const source of rideOutSources(lines)) {
      for (const rideOut of makeContinuationLines(rideOutId, source)) {
        const extendedLines = [...lines, rideOut];
        const extended = evaluateGapFit(
          baseEngine, gap, extendedLines, axisMeasureEnd, allContactFrames,
          searchTargets, useWindowDetection,
        );
        if (extended !== null && extended.cost + 1e-6 < best.cost) {
          best = extended;
        }
      }
    }
  }

  return { arc, lines: best.lines, achieved: best.achieved, cost: best.cost };
}

function evaluateGapFit(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  lines: TrackLine[],
  axisMeasureEnd: number,
  allContactFrames: number[],
  searchTargets: AxisValues,
  useWindowDetection: boolean,
): Pick<GapFit, "lines" | "achieved" | "cost"> | null {
  // deno-lint-ignore no-explicit-any
  let eng: any = baseEngine;
  for (const line of lines) eng = eng.addLine(engineLineFromTrackLine(line));
  const horizon = Math.max(gap.endFrame + 20, axisMeasureEnd + 20);
  const det = useWindowDetection
    ? detectWindow(eng, gap.startFrame, horizon)
    : detect(extractRawTrajectory(eng, horizon));

  // Hard gate 1: rider survived to gap.endFrame + SURVIVAL_MARGIN.
  // Surviving exactly the landing frame isn't enough — many randomly-sampled
  // catch geometries eject the rider on the next frame. Require the rider to
  // remain alive long enough to plausibly bridge into the next gap.
  const SURVIVAL_MARGIN = 16;
  const minSurvival = Math.max(gap.endFrame + SURVIVAL_MARGIN, axisMeasureEnd);
  if (det.terminus.frame < minSurvival && det.terminus.reason !== "endOfSpec") return null;

  // Hard gate 2: a landing event near gap.endFrame ±1.
  const owned = new Set(lines.map((l) => l.id));
  const landingNearTarget = det.events.some(
    (e) => e.type === "landing"
      && Math.abs(e.frame - gap.endFrame) <= 1
      && intersectsLineIds(e, det, owned),
  );
  if (!landingNearTarget) return null;

  // Hard gate 3: no off-beat landings before the next measurement boundary.
  const offBeat = countOffBeatLandings(
    det.events, gap.startFrame, axisMeasureEnd, allContactFrames,
  );
  if (offBeat > 0) return null;

  const achieved = measureGapAxes(det, gap, lines, axisMeasureEnd);
  const cost = axisCost(searchTargets, achieved);
  return { lines, achieved, cost };
}

function shouldTryCandidateRideOut(
  gap: Gap,
  axisMeasureEnd: number,
): boolean {
  return hasExactlyTargetAxes(gap.targets, ["air"])
    && axisMeasureEnd > gap.endFrame
    && (
      gap.endFrame - gap.startFrame >= 60
    );
}

function rideOutSources(lines: TrackLine[]): TrackLine[] {
  return lines.slice(Math.max(0, lines.length - 8));
}

export function axisLookaheadEndFrame(gap: Gap, allContactFrames: number[]): number {
  if (gap.targets.air === undefined) return gap.endFrame;
  const nextContact = allContactFrames.find((cf) => cf > gap.endFrame) ?? gap.endFrame;
  const postContactFrames = nextContact - gap.endFrame;
  // For long airborne gaps, the catch at gap.endFrame determines most of the
  // air/contact balance after the beat, not before it. Score those candidates
  // through the next beat so ranking can prefer a catch that keeps riding.
  if (gap.endFrame - gap.startFrame >= 60) return nextContact;
  if (postContactFrames > Math.floor(FPS / 2)) return nextContact;
  return gap.endFrame;
}

// ─────────── Bisection: adjust anchor Y so the landing fires AT gap.endFrame ───────────

/**
 * Bisect Arc.anchor.y so that, when the Arc is added to the engine, a landing
 * event attributable to the Arc's lines fires at gap.endFrame ±1.
 *
 * Direction: larger Y → line lower → rider hits LATER. (World Y increases
 * downward in the engine's coordinate frame.)
 *
 * Falls back to coarse grid search if bisection diverges (non-monotone region).
 * Returns null if neither converges.
 */
function bisectAnchorY(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  baseArc: Arc,
  targetFrame: number,
  lineIdStart: number,
  useWindowDetection: boolean,
): { arc: Arc; lines: TrackLine[] } | null {
  const SEARCH_RADIUS = 14;
  const MAX_ITERS = 18;
  const windowStart = Math.max(
    0,
    targetFrame - SEARCH_RADIUS - K_BOUNCE_LANDING - PERSISTENCE_FRAMES - 2,
  );
  const windowEnd = targetFrame + PERSISTENCE_FRAMES + 1;

  const evalAt = (y: number): { frame: number | null; arc: Arc; lines: TrackLine[] } => {
    const arc: Arc = { ...baseArc, anchor: { x: baseArc.anchor.x, y } };
    const lines = arcToLines(arc, lineIdStart);
    // deno-lint-ignore no-explicit-any
    let eng: any = baseEngine;
    for (const line of lines) eng = eng.addLine(engineLineFromTrackLine(line));
    const det = useWindowDetection
      ? detectWindow(eng, windowStart, windowEnd)
      : detect(extractRawTrajectory(eng, targetFrame + PERSISTENCE_FRAMES + 1));
    const owned = new Set(lines.map((l) => l.id));
    const landing = det.events.find(
      (e) => e.type === "landing"
        && Math.abs(e.frame - targetFrame) <= SEARCH_RADIUS
        && intersectsLineIds(e, det, owned),
    );
    return { frame: landing ? landing.frame : null, arc, lines };
  };

  let lo = baseArc.anchor.y - SEARCH_RADIUS;
  let hi = baseArc.anchor.y + SEARCH_RADIUS;
  let bestRes = evalAt(baseArc.anchor.y);
  let bestErr = bestRes.frame !== null ? Math.abs(bestRes.frame - targetFrame) : Infinity;
  if (bestErr <= 1) return { arc: bestRes.arc, lines: bestRes.lines };

  for (let i = 0; i < MAX_ITERS; i++) {
    const mid = (lo + hi) / 2;
    const r = evalAt(mid);
    if (r.frame !== null) {
      const err = Math.abs(r.frame - targetFrame);
      if (err < bestErr) { bestErr = err; bestRes = r; }
      if (err <= 1) return { arc: r.arc, lines: r.lines };
      if (r.frame > targetFrame) hi = mid; else lo = mid;
    } else {
      // No landing detected at this Y — line too far away. Move toward "closer".
      lo = mid;
    }
    if (hi - lo < 0.05) break;
  }

  // Coarse grid fallback if bisection didn't converge to ±1.
  if (bestErr > 1) {
    const STEPS = 16;
    for (let i = 0; i <= STEPS; i++) {
      const y = baseArc.anchor.y - SEARCH_RADIUS + (2 * SEARCH_RADIUS * i) / STEPS;
      const r = evalAt(y);
      if (r.frame !== null) {
        const err = Math.abs(r.frame - targetFrame);
        if (err < bestErr) { bestErr = err; bestRes = r; }
        if (err <= 1) return { arc: r.arc, lines: r.lines };
      }
    }
  }

  return bestErr <= 1 ? { arc: bestRes.arc, lines: bestRes.lines } : null;
}

// ─────────── Hard-gate helpers ───────────

function intersectsLineIds(
  event: DetEvent, det: Detection, owned: Set<number>,
): boolean {
  const lids = contactLineIdsAt(det, event.frame);
  return lids.some((id) => owned.has(id));
}

export function countOffBeatLandings(
  events: DetEvent[], startFrame: number, endFrame: number,
  contactFrames: number[],
): number {
  let n = 0;
  for (const e of events) {
    if (e.type !== "landing") continue;
    if (e.frame < startFrame || e.frame > endFrame) continue;
    const nearAnyContact = contactFrames.some((cf) => Math.abs(cf - e.frame) <= 1);
    if (!nearAnyContact) n++;
  }
  return n;
}

// ─────────── Axis measurement ───────────
// The per-axis reductions now live in `./measure.ts` (AXIS_MEASURE registry) so
// each axis's achieved value is defined in exactly one place. `measureGapAxes`
// is the verbatim equivalent of the former inline `measureAxes`.

export function axisCost(target: AxisValues, achieved: AxisValues): number {
  // Equal-axis L2 cost. The suite scores axes equally; keeping the local
  // optimizer equal-weighted avoids region-specific ranking bias while
  // preserving a smooth gradient for nearby candidate choices.
  let cost = 0;
  for (const key of AXES) {
    const t = target[key];
    const a = achieved[key];
    if (t !== undefined && a !== undefined) {
      const d = t - a;
      cost += d * d;
    }
  }
  return cost;
}
