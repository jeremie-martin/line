/**
 * The renderer is a debugging surface for the current clean-break payload. It
 * fails closed on historical or structurally incomplete schemas.
 */

import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeBudgetTelemetry } from "../scripts/v0/describe_budget_telemetry.ts";
import { BUDGET_TELEMETRY_SCHEMA } from "../scripts/v0/optimizer/budget_telemetry.ts";

const WORK = {
  ranked_option_calls: 2,
  requested_normal_proposals: 80,
  actual_candidate_samples: 77,
  viable_candidates: 30,
  candidate_samples_by_stream: { normal: 77 },
  by_evaluation_origin: {
    frontier: { register_offers: 3, terminal_node_evaluations: 2, register_improvements: 2, terminal_register_improvements: 1 },
    tail_completion: { register_offers: 0, terminal_node_evaluations: 0, register_improvements: 0, terminal_register_improvements: 0 },
    polish: { register_offers: 0, terminal_node_evaluations: 0, register_improvements: 0, terminal_register_improvements: 0 },
  },
  nodes_processed: 4,
  nodes_expanded: 3,
  children_enqueued: 8,
  register_offers: 3,
  partial_node_evaluations: 1,
  terminal_node_evaluations: 2,
  first_time_terminal_node_evaluations: 2,
  revisited_terminal_node_evaluations: 0,
  distinct_terminal_tracks: 2,
  repeated_terminal_track_evaluations: 0,
  register_improvements: 2,
  terminal_register_improvements: 1,
};

function observation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event: "start",
    total_spent_frames: 0,
    hard_remaining_frames: 750_000,
    hard_overrun_frames: 0,
    episode_spent_frames: 0,
    episode_remaining_frames: 750_000,
    episode_overrun_frames: 0,
    high_water: {
      gap_index: 0,
      anchor_frame: 0,
      remaining_gaps: 8,
      remaining_contacts: 7,
      remaining_duration_frames: 200,
    },
    structural_startup_included: true,
    estimator_applicability: "calibrated",
    structural_progress_fraction: 0,
    structural_work_prior_frames: 54_151,
    incumbent_path_work_estimate_frames: null,
    episode_pace_work_estimate_frames: null,
    estimated_remaining_work_frames: 52_713,
    estimate_lower_frames: 30_198,
    estimate_upper_frames: 60_659,
    estimate_uncertainty_frames: 15_230,
    hard_completion_margin: 14.23,
    hard_completion_surplus_frames: 697_287,
    episode_completion_margin: 14.23,
    episode_completion_surplus_frames: 697_287,
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: BUDGET_TELEMETRY_SCHEMA,
    level: "summary",
    model: {
      traversal_model: "traversal-test",
      traversal_source: "unit test",
      estimator_model: "test-model",
      estimator_fingerprint: "0123456789abcdef",
      calibrated: true,
    },
    compile: {
      hard_budget_frames: 750_000,
      policy_budget_frames: 750_000,
      total_spent_frames: 750_469,
      hard_remaining_frames: 0,
      hard_overrun_frames: 469,
      budget_exhausted: true,
      initial_structural_work_prior_frames: 54_151,
      initial_structural_slack: 13.85,
      work: WORK,
      final_output_episode_id: 0,
      final_output_lane: "initial",
    },
    execution_intervals: [
      {
        kind: "startup",
        episode_id: 0,
        start_total_spent_frames: 0,
        end_total_spent_frames: 7_814,
        spent_frames: 7_814,
        stop_reason: "search_ready",
      },
    ],
    episodes: [
      {
        episode_id: 0,
        lane: "initial",
        parent_episode_id: null,
        search_seed: 0,
        frontier_has_fallback_lane: false,
        repair_decision: null,
        anchor: {
          gap_index: 0,
          anchor_frame: 0,
          remaining_gaps: 8,
          remaining_contacts: 7,
          remaining_duration_frames: 200,
        },
        start_total_spent_frames: 0,
        ceiling_total_spent_frames: 750_000,
        available_hard_budget_frames: 750_000,
        allocated_frames: 750_000,
        work: WORK,
        start: observation(),
        end: observation({ event: "end", total_spent_frames: 38_626 }),
        outcome: {
          stop_reason: "handoff_to_repair",
          end_total_spent_frames: 38_626,
          spent_frames: 38_626,
          terminal_reached: true,
          first_terminal_offset_frames: 38_626,
          register_improved: true,
          accepted_alternative: false,
          first_register_improvement_offset_frames: 1_000,
          first_terminal_register_improvement_offset_frames: 1_000,
          internal_full_score_delta: null,
          repair_divergence: null,
          terminal_observation_censored: false,
        },
      },
    ],
    ...overrides,
  };
}

