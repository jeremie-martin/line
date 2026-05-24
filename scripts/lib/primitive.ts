/**
 * Track-generation primitives. Step 1 = single landing. Step 2 = chained
 * landings.
 *
 * Strategy: simulation oracle. For each target frame T_i:
 *   1. Build an engine with all lines placed so far.
 *   2. At frame T_i, find the lowest sled point (max y) — that's what'll hit
 *      first when we drop a horizontal line under it.
 *   3. Place a short horizontal line at that (x, y). Width=2*halfWidth tuned
 *      so the sled is in contact for ≥3/5 frames (qualifies as a landing per
 *      the detector's persistence rule) but short enough that the rider
 *      slides off the right edge and resumes ballistic flight — making the
 *      primitive chainable.
 *   4. Bisect on the line's y until the detector reports a landing at the
 *      target frame.
 *
 * Chained landings build one cumulative track: each step's engine starts
 * with all previously-placed lines, so the rider's trajectory at T_i
 * naturally reflects the landings before it. No "restart from extracted
 * state" — lr-core's rider has internal constraint state that can't be
 * round-tripped through track JSON anyway.
 */

import { detect, extractRawTrajectory, K_BOUNCE_LANDING } from "./detector.ts";

import { LineRiderEngine, createLineFromJson } from "./_lr_engine.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;
type SledPoint = (typeof SLED_POINTS)[number];

export type TrackLine = {
  id: number;
  type: 0 | 1 | 2;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  flipped: boolean;
  leftExtended: boolean;
  rightExtended: boolean;
};

export type TrackJson = {
  label: string;
  creator: string;
  description: string;
  duration: number;
  version: string;
  audio: null;
  startPosition: { x: number; y: number };
  riders: Array<{
    startPosition: { x: number; y: number };
    startVelocity: { x: number; y: number };
    remountable: number;
  }>;
  layers: Array<{ id: number; type: number; name: string; visible: boolean; editable: boolean; folderId: number }>;
  script: string;
  lines: TrackLine[];
};

/**
 * Default short-line width for chained landings.
 * Picked from the width sweep: wide enough to give ≥3/5 contact frames after
 * landing N-1 redirected the sled, narrow enough that the rider re-enters
 * ballistic flight quickly. Survives 5+ chained landings at 30-frame spacing.
 * Tuned for default spawn velocity; revisit if start velocity is altered.
 */
const DEFAULT_CHAIN_HALFWIDTH = 8;
/** Step 1's wider line — original Step 1 acceptance was done with this. */
const DEFAULT_SINGLE_HALFWIDTH = 60;

export type StepResult = {
  targetFrame: number;
  actualFrame: number;
  sledPoint: SledPoint;
  lineY: number;
  iterations: number;
  /** What the detector classified the event as at this step's target. */
  eventType: "landing" | "bounce" | "flyThrough" | "missing";
};

export type ChainResult = {
  track: TrackJson;
  steps: StepResult[];
  /** Convenience: did every step produce a real landing? */
  allLandings: boolean;
};

export type PlaceChainOpts = {
  lineHalfWidth?: number;
  /** Padding frames after the last landing. */
  postFrames?: number;
  /** Bisection search radius (engine units of y). */
  searchRadius?: number;
  maxIters?: number;
  /** Window (frames) around T to attribute a landing to this step. */
  attributionWindow?: number;
};

// ── bisectLandingY helper ──────────────────────────────────────────────
//
// Shared by placeChain (which chains many landings) and the landAt() Move
// (which is a single bisected landing inside the standard ride() loop).
//
// Given a base engine (with whatever lines already exist) + target frame T,
// bisects on a candidate horizontal line's y position until the rider's
// resulting event fires AT T. Returns the best candidate found plus
// diagnostics. The base engine is NOT mutated.

export type BisectLandingResult = {
  /** The chosen candidate line (with the id provided in opts). */
  candidate: TrackLine;
  /** Engine state with `candidate` added. Pass to subsequent placements. */
  engineAfter: any;
  /** Frame the event actually fired at, or null if bisection couldn't get one. */
  eventFrame: number | null;
  /** "landing" | "bounce" | "flyThrough" | "missing". */
  eventType: StepResult["eventType"];
  /** Sled point the bisection anchored to. */
  sledPoint: SledPoint;
  /** Anchor x position used for the line center. */
  anchorX: number;
  /** Final line y. */
  lineY: number;
  /** Iterations spent in bisection. */
  iterations: number;
};

export type BisectLandingOpts = {
  /** Line id to give the candidate. */
  lineId: number;
  /** halfWidth in px. Default DEFAULT_CHAIN_HALFWIDTH. */
  halfWidth?: number;
  /** Simulation duration when extracting trajectories. Default T + 80. */
  duration?: number;
  /** Bisection radius around the rider's natural sled y. Default 4. */
  searchRadius?: number;
  /** Max bisection iterations. Default 20. */
  maxIters?: number;
  /** Window for attributing an event to T. Default 5. */
  attributionWindow?: number;
};

