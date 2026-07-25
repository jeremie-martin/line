import { describe, expect, test } from "vitest";
import {
  airFractionWithTerminalOccupancy,
  cloneBallisticLaunchObservation,
  projectBallisticGap,
  type BallisticLaunchObservation,
} from "../scripts/v0/core/ballistic_projection.ts";
import {
  BALLISTIC_POINT_IDS,
  type ConstraintBallisticState,
} from "../scripts/v0/core/ballistic_micro_sim.ts";
import { ELEVATION } from "../scripts/v0/types.ts";

function launch(): BallisticLaunchObservation {
  const base = {
    PEG: [0, 0],
    TAIL: [0, 5],
    NOSE: [15, 5],
    STRING: [17.5, 0],
    BUTT: [5, 0],
    SHOULDER: [5, -5.5],
    RHAND: [11.5, -5],
    LHAND: [11.5, -5],
    LFOOT: [10, 5],
    RFOOT: [10, 5],
  } as const;
  const points = Object.fromEntries(BALLISTIC_POINT_IDS.map((id) => {
    const [baseX, baseY] = base[id];
    const x = baseX + 7 / 6;
    const y = baseY + 251 / 12;
    return [id, {
      x,
      y,
      prevX: x - 3,
      prevY: y - 4,
      vx: 3,
      vy: 4,
    }];
  })) as ConstraintBallisticState["points"];
  return {
    gapStartFrame: 0,
    anchorFrame: 2,
    state: {
      x: 10,
      y: 20,
      vx: 3,
      vy: 4,
      speed: 5,
      comAngleDeg: Math.atan2(4, 3) * 180 / Math.PI,
      sledPoseDeg: null,
      sledPoseRateDegPerFrame: null,
      constraintState: {
        frameOffset: 0,
        points,
        riderMounted: true,
        sledIntact: true,
      },
    },
    prefix: {
      startFrame: 0,
      prefixEndFrame: 2,
      airFrames: 2,
      speedSumPx: 12,
      speedFrames: 3,
      dy: 5,
      v0SpeedPx: 3,
      displacementYByFrame: [0, 2, 5],
    },
    groundedFrames: 1,
    airborne: true,
  };
}

describe("canonical ballistic gap projection", () => {
  test("composes the exact prefix with suffix frames on the scorer interval", () => {
    const projected = projectBallisticGap(launch(), 4, {});
    expect(projected).not.toBeNull();
    const gravity = ELEVATION.GRAVITY_PX_PER_FRAME2;
    const speed3 = Math.hypot(3, 4 + gravity);
    const speed4 = Math.hypot(3, 4 + 2 * gravity);

    expect(projected!.frameCount).toBe(5);
    expect(projected!.meanSpeedPx).toBeCloseTo(
      (12 + speed3 + speed4) / 5,
      12,
    );
    // Prefix air frames 1..2 plus suffix frame 3. Authored contact frame 4
    // is grounded conditional on a successful catch.
    expect(
      airFractionWithTerminalOccupancy(projected!, false),
    ).toBeCloseTo(3 / 5, 12);
    expect(projected!.airFramesWithCollisionFreeSuffix).toBe(4);
  });

  test("keeps pre-contact position and target-frame incoming velocity explicit", () => {
    const projected = projectBallisticGap(launch(), 4, {})!;
    const gravity = ELEVATION.GRAVITY_PX_PER_FRAME2;

    expect(projected.boundary.preContactFrame).toBe(3);
    expect(projected.boundary.preContact.x).toBeCloseTo(13, 12);
    expect(projected.boundary.preContact.vy).toBeCloseTo(4 + gravity, 12);
    expect(projected.boundary.incomingVelocityFrame).toBe(4);
    expect(projected.boundary.incoming.vy).toBeCloseTo(4 + 2 * gravity, 12);
    expect(projected.boundary.projectedContactFrame).toBe(4);
    expect(projected.boundary.projectedContact.x).toBeCloseTo(16, 12);
  });

  test("does not invent a grounded terminal frame at an open tail boundary", () => {
    const projected = projectBallisticGap(launch(), 4, {});
    expect(
      airFractionWithTerminalOccupancy(projected!, true),
    ).toBeCloseTo(4 / 5, 12);
  });

  test("computes optional span aggregates from the same one-pass trajectory", () => {
    const projected = projectBallisticGap(launch(), 4, {
      includeElevation: true,
      includeAmplitude: true,
    });
    expect(projected?.elevation).not.toBeNull();
    expect(projected?.amplitude).not.toBeNull();
    expect(projected!.amplitude!).toBeGreaterThanOrEqual(0);
    expect(projected!.amplitude!).toBeLessThanOrEqual(1);
  });

  test("fails closed when the request has no predicted suffix", () => {
    expect(
      projectBallisticGap(launch(), 2, {}),
    ).toBeNull();
  });

  test("fails closed instead of silently using a weaker point-mass model", () => {
    const source = launch();
    delete source.state.constraintState;
    expect(projectBallisticGap(source, 4, {})).toBeNull();
  });

  test("deep-clones mutable prefix summaries", () => {
    const source = launch();
    const cloned = cloneBallisticLaunchObservation(source);
    expect(cloned).toEqual(source);
    expect(cloned.prefix).not.toBe(source.prefix);
    expect(cloned.prefix.displacementYByFrame).not.toBe(
      source.prefix.displacementYByFrame,
    );
  });

  /*
   * These pin the closed-form path's FAIL-CLOSED behaviour, which the exact
   * kernel got for free by returning null.
   *
   * Note what is deliberately NOT claimed here: `launch()` builds a rigid,
   * non-articulating body, where the ten-point system centre and the six-point
   * body centre move identically. That fixture therefore cannot tell the two
   * projection paths apart - it is a shared-behaviour fixture, not a
   * discriminating one. The place the two are actually compared is the frozen
   * 202,752-row predictor corpus (`npm run benchmark:ballistic`), against
   * engine truth on real articulating bodies.
   */
  test("closed-form projection refuses a non-anchored constraint packet", () => {
    const observation = launch();
    const state = observation.state.constraintState;
    if (state === undefined) throw new Error("fixture lost its constraint state");
    // Production always anchors at the launch frame; the closed-form loop
    // measures from the anchor, so a non-zero offset must be refused rather
    // than silently disagreeing with the kernel.
    const offset: BallisticLaunchObservation = {
      ...observation,
      state: { ...observation.state, constraintState: { ...state, frameOffset: 3 } },
    };
    expect(projectBallisticGap(offset, offset.anchorFrame + 8, {})).toBeNull();
  });

  test("closed-form projection refuses a non-finite launch state", () => {
    const observation = launch();
    const state = observation.state.constraintState;
    if (state === undefined) throw new Error("fixture lost its constraint state");
    const broken: BallisticLaunchObservation = {
      ...observation,
      state: {
        ...observation.state,
        constraintState: {
          ...state,
          points: {
            ...state.points,
            NOSE: { ...state.points.NOSE, vx: Number.NaN },
          },
        },
      },
    };
    // The kernel failed closed by returning null. The closed form has no
    // failure of its own, so an unusable launch must be rejected here rather
    // than reaching the readiness extractor, which throws mid-compile.
    expect(projectBallisticGap(broken, broken.anchorFrame + 8, {})).toBeNull();
  });
});
