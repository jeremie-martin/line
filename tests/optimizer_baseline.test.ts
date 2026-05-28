/**
 * Step 0 verification — the frozen greedy_v1 baseline is internally
 * consistent and the scorer wrapper can read it without surprise.
 *
 * This is the strong gate from the Step 0 plan: "scorer wrapper
 * reproduces existing goal_score from frozen baseline". We don't
 * re-run greedy_v1 here (that's the freeze script's job); we verify
 * the saved baseline is self-consistent and that the aggregation
 * we'd use to compare a new compiler to it is well-defined.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { GOLDEN_SPECS } from "../scripts/v0/golden_suite.ts";
import { shiftedGeometricMean } from "../scripts/v0/score.ts";

type Row = {
  spec: string;
  seed: number;
  axis_quality: number;
  axis_error_rms: number;
  axis_error_max: number;
  contract_passed: boolean;
  hits: number;
  drift: number;
  missing: number;
  off_beat: number;
  terminus_reason: string;
  elapsed_ms: number;
};

type Baseline = {
  generated_at: string;
  seeds: number[];
  specs: string[];
  goal_score: number;
  per_spec: { name: string; score: number }[];
  rows: Row[];
};

const baseline: Baseline = JSON.parse(
  readFileSync("baselines/greedy_v1.json", "utf8"),
);

describe("baselines/greedy_v1.json — Step 0 frozen anchor", () => {
  test("file covers exactly the golden suite × 5 seeds", () => {
    expect(baseline.specs).toEqual([...GOLDEN_SPECS]);
    expect(baseline.seeds).toEqual([0, 1, 2, 3, 4]);
    expect(baseline.rows.length).toBe(baseline.specs.length * baseline.seeds.length);
  });

  test("every (spec, seed) cell is present exactly once", () => {
    const seen = new Set<string>();
    for (const r of baseline.rows) {
      const key = `${r.spec}/${r.seed}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(baseline.specs.length * baseline.seeds.length);
  });

  test("per-spec scores match shifted-geomean of per-row scores", () => {
    // Reproduce golden.ts's aggregation: per-spec shifted geomean of
    // (axis_quality * 1000 if contract_passed else 0) across seeds.
    for (const sp of baseline.specs) {
      const rows = baseline.rows.filter((r) => r.spec === sp);
      const scores = rows.map((r) => (r.contract_passed ? r.axis_quality : 0) * 1000);
      const expected = shiftedGeometricMean(scores);
      const stored = baseline.per_spec.find((s) => s.name === sp)!.score;
      // Stored values are rounded to 4 decimals; allow small slack.
      expect(stored).toBeCloseTo(expected, 3);
    }
  });

  test("goal_score matches shifted-geomean of per-spec scores", () => {
    const expected = shiftedGeometricMean(baseline.per_spec.map((s) => s.score));
    expect(baseline.goal_score).toBeCloseTo(expected, 3);
  });

  test("baseline goal_score is in the expected ballpark (~460)", () => {
    // Sanity check: catches massive scoring-formula drift between
    // freeze and now. If this fails, either the scorer changed or
    // the baseline is from a different epoch.
    expect(baseline.goal_score).toBeGreaterThan(400);
    expect(baseline.goal_score).toBeLessThan(550);
  });
});