export function bisectLandingY(
  baseEngine: any,
  targetFrame: number,
  opts: BisectLandingOpts,
): BisectLandingResult {
  if (targetFrame <= K_BOUNCE_LANDING) {
    throw new Error(`targetFrame must be > K_BOUNCE_LANDING (${K_BOUNCE_LANDING}); got ${targetFrame}`);
  }
  const halfWidth = opts.halfWidth ?? DEFAULT_CHAIN_HALFWIDTH;
  const duration = opts.duration ?? targetFrame + 80;
  const searchRadius = opts.searchRadius ?? 4;
  const maxIters = opts.maxIters ?? 20;
  const W = opts.attributionWindow ?? 5;

  // 1. Find rider's lowest sled point at the target frame given baseEngine.
  const rider = baseEngine.getRider(targetFrame);
  let bestPoint: SledPoint = "TAIL";
  let anchorX = 0;
  let anchorY = -Infinity;
  for (const name of SLED_POINTS) {
    const p = rider.get(name);
    if (p?.pos && p.pos.y > anchorY) {
      anchorY = p.pos.y;
      anchorX = p.pos.x;
      bestPoint = name;
    }
  }

  // 2. Bisect on candidate line y.
  const tryY = (lineY: number) => {
    const candidate: TrackLine = makeLine(opts.lineId, anchorX - halfWidth, lineY, anchorX + halfWidth, lineY);
    const e2 = baseEngine.addLine(createLineFromJson(candidate));
    const raw = extractRawTrajectory(e2, duration);
    const det = detect(raw);
    const attributed = det.events
      .filter((e) => Math.abs(e.frame - targetFrame) <= W)
      .filter((e) => e.type === "landing" || e.type === "flyThrough" || e.type === "bounce");
    const landing = attributed.find((e) => e.type === "landing");
    const fly = attributed.find((e) => e.type === "flyThrough");
    const bounce = attributed.find((e) => e.type === "bounce");
    const chosen = landing ?? fly ?? bounce;
    return {
      candidate,
      engineAfter: e2,
      eventFrame: chosen ? chosen.frame : null,
      eventType: (chosen?.type ?? "missing") as StepResult["eventType"],
    };
  };

  let r = tryY(anchorY);
  let yMid = anchorY;
  let iters = 0;

  if (r.eventFrame !== targetFrame) {
    let lo = anchorY - searchRadius;
    let hi = anchorY + searchRadius;
    while (iters < maxIters) {
      iters++;
      yMid = (lo + hi) / 2;
      r = tryY(yMid);
      if (r.eventFrame === targetFrame) break;
      // +y is DOWN: event too late → line is too low → decrease y (move hi down)
      if (r.eventFrame === null || r.eventFrame > targetFrame) hi = yMid;
      else lo = yMid;
      if (hi - lo < 1e-4) break;
    }
  }

  return {
    candidate: r.candidate,
    engineAfter: r.engineAfter,
    eventFrame: r.eventFrame,
    eventType: r.eventType,
    sledPoint: bestPoint,
    anchorX,
    lineY: yMid,
    iterations: iters,
  };
}

// ── bisectCurveOffset helper ───────────────────────────────────────────
//
// Same idea as bisectLandingY but for a MULTI-SEGMENT SLOPED CURVE (shape
// proven to survive impact, unlike the horizontal stub which ejects the
// rider 2f after first landing). The bisection variable is `offset` — the
// perpendicular distance below the rider's predicted lowest sled point at
// targetFrame:
//   larger offset → curve lower → rider hits it LATER
//   smaller offset → curve higher → rider hits it EARLIER
//
// Foundation for the precise-landing primitive family (see precise_landings.ts).

export type CurveShape = {
  /** Starting angle of the curve, degrees (positive = downhill). */
  startAngleDeg: number;
  /** Ending angle of the curve, degrees. */
  endAngleDeg: number;
  /** Number of segments. */
  segments: number;
  /** Length of each segment, engine units. */
  segmentLength: number;
  /** Horizontal lead — places the curve start `lead` units before the
   *  rider's predicted x at targetFrame. Default 5 (mirrors placeSlideChain). */
  lead: number;
};

export const DEFAULT_CURVE_SHAPE: CurveShape = {
  startAngleDeg: 20,
  endAngleDeg: 3,
  segments: 6,
  segmentLength: 25,
  lead: 5,
};

export type BisectCurveOffsetOpts = {
  /** First line id to use. The curve consumes shape.segments contiguous ids. */
  lineIdStart: number;
  shape: CurveShape;
  /** Simulation duration. Default targetFrame + 80. */
  duration?: number;
  /** Bisection radius for offset. Default 8 px. */
  searchRadius?: number;
  /** Max bisection iterations. Default 18. */
  maxIters?: number;
};

export type BisectCurveOffsetResult = {
  lines: TrackLine[];
  // deno-lint-ignore no-explicit-any
  engineAfter: any;
  /** Frame the landing event actually fired at, or null. */
  eventFrame: number | null;
  /** "landing" | "bounce" | "flyThrough" | "missing". */
  eventType: StepResult["eventType"];
  /** Anchor x position used (rider's predicted lowest-sled x at targetFrame). */
  anchorX: number;
  /** Anchor y position used. */
  anchorY: number;
  /** Final bisected offset value. */
  offset: number;
  /** Iterations spent in bisection. */
  iterations: number;
};

