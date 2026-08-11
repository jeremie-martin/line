import { describe, expect, test } from "vitest";
import { axisQualityForTargets } from "../scripts/v0/score.ts";
import {
  type AxisValues,
  type Gap,
  type TrackLine,
} from "../scripts/v0/types.ts";
import type { GapFit, ResolvedStart } from "../scripts/v0/core/substrate.ts";
import type { BallisticFitFields } from "../scripts/v0/core/ballistic_projection.ts";
import {
  projectOutgoingScorerGap,
  projectedOutgoingSurrogateQuality,
  scoreCandidateProposal,
  scoreNextArcReadiness,
  scoreSettledIncomingQuality,
  setProposalUtilityPowers,
  settledIncomingAxes,
} from "../scripts/v0/optimizer/objective.ts";
import { applyReadinessStudyAblation } from "../scripts/v0/optimizer/readiness.ts";
import { sortCandidatesByQuality } from "../scripts/v0/optimizer/aim.ts";
import { forwardTerminalReadiness, snapshotHandoffNode, type HandoffNode } from "../scripts/v0/optimizer/handoff.ts";
import type { Candidate } from "../scripts/v0/optimizer/sample.ts";
import type { SearchNode } from "../scripts/v0/optimizer/node.ts";
import type { LeafKey } from "../scripts/v0/optimizer/register.ts";
import {
  BALLISTIC_POINT_IDS,
  type ConstraintBallisticState,
} from "../scripts/v0/core/ballistic_micro_sim.ts";

function gap(
  index: number,
  startFrame: number,
  endFrame: number,
  targets: AxisValues = {},
  endsWithContact = true,
): Gap {
  return { index, startFrame, endFrame, endsWithContact, targets };
}

function line(id = 1): TrackLine {
  return {
    id,
    type: 0,
    x1: 0,
    y1: 0,
    x2: 10,
    y2: 0,
    flipped: false,
    leftExtended: false,
    rightExtended: false,
  };
}

function constraintState(
  vx: number,
  vy: number,
): ConstraintBallisticState {
  const base = {
    PEG: [0, 0],
    TAIL: [0, 5],
    NOSE: [15, 5],
    STRING: [17.5, 0],
    BUTT: [5, 0],
    SHOULDER: [5, -5.5],
    RHAND: [11.5, -5],
    LHAND: [11.5, -5],
    LFOOT: [10, 5],
    RFOOT: [10, 5],
  } as const;
  const points = Object.fromEntries(BALLISTIC_POINT_IDS.map((id) => {
    const [baseX, baseY] = base[id];
    const x = baseX - 53 / 6;
    const y = baseY + 11 / 12;
    return [id, {
      x,
      y,
      prevX: x - vx,
      prevY: y - vy,
      vx,
      vy,
    }];
  })) as ConstraintBallisticState["points"];
  return {
    frameOffset: 0,
    points,
    riderMounted: true,
    sledIntact: true,
  };
}

/** A minimal canonical launch packet with one grounded start frame followed
 * by the airborne anchor. */
function ballisticLaunch(
  gapStartFrame: number,
  anchorFrame: number,
  vx: number,
  vy: number,
): NonNullable<BallisticFitFields["ballisticLaunch"]> {
  const speed = Math.hypot(vx, vy);
  const frames = anchorFrame - gapStartFrame + 1;
  return {
    gapStartFrame,
    anchorFrame,
    state: {
      x: 0,
      y: 0,
      vx,
      vy,
      speed,
      comAngleDeg: Math.atan2(vy, vx) * 180 / Math.PI,
      sledPoseDeg: null,
      sledPoseRateDegPerFrame: null,
      constraintState: constraintState(vx, vy),
    },
    prefix: {
      startFrame: gapStartFrame,
      prefixEndFrame: anchorFrame,
      airFrames: Math.max(0, frames - 1),
      speedSumPx: speed * frames,
      speedFrames: frames,
      dy: vy * Math.max(0, frames - 1),
      v0SpeedPx: speed,
      displacementYByFrame: Array.from(
        { length: frames },
        (_, index) => vy * index,
      ),
    },
    groundedFrames: 1,
    airborne: true,
  };
}

