/**
 * State-normalized, chiral support curve for the next local-response
 * experiment.
 *
 * This is deliberately distinct from the earlier support slice. A single
 * capture-only H -> H+1 named-reference step fixes the physical active side;
 * every arm then shares an adaptive topology derived from the largest declared
 * action. The module is geometry-only: it reads no authored axes, next event,
 * target score, case identity, seed, or duration class.
 */
import { adaptiveCurveSegmentCount } from "./curve_resolution.ts";
import {
  activeNormalForDirectedTangent,
  leftNormalForTangent,
  resolvePostimpactSupportOrientation,
} from "./postimpact_support_orientation.ts";
import type {
  PostimpactNamedReferenceStep,
  PostimpactReferenceStepProvenance,
} from "./postimpact_support_orientation.ts";
import type { PostimpactTrackLine as TrackLine } from "./postimpact_physics.ts";
import type { TargetFrame } from "./target_frame.ts";
import type { Vec2 } from "./state.ts";

export const CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS = Object.freeze([0, 1, 2, 3, 4] as const);
export const CONTINUOUS_SUPPORT_CURVE_RESOLUTION_DIAGNOSTIC_MULTIPLIERS = Object.freeze([1, 2] as const);

export const CONTINUOUS_SUPPORT_CURVE_PROTOCOL = Object.freeze({
  constructionExtentFrames: 12,
  /** Constant-curvature circular-arc schedule; its topology is resolution-controlled. */
  curvaturePower: 1,
  /** Shared circular-arc approximation tolerance for the widest declared arm. */
  maxChordErrorPx: 2,
  /** Shared maximum action-tangent change between adjacent schedule samples. */
  maxTurnDegPerSegment: 5,
  /** Applies from the entry normal to the first chord and between later chords. */
  minAdjacentActiveNormalDot: 0.99,
  phaseLeadSteps: CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS,
  resolutionDiagnosticMultipliers: CONTINUOUS_SUPPORT_CURVE_RESOLUTION_DIAGNOSTIC_MULTIPLIERS,
} as const);

const MIN_SIGNED_I32_LINE_ID = 0;
const MAX_SIGNED_I32_LINE_ID = 0x7fffffff;

export type ContinuousSupportCurveAction = {
  readonly id:
    | "curve-turn-negative-8"
    | "curve-turn-negative-4"
    | "curve-neutral"
    | "curve-turn-positive-4"
    | "curve-turn-positive-8";
  /**
   * Signed endpoint turn toward (+) or away from (-) the selected active
   * normal. This is local/chiral action space, not a fixed world-heading turn.
   */
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
  /** Exact named-reference target frame at the post-impact response boundary H. */
  anchor: TargetFrame;
  /** Exact capture-only H -> H+1 step of that same named reference point. */
  captureOnlyNamedReferenceStep: PostimpactNamedReferenceStep;
  /** Shared construction phase, chosen by an external pre-outcome guard. */
  phaseLeadSteps: (typeof CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS)[number];
};

export type ContinuousSupportCurveSegment = {
  lineId: number;
  /** Exact directed heading of this circular-arc chord (the midpoint tangent). */
  tangentDeg: number;
  activeNormal: Vec2;
  flipped: boolean;
  lengthPx: number;
  /** Physical-polyline arc interval; common across every arm. */
  startArcFraction: number;
  endArcFraction: number;
  /** Continuous-arc fraction at this chord's midpoint. */
  tangentArcFraction: number;
};

