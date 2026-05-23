/**
 * Move primitives — the unit of authoring in a composed `ride()`.
 *
 * A `Move` is a record-of-functions, not a simulation. Each move's `place()`
 * adds lines to a threaded lr-core engine; its `verify()` runs after the
 * full track has been simulated, with the full Detection plus the move's
 * frame range and owned line ids.
 *
 * This is the layer the user-facing DSL composes:
 *   ride([ slide({ at: 30 }), drop({ at: 100 }), ramp({ at: 200 }), ... ])
 *
 * Geometry generation is shared with `scripts/lib/primitive.ts` via helper
 * functions in this file; the existing placeSlide/placeCurve/etc. remain
 * as standalone CLIs (they internally rebuild an engine per call), while
 * moves here append to a threaded engine that lives in `ride()`.
 */

import {
  detect,
  extractRawTrajectory,
  type Detection,
  type Vec2,
} from "./detector.ts";
import { type TrackLine } from "./primitive.ts";

// deno-lint-ignore no-explicit-any
const lrCore: any = await import("lr-core/line-rider-engine/index.js");
const LineRiderEngine = lrCore.default;
const { createLineFromJson } = lrCore;

// ────────── Types ──────────

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;
export type SledPoint = (typeof SLED_POINTS)[number];

/** What a move's `place()` is given. */
export type PlaceCtx = {
  /** lr-core engine, threaded — already has all prior moves' lines. */
  // deno-lint-ignore no-explicit-any
  engine: any;
  /** Running list of all lines placed so far across all prior moves. */
  accumulated: TrackLine[];
  /** Id the move should assign to its first new line. */
  lineIdStart: number;
  /** Spec duration in frames — useful for moves that want to clip geometry. */
  duration: number;
};

/** What a move's `place()` returns. */
export type Placement = {
  /** Lines this move added. Ids start at ctx.lineIdStart, contiguous. */
  lines: TrackLine[];
  /** Engine after this move's lines. Passed to the next move's `place()`. */
  // deno-lint-ignore no-explicit-any
  engineAfter: any;
  /** Frame the rider is "past" this move's geometry. Approximate upper-bound
   * — verify() uses the line-id attribution as the authoritative window. */
  endFrame: number;
  /** Line ids this move owns. Detector frames whose contactLineIds intersect
   * this set count as "during this move." */
  lineIds: number[];
};

export type DriftEntry = {
  metric: string;
  expected: string;
  actual: string | number;
};

export type MoveVerdict = {
  /**
   * True iff the ride survived through this move's range — i.e. terminus,
   * if any, happens at or after `range.end`. Metric shortfalls do NOT
   * make passed false; they go in `drift`.
   */
  passed: boolean;
  /** Per-metric drift entries. Empty when the move matched its contract. */
  drift: DriftEntry[];
  /** What the detector actually observed — useful for debugging / tuning. */
  observed: Record<string, number | string | boolean>;
};

export type Move = {
  /** Move kind for logging and serialization. */
  type: string;
  /** Frame the user *asked* this move to begin at. */
  atFrame: number;
  place: (ctx: PlaceCtx) => Placement;
  verify: (
    det: Detection,
    range: { start: number; end: number },
    lineIds: number[],
  ) => MoveVerdict;
  /** Optional lookahead hook — unused in v0. Declared so a two-pass composer can be added later without an API break. */
  predictExit?: (ctx: PlaceCtx) => { pos: Vec2; vel: Vec2; frame: number };
};

// ────────── Shared geometry helpers ──────────

/** Find the lowest sled-side collision point on the rider at frame `f`. */
// deno-lint-ignore no-explicit-any
function lowestSledPoint(engine: any, f: number): { sledPoint: SledPoint; pos: Vec2 } {
  const rider = engine.getRider(f);
  let bestPoint: SledPoint = "TAIL";
  let bestX = 0;
  let bestY = -Infinity;
  for (const n of SLED_POINTS) {
    const p = rider.get(n);
    if (p?.pos && p.pos.y > bestY) {
      bestY = p.pos.y;
      bestX = p.pos.x;
      bestPoint = n;
    }
  }
  return { sledPoint: bestPoint, pos: { x: bestX, y: bestY } };
}

