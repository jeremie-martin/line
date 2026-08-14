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

  test("fires once on a mature causal watch and names its concrete sibling", () => {
    const controller = new SelectiveAxisRegretController<Node>((node) => node.gap);
    const parent = { gap: 3, name: "parent" };
    const leader = { gap: 4, name: "leader" };
    const alternative = { gap: 4, name: "alternative" };
    const descendant = { gap: 5, name: "descendant" };
    controller.observeRoot(parent);
    controller.observeExpansion({
      parent,
      children: [leader, alternative],
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
      alternativeAvailable: (node) => node === alternative,
      alternativeDeadline: () => ({ margin: 3, pressured: false }),
    });
    expect(decision?.alternative).toBe(alternative);
    expect(decision?.contactAdvance).toBe(2);
    expect(decision?.gapRewind).toBe(1);
    controller.markSuspended(descendant);
    controller.recordCatchupCheckpoint(decision!, {
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
      endGapIndex: 5,
      probeNodesProcessed: 1,
      probeFrames: 35,
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
      loss_threshold_crossings: 1,
      selective_backtracks: 1,
      suspended_continuations_resumed: 1,
      catchup_completed: 1,
      catchup_current_selected: 1,
      catchup_alternative_selected: 0,
      catchup_probe_nodes_processed: 1,
      catchup_probe_frames: 35,
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
        alternative_conservative_deadline_margin: 3,
        trigger_total_spent_frames: 100,
        resumed_total_spent_frames: 140,
        catchup_outcome: "current_selected",
        catchup_end_gap_index: 5,
        catchup_probe_nodes_processed: 1,
        catchup_probe_frames: 35,
        catchup_axis_loss: 0.7,
        catchup_checkpoints: [{
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
