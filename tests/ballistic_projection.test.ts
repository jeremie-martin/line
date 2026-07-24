import { describe, expect, test } from "vitest";
import {
  cloneBallisticLaunchObservation,
  projectBallisticGap,
  type BallisticLaunchObservation,
} from "../scripts/v0/core/ballistic_projection.ts";
import { ELEVATION } from "../scripts/v0/types.ts";

function launch(): BallisticLaunchObservation {
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
    sampleCount: 1,
    groundedFrames: 1,
    airborne: true,
  };
}

describe("canonical ballistic gap projection", () => {
  test("composes the exact prefix with suffix frames on the scorer interval", () => {
    const projected = projectBallisticGap(launch(), 4, {
      terminalContact: "grounded",
    });
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
    expect(projected!.airFraction).toBeCloseTo(3 / 5, 12);
  });

  test("keeps pre-contact position and target-frame incoming velocity explicit", () => {
    const projected = projectBallisticGap(launch(), 4, {
      terminalContact: "grounded",
    })!;
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
    const projected = projectBallisticGap(launch(), 4, {
      terminalContact: "none",
    });
    expect(projected?.airFraction).toBeCloseTo(4 / 5, 12);
  });

  test("computes optional span aggregates from the same one-pass trajectory", () => {
    const projected = projectBallisticGap(launch(), 4, {
      terminalContact: "grounded",
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
      projectBallisticGap(launch(), 2, {
        terminalContact: "grounded",
      }),
    ).toBeNull();
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
});
