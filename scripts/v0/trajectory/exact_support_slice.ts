/**
 * Study-only tangent-aligned offset rail for the exact post-impact assay.
 *
 * This is not a compiler primitive, target solver, or configurable action
 * menu. It realizes one preregistered physical stencil from an exact response
 * anchor and a capture-only one-step reference displacement. Exact replay
 * decides whether any rail actually catches or safely changes the trajectory.
 */
import type { TrackLine } from "../types.ts";
import { adaptiveCurveSegmentCount } from "./curve_resolution.ts";
import type { TargetFrame } from "./target_frame.ts";

export const EXACT_SUPPORT_SLICE_PROTOCOL = Object.freeze({
  minHorizonFrames: 4,
  maxHorizonFrames: 12,
  preloadSpeedFrames: 0.1,
  minNormalDisplacementPx: 1e-3,
  minForwardDisplacementPx: 1e-3,
  maxChordErrorPx: 2,
  maxTurnDegPerSegment: 5,
  minAdjacentActiveNormalDot: 0.99,
  engineGridCellSizePx: 14,
} as const);

export type ExactSupportSliceAction = {
  readonly id:
    | "rail-neutral"
    | "rail-turn-positive"
    | "rail-turn-negative"
    | "rail-extent-long"
    | "rail-extent-short";
  readonly extentScale: number;
  readonly totalTurnDeg: number;
};

/**
 * The capture-only comparator is a sixth, geometry-free arm owned by the
 * study runner. This source-declared list is the complete rail action stencil.
 */
export const EXACT_SUPPORT_SLICE_RAIL_ACTIONS: readonly ExactSupportSliceAction[] = Object.freeze([
  Object.freeze({ id: "rail-neutral", extentScale: 1, totalTurnDeg: 0 }),
  Object.freeze({ id: "rail-turn-positive", extentScale: 1, totalTurnDeg: 8 }),
  Object.freeze({ id: "rail-turn-negative", extentScale: 1, totalTurnDeg: -8 }),
  Object.freeze({ id: "rail-extent-long", extentScale: 1.15, totalTurnDeg: 0 }),
  Object.freeze({ id: "rail-extent-short", extentScale: 0.85, totalTurnDeg: 0 }),
] as const);

export type ExactSupportSliceInput = {
  /** Exact named-reference target frame at H. */
  anchor: TargetFrame;
  /**
   * Capture-only displacement of that same named reference point from H to
   * H+1. This declares the active one-sided normal before rail actions run.
   */
  captureOnlyReferenceDisplacement: Vec2;
  /** Q elapsed intervals; the study observes [H, H+Q] inclusively. */
  horizonFrames: number;
};

export type ExactSupportSliceSegment = {
  lineId: number;
  tangentDeg: number;
  activeNormal: Vec2;
  flipped: boolean;
  lengthPx: number;
};

export type ExactSupportSlice = {
  action: ExactSupportSliceAction;
  horizonFrames: number;
  baseExtentPx: number;
  extentPx: number;
  preloadPx: number;
  railStart: Vec2;
  entryTangentDeg: number;
  entryFlipped: boolean;
  entryActiveNormal: Vec2;
  entryNormalProjectionPx: number;
  entryTangentProjectionPx: number;
  minimumAdjacentActiveNormalDot: number;
  lines: TrackLine[];
  segments: ExactSupportSliceSegment[];
  footprint: {
    kind: "conservative_engine_grid_bounds_v1";
    cellSizePx: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minCellX: number;
    maxCellX: number;
    minCellY: number;
    maxCellY: number;
    conservativeCellCount: number;
  };
};

export type Vec2 = { x: number; y: number };

export type ExactSupportSliceOrientation = {
  entryTangent: Vec2;
  entryTangentDeg: number;
  entryFlipped: boolean;
  entryActiveNormal: Vec2;
  entryNormalProjectionPx: number;
  entryTangentProjectionPx: number;
  preloadPx: number;
};

/**
 * Resolve the shared physical side once from the capture-only H -> H+1
 * observation. Every action in one row receives this exact orientation.
 */
