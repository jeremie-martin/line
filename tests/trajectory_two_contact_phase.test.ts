import { describe, expect, test } from "vitest";
import {
  makeCompactTwoContactControls,
  makeOracleTwoContactControls,
  realizeTwoContactPhase,
  supportFramesForOutgoing,
} from "../scripts/v0/trajectory/two_contact_phase.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";

const state: PlanningState = {
  frame: 100,
  position: { x: 20, y: 30 },
  velocity: { x: 10, y: 2 },
  speed: Math.hypot(10, 2),
  velocityAngleDeg: Math.atan2(2, 10) * 180 / Math.PI,
  reference: { x: 24, y: 35 },
  referencePointName: "rider",
  referenceVelocity: { x: 10, y: 2 },
  sledPoseDeg: null,
  sledPoseRateDegPerFrame: null,
  points: {},
  phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: 4 },
};

describe("two-contact phase controls", () => {
  test("uses a fixed nine-control chiral compact stencil", () => {
    const controls = makeCompactTwoContactControls({
      currentImpact: 0.7,
      observedSpeed: state.speed,
      outgoing: { intervalFrames: 12, air: 0.2, speed: 0.8 },
    });

    expect(controls).toHaveLength(9);
    expect(new Set(controls.map((control) => JSON.stringify(control))).size).toBe(9);
    expect(controls.filter((control) => control.flipped)).toHaveLength(3);
    expect(controls.filter((control) => !control.flipped && control.turnDeg === 0)).toHaveLength(3);
    expect(controls.map((control) => control.phaseLookbackFrames).sort()).toEqual([
      0, 0, 0, 2, 2, 2, 4, 4, 4,
    ]);
  });

  test("keeps an undefined air axis separate from an authored air request", () => {
    const undefinedAir = supportFramesForOutgoing({ intervalFrames: 20 });
    const explicitHalfAir = supportFramesForOutgoing({ intervalFrames: 20, air: 0.5 });
    const lowAir = supportFramesForOutgoing({ intervalFrames: 20, air: 0.1 });

    expect(undefinedAir).not.toBe(explicitHalfAir);
    expect(undefinedAir).toBeLessThan(explicitHalfAir);
    expect(lowAir).toBeGreaterThan(undefinedAir);
  });

  test("keeps the broad oracle deterministic and bounded", () => {
    const left = makeOracleTwoContactControls(32, { intervalFrames: 9, air: 0.15 });
    const right = makeOracleTwoContactControls(32, { intervalFrames: 9, air: 0.15 });

    expect(left).toEqual(right);
    expect(left).toHaveLength(32);
    expect(left.every((control) => control.phaseLookbackFrames >= 0 && control.phaseLookbackFrames <= 4)).toBe(true);
    expect(left.every((control) => control.postFrames <= 9)).toBe(true);
  });

  test("realizes contiguous IDs with resolution set by geometry", () => {
    const control = {
      phaseLookbackFrames: 2,
      approachDeltaDeg: 12,
      turnDeg: 35,
      normalOffsetPx: 2,
      tangentFrames: 1.5,
      preFrames: 4,
      postFrames: 12,
      flipped: true,
    };
    const realized = realizeTwoContactPhase(state, control, 42);

    expect(realized.lines.map((line) => line.id)).toEqual(
      Array.from({ length: realized.lines.length }, (_, index) => 42 + index),
    );
    expect(realized.lines.every((line) => line.flipped)).toBe(true);
    expect(realized.segmentCount).toBeGreaterThan(1);
    expect(realized.lines.flatMap((line) => [line.x1, line.y1, line.x2, line.y2]).every(Number.isFinite)).toBe(true);
  });
});