export function bisectCurveOffset(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  targetFrame: number,
  opts: BisectCurveOffsetOpts,
): BisectCurveOffsetResult {
  if (targetFrame <= K_BOUNCE_LANDING) {
    throw new Error(
      `targetFrame must be > K_BOUNCE_LANDING (${K_BOUNCE_LANDING}); got ${targetFrame}`,
    );
  }
  const shape = opts.shape;
  const duration = opts.duration ?? targetFrame + 80;
  const searchRadius = opts.searchRadius ?? 8;
  const maxIters = opts.maxIters ?? 18;
  const W = 5;

  // 1. Find rider's lowest sled point at the target frame given baseEngine.
  const rider = baseEngine.getRider(targetFrame);
  let anchorX = 0;
  let anchorY = -Infinity;
  for (const name of SLED_POINTS) {
    const p = rider.get(name);
    if (p?.pos && p.pos.y > anchorY) {
      anchorY = p.pos.y;
      anchorX = p.pos.x;
    }
  }

  // 2. Build curve at a given offset (perpendicular distance below the
  //    anchor point along the curve's perpendicular).
  const a0 = (shape.startAngleDeg * Math.PI) / 180;
  const dx0 = Math.cos(a0);
  const dy0 = Math.sin(a0);
  // Perpendicular vector pointing "down-and-back" from the curve direction.
  // Same convention as placeSlideChain.
  const perp0x = -dy0;
  const perp0y = dx0;

  const tryOffset = (offset: number) => {
    let curX = anchorX - dx0 * shape.lead + perp0x * offset;
    let curY = anchorY - dy0 * shape.lead + perp0y * offset;
    const lines: TrackLine[] = [];
    let idBase = opts.lineIdStart - 1;
    for (let i = 0; i < shape.segments; i++) {
      const t = shape.segments === 1 ? 0 : i / (shape.segments - 1);
      const angleDeg = shape.startAngleDeg + (shape.endAngleDeg - shape.startAngleDeg) * t;
      const a = (angleDeg * Math.PI) / 180;
      const dx = Math.cos(a) * shape.segmentLength;
      const dy = Math.sin(a) * shape.segmentLength;
      lines.push(makeLine(++idBase, curX, curY, curX + dx, curY + dy));
      curX += dx;
      curY += dy;
    }
    // deno-lint-ignore no-explicit-any
    let eng: any = baseEngine;
    for (const ln of lines) eng = eng.addLine(createLineFromJson(ln));
    const raw = extractRawTrajectory(eng, duration);
    const det = detect(raw);
    const ownedIds = new Set(lines.map((l) => l.id));
    // Prefer landing strictly; fall back to bounce only if no landing.
    // Deliberately EXCLUDE flyThrough — curve too close, rider punches through.
    const attributed = det.events
      .filter((e) => Math.abs(e.frame - targetFrame) <= W)
      .filter((e) => e.type === "landing" || e.type === "bounce")
      .filter((e) => {
        const lids = det.measurements.contactLineIds[e.frame] ?? [];
        return lids.some((id) => ownedIds.has(id));
      });
    const landing = attributed.find((e) => e.type === "landing");
    const bounce = attributed.find((e) => e.type === "bounce");
    const chosen = landing ?? bounce;
    // Survival check: does the rider live past the landing window?
    // If terminus fires within (chosen.frame, chosen.frame + survivalWindow),
    // the catch ejected the rider — we don't want THIS offset.
    const SURVIVAL_WINDOW = 8; // frames the rider must live past the landing
    const survives = chosen !== undefined &&
      (det.terminus.reason === "endOfSpec" ||
       det.terminus.frame > chosen.frame + SURVIVAL_WINDOW);
    return {
      lines,
      engineAfter: eng,
      eventFrame: chosen ? chosen.frame : null,
      eventType: (chosen?.type ?? "missing") as StepResult["eventType"],
      survives,
    };
  };

  // 3. Bisection: monotonic — larger offset → curve lower → event LATER.
  //    Start at offset=2 (placeSlideChain's gentle default). Among SURVIVING
  //    landings, prefer the one with smallest |actualFrame - targetFrame|.
  //    A non-surviving landing is never accepted, regardless of precision —
  //    a dead rider with ±0f sync is useless.
  let offset = 2;
  let r = tryOffset(offset);
  let iters = 0;
  let bestR = r;
  let bestOffset = offset;
  // bestErr scoring: surviving landings rank above non-surviving regardless
  // of frame error. Within either bucket, smaller |error| wins.
  const scoreResult = (rr: ReturnType<typeof tryOffset>): number => {
    if (rr.eventFrame === null) return Infinity;
    const err = Math.abs(rr.eventFrame - targetFrame);
    // Surviving landings: error directly. Non-surviving: huge penalty.
    return rr.survives ? err : 1000 + err;
  };
  let bestScore = scoreResult(r);

  if (bestScore > 0) {
    let lo = 2 - searchRadius;
    let hi = 2 + searchRadius;
    while (iters < maxIters) {
      iters++;
      offset = (lo + hi) / 2;
      r = tryOffset(offset);
      const sc = scoreResult(r);
      if (sc < bestScore) { bestScore = sc; bestR = r; bestOffset = offset; }
      if (sc === 0) break;
      // Direction: event too late or missing → curve too low → decrease offset.
      // For non-surviving landings, also decrease (they're typically too aggressive).
      if (r.eventFrame === null || r.eventFrame > targetFrame) hi = offset;
      else lo = offset;
      if (hi - lo < 1e-3) break;
    }
  }
  r = bestR;
  offset = bestOffset;

  return {
    lines: r.lines,
    engineAfter: r.engineAfter,
    eventFrame: r.eventFrame,
    eventType: r.eventType,
    anchorX,
    anchorY,
    offset,
    iterations: iters,
  };
}

