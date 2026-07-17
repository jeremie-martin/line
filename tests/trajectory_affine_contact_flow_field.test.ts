import { describe, expect, test } from "vitest";
import { realizeAffineContactFlowField } from "../scripts/v0/trajectory/affine_contact_flow_field.ts";
import type { TrackLine } from "../scripts/v0/types.ts";

const lines: TrackLine[] = [
  { id: 1, type: 0, x1: 0, y1: 0, x2: 2, y2: 0, flipped: false, leftExtended: false, rightExtended: false },
  { id: 2, type: 0, x1: 2, y1: 0, x2: 4, y2: 0, flipped: false, leftExtended: false, rightExtended: false },
];

describe("affine contact-flow geometry field", () => {
  test("preserves the raw anchor and applies the full fitted position flow", () => {
    const points = [
      { position: { x: -1, y: -1 }, velocity: { x: 1, y: 0 } },
      { position: { x: 1, y: -1 }, velocity: { x: 3, y: 0 } },
      { position: { x: -1, y: 1 }, velocity: { x: 1, y: 0 } },
      { position: { x: 1, y: 1 }, velocity: { x: 3, y: 0 } },
    ];
    const result = realizeAffineContactFlowField(lines, points);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.lines[0]!.x1).toBe(0);
    expect(result.lines[0]!.y1).toBe(0);
    expect(result.gradient).toMatchObject({ a: 1, b: 0, c: 0, d: 0 });
    expect(result.lines[0]!.x2).toBeCloseTo(2 * Math.E, 12);
    expect(result.lines[1]!.x1).toBeCloseTo(2 * Math.E, 12);
    expect(result.lines[1]!.x2).toBeCloseTo(4 * Math.exp(2), 12);
    expect(result.lines.map((line) => line.id)).toEqual([1, 2]);
  });

  test("fails closed for an unidentifiable spatial field", () => {
    const collinear = [
      { position: { x: 0, y: 0 }, velocity: { x: 1, y: 0 } },
      { position: { x: 1, y: 0 }, velocity: { x: 1, y: 0 } },
      { position: { x: 2, y: 0 }, velocity: { x: 1, y: 0 } },
      { position: { x: 3, y: 0 }, velocity: { x: 1, y: 0 } },
    ];
    expect(realizeAffineContactFlowField(lines, collinear)).toMatchObject({
      status: "unavailable", reason: "singular_affine_fit",
    });
  });
});