function candidate(
  cost: number,
  achieved: AxisValues,
  launch?: BallisticFitFields["ballisticLaunch"],
): Candidate {
  return {
    arc: null,
    geometry: "lines",
    lines: [line()],
    achieved,
    cost,
    ...(launch === undefined ? {} : { ballisticLaunch: launch }),
  };
}

describe("contact-indexed proposal objective", () => {
  test("study ablations neutralize only the named readiness factor", () => {
    const factors = {
      catchability: 0.2,
      speedFit: 0.3,
      airFit: 0.4,
      impactFeasibility: 0.5,
      elevationFit: 0.6,
    };
    expect(applyReadinessStudyAblation(factors, "normal"))
      .toBeCloseTo(0.2 * 0.3 * 0.4 * 0.5 * 0.6, 12);
    expect(applyReadinessStudyAblation(factors, "neutral")).toBe(1);
    expect(
      applyReadinessStudyAblation(factors, "without-catchability"),
    ).toBeCloseTo(0.3 * 0.4 * 0.5 * 0.6, 12);
    expect(applyReadinessStudyAblation(factors, "without-speed"))
      .toBeCloseTo(0.2 * 0.4 * 0.5 * 0.6, 12);
    expect(applyReadinessStudyAblation(factors, "without-air"))
      .toBeCloseTo(0.2 * 0.3 * 0.5 * 0.6, 12);
    expect(applyReadinessStudyAblation(factors, "without-impact"))
      .toBeCloseTo(0.2 * 0.3 * 0.4 * 0.6, 12);
    expect(applyReadinessStudyAblation(factors, "without-elevation"))
      .toBeCloseTo(0.2 * 0.3 * 0.4 * 0.5, 12);
  });

  test("settled incoming quality reuses the scorer definition, including impact", () => {
    const g = gap(0, 0, 20, { air: 0.5, impact: 0.8 });
    const achieved = { air: 0.4, impact: 0.7 };
    expect(scoreSettledIncomingQuality(g.targets, achieved)).toBeCloseTo(
      axisQualityForTargets(g.targets, achieved).axis_quality,
      12,
    );
  });

  test("settled incoming axes are the canonical exact measurement", () => {
    expect(settledIncomingAxes(candidate(0, { air: 0.4 }))).toEqual({
      air: 0.4,
    });
  });

  test("outgoing projection and next-arc readiness own different gaps", () => {
    const incoming = gap(0, 0, 20, { impact: 0.5 });
    const outgoing = gap(1, 20, 40, { air: 0.4, impact: 0.7 });
    const readinessOutgoing = gap(2, 40, 60, {
      speed: 0.6,
      air: 0.3,
    });
    const fit = candidate(
      0,
      { impact: 0.55 },
      ballisticLaunch(20, 22, 8, -1),
    );
    const projection = projectOutgoingScorerGap(fit, outgoing);
    expect(projection).not.toBeNull();
    expect(projection!.achieved.speed).toEqual(expect.any(Number));
    expect(projection!.achieved.air).toEqual(expect.any(Number));

    const scored = scoreNextArcReadiness(
      projection!.projection,
      outgoing,
      readinessOutgoing,
    );
    expect(scored.catchability).toBeGreaterThanOrEqual(0);
    expect(scored.catchability).toBeLessThanOrEqual(1);
    expect(scored.impactFeasibility).toBeGreaterThanOrEqual(0);
    expect(scored.impactFeasibility).toBeLessThanOrEqual(1);
    expect(scored.speedFit).toBeGreaterThanOrEqual(0);
    expect(scored.speedFit).toBeLessThanOrEqual(1);
    expect(scored.airFit).toBeGreaterThanOrEqual(0);
    expect(scored.airFit).toBeLessThanOrEqual(1);
    expect(scored.elevationFit).toBe(1);
    expect(scored.readiness).toBeCloseTo(
      scored.catchability *
        scored.speedFit *
        scored.airFit *
        scored.impactFeasibility,
      12,
    );
  });

  test("unauthored readiness factors are exactly neutral", () => {
    const incoming = gap(1, 20, 40, {});
    const fit = candidate(
      0,
      {},
      ballisticLaunch(20, 22, 8, -1),
    );
    const projection = projectOutgoingScorerGap(fit, incoming)!;
    const scored = scoreNextArcReadiness(
      projection.projection,
      incoming,
      null,
    );
    expect(scored.impactFeasibility).toBe(1);
    expect(scored.speedFit).toBe(1);
    expect(scored.airFit).toBe(1);
    expect(scored.elevationFit).toBe(1);
    expect(scored.readiness).toBe(scored.catchability);
  });

  test("an authored zero impact ask remains a finite scored target", () => {
    const incoming = gap(1, 20, 40, { impact: 0 });
    const fit = candidate(
      0,
      {},
      ballisticLaunch(20, 22, 8, -1),
    );
    const projection = projectOutgoingScorerGap(fit, incoming)!;
    const scored = scoreNextArcReadiness(
      projection.projection,
      incoming,
      null,
    );
    expect(scored.impactFeasibility).toBeGreaterThanOrEqual(0);
    expect(scored.impactFeasibility).toBeLessThan(1);
    expect(scored.readiness).toBeCloseTo(
      scored.catchability * scored.impactFeasibility,
      12,
    );
  });

  test("readiness rejects gaps from another contact boundary", () => {
    const incoming = gap(1, 20, 40, {});
    const fit = candidate(
      0,
      {},
      ballisticLaunch(20, 22, 8, -1),
    );
    const projection = projectOutgoingScorerGap(fit, incoming)!;

    expect(() =>
      scoreNextArcReadiness(
        projection.projection,
        { ...incoming, endFrame: 39 },
        null,
      )
    ).toThrow(/does not terminate at its incoming boundary/);
    expect(() =>
      scoreNextArcReadiness(
        projection.projection,
        incoming,
        gap(2, 41, 60, {}),
      )
    ).toThrow(/not a forward interval from its incoming boundary/);
  });

  test("an authored projected elevation is scored outside readiness", () => {
    const next = gap(1, 20, 40, { elevation: 0.8 });
    const fit = candidate(
      0,
      {},
      ballisticLaunch(20, 22, 8, -2),
    );
    const first = projectOutgoingScorerGap(fit, next);
    const second = projectOutgoingScorerGap(fit, next);
    expect(first).not.toBeNull();
    expect(first?.projection.elevation).toEqual(expect.any(Number));
    expect(second?.projection).toBe(first?.projection);
    expect(first!.scoredAxisCount).toBe(1);
  });

  test("a targeted projected aggregate fails closed when unavailable", () => {
    const outgoing = gap(1, 20, 40, { amplitude: 0.7 });
    const launch = ballisticLaunch(20, 22, 8, -2);
    delete launch.prefix.displacementYByFrame;
    const fit = candidate(0, {}, launch);
    expect(projectOutgoingScorerGap(fit, outgoing)).toBeNull();
  });

  test("the outgoing surrogate scores amplitude when the response model provides it", () => {
    const withoutAmplitude = projectedOutgoingSurrogateQuality(
      { amplitude: 0.8 },
      Number.NaN,
      Number.NaN,
      undefined,
    );
    const withAmplitude = projectedOutgoingSurrogateQuality(
      { amplitude: 0.8 },
      Number.NaN,
      Number.NaN,
      undefined,
      0.2,
    );
    expect(withoutAmplitude).toBe(1);
    expect(withAmplitude).toBeLessThan(withoutAmplitude!);
  });

  test("proposal utility contains all three temporal layers exactly once", () => {
    const current = gap(0, 0, 20, { air: 0.5 });
    const next = gap(1, 20, 40, { speed: 0.5 });
    const after = gap(2, 40, 60, { air: 0.4 });
    const fit = candidate(
      0,
      { air: 0.45 },
      ballisticLaunch(20, 22, 9.5, -1),
    );
    const scored = scoreCandidateProposal(
      fit,
      current,
      [current, next, after],
    );
    expect(scored).not.toBeNull();
    // Exactly the three layers, multiplied in this order. The order is load
    // bearing: an algebraically identical regrouping cost 14 headline points at
    // N=48 (see proposalUtility).
    expect(scored!.value).toBe(
      scored!.settledIncomingQuality *
        scored!.projectedOutgoingQuality *
        scored!.readiness,
    );
  });

  test("the readiness exponent follows the future exponent unless set", () => {
    const current = gap(0, 0, 20, { air: 0.5 });
    const next = gap(1, 20, 40, { speed: 0.5 });
    const after = gap(2, 40, 60, { air: 0.4 });
    const gaps = [current, next, after];
    const scoreOnce = () =>
      scoreCandidateProposal(
        candidate(0, { air: 0.45 }, ballisticLaunch(20, 22, 9.5, -1)),
        current,
        gaps,
      )!;
    const clamped = (value: number, power: number) =>
      Math.max(0, Math.min(1, value)) ** power;

    try {
      // Unset: readiness follows futureQualityPower, reproducing exactly the
      // two-exponent compiler this knob was added beside. This is what keeps the
      // default tree bit-identical on the five specs where
      // objectiveBlendReadinessPowerForSpec resolves a non-neutral value.
      setProposalUtilityPowers({ futureQualityPower: 0.75 });
      const shared = scoreOnce();
      expect(shared.readiness).toBeLessThan(1);
      expect(shared.projectedOutgoingQuality).toBeLessThan(1);
      expect(shared.value).toBe(
        shared.settledIncomingQuality *
          clamped(shared.projectedOutgoingQuality, 0.75) *
          clamped(shared.readiness, 0.75),
      );

      // Set: readiness decouples and projected keeps the future exponent. This
      // is the arm the exponent sweep measures.
      setProposalUtilityPowers({ futureQualityPower: 0.75, readinessPower: 2 });
      const split = scoreOnce();
      expect(split.value).toBe(
        split.settledIncomingQuality *
          clamped(split.projectedOutgoingQuality, 0.75) *
          clamped(split.readiness, 2),
      );
      expect(split.value).not.toBe(shared.value);
    } finally {
      setProposalUtilityPowers();
    }
  });

  test("candidate pool ranking uses the canonical proposal objective over cost", () => {
    const current = gap(0, 0, 20, { air: 0.5 });
    const next = gap(1, 20, 40, { speed: 0.4 });
    const after = gap(2, 40, 60, { air: 0.4 });
    const cheapBad = candidate(
      0.01,
      { air: 0.5 },
      ballisticLaunch(20, 21, 4, -4),
    );
    const costlyGood = candidate(
      10,
      { air: 0.5 },
      ballisticLaunch(20, 21, 8, 0),
    );

    const goodObj = scoreCandidateProposal(
      costlyGood,
      current,
      [current, next, after],
    )!.value;
    const badObj = scoreCandidateProposal(
      cheapBad,
      current,
      [current, next, after],
    )!.value;

    const ranked = sortCandidatesByQuality(
      {},
      current,
      [current, next, after],
      [cheapBad, costlyGood],
      false,
    );
    expect(ranked[0]).toBe(
      goodObj > badObj ? costlyGood : cheapBad,
    );
  });

  test("the final arc owns and projects the non-contact scorer tail", () => {
    const current = gap(0, 0, 20, { impact: 0 });
    const tail = gap(1, 20, 40, { air: 1, speed: 0.5 }, false);
    const fit = candidate(
      0,
      { impact: 0 },
      ballisticLaunch(20, 22, 9.5, -1),
    );
    const scored = scoreCandidateProposal(
      fit,
      current,
      [current, tail],
    );
    expect(scored).not.toBeNull();
    expect(scored!.projectedOutgoingQuality).toBeGreaterThan(0);
    expect(scored!.readiness).toBe(1);
    expect(scored!.value).toBeCloseTo(
      scored!.settledIncomingQuality *
        scored!.projectedOutgoingQuality,
      12,
    );
  });
});

