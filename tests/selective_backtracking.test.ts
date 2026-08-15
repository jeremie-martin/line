import { describe, expect, test } from "vitest";
import {
  catchupAlternativeHasStablePriority,
  catchupAlternativeHasSufficientGain,
  parseFrontierTraversalPolicy,
  SelectiveAxisRegretController,
  valueExplorationBudgetFraction,
  valueProbeCandidateCount,
  valueProbeCandidateCountAtRoutePosition,
  valueProbeEmptyFallbackCandidateCount,
} from "../scripts/v0/optimizer/selective_backtracking.ts";

type Node = { gap: number; name: string };

const NO_EMPTY_POOL_RETRY = {
  normal_empty_full_width_retry_attempts: 0,
  normal_empty_full_width_retry_successes: 0,
  normal_empty_full_width_retry_requested_proposals: 0,
  normal_empty_full_width_retry_incremental_requested_proposals: 0,
  normal_empty_full_width_retry_candidate_geometry_evaluations: 0,
  normal_empty_full_width_retry_frames: 0,
} as const;

describe("selective-backtracking controller", () => {
  test("parses a strict categorical frontier policy", () => {
    expect(parseFrontierTraversalPolicy(undefined))
      .toBe("selective_axis_regret_catchup_value_initial_expire_10_first_advantage_handoff");
    expect(parseFrontierTraversalPolicy(""))
      .toBe("selective_axis_regret_catchup_value_initial_expire_10_first_advantage_handoff");
    expect(parseFrontierTraversalPolicy("dfs")).toBe("depth_first");
    expect(parseFrontierTraversalPolicy("off")).toBe("depth_first");
    expect(parseFrontierTraversalPolicy("0")).toBe("depth_first");
    expect(parseFrontierTraversalPolicy("selective-axis-regret-catchup"))
      .toBe("selective_axis_regret_catchup");
    expect(parseFrontierTraversalPolicy("selective-axis-regret-catchup-repair-incumbent-once"))
      .toBe("selective_axis_regret_catchup_repair_incumbent_once");
    expect(parseFrontierTraversalPolicy("selective-axis-regret-catchup-periodic-initial"))
      .toBe("selective_axis_regret_catchup_periodic_initial");
    expect(parseFrontierTraversalPolicy("selective-axis-regret-catchup-periodic-repair"))
      .toBe("selective_axis_regret_catchup_periodic_repair");
    expect(parseFrontierTraversalPolicy("selective-axis-regret-catchup-value-map"))
      .toBe("selective_axis_regret_catchup_value_map");
    expect(parseFrontierTraversalPolicy("selective-axis-regret-catchup-value-deferred-map"))
      .toBe("selective_axis_regret_catchup_value_deferred_map");
    expect(parseFrontierTraversalPolicy("selective-axis-regret-catchup-value-deferred-initial"))
      .toBe("selective_axis_regret_catchup_value_deferred_initial");
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-deferred-prefix-gate",
    )).toBe("selective_axis_regret_catchup_value_deferred_prefix_gate");
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-deferred-pass-only",
    )).toBe("selective_axis_regret_catchup_value_deferred_pass_only");
    expect(parseFrontierTraversalPolicy("selective-axis-regret-catchup-value-initial"))
      .toBe("selective_axis_regret_catchup_value_initial");
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-initial-progress-10",
    )).toBe("selective_axis_regret_catchup_value_initial_progress_10");
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-initial-expire-10",
    )).toBe("selective_axis_regret_catchup_value_initial_expire_10");
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-initial-expire-10-stable-priority",
    )).toBe("selective_axis_regret_catchup_value_initial_expire_10_stable_priority");
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-initial-expire-10-first-deficit-stop-005",
    )).toBe(
      "selective_axis_regret_catchup_value_initial_expire_10_first_deficit_stop_005",
    );
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-initial-expire-10-first-advantage-handoff",
    )).toBe(
      "selective_axis_regret_catchup_value_initial_expire_10_first_advantage_handoff",
    );
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-initial-expire-10-probe-breadth-3q",
    )).toBe(
      "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q",
    );
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-initial-expire-10-probe-breadth-3q-empty-retry",
    )).toBe(
      "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_empty_retry",
    );
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-initial-expire-10-probe-breadth-3q-after-first",
    )).toBe(
      "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_after_first",
    );
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-initial-expire-10-probe-breadth-3q-before-last",
    )).toBe(
      "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_before_last",
    );
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-initial-expire-10-probe-breadth-3q-positive-prefix",
    )).toBe(
      "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_positive_prefix",
    );
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-initial-expire-10-probe-breadth-3q-nonpositive-prefix",
    )).toBe(
      "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_nonpositive_prefix",
    );
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-initial-expire-10-probe-breadth-3q-no-refill",
    )).toBe(
      "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_no_refill",
    );
    expect(parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-value-initial-expire-10-run-proof",
    )).toBe("selective_axis_regret_catchup_value_initial_expire_10_run_proof");
    expect(() => parseFrontierTraversalPolicy("selective-axis-regret-catchup-proper-discrepancy"))
      .toThrow(/LR_FRONTIER_POLICY/);
    expect(() => parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-nested-discrepancy",
    )).toThrow(/LR_FRONTIER_POLICY/);
    expect(() => parseFrontierTraversalPolicy(
      "selective-axis-regret-catchup-yielding-discrepancy",
    )).toThrow(/LR_FRONTIER_POLICY/);
    expect(() => parseFrontierTraversalPolicy("selective-axis-regret-catchup-one-discrepancy"))
      .toThrow(/LR_FRONTIER_POLICY/);
    expect(() => parseFrontierTraversalPolicy("selective-axis-regret-catchup-repair-incumbent"))
      .toThrow(/LR_FRONTIER_POLICY/);
    expect(() => parseFrontierTraversalPolicy("selective-axis-regret-catchup-second-chance"))
      .toThrow(/LR_FRONTIER_POLICY/);
    expect(() => parseFrontierTraversalPolicy("selective-axis-regret-catchup-multi-sibling"))
      .toThrow(/LR_FRONTIER_POLICY/);
    expect(() => parseFrontierTraversalPolicy("selective-axis-regret-catchup-reserve-225"))
      .toThrow(/LR_FRONTIER_POLICY/);
    expect(() => parseFrontierTraversalPolicy("selective-axis-regret-catchup-shallow6-trigger-015"))
      .toThrow(/LR_FRONTIER_POLICY/);
    expect(() => parseFrontierTraversalPolicy("selective-axis-regret-catchup-shallow-trigger-015"))
      .toThrow(/LR_FRONTIER_POLICY/);
    expect(() => parseFrontierTraversalPolicy("selective-axis-regret-catchup-trigger-015"))
      .toThrow(/LR_FRONTIER_POLICY/);
    expect(() => parseFrontierTraversalPolicy("selective-axis-regret"))
      .toThrow(/LR_FRONTIER_POLICY/);
    expect(() => parseFrontierTraversalPolicy("best-first")).toThrow(/LR_FRONTIER_POLICY/);
  });

  test("scales only value-probe breadth and preserves the production floor", () => {
    const probePolicy =
      "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q";
    expect(valueProbeCandidateCount(probePolicy, 81, 8)).toBe(61);
    expect(valueProbeCandidateCount(probePolicy, 8, 8)).toBe(8);
    const retryPolicy =
      "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_empty_retry";
    expect(valueProbeCandidateCount(retryPolicy, 81, 8)).toBe(61);
    expect(valueProbeEmptyFallbackCandidateCount(retryPolicy, 81)).toBe(81);
    expect(valueProbeEmptyFallbackCandidateCount(probePolicy, 81)).toBeNull();
    const afterFirst =
      "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_after_first";
    const beforeLast =
      "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_before_last";
    const positivePrefix =
      "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_positive_prefix";
    const nonpositivePrefix =
      "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_nonpositive_prefix";
    const noRefill =
      "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_no_refill";
    expect(valueProbeCandidateCount(noRefill, 81, 8)).toBe(61);
    expect(valueProbeCandidateCount(noRefill, 8, 8)).toBe(8);
    expect(valueExplorationBudgetFraction(noRefill)).toBe(0.1125);
    expect(valueExplorationBudgetFraction(probePolicy)).toBe(0.15);
    expect(valueProbeCandidateCountAtRoutePosition(afterFirst, 81, 8, 0, 2)).toBe(81);
    expect(valueProbeCandidateCountAtRoutePosition(afterFirst, 81, 8, 1, 1)).toBe(61);
    expect(valueProbeCandidateCountAtRoutePosition(beforeLast, 81, 8, 0, 2)).toBe(61);
    expect(valueProbeCandidateCountAtRoutePosition(beforeLast, 81, 8, 1, 1)).toBe(81);
    expect(valueProbeCandidateCountAtRoutePosition(afterFirst, 81, 8, 0, 1)).toBe(81);
    expect(valueProbeCandidateCountAtRoutePosition(beforeLast, 81, 8, 0, 1)).toBe(81);
    expect(valueProbeCandidateCountAtRoutePosition(positivePrefix, 81, 8, 0, 2, null))
      .toBe(81);
    expect(valueProbeCandidateCountAtRoutePosition(positivePrefix, 81, 8, 1, 1, 0.001))
      .toBe(61);
    expect(valueProbeCandidateCountAtRoutePosition(positivePrefix, 81, 8, 1, 1, 0))
      .toBe(81);
    expect(valueProbeCandidateCountAtRoutePosition(positivePrefix, 81, 8, 1, 1, -0.001))
      .toBe(81);
    expect(valueProbeCandidateCountAtRoutePosition(nonpositivePrefix, 81, 8, 0, 2, null))
      .toBe(81);
    expect(valueProbeCandidateCountAtRoutePosition(nonpositivePrefix, 81, 8, 1, 1, 0.001))
      .toBe(81);
    expect(valueProbeCandidateCountAtRoutePosition(nonpositivePrefix, 81, 8, 1, 1, 0))
      .toBe(61);
    expect(valueProbeCandidateCountAtRoutePosition(nonpositivePrefix, 81, 8, 1, 1, -0.001))
      .toBe(61);
    expect(valueProbeCandidateCountAtRoutePosition(afterFirst, 8, 8, 1, 2)).toBe(8);
    expect(() => valueProbeCandidateCountAtRoutePosition(afterFirst, 81, 8, -1, 2))
      .toThrow(/route position/);
    expect(valueProbeCandidateCount(
      "selective_axis_regret_catchup_value_initial_expire_10",
      81,
      8,
    )).toBe(81);
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: probePolicy,
    });
    expect(controller.snapshot()).toMatchObject({
      catchup_priority_rule: "endpoint_gain",
      value_probe_candidate_breadth_rule: "three_quarter_after_floor",
      value_probe_candidate_breadth_scale: 0.75,
    });
    const retryController = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: retryPolicy,
    });
    expect(retryController.snapshot()).toMatchObject({
      catchup_priority_rule: "endpoint_gain",
      value_probe_candidate_breadth_rule: "three_quarter_after_floor_empty_full_retry",
      value_probe_candidate_breadth_scale: 0.75,
    });
    expect(new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: afterFirst,
    }).snapshot()).toMatchObject({
      value_probe_candidate_breadth_rule: "full_first_then_three_quarter_after_floor",
      value_probe_candidate_breadth_scale: 0.75,
    });
    expect(new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: beforeLast,
    }).snapshot()).toMatchObject({
      value_probe_candidate_breadth_rule: "three_quarter_after_floor_then_full_last",
      value_probe_candidate_breadth_scale: 0.75,
    });
    expect(new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: positivePrefix,
    }).snapshot()).toMatchObject({
      value_probe_candidate_breadth_rule:
        "full_first_then_three_quarter_while_prefix_positive",
      value_probe_candidate_breadth_scale: 0.75,
    });
    expect(new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: nonpositivePrefix,
    }).snapshot()).toMatchObject({
      value_probe_candidate_breadth_rule:
        "full_first_then_three_quarter_while_prefix_nonpositive",
      value_probe_candidate_breadth_scale: 0.75,
    });
    expect(new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: noRefill,
    }).snapshot()).toMatchObject({
      value_probe_candidate_breadth_rule: "three_quarter_after_floor",
      value_probe_candidate_breadth_scale: 0.75,
      value_live_exploration_budget_fraction: 0.1125,
      value_live_min_gap_progress: 0.10,
    });
  });

  test("uses the exact sign of equal-depth axis gain", () => {
    expect(catchupAlternativeHasSufficientGain(0.5, 0.4999)).toBe(true);
    expect(catchupAlternativeHasSufficientGain(0.5, 0.5)).toBe(false);
    expect(catchupAlternativeHasSufficientGain(0.5, 0.5001)).toBe(false);
  });

  test("gives stable priority only to endpoint winners positive at every checkpoint", () => {
    expect(catchupAlternativeHasStablePriority(0.5, 0.49, true)).toBe(true);
    expect(catchupAlternativeHasStablePriority(0.5, 0.49, false)).toBe(false);
    expect(catchupAlternativeHasStablePriority(0.5, 0.5, true)).toBe(false);
    expect(catchupAlternativeHasStablePriority(0.5, 0.51, true)).toBe(false);
  });

  test("admits one exact-rewind periodic tournament only in its configured lane", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_periodic_initial",
    });
    const parent = { gap: 5, name: "parent" };
    const leader = { gap: 6, name: "leader" };
    const alternative = { gap: 6, name: "alternative" };
    const atEight = { gap: 9, name: "at-eight" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 5,
      axisLoss: 0.1,
    });
    controller.observeExpansion({
      parent: leader,
      children: [atEight],
      contactExpansion: false,
      contactOrdinal: 6,
      axisLoss: 0.11,
    });
    const assessment = {
      execution_remaining_frames: 300_000,
      conservative_terminal_work_frames: 100_000,
      estimated_probe_work_frames: 40_000,
      terminal_reserve_frames: 125_000,
      exploration_allowance_frames: 112_500,
      exploration_spent_frames: 0,
      exploration_remaining_frames: 112_500,
      local_probe_allowance_frames: 112_500,
      admitted: true,
      reason: "admitted" as const,
    };
    const decision = controller.consider({
      node: atEight,
      contactOrdinal: 8,
      contactBoundary: true,
      axisLoss: 0.12,
      executionCeilingReached: false,
      totalSpentFrames: 450_000,
      lane: "initial",
      alternativeAvailable: (node) => node === alternative,
      // Periodic admission uses the explicit episode reserve below; the old
      // compile-wide binary pressure gate remains production-regret-only.
      alternativeDeadline: () => ({ margin: 1, pressured: true }),
      explorationBudgetAssessment: (_alternative, fromGapIndex, spent) => {
        expect(fromGapIndex).toBe(9);
        expect(spent).toBe(0);
        return assessment;
      },
    });
    expect(decision).toMatchObject({
      alternative,
      contactAdvance: 3,
      triggerSignal: "periodic_exploration",
    });
    controller.markSuspended(atEight);
    controller.finishCatchup(decision!, {
      outcome: "alternative_selected",
      selectedAlternativeOrdinal: 1,
      selectedRouteOrdinal: 1,
      probes: [{
        route_ordinal: 1,
        route_kind: "causal_alternative",
        alternative_ordinal: 1,
        outcome: "reached_target",
        end_gap_index: 9,
        probe_nodes_processed: 2,
        probe_frames: 35_000,
        ranked_option_calls: 2,
        requested_normal_proposals: 200,
        candidate_geometry_evaluations: 180,
        ...NO_EMPTY_POOL_RETRY,
        atomic_node_primary_normal_requested_proposals: [100, 100],
        atomic_node_starting_prefix_axis_loss_gain: [null, 0.01],
        atomic_node_frames: [15_000, 20_000],
        tail_completion_attempts: 0,
        budget_allowance_frames: null,
        budget_remaining_before_yield: null,
        estimated_next_node_frames: null,
        axis_loss: 0.11,
        local_fallback_choices: [],
      }],
      catchupAxisLoss: 0.11,
    });
    expect(controller.snapshot()).toMatchObject({
      periodic_schedule_checks: 1,
      periodic_exact_rewind_opportunities: 1,
      periodic_admitted: 1,
      periodic_probe_frames: 35_000,
      periodic_probe_nodes_processed: 2,
      selective_backtracks_by_signal: {
        branch_regret: 0,
        repair_incumbent_regret: 0,
        periodic_exploration: 1,
      },
      periodic_opportunities: [{ outcome: "admitted", budget: assessment }],
      events: [{
        trigger_signal: "periodic_exploration",
        periodic_budget: assessment,
      }],
    });
  });

  test("records periodic reserve suppression without changing traversal", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_periodic_repair",
    });
    const parent = { gap: 5, name: "parent" };
    const leader = { gap: 6, name: "leader" };
    const alternative = { gap: 6, name: "alternative" };
    const atEight = { gap: 9, name: "at-eight" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 5,
      axisLoss: 0,
    });
    controller.observeExpansion({
      parent: leader,
      children: [atEight],
      contactExpansion: false,
      contactOrdinal: 6,
      axisLoss: 0,
    });
    expect(controller.consider({
      node: atEight,
      contactOrdinal: 8,
      contactBoundary: true,
      axisLoss: 0.01,
      incumbentAxisLoss: 0.01,
      repairAttemptIndex: 2,
      executionCeilingReached: false,
      totalSpentFrames: 700_000,
      lane: "repair",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
      explorationBudgetAssessment: () => ({
        execution_remaining_frames: 50_000,
        conservative_terminal_work_frames: 60_000,
        estimated_probe_work_frames: 20_000,
        terminal_reserve_frames: 75_000,
        exploration_allowance_frames: 112_500,
        exploration_spent_frames: 0,
        exploration_remaining_frames: 112_500,
        local_probe_allowance_frames: 0,
        admitted: false,
        reason: "terminal_reserve",
      }),
    })).toBeNull();
    expect(controller.snapshot()).toMatchObject({
      periodic_schedule_checks: 1,
      periodic_exact_rewind_opportunities: 1,
      periodic_admitted: 0,
      periodic_terminal_reserve_suppressed: 1,
      selective_backtracks: 0,
      periodic_opportunities: [{ outcome: "terminal_reserve" }],
    });
  });

  test("maps first value-density crossing and later admission without changing traversal", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_value_map",
    });
    const parent = { gap: 1, name: "parent" };
    const leader = { gap: 2, name: "leader" };
    const alternative = { gap: 2, name: "alternative" };
    const first = { gap: 4, name: "first" };
    const second = { gap: 5, name: "second" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0.1,
    });
    controller.observeExpansion({
      parent: leader,
      children: [first],
      contactExpansion: false,
      contactOrdinal: 2,
      axisLoss: 0.1,
    });
    const assessment = (admitted: boolean) => ({
      execution_remaining_frames: admitted ? 300_000 : 100_000,
      conservative_terminal_work_frames: 100_000,
      estimated_probe_work_frames: 10_000,
      terminal_reserve_frames: 125_000,
      exploration_allowance_frames: 112_500,
      exploration_spent_frames: 0,
      exploration_remaining_frames: 112_500,
      local_probe_allowance_frames: admitted ? 112_500 : 0,
      admitted,
      reason: admitted ? "admitted" as const : "terminal_reserve" as const,
    });
    expect(controller.consider({
      node: first,
      contactOrdinal: 4,
      contactBoundary: true,
      axisLoss: 0.13,
      executionCeilingReached: false,
      totalSpentFrames: 200_000,
      lane: "initial",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 1, pressured: false }),
      explorationBudgetAssessment: () => assessment(false),
    })).toBeNull();
    controller.observeExpansion({
      parent: first,
      children: [second],
      contactExpansion: false,
      contactOrdinal: 4,
      axisLoss: 0.13,
    });
    expect(controller.consider({
      node: second,
      contactOrdinal: 5,
      contactBoundary: true,
      axisLoss: 0.13,
      executionCeilingReached: false,
      totalSpentFrames: 220_000,
      lane: "initial",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 1, pressured: false }),
      explorationBudgetAssessment: () => assessment(true),
    })).toBeNull();

    const snapshot = controller.snapshot();
    expect(snapshot.selective_backtracks).toBe(0);
    expect(snapshot.value_opportunities_by_density).toEqual({
      "0.005": { crossed_watches: 1, admissible_watches: 1 },
      "0.010": { crossed_watches: 1, admissible_watches: 1 },
      "0.020": { crossed_watches: 1, admissible_watches: 1 },
      "0.040": { crossed_watches: 0, admissible_watches: 0 },
    });
    expect(snapshot.value_opportunities).toHaveLength(3);
    expect(snapshot.value_opportunities[0]).toMatchObject({
      watch_id: 1,
      threshold: 0.005,
      crossing: {
        lane: "initial",
        contact_ordinal: 4,
        contact_advance: 3,
        axis_loss_delta: 0.03,
        value_density_per_10k_estimated_frames: 0.03,
        budget: { admitted: false, reason: "terminal_reserve" },
      },
      first_admission: {
        contact_ordinal: 5,
        contact_advance: 4,
        budget: { admitted: true, reason: "admitted" },
      },
    });
  });

  test("retains and terminal-ranks an exact deferred value opportunity without acting", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_value_deferred_map",
    });
    const parent = { gap: 1, name: "parent" };
    const leader = { gap: 2, name: "leader" };
    const alternative = { gap: 2, name: "alternative" };
    const current = { gap: 5, name: "current" };
    const terminal = { gap: 10, name: "terminal" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0.10,
    });
    controller.observeExpansion({
      parent: leader,
      children: [current],
      contactExpansion: false,
      contactOrdinal: 2,
      axisLoss: 0.10,
    });
    expect(controller.consider({
      node: current,
      contactOrdinal: 5,
      contactBoundary: true,
      gapProgress: 0.50,
      axisLoss: 0.15,
      executionCeilingReached: false,
      totalSpentFrames: 200_000,
      lane: "initial",
      alternativeAvailable: (node) => node === alternative,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
      explorationBudgetAssessment: () => ({
        execution_remaining_frames: 550_000,
        conservative_terminal_work_frames: 100_000,
        estimated_probe_work_frames: 10_000,
        terminal_reserve_frames: 125_000,
        exploration_allowance_frames: 112_500,
        exploration_spent_frames: 0,
        exploration_remaining_frames: 112_500,
        local_probe_allowance_frames: 112_500,
        admitted: true,
        reason: "admitted",
      }),
    })).toBeNull();
    const decision = controller.assessDeferredValueAtFirstTerminal({
      incumbent: terminal,
      firstTerminalTotalSpentFrames: 300_000,
      firstTerminalTrackHash: "a".repeat(64),
      remainingHardBudgetFrames: 450_000,
      remainingRepairBudgetFrames: 400_000,
      searchPolicyBudgetFrames: 750_000,
      explorationAllowanceFrames: 300_000,
      currentOnIncumbentPath: (node) => node === current,
      alternativeAvailable: (node) => node === alternative,
      estimatedSuffixWorkFrames: () => 50_000,
    });
    expect(decision).toMatchObject({
      watchId: 1,
      current,
      alternative,
      terminal: {
        estimated_suffix_work_frames: 50_000,
        affordable: true,
        reason: "admitted",
        affordable_rank: 1,
      },
    });
    expect(decision?.terminal.terminal_value_density_per_10k_estimated_frames)
      .toBeCloseTo(0.01);
    expect(controller.snapshot()).toMatchObject({
      selective_backtracks: 0,
      deferred_value_crossings: 1,
      deferred_value_collected: 1,
      deferred_value_assessed: 1,
      deferred_value_incumbent_path: 1,
      deferred_value_affordable: 1,
      deferred_value_first_terminal_track_hash: "a".repeat(64),
      deferred_value_opportunities: [{
        outcome: "collected",
        terminal: { affordable: true, affordable_rank: 1 },
      }],
    });
    expect(() => controller.assessDeferredValueAtFirstTerminal({
      incumbent: terminal,
      firstTerminalTotalSpentFrames: 300_000,
      firstTerminalTrackHash: "a".repeat(64),
      remainingHardBudgetFrames: 450_000,
      remainingRepairBudgetFrames: 400_000,
      searchPolicyBudgetFrames: 750_000,
      explorationAllowanceFrames: 300_000,
      currentOnIncumbentPath: () => true,
      alternativeAvailable: () => true,
      estimatedSuffixWorkFrames: () => 50_000,
    })).toThrow(/sealed more than once/);
  });

  test("records exactly one rank-one deferred suffix attempt", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_value_deferred_initial",
    });
    const attempt = {
      watch_id: 7,
      affordable_rank: 1,
      start_gap_index: 4,
      start_total_spent_frames: 300_000,
      end_total_spent_frames: 380_000,
      estimated_suffix_work_frames: 75_000,
      local_allowance_frames: 300_000,
      execution_ceiling_frames: 600_000,
      outcome: "terminal_reached" as const,
      nodes_processed: 5,
      atomic_node_frames: [10_000, 20_000, 15_000, 20_000, 15_000],
      ranked_option_calls: 5,
      requested_normal_proposals: 400,
      candidate_geometry_evaluations: 380,
      tail_completion_attempts: 0,
      terminal_node_evaluations: 1,
      register_improvements: 1,
      terminal_register_improvements: 1,
      remaining_pass_nodes_returned: 12,
      remaining_fallback_nodes_returned: 2,
      budget_remaining_before_yield: null,
      estimated_next_node_frames: null,
      progress_checkpoints: [],
      pass_frontier_gate: null,
      prefix_gate: null,
    };
    controller.recordDeferredValueAttempt(attempt);
    expect(controller.snapshot().deferred_value_attempts).toEqual([attempt]);
    expect(() => controller.recordDeferredValueAttempt(attempt))
      .toThrow(/more than one suffix attempt/);
  });

  test("records a pass-frontier return without conflating it with atomic work", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_value_deferred_pass_only",
    });
    controller.recordDeferredValueAttempt({
      watch_id: 11,
      affordable_rank: 1,
      start_gap_index: 4,
      start_total_spent_frames: 300_000,
      end_total_spent_frames: 340_000,
      estimated_suffix_work_frames: 75_000,
      local_allowance_frames: 300_000,
      execution_ceiling_frames: 600_000,
      outcome: "fallback_frontier_return",
      nodes_processed: 2,
      atomic_node_frames: [20_000, 20_000],
      ranked_option_calls: 2,
      requested_normal_proposals: 160,
      candidate_geometry_evaluations: 152,
      tail_completion_attempts: 0,
      terminal_node_evaluations: 0,
      register_improvements: 0,
      terminal_register_improvements: 0,
      remaining_pass_nodes_returned: 0,
      remaining_fallback_nodes_returned: 3,
      budget_remaining_before_yield: null,
      estimated_next_node_frames: null,
      progress_checkpoints: [],
      pass_frontier_gate: {
        decision: "fallback_return",
        checkpoint: {
          selection_ordinal: 3,
          selection_total_spent_frames: 340_000,
          spent_frames_since_attempt_start: 40_000,
          remaining_local_allowance_frames: 260_000,
          gap_index: 8,
          contact_ordinal: 5,
          skipped_contacts: 1,
          local_pass_frontier_size: 0,
          local_fallback_frontier_size: 3,
        },
      },
      prefix_gate: null,
    });
    const [attempt] = controller.snapshot().deferred_value_attempts;
    expect(attempt?.outcome).toBe("fallback_frontier_return");
    expect(attempt?.pass_frontier_gate?.checkpoint?.selection_ordinal).toBe(3);
    expect(attempt?.atomic_node_frames).toHaveLength(2);
  });

  test("ranks simultaneous initial opportunities by density before lineage order", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_value_initial",
    });
    const root = { gap: 1, name: "root" };
    const firstLeader = { gap: 2, name: "first-leader" };
    const highDensityAlternative = { gap: 2, name: "high-density" };
    const secondLeader = { gap: 3, name: "second-leader" };
    const lowDensityAlternative = { gap: 3, name: "low-density" };
    const current = { gap: 5, name: "current" };
    controller.observeExpansion({
      parent: root,
      children: [firstLeader, highDensityAlternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0.10,
    });
    controller.observeExpansion({
      parent: firstLeader,
      children: [secondLeader, lowDensityAlternative],
      contactExpansion: true,
      contactOrdinal: 2,
      axisLoss: 0.13,
    });
    controller.observeExpansion({
      parent: secondLeader,
      children: [current],
      contactExpansion: false,
      contactOrdinal: 3,
      axisLoss: 0.13,
    });
    const decision = controller.consider({
      node: current,
      contactOrdinal: 5,
      contactBoundary: true,
      axisLoss: 0.15,
      executionCeilingReached: false,
      totalSpentFrames: 200_000,
      lane: "initial",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
      explorationBudgetAssessment: (alternative) => {
        const estimated = alternative === highDensityAlternative ? 10_000 : 5_000;
        return {
          execution_remaining_frames: 500_000,
          conservative_terminal_work_frames: 100_000,
          estimated_probe_work_frames: estimated,
          terminal_reserve_frames: 125_000,
          exploration_allowance_frames: 112_500,
          exploration_spent_frames: 0,
          exploration_remaining_frames: 112_500,
          local_probe_allowance_frames: 112_500,
          admitted: true,
          reason: "admitted",
        };
      },
    });
    expect(decision).toMatchObject({
      alternative: highDensityAlternative,
      triggerSignal: "value_exploration",
      explorationBudget: { local_probe_allowance_frames: 112_500 },
    });
    expect(decision?.axisLossDelta).toBeCloseTo(0.05);
    expect(controller.snapshot()).toMatchObject({
      value_live_crossings: 2,
      value_live_admitted: 1,
      value_live_ranked_out: 1,
      selective_backtracks_by_signal: { value_exploration: 1 },
      value_live_opportunities: [
        { watch_id: 1, outcome: "admitted", affordable_rank: 1 },
        { watch_id: 2, outcome: "ranked_out", affordable_rank: 2 },
      ],
    });
  });

  test("keeps production regret ahead of value exploration and value out of repair", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_value_initial",
    });
    const parent = { gap: 1, name: "parent" };
    const leader = { gap: 2, name: "leader" };
    const alternative = { gap: 2, name: "alternative" };
    const current = { gap: 5, name: "current" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0.1,
    });
    controller.observeExpansion({
      parent: leader,
      children: [current],
      contactExpansion: false,
      contactOrdinal: 2,
      axisLoss: 0.1,
    });
    const input = {
      node: current,
      contactOrdinal: 4,
      contactBoundary: true,
      axisLoss: 0.31,
      executionCeilingReached: false,
      totalSpentFrames: 100_000,
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
      explorationBudgetAssessment: () => ({
        execution_remaining_frames: 500_000,
        conservative_terminal_work_frames: 100_000,
        estimated_probe_work_frames: 10_000,
        terminal_reserve_frames: 125_000,
        exploration_allowance_frames: 112_500,
        exploration_spent_frames: 0,
        exploration_remaining_frames: 112_500,
        local_probe_allowance_frames: 112_500,
        admitted: true,
        reason: "admitted" as const,
      }),
    };
    expect(controller.consider({ ...input, lane: "initial" })).toMatchObject({
      triggerSignal: "branch_regret",
    });
    expect(controller.snapshot()).toMatchObject({
      value_live_admitted: 0,
      value_live_production_priority: 1,
      selective_backtracks_by_signal: {
        branch_regret: 1,
        value_exploration: 0,
      },
    });

    const repairController = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_value_initial",
    });
    repairController.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0.1,
    });
    repairController.observeExpansion({
      parent: leader,
      children: [current],
      contactExpansion: false,
      contactOrdinal: 2,
      axisLoss: 0.1,
    });
    expect(repairController.consider({
      ...input,
      axisLoss: 0.15,
      lane: "repair",
    })).toBeNull();
    expect(repairController.snapshot().value_live_crossings).toBe(0);
  });

  test("defers value exploration until normalized gap progress reaches ten percent", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_value_initial_progress_10",
    });
    const parent = { gap: 1, name: "parent" };
    const leader = { gap: 2, name: "leader" };
    const alternative = { gap: 2, name: "alternative" };
    const early = { gap: 4, name: "early" };
    const mature = { gap: 5, name: "mature" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0.1,
      childAxisLosses: [0.12, 0.10],
    });
    controller.observeExpansion({
      parent: leader,
      children: [early],
      contactExpansion: false,
      contactOrdinal: 2,
      axisLoss: 0.1,
    });
    const assessment = () => ({
      execution_remaining_frames: 500_000,
      conservative_terminal_work_frames: 100_000,
      estimated_probe_work_frames: 10_000,
      terminal_reserve_frames: 125_000,
      exploration_allowance_frames: 112_500,
      exploration_spent_frames: 0,
      exploration_remaining_frames: 112_500,
      local_probe_allowance_frames: 112_500,
      admitted: true,
      reason: "admitted" as const,
    });
    const common = {
      contactBoundary: true,
      axisLoss: 0.14,
      executionCeilingReached: false,
      totalSpentFrames: 100_000,
      lane: "initial" as const,
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
      explorationBudgetAssessment: assessment,
      axisWindow: (fromGapIndex, throughGapIndex) => {
        expect(fromGapIndex).toBe(1);
        expect(throughGapIndex).toBe(5);
        return { axisCount: 4, axisSse: 0.04, axisLoss: 0.1 };
      },
    };
    expect(controller.consider({
      ...common,
      node: early,
      contactOrdinal: 4,
      gapProgress: 0.09,
    })).toBeNull();
    expect(controller.snapshot()).toMatchObject({
      value_live_min_gap_progress: 0.1,
      value_live_progress_suppressed_watches: 1,
      value_live_crossings: 0,
    });
    controller.observeExpansion({
      parent: early,
      children: [mature],
      contactExpansion: false,
      contactOrdinal: 4,
      axisLoss: 0.14,
    });
    expect(controller.consider({
      ...common,
      node: mature,
      contactOrdinal: 5,
      gapProgress: 0.10,
    })).toMatchObject({
      alternative,
      triggerSignal: "value_exploration",
    });
    expect(controller.snapshot()).toMatchObject({
      value_live_progress_suppressed_watches: 1,
      value_live_crossings: 1,
      value_live_admitted: 1,
      value_live_opportunities: [{
        point: {
          gap_progress: 0.1,
          branch_preferred_axis_loss: 0.12,
          branch_alternative_axis_loss: 0.10,
          branch_alternative_axis_loss_gain: 0.12 - 0.10,
          current_divergent_suffix_axis_count: 4,
          current_divergent_suffix_axis_sse: 0.04,
          current_divergent_suffix_axis_loss: 0.1,
        },
      }],
      events: [{
        branch_preferred_axis_loss: 0.12,
        branch_alternative_axis_loss: 0.10,
        branch_alternative_axis_loss_gain: 0.12 - 0.10,
        current_divergent_suffix_axis_count: 4,
        current_divergent_suffix_axis_sse: 0.04,
        current_divergent_suffix_axis_loss: 0.1,
      }],
    });
  });

  test("expires pre-horizon value opportunities without consuming production watches", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_value_initial_expire_10",
    });
    const parent = { gap: 1, name: "parent" };
    const leader = { gap: 2, name: "leader" };
    const alternative = { gap: 2, name: "alternative" };
    const early = { gap: 4, name: "early" };
    const later = { gap: 5, name: "later" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0.1,
    });
    controller.observeExpansion({
      parent: leader,
      children: [early],
      contactExpansion: false,
      contactOrdinal: 2,
      axisLoss: 0.1,
    });
    const common = {
      contactBoundary: true,
      axisLoss: 0.14,
      executionCeilingReached: false,
      totalSpentFrames: 100_000,
      lane: "initial" as const,
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
      explorationBudgetAssessment: () => ({
        execution_remaining_frames: 500_000,
        conservative_terminal_work_frames: 100_000,
        estimated_probe_work_frames: 10_000,
        terminal_reserve_frames: 125_000,
        exploration_allowance_frames: 112_500,
        exploration_spent_frames: 0,
        exploration_remaining_frames: 112_500,
        local_probe_allowance_frames: 112_500,
        admitted: true,
        reason: "admitted" as const,
      }),
    };
    expect(controller.consider({
      ...common,
      node: early,
      contactOrdinal: 4,
      gapProgress: 0.09,
    })).toBeNull();
    expect(controller.snapshot()).toMatchObject({
      value_live_crossings: 1,
      value_live_progress_expired_watches: 1,
      value_live_admitted: 0,
      value_live_opportunities: [{
        outcome: "progress_expired",
        point: { gap_progress: 0.09 },
      }],
    });
    controller.observeExpansion({
      parent: early,
      children: [later],
      contactExpansion: false,
      contactOrdinal: 4,
      axisLoss: 0.14,
    });
    expect(controller.consider({
      ...common,
      node: later,
      contactOrdinal: 5,
      gapProgress: 0.10,
    })).toBeNull();
    expect(controller.snapshot().value_live_crossings).toBe(1);
  });

  test("attributes an unstable endpoint winner whose immediate priority is suppressed", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_value_initial_expire_10_stable_priority",
    });
    const parent = { gap: 1, name: "parent" };
    const leader = { gap: 2, name: "leader" };
    const alternative = { gap: 2, name: "alternative" };
    const current = { gap: 4, name: "current" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0.10,
    });
    controller.observeExpansion({
      parent: leader,
      children: [current],
      contactExpansion: false,
      contactOrdinal: 2,
      axisLoss: 0.10,
    });
    const decision = controller.consider({
      node: current,
      contactOrdinal: 4,
      contactBoundary: true,
      axisLoss: 0.14,
      gapProgress: 0.20,
      executionCeilingReached: false,
      totalSpentFrames: 100_000,
      lane: "initial",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
      explorationBudgetAssessment: () => ({
        execution_remaining_frames: 500_000,
        conservative_terminal_work_frames: 100_000,
        estimated_probe_work_frames: 10_000,
        terminal_reserve_frames: 125_000,
        exploration_allowance_frames: 112_500,
        exploration_spent_frames: 0,
        exploration_remaining_frames: 112_500,
        local_probe_allowance_frames: 112_500,
        admitted: true,
        reason: "admitted",
      }),
    });
    expect(decision).toMatchObject({ triggerSignal: "value_exploration" });
    controller.recordCatchupCheckpoint(decision!, 1, "causal_alternative", 1, {
      gap_index: 3,
      contact_advance: 2,
      probe_nodes_processed: 1,
      probe_frames: 40,
      current_axis_loss: 0.13,
      alternative_axis_loss: 0.14,
      alternative_axis_loss_gain: -0.01,
    });
    controller.recordCatchupCheckpoint(decision!, 1, "causal_alternative", 1, {
      gap_index: 4,
      contact_advance: 3,
      probe_nodes_processed: 2,
      probe_frames: 90,
      current_axis_loss: 0.14,
      alternative_axis_loss: 0.13,
      alternative_axis_loss_gain: 0.01,
    });
    controller.finishCatchup(decision!, {
      outcome: "current_selected",
      selectedAlternativeOrdinal: null,
      selectedRouteOrdinal: null,
      probes: [{
        route_ordinal: 1,
        route_kind: "causal_alternative",
        alternative_ordinal: 1,
        outcome: "reached_target",
        end_gap_index: 4,
        probe_nodes_processed: 2,
        probe_frames: 90,
        ranked_option_calls: 2,
        requested_normal_proposals: 160,
        candidate_geometry_evaluations: 150,
        ...NO_EMPTY_POOL_RETRY,
        atomic_node_primary_normal_requested_proposals: [80, 80],
        atomic_node_starting_prefix_axis_loss_gain: [null, 0.01],
        atomic_node_frames: [40, 50],
        tail_completion_attempts: 0,
        budget_allowance_frames: 112_500,
        budget_remaining_before_yield: null,
        estimated_next_node_frames: null,
        axis_loss: 0.13,
        local_fallback_choices: [],
      }],
      catchupAxisLoss: 0.13,
      bestAlternativeAllCheckpointsPositive: false,
      endpointWinnerPrioritySuppressed: true,
    });
    const stableSnapshot = controller.snapshot();
    expect(stableSnapshot).toMatchObject({
      catchup_priority_rule: "all_checkpoints_positive",
      catchup_endpoint_winners_suppressed_unstable: 1,
      catchup_current_selected: 1,
      catchup_alternative_selected: 0,
      events: [{
        catchup_outcome: "current_selected",
        catchup_best_alternative_all_checkpoints_positive: false,
        catchup_endpoint_winner_priority_suppressed: true,
      }],
    });
    expect(stableSnapshot.events[0]?.catchup_axis_loss_gain).toBeCloseTo(0.01);
  });

  test("attributes a value probe stopped at a material first-checkpoint deficit", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy:
        "selective_axis_regret_catchup_value_initial_expire_10_first_deficit_stop_005",
    });
    const parent = { gap: 1, name: "parent" };
    const leader = { gap: 2, name: "leader" };
    const alternative = { gap: 2, name: "alternative" };
    const current = { gap: 4, name: "current" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0.10,
    });
    controller.observeExpansion({
      parent: leader,
      children: [current],
      contactExpansion: false,
      contactOrdinal: 2,
      axisLoss: 0.10,
    });
    const decision = controller.consider({
      node: current,
      contactOrdinal: 4,
      contactBoundary: true,
      axisLoss: 0.14,
      gapProgress: 0.20,
      executionCeilingReached: false,
      totalSpentFrames: 100_000,
      lane: "initial",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
      explorationBudgetAssessment: () => ({
        execution_remaining_frames: 500_000,
        conservative_terminal_work_frames: 100_000,
        estimated_probe_work_frames: 10_000,
        terminal_reserve_frames: 125_000,
        exploration_allowance_frames: 112_500,
        exploration_spent_frames: 0,
        exploration_remaining_frames: 112_500,
        local_probe_allowance_frames: 112_500,
        admitted: true,
        reason: "admitted",
      }),
    });
    controller.recordCatchupCheckpoint(decision!, 1, "causal_alternative", 1, {
      gap_index: 3,
      contact_advance: 2,
      probe_nodes_processed: 1,
      probe_frames: 40,
      current_axis_loss: 0.13,
      alternative_axis_loss: 0.14,
      alternative_axis_loss_gain: -0.01,
    });
    controller.finishCatchup(decision!, {
      outcome: "probe_first_deficit_stop",
      selectedAlternativeOrdinal: null,
      selectedRouteOrdinal: null,
      probes: [{
        route_ordinal: 1,
        route_kind: "causal_alternative",
        alternative_ordinal: 1,
        outcome: "probe_first_deficit_stop",
        end_gap_index: 3,
        probe_nodes_processed: 1,
        probe_frames: 40,
        ranked_option_calls: 1,
        requested_normal_proposals: 80,
        candidate_geometry_evaluations: 75,
        ...NO_EMPTY_POOL_RETRY,
        atomic_node_primary_normal_requested_proposals: [80],
        atomic_node_starting_prefix_axis_loss_gain: [null],
        atomic_node_frames: [40],
        tail_completion_attempts: 0,
        budget_allowance_frames: 112_500,
        budget_remaining_before_yield: null,
        estimated_next_node_frames: null,
        axis_loss: null,
        local_fallback_choices: [],
      }],
      catchupAxisLoss: null,
    });
    expect(controller.snapshot()).toMatchObject({
      catchup_priority_rule: "endpoint_gain",
      value_probe_stop_rule: "first_pre_target_deficit_005",
      value_probe_first_checkpoint_deficit_threshold: 0.005,
      catchup_probe_first_deficit_stops: 1,
      catchup_completed: 0,
      catchup_current_selected: 0,
      catchup_alternative_selected: 0,
      events: [{
        catchup_outcome: "probe_first_deficit_stop",
        catchup_end_gap_index: 3,
        catchup_selected_alternative_ordinal: null,
        catchup_selected_route_ordinal: null,
      }],
    });
  });

  test("attributes a strictly positive first-checkpoint partial handoff", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy:
        "selective_axis_regret_catchup_value_initial_expire_10_first_advantage_handoff",
    });
    const parent = { gap: 1, name: "parent" };
    const leader = { gap: 2, name: "leader" };
    const alternative = { gap: 2, name: "alternative" };
    const current = { gap: 4, name: "current" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0.10,
    });
    controller.observeExpansion({
      parent: leader,
      children: [current],
      contactExpansion: false,
      contactOrdinal: 2,
      axisLoss: 0.10,
    });
    const decision = controller.consider({
      node: current,
      contactOrdinal: 4,
      contactBoundary: true,
      axisLoss: 0.14,
      gapProgress: 0.20,
      executionCeilingReached: false,
      totalSpentFrames: 100_000,
      lane: "initial",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
      explorationBudgetAssessment: () => ({
        execution_remaining_frames: 500_000,
        conservative_terminal_work_frames: 100_000,
        estimated_probe_work_frames: 10_000,
        terminal_reserve_frames: 125_000,
        exploration_allowance_frames: 112_500,
        exploration_spent_frames: 0,
        exploration_remaining_frames: 112_500,
        local_probe_allowance_frames: 112_500,
        admitted: true,
        reason: "admitted",
      }),
    });
    controller.recordCatchupCheckpoint(decision!, 1, "causal_alternative", 1, {
      gap_index: 3,
      contact_advance: 2,
      probe_nodes_processed: 1,
      probe_frames: 40,
      current_axis_loss: 0.13,
      alternative_axis_loss: 0.12,
      alternative_axis_loss_gain: 0.01,
    });
    controller.finishCatchup(decision!, {
      outcome: "probe_first_advantage_handoff",
      selectedAlternativeOrdinal: 1,
      selectedRouteOrdinal: 1,
      probes: [{
        route_ordinal: 1,
        route_kind: "causal_alternative",
        alternative_ordinal: 1,
        outcome: "probe_first_advantage_handoff",
        end_gap_index: 3,
        probe_nodes_processed: 1,
        probe_frames: 40,
        ranked_option_calls: 1,
        requested_normal_proposals: 80,
        candidate_geometry_evaluations: 75,
        ...NO_EMPTY_POOL_RETRY,
        atomic_node_primary_normal_requested_proposals: [80],
        atomic_node_starting_prefix_axis_loss_gain: [null],
        atomic_node_frames: [40],
        tail_completion_attempts: 0,
        budget_allowance_frames: 112_500,
        budget_remaining_before_yield: null,
        estimated_next_node_frames: null,
        axis_loss: 0.12,
        local_fallback_choices: [],
      }],
      catchupAxisLoss: null,
    });
    const partial = { gap: 3, name: "partial alternative" };
    controller.markFirstAdvantageHandoff(partial, decision!);
    expect(controller.observeSelected(partial, 100_040)).toBe(false);
    expect(controller.snapshot()).toMatchObject({
      catchup_priority_rule: "endpoint_gain",
      value_probe_stop_rule: "first_pre_target_advantage",
      value_probe_first_checkpoint_deficit_threshold: null,
      value_probe_first_checkpoint_advantage_threshold: 0,
      catchup_probe_first_advantage_handoffs: 1,
      catchup_first_advantage_handoffs_selected: 1,
      catchup_completed: 0,
      catchup_current_selected: 0,
      catchup_alternative_selected: 0,
      events: [{
        catchup_outcome: "probe_first_advantage_handoff",
        catchup_end_gap_index: 3,
        catchup_axis_loss: null,
        first_advantage_handoff_total_spent_frames: 100_040,
        catchup_selected_alternative_ordinal: 1,
        catchup_selected_route_ordinal: 1,
      }],
    });
  });

  test("seals later value opportunities when the first run-proof probe cannot reach", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_value_initial_expire_10_run_proof",
    });
    const assessment = () => ({
      execution_remaining_frames: 500_000,
      conservative_terminal_work_frames: 100_000,
      estimated_probe_work_frames: 10_000,
      terminal_reserve_frames: 125_000,
      exploration_allowance_frames: 112_500,
      exploration_spent_frames: 0,
      exploration_remaining_frames: 112_500,
      local_probe_allowance_frames: 112_500,
      admitted: true,
      reason: "admitted" as const,
    });
    const arm = (prefix: string, gap: number, contact: number) => {
      const parent = { gap, name: `${prefix}-parent` };
      const leader = { gap: gap + 1, name: `${prefix}-leader` };
      const alternative = { gap: gap + 1, name: `${prefix}-alternative` };
      const current = { gap: gap + 3, name: `${prefix}-current` };
      controller.observeExpansion({
        parent,
        children: [leader, alternative],
        contactExpansion: true,
        contactOrdinal: contact,
        axisLoss: 0.10,
      });
      controller.observeExpansion({
        parent: leader,
        children: [current],
        contactExpansion: false,
        contactOrdinal: contact + 1,
        axisLoss: 0.10,
      });
      return { current, alternative, contact };
    };
    const consider = (branch: ReturnType<typeof arm>, axisLoss = 0.14) =>
      controller.consider({
        node: branch.current,
        contactOrdinal: branch.contact + 3,
        contactBoundary: true,
        axisLoss,
        gapProgress: 0.20,
        executionCeilingReached: false,
        totalSpentFrames: 100_000,
        lane: "initial",
        alternativeAvailable: (node) => node === branch.alternative,
        alternativeDeadline: () => ({ margin: 3, pressured: false }),
        explorationBudgetAssessment: assessment,
      });

    const first = consider(arm("first", 1, 1));
    expect(first).toMatchObject({ triggerSignal: "value_exploration" });
    controller.finishCatchup(first!, {
      outcome: "probe_dead_end",
      selectedAlternativeOrdinal: null,
      selectedRouteOrdinal: null,
      probes: [{
        route_ordinal: 1,
        route_kind: "causal_alternative",
        alternative_ordinal: 1,
        outcome: "probe_dead_end",
        end_gap_index: 2,
        probe_nodes_processed: 1,
        probe_frames: 1_000,
        ranked_option_calls: 1,
        requested_normal_proposals: 80,
        candidate_geometry_evaluations: 75,
        ...NO_EMPTY_POOL_RETRY,
        atomic_node_primary_normal_requested_proposals: [80],
        atomic_node_starting_prefix_axis_loss_gain: [null],
        atomic_node_frames: [1_000],
        tail_completion_attempts: 0,
        budget_allowance_frames: 112_500,
        budget_remaining_before_yield: null,
        estimated_next_node_frames: null,
        axis_loss: null,
        local_fallback_choices: [],
      }],
      catchupAxisLoss: null,
    });
    expect(controller.snapshot()).toMatchObject({
      value_live_run_proof_state: "sealed_after_failed_first_tournament",
      value_live_run_proof_first_event_index: 0,
      value_live_run_proof_first_outcome: "probe_dead_end",
      value_live_run_proof_first_reached_target: false,
    });

    const second = arm("second", 10, 5);
    expect(consider(second)).toBeNull();
    expect(controller.snapshot()).toMatchObject({
      value_live_crossings: 2,
      value_live_admitted: 1,
      value_live_run_proof_sealed_opportunities: 1,
      value_live_opportunities: [
        { outcome: "admitted" },
        { outcome: "run_proof_sealed", affordable_rank: null },
      ],
    });

    // Sealing consumes only the experimental value opportunity. The same
    // causal sibling remains eligible for production branch-regret traversal.
    expect(consider(second, 0.31)).toMatchObject({
      alternative: second.alternative,
      triggerSignal: "branch_regret",
    });
  });

  test("a reached first target proves the run even when the incumbent wins", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_value_initial_expire_10_run_proof",
    });
    const parent = { gap: 1, name: "parent" };
    const leader = { gap: 2, name: "leader" };
    const alternative = { gap: 2, name: "alternative" };
    const current = { gap: 4, name: "current" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0.10,
    });
    controller.observeExpansion({
      parent: leader,
      children: [current],
      contactExpansion: false,
      contactOrdinal: 2,
      axisLoss: 0.10,
    });
    const decision = controller.consider({
      node: current,
      contactOrdinal: 4,
      contactBoundary: true,
      axisLoss: 0.14,
      gapProgress: 0.20,
      executionCeilingReached: false,
      totalSpentFrames: 100_000,
      lane: "initial",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
      explorationBudgetAssessment: () => ({
        execution_remaining_frames: 500_000,
        conservative_terminal_work_frames: 100_000,
        estimated_probe_work_frames: 10_000,
        terminal_reserve_frames: 125_000,
        exploration_allowance_frames: 112_500,
        exploration_spent_frames: 0,
        exploration_remaining_frames: 112_500,
        local_probe_allowance_frames: 112_500,
        admitted: true,
        reason: "admitted" as const,
      }),
    });
    controller.finishCatchup(decision!, {
      outcome: "current_selected",
      selectedAlternativeOrdinal: null,
      selectedRouteOrdinal: null,
      probes: [{
        route_ordinal: 1,
        route_kind: "causal_alternative",
        alternative_ordinal: 1,
        outcome: "reached_target",
        end_gap_index: 4,
        probe_nodes_processed: 1,
        probe_frames: 1_000,
        ranked_option_calls: 1,
        requested_normal_proposals: 80,
        candidate_geometry_evaluations: 75,
        ...NO_EMPTY_POOL_RETRY,
        atomic_node_primary_normal_requested_proposals: [80],
        atomic_node_starting_prefix_axis_loss_gain: [null],
        atomic_node_frames: [1_000],
        tail_completion_attempts: 0,
        budget_allowance_frames: 112_500,
        budget_remaining_before_yield: null,
        estimated_next_node_frames: null,
        axis_loss: 0.15,
        local_fallback_choices: [],
      }],
      catchupAxisLoss: 0.15,
    });
    expect(controller.snapshot()).toMatchObject({
      value_live_run_proof_state: "first_tournament_reached_target",
      value_live_run_proof_first_outcome: "current_selected",
      value_live_run_proof_first_reached_target: true,
      value_live_run_proof_sealed_opportunities: 0,
    });
  });

  test("counts lower-threshold admissible watches without changing traversal", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap);
    const parent = { gap: 1, name: "parent" };
    const leader = { gap: 2, name: "leader" };
    const alternative = { gap: 2, name: "alternative" };
    const descendant = { gap: 3, name: "descendant" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0.1,
    });
    controller.observeExpansion({
      parent: leader,
      children: [descendant],
      contactExpansion: true,
      contactOrdinal: 2,
      axisLoss: 0.15,
    });
    expect(controller.consider({
      node: descendant,
      contactOrdinal: 3,
      axisLoss: 0.22,
      executionCeilingReached: false,
      totalSpentFrames: 10,
      lane: "initial",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
    })).toBeNull();
    expect(controller.snapshot()).toMatchObject({
      selective_backtracks: 0,
      mature_axis_loss_delta_max: 0.12,
      regret_opportunities_by_min_axis_loss_delta: {
        "0.05": { crossed_watches: 1, admissible_watches: 1 },
        "0.10": { crossed_watches: 1, admissible_watches: 1 },
        "0.15": { crossed_watches: 0, admissible_watches: 0 },
        "0.20": { crossed_watches: 0, admissible_watches: 0 },
      },
    });
  });

  test("maps repair-incumbent regret without changing traversal", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap);
    const parent = { gap: 1, name: "parent" };
    const leader = { gap: 2, name: "leader" };
    const alternative = { gap: 2, name: "alternative" };
    const descendant = { gap: 3, name: "descendant" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0,
    });
    controller.observeExpansion({
      parent: leader,
      children: [descendant],
      contactExpansion: true,
      contactOrdinal: 2,
      axisLoss: 0.05,
    });
    expect(controller.consider({
      node: descendant,
      contactOrdinal: 3,
      axisLoss: 0.11,
      incumbentAxisLoss: 0,
      executionCeilingReached: false,
      totalSpentFrames: 10,
      lane: "repair",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
    })).toBeNull();
    expect(controller.snapshot()).toMatchObject({
      selective_backtracks: 0,
      repair_incumbent_axis_loss_delta_max: 0.11,
      repair_incumbent_regret_opportunities_by_min_axis_loss_delta: {
        "0.00": { crossed_watches: 1, admissible_watches: 1 },
        "0.01": { crossed_watches: 1, admissible_watches: 1 },
        "0.02": { crossed_watches: 1, admissible_watches: 1 },
        "0.05": { crossed_watches: 1, admissible_watches: 1 },
        "0.10": { crossed_watches: 1, admissible_watches: 1 },
      },
      repair_incumbent_regret_opportunities_by_min_contact_advance: {
        "2": { crossed_watches: 1, admissible_watches: 1 },
        "3": { crossed_watches: 0, admissible_watches: 0 },
        "4": { crossed_watches: 0, admissible_watches: 0 },
        "5": { crossed_watches: 0, admissible_watches: 0 },
        "6": { crossed_watches: 0, admissible_watches: 0 },
      },
    });
  });

  test("maps delayed repair-incumbent maturity as nested causal opportunities", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap);
    const parent = { gap: 1, name: "parent" };
    const leader = { gap: 2, name: "leader" };
    const alternative = { gap: 2, name: "alternative" };
    const early = { gap: 3, name: "early" };
    const later = { gap: 4, name: "later" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0,
    });
    controller.observeExpansion({
      parent: leader,
      children: [early],
      contactExpansion: true,
      contactOrdinal: 2,
      axisLoss: 0.01,
    });
    const consider = (node: Node, contactOrdinal: number) => controller.consider({
      node,
      contactOrdinal,
      axisLoss: 0.05,
      incumbentAxisLoss: 0.01,
      executionCeilingReached: false,
      totalSpentFrames: 10,
      lane: "repair",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
    });
    expect(consider(early, 3)).toBeNull();
    controller.observeExpansion({
      parent: early,
      children: [later],
      contactExpansion: true,
      contactOrdinal: 3,
      axisLoss: 0.05,
    });
    expect(consider(later, 5)).toBeNull();
    expect(controller.snapshot().repair_incumbent_regret_opportunities_by_min_contact_advance)
      .toEqual({
        "2": { crossed_watches: 1, admissible_watches: 1 },
        "3": { crossed_watches: 1, admissible_watches: 1 },
        "4": { crossed_watches: 1, admissible_watches: 1 },
        "5": { crossed_watches: 0, admissible_watches: 0 },
        "6": { crossed_watches: 0, admissible_watches: 0 },
      });
  });

  test("fires once on a mature causal watch and names its concrete sibling", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap);
    const parent = { gap: 3, name: "parent" };
    const leader = { gap: 4, name: "leader" };
    const alternative = { gap: 4, name: "alternative" };
    const secondAlternative = { gap: 4, name: "second-alternative" };
    const descendant = { gap: 5, name: "descendant" };
    controller.observeRoot(parent);
    controller.observeExpansion({
      parent,
      children: [leader, alternative, secondAlternative],
      contactExpansion: true,
      contactOrdinal: 3,
      axisLoss: 0.4,
    });
    controller.observeExpansion({
      parent: leader,
      children: [descendant],
      contactExpansion: true,
      contactOrdinal: 4,
      axisLoss: 0.5,
    });

    const decision = controller.consider({
      node: descendant,
      contactOrdinal: 5,
      axisLoss: 0.61,
      executionCeilingReached: false,
      totalSpentFrames: 100,
      lane: "initial",
      alternativeAvailable: (node) => node === alternative || node === secondAlternative,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
    });
    expect(decision?.alternative).toBe(alternative);
    expect(decision?.alternatives).toEqual([alternative]);
    expect(decision?.contactAdvance).toBe(2);
    expect(decision?.gapRewind).toBe(1);
    controller.markSuspended(descendant);
    controller.recordCatchupCheckpoint(decision!, 1, "causal_alternative", 1, {
      gap_index: 5,
      contact_advance: 2,
      probe_nodes_processed: 1,
      probe_frames: 35,
      current_axis_loss: 0.61,
      alternative_axis_loss: 0.7,
      alternative_axis_loss_gain: -0.09,
    });
    controller.finishCatchup(decision!, {
      outcome: "current_selected",
      selectedAlternativeOrdinal: null,
      selectedRouteOrdinal: null,
      probes: [{
        route_ordinal: 1,
        route_kind: "causal_alternative",
        alternative_ordinal: 1,
        outcome: "reached_target",
        end_gap_index: 5,
        probe_nodes_processed: 1,
        probe_frames: 35,
        ranked_option_calls: 1,
        requested_normal_proposals: 100,
        candidate_geometry_evaluations: 90,
        ...NO_EMPTY_POOL_RETRY,
        atomic_node_primary_normal_requested_proposals: [100],
        atomic_node_starting_prefix_axis_loss_gain: [null],
        atomic_node_frames: [35],
        tail_completion_attempts: 0,
        budget_allowance_frames: null,
        budget_remaining_before_yield: null,
        estimated_next_node_frames: null,
        axis_loss: 0.7,
        local_fallback_choices: [
          {
            choice_ordinal: 1,
            gap_index: 4,
            remaining_gap_advance: 1,
            current_relative_axis_loss_gain: 0.03,
            conservative_deadline_margin: 3.5,
          },
          {
            choice_ordinal: 2,
            gap_index: 3,
            remaining_gap_advance: 2,
            current_relative_axis_loss_gain: -0.01,
            conservative_deadline_margin: 4,
          },
        ],
      }],
      catchupAxisLoss: 0.7,
    });
    expect(controller.observeSelected({ gap: 5, name: "different" }, 120)).toBe(false);
    expect(controller.observeSelected(descendant, 140)).toBe(true);
    expect(controller.consider({
      node: descendant,
      contactOrdinal: 6,
      axisLoss: 1,
      executionCeilingReached: false,
      totalSpentFrames: 101,
      lane: "initial",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
    })).toBeNull();
    expect(controller.snapshot()).toMatchObject({
      branch_watches_armed: 1,
      branch_watches_by_alternative_count: { "2": 1 },
      loss_threshold_crossings: 1,
      selective_backtracks: 1,
      selective_backtracks_by_signal: {
        branch_regret: 1,
        repair_incumbent_regret: 0,
      },
      selective_backtracks_with_additional_sibling_available: 1,
      additional_siblings_available_at_selective_backtrack_sum: 1,
      additional_siblings_available_at_selective_backtrack_max: 1,
      suspended_continuations_resumed: 1,
      catchup_completed: 1,
      catchup_current_selected: 1,
      catchup_alternative_selected: 0,
      catchup_probe_nodes_processed: 1,
      catchup_probe_frames: 35,
      catchup_probe_attempts: 1,
      catchup_probe_target_reaches: 1,
      catchup_probes_with_local_fallback_choice: 1,
      catchup_probes_with_positive_local_fallback_choice: 1,
      catchup_local_fallback_choice_count_sum: 2,
      catchup_positive_local_fallback_choice_count_sum: 1,
      catchup_local_fallback_choice_count_max: 2,
      catchup_additional_probe_attempts: 0,
      catchup_additional_probe_target_reaches: 0,
      catchup_tournaments_with_additional_probe: 0,
      catchup_additional_alternative_selected: 0,
      regret_opportunities_by_min_axis_loss_delta: {
        "0.05": { crossed_watches: 1, admissible_watches: 1 },
        "0.10": { crossed_watches: 1, admissible_watches: 1 },
        "0.15": { crossed_watches: 1, admissible_watches: 1 },
        "0.20": { crossed_watches: 1, admissible_watches: 1 },
      },
      selective_backtracks_by_lane: { initial: 1, snapshot: 0, repair: 0, resumed: 0 },
      events: [{
        branch_gap_index: 3,
        from_gap_index: 5,
        alternative_gap_index: 4,
        additional_siblings_available: 1,
        catchup_alternatives_requested: 1,
        alternative_conservative_deadline_margin: 3,
        trigger_total_spent_frames: 100,
        resumed_total_spent_frames: 140,
        catchup_outcome: "current_selected",
        catchup_end_gap_index: 5,
        catchup_probe_nodes_processed: 1,
        catchup_probe_frames: 35,
        catchup_axis_loss: 0.7,
        catchup_selected_alternative_ordinal: null,
        catchup_probe_results: [{
          alternative_ordinal: 1,
          outcome: "reached_target",
          end_gap_index: 5,
          probe_nodes_processed: 1,
          probe_frames: 35,
          axis_loss: 0.7,
          local_fallback_choices: [
            {
              choice_ordinal: 1,
              gap_index: 4,
              remaining_gap_advance: 1,
              current_relative_axis_loss_gain: 0.03,
              conservative_deadline_margin: 3.5,
            },
            {
              choice_ordinal: 2,
              gap_index: 3,
              remaining_gap_advance: 2,
              current_relative_axis_loss_gain: -0.01,
              conservative_deadline_margin: 4,
            },
          ],
        }],
        catchup_checkpoints: [{
          route_ordinal: 1,
          route_kind: "causal_alternative",
          alternative_ordinal: 1,
          gap_index: 5,
          contact_advance: 2,
          probe_nodes_processed: 1,
          probe_frames: 35,
          current_axis_loss: 0.61,
          alternative_axis_loss: 0.7,
          alternative_axis_loss_gain: -0.09,
        }],
      }],
    });
    expect(controller.snapshot().mature_axis_loss_delta_max).toBeCloseTo(0.21);
    expect(controller.snapshot().events[0]?.catchup_axis_loss_gain).toBeCloseTo(-0.09);
  });

  test("maps every simultaneously admissible causal rewind without changing nearest selection", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap);
    const outerParent = { gap: 1, name: "outer-parent" };
    const outerLeader = { gap: 2, name: "outer-leader" };
    const outerAlternative = { gap: 2, name: "outer-alternative" };
    const innerLeader = { gap: 3, name: "inner-leader" };
    const innerAlternative = { gap: 3, name: "inner-alternative" };
    const descendant = { gap: 4, name: "descendant" };
    controller.observeExpansion({
      parent: outerParent,
      children: [outerLeader, outerAlternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0,
    });
    controller.observeExpansion({
      parent: outerLeader,
      children: [innerLeader, innerAlternative],
      contactExpansion: true,
      contactOrdinal: 2,
      axisLoss: 0.1,
    });
    controller.observeExpansion({
      parent: innerLeader,
      children: [descendant],
      contactExpansion: true,
      contactOrdinal: 3,
      axisLoss: 0.2,
    });
    const decision = controller.consider({
      node: descendant,
      contactOrdinal: 4,
      axisLoss: 0.5,
      executionCeilingReached: false,
      totalSpentFrames: 100,
      lane: "initial",
      alternativeAvailable: () => true,
      alternativeDeadline: (node) => ({
        margin: node === innerAlternative ? 3 : 4,
        pressured: false,
      }),
    });
    expect(decision?.alternative).toBe(innerAlternative);
    expect(controller.snapshot()).toMatchObject({
      selective_backtracks: 1,
      selective_backtracks_with_multiple_admissible_rewind_choices: 1,
      admissible_rewind_choice_count_sum: 2,
      admissible_rewind_choice_count_max: 2,
      events: [{
        admissible_rewind_choices: [
          {
            branch_gap_index: 2,
            alternative_gap_index: 3,
            contact_advance: 2,
            gap_rewind: 1,
            axis_loss_delta: 0.4,
            conservative_deadline_margin: 3,
          },
          {
            branch_gap_index: 1,
            alternative_gap_index: 2,
            contact_advance: 3,
            gap_rewind: 2,
            axis_loss_delta: 0.5,
            conservative_deadline_margin: 4,
          },
        ],
      }],
    });
  });

  test("repair-incumbent policy adds one repair-only causal catch-up", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_repair_incumbent_once",
    });
    const parent = { gap: 1, name: "parent" };
    const leader = { gap: 2, name: "leader" };
    const runnerUp = { gap: 2, name: "runner-up" };
    const third = { gap: 2, name: "third" };
    const descendant = { gap: 3, name: "descendant" };
    controller.observeExpansion({
      parent,
      children: [leader, runnerUp, third],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0,
    });
    controller.observeExpansion({
      parent: leader,
      children: [descendant],
      contactExpansion: true,
      contactOrdinal: 2,
      axisLoss: 0.1,
    });
    const decision = controller.consider({
      node: descendant,
      contactOrdinal: 3,
      axisLoss: 0.11,
      incumbentAxisLoss: 0.08,
      repairAttemptIndex: 0,
      executionCeilingReached: false,
      totalSpentFrames: 10,
      lane: "repair",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
    });
    expect(decision).toMatchObject({
      alternatives: [runnerUp],
      triggerSignal: "repair_incumbent_regret",
      incumbentAxisLoss: 0.08,
      incumbentAxisLossDelta: 0.03,
    });
    expect(controller.snapshot().events[0]).toMatchObject({
      trigger_signal: "repair_incumbent_regret",
      additional_siblings_available: 1,
      catchup_alternatives_requested: 1,
      incumbent_axis_loss: 0.08,
      incumbent_axis_loss_delta: 0.03,
      repair_attempt_index: 0,
    });
    controller.markSuspended(descendant);
    controller.finishCatchup(decision!, {
      outcome: "alternative_selected",
      selectedAlternativeOrdinal: 1,
      selectedRouteOrdinal: 1,
      probes: [{
        route_ordinal: 1,
        route_kind: "causal_alternative",
        alternative_ordinal: 1,
        outcome: "reached_target",
        end_gap_index: 3,
        probe_nodes_processed: 1,
        probe_frames: 20,
        ranked_option_calls: 1,
        requested_normal_proposals: 100,
        candidate_geometry_evaluations: 90,
        ...NO_EMPTY_POOL_RETRY,
        atomic_node_primary_normal_requested_proposals: [100],
        atomic_node_starting_prefix_axis_loss_gain: [null],
        atomic_node_frames: [20],
        tail_completion_attempts: 0,
        budget_allowance_frames: null,
        budget_remaining_before_yield: null,
        estimated_next_node_frames: null,
        axis_loss: 0.07,
        local_fallback_choices: [],
      }],
      catchupAxisLoss: 0.07,
    });
    expect(controller.snapshot()).toMatchObject({
      catchup_completed: 1,
      catchup_alternative_selected: 1,
      selective_backtracks_by_signal: {
        branch_regret: 0,
        repair_incumbent_regret: 1,
      },
      repair_incumbent_max_backtracks_per_attempt: 1,
      repair_incumbent_attempt_limit_suppressed_watches: 0,
      catchup_probe_attempts: 1,
      catchup_probe_target_reaches: 1,
      catchup_additional_probe_attempts: 0,
      catchup_additional_probe_target_reaches: 0,
      catchup_tournaments_with_additional_probe: 0,
      catchup_additional_alternative_selected: 0,
      catchup_probe_nodes_processed: 1,
      catchup_probe_frames: 20,
      events: [{
        catchup_selected_alternative_ordinal: 1,
        catchup_axis_loss: 0.07,
        catchup_probe_nodes_processed: 1,
        catchup_probe_frames: 20,
      }],
    });
  });

  test("allows only one incumbent-relative backtrack per repair attempt", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap, {
      policy: "selective_axis_regret_catchup_repair_incumbent_once",
    });
    const makeOpportunity = (name: string, attempt: number) => {
      const parent = { gap: 1, name: `${name}-parent` };
      const leader = { gap: 2, name: `${name}-leader` };
      const alternative = { gap: 2, name: `${name}-alternative` };
      const descendant = { gap: 3, name: `${name}-descendant` };
      controller.observeExpansion({
        parent,
        children: [leader, alternative],
        contactExpansion: true,
        contactOrdinal: 1,
        axisLoss: 0.1,
      });
      controller.observeExpansion({
        parent: leader,
        children: [descendant],
        contactExpansion: true,
        contactOrdinal: 2,
        axisLoss: 0.105,
      });
      return controller.consider({
        node: descendant,
        contactOrdinal: 3,
        axisLoss: 0.11,
        incumbentAxisLoss: 0.08,
        repairAttemptIndex: attempt,
        executionCeilingReached: false,
        totalSpentFrames: 10,
        lane: "repair",
        alternativeAvailable: () => true,
        alternativeDeadline: () => ({ margin: 3, pressured: false }),
      });
    };

    expect(makeOpportunity("first", 0)?.triggerSignal).toBe("repair_incumbent_regret");
    expect(makeOpportunity("same-attempt", 0)).toBeNull();
    expect(makeOpportunity("next-attempt", 1)?.triggerSignal).toBe("repair_incumbent_regret");
    expect(controller.snapshot()).toMatchObject({
      selective_backtracks_by_signal: {
        branch_regret: 0,
        repair_incumbent_regret: 2,
      },
      repair_incumbent_max_backtracks_per_attempt: 1,
      repair_incumbent_attempt_limit_suppressed_watches: 1,
      events: [
        { repair_attempt_index: 0 },
        { repair_attempt_index: 1 },
      ],
    });
  });

  test("does not backtrack before maturity or while deadline pressure is active", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap);
    const parent = { gap: 1, name: "parent" };
    const leader = { gap: 2, name: "leader" };
    const alternative = { gap: 2, name: "alternative" };
    const descendant = { gap: 3, name: "descendant" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0,
    });
    expect(controller.consider({
      node: leader,
      contactOrdinal: 2,
      axisLoss: 1,
      executionCeilingReached: false,
      totalSpentFrames: 10,
      lane: "repair",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
    })).toBeNull();
    controller.observeExpansion({
      parent: leader,
      children: [descendant],
      contactExpansion: true,
      contactOrdinal: 2,
      axisLoss: 0.5,
    });
    expect(controller.consider({
      node: descendant,
      contactOrdinal: 3,
      axisLoss: 0.5,
      executionCeilingReached: false,
      totalSpentFrames: 20,
      lane: "repair",
      alternativeAvailable: () => true,
      alternativeDeadline: () => ({ margin: 1, pressured: true }),
    })).toBeNull();
    expect(controller.snapshot()).toMatchObject({
      loss_threshold_crossings: 1,
      deadline_suppressed_crossings: 1,
      selective_backtracks: 0,
      regret_opportunities_by_min_axis_loss_delta: {
        "0.05": { crossed_watches: 1, admissible_watches: 0 },
        "0.10": { crossed_watches: 1, admissible_watches: 0 },
        "0.15": { crossed_watches: 1, admissible_watches: 0 },
        "0.20": { crossed_watches: 1, admissible_watches: 0 },
      },
    });
  });

  test("records an unavailable causal sibling as an invariant failure", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap);
    const parent = { gap: 0, name: "parent" };
    const leader = { gap: 1, name: "leader" };
    const alternative = { gap: 1, name: "alternative" };
    const descendant = { gap: 2, name: "descendant" };
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
      contactExpansion: true,
      contactOrdinal: 0,
      axisLoss: 0,
    });
    controller.observeExpansion({
      parent: leader,
      children: [descendant],
      contactExpansion: true,
      contactOrdinal: 1,
      axisLoss: 0.1,
    });
    expect(controller.consider({
      node: descendant,
      contactOrdinal: 2,
      axisLoss: 0.3,
      executionCeilingReached: false,
      totalSpentFrames: 30,
      lane: "resumed",
      alternativeAvailable: () => false,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
    })).toBeNull();
    expect(controller.snapshot()).toMatchObject({
      unavailable_alternatives: 1,
      selective_backtracks: 0,
    });
  });

  test("rejects suspension without a causal decision", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap);
    const node = { gap: 8, name: "suspended" };
    // Use a real decision: suspension without a decision is an invariant error.
    expect(() => controller.markSuspended(node)).toThrow(/without a causal event/);
  });
});
