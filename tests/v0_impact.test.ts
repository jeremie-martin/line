/**
 * Landing `impact` lever — measurement, scoring, and the beat authoring helpers.
 *
 *  - measureImpact computes the velocity REDIRECTION ARC `redirArc = v·Δθ` (incoming CoM
 *    speed × NET heading change at the window end, over IMPACT_WINDOW frames), CoM-only
 *    (NO catch-line geometry), mapped to felt [0,1] by `normImpact` (0 = soft @2.0 px/f,
 *    1 = very strong @6.5 px/f) — in both the full `detect` and offset `detectWindow`.
 *  - impact is SCORED: an authored target folds into the contract `axis_quality`
 *    (target/achieved/error/ceiling in the drift report), draws no RNG, stays out of
 *    TARGET_AXES, and compiles deterministically.
 *  - `beats` / `withImpact` co-author timing + per-beat impact.
 */
import { describe, expect, test } from "vitest";
import { AXIS_MEASURE } from "../scripts/v0/core/measure.ts";
import { beats, withImpact } from "../scripts/v0/core/beats.ts";
import { constant } from "../scripts/v0/core/curves.ts";
import { scoreDriftReport } from "../scripts/v0/score.ts";
import { compileHandoff } from "../scripts/v0/optimizer/handoff.ts";
import {
  REDIRARC, IMPACT, IMPACT_WINDOW, impactCeiling, type Gap, type Spec, type TrackLine,
} from "../scripts/v0/types.ts";
import type { Detection } from "../scripts/lib/detector.ts";

/** Independent reference normalization (mirrors types.normImpact) — redirArc px → felt [0,1]. */
const norm = (px: number) =>
  Math.max(0, Math.min(1, (px - REDIRARC.SOFT) / (REDIRARC.VERY_STRONG - REDIRARC.SOFT)));
/** Unit-speed velocity at heading `θ` (rad) and magnitude `s`. */
const vel = (theta: number, s: number) => ({ x: s * Math.cos(theta), y: s * Math.sin(theta) });

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

