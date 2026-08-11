import { describe, expect, test } from "vitest";
import { beginEnvFlagEpoch } from "../scripts/v0/env_flags.ts";
import {
  brakeCandidateCount,
  compareRepairTerminalGeometry,
  handoffCandidatePool,
  handoffAxisOvershootPenalty,
  handoffSampleCount,
  hasStartFeasibilityLookahead,
  impactRepairInsuranceMode,
  impactResponseAdmissionMode,
  prioritizeRepairTargetOptions,
  repairRestartCeilingFrames,
  repairSuffixSearchPolicy,
  selectAffordableRepairTarget,
  selectRepairRestart,
  spliceRepairCostToEnd,
  shouldOfferBrakeCandidates,
  shouldAttemptNearTailCompletion,
  shortGapRescueCandidateCount,
  startAngles,
  startSpeedAnchors,
  targetStartAngle,
  usesHighSpeedStartOvershootScoring,
  usesSparseContactCadence,
} from "../scripts/v0/optimizer/handoff.ts";
import {
  BUDGET_ESTIMATOR_MODEL,
  budgetEstimateInterval,
  estimateRemainingBudgetWork,
  type BudgetEstimatorModelArtifact,
} from "../scripts/v0/optimizer/budget_estimator.ts";
import {
  candidateOffBeatGateEndFrame,
  releaseSpeedPenalty,
  releaseStateFrame,
  translateTrackLines,
} from "../scripts/v0/core/candidate.ts";
import {
  arcPlacementMode,
  impactSupportWindowStrength,
  recordArcPlacementDirectFailure,
  resetArcPlacementStats,
  sampleArcParamsRngDraws,
  sampleArcPlacementGeometry,
  setImpactProfilePressures,
  snapshotArcPlacementStats,
  wasLastGeometryImpactTemplate,
} from "../scripts/v0/arc_placement.ts";
import { authoredSpeedToPx, SPEED_RULER, type Gap, type TrackLine } from "../scripts/v0/types.ts";
import type { SearchNode } from "../scripts/v0/optimizer/node.ts";

function gap(index: number, startFrame: number, endFrame: number, endsWithContact = true): Gap {
  return { index, startFrame, endFrame, endsWithContact, targets: {} };
}

function contactGaps(count: number): Gap[] {
  return Array.from({ length: count }, (_, index) => gap(index, index * 20, (index + 1) * 20));
}

function nodeAt(gapIndex: number, hasCommittedCatch = gapIndex > 0): SearchNode {
  return {
    gapIndex,
    prefixFits: hasCommittedCatch
      ? [{} as NonNullable<SearchNode["prefixFits"][number]>]
      : [],
    prefixEngine: null,
    prefixNextLineId: 1,
    cumulativeCost: 0,
    _candidatesCache: null,
  };
}

function targetState(speed = Math.hypot(8, 2), angleDeg = 14) {
  return {
    sledX: 100,
    sledY: 50,
    velocity: {
      x: Math.cos((angleDeg * Math.PI) / 180) * speed,
      y: Math.sin((angleDeg * Math.PI) / 180) * speed,
    },
    speed,
    angleDeg,
  };
}

function linesFromGeometry(geometry: ReturnType<typeof sampleArcPlacementGeometry>): TrackLine[] {
  return geometry.lines;
}

function totalLineLength(lines: TrackLine[]): number {
  return lines.reduce((sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1), 0);
}

function totalSignedTurnDeg(lines: TrackLine[]): number {
  let prev: number | null = null;
  let turn = 0;
  for (const line of lines) {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    if (dx === 0 && dy === 0) continue;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (prev !== null) {
      let delta = (angle - prev) % 360;
      if (delta > 180) delta -= 360;
      if (delta <= -180) delta += 360;
      turn += delta;
    }
    prev = angle;
  }
  return turn;
}

