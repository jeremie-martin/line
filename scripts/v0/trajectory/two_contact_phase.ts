/**
 * Fixed-horizon, state-relative contact-phase geometry for a causal
 * construction assay. This module is deliberately not imported by the
 * compiler: it describes a bounded local hypothesis, not a production menu.
 *
 * The construction accepts only a pre-contact planning state, the current
 * contact's impact ask, and a predeclared control. In particular, it has no
 * outgoing interval, later contact, axis, seed, case, or score input.
 */
import { PERSISTENCE_FRAMES } from "../../lib/detector.ts";
import { IMPACT, IMPACT_WINDOW, impactToRedirArcPx, type TrackLine } from "../types.ts";
import { contactKinematicFrameFromPlanningState } from "./contact_kinematic_frame.ts";
import {
  activeNormalForDirectedTangent,
  leftNormalForTangent,
} from "./postimpact_support_orientation.ts";
import type { PlanningState } from "./state.ts";
import { targetFrameFromPlanningState } from "./target_frame.ts";

export const TWO_CONTACT_PHASE_PROTOCOL = Object.freeze({
  fixedResponseHorizonFrames: Math.max(PERSISTENCE_FRAMES, IMPACT_WINDOW),
  /** The owned-event reader accepts an event within +/-1 authored frame. */
  maxOwnedEventOffsetFrames: 1,
  captureSurfaceFrames: 1,
  compactPhaseLookbackFrames: [0, 2, 4] as const,
  /** The diagnostic sweep is deliberately broader than the compact stencil. */
  oraclePhaseLookbackFrames: [0, 1, 2, 3, 4, 5, 6, 7, 8] as const,
  compactApproachFrames: 2,
  compactTangentFrames: 1,
  /** Four deterministic samples for each phase/chirality/tail/side stratum. */
  oracleCount: 288,
  oraclePreReachFrames: [0.25, 8] as const,
  oracleTangentFrames: [-2, 2] as const,
  /** A physical preload is positive along the motion-facing capture normal. */
  oraclePreloadSledSpans: [0.15, 1.5] as const,
  oracleApproachDeltaDeg: [0, 55] as const,
  oracleTurnDeg: [4, 65] as const,
} as const);

export type PhaseTailAction = "neutral" | "directed";
/**
 * The engine's one-way collision side is independent of signed turning. The
 * away-from-motion arm is retained only as an explicit diagnostic control;
 * production proposals must use the motion-facing side.
 */
export type CollisionSide = "toward_motion" | "away_from_motion";

export type TwoContactPhaseControl = {
  /** State sampled before the current target frame, in whole frames. */
  phaseLookbackFrames: number;
  /** Explicitly retained chiral arm; impact itself has no signed direction. */
  chirality: -1 | 1;
  /** A neutral tail or a signed local response tail. */
  tailAction: PhaseTailAction;
  /** One-way collision side, deliberately independent of chirality. */
  collisionSide: CollisionSide;
  /** Entry tangent residual relative to the observed CoM velocity. */
  approachDeltaDeg: number;
  /** Signed tangent rotation over the bounded phase tail. */
  turnDeg: number;
  /** Positive preload from the named sled anchor along the physical capture normal. */
  preloadSledSpans: number;
  /** Anchor-forward placement in named-reference speed frames. */
  tangentFrames: number;
  /** Incoming catch extent in named-reference speed frames. */
  approachFrames: number;
  /** Collinear capture surface immediately after the target boundary. */
  captureSurfaceFrames: number;
  /** Fixed local construction extent, never an inferred support duration. */
  phaseHorizonFrames: number;
};

