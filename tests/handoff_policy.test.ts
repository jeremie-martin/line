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
  recordImpactAnchorDirectFailure,
  readPositiveEnvNumber,
  resetArcPlacementStats,
  sampleArcParams,
  sampleArcParamsRngDraws,
  sampleArcPlacementGeometry,
  sampleContactCenteredLinesWithDiagnostics,
  sampleImpactFrameArcWithDiagnostics,
  snapshotArcPlacementStats,
  steepCatchTemplateIndex,
  usesSteepCatchTemplateAttempt,
} from "../scripts/v0/arc_placement.ts";
import { authoredSpeedToPx, type Gap } from "../scripts/v0/types.ts";
import type { SearchNode } from "../scripts/v0/optimizer/node.ts";

function gap(index: number, startFrame: number, endFrame: number, endsWithContact = true): Gap {
  return { index, startFrame, endFrame, endsWithContact, targets: {} };
}

function withArcPlacementMode<T>(mode: string | undefined, fn: () => T): T {
  const previous = process.env.LR_ARC_PLACEMENT;
  if (mode === undefined) {
    delete process.env.LR_ARC_PLACEMENT;
  } else {
    process.env.LR_ARC_PLACEMENT = mode;
  }
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.LR_ARC_PLACEMENT;
    } else {
      process.env.LR_ARC_PLACEMENT = previous;
    }
  }
}

function withEnv<T>(name: string, value: string | undefined, fn: () => T): T {
  const previous = process.env[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = previous;
    }
  }
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

