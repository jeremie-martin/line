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
import type { PlanningState } from "./state.ts";
import { targetFrameFromPlanningState } from "./target_frame.ts";

export const TWO_CONTACT_PHASE_PROTOCOL = Object.freeze({
  fixedResponseHorizonFrames: Math.max(PERSISTENCE_FRAMES, IMPACT_WINDOW),
  captureSurfaceFrames: 1,
  compactPhaseLookbackFrames: [0, 2, 4] as const,
  compactApproachFrames: 2,
  compactTangentFrames: 1,
  oracleCount: 120,
  oraclePreReachFrames: [0.25, 8] as const,
  oracleTangentFrames: [-2, 2] as const,
  oracleNormalOffsetSledSpans: [-1.5, 1.5] as const,
  oracleApproachDeltaDeg: [0, 55] as const,
  oracleTurnDeg: [4, 65] as const,
} as const);

export type PhaseTailAction = "neutral" | "directed";

export type TwoContactPhaseControl = {
  /** State sampled before the current target frame, in whole frames. */
  phaseLookbackFrames: number;
  /** Explicitly retained chiral arm; impact itself has no signed direction. */
  chirality: -1 | 1;
  /** A neutral tail or a signed local response tail. */
  tailAction: PhaseTailAction;
  /** Entry tangent residual relative to the observed CoM velocity. */
  approachDeltaDeg: number;
  /** Signed tangent rotation over the bounded phase tail. */
  turnDeg: number;
  /** Offset from the named sled anchor, in that sled's own span units. */
  normalOffsetSledSpans: number;
  /** Anchor-forward placement in named-reference speed frames. */
  tangentFrames: number;
  /** Incoming catch extent in named-reference speed frames. */
  approachFrames: number;
  /** Collinear capture surface immediately after the target boundary. */
  captureSurfaceFrames: number;
  /** Fixed local construction extent, never an inferred support duration. */
  phaseHorizonFrames: number;
  /** Collidable side of every directed phase segment. */
  flipped: boolean;
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
    headingDeg: number;
    speedPxPerFrame: number;
    sledSpanPx: number;
  };
  com: {
    headingDeg: number;
    speedPxPerFrame: number;
  };
};

/**
 * Fixed twelve-row compact stencil: three causal observation phases crossed
 * with both physical chiralities and neutral/directed phase tails.
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
        controls.push({
          phaseLookbackFrames,
          chirality,
          tailAction,
          approachDeltaDeg: chirality * clamp(turnMagnitude * 0.35, 4, 18),
          turnDeg: tailAction === "neutral" ? 0 : chirality * turnMagnitude,
          normalOffsetSledSpans: chirality * 0.35,
          tangentFrames: TWO_CONTACT_PHASE_PROTOCOL.compactTangentFrames,
          approachFrames: TWO_CONTACT_PHASE_PROTOCOL.compactApproachFrames,
          captureSurfaceFrames: TWO_CONTACT_PHASE_PROTOCOL.captureSurfaceFrames,
          phaseHorizonFrames: TWO_CONTACT_PHASE_PROTOCOL.fixedResponseHorizonFrames,
          flipped: chirality < 0,
        });
      }
    }
  }
  return controls;
}

/**
 * Broad deterministic diagnostic screen. It is stratified by phase,
 * chirality, and tail topology so a finite global quasi-random prefix cannot
 * accidentally omit one physical arm. It is evidence of only the declared
 * bounded region; it never selects a source control.
 */
