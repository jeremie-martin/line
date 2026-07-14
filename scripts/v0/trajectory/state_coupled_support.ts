/**
 * Pure, study-only planning contract for support derived from an exact
 * post-contact response state.
 *
 * This intentionally does not import arc placement, the optimizer, or the
 * older envelope planner. It accounts for scorer samples already consumed by
 * the capture response, then emits one continuous state-shot support plan.
 * Exact replay remains responsible for collision, occupancy, and all axis
 * measurements.
 */
import { IMPACT_WINDOW } from "../types.ts";
import type { TargetFrame } from "./target_frame.ts";
import type { SupportPathPlan } from "./envelope/realizer.ts";
import type { IntervalAxes, OutgoingInterval } from "./transition_contract.ts";

/** The support planner is intentionally unable to read the later arrival event. */
export type OutgoingSupportInterval = Pick<
  OutgoingInterval,
  "gapIndex" | "startFrame" | "endFrame" | "endKind" | "intervalFrames" | "measurementSamples" | "axes"
>;

/** Exact local-only scorer samples that precede the first support-owned frame. */
export type ObservedOutgoingPrefix = {
  startFrame: number;
  /** Exclusive first frame available to support geometry. */
  endFrameExclusive: number;
  measurementSamples: number;
  airborneSamples: number;
  /** Optional telemetry only; the first plan does not convert mean speed to an exit command. */
  speedSumPxPerFrame?: number;
};

export type ExactResponseBoundary = {
  /** Selected exact owned landing, not merely the authored target frame. */
  eventFrame: number;
  /** Must equal `eventFrame + IMPACT_WINDOW + 1`. */
  supportStartFrame: number;
  /** Exact state-derived sled/reference frame at `supportStartFrame`. */
  anchor: TargetFrame;
  /** Exact local-only samples over `[outgoing.startFrame, supportStartFrame)`. */
  prefix: ObservedOutgoingPrefix;
};

export type StateShotSupportControl = {
  /** Continuous multiplier around the air-accounted support-time prior. */
  supportTimeScale: number;
  /** Explicit tangent residual from the exact response reference heading. */
  gradeResidualDeg: number;
  /** Log2 curvature power; zero produces a constant tangent schedule. */
  curvatureSkew: number;
};

type PlanContext = {
  outgoingGap: number;
  outgoingEndKind: "contact" | "tail";
  outgoingAxes: IntervalAxes;
  eventFrame: number;
  supportStartFrame: number;
  totalMeasurementSamples: number;
  prefixMeasurementSamples: number;
  futureMeasurementSamples: number;
  futureIntervals: number;
};

export type StateShotSupportReadyPlan = PlanContext & SupportPathPlan & {
  status: "ready";
  targetAir: number;
  observedPrefixAirborneSamples: number;
  requiredFutureAirborneSamples: number;
  neutralSupportIntervals: number;
  supportTimeScale: number;
  anchor: TargetFrame;
};

export type StateShotSupportUnavailablePlan = PlanContext & {
  status:
    | "response_leaves_no_support_horizon"
    | "duration_unconstrained"
    | "air_budget_overspent"
    | "air_budget_unreachable"
    | "support_duration_exceeds_horizon";
  targetAir: number | null;
  observedPrefixAirborneSamples: number | null;
  requiredFutureAirborneSamples: number | null;
  neutralSupportIntervals: number | null;
  requestedSupportIntervals: number | null;
};

export type StateShotSupportPlan = StateShotSupportReadyPlan | StateShotSupportUnavailablePlan;

/**
 * Derive one support plan from exact local response evidence and literal
 * outgoing axes. It deliberately does not read `OutgoingInterval.arrival`.
 */
