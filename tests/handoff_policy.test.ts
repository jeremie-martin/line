import { describe, expect, test } from "vitest";
import {
  brakeCandidateCount,
  handoffCandidatePool,
  handoffAxisOvershootPenalty,
  handoffSampleCount,
  handoffUsesFuturePreview,
  hasStartFeasibilityLookahead,
  shouldOfferBrakeCandidates,
  shouldAttemptNearTailCompletion,
  shouldUseExpandedBrakeSearch,
  shortDeadlineRescueCandidateCount,
  startAngles,
  startSpeedAnchors,
  targetStartAngle,
  usesHighSpeedStartOvershootScoring,
  usesSparseContractSearch,
} from "../scripts/v0/optimizer/handoff.ts";
import {
  releaseSpeedPenalty,
  releaseStateFrame,
  translateTrackLines,
} from "../scripts/v0/core/candidate.ts";
import {
  arcPlacementMode,
  recordArcPlacementDirectFailure,
  resetArcPlacementStats,
  sampleArcParams,
  sampleArcParamsRngDraws,
  sampleArcPlacementGeometry,
  snapshotArcPlacementStats,
} from "../scripts/v0/arc_placement.ts";
import { authoredSpeedToPx, type Gap, type TrackLine } from "../scripts/v0/types.ts";
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
  if (geometry.kind !== "lines") throw new Error("expected line-native placement geometry");
  return geometry.lines;
}

function totalLineLength(lines: TrackLine[]): number {
  return lines.reduce((sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1), 0);
}

describe("handoff policy boundaries", () => {
  test("candidate pool has no contact-count regime cliff", () => {
    const formerCliffCounts = [29, 30, 31, 60, 61, 77];
    expect(formerCliffCounts.map(() => handoffCandidatePool())).toEqual([8, 8, 8, 8, 8, 8]);
  });

  test("sample schedule widens after contract success", () => {
    expect(handoffSampleCount(false)).toBe(14);
    expect(handoffSampleCount(false, true)).toBe(13);
    expect(handoffSampleCount(true)).toBe(24);
  });

  test("sparse contract search is based on median contact cadence", () => {
    expect(usesSparseContractSearch([
      gap(0, 0, 20),
      gap(1, 20, 40),
      gap(2, 40, 60),
    ])).toBe(false);
    expect(usesSparseContractSearch([
      gap(0, 0, 22),
      gap(1, 22, 53),
      gap(2, 53, 84),
    ])).toBe(true);
  });

  test("expanded brake breadth follows the quality phase", () => {
    expect(shouldUseExpandedBrakeSearch(false)).toBe(false);
    expect(shouldUseExpandedBrakeSearch(true)).toBe(true);
  });

  test("future preview is reserved for contract search", () => {
    expect(handoffUsesFuturePreview(false)).toBe(true);
    expect(handoffUsesFuturePreview(true)).toBe(false);
  });

  test("brake work is allocated from local overspeed only", () => {
    expect(brakeCandidateCount(0.99)).toBe(0);
    expect(brakeCandidateCount(1.0)).toBe(2);
    expect(brakeCandidateCount(1.14)).toBe(2);
    expect(brakeCandidateCount(1.15)).toBe(3);
    expect(brakeCandidateCount(1.49)).toBe(3);
    expect(brakeCandidateCount(1.5)).toBe(3);
    expect(brakeCandidateCount(2.0)).toBe(3);
    expect(brakeCandidateCount(1.0, true)).toBe(3);
    expect(brakeCandidateCount(1.15, true)).toBe(4);
  });

  test("handoff overshoot pressure is asymmetric and policy-table driven", () => {
    expect(handoffAxisOvershootPenalty(
      { speed: 0.5, air: 0.25 },
      { speed: 0.6, air: 0.5 },
    )).toBeCloseTo(1.0576, 6);
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

  test("arc compatibility sampler remains target-state anchored and finite", () => {
    const arc = sampleArcParams(
      () => 0.5,
      100,
      50,
      { air: 0.4, speed: 0.6, grain: 0.5 },
      targetState(8, 25),
      0,
      gap(0, 0, 24),
    );

    expect(Number.isFinite(arc.anchor.x)).toBe(true);
    expect(Number.isFinite(arc.anchor.y)).toBe(true);
    expect(arc.length).toBeGreaterThan(0);
    expect(arc.segments).toBeGreaterThanOrEqual(3);
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
    expect(releaseSpeedPenalty(authoredSpeedToPx(1), 0.5)).toBeCloseTo(0.0315, 6);
    expect(releaseSpeedPenalty(authoredSpeedToPx(0), 0.5)).toBeCloseTo(0.0315, 6);
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
    expect(shortDeadlineRescueCandidateCount(0)).toBe(0);
    expect(shortDeadlineRescueCandidateCount(10)).toBe(80);
    expect(shortDeadlineRescueCandidateCount(11)).toBe(80);
    expect(shortDeadlineRescueCandidateCount(12)).toBe(0);
    expect(shortDeadlineRescueCandidateCount(16)).toBe(0);
  });
});
