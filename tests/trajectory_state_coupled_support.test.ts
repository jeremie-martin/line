import { describe, expect, test } from "vitest";
import { IMPACT_WINDOW } from "../scripts/v0/types.ts";
import {
  planStateCoupledSupport,
  type ExactResponseBoundary,
  type OutgoingSupportInterval,
} from "../scripts/v0/trajectory/state_coupled_support.ts";

const anchor = {
  reference: { x: 20, y: 30 },
  headingDeg: 5,
  speedPxPerFrame: 10,
  sledSpanPx: 18,
  anchorPoint: "NOSE" as const,
  headingSource: "reference_point_velocity" as const,
};

function outgoing(axes: OutgoingSupportInterval["axes"], endFrame = 200): OutgoingSupportInterval {
  return {
    gapIndex: 4,
    startFrame: 100,
    endFrame,
    endKind: "contact",
    intervalFrames: endFrame - 100,
    measurementSamples: endFrame - 100 + 1,
    axes,
  };
}

function response(airborneSamples: number, eventFrame = 100): ExactResponseBoundary {
  const supportStartFrame = eventFrame + IMPACT_WINDOW + 1;
  return {
    eventFrame,
    supportStartFrame,
    anchor,
    prefix: {
      startFrame: 100,
      endFrameExclusive: supportStartFrame,
      measurementSamples: supportStartFrame - 100,
      airborneSamples,
    },
  };
}

const center = { supportTimeScale: 1, gradeResidualDeg: 0, curvatureSkew: 0 };

describe("state-coupled support plan", () => {
  test("accounts for inclusive scorer samples already consumed by exact response", () => {
    const interval = outgoing({ air: 0.2, speed: 0.7 });
    const plan = planStateCoupledSupport(interval, response(4), center);
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;
    expect(plan.totalMeasurementSamples).toBe(101);
    expect(plan.prefixMeasurementSamples + plan.futureMeasurementSamples).toBe(101);
    expect(plan.requiredFutureAirborneSamples).toBeCloseTo(16.2, 12);
    expect(plan.futureIntervals).toBe(93);
    expect(plan.neutralSupportIntervals).toBeCloseTo(93 * (1 - 16.2 / 94), 12);
    expect(plan.plannedExtentPx).toBeCloseTo(plan.supportIntervals * 10, 12);
  });

  test("does not silently rewrite an over-spent or unreachable authored air budget", () => {
    expect(planStateCoupledSupport(outgoing({ air: 0 }), response(1), center).status).toBe("air_budget_overspent");
    expect(planStateCoupledSupport(outgoing({ air: 1 }), response(0), center).status).toBe("air_budget_unreachable");
  });

  test("leaves undefined air unconstrained instead of inventing a target", () => {
    const plan = planStateCoupledSupport(outgoing({ speed: 0.7 }), response(2), center);
    expect(plan).toMatchObject({ status: "duration_unconstrained", targetAir: null });
  });

  test("does not accept a support start after the interval horizon", () => {
    const short = outgoing({ air: 0.2 }, 105);
    const plan = planStateCoupledSupport(short, response(1), center);
    expect(plan.status).toBe("response_leaves_no_support_horizon");
  });

  test("scales continuously without a length cap and rejects a requested duration beyond the horizon", () => {
    const interval = outgoing({ air: 0.1 }, 400);
    const one = planStateCoupledSupport(interval, response(2), center);
    const half = planStateCoupledSupport(interval, response(2), { ...center, supportTimeScale: 0.5 });
    expect(one.status).toBe("ready");
    expect(half.status).toBe("ready");
    if (one.status !== "ready" || half.status !== "ready") return;
    expect(half.plannedExtentPx).toBeCloseTo(one.plannedExtentPx / 2, 12);
    expect(one.plannedExtentPx).toBeGreaterThan(1_000);
    expect(planStateCoupledSupport(interval, response(2), { ...center, supportTimeScale: 2 }).status)
      .toBe("support_duration_exceeds_horizon");
  });

  test("has no route from next-event impact to support planning", () => {
    const base = outgoing({ air: 0.25, amplitude: 0.3 });
    const withArrival = { ...base, arrival: { frame: 200, impact: 0.1 } };
    const changedArrival = { ...base, arrival: { frame: 200, impact: 0.9 } };
    expect(planStateCoupledSupport(withArrival, response(3), center))
      .toEqual(planStateCoupledSupport(changedArrival, response(3), center));
  });
});
