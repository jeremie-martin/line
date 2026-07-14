/**
 * Study-only, state-normalized support curve for the next local-response
 * experiment.
 *
 * This is deliberately distinct from the earlier support slice. Every arm
 * has the same four-segment topology and arc-length breakpoints, including
 * the zero-turn control. Curvature begins immediately at the entry tangent,
 * so a short exact observation can actually expose the signed action.
 *
 * The module is geometry-only. It reads no authored axes, next event, target
 * score, case identity, seed, or duration class. A runner must select its
 * shared construction phase solely through protected pre-outcome replay.
 */
import type { TrackLine } from "../types.ts";
import {
  activeNormalForDirectedTangent,
  leftNormalForTangent,
  resolvePostimpactSupportOrientation,
} from "./postimpact_support_orientation.ts";
import type { TargetFrame } from "./target_frame.ts";
import type { Vec2 } from "./state.ts";

export const CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS = Object.freeze([0, 1, 2, 3, 4] as const);

export const CONTINUOUS_SUPPORT_CURVE_PROTOCOL = Object.freeze({
  constructionExtentFrames: 12,
  preloadSpeedFrames: 0.1,
  segmentCount: 4,
  minAdjacentActiveNormalDot: 0.99,
  phaseLeadSteps: CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS,
} as const);

export type ContinuousSupportCurveAction = {
  readonly id:
    | "curve-turn-negative-8"
    | "curve-turn-negative-4"
    | "curve-neutral"
    | "curve-turn-positive-4"
    | "curve-turn-positive-8";
  /** Signed endpoint tangent change relative to the observed response tangent. */
  readonly totalTurnDeg: -8 | -4 | 0 | 4 | 8;
};

/**
 * This is the complete fixed action ladder for the design assay. It is not a
 * compiler menu and callers cannot inject arbitrary amplitudes.
 */
export const CONTINUOUS_SUPPORT_CURVE_ACTIONS: readonly ContinuousSupportCurveAction[] = Object.freeze([
  Object.freeze({ id: "curve-turn-negative-8", totalTurnDeg: -8 }),
  Object.freeze({ id: "curve-turn-negative-4", totalTurnDeg: -4 }),
  Object.freeze({ id: "curve-neutral", totalTurnDeg: 0 }),
  Object.freeze({ id: "curve-turn-positive-4", totalTurnDeg: 4 }),
  Object.freeze({ id: "curve-turn-positive-8", totalTurnDeg: 8 }),
] as const);

export type ContinuousSupportCurveInput = {
  /** Exact named-reference target frame at the post-impact response boundary. */
  anchor: TargetFrame;
  /** Capture-only named-reference displacement from H to H + 1. */
  captureOnlyReferenceDisplacement: Vec2;
  /** Shared construction phase, chosen by an external pre-outcome guard. */
  phaseLeadSteps: (typeof CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS)[number];
};

export type ContinuousSupportCurveSegment = {
  lineId: number;
  /** Midpoint-tangent approximation to theta(u) = theta0 + totalTurn * u. */
  tangentDeg: number;
  activeNormal: Vec2;
  flipped: boolean;
  lengthPx: number;
  startArcFraction: number;
  endArcFraction: number;
};

export type ContinuousSupportCurve = {
  action: ContinuousSupportCurveAction;
  constructionExtentFrames: number;
  extentPx: number;
  preloadPx: number;
  phaseLeadSteps: number;
  phaseLeadPx: number;
  curveStart: Vec2;
  entryTangentDeg: number;
  entryFlipped: boolean;
  entryActiveNormal: Vec2;
  entryNormalProjectionPx: number;
  entryTangentProjectionPx: number;
  /** Exact tangent of the underlying continuous curve at arc fraction one. */
  terminalTangentDeg: number;
  minimumAdjacentActiveNormalDot: number;
  lines: TrackLine[];
  segments: ContinuousSupportCurveSegment[];
};

/**
 * Realize a fixed-resolution approximation of a constant-curvature schedule.
 * Segment headings are evaluated at interval midpoints, preserving a common
 * geometry topology and allowing nonzero actions to differ immediately.
 */
