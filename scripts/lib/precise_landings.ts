/**
 * Precise-landing primitive family — sloped-curve foundation.
 *
 * Per NEXT.md: precision-first landings + visual variety + rider air time
 * between beats. After probing the horizontal-stub bisection (landAt) we
 * found it ejects the rider 2f after the first landing — flat catches
 * can't absorb impact when vy is non-trivial. The successful chained-
 * landing primitive in the codebase is `placeSlideChain`, which uses a
 * MULTI-SEGMENT SLOPED CURVE to absorb impact gradually.
 *
 * This module reuses that survival-proven shape, adds bisection on its
 * `offset` parameter to achieve ±1f precision, and provides a small
 * family of variants (the basic curve, plus post-catch decoration
 * geometry) for visual variety across consecutive beats.
 *
 * The pattern from the probe (bench/v2 baseline run + manual probe on
 * metronome_60):
 *
 *   placeSlideChain (current):  survives ✓, 61% air fraction ✓,
 *                                23% onBeat1, 77% onBeat2 (median 2f late)
 *
 * The "2f late" is uniform: every beat lands 1-2f after the target because
 * the curve is placed at a fixed `offset` (2 px perpendicular below the
 * rider's predicted position). Bisecting `offset` is the fix.
 */

import {
  bisectCurveOffset,
  type CurveShape,
  DEFAULT_CURVE_SHAPE,
} from "./primitive.ts";
import { createLineFromJson } from "./_lr_engine.ts";
import { makeLine } from "./primitive.ts";
import {
  type Move,
  type Placement,
  type MoveVerdict,
  type DriftEntry,
} from "./moves.ts";
import type { Detection } from "./detector.ts";

const LOOKAHEAD_FRAMES = 40;

/** Shared verify() — landing/bounce attributed to this move's lines must
 *  fire within ±tol of `at`. */
function buildVerify(at: number, tol: number) {
  return function verify(
    det: Detection,
    range: { start: number; end: number },
    lineIds: number[],
  ): MoveVerdict {
    const owned = new Set(lineIds);
    const matched = det.events.filter((e) => {
      if (e.type !== "landing" && e.type !== "bounce") return false;
      if (e.frame < range.start - 10 || e.frame > range.end) return false;
      const lids = det.measurements.contactLineIds[e.frame] ?? [];
      return lids.some((id) => owned.has(id));
    });
    const best = matched.sort(
      (a, b) => Math.abs(a.frame - at) - Math.abs(b.frame - at),
    )[0];
    const offset = best ? Math.abs(best.frame - at) : null;
    const drift: DriftEntry[] = [];
    if (!best) {
      drift.push({
        metric: "landing",
        expected: `at f=${at} ±${tol}`,
        actual: "none",
      });
    } else if (offset! > tol) {
      drift.push({
        metric: "landingFrame",
        expected: `f=${at} ±${tol}`,
        actual: best.frame,
      });
    }
    const cata =
      det.terminus.frame < range.end &&
      det.terminus.reason !== "endOfSpec";
    return {
      passed: !cata,
      drift,
      observed: {
        actualLandingFrame: best?.frame ?? -1,
        offset: offset ?? -1,
      },
    };
  };
}

// ────────── landAtCurve — the precision-bisected sloped-curve base ──────────

export type LandAtCurveOpts = {
  at: number;
  /** Override the curve shape (start/end angle, segments, segment length). */
  shape?: Partial<CurveShape>;
  /** Bisection search radius for `offset` (perpendicular distance below
   *  the rider's predicted lowest sled point). Default 8 px. */
  searchRadius?: number;
  /** Max bisection iterations. Default 18. */
  maxIters?: number;
  frameTolerance?: number;
};

/**
 * The precision-bisected base. Multi-segment sloped curve (same shape as
 * placeSlideChain — survival proven) with `offset` bisected so the rider's
 * landing event fires AT `at`.
 *
 * Visual signature: gradual catch + smooth slide along curve. No post-catch
 * decoration; just the curve.
 */
export function landAtCurve(opts: LandAtCurveOpts): Move {
  const shape: CurveShape = { ...DEFAULT_CURVE_SHAPE, ...(opts.shape ?? {}) };
  const searchRadius = opts.searchRadius ?? 8;
  const maxIters = opts.maxIters ?? 18;
  return {
    type: "landAt_curve",
    atFrame: opts.at,
    place(ctx): Placement {
      const r = bisectCurveOffset(ctx.engine, opts.at, {
        lineIdStart: ctx.lineIdStart,
        shape,
        duration: Math.min(ctx.duration, opts.at + LOOKAHEAD_FRAMES),
        searchRadius,
        maxIters,
      });
      return {
        lines: r.lines,
        engineAfter: r.engineAfter,
        endFrame: opts.at + LOOKAHEAD_FRAMES,
        lineIds: r.lines.map((l) => l.id),
      };
    },
    verify: buildVerify(opts.at, opts.frameTolerance ?? 1),
  };
}

// ────────── landAtCurveKicker — curve + relaunch kicker ──────────

