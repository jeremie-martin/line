import { describe, expect, test } from "vitest";
import { IMPACT_WINDOW } from "../scripts/v0/types.ts";
import { realizeSupportPath } from "../scripts/v0/trajectory/envelope/realizer.ts";
import {
  realizeStateSupportContinuation,
  STATE_SUPPORT_CARRIER_FRAMES,
  STATE_SUPPORT_FIRST_CHUNK_FRAMES,
} from "../scripts/v0/trajectory/state_support_continuation.ts";
import { planStateSupportResponse } from "../scripts/v0/trajectory/state_support_response.ts";

const response = {
  eventFrame: 100,
  supportStartFrame: 100 + IMPACT_WINDOW + 1,
  anchor: {
    reference: { x: 20, y: 30 },
    headingDeg: -12,
    speedPxPerFrame: 11,
    sledSpanPx: 18,
    anchorPoint: "TAIL" as const,
    headingSource: "reference_point_velocity" as const,
  },
  prefix: {
    startFrame: 100,
    endFrameExclusive: 100 + IMPACT_WINDOW + 1,
    measurementSamples: IMPACT_WINDOW + 1,
    airborneSamples: 0,
  },
};

const action = { id: "grade_positive_4", gradeResidualDeg: 4, curvatureSkew: 0 };

describe("state-support continuation geometry", () => {
  test("keeps the first-only arm byte-for-byte equal to the existing local response geometry", () => {
    const geometry = realizeStateSupportContinuation(response, action, 40);
    const plan = planStateSupportResponse(response, STATE_SUPPORT_FIRST_CHUNK_FRAMES, action);
    const direct = realizeSupportPath(
      { point: plan.anchor.reference, entryAngleDeg: plan.anchor.headingDeg },
      plan,
      40,
      { preserveEntryTangent: true },
    );
    expect(geometry.arms.firstOnlyA).toEqual(direct.lines);
  });

  test("uses one fixed tangent carrier and an explicit topology/line-label matrix", () => {
    const geometry = realizeStateSupportContinuation(response, action, 40);
    const firstLast = geometry.arms.firstOnlyA.at(-1)!;
    const mergedALast = geometry.arms.mergedA.at(-1)!;
    const mergedBLast = geometry.arms.mergedB.at(-1)!;
    const splitABLast = geometry.arms.splitAB.at(-1)!;
    const splitBALast = geometry.arms.splitBA.at(-1)!;
    expect(geometry.carrier.x1).toBe(firstLast.x2);
    expect(geometry.carrier.y1).toBe(firstLast.y2);
    expect(geometry.carrier.flipped).toBe(firstLast.flipped);
    expect(geometry.arms.mergedA).toHaveLength(geometry.arms.firstOnlyA.length);
    expect(geometry.arms.mergedB).toHaveLength(geometry.arms.firstOnlyA.length);
    expect(geometry.arms.splitAB).toHaveLength(geometry.arms.firstOnlyA.length + 1);
    expect(geometry.arms.splitBA).toHaveLength(geometry.arms.firstOnlyA.length + 1);
    expect({ x: mergedALast.x2, y: mergedALast.y2 }).toEqual({ x: splitABLast.x2, y: splitABLast.y2 });
    expect({ x: mergedALast.x2, y: mergedALast.y2 }).toEqual({ x: splitBALast.x2, y: splitBALast.y2 });
    expect(mergedALast).toMatchObject({ ...mergedBLast, id: mergedALast.id });
    expect(geometry.arms.splitAB.at(-2)).toMatchObject({ ...geometry.arms.splitBA.at(-2)!, id: geometry.arms.splitAB.at(-2)!.id });
    expect(geometry.arms.splitAB.at(-1)).toMatchObject({ ...geometry.arms.splitBA.at(-1)!, id: geometry.arms.splitAB.at(-1)!.id });
    expect(geometry.lineLabels).toEqual({ A: firstLast.id, B: geometry.carrier.id });
    for (const lines of Object.values(geometry.arms)) {
      expect(new Set(lines.map((line) => line.id)).size).toBe(lines.length);
    }
    const carrierLength = Math.hypot(geometry.carrier.x2 - geometry.carrier.x1, geometry.carrier.y2 - geometry.carrier.y1);
    expect(carrierLength).toBeCloseTo(response.anchor.speedPxPerFrame * STATE_SUPPORT_CARRIER_FRAMES, 12);
  });
});
