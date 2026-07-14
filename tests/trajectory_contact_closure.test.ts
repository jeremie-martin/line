import { describe, expect, test } from "vitest";
import {
  realizeContactClosure,
  resolveContactClosure,
} from "../scripts/v0/trajectory/contact_closure.ts";
import type { TargetFrame } from "../scripts/v0/trajectory/target_frame.ts";

const frame: TargetFrame = {
  reference: { x: 100, y: 200 },
  headingDeg: 0,
  speedPxPerFrame: 10,
  sledSpanPx: 20,
  anchorPoint: "NOSE",
  headingSource: "reference_point_velocity",
};

describe("local contact closure primitive", () => {
  test("uses only target-frame state and makes the contact junction explicit", () => {
    const resolved = resolveContactClosure(frame, {
      targetTangentOffsetFrames: 0.5,
      targetNormalOffsetSledSpans: -0.5,
      entryAngleRelativeDeg: 10,
      preReachFrames: 2,
      collisionTurnDeg: -15,
      localContinuationFrames: 3,
    });
    expect(resolved.contactPoint).toEqual({ x: 105, y: 190 });
    expect(resolved.preReachPx).toBe(20);
    expect(resolved.localContinuationPx).toBe(30);
    expect(resolved.entryAngleDeg).toBe(10);
    expect(resolved.postContactAngleDeg).toBe(-5);

    const realized = realizeContactClosure(resolved, 40);
    expect(realized.lines).toHaveLength(2);
    expect(realized.contactClosureLineIds).toEqual([40, 41]);
    expect(realized.lineRoles).toEqual({ ingress: 40, guard: 41 });
    expect(realized.handoff).toMatchObject({ tangentDeg: -5, source: "closure_geometry" });
    expect(realized.lines[0]).toMatchObject({ id: 40, x2: 105, y2: 190 });
    expect(realized.lines[1]).toMatchObject({ id: 41, x1: 105, y1: 190 });
  });

  test("rejects a degenerate local continuation rather than silently relying on later support", () => {
    expect(() => resolveContactClosure(frame, {
      targetTangentOffsetFrames: 0,
      targetNormalOffsetSledSpans: 0,
      entryAngleRelativeDeg: 0,
      preReachFrames: 2,
      collisionTurnDeg: 0,
      localContinuationFrames: 0,
    })).toThrow(/localContinuationFrames/);
  });
});