export function placeChain(
  targetFrames: number[],
  opts: PlaceChainOpts = {},
): ChainResult {
  const targets = [...targetFrames].sort((a, b) => a - b);
  for (const T of targets) {
    if (T <= K_BOUNCE_LANDING) {
      throw new Error(
        `each target must be > K_BOUNCE_LANDING (${K_BOUNCE_LANDING}); got ${T}`,
      );
    }
  }
  const halfWidth = opts.lineHalfWidth ?? DEFAULT_CHAIN_HALFWIDTH;
  const postFrames = opts.postFrames ?? 60;
  const searchRadius = opts.searchRadius ?? 4;
  const maxIters = opts.maxIters ?? 20;
  const W = opts.attributionWindow ?? 5;
  const duration = targets[targets.length - 1] + postFrames;

  const accumulated: TrackLine[] = [];
  const steps: StepResult[] = [];
  // deno-lint-ignore no-explicit-any
  let eng: any = new LineRiderEngine();

  for (const T of targets) {
    const r = bisectLandingY(eng, T, {
      lineId: accumulated.length + 1,
      halfWidth,
      duration,
      searchRadius,
      maxIters,
      attributionWindow: W,
    });
    accumulated.push(r.candidate);
    eng = r.engineAfter;
    steps.push({
      targetFrame: T,
      actualFrame: r.eventFrame ?? -1,
      sledPoint: r.sledPoint,
      lineY: r.lineY,
      iterations: r.iterations,
      eventType: r.eventType,
    });
  }

  return {
    track: makeTrack(accumulated, duration),
    steps,
    allLandings: steps.every((s) => s.eventType === "landing" && s.actualFrame === s.targetFrame),
  };
}

// ── Step 1 wrapper — preserves the existing API/CLI ──────────────────────

export type PlaceLandingOpts = PlaceChainOpts;

export type LandingResult = {
  track: TrackJson;
  actualFrame: number;
  targetFrame: number;
  sledPoint: SledPoint;
  lineY: number;
  iterations: number;
  eventType: StepResult["eventType"];
};

export function placeLanding(
  targetFrame: number,
  opts: PlaceLandingOpts = {},
): LandingResult {
  // Step 1's CLI defaults to the wider line for compatibility with the
  // existing dashboard validation. Chain callers should pass a small width.
  const chain = placeChain([targetFrame], {
    lineHalfWidth: opts.lineHalfWidth ?? DEFAULT_SINGLE_HALFWIDTH,
    postFrames: opts.postFrames ?? 60,
    searchRadius: opts.searchRadius,
    maxIters: opts.maxIters,
    attributionWindow: opts.attributionWindow,
  });
  const s = chain.steps[0];
  return {
    track: chain.track,
    actualFrame: s.actualFrame,
    targetFrame: s.targetFrame,
    sledPoint: s.sledPoint,
    lineY: s.lineY,
    iterations: s.iterations,
    eventType: s.eventType,
  };
}

// ── Slide primitive ─────────────────────────────────────────────────────
//
// Single-line slide: place an angled line under the rider's predicted free-
// fall position at `startFrame`. The rider falls onto it and slides along
// for some duration. Survival depends on angle (steeper = harder impact)
// and offset (zero offset can graze + eject).
//
// From the angle sweep at T=30 (default spawn velocity, vy ≈ 5.25):
//   - 0° (horizontal): rider sits there. Long contact but vx ≈ 0.5. Boring.
//   - 10-20°: 50-80 frame slides with max vx 3.5-4.8. Real horizontal motion.
//   - 30°+: progressively shorter, harder impact.
// Default angle = 15° splits the difference.
//
// This is a step toward chained-curve slides (matching what test.track.json
// actually does — a sequence of segments at progressively shallower angles).
// Single-line first; curves next.

export type SlideOpts = {
  /** Frame at which the rider should hit the slide. */
  startFrame: number;
  /** Slope of the line in degrees from horizontal (positive = down to the right). */
  angleDeg?: number;
  /** Line length in engine units. */
  length?: number;
  /**
   * Perpendicular offset below the rider's predicted lowest-sled position.
   * Zero offset can graze (no real contact); too large skips the line.
   */
  offset?: number;
  /** Padding frames after startFrame (so the dashboard has post-roll). */
  postFrames?: number;
};