describe("handoff policy boundaries", () => {
  test("keeps the native impact-window support floor default-off", () => {
    expect(impactSupportWindowStrength({})).toBe(0);
    expect(impactSupportWindowStrength({ LR_IMPACT_SUPPORT_WINDOW: "off" })).toBe(0);
    expect(impactSupportWindowStrength({ LR_IMPACT_SUPPORT_WINDOW: "full" })).toBe(1);
    expect(() => impactSupportWindowStrength({ LR_IMPACT_SUPPORT_WINDOW: "half" })).toThrow();
  });

  test("keeps same-speed impact repair insurance default-off and validates its mode", () => {
    expect(impactRepairInsuranceMode({})).toBeNull();
    expect(impactRepairInsuranceMode({ LR_IMPACT_REPAIR_INSURANCE: "off" })).toBeNull();
    expect(impactRepairInsuranceMode({ LR_IMPACT_REPAIR_INSURANCE: "1" })).toBe("same-speed");
    expect(impactRepairInsuranceMode({ LR_IMPACT_REPAIR_INSURANCE: "same-speed" }))
      .toBe("same-speed");
    expect(() => impactRepairInsuranceMode({ LR_IMPACT_REPAIR_INSURANCE: "winner-take-all" }))
      .toThrow();
  });

  test("keeps the active same-speed repair interaction default-off", () => {
    expect(impactResponseAdmissionMode({})).toBeNull();
    expect(impactResponseAdmissionMode({ LR_IMPACT_RESPONSE_ADMISSION: "off" })).toBeNull();
    expect(impactResponseAdmissionMode({
      LR_IMPACT_RESPONSE_ADMISSION: "same-speed-active-tail-repair",
    })).toBe("same-speed-active-tail-repair");
    expect(() => impactResponseAdmissionMode({
      LR_IMPACT_RESPONSE_ADMISSION: "active-repair-dose-walk",
    })).toThrow();
  });

  test("compares repair alternatives by arc geometry rather than object identity", () => {
    const arc = (x2: number) => ({
      lines: [{
        id: 1,
        type: 0,
        x1: 0,
        y1: 0,
        x2,
        y2: 1,
        flipped: false,
        leftExtended: false,
        rightExtended: false,
      }],
    }) as any;
    const identical = compareRepairTerminalGeometry(
      [arc(1), arc(2), null],
      [arc(1), arc(2), null],
      1,
    );
    expect(identical).toEqual({
      compared_gap_count: 3,
      first_divergent_gap_index: null,
      divergent_gap_count: 0,
      divergent_suffix_gap_count: 0,
      terminal_geometry_identical: true,
    });
    expect(compareRepairTerminalGeometry(
      [arc(1), arc(2), arc(3)],
      [arc(1), arc(20), arc(30)],
      1,
    )).toEqual({
      compared_gap_count: 3,
      first_divergent_gap_index: 1,
      divergent_gap_count: 2,
      divergent_suffix_gap_count: 2,
      terminal_geometry_identical: false,
    });
  });

  test("candidate pool has no contact-count regime cliff", () => {
    const formerCliffCounts = [29, 30, 31, 60, 61, 77];
    expect(formerCliffCounts.map(() => handoffCandidatePool())).toEqual([5, 5, 5, 5, 5, 5]);
  });

  test("sample schedule uses one unified quality breadth", () => {
    expect(handoffSampleCount()).toBe(32);
  });

  test("final contact off-beat gate covers the scorer-visible rideout tail", () => {
    const contacts = [20, 40, 70];
    expect(candidateOffBeatGateEndFrame(gap(1, 20, 40), 40, contacts)).toBe(40);
    expect(candidateOffBeatGateEndFrame(gap(2, 40, 70), 70, contacts)).toBe(90);
    expect(candidateOffBeatGateEndFrame(gap(2, 40, 70, false), 80, contacts)).toBe(80);
    expect(candidateOffBeatGateEndFrame(gap(2, 40, 70), 95, contacts)).toBe(95);
  });

  test("quality candidate override controls the unified breadth", () => {
    const previousQuality = process.env.LR_QUALITY_NCAND;
    try {
      process.env.LR_QUALITY_NCAND = "36";
      expect(handoffSampleCount()).toBe(36);
    } finally {
      if (previousQuality === undefined) {
        delete process.env.LR_QUALITY_NCAND;
      } else {
        process.env.LR_QUALITY_NCAND = previousQuality;
      }
    }
  });

  /**
   * The breadth law's STUDY-ONLY output scale.
   *
   * A probe of the law's local optimum at a fixed budget under the depth-1
   * rollout economics (the stale-sweep rule), never a production shape: a scale
   * applied at one budget IS a per-budget constant. It exists because
   * `LR_QUALITY_NCAND` cannot reach here — that knob is an absolute count
   * capped at 64 and the law already returns 81 at 750k.
   */
  test("LR_STUDY_NCAND_SCALE scales the breadth law's output and refuses rather than clamps", () => {
    const previous = process.env.LR_STUDY_NCAND_SCALE;
    const at = (scale: string | undefined, budget: number) => {
      if (scale === undefined) delete process.env.LR_STUDY_NCAND_SCALE;
      else process.env.LR_STUDY_NCAND_SCALE = scale;
      beginEnvFlagEpoch();
      return handoffSampleCount(budget);
    };
    try {
      // The shipped law at the promoting budget, and the scale walking it.
      expect(at(undefined, 750_000)).toBe(81);
      expect(at("1", 750_000)).toBe(81);
      expect(at("", 750_000)).toBe(81);
      expect(at("0.7", 750_000)).toBe(57);
      expect(at("0.85", 750_000)).toBe(69);
      expect(at("1.15", 750_000)).toBe(93);
      expect(at("1.3", 750_000)).toBe(105);
      // The law's FORM is untouched: still linear in the budget, still anchored
      // at 27 per 250k, with the scale a constant factor on the whole curve.
      expect(at("1.3", 250_000)).toBe(35);
      expect(at("1.3", 1_500_000)).toBe(211);
      // The floor still applies to the scaled result, and it is a floor on the
      // law's output, not a second budget regime.
      expect(at("0.5", 50_000)).toBe(8);
      for (const bad of ["0.49", "2.01", "0", "-1", "double", "NaN", "1e400", " "]) {
        expect(() => at(bad, 750_000))
          .toThrow(/LR_STUDY_NCAND_SCALE must be a finite number in \[0.5, 2\]/);
      }
    } finally {
      if (previous === undefined) delete process.env.LR_STUDY_NCAND_SCALE;
      else process.env.LR_STUDY_NCAND_SCALE = previous;
      beginEnvFlagEpoch();
    }
  });

  test("LR_STUDY_NCAND_EXPONENT changes curvature without moving the 750k anchor", () => {
    const previousExponent = process.env.LR_STUDY_NCAND_EXPONENT;
    const previousScale = process.env.LR_STUDY_NCAND_SCALE;
    const at = (exponent: string | undefined, budget: number) => {
      delete process.env.LR_STUDY_NCAND_SCALE;
      if (exponent === undefined) delete process.env.LR_STUDY_NCAND_EXPONENT;
      else process.env.LR_STUDY_NCAND_EXPONENT = exponent;
      beginEnvFlagEpoch();
      return handoffSampleCount(budget);
    };
    try {
      for (const exponent of [undefined, "0.25", "0.5", "0.75", "1"]) {
        expect(at(exponent, 750_000)).toBe(81);
      }
      expect(at("0.25", 250_000)).toBe(62);
      expect(at("0.5", 250_000)).toBe(47);
      expect(at("0.75", 250_000)).toBe(36);
      expect(at("1", 250_000)).toBe(27);
      expect(at("0.25", 1_500_000)).toBe(96);
      expect(at("0.5", 1_500_000)).toBe(115);
      expect(at("0.75", 1_500_000)).toBe(136);
      expect(at("1", 1_500_000)).toBe(162);
      for (const bad of ["0", "-0.1", "1.01", "curve", "NaN", "1e400", " "]) {
        expect(() => at(bad, 750_000))
          .toThrow(/LR_STUDY_NCAND_EXPONENT must be a finite number in \(0, 1\]/);
      }
    } finally {
      if (previousExponent === undefined) delete process.env.LR_STUDY_NCAND_EXPONENT;
      else process.env.LR_STUDY_NCAND_EXPONENT = previousExponent;
      if (previousScale === undefined) delete process.env.LR_STUDY_NCAND_SCALE;
      else process.env.LR_STUDY_NCAND_SCALE = previousScale;
      beginEnvFlagEpoch();
    }
  });

  test("high-budget breadth policies leave the 750k-and-below law untouched", () => {
    const previousPolicy = process.env.LR_STUDY_NCAND_POLICY;
    const previousExponent = process.env.LR_STUDY_NCAND_EXPONENT;
    const at = (policy: string | undefined, budget: number, repairLane = false) => {
      delete process.env.LR_STUDY_NCAND_EXPONENT;
      if (policy === undefined) delete process.env.LR_STUDY_NCAND_POLICY;
      else process.env.LR_STUDY_NCAND_POLICY = policy;
      beginEnvFlagEpoch();
      return handoffSampleCount(budget, repairLane);
    };
    try {
      for (const budget of [150_000, 250_000, 500_000, 750_000]) {
        expect(at("high-budget-three-quarter", budget)).toBe(at(undefined, budget));
        expect(at("linear-cap-216", budget)).toBe(at(undefined, budget));
      }
      expect(at("high-budget-three-quarter", 1_000_000)).toBe(101);
      expect(at("high-budget-three-quarter", 1_500_000)).toBe(136);
      expect(at("high-budget-three-quarter", 2_500_000)).toBe(200);
      expect(at("high-budget-three-quarter", 4_000_000)).toBe(284);
      expect(at("linear-cap-216", 1_000_000)).toBe(108);
      expect(at("linear-cap-216", 1_500_000)).toBe(162);
      expect(at("linear-cap-216", 2_500_000)).toBe(216);
      expect(at("linear-cap-216", 4_000_000)).toBe(216);
      expect(at("repair-high-budget-three-quarter", 4_000_000)).toBe(432);
      expect(at("repair-high-budget-three-quarter", 4_000_000, true)).toBe(284);
      expect(at("repair-high-budget-three-quarter", 750_000, true)).toBe(81);
      expect(() => at("unknown", 1_000_000)).toThrow(/LR_STUDY_NCAND_POLICY must be/);

      process.env.LR_STUDY_NCAND_POLICY = "linear-cap-216";
      process.env.LR_STUDY_NCAND_EXPONENT = "0.75";
      beginEnvFlagEpoch();
      expect(() => handoffSampleCount(1_000_000)).toThrow(/mutually exclusive/);
    } finally {
      if (previousPolicy === undefined) delete process.env.LR_STUDY_NCAND_POLICY;
      else process.env.LR_STUDY_NCAND_POLICY = previousPolicy;
      if (previousExponent === undefined) delete process.env.LR_STUDY_NCAND_EXPONENT;
      else process.env.LR_STUDY_NCAND_EXPONENT = previousExponent;
      beginEnvFlagEpoch();
    }
  });

  /**
   * `HANDOFF_QUALITY_N_CAND_FLOOR` is UNTESTABLE at the promoting surface, and
   * that is arithmetic rather than an opinion: the law returns 8 exactly at
   * `250k * 7.5 / 27` = 69,444 frames, so the floor binds only below ~69k —
   * a factor of ten under 750k, and still a factor of seven under it at the
   * widest study scale this file admits. A bracket on the floor has to be taken
   * on the low-budget reading, never on a 750k panel.
   */
  test("the breadth floor cannot bind at any promoted budget", () => {
    const previous = process.env.LR_STUDY_NCAND_SCALE;
    try {
      for (const budget of [250_000, 500_000, 750_000, 1_500_000]) {
        for (const scale of [undefined, "0.5"]) {
          if (scale === undefined) delete process.env.LR_STUDY_NCAND_SCALE;
          else process.env.LR_STUDY_NCAND_SCALE = scale;
          beginEnvFlagEpoch();
          expect(handoffSampleCount(budget)).toBeGreaterThan(8);
        }
      }
      delete process.env.LR_STUDY_NCAND_SCALE;
      beginEnvFlagEpoch();
      expect(handoffSampleCount(69_445)).toBe(8);
      expect(handoffSampleCount(69_444)).toBe(8);
      expect(handoffSampleCount(80_000)).toBeGreaterThan(8);
    } finally {
      if (previous === undefined) delete process.env.LR_STUDY_NCAND_SCALE;
      else process.env.LR_STUDY_NCAND_SCALE = previous;
      beginEnvFlagEpoch();
    }
  });

  test("sparse contact cadence is based on median contact cadence", () => {
    expect(usesSparseContactCadence([
      gap(0, 0, 20),
      gap(1, 20, 40),
      gap(2, 40, 60),
    ])).toBe(false);
    expect(usesSparseContactCadence([
      gap(0, 0, 22),
      gap(1, 22, 53),
      gap(2, 53, 84),
    ])).toBe(true);
  });

  test("brake work is allocated from local overspeed only", () => {
    expect(brakeCandidateCount(0.99)).toBe(0);
    expect(brakeCandidateCount(1.0)).toBe(3);
    expect(brakeCandidateCount(1.14)).toBe(3);
    expect(brakeCandidateCount(1.15)).toBe(4);
    expect(brakeCandidateCount(1.49)).toBe(4);
    expect(brakeCandidateCount(1.5)).toBe(4);
    expect(brakeCandidateCount(2.0)).toBe(4);
  });

  test("handoff overshoot pressure is asymmetric and policy-table driven", () => {
    expect(handoffAxisOvershootPenalty(
      { speed: 0.5, air: 0.25 },
      { speed: 0.6, air: 0.5 },
    )).toBeCloseTo(1.06, 6);
    expect(handoffAxisOvershootPenalty(
      { speed: 0.5, air: 0.25 },
      { speed: 0.4, air: 0.1 },
    )).toBe(0);
    expect(handoffAxisOvershootPenalty(
      { grain: 0.2 },
      { grain: 1 },
    )).toBe(0);
  });

  test("start feasibility scoring only requires two future contacts", () => {
    expect(hasStartFeasibilityLookahead([gap(0, 0, 24)])).toBe(false);
    expect(hasStartFeasibilityLookahead([gap(0, 0, 24), gap(1, 24, 46)])).toBe(true);
    expect(hasStartFeasibilityLookahead([gap(0, 0, 25), gap(1, 25, 48)])).toBe(true);
    expect(hasStartFeasibilityLookahead([gap(0, 0, 40), gap(1, 40, 80)])).toBe(true);
  });

  test("start overshoot scoring is gated to high-speed openings", () => {
    expect(usesHighSpeedStartOvershootScoring({ speed: 0.5 })).toBe(true);
    expect(usesHighSpeedStartOvershootScoring({ speed: 0.49 })).toBe(false);
    expect(usesHighSpeedStartOvershootScoring({})).toBe(false);
  });

  test("start-angle policy is continuous around former air bands", () => {
    expect(targetStartAngle({ air: 0.3 })).toBe(24);
    expect(targetStartAngle({ air: 0.31 })).toBeCloseTo(23.1, 6);
    expect(targetStartAngle({ air: 0.69 })).toBeCloseTo(-11.1, 6);
    expect(targetStartAngle({ air: 0.7 })).toBeCloseTo(-12, 6);

    const below = startAngles({ air: 0.69 });
    const above = startAngles({ air: 0.7 });
    for (const [i, angle] of above.entries()) {
      expect(Math.abs(angle - below[i])).toBeCloseTo(0.9, 6);
    }
  });

  test("start-speed anchors are continuous around the old high-speed split", () => {
    const below = [...startSpeedAnchors(8.99)].sort((a, b) => a - b);
    const above = [...startSpeedAnchors(9.01)].sort((a, b) => a - b);

    expect(below).toHaveLength(above.length);
    expect(below[0]).toBe(0.4);
    expect(above[0]).toBe(0.4);
    expect(startSpeedAnchors(authoredSpeedToPx(0.5))).toContain(9);

    const maxDelta = Math.max(...below.map((speed, index) => Math.abs(speed - above[index])));
    expect(maxDelta).toBeLessThan(0.03);
  });
});

