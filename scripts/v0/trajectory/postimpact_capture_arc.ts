/**
 * Target-blind capture geometry for the continuous-support study.
 *
 * This is a deliberately separate realization of the legacy capture primitive.
 * It accepts an immutable impact convention from the sealed fixture boundary,
 * rather than importing broad compiler types or environment-derived constants.
 * Its parity is tested against the legacy kinematic/capture path for the active
 * convention; it is not a second production proposal implementation.
 */
import { PERSISTENCE_FRAMES } from "../../lib/detector.ts";
import { adaptiveCurveSegmentCount } from "./curve_resolution.ts";
import {
  assertImpactConvention,
  postimpactFeltToRawImpactPx,
  type PostimpactImpactConvention,
  type PostimpactTrackLine,
} from "./postimpact_physics.ts";
import type { PlanningState } from "./state.ts";
import type { TargetFrame } from "./target_frame.ts";

export type PostimpactContactKinematicFrame = {
  anchor: TargetFrame;
  com: {
    headingDeg: number;
    speedPxPerFrame: number;
  };
  impact: {
    target: number;
    requestedRawImpactPx: number;
    requestedTurnDeg: number;
    catchableTurnDeg: number;
  } | null;
};

export type PostimpactCaptureArcControl = {
  turnOrientation: -1 | 1;
  targetPhaseOffsetFrames: number;
  entryTurnShare: number;
  approachFrames: number;
  runwayFrames: number;
};

export type PostimpactResolvedCaptureArc = {
  capturePoint: { x: number; y: number };
  approachPoint: { x: number; y: number };
  runwayExitPoint: { x: number; y: number };
  exitPoint: { x: number; y: number };
  entryAngleDeg: number;
  exitAngleDeg: number;
  turnOrientation: -1 | 1;
  impactTurnDeg: number;
  entryTurnDeg: number;
  remainingTurnDeg: number;
  approachPx: number;
  runwayPx: number;
  arcExtentPx: number;
  arcSegmentCount: number;
  responseHorizonFrames: number;
};

export type PostimpactRealizedCaptureArc = PostimpactResolvedCaptureArc & {
  lines: PostimpactTrackLine[];
  lineRoles: { approach: number; runway: number; arc: number[] };
  captureBandLineIds: number[];
  handoff: { point: { x: number; y: number }; tangentDeg: number; source: "capture_arc_geometry" };
};

export type PostimpactCaptureArcAllocation = "distributed" | "balanced" | "entry_loaded" | "entry_only";
export type PostimpactCaptureArcPlacement = "at_target" | "half_frame_forward" | "one_frame_forward";

export type PostimpactCaptureArcDesignEntry = {
  label: string;
  hypothesis: PostimpactCaptureArcAllocation;
  placement: { label: PostimpactCaptureArcPlacement; targetPhaseOffsetFrames: number };
  turnOrientation: -1 | 1;
  turnMagnitudeDeg: number;
  control: PostimpactCaptureArcControl;
};

/**
 * Recreate the legacy anchor/CoM split from only current physical state and
 * the convention sealed at replay start. No authored future axis is accepted.
 */
export function postimpactContactKinematicFrameFromPlanningState(
  state: PlanningState,
  anchor: TargetFrame,
  impact: number | undefined,
  convention: Readonly<PostimpactImpactConvention>,
): PostimpactContactKinematicFrame {
  assertImpactConvention(convention);
  const speed = positive("state.speed", state.speed);
  const headingDeg = finite("state.velocityAngleDeg", state.velocityAngleDeg);
  if (impact === undefined) {
    return { anchor, com: { headingDeg, speedPxPerFrame: speed }, impact: null };
  }
  const target = bounded("impact", impact, 0, 1);
  const requestedRawImpactPx = postimpactFeltToRawImpactPx(target, convention);
  const requestedTurnDeg = degrees(requestedRawImpactPx / speed);
  const catchableTurnDeg = degrees(Math.min(
    requestedRawImpactPx / speed,
    Math.asin(convention.catchableRedirFraction),
  ));
  return {
    anchor,
    com: { headingDeg, speedPxPerFrame: speed },
    impact: { target, requestedRawImpactPx, requestedTurnDeg, catchableTurnDeg },
  };
}

/**
 * Resolve the exact legacy capture geometry under the fixture-bound convention.
 * The response horizon remains the detector/impact maximum; it is never an
 * outgoing-gap property.
 */
