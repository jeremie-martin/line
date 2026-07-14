import { describe, expect, test } from "vitest";
import {
  deriveSupportEnvelopeIntent,
  deriveMeanSpeedExitPrior,
  makeTransitionEnvelopeCenter,
  resolveSupportEnvelope,
  type IncomingTargetFrame,
} from "../scripts/v0/trajectory/envelope/model.ts";
import { realizeSupportPath, realizeTransitionEnvelope } from "../scripts/v0/trajectory/envelope/realizer.ts";
import { outgoingIntervalFromGap } from "../scripts/v0/trajectory/outgoing_interval.ts";
import type { Gap } from "../scripts/v0/types.ts";

const frame: IncomingTargetFrame = {
  reference: { x: 120, y: 300 },
  headingDeg: 8,
  speedPxPerFrame: 10,
  sledSpanPx: 18,
  anchorPoint: "NOSE",
  headingSource: "reference_point_velocity",
};

function interval(endFrame: number, targets: Gap["targets"]) {
  return outgoingIntervalFromGap({
    index: 4,
    startFrame: 100,
    endFrame,
    endsWithContact: true,
    targets,
  });
}

describe("transition envelope geometry", () => {
  test("owns authored air on the outgoing interval and labels an absent-air prior", () => {
    const authored = deriveSupportEnvelopeIntent(interval(300, { air: 0.05, speed: 0.7 }), 10, 6);
    const absent = deriveSupportEnvelopeIntent(interval(300, { speed: 0.7 }), 10, 6);
    expect(authored.supportPrior).toBe("authored_air");
    expect(authored.air.nominalSupportIntervals).toBeCloseTo(190.95);
    expect(authored.authoredMeanSpeedPxPerFrame).not.toBeNull();
    expect(absent.supportPrior).toBe("neutral");
    expect(absent.air.nominalSupportIntervals).toBeNull();
  });

  test("does not reinterpret an outgoing mean-speed target as an exit-speed command", () => {
    const intent = deriveSupportEnvelopeIntent(interval(300, { air: 0.2, speed: 0.1 }), 10, 6);
    const center = makeTransitionEnvelopeCenter(frame, intent);
    expect(center.exitSpeedRatio).toBe(1);
  });

  test("offers an explicit, non-clamped mean-speed exit prior only when physical", () => {
    const intent = deriveSupportEnvelopeIntent(interval(300, { air: 0.2, speed: 0.7 }), 10, 6);
    const prior = deriveMeanSpeedExitPrior(intent, 10);
    expect(prior?.targetMeanSpeedPxPerFrame).toBeCloseTo(10.44, 12);
    expect(prior?.impliedExitSpeedPxPerFrame).toBeCloseTo(10.88, 12);
    expect(prior?.exitSpeedRatio).toBeCloseTo(1.088, 12);
    const impossible = deriveSupportEnvelopeIntent(interval(300, { speed: 0 }), 10, 6);
    expect(deriveMeanSpeedExitPrior(impossible, 12)).toBeNull();
    const absent = deriveSupportEnvelopeIntent(interval(300, {}), 10, 6);
    expect(deriveMeanSpeedExitPrior(absent, 10)).toBeNull();
  });

  test("scales support extent with elapsed time without a duration-specific cap", () => {
    const shortIntent = deriveSupportEnvelopeIntent(interval(140, { air: 0.1 }), 10, 6);
    const longIntent = deriveSupportEnvelopeIntent(interval(380, { air: 0.1 }), 10, 6);
    const short = resolveSupportEnvelope(shortIntent, 10, { supportScale: 1, exitSpeedRatio: 1, gradeBiasDeg: 0, curvatureSkew: 0 });
    const long = resolveSupportEnvelope(longIntent, 10, { supportScale: 1, exitSpeedRatio: 1, gradeBiasDeg: 0, curvatureSkew: 0 });
    expect(long.plannedExtentPx).toBeGreaterThan(short.plannedExtentPx * 5);
    const center = makeTransitionEnvelopeCenter(frame, longIntent);
    const straight = realizeTransitionEnvelope(
      frame,
      { ...center, entryAngleRelativeDeg: -frame.headingDeg, contactTurnDeg: 0 },
      long,
      1,
    );
    // Duration alone does not fragment a straight support surface.
    expect(straight.supportSegmentCount).toBe(1);
    const curved = realizeTransitionEnvelope(frame, center, long, 1);
    expect(curved.supportSegmentCount).toBeGreaterThan(1);
    expect(curved.lines).toHaveLength(curved.supportSegmentCount + 1);
  });

  test("holds the contact coordinate fixed while independently varying entry angle", () => {
    const intent = deriveSupportEnvelopeIntent(interval(180, { air: 0.2 }), 10, 6);
    const envelope = resolveSupportEnvelope(intent, 10, { supportScale: 1, exitSpeedRatio: 1, gradeBiasDeg: 0, curvatureSkew: 0 });
    const center = makeTransitionEnvelopeCenter(frame, intent);
    const left = realizeTransitionEnvelope(frame, center, envelope, 1);
    const right = realizeTransitionEnvelope(frame, { ...center, entryAngleRelativeDeg: center.entryAngleRelativeDeg + 25 }, envelope, 1);
    expect(right.contactPoint.x).toBeCloseTo(left.contactPoint.x, 12);
    expect(right.contactPoint.y).toBeCloseTo(left.contactPoint.y, 12);
  });

  test("represents an all-air outgoing interval without a zero-length support line", () => {
    const intent = deriveSupportEnvelopeIntent(interval(180, { air: 1 }), 10, 6);
    const envelope = resolveSupportEnvelope(intent, 10, { supportScale: 1, exitSpeedRatio: 1, gradeBiasDeg: 0, curvatureSkew: 0 });
    const realized = realizeTransitionEnvelope(frame, makeTransitionEnvelopeCenter(frame, intent), envelope, 1);
    expect(envelope.plannedExtentPx).toBe(0);
    expect(realized.supportSegmentCount).toBe(0);
    expect(realized.lines).toHaveLength(1);
  });

  test("honors the actual adjacent-line turn bound when anchoring the first tangent", () => {
    const support = realizeSupportPath(
      { point: { x: 0, y: 0 }, entryAngleDeg: 0 },
      {
        intervalFrames: 12,
        supportIntervals: 12,
        plannedAirborneIntervals: 0,
        plannedExtentPx: 120,
        // With p=1 this implies an 8 degree total turn from a 0 degree entry.
        meanGradeDeg: 4,
        curvaturePower: 1,
      },
      1,
      { preserveEntryTangent: true, maxTurnDegPerSegment: 5 },
    );
    const angles = support.lines.map((line) => Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180 / Math.PI);
    expect(angles[0]).toBeCloseTo(0, 12);
    expect(angles.at(-1)).toBeCloseTo(8, 12);
    for (let index = 1; index < angles.length; index++) {
      expect(Math.abs(angles[index]! - angles[index - 1]!)).toBeLessThanOrEqual(5 + 1e-12);
    }
  });

  test("fails closed on invalid externally supplied envelope geometry", () => {
    const intent = deriveSupportEnvelopeIntent(interval(180, { air: 0.2 }), 10, 6);
    const envelope = resolveSupportEnvelope(intent, 10, { supportScale: 1, exitSpeedRatio: 1, gradeBiasDeg: 0, curvatureSkew: 0 });
    expect(() => realizeTransitionEnvelope(
      frame,
      makeTransitionEnvelopeCenter(frame, intent),
      { ...envelope, plannedExtentPx: Number.NaN },
      1,
    )).toThrow(/plannedExtentPx/);
    expect(() => realizeTransitionEnvelope(
      frame,
      makeTransitionEnvelopeCenter(frame, intent),
      { ...envelope, plannedAirborneIntervals: envelope.plannedAirborneIntervals + 1 },
      1,
    )).toThrow(/occupancy partition/);
  });
});