export type RealizedTwoContactPhase = {
  lines: TrackLine[];
  lineRoles: {
    captureApproach: number;
    captureSurface: number;
    phaseTail: number[];
  };
  contactPoint: { x: number; y: number };
  entryAngleDeg: number;
  exitAngleDeg: number;
  segmentCount: number;
  anchor: {
    point: string;
    headingSource: "reference_point_velocity" | "rider_com_velocity";
    headingDeg: number;
    speedPxPerFrame: number;
    sledSpanPx: number;
  };
  com: {
    headingDeg: number;
    speedPxPerFrame: number;
  };
  /** Explicit one-way-side and preload evidence for each directed segment. */
  orientation: {
    collisionSide: CollisionSide;
    preloadSledSpans: number;
    captureMotionAlignedFlipped: boolean;
    captureFlipped: boolean;
    captureGeometryActiveNormal: { x: number; y: number };
    captureActiveNormal: { x: number; y: number };
    captureNormalVelocityProjection: number;
    captureNormalPositionProjection: number;
    minimumGeometryActiveNormalDot: number;
    segments: Array<{
      lineId: number;
      tangentDeg: number;
      geometryFlipped: boolean;
      flipped: boolean;
      geometryActiveNormal: { x: number; y: number };
      activeNormal: { x: number; y: number };
    }>;
  };
};

/**
 * Fixed 24-row compact stencil: three causal observation phases crossed
 * with both physical chiralities, neutral/directed phase tails, and both
 * independently represented one-way collision sides.
 */
export function makeCompactTwoContactControls(input: {
  currentImpact: number | undefined;
  observedComSpeed: number;
}): TwoContactPhaseControl[] {
  const turnMagnitude = characteristicTurnDeg(input.currentImpact, input.observedComSpeed);
  const controls: TwoContactPhaseControl[] = [];
  for (const phaseLookbackFrames of TWO_CONTACT_PHASE_PROTOCOL.compactPhaseLookbackFrames) {
    for (const chirality of [-1, 1] as const) {
      for (const tailAction of ["neutral", "directed"] as const) {
        for (const collisionSide of ["toward_motion", "away_from_motion"] as const) {
          controls.push({
            phaseLookbackFrames,
            chirality,
            tailAction,
            collisionSide,
            approachDeltaDeg: chirality * clamp(turnMagnitude * 0.35, 4, 18),
            turnDeg: tailAction === "neutral" ? 0 : chirality * turnMagnitude,
            preloadSledSpans: 0.35,
            tangentFrames: TWO_CONTACT_PHASE_PROTOCOL.compactTangentFrames,
            approachFrames: TWO_CONTACT_PHASE_PROTOCOL.compactApproachFrames,
            captureSurfaceFrames: TWO_CONTACT_PHASE_PROTOCOL.captureSurfaceFrames,
            phaseHorizonFrames: TWO_CONTACT_PHASE_PROTOCOL.fixedResponseHorizonFrames,
          });
        }
      }
    }
  }
  return controls;
}

/**
 * Broad deterministic diagnostic screen. It is stratified by an independent
 * phase ladder, chirality, tail topology, and one-way collision side so a
 * finite global quasi-random prefix cannot accidentally omit a physical arm.
 * It is evidence of only the declared bounded region; it never selects a
 * source control.
 */
export function makeOracleTwoContactControls(count = TWO_CONTACT_PHASE_PROTOCOL.oracleCount): TwoContactPhaseControl[] {
  const strata = TWO_CONTACT_PHASE_PROTOCOL.oraclePhaseLookbackFrames.flatMap((phaseLookbackFrames) =>
    ([-1, 1] as const).flatMap((chirality) =>
      (["neutral", "directed"] as const).flatMap((tailAction) =>
        (["toward_motion", "away_from_motion"] as const).map((collisionSide) => ({
          phaseLookbackFrames,
          chirality,
          tailAction,
          collisionSide,
        }))
      )
    )
  );
  if (!Number.isSafeInteger(count) || count < 1 || count > 16_384) {
    throw new Error(`oracle control count must be an integer in [1, 16384], got ${count}`);
  }
  if (count % strata.length !== 0) {
    throw new Error(`oracle control count must cover complete ${strata.length}-row strata, got ${count}`);
  }
  return Array.from({ length: count }, (_, index) => {
    const stratum = strata[index % strata.length]!;
    const sequence = Math.floor(index / strata.length) + 1;
    return {
      ...stratum,
      approachDeltaDeg: stratum.chirality * lerp(
        TWO_CONTACT_PHASE_PROTOCOL.oracleApproachDeltaDeg[0],
        TWO_CONTACT_PHASE_PROTOCOL.oracleApproachDeltaDeg[1],
        halton(sequence, 2),
      ),
      turnDeg: stratum.tailAction === "neutral"
        ? 0
        : stratum.chirality * lerp(
          TWO_CONTACT_PHASE_PROTOCOL.oracleTurnDeg[0],
          TWO_CONTACT_PHASE_PROTOCOL.oracleTurnDeg[1],
          halton(sequence, 3),
        ),
      preloadSledSpans: lerp(
        TWO_CONTACT_PHASE_PROTOCOL.oraclePreloadSledSpans[0],
        TWO_CONTACT_PHASE_PROTOCOL.oraclePreloadSledSpans[1],
        halton(sequence, 5),
      ),
      tangentFrames: lerp(
        TWO_CONTACT_PHASE_PROTOCOL.oracleTangentFrames[0],
        TWO_CONTACT_PHASE_PROTOCOL.oracleTangentFrames[1],
        halton(sequence, 7),
      ),
      approachFrames: lerp(
        TWO_CONTACT_PHASE_PROTOCOL.oraclePreReachFrames[0],
        TWO_CONTACT_PHASE_PROTOCOL.oraclePreReachFrames[1],
        halton(sequence, 11),
      ),
      captureSurfaceFrames: TWO_CONTACT_PHASE_PROTOCOL.captureSurfaceFrames,
      phaseHorizonFrames: TWO_CONTACT_PHASE_PROTOCOL.fixedResponseHorizonFrames,
    };
  });
}

