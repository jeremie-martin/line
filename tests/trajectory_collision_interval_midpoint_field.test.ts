import { describe, expect, it } from "vitest";
import { realizeCollisionIntervalMidpointField } from "../scripts/v0/trajectory/collision_interval_midpoint_field.ts";

const lines = [0, 1, 2, 3].map((index) => ({
  id: index,
  type: 0,
  x1: index,
  y1: 2,
  x2: index + 1,
  y2: 2,
  flipped: false,
  leftExtended: false,
  rightExtended: false,
}));
const entering = [
  { position: { x: -1, y: -1 }, velocity: { x: 3, y: 0 } },
  { position: { x: 1, y: -1 }, velocity: { x: 3, y: 0 } },
  { position: { x: -1, y: 1 }, velocity: { x: 3, y: 0 } },
  { position: { x: 1, y: 1 }, velocity: { x: 3, y: 0 } },
];

describe("collision-interval midpoint field", () => {
  it("uses the observed four-point configuration midpoint in a compact continuous window", () => {
    const leaving = entering.map((point) => ({
      ...point,
      position: { x: point.position.x * 2, y: point.position.y },
    }));
    const field = realizeCollisionIntervalMidpointField(lines, {
      entering,
      leaving,
      intervalFrames: 1,
      contactLineIds: new Set([2]),
    });
    expect(field.status).toBe("ready");
    if (field.status !== "ready") return;
    expect(field.midpointMap).toEqual({ a: 1.5, b: 0, c: 0, d: 1 });
    expect(field.supportRadiusPx).toBe(3);
    expect(field.maxVertexDisplacementPx).toBeGreaterThan(0);
    expect(field.lines.map((line) => line.id)).toEqual(lines.map((line) => line.id));
    expect(field.lines.every((line, index) => index === 0 ||
      (line.x1 === field.lines[index - 1]!.x2 && line.y1 === field.lines[index - 1]!.y2))).toBe(true);
    expect(field.lines[2]!.x1).toBeGreaterThan(lines[2]!.x1);
  });

  it("fails closed when the entering full-sled configuration is singular", () => {
    const collinear = entering.map((point, index) => ({
      ...point,
      position: { x: index, y: 0 },
    }));
    const field = realizeCollisionIntervalMidpointField(lines, {
      entering: collinear,
      leaving: collinear,
      intervalFrames: 1,
      contactLineIds: new Set([2]),
    });
    expect(field).toEqual({ status: "unavailable", reason: "singular_configuration_map" });
  });
});
