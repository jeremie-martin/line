/**
 * Staged transition solver assay: fresh construction leaf.
 *
 * Implements docs/staged-transition-solver-assay.md. This module is pure
 * geometry/arithmetic: it realizes (a) the side-aware 48-control capture
 * stencil (the existing 24 compact geometric controls crossed with both
 * one-way collision sides), (b) the duration-aware support/release curve fed
 * only the sealed capture handoff, exact outgoing sample accounting, and
 * authored air, and (c) the static positive rail side-control. Exact replay
 * in the study runner is the sole authority on closure and preservation.
 *
 * It deliberately does NOT import the historical capture realizer or closure
 * (contact_capture_arc.ts): that realizer hard-codes `flipped: false` and its
 * protection contract covers only the incoming interval's start. Only the
 * declared 24-control grid (contact_capture_arc_design.ts, a pure control
 * enumeration) and pure curve subdivision arithmetic are reused.
 */
import { PERSISTENCE_FRAMES } from "../../lib/detector.ts";
import { IMPACT_WINDOW, type TrackLine } from "../types.ts";
import { makeMirroredContactCaptureArcScreen } from "./contact_capture_arc_design.ts";
import type { ContactKinematicFrame } from "./contact_kinematic_frame.ts";
import { adaptiveCurveSegmentCount } from "./curve_resolution.ts";

export type Vec2 = { x: number; y: number };

/** Frames of exact replay after the selected owned event that the capture
 *  owns before the sealed handoff. H = selectedEvent.frame + this offset:
 *  one frame past the scored impact-window closure read, and past detector
 *  persistence (PERSISTENCE_FRAMES < IMPACT_WINDOW + 1). */
export const STAGED_RESPONSE_HORIZON_OFFSET_FRAMES = IMPACT_WINDOW + 1;

/** Geometric extent of the capture band in reference-speed frames: the
 *  response window the capture must physically own. */
export const STAGED_CAPTURE_BAND_FRAMES = Math.max(PERSISTENCE_FRAMES, IMPACT_WINDOW);

export const STAGED_CAPTURE_ROLES = ["capture_approach", "capture_runway", "capture_arc"] as const;

/** One of the 48 declared capture controls: a compact geometric control from
 *  the existing mirrored 24-control screen crossed with an explicit one-way
 *  collision side. Ordering is fixed: design-screen order major, side minor
 *  (`flipped: false` before `flipped: true`). */
export type StagedCaptureControl = {
  index: number;
  label: string;
  /** Physical one-way collision side stamped on every capture line. */
  flipped: boolean;
  turnOrientation: -1 | 1;
  targetPhaseOffsetFrames: number;
  entryTurnShare: number;
  approachFrames: number;
  runwayFrames: number;
  turnMagnitudeDeg: number;
};

export function makeStagedCaptureStencil(frame: ContactKinematicFrame): StagedCaptureControl[] {
  const geometric = makeMirroredContactCaptureArcScreen(frame);
  const controls: StagedCaptureControl[] = [];
  for (const entry of geometric) {
    for (const flipped of [false, true]) {
      controls.push({
        index: controls.length,
        label: `${entry.label}_${flipped ? "sideB" : "sideA"}`,
        flipped,
        turnOrientation: entry.control.turnOrientation,
        targetPhaseOffsetFrames: entry.control.targetPhaseOffsetFrames,
        entryTurnShare: entry.control.entryTurnShare,
        approachFrames: entry.control.approachFrames,
        runwayFrames: entry.control.runwayFrames,
        turnMagnitudeDeg: entry.turnMagnitudeDeg,
      });
    }
  }
  if (controls.length !== geometric.length * 2) throw new Error("staged capture stencil must cross every geometric control with both sides");
  return controls;
}