export type SlideResult = {
  track: TrackJson;
  /** Where on the line the rider's first sled contact happens (best estimate). */
  startFrame: number;
  /** Detected slide segment after placement: first frame in contact. */
  slideStart: number;
  /** Last frame in contact. */
  slideEnd: number;
  /** end - start + 1. */
  slideDurationFrames: number;
  /** Max vx observed during the slide segment. */
  maxVxDuringSlide: number;
  /** Did the ride survive to spec end? */
  survived: boolean;
  terminus: { frame: number; reason: string };
  /** All lines placed by the primitive. For single-line slides, length = 1. */
  lines: TrackLine[];
};

const DEFAULT_SLIDE_ANGLE_DEG = 15;
const DEFAULT_SLIDE_LENGTH = 200;
const DEFAULT_SLIDE_OFFSET = 2;

export function placeSlide(opts: SlideOpts): SlideResult {
  const startFrame = opts.startFrame;
  const angleDeg = opts.angleDeg ?? DEFAULT_SLIDE_ANGLE_DEG;
  const length = opts.length ?? DEFAULT_SLIDE_LENGTH;
  const offset = opts.offset ?? DEFAULT_SLIDE_OFFSET;
  const postFrames = opts.postFrames ?? 60;

  if (startFrame <= K_BOUNCE_LANDING) {
    throw new Error(
      `startFrame must be > ${K_BOUNCE_LANDING} for the prior airborne phase to register; got ${startFrame}`,
    );
  }

  // 1. Find lowest sled point at startFrame in pure free-fall.
  // deno-lint-ignore no-explicit-any
  const baseEng: any = new LineRiderEngine();
  const rider = baseEng.getRider(startFrame);
  let p0x = 0;
  let p0y = -Infinity;
  for (const n of SLED_POINTS) {
    const p = rider.get(n);
    if (p?.pos && p.pos.y > p0y) {
      p0y = p.pos.y;
      p0x = p.pos.x;
    }
  }

  // 2. Build the line at the requested angle and offset.
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  // Perpendicular pointing "below" (+y direction when line is horizontal):
  // For direction (dx, dy), the perp (-dy, dx) has positive y when dy is
  // negative or when dx is positive — i.e. it points down-ish for a line
  // sloping down to the right. (Empirically verified by the angle sweep.)
  const px = -dy;
  const py = dx;
  // Start a bit behind the contact point so the rider's path enters the
  // line cleanly, not at its endpoint (where lr-core's edge case lives).
  const lead = 5;
  const startX = p0x - dx * lead + px * offset;
  const startY = p0y - dy * lead + py * offset;
  const endX = startX + dx * length;
  const endY = startY + dy * length;
  const line = makeLine(1, startX, startY, endX, endY);

  // 3. Simulate.
  const duration = startFrame + postFrames;
  const track = makeTrack([line], duration);
  // deno-lint-ignore no-explicit-any
  let eng: any = new LineRiderEngine();
  eng = eng.addLine(createLineFromJson(line));
  const raw = extractRawTrajectory(eng, duration);
  const det = detect(raw);

  // 4. Identify the slide segment caused by this line. The first segment
  // whose start is at or after startFrame - 2 is "ours."
  const slide = det.summary.slideSegments.find((s) => s.start >= startFrame - 2);
  let maxVx = 0;
  if (slide) {
    for (let i = slide.start; i <= slide.end; i++) {
      const v = det.measurements.velocity[i];
      if (v && v.x > maxVx) maxVx = v.x;
    }
  }

  return {
    track,
    startFrame,
    slideStart: slide?.start ?? -1,
    slideEnd: slide?.end ?? -1,
    slideDurationFrames: slide?.durationFrames ?? 0,
    maxVxDuringSlide: maxVx,
    survived: det.terminus.reason === "endOfSpec",
    terminus: det.terminus,
    lines: [line],
  };
}

// ── Curve primitive ─────────────────────────────────────────────────────
//
// Chained line segments at progressively interpolated angles — directly
// mimicking the pattern observed in test.track.json's first slide segment
// (angles 20° → 13° → 11° → 10° → 5° → 3°). The rider lands on the
// steepest segment, accelerates, then each subsequent segment is a touch
// shallower so velocity gradually rotates from "falling" to "running."
//
// Why chained segments instead of a true circular arc:
//  - the math is more transparent (linear interpolation of angle);
//  - it matches what real Line Rider tracks actually do;
//  - segment count and lengths are independent controls;
//  - it generalizes easily to non-linear angle schedules later (sigmoid,
//    custom curves) without changing the placement logic.

export type CurveOpts = {
  /** Frame at which the rider should hit the curve's first segment. */
  startFrame: number;
  /** Slope of the first segment in degrees from horizontal (the "catch"). */
  startAngleDeg?: number;
  /** Slope of the last segment (the "ride out"). */
  endAngleDeg?: number;
  /** Length of each segment in engine units. */
  segmentLength?: number;
  /** Number of segments. Total path length = segments * segmentLength. */
  segments?: number;
  /** Perpendicular offset below predicted trajectory at the first segment. */
  offset?: number;
  /** Padding frames after startFrame. */
  postFrames?: number;
};

const DEFAULT_CURVE_START_ANGLE = 20;
const DEFAULT_CURVE_END_ANGLE = 3;
const DEFAULT_CURVE_SEGMENTS = 8;
const DEFAULT_CURVE_SEGMENT_LEN = 30;
const DEFAULT_CURVE_OFFSET = 2;