export type ContinuousSupportCurveResolution = {
  /** Source-declared replay resolution: nominal (1x) or diagnostic (2x). */
  resolutionMultiplier: (typeof CONTINUOUS_SUPPORT_CURVE_RESOLUTION_DIAGNOSTIC_MULTIPLIERS)[number];
  /** Number of physical line segments emitted by every arm. */
  segmentCount: number;
  /** Largest absolute declared local action used to choose the common topology. */
  maximumActionTurnDeg: number;
  curvaturePower: number;
  maxChordErrorPx: number;
  maxTurnDegPerSegment: number;
  /** Largest declared action's turn across one emitted chord. */
  maximumTangentStepDeg: number;
  /** Exact circular-arc sagitta for the widest declared arm's emitted chord. */
  maximumDeclaredChordSagittaPx: number;
  /** Exact circular-arc sagitta for this arm's emitted chord. */
  actualChordSagittaPx: number;
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
  /** Entry-normal agreement with the first chord, checked against protocol. */
  entryActiveNormalContinuityDot: number;
  entryNormalProjectionPx: number;
  entryTangentProjectionPx: number;
  referenceStep: PostimpactReferenceStepProvenance;
  /** Chiral local action projected into the world heading convention. */
  worldTotalTurnDeg: number;
  /** Exact tangent of the underlying continuous curve at arc fraction one. */
  terminalTangentDeg: number;
  /** First and last emitted chord headings; distinct from endpoint tangents. */
  firstRealizedChordTangentDeg: number;
  lastRealizedChordTangentDeg: number;
  resolution: ContinuousSupportCurveResolution;
  minimumAdjacentActiveNormalDot: number;
  lines: TrackLine[];
  segments: ContinuousSupportCurveSegment[];
};

/**
 * Realize a shared-resolution exact circular arc as directed line chords.
 * The continuous curve retains its exact entry/terminal tangents; emitted line
 * headings are chord midpoint tangents and carry an explicit continuity bound.
 * Positive local turn always bends toward the active normal, so mirrored
 * capture evidence mirrors the world-heading realization.
 */
export function realizeContinuousSupportCurve(
  input: ContinuousSupportCurveInput,
  action: ContinuousSupportCurveAction,
  lineIdStart: number,
): ContinuousSupportCurve {
  return realizeContinuousSupportCurveAtResolution(input, action, lineIdStart, 1);
}

/**
 * Realize one source-declared resolution of the same curve. The 2x option is
 * a post-selection physics-sensitivity diagnostic, not a construction menu.
 */
