import { describe, expect, test } from "vitest";
import {
  summarizeSelectiveTriggerOpportunities,
  type SelectiveTriggerOpportunityRun,
} from "../scripts/benchmark/selective_trigger_opportunities.ts";

function run(
  sourceId: string,
  seed: number,
  values: Array<[number, number]>,
): SelectiveTriggerOpportunityRun {
  return {
    sourceId,
    seed,
    stats: {
      mature_axis_loss_delta_max: 0.31,
      loss_threshold_crossings: values[3]![0],
      selective_backtracks: values[3]![1],
      regret_opportunities_by_min_axis_loss_delta: Object.fromEntries(
        ["0.05", "0.10", "0.15", "0.20"].map((threshold, index) => [
          threshold,
          { crossed_watches: values[index]![0], admissible_watches: values[index]![1] },
        ]),
      ),
    },
  };
}

describe("selective trigger opportunity analysis", () => {
  test("reports incremental lower-threshold action sets by run and source", () => {
    const summary = summarizeSelectiveTriggerOpportunities([
      run("a", 16, [[5, 4], [4, 3], [3, 2], [2, 1]]),
      run("a", 17, [[2, 1], [1, 1], [1, 1], [0, 0]]),
      run("b", 16, [[3, 2], [2, 1], [1, 0], [0, 0]]),
    ]);
    expect(summary.thresholds.find((row) => row.min_axis_loss_delta === 0.15))
      .toMatchObject({
        crossed_watches: 5,
        admissible_watches: 3,
        additional_admissible_vs_production: 2,
        runs_with_admissible_watch: 2,
        sources_with_admissible_watch: 1,
      });
    expect(summary.by_source[0]).toMatchObject({ source_id: "a", runs: 2 });
    expect(summary.trust_checks).toEqual({
      nested_threshold_counts: true,
      production_crossings_match: true,
      production_admissions_match: true,
    });
  });

  test("rejects counters that violate causal nesting", () => {
    expect(() => summarizeSelectiveTriggerOpportunities([
      run("a", 16, [[1, 1], [2, 1], [1, 1], [1, 1]]),
    ])).toThrow(/not nested/);
  });

  test("rejects disagreement with production admission telemetry", () => {
    const input = run("a", 16, [[2, 2], [2, 2], [2, 2], [2, 2]]);
    input.stats.selective_backtracks = 1;
    expect(() => summarizeSelectiveTriggerOpportunities([input]))
      .toThrow(/production admission counters disagree/);
  });
});
