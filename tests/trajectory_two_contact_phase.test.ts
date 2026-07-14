import { describe, expect, test } from "vitest";
import {
  TWO_CONTACT_PHASE_PROTOCOL,
  makeCompactTwoContactControls,
  makeOracleTwoContactControls,
  realizeTwoContactPhase,
} from "../scripts/v0/trajectory/two_contact_phase.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";

const state: PlanningState = {
  frame: 100,
  position: { x: 20, y: 30 },
  velocity: { x: 10, y: 2 },
  speed: Math.hypot(10, 2),
  velocityAngleDeg: Math.atan2(2, 10) * 180 / Math.PI,
  reference: { x: 24, y: 35 },
  referencePointName: "TAIL",
  referenceVelocity: { x: 7, y: 5 },
  sledPoseDeg: null,
  sledPoseRateDegPerFrame: null,
  points: {
    TAIL: {
      position: { x: 24, y: 35 },
      velocity: { x: 7, y: 5 },
      relativePosition: { x: 4, y: 5 },
      relativeVelocity: { x: -3, y: 3 },
    },
    NOSE: {
      position: { x: 36, y: 35 },
      velocity: { x: 7, y: 5 },
      relativePosition: { x: 16, y: 5 },
      relativeVelocity: { x: -3, y: 3 },
    },
  },
  phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: 4 },
};

describe("two-contact phase controls", () => {
  test("uses a fixed 24-control chiral/side compact stencil with no outgoing input", () => {
    const controls = makeCompactTwoContactControls({ currentImpact: 0.7, observedComSpeed: state.speed });

    expect(controls).toHaveLength(24);
    expect(new Set(controls.map((control) => JSON.stringify(control))).size).toBe(24);
    expect(new Set(controls.map((control) => control.phaseHorizonFrames))).toEqual(
      new Set([TWO_CONTACT_PHASE_PROTOCOL.fixedResponseHorizonFrames]),
    );
    expect(TWO_CONTACT_PHASE_PROTOCOL.fixedResponseHorizonFrames +
      TWO_CONTACT_PHASE_PROTOCOL.maxOwnedEventOffsetFrames).toBe(7);
    expect(controls.filter((control) => control.tailAction === "neutral")).toHaveLength(12);
    expect(controls.filter((control) => control.tailAction === "directed")).toHaveLength(12);
    expect(controls.filter((control) => control.collisionSide === "toward_motion")).toHaveLength(12);
    expect(controls.filter((control) => control.collisionSide === "away_from_motion")).toHaveLength(12);
    expect(controls.map((control) => control.phaseLookbackFrames).sort()).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0,
      2, 2, 2, 2, 2, 2, 2, 2,
      4, 4, 4, 4, 4, 4, 4, 4,
    ]);
  });

  test("stratifies the broad oracle over an independent phase ladder, chirality, tail, and side", () => {
    const left = makeOracleTwoContactControls(288);
    const right = makeOracleTwoContactControls(288);

    expect(left).toEqual(right);
    expect(left).toHaveLength(288);
    expect(new Set(left.map((control) =>
      `${control.phaseLookbackFrames}:${control.chirality}:${control.tailAction}:${control.collisionSide}`,
    ))).toHaveLength(72);
    expect(new Set(left.map((control) => control.phaseLookbackFrames))).toEqual(
      new Set(TWO_CONTACT_PHASE_PROTOCOL.oraclePhaseLookbackFrames),
    );
    expect(left.every((control) => control.phaseHorizonFrames === TWO_CONTACT_PHASE_PROTOCOL.fixedResponseHorizonFrames)).toBe(true);
    expect(left.every((control) => control.approachFrames >= 0.25 && control.approachFrames <= 8)).toBe(true);
    expect(left.every((control) => control.preloadSledSpans >= 0.15 && control.preloadSledSpans <= 1.5)).toBe(true);
    expect(() => makeOracleTwoContactControls(120)).toThrow(/complete 72-row strata/);
  });

  test("uses the named sled point for placement and the CoM for response heading", () => {
    const control = makeCompactTwoContactControls({ currentImpact: 0.8, observedComSpeed: state.speed })
      .find((candidate) => candidate.phaseLookbackFrames === 0 && candidate.chirality === 1 &&
        candidate.tailAction === "directed" && candidate.collisionSide === "toward_motion")!;
    const realized = realizeTwoContactPhase(state, control, 42);

    expect(realized.anchor.point).toBe("TAIL");
    expect(realized.anchor.headingSource).toBe("reference_point_velocity");
    expect(realized.anchor.headingDeg).toBeCloseTo(Math.atan2(5, 7) * 180 / Math.PI);
    expect(realized.com.headingDeg).toBeCloseTo(state.velocityAngleDeg);
    expect(realized.entryAngleDeg).toBeCloseTo(state.velocityAngleDeg + control.approachDeltaDeg);
    expect(realized.anchor.sledSpanPx).toBeCloseTo(12);
  });

  test("realizes contiguous IDs and assigns only the capture pair to current ownership", () => {
    const control = makeCompactTwoContactControls({ currentImpact: 0.7, observedComSpeed: state.speed })[0]!;
    const realized = realizeTwoContactPhase(state, control, 42);

    expect(realized.lines.map((line) => line.id)).toEqual(
      Array.from({ length: realized.lines.length }, (_, index) => 42 + index),
    );
    expect(realized.lineRoles.captureApproach).toBe(42);
    expect(realized.lineRoles.captureSurface).toBe(43);
    expect(realized.lineRoles.phaseTail).toEqual(realized.lines.slice(2).map((line) => line.id));
    expect(realized.lines.flatMap((line) => [line.x1, line.y1, line.x2, line.y2]).every(Number.isFinite)).toBe(true);
  });

  test("derives the physical collision side from motion and crosses the opposite side without moving geometry", () => {
    const toward = makeCompactTwoContactControls({ currentImpact: 0.7, observedComSpeed: state.speed })
      .find((candidate) => candidate.phaseLookbackFrames === 0 && candidate.chirality === 1 &&
        candidate.tailAction === "directed" && candidate.collisionSide === "toward_motion")!;
    const away = { ...toward, collisionSide: "away_from_motion" as const };
    const motionFacing = realizeTwoContactPhase(state, toward, 42);
    const motionAway = realizeTwoContactPhase(state, away, 42);

    expect(motionFacing.lines.map((line) => [line.x1, line.y1, line.x2, line.y2])).toEqual(
      motionAway.lines.map((line) => [line.x1, line.y1, line.x2, line.y2]),
    );
    expect(motionFacing.lines.map((line) => line.flipped)).toEqual(
      motionAway.lines.map((line) => !line.flipped),
    );
    expect(motionFacing.orientation.captureNormalVelocityProjection).toBeGreaterThan(0);
    expect(motionFacing.orientation.captureNormalPositionProjection).toBeGreaterThan(0);
    expect(motionAway.orientation.captureNormalVelocityProjection).toBeLessThan(0);
    expect(motionAway.orientation.captureNormalPositionProjection).toBeLessThan(0);
  });

  test("keeps every motion-facing compact capture on the engine-valid side", () => {
    for (const control of makeCompactTwoContactControls({ currentImpact: 0.7, observedComSpeed: state.speed })) {
      if (control.collisionSide !== "toward_motion") continue;
      const realized = realizeTwoContactPhase(state, control, 42);
      expect(realized.orientation.captureNormalVelocityProjection).toBeGreaterThan(0);
      expect(realized.orientation.captureNormalPositionProjection).toBeGreaterThan(0);
    }
  });
});
