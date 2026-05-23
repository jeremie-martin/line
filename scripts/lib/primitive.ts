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

// deno-lint-ignore no-explicit-any
const lrCore: any = await import("lr-core/line-rider-engine/index.js");
const LineRiderEngine = lrCore.default;
const { createLineFromJson } = lrCore;

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

  for (const T of targets) {
    // 1. Find rider's lowest sled point at frame T given lines so far.
    // deno-lint-ignore no-explicit-any
    let eng: any = new LineRiderEngine();
    for (const ln of accumulated) eng = eng.addLine(createLineFromJson(ln));
    const rider = eng.getRider(T);

    let bestPoint: SledPoint = "TAIL";
    let bestX = 0;
    let bestY = -Infinity;
    for (const name of SLED_POINTS) {
      const p = rider.get(name);
      if (p?.pos && p.pos.y > bestY) {
        bestY = p.pos.y;
        bestX = p.pos.x;
        bestPoint = name;
      }
    }

    // 2. Try a candidate at that (x, y). Bisect on y if the event lands off.
    const tryY = (lineY: number) => {
      const candidate: TrackLine = makeLine(
        accumulated.length + 1,
        bestX - halfWidth,
        lineY,
        bestX + halfWidth,
        lineY,
      );
      // deno-lint-ignore no-explicit-any
      let e2: any = new LineRiderEngine();
      for (const ln of accumulated) e2 = e2.addLine(createLineFromJson(ln));
      e2 = e2.addLine(createLineFromJson(candidate));
      const raw = extractRawTrajectory(e2, duration);
      const det = detect(raw);
      // Attribute the event to this step iff it's within ±W of T.
      const attributed = det.events
        .filter((e) => Math.abs(e.frame - T) <= W)
        .filter((e) => e.type === "landing" || e.type === "flyThrough" || e.type === "bounce");
      // Prefer landing over flyThrough/bounce if multiple fit.
      const landing = attributed.find((e) => e.type === "landing");
      const fly = attributed.find((e) => e.type === "flyThrough");
      const bounce = attributed.find((e) => e.type === "bounce");
      const chosen = landing ?? fly ?? bounce;
      return {
        candidate,
        eventFrame: chosen ? chosen.frame : null,
        eventType: (chosen?.type ?? "missing") as StepResult["eventType"],
      };
    };

    let { candidate, eventFrame, eventType } = tryY(bestY);
    let yMid = bestY;
    let iters = 0;

    if (eventFrame !== T) {
      let lo = bestY - searchRadius;
      let hi = bestY + searchRadius;
      while (iters < maxIters) {
        iters++;
        yMid = (lo + hi) / 2;
        const r = tryY(yMid);
        candidate = r.candidate;
        eventFrame = r.eventFrame;
        eventType = r.eventType;
        if (eventFrame === T) break;
        // +y is DOWN in lr-core: hit too late → line is too low → decrease y
        if (eventFrame === null || eventFrame > T) hi = yMid;
        else lo = yMid;
        if (hi - lo < 1e-4) break;
      }
    }

    accumulated.push(candidate);
    steps.push({
      targetFrame: T,
      actualFrame: eventFrame ?? -1,
      sledPoint: bestPoint,
      lineY: yMid,
      iterations: iters,
      eventType,
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

// ── Helpers ──────────────────────────────────────────────────────────────

function makeLine(id: number, x1: number, y1: number, x2: number, y2: number): TrackLine {
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