export function planStateCoupledSupport(
  outgoing: OutgoingSupportInterval,
  response: ExactResponseBoundary,
  control: StateShotSupportControl,
): StateShotSupportPlan {
  assertOutgoing(outgoing);
  assertControl(control);
  assertResponseBoundaryBasics(response);

  const context = planContext(outgoing, response);
  if (response.supportStartFrame > outgoing.endFrame) {
    return unavailable(context, "response_leaves_no_support_horizon", null, null, null, null);
  }
  assertObservedPrefix(outgoing, response);

  const targetAir = outgoing.axes.air;
  if (targetAir === undefined) {
    return unavailable(
      context,
      "duration_unconstrained",
      null,
      response.prefix.airborneSamples,
      null,
      null,
    );
  }
  bounded("outgoing.axes.air", targetAir, 0, 1);
  const requiredFutureAirborneSamples = targetAir * context.totalMeasurementSamples -
    response.prefix.airborneSamples;
  if (requiredFutureAirborneSamples < -EPSILON) {
    return unavailable(
      context,
      "air_budget_overspent",
      targetAir,
      response.prefix.airborneSamples,
      requiredFutureAirborneSamples,
      null,
    );
  }
  if (requiredFutureAirborneSamples > context.futureMeasurementSamples + EPSILON) {
    return unavailable(
      context,
      "air_budget_unreachable",
      targetAir,
      response.prefix.airborneSamples,
      requiredFutureAirborneSamples,
      null,
    );
  }

  const boundedFutureAirborneSamples = clamp(requiredFutureAirborneSamples, 0, context.futureMeasurementSamples);
  const neutralSupportIntervals = context.futureIntervals * (
    1 - boundedFutureAirborneSamples / context.futureMeasurementSamples
  );
  const requestedSupportIntervals = neutralSupportIntervals * control.supportTimeScale;
  if (requestedSupportIntervals > context.futureIntervals + EPSILON) {
    return unavailable(
      context,
      "support_duration_exceeds_horizon",
      targetAir,
      response.prefix.airborneSamples,
      requiredFutureAirborneSamples,
      neutralSupportIntervals,
      requestedSupportIntervals,
    );
  }

  const supportIntervals = clamp(requestedSupportIntervals, 0, context.futureIntervals);
  const plannedAirborneIntervals = context.futureIntervals - supportIntervals;
  const curvaturePower = Math.pow(2, control.curvatureSkew);
  positive("curvaturePower", curvaturePower);
  const anchor = copyAnchor(response.anchor);
  return {
    ...context,
    status: "ready",
    targetAir,
    observedPrefixAirborneSamples: response.prefix.airborneSamples,
    requiredFutureAirborneSamples,
    neutralSupportIntervals,
    supportTimeScale: control.supportTimeScale,
    anchor,
    intervalFrames: context.futureIntervals,
    supportIntervals,
    plannedAirborneIntervals,
    plannedExtentPx: anchor.speedPxPerFrame * supportIntervals,
    // A neutral first shot stays tangent to the exact response reference
    // velocity. Speed/elevation/amplitude remain measured outputs, not invented
    // exit-state equations.
    meanGradeDeg: anchor.headingDeg + control.gradeResidualDeg,
    curvaturePower,
  };
}

function planContext(outgoing: OutgoingSupportInterval, response: ExactResponseBoundary): PlanContext {
  const prefixMeasurementSamples = response.supportStartFrame - outgoing.startFrame;
  const futureMeasurementSamples = outgoing.endFrame - response.supportStartFrame + 1;
  return {
    outgoingGap: outgoing.gapIndex,
    outgoingEndKind: outgoing.endKind,
    outgoingAxes: { ...outgoing.axes },
    eventFrame: response.eventFrame,
    supportStartFrame: response.supportStartFrame,
    totalMeasurementSamples: outgoing.measurementSamples,
    prefixMeasurementSamples,
    futureMeasurementSamples,
    futureIntervals: Math.max(0, outgoing.endFrame - response.supportStartFrame),
  };
}

function unavailable(
  context: PlanContext,
  status: StateShotSupportUnavailablePlan["status"],
  targetAir: number | null,
  observedPrefixAirborneSamples: number | null,
  requiredFutureAirborneSamples: number | null,
  neutralSupportIntervals: number | null,
  requestedSupportIntervals: number | null = null,
): StateShotSupportUnavailablePlan {
  return {
    ...context,
    status,
    targetAir,
    observedPrefixAirborneSamples,
    requiredFutureAirborneSamples,
    neutralSupportIntervals,
    requestedSupportIntervals,
  };
}

