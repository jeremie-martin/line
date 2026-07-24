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
import type { BallisticFitFields } from "../scripts/v0/core/ballistic_projection.ts";
import {
  currentGapAxes,
  frontierReadinessFromFit,
  predictArrivalAtNextContact,
  scoreCurrentTargetQuality,
  scoreGapObjectiveForTargets,
  scoreNextTargetReadiness,
  setObjectiveBlendPowers,
} from "../scripts/v0/optimizer/objective.ts";
import {
  impactAskPressure,
  impactFeasibility,
  READINESS_SPEED_OVERSHOOT_WEIGHT,
  READINESS_SPEED_SCALE_PXF,
} from "../scripts/v0/optimizer/readiness.ts";
import { predictCatchability } from "../scripts/v0/optimizer/catchability.ts";
import { sortCandidatesByQuality } from "../scripts/v0/optimizer/aim.ts";
import { forwardTerminalReadiness, snapshotHandoffNode, type HandoffNode } from "../scripts/v0/optimizer/handoff.ts";
import type { Candidate } from "../scripts/v0/optimizer/sample.ts";
import type { SearchNode } from "../scripts/v0/optimizer/node.ts";
import type { LeafKey } from "../scripts/v0/optimizer/register.ts";
import {
  BALLISTIC_POINT_IDS,
  type ConstraintBallisticState,
} from "../scripts/v0/core/ballistic_micro_sim.ts";

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
    sampleCount: 1,
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