export function resolvePostimpactCaptureArc(
  frame: PostimpactContactKinematicFrame,
  control: PostimpactCaptureArcControl,
  convention: Readonly<PostimpactImpactConvention>,
): PostimpactResolvedCaptureArc {
  assertImpactConvention(convention);
  if (frame.impact === null) {
    throw new Error("contact capture arc requires an authored impact target; non-impact contact formulation is separate work");
  }
  const anchorSpeed = positive("frame.anchor.speedPxPerFrame", frame.anchor.speedPxPerFrame);
  const anchorHeading = finite("frame.anchor.headingDeg", frame.anchor.headingDeg);
  const comHeading = finite("frame.com.headingDeg", frame.com.headingDeg);
  const phaseOffset = bounded("targetPhaseOffsetFrames", control.targetPhaseOffsetFrames, 0, 1);
  const entryTurnShare = bounded("entryTurnShare", control.entryTurnShare, 0, 1);
  const turnOrientation = orientation(control.turnOrientation);
  const approachFrames = positive("approachFrames", control.approachFrames);
  const runwayFrames = positive("runwayFrames", control.runwayFrames);
  const responseHorizonFrames = Math.max(PERSISTENCE_FRAMES, convention.impactWindowFrames);
  if (!(runwayFrames < responseHorizonFrames)) {
    throw new Error(`runwayFrames must be below the ${responseHorizonFrames}-frame capture response horizon`);
  }
  const impactTurnDeg = positiveImpactTurn(frame.impact.catchableTurnDeg);
  const entryTurnDeg = impactTurnDeg * entryTurnShare;
  const remainingTurnDeg = turnOrientation * (impactTurnDeg - entryTurnDeg);
  const entryAngleDeg = comHeading + turnOrientation * entryTurnDeg;
  const exitAngleDeg = entryAngleDeg + remainingTurnDeg;
  const anchorTangent = unit(anchorHeading);
  const capturePoint = {
    x: frame.anchor.reference.x + anchorTangent.x * phaseOffset * anchorSpeed,
    y: frame.anchor.reference.y + anchorTangent.y * phaseOffset * anchorSpeed,
  };
  const entryTangent = unit(entryAngleDeg);
  const approachPx = approachFrames * anchorSpeed;
  const runwayPx = runwayFrames * anchorSpeed;
  const arcExtentPx = (responseHorizonFrames - runwayFrames) * anchorSpeed;
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
  let point = { ...runwayExitPoint };
  const arcSegmentPx = arcExtentPx / arcSegmentCount;
  for (let index = 0; index < arcSegmentCount; index++) {
    const fraction = arcSegmentCount === 1 ? 0 : index / (arcSegmentCount - 1);
    const tangent = unit(entryAngleDeg + remainingTurnDeg * fraction);
    point = { x: point.x + tangent.x * arcSegmentPx, y: point.y + tangent.y * arcSegmentPx };
  }
  return {
    capturePoint,
    approachPoint,
    runwayExitPoint,
    exitPoint: point,
    entryAngleDeg,
    exitAngleDeg,
    turnOrientation,
    impactTurnDeg,
    entryTurnDeg,
    remainingTurnDeg,
    approachPx,
    runwayPx,
    arcExtentPx,
    arcSegmentCount,
    responseHorizonFrames,
  };
}

