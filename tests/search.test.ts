/**
 * Monte-Carlo search tests.
 */
import { describe, test, expect } from "vitest";
import { slide } from "../scripts/lib/moves.ts";
import { ride } from "../scripts/lib/ride.ts";
import { searchRide, defaultFitness } from "../scripts/lib/search.ts";
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

  test("defaultFitness penalizes stalled rider", () => {
    // Build a synthetic RideResult with a stuck rider and verify it
    // scores worse than a normal one.
    const moves = [slide({ at: 30 })];
    const normal = ride(moves);
    const stalled = { ...normal, detection: { ...normal.detection, summary: { ...normal.detection.summary, meanVxSliding: 0.5 } } };
    const scoreNormal = defaultFitness(normal);
    const scoreStalled = defaultFitness(stalled as typeof normal);
    expect(scoreStalled).toBeLessThan(scoreNormal);
  });
});
