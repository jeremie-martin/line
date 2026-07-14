/**
 * Continuous, state-relative controls for an observation-only two-contact
 * feasibility assay. This is deliberately not imported by the compiler.
 *
 * A control constructs the terrain that owns a current contact and the start
 * of its outgoing interval. The next contact is only an exact replay endpoint:
 * no later impact, case identity, seed, or outcome is available to control
 * construction.
 */
import { MIN_LANDING_AIRBORNE_FRAMES } from "../../lib/detector.ts";
import { IMPACT, impactToRedirArcPx, type TrackLine } from "../types.ts";
import type { PlanningState } from "./state.ts";

export type TwoContactOutgoingIntent = {
  intervalFrames: number;
  /** Undefined remains undefined: it is not replaced with a neutral target. */
  air?: number;
  speed?: number;
  amplitude?: number;
};

export type TwoContactPhaseControl = {
  /** State sampled before the current target frame, in whole frames. */
  phaseLookbackFrames: number;
  /** Entry tangent residual relative to the observed reference velocity. */
  approachDeltaDeg: number;
  /** Signed tangent rotation distributed along the post-contact support. */
  turnDeg: number;
  /** Offset along the explicitly selected contact-side normal. */
  normalOffsetPx: number;
  /** Contact placement ahead of the sampled reference state. */
  tangentFrames: number;
  /** Incoming catch extent in observed-speed frame units. */
  preFrames: number;
  /** Outgoing support extent in observed-speed frame units. */
  postFrames: number;
  /** Which physical side of the directed support surface is collidable. */
  flipped: boolean;
};

export type RealizedTwoContactPhase = {
  lines: TrackLine[];
  contactPoint: { x: number; y: number };
  entryAngleDeg: number;
  exitAngleDeg: number;
  segmentCount: number;
};

const MAX_PHASE_LOOKBACK = 4;
const MAX_POST_FRAMES = 24;

/**
 * Fixed nine-control falsification stencil. It derives only a current-event
 * turn magnitude and an outgoing non-event interval intent. Both chiralities
 * are always represented; this avoids treating an unsigned impact magnitude
 * as a hidden global bend direction.
 */
export function makeCompactTwoContactControls(input: {
  currentImpact: number | undefined;
  observedSpeed: number;
  outgoing: TwoContactOutgoingIntent;
}): TwoContactPhaseControl[] {
  const supportFrames = supportFramesForOutgoing(input.outgoing);
  const turnMagnitude = characteristicTurnDeg(input.currentImpact, input.observedSpeed);
  const phaseLookbacks = [0, 2, 4] as const;
  const controls: TwoContactPhaseControl[] = [];

  for (const sign of [-1, 1] as const) {
    for (const phaseLookbackFrames of phaseLookbacks) {
      controls.push({
        phaseLookbackFrames,
        approachDeltaDeg: sign * clamp(turnMagnitude * 0.35, 4, 18),
        turnDeg: sign * turnMagnitude,
        normalOffsetPx: sign * clamp(input.observedSpeed * 0.15, 1, 4),
        tangentFrames: 1.5,
        preFrames: 4,
        postFrames: supportFrames,
        flipped: sign < 0,
      });
    }
  }
  for (const phaseLookbackFrames of phaseLookbacks) {
    controls.push({
      phaseLookbackFrames,
      approachDeltaDeg: 0,
      turnDeg: 0,
      normalOffsetPx: 0,
      tangentFrames: 1.5,
      preFrames: 4,
      postFrames: supportFrames,
      flipped: false,
    });
  }
  return controls;
}

/**
 * Broad diagnostic oracle. Its only role is to establish whether a compact
 * state-derived stencil is missing a reachable region. It is never a source
 * candidate family and no individual oracle row is selected by this module.
 */
export function makeOracleTwoContactControls(
  count: number,
  outgoing: TwoContactOutgoingIntent,
): TwoContactPhaseControl[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > 16_384) {
    throw new Error(`oracle control count must be an integer in [1, 16384], got ${count}`);
  }
  const maxPostFrames = maximumSupportFramesForOutgoing(outgoing);
  return Array.from({ length: count }, (_, index) => ({
    phaseLookbackFrames: Math.min(MAX_PHASE_LOOKBACK, Math.floor(halton(index + 1, 2) * (MAX_PHASE_LOOKBACK + 1))),
    approachDeltaDeg: lerp(-55, 35, halton(index + 1, 3)),
    turnDeg: lerp(-65, 35, halton(index + 1, 5)),
    normalOffsetPx: lerp(-10, 22, halton(index + 1, 7)),
    tangentFrames: lerp(-2, 2, halton(index + 1, 11)),
    preFrames: lerp(1.5, 8, halton(index + 1, 13)),
    postFrames: lerp(1.5, maxPostFrames, halton(index + 1, 17)),
    flipped: halton(index + 1, 19) >= 0.5,
  }));
}