export function realizeContinuousSupportCurveAtResolution(
  input: ContinuousSupportCurveInput,
  action: ContinuousSupportCurveAction,
  lineIdStart: number,
  resolutionMultiplier: (typeof CONTINUOUS_SUPPORT_CURVE_RESOLUTION_DIAGNOSTIC_MULTIPLIERS)[number],
): ContinuousSupportCurve {
  assertInput(input, action, lineIdStart);
  if (!(CONTINUOUS_SUPPORT_CURVE_RESOLUTION_DIAGNOSTIC_MULTIPLIERS as readonly number[]).includes(resolutionMultiplier)) {
    throw new Error("continuous support curve resolution multiplier must match the declared diagnostic set");
  }
  const orientation = resolvePostimpactSupportOrientation(input);
  const extentPx = input.anchor.speedPxPerFrame * CONTINUOUS_SUPPORT_CURVE_PROTOCOL.constructionExtentFrames;
  if (!(extentPx > 0) || !Number.isFinite(extentPx)) {
    throw new Error("continuous support curve requires a finite non-zero construction extent");
  }

  const baseResolution = resolveCommonResolution(extentPx, resolutionMultiplier);
  const activeNormalTurnSign = orientation.entryFlipped ? -1 : 1;
  const worldTotalTurnDeg = action.totalTurnDeg * activeNormalTurnSign;
  const actualChordSagittaPx = circularArcChordSagittaPx(
    extentPx,
    worldTotalTurnDeg,
    baseResolution.segmentCount,
  );
  if (actualChordSagittaPx > CONTINUOUS_SUPPORT_CURVE_PROTOCOL.maxChordErrorPx + 1e-12) {
    throw new Error("continuous support curve actual chord sagitta exceeds the declared tolerance");
  }
  const resolution: ContinuousSupportCurveResolution = {
    ...baseResolution,
    actualChordSagittaPx,
  };
  assertLineIdRange(lineIdStart, resolution.segmentCount);

  const phaseLeadPx = orientation.entryTangentProjectionPx * input.phaseLeadSteps;
  const curveStart = add(
    add(input.anchor.reference, scale(orientation.entryTangent, phaseLeadPx)),
    scale(orientation.entryActiveNormal, orientation.preloadPx),
  );
  const lines: TrackLine[] = [];
  const segments: ContinuousSupportCurveSegment[] = [];
  let point = { ...curveStart };
  let previousActiveNormal: Vec2 | null = null;
  let minimumAdjacentActiveNormalDot = 1;
  let entryActiveNormalContinuityDot = Number.NaN;

  for (let index = 0; index < resolution.segmentCount; index++) {
    const startArcFraction = index / resolution.segmentCount;
    const endArcFraction = (index + 1) / resolution.segmentCount;
    const tangentArcFraction = (startArcFraction + endArcFraction) / 2;
    const tangentDeg = input.anchor.headingDeg + worldTotalTurnDeg * tangentArcFraction;
    const tangent = unit(tangentDeg);
    const baseNormal = leftNormalForTangent(tangent);
    const flipped = previousActiveNormal === null
      ? orientation.entryFlipped
      : dot(baseNormal, previousActiveNormal) < 0;
    const activeNormal = activeNormalForDirectedTangent(tangent, flipped);

    if (previousActiveNormal === null) {
      entryActiveNormalContinuityDot = dot(orientation.entryActiveNormal, activeNormal);
      if (entryActiveNormalContinuityDot < CONTINUOUS_SUPPORT_CURVE_PROTOCOL.minAdjacentActiveNormalDot) {
        throw new Error("continuous support curve does not preserve entry active-normal continuity");
      }
    } else {
      const continuity = dot(previousActiveNormal, activeNormal);
      minimumAdjacentActiveNormalDot = Math.min(minimumAdjacentActiveNormalDot, continuity);
      if (continuity < CONTINUOUS_SUPPORT_CURVE_PROTOCOL.minAdjacentActiveNormalDot) {
        throw new Error("continuous support curve active normal cannot be transported continuously");
      }
    }

    const next = pointOnCircularArc(
      curveStart,
      input.anchor.headingDeg,
      worldTotalTurnDeg,
      extentPx,
      endArcFraction,
    );
    const lengthPx = Math.hypot(next.x - point.x, next.y - point.y);
    if (!(lengthPx > 0) || !Number.isFinite(lengthPx)) {
      throw new Error("continuous support curve emitted a non-finite or zero-length chord");
    }
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
      lengthPx,
      startArcFraction,
      endArcFraction,
      tangentArcFraction,
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
    entryActiveNormalContinuityDot,
    entryNormalProjectionPx: orientation.entryNormalProjectionPx,
    entryTangentProjectionPx: orientation.entryTangentProjectionPx,
    referenceStep: orientation.referenceStep,
    worldTotalTurnDeg,
    terminalTangentDeg: input.anchor.headingDeg + worldTotalTurnDeg,
    firstRealizedChordTangentDeg: segments[0]!.tangentDeg,
    lastRealizedChordTangentDeg: segments.at(-1)!.tangentDeg,
    resolution,
    minimumAdjacentActiveNormalDot,
    lines,
    segments,
  };
}