export type StagedCaptureRealization = {
  lines: TrackLine[];
  /** Line id -> declared role (approach/runway/arc). */
  roles: Map<number, string>;
  capturePoint: Vec2;
  approachPoint: Vec2;
  runwayExitPoint: Vec2;
  exitPoint: Vec2;
  entryAngleDeg: number;
  exitAngleDeg: number;
  impactTurnDeg: number;
  entryTurnDeg: number;
  remainingTurnDeg: number;
  arcSegmentCount: number;
  flipped: boolean;
};

/**
 * Realize one capture control. Same compact physical form as the historical
 * calibration screen — C1 approach along the entry incidence into the
 * predicted sled point (shifted by the continuous phase of one reference
 * frame), collinear runway, then a bounded-angle polyline spreading the
 * remaining catchable turn across the response band — but every line carries
 * the control's explicit collision side, and no protection or closure claim
 * is made here: the runner's exact guards decide everything.
 */
export function realizeStagedCapture(
  frame: ContactKinematicFrame,
  control: StagedCaptureControl,
  lineIdStart: number,
): StagedCaptureRealization {
  if (frame.impact === null) throw new Error("staged capture requires an authored impact target");
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  const anchorSpeed = positive("anchor.speedPxPerFrame", frame.anchor.speedPxPerFrame);
  const anchorHeading = finite("anchor.headingDeg", frame.anchor.headingDeg);
  const comHeading = finite("com.headingDeg", frame.com.headingDeg);
  const impactTurnDeg = positive("impact.catchableTurnDeg", frame.impact.catchableTurnDeg);
  if (!(control.runwayFrames < STAGED_CAPTURE_BAND_FRAMES)) {
    throw new Error("runwayFrames must be below the capture band horizon");
  }
  const entryTurnDeg = impactTurnDeg * bounded("entryTurnShare", control.entryTurnShare, 0, 1);
  const remainingTurnDeg = control.turnOrientation * (impactTurnDeg - entryTurnDeg);
  const entryAngleDeg = comHeading + control.turnOrientation * entryTurnDeg;
  const anchorTangent = unit(anchorHeading);
  const phase = bounded("targetPhaseOffsetFrames", control.targetPhaseOffsetFrames, 0, 1);
  const capturePoint = {
    x: frame.anchor.reference.x + anchorTangent.x * phase * anchorSpeed,
    y: frame.anchor.reference.y + anchorTangent.y * phase * anchorSpeed,
  };
  const entryTangent = unit(entryAngleDeg);
  const approachPx = positive("approachFrames", control.approachFrames) * anchorSpeed;
  const runwayPx = positive("runwayFrames", control.runwayFrames) * anchorSpeed;
  const arcExtentPx = (STAGED_CAPTURE_BAND_FRAMES - control.runwayFrames) * anchorSpeed;
  const approachPoint = {
    x: capturePoint.x - entryTangent.x * approachPx,
    y: capturePoint.y - entryTangent.y * approachPx,
  };
  const runwayExitPoint = {
    x: capturePoint.x + entryTangent.x * runwayPx,
    y: capturePoint.y + entryTangent.y * runwayPx,
  };
  const resolvedCount = adaptiveCurveSegmentCount(arcExtentPx, remainingTurnDeg, 1);
  const arcSegmentCount = Math.abs(remainingTurnDeg) <= 1e-12 ? 1 : Math.max(2, resolvedCount);

  const lines: TrackLine[] = [];
  const roles = new Map<number, string>();
  const push = (start: Vec2, end: Vec2, role: string): void => {
    const id = lineIdStart + lines.length;
    lines.push(sidedLine(id, start, end, control.flipped));
    roles.set(id, role);
  };
  push(approachPoint, capturePoint, "capture_approach");
  push(capturePoint, runwayExitPoint, "capture_runway");
  let point = { ...runwayExitPoint };
  const segmentPx = arcExtentPx / arcSegmentCount;
  let exitAngleDeg = entryAngleDeg;
  for (let index = 0; index < arcSegmentCount; index++) {
    // The first arc segment shares the entry tangent, preserving C1 geometry
    // across approach, capture boundary, and runway.
    const fraction = arcSegmentCount === 1 ? 0 : index / (arcSegmentCount - 1);
    exitAngleDeg = entryAngleDeg + remainingTurnDeg * fraction;
    const tangent = unit(exitAngleDeg);
    const next = { x: point.x + tangent.x * segmentPx, y: point.y + tangent.y * segmentPx };
    push(point, next, "capture_arc");
    point = next;
  }
  return {
    lines,
    roles,
    capturePoint,
    approachPoint,
    runwayExitPoint,
    exitPoint: point,
    entryAngleDeg,
    exitAngleDeg,
    impactTurnDeg,
    entryTurnDeg,
    remainingTurnDeg,
    arcSegmentCount,
    flipped: control.flipped,
  };
}