describe("target-state arc placement", () => {
  test("uses the clean target-state placement mode", () => {
    expect(arcPlacementMode()).toBe("target_state");
  });

  test("line sampler emits contiguous target-state geometry with stable ids", () => {
    const lines = linesFromGeometry(sampleArcPlacementGeometry(
      () => 0.5,
      100,
      50,
      { air: 0.5, speed: 0.4, grain: 0.5 },
      targetState(8, 20),
      0,
      gap(0, 0, 24),
      20,
      "normal",
      [24, 52],
    ));

    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.map((line) => line.id)).toEqual(
      Array.from({ length: lines.length }, (_, index) => 20 + index),
    );
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].x1).toBeCloseTo(lines[i - 1].x2, 10);
      expect(lines[i].y1).toBeCloseTo(lines[i - 1].y2, 10);
    }
  });

  test("low-air targets receive longer grounded support than high-air targets", () => {
    const state = targetState(9, 18);
    const baseGap = gap(0, 0, 30);
    const lowAir = linesFromGeometry(sampleArcPlacementGeometry(
      () => 0.5,
      100,
      50,
      { air: 0.15, speed: 0.55, grain: 0.45 },
      state,
      0,
      baseGap,
      1,
      "normal",
      [30, 70],
    ));
    const highAir = linesFromGeometry(sampleArcPlacementGeometry(
      () => 0.5,
      100,
      50,
      { air: 0.85, speed: 0.55, grain: 0.45 },
      state,
      0,
      baseGap,
      1,
      "normal",
      [30, 70],
    ));

    expect(totalLineLength(lowAir)).toBeGreaterThan(totalLineLength(highAir));
  });

  test("near downstream contacts cap support length continuously", () => {
    const state = targetState(10, 12);
    const targets = { air: 0.35, speed: 0.55, grain: 0.6 };
    const loose = linesFromGeometry(sampleArcPlacementGeometry(
      () => 0.5,
      100,
      50,
      targets,
      state,
      0,
      gap(0, 0, 30),
      1,
      "normal",
      [30, 65],
    ));
    const dense = linesFromGeometry(sampleArcPlacementGeometry(
      () => 0.5,
      100,
      50,
      targets,
      state,
      0,
      gap(0, 0, 30),
      1,
      "normal",
      [30, 42],
    ));

    expect(totalLineLength(dense)).toBeLessThan(totalLineLength(loose));
  });

  test("high-speed relief dampens the elevation-room impact onset", () => {
    const state = targetState(10, 0);
    const targets = { air: 0.5, speed: 0.75, grain: 0.5, impact: 0.56 };
    const contactGap = gap(0, 0, 30);
    try {
      setImpactProfilePressures({ elevationRoom: 1, highSpeedRelief: 0, templateHold: 0 });
      const base = linesFromGeometry(sampleArcPlacementGeometry(
        () => 0.5,
        100,
        50,
        targets,
        state,
        0,
        contactGap,
        1,
        "normal",
        [30, 70],
      ));

      setImpactProfilePressures({ elevationRoom: 1, highSpeedRelief: 1, templateHold: 0 });
      const relieved = linesFromGeometry(sampleArcPlacementGeometry(
        () => 0.5,
        100,
        50,
        targets,
        state,
        0,
        contactGap,
        1,
        "normal",
        [30, 70],
      ));

      expect(relieved.at(-1)?.y2).not.toBeCloseTo(base.at(-1)?.y2 ?? NaN, 4);
    } finally {
      setImpactProfilePressures({ elevationRoom: 0, highSpeedRelief: 0, templateHold: 0 });
    }
  });

  test("impact template hold pressure lengthens the profiled template lane", () => {
    const state = targetState(9, 18);
    const contactGap = gap(0, 0, 30);
    const targets = { air: 0.15, speed: 0.55, grain: 0.45, impact: 0.72 };
    try {
      setImpactProfilePressures({ elevationRoom: 0, highSpeedRelief: 0, templateHold: 0 });
      const base = linesFromGeometry(sampleArcPlacementGeometry(
        () => 0.5,
        100,
        50,
        targets,
        state,
        10,
        contactGap,
        1,
        "normal",
        [30, 70],
      ));
      expect(wasLastGeometryImpactTemplate()).toBe(true);

      setImpactProfilePressures({ elevationRoom: 0, highSpeedRelief: 0, templateHold: 1 });
      const held = linesFromGeometry(sampleArcPlacementGeometry(
        () => 0.5,
        100,
        50,
        targets,
        state,
        10,
        contactGap,
        1,
        "normal",
        [30, 70],
      ));
      expect(wasLastGeometryImpactTemplate()).toBe(true);
      expect(held.length).toBeGreaterThan(base.length);
      expect(totalLineLength(held)).toBeGreaterThan(totalLineLength(base) + 5);
    } finally {
      setImpactProfilePressures({ elevationRoom: 0, highSpeedRelief: 0, templateHold: 0 });
    }
  });

  test("hard-impact template lane can request a deep target-sized scoop", () => {
    const state = targetState(9, 18);
    const contactGap = gap(0, 0, 30);
    try {
      setImpactProfilePressures({ elevationRoom: 0, highSpeedRelief: 0, templateHold: 0 });
      const hard = linesFromGeometry(sampleArcPlacementGeometry(
        () => 0.5,
        100,
        50,
        { air: 0.3, speed: 0.55, grain: 0.45, impact: 0.72 },
        state,
        10,
        contactGap,
        1,
        "normal",
        [30, 70],
      ));
      expect(wasLastGeometryImpactTemplate()).toBe(true);
      expect(Math.abs(totalSignedTurnDeg(hard))).toBeGreaterThan(24);
    } finally {
      setImpactProfilePressures({ elevationRoom: 0, highSpeedRelief: 0, templateHold: 0 });
    }
  });

  test("translateTrackLines moves endpoints and assigns fresh contiguous ids", () => {
    const translated = translateTrackLines([
      {
        id: 7,
        type: 0,
        x1: 1,
        y1: 2,
        x2: 3,
        y2: 4,
        flipped: false,
        leftExtended: false,
        rightExtended: false,
      },
      {
        id: 8,
        type: 0,
        x1: 3,
        y1: 4,
        x2: 5,
        y2: 6,
        flipped: false,
        leftExtended: false,
        rightExtended: false,
      },
    ], 10, -2, 100);

    expect(translated.map((line) => line.id)).toEqual([100, 101]);
    expect(translated[0]).toMatchObject({ x1: 11, y1: 0, x2: 13, y2: 2 });
    expect(translated[1]).toMatchObject({ x1: 13, y1: 2, x2: 15, y2: 4 });
  });

  test("release-state scoring uses speed magnitude and clips before the next contact", () => {
    expect(releaseStateFrame(gap(0, 10, 20), [20, 33])).toBe(28);
    expect(releaseStateFrame(gap(0, 10, 20), [20, 26])).toBe(24);
    expect(releaseStateFrame(gap(0, 10, 20), [20])).toBe(28);

    expect(releaseSpeedPenalty(undefined, 0.5)).toBe(0);
    expect(releaseSpeedPenalty(authoredSpeedToPx(0.5), undefined)).toBe(0);
    expect(releaseSpeedPenalty(authoredSpeedToPx(0.5), 0.5)).toBeCloseTo(0, 12);
    const releaseSpeedWeight = 0.35 * (SPEED_RULER.RANGE_PX_PER_FRAME / 12) ** 2;
    const halfTargetErrorPenalty = releaseSpeedWeight * 0.5 ** 2;
    expect(releaseSpeedPenalty(authoredSpeedToPx(1), 0.5)).toBeCloseTo(halfTargetErrorPenalty, 6);
    expect(releaseSpeedPenalty(authoredSpeedToPx(0), 0.5)).toBeCloseTo(halfTargetErrorPenalty, 6);
  });

  test("placement diagnostics split direct failure reasons by sample mode", () => {
    resetArcPlacementStats();
    recordArcPlacementDirectFailure("normal", "survival");
    recordArcPlacementDirectFailure("normal", "landing");
    recordArcPlacementDirectFailure("brake", "offbeat");

    const stats = snapshotArcPlacementStats();
    expect(stats.direct_failed).toBe(3);
    expect(stats.direct_survival_failed).toBe(1);
    expect(stats.direct_landing_failed).toBe(1);
    expect(stats.direct_offbeat_failed).toBe(1);
    expect(stats.by_sample_mode.normal.direct_failed).toBe(2);
    expect(stats.by_sample_mode.normal.direct_survival_failed).toBe(1);
    expect(stats.by_sample_mode.normal.direct_landing_failed).toBe(1);
    expect(stats.by_sample_mode.brake.direct_failed).toBe(1);
    expect(stats.by_sample_mode.brake.direct_offbeat_failed).toBe(1);
  });
});

