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
  test("uses a fixed twelve-control chiral compact stencil with no outgoing input", () => {
    const controls = makeCompactTwoContactControls({ currentImpact: 0.7, observedComSpeed: state.speed });

    expect(controls).toHaveLength(12);
    expect(new Set(controls.map((control) => JSON.stringify(control))).size).toBe(12);
    expect(new Set(controls.map((control) => control.phaseHorizonFrames))).toEqual(
      new Set([TWO_CONTACT_PHASE_PROTOCOL.fixedResponseHorizonFrames]),
    );
    expect(controls.filter((control) => control.tailAction === "neutral")).toHaveLength(6);
    expect(controls.filter((control) => control.tailAction === "directed")).toHaveLength(6);
    expect(controls.map((control) => control.phaseLookbackFrames).sort()).toEqual([
      0, 0, 0, 0, 2, 2, 2, 2, 4, 4, 4, 4,
    ]);
  });

  test("stratifies the broad oracle over every phase, chirality, and tail arm", () => {
    const left = makeOracleTwoContactControls(120);
    const right = makeOracleTwoContactControls(120);

    expect(left).toEqual(right);
    expect(left).toHaveLength(120);
    expect(new Set(left.map((control) => `${control.phaseLookbackFrames}:${control.chirality}:${control.tailAction}`))).toHaveLength(12);
    expect(left.every((control) => control.phaseHorizonFrames === TWO_CONTACT_PHASE_PROTOCOL.fixedResponseHorizonFrames)).toBe(true);
    expect(left.every((control) => control.approachFrames >= 0.25 && control.approachFrames <= 8)).toBe(true);
    expect(left.every((control) => Math.abs(control.normalOffsetSledSpans) <= 1.5)).toBe(true);
  });

  test("uses the named sled point for placement and the CoM for response heading", () => {
    const control = makeCompactTwoContactControls({ currentImpact: 0.8, observedComSpeed: state.speed })
      .find((candidate) => candidate.phaseLookbackFrames === 0 && candidate.chirality === 1 && candidate.tailAction === "directed")!;
    const realized = realizeTwoContactPhase(state, control, 42);

    expect(realized.anchor.point).toBe("TAIL");
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
});
