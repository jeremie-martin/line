import { describe, expect, test } from "vitest";
import {
  deriveTrajectoryIntent,
  makeLowDiscrepancyControls,
  makePrototypeProbeControls,
  type ContactPrimitiveControl,
} from "../scripts/v0/trajectory/primitive.ts";
import { realizeContactPrimitive } from "../scripts/v0/trajectory/realizer.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";
import type { Gap } from "../scripts/v0/types.ts";

const state: PlanningState = {
  frame: 96,
  position: { x: 100, y: 200 },
  velocity: { x: 10, y: 0 },
  speed: 10,
  velocityAngleDeg: 0,
  reference: { x: 100, y: 208 },
  referencePointName: "NOSE",
  referenceVelocity: { x: 10, y: 0 },
  sledPoseDeg: 0,
  sledPoseRateDegPerFrame: 0,
  points: {},
  phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: 6 },
};

function gap(index: number, startFrame: number, endFrame: number, targets: Gap["targets"]): Gap {
  return { index, startFrame, endFrame, endsWithContact: true, targets };
}

describe("trajectory contact primitive", () => {
  test("derives support duration in time units across a multi-second interval", () => {
    const intent = deriveTrajectoryIntent(
      state,
      gap(0, 0, 100, {}),
      gap(1, 100, 300, { air: 0.05, speed: 0.5 }),
    );
    expect(intent.nextSpanFrames).toBe(200);
    expect(intent.authoredAirTarget).toBe(0.05);
    expect(intent.authoredFlightFrames).toBe(10);
    expect(intent.supportPriorFrames).toBe(190);
    expect(intent.center.supportFrames).toBe(190);
  });

  test("reserves the detector flight floor on a short interval", () => {
    const intent = deriveTrajectoryIntent(
      state,
      gap(0, 0, 100, {}),
      gap(1, 100, 108, { air: 0.1 }),
    );
    expect(intent.authoredFlightFrames).toBe(6);
    expect(intent.supportPriorFrames).toBe(2);
    expect(intent.bounds.supportFrames[1]).toBe(2);
  });

  test("realizes a continuous polyline with time-scaled support", () => {
    const control: ContactPrimitiveControl = {
      entryLeadFrames: 2,
      normalOffsetPx: 0,
      entryAngleRelativeDeg: 0,
      totalTurnDeg: -18,
      turnFrontload: -0.5,
      supportFrames: 200,
    };
    const realized = realizeContactPrimitive(state, control, 100);
    expect(realized.lines).toHaveLength(161);
    expect(realized.lines[0].id).toBe(100);
    expect(realized.lines.at(-1)?.id).toBe(260);
    for (let i = 1; i < realized.lines.length; i++) {
      expect(realized.lines[i].x1).toBeCloseTo(realized.lines[i - 1].x2, 10);
      expect(realized.lines[i].y1).toBeCloseTo(realized.lines[i - 1].y2, 10);
    }
    const pre = realized.lines[0];
    const firstSupport = realized.lines[1];
    expect(Math.atan2(pre.y2 - pre.y1, pre.x2 - pre.x1)).toBeCloseTo(
      Math.atan2(firstSupport.y2 - firstSupport.y1, firstSupport.x2 - firstSupport.x1),
      10,
    );
    expect(realized.exitAngleDeg).toBeCloseTo(-18);
  });

  test("keeps absent axes out of the prototype intent and samples deterministically", () => {
    const intent = deriveTrajectoryIntent(
      state,
      gap(0, 0, 100, {}),
      gap(1, 100, 160, { speed: 0.5 }),
    );
    expect(intent.authoredAirTarget).toBeNull();
    expect(intent.authoredFlightFrames).toBeNull();
    expect(intent.supportPriorFrames).toBe(30);
    expect(makePrototypeProbeControls(intent.center, intent.bounds)).toHaveLength(7);
    expect(makeLowDiscrepancyControls(intent.center, intent.bounds, 4)).toEqual(
      makeLowDiscrepancyControls(intent.center, intent.bounds, 4),
    );
  });

  test("records an authored impact magnitude without inventing its turn direction", () => {
    const intent = deriveTrajectoryIntent(
      state,
      gap(0, 0, 100, { impact: 0.7 }),
      gap(1, 100, 180, { air: 0.2 }),
    );
    expect(intent.impactTurnDeg).toBeGreaterThan(0);
    expect(intent.center.totalTurnDeg).toBe(0);
  });
});