/** The single sealed physical handoff a selected capture exposes at H. */
export type SealedCaptureHandoff = {
  point: Vec2;
  tangentDeg: number;
  flipped: boolean;
  speedPxPerFrame: number;
};

/** Fixed deterministic support menu: scales of the exact air-accounted
 *  extent, neutral curvature first. Small by design; hundreds of controls
 *  are a falsifier, not an implementation plan. */
export type StagedSupportControl = {
  id: "support-neutral" | "support-short" | "support-long" | "support-turn-positive" | "support-turn-negative";
  extentScale: number;
  totalTurnDeg: number;
};

export const STAGED_SUPPORT_CONTROLS: readonly StagedSupportControl[] = Object.freeze([
  Object.freeze({ id: "support-neutral", extentScale: 1, totalTurnDeg: 0 }),
  Object.freeze({ id: "support-short", extentScale: 0.5, totalTurnDeg: 0 }),
  Object.freeze({ id: "support-long", extentScale: 1.5, totalTurnDeg: 0 }),
  Object.freeze({ id: "support-turn-positive", extentScale: 1, totalTurnDeg: 8 }),
  Object.freeze({ id: "support-turn-negative", extentScale: 1, totalTurnDeg: -8 }),
] as const);

export const STAGED_SUPPORT_PROTOCOL = Object.freeze({
  maxChordErrorPx: 2,
  maxTurnDegPerSegment: 5,
  minExtentPx: 2,
  /** Engagement tolerance (same order as the validated exact-support-slice
   *  preload): the support curve is offset this far along the handoff's
   *  active normal (the side the rider presses) so leading body points
   *  cannot graze it before the handoff frame. The curve remains continuous
   *  with the sealed handoff within this sub-pixel construction tolerance;
   *  it is a fixed constant, not a target-dependent input. */
  engagementPreloadPx: 0.6,
  /** DECLARED DEVIATION from the assay doc's literal "begins at that
   *  handoff": the support's material extent begins this many reference-speed
   *  frames downstream ALONG the handoff tangent ray. Measured necessity: on
   *  grounded-at-H states the rider's own body footprint (feet/tail drag at
   *  surface level, hands lead the reference by ~1.2 frames) collides with a
   *  lead-0 curve AT the handoff frame itself, which violates the doc's
   *  load-bearing seal ("adding support must preserve ... exact trace through
   *  H") on every such state. Two reference frames is the smallest
   *  state-normalized lead that clears the leading body points at H; the
   *  curve still lies on the handoff's own tangent ray (C1 with the sealed
   *  handoff), and no case, duration, or target quantity is read. */
  engagementLeadFrames: 2,
} as const);

/**
 * Exact post-response air accounting in reference-speed frames. Inputs are
 * exact measured sample counts plus the authored air; the caller supplies
 * them from the capture-only replay. The next contact, next impact, speed,
 * and every other outgoing axis are withheld by construction.
 */
export function supportGroundedBudgetFrames(input: {
  outgoingMeasurementSamples: number;
  groundedSamplesBeforeSupport: number;
  authoredAir: number;
}): number {
  const samples = nonNegativeInt("outgoingMeasurementSamples", input.outgoingMeasurementSamples);
  const groundedBefore = nonNegativeInt("groundedSamplesBeforeSupport", input.groundedSamplesBeforeSupport);
  const air = bounded("authoredAir", input.authoredAir, 0, 1);
  const groundedTargetSamples = (1 - air) * samples;
  return Math.max(0, groundedTargetSamples - groundedBefore);
}

