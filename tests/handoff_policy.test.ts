import { describe, expect, test } from "vitest";
import {
  brakeCandidateCount,
  contactStyleQualityCandidateCount,
  handoffCandidatePool,
  handoffAxisOvershootPenalty,
  handoffPreviewCostWeight,
  handoffSampleCount,
  handoffUsesFuturePreview,
  hasStartFeasibilityLookahead,
  shouldOfferBrakeCandidates,
  shouldAttemptNearTailCompletion,
  shouldUseExpandedBrakeSearch,
  shortDeadlineRescueCandidateCount,
  startAngles,
  targetStartAngle,
  usesExpandedBrakeSearch,
  usesHighSpeedStartOvershootScoring,
  usesSparseContractSearch,
} from "../scripts/v0/optimizer/handoff.ts";
import {
  steepCatchTemplateIndex,
  usesSteepCatchTemplateAttempt,
} from "../scripts/v0/core/candidate.ts";
import type { Gap } from "../scripts/v0/types.ts";
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

  test("expanded first-pass brake search avoids dense cadences", () => {
    expect(usesExpandedBrakeSearch([
      gap(0, 0, 13),
      gap(1, 13, 26),
      gap(2, 26, 39),
    ])).toBe(false);
    expect(usesExpandedBrakeSearch([
      gap(0, 0, 15),
      gap(1, 15, 31),
      gap(2, 31, 49),
    ])).toBe(true);
  });

  test("expanded first-pass brake work needs contact-style pressure", () => {
    expect(shouldUseExpandedBrakeSearch(false, true, gap(0, 0, 20))).toBe(false);
    expect(shouldUseExpandedBrakeSearch(false, true, {
      ...gap(0, 0, 20),
      targets: { contact_style: 0.5 },
    })).toBe(true);
    expect(shouldUseExpandedBrakeSearch(true, false, gap(0, 0, 13))).toBe(true);
  });

  test("preview cost is suppressed on contact-style gaps", () => {
    expect(handoffPreviewCostWeight(gap(0, 0, 20))).toBeGreaterThan(0);
    expect(handoffPreviewCostWeight({
      ...gap(0, 0, 20),
      targets: { contact_style: 0.5 },
    })).toBe(0);
  });

  test("future preview is reserved for contract search", () => {
    expect(handoffUsesFuturePreview(false)).toBe(true);
    expect(handoffUsesFuturePreview(true)).toBe(false);
  });

  test("high contact-style quality search gets one extra sample", () => {
    expect(contactStyleQualityCandidateCount(0.25)).toBe(2);
    expect(contactStyleQualityCandidateCount(0.74)).toBe(2);
    expect(contactStyleQualityCandidateCount(0.75)).toBe(3);
    expect(contactStyleQualityCandidateCount(1.0)).toBe(3);
  });

  test("near-tail completion is based on remaining contacts, not total contacts", () => {
    for (const totalContacts of [29, 30, 31, 60, 61, 77]) {
      const gaps = contactGaps(totalContacts);
      expect(shouldAttemptNearTailCompletion({
        search: nodeAt(totalContacts - 6),
        skippedContacts: 0,
      }, gaps)).toBe(true);
      expect(shouldAttemptNearTailCompletion({
        search: nodeAt(totalContacts - 7),
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
      { contact_style: 0.2, grain: 0.2 },
      { contact_style: 1, grain: 1 },
    )).toBe(0);
  });

  test("high-speed brake work needs contact style and severe overspeed", () => {
    expect(shouldOfferBrakeCandidates(0.78, 1.0, false)).toBe(true);
    expect(shouldOfferBrakeCandidates(0.8, 1.14, true)).toBe(false);
    expect(shouldOfferBrakeCandidates(0.8, 1.15, false)).toBe(false);
    expect(shouldOfferBrakeCandidates(0.8, 1.15, true)).toBe(true);
    expect(shouldOfferBrakeCandidates(0.8, 1.15, true, true)).toBe(true);
  });

  test("start feasibility scoring only requires two future contacts", () => {
    expect(hasStartFeasibilityLookahead([gap(0, 0, 24)])).toBe(false);
    expect(hasStartFeasibilityLookahead([gap(0, 0, 24), gap(1, 24, 46)])).toBe(true);
    expect(hasStartFeasibilityLookahead([gap(0, 0, 25), gap(1, 25, 48)])).toBe(true);
    expect(hasStartFeasibilityLookahead([gap(0, 0, 40), gap(1, 40, 80)])).toBe(true);
  });

  test("start overshoot scoring is gated to high-speed openings", () => {
    expect(usesHighSpeedStartOvershootScoring({ speed: 0.75 })).toBe(true);
    expect(usesHighSpeedStartOvershootScoring({ speed: 0.74 })).toBe(false);
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

  test("short-deadline rescue is based on local gap duration", () => {
    expect(shortDeadlineRescueCandidateCount(0)).toBe(0);
    expect(shortDeadlineRescueCandidateCount(10)).toBe(80);
    expect(shortDeadlineRescueCandidateCount(11)).toBe(80);
    expect(shortDeadlineRescueCandidateCount(12)).toBe(0);
    expect(shortDeadlineRescueCandidateCount(16)).toBe(0);
  });
});