export function resolveExactSupportSliceOrientation(
  input: Pick<ExactSupportSliceInput, "anchor" | "captureOnlyReferenceDisplacement">,
): ExactSupportSliceOrientation {
  assertAnchorAndDisplacement(input);
  const entryTangent = unit(input.anchor.headingDeg);
  const entryTangentProjectionPx = dot(entryTangent, input.captureOnlyReferenceDisplacement);
  if (entryTangentProjectionPx < EXACT_SUPPORT_SLICE_PROTOCOL.minForwardDisplacementPx) {
    throw new Error("capture-only one-step reference motion does not advance along the canonical rail direction");
  }
  const leftNormal = leftNormalForTangent(entryTangent);
  const normalProjection = dot(leftNormal, input.captureOnlyReferenceDisplacement);
  if (Math.abs(normalProjection) < EXACT_SUPPORT_SLICE_PROTOCOL.minNormalDisplacementPx) {
    throw new Error("capture-only one-step reference motion cannot choose a stable active normal");
  }
  const entryFlipped = normalProjection < 0;
  const entryActiveNormal = activeNormalForDirectedTangent(entryTangent, entryFlipped);
  const entryNormalProjectionPx = dot(entryActiveNormal, input.captureOnlyReferenceDisplacement);
  if (entryNormalProjectionPx < EXACT_SUPPORT_SLICE_PROTOCOL.minNormalDisplacementPx) {
    throw new Error("selected active normal does not face capture-only reference motion");
  }
  return {
    entryTangent,
    entryTangentDeg: input.anchor.headingDeg,
    entryFlipped,
    entryActiveNormal,
    entryNormalProjectionPx,
    entryTangentProjectionPx,
    preloadPx: input.anchor.speedPxPerFrame * EXACT_SUPPORT_SLICE_PROTOCOL.preloadSpeedFrames,
  };
}

/**
 * Realize a canonical directed rail. Every endpoint advances along the
 * declared response tangent and every line is solid/nonextended. `flipped` is
 * selected only to transport the preregistered active normal; it never encodes
 * the signed-turn arm.
 */
export function realizeExactSupportSlice(
  input: ExactSupportSliceInput,
  action: ExactSupportSliceAction,
  lineIdStart: number,
): ExactSupportSlice {
  assertInput(input, action, lineIdStart);
  const orientation = resolveExactSupportSliceOrientation(input);

  const baseExtentPx = input.anchor.speedPxPerFrame * input.horizonFrames;
  const extentPx = baseExtentPx * action.extentScale;
  const railStart = add(input.anchor.reference, scale(orientation.entryActiveNormal, orientation.preloadPx));
  const resolvedSegments = adaptiveCurveSegmentCount(
    extentPx,
    action.totalTurnDeg,
    1,
    {
      maxChordErrorPx: EXACT_SUPPORT_SLICE_PROTOCOL.maxChordErrorPx,
      maxTurnDegPerSegment: EXACT_SUPPORT_SLICE_PROTOCOL.maxTurnDegPerSegment,
    },
  );
  const segmentCount = Math.abs(action.totalTurnDeg) <= 1e-12
    ? resolvedSegments
    : resolvedSegments + 1;
  if (segmentCount < 1) throw new Error("exact support slice requires at least one segment");

  const lines: TrackLine[] = [];
  const segments: ExactSupportSliceSegment[] = [];
  const segmentLengthPx = extentPx / segmentCount;
  let point = { ...railStart };
  let previousActiveNormal: Vec2 | null = null;
  let minimumAdjacentActiveNormalDot = 1;
  for (let index = 0; index < segmentCount; index++) {
    const fraction = segmentCount === 1 ? 0 : index / (segmentCount - 1);
    const tangentDeg = input.anchor.headingDeg + action.totalTurnDeg * fraction;
    const tangent = unit(tangentDeg);
    const baseNormal = leftNormalForTangent(tangent);
    const flipped = previousActiveNormal === null
      ? orientation.entryFlipped
      : dot(baseNormal, previousActiveNormal) < 0;
    const activeNormal = activeNormalForDirectedTangent(tangent, flipped);
    if (previousActiveNormal !== null) {
      const continuity = dot(previousActiveNormal, activeNormal);
      minimumAdjacentActiveNormalDot = Math.min(minimumAdjacentActiveNormalDot, continuity);
      if (continuity < EXACT_SUPPORT_SLICE_PROTOCOL.minAdjacentActiveNormalDot) {
        throw new Error("support rail active normal cannot be transported continuously");
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
    });
    point = next;
    previousActiveNormal = activeNormal;
  }

  return {
    action: { ...action },
    horizonFrames: input.horizonFrames,
    baseExtentPx,
    extentPx,
    preloadPx: orientation.preloadPx,
    railStart,
    entryTangentDeg: orientation.entryTangentDeg,
    entryFlipped: orientation.entryFlipped,
    entryActiveNormal: orientation.entryActiveNormal,
    entryNormalProjectionPx: orientation.entryNormalProjectionPx,
    entryTangentProjectionPx: orientation.entryTangentProjectionPx,
    minimumAdjacentActiveNormalDot,
    lines,
    segments,
    footprint: conservativeGridFootprint([railStart, ...lines.map((line) => ({ x: line.x2, y: line.y2 }))]),
  };
}

