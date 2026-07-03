import { describe, expect, test } from "vitest";
import { axisQualityForTargets } from "../scripts/v0/score.ts";
import {
  impactToRedirArcPx,
  authoredSpeedToPx,
  type AxisValues,
  type Gap,
  type TrackLine,
} from "../scripts/v0/types.ts";
import type { GapFit, ResolvedStart } from "../scripts/v0/core/substrate.ts";
import {
  OBJECTIVE_SPEED_OVERSHOOT_PENALTY_WEIGHT,
  OBJECTIVE_SPEED_SCALE_PXF,
  frontierReadinessFromFit,
  impactAskPressure,
  impactFeasibility,
  predictArrivalAtNextContact,
  scoreCurrentTargetQuality,
  scoreGapObjectiveForTargets,
  scoreNextTargetReadiness,
} from "../scripts/v0/optimizer/objective.ts";
import { readinessCatch } from "../scripts/v0/optimizer/readiness.ts";
import { sortCandidatesByQuality } from "../scripts/v0/optimizer/aim.ts";
import { forwardTerminalReadiness, snapshotHandoffNode, type HandoffNode } from "../scripts/v0/optimizer/handoff.ts";
import type { Candidate } from "../scripts/v0/optimizer/sample.ts";
import type { SearchNode } from "../scripts/v0/optimizer/node.ts";
import type { LeafKey } from "../scripts/v0/optimizer/register.ts";

