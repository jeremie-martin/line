import { describe, expect, it } from "vitest";
import { releaseProgram } from "../scripts/benchmark/contact_program.ts";
import type { TrackLine } from "../scripts/v0/types.ts";

const lines: TrackLine[] = [0, 1, 2, 3].map(i => ({ id: i + 10, type: 0,
  x1: 10 * i, y1: 0, x2: 10 * (i + 1), y2: 0,
  flipped: false, leftExtended: false, rightExtended: i < 3 }));
const frame = { sledX: 10, sledY: 0, speed: 4, angleDeg: 0, velocity: { x: 4, y: 0 } };

describe("physical release programs", () => {
  it("preserves its approach and builds a connected finite branch of the requested length", () => {
    const result = releaseProgram(lines, frame, { length: 63, exitTurn: -0.3, bend: 0.1, energy: 0 })!;
    expect(result[0]).toEqual(lines[0]);
    let length = 0;
    for (let i = 1; i < result.length; i++) {
      expect([result[i].x1, result[i].y1]).toEqual([result[i - 1].x2, result[i - 1].y2]);
      length += Math.hypot(result[i].x2 - result[i].x1, result[i].y2 - result[i].y1);
    }
    expect(length).toBeCloseTo(63, 10);
    expect(result.at(-1)!.rightExtended).toBe(false);
    expect(lines[0].x2).toBe(10);
  });
  it("uses native acceleration only after the retained approach", () => {
    const result = releaseProgram(lines, frame, { length: 40, exitTurn: 0, bend: 0, energy: 1 })!;
    expect(result[0]).toEqual(lines[0]);
    for (const line of result.slice(1)) {
      expect(line.type).toBe(1);
      expect(line.x1).toBeGreaterThan(line.x2);
      expect(line.flipped).toBe(true);
    }
  });
  it("rejects malformed seed carriers and nonfinite programs", () => {
    expect(releaseProgram([{ ...lines[0], x2: 9 }, ...lines.slice(1)], frame,
      { length: 40, exitTurn: 0, bend: 0, energy: 0 })).toBeNull();
    expect(releaseProgram(lines, frame, { length: Infinity, exitTurn: 0, bend: 0, energy: 0 })).toBeNull();
  });
});