/**
 * Realize a control with a named sled point for placement and the rider CoM
 * for collision-response heading. The phase tail has a fixed six-frame extent;
 * it is intentionally not a surrogate for a full outgoing support duration.
 */
export function realizeTwoContactPhase(
  state: PlanningState,
  control: TwoContactPhaseControl,
  lineIdStart: number,
): RealizedTwoContactPhase {
  assertControl(control);
  if (!Number.isSafeInteger(lineIdStart) || lineIdStart < 1) {
    throw new Error(`lineIdStart must be a positive integer, got ${lineIdStart}`);
  }
  const anchor = targetFrameFromPlanningState(state);
  const kinematic = contactKinematicFrameFromPlanningState(state, anchor, {});
  const entryAngleDeg = kinematic.com.headingDeg + control.approachDeltaDeg;
  const anchorTangent = unit(anchor.headingDeg);
  const entryTangent = unit(entryAngleDeg);
  const incomingVelocity = scale(unit(kinematic.com.headingDeg), kinematic.com.speedPxPerFrame);
  const entryBaseNormal = leftNormalForTangent(entryTangent);
  const entryBaseNormalVelocityProjection = dot(entryBaseNormal, incomingVelocity);
  if (Math.abs(entryBaseNormalVelocityProjection) <= 1e-9) {
    throw new Error("two-contact phase cannot select a stable collision side at zero normal incidence");
  }
  const captureMotionAlignedFlipped = entryBaseNormalVelocityProjection < 0;
  const captureGeometryActiveNormal = activeNormalForDirectedTangent(entryTangent, captureMotionAlignedFlipped);
  const rawContactPoint = {
    x: anchor.reference.x + anchorTangent.x * anchor.speedPxPerFrame * control.tangentFrames,
    y: anchor.reference.y + anchorTangent.y * anchor.speedPxPerFrame * control.tangentFrames,
  };
  // Preserve the tangential phase coordinate while placing the surface a
  // positive signed preload away from the incoming named reference. This
  // construction is independent of the diagnostic one-way-side arm below.
  const rawPositionProjection = dot(
    captureGeometryActiveNormal,
    subtract(anchor.reference, rawContactPoint),
  );
  const desiredPositionProjection = anchor.sledSpanPx * control.preloadSledSpans;
  const contactPoint = add(
    rawContactPoint,
    scale(captureGeometryActiveNormal, rawPositionProjection - desiredPositionProjection),
  );
  const approachPoint = {
    x: contactPoint.x - entryTangent.x * anchor.speedPxPerFrame * control.approachFrames,
    y: contactPoint.y - entryTangent.y * anchor.speedPxPerFrame * control.approachFrames,
  };
  const captureSurfaceEnd = {
    x: contactPoint.x + entryTangent.x * anchor.speedPxPerFrame * control.captureSurfaceFrames,
    y: contactPoint.y + entryTangent.y * anchor.speedPxPerFrame * control.captureSurfaceFrames,
  };
  const lines: TrackLine[] = [];
  const segments: RealizedTwoContactPhase["orientation"]["segments"] = [];
  let previousGeometryActiveNormal: { x: number; y: number } | null = null;
  let minimumGeometryActiveNormalDot = 1;
  const appendSegment = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    tangentDeg: number,
  ) => {
    const tangent = unit(tangentDeg);
    const baseNormal = leftNormalForTangent(tangent);
    const geometryFlipped = previousGeometryActiveNormal === null
      ? captureMotionAlignedFlipped
      : dot(baseNormal, previousGeometryActiveNormal) < 0;
    const geometryActiveNormal = activeNormalForDirectedTangent(tangent, geometryFlipped);
    if (previousGeometryActiveNormal !== null) {
      minimumGeometryActiveNormalDot = Math.min(
        minimumGeometryActiveNormalDot,
        dot(previousGeometryActiveNormal, geometryActiveNormal),
      );
    }
    const flipped = control.collisionSide === "toward_motion" ? geometryFlipped : !geometryFlipped;
    const activeNormal = activeNormalForDirectedTangent(tangent, flipped);
    const lineId = lineIdStart + lines.length;
    lines.push(solidLine(lineId, start, end, flipped));
    segments.push({
      lineId,
      tangentDeg,
      geometryFlipped,
      flipped,
      geometryActiveNormal,
      activeNormal,
    });
    previousGeometryActiveNormal = geometryActiveNormal;
  };
  appendSegment(approachPoint, contactPoint, entryAngleDeg);
  appendSegment(contactPoint, captureSurfaceEnd, entryAngleDeg);

  const tailFrames = control.phaseHorizonFrames - control.captureSurfaceFrames;
  const tailLength = anchor.speedPxPerFrame * tailFrames;
  const tailSegments = Math.max(
    Math.abs(control.turnDeg) > 1e-12 ? 2 : 1,
    Math.ceil(Math.abs(control.turnDeg) / 5),
    Math.ceil(tailLength / Math.max(16, anchor.speedPxPerFrame * 2)),
  );
  const tailSegmentLength = tailLength / tailSegments;
  let point = captureSurfaceEnd;
  for (let index = 0; index < tailSegments; index++) {
    const progress = tailSegments === 1 ? 0 : index / (tailSegments - 1);
    const tangent = unit(entryAngleDeg + control.turnDeg * progress);
    const next = {
      x: point.x + tangent.x * tailSegmentLength,
      y: point.y + tangent.y * tailSegmentLength,
    };
    appendSegment(point, next, entryAngleDeg + control.turnDeg * progress);
    point = next;
  }
  const captureSegment = segments[0]!;
  const captureNormalVelocityProjection = dot(captureSegment.activeNormal, incomingVelocity);
  const captureNormalPositionProjection = dot(
    captureSegment.activeNormal,
    subtract(anchor.reference, contactPoint),
  );
  if (control.collisionSide === "toward_motion" &&
      (captureNormalVelocityProjection <= 1e-9 || captureNormalPositionProjection <= 1e-9)) {
    throw new Error("motion-facing capture phase violates the engine's one-way collision predicate");
  }
  return {
    lines,
    lineRoles: {
      captureApproach: lines[0]!.id,
      captureSurface: lines[1]!.id,
      phaseTail: lines.slice(2).map((line) => line.id),
    },
    contactPoint,
    entryAngleDeg,
    exitAngleDeg: entryAngleDeg + control.turnDeg,
    segmentCount: tailSegments,
    anchor: {
      point: anchor.anchorPoint,
      headingSource: anchor.headingSource,
      headingDeg: anchor.headingDeg,
      speedPxPerFrame: anchor.speedPxPerFrame,
      sledSpanPx: anchor.sledSpanPx,
    },
    com: { ...kinematic.com },
    orientation: {
      collisionSide: control.collisionSide,
      preloadSledSpans: control.preloadSledSpans,
      captureMotionAlignedFlipped,
      captureFlipped: captureSegment.flipped,
      captureGeometryActiveNormal,
      captureActiveNormal: captureSegment.activeNormal,
      captureNormalVelocityProjection,
      captureNormalPositionProjection,
      minimumGeometryActiveNormalDot,
      segments,
    },
  };
}