describe("unified objective quality score", () => {
  test("current gap quality reuses the scorer axis-quality definition, including impact", () => {
    const g = gap(0, 0, 20, { air: 0.5, impact: 0.8 });
    const achieved = { air: 0.4, impact: 0.7 };
    expect(scoreCurrentTargetQuality(g.targets, achieved)).toBeCloseTo(
      axisQualityForTargets(g.targets, achieved).axis_quality,
      12,
    );
  });

  test("current-gap axes are the canonical scorer-window measurement", () => {
    expect(currentGapAxes(candidate(0, { air: 0.4 }))).toEqual({ air: 0.4 });
  });

  test("next-gap readiness always exposes the canonical five-factor product", () => {
    const next = gap(1, 20, 40, { speed: 0.5, impact: 0.8 });
    const incoming = {
      vx: 10 * Math.cos(Math.PI / 6),
      vy: 5,
      speed: 10,
      comAngleDeg: 30,
      sledPoseDeg: null,
      sledPoseRateDegPerFrame: null,
    };
    const arrival = { incoming, meanSpeedPx: 10 };
    const scored = scoreNextTargetReadiness(arrival, next.targets);
    expect(scored).not.toBeNull();

    const catchability = predictCatchability(
      incoming.speed,
      incoming.comAngleDeg,
    );
    // speedFit is asymmetric: overshoot (too fast) is half-penalized, too-slow full.
    const dSpeed = arrival.meanSpeedPx - authoredSpeedToPx(0.5);
    const speedFit = Math.exp(
      -(dSpeed > 0 ? dSpeed * READINESS_SPEED_OVERSHOOT_WEIGHT : -dSpeed) /
        READINESS_SPEED_SCALE_PXF,
    );
    const impactFeasibility = Math.min(
      1,
      Math.max(0, (incoming.speed * ((incoming.comAngleDeg * Math.PI) / 180)) / impactToRedirArcPx(0.8)),
    );
    expect(scored!.catchability).toBeCloseTo(catchability, 12);
    expect(scored!.speedFit).toBeCloseTo(speedFit, 12);
    expect(scored!.airFit).toBe(1);
    expect(scored!.impactFeasibility).toBeCloseTo(impactFeasibility, 12);
    expect(scored!.elevationFit).toBe(1);
    expect(scored!.readiness).toBeCloseTo(catchability * speedFit * impactFeasibility, 12);
  });

  test("a projected broken binding has zero catchability and readiness", () => {
    const scored = scoreNextTargetReadiness({
      incoming: {
        vx: 9,
        vy: 1,
        speed: Math.hypot(9, 1),
        comAngleDeg: Math.atan2(1, 9) * 180 / Math.PI,
        sledPoseDeg: 0,
        sledPoseRateDegPerFrame: 0,
        riderMounted: false,
        sledIntact: true,
      },
    }, {});
    expect(scored).not.toBeNull();
    expect(scored!.catchability).toBe(0);
    expect(scored!.readiness).toBe(0);
  });

  test("soft impact asks blend no-constraint readiness into feasibility", () => {
    const incoming = {
      vx: 6 * Math.cos(5 * Math.PI / 180),
      vy: 6 * Math.sin(5 * Math.PI / 180),
      speed: 6,
      comAngleDeg: 5,
      sledPoseDeg: null,
      sledPoseRateDegPerFrame: null,
    };
    const arrival = { incoming };
    const impactAsk = 0.3;
    const scored = scoreNextTargetReadiness(arrival, { impact: impactAsk });
    expect(scored).not.toBeNull();

    const pressure = impactAskPressure(impactAsk);
    const feasibility = impactFeasibility(
      incoming.speed,
      incoming.comAngleDeg,
      impactAsk,
    );
    expect(pressure).toBeCloseTo(0.5, 12);
    expect(scored!.impactFeasibility).toBeCloseTo(1 + (feasibility - 1) * pressure, 12);
  });

  test("readiness still scores catchability when the next gap has no speed or impact ask", () => {
    const next = gap(1, 20, 40, {});
    const scored = scoreNextTargetReadiness({
      incoming: {
        vx: 9 * Math.cos(15 * Math.PI / 180),
        vy: 9 * Math.sin(15 * Math.PI / 180),
        speed: 9,
        comAngleDeg: 15,
        sledPoseDeg: null,
        sledPoseRateDegPerFrame: null,
      },
    }, next.targets);
    expect(scored).not.toBeNull();
    expect(scored!.speedFit).toBe(1);
    expect(scored!.impactFeasibility).toBe(1);
    expect(scored!.readiness).toBeCloseTo(predictCatchability(9, 15), 12);
  });

  test("targeted span factors fail closed without their complete-gap projection", () => {
    const incoming = {
      vx: 9,
      vy: 0,
      speed: 9,
      comAngleDeg: 0,
      sledPoseDeg: null,
      sledPoseRateDegPerFrame: null,
    };
    expect(
      scoreNextTargetReadiness({ incoming }, { speed: 0.5 }),
    ).toBeNull();
    expect(
      scoreNextTargetReadiness({ incoming }, { air: 0.5 }),
    ).toBeNull();
  });

  test("the enabled elevation policy requests, caches, and scores elevation", () => {
    const next = gap(1, 20, 40, { elevation: 0.8 });
    const fit = candidate(
      0,
      {},
      ballisticLaunch(20, 22, 8, -2),
    );
    setObjectiveBlendPowers({ elevationReadiness: true });
    try {
      const first = predictArrivalAtNextContact(fit, next);
      const second = predictArrivalAtNextContact(fit, next);
      expect(first).not.toBeNull();
      expect(first?.elevation).toEqual(expect.any(Number));
      expect(second).toBe(first);
      const readiness = scoreNextTargetReadiness(first!, next.targets);
      expect(readiness).not.toBeNull();
      expect(readiness!.elevationFit).toBeLessThanOrEqual(1);
    } finally {
      setObjectiveBlendPowers();
    }
  });

  test("gap objective is current quality times composite readiness", () => {
    const current = gap(0, 0, 20, { air: 0.5, impact: 0.8 });
    const next = gap(1, 20, 40, { speed: 0.5 });
    const achieved = { air: 0.45, impact: 0.75 };
    const arrival = {
      incoming: {
        vx: 9.5 * Math.cos(12 * Math.PI / 180),
        vy: 9.5 * Math.sin(12 * Math.PI / 180),
        speed: 9.5,
        comAngleDeg: 12,
        sledPoseDeg: null,
        sledPoseRateDegPerFrame: null,
      },
      meanSpeedPx: 9.5,
    };
    const scored = scoreGapObjectiveForTargets(current.targets, achieved, arrival, next.targets);
    expect(scored).not.toBeNull();
    expect(scored!.value).toBeCloseTo(scored!.currentQuality * scored!.readiness, 12);
  });

  test("gap objective applies configured current-quality and readiness powers", () => {
    const current = gap(0, 0, 20, { air: 0.5, impact: 0.8 });
    const next = gap(1, 20, 40, { speed: 0.5 });
    const achieved = { air: 0.45, impact: 0.75 };
    const arrival = {
      incoming: {
        vx: 9.5 * Math.cos(12 * Math.PI / 180),
        vy: 9.5 * Math.sin(12 * Math.PI / 180),
        speed: 9.5,
        comAngleDeg: 12,
        sledPoseDeg: null,
        sledPoseRateDegPerFrame: null,
      },
      meanSpeedPx: 9.5,
    };

    setObjectiveBlendPowers({ currentQualityPower: 2, readinessPower: 0.5 });
    try {
      const scored = scoreGapObjectiveForTargets(current.targets, achieved, arrival, next.targets);
      expect(scored).not.toBeNull();
      expect(scored!.value).toBeCloseTo(scored!.currentQuality ** 2 * scored!.readiness ** 0.5, 12);
    } finally {
      setObjectiveBlendPowers();
    }
  });

  test("candidate pool ranking uses the predicted-arrival objective over cost", () => {
    // `next` is catchability-only (empty targets). Both candidates release at
    // frame 20 and propagate ballistically 20 frames to the next contact; the
    // launch velocity drives the predicted-arrival readiness. The "good" launch
    // arrives more catchable and must rank first despite costing far more.
    const current = gap(0, 0, 20, { air: 0.5 });
    const next = gap(1, 20, 40, {});
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
      phase: "main" as const,
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
  });
});
