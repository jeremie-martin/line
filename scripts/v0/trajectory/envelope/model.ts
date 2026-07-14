/**
 * Pure planning model for an event-aligned contact transition and outgoing
 * support envelope. This deliberately imports authored units and the explicit
 * outgoing interval contract, but not arc placement, support geometry, or
 * optimizer policy.
 */
import { ELEVATION, authoredSpeedToPx } from "../../types.ts";
import type { TargetFrame } from "../target_frame.ts";
import {
  envelopeAirIntent,
  type EnvelopeAirIntent,
  type OutgoingInterval,
} from "../outgoing_interval.ts";

/** Target-frame geometry is constructed in `trajectory/target_frame.ts`. */
export type IncomingTargetFrame = TargetFrame;

/** Collision-local degrees of freedom, independent of outgoing support. */
export type ContactTransitionControl = {
  /** Contact coordinate in the incoming target tangent-normal frame. */
  targetTangentOffsetPx: number;
  targetNormalOffsetPx: number;
  /** Incoming pre-contact line angle relative to target heading. */
  entryAngleRelativeDeg: number;
  /** Drawn incoming reach; not a predicted contact duration. */
  preReachPx: number;
  /** Explicit support tangent change at the contact boundary. */
  contactTurnDeg: number;
};

/** Outgoing-time degrees of freedom, all continuous across interval length. */
export type SupportEnvelopeControl = {
  /** Multiplier around the neutral/authored support-time prior. */
  supportScale: number;
  /** Desired release speed divided by incoming speed; exact physics measures it. */
  exitSpeedRatio: number;
  /** Residual around the kinematic grade needed for the desired speed change. */
  gradeBiasDeg: number;
  /** Log2 power shaping when curvature is spent along the support path. */
  curvatureSkew: number;
};

export type TransitionEnvelopeControl = ContactTransitionControl & SupportEnvelopeControl;

export type SupportEnvelopeIntent = {
  outgoing: OutgoingInterval;
  air: EnvelopeAirIntent;
  /** Source of the support prior; a neutral prior is not an authored target. */
  supportPrior: "authored_air" | "neutral";
  neutralSupportIntervals: number;
  /** Informational duration of an airborne arrival run, if that mode is chosen. */
  minimumAirborneIntervals: number;
  /** Full supported interval is valid for dense-continuity regimes. */
  maximumSupportIntervals: number;
  /**
   * The authored speed axis is an interval-average scorer target. It is kept
   * here for observation and future full-interval modelling, never treated as
   * an exit-speed command for the short support realizer.
   */
  authoredMeanSpeedPxPerFrame: number | null;
};

export type ResolvedSupportEnvelope = {
  /** Elapsed outgoing interval used to resolve the occupancy partition. */
  intervalFrames: number;
  supportIntervals: number;
  plannedAirborneIntervals: number;
  plannedExtentPx: number;
  desiredExitSpeedPxPerFrame: number;
  kinematicGradeDeg: number;
  meanGradeDeg: number;
  curvaturePower: number;
};

export type MeanSpeedExitPrior = {
  targetMeanSpeedPxPerFrame: number;
  impliedExitSpeedPxPerFrame: number;
  exitSpeedRatio: number;
};

/**
 * Bind support planning to the interval after the current contact. Undefined
 * axes remain undefined: the neutral support duration is a labelled geometric
 * prior, never a residual against an invented target.
 */
export function deriveSupportEnvelopeIntent(
  outgoing: OutgoingInterval,
  incomingSpeedPxPerFrame: number,
  minimumAirborneSamples: number,
): SupportEnvelopeIntent {
  const air = envelopeAirIntent(outgoing, minimumAirborneSamples);
  positive("incomingSpeedPxPerFrame", incomingSpeedPxPerFrame);
  const minimumAirborneIntervals = Math.max(0, minimumAirborneSamples - 1);
  const targetSpeed = outgoing.targets.speed;
  return {
    outgoing,
    air,
    supportPrior: air.nominalSupportIntervals === null ? "neutral" : "authored_air",
    neutralSupportIntervals: outgoing.intervalFrames * 0.5,
    minimumAirborneIntervals,
    maximumSupportIntervals: outgoing.intervalFrames,
    authoredMeanSpeedPxPerFrame: targetSpeed === undefined
      ? null
      : authoredSpeedToPx(targetSpeed),
  };
}