function characteristicTurnDeg(currentImpact: number | undefined, speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) throw new Error(`observedComSpeed must be positive and finite, got ${speed}`);
  if (currentImpact === undefined) return 12;
  const redirection = impactToRedirArcPx(clamp(currentImpact, 0, 1));
  const radians = Math.min(
    redirection / speed,
    Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION),
  );
  return clamp(toDegrees(radians), 8, 52);
}

function assertControl(control: TwoContactPhaseControl): void {
  if (!TWO_CONTACT_PHASE_PROTOCOL.oraclePhaseLookbackFrames.includes(
    control.phaseLookbackFrames as (typeof TWO_CONTACT_PHASE_PROTOCOL.oraclePhaseLookbackFrames)[number],
  )) {
    throw new Error(`phaseLookbackFrames must be one of ${TWO_CONTACT_PHASE_PROTOCOL.oraclePhaseLookbackFrames.join(", ")}`);
  }
  if (control.chirality !== -1 && control.chirality !== 1) throw new Error("chirality must be -1 or 1");
  if (control.tailAction !== "neutral" && control.tailAction !== "directed") {
    throw new Error("tailAction must be neutral or directed");
  }
  if (control.collisionSide !== "toward_motion" && control.collisionSide !== "away_from_motion") {
    throw new Error("collisionSide must be toward_motion or away_from_motion");
  }
  const ranges: Array<[string, number, number]> = [
    ["approachDeltaDeg", -90, 90],
    ["turnDeg", -90, 90],
    ["preloadSledSpans", 0.05, 4],
    ["tangentFrames", -4, 4],
    ["approachFrames", 0.25, 12],
  ];
  for (const [name, lo, hi] of ranges) {
    const value = control[name as keyof TwoContactPhaseControl];
    if (typeof value !== "number" || !Number.isFinite(value) || value < lo || value > hi) {
      throw new Error(`${name} must be finite and in [${lo}, ${hi}]`);
    }
  }
  if (control.captureSurfaceFrames !== TWO_CONTACT_PHASE_PROTOCOL.captureSurfaceFrames) {
    throw new Error(`captureSurfaceFrames must equal ${TWO_CONTACT_PHASE_PROTOCOL.captureSurfaceFrames}`);
  }
  if (control.phaseHorizonFrames !== TWO_CONTACT_PHASE_PROTOCOL.fixedResponseHorizonFrames) {
    throw new Error(`phaseHorizonFrames must equal ${TWO_CONTACT_PHASE_PROTOCOL.fixedResponseHorizonFrames}`);
  }
  if (control.tailAction === "neutral" && Math.abs(control.turnDeg) > 1e-12) {
    throw new Error("neutral tailAction requires turnDeg = 0");
  }
}

function solidLine(
  id: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
  flipped: boolean,
): TrackLine {
  return {
    id,
    type: 0,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    flipped,
    leftExtended: false,
    rightExtended: false,
  };
}

function unit(angleDeg: number): { x: number; y: number } {
  const radians = angleDeg * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function add(left: { x: number; y: number }, right: { x: number; y: number }): { x: number; y: number } {
  return { x: left.x + right.x, y: left.y + right.y };
}

function subtract(left: { x: number; y: number }, right: { x: number; y: number }): { x: number; y: number } {
  return { x: left.x - right.x, y: left.y - right.y };
}

function scale(value: { x: number; y: number }, factor: number): { x: number; y: number } {
  return { x: value.x * factor, y: value.y * factor };
}

function dot(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return left.x * right.x + left.y * right.y;
}

function halton(index: number, base: number): number {
  let value = 0;
  let fraction = 1 / base;
  let remaining = index;
  while (remaining > 0) {
    value += fraction * (remaining % base);
    remaining = Math.floor(remaining / base);
    fraction /= base;
  }
  return value;
}

function lerp(left: number, right: number, t: number): number {
  return left + (right - left) * t;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function toDegrees(radians: number): number {
  return radians * 180 / Math.PI;
}