export type StagedSupportRealization = {
  control: StagedSupportControl;
  lines: TrackLine[];
  lineIds: number[];
  groundedBudgetFrames: number;
  extentPx: number;
  segmentCount: number;
  startPoint: Vec2;
  endPoint: Vec2;
  entryTangentDeg: number;
  exitTangentDeg: number;
  flipped: boolean;
};

/**
 * Realize one support/release curve. It begins continuously at the sealed
 * handoff (same point, same tangent, same physical side), spans the scaled
 * air-accounted extent with subdivision from chord/turn error, and simply
 * ends: release is the finite end of the curve, with no endpoint rail aimed
 * at the next landing.
 */
export function realizeStagedSupport(
  handoff: SealedCaptureHandoff,
  groundedBudgetFrames: number,
  control: StagedSupportControl,
  lineIdStart: number,
): StagedSupportRealization {
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  const declared = STAGED_SUPPORT_CONTROLS.find((candidate) => candidate.id === control.id);
  if (declared === undefined || !Object.is(declared.extentScale, control.extentScale) ||
      !Object.is(declared.totalTurnDeg, control.totalTurnDeg)) {
    throw new Error("support control must exactly match the declared menu");
  }
  const speed = positive("handoff.speedPxPerFrame", handoff.speedPxPerFrame);
  const budget = nonNegative("groundedBudgetFrames", groundedBudgetFrames);
  const extentPx = budget * speed * control.extentScale;
  if (!(extentPx >= STAGED_SUPPORT_PROTOCOL.minExtentPx)) {
    throw new Error(`support extent ${extentPx.toFixed(3)}px is below the ${STAGED_SUPPORT_PROTOCOL.minExtentPx}px construction floor`);
  }
  const segmentCount = Math.max(1, adaptiveCurveSegmentCount(extentPx, control.totalTurnDeg, 1, {
    maxChordErrorPx: STAGED_SUPPORT_PROTOCOL.maxChordErrorPx,
    maxTurnDegPerSegment: STAGED_SUPPORT_PROTOCOL.maxTurnDegPerSegment,
  }));
  const segmentPx = extentPx / segmentCount;
  const lines: TrackLine[] = [];
  const entryUnit = unit(handoff.tangentDeg);
  const activeNormal = handoff.flipped
    ? { x: entryUnit.y, y: -entryUnit.x }
    : { x: -entryUnit.y, y: entryUnit.x };
  const leadPx = STAGED_SUPPORT_PROTOCOL.engagementLeadFrames * speed;
  let point = {
    x: handoff.point.x + entryUnit.x * leadPx + activeNormal.x * STAGED_SUPPORT_PROTOCOL.engagementPreloadPx,
    y: handoff.point.y + entryUnit.y * leadPx + activeNormal.y * STAGED_SUPPORT_PROTOCOL.engagementPreloadPx,
  };
  const startPoint = { ...point };
  let tangentDeg = handoff.tangentDeg;
  for (let index = 0; index < segmentCount; index++) {
    const fraction = segmentCount === 1 ? 0 : index / (segmentCount - 1);
    tangentDeg = handoff.tangentDeg + control.totalTurnDeg * fraction;
    const tangent = unit(tangentDeg);
    const next = { x: point.x + tangent.x * segmentPx, y: point.y + tangent.y * segmentPx };
    lines.push(sidedLine(lineIdStart + lines.length, point, next, handoff.flipped));
    point = next;
  }
  return {
    control: { ...control },
    lines,
    lineIds: lines.map((line) => line.id),
    groundedBudgetFrames: budget,
    extentPx,
    segmentCount,
    startPoint,
    endPoint: point,
    entryTangentDeg: handoff.tangentDeg,
    exitTangentDeg: tangentDeg,
    flipped: handoff.flipped,
  };
}

// ── Positive static rail side-control ────────────────────────────────────────