function resolveCommonResolution(
  extentPx: number,
  resolutionMultiplier: (typeof CONTINUOUS_SUPPORT_CURVE_RESOLUTION_DIAGNOSTIC_MULTIPLIERS)[number],
): Omit<ContinuousSupportCurveResolution, "actualChordSagittaPx"> {
  const maximumActionTurnDeg = Math.max(
    ...CONTINUOUS_SUPPORT_CURVE_ACTIONS.map((action) => Math.abs(action.totalTurnDeg)),
  );
  const nominalSegmentCount = adaptiveCurveSegmentCount(
    extentPx,
    maximumActionTurnDeg,
    CONTINUOUS_SUPPORT_CURVE_PROTOCOL.curvaturePower,
    {
      maxChordErrorPx: CONTINUOUS_SUPPORT_CURVE_PROTOCOL.maxChordErrorPx,
      maxTurnDegPerSegment: CONTINUOUS_SUPPORT_CURVE_PROTOCOL.maxTurnDegPerSegment,
    },
  );
  if (!Number.isSafeInteger(nominalSegmentCount) || nominalSegmentCount < 1) {
    throw new Error("continuous support curve adaptive resolution must contain at least one chord");
  }
  const segmentCount = nominalSegmentCount * resolutionMultiplier;
  if (!Number.isSafeInteger(segmentCount) || segmentCount < 1) {
    throw new Error("continuous support curve diagnostic resolution exceeds safe segment count");
  }
  const maximumDeclaredChordSagittaPx = circularArcChordSagittaPx(
    extentPx,
    maximumActionTurnDeg,
    segmentCount,
  );
  if (maximumDeclaredChordSagittaPx > CONTINUOUS_SUPPORT_CURVE_PROTOCOL.maxChordErrorPx + 1e-12) {
    throw new Error("continuous support curve adaptive resolution violates the declared chord sagitta tolerance");
  }
  return {
    resolutionMultiplier,
    segmentCount,
    maximumActionTurnDeg,
    curvaturePower: CONTINUOUS_SUPPORT_CURVE_PROTOCOL.curvaturePower,
    maxChordErrorPx: CONTINUOUS_SUPPORT_CURVE_PROTOCOL.maxChordErrorPx,
    maxTurnDegPerSegment: CONTINUOUS_SUPPORT_CURVE_PROTOCOL.maxTurnDegPerSegment,
    maximumTangentStepDeg: maximumActionTurnDeg / segmentCount,
    maximumDeclaredChordSagittaPx,
  };
}

function assertInput(
  input: ContinuousSupportCurveInput,
  action: ContinuousSupportCurveAction,
  lineIdStart: number,
): void {
  if (!Number.isSafeInteger(lineIdStart) || lineIdStart < MIN_SIGNED_I32_LINE_ID || lineIdStart > MAX_SIGNED_I32_LINE_ID) {
    throw new Error("continuous support curve lineIdStart must be a non-negative signed 32-bit integer");
  }
  if (!(CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS as readonly number[]).includes(input.phaseLeadSteps)) {
    throw new Error("continuous support curve phaseLeadSteps must match the declared construction ladder");
  }
  const declared = CONTINUOUS_SUPPORT_CURVE_ACTIONS.find((candidate) => candidate.id === action.id);
  if (declared === undefined || !Object.is(declared.totalTurnDeg, action.totalTurnDeg)) {
    throw new Error("continuous support curve action must exactly match the declared assay stencil");
  }
}

function assertLineIdRange(lineIdStart: number, segmentCount: number): void {
  const lastLineId = lineIdStart + segmentCount - 1;
  if (!Number.isSafeInteger(lastLineId) || lastLineId > MAX_SIGNED_I32_LINE_ID) {
    throw new Error("continuous support curve generated line ids must remain unique signed 32-bit integers");
  }
}

function circularArcChordSagittaPx(extentPx: number, totalTurnDeg: number, segmentCount: number): number {
  const totalTurnRadians = Math.abs(totalTurnDeg) * Math.PI / 180;
  if (totalTurnRadians <= 1e-12) return 0;
  const radiusPx = extentPx / totalTurnRadians;
  const stepRadians = totalTurnRadians / segmentCount;
  return radiusPx * (1 - Math.cos(stepRadians / 2));
}

function pointOnCircularArc(
  start: Vec2,
  entryTangentDeg: number,
  totalTurnDeg: number,
  extentPx: number,
  arcFraction: number,
): Vec2 {
  const entryRadians = entryTangentDeg * Math.PI / 180;
  const totalTurnRadians = totalTurnDeg * Math.PI / 180;
  if (Math.abs(totalTurnRadians) <= 1e-12) {
    return add(start, scale(unit(entryTangentDeg), extentPx * arcFraction));
  }
  const terminalRadians = entryRadians + totalTurnRadians * arcFraction;
  const signedRadiusPx = extentPx / totalTurnRadians;
  return {
    x: cleanZero(start.x + signedRadiusPx * (Math.sin(terminalRadians) - Math.sin(entryRadians))),
    y: cleanZero(start.y - signedRadiusPx * (Math.cos(terminalRadians) - Math.cos(entryRadians))),
  };
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