export function makeOracleTwoContactControls(count = TWO_CONTACT_PHASE_PROTOCOL.oracleCount): TwoContactPhaseControl[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > 16_384) {
    throw new Error(`oracle control count must be an integer in [1, 16384], got ${count}`);
  }
  const phaseSteps = TWO_CONTACT_PHASE_PROTOCOL.compactPhaseLookbackFrames;
  const stratumCount = phaseSteps.length * 2 * 2;
  return Array.from({ length: count }, (_, index) => {
    const stratum = index % stratumCount;
    const sequence = Math.floor(index / stratumCount) + 1;
    const phaseLookbackFrames = phaseSteps[stratum % phaseSteps.length]!;
    const chirality: -1 | 1 = Math.floor(stratum / phaseSteps.length) % 2 === 0 ? -1 : 1;
    const tailAction: PhaseTailAction = Math.floor(stratum / (phaseSteps.length * 2)) === 0
      ? "neutral"
      : "directed";
    return {
      phaseLookbackFrames,
      chirality,
      tailAction,
      approachDeltaDeg: chirality * lerp(
        TWO_CONTACT_PHASE_PROTOCOL.oracleApproachDeltaDeg[0],
        TWO_CONTACT_PHASE_PROTOCOL.oracleApproachDeltaDeg[1],
        halton(sequence, 2),
      ),
      turnDeg: tailAction === "neutral"
        ? 0
        : chirality * lerp(
          TWO_CONTACT_PHASE_PROTOCOL.oracleTurnDeg[0],
          TWO_CONTACT_PHASE_PROTOCOL.oracleTurnDeg[1],
          halton(sequence, 3),
        ),
      normalOffsetSledSpans: lerp(
        TWO_CONTACT_PHASE_PROTOCOL.oracleNormalOffsetSledSpans[0],
        TWO_CONTACT_PHASE_PROTOCOL.oracleNormalOffsetSledSpans[1],
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
      flipped: chirality < 0,
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
  const entryNormal = leftNormal(entryTangent);
  const contactPoint = {
    x: anchor.reference.x + anchorTangent.x * anchor.speedPxPerFrame * control.tangentFrames +
      entryNormal.x * anchor.sledSpanPx * control.normalOffsetSledSpans,
    y: anchor.reference.y + anchorTangent.y * anchor.speedPxPerFrame * control.tangentFrames +
      entryNormal.y * anchor.sledSpanPx * control.normalOffsetSledSpans,
  };
  const approachPoint = {
    x: contactPoint.x - entryTangent.x * anchor.speedPxPerFrame * control.approachFrames,
    y: contactPoint.y - entryTangent.y * anchor.speedPxPerFrame * control.approachFrames,
  };
  const captureSurfaceEnd = {
    x: contactPoint.x + entryTangent.x * anchor.speedPxPerFrame * control.captureSurfaceFrames,
    y: contactPoint.y + entryTangent.y * anchor.speedPxPerFrame * control.captureSurfaceFrames,
  };
  const lines: TrackLine[] = [
    solidLine(lineIdStart, approachPoint, contactPoint, control.flipped),
    solidLine(lineIdStart + 1, contactPoint, captureSurfaceEnd, control.flipped),
  ];

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
    lines.push(solidLine(lineIdStart + lines.length, point, next, control.flipped));
    point = next;
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
      headingDeg: anchor.headingDeg,
      speedPxPerFrame: anchor.speedPxPerFrame,
      sledSpanPx: anchor.sledSpanPx,
    },
    com: { ...kinematic.com },
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
  if (!TWO_CONTACT_PHASE_PROTOCOL.compactPhaseLookbackFrames.includes(
    control.phaseLookbackFrames as (typeof TWO_CONTACT_PHASE_PROTOCOL.compactPhaseLookbackFrames)[number],
  )) {
    throw new Error(`phaseLookbackFrames must be one of ${TWO_CONTACT_PHASE_PROTOCOL.compactPhaseLookbackFrames.join(", ")}`);
  }
  if (control.chirality !== -1 && control.chirality !== 1) throw new Error("chirality must be -1 or 1");
  if (control.tailAction !== "neutral" && control.tailAction !== "directed") {
    throw new Error("tailAction must be neutral or directed");
  }
  const ranges: Array<[string, number, number]> = [
    ["approachDeltaDeg", -90, 90],
    ["turnDeg", -90, 90],
    ["normalOffsetSledSpans", -4, 4],
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

function leftNormal(value: { x: number; y: number }): { x: number; y: number } {
  return { x: -value.y, y: value.x };
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
