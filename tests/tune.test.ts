/**
 * tune() — parameter-search wrapper tests.
 */
import { describe, test, expect } from "vitest";
import { slide, catch_ } from "../scripts/lib/moves.ts";
import { tune } from "../scripts/lib/tune.ts";
import { ride } from "../scripts/lib/ride.ts";

describe("tune", () => {
  test("returns a Move that produces a track", () => {
    const r = ride([
      tune(
        (p) => slide({ at: 30, startAngleDeg: p.startAngleDeg }),
        { seed: { startAngleDeg: 20 }, vary: { startAngleDeg: [10, 25] }, budget: 5 },
      ),
    ]);
    expect(r.survived).toBe(true);
    expect(r.track.lines.length).toBeGreaterThan(0);
  });

  test("budget cap is respected (no runtime explosion)", () => {
    // 3 dims × budget 10 → ~10^(1/3) = 2-3 samples each = 8-27 trials
    const t0 = Date.now();
    const r = ride([
      tune(
        (p) => slide({
          at: 30,
          startAngleDeg: p.a,
          endAngleDeg: p.b,
          segmentLength: p.l,
        }),
        {
          seed: { a: 20, b: 3, l: 25 },
          vary: { a: [10, 25], b: [2, 6], l: [20, 40] },
          budget: 10,
        },
      ),
    ]);
    const elapsed = Date.now() - t0;
    expect(r.survived).toBe(true);
    // Loose upper bound on runtime to catch budget runaway.
    expect(elapsed).toBeLessThan(15_000);
  });

  test("after preheat, tune finds a working slide param at moderate gap", () => {
    // 90-frame gap from slide-1 to slide-2 is hard at fixed defaults.
    // Tune should find params that get a clean slide.
    const r = ride([
      slide({ at: 30 }),
      tune(
        (p) => slide({ at: 120, startAngleDeg: p.startAngleDeg }),
        { seed: { startAngleDeg: 20 }, vary: { startAngleDeg: [10, 70] }, budget: 10 },
      ),
    ]);
    expect(r.survived).toBe(true);
    // Tuned slide should produce ≥ 15 frames of slide.
    expect((r.steps[1].verdict?.observed?.slideDurationFrames as number) ?? 0).toBeGreaterThanOrEqual(15);
  });
});
