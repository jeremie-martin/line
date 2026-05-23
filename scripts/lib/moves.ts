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
import { arcLines } from "./arcLines.ts";
import {
  readIncoming,
  adaptSlide,
  adaptDrop,
  adaptGlide,
  adaptWave,
  adaptSigmoid,
  adaptRamp,
  adaptCatch,
  adaptBrake,
  adaptKicker,
  adaptBounceStrip,
  adaptHalfPipe,
  adaptLoop,
  adaptJump,
  type ResolvedSlideParams,
  type ResolvedDropParams,
  type ResolvedGlideParams,
  type ResolvedWaveParams,
  type ResolvedSigmoidParams,
  type ResolvedRampParams,
  type ResolvedCatchParams,
  type ResolvedBrakeParams,
  type ResolvedKickerParams,
  type ResolvedBounceStripParams,
  type ResolvedHalfPipeParams,
  type ResolvedLoopParams,
  type ResolvedJumpParams,
  type SlideUserParams,
  type DropUserParams,
  type GlideUserParams,
  type WaveUserParams,
  type SigmoidUserParams,
  type RampUserParams,
  type CatchUserParams,
  type BrakeUserParams,
  type KickerUserParams,
  type BounceStripUserParams,
  type HalfPipeUserParams,
  type LoopUserParams,
  type JumpUserParams,
} from "./adapt.ts";

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

/**
 * Chained-segments builder with an explicit per-segment angle list.
 * Used by slide (linear interp), wave (alternating), sigmoid (S-curve), etc.
 * Each segment ends where the next begins — the chain is continuous.
 */
