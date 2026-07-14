/**
 * Named-reference placement and collision-side transport shared by new
 * post-impact study primitives.
 *
 * This is a geometry boundary, not a dynamics model: capture-only H -> H + 1
 * motion selects a one-sided static-line orientation before any action replay.
 */
import type { TargetFrame } from "./target_frame.ts";
import type { Vec2 } from "./state.ts";

export const POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL = Object.freeze({
  preloadSpeedFrames: 0.1,
  minNormalDisplacementPx: 1e-3,
  minForwardDisplacementPx: 1e-3,
} as const);

export type PostimpactSupportOrientationInput = {
  anchor: TargetFrame;
  captureOnlyReferenceDisplacement: Vec2;
};

export type PostimpactSupportOrientation = {
  entryTangent: Vec2;
  entryTangentDeg: number;
  entryFlipped: boolean;
  entryActiveNormal: Vec2;
  entryNormalProjectionPx: number;
  entryTangentProjectionPx: number;
  preloadPx: number;
};

export function resolvePostimpactSupportOrientation(
  input: PostimpactSupportOrientationInput,
): PostimpactSupportOrientation {
  assertAnchorAndDisplacement(input);
  const entryTangent = unit(input.anchor.headingDeg);
  const entryTangentProjectionPx = dot(entryTangent, input.captureOnlyReferenceDisplacement);
  if (entryTangentProjectionPx < POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL.minForwardDisplacementPx) {
    throw new Error("post-impact support reference motion does not advance along the canonical direction");
  }
  const leftNormal = leftNormalForTangent(entryTangent);
  const normalProjection = dot(leftNormal, input.captureOnlyReferenceDisplacement);
  if (Math.abs(normalProjection) < POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL.minNormalDisplacementPx) {
    throw new Error("post-impact support reference motion cannot choose a stable active normal");
  }
  const entryFlipped = normalProjection < 0;
  const entryActiveNormal = activeNormalForDirectedTangent(entryTangent, entryFlipped);
  const entryNormalProjectionPx = dot(entryActiveNormal, input.captureOnlyReferenceDisplacement);
  if (entryNormalProjectionPx < POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL.minNormalDisplacementPx) {
    throw new Error("post-impact support selected active normal does not face reference motion");
  }
  return {
    entryTangent,
    entryTangentDeg: input.anchor.headingDeg,
    entryFlipped,
    entryActiveNormal,
    entryNormalProjectionPx,
    entryTangentProjectionPx,
    preloadPx: input.anchor.speedPxPerFrame * POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL.preloadSpeedFrames,
  };
}

export function activeNormalForDirectedTangent(tangent: Vec2, flipped: boolean): Vec2 {
  const left = leftNormalForTangent(tangent);
  return flipped ? scale(left, -1) : left;
}

export function leftNormalForTangent(tangent: Vec2): Vec2 {
  const magnitude = Math.hypot(tangent.x, tangent.y);
  if (!(magnitude > 1e-12) || !Number.isFinite(magnitude)) {
    throw new Error("post-impact support tangent must be finite and non-zero");
  }
  return { x: cleanZero(-tangent.y / magnitude), y: cleanZero(tangent.x / magnitude) };
}

function assertAnchorAndDisplacement(input: PostimpactSupportOrientationInput): void {
  for (const [name, value] of Object.entries({
    anchorX: input.anchor.reference.x,
    anchorY: input.anchor.reference.y,
    anchorHeadingDeg: input.anchor.headingDeg,
    anchorSpeedPxPerFrame: input.anchor.speedPxPerFrame,
    displacementX: input.captureOnlyReferenceDisplacement.x,
    displacementY: input.captureOnlyReferenceDisplacement.y,
  })) {
    if (!Number.isFinite(value)) throw new Error(`post-impact support ${name} must be finite`);
  }
  if (!(input.anchor.speedPxPerFrame > 0)) {
    throw new Error("post-impact support anchor speed must be positive");
  }
  if (input.anchor.anchorPoint !== "rider" && input.anchor.headingSource !== "reference_point_velocity") {
    throw new Error("post-impact support heading must belong to its named non-rider reference point");
  }
}

function unit(angleDeg: number): Vec2 {
  const radians = angleDeg * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function dot(left: Vec2, right: Vec2): number {
  return left.x * right.x + left.y * right.y;
}

function scale(value: Vec2, factor: number): Vec2 {
  return { x: cleanZero(value.x * factor), y: cleanZero(value.y * factor) };
}

function cleanZero(value: number): number {
  return value === 0 ? 0 : value;
}
