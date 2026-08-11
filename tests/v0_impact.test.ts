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
import { contactRedirArcPxAtLanding } from "../scripts/v0/core/substrate.ts";
import {
  LEGACY_IMPACT_AUTHORING_CONVERSION,
  beats,
  migrateImpact,
  withImpact,
} from "../scripts/v0/core/beats.ts";
import { constant } from "../scripts/v0/core/curves.ts";
import {
  GRAVITY,
  contactRedirArcPx,
  legacyNetRedirArcPx,
  type Sim,
} from "../scripts/v0/impact_support.ts";
import { scoreDriftReport } from "../scripts/v0/score.ts";
import {
  applyImpactCarrierRipple,
  applyImpactContactSegmentAcceleration,
  applyImpactCurveJointExtensions,
  applyImpactPostCaptureAcceleration,
  applyImpactWindowAcceleration,
  applyImpactWindowAccelerationAfterReference,
  applyImpactWindowAccelerationLaminate,
  impactActiveCarrierAttempt,
  impactActiveCarrierLaw,
  impactCarrierRippleActive,
  impactCarrierRippleLaw,
  impactCarrierRipplePhase,
  impactCommandDose,
  impactCommandLaw,
  impactCommandScope,
  impactCommandTarget,
  impactCurveJointExtensionLaw,
  impactSegmentDistributionForTargets,
  impactSegmentDistributionLaw,
  impactSegmentLaw,
  impactSegmentRefinement,
  normalPostCurveResolutionEligible,
  normalPostCurveResolutionLaw,
  postContactSegmentLengths,
  setImpactCarrierRippleRepairActive,
} from "../scripts/v0/arc_placement.ts";
import {
  compileHandoff,
  impactResponseAdmissionMode,
  responseRetainsCandidateContact,
  responseSafeImpactTransition,
} from "../scripts/v0/optimizer/handoff.ts";
import { resolutionSiblingHasNoAxisDebt } from "../scripts/v0/optimizer/sample.ts";
import {
  IMPACT,
  IMPACT_METRIC,
  IMPACT_RULER,
  IMPACT_WINDOW,
  impactCeiling,
  type Gap,
  type Spec,
  type TrackLine,
} from "../scripts/v0/types.ts";
import type { Detection } from "../scripts/lib/detector.ts";

/** Independent reference normalization (mirrors types.normImpact). */
const norm = (px: number) =>
  Math.max(0, Math.min(1, (px - IMPACT_RULER.SOFT) /
    (IMPACT_RULER.VERY_STRONG - IMPACT_RULER.SOFT)));
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

describe("impact geometry command calibration", () => {
  test("is exactly off by default and validates the experiment mode", () => {
    expect(impactCommandLaw({})).toBeNull();
    expect(impactCommandLaw({ LR_IMPACT_COMMAND_LAW: "off" })).toBeNull();
    expect(impactCommandTarget(0.6, {})).toBe(0.6);
    expect(impactCommandLaw({ LR_IMPACT_COMMAND_LAW: "inverse-baseline" }))
      .toBe("inverse-baseline");
    expect(() => impactCommandLaw({ LR_IMPACT_COMMAND_LAW: "per-case" })).toThrow();
    expect(impactCommandDose({})).toBe(1);
    expect(impactCommandDose({ LR_IMPACT_COMMAND_DOSE: "0.25" })).toBe(0.25);
    expect(impactCommandDose({ LR_IMPACT_COMMAND_DOSE: "-0.10" })).toBe(-0.1);
    expect(() => impactCommandDose({ LR_IMPACT_COMMAND_DOSE: "-1.01" })).toThrow();
    expect(() => impactCommandDose({ LR_IMPACT_COMMAND_DOSE: "1.01" })).toThrow();
    expect(() => impactCommandDose({ LR_IMPACT_COMMAND_DOSE: "quarter" })).toThrow();
    expect(impactCommandScope({})).toBe("both");
    expect(impactCommandScope({ LR_IMPACT_COMMAND_SCOPE: "current" })).toBe("current");
    expect(impactCommandScope({ LR_IMPACT_COMMAND_SCOPE: "next" })).toBe("next");
    expect(() => impactCommandScope({ LR_IMPACT_COMMAND_SCOPE: "local" })).toThrow();
  });

  test("inverts the frozen broad-baseline response and clamps physical bounds", () => {
    const environment = { LR_IMPACT_COMMAND_LAW: "inverse-baseline" };
    expect(impactCommandTarget(0.2, environment)).toBeCloseTo(0.31125, 12);
    expect(impactCommandTarget(0.6, environment)).toBeCloseTo(0.81125, 12);
    expect(impactCommandTarget(1, environment)).toBe(1);
    expect(impactCommandTarget(-0.2, environment)).toBe(0);
  });

  test("interpolates partial doses while dose zero is exactly neutral", () => {
    const quarter = {
      LR_IMPACT_COMMAND_LAW: "inverse-baseline",
      LR_IMPACT_COMMAND_DOSE: "0.25",
    };
    const offDose = {
      LR_IMPACT_COMMAND_LAW: "inverse-baseline",
      LR_IMPACT_COMMAND_DOSE: "0",
    };
    expect(impactCommandTarget(0.2, quarter)).toBeCloseTo(0.2278125, 12);
    expect(impactCommandTarget(0.6, quarter)).toBeCloseTo(0.6528125, 12);
    expect(impactCommandTarget(0.6, offDose)).toBe(0.6);
    expect(impactCommandTarget(-0.2, offDose)).toBe(-0.2);
    expect(impactCommandTarget(0.6, { LR_IMPACT_COMMAND_DOSE: "invalid" })).toBe(0.6);
    expect(impactCommandTarget(0.6, {
      LR_IMPACT_COMMAND_LAW: "inverse-baseline",
      LR_IMPACT_COMMAND_DOSE: "-0.10",
    })).toBeCloseTo(0.578875, 12);
  });
});

