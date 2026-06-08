/**
 * Landing `impact` lever — measurement, the report-only / no-op contract, and the
 * beat authoring helpers.
 *
 *  - measureImpact computes the normal impact speed (|v_in ⊥ catch-line|) / IMPACT_CAP,
 *    from the PRE-impact velocity and the PLACED line geometry, in both the full
 *    `detect` and the offset `detectWindow` measurement layouts, with graceful
 *    fallbacks.
 *  - impact is REPORT-ONLY in v1: an authored target appears in the drift report
 *    (target/achieved/error/ceiling) but does NOT change the contract score or the
 *    produced track (no RNG draw, not in TARGET_AXES) — the no-op/determinism contract.
 *  - `beats` / `withImpact` co-author timing + per-beat impact.
 */
import { describe, expect, test } from "vitest";
import { AXIS_MEASURE } from "../scripts/v0/core/measure.ts";
import { beats, withImpact } from "../scripts/v0/core/beats.ts";
import { constant } from "../scripts/v0/core/curves.ts";
import { scoreDriftReport } from "../scripts/v0/score.ts";
import { compileHandoff } from "../scripts/v0/optimizer/handoff.ts";
import {
  CALIB, impactCeiling, type Gap, type Spec, type TrackLine,
} from "../scripts/v0/types.ts";
import type { Detection } from "../scripts/lib/detector.ts";

// ── synthetic Detection just rich enough for measureImpact ──
function makeDet(opts: {
  landingFrame: number;
  velocity: Array<{ x: number; y: number }>;
  contactLineIds: number[][];
  frameOffset?: number;
}): Detection {
  const n = opts.velocity.length;
  return {
    frameOffset: opts.frameOffset ?? 0,
    events: [{ frame: opts.landingFrame, type: "landing", airborneFrom: 0 }],
    measurements: {
      velocity: opts.velocity,
      contactLineIds: opts.contactLineIds,
      airborne: new Array(n).fill(false),
      position: [],
      speed: opts.velocity.map((v) => Math.hypot(v.x, v.y)),
      sledContacts: [],
    },
    terminus: { frame: (opts.frameOffset ?? 0) + n - 1, reason: "endOfSpec" },
  } as unknown as Detection;
}

function line(id: number, x1: number, y1: number, x2: number, y2: number): TrackLine {
  return { id, x1, y1, x2, y2 } as TrackLine;
}

const measureImpact = AXIS_MEASURE.impact;