function gap(index: number, startFrame: number, endFrame: number, targets: AxisValues = {}): Gap {
  return { index, startFrame, endFrame, endsWithContact: true, targets };
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

/** An airborne release state at `frame` with launch velocity (vx, vy); the
 *  objective propagates it ballistically to the next contact. */
function releaseState(
  frame: number,
  vx: number,
  vy: number,
): GapFit["releaseArrivalState"] {
  return {
    frame,
    x: 0,
    y: 0,
    vx,
    vy,
    sledPoseDeg: null,
    sledPoseRateDegPerFrame: null,
    grounded: 1,
    airborne: true,
  };
}

function candidate(
  cost: number,
  achieved: AxisValues,
  releaseArrivalState?: GapFit["releaseArrivalState"],
): Candidate {
  return {
    arc: null,
    geometry: "lines",
    lines: [line()],
    achieved,
    cost,
    ...(releaseArrivalState === undefined ? {} : { releaseArrivalState }),
  };
}

describe("unified objective quality score", () => {
  test("current gap quality reuses the scorer axis-quality definition, including impact", () => {
    const g = gap(0, 0, 20, { air: 0.5, impact: 0.8 });
    const achieved = { air: 0.4, impact: 0.7 };
    expect(scoreCurrentTargetQuality(g.targets, achieved)).toBeCloseTo(
      axisQualityForTargets(g.targets, achieved).axis_quality,
      12,
    );
  });

  test("next-gap readiness is catchability times speed fit times impact feasibility", () => {
    const next = gap(1, 20, 40, { speed: 0.5, impact: 0.8 });
    const arrival = { speed: 10, comAngleDeg: 30 };
    const scored = scoreNextTargetReadiness(arrival, next.targets);
    expect(scored).not.toBeNull();

    const catchability = readinessCatch(arrival.speed, arrival.comAngleDeg);
    // speedFit is asymmetric: overshoot (too fast) is half-penalized, too-slow full.
    const dSpeed = arrival.speed - authoredSpeedToPx(0.5);
    const speedFit = Math.exp(
      -(dSpeed > 0 ? dSpeed * OBJECTIVE_SPEED_OVERSHOOT_PENALTY_WEIGHT : -dSpeed) /
        OBJECTIVE_SPEED_SCALE_PXF,
    );
    const impactFeasibility = Math.min(
      1,
      Math.max(0, (arrival.speed * ((arrival.comAngleDeg * Math.PI) / 180)) / impactToRedirArcPx(0.8)),
    );
    expect(scored!.catchability).toBeCloseTo(catchability, 12);
    expect(scored!.speedFit).toBeCloseTo(speedFit, 12);
    expect(scored!.impactFeasibility).toBeCloseTo(impactFeasibility, 12);
    expect(scored!.readiness).toBeCloseTo(catchability * speedFit * impactFeasibility, 12);
  });

  test("soft impact asks blend no-constraint readiness into feasibility", () => {
    const arrival = { speed: 6, comAngleDeg: 5 };
    const impactAsk = 0.3;
    const scored = scoreNextTargetReadiness(arrival, { impact: impactAsk });
    expect(scored).not.toBeNull();

    const pressure = impactAskPressure(impactAsk);
    const feasibility = impactFeasibility(arrival.speed, arrival.comAngleDeg, impactAsk);
    expect(pressure).toBeCloseTo(0.5, 12);
    expect(scored!.impactFeasibility).toBeCloseTo(1 + (feasibility - 1) * pressure, 12);
  });

  test("readiness still scores catchability when the next gap has no speed or impact ask", () => {
    const next = gap(1, 20, 40, {});
    const scored = scoreNextTargetReadiness({ speed: 9, comAngleDeg: 15 }, next.targets);
    expect(scored).not.toBeNull();
    expect(scored!.speedFit).toBe(1);
    expect(scored!.impactFeasibility).toBe(1);
    expect(scored!.readiness).toBeCloseTo(readinessCatch(9, 15), 12);
  });

  test("gap objective is current quality times composite readiness", () => {
    const current = gap(0, 0, 20, { air: 0.5, impact: 0.8 });
    const next = gap(1, 20, 40, { speed: 0.5 });
    const achieved = { air: 0.45, impact: 0.75 };
    const arrival = { speed: 9.5, comAngleDeg: 12 };
    const scored = scoreGapObjectiveForTargets(current.targets, achieved, arrival, next.targets);
    expect(scored).not.toBeNull();
    expect(scored!.value).toBeCloseTo(scored!.currentQuality * scored!.readiness, 12);
  });

  test("candidate pool ranking uses the predicted-arrival objective over cost", () => {
    // `next` is catchability-only (empty targets). Both candidates release at
    // frame 20 and propagate ballistically 20 frames to the next contact; the
    // launch velocity drives the predicted-arrival readiness. The "good" launch
    // arrives more catchable and must rank first despite costing far more.
    const current = gap(0, 0, 20, { air: 0.5 });
    const next = gap(1, 20, 40, {});
    const cheapBad = candidate(0.01, { air: 0.5 }, releaseState(20, 4, -4));
    const costlyGood = candidate(10, { air: 0.5 }, releaseState(20, 8, 0));

    const goodObj = scoreGapObjectiveForTargets(
      current.targets,
      { air: 0.5 },
      predictArrivalAtNextContact(costlyGood, next)!,
      next.targets,
    )!.value;
    const badObj = scoreGapObjectiveForTargets(
      current.targets,
      { air: 0.5 },
      predictArrivalAtNextContact(cheapBad, next)!,
      next.targets,
    )!.value;
    expect(goodObj).toBeGreaterThan(badObj);

    const ranked = sortCandidatesByQuality({}, current, [current, next], [cheapBad, costlyGood], false);
    expect(ranked[0]).toBe(costlyGood);
    expect(ranked[1]).toBe(cheapBad);
  });
});

describe("diagnostic frontier readiness", () => {
  test("terminal readiness reads the last committed fit's frontier readiness", () => {
    const current = gap(0, 0, 20, { air: 0.5 });
    const next = gap(1, 20, 40, {});
    const fit = candidate(0, { air: 0.5 }, releaseState(20, 8, 0));
    const node: SearchNode = {
      gapIndex: 1,
      prefixFits: [fit],
      prefixEngine: null,
      prefixNextLineId: 2,
      cumulativeCost: 0,
      _candidatesCache: null,
    };

    expect(forwardTerminalReadiness(node, [current, next])).toBeCloseTo(
      frontierReadinessFromFit(fit, next)!.readiness,
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
    const fit: GapFit = {
      ...candidate(0, { air: 0.5 }),
      releaseArrivalState: {
        frame: 28,
        x: 1,
        y: 2,
        vx: 3,
        vy: 4,
        sledPoseDeg: null,
        sledPoseRateDegPerFrame: null,
        grounded: 1,
        airborne: true,
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
      phase: "main" as const,
      simFrames: 0,
      fullDuration: false,
      outputDurationFrames: 1,
      improved: false,
      improvementCount: 0,
      consideredCount: 0,
    };

    const cloned = snapshotHandoffNode(node, key, event).node.search.prefixFits[0]!;
    expect(cloned.releaseArrivalState).toEqual(fit.releaseArrivalState);
  });
});
