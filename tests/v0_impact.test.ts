/**
 * Landing `impact` lever — measurement, scoring, and the beat authoring helpers.
 *
 *  - measureImpact computes the redirection IMPULSE `cArc = Σ v̄·|Δθ|` (per-frame CoM
 *    heading change × midpoint speed, ACCUMULATED over CONTACTED frames of the
 *    IMPACT_WINDOW episode; airborne frames contribute zero), CoM-only (NO catch-line
 *    geometry), mapped to felt [0,1] by `normImpact` (0 = SOFT @0 px/f — the physical
 *    floor, no redirection; 1 = VSTRONG @7.55 px/f) — both full `detect` and offset.
 *  - impact is SCORED: an authored target folds into the contract `axis_quality`
 *    (target/achieved/error/ceiling in the drift report), draws no RNG, stays out of
 *    TARGET_AXES, and compiles deterministically.
 *  - `beats` / `withImpact` co-author timing + per-beat impact.
 */
import { describe, expect, test } from "vitest";
import { AXIS_MEASURE } from "../scripts/v0/core/measure.ts";
import { beats, withImpact } from "../scripts/v0/core/beats.ts";
import { constant } from "../scripts/v0/core/curves.ts";
import { GRAVITY, contactRedirArcPx, redirArcPx, type Sim } from "../scripts/v0/impact_support.ts";
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
  airborne?: boolean[];
  frameOffset?: number;
}): Detection {
  const n = opts.velocity.length;
  return {
    frameOffset: opts.frameOffset ?? 0,
    events: [{ frame: opts.landingFrame, type: "landing", airborneFrom: 0 }],
    measurements: {
      velocity: opts.velocity,
      contactLineIds: opts.contactLineIds,
      airborne: opts.airborne ?? new Array(n).fill(false),
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

describe("measureImpact (cArc = Σ v̄·|Δθ| impulse reduction)", () => {
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

  test("ACCUMULATED turn: bend-then-unbend adds, it does not cancel", () => {
    // heading bends to 1.0 rad mid-window then settles back to 0.5 rad: the scored
    // impulse accumulates |Δθ| per frame (1.0 + 0.5 = 1.5 rad at speed 3) — the
    // legacy net form would have read only the 0.5-rad endpoint.
    const det = detFor(10, 20, (f) => (f <= 9 ? { x: 3, y: 0 } : f <= 13 ? vel(1.0, 3) : vel(0.5, 3)));
    expect(call(det)).toBeCloseTo(norm(3 * 1.5), 5);
    expect(call(det)!).toBeGreaterThan(norm(3 * 0.5)); // not the net endpoint
  });

  test("airborne frames inside the window contribute zero (flight is not impact)", () => {
    // gravity-like bending while airborne: the scored impulse ignores it entirely.
    const g = 0.175;
    const det = makeDet({
      landingFrame: 10,
      velocity: Array.from({ length: 20 }, (_, f) => (f <= 9 ? { x: 10, y: 0 } : { x: 10, y: g * (f - 9) })),
      contactLineIds: arrAt(20, 10, [1]),
      airborne: Array.from({ length: 20 }, () => true), // never grounded in-window
    });
    expect(call(det)).toBeCloseTo(0, 9);
  });

  test("mixed window: flight bending is skipped, but the re-contact bend still counts", () => {
    // The subtlest rule of the scored loop: the airborne gate suppresses the
    // CONTRIBUTION of an airborne frame, yet `prev` still advances through it — so
    // the 0.6 rad the rider accrues ballistically between touchdown and re-contact
    // is excluded, while the 0.1 rad the ground puts in at re-contact is kept.
    // headings: lf−1 = 0 · lf = 0.3 (contacted) · lf+1..3 = 0.5/0.7/0.9 (airborne)
    //           lf+4.. = 1.0 (contacted). Speed 10 throughout.
    const heading = (f: number) => (f <= 9 ? 0 : f === 10 ? 0.3 : f === 11 ? 0.5 : f === 12 ? 0.7 : f === 13 ? 0.9 : 1.0);
    const det = makeDet({
      landingFrame: 10,
      velocity: Array.from({ length: 20 }, (_, f) => vel(heading(f), 10)),
      contactLineIds: arrAt(20, 10, [1]),
      airborne: Array.from({ length: 20 }, (_, f) => f >= 11 && f <= 13),
    });
    // 10·0.3 (touchdown) + 0 (three airborne frames) + 10·0.1 (re-contact) = 4.
    expect(call(det)).toBeCloseTo(norm(4), 5);
    // Guards the two plausible refactors of the loop, in both directions:
    //  - moving `prev = v` INSIDE the airborne guard reads 10 (the whole 0.7 rad of
    //    flight bending is billed to the re-contact frame — verified by mutation);
    //  - breaking out of the loop at the first airborne frame reads 3 (the
    //    re-contact bend is lost).
    expect(call(det)).toBeLessThan(norm(10));
    expect(call(det)).toBeGreaterThan(norm(3));
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
    // landing near the last frame: the window is cut at the detection end (frame 12),
    // so only the single touchdown bend at frame 10 is accumulated — no crash, and
    // the truncated tail is silently absent (accumulation can only under-read).
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

  test("SOFT=0 floor: a small redirArc reads small & linear (no dead-zone)", () => {
    // speed 3, single 0.2-rad bend → impulse 0.6 px/f → 0.6/VSTRONG(7.55) ≈ 0.08.
    // SOFT=0 means a gentle redirect is a small REAL impact, not clamped to 0.
    const det = detFor(10, 20, (f) => (f <= 9 ? { x: 3, y: 0 } : vel(0.2, 3)));
    const v = call(det)!;
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(0.15);
  });

  test("saturates at 1.0 above very-strong (≥VSTRONG px/f impulse)", () => {
    // speed 10, π/2 turn → impulse 10·1.571 ≈ 15.7 ≫ VSTRONG(7.55) ⇒ 1.
    const det = detFor(10, 20, (f) => (f <= 9 ? { x: 10, y: 0 } : { x: 0, y: 10 }));
    expect(call(det)).toBe(1);
  });
});

describe("contactRedirArcPx (study delegate for the SCORED redirection impulse)", () => {
  const asSim = (det: Detection): Sim => ({
    det,
    vel: det.measurements.velocity,
    last: det.terminus.frame,
    track: {},
    eng: null,
    lineById: new Map(),
    cids: det.measurements.contactLineIds,
  }) as Sim;

  const lf = 10;
  const flatDet = (vfn: (f: number) => { x: number; y: number }, airborne?: boolean[]) =>
    makeDet({
      landingFrame: lf,
      velocity: Array.from({ length: 20 }, (_, f) => vfn(f)),
      contactLineIds: arrAt(20, lf, [1]),
      airborne,
    });

  test("flat sustained ride: raw reads 0; stepGravity manufactures the support artifact", () => {
    // Constant velocity on sustained contact — the path never bends, so the raw
    // contacted-only impulse is exactly 0. Subtracting g·dt per supported step
    // mis-attributes the ground's support force: ~v·atan(g/v) ≈ GRAVITY per frame.
    const sim = asSim(flatDet(() => ({ x: 10, y: 0 })));
    expect(contactRedirArcPx(sim, lf)).toBeCloseTo(0, 9);
    expect(contactRedirArcPx(sim, lf, IMPACT_WINDOW, { stepGravity: true }))
      .toBeGreaterThan(6 * GRAVITY * 0.9); // ≈ 7 frames × 0.175 px/f of phantom arc
  });

  test("windowed airborne frames contribute zero (flight is not impact)", () => {
    // Ballistic gravity bending inside the window: production redirArc reads a turn,
    // the contacted-only impulse reads 0 — the rule IS the gravity treatment.
    const airborne = new Array(20).fill(true);
    const sim = asSim(flatDet((f) => (f < lf ? { x: 10, y: 0 } : { x: 10, y: GRAVITY * (f - (lf - 1)) }), airborne));
    expect(contactRedirArcPx(sim, lf)).toBeCloseTo(0, 9);
    expect(redirArcPx(sim, lf)).toBeGreaterThan(0);
  });

  test("bend-then-unbend: accumulated keeps both bends, net redirArc cancels", () => {
    // Heading 0 → 0.5 rad → back to 0 inside the window, speed 10 throughout.
    const sim = asSim(flatDet((f) => (f < lf || f > 12 ? { x: 10, y: 0 } : vel(0.5, 10))));
    expect(contactRedirArcPx(sim, lf)).toBeCloseTo(10 * 0.5 * 2, 9); // both bends count
    expect(redirArcPx(sim, lf)).toBeCloseTo(0, 9); // net endpoint turn cancelled
  });

  test("onset decay discounts late bending; tau=∞ equals the undecayed value", () => {
    const early = asSim(flatDet((f) => (f < lf ? { x: 10, y: 0 } : vel(0.5, 10))));
    const late = asSim(flatDet((f) => (f < lf + IMPACT_WINDOW ? { x: 10, y: 0 } : vel(0.5, 10))));
    const undecayed = contactRedirArcPx(early, lf);
    expect(contactRedirArcPx(early, lf, IMPACT_WINDOW, { tau: 4 })).toBeCloseTo(undecayed, 9); // turn at dt=0
    expect(contactRedirArcPx(late, lf, IMPACT_WINDOW, { tau: 4 }))
      .toBeCloseTo(undecayed * Math.exp(-IMPACT_WINDOW / 4), 9); // same turn, decayed
  });
});

describe("impactCeiling (atlas-measured reliable-turn bound)", () => {
  test("scales with speed (MAX_RELIABLE_TURN_RAD) and clamps to [0,1]", () => {
    expect(IMPACT.MAX_RELIABLE_TURN_RAD).toBeCloseTo(1.0, 9);
    // the fraction form is the SAME bound (asin(sin(1.0)) = 1.0) so every sealed
    // consumer of asin(CATCHABLE_REDIR_FRACTION) clamps at exactly the measured turn
    expect(Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION)).toBeCloseTo(IMPACT.MAX_RELIABLE_TURN_RAD, 9);
    expect(impactCeiling(0)).toBe(0); // no speed ⇒ no impact possible
    expect(impactCeiling(5)).toBeCloseTo(norm(5 * 1.0), 5); // ≈ 0.66 at VSTRONG 7.55
    expect(impactCeiling(100)).toBe(1); // ≫ very-strong ⇒ 1
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