export type LandAtCurveKickerOpts = LandAtCurveOpts & {
  /** Length of the kicker line added at the trailing edge of the curve. */
  kickerLength?: number;
  /** Upward angle of the kicker, degrees (negative = up). Default −10. */
  kickerAngleDeg?: number;
};

/**
 * Bisected curve + upward kicker at the trailing edge. Rider lands on the
 * curve, slides over, hits the kicker, relaunches into air with extra
 * upward vy.
 */
export function landAtCurveKicker(opts: LandAtCurveKickerOpts): Move {
  const shape: CurveShape = { ...DEFAULT_CURVE_SHAPE, ...(opts.shape ?? {}) };
  const searchRadius = opts.searchRadius ?? 8;
  const maxIters = opts.maxIters ?? 18;
  const kickerLength = opts.kickerLength ?? 10;
  const kickerAngleDeg = opts.kickerAngleDeg ?? -10;
  return {
    type: "landAt_curve_kicker",
    atFrame: opts.at,
    place(ctx): Placement {
      const r = bisectCurveOffset(ctx.engine, opts.at, {
        lineIdStart: ctx.lineIdStart,
        shape,
        duration: Math.min(ctx.duration, opts.at + LOOKAHEAD_FRAMES),
        searchRadius,
        maxIters,
      });
      const last = r.lines[r.lines.length - 1];
      const ang = (kickerAngleDeg * Math.PI) / 180;
      const kx = last.x2 + Math.cos(ang) * kickerLength;
      const ky = last.y2 + Math.sin(ang) * kickerLength;
      const kickerLine = makeLine(
        ctx.lineIdStart + r.lines.length,
        last.x2,
        last.y2,
        kx,
        ky,
      );
      // deno-lint-ignore no-explicit-any
      const engineAfter = (r.engineAfter as any).addLine(
        createLineFromJson(kickerLine),
      );
      return {
        lines: [...r.lines, kickerLine],
        engineAfter,
        endFrame: opts.at + LOOKAHEAD_FRAMES,
        lineIds: [...r.lines.map((l) => l.id), kickerLine.id],
      };
    },
    verify: buildVerify(opts.at, opts.frameTolerance ?? 1),
  };
}

// ────────── landAtCurveDive — curve + steep downward exit ──────────

export type LandAtCurveDiveOpts = LandAtCurveOpts & {
  /** Length of the dive exit added at the trailing edge of the curve. */
  diveLength?: number;
  /** Downward angle of the dive exit, degrees (positive = down). Default 22. */
  diveAngleDeg?: number;
};

/**
 * Bisected curve + steeper downward exit. Rider lands on the curve, slides
 * over the gentle curve, then accelerates down the dive — gains vy for the
 * next landing. Useful when consecutive beats need the rider to NOT bleed
 * speed.
 */
export function landAtCurveDive(opts: LandAtCurveDiveOpts): Move {
  const shape: CurveShape = { ...DEFAULT_CURVE_SHAPE, ...(opts.shape ?? {}) };
  const searchRadius = opts.searchRadius ?? 8;
  const maxIters = opts.maxIters ?? 18;
  const diveLength = opts.diveLength ?? 14;
  const diveAngleDeg = opts.diveAngleDeg ?? 22;
  return {
    type: "landAt_curve_dive",
    atFrame: opts.at,
    place(ctx): Placement {
      const r = bisectCurveOffset(ctx.engine, opts.at, {
        lineIdStart: ctx.lineIdStart,
        shape,
        duration: Math.min(ctx.duration, opts.at + LOOKAHEAD_FRAMES),
        searchRadius,
        maxIters,
      });
      const last = r.lines[r.lines.length - 1];
      const ang = (diveAngleDeg * Math.PI) / 180;
      const dx = last.x2 + Math.cos(ang) * diveLength;
      const dy = last.y2 + Math.sin(ang) * diveLength;
      const diveLine = makeLine(
        ctx.lineIdStart + r.lines.length,
        last.x2,
        last.y2,
        dx,
        dy,
      );
      // deno-lint-ignore no-explicit-any
      const engineAfter = (r.engineAfter as any).addLine(
        createLineFromJson(diveLine),
      );
      return {
        lines: [...r.lines, diveLine],
        engineAfter,
        endFrame: opts.at + LOOKAHEAD_FRAMES,
        lineIds: [...r.lines.map((l) => l.id), diveLine.id],
      };
    },
    verify: buildVerify(opts.at, opts.frameTolerance ?? 1),
  };
}

// ────────── Family registry ──────────

export const PRECISE_LANDING_FAMILY: Array<{
  type: string;
  factory: (at: number) => Move;
  description: string;
}> = [
  { type: "landAt_curve",         factory: (at) => landAtCurve({ at }),       description: "Bisected sloped curve — no decoration." },
  { type: "landAt_curve_kicker",  factory: (at) => landAtCurveKicker({ at }), description: "Curve + upward kicker — rider relaunches." },
  { type: "landAt_curve_dive",    factory: (at) => landAtCurveDive({ at }),   description: "Curve + steep downward exit — rider gains vy." },
];