/** Chained-segments builder with interpolated angles. Shared by slide / curve / drop. */
function buildAngleScheduleLines(p: {
  anchor: Vec2;
  startAngleDeg: number;
  endAngleDeg: number;
  segments: number;
  segmentLength: number;
  offset: number;
  lineIdStart: number;
}): TrackLine[] {
  const a0 = (p.startAngleDeg * Math.PI) / 180;
  const dx0 = Math.cos(a0);
  const dy0 = Math.sin(a0);
  // Perpendicular "below" — same convention as placeCurve/placeSlide.
  const perp0x = -dy0;
  const perp0y = dx0;
  const lead = 5;
  let curX = p.anchor.x - dx0 * lead + perp0x * p.offset;
  let curY = p.anchor.y - dy0 * lead + perp0y * p.offset;

  const lines: TrackLine[] = [];
  for (let i = 0; i < p.segments; i++) {
    const t = p.segments === 1 ? 0 : i / (p.segments - 1);
    const angleDeg = p.startAngleDeg + (p.endAngleDeg - p.startAngleDeg) * t;
    const a = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(a) * p.segmentLength;
    const dy = Math.sin(a) * p.segmentLength;
    lines.push({
      id: p.lineIdStart + i,
      type: 0,
      x1: curX,
      y1: curY,
      x2: curX + dx,
      y2: curY + dy,
      flipped: false,
      leftExtended: false,
      rightExtended: false,
    });
    curX += dx;
    curY += dy;
  }
  return lines;
}