function buildSegmentsFromAngles(p: {
  anchor: Vec2;
  /** Per-segment slope in degrees from horizontal. */
  angles: number[];
  segmentLength: number;
  offset: number;
  lineIdStart: number;
}): TrackLine[] {
  const a0 = (p.angles[0] * Math.PI) / 180;
  const dx0 = Math.cos(a0);
  const dy0 = Math.sin(a0);
  // Perpendicular "below" — same convention as placeCurve/placeSlide.
  const perp0x = -dy0;
  const perp0y = dx0;
  const lead = 5;
  let curX = p.anchor.x - dx0 * lead + perp0x * p.offset;
  let curY = p.anchor.y - dy0 * lead + perp0y * p.offset;

  const lines: TrackLine[] = [];
  for (let i = 0; i < p.angles.length; i++) {
    const a = (p.angles[i] * Math.PI) / 180;
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

/** Linear angle interpolation — slide / drop / curve schedule. */
function linearAngles(startDeg: number, endDeg: number, segments: number): number[] {
  if (segments < 1) return [];
  if (segments === 1) return [startDeg];
  const out: number[] = [];
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1);
    out.push(startDeg + (endDeg - startDeg) * t);
  }
  return out;
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

export type SlideOpts = SlideUserParams & { at: number };

export function slide(opts: SlideOpts): Move {
  let resolved: ResolvedSlideParams | null = null;

  return {
    type: "slide",
    atFrame: opts.at,
    place(ctx) {
      const rider = readIncoming(ctx.engine, opts.at);
      resolved = adaptSlide(opts, rider);
      const { startAngleDeg, endAngleDeg, segments, segmentLength, offset } = resolved;
      const { pos } = lowestSledPoint(ctx.engine, opts.at);
      const lines = buildSegmentsFromAngles({
        anchor: pos,
        angles: linearAngles(startAngleDeg, endAngleDeg, segments),
        segmentLength,
        offset,
        lineIdStart: ctx.lineIdStart,
      });
      let eng = ctx.engine;
      for (const ln of lines) eng = eng.addLine(createLineFromJson(ln));
      const meanVx = Math.max(2, rider.speed * 0.7);
      const endFrame = opts.at + Math.ceil((segments * segmentLength) / meanVx);
      return { lines, engineAfter: eng, endFrame, lineIds: lines.map((l) => l.id) };
    },
    verify(det, range, lineIds) {
      const { minDurationFrames } = resolved!;
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
          maxVx: Number(maxVx.toFixed(2)),
          startAngleUsed: resolved!.startAngleDeg,
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

export type DropOpts = DropUserParams & { at: number };

export function drop(opts: DropOpts): Move {
  let resolved: ResolvedDropParams | null = null;

  return {
    type: "drop",
    atFrame: opts.at,
    place(ctx) {
      const rider = readIncoming(ctx.engine, opts.at);
      resolved = adaptDrop(opts, rider);
      const { startAngleDeg, endAngleDeg, segments, segmentLength, offset } = resolved;
      const { pos } = lowestSledPoint(ctx.engine, opts.at);
      const lines = buildSegmentsFromAngles({
        anchor: pos,
        angles: linearAngles(startAngleDeg, endAngleDeg, segments),
        segmentLength,
        offset,
        lineIdStart: ctx.lineIdStart,
      });
      let eng = ctx.engine;
      for (const ln of lines) eng = eng.addLine(createLineFromJson(ln));
      const meanVx = Math.max(2, rider.speed * 0.7);
      const endFrame = opts.at + Math.ceil((segments * segmentLength) / meanVx);
      return { lines, engineAfter: eng, endFrame, lineIds: lines.map((l) => l.id) };
    },
    verify(det, range, lineIds) {
      const { minDurationFrames, minExitVy } = resolved!;
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

export type CatchOpts = CatchUserParams & { at: number };

export function catch_(opts: CatchOpts): Move {
  let resolved: ResolvedCatchParams | null = null;
  const lookaheadFrames = 30;

  return {
    type: "catch",
    atFrame: opts.at,
    place(ctx) {
      const rider = readIncoming(ctx.engine, opts.at);
      resolved = adaptCatch(opts, rider);
      const { halfWidth } = resolved;
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
      const { frameTolerance } = resolved!;
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

export type RampOpts = RampUserParams & { at: number };

export function ramp(opts: RampOpts): Move {
  let resolved: ResolvedRampParams | null = null;
  const lookaheadFrames = 30;

  return {
    type: "ramp",
    atFrame: opts.at,
    place(ctx) {
      const rider = readIncoming(ctx.engine, opts.at);
      resolved = adaptRamp(opts, rider);
      const { angleDeg, length, offset } = resolved;
      const { pos } = lowestSledPoint(ctx.engine, opts.at);
      const line = buildSingleLine({ anchor: pos, angleDeg, length, offset, lineId: ctx.lineIdStart });
      const eng = ctx.engine.addLine(createLineFromJson(line));
      return { lines: [line], engineAfter: eng, endFrame: opts.at + lookaheadFrames, lineIds: [line.id] };
    },
    verify(det, range, _lineIds) {
      const { minAirborneFramesAfter, insufficientVx } = resolved!;
      const end = Math.min(det.measurements.airborne.length - 1, range.start + lookaheadFrames);
      let airborneAfter = 0;
      for (let f = range.start; f <= end; f++) {
        if (det.measurements.airborne[f]) airborneAfter++;
      }
      const drift: DriftEntry[] = [];
      if (insufficientVx) {
        drift.push({ metric: "incomingVx", expected: ">= 1.5", actual: "below threshold" });
      }
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

// ────────── Glide move ──────────
//
// Long shallow chained segments at near-constant angle. The rider lands
// and rides along, slowly losing some vy to friction. Useful for filling
// space between events (low-drama sustained sliding).

export type GlideOpts = GlideUserParams & { at: number };

export function glide(opts: GlideOpts): Move {
  let resolved: ResolvedGlideParams | null = null;
  return {
    type: "glide",
    atFrame: opts.at,
    place(ctx) {
      const rider = readIncoming(ctx.engine, opts.at);
      resolved = adaptGlide(opts, rider);
      const { angleDeg, segments, segmentLength, offset } = resolved;
      const { pos } = lowestSledPoint(ctx.engine, opts.at);
      const lines = buildSegmentsFromAngles({
        anchor: pos,
        angles: new Array(segments).fill(angleDeg),
        segmentLength,
        offset,
        lineIdStart: ctx.lineIdStart,
      });
      let eng = ctx.engine;
      for (const ln of lines) eng = eng.addLine(createLineFromJson(ln));
      const meanVx = Math.max(2, rider.speed * 0.7);
      const endFrame = opts.at + Math.ceil((segments * segmentLength) / meanVx);
      return { lines, engineAfter: eng, endFrame, lineIds: lines.map((l) => l.id) };
    },
    verify(det, range, lineIds) {
      const { minDurationFrames } = resolved!;
      const segs = ownedSlideSegments(det, range, lineIds).sort(
        (a, b) => b.durationFrames - a.durationFrames,
      );
      const best = segs[0];
      const dur = best?.durationFrames ?? 0;
      const drift: DriftEntry[] = [];
      if (dur < minDurationFrames) {
        drift.push({ metric: "slideDurationFrames", expected: `>= ${minDurationFrames}`, actual: dur });
      }
      // Compute vy variance during the slide — low = smooth glide.
      let vyVarDur = 0;
      let maxVx = 0;
      if (best) {
        const vys: number[] = [];
        for (let f = best.start; f <= best.end; f++) {
          const v = det.measurements.velocity[f];
          if (v) { vys.push(v.y); if (v.x > maxVx) maxVx = v.x; }
        }
        if (vys.length > 1) {
          const mean = vys.reduce((a, b) => a + b, 0) / vys.length;
          const variance = vys.reduce((s, v) => s + (v - mean) ** 2, 0) / vys.length;
          vyVarDur = Math.sqrt(variance);
        }
      }
      return {
        passed: !catastrophicBy(det, range),
        drift,
        observed: { slideDurationFrames: dur, vyStdDev: Number(vyVarDur.toFixed(3)), maxVx: Number(maxVx.toFixed(3)) },
      };
    },
  };
}

// ────────── Wave move ──────────
//
// Alternating-angle segments — the rider undulates along a wavy path.
// Each segment swings the slope by ±peakAngleDeg around a baseline.
// Visual texture for an otherwise-monotonic slide stretch.

export type WaveOpts = WaveUserParams & { at: number };

export function wave(opts: WaveOpts): Move {
  let resolved: ResolvedWaveParams | null = null;
  return {
    type: "wave",
    atFrame: opts.at,
    place(ctx) {
      const rider = readIncoming(ctx.engine, opts.at);
      resolved = adaptWave(opts, rider);
      const { segments, segmentLength, peakAngleDeg, baselineAngleDeg, offset } = resolved;
      const { pos } = lowestSledPoint(ctx.engine, opts.at);
      const angles: number[] = [];
      for (let i = 0; i < segments; i++) {
        angles.push(baselineAngleDeg + (i % 2 === 0 ? -peakAngleDeg : peakAngleDeg));
      }
      const lines = buildSegmentsFromAngles({
        anchor: pos,
        angles,
        segmentLength,
        offset,
        lineIdStart: ctx.lineIdStart,
      });
      let eng = ctx.engine;
      for (const ln of lines) eng = eng.addLine(createLineFromJson(ln));
      const meanVx = Math.max(2, rider.speed * 0.7);
      const endFrame = opts.at + Math.ceil((segments * segmentLength) / meanVx);
      return { lines, engineAfter: eng, endFrame, lineIds: lines.map((l) => l.id) };
    },
    verify(det, range, lineIds) {
      const { minDurationFrames } = resolved!;
      const segs = ownedSlideSegments(det, range, lineIds);
      const totalContact = segs.reduce((s, x) => s + x.durationFrames, 0);
      // Count sign-changes in vy across the wave's frames — a proxy for "undulating."
      let signChanges = 0;
      let prevSign = 0;
      const rangeEnd = Math.min(det.measurements.velocity.length - 1, range.end);
      for (let f = range.start; f <= rangeEnd; f++) {
        const v = det.measurements.velocity[f];
        if (!v) continue;
        const sign = v.y > 0 ? 1 : v.y < 0 ? -1 : 0;
        if (sign !== 0 && prevSign !== 0 && sign !== prevSign) signChanges++;
        if (sign !== 0) prevSign = sign;
      }
      const drift: DriftEntry[] = [];
      if (totalContact < minDurationFrames) {
        drift.push({ metric: "totalContactFrames", expected: `>= ${minDurationFrames}`, actual: totalContact });
      }
      return {
        passed: !catastrophicBy(det, range),
        drift,
        observed: {
          totalContactFrames: totalContact,
          slideSegmentCount: segs.length,
          vySignChanges: signChanges,
        },
      };
    },
  };
}

// ────────── Sigmoid move ──────────
//
// S-curve angle schedule: flat → steep → flat. Concentrates angle change
// in the middle of the run, giving a controlled "speed burst" sandwich
// between calm in/out. The angle interpolates via a logistic between
// startAngle and peakAngle and back.

export type SigmoidOpts = SigmoidUserParams & { at: number };

export function sigmoid(opts: SigmoidOpts): Move {
  let resolved: ResolvedSigmoidParams | null = null;
  return {
    type: "sigmoid",
    atFrame: opts.at,
    place(ctx) {
      const rider = readIncoming(ctx.engine, opts.at);
      resolved = adaptSigmoid(opts, rider);
      const { startAngleDeg, peakAngleDeg, segments, segmentLength, steepness, offset } = resolved;
      const { pos } = lowestSledPoint(ctx.engine, opts.at);
      const angles: number[] = [];
      for (let i = 0; i < segments; i++) {
        const u = segments === 1 ? 0.5 : i / (segments - 1);
        const t = Math.tanh(steepness * (u - 0.25)) - Math.tanh(steepness * (u - 0.75));
        const w = t / 2;
        angles.push(startAngleDeg + (peakAngleDeg - startAngleDeg) * w);
      }
      const lines = buildSegmentsFromAngles({
        anchor: pos,
        angles,
        segmentLength,
        offset,
        lineIdStart: ctx.lineIdStart,
      });
      let eng = ctx.engine;
      for (const ln of lines) eng = eng.addLine(createLineFromJson(ln));
      const meanVx = Math.max(2, rider.speed * 0.7);
      const endFrame = opts.at + Math.ceil((segments * segmentLength) / meanVx);
      return { lines, engineAfter: eng, endFrame, lineIds: lines.map((l) => l.id) };
    },
    verify(det, range, lineIds) {
      const { minDurationFrames } = resolved!;
      const segs = ownedSlideSegments(det, range, lineIds).sort(
        (a, b) => b.durationFrames - a.durationFrames,
      );
      const best = segs[0];
      const dur = best?.durationFrames ?? 0;
      // Verify max vx in the middle third of the slide exceeds vx at start
      // and end — this is what makes it a sigmoid (speed burst).
      let entryVx = 0;
      let exitVx = 0;
      let midMaxVx = 0;
      if (best) {
        const len = best.end - best.start + 1;
        const third = Math.floor(len / 3);
        const v0 = det.measurements.velocity[best.start];
        const v1 = det.measurements.velocity[best.end];
        entryVx = v0?.x ?? 0;
        exitVx = v1?.x ?? 0;
        for (let f = best.start + third; f <= best.end - third; f++) {
          const v = det.measurements.velocity[f];
          if (v && v.x > midMaxVx) midMaxVx = v.x;
        }
      }
      const drift: DriftEntry[] = [];
      if (dur < minDurationFrames) {
        drift.push({ metric: "slideDurationFrames", expected: `>= ${minDurationFrames}`, actual: dur });
      }
      const surge = midMaxVx - Math.max(entryVx, exitVx);
      if (surge <= 0 && dur > 0) {
        drift.push({ metric: "speedSurge", expected: "midMaxVx > max(entry,exit)", actual: Number(surge.toFixed(2)) });
      }
      return {
        passed: !catastrophicBy(det, range),
        drift,
        observed: {
          slideDurationFrames: dur,
          entryVx: Number(entryVx.toFixed(2)),
          midMaxVx: Number(midMaxVx.toFixed(2)),
          exitVx: Number(exitVx.toFixed(2)),
        },
      };
    },
  };
}

// ────────── Brake move ──────────
//
// Steep uphill segment. Decelerates the rider. PROBLEM.md treats speed
// as a primary axis but we had no decelerator until now.

export type BrakeOpts = BrakeUserParams & { at: number };

export function brake(opts: BrakeOpts): Move {
  let resolved: ResolvedBrakeParams | null = null;
  const lookahead = 30;

  return {
    type: "brake",
    atFrame: opts.at,
    place(ctx) {
      const rider = readIncoming(ctx.engine, opts.at);
      resolved = adaptBrake(opts, rider);
      const { angleDeg, length, offset } = resolved;
      const { pos } = lowestSledPoint(ctx.engine, opts.at);
      const line = buildSingleLine({ anchor: pos, angleDeg, length, offset, lineId: ctx.lineIdStart });
      const eng = ctx.engine.addLine(createLineFromJson(line));
      return { lines: [line], engineAfter: eng, endFrame: opts.at + lookahead, lineIds: [line.id] };
    },
    verify(det, range, _lineIds) {
      const { minVxDrop } = resolved!;
      const before = det.measurements.velocity[Math.max(0, range.start - 1)]?.x ?? 0;
      const afterIdx = Math.min(det.measurements.velocity.length - 1, range.end);
      const after = det.measurements.velocity[afterIdx]?.x ?? 0;
      const drop = before - after;
      const drift: DriftEntry[] = [];
      if (drop < minVxDrop) {
        drift.push({ metric: "vxDrop", expected: `>= ${minVxDrop}`, actual: Number(drop.toFixed(2)) });
      }
      return {
        passed: !catastrophicBy(det, range),
        drift,
        observed: {
          vxBefore: Number(before.toFixed(2)),
          vxAfter: Number(after.toFixed(2)),
          vxDrop: Number(drop.toFixed(2)),
        },
      };
    },
  };
}

// ────────── Kicker move ──────────
//
// Sharp angle change designed to produce a `kick` event (velocity-direction
// change > θ) without a sustained landing. Two short segments meeting at a
// steep V or A shape. Tests PROBLEM.md's open question about kick-as-event
// independence.

export type KickerOpts = KickerUserParams & { at: number };

export function kicker(opts: KickerOpts): Move {
  let resolved: ResolvedKickerParams | null = null;
  const lookahead = 25;

  return {
    type: "kicker",
    atFrame: opts.at,
    place(ctx) {
      const rider = readIncoming(ctx.engine, opts.at);
      resolved = adaptKicker(opts, rider);
      const { inAngleDeg, outAngleDeg, segmentLength, offset } = resolved;
      const { pos } = lowestSledPoint(ctx.engine, opts.at);
      const lines = buildSegmentsFromAngles({
        anchor: pos,
        angles: [inAngleDeg, outAngleDeg],
        segmentLength,
        offset,
        lineIdStart: ctx.lineIdStart,
      });
      let eng = ctx.engine;
      for (const ln of lines) eng = eng.addLine(createLineFromJson(ln));
      return { lines, engineAfter: eng, endFrame: opts.at + lookahead, lineIds: lines.map((l) => l.id) };
    },
    verify(det, range, _lineIds) {
      const kicks = det.events.filter((e) => e.type === "kick" && e.frame >= range.start && e.frame <= range.end);
      const drift: DriftEntry[] = [];
      if (kicks.length === 0) {
        drift.push({ metric: "kickEvent", expected: ">= 1", actual: 0 });
      }
      return {
        passed: !catastrophicBy(det, range),
        drift,
        observed: { kickCount: kicks.length, firstKickFrame: kicks[0]?.frame ?? -1 },
      };
    },
  };
}

// ────────── BounceStrip move ──────────
//
// Series of small bumps spaced for rhythmic skipping. Each bump is a tiny
// stub line; the rider lands on one, takes off, lands on the next, etc.
// Used for "drum roll" musical effects.

export type BounceStripOpts = BounceStripUserParams & { at: number };

export function bounceStrip(opts: BounceStripOpts): Move {
  let resolved: ResolvedBounceStripParams | null = null;

  return {
    type: "bounceStrip",
    atFrame: opts.at,
    place(ctx) {
      const rider = readIncoming(ctx.engine, opts.at);
      resolved = adaptBounceStrip(opts, rider);
      const { bumpCount, bumpSpacing, bumpHalfWidth } = resolved;
      const lines: TrackLine[] = [];
      // For each bump i, find the rider's predicted lowest sled position at
      // (at + i*bumpSpacing) — using the engine ONLY up to that point, with
      // accumulated bumps already placed.
      // deno-lint-ignore no-explicit-any
      let eng: any = ctx.engine;
      for (let i = 0; i < bumpCount; i++) {
        const bumpFrame = opts.at + i * bumpSpacing;
        const { pos } = lowestSledPoint(eng, bumpFrame);
        const line: TrackLine = {
          id: ctx.lineIdStart + i,
          type: 0,
          x1: pos.x - bumpHalfWidth,
          y1: pos.y,
          x2: pos.x + bumpHalfWidth,
          y2: pos.y,
          flipped: false,
          leftExtended: false,
          rightExtended: false,
        };
        lines.push(line);
        eng = eng.addLine(createLineFromJson(line));
      }
      return {
        lines,
        engineAfter: eng,
        endFrame: opts.at + bumpCount * bumpSpacing + 10,
        lineIds: lines.map((l) => l.id),
      };
    },
    verify(det, range, lineIds) {
      const { bumpCount } = resolved!;
      const owned = new Set(lineIds);
      const events = det.events.filter((e) => {
        if (e.type !== "bounce" && e.type !== "landing") return false;
        if (e.frame < range.start || e.frame > range.end) return false;
        const lids = det.measurements.contactLineIds[e.frame] ?? [];
        return lids.some((id) => owned.has(id));
      });
      const drift: DriftEntry[] = [];
      if (events.length < Math.floor(bumpCount * 0.5)) {
        drift.push({
          metric: "bumpEvents",
          expected: `>= ${Math.floor(bumpCount * 0.5)} (half of ${bumpCount} bumps)`,
          actual: events.length,
        });
      }
      return {
        passed: !catastrophicBy(det, range),
        drift,
        observed: {
          bumpEvents: events.length,
          bumpCount,
        },
      };
    },
  };
}

// ────────── Jump move ──────────
//
// Composed primitive: a ramp (single upward line) + a catch (short stub)
// placed at the predicted landing frame. The rider gets launched off the
// ramp into an arc, lands on the catch ε_t later. Verifies a landing
// event near (atFrame + airDuration).

export type JumpOpts = JumpUserParams & { at: number };

export function jump(opts: JumpOpts): Move {
  let resolved: ResolvedJumpParams | null = null;
  let landFrame = opts.at;

  return {
    type: "jump",
    atFrame: opts.at,
    place(ctx) {
      const rider = readIncoming(ctx.engine, opts.at);
      resolved = adaptJump(opts, rider);
      const { airDuration, launchAngleDeg, rampLength, catchHalfWidth } = resolved;
      landFrame = opts.at + airDuration;
      const lines: TrackLine[] = [];

      const rampAnchor = lowestSledPoint(ctx.engine, opts.at).pos;
      const ramp = buildSingleLine({
        anchor: rampAnchor,
        angleDeg: launchAngleDeg,
        length: rampLength,
        offset: 2,
        lineId: ctx.lineIdStart,
      });
      lines.push(ramp);
      // deno-lint-ignore no-explicit-any
      let eng: any = ctx.engine.addLine(createLineFromJson(ramp));

      const catchAnchor = lowestSledPoint(eng, landFrame).pos;
      const catchLine: TrackLine = {
        id: ctx.lineIdStart + 1,
        type: 0,
        x1: catchAnchor.x - catchHalfWidth,
        y1: catchAnchor.y,
        x2: catchAnchor.x + catchHalfWidth,
        y2: catchAnchor.y,
        flipped: false,
        leftExtended: false,
        rightExtended: false,
      };
      lines.push(catchLine);
      eng = eng.addLine(createLineFromJson(catchLine));

      return {
        lines,
        engineAfter: eng,
        endFrame: landFrame + 15,
        lineIds: lines.map((l) => l.id),
      };
    },
    verify(det, range, lineIds) {
      const { frameTolerance } = resolved!;
      const owned = new Set(lineIds);
      // Look for a landing event near landFrame whose contact involves our catch line.
      const landings = det.events.filter((e) => {
        if (e.type !== "landing") return false;
        if (e.frame < landFrame - frameTolerance || e.frame > landFrame + frameTolerance) return false;
        const lids = det.measurements.contactLineIds[e.frame] ?? [];
        return lids.some((id) => owned.has(id));
      });
      // Airborne fraction during the airDuration window
      let airCount = 0;
      const end = Math.min(det.measurements.airborne.length, landFrame);
      for (let f = opts.at + 2; f < end; f++) {
        if (det.measurements.airborne[f]) airCount++;
      }
      const drift: DriftEntry[] = [];
      if (landings.length === 0) {
        drift.push({
          metric: "landingNearLandFrame",
          expected: `near f=${landFrame} (±${frameTolerance})`,
          actual: "none",
        });
      } else if (landings[0].frame !== landFrame) {
        drift.push({
          metric: "landingFrame",
          expected: `f=${landFrame}`,
          actual: landings[0].frame,
        });
      }
      return {
        passed: !catastrophicBy(det, range),
        drift,
        observed: {
          landingFrame: landings[0]?.frame ?? -1,
          airborneFramesInWindow: airCount,
          targetLandFrame: landFrame,
        },
      };
    },
  };
}

// ────────── HalfPipe move ──────────
//
// Sine-shaped angle schedule: the segment slopes ramp up from 0 to a peak
// descent, back through 0 (at the bottom of the dip), then negative
// (climbing) to peak ascent, and back to 0. The cumulative path is a
// shallow valley — rider descends, levels out, climbs back to entry height.

export type HalfPipeOpts = HalfPipeUserParams & { at: number };

export function halfPipe(opts: HalfPipeOpts): Move {
  let resolved: ResolvedHalfPipeParams | null = null;
  return {
    type: "halfPipe",
    atFrame: opts.at,
    place(ctx) {
      const rider = readIncoming(ctx.engine, opts.at);
      resolved = adaptHalfPipe(opts, rider);
      const { peakDescentDeg, segments, segmentLength, offset } = resolved;
      const { pos } = lowestSledPoint(ctx.engine, opts.at);
      const angles: number[] = [];
      for (let i = 0; i < segments; i++) {
        const t = (i + 0.5) / segments;
        angles.push(peakDescentDeg * Math.sin(2 * Math.PI * t));
      }
      const lines = buildSegmentsFromAngles({
        anchor: pos,
        angles,
        segmentLength,
        offset,
        lineIdStart: ctx.lineIdStart,
      });
      let eng = ctx.engine;
      for (const ln of lines) eng = eng.addLine(createLineFromJson(ln));
      const meanVx = Math.max(2, rider.speed * 0.7);
      const endFrame = opts.at + Math.ceil((segments * segmentLength) / meanVx);
      return { lines, engineAfter: eng, endFrame, lineIds: lines.map((l) => l.id) };
    },
    verify(det, range, lineIds) {
      const { minDurationFrames } = resolved!;
      const segs = ownedSlideSegments(det, range, lineIds);
      const totalContact = segs.reduce((s, x) => s + x.durationFrames, 0);
      const mid = Math.floor((range.start + range.end) / 2);
      const vxMid = det.measurements.velocity[mid]?.x ?? 0;
      const vxStart = det.measurements.velocity[range.start]?.x ?? 0;
      const vxEnd =
        det.measurements.velocity[Math.min(det.measurements.velocity.length - 1, range.end)]?.x ?? 0;
      const drift: DriftEntry[] = [];
      if (totalContact < minDurationFrames) {
        drift.push({
          metric: "totalContactFrames",
          expected: `>= ${minDurationFrames}`,
          actual: totalContact,
        });
      }
      return {
        passed: !catastrophicBy(det, range),
        drift,
        observed: {
          totalContactFrames: totalContact,
          vxStart: Number(vxStart.toFixed(2)),
          vxMid: Number(vxMid.toFixed(2)),
          vxEnd: Number(vxEnd.toFixed(2)),
        },
      };
    },
  };
}

// ────────── Loop move ──────────
//
// Near-full circular arc. Rider enters going horizontally, sweeps around a
// circle centered below them. At 2D rigid-body with gravity, full 360°
// inversion is hard — the rider tends to detach at the top of the loop
// (gravity pulls them off the inside of the line). Accept ≤270° as the
// practical version; verify by measuring direction-sweep during contact.

export type LoopOpts = LoopUserParams & { at: number };

export function loop(opts: LoopOpts): Move {
  let resolved: ResolvedLoopParams | null = null;

  return {
    type: "loop",
    atFrame: opts.at,
    place(ctx) {
      const rider = readIncoming(ctx.engine, opts.at);
      resolved = adaptLoop(opts, rider);
      const { radius, segments, sweepDeg } = resolved;
      const sweepRad = (sweepDeg * Math.PI) / 180;
      const { pos } = lowestSledPoint(ctx.engine, opts.at);
      const center = { x: pos.x, y: pos.y + radius };
      const lines = arcLines({
        center,
        radius,
        startAngleRad: -Math.PI / 2,
        endAngleRad: -Math.PI / 2 + sweepRad,
        segments,
        lineIdStart: ctx.lineIdStart,
      });
      let eng = ctx.engine;
      for (const ln of lines) eng = eng.addLine(createLineFromJson(ln));
      const meanV = Math.max(2, rider.speed * 0.7);
      const endFrame = opts.at + Math.ceil((2 * Math.PI * radius) / meanV) + 10;
      return { lines, engineAfter: eng, endFrame, lineIds: lines.map((l) => l.id) };
    },
    verify(det, range, lineIds) {
      const { minSweepDeg, insufficientSpeed } = resolved!;
      const owned = new Set(lineIds);
      let sweptDeg = 0;
      let prevAngle: number | null = null;
      for (
        let f = range.start;
        f <= Math.min(range.end, det.measurements.velocity.length - 1);
        f++
      ) {
        const lids = det.measurements.contactLineIds[f] ?? [];
        if (!lids.some((id) => owned.has(id))) {
          prevAngle = null; // reset on contact break
          continue;
        }
        const v = det.measurements.velocity[f];
        if (!v) continue;
        const a = Math.atan2(v.y, v.x);
        if (prevAngle !== null) {
          let d = a - prevAngle;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          sweptDeg += (Math.abs(d) * 180) / Math.PI;
        }
        prevAngle = a;
      }
      const drift: DriftEntry[] = [];
      if (insufficientSpeed) {
        drift.push({ metric: "incomingSpeed", expected: ">= 3", actual: "too low for loop" });
      }
      if (sweptDeg < minSweepDeg) {
        drift.push({
          metric: "sweepDeg",
          expected: `>= ${minSweepDeg}°`,
          actual: Number(sweptDeg.toFixed(1)),
        });
      }
      return {
        passed: !catastrophicBy(det, range),
        drift,
        observed: { sweepDeg: Number(sweptDeg.toFixed(1)) },
      };
    },
  };
}