describe("impact-window active carrier", () => {
  test("is default-off, validates its law, and reserves one quarter after attempt zero", () => {
    expect(impactActiveCarrierLaw({})).toBeNull();
    expect(impactActiveCarrierLaw({ LR_IMPACT_ACTIVE_CARRIER: "off" })).toBeNull();
    expect(impactActiveCarrierLaw({ LR_IMPACT_ACTIVE_CARRIER: "window-quarter" }))
      .toBe("window-quarter");
    expect(impactActiveCarrierLaw({ LR_IMPACT_ACTIVE_CARRIER: "window-accel-pressure" }))
      .toBe("window-accel-pressure");
    expect(impactActiveCarrierLaw({
      LR_IMPACT_ACTIVE_CARRIER: "window-accel-laminate-pressure",
    })).toBe("window-accel-laminate-pressure");
    expect(impactActiveCarrierLaw({
      LR_IMPACT_ACTIVE_CARRIER: "window-accel-laminate-additive-pressure",
    })).toBe("window-accel-laminate-additive-pressure");
    expect(impactActiveCarrierLaw({
      LR_IMPACT_ACTIVE_CARRIER: "contact-segment-accel-pressure",
    })).toBe("contact-segment-accel-pressure");
    expect(impactActiveCarrierLaw({
      LR_IMPACT_ACTIVE_CARRIER: "contact-segment-additive-pressure",
    })).toBe("contact-segment-additive-pressure");
    expect(impactActiveCarrierLaw({
      LR_IMPACT_ACTIVE_CARRIER: "post-capture-accel-pressure",
    })).toBe("post-capture-accel-pressure");
    expect(() => impactActiveCarrierLaw({ LR_IMPACT_ACTIVE_CARRIER: "all" })).toThrow();
    const law = impactActiveCarrierLaw({ LR_IMPACT_ACTIVE_CARRIER: "window-quarter" });
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((attempt) =>
      impactActiveCarrierAttempt(attempt, law)))
      .toEqual([false, false, false, true, false, false, false, true]);

    const pressureLaw = impactActiveCarrierLaw({
      LR_IMPACT_ACTIVE_CARRIER: "window-accel-pressure",
    });
    const full = Array.from({ length: 128 }, (_, index) =>
      impactActiveCarrierAttempt(index, pressureLaw, 1));
    const half = Array.from({ length: 128 }, (_, index) =>
      impactActiveCarrierAttempt(index, pressureLaw, 0.5));
    expect(full.filter(Boolean).length).toBeGreaterThanOrEqual(28);
    expect(full.filter(Boolean).length).toBeLessThanOrEqual(36);
    expect(half.every((active, index) => !active || full[index])).toBe(true);
    expect(Array.from({ length: 16 }, (_, index) =>
      impactActiveCarrierAttempt(index, pressureLaw, 0)).some(Boolean)).toBe(false);
  });

  test("changes only material inside the speed-scaled window and preserves geometry", () => {
    const lines: TrackLine[] = [0, 1, 2, 3].map((index) => ({
      id: index,
      type: 0,
      x1: index * 10,
      y1: index,
      x2: (index + 1) * 10,
      y2: index + 1,
      flipped: index === 1,
      leftExtended: index === 1,
      rightExtended: index === 2,
    }));
    const accelerated = applyImpactWindowAcceleration(lines, 4);
    expect(accelerated.map((candidate) => candidate.type)).toEqual([1, 1, 1, 0]);
    for (let index = 0; index < lines.length; index++) {
      const original = lines[index];
      const candidate = accelerated[index];
      expect(candidate.id).toBe(original.id);
      if (index < 3) {
        expect(candidate).toMatchObject({
          x1: original.x2,
          y1: original.y2,
          x2: original.x1,
          y2: original.y1,
          flipped: !original.flipped,
          leftExtended: original.rightExtended,
          rightExtended: original.leftExtended,
        });
      } else {
        expect(candidate).toEqual(original);
      }
    }
    expect(lines.every((candidate) => candidate.type === 0)).toBe(true);
    expect(applyImpactWindowAcceleration(lines, 0)).toEqual(lines);

    const contactSegment = applyImpactContactSegmentAcceleration(lines);
    expect(contactSegment.map((candidate) => candidate.type)).toEqual([1, 0, 0, 0]);
    expect(contactSegment[0]).toMatchObject({
      x1: lines[0].x2,
      y1: lines[0].y2,
      x2: lines[0].x1,
      y2: lines[0].y1,
      flipped: !lines[0].flipped,
    });
    expect(contactSegment.slice(1)).toEqual(lines.slice(1));

    const postCapture = applyImpactPostCaptureAcceleration(lines, 4);
    expect(postCapture.map((candidate) => candidate.type)).toEqual([0, 1, 1, 0]);
    expect(postCapture[0]).toEqual(lines[0]);
    expect(postCapture[3]).toEqual(lines[3]);
  });

  test("preserves a complete catch prefix and accelerates only after its reference", () => {
    const lines: TrackLine[] = [
      { id: 40, type: 0, x1: -8, y1: 0, x2: 0, y2: 0, flipped: false },
      { id: 41, type: 0, x1: 0, y1: 0, x2: 8, y2: 0, flipped: false },
      { id: 42, type: 0, x1: 8, y1: 0, x2: 16, y2: 0, flipped: false },
    ];
    const accelerated = applyImpactWindowAccelerationAfterReference(
      lines,
      { x: .01, y: 0 },
      2,
    );
    expect(accelerated[0]).toEqual(lines[0]);
    expect(accelerated.slice(1).map((line) => line.type)).toEqual([1, 1]);
    expect(accelerated.map((line) => line.id)).toEqual([40, 41, 42]);
    expect(accelerated[1]).toMatchObject({ x1: 8, y1: 0, x2: 0, y2: 0, flipped: true });
  });

  test("builds a fixed two-layer active laminate behind the native surface", () => {
    const source = [
      line(10, 0, 0, 10, 0),
      line(11, 10, 0, 20, 0),
      line(12, 20, 0, 30, 0),
    ].map((candidate) => ({
      ...candidate,
      type: 0 as const,
      flipped: false,
      leftExtended: false,
      rightExtended: false,
    }));
    const laminate = applyImpactWindowAccelerationLaminate(source, 4);
    expect(laminate).toHaveLength(6);
    expect(laminate.map((candidate) => candidate.id)).toEqual([10, 11, 12, 13, 14, 15]);
    for (let index = 0; index < 3; index++) {
      const inner = laminate[index * 2]!;
      const outer = laminate[index * 2 + 1]!;
      expect(inner.type).toBe(1);
      expect(outer.type).toBe(1);
      expect(outer.id).toBeGreaterThan(inner.id);
      expect(Math.abs(inner.y1 - outer.y1)).toBeCloseTo(0.1, 12);
      expect(Math.abs(inner.y2 - outer.y2)).toBeCloseTo(0.1, 12);
    }
  });
});