function assertOutgoing(outgoing: OutgoingSupportInterval): void {
  safeFrame("outgoing.startFrame", outgoing.startFrame);
  safeFrame("outgoing.endFrame", outgoing.endFrame);
  if (outgoing.endFrame < outgoing.startFrame) {
    throw new Error("outgoing endFrame must not precede startFrame");
  }
  if (outgoing.intervalFrames !== outgoing.endFrame - outgoing.startFrame) {
    throw new Error("outgoing intervalFrames must match its frame bounds");
  }
  if (outgoing.measurementSamples !== outgoing.intervalFrames + 1) {
    throw new Error("outgoing measurementSamples must equal intervalFrames + 1");
  }
  if (outgoing.endKind !== "contact" && outgoing.endKind !== "tail") {
    throw new Error("outgoing endKind must be contact or tail");
  }
}

function assertControl(control: StateShotSupportControl): void {
  nonNegative("supportTimeScale", control.supportTimeScale);
  finite("gradeResidualDeg", control.gradeResidualDeg);
  finite("curvatureSkew", control.curvatureSkew);
}

function assertResponseBoundaryBasics(response: ExactResponseBoundary): void {
  safeFrame("response.eventFrame", response.eventFrame);
  safeFrame("response.supportStartFrame", response.supportStartFrame);
  if (response.supportStartFrame !== response.eventFrame + IMPACT_WINDOW + 1) {
    throw new Error(`supportStartFrame must equal eventFrame + IMPACT_WINDOW + 1 (${IMPACT_WINDOW})`);
  }
  finite("response.anchor.reference.x", response.anchor.reference.x);
  finite("response.anchor.reference.y", response.anchor.reference.y);
  finite("response.anchor.headingDeg", response.anchor.headingDeg);
  positive("response.anchor.speedPxPerFrame", response.anchor.speedPxPerFrame);
}

function assertObservedPrefix(outgoing: OutgoingSupportInterval, response: ExactResponseBoundary): void {
  const prefix = response.prefix;
  safeFrame("response.prefix.startFrame", prefix.startFrame);
  safeFrame("response.prefix.endFrameExclusive", prefix.endFrameExclusive);
  if (prefix.startFrame !== outgoing.startFrame || prefix.endFrameExclusive !== response.supportStartFrame) {
    throw new Error("observed response prefix must cover [outgoing.startFrame, supportStartFrame)");
  }
  const expectedSamples = response.supportStartFrame - outgoing.startFrame;
  if (!Number.isSafeInteger(prefix.measurementSamples) || prefix.measurementSamples !== expectedSamples) {
    throw new Error("observed response prefix has inconsistent scorer sample count");
  }
  if (!Number.isSafeInteger(prefix.airborneSamples) || prefix.airborneSamples < 0 || prefix.airborneSamples > prefix.measurementSamples) {
    throw new Error("observed response prefix has invalid airborne sample count");
  }
  if (prefix.speedSumPxPerFrame !== undefined) finite("response.prefix.speedSumPxPerFrame", prefix.speedSumPxPerFrame);
}

function copyAnchor(anchor: TargetFrame): TargetFrame {
  return {
    reference: { ...anchor.reference },
    headingDeg: anchor.headingDeg,
    speedPxPerFrame: anchor.speedPxPerFrame,
    sledSpanPx: anchor.sledSpanPx,
    anchorPoint: anchor.anchorPoint,
    headingSource: anchor.headingSource,
  };
}

const EPSILON = 1e-9;

function safeFrame(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative safe integer`);
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
}

function nonNegative(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be non-negative and finite`);
  return value;
}

function bounded(name: string, value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value) || value < lo || value > hi) {
    throw new Error(`${name} must be in [${lo}, ${hi}]`);
  }
  return value;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}
