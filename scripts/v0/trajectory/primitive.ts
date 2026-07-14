/**
 * Time-normalized contact-transition primitives for observation-only studies.
 *
 * The controls are physical quantities in a rider-relative Frenet frame. This
 * module contains no sampler rolls, case labels, or compiler policy.
 */
import { MIN_LANDING_AIRBORNE_FRAMES } from "../../lib/detector.ts";
import {
  impactToRedirArcPx,
  IMPACT,
  type Gap,
} from "../types.ts";
import type { PlanningState } from "./state.ts";

export type ContactPrimitiveControl = {
  /** Contact anchor distance along the observed incoming tangent, in frames. */
  entryLeadFrames: number;
  /** Contact anchor displacement along the incoming normal, in pixels. */
  normalOffsetPx: number;
  /** Entry tangent residual from the observed velocity direction, in degrees. */
  entryAngleRelativeDeg: number;
  /** Total support-tangent rotation from entry to release, in degrees. */
  totalTurnDeg: number;
  /** Negative front-loads the tangent turn; positive back-loads it. */
  turnFrontload: number;
  /** Supported duration represented by the post-contact primitive, in frames. */
  supportFrames: number;
};

export type PrimitiveBounds = {
  entryLeadFrames: readonly [number, number];
  normalOffsetPx: readonly [number, number];
  entryAngleRelativeDeg: readonly [number, number];
  totalTurnDeg: readonly [number, number];
  turnFrontload: readonly [number, number];
  supportFrames: readonly [number, number];
};

export type TrajectoryIntent = {
  nextSpanFrames: number;
  /** Null means the outgoing air axis was not authored. */
  authoredAirTarget: number | null;
  /** Null means support length is a feasibility prior, not an air target. */
  authoredFlightFrames: number | null;
  /** Geometry prior used only to center observation samples. */
  supportPriorFrames: number;
  impactTurnDeg: number;
  center: ContactPrimitiveControl;
  bounds: PrimitiveBounds;
};

/**
 * Derive a continuous current-contact intent from physical state and the next
 * authored interval. Ballistic values seed proposals only; exact simulation is
 * deliberately the final judge because the engine's contact dynamics are not a
 * ballistic model.
 */
export function deriveTrajectoryIntent(
  phaseState: PlanningState,
  currentGap: Gap,
  nextGap: Gap | null,
  contactAnchorState: PlanningState = phaseState,
): TrajectoryIntent {
  const span = nextGap === null
    ? Math.max(MIN_LANDING_AIRBORNE_FRAMES, currentGap.endFrame - currentGap.startFrame)
    : Math.max(1, nextGap.endFrame - currentGap.endFrame);
  const authoredAirTarget = nextGap?.targets.air ?? null;
  const minimumFlight = Math.min(span, MIN_LANDING_AIRBORNE_FRAMES);
  const authoredFlightFrames = authoredAirTarget === null
    ? null
    : clamp(authoredAirTarget * span, minimumFlight, span);
  const maxSupportFrames = Math.max(0.25, span - minimumFlight);
  const supportPriorFrames = authoredFlightFrames === null
    ? Math.min(maxSupportFrames, Math.max(0.25, span * 0.5))
    : Math.max(0.25, span - authoredFlightFrames);
  const impactTurnDeg = currentGap.targets.impact === undefined
    ? 0
    : radiansToDeg(Math.min(
      impactToRedirArcPx(currentGap.targets.impact) / Math.max(1, contactAnchorState.speed),
      Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION),
    ));
  // Impact gives a required turn magnitude, not a preferred turn direction.
  // This retired prototype records that constraint but does not invent a sign.
  const totalTurnDeg = 0;
  const center: ContactPrimitiveControl = {
    entryLeadFrames: clamp(
      1.75 + 0.08 * (
        phaseState.phase.airborneAgeFrames - phaseState.phase.groundedAgeFrames
      ),
      0.75,
      3.5,
    ),
    normalOffsetPx: -0.5,
    entryAngleRelativeDeg: 0,
    totalTurnDeg,
    turnFrontload: 0,
    supportFrames: supportPriorFrames,
  };
  return {
    nextSpanFrames: span,
    authoredAirTarget,
    authoredFlightFrames,
    supportPriorFrames,
    impactTurnDeg,
    center,
    bounds: {
      entryLeadFrames: [0.5, 4],
      normalOffsetPx: [-6, 6],
      entryAngleRelativeDeg: [-20, 20],
      totalTurnDeg: [-60, 60],
      turnFrontload: [-1.5, 1.5],
      supportFrames: [0.25, maxSupportFrames],
    },
  };
}

const CONTROL_SCALES = {
  entryLeadFrames: 0.55,
  normalOffsetPx: 2.25,
  entryAngleRelativeDeg: 5,
  totalTurnDeg: 10,
  turnFrontload: 0.65,
  supportFrames: 1,
} as const;

const CONTROL_KEYS = [
  "entryLeadFrames",
  "normalOffsetPx",
  "entryAngleRelativeDeg",
  "totalTurnDeg",
  "turnFrontload",
  "supportFrames",
] as const satisfies readonly (keyof ContactPrimitiveControl)[];

/**
 * Deterministic broad samples for the retired first primitive. They are not a
 * finite-difference design and must not be used to fit a response model.
 */
const PROTOTYPE_DIRECTIONS: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1, 1],
  [1, -1, 1, -1, 1, -1],
  [1, 1, -1, -1, 1, 1],
  [1, -1, -1, 1, 1, -1],
  [1, 1, 1, -1, -1, -1],
  [1, -1, 1, 1, -1, 1],
];

export function makePrototypeProbeControls(
  center: ContactPrimitiveControl,
  bounds: PrimitiveBounds,
): ContactPrimitiveControl[] {
  return [
    clampControl(center, bounds),
    ...PROTOTYPE_DIRECTIONS.map((direction) => controlAtUnitDelta(center, bounds, direction)),
  ];
}

/** Deterministic low-discrepancy controls used only as an equal-count control. */
export function makeLowDiscrepancyControls(
  center: ContactPrimitiveControl,
  bounds: PrimitiveBounds,
  count: number,
): ContactPrimitiveControl[] {
  const controls: ContactPrimitiveControl[] = [];
  for (let index = 0; index < Math.max(0, count); index++) {
    const unit = CONTROL_KEYS.map((_, dimension) => 2 * halton(index + 1, primeAt(dimension)) - 1);
    controls.push(controlAtUnitDelta(center, bounds, unit));
  }
  return controls;
}

export function clampControl(
  control: ContactPrimitiveControl,
  bounds: PrimitiveBounds,
): ContactPrimitiveControl {
  const out = { ...control };
  for (const key of CONTROL_KEYS) {
    const [lo, hi] = bounds[key];
    out[key] = clamp(out[key], lo, hi);
  }
  return out;
}

function controlAtUnitDelta(
  center: ContactPrimitiveControl,
  bounds: PrimitiveBounds,
  unit: readonly number[],
): ContactPrimitiveControl {
  const out = { ...center };
  for (const [index, key] of CONTROL_KEYS.entries()) {
    const supportScale = key === "supportFrames"
      ? Math.max(1, center.supportFrames * 0.2)
      : CONTROL_SCALES[key];
    out[key] += (unit[index] ?? 0) * supportScale;
  }
  return clampControl(out, bounds);
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

function primeAt(index: number): number {
  return [2, 3, 5, 7, 11, 13][index] ?? 17;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function radiansToDeg(value: number): number {
  return value * 180 / Math.PI;
}
