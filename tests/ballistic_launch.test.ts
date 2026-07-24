import { describe, expect, test } from "vitest";
import { captureBallisticLaunchObservation } from "../scripts/v0/core/ballistic_launch.ts";
import {
  BALLISTIC_POINT_IDS,
} from "../scripts/v0/core/ballistic_micro_sim.ts";
import type { Detection } from "../scripts/lib/detector.ts";

const FRAMES = 24;

/** Detection whose rider is grounded through `groundedThrough`, then airborne,
 *  moving at a constant (3, 4) with a matching position ramp. */
function detection(groundedThrough: number, breakFrames: number[] = []): Detection {
  const airborne: boolean[] = [];
  const velocity: { x: number; y: number }[] = [];
  const speed: number[] = [];
  const position: { x: number; y: number }[] = [];
  for (let frame = 0; frame < FRAMES; frame++) {
    const air = frame > groundedThrough && !breakFrames.includes(frame);
    airborne.push(air);
    velocity.push({ x: 3, y: 4 });
    speed.push(5);
    position.push({ x: 3 * frame, y: 4 * frame });
  }
  return {
    measurements: {
      position,
      velocity,
      speed,
      airborne,
      sledContacts: airborne.map((air) => (air ? [] : ["PEG"])),
      contactLineIds: airborne.map(() => []),
    },
    events: [],
    terminus: { frame: FRAMES - 1, reason: "endOfSpec" },
    params: {},
    summary: {},
  } as unknown as Detection;
}

/** Engine stub: one readable rider per frame, counting the reads. */
function engineStub(): { engine: unknown; reads: number[] } {
  const reads: number[] = [];
  const points = Object.fromEntries(BALLISTIC_POINT_IDS.map((id, index) => [id, {
    x: index,
    y: index,
    prevX: index - 3,
    prevY: index - 4,
    vx: 3,
    vy: 4,
  }]));
  const engine = {
    getRider(frame: number) {
      reads.push(frame);
      return {
        position: { x: 3 * frame, y: 4 * frame },
        velocity: { x: 3, y: 4 },
        ballisticState: () => ({ points, riderMounted: true, sledIntact: true }),
      };
    },
    getLastFrameIndex: () => FRAMES - 1,
  };
  return { engine, reads };
}

describe("canonical launch acquisition", () => {
  test("anchors exactly at the supplied geometric exit, with one rider read", () => {
    const { engine, reads } = engineStub();
    const launch = captureBallisticLaunchObservation(engine, detection(5), {
      gapStartFrame: 4,
      anchorFrame: 6,
      targetFrameExclusive: 20,
      groundedFrames: 0,
    });
    expect(launch).not.toBeNull();
    // The anchor is the exit verbatim — no forward scan, no dependence on how
    // far the caller simulated.
    expect(launch!.anchorFrame).toBe(6);
    expect(launch!.gapStartFrame).toBe(4);
    expect(launch!.prefix.startFrame).toBe(4);
    expect(launch!.prefix.prefixEndFrame).toBe(6);
    expect(reads).toEqual([6]);
  });

  test("acquires the same launch regardless of how much was simulated", () => {
    const anchors = new Set<number>();
    for (const target of [8, 12, 20, 24]) {
      const { engine } = engineStub();
      const launch = captureBallisticLaunchObservation(engine, detection(5), {
        gapStartFrame: 4,
        anchorFrame: 6,
        targetFrameExclusive: target,
        groundedFrames: 0,
      });
      anchors.add(launch!.anchorFrame);
      expect(launch!.state.speed).toBe(5);
    }
    expect([...anchors]).toEqual([6]);
  });

  test("refuses an acausal anchor at or past the target contact", () => {
    const { engine, reads } = engineStub();
    expect(
      captureBallisticLaunchObservation(engine, detection(5), {
        gapStartFrame: 4,
        anchorFrame: 12,
        targetFrameExclusive: 12,
        groundedFrames: 0,
      }),
    ).toBeNull();
    expect(reads).toEqual([]);
  });

  test("refuses a grounded anchor", () => {
    const { engine } = engineStub();
    expect(
      captureBallisticLaunchObservation(engine, detection(5), {
        gapStartFrame: 4,
        anchorFrame: 5,
        targetFrameExclusive: 20,
        groundedFrames: 0,
      }),
    ).toBeNull();
  });

  test("refuses an anchor before the scorer interval it completes", () => {
    const { engine } = engineStub();
    expect(
      captureBallisticLaunchObservation(engine, detection(2), {
        gapStartFrame: 6,
        anchorFrame: 4,
        targetFrameExclusive: 20,
        groundedFrames: 0,
      }),
    ).toBeNull();
  });
});