export function placeCurve(opts: CurveOpts): SlideResult {
  const startFrame = opts.startFrame;
  const startAngleDeg = opts.startAngleDeg ?? DEFAULT_CURVE_START_ANGLE;
  const endAngleDeg = opts.endAngleDeg ?? DEFAULT_CURVE_END_ANGLE;
  const segments = opts.segments ?? DEFAULT_CURVE_SEGMENTS;
  const segmentLength = opts.segmentLength ?? DEFAULT_CURVE_SEGMENT_LEN;
  const offset = opts.offset ?? DEFAULT_CURVE_OFFSET;
  const postFrames = opts.postFrames ?? 80;

  if (startFrame <= K_BOUNCE_LANDING) {
    throw new Error(
      `startFrame must be > ${K_BOUNCE_LANDING}; got ${startFrame}`,
    );
  }
  if (segments < 1) {
    throw new Error(`segments must be ≥ 1; got ${segments}`);
  }

  // 1. Find lowest sled point at startFrame in pure free-fall.
  // deno-lint-ignore no-explicit-any
  const baseEng: any = new LineRiderEngine();
  const rider = baseEng.getRider(startFrame);
  let p0x = 0;
  let p0y = -Infinity;
  for (const n of SLED_POINTS) {
    const p = rider.get(n);
    if (p?.pos && p.pos.y > p0y) {
      p0y = p.pos.y;
      p0x = p.pos.x;
    }
  }

  // 2. Build curve as a chain of connected segments.
  // First segment's starting point: offset perpendicular to its direction +
  // a small lead-in behind the rider's predicted contact point. Same
  // convention as placeSlide.
  const a0 = (startAngleDeg * Math.PI) / 180;
  const dx0 = Math.cos(a0);
  const dy0 = Math.sin(a0);
  const perp0x = -dy0;
  const perp0y = dx0;
  const lead = 5;
  let curX = p0x - dx0 * lead + perp0x * offset;
  let curY = p0y - dy0 * lead + perp0y * offset;

  const lines: TrackLine[] = [];
  for (let i = 0; i < segments; i++) {
    // Interpolate angle. With segments=1, t=0 always (use startAngle).
    const t = segments === 1 ? 0 : i / (segments - 1);
    const angleDeg = startAngleDeg + (endAngleDeg - startAngleDeg) * t;
    const a = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(a) * segmentLength;
    const dy = Math.sin(a) * segmentLength;
    lines.push(makeLine(i + 1, curX, curY, curX + dx, curY + dy));
    curX += dx;
    curY += dy;
  }

  // 3. Simulate and measure.
  const duration = startFrame + postFrames;
  const track = makeTrack(lines, duration);
  // deno-lint-ignore no-explicit-any
  let eng: any = new LineRiderEngine();
  for (const ln of lines) eng = eng.addLine(createLineFromJson(ln));
  const raw = extractRawTrajectory(eng, duration);
  const det = detect(raw);

  const slide = det.summary.slideSegments.find((s) => s.start >= startFrame - 2);
  let maxVx = 0;
  if (slide) {
    for (let i = slide.start; i <= slide.end; i++) {
      const v = det.measurements.velocity[i];
      if (v && v.x > maxVx) maxVx = v.x;
    }
  }

  return {
    track,
    startFrame,
    slideStart: slide?.start ?? -1,
    slideEnd: slide?.end ?? -1,
    slideDurationFrames: slide?.durationFrames ?? 0,
    maxVxDuringSlide: maxVx,
    survived: det.terminus.reason === "endOfSpec",
    terminus: det.terminus,
    lines,
  };
}

// ── Drop primitive ──────────────────────────────────────────────────────
//
// Chained STEEPENING segments — the geometric inverse of placeCurve. The
// rider arrives, catches on a shallow first segment, then each subsequent
// segment angles more steeply downward, rotating the rider's velocity from
// near-horizontal toward steep-down. Net effect: rider gains downward
// momentum and accelerates along the line under gravity-along-line.
//
// Most useful AFTER a slide, when the rider already has horizontal velocity
// — the drop's first shallow segment matches that flow, then the geometry
// pivots downward. From a free-fall entry (no prior moves), the rider's vy
// is mostly killed by the first shallow segment's impact, so the "drop"
// observed is the geometry-driven re-acceleration after the catch.
//
// Under the hood: same physics + line-placement code as placeCurve, just
// with start < end (shallow → steep). Kept as a distinct entry point for
// semantic clarity and because the default angle ranges are different.

export type DropOpts = {
  startFrame: number;
  /** Slope of the first segment (shallow, should match incoming flow). */
  startAngleDeg?: number;
  /** Slope of the last segment (steep — the "drop angle"). */
  endAngleDeg?: number;
  segments?: number;
  segmentLength?: number;
  offset?: number;
  postFrames?: number;
};

const DEFAULT_DROP_START_ANGLE = 5;
const DEFAULT_DROP_END_ANGLE = 30;

