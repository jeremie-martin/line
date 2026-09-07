import { describe, expect, it } from "vitest";
import { transportCatch, setCatchEnergy, shapeCatch } from "../scripts/benchmark/whole_track_controls.ts";

describe("whole-track physical controls", () => {
  const line = { id: 13, type: 0 as const, x1: 0.1, y1: 2.4, x2: 8.7, y2: 4.2,
    flipped: false, leftExtended: true, rightExtended: false };
  const frame = { sledX: 1.3, sledY: 2.8, speed: 5, angleDeg: 0, velocity: { x: 5, y: 0 } };
  it("preserves byte-identical geometry for a neutral replay in all transports", () => {
    for (const mode of ["fixed", "translate", "similarity"] as const) {
      expect(JSON.stringify(transportCatch([line], frame, { ...frame }, mode))).toBe(JSON.stringify([line]));
    }
    expect(setCatchEnergy([line], frame.velocity, 0)).toEqual([line]);
  });
  it("preserves collision normal and exchanges endpoint extension when reversing propulsion", () => {
    const forward = setCatchEnergy([line], frame.velocity, 1)[0];
    const brake = setCatchEnergy([line], frame.velocity, -1)[0];
    const normal = (l: typeof line) => [-(l.y2 - l.y1) * (l.flipped ? -1 : 1),
      (l.x2 - l.x1) * (l.flipped ? -1 : 1)];
    expect(normal(forward as typeof line)).toEqual(normal(line));
    expect(normal(brake as typeof line)).toEqual(normal(line));
    expect(forward.x1 - forward.x2).toBeGreaterThan(0);
    expect(brake.x1 - brake.x2).toBeLessThan(0);
    expect(forward.leftExtended).toBe(line.rightExtended);
    expect(forward.rightExtended).toBe(line.leftExtended);
    expect(line.type).toBe(0);
  });
  it("maps a catch through a known rotated and scaled arrival frame", () => {
    const changed = { ...frame, sledX: 20, sledY: -4, speed: 10, angleDeg: 90 };
    const result = transportCatch([line], frame, changed, "similarity")[0];
    expect(result.x1).toBeCloseTo(20 - 2 * (line.y1 - frame.sledY), 12);
    expect(result.y1).toBeCloseTo(-4 + 2 * (line.x1 - frame.sledX), 12);
    expect(result.id).toBe(line.id);
    expect(result.flipped).toBe(line.flipped);
  });
  it("keeps the arrival anchor fixed under shape controls and preserves connected seams", () => {
    const joined = [line, { ...line, id: 14, x1: line.x2, y1: line.y2, x2: 15, y2: 1 }];
    const shaped = shapeCatch(joined, frame, { energy: 0, turn: 0.3, logScale: Math.log(1.2) });
    expect(shaped[0].x2).toBe(shaped[1].x1);
    expect(shaped[0].y2).toBe(shaped[1].y1);
    const anchor = { ...line, x1: frame.sledX, y1: frame.sledY };
    expect(shapeCatch([anchor], frame, { energy: 0, turn: 0.3, logScale: Math.log(1.2) })[0]).toMatchObject({ x1: frame.sledX, y1: frame.sledY });
    expect(shapeCatch(joined, frame, { energy: 0, turn: 0, logScale: 0 })).toEqual(joined);
  });
});