/**
 * Resolve a continuous envelope control into geometric planning quantities.
 * This is a proposal prior only. In particular, planned support duration and
 * exit speed are never substituted for exact engine observations.
 */
export function resolveSupportEnvelope(
  intent: SupportEnvelopeIntent,
  incomingSpeedPxPerFrame: number,
  control: SupportEnvelopeControl,
): ResolvedSupportEnvelope {
  const speed = positive("incomingSpeedPxPerFrame", incomingSpeedPxPerFrame);
  const supportPrior = intent.air.nominalSupportIntervals ?? intent.neutralSupportIntervals;
  const supportIntervals = clamp(
    supportPrior * positive("supportScale", control.supportScale),
    0,
    intent.maximumSupportIntervals,
  );
  const desiredExitSpeedPxPerFrame = speed * positive("exitSpeedRatio", control.exitSpeedRatio);
  const meanSpeed = 0.5 * (speed + desiredExitSpeedPxPerFrame);
  const acceleration = supportIntervals <= 1e-9
    ? 0
    : (desiredExitSpeedPxPerFrame - speed) / supportIntervals;
  const kinematicGradeDeg = radiansToDeg(Math.asin(clamp(
    acceleration / ELEVATION.GRAVITY_PX_PER_FRAME2,
    -0.95,
    0.95,
  )));
  const meanGradeDeg = kinematicGradeDeg + finite("gradeBiasDeg", control.gradeBiasDeg);
  const curvaturePower = positive(
    "curvaturePower",
    Math.pow(2, finite("curvatureSkew", control.curvatureSkew)),
  );
  return {
    intervalFrames: intent.outgoing.intervalFrames,
    supportIntervals,
    plannedAirborneIntervals: Math.max(0, intent.outgoing.intervalFrames - supportIntervals),
    plannedExtentPx: meanSpeed * supportIntervals,
    desiredExitSpeedPxPerFrame,
    kinematicGradeDeg,
    meanGradeDeg,
    curvaturePower,
  };
}

export function makeTransitionEnvelopeCenter(
  frame: IncomingTargetFrame,
  intent: SupportEnvelopeIntent,
): TransitionEnvelopeControl {
  const speed = positive("frame.speedPxPerFrame", frame.speedPxPerFrame);
  return {
    // These are broad physical priors, not a replay of legacy attempt rolls.
    targetTangentOffsetPx: -speed,
    targetNormalOffsetPx: 0,
    // Neutral contact geometry follows the measured incoming tangent. The
    // study menu perturbs this explicitly; no unexplained default tilt is
    // baked into the formulation.
    entryAngleRelativeDeg: 0,
    preReachPx: clamp(speed * 2, 12, 42),
    contactTurnDeg: 0,
    supportScale: 1,
    // An outgoing speed target is an interval average, not a release-state
    // target. Keep the center dynamically neutral until a full support plus
    // flight model can derive this quantity honestly.
    exitSpeedRatio: 1,
    gradeBiasDeg: 0,
    curvatureSkew: 0,
  };
}

/**
 * Constant-acceleration proposal prior for an authored *interval-average*
 * speed. It is deliberately returned separately from the neutral center so a
 * study must name when it chooses this approximation. A non-positive implied
 * exit speed is reported as unavailable rather than silently clamped.
 */
export function deriveMeanSpeedExitPrior(
  intent: SupportEnvelopeIntent,
  incomingSpeedPxPerFrame: number,
): MeanSpeedExitPrior | null {
  const entering = positive("incomingSpeedPxPerFrame", incomingSpeedPxPerFrame);
  if (intent.authoredMeanSpeedPxPerFrame === null) return null;
  const impliedExitSpeedPxPerFrame = 2 * intent.authoredMeanSpeedPxPerFrame - entering;
  if (!(impliedExitSpeedPxPerFrame > 0) || !Number.isFinite(impliedExitSpeedPxPerFrame)) return null;
  return {
    targetMeanSpeedPxPerFrame: intent.authoredMeanSpeedPxPerFrame,
    impliedExitSpeedPxPerFrame,
    exitSpeedRatio: impliedExitSpeedPxPerFrame / entering,
  };
}

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function radiansToDeg(value: number): number {
  return value * 180 / Math.PI;
}