describe("measureImpact (normal impact speed reduction)", () => {
  // targets.impact set: measureImpact is gated to gaps whose beat authored impact.
  const gap: Gap = { index: 0, startFrame: 0, endFrame: 10, endsWithContact: true, targets: { impact: 0.5 } };

  test("horizontal catch line ⇒ impact = |vy_in| / IMPACT_CAP", () => {
    // velocity[9] (pre-impact) descends at (8, 4); horizontal line ⇒ normal = |vy| = 4.
    const velocity = Array.from({ length: 12 }, () => ({ x: 8, y: 4 }));
    const det = makeDet({ landingFrame: 10, velocity, contactLineIds: arrAt(12, 10, [1]) });
    const v = measureImpact({ det, gap, gapLines: [line(1, 0, 0, 100, 0)], rangeEndFrame: 10 });
    expect(v).toBeCloseTo(4 / CALIB.IMPACT_CAP, 5); // 0.8
  });

  test("45° catch line discounts the along-slope component", () => {
    const velocity = Array.from({ length: 12 }, () => ({ x: 8, y: 4 }));
    const det = makeDet({ landingFrame: 10, velocity, contactLineIds: arrAt(12, 10, [1]) });
    // tangent (1,1)/√2 ⇒ |tx*vy − ty*vx| = (4−8)/√2 = 2.828.
    const v = measureImpact({ det, gap, gapLines: [line(1, 0, 0, 100, 100)], rangeEndFrame: 10 });
    expect(v).toBeCloseTo(Math.abs(4 - 8) / Math.SQRT2 / CALIB.IMPACT_CAP, 5);
  });

  test("uses the PRE-impact frame (landingFrame−1), not the landing frame", () => {
    const velocity = Array.from({ length: 12 }, (_, i) => (i === 9 ? { x: 8, y: 4 } : { x: 8, y: 0 }));
    const det = makeDet({ landingFrame: 10, velocity, contactLineIds: arrAt(12, 10, [1]) });
    const v = measureImpact({ det, gap, gapLines: [line(1, 0, 0, 100, 0)], rangeEndFrame: 10 });
    expect(v).toBeCloseTo(4 / CALIB.IMPACT_CAP, 5); // reads frame 9 (=4 ⇒ 0.8), not frame 10 (=0)
  });

  test("works under the detectWindow frame offset", () => {
    // frameOffset 100: landing at absolute frame 110, arrays indexed from 0.
    const velocity = Array.from({ length: 12 }, () => ({ x: 8, y: 4 }));
    const det = makeDet({ landingFrame: 110, velocity, contactLineIds: arrAt(12, 10, [1]), frameOffset: 100 });
    const g: Gap = { ...gap, endFrame: 110 };
    const v = measureImpact({ det, gap: g, gapLines: [line(1, 0, 0, 100, 0)], rangeEndFrame: 110 });
    expect(v).toBeCloseTo(4 / CALIB.IMPACT_CAP, 5);
  });

  test("undefined when the landing fired no owned line (don't guess geometry)", () => {
    const velocity = Array.from({ length: 12 }, () => ({ x: 8, y: 4 }));
    // contactLineIds names a foreign line (99) not in gapLines ⇒ no owned tangent.
    // The candidate gate guarantees an owned line fired in real compiles, so this
    // only happens off-path; we return undefined rather than guess gapLines[0].
    const det = makeDet({ landingFrame: 10, velocity, contactLineIds: arrAt(12, 10, [99]) });
    expect(measureImpact({ det, gap, gapLines: [line(1, 0, 0, 100, 0)], rangeEndFrame: 10 })).toBeUndefined();
  });

  test("undefined when no landing event is near the contact", () => {
    const velocity = Array.from({ length: 12 }, () => ({ x: 8, y: 4 }));
    const det = makeDet({ landingFrame: 30, velocity, contactLineIds: arrAt(12, 30, [1]) });
    expect(measureImpact({ det, gap, gapLines: [line(1, 0, 0, 100, 0)], rangeEndFrame: 10 })).toBeUndefined();
  });

  test("gated: undefined when the beat did not author impact (gap.targets.impact unset)", () => {
    const velocity = Array.from({ length: 12 }, () => ({ x: 8, y: 4 }));
    const det = makeDet({ landingFrame: 10, velocity, contactLineIds: arrAt(12, 10, [1]) });
    const untargeted: Gap = { ...gap, targets: {} };
    expect(measureImpact({ det, gap: untargeted, gapLines: [line(1, 0, 0, 100, 0)], rangeEndFrame: 10 })).toBeUndefined();
  });

  test("undefined when the gap placed no lines", () => {
    const velocity = Array.from({ length: 12 }, () => ({ x: 8, y: 4 }));
    const det = makeDet({ landingFrame: 10, velocity, contactLineIds: arrAt(12, 10, [1]) });
    expect(measureImpact({ det, gap, gapLines: [], rangeEndFrame: 10 })).toBeUndefined();
  });

  test("saturates at 1.0 for a slam beyond IMPACT_CAP", () => {
    const velocity = Array.from({ length: 12 }, () => ({ x: 1, y: 20 }));
    const det = makeDet({ landingFrame: 10, velocity, contactLineIds: arrAt(12, 10, [1]) });
    expect(measureImpact({ det, gap, gapLines: [line(1, 0, 0, 100, 0)], rangeEndFrame: 10 })).toBe(1);
  });
});

