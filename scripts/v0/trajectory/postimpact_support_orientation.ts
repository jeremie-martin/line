/**
 * Named-reference placement and collision-side transport shared by new
 * post-impact study primitives.
 *
 * This is a geometry boundary, not a dynamics model: a capture-only H -> H+1
 * step of the same named reference point selects a one-sided static-line
 * orientation before any action replay. The step carries enough provenance to
 * prevent a caller from substituting an unbound displacement after capture.
 */
import type { TargetFrame } from "./target_frame.ts";
import type { Vec2 } from "./state.ts";

export const POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL = Object.freeze({
  /** The only owner of post-impact preload distance. */
  preloadSpeedFrames: 0.1,
  /** Reject a numerically trivial H -> H+1 step relative to the anchor speed. */
  minReferenceStepToAnchorSpeedRatio: 1e-4,
  /** Require forward progress as a fraction of the named-reference step. */
  minForwardProjectionToReferenceStepRatio: 1e-4,
  /** Require a resolvable active side as a fraction of the named-reference step. */
  minNormalProjectionToReferenceStepRatio: 1e-4,
} as const);

/**
 * Immutable capture-only evidence for one adjacent named-reference step.
 * `fromReference` must be the target-frame reference at H, while
 * `toReference` is that exact named point at H+1. The fingerprint is an exact
 * capture-only trace identity supplied by the replay boundary.
 */
export type PostimpactNamedReferenceStep = {
  readonly anchorPoint: TargetFrame["anchorPoint"];
  readonly fromFrame: number;
  readonly toFrame: number;
  readonly fromReference: Vec2;
  readonly toReference: Vec2;
  readonly exactCaptureOnlyTraceFingerprint: string;
};

export type PostimpactNamedReferenceStepInput = PostimpactNamedReferenceStep;

/**
 * Construct a frozen provenance-bearing H -> H+1 step. Resolution validates
 * this again because TypeScript callers can still fabricate a structural type.
 */
export function makePostimpactNamedReferenceStep(
  input: PostimpactNamedReferenceStepInput,
): PostimpactNamedReferenceStep {
  assertPostimpactNamedReferenceStep(input);
  return Object.freeze({
    anchorPoint: input.anchorPoint,
    fromFrame: input.fromFrame,
    toFrame: input.toFrame,
    fromReference: Object.freeze({ ...input.fromReference }),
    toReference: Object.freeze({ ...input.toReference }),
    exactCaptureOnlyTraceFingerprint: input.exactCaptureOnlyTraceFingerprint,
  });
}

export type PostimpactSupportOrientationInput = {
  anchor: TargetFrame;
  captureOnlyNamedReferenceStep: PostimpactNamedReferenceStep;
};

/** Stable audit fields derived from the immutable capture-only step. */
export type PostimpactReferenceStepProvenance = {
  anchorPoint: TargetFrame["anchorPoint"];
  fromFrame: number;
  toFrame: number;
  exactCaptureOnlyTraceFingerprint: string;
  referenceStepPx: number;
  referenceStepToAnchorSpeedRatio: number;
  entryTangentProjectionToReferenceStepRatio: number;
  entryActiveNormalProjectionToReferenceStepRatio: number;
};

export type PostimpactSupportOrientation = {
  entryTangent: Vec2;
  entryTangentDeg: number;
  entryFlipped: boolean;
  entryActiveNormal: Vec2;
  entryNormalProjectionPx: number;
  entryTangentProjectionPx: number;
  preloadPx: number;
  referenceStep: PostimpactReferenceStepProvenance;
};