describe("diagnostic frontier readiness", () => {
  test("terminal readiness reads the last committed fit's frontier readiness", () => {
    const current = gap(0, 0, 20, { air: 0.5 });
    const next = gap(1, 20, 40, {});
    const fit = candidate(
      0,
      { air: 0.5 },
      ballisticLaunch(20, 21, 8, 0),
    );
    const node: SearchNode = {
      gapIndex: 1,
      prefixFits: [fit],
      prefixEngine: null,
      prefixNextLineId: 2,
      cumulativeCost: 0,
      _candidatesCache: null,
    };

    const projection = projectOutgoingScorerGap(fit, next)!;
    expect(forwardTerminalReadiness(node, [current, next])).toBeCloseTo(
      scoreNextArcReadiness(projection.projection, next, null).readiness,
      12,
    );
  });

  test("terminal readiness is neutral when the frontier state is unavailable", () => {
    const current = gap(0, 0, 20, { air: 0.5 });
    const next = gap(1, 20, 40, {});
    const fit = candidate(0, { air: 0.5 });
    const node: SearchNode = {
      gapIndex: 1,
      prefixFits: [fit],
      prefixEngine: null,
      prefixNextLineId: 2,
      cumulativeCost: 0,
      _candidatesCache: null,
    };

    expect(forwardTerminalReadiness(node, [current, next])).toBe(1);
  });

  test("handoff snapshots preserve objective-relevant arrival fields", () => {
    const startState: ResolvedStart = {
      position: { x: 0, y: 0 },
      velocity: { x: 0.4, y: 0 },
    };
    const points = Object.fromEntries(BALLISTIC_POINT_IDS.map((id, index) => [
      id,
      {
        x: index,
        y: index + 1,
        prevX: index - 2,
        prevY: index,
        vx: 2,
        vy: 1,
      },
    ])) as ConstraintBallisticState["points"];
    const fit: GapFit & BallisticFitFields = {
      ...candidate(0, { air: 0.5 }),
      contactFrameOffset: 1,
      ballisticLaunch: {
        ...ballisticLaunch(20, 28, 3, 4),
        state: {
          ...ballisticLaunch(20, 28, 3, 4).state,
          constraintState: {
          frameOffset: 0,
          points,
          riderMounted: true,
          sledIntact: true,
          },
        },
      },
    };
    const node: HandoffNode = {
      search: {
        gapIndex: 1,
        prefixFits: [fit],
        prefixEngine: null,
        prefixNextLineId: 2,
        cumulativeCost: 0,
        _candidatesCache: null,
      },
      startState,
      startLines: [],
      startRank: 0,
      searchSeed: 0,
      startExpanded: true,
      deferExpansion: false,
      rankTrace: [],
      skippedContacts: 0,
    };
    const key: LeafKey = { contract_passed: false, axis_quality: 0, full_score: 0 };
    const event = {
      phase: "frontier" as const,
      simFrames: 0,
      fullDuration: false,
      outputDurationFrames: 1,
      improved: false,
      improvementCount: 0,
      consideredCount: 0,
    };

    const cloned = snapshotHandoffNode(node, key, event).node.search
      .prefixFits[0]! as GapFit & BallisticFitFields;
    expect(cloned.ballisticLaunch).toEqual(fit.ballisticLaunch);
    expect(cloned.ballisticLaunch?.state.constraintState).not.toBe(
      fit.ballisticLaunch?.state.constraintState,
    );
    expect(cloned.ballisticLaunch?.state.constraintState?.points.PEG).not.toBe(
      fit.ballisticLaunch?.state.constraintState?.points.PEG,
    );
    expect(cloned.contactFrameOffset).toBe(1);
  });
});
