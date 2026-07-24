import { describe, expect, test } from "vitest";
import { LineRiderEngine } from "../scripts/lib/_lr_engine_wasm.ts";
import {
  advanceConstraintBallisticState,
  advanceConstraintBallisticTrajectory,
  constraintBallisticStateFromRider,
  predictConstraintBallisticArrival,
} from "../scripts/v0/core/ballistic_micro_sim.ts";
import { sledPoseDegFromRider } from "../scripts/lib/detector.ts";
import { ELEVATION } from "../scripts/v0/types.ts";

describe("collision-free ballistic rider micro-simulation", () => {
  test("matches the WASM engine from one causal launch-frame read", () => {
    const engine = new LineRiderEngine().setStart(
      { x: 20, y: -30 },
      { x: 0.8, y: -0.4 },
    );
    const launchFrame = 12;
    const targetFrame = 53;
    const state = constraintBallisticStateFromRider(engine.getRider(launchFrame));
    expect(state).not.toBeNull();

    const predicted = predictConstraintBallisticArrival(
      state!,
      targetFrame - launchFrame,
      ELEVATION.GRAVITY_PX_PER_FRAME2,
    );
    const truth = engine.getRider(targetFrame);

    expect(predicted).not.toBeNull();
    expect(predicted!.x).toBeCloseTo(truth.position.x, 10);
    expect(predicted!.y).toBeCloseTo(truth.position.y, 10);
    expect(predicted!.vx).toBeCloseTo(truth.velocity.x, 10);
    expect(predicted!.vy).toBeCloseTo(truth.velocity.y, 10);
  });

  test("re-anchored chained advances equal one combined advance", () => {
    const engine = new LineRiderEngine().setStart(
      { x: -5, y: 7 },
      { x: 1.1, y: 0.2 },
    );
    const state = constraintBallisticStateFromRider(engine.getRider(9))!;
    const combined = advanceConstraintBallisticState(
      state,
      37,
      ELEVATION.GRAVITY_PX_PER_FRAME2,
    )!;
    const first = advanceConstraintBallisticState(
      state,
      19,
      ELEVATION.GRAVITY_PX_PER_FRAME2,
    )!;
    const chained = advanceConstraintBallisticState(
      first.constraintState,
      18,
      ELEVATION.GRAVITY_PX_PER_FRAME2,
    )!;

    for (const key of ["x", "y", "vx", "vy"] as const) {
      expect(chained.arrival[key]).toBeCloseTo(combined.arrival[key], 10);
    }
  });

  test("projects sled pose and pose rate from the same constraint trajectory", () => {
    const engine = new LineRiderEngine().setStart(
      { x: 4, y: -12 },
      { x: 1.2, y: -0.6 },
    );
    const launchFrame = 10;
    const targetFrame = 45;
    const state = constraintBallisticStateFromRider(
      engine.getRider(launchFrame),
    )!;
    let terminal:
      | { sledPoseDeg: number; sledPoseRateDegPerFrame: number }
      | null = null;
    advanceConstraintBallisticTrajectory(
      state,
      targetFrame - launchFrame,
      ELEVATION.GRAVITY_PX_PER_FRAME2,
      (relativeFrame, _arrival, orientation) => {
        if (relativeFrame === targetFrame - launchFrame) {
          terminal = orientation;
        }
      },
    );

    const truthPose = sledPoseDegFromRider(engine.getRider(targetFrame));
    const previousPose = sledPoseDegFromRider(engine.getRider(targetFrame - 1));
    const truthRate = wrappedDegrees(truthPose - previousPose);
    expect(terminal).not.toBeNull();
    expect(wrappedDegrees(terminal!.sledPoseDeg - truthPose)).toBeCloseTo(
      0,
      10,
    );
    expect(terminal!.sledPoseRateDegPerFrame).toBeCloseTo(truthRate, 10);
  });
});

function wrappedDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}