export function realizeContinuousSupportCurve(
  input: ContinuousSupportCurveInput,
  action: ContinuousSupportCurveAction,
  lineIdStart: number,
): ContinuousSupportCurve {
  assertInput(input, action, lineIdStart);
  const orientation = resolvePostimpactSupportOrientation(input);
  const extentPx = input.anchor.speedPxPerFrame * CONTINUOUS_SUPPORT_CURVE_PROTOCOL.constructionExtentFrames;
  const phaseLeadPx = orientation.entryTangentProjectionPx * input.phaseLeadSteps;
  const curveStart = add(
    add(input.anchor.reference, scale(orientation.entryTangent, phaseLeadPx)),
    scale(orientation.entryActiveNormal, orientation.preloadPx),
  );
  const segmentCount = CONTINUOUS_SUPPORT_CURVE_PROTOCOL.segmentCount;
  const segmentLengthPx = extentPx / segmentCount;
  const lines: TrackLine[] = [];
  const segments: ContinuousSupportCurveSegment[] = [];
  let point = { ...curveStart };
  let previousActiveNormal: Vec2 | null = null;
  let minimumAdjacentActiveNormalDot = 1;

  for (let index = 0; index < segmentCount; index++) {
    const startArcFraction = index / segmentCount;
    const endArcFraction = (index + 1) / segmentCount;
    const midpointArcFraction = (startArcFraction + endArcFraction) / 2;
    const tangentDeg = input.anchor.headingDeg + action.totalTurnDeg * midpointArcFraction;
    const tangent = unit(tangentDeg);
    const baseNormal = leftNormalForTangent(tangent);
    const flipped = previousActiveNormal === null
      ? orientation.entryFlipped
      : dot(baseNormal, previousActiveNormal) < 0;
    const activeNormal = activeNormalForDirectedTangent(tangent, flipped);
    if (previousActiveNormal !== null) {
      const continuity = dot(previousActiveNormal, activeNormal);
      minimumAdjacentActiveNormalDot = Math.min(minimumAdjacentActiveNormalDot, continuity);
      if (continuity < CONTINUOUS_SUPPORT_CURVE_PROTOCOL.minAdjacentActiveNormalDot) {
        throw new Error("continuous support curve active normal cannot be transported continuously");
      }
    }
    const next = add(point, scale(tangent, segmentLengthPx));
    const lineId = lineIdStart + lines.length;
    lines.push({
      id: lineId,
      type: 0,
      x1: point.x,
      y1: point.y,
      x2: next.x,
      y2: next.y,
      flipped,
      leftExtended: false,
      rightExtended: false,
    });
    segments.push({
      lineId,
      tangentDeg,
      activeNormal,
      flipped,
      lengthPx: segmentLengthPx,
      startArcFraction,
      endArcFraction,
    });
    point = next;
    previousActiveNormal = activeNormal;
  }

  return {
    action: { ...action },
    constructionExtentFrames: CONTINUOUS_SUPPORT_CURVE_PROTOCOL.constructionExtentFrames,
    extentPx,
    preloadPx: orientation.preloadPx,
    phaseLeadSteps: input.phaseLeadSteps,
    phaseLeadPx,
    curveStart,
    entryTangentDeg: orientation.entryTangentDeg,
    entryFlipped: orientation.entryFlipped,
    entryActiveNormal: orientation.entryActiveNormal,
    entryNormalProjectionPx: orientation.entryNormalProjectionPx,
    entryTangentProjectionPx: orientation.entryTangentProjectionPx,
    terminalTangentDeg: input.anchor.headingDeg + action.totalTurnDeg,
    minimumAdjacentActiveNormalDot,
    lines,
    segments,
  };
}

function assertInput(
  input: ContinuousSupportCurveInput,
  action: ContinuousSupportCurveAction,
  lineIdStart: number,
): void {
  if (!Number.isSafeInteger(lineIdStart)) {
    throw new Error("continuous support curve lineIdStart must be a safe integer");
  }
  if (!(CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS as readonly number[]).includes(input.phaseLeadSteps)) {
    throw new Error("continuous support curve phaseLeadSteps must match the declared construction ladder");
  }
  const declared = CONTINUOUS_SUPPORT_CURVE_ACTIONS.find((candidate) => candidate.id === action.id);
  if (declared === undefined || !Object.is(declared.totalTurnDeg, action.totalTurnDeg)) {
    throw new Error("continuous support curve action must exactly match the declared assay stencil");
  }
  // Orientation resolution performs the named-state, finite-value, active-side,
  // and forward-motion checks. Invoke it before allocating any geometry.
  resolvePostimpactSupportOrientation(input);
}

function unit(angleDeg: number): Vec2 {
  const radians = angleDeg * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function add(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x + right.x, y: left.y + right.y };
}

function scale(value: Vec2, factor: number): Vec2 {
  return { x: cleanZero(value.x * factor), y: cleanZero(value.y * factor) };
}

function dot(left: Vec2, right: Vec2): number {
  return left.x * right.x + left.y * right.y;
}

function cleanZero(value: number): number {
  return value === 0 ? 0 : value;
}