/**
 * Realize a control in the observed reference frame. Segment count follows
 * angular and chord-length error bounds; it is never an elapsed-time bucket.
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
  const speed = Math.max(1, state.speed);
  const entryAngleDeg = state.velocityAngleDeg + control.approachDeltaDeg;
  const entryAngle = toRadians(entryAngleDeg);
  const tangent = { x: Math.cos(entryAngle), y: Math.sin(entryAngle) };
  const normal = { x: -tangent.y, y: tangent.x };
  const contactPoint = {
    x: state.reference.x + tangent.x * speed * control.tangentFrames + normal.x * control.normalOffsetPx,
    y: state.reference.y + tangent.y * speed * control.tangentFrames + normal.y * control.normalOffsetPx,
  };
  const entryPoint = {
    x: contactPoint.x - tangent.x * speed * control.preFrames,
    y: contactPoint.y - tangent.y * speed * control.preFrames,
  };
  const lines: TrackLine[] = [solidLine(lineIdStart, entryPoint, contactPoint, control.flipped)];
  const postLength = speed * control.postFrames;
  const segmentCount = Math.max(
    1,
    Math.ceil(Math.abs(control.turnDeg) / 5),
    Math.ceil(postLength / Math.max(16, speed * 2)),
  );
  const segmentLength = postLength / segmentCount;
  let point = contactPoint;
  for (let index = 0; index < segmentCount; index++) {
    const progress = segmentCount === 1 ? 1 : index / (segmentCount - 1);
    const angle = toRadians(entryAngleDeg + control.turnDeg * progress);
    const next = {
      x: point.x + Math.cos(angle) * segmentLength,
      y: point.y + Math.sin(angle) * segmentLength,
    };
    lines.push(solidLine(lineIdStart + lines.length, point, next, control.flipped));
    point = next;
  }
  return {
    lines,
    contactPoint,
    entryAngleDeg,
    exitAngleDeg: entryAngleDeg + control.turnDeg,
    segmentCount,
  };
}

export function supportFramesForOutgoing(outgoing: TwoContactOutgoingIntent): number {
  const maximum = maximumSupportFramesForOutgoing(outgoing);
  // An undefined air axis leaves no target residual. The compact local stencil
  // uses a bounded duration-only physical prior instead of silently treating
  // undefined as an authored 0.5 air request.
  const intendedSupport = outgoing.air === undefined
    ? Math.min(6, Math.max(0.25, outgoing.intervalFrames * 0.25))
    : outgoing.intervalFrames - clamp(outgoing.air, 0, 1) * outgoing.intervalFrames;
  return clamp(intendedSupport, 0.25, maximum);
}

export function maximumSupportFramesForOutgoing(outgoing: TwoContactOutgoingIntent): number {
  if (!Number.isSafeInteger(outgoing.intervalFrames) || outgoing.intervalFrames < 1) {
    throw new Error(`outgoing intervalFrames must be a positive integer, got ${outgoing.intervalFrames}`);
  }
  const minimumFlight = Math.min(outgoing.intervalFrames, MIN_LANDING_AIRBORNE_FRAMES);
  return Math.max(0.25, Math.min(MAX_POST_FRAMES, outgoing.intervalFrames - minimumFlight));
}

function characteristicTurnDeg(currentImpact: number | undefined, speed: number): number {
  if (currentImpact === undefined) return 12;
  const redirection = impactToRedirArcPx(clamp(currentImpact, 0, 1));
  const radians = Math.min(
    redirection / Math.max(1, speed),
    Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION),
  );
  return clamp(toDegrees(radians), 8, 52);
}

function assertControl(control: TwoContactPhaseControl): void {
  if (!Number.isSafeInteger(control.phaseLookbackFrames) ||
      control.phaseLookbackFrames < 0 || control.phaseLookbackFrames > MAX_PHASE_LOOKBACK) {
    throw new Error(`phaseLookbackFrames must be an integer in [0, ${MAX_PHASE_LOOKBACK}]`);
  }
  const ranges: Array<[keyof TwoContactPhaseControl, number, number]> = [
    ["approachDeltaDeg", -90, 90],
    ["turnDeg", -90, 90],
    ["normalOffsetPx", -40, 40],
    ["tangentFrames", -4, 4],
    ["preFrames", 0.25, 12],
    ["postFrames", 0.25, MAX_POST_FRAMES],
  ];
  for (const [name, lo, hi] of ranges) {
    const value = control[name];
    if (typeof value !== "number" || !Number.isFinite(value) || value < lo || value > hi) {
      throw new Error(`${name} must be finite and in [${lo}, ${hi}]`);
    }
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

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function lerp(lo: number, hi: number, t: number): number {
  return lo + (hi - lo) * t;
}

function toRadians(value: number): number {
  return value * Math.PI / 180;
}

function toDegrees(value: number): number {
  return value * 180 / Math.PI;
}
