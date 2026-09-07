import { describe, expect, it } from "vitest";
import { matchRecaptureFrame } from "../scripts/benchmark/impact_recapture_frame.ts";

describe("recapture rigid phase alignment", () => {
  const phase = [{ x: 0, y: 0, vx: 3, vy: 1 }, { x: 2, y: 0, vx: 3, vy: 1 },
    { x: 0, y: 1, vx: 3, vy: 1 }, { x: 2, y: 1, vx: 3, vy: 1 }];
  const lines = [{ id: 8, type: 0 as const, x1: -0.1, y1: 1.5, x2: 4.2, y2: 2.5, flipped: true, rightExtended: true }];
  it("preserves exact geometry for an unchanged phase", () => {
    const result = matchRecaptureFrame(lines, phase, phase.map(p => ({ ...p })));
    expect(result.identity).toBe(true);
    expect(JSON.stringify(result.lines)).toBe(JSON.stringify(lines));
  });
  it("recovers a known rigid motion without changing physical line flags or length", () => {
    const moved = phase.map(p => ({ x: 10 - p.y, y: 20 + p.x, vx: -p.vy, vy: p.vx }));
    const result = matchRecaptureFrame(lines, phase, moved), line = result.lines[0];
    expect(result.cosine).toBeCloseTo(0, 12);
    expect(result.sine).toBeCloseTo(1, 12);
    expect(result.residual).toBeCloseTo(0, 12);
    expect(line.x1).toBeCloseTo(8.5, 12);
    expect(line.y1).toBeCloseTo(19.9, 12);
    expect(Math.hypot(line.x2 - line.x1, line.y2 - line.y1)).toBeCloseTo(Math.hypot(4.3, 1), 12);
    expect(line).toMatchObject({ id: 8, type: 0, flipped: true, rightExtended: true });
  });
  it("rejects a phase without an identifiable orientation", () => {
    const degenerate = Array.from({ length: 4 }, () => ({ x: 3, y: 2, vx: 0, vy: 0 }));
    expect(matchRecaptureFrame(lines, phase, degenerate)).toMatchObject({ available: false, reason: "unidentifiable_rotation" });
  });
});