export function resolvePostimpactSupportOrientation(
  input: PostimpactSupportOrientationInput,
): PostimpactSupportOrientation {
  assertAnchorAndNamedReferenceStep(input);
  const step = input.captureOnlyNamedReferenceStep;
  const displacement = subtract(step.toReference, step.fromReference);
  const referenceStepPx = Math.hypot(displacement.x, displacement.y);
  const referenceStepToAnchorSpeedRatio = referenceStepPx / input.anchor.speedPxPerFrame;
  if (referenceStepToAnchorSpeedRatio < POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL.minReferenceStepToAnchorSpeedRatio) {
    throw new Error("post-impact support H-to-H+1 reference step is too small relative to anchor speed");
  }

  const entryTangent = unit(input.anchor.headingDeg);
  const entryTangentProjectionPx = dot(entryTangent, displacement);
  const entryTangentProjectionToReferenceStepRatio = entryTangentProjectionPx / referenceStepPx;
  if (entryTangentProjectionToReferenceStepRatio <
      POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL.minForwardProjectionToReferenceStepRatio) {
    throw new Error("post-impact support reference motion does not advance along the canonical direction");
  }

  const leftNormal = leftNormalForTangent(entryTangent);
  const normalProjection = dot(leftNormal, displacement);
  const normalProjectionToReferenceStepRatio = Math.abs(normalProjection) / referenceStepPx;
  if (normalProjectionToReferenceStepRatio <
      POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL.minNormalProjectionToReferenceStepRatio) {
    throw new Error("post-impact support reference motion cannot choose a stable active normal");
  }

  const entryFlipped = normalProjection < 0;
  const entryActiveNormal = activeNormalForDirectedTangent(entryTangent, entryFlipped);
  const entryNormalProjectionPx = dot(entryActiveNormal, displacement);
  const entryActiveNormalProjectionToReferenceStepRatio = entryNormalProjectionPx / referenceStepPx;
  if (entryActiveNormalProjectionToReferenceStepRatio <
      POSTIMPACT_SUPPORT_ORIENTATION_PROTOCOL.minNormalProjectionToReferenceStepRatio) {
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
    referenceStep: {
      anchorPoint: step.anchorPoint,
      fromFrame: step.fromFrame,
      toFrame: step.toFrame,
      exactCaptureOnlyTraceFingerprint: step.exactCaptureOnlyTraceFingerprint,
      referenceStepPx,
      referenceStepToAnchorSpeedRatio,
      entryTangentProjectionToReferenceStepRatio,
      entryActiveNormalProjectionToReferenceStepRatio,
    },
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

function assertAnchorAndNamedReferenceStep(input: PostimpactSupportOrientationInput): void {
  const { anchor, captureOnlyNamedReferenceStep: step } = input;
  for (const [name, value] of Object.entries({
    anchorX: anchor.reference.x,
    anchorY: anchor.reference.y,
    anchorHeadingDeg: anchor.headingDeg,
    anchorSpeedPxPerFrame: anchor.speedPxPerFrame,
  })) {
    if (!Number.isFinite(value)) throw new Error(`post-impact support ${name} must be finite`);
  }
  if (!(anchor.speedPxPerFrame > 0)) {
    throw new Error("post-impact support anchor speed must be positive");
  }
  if (anchor.anchorPoint !== "rider" && anchor.headingSource !== "reference_point_velocity") {
    throw new Error("post-impact support heading must belong to its named non-rider reference point");
  }

  assertPostimpactNamedReferenceStep(step);
  if (step.anchorPoint !== anchor.anchorPoint) {
    throw new Error("post-impact support named reference step must use the same anchor point");
  }
  if (step.fromReference.x !== anchor.reference.x || step.fromReference.y !== anchor.reference.y) {
    throw new Error("post-impact support named reference step must begin at the exact anchor reference");
  }
}

/** Validate named H-to-H+1 evidence without selecting a collision side. */
export function assertPostimpactNamedReferenceStep(step: PostimpactNamedReferenceStep): void {
  if (!Number.isSafeInteger(step.fromFrame) || step.fromFrame < 0 ||
      !Number.isSafeInteger(step.toFrame) || step.toFrame < 0) {
    throw new Error("post-impact support named reference frames must be non-negative safe integers");
  }
  if (step.toFrame !== step.fromFrame + 1) {
    throw new Error("post-impact support named reference step must be contiguous from H to H+1");
  }
  if (typeof step.exactCaptureOnlyTraceFingerprint !== "string" || step.exactCaptureOnlyTraceFingerprint.trim() === "") {
    throw new Error("post-impact support named reference step requires a non-empty exact capture-only trace fingerprint");
  }
  for (const [name, value] of Object.entries({
    fromReferenceX: step.fromReference.x,
    fromReferenceY: step.fromReference.y,
    toReferenceX: step.toReference.x,
    toReferenceY: step.toReference.y,
  })) {
    if (!Number.isFinite(value)) throw new Error(`post-impact support ${name} must be finite`);
  }
}

function unit(angleDeg: number): Vec2 {
  const radians = angleDeg * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function subtract(left: Vec2, right: Vec2): Vec2 {
  return { x: cleanZero(left.x - right.x), y: cleanZero(left.y - right.y) };
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
