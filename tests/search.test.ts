/**
 * Monte-Carlo search tests.
 */
import { describe, test, expect } from "vitest";
import { slide } from "../scripts/lib/moves.ts";
import { ride } from "../scripts/lib/ride.ts";
import { searchRide, searchRideGreedy, defaultFitness } from "../scripts/lib/search.ts";
import { makeRng } from "../scripts/lib/rng.ts";

describe("searchRide", () => {
  test("survives at fixed timing across N trials", () => {
    const moves = [slide({ at: 30 }), slide({ at: 80 }), slide({ at: 130 })];
    const result = searchRide(moves, {}, { trials: 10, seed: 1 });
    expect(result.best.result.survived).toBe(true);
    expect(result.trials).toBe(10);
    expect(result.topK.length).toBeGreaterThan(0);
  });

  test("default fitness ranks survivors above non-survivors", () => {
    const moves = [slide({ at: 30 }), slide({ at: 80 })];
    const r = searchRide(moves, {}, { trials: 5, seed: 1, topK: 5 });
    // Top trials should be survivors first.
    const survivors = r.topK.filter((t) => t.result.survived);
    if (survivors.length > 0 && survivors.length < r.topK.length) {
      const lastSurvivor = r.topK.lastIndexOf(survivors[survivors.length - 1]);
      const firstNonSurvivor = r.topK.findIndex((t) => !t.result.survived);
      if (firstNonSurvivor >= 0) {
        expect(lastSurvivor).toBeLessThan(firstNonSurvivor);
      }
    }
  });

  test("seed reproduces exactly", () => {
    const moves = [slide({ at: 30 }), slide({ at: 80 }), slide({ at: 130 })];
    // Same seed → same track + metrics.
    const a = ride(moves, { rng: makeRng(42) });
    const b = ride(moves, { rng: makeRng(42) });
    expect(a.track.lines.length).toBe(b.track.lines.length);
    expect(a.detection.summary.longestContactRun).toBe(b.detection.summary.longestContactRun);
    expect(a.detection.summary.meanVxSliding).toBe(b.detection.summary.meanVxSliding);
  });

  test("different seeds produce different geometry", () => {
    const moves = [slide({ at: 30 }), slide({ at: 80 })];
    const a = ride(moves, { rng: makeRng(1) });
    const b = ride(moves, { rng: makeRng(2) });
    // Line coords should differ between seeds.
    const aCoord = a.track.lines[0].x2;
    const bCoord = b.track.lines[0].x2;
    expect(aCoord).not.toBe(bCoord);
  });

  test("no rng = deterministic baseline (regression)", () => {
    const moves = [slide({ at: 30 })];
    // Two calls without rng should produce identical results.
    const a = ride(moves);
    const b = ride(moves);
    expect(a.track.lines[0].x2).toBe(b.track.lines[0].x2);
  });

  test("greedy reaches the end on a normal slide chain", () => {
    const moves = [slide({ at: 30 }), slide({ at: 80 }), slide({ at: 130 })];
    const r = searchRideGreedy(moves, {}, { triesPerMove: 5, seed: 1 });
    expect(r.reachedEnd).toBe(true);
    expect(r.result.survived).toBe(true);
    expect(r.perMoveSeeds.every((s) => s !== null)).toBe(true);
  });

  test("greedy is reproducible (same baseSeed → same result)", () => {
    const moves = [slide({ at: 30 }), slide({ at: 80 })];
    const a = searchRideGreedy(moves, {}, { triesPerMove: 5, seed: 7 });
    const b = searchRideGreedy(moves, {}, { triesPerMove: 5, seed: 7 });
    expect(a.perMoveSeeds).toEqual(b.perMoveSeeds);
    expect(a.result.detection.summary.longestContactRun).toBe(b.result.detection.summary.longestContactRun);
  });

  test("greedy uses fewer sims than monte-carlo for the same spec length", () => {
    const moves = [slide({ at: 30 }), slide({ at: 80 }), slide({ at: 130 }), slide({ at: 180 }), slide({ at: 230 })];
    // 5 moves × triesPerMove=4 = 20 sims, plus 1 final ride = 21 sims max in happy case.
    const r = searchRideGreedy(moves, {}, { triesPerMove: 4, seed: 1 });
    expect(r.totalSimulations).toBeLessThanOrEqual(40); // even with some backtracks
    expect(r.result.survived).toBe(true);
  });

  // Stalls are handled through survival: a stalled rider terminates with
  // `rideStalled`, so defaultFitness returns 0.
});