describe("handoff policy boundaries", () => {
  test("candidate pool has no contact-count regime cliff", () => {
    const formerCliffCounts = [29, 30, 31, 60, 61, 77];
    expect(formerCliffCounts.map(() => handoffCandidatePool())).toEqual([8, 8, 8, 8, 8, 8]);
  });

  test("sample schedule widens after contract success", () => {
    expect(handoffSampleCount(false)).toBe(14);
    expect(handoffSampleCount(false, true)).toBe(13);
    expect(handoffSampleCount(true)).toBe(16);
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

  test("near-tail completion is based on remaining contacts, not total contacts", () => {
    for (const totalContacts of [29, 30, 31, 60, 61, 77]) {
      const gaps = contactGaps(totalContacts);
      expect(shouldAttemptNearTailCompletion({
        search: nodeAt(totalContacts - 8),
        skippedContacts: 0,
      }, gaps)).toBe(true);
      expect(shouldAttemptNearTailCompletion({
        search: nodeAt(totalContacts - 9),
        skippedContacts: 0,
      }, gaps)).toBe(false);
    }

    const gaps = contactGaps(31);
    expect(shouldAttemptNearTailCompletion({ search: nodeAt(26), skippedContacts: 1 }, gaps)).toBe(false);
    expect(shouldAttemptNearTailCompletion({ search: nodeAt(31), skippedContacts: 0 }, gaps)).toBe(false);

    const shortSpecGaps = contactGaps(4);
    expect(shouldAttemptNearTailCompletion({
      search: nodeAt(0, false),
      skippedContacts: 0,
    }, shortSpecGaps)).toBe(false);
    expect(shouldAttemptNearTailCompletion({
      search: nodeAt(1),
      skippedContacts: 0,
    }, shortSpecGaps)).toBe(true);
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
    )).toBeCloseTo(1.16, 6);
    expect(handoffAxisOvershootPenalty(
      { speed: 0.5, air: 0.25 },
      { speed: 0.4, air: 0.1 },
    )).toBe(0);
    expect(handoffAxisOvershootPenalty(
      { grain: 0.2 },
      { grain: 1 },
    )).toBe(0);
  });

  test("brake work fires only on mild-overspeed targets", () => {
    expect(shouldOfferBrakeCandidates(authoredSpeedToPx(0), 1.15)).toBe(false);
    expect(shouldOfferBrakeCandidates(authoredSpeedToPx(0) + 1e-7, 1.15)).toBe(false);
    expect(shouldOfferBrakeCandidates(authoredSpeedToPx(0) + 1e-3, 1.15)).toBe(true);
    expect(shouldOfferBrakeCandidates(authoredSpeedToPx(0.55), 1.0)).toBe(true);
    expect(shouldOfferBrakeCandidates(authoredSpeedToPx(0.55), 0.5)).toBe(false);
    expect(shouldOfferBrakeCandidates(authoredSpeedToPx(0.78), 1.15)).toBe(true);
    expect(shouldOfferBrakeCandidates(authoredSpeedToPx(0.78) + 1e-7, 1.15)).toBe(true);
    expect(shouldOfferBrakeCandidates(authoredSpeedToPx(0.78) + 1e-3, 1.15)).toBe(false);
    expect(shouldOfferBrakeCandidates(authoredSpeedToPx(0.79), 1.15, true)).toBe(false);
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

describe("arc placement mode policy", () => {
  test("positive numeric env parser rejects empty and non-positive values", () => {
    expect(withEnv("LR_LEVEL_SCALE", undefined, () => readPositiveEnvNumber("LR_LEVEL_SCALE", 1)))
      .toBe(1);
    expect(withEnv("LR_LEVEL_SCALE", "", () => readPositiveEnvNumber("LR_LEVEL_SCALE", 1)))
      .toBe(1);
    expect(withEnv("LR_LEVEL_SCALE", "   ", () => readPositiveEnvNumber("LR_LEVEL_SCALE", 1)))
      .toBe(1);
    expect(withEnv("LR_LEVEL_SCALE", "0", () => readPositiveEnvNumber("LR_LEVEL_SCALE", 1)))
      .toBe(1);
    expect(withEnv("LR_LEVEL_SCALE", "-1", () => readPositiveEnvNumber("LR_LEVEL_SCALE", 1)))
      .toBe(1);
    expect(withEnv("LR_LEVEL_SCALE", "2.5", () => readPositiveEnvNumber("LR_LEVEL_SCALE", 1)))
      .toBe(2.5);
  });

  test("LR_ARC_PLACEMENT accepts only the explicit alternate modes", () => {
    expect(withArcPlacementMode(undefined, () => arcPlacementMode())).toBe("impact_anchor");
    expect(withArcPlacementMode("uniform", () => arcPlacementMode())).toBe("uniform");
    expect(withArcPlacementMode("impact_frame", () => arcPlacementMode())).toBe("impact_frame");
    expect(withArcPlacementMode("contact_centered", () => arcPlacementMode())).toBe("contact_centered");
    expect(withArcPlacementMode("unknown", () => arcPlacementMode())).toBe("impact_anchor");
  });

  test("alternate placement modes preserve candidate RNG draw accounting", () => {
    const state = { speed: 4, angleDeg: 10 };
    const normalGap = gap(0, 0, 20);
    expect(withArcPlacementMode(undefined, () => sampleArcParamsRngDraws(state, normalGap, 1))).toBe(8);
    expect(withArcPlacementMode("impact_frame", () => sampleArcParamsRngDraws(state, normalGap, 1))).toBe(8);
    expect(withArcPlacementMode("contact_centered", () => sampleArcParamsRngDraws(state, normalGap, 1))).toBe(8);
    expect(withArcPlacementMode("uniform", () => sampleArcParamsRngDraws(state, normalGap, 1))).toBe(7);
  });

  test("impact-frame sampler makes contact tangent an explicit local control", () => {
    const sample = sampleImpactFrameArcWithDiagnostics(
      () => 0.5,
      {
        sledX: 100,
        sledY: 50,
        velocity: { x: 4, y: 2 },
        speed: Math.hypot(4, 2),
        angleDeg: 35,
      },
      { air: 0.5, speed: 0.4, grain: 0.5 },
      gap(0, 0, 20),
      120,
      8,
    );

    expect(sample.impactT).toBeGreaterThanOrEqual(0.30);
    expect(sample.impactT).toBeLessThanOrEqual(0.76);
    expect(sample.localTangentAngleDeg).toBeCloseTo(sample.contactAngleDeg, 6);
    expect(Number.isFinite(sample.arc.anchor.x)).toBe(true);
    expect(Number.isFinite(sample.arc.anchor.y)).toBe(true);
    expect(sample.arc.segments).toBe(8);
  });

  test("impact-frame mode preserves specialized brake and air-support geometry", () => {
    const targetState = {
      sledX: 100,
      sledY: 50,
      velocity: { x: 4, y: 2 },
      speed: Math.hypot(4, 2),
      angleDeg: 35,
    };

    withArcPlacementMode("impact_frame", () => {
      const brake = sampleArcParams(
        () => 0.5,
        100,
        50,
        {},
        targetState,
        1,
        gap(0, 0, 20),
        "brake",
      );
      expect(brake.startAngleDeg).toBeGreaterThanOrEqual(-28);
      expect(brake.startAngleDeg).toBeLessThanOrEqual(-6);

      const airSupport = sampleArcParams(
        () => 0.5,
        100,
        50,
        {},
        targetState,
        1,
        gap(0, 0, 20),
        "air_support",
      );
      expect(airSupport.length).toBeGreaterThanOrEqual(100);
      expect(airSupport.startAngleDeg).toBeGreaterThanOrEqual(-8);
      expect(airSupport.startAngleDeg).toBeLessThanOrEqual(14);
      expect(airSupport.endAngleDeg).toBeGreaterThanOrEqual(-6);
      expect(airSupport.endAngleDeg).toBeLessThanOrEqual(10);
      expect(Math.abs(airSupport.curveBias)).toBeLessThanOrEqual(0.35);
    });
  });

  test("contact-centered line sampler emits contiguous geometry around the contact point", () => {
    const sample = sampleContactCenteredLinesWithDiagnostics(
      () => 0.5,
      {
        sledX: 100,
        sledY: 50,
        velocity: { x: 4, y: 2 },
        speed: Math.hypot(4, 2),
        angleDeg: 35,
      },
      { air: 0.5, speed: 0.4, grain: 0.5 },
      gap(0, 0, 20),
      20,
    );

    expect(sample.preSegments).toBeGreaterThanOrEqual(1);
    expect(sample.preSegments).toBeLessThanOrEqual(6);
    expect(sample.postSegments).toBeGreaterThanOrEqual(2);
    expect(sample.postSegments).toBeLessThanOrEqual(14);
    expect(sample.lines).toHaveLength(sample.preSegments + sample.postSegments);
    expect(sample.lines.map((line) => line.id)).toEqual(
      Array.from({ length: sample.lines.length }, (_, index) => 20 + index),
    );

    const preContact = sample.lines[sample.preSegments - 1];
    const postContact = sample.lines[sample.preSegments];
    expect(preContact.x2).toBeCloseTo(sample.contactPoint.x, 10);
    expect(preContact.y2).toBeCloseTo(sample.contactPoint.y, 10);
    expect(postContact.x1).toBeCloseTo(sample.contactPoint.x, 10);
    expect(postContact.y1).toBeCloseTo(sample.contactPoint.y, 10);
  });

  test("contact-centered sampler turns authored overspeed into uphill support pressure", () => {
    const baseState = {
      sledX: 100,
      sledY: 50,
      velocity: { x: 8, y: 5 },
      angleDeg: 35,
    };
    const overspeed = sampleContactCenteredLinesWithDiagnostics(
      () => 0.5,
      { ...baseState, speed: 12 },
      { air: 0.5, speed: 0, grain: 0.5 },
      gap(0, 0, 24),
      20,
    );
    const underspeed = sampleContactCenteredLinesWithDiagnostics(
      () => 0.5,
      { ...baseState, speed: 6 },
      { air: 0.5, speed: 1, grain: 0.5 },
      gap(0, 0, 24),
      20,
    );

    expect(overspeed.brakePressure).toBeGreaterThan(0.9);
    expect(underspeed.accelPressure).toBeGreaterThan(0.9);
    expect(overspeed.contactAngleDeg).toBeLessThan(underspeed.contactAngleDeg);
    expect(overspeed.postAngleDeg).toBeLessThan(underspeed.postAngleDeg);
    expect(overspeed.preLength).toBeGreaterThan(underspeed.preLength);
  });

  test("contact-centered sampler shortens ride-out before dense next contacts", () => {
    const state = {
      sledX: 100,
      sledY: 50,
      velocity: { x: 10, y: 3 },
      speed: Math.hypot(10, 3),
      angleDeg: 17,
    };
    const targets = { air: 0.85, speed: 0.95, grain: 0.62 };
    const loose = sampleContactCenteredLinesWithDiagnostics(
      () => 0.5,
      state,
      targets,
      gap(0, 0, 30),
      20,
      [30],
    );
    const dense = sampleContactCenteredLinesWithDiagnostics(
      () => 0.5,
      state,
      targets,
      gap(0, 0, 30),
      20,
      [30, 40],
    );

    expect(dense.postLength).toBeLessThan(loose.postLength * 0.7);
    expect(dense.postSegments).toBeLessThanOrEqual(loose.postSegments);
    expect(dense.contactAngleDeg).toBeGreaterThan(0);
  });

  test("contact-centered sampler carries tight moderate-speed rhythms forward", () => {
    const state = {
      sledX: 100,
      sledY: 50,
      velocity: { x: 8, y: 2 },
      speed: Math.hypot(8, 2),
      angleDeg: 14,
    };
    const targets = { air: 0.55, speed: 0.72, grain: 0.5 };
    const loose = sampleContactCenteredLinesWithDiagnostics(
      () => 0.5,
      state,
      targets,
      gap(0, 0, 30),
      20,
      [30],
    );
    const tight = sampleContactCenteredLinesWithDiagnostics(
      () => 0.5,
      state,
      targets,
      gap(0, 0, 30),
      20,
      [30, 43],
    );

    expect(tight.contactAngleDeg).toBeGreaterThan(loose.contactAngleDeg);
    expect(tight.postAngleDeg).toBeGreaterThan(loose.postAngleDeg);
    expect(tight.postLength).toBeLessThan(loose.postLength);
  });

  test("contact-centered mode preserves specialized brake and air-support geometry", () => {
    const targetState = {
      sledX: 100,
      sledY: 50,
      velocity: { x: 4, y: 2 },
      speed: Math.hypot(4, 2),
      angleDeg: 35,
    };

    withArcPlacementMode("contact_centered", () => {
      const normal = sampleArcPlacementGeometry(
        () => 0.5,
        100,
        50,
        {},
        targetState,
        1,
        gap(0, 0, 20),
        10,
        "normal",
      );
      expect(normal.kind).toBe("lines");

      const brake = sampleArcPlacementGeometry(
        () => 0.5,
        100,
        50,
        {},
        targetState,
        1,
        gap(0, 0, 20),
        10,
        "brake",
      );
      expect(brake.kind).toBe("arc");
      if (brake.kind === "arc") {
        expect(brake.arc.startAngleDeg).toBeGreaterThanOrEqual(-28);
        expect(brake.arc.startAngleDeg).toBeLessThanOrEqual(-6);
      }

      const airSupport = sampleArcPlacementGeometry(
        () => 0.5,
        100,
        50,
        {},
        targetState,
        1,
        gap(0, 0, 20),
        10,
        "air_support",
      );
      expect(airSupport.kind).toBe("arc");
      if (airSupport.kind === "arc") {
        expect(airSupport.arc.length).toBeGreaterThanOrEqual(100);
        expect(airSupport.arc.startAngleDeg).toBeGreaterThanOrEqual(-8);
        expect(airSupport.arc.startAngleDeg).toBeLessThanOrEqual(14);
        expect(airSupport.arc.endAngleDeg).toBeGreaterThanOrEqual(-6);
        expect(airSupport.arc.endAngleDeg).toBeLessThanOrEqual(10);
        expect(Math.abs(airSupport.arc.curveBias)).toBeLessThanOrEqual(0.35);
      }
    });
  });

  test("contact-centered mode falls back to impact arcs for loose contact spacing", () => {
    const targetState = {
      sledX: 100,
      sledY: 50,
      velocity: { x: 4, y: 2 },
      speed: Math.hypot(4, 2),
      angleDeg: 35,
    };

    withArcPlacementMode("contact_centered", () => {
      const defaultTimeline = sampleArcPlacementGeometry(
        () => 0.5,
        100,
        50,
        {},
        targetState,
        1,
        gap(0, 0, 20),
        10,
        "normal",
      );
      expect(defaultTimeline.kind).toBe("lines");

      const looseTimeline = sampleArcPlacementGeometry(
        () => 0.5,
        100,
        50,
        {},
        targetState,
        1,
        gap(0, 0, 20),
        10,
        "normal",
        [20, 50],
      );
      expect(looseTimeline.kind).toBe("arc");

    });
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
    expect(releaseSpeedPenalty(authoredSpeedToPx(1), 0.5)).toBeCloseTo(0.0875, 6);
    expect(releaseSpeedPenalty(authoredSpeedToPx(0), 0.5)).toBeCloseTo(0.0875, 6);
  });

  test("arc placement diagnostics split direct failure reasons by sample mode", () => {
    withArcPlacementMode("impact_frame", () => {
      resetArcPlacementStats();
      recordImpactAnchorDirectFailure("normal", "survival");
      recordImpactAnchorDirectFailure("normal", "landing");
      recordImpactAnchorDirectFailure("brake", "offbeat");

      const stats = snapshotArcPlacementStats();
      expect(stats?.direct_failed).toBe(3);
      expect(stats?.direct_survival_failed).toBe(1);
      expect(stats?.direct_landing_failed).toBe(1);
      expect(stats?.direct_offbeat_failed).toBe(1);
      expect(stats?.by_sample_mode.normal.direct_failed).toBe(2);
      expect(stats?.by_sample_mode.normal.direct_survival_failed).toBe(1);
      expect(stats?.by_sample_mode.normal.direct_landing_failed).toBe(1);
      expect(stats?.by_sample_mode.brake.direct_failed).toBe(1);
      expect(stats?.by_sample_mode.brake.direct_offbeat_failed).toBe(1);
    });
  });
});

describe("steep catch attempt policy", () => {
  const steepGap = gap(0, 0, 60);

  test("steep catch templates interleave with normal random attempts", () => {
    expect(steepCatchTemplateIndex(0)).toBe(0);
    expect(steepCatchTemplateIndex(1)).toBe(null);
    expect(steepCatchTemplateIndex(2)).toBe(1);
    expect(steepCatchTemplateIndex(30)).toBe(15);
    expect(steepCatchTemplateIndex(31)).toBe(null);
    expect(steepCatchTemplateIndex(32)).toBe(null);
  });

  test("steep catch template attempts still require steep local state", () => {
    expect(usesSteepCatchTemplateAttempt({ speed: 10, angleDeg: 0 }, steepGap, 0)).toBe(true);
    expect(usesSteepCatchTemplateAttempt({ speed: 10, angleDeg: 0 }, steepGap, 1)).toBe(false);
    expect(usesSteepCatchTemplateAttempt({ speed: 9.9, angleDeg: 55 }, steepGap, 2)).toBe(true);
    expect(usesSteepCatchTemplateAttempt({ speed: 9.9, angleDeg: 54.9 }, steepGap, 2)).toBe(false);
    expect(usesSteepCatchTemplateAttempt({ speed: 10, angleDeg: 0 }, gap(0, 0, 59), 0)).toBe(false);
  });

  test("extra sampler modes do not consume normal steep-template slots", () => {
    const steepState = { speed: 10, angleDeg: 0 };
    expect(sampleArcParamsRngDraws(steepState, steepGap, 0)).toBe(0);
    expect(sampleArcParamsRngDraws(steepState, steepGap, 0, "brake")).toBeGreaterThan(0);
    expect(sampleArcParamsRngDraws(steepState, steepGap, 0, "air_support")).toBeGreaterThan(0);
  });

  test("short-deadline rescue is based on local gap duration", () => {
    expect(shortDeadlineRescueCandidateCount(0)).toBe(0);
    expect(shortDeadlineRescueCandidateCount(10)).toBe(80);
    expect(shortDeadlineRescueCandidateCount(11)).toBe(80);
    expect(shortDeadlineRescueCandidateCount(12)).toBe(0);
    expect(shortDeadlineRescueCandidateCount(16)).toBe(0);
  });
});
