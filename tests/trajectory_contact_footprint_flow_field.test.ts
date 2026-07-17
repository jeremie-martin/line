import { describe, expect, it } from "vitest";
import { realizeContactFootprintFlowField } from "../scripts/v0/trajectory/contact_footprint_flow_field.ts";

const lines = [
  { id: 0, type: 0, x1: -1, y1: 0, x2: 0, y2: 0, flipped: false, leftExtended: false, rightExtended: false },
  { id: 1, type: 0, x1: 0, y1: 0, x2: 1, y2: 0, flipped: false, leftExtended: false, rightExtended: false },
];
const points = [
  { position: { x: -1, y: -1 }, velocity: { x: 3, y: 0 } },
  { position: { x: 1, y: -1 }, velocity: { x: 5, y: 0 } },
  { position: { x: -1, y: 1 }, velocity: { x: 3, y: 0 } },
  { position: { x: 1, y: 1 }, velocity: { x: 5, y: 0 } },
];

describe("contact-footprint differential flow", () => {
  it("uses one full-cloud traversal and leaves the raw curve continuous", () => {
    const field = realizeContactFootprintFlowField(lines, points);
    expect(field.status).toBe("ready");
    if (field.status !== "ready") return;
    expect(field.footprintRadiusPx).toBeCloseTo(Math.sqrt(2));
    expect(field.traversalFrames).toBeCloseTo(Math.sqrt(2) / 4);
    expect(field.activeVertexCount).toBe(3);
    expect(field.maxVertexDisplacementPx).toBeGreaterThan(0);
    expect(field.lines[1]!.x1).toBe(field.lines[0]!.x2);
    expect(field.lines[1]!.x2).toBeGreaterThan(lines[1]!.x2);
    expect(field.lines.map((line) => line.id)).toEqual([0, 1]);
  });

  it("fails closed outside the physical footprint", () => {
    const farLines = lines.map((line) => ({ ...line, y1: line.y1 + 10, y2: line.y2 + 10 }));
    expect(realizeContactFootprintFlowField(farLines, points)).toEqual({ status: "unavailable", reason: "outside_footprint" });
  });
});
