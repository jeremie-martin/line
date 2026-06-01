import { describe, expect, test } from "vitest";
import {
  brakeCandidateCount,
  handoffCandidatePool,
  hasStartFeasibilityLookahead,
  isSpeedRunaway,
  shouldAttemptNearTailCompletion,
  startAngles,
  targetStartAngle,
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

function nodeAt(gapIndex: number): SearchNode {
  return {
    gapIndex,
    prefixFits: [],
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

  test("near-tail completion is based on remaining contacts, not total contacts", () => {
    for (const totalContacts of [29, 30, 31, 60, 61, 77]) {
      const gaps = contactGaps(totalContacts);
      expect(shouldAttemptNearTailCompletion({
        search: nodeAt(totalContacts - 3),
        skippedContacts: 0,
      }, gaps)).toBe(true);
      expect(shouldAttemptNearTailCompletion({
        search: nodeAt(totalContacts - 4),
        skippedContacts: 0,
      }, gaps)).toBe(false);
    }

    const gaps = contactGaps(31);
    expect(shouldAttemptNearTailCompletion({ search: nodeAt(28), skippedContacts: 1 }, gaps)).toBe(false);
    expect(shouldAttemptNearTailCompletion({ search: nodeAt(31), skippedContacts: 0 }, gaps)).toBe(false);
  });

  test("brake work is allocated from local overspeed only", () => {
    expect(brakeCandidateCount(0.99)).toBe(0);
    expect(brakeCandidateCount(1.0)).toBe(2);
    expect(brakeCandidateCount(1.14)).toBe(2);
    expect(brakeCandidateCount(1.15)).toBe(3);
    expect(brakeCandidateCount(2.0)).toBe(3);
  });

  test("start feasibility scoring only requires two future contacts", () => {
    expect(hasStartFeasibilityLookahead([gap(0, 0, 24)])).toBe(false);
    expect(hasStartFeasibilityLookahead([gap(0, 0, 24), gap(1, 24, 46)])).toBe(true);
    expect(hasStartFeasibilityLookahead([gap(0, 0, 25), gap(1, 25, 48)])).toBe(true);
    expect(hasStartFeasibilityLookahead([gap(0, 0, 40), gap(1, 40, 80)])).toBe(true);
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
});

describe("sustained speed-runaway detector (isSpeedRunaway)", () => {
  // Readings are most-recent-first; the window needs RUNAWAY_RUN_LEN+1 (=4) of
  // them. Defaults at time of writing: RUN_LEN=3, RISE_MIN=0.18, MARGIN=0.5.
  test("fires on a genuine runaway: speed climbing while target recedes, still overshooting", () => {
    const runaway = [
      { sp: 1.50, tgt: 0.50 }, // recent
      { sp: 1.30, tgt: 0.55 },
      { sp: 1.15, tgt: 0.58 },
      { sp: 1.00, tgt: 0.60 }, // RUN_LEN catches back
    ];
    expect(isSpeedRunaway(runaway)).toBe(true);
  });

  test("exempts a legitimately fast section whose target is RISING (a crescendo)", () => {
    // Speed rose and overshoots, but the target rose too — on-curve, not a runaway.
    const crescendo = [
      { sp: 1.50, tgt: 0.90 },
      { sp: 1.30, tgt: 0.78 },
      { sp: 1.15, tgt: 0.70 },
      { sp: 1.00, tgt: 0.60 },
    ];
    expect(isSpeedRunaway(crescendo)).toBe(false);
  });

  test("exempts steady fast riding: target flat but speed not climbing", () => {
    const steady = [
      { sp: 1.20, tgt: 0.50 },
      { sp: 1.18, tgt: 0.50 },
      { sp: 1.17, tgt: 0.50 },
      { sp: 1.15, tgt: 0.50 },
    ];
    expect(isSpeedRunaway(steady)).toBe(false);
  });

  test("does not fire once the rider has bled back near target (overshoot under margin)", () => {
    const recovered = [
      { sp: 0.90, tgt: 0.50 }, // climbed, target flat, but overshoot 0.40 < 0.50
      { sp: 0.75, tgt: 0.50 },
      { sp: 0.65, tgt: 0.50 },
      { sp: 0.60, tgt: 0.50 },
    ];
    expect(isSpeedRunaway(recovered)).toBe(false);
  });

  test("needs a full window — too few committed catches never trips it", () => {
    const short = [
      { sp: 1.50, tgt: 0.50 },
      { sp: 1.00, tgt: 0.60 },
    ];
    expect(isSpeedRunaway(short)).toBe(false);
  });
});
