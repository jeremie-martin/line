/**
 * One-line, target-blind realization for the long-carrier duration assay.
 *
 * The caller supplies a numeric extent that has already been planned from the
 * scalar duration boundary. This module does not know an outgoing endpoint,
 * axes, targets, fixture identity, score, or compiler policy.
 */
import type { PostimpactTrackLine } from "./postimpact_physics.ts";
import {
  assertPostimpactNamedReferenceStep,
  type PostimpactNamedReferenceStep,
} from "./postimpact_support_orientation.ts";
import type { Vec2 } from "./state.ts";

export const POSTIMPACT_LONG_CARRIER_SURFACE_PROTOCOL = Object.freeze({
  lineType: 0,
  flipped: false,
  leftExtended: false,
  rightExtended: false,
  topology: "one_solid_directed_line.v1",
} as const);

const MAX_SIGNED_I32_LINE_ID = 0x7fffffff;

export type PostimpactLongCarrierInput = {
  namedReferenceStep: PostimpactNamedReferenceStep;
  phaseLeadSteps: number;
  supportFraction: number;
  extentPx: number;
  lineIdStart: number;
};

export type PostimpactLongCarrier = {
  phaseLeadSteps: number;
  supportFraction: number;
  extentPx: number;
  carrierStart: Vec2;
  direction: Vec2;
  line: PostimpactTrackLine | null;
  lines: readonly PostimpactTrackLine[];
};

/**
 * Realize a single forward rail from observed H-to-H+1 reference motion. The
 * zero-fraction control emits no line. Every nonzero fraction emits exactly
 * one default solid line; no segmentation or side/preload choice is hidden in
 * the geometry layer.
 */
export function realizePostimpactLongCarrier(input: PostimpactLongCarrierInput): PostimpactLongCarrier {
  assertPostimpactNamedReferenceStep(input.namedReferenceStep);
  assertPhaseLeadSteps(input.phaseLeadSteps);
  assertSupportFraction(input.supportFraction);
  assertLineIdStart(input.lineIdStart);
  if (!Number.isFinite(input.extentPx) || input.extentPx < 0) {
    throw new Error("post-impact long carrier extent must be finite and non-negative");
  }
  const displacement = subtract(input.namedReferenceStep.toReference, input.namedReferenceStep.fromReference);
  const displacementLength = Math.hypot(displacement.x, displacement.y);
  if (!(displacementLength > 1e-12) || !Number.isFinite(displacementLength)) {
    throw new Error("post-impact long carrier requires a finite non-zero H-to-H+1 reference step");
  }
  const direction = {
    x: displacement.x / displacementLength,
    y: displacement.y / displacementLength,
  };
  const carrierStart = add(
    input.namedReferenceStep.toReference,
    scale(displacement, input.phaseLeadSteps),
  );
  if (input.supportFraction === 0) {
    if (input.extentPx !== 0) {
      throw new Error("post-impact long carrier zero fraction must have zero extent");
    }
    return freezeCarrier({
      phaseLeadSteps: input.phaseLeadSteps,
      supportFraction: input.supportFraction,
      extentPx: input.extentPx,
      carrierStart,
      direction,
      line: null,
      lines: [],
    });
  }
  if (!(input.extentPx > 0)) {
    throw new Error("post-impact long carrier nonzero fraction requires positive extent");
  }
  const end = add(carrierStart, scale(direction, input.extentPx));
  const line: PostimpactTrackLine = {
    id: input.lineIdStart,
    type: POSTIMPACT_LONG_CARRIER_SURFACE_PROTOCOL.lineType,
    x1: carrierStart.x,
    y1: carrierStart.y,
    x2: end.x,
    y2: end.y,
    flipped: POSTIMPACT_LONG_CARRIER_SURFACE_PROTOCOL.flipped,
    leftExtended: POSTIMPACT_LONG_CARRIER_SURFACE_PROTOCOL.leftExtended,
    rightExtended: POSTIMPACT_LONG_CARRIER_SURFACE_PROTOCOL.rightExtended,
  };
  return freezeCarrier({
    phaseLeadSteps: input.phaseLeadSteps,
    supportFraction: input.supportFraction,
    extentPx: input.extentPx,
    carrierStart,
    direction,
    line,
    lines: [line],
  });
}

function assertPhaseLeadSteps(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("post-impact long carrier phase lead must be a non-negative safe integer");
  }
}

function assertSupportFraction(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("post-impact long carrier support fraction must be finite in [0, 1]");
  }
}

function assertLineIdStart(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_SIGNED_I32_LINE_ID) {
    throw new Error("post-impact long carrier line id must be a non-negative signed 32-bit integer");
  }
}

function freezeCarrier(carrier: PostimpactLongCarrier): PostimpactLongCarrier {
  const line = carrier.line === null ? null : Object.freeze({ ...carrier.line });
  return Object.freeze({
    ...carrier,
    carrierStart: Object.freeze({ ...carrier.carrierStart }),
    direction: Object.freeze({ ...carrier.direction }),
    line,
    lines: Object.freeze(line === null ? [] : [line]),
  });
}

function add(left: Vec2, right: Vec2): Vec2 {
  return { x: cleanZero(left.x + right.x), y: cleanZero(left.y + right.y) };
}

function subtract(left: Vec2, right: Vec2): Vec2 {
  return { x: cleanZero(left.x - right.x), y: cleanZero(left.y - right.y) };
}

function scale(value: Vec2, factor: number): Vec2 {
  return { x: cleanZero(value.x * factor), y: cleanZero(value.y * factor) };
}

function cleanZero(value: number): number {
  return value === 0 ? 0 : value;
}