describe("impact segment command calibration", () => {
  test("is exactly off by default and validates the high-ask arms", () => {
    expect(impactSegmentLaw({})).toBeNull();
    expect(impactSegmentLaw({ LR_IMPACT_SEGMENT_LAW: "off" })).toBeNull();
    expect(impactSegmentLaw({ LR_IMPACT_SEGMENT_LAW: "base-one" })).toBe("base-one");
    expect(impactSegmentLaw({ LR_IMPACT_SEGMENT_LAW: "high-ask" })).toBe("high-ask");
    expect(impactSegmentLaw({ LR_IMPACT_SEGMENT_LAW: "high-ask-strong" }))
      .toBe("high-ask-strong");
    expect(impactSegmentLaw({ LR_IMPACT_SEGMENT_LAW: "high-ask-dense-history" }))
      .toBe("high-ask-dense-history");
    expect(impactSegmentLaw({ LR_IMPACT_SEGMENT_LAW: "high-ask-detector-history" }))
      .toBe("high-ask-detector-history");
    expect(impactSegmentLaw({ LR_IMPACT_SEGMENT_LAW: "atlas-window" }))
      .toBe("atlas-window");
    expect(() => impactSegmentLaw({ LR_IMPACT_SEGMENT_LAW: "global" })).toThrow();
  });

  test("keeps tolerance-based post-curve resolution default-off", () => {
    expect(normalPostCurveResolutionLaw({})).toBeNull();
    expect(normalPostCurveResolutionLaw({ LR_NORMAL_POST_CURVE_RESOLUTION: "off" }))
      .toBeNull();
    expect(normalPostCurveResolutionLaw({ LR_NORMAL_POST_CURVE_RESOLUTION: "tolerance" }))
      .toBe("tolerance");
    expect(normalPostCurveResolutionLaw({
      LR_NORMAL_POST_CURVE_RESOLUTION: "tolerance-additive",
    })).toBe("tolerance-additive");
    expect(normalPostCurveResolutionLaw({
      LR_NORMAL_POST_CURVE_RESOLUTION: "tolerance-native-span",
    })).toBe("tolerance-native-span");
    expect(() => normalPostCurveResolutionLaw({
      LR_NORMAL_POST_CURVE_RESOLUTION: "duration-bin",
    })).toThrow();
  });

  test("native-span resolution leaves the impact-frontloaded carrier exact", () => {
    expect(normalPostCurveResolutionEligible(0.6, "tolerance-native-span")).toBe(true);
    expect(normalPostCurveResolutionEligible(-0.6, "tolerance-native-span")).toBe(true);
    expect(normalPostCurveResolutionEligible(-0.600001, "tolerance-native-span")).toBe(false);
    expect(normalPostCurveResolutionEligible(-1.6, "tolerance")).toBe(true);
    expect(normalPostCurveResolutionEligible(0, null)).toBe(false);
  });

  test("additive resolution requires strict exact improvement without per-axis debt", () => {
    const targets = { air: 0.5, impact: 0.7, speed: 0.4 };
    const nominal = { achieved: { air: 0.6, impact: 0.5, speed: 0.3 } };
    expect(resolutionSiblingHasNoAxisDebt(targets, nominal, {
      achieved: { air: 0.58, impact: 0.55, speed: 0.32 },
    })).toBe(true);
    expect(resolutionSiblingHasNoAxisDebt(targets, nominal, {
      achieved: { air: 0.61, impact: 0.55, speed: 0.32 },
    })).toBe(false);
    expect(resolutionSiblingHasNoAxisDebt(targets, nominal, nominal)).toBe(false);
  });

  test("window-density redistribution is default-off and preserves line budget", () => {
    expect(impactSegmentDistributionLaw({})).toBeNull();
    expect(impactSegmentDistributionLaw({ LR_IMPACT_SEGMENT_DISTRIBUTION: "off" }))
      .toBeNull();
    expect(impactSegmentDistributionLaw({ LR_IMPACT_SEGMENT_DISTRIBUTION: "window-dense" }))
      .toBe("window-dense");
    expect(impactSegmentDistributionLaw({ LR_IMPACT_SEGMENT_DISTRIBUTION: "window-dense-strong" }))
      .toBe("window-dense-strong");
    expect(impactSegmentDistributionLaw({ LR_IMPACT_SEGMENT_DISTRIBUTION: "curve-equal-turn" }))
      .toBe("curve-equal-turn");
    expect(impactSegmentDistributionLaw({
      LR_IMPACT_SEGMENT_DISTRIBUTION: "curve-equal-turn-low-air",
    })).toBe("curve-equal-turn-low-air");
    expect(() => impactSegmentDistributionLaw({ LR_IMPACT_SEGMENT_DISTRIBUTION: "global" }))
      .toThrow();

    const base = postContactSegmentLengths(120, 10, 10, null);
    const dense = postContactSegmentLengths(120, 10, 10, "window-dense");
    const strong = postContactSegmentLengths(120, 10, 10, "window-dense-strong");
    expect(base).toHaveLength(10);
    expect(dense).toHaveLength(10);
    expect(strong).toHaveLength(10);
    expect(base.reduce((sum, value) => sum + value, 0)).toBeCloseTo(120, 12);
    expect(dense.reduce((sum, value) => sum + value, 0)).toBeCloseTo(120, 12);
    expect(strong.reduce((sum, value) => sum + value, 0)).toBeCloseTo(120, 12);
    expect(dense[0]).toBeLessThan(base[0]);
    expect(strong[0]).toBeLessThanOrEqual(dense[0]);
    expect(dense.at(-1)).toBeGreaterThan(base.at(-1)!);
  });

  test("curve-joint extension defaults to incoming continuity and changes only internal domains", () => {
    expect(impactCurveJointExtensionLaw({})).toBe("incoming-tangent");
    expect(impactCurveJointExtensionLaw({ LR_IMPACT_CURVE_JOINT_EXTENSION: "off" }))
      .toBeNull();
    expect(impactCurveJointExtensionLaw({
      LR_IMPACT_CURVE_JOINT_EXTENSION: "incoming-tangent",
    })).toBe("incoming-tangent");
    expect(impactCurveJointExtensionLaw({
      LR_IMPACT_CURVE_JOINT_EXTENSION: "outgoing-tangent",
    })).toBe("outgoing-tangent");
    expect(impactCurveJointExtensionLaw({ LR_IMPACT_CURVE_JOINT_EXTENSION: "both" }))
      .toBe("both");
    expect(() => impactCurveJointExtensionLaw({
      LR_IMPACT_CURVE_JOINT_EXTENSION: "case",
    })).toThrow();

    const source: TrackLine[] = [
      { ...line(10, 0, 0, 10, 0), type: 0, flipped: false,
        leftExtended: false, rightExtended: false },
      { ...line(11, 10, 0, 20, 2), type: 0, flipped: false,
        leftExtended: false, rightExtended: false },
      { ...line(12, 20, 2, 30, 6), type: 0, flipped: false,
        leftExtended: false, rightExtended: false },
    ];
    const incoming = applyImpactCurveJointExtensions(source, "incoming-tangent");
    const outgoing = applyImpactCurveJointExtensions(source, "outgoing-tangent");
    const both = applyImpactCurveJointExtensions(source, "both");
    expect(incoming.map(({ leftExtended, rightExtended }) =>
      [leftExtended, rightExtended])).toEqual([
      [false, true], [false, true], [false, false],
    ]);
    expect(outgoing.map(({ leftExtended, rightExtended }) =>
      [leftExtended, rightExtended])).toEqual([
      [false, false], [true, false], [true, false],
    ]);
    expect(both.map(({ leftExtended, rightExtended }) =>
      [leftExtended, rightExtended])).toEqual([
      [false, true], [true, true], [true, false],
    ]);
    for (const candidate of [incoming, outgoing, both]) {
      expect(candidate.map(({ leftExtended: _l, rightExtended: _r, ...rest }) => rest))
        .toEqual(source.map(({ leftExtended: _l, rightExtended: _r, ...rest }) => rest));
    }
    expect(source.every((entry) => !entry.leftExtended && !entry.rightExtended)).toBe(true);
  });

  test("equal-turn low-air eligibility is source-blind and exact at its authored boundary", () => {
    expect(impactSegmentDistributionForTargets(
      { air: 0.39, impact: 0.7 },
      "curve-equal-turn-low-air",
    )).toBe("curve-equal-turn");
    expect(impactSegmentDistributionForTargets(
      { air: 0.4, impact: 0.7 },
      "curve-equal-turn-low-air",
    )).toBeNull();
    expect(impactSegmentDistributionForTargets(
      { impact: 0.7 },
      "curve-equal-turn-low-air",
    )).toBeNull();
    expect(impactSegmentDistributionForTargets(
      { air: 0.7, impact: 0.7 },
      "curve-equal-turn",
    )).toBe("curve-equal-turn");
  });

  test("equal-turn redistribution preserves a front-loaded curve with the native line budget", () => {
    const base = postContactSegmentLengths(120, 10, 10, null, -1.6);
    const equalTurn = postContactSegmentLengths(120, 10, 10, "curve-equal-turn", -1.6);
    const unbiased = postContactSegmentLengths(120, 10, 10, "curve-equal-turn", 0);
    expect(equalTurn).toHaveLength(base.length);
    expect(equalTurn.every((value) => value > 0)).toBe(true);
    expect(equalTurn.reduce((sum, value) => sum + value, 0)).toBeCloseTo(120, 12);
    expect(equalTurn[0]).toBeLessThan(equalTurn.at(-1)!);
    expect(unbiased).toEqual(base);

  });

  test("carrier ripple is default-off and preserves its native continuation boundary", () => {
    expect(impactCarrierRippleLaw({})).toBeNull();
    expect(impactCarrierRippleLaw({ LR_IMPACT_CARRIER_RIPPLE: "off" })).toBeNull();
    expect(impactCarrierRippleLaw({ LR_IMPACT_CARRIER_RIPPLE: "half" })).toBe("half");
    expect(impactCarrierRippleLaw({ LR_IMPACT_CARRIER_RIPPLE: "full" })).toBe("full");
    expect(impactCarrierRippleLaw({ LR_IMPACT_CARRIER_RIPPLE: "aligned-half" }))
      .toBe("aligned-half");
    expect(impactCarrierRippleLaw({ LR_IMPACT_CARRIER_RIPPLE: "active-half" }))
      .toBe("active-half");
    expect(() => impactCarrierRippleLaw({ LR_IMPACT_CARRIER_RIPPLE: "case" })).toThrow();
    expect(impactCarrierRipplePhase({})).toBe("all");
    expect(impactCarrierRipplePhase({ LR_IMPACT_CARRIER_RIPPLE_PHASE: "repair" }))
      .toBe("repair");
    expect(() => impactCarrierRipplePhase({ LR_IMPACT_CARRIER_RIPPLE_PHASE: "post" }))
      .toThrow();
    setImpactCarrierRippleRepairActive(false);
    expect(impactCarrierRippleActive("all")).toBe(true);
    expect(impactCarrierRippleActive("repair")).toBe(false);
    setImpactCarrierRippleRepairActive(true);
    expect(impactCarrierRippleActive("repair")).toBe(true);
    setImpactCarrierRippleRepairActive(false);

    const carrier = Array.from({ length: 7 }, (_, index) =>
      line(index + 1, index * 10, 0, (index + 1) * 10, 0)
    );
    expect(applyImpactCarrierRipple(carrier, .6, 10, 0, "half")).toEqual(carrier);
    const rippled = applyImpactCarrierRipple(carrier, .6, 10, 2, "half");
    expect(rippled[0].x1).toBe(0);
    expect(rippled[0].y1).toBe(0);
    expect(rippled[4].x2).toBe(50);
    expect(rippled[4].y2).toBe(0);
    expect(rippled.slice(5)).toEqual(carrier.slice(5));
    expect(rippled[0].y2).not.toBeCloseTo(0);
    for (let index = 1; index < rippled.length; index++) {
      expect(rippled[index - 1].x2).toBeCloseTo(rippled[index].x1, 12);
      expect(rippled[index - 1].y2).toBeCloseTo(rippled[index].y1, 12);
    }
    const active = applyImpactCarrierRipple(carrier, .6, 10, 2, "active-half");
    expect(active.slice(0, 5).every((candidate) => candidate.type === 1)).toBe(true);
    expect(active.slice(5)).toEqual(carrier.slice(5));
    for (let index = 0; index < 5; index++) {
      expect(active[index]).toMatchObject({
        x1: rippled[index].x2,
        y1: rippled[index].y2,
        x2: rippled[index].x1,
        y2: rippled[index].y1,
        flipped: !rippled[index].flipped,
      });
    }
  });

  test("preserves low asks and brackets extra high-ask subdivision", () => {
    expect(impactSegmentRefinement(.5, null)).toBe(2);
    expect(impactSegmentRefinement(.5, "base-one")).toBe(1.5);
    expect(impactSegmentRefinement(.5, "high-ask")).toBe(2);
    expect(impactSegmentRefinement(.6, "high-ask-strong")).toBeCloseTo(2.2, 12);
    expect(impactSegmentRefinement(.85, "high-ask")).toBeCloseTo(3.55, 12);
    expect(impactSegmentRefinement(.85, "high-ask-strong")).toBeCloseTo(4.4, 12);
    expect(impactSegmentRefinement(.5, "atlas-window", null, null, 16)).toBe(2);
    expect(impactSegmentRefinement(.5, "atlas-window", null, null, 17)).toBe(2.5);
    expect(impactSegmentRefinement(.5, "atlas-window", null, null, 24)).toBe(2.5);
    expect(impactSegmentRefinement(.5, "atlas-window", null, null, 25)).toBe(2);
    const incoherent = {
      status: "ready" as const,
      frameCount: 7,
      collectiveTurnDeg: 2,
      collectiveSpeedDeltaPxPerFrame: 0,
      accelerationResidualFromGravityPxPerFrame2: 0,
      poseTurnDeg: 12,
      angularVelocityDeltaDegPerFrame: 0,
      rmsPairDistanceChangePx: 0,
      rmsRelativeVelocityChangePxPerFrame: 0,
    };
    expect(impactSegmentRefinement(
      .85,
      "high-ask-dense-history",
      18,
      incoherent,
    )).toBeCloseTo(4.4, 12);
    expect(impactSegmentRefinement(
      .85,
      "high-ask-dense-history",
      28,
      incoherent,
    )).toBeCloseTo(2.7, 12);
    expect(impactSegmentRefinement(
      .85,
      "high-ask-dense-history",
      18,
      { ...incoherent, poseTurnDeg: 3 },
    )).toBeCloseTo(2.7, 12);
    expect(impactSegmentRefinement(
      .85,
      "high-ask-detector-history",
      12,
      incoherent,
    )).toBeCloseTo(4.4, 12);
    expect(impactSegmentRefinement(
      .85,
      "high-ask-detector-history",
      13,
      incoherent,
    )).toBeCloseTo(2.7, 12);
  });
});