describe("impactCeiling", () => {
  test("scales with speed and clamps to [0,1]", () => {
    expect(impactCeiling(0)).toBe(0);
    expect(impactCeiling(5)).toBeCloseTo(0.6, 5); // 0.6*5 / 5
    expect(impactCeiling(100)).toBe(1);
  });
});

describe("impact is scored (v2)", () => {
  const grid = [{ t: 0.5 }, { t: 1.0 }, { t: 1.5 }, { t: 2.0 }, { t: 2.5 }];
  const withImp: Spec = { duration: 3, contacts: withImpact(grid, (t) => 0.2 + 0.2 * t), jitter: 0, axes: { air: constant(0.6), speed: constant(0.5) } };

  test("impact counts in axis_quality (promoted from report-only)", () => {
    // A report whose only axis is impact, with error — must now be aggregated.
    const report = {
      contacts: [{ t_target: 1, t_actual: 1, frame_error: 0, status: "hit" }],
      gaps: [{ gap_index: 0, t_end: 1, survived: true, axes: { impact: { target: 0.8, achieved: 0.4, error: 0.4 } } }],
      off_beat_landings: [],
      terminus: { frame: 40, reason: "endOfSpec" },
    };
    const sc = scoreDriftReport(report as never, { totalFrames: 40 });
    expect(sc.axis_count).toBe(1);           // impact is aggregated, not filtered out (v1 was 0)
    expect(sc.axis_quality).toBeLessThan(1); // its 0.4 error drags axis_quality down
  });

  test("authored impact surfaces in the report with target/achieved/error/ceiling", () => {
    const { report } = compileHandoff(withImp, 0, { budget: 40_000 });
    const withTarget = report.gaps.filter((g) => g.axes.impact !== undefined);
    expect(withTarget.length).toBeGreaterThan(0);
    for (const g of withTarget) {
      const a = g.axes.impact!;
      expect(a.target).toBeGreaterThanOrEqual(0);
      expect(a.achieved).toBeGreaterThanOrEqual(0);
      expect(a.error).toBeCloseTo(Math.abs(a.target - a.achieved), 9);
      expect(a.ceiling).toBeDefined();
    }
  }, 120_000);
});

describe("beat authoring helpers", () => {
  test("beats preserves t, clamps impact, leaves impact-less beats untargeted", () => {
    const out = beats([{ t: 0.5, impact: 0.8 }, { t: 1.0, impact: 1.5 }, { t: 1.5 }]);
    expect(out[0]).toEqual({ t: 0.5, impact: 0.8 });
    expect(out[1]).toEqual({ t: 1.0, impact: 1 }); // clamped to [0,1]
    expect(out[2]).toEqual({ t: 1.5 }); // no impact key
  });

  test("withImpact scalar and rule, clamped; non-finite rule leaves untargeted", () => {
    const c = [{ t: 0 }, { t: 1 }, { t: 2 }];
    expect(withImpact(c, 0.5)).toEqual([{ t: 0, impact: 0.5 }, { t: 1, impact: 0.5 }, { t: 2, impact: 0.5 }]);
    expect(withImpact(c, (t) => t * 0.4)).toEqual([{ t: 0, impact: 0 }, { t: 1, impact: 0.4 }, { t: 2, impact: 0.8 }]);
    expect(withImpact(c, (_t, i) => (i === 1 ? 2 : -1))).toEqual([{ t: 0, impact: 0 }, { t: 1, impact: 1 }, { t: 2, impact: 0 }]);
    expect(withImpact(c, () => undefined)).toEqual([{ t: 0 }, { t: 1 }, { t: 2 }]);
  });
});

/** contactLineIds array of length n, with `ids` at index `frame`, else []. */
function arrAt(n: number, frame: number, ids: number[]): number[][] {
  return Array.from({ length: n }, (_, i) => (i === frame ? ids : []));
}
