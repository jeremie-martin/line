/**
 * The renderer is a debugging surface for an evolving payload: its contract is
 * "show what you recognize, never crash, never invent". These tests pin that
 * contract, not the exact column layout.
 */

import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeBudgetTelemetry } from "../scripts/v0/describe_budget_telemetry.ts";

function observation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event: "start",
    total_spent_frames: 0,
    hard_remaining_frames: 750_000,
    hard_overrun_frames: 0,
    attempt_spent_frames: 0,
    attempt_remaining_frames: 750_000,
    attempt_overrun_frames: 0,
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
    attempt_completion_margin: 14.23,
    attempt_completion_surplus_frames: 697_287,
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: "line.compile-budget-telemetry.v1",
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
    },
    segments: [
      {
        kind: "startup",
        attempt_id: 0,
        start_total_spent_frames: 0,
        end_total_spent_frames: 7_814,
        spent_frames: 7_814,
        stop_reason: "search_ready",
      },
    ],
    attempts: [
      {
        attempt_id: 0,
        kind: "initial",
        parent_attempt_id: null,
        search_seed: 0,
        has_fallback: false,
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
        local_budget_frames: 750_000,
        start: observation(),
        end: observation({ event: "end", total_spent_frames: 38_626 }),
        outcome: {
          stop_reason: "handoff_to_repair",
          end_total_spent_frames: 38_626,
          spent_frames: 38_626,
          completed: true,
          first_terminal_offset_frames: 38_626,
          accepted_improvement: null,
          censored: false,
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
  test("renders the compile, segment, attempt and observation story", () => {
    const output = render(payload());

    expect(output).toContain("line.compile-budget-telemetry.v1");
    expect(output).toContain("hard budget");
    expect(output).toContain("750,000");
    expect(output).toContain("hard overrun");
    expect(output).toContain("initial structural slack");
    expect(output).toContain("SEGMENTS (1)");
    expect(output).toContain("search_ready");
    expect(output).toContain("ATTEMPTS (1)");
    expect(output).toContain("handoff_to_repair");
    expect(output).toContain("OBSERVATION WALK");
    // Summary payloads have no observation array; the walk says what it walked.
    expect(output).toContain("start/end only");
  });

  test("walks every trace observation, not just start and end", () => {
    const traced = payload({ level: "trace" }) as { attempts: Record<string, unknown>[] };
    traced.attempts[0].observations = [
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
      attempts: Record<string, unknown>[];
    };
    extended.compile.initial_structural_applicability = "extrapolated_policy_budget";
    extended.compile.first_terminal_total_spent_frames = 20_751;
    extended.attempts[0].ceiling_source = "measured_cost_to_end";
    extended.attempts[0].some_future_attempt_field = 7;
    (extended.attempts[0].start as Record<string, unknown>).some_future_observation_field = 9;

    const output = render(extended);

    expect(output).toContain("initial structural applicability");
    expect(output).toContain("extrapolated_policy_budget");
    expect(output).toContain("first terminal at");
    expect(output).toContain("measured_cost_to_end");
    expect(output).toContain("UNRENDERED FIELDS");
    expect(output).toContain("some_future_attempt_field");
    expect(output).toContain("some_future_observation_field");
  });

  test("omits optional columns no attempt carries", () => {
    // ceiling_source is not in the v1 payload: an old sidecar must not grow a
    // column of nulls for it. The three repair fields are null on an initial
    // attempt, so their columns must disappear on a repair-free payload too.
    const output = render(payload());
    expect(output).not.toContain("ceiling from");
    expect(output).not.toContain("weak sse");
  });

  /**
   * The three repair fields are ALWAYS present on a repair attempt and were
   * documented first-class, yet the tool reported all three as unrecognized on
   * every repair-bearing payload. Recognizing them is the fix; rendering them
   * is what the columns are for (the attempt ordinal is not the round index,
   * and the anchor alone cannot say whether it was chosen or walked to).
   */
  test("renders the repair round, upstream walk and weakness key", () => {
    const withRepair = payload() as { attempts: Record<string, unknown>[] };
    withRepair.attempts.push({
      ...withRepair.attempts[0],
      attempt_id: 1,
      kind: "repair",
      parent_attempt_id: 0,
      repair_round_index: 2,
      anchor_upstream_offset: 3,
      incumbent_weak_gap_sse: 0.2473,
    });

    const output = render(withRepair);

    expect(output).toContain("round");
    expect(output).toContain("weak sse");
    expect(output).toContain("0.2473");
    // ... and none of the three is reported as a field the tool cannot read.
    expect(output).not.toContain("repair_round_index");
    expect(output).not.toContain("anchor_upstream_offset");
    expect(output).not.toContain("incumbent_weak_gap_sse");
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
        "attempt_overrun_frames",
        "estimate_uncertainty_frames",
        "hard_completion_surplus_frames",
        "attempt_completion_surplus_frames",
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

  test("survives a payload missing, nulling or mistyping every field it reads", () => {
    expect(() => render({})).not.toThrow();
    expect(() => render({ compile: null, segments: null, attempts: null })).not.toThrow();
    expect(() => render({ segments: [null, 7, "x"], attempts: [null, {}] })).not.toThrow();
    expect(() =>
      render({
        compile: { hard_budget_frames: "lots" },
        attempts: [{ attempt_id: {}, anchor: [], outcome: 5, start: "nope", observations: [{}] }],
      })
    ).not.toThrow();

    const output = render({ attempts: [{ attempt_id: 0 }] });
    expect(output).toContain("ATTEMPTS (1)");
    expect(output).toContain("null");
  });

  test("rejects a file that is not a telemetry object", () => {
    expect(() => render([1, 2, 3])).toThrow(/not a budget-telemetry object/);
  });
});
