import { describe, expect, it } from "vitest";
import { ridgeStep, broydenUpdate } from "../scripts/benchmark/impact_axis_math.ts";

describe("physical output response", () => {
  it("solves independent measured axes without moving a null coordinate", () => {
    const step = ridgeStep([[2, 0, 0], [0, 3, 0]], [1, -1.5]);
    expect(step[0]).toBeCloseTo(-0.5, 5);
    expect(step[1]).toBeCloseTo(0.5, 5);
    expect(Math.abs(step[2])).toBe(0);
  });
  it("reports a finite compromise for incompatible output requests", () => {
    const step = ridgeStep([[1], [1]], [-1, 1]);
    expect(step[0]).toBeCloseTo(0, 8);
  });
  it("updates the observed secant while preserving orthogonal predictions", () => {
    const updated = broydenUpdate([[1, 2], [3, 4]], [0.5, 0], [1, 2.5]);
    expect(updated[0][0] * 0.5).toBeCloseTo(1, 12);
    expect(updated[1][0] * 0.5).toBeCloseTo(2.5, 12);
    expect(updated[0][1]).toBe(2);
    expect(updated[1][1]).toBe(4);
  });
});
