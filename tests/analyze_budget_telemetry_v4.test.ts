import { describe, expect, test } from "vitest";
import { analyzeBudgetTelemetry } from "../scripts/v0/analyze_budget_telemetry.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import { compileHandoff } from "../scripts/v0/optimizer/handoff.ts";

describe("V4 budget telemetry analysis", () => {
  test("validates and reports the exact work populations from a real compile", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const output = compileHandoff(spec, 0, {
      budget: 20_000,
      maxNodes: 12,
      polish: false,
      budgetTelemetry: "trace",
    });
    const telemetry = output.budgetTelemetry!;
    const report = analyzeBudgetTelemetry([{ source: "test", context: "tiny", telemetry }]);

    expect(report.validation.violations).toEqual([]);
    expect(report.counts).toMatchObject({ compiles: 1, episodes: 1 });
    expect(report.work.register_offers).toBe(
      report.work.partial_node_evaluations + report.work.terminal_node_evaluations,
    );
    expect(report.work.terminal_node_evaluations).toBe(
      report.work.first_time_terminal_node_evaluations +
        report.work.revisited_terminal_node_evaluations,
    );
    expect(report.work.terminal_node_evaluations).toBe(
      report.work.distinct_terminal_tracks + report.work.repeated_terminal_track_evaluations,
    );
    expect(report.ratios.requested_proposals_per_ranked_option_call).not.toBeNull();
    expect(report.ratios).not.toHaveProperty("requested_proposals_per_pool");
    expect(
      Object.values(report.work.by_evaluation_origin)
        .reduce((sum, origin) => sum + origin.register_offers, 0),
    ).toBe(report.work.register_offers);
    expect(report.lineage.outputs_by_lane.initial).toBe(1);
  });

  test("fails closed when a work identity or interval partition is corrupted", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const output = compileHandoff(spec, 0, {
      budget: 20_000,
      maxNodes: 12,
      polish: false,
      budgetTelemetry: "summary",
    });
    const brokenWork = structuredClone(output.budgetTelemetry!);
    brokenWork.episodes[0]!.work.register_offers++;
    expect(() => analyzeBudgetTelemetry([
      { source: "test", context: "broken-work", telemetry: brokenWork },
    ])).toThrow(/register-offer identity is open/);

    const brokenInterval = structuredClone(output.budgetTelemetry!);
    brokenInterval.execution_intervals[0]!.start_total_spent_frames++;
    expect(() => analyzeBudgetTelemetry([
      { source: "test", context: "broken-interval", telemetry: brokenInterval },
    ])).toThrow(/contiguous partition/);
  });
});