/** Single straight line, optionally angled upward. Shared by ramp / brake. */
function buildSingleLine(p: {
  anchor: Vec2;
  angleDeg: number;
  length: number;
  offset: number;
  lineId: number;
}): TrackLine {
  const a = (p.angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const perpX = -dy;
  const perpY = dx;
  const lead = 5;
  const startX = p.anchor.x - dx * lead + perpX * p.offset;
  const startY = p.anchor.y - dy * lead + perpY * p.offset;
  return {
    id: p.lineId,
    type: 0,
    x1: startX,
    y1: startY,
    x2: startX + dx * p.length,
    y2: startY + dy * p.length,
    flipped: false,
    leftExtended: false,
    rightExtended: false,
  };
}

/** Find slide segments attributable to a set of line ids — the canonical
 * "did this move's geometry produce a slide" check. */
function ownedSlideSegments(
  det: Detection,
  range: { start: number; end: number },
  lineIds: number[],
) {
  const owned = new Set(lineIds);
  return det.summary.slideSegments.filter((s) => {
    if (s.end < range.start) return false;
    if (s.start > range.end + 30) return false; // a bit of slack past endFrame
    for (let f = s.start; f <= s.end; f++) {
      const lids = det.measurements.contactLineIds[f] ?? [];
      if (lids.some((id) => owned.has(id))) return true;
    }
    return false;
  });
}

/** True iff terminus stops the ride strictly before `range.end`. */
function catastrophicBy(det: Detection, range: { start: number; end: number }): boolean {
  if (det.terminus.reason === "endOfSpec") return false;
  return det.terminus.frame < range.end;
}

// ────────── Slide move ──────────

export type SlideOpts = {
  at: number;
  startAngleDeg?: number;
  endAngleDeg?: number;
  segments?: number;
  segmentLength?: number;
  offset?: number;
  /** Drift threshold: minimum slide duration to consider on-contract (frames). */
  minDurationFrames?: number;
};

export function slide(opts: SlideOpts): Move {
  const startAngleDeg = opts.startAngleDeg ?? 20;
  const endAngleDeg = opts.endAngleDeg ?? 3;
  const segments = opts.segments ?? 6;
  const segmentLength = opts.segmentLength ?? 25;
  const offset = opts.offset ?? 2;
  const minDurationFrames = opts.minDurationFrames ?? 20;

  return {
    type: "slide",
    atFrame: opts.at,
    place(ctx) {
      const { pos } = lowestSledPoint(ctx.engine, opts.at);
      const lines = buildAngleScheduleLines({
        anchor: pos,
        startAngleDeg,
        endAngleDeg,
        segments,
        segmentLength,
        offset,
        lineIdStart: ctx.lineIdStart,
      });
      let eng = ctx.engine;
      for (const ln of lines) eng = eng.addLine(createLineFromJson(ln));
      // endFrame estimate: approximate slide duration given the rider's
      // typical mean vx over a curve (~3-5 units/frame on default chain).
      const meanVx = 4;
      const endFrame = opts.at + Math.ceil((segments * segmentLength) / meanVx);
      return { lines, engineAfter: eng, endFrame, lineIds: lines.map((l) => l.id) };
    },
    verify(det, range, lineIds) {
      const segs = ownedSlideSegments(det, range, lineIds).sort(
        (a, b) => b.durationFrames - a.durationFrames,
      );
      const best = segs[0];
      const slideDur = best?.durationFrames ?? 0;
      let maxVx = 0;
      if (best) {
        for (let f = best.start; f <= best.end; f++) {
          const v = det.measurements.velocity[f];
          if (v && v.x > maxVx) maxVx = v.x;
        }
      }
      const drift: DriftEntry[] = [];
      if (slideDur < minDurationFrames) {
        drift.push({
          metric: "slideDurationFrames",
          expected: `>= ${minDurationFrames}`,
          actual: slideDur,
        });
      }
      return {
        passed: !catastrophicBy(det, range),
        drift,
        observed: {
          slideDurationFrames: slideDur,
          slideStart: best?.start ?? -1,
          slideEnd: best?.end ?? -1,
          maxVx,
        },
      };
    },
  };
}

// ────────── Curve move (alias of slide with different defaults) ──────────

export type CurveMoveOpts = SlideOpts;

/** A "curve" is a slide with explicit start/end angle defaults that mimic
 * test.track.json's first slide pattern (20° → 3°). Functionally identical
 * to `slide()`; exists as a named primitive for spec clarity. */
export function curve(opts: CurveMoveOpts): Move {
  return { ...slide(opts), type: "curve" };
}

// ────────── Drop move ──────────

export type DropOpts = {
  at: number;
  /** Initial slope (shallow). Should match rider's incoming flow. */
  startAngleDeg?: number;
  /** Final slope (steep — the "drop angle"). */
  endAngleDeg?: number;
  segments?: number;
  segmentLength?: number;
  offset?: number;
  /** Drift threshold: minimum slide duration the drop's geometry should sustain. */
  minDurationFrames?: number;
  /** Drift threshold: minimum vy at slide end (engine units / frame). */
  minExitVy?: number;
};

export function drop(opts: DropOpts): Move {
  const startAngleDeg = opts.startAngleDeg ?? 5;
  const endAngleDeg = opts.endAngleDeg ?? 30;
  const segments = opts.segments ?? 8;
  const segmentLength = opts.segmentLength ?? 30;
  const offset = opts.offset ?? 2;
  const minDurationFrames = opts.minDurationFrames ?? 20;
  const minExitVy = opts.minExitVy ?? 1.5;

  return {
    type: "drop",
    atFrame: opts.at,
    place(ctx) {
      const { pos } = lowestSledPoint(ctx.engine, opts.at);
      const lines = buildAngleScheduleLines({
        anchor: pos,
        startAngleDeg,
        endAngleDeg,
        segments,
        segmentLength,
        offset,
        lineIdStart: ctx.lineIdStart,
      });
      let eng = ctx.engine;
      for (const ln of lines) eng = eng.addLine(createLineFromJson(ln));
      const meanVx = 4;
      const endFrame = opts.at + Math.ceil((segments * segmentLength) / meanVx);
      return { lines, engineAfter: eng, endFrame, lineIds: lines.map((l) => l.id) };
    },
    verify(det, range, lineIds) {
      const segs = ownedSlideSegments(det, range, lineIds).sort(
        (a, b) => b.durationFrames - a.durationFrames,
      );
      const best = segs[0];
      const slideDur = best?.durationFrames ?? 0;
      let exitVy = 0;
      let maxVx = 0;
      if (best) {
        const v = det.measurements.velocity[best.end];
        if (v) exitVy = v.y;
        for (let f = best.start; f <= best.end; f++) {
          const vx = det.measurements.velocity[f]?.x ?? 0;
          if (vx > maxVx) maxVx = vx;
        }
      }
      const drift: DriftEntry[] = [];
      if (slideDur < minDurationFrames) {
        drift.push({ metric: "slideDurationFrames", expected: `>= ${minDurationFrames}`, actual: slideDur });
      }
      if (exitVy < minExitVy) {
        drift.push({ metric: "exitVy", expected: `>= ${minExitVy}`, actual: Number(exitVy.toFixed(2)) });
      }
      return {
        passed: !catastrophicBy(det, range),
        drift,
        observed: {
          slideDurationFrames: slideDur,
          exitVy: Number(exitVy.toFixed(3)),
          maxVx: Number(maxVx.toFixed(3)),
        },
      };
    },
  };
}

// ────────── Catch move ──────────
//
// Short horizontal stub. The rider lands on it for a few frames then slides
// off the edge into ballistic flight. Frame-exact landing event near T.
// Inherits the "halfWidth=8" pattern from the older placeChain code (the
// width that gave us reliable per-chained landings before we built curves).

export type CatchOpts = {
  at: number;
  /** Half-width of the stub (engine units). */
  halfWidth?: number;
  /** Drift threshold: landing must fire within ±frameTolerance of `at`. */
  frameTolerance?: number;
};

export function catch_(opts: CatchOpts): Move {
  // (Function named with trailing underscore because `catch` is reserved.
  // Spec authors call it via re-export below as `catch as catch_` then
  // `import { catch_ as catch }`, or by using `catch_` directly.)
  const halfWidth = opts.halfWidth ?? 8;
  const frameTolerance = opts.frameTolerance ?? 1;
  const lookaheadFrames = 30;

  return {
    type: "catch",
    atFrame: opts.at,
    place(ctx) {
      const { pos } = lowestSledPoint(ctx.engine, opts.at);
      // Horizontal stub centered (approximately) at the rider's lowest sled point.
      const line: TrackLine = {
        id: ctx.lineIdStart,
        type: 0,
        x1: pos.x - halfWidth,
        y1: pos.y,
        x2: pos.x + halfWidth,
        y2: pos.y,
        flipped: false,
        leftExtended: false,
        rightExtended: false,
      };
      let eng = ctx.engine;
      eng = eng.addLine(createLineFromJson(line));
      return {
        lines: [line],
        engineAfter: eng,
        endFrame: opts.at + lookaheadFrames,
        lineIds: [line.id],
      };
    },
    verify(det, range, lineIds) {
      const owned = new Set(lineIds);
      const landings = det.events.filter((e) => {
        if (e.type !== "landing") return false;
        if (e.frame < range.start - frameTolerance || e.frame > range.end) return false;
        const lids = det.measurements.contactLineIds[e.frame] ?? [];
        return lids.some((id) => owned.has(id));
      });
      const best = landings.sort((a, b) => Math.abs(a.frame - opts.at) - Math.abs(b.frame - opts.at))[0];
      const drift: DriftEntry[] = [];
      if (!best) {
        drift.push({ metric: "landing", expected: `near f=${opts.at}`, actual: "none" });
      } else if (Math.abs(best.frame - opts.at) > frameTolerance) {
        drift.push({
          metric: "landingFrame",
          expected: `f=${opts.at} ±${frameTolerance}`,
          actual: best.frame,
        });
      }
      return {
        passed: !catastrophicBy(det, range),
        drift,
        observed: { landingFrame: best?.frame ?? -1, landingCount: landings.length },
      };
    },
  };
}

// ────────── Gap move ──────────
//
// Pure verification, no geometry. Asserts the rider is airborne for ≥ a
// requested number of consecutive frames starting at `at`. Useful between
// landings to declare "this stretch should be a flight, not a slide."
//
// Failures from gap don't make the ride unsurvivable — they're drift
// entries against the prior moves' shapes. If your slide is too long and
// eats into the gap window, the gap will fail (drift = "should be airborne
// got grounded") but the ride continues.

export type GapOpts = {
  at: number;
  /** Minimum consecutive airborne frames required starting at `at`. */
  duration: number;
};

export function gap(opts: GapOpts): Move {
  return {
    type: "gap",
    atFrame: opts.at,
    place(ctx) {
      // No geometry; just claim a range. endFrame matters for catastrophe checks.
      return {
        lines: [],
        engineAfter: ctx.engine,
        endFrame: opts.at + opts.duration,
        lineIds: [], // owns no lines
      };
    },
    verify(det, range, _lineIds) {
      const end = Math.min(det.measurements.airborne.length, range.start + opts.duration);
      let airborneRun = 0;
      let firstContactInWindow = -1;
      for (let f = range.start; f < end; f++) {
        if (det.measurements.airborne[f]) {
          airborneRun++;
        } else if (firstContactInWindow === -1) {
          firstContactInWindow = f;
        }
      }
      const drift: DriftEntry[] = [];
      if (airborneRun < opts.duration) {
        drift.push({
          metric: "airborneFrames",
          expected: `>= ${opts.duration}`,
          actual: airborneRun,
        });
      }
      return {
        passed: !catastrophicBy(det, range),
        drift,
        observed: {
          airborneFrames: airborneRun,
          firstContactInWindow,
        },
      };
    },
  };
}

// ────────── Ramp move ──────────

export type RampOpts = {
  at: number;
  /** Upward slope in degrees (negative = up to the right). */
  angleDeg?: number;
  length?: number;
  offset?: number;
  /** Drift: min frames airborne in the K frames after the ramp begins. */
  minAirborneFramesAfter?: number;
};

export function ramp(opts: RampOpts): Move {
  const angleDeg = opts.angleDeg ?? -25;
  const length = opts.length ?? 40;
  const offset = opts.offset ?? 2;
  const minAirborneFramesAfter = opts.minAirborneFramesAfter ?? 8;
  const lookaheadFrames = 30;

  return {
    type: "ramp",
    atFrame: opts.at,
    place(ctx) {
      const { pos } = lowestSledPoint(ctx.engine, opts.at);
      const line = buildSingleLine({
        anchor: pos,
        angleDeg,
        length,
        offset,
        lineId: ctx.lineIdStart,
      });
      let eng = ctx.engine;
      eng = eng.addLine(createLineFromJson(line));
      const endFrame = opts.at + lookaheadFrames;
      return {
        lines: [line],
        engineAfter: eng,
        endFrame,
        lineIds: [line.id],
      };
    },
    verify(det, range, _lineIds) {
      // Look at the K frames after range.start; count airborne.
      const end = Math.min(det.measurements.airborne.length - 1, range.start + lookaheadFrames);
      let airborneAfter = 0;
      for (let f = range.start; f <= end; f++) {
        if (det.measurements.airborne[f]) airborneAfter++;
      }
      const drift: DriftEntry[] = [];
      if (airborneAfter < minAirborneFramesAfter) {
        drift.push({
          metric: "airborneFramesAfter",
          expected: `>= ${minAirborneFramesAfter}`,
          actual: airborneAfter,
        });
      }
      return {
        passed: !catastrophicBy(det, range),
        drift,
        observed: { airborneFramesAfter: airborneAfter },
      };
    },
  };
}