export const POSITIVE_RAIL_PROTOCOL = Object.freeze({
  /** Wall center placed this many reference-speed frames ahead of the anchor. */
  leadFrames: 2,
  /** Wall half-span, in reference-speed frames, each side of the path. */
  halfSpanFrames: 2,
  minMotionPx: 1e-3,
  observationTailFrames: 8,
} as const);

export type PositiveRailResolution = {
  /** Declared motion-facing side: the flipped value whose active normal has a
   *  positive projection on the incoming motion (the engine catches a point
   *  whose motion crosses the line along its active normal). */
  motionFacingFlipped: boolean;
  motionProjectionPx: number;
  wallTangentDeg: number;
};

/**
 * Resolve the motion-facing collision side of a wall perpendicular to the
 * incoming motion. `flipped = dot(leftNormal(wallTangent), motion) < 0`, the
 * same active-normal convention the exact-support-slice assay validated; for
 * a perpendicular wall the projection is the full motion magnitude, so the
 * resolution is robust for every body point (all approach from one side).
 */
export function resolvePositiveRailSide(
  wallTangentDeg: number,
  motion: Vec2,
): PositiveRailResolution {
  const tangent = unit(finite("wallTangentDeg", wallTangentDeg));
  const leftNormal = { x: -tangent.y, y: tangent.x };
  const motionProjection = leftNormal.x * motion.x + leftNormal.y * motion.y;
  if (!Number.isFinite(motionProjection) || Math.abs(motionProjection) < POSITIVE_RAIL_PROTOCOL.minMotionPx) {
    throw new Error("incoming motion cannot choose a stable wall side");
  }
  return {
    motionFacingFlipped: motionProjection < 0,
    motionProjectionPx: Math.abs(motionProjection),
    wallTangentDeg,
  };
}

/**
 * Realize the static positive rail for one arm: a straight wall PERPENDICULAR
 * to the anchor heading, centered on the predicted path a fixed lead ahead.
 * Both arms share exactly the same segment geometry and differ only in the
 * one-way `flipped` side.
 */
export function realizePositiveRail(
  anchor: { point: Vec2; headingDeg: number; speedPxPerFrame: number },
  flipped: boolean,
  lineId: number,
): TrackLine {
  const speed = positive("anchor.speedPxPerFrame", anchor.speedPxPerFrame);
  const heading = unit(finite("anchor.headingDeg", anchor.headingDeg));
  const wallTangent = { x: -heading.y, y: heading.x };
  const center = {
    x: anchor.point.x + heading.x * POSITIVE_RAIL_PROTOCOL.leadFrames * speed,
    y: anchor.point.y + heading.y * POSITIVE_RAIL_PROTOCOL.leadFrames * speed,
  };
  const halfSpanPx = POSITIVE_RAIL_PROTOCOL.halfSpanFrames * speed;
  const start = { x: center.x - wallTangent.x * halfSpanPx, y: center.y - wallTangent.y * halfSpanPx };
  const end = { x: center.x + wallTangent.x * halfSpanPx, y: center.y + wallTangent.y * halfSpanPx };
  return sidedLine(lineId, start, end, flipped);
}

/** Wall tangent for the positive rail: perpendicular to the anchor heading. */
export function positiveRailWallTangentDeg(headingDeg: number): number {
  return finite("headingDeg", headingDeg) + 90;
}

// ── Local numeric/geometry helpers ───────────────────────────────────────────

function sidedLine(id: number, start: Vec2, end: Vec2, flipped: boolean): TrackLine {
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

function unit(angleDeg: number): Vec2 {
  const radians = angleDeg * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
}

function nonNegative(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be non-negative and finite`);
  return value;
}

function nonNegativeInt(name: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative safe integer`);
  return value;
}

function bounded(name: string, value: number, lower: number, upper: number): number {
  if (!Number.isFinite(value) || value < lower || value > upper) {
    throw new Error(`${name} must be in [${lower}, ${upper}]`);
  }
  return value;
}