function render(value: unknown, stats?: unknown): string {
  const directory = mkdtempSync(join(tmpdir(), "line-describe-telemetry-"));
  const path = join(directory, "case.budget-telemetry.json");
  try {
    writeFileSync(path, JSON.stringify(value));
    // run.ts writes this beside the sidecar; the renderer picks it up by name.
    if (stats !== undefined) {
      writeFileSync(join(directory, "case.stats.json"), JSON.stringify({ stats }));
    }
    return describeBudgetTelemetry(path);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("describe_budget_telemetry", () => {
  test("renders the compile, interval, episode, work, and observation story", () => {
    const output = render(payload());

    expect(output).toContain(BUDGET_TELEMETRY_SCHEMA);
    expect(output).toContain("hard budget");
    expect(output).toContain("750,000");
    expect(output).toContain("hard overrun");
    expect(output).toContain("initial structural slack");
    expect(output).toContain("EXECUTION INTERVALS (1)");
    expect(output).toContain("search_ready");
    expect(output).toContain("EPISODES (1)");
    expect(output).toContain("EPISODE WORK FUNNEL");
    expect(output).toContain("requested normal proposals");
    expect(output).toContain("distinct terminal tracks");
    expect(output).toContain("handoff_to_repair");
    expect(output).toContain("OBSERVATION WALK");
    // Summary payloads have no observation array; the walk says what it walked.
    expect(output).toContain("start/end only");
  });

  test("walks every trace observation, not just start and end", () => {
    const traced = payload({ level: "trace" }) as { episodes: Record<string, unknown>[] };
    traced.episodes[0].observations = [
      observation(),
      observation({ event: "high_water", total_spent_frames: 3_275 }),
      observation({ event: "spend", total_spent_frames: 5_698 }),
      observation({ event: "end", total_spent_frames: 38_626 }),
    ];

    const output = render(traced);

    expect(output).toContain("observations=4 (trace)");
    expect(output).toContain("high_water");
    expect(output).toContain("spend");
  });

  test("renders fields a later recorder adds, and reports the ones it cannot", () => {
    const extended = payload() as {
      compile: Record<string, unknown>;
      episodes: Record<string, unknown>[];
    };
    extended.compile.initial_structural_applicability = "extrapolated_policy_budget";
    extended.compile.first_terminal_total_spent_frames = 20_751;
    extended.episodes[0].ceiling_source = "measured_cost_to_end";
    extended.episodes[0].some_future_episode_field = 7;
    (extended.episodes[0].start as Record<string, unknown>).some_future_observation_field = 9;

    const output = render(extended);

    expect(output).toContain("initial structural applicability");
    expect(output).toContain("extrapolated_policy_budget");
    expect(output).toContain("first terminal at");
    expect(output).toContain("measured_cost_to_end");
    expect(output).toContain("UNRENDERED FIELDS");
    expect(output).toContain("some_future_episode_field");
    expect(output).toContain("some_future_observation_field");
  });

  test("omits optional repair columns no episode carries", () => {
    const clean = payload() as { episodes: Record<string, unknown>[] };
    clean.episodes[0].ceiling_source = "hard_budget";
    const output = render(clean);
    expect(output).toContain("ceiling from");
    expect(output).not.toContain("weak sse");
  });

  /**
   * The three repair fields are ALWAYS present on a repair episode and were
   * documented first-class, yet the tool reported all three as unrecognized on
   * every repair-bearing payload. Recognizing them is the fix; rendering them
   * is what the columns are for (the episode ordinal is not the round index,
   * and the anchor alone cannot say whether it was chosen or walked to).
   */
  test("renders the repair iteration, parent depth and weakness key", () => {
    const withRepair = payload() as { episodes: Record<string, unknown>[] };
    withRepair.episodes.push({
      ...withRepair.episodes[0],
      episode_id: 1,
      lane: "repair",
      parent_episode_id: 0,
      repair_decision: {
        iteration_index: 2,
        parent_depth: 3,
      },
      incumbent_target_gap_before: { gap_index: 3, sse: 0.2473, axes: {} },
    });

    const output = render(withRepair);

    expect(output).toContain("iteration");
    expect(output).toContain("parent depth");
    expect(output).toContain("weak sse");
    expect(output).toContain("0.2473");
    // ... and none of the three is reported as a field the tool cannot read.
    expect(output).not.toContain("repair_decision");
    expect(output).not.toContain("incumbent_target_gap_before");
  });

  /**
   * `hard mrg` is `hard_remaining_frames / EST` and `EST` blends the episode
   * pace in at `structural_progress_fraction`. Both inputs used to be
   * recognized and never printed, so the walk showed the margin and neither
   * term it is made of.
   */
  test("renders the margin's numerator and the pace-blend weight", () => {
    const output = render(payload());
    expect(output).toContain("hard rem");
    expect(output).toContain("prog");
    // structural_progress_fraction 0 in the fixture, rendered at 3 decimals.
    expect(output).toContain("0.000");
  });

  /**
   * "Recognized" and "rendered" are different claims. The six fields that are
   * known and deliberately given no column are named in the legend, so their
   * absence reads as a decision rather than as an omission.
   */
  test("names the recognized fields it deliberately does not render", () => {
    const output = render(payload());
    expect(output).toContain("recognized, not given a column");
    for (
      const field of [
        "hard_overrun_frames",
        "episode_overrun_frames",
        "estimate_uncertainty_frames",
        "hard_completion_surplus_frames",
        "episode_completion_surplus_frames",
        "structural_startup_included",
      ]
    ) {
      expect(output).toContain(field);
    }
  });

  /**
   * Two different quantities ship under the word "slack" and used to print one
   * above the other undistinguished: the compile block's is the ESTIMATOR
   * ARTIFACT ratio (grows as B^(1-alpha), telemetry), the stats block's is the
   * V1 traversal-model DIFFICULTY coordinate (linear in B, live policy).
   */
  test("labels the two differently-defined slacks", () => {
    const output = render(payload(), { sim_frames: 799_359, budget_slack: 4.21 });
    expect(output).toContain("initial structural slack (artifact)");
    expect(output).toContain("budget_slack (traversal model V1)");
    // Neither label may be the bare word both quantities used to print under.
    expect(output).not.toMatch(/^ +initial structural slack +[\d.]/m);
    expect(output).not.toMatch(/^ +budget_slack +[\d.]/m);
  });

  test("rejects historical and structurally incomplete payloads", () => {
    expect(() => render({})).toThrow(/expected line\.compile-budget-telemetry\.v6/);
    expect(() => render({
      schema: "line.compile-budget-telemetry.v2",
      episodes: [],
      execution_intervals: [],
    })).toThrow(/expected line\.compile-budget-telemetry\.v6/);
    expect(() => render({
      schema: BUDGET_TELEMETRY_SCHEMA,
      episodes: [],
    })).toThrow(/missing V5 episodes or execution intervals/);
  });

  test("rejects a file that is not a telemetry object", () => {
    expect(() => render([1, 2, 3])).toThrow(/not a budget-telemetry object/);
  });
});