describe("impact native-response admission", () => {
  test("is default-off and validates only the bounded exact screens", () => {
    expect(impactResponseAdmissionMode({})).toBeNull();
    expect(impactResponseAdmissionMode({ LR_IMPACT_RESPONSE_ADMISSION: "off" })).toBeNull();
    expect(impactResponseAdmissionMode({ LR_IMPACT_RESPONSE_ADMISSION: "exact-safe-8" }))
      .toBe("exact-safe-8");
    expect(impactResponseAdmissionMode({ LR_IMPACT_RESPONSE_ADMISSION: "exact-safe-all" }))
      .toBe("exact-safe-all");
    expect(impactResponseAdmissionMode({ LR_IMPACT_RESPONSE_ADMISSION: "exact-safe-8-admit" }))
      .toBe("exact-safe-8-admit");
    expect(impactResponseAdmissionMode({ LR_IMPACT_RESPONSE_ADMISSION: "exact-safe-8-repair" }))
      .toBe("exact-safe-8-repair");
    expect(impactResponseAdmissionMode({ LR_IMPACT_RESPONSE_ADMISSION: "exact-contact-all-repair" }))
      .toBe("exact-contact-all-repair");
    expect(impactResponseAdmissionMode({ LR_IMPACT_RESPONSE_ADMISSION: "model-exact-contact-repair" }))
      .toBe("model-exact-contact-repair");
    expect(impactResponseAdmissionMode({ LR_IMPACT_RESPONSE_ADMISSION: "cached-contact-repair" }))
      .toBe("cached-contact-repair");
    expect(impactResponseAdmissionMode({ LR_IMPACT_RESPONSE_ADMISSION: "same-speed-tail-repair" }))
      .toBe("same-speed-tail-repair");
    expect(impactResponseAdmissionMode({ LR_IMPACT_RESPONSE_ADMISSION: "model-safe-08-admit" }))
      .toBe("model-safe-08-admit");
    expect(impactResponseAdmissionMode({ LR_IMPACT_RESPONSE_ADMISSION: "model-safe-08-post" }))
      .toBe("model-safe-08-post");
    expect(() => impactResponseAdmissionMode({ LR_IMPACT_RESPONSE_ADMISSION: "unsafe" }))
      .toThrow();
  });

  test("requires every measured response debt to remain inside its tolerance", () => {
    const incumbent = {
      collectiveSpeedDelta: -.2,
      rmsPairDistanceChange: .3,
      rmsRelativeVelocityChange: .4,
      absPhaseSlipDeg: 5,
      candidateOwnedSledContactFrames: 5,
      candidateOwnedSledUpdateCount: 20,
      candidateOwnedSledPointCoverage: 2,
    };
    expect(responseSafeImpactTransition(incumbent, {
      collectiveSpeedDelta: -.25,
      rmsPairDistanceChange: .35,
      rmsRelativeVelocityChange: .45,
      absPhaseSlipDeg: 8,
      candidateOwnedSledContactFrames: 5,
      candidateOwnedSledUpdateCount: 20,
      candidateOwnedSledPointCoverage: 2,
    })).toBe(true);
    expect(responseSafeImpactTransition(incumbent, {
      collectiveSpeedDelta: -.251,
      rmsPairDistanceChange: .3,
      rmsRelativeVelocityChange: .4,
      absPhaseSlipDeg: 5,
      candidateOwnedSledContactFrames: 5,
      candidateOwnedSledUpdateCount: 20,
      candidateOwnedSledPointCoverage: 2,
    })).toBe(false);
    expect(responseSafeImpactTransition(incumbent, {
      collectiveSpeedDelta: -.2,
      rmsPairDistanceChange: .351,
      rmsRelativeVelocityChange: .4,
      absPhaseSlipDeg: 5,
      candidateOwnedSledContactFrames: 5,
      candidateOwnedSledUpdateCount: 20,
      candidateOwnedSledPointCoverage: 2,
    })).toBe(false);
  });

  test("retains contact frames, exact sled updates, and point coverage", () => {
    const incumbent = {
      collectiveSpeedDelta: -.2,
      rmsPairDistanceChange: .3,
      rmsRelativeVelocityChange: .4,
      absPhaseSlipDeg: 5,
      candidateOwnedSledContactFrames: 5,
      candidateOwnedSledUpdateCount: 20,
      candidateOwnedSledPointCoverage: 2,
    };
    expect(responseRetainsCandidateContact(incumbent, { ...incumbent })).toBe(true);
    expect(responseRetainsCandidateContact(incumbent, {
      ...incumbent,
      candidateOwnedSledUpdateCount: 19,
    })).toBe(false);
    expect(responseRetainsCandidateContact(incumbent, {
      ...incumbent,
      candidateOwnedSledContactFrames: 4,
    })).toBe(false);
    expect(responseRetainsCandidateContact(incumbent, {
      ...incumbent,
      candidateOwnedSledPointCoverage: 1,
    })).toBe(false);
  });
});

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
  // gapLines are intentionally varied/empty: scored impact is CoM-only.
  const call = (det: Detection, g: Gap = gap, gapLines: TrackLine[] = []) =>
    measureImpact({ det, gap: g, gapLines, rangeEndFrame: g.endFrame });

  test("straight glide (no heading change) ⇒ raw impulse 0 ⇒ impact 0", () => {
    const det = detFor(10, 20, () => ({ x: 9, y: 4 })); // constant velocity → no turn
    expect(call(det)).toBeCloseTo(0, 6);
  });

  test("single redirection ⇒ midpoint-speed·|Δθ|, felt-normalized", () => {
    // Equal speeds make the midpoint speed 3.
    const det = detFor(10, 20, (f) => (f <= 9 ? { x: 3, y: 0 } : { x: 0, y: 3 }));
    expect(call(det)).toBeCloseTo(norm(3 * (Math.PI / 2)), 5);
  });

  test("uses the arithmetic midpoint of unequal consecutive speeds", () => {
    // Incoming speed 2, landing-frame speed 4, turn 0.5 rad:
    // 0.5 × (2 + 4) × 0.5 = 1.5 px/frame.
    const det = detFor(10, 20, (f) => f <= 9 ? vel(0, 2) : vel(0.5, 4));
    expect(contactRedirArcPxAtLanding(det, 10)).toBeCloseTo(1.5, 12);
    expect(call(det)).toBeCloseTo(norm(1.5), 12);
  });

  test("the right boundary is inclusive at landing + IMPACT_WINDOW", () => {
    const atBoundary = detFor(10, 20, (f) =>
      f < 10 + IMPACT_WINDOW ? vel(0, 4) : vel(0.5, 4));
    const afterBoundary = detFor(10, 20, (f) =>
      f <= 10 + IMPACT_WINDOW ? vel(0, 4) : vel(0.5, 4));
    expect(contactRedirArcPxAtLanding(atBoundary, 10)).toBeCloseTo(2, 12);
    expect(contactRedirArcPxAtLanding(afterBoundary, 10)).toBeCloseTo(0, 12);
  });

  test("a missing in-window velocity bridges from the previous valid sample", () => {
    const det = detFor(10, 20, (f) => f <= 11 ? vel(0, 5) : vel(0.4, 5));
    det.measurements.velocity[11] = undefined as never;
    // f=11 contributes nothing and does not invent a velocity. At f=12 the
    // loop compares with the last valid sample at f=10, preserving the 0.4 turn.
    expect(contactRedirArcPxAtLanding(det, 10)).toBeCloseTo(2, 12);
  });

  test("falls back to the landing velocity when the pre-landing sample is missing", () => {
    const det = detFor(10, 20, (f) => f <= 10 ? vel(0, 5) : vel(0.4, 5));
    det.measurements.velocity[9] = undefined as never;
    // The landing sample initializes `prev`; it is not counted against itself.
    expect(contactRedirArcPxAtLanding(det, 10)).toBeCloseTo(2, 12);
  });

  test("returns undefined when neither incoming sample is available", () => {
    const det = detFor(10, 20, () => vel(0, 5));
    det.measurements.velocity[9] = undefined as never;
    det.measurements.velocity[10] = undefined as never;
    expect(contactRedirArcPxAtLanding(det, 10)).toBeUndefined();
    expect(call(det)).toBeUndefined();
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
    const none = call(det, gap, []); // no owned line ⇒ STILL a value
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

  test("matches a detector landing one frame after the authored contact", () => {
    const det = detFor(11, 20, (f) => f <= 10 ? vel(0, 3) : vel(Math.PI / 2, 3));
    expect(call(det)).toBeCloseTo(norm(3 * Math.PI / 2), 12);
  });

  test("window truncates at the detection end (no crash)", () => {
    // landing near the last frame: the window is cut at the detection end (frame 12),
    // so only the single touchdown bend at frame 10 is accumulated — no crash, and
    // the truncated tail is silently absent (accumulation can only under-read).
    const det = detFor(10, 13, (f) => (f <= 9 ? { x: 3, y: 0 } : { x: 0, y: 3 }));
    expect(call(det)).toBeCloseTo(norm(3 * (Math.PI / 2)), 5);
  });

  test("zero and negative windows include only the touchdown step", () => {
    const det = detFor(10, 20, (f) =>
      f <= 9 ? vel(0, 4) : f === 10 ? vel(0.25, 4) : vel(0.75, 4));
    expect(contactRedirArcPxAtLanding(det, 10, 0)).toBeCloseTo(1, 12);
    expect(contactRedirArcPxAtLanding(det, 10, -5)).toBeCloseTo(1, 12);
  });

  test("gated: undefined when the beat did not author impact", () => {
    const det = detFor(10, 20, () => ({ x: 9, y: 4 }));
    expect(call(det, { ...gap, targets: {} })).toBeUndefined();
  });

  test("undefined when no landing event is near the contact", () => {
    const det = detFor(30, 40, () => ({ x: 9, y: 4 })); // landing 30, gap.endFrame 10
    expect(call(det)).toBeUndefined();
  });

  test("SOFT=0 floor: a small impulse reads small & linear (no dead-zone)", () => {
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

describe("production impact ruler identity", () => {
  test("pins the shipped defaults when study overrides are absent", () => {
    if (process.env.LR_IMPACT_SOFT === undefined) expect(IMPACT_RULER.SOFT).toBe(0);
    if (process.env.LR_IMPACT_VSTRONG === undefined) {
      expect(IMPACT_RULER.VERY_STRONG).toBe(7.55);
    }
    expect(IMPACT_METRIC).toMatchObject({
      id: "contact-redirection-impulse",
      version: 1,
      rawUnit: "px/frame",
      windowFrames: 6,
      soft: IMPACT_RULER.SOFT,
      veryStrong: IMPACT_RULER.VERY_STRONG,
    });
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
    // Ballistic gravity bending inside the window: the legacy net formula reads
    // a turn; the contacted-only impulse reads 0.
    const airborne = new Array(20).fill(true);
    const sim = asSim(flatDet((f) => (f < lf ? { x: 10, y: 0 } : { x: 10, y: GRAVITY * (f - (lf - 1)) }), airborne));
    expect(contactRedirArcPx(sim, lf)).toBeCloseTo(0, 9);
    expect(legacyNetRedirArcPx(sim, lf)).toBeGreaterThan(0);
  });

  test("bend-then-unbend: accumulated keeps both bends, net redirArc cancels", () => {
    // Heading 0 → 0.5 rad → back to 0 inside the window, speed 10 throughout.
    const sim = asSim(flatDet((f) => (f < lf || f > 12 ? { x: 10, y: 0 } : vel(0.5, 10))));
    expect(contactRedirArcPx(sim, lf)).toBeCloseTo(10 * 0.5 * 2, 9); // both bends count
    expect(legacyNetRedirArcPx(sim, lf)).toBeCloseTo(0, 9); // net endpoint turn cancelled
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
  test("old authored values use the single affine compatibility conversion", () => {
    if (process.env.LR_IMPACT_MIGRATE_SOFT === undefined &&
        process.env.LR_IMPACT_MIGRATE_SPAN === undefined) {
      expect(LEGACY_IMPACT_AUTHORING_CONVERSION).toEqual({ soft: 0.2, span: 0.8 });
      expect(migrateImpact(0.2)).toBe(0);
      expect(migrateImpact(0.45)).toBeCloseTo(0.3125, 12);
      expect(migrateImpact(1)).toBe(1);
    }
  });

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