describe("short deadline rescue policy", () => {
  test("short-deadline rescue is based on local gap duration", () => {
    expect(shortGapRescueCandidateCount(0)).toBe(0);
    expect(shortGapRescueCandidateCount(10)).toBe(80);
    expect(shortGapRescueCandidateCount(11)).toBe(80);
    expect(shortGapRescueCandidateCount(12)).toBe(0);
    expect(shortGapRescueCandidateCount(16)).toBe(0);
  });
});

/**
 * The repair restart ceiling — `estCostUpperOf`, the one live read of the
 * estimator artifact's CLAIM layer. It determines which priced target×parent
 * anchors are affordable and how many frames one iteration may spend, so a zero
 * here would make every target ineligible.
 */
describe("repair restart ceiling", () => {
  /** The calibrator's static fallback shape: legal, and it ignores the path. */
  const STRUCTURAL_BASE: BudgetEstimatorModelArtifact = {
    ...BUDGET_ESTIMATOR_MODEL,
    combination: { ...BUDGET_ESTIMATOR_MODEL.combination, baseMode: "structural" },
  };

  test("prices a measured anchor at the artifact's path-backed start band", () => {
    const measured = 40_000;
    const point = estimateRemainingBudgetWork({
      structural: 0,
      path: measured,
      pace: null,
      progressFraction: 1,
    });
    const expected = budgetEstimateInterval(point, { event: "start", pathAvailable: true }).upper;

    expect(expected).toBeGreaterThan(0);
    expect(repairRestartCeilingFrames(measured, 999)).toBe(expected);
    // The retired hand-set feasibility margin, now sourced from the artifact.
    expect(expected / measured).toBeGreaterThan(1);
  });

  test("prices an unmeasured anchor at the path-free start band around the fallback", () => {
    const fallback = 12_345;
    expect(repairRestartCeilingFrames(null, fallback)).toBe(
      budgetEstimateInterval(fallback, { event: "start", pathAvailable: false }).upper,
    );
  });

  test("never hands repair a zero ceiling under a structural-base artifact", () => {
    const measured = 40_000;
    // The precondition the guard exists for: a structural base mode reads the
    // deliberately-zero structural slot, so point and interval are both zero.
    const point = estimateRemainingBudgetWork({
      structural: 0,
      path: measured,
      pace: null,
      progressFraction: 1,
    }, STRUCTURAL_BASE);
    expect(point).toBe(0);
    expect(
      budgetEstimateInterval(point, { event: "start", pathAvailable: true }, STRUCTURAL_BASE).upper,
    ).toBe(0);

    // Unguarded, every measured restart would be sized at zero frames.
    expect(repairRestartCeilingFrames(measured, 999, STRUCTURAL_BASE)).toBe(measured);
    // The per-gap fallback never goes through the estimator's base selector, so
    // it is priced identically under either artifact and needs no guard.
    expect(repairRestartCeilingFrames(null, 12_345, STRUCTURAL_BASE))
      .toBe(repairRestartCeilingFrames(null, 12_345));
  });
});

