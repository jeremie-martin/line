import { describe, expect, test } from "vitest";
import { scaleAnalysisRun } from "../scripts/v0/benchmark_v2/scale_analysis_projection.ts";

describe("Benchmark V2 scale analysis projection", () => {
  test("retains repair target-search mechanics while omitting bulky compile stats", () => {
    const projected = scaleAnalysisRun({
      task: { sourceId: "source", budget: 750_000, actualSeed: 1 },
      report: { contacts: new Array(10).fill({}) },
      authoredContacts: 10,
      phaseResults: [{ large: true }],
      stats: {
        repair_target_search: {
          policy: "target_improvement_first",
          target_pools: 7,
          reordered: 2,
        },
        unrelated_large_stats: { samples: [1, 2, 3] },
      },
      budgetTelemetry: {
        schema: "line.compile-budget-telemetry.v9",
        node_events: [{ large: true }],
        compile: { work: {} },
        episodes: [{
          repair_decision: {
            target_gap_index: 4,
            considered_targets: [{ large: true }],
            incumbent_track_hash: "incumbent",
            working_track_hash: "working",
          },
          outcome: {
            terminal_reached: true,
            terminal_offer_track_hash: "offer",
          },
        }],
      },
    });

    expect(projected).not.toHaveProperty("report");
    expect(projected).not.toHaveProperty("authoredContacts");
    expect(projected).not.toHaveProperty("phaseResults");
    expect(projected.stats).toEqual({
      repair_target_search: {
        policy: "target_improvement_first",
        target_pools: 7,
        reordered: 2,
      },
    });
    expect(projected).not.toHaveProperty("stats.unrelated_large_stats");
    expect(projected).not.toHaveProperty("budgetTelemetry.node_events");
    expect(projected).not.toHaveProperty(
      "budgetTelemetry.episodes.0.repair_decision.considered_targets",
    );
    expect(projected).not.toHaveProperty(
      "budgetTelemetry.episodes.0.outcome.terminal_offer_track_hash",
    );
  });

  test("uses an explicit null stats field when target-search mechanics are absent", () => {
    expect(scaleAnalysisRun({ budgetTelemetry: null, stats: { other: 1 } })).toMatchObject({
      stats: null,
      budgetTelemetry: null,
    });
  });
});