/** The engine's active penetration/force normal for a canonical directed line. */
export function activeNormalForDirectedTangent(tangent: Vec2, flipped: boolean): Vec2 {
  const left = leftNormalForTangent(tangent);
  return flipped ? scale(left, -1) : left;
}

export function leftNormalForTangent(tangent: Vec2): Vec2 {
  const magnitude = Math.hypot(tangent.x, tangent.y);
  if (!(magnitude > 1e-12) || !Number.isFinite(magnitude)) {
    throw new Error("support rail tangent must be finite and non-zero");
  }
  return { x: cleanZero(-tangent.y / magnitude), y: cleanZero(tangent.x / magnitude) };
}

function conservativeGridFootprint(points: readonly Vec2[]): ExactSupportSlice["footprint"] {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cellSizePx = EXACT_SUPPORT_SLICE_PROTOCOL.engineGridCellSizePx;
  const minCellX = Math.floor(minX / cellSizePx);
  const maxCellX = Math.floor(maxX / cellSizePx);
  const minCellY = Math.floor(minY / cellSizePx);
  const maxCellY = Math.floor(maxY / cellSizePx);
  return {
    kind: "conservative_engine_grid_bounds_v1",
    cellSizePx,
    minX,
    maxX,
    minY,
    maxY,
    minCellX,
    maxCellX,
    minCellY,
    maxCellY,
    conservativeCellCount: (maxCellX - minCellX + 1) * (maxCellY - minCellY + 1),
  };
}

function assertInput(input: ExactSupportSliceInput, action: ExactSupportSliceAction, lineIdStart: number): void {
  if (!Number.isSafeInteger(input.horizonFrames) ||
    input.horizonFrames < EXACT_SUPPORT_SLICE_PROTOCOL.minHorizonFrames ||
    input.horizonFrames > EXACT_SUPPORT_SLICE_PROTOCOL.maxHorizonFrames) {
    throw new Error(`support rail horizon must be an integer in [${EXACT_SUPPORT_SLICE_PROTOCOL.minHorizonFrames}, ${EXACT_SUPPORT_SLICE_PROTOCOL.maxHorizonFrames}]`);
  }
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("support rail lineIdStart must be a safe integer");
  assertAnchorAndDisplacement(input);
  const declared = EXACT_SUPPORT_SLICE_RAIL_ACTIONS.find((candidate) => candidate.id === action.id);
  if (declared === undefined || !Object.is(action.extentScale, declared.extentScale) || !Object.is(action.totalTurnDeg, declared.totalTurnDeg)) {
    throw new Error("support rail action must exactly match the declared assay stencil");
  }
  for (const [name, value] of Object.entries({
    extentScale: action.extentScale,
    totalTurnDeg: action.totalTurnDeg,
  })) {
    if (!Number.isFinite(value)) throw new Error(`support rail ${name} must be finite`);
  }
  if (!(action.extentScale > 0)) throw new Error("support rail extentScale must be positive");
}

function assertAnchorAndDisplacement(input: Pick<ExactSupportSliceInput, "anchor" | "captureOnlyReferenceDisplacement">): void {
  for (const [name, value] of Object.entries({
    anchorX: input.anchor.reference.x,
    anchorY: input.anchor.reference.y,
    anchorHeadingDeg: input.anchor.headingDeg,
    anchorSpeedPxPerFrame: input.anchor.speedPxPerFrame,
    displacementX: input.captureOnlyReferenceDisplacement.x,
    displacementY: input.captureOnlyReferenceDisplacement.y,
  })) {
    if (!Number.isFinite(value)) throw new Error(`support rail ${name} must be finite`);
  }
  if (!(input.anchor.speedPxPerFrame > 0)) throw new Error("support rail anchor speed must be positive");
  if (input.anchor.anchorPoint !== "rider" && input.anchor.headingSource !== "reference_point_velocity") {
    throw new Error("support rail heading must belong to its named non-rider reference point");
  }
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