describe("repair target selection", () => {
  const candidates = [
    { gapIndex: 1, sse: 5 },
    { gapIndex: 2, sse: 10 },
    { gapIndex: 3, sse: 10 },
  ];

  test("target-aware suffix ordering can stay within the ordinary top three", () => {
    const a = { id: "a", sse: 5 };
    const b = { id: "b", sse: 2 };
    const c = { id: "c", sse: 4 };
    const outside = { id: "outside", sse: 1 };
    const result = prioritizeRepairTargetOptions(
      [a, b, c],
      [a, b, c, outside],
      "target_top_three_first",
      (option) => option.sse,
    );
    expect(result.options).toEqual([b, a, c]);
    expect(result).toMatchObject({ ordinaryFirstSse: 5, chosenSse: 2, promoted: false });
  });

  test("eligible target ordering promotes one evaluated local specialist without widening", () => {
    const a = { id: "a", sse: 5 };
    const b = { id: "b", sse: 2 };
    const c = { id: "c", sse: 4 };
    const outside = { id: "outside", sse: 1 };
    const result = prioritizeRepairTargetOptions(
      [a, b, c],
      [a, b, c, outside],
      "target_eligible_first",
      (option) => option.sse,
    );
    expect(result.options).toEqual([outside, a, b]);
    expect(result.options).toHaveLength(3);
    expect(result).toMatchObject({ ordinaryFirstSse: 5, chosenSse: 1, promoted: true });
  });

  test("improvement-gated ordering changes branch zero only when it is not a repair", () => {
    const a = { id: "a", sse: 5 };
    const b = { id: "b", sse: 2 };
    const c = { id: "c", sse: 4 };
    const result = prioritizeRepairTargetOptions(
      [a, b, c],
      [a, b, c],
      "target_improvement_first",
      (option) => option.sse,
      4,
    );
    expect(result.options).toEqual([b, a, c]);
    expect(result).toMatchObject({
      ordinaryFirstSse: 5,
      chosenSse: 2,
      promoted: false,
      ordinaryFirstImprovesIncumbent: false,
      improvingAlternativeAvailable: true,
    });
  });

  test("improvement-gated ordering preserves an ordinary branch that already repairs", () => {
    const a = { id: "a", sse: 5 };
    const b = { id: "b", sse: 2 };
    const c = { id: "c", sse: 4 };
    const result = prioritizeRepairTargetOptions(
      [a, b, c],
      [a, b, c],
      "target_improvement_first",
      (option) => option.sse,
      6,
    );
    expect(result.options).toEqual([a, b, c]);
    expect(result).toMatchObject({
      chosenSse: 5,
      ordinaryFirstImprovesIncumbent: true,
      improvingAlternativeAvailable: true,
    });
  });

  test("improvement-gated ordering preserves ordinary order without a true repair", () => {
    const selected = [{ sse: 5 }, { sse: 4 }, { sse: 6 }];
    const result = prioritizeRepairTargetOptions(
      selected,
      selected,
      "target_improvement_first",
      (option) => option.sse,
      4,
    );
    expect(result.options).toEqual(selected);
    expect(result.improvingAlternativeAvailable).toBe(false);
  });

  test("ordinary suffix ordering is byte-order preserving", () => {
    const selected = [{ sse: 5 }, { sse: 2 }, { sse: 1 }];
    expect(prioritizeRepairTargetOptions(
      selected,
      selected,
      "ordinary",
      (option) => option.sse,
    ).options).toEqual(selected);
  });

  test("suffix search policy rejects undeclared study values", () => {
    const previous = process.env.LR_REPAIR_SUFFIX_SEARCH_POLICY;
    try {
      process.env.LR_REPAIR_SUFFIX_SEARCH_POLICY = "mystery";
      beginEnvFlagEpoch();
      expect(() => repairSuffixSearchPolicy()).toThrow(/must be ordinary/);
      process.env.LR_REPAIR_SUFFIX_SEARCH_POLICY = "target-top-three-first";
      beginEnvFlagEpoch();
      expect(repairSuffixSearchPolicy()).toBe("target_top_three_first");
      process.env.LR_REPAIR_SUFFIX_SEARCH_POLICY = "target-improvement-first";
      beginEnvFlagEpoch();
      expect(repairSuffixSearchPolicy()).toBe("target_improvement_first");
    } finally {
      if (previous === undefined) delete process.env.LR_REPAIR_SUFFIX_SEARCH_POLICY;
      else process.env.LR_REPAIR_SUFFIX_SEARCH_POLICY = previous;
      beginEnvFlagEpoch();
    }
  });

  test("ranks weakness among targets with an affordable anchor", () => {
    expect(selectAffordableRepairTarget(
      candidates,
      [60, 75, 81],
      100,
      0.2,
      1,
    )).toEqual({
      targetGapIndex: 2,
      anchorGapIndex: 1,
      parentDepth: 1,
      targetGapSse: 10,
      usableBudgetFrames: 80,
      affordableTargetGapIndices: [1, 2],
    });
  });

  test("uses the deepest affordable parent up to the declared maximum", () => {
    expect(selectAffordableRepairTarget(
      candidates,
      [70, 90],
      100,
      0.2,
      2,
    )).toEqual({
      targetGapIndex: 2,
      anchorGapIndex: 0,
      parentDepth: 2,
      targetGapSse: 10,
      usableBudgetFrames: 80,
      affordableTargetGapIndices: [1, 2],
    });
    expect(selectAffordableRepairTarget(candidates, [81], 100, 0.2, 2)).toBeNull();
  });

  test("selects the worst eligible target before choosing its deepest anchor", () => {
    expect(selectAffordableRepairTarget(
      [
        { gapIndex: 2, sse: 5 },
        { gapIndex: 4, sse: 20 },
      ],
      [90, 90, 60, 75, 79],
      100,
      0.2,
      4,
    )).toEqual({
      targetGapIndex: 4,
      anchorGapIndex: 2,
      parentDepth: 2,
      targetGapSse: 20,
      usableBudgetFrames: 80,
      affordableTargetGapIndices: [2, 4],
    });
  });

  test("selects suffix opportunity per expected cost from the shared affordable anchor set", () => {
    const densityCandidates = [0, 1, 2, 3, 4, 5].map((gapIndex) => ({
      gapIndex,
      sse: gapIndex === 5 ? 15 : 10,
    }));
    expect(selectRepairRestart(
      densityCandidates,
      [100, 95, 90, 85, 80, 75],
      [100, 95, 90, 85, 80, 75],
      100,
      0,
      1,
      "suffix_opportunity_per_cost",
    )).toEqual({
      selectionPolicy: "suffix_opportunity_per_cost",
      targetGapIndex: 5,
      anchorGapIndex: 0,
      parentDepth: 5,
      targetGapSse: 15,
      mutableSuffixSse: 65,
      usableBudgetFrames: 100,
      affordableTargetGapIndices: [0, 1, 2, 3, 4, 5],
      affordableAnchorGapIndices: [0, 1, 2, 3, 4, 5],
    });
  });

  test("selects maximum affordable suffix opportunity without a cost ratio", () => {
    expect(selectRepairRestart(
      [
        { gapIndex: 0, sse: 10 },
        { gapIndex: 1, sse: 10 },
        { gapIndex: 2, sse: 15 },
      ],
      [100, 30, 10],
      [100, 30, 10],
      100,
      0,
      0,
      "max_suffix_opportunity",
    )).toEqual({
      selectionPolicy: "max_suffix_opportunity",
      targetGapIndex: 2,
      anchorGapIndex: 0,
      parentDepth: 2,
      targetGapSse: 15,
      mutableSuffixSse: 35,
      usableBudgetFrames: 100,
      affordableTargetGapIndices: [0, 1, 2],
      affordableAnchorGapIndices: [0, 1, 2],
    });
  });

  test("selects the strongest affordable local error window within the option radius", () => {
    const windowCandidates = Array.from({ length: 9 }, (_, gapIndex) => ({
      gapIndex,
      sse: gapIndex === 5 || gapIndex === 6 ? 10 : 0,
    }));
    expect(selectRepairRestart(
      windowCandidates,
      Array(9).fill(100),
      Array(9).fill(100),
      100,
      0,
      2,
      "max_local_window_opportunity",
    )).toEqual({
      selectionPolicy: "max_local_window_opportunity",
      targetGapIndex: 6,
      anchorGapIndex: 4,
      parentDepth: 2,
      targetGapSse: 10,
      mutableSuffixSse: 20,
      usableBudgetFrames: 100,
      affordableTargetGapIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      affordableAnchorGapIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    });
  });

  test("updates an accepted incumbent with its own suffix cost observations", () => {
    expect(spliceRepairCostToEnd(
      [-1, -1, 300, 180, 0],
      [1_000, 700, 400, 150, 0],
      2,
    )).toEqual([900, 600, 300, 180, 0]);
    expect(spliceRepairCostToEnd([-1, -1, 300], [-1, 700, 400], 2))
      .toEqual([-1, 600, 300]);
  });
});