describe("measureImpact (redirArc = v·Δθ reduction)", () => {
  // targets.impact set: measureImpact is gated to gaps whose beat authored impact.
  const gap: Gap = { index: 0, startFrame: 0, endFrame: 10, endsWithContact: true, targets: { impact: 0.5 } };
  // Build a det whose CoM velocity at absolute frame f is vfn(f), landing at `lf`.
  const detFor = (lf: number, n: number, vfn: (f: number) => { x: number; y: number }, off = 0) =>
    makeDet({
      landingFrame: lf,
      velocity: Array.from({ length: n }, (_, i) => vfn(i + off)),
      contactLineIds: arrAt(n, lf - off, [1]),
      frameOffset: off,
    });
  // gapLines are intentionally varied/empty: redirArc is CoM-only and ignores them.
  const call = (det: Detection, g: Gap = gap, gapLines: TrackLine[] = []) =>
    measureImpact({ det, gap: g, gapLines, rangeEndFrame: g.endFrame });

  test("straight glide (no heading change) ⇒ redirArc = 0 ⇒ impact 0", () => {
    const det = detFor(10, 20, () => ({ x: 9, y: 4 })); // constant velocity → no turn
    expect(call(det)).toBeCloseTo(0, 6);
  });

  test("net redirection ⇒ |v_in|·Δθ, felt-normalized", () => {
    // incoming (3,0) speed 3; window-end heading turns to π/2 → redirArc = 3·(π/2).
    const det = detFor(10, 20, (f) => (f <= 9 ? { x: 3, y: 0 } : { x: 0, y: 3 }));
    expect(call(det)).toBeCloseTo(norm(3 * (Math.PI / 2)), 5);
  });

  test("NET turn at the window end, not the in-window peak", () => {
    // heading spikes to 1.0 rad mid-window then settles to 0.5 rad by the end:
    // redirArc must reflect the 0.5-rad endpoint (= |v_in|·0.5), NOT the 1.0 peak.
    const det = detFor(10, 20, (f) => (f <= 9 ? { x: 10, y: 0 } : f <= 13 ? vel(1.0, 10) : vel(0.5, 10)));
    expect(call(det)).toBeCloseTo(norm(10 * 0.5), 5);
    expect(call(det)).toBeLessThan(norm(10 * 1.0)); // not the peak
  });

  test("geometry-independent: ignores catch-line tangent / owned lines (CoM-only)", () => {
    const det = detFor(10, 20, (f) => (f <= 9 ? { x: 10, y: 0 } : vel(0.5, 10)));
    const horiz = call(det, gap, [line(1, 0, 0, 100, 0)]);
    const slant = call(det, gap, [line(1, 0, 0, 100, 100)]);
    const none = call(det, gap, []); // no owned line ⇒ STILL a value (redirArc ignores lines)
    expect(horiz).toBeCloseTo(norm(10 * 0.5), 5);
    expect(slant).toBeCloseTo(horiz!, 9);
    expect(none).toBeCloseTo(horiz!, 9);
  });

  test("heading reference is the PRE-landing frame (lf−1)", () => {
    // incoming (lf−1) = (0,3) [heading π/2]; post = (3,0) [heading 0] → Δθ = π/2.
    // If it wrongly used lf as the reference (also (3,0)), Δθ would be 0.
    const det = detFor(10, 20, (f) => (f <= 9 ? { x: 0, y: 3 } : { x: 3, y: 0 }));
    expect(call(det)).toBeCloseTo(norm(3 * (Math.PI / 2)), 5);
  });

  test("works under the detectWindow frame offset", () => {
    const det = detFor(110, 20, (f) => (f < 110 ? { x: 3, y: 0 } : { x: 0, y: 3 }), 100);
    expect(call(det, { ...gap, endFrame: 110 })).toBeCloseTo(norm(3 * (Math.PI / 2)), 5);
  });

  test("window truncates at the detection end (no crash)", () => {
    // landing near the last frame: only frames 11,12 available; Δθ read at frame 12.
    const det = detFor(10, 13, (f) => (f <= 9 ? { x: 3, y: 0 } : { x: 0, y: 3 }));
    expect(call(det)).toBeCloseTo(norm(3 * (Math.PI / 2)), 5);
  });

  test("gated: undefined when the beat did not author impact", () => {
    const det = detFor(10, 20, () => ({ x: 9, y: 4 }));
    expect(call(det, { ...gap, targets: {} })).toBeUndefined();
  });

  test("undefined when no landing event is near the contact", () => {
    const det = detFor(30, 40, () => ({ x: 9, y: 4 })); // landing 30, gap.endFrame 10
    expect(call(det)).toBeUndefined();
  });

  test("clamps below soft (gentler than 2.0 px/f redirArc) to 0", () => {
    // speed 3, tiny end turn 0.2 rad → redirArc 0.6 px/f < SOFT(2.0) ⇒ 0.
    const det = detFor(10, 20, (f) => (f <= 9 ? { x: 3, y: 0 } : vel(0.2, 3)));
    expect(call(det)).toBe(0);
  });

  test("saturates at 1.0 above very-strong (≥6.5 px/f redirArc)", () => {
    // speed 10, π/2 turn → redirArc 10·1.571 ≈ 15.7 ≫ 6.5 ⇒ 1.
    const det = detFor(10, 20, (f) => (f <= 9 ? { x: 10, y: 0 } : { x: 0, y: 10 }));
    expect(call(det)).toBe(1);
  });
});

describe("impactCeiling (redirArc bound)", () => {
  test("scales with speed (CATCHABLE_REDIR_FRACTION) and clamps to [0,1]", () => {
    const maxTurn = Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION); // ≈ 1.12 rad
    expect(impactCeiling(0)).toBe(0); // 0 redirArc < soft ⇒ 0
    expect(impactCeiling(5)).toBeCloseTo(norm(5 * maxTurn), 5); // ≈ 0.80
    expect(impactCeiling(100)).toBe(1); // 100·1.12 ≫ very-strong ⇒ 1
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

  test("an impact-authoring spec compiles deterministically", () => {
    // impact is resolved after sampleGapTargets (no RNG draw); two compiles of the
    // same (spec, seed, budget) must still be byte-identical.
    const a = compileHandoff(withImp, 0, { budget: 40_000 });
    const b = compileHandoff(withImp, 0, { budget: 40_000 });
    expect(JSON.stringify(b.track)).toBe(JSON.stringify(a.track));
    expect(b.stats.sim_frames).toBe(a.stats.sim_frames);
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