export function placeDrop(opts: DropOpts): SlideResult {
  return placeCurve({
    startFrame: opts.startFrame,
    startAngleDeg: opts.startAngleDeg ?? DEFAULT_DROP_START_ANGLE,
    endAngleDeg: opts.endAngleDeg ?? DEFAULT_DROP_END_ANGLE,
    segments: opts.segments ?? DEFAULT_CURVE_SEGMENTS,
    segmentLength: opts.segmentLength ?? DEFAULT_CURVE_SEGMENT_LEN,
    offset: opts.offset ?? DEFAULT_CURVE_OFFSET,
    postFrames: opts.postFrames ?? 80,
  });
}

// ── Ramp primitive ──────────────────────────────────────────────────────
//
// Single line at an upward angle (negative slope in our convention, where
// +y is down). Catches a rider with horizontal velocity and launches them
// into a ballistic arc.
//
// Best after a slide (so the rider has vx). At default spawn velocity
// (vx = 0.4) a ramp accomplishes almost nothing — the rider needs real
// horizontal motion to take off.

export type RampOpts = {
  startFrame: number;
  /** Upward slope in degrees. Convention: negative = sloping up to the right. */
  angleDeg?: number;
  length?: number;
  offset?: number;
  postFrames?: number;
};

const DEFAULT_RAMP_ANGLE = -25;
const DEFAULT_RAMP_LENGTH = 40;

export function placeRamp(opts: RampOpts): SlideResult {
  // A ramp is geometrically a "slide" with a negative angle. The existing
  // placeSlide already handles arbitrary angle signs — the perpendicular
  // offset direction works out as long as we pass a small positive offset.
  return placeSlide({
    startFrame: opts.startFrame,
    angleDeg: opts.angleDeg ?? DEFAULT_RAMP_ANGLE,
    length: opts.length ?? DEFAULT_RAMP_LENGTH,
    offset: opts.offset ?? 2,
    postFrames: opts.postFrames ?? 80,
  });
}

// ── Slide chain ─────────────────────────────────────────────────────────
//
// Multi-curve chain. Each curve is placed under the rider's predicted
// position at its target start frame, given the cumulative track-so-far.
// Each curve is shaped the same way (steep catch → shallow exit); the
// rider's incoming velocity differs from one curve to the next (steep on
// curve 1, less steep on later curves because the prior curve gave them
// horizontal momentum), but the curve geometry catches it regardless —
// shallow lines (~15-20°) kill vy without much dependence on incoming
// angle, which is why this works without per-step parameter tuning.
//
// Spec semantics: each Ti is a target *slide start frame*. The rider lands
// on curve i near Ti; the slide lasts ~segments*segmentLength / |v| frames;
// the rider then takes off again and (hopefully) hits curve i+1 near Ti+1.
// If Ti+1 is too soon, the rider hasn't fallen back far enough to land
// cleanly on curve i+1. The minimum spacing is bounded by curve length.

export type SlideChainOpts = {
  /** Slope of each curve's first segment. */
  startAngleDeg?: number;
  /** Slope of each curve's last segment. */
  endAngleDeg?: number;
  /** Segments per curve. */
  segments?: number;
  /** Length of each segment in engine units. */
  segmentLength?: number;
  /** Perpendicular offset below predicted trajectory at each curve. */
  offset?: number;
  /** Padding frames after the last target. */
  postFrames?: number;
};

export type SlideChainStep = {
  targetFrame: number;
  /** Sled point lowest at the moment of placement. */
  sledPoint: SledPoint;
  /** Rider's velocity angle (deg from horizontal) when hitting the curve. */
  incomingAngleDeg: number;
  /** Rider's |velocity| when hitting the curve. */
  incomingSpeed: number;
  /** Where the curve was placed (start of first segment, after offset). */
  placedAt: { x: number; y: number };
  /** Slide segment attributed to this curve, after full-track simulation. */
  slideStart: number;
  slideEnd: number;
  slideDurationFrames: number;
};

export type SlideChainResult = {
  track: TrackJson;
  steps: SlideChainStep[];
  survived: boolean;
  terminus: { frame: number; reason: string };
  /** Convenience: total contact frames over spec duration. */
  contactFractionSpec: number;
  longestSlide: number;
};

const DEFAULT_CHAIN_CURVE_OPTS: Required<Omit<SlideChainOpts, "postFrames">> = {
  startAngleDeg: 20,
  endAngleDeg: 3,
  segments: 6,
  segmentLength: 25,
  offset: 2,
};

