import { describe, expect, test } from "vitest";
import {
  catchupAlternativeHasSufficientGain,
  parseFrontierTraversalPolicy,
  SelectiveAxisRegretController,
} from "../scripts/v0/optimizer/selective_backtracking.ts";

type Node = { gap: number; name: string };

describe("selective-backtracking controller", () => {
  test("parses a strict categorical frontier policy", () => {
    expect(parseFrontierTraversalPolicy(undefined)).toBe("selective_axis_regret_catchup");
    expect(parseFrontierTraversalPolicy("")).toBe("selective_axis_regret_catchup");
    expect(parseFrontierTraversalPolicy("dfs")).toBe("depth_first");
    expect(parseFrontierTraversalPolicy("off")).toBe("depth_first");
    expect(parseFrontierTraversalPolicy("0")).toBe("depth_first");
    expect(parseFrontierTraversalPolicy("selective-axis-regret-catchup"))
      .toBe("selective_axis_regret_catchup");
    expect(parseFrontierTraversalPolicy("selective-axis-regret-catchup-repair-incumbent-once"))
      .toBe("selective_axis_regret_catchup_repair_incumbent_once");
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

  test("uses the exact sign of equal-depth axis gain", () => {
    expect(catchupAlternativeHasSufficientGain(0.5, 0.4999)).toBe(true);
    expect(catchupAlternativeHasSufficientGain(0.5, 0.5)).toBe(false);
    expect(catchupAlternativeHasSufficientGain(0.5, 0.5001)).toBe(false);
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
    controller.recordCatchupCheckpoint(decision!, 1, {
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
      probes: [{
        alternative_ordinal: 1,
        outcome: "reached_target",
        end_gap_index: 5,
        probe_nodes_processed: 1,
        probe_frames: 35,
        axis_loss: 0.7,
        local_fallback_choices: [
          {
            gap_index: 4,
            remaining_gap_advance: 1,
            current_relative_axis_loss_gain: 0.03,
            conservative_deadline_margin: 3.5,
          },
          {
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
              gap_index: 4,
              remaining_gap_advance: 1,
              current_relative_axis_loss_gain: 0.03,
              conservative_deadline_margin: 3.5,
            },
            {
              gap_index: 3,
              remaining_gap_advance: 2,
              current_relative_axis_loss_gain: -0.01,
              conservative_deadline_margin: 4,
            },
          ],
        }],
        catchup_checkpoints: [{
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
      probes: [{
        alternative_ordinal: 1,
        outcome: "reached_target",
        end_gap_index: 3,
        probe_nodes_processed: 1,
        probe_frames: 20,
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
