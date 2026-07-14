import { describe, expect, test } from "vitest";
import {
  realizeCollisionStripTransition,
  resolveCollisionStrip,
  type CollisionStripControl,
} from "../scripts/v0/trajectory/collision_strip.ts";
import {
  deriveSupportEnvelopeIntent,
  resolveSupportEnvelope,
  type IncomingTargetFrame,
} from "../scripts/v0/trajectory/envelope/model.ts";
import { outgoingIntervalFromGap } from "../scripts/v0/trajectory/outgoing_interval.ts";

const frame: IncomingTargetFrame = {
  reference: { x: 100, y: 200 },
  headingDeg: 0,
  speedPxPerFrame: 10,
  sledSpanPx: 18,
  anchorPoint: "NOSE",
  headingSource: "reference_point_velocity",
};

const control: CollisionStripControl = {
  targetTangentOffsetFrames: -1,
  targetNormalOffsetSledSpans: 0.25,
  entryAngleRelativeDeg: 12,
  preReachFrames: 2,
  collisionTurnDeg: -12,
  stripTurnDeg: 18,
  stripSupportFrames: 2,
  stripCurvatureSkew: 0,
};

function envelope(air: number) {
  const outgoing = outgoingIntervalFromGap({
    index: 3,
    startFrame: 100,
    endFrame: 200,
    endsWithContact: true,
    targets: { air },
  });
  return resolveSupportEnvelope(
    deriveSupportEnvelopeIntent(outgoing, frame.speedPxPerFrame, 6),
    frame.speedPxPerFrame,
    { supportScale: 1, exitSpeedRatio: 1, gradeBiasDeg: 0, curvatureSkew: 0 },
  );
}

function angle(line: { x1: number; y1: number; x2: number; y2: number }): number {
  return Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180 / Math.PI;
}

describe("collision-strip transition geometry", () => {
  test("keeps target-frame contact placement independent of collision orientation", () => {
    const left = resolveCollisionStrip(frame, envelope(0.1), control);
    const right = resolveCollisionStrip(frame, envelope(0.1), {
      ...control,
      entryAngleRelativeDeg: -31,
      collisionTurnDeg: 27,
      stripTurnDeg: -42,
    });
    expect(right.contactPoint.x).toBeCloseTo(left.contactPoint.x, 12);
    expect(right.contactPoint.y).toBeCloseTo(left.contactPoint.y, 12);
  });

  test("allocates local-strip and support extent from one outgoing support budget", () => {
    const support = envelope(0.1);
    const resolved = resolveCollisionStrip(frame, support, control);
    expect(resolved.stripSupportFrames + resolved.remainingSupportFrames).toBeCloseTo(
      support.supportIntervals,
      12,
    );
    expect(resolved.stripExtentPx + resolved.remainingSupportExtentPx).toBeCloseTo(
      support.plannedExtentPx,
      12,
    );
  });

  test("makes the contact kink explicit and hands the strip tangent to support", () => {
    const support = envelope(0.1);
    const resolved = resolveCollisionStrip(frame, support, control);
    const realized = realizeCollisionStripTransition(resolved, support, 10);
    expect(realized.lines[0]!.x2).toBeCloseTo(realized.contactPoint.x, 12);
    expect(realized.lines[0]!.y2).toBeCloseTo(realized.contactPoint.y, 12);
    expect(realized.stripSegmentCount).toBeGreaterThan(0);
    const firstStrip = realized.lines[1]!;
    expect(angle(firstStrip)).toBeCloseTo(realized.postEntryAngleDeg, 10);
    expect(angle(realized.lines[0]!)).toBeCloseTo(realized.entryAngleDeg, 10);
    expect(angle(firstStrip)).not.toBeCloseTo(angle(realized.lines[0]!), 1);
    const firstSupport = realized.lines[1 + realized.stripSegmentCount]!;
    expect(firstSupport.x1).toBeCloseTo(realized.stripExitPoint.x, 12);
    expect(firstSupport.y1).toBeCloseTo(realized.stripExitPoint.y, 12);
    expect(angle(firstSupport)).toBeCloseTo(realized.stripExitAngleDeg, 10);
  });

  test("allows an all-air interval without a zero-length local or support line", () => {
    const support = envelope(1);
    const resolved = resolveCollisionStrip(frame, support, { ...control, stripSupportFrames: 8 });
    const realized = realizeCollisionStripTransition(resolved, support, 10);
    expect(resolved.stripExtentPx).toBe(0);
    expect(realized.stripSegmentCount).toBe(0);
    expect(realized.supportSegmentCount).toBe(0);
    expect(realized.lines).toHaveLength(1);
    for (const line of realized.lines) {
      expect(Math.hypot(line.x2 - line.x1, line.y2 - line.y1)).toBeGreaterThan(0);
    }
  });

  test("fails closed when the frame lacks a physical cross-track scale", () => {
    expect(() => resolveCollisionStrip(
      { ...frame, sledSpanPx: Number.NaN },
      envelope(0.1),
      control,
    )).toThrow(/sledSpanPx/);
  });
});