export function placeSlideChain(
  targetFrames: number[],
  opts: SlideChainOpts = {},
): SlideChainResult {
  if (targetFrames.length === 0) {
    throw new Error("placeSlideChain: at least one target frame required");
  }
  const targets = [...targetFrames].sort((a, b) => a - b);
  for (const T of targets) {
    if (T <= K_BOUNCE_LANDING) {
      throw new Error(`each target must be > ${K_BOUNCE_LANDING}; got ${T}`);
    }
  }
  // Explicit fallback per-field, since spread-merging with `undefined`
  // values from optional CLI fields would clobber the defaults.
  const o = {
    startAngleDeg: opts.startAngleDeg ?? DEFAULT_CHAIN_CURVE_OPTS.startAngleDeg,
    endAngleDeg: opts.endAngleDeg ?? DEFAULT_CHAIN_CURVE_OPTS.endAngleDeg,
    segments: opts.segments ?? DEFAULT_CHAIN_CURVE_OPTS.segments,
    segmentLength: opts.segmentLength ?? DEFAULT_CHAIN_CURVE_OPTS.segmentLength,
    offset: opts.offset ?? DEFAULT_CHAIN_CURVE_OPTS.offset,
  };
  const postFrames = opts.postFrames ?? 60;
  const duration = targets[targets.length - 1] + postFrames;

  const accumulated: TrackLine[] = [];
  const stepInfo: Array<Omit<SlideChainStep, "slideStart" | "slideEnd" | "slideDurationFrames">> = [];

  for (const T of targets) {
    // Build engine with the lines so far so the rider's state at T reflects
    // every prior curve's deflection.
    // deno-lint-ignore no-explicit-any
    let eng: any = new LineRiderEngine();
    for (const ln of accumulated) eng = eng.addLine(createLineFromJson(ln));

    const rider = eng.getRider(T);
    let p0x = 0;
    let p0y = -Infinity;
    let bestPoint: SledPoint = "TAIL";
    for (const n of SLED_POINTS) {
      const p = rider.get(n);
      if (p?.pos && p.pos.y > p0y) {
        p0y = p.pos.y;
        p0x = p.pos.x;
        bestPoint = n;
      }
    }
    const v = rider.velocity;
    const incomingAngleDeg = (Math.atan2(v.y, v.x) * 180) / Math.PI;
    const incomingSpeed = Math.hypot(v.x, v.y);

    // Build a curve at this point with fixed shape.
    const a0 = (o.startAngleDeg * Math.PI) / 180;
    const dx0 = Math.cos(a0);
    const dy0 = Math.sin(a0);
    const perp0x = -dy0;
    const perp0y = dx0;
    const lead = 5;
    let curX = p0x - dx0 * lead + perp0x * o.offset;
    let curY = p0y - dy0 * lead + perp0y * o.offset;
    const placedAt = { x: curX, y: curY };

    let idBase = accumulated.length;
    for (let i = 0; i < o.segments; i++) {
      const t = o.segments === 1 ? 0 : i / (o.segments - 1);
      const angleDeg = o.startAngleDeg + (o.endAngleDeg - o.startAngleDeg) * t;
      const a = (angleDeg * Math.PI) / 180;
      const dx = Math.cos(a) * o.segmentLength;
      const dy = Math.sin(a) * o.segmentLength;
      accumulated.push(makeLine(++idBase, curX, curY, curX + dx, curY + dy));
      curX += dx;
      curY += dy;
    }

    stepInfo.push({
      targetFrame: T,
      sledPoint: bestPoint,
      incomingAngleDeg,
      incomingSpeed,
      placedAt,
    });
  }

  // Simulate full chain track once to extract per-step slide segments.
  // deno-lint-ignore no-explicit-any
  let fullEng: any = new LineRiderEngine();
  for (const ln of accumulated) fullEng = fullEng.addLine(createLineFromJson(ln));
  const raw = extractRawTrajectory(fullEng, duration);
  const det = detect(raw);

  // Attribute slide segments to steps: a slide whose start frame is closest
  // to a target frame (within reason) belongs to that step.
  const W = 10;
  const steps: SlideChainStep[] = stepInfo.map((info) => {
    const candidates = det.summary.slideSegments
      .filter((s) => s.start >= info.targetFrame - 2 && s.start <= info.targetFrame + W)
      // longest one wins (we want the "real" slide, not a 1-frame graze)
      .sort((a, b) => b.durationFrames - a.durationFrames);
    const best = candidates[0];
    return {
      ...info,
      slideStart: best?.start ?? -1,
      slideEnd: best?.end ?? -1,
      slideDurationFrames: best?.durationFrames ?? 0,
    };
  });

  const longestSlide = det.summary.slideSegments.reduce(
    (mx, s) => Math.max(mx, s.durationFrames),
    0,
  );

  return {
    track: makeTrack(accumulated, duration),
    steps,
    survived: det.terminus.reason === "endOfSpec",
    terminus: det.terminus,
    contactFractionSpec: det.summary.contactFractionSpec,
    longestSlide,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

export function makeLine(id: number, x1: number, y1: number, x2: number, y2: number): TrackLine {
  return {
    id,
    type: 0,
    x1,
    y1,
    x2,
    y2,
    flipped: false,
    leftExtended: false,
    rightExtended: false,
  };
}

function makeTrack(lines: TrackLine[], duration: number): TrackJson {
  return {
    label: "auto-chain",
    creator: "line",
    description: "Generated by scripts/lib/primitive.ts:placeChain()",
    duration,
    version: "6.2",
    audio: null,
    startPosition: { x: 0, y: 0 },
    riders: [
      { startPosition: { x: 0, y: 0 }, startVelocity: { x: 0.4, y: 0 }, remountable: 1 },
    ],
    layers: [
      { id: 0, type: 0, name: "Base Layer", visible: true, editable: true, folderId: -1 },
    ],
    script: "",
    lines,
  };
}