export function realizePostimpactCaptureArc(
  resolved: PostimpactResolvedCaptureArc,
  lineIdStart: number,
): PostimpactRealizedCaptureArc {
  if (!Number.isSafeInteger(lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  assertResolved(resolved);
  const lines: PostimpactTrackLine[] = [];
  lines.push(solidLine(lineIdStart + lines.length, resolved.approachPoint, resolved.capturePoint));
  lines.push(solidLine(lineIdStart + lines.length, resolved.capturePoint, resolved.runwayExitPoint));
  let point = { ...resolved.runwayExitPoint };
  const segmentPx = resolved.arcExtentPx / resolved.arcSegmentCount;
  for (let index = 0; index < resolved.arcSegmentCount; index++) {
    const fraction = resolved.arcSegmentCount === 1 ? 0 : index / (resolved.arcSegmentCount - 1);
    const tangent = unit(resolved.entryAngleDeg + resolved.remainingTurnDeg * fraction);
    const next = { x: point.x + tangent.x * segmentPx, y: point.y + tangent.y * segmentPx };
    lines.push(solidLine(lineIdStart + lines.length, point, next));
    point = next;
  }
  if (distance(point, resolved.exitPoint) > 1e-8) throw new Error("capture arc realization drifted from its resolved exit");
  const approach = lines[0]!;
  const runway = lines[1]!;
  const arc = lines.slice(2).map((line) => line.id);
  return {
    ...resolved,
    lines,
    lineRoles: { approach: approach.id, runway: runway.id, arc },
    captureBandLineIds: lines.map((line) => line.id),
    handoff: {
      point: { ...resolved.exitPoint },
      tangentDeg: resolved.exitAngleDeg,
      source: "capture_arc_geometry",
    },
  };
}

export function makePostimpactCaptureArcScreen(
  frame: PostimpactContactKinematicFrame,
): PostimpactCaptureArcDesignEntry[] {
  return makePostimpactCaptureArcScreenForOrientations(frame, [-1]);
}

export function makeMirroredPostimpactCaptureArcScreen(
  frame: PostimpactContactKinematicFrame,
): PostimpactCaptureArcDesignEntry[] {
  return makePostimpactCaptureArcScreenForOrientations(frame, [-1, 1]);
}

const ALLOCATIONS: ReadonlyArray<{ hypothesis: PostimpactCaptureArcAllocation; entryTurnShare: number }> = [
  { hypothesis: "distributed", entryTurnShare: 0 },
  { hypothesis: "balanced", entryTurnShare: 0.5 },
  { hypothesis: "entry_loaded", entryTurnShare: 0.75 },
  { hypothesis: "entry_only", entryTurnShare: 1 },
];

const PLACEMENTS: ReadonlyArray<{ label: PostimpactCaptureArcPlacement; targetPhaseOffsetFrames: number }> = [
  { label: "at_target", targetPhaseOffsetFrames: 0 },
  { label: "half_frame_forward", targetPhaseOffsetFrames: 0.5 },
  { label: "one_frame_forward", targetPhaseOffsetFrames: 1 },
];

const APPROACH_FRAMES = 2;
const RUNWAY_FRAMES = 1;

function makePostimpactCaptureArcScreenForOrientations(
  frame: PostimpactContactKinematicFrame,
  orientations: readonly (-1 | 1)[],
): PostimpactCaptureArcDesignEntry[] {
  if (frame.impact === null) {
    throw new Error("contact capture-arc screen requires an authored impact target");
  }
  const turnMagnitudeDeg = positiveImpactTurn(frame.impact.catchableTurnDeg);
  const entries = orientations.flatMap((turnOrientation) => ALLOCATIONS.flatMap((allocation) =>
    PLACEMENTS.map((placement) => ({
      label: `${turnOrientation === -1 ? "negative" : "positive"}_${allocation.hypothesis}_${placement.label}`,
      hypothesis: allocation.hypothesis,
      placement,
      turnOrientation,
      turnMagnitudeDeg,
      control: {
        turnOrientation,
        targetPhaseOffsetFrames: placement.targetPhaseOffsetFrames,
        entryTurnShare: allocation.entryTurnShare,
        approachFrames: APPROACH_FRAMES,
        runwayFrames: RUNWAY_FRAMES,
      },
    })),
  ));
  if (new Set(entries.map((entry) => JSON.stringify(entry.control))).size !== entries.length) {
    throw new Error("capture-arc screen must contain unique controls");
  }
  return entries;
}

function assertResolved(value: PostimpactResolvedCaptureArc): void {
  for (const [name, number] of Object.entries({
    captureX: value.capturePoint.x,
    captureY: value.capturePoint.y,
    approachX: value.approachPoint.x,
    approachY: value.approachPoint.y,
    runwayExitX: value.runwayExitPoint.x,
    runwayExitY: value.runwayExitPoint.y,
    exitX: value.exitPoint.x,
    exitY: value.exitPoint.y,
    entryAngleDeg: value.entryAngleDeg,
    exitAngleDeg: value.exitAngleDeg,
    impactTurnDeg: value.impactTurnDeg,
    entryTurnDeg: value.entryTurnDeg,
    remainingTurnDeg: value.remainingTurnDeg,
  })) finite(name, number);
  positive("approachPx", value.approachPx);
  positive("runwayPx", value.runwayPx);
  positive("arcExtentPx", value.arcExtentPx);
  orientation(value.turnOrientation);
  if (!Number.isSafeInteger(value.arcSegmentCount) || value.arcSegmentCount < 1) {
    throw new Error("arcSegmentCount must be a positive safe integer");
  }
}

function solidLine(
  id: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
): PostimpactTrackLine {
  return {
    id,
    type: 0,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    flipped: false,
    leftExtended: false,
    rightExtended: false,
  };
}

function unit(angleDeg: number): { x: number; y: number } {
  const radians = angleDeg * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function degrees(radiansValue: number): number {
  return radiansValue * 180 / Math.PI;
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
}

function positiveImpactTurn(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("frame.impact.catchableTurnDeg must be finite and non-negative");
  }
  if (value === 0) {
    throw new Error(
      "capture arc currently scopes to authored impact > 0; zero-impact contact needs a separately predeclared neutral-incidence study",
    );
  }
  return value;
}

function orientation(value: number): -1 | 1 {
  if (value !== -1 && value !== 1) {
    throw new Error("turnOrientation must be -1 or 1");
  }
  return value;
}

function bounded(name: string, value: number, lower: number, upper: number): number {
  if (!Number.isFinite(value) || value < lower || value > upper) {
    throw new Error(`${name} must be in [${lower}, ${upper}]`);
  }
  return value;
}
