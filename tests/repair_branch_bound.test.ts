import { describe, expect, test } from "vitest";
import {
  assessRepairAxisDominance,
  optimisticAxisQualityUpper,
  parseRepairAxisBranchBoundMode,
  RepairAxisBranchBoundController,
} from "../scripts/v0/optimizer/repair_branch_bound.ts";
import { AXIS_QUALITY_TOLERANCE } from "../scripts/v0/score.ts";
import { LEAF_KEY_FLOAT_EPSILON } from "../scripts/v0/optimizer/register.ts";

type Node = { path: string };
const isPrefix = (prefix: Node, descendant: Node): boolean =>
  descendant.path === prefix.path || descendant.path.startsWith(`${prefix.path}/`);

describe("repair authored-axis branch bound", () => {
  test("parses audit and live modes without aliases", () => {
    expect(parseRepairAxisBranchBoundMode({})).toBe("off");
    expect(parseRepairAxisBranchBoundMode({ LR_REPAIR_AXIS_BRANCH_BOUND_AUDIT: "1" }))
      .toBe("audit");
    expect(parseRepairAxisBranchBoundMode({ LR_REPAIR_AXIS_BRANCH_BOUND: "1" }))
      .toBe("prune");
    expect(parseRepairAxisBranchBoundMode({ LR_REPAIR_AXIS_ATTEMPT_BOUND: "1" }))
      .toBe("abort");
    expect(parseRepairAxisBranchBoundMode({
      LR_REPAIR_AXIS_BRANCH_BOUND_AUDIT: "1",
      LR_REPAIR_AXIS_BRANCH_BOUND: "1",
    })).toBe("prune");
    expect(() => parseRepairAxisBranchBoundMode({
      LR_REPAIR_AXIS_BRANCH_BOUND: "yes",
    })).toThrow(/must be 0 or 1/);
    expect(() => parseRepairAxisBranchBoundMode({
      LR_REPAIR_AXIS_BRANCH_BOUND: "1",
      LR_REPAIR_AXIS_ATTEMPT_BOUND: "1",
    })).toThrow(/mutually exclusive/);
  });

  test("pads the scorer RMS with zero-error remaining axes", () => {
    const sse = AXIS_QUALITY_TOLERANCE ** 2;
    expect(optimisticAxisQualityUpper(sse, 4)).toBeCloseTo(Math.exp(-0.5), 14);
    expect(optimisticAxisQualityUpper(0, 4)).toBe(1);
    expect(optimisticAxisQualityUpper(0, 0)).toBe(1);
  });

  test("respects the register epsilon and remaining-axis dilution", () => {
    const upper = optimisticAxisQualityUpper(1, 10);
    expect(assessRepairAxisDominance({
      prefixAxisSse: 1,
      prefixAxisCount: 2,
      totalAuthoredAxisCount: 10,
      incumbentAxisQuality: upper + LEAF_KEY_FLOAT_EPSILON / 2,
    }).dominated).toBe(false);
    expect(assessRepairAxisDominance({
      prefixAxisSse: 1,
      prefixAxisCount: 2,
      totalAuthoredAxisCount: 10,
      incumbentAxisQuality: upper + LEAF_KEY_FLOAT_EPSILON * 2,
    }).dominated).toBe(true);
  });

  test("audits a whole dominated subtree until ordinary DFS returns", () => {
    const controller = new RepairAxisBranchBoundController<Node>("audit", isPrefix);
    controller.beginAttempt({
      iterationIndex: 0,
      anchorGapIndex: 2,
      totalSpentFrames: 100,
      incumbentAxisQuality: 0.9,
      incumbentAxisSse: 10,
      totalAuthoredAxisCount: 10,
    });
    const root = controller.observeSelection({
      node: { path: "a" },
      totalSpentFrames: 120,
      gapIndex: 3,
      contactOrdinal: 3,
      frontierNodes: 4,
      eligibleCheckpoint: true,
      prunable: true,
      prefixAxisCount: 3,
      prefixAxisSse: 100,
      prefixAxisLoss: 1,
      incumbentPrefixAxisCount: 3,
      incumbentPrefixAxisSse: 1,
    });
    expect(root).toMatchObject({ dominated: true, prune: false, abort: false });
    controller.observeSelection({
      node: { path: "a/b" },
      totalSpentFrames: 150,
      gapIndex: 4,
      contactOrdinal: 4,
      frontierNodes: 5,
      eligibleCheckpoint: true,
      prunable: true,
      prefixAxisCount: 4,
      prefixAxisSse: 110,
      prefixAxisLoss: 1.1,
      incumbentPrefixAxisCount: 4,
      incumbentPrefixAxisSse: 2,
    });
    controller.observeSelection({
      node: { path: "c" },
      totalSpentFrames: 180,
      gapIndex: 3,
      contactOrdinal: 3,
      frontierNodes: 3,
      eligibleCheckpoint: false,
      prunable: true,
      prefixAxisCount: 3,
      prefixAxisSse: 0,
      prefixAxisLoss: 0,
      incumbentPrefixAxisCount: 3,
      incumbentPrefixAxisSse: 1,
    });
    controller.finishAttempt({
      totalSpentFrames: 200,
      terminalNode: null,
      terminalGapIndex: null,
      terminalReached: false,
      acceptedAlternative: false,
      terminalAxisSse: null,
    });
    expect(controller.snapshot().attempts[0]).toMatchObject({
      selected_nodes: 3,
      eligible_checkpoint_nodes: 2,
      dominated_selected_nodes: 2,
      pruned_subtrees: 0,
      opportunities: [{
        frontier_nodes_at_entry: 4,
        selected_nodes_in_subtree: 2,
        spent_frames_in_subtree: 60,
        outcome: "frontier_return",
      }],
    });
  });

  test("prune mode returns a disposition at a dominated root", () => {
    const controller = new RepairAxisBranchBoundController<Node>("prune", isPrefix);
    controller.beginAttempt({
      iterationIndex: 2,
      anchorGapIndex: 8,
      totalSpentFrames: 1_000,
      incumbentAxisQuality: 0.95,
      incumbentAxisSse: 10,
      totalAuthoredAxisCount: 20,
    });
    expect(controller.observeSelection({
      node: { path: "root" },
      totalSpentFrames: 1_100,
      gapIndex: 9,
      contactOrdinal: 7,
      frontierNodes: 6,
      eligibleCheckpoint: true,
      prunable: true,
      prefixAxisCount: 12,
      prefixAxisSse: 100,
      prefixAxisLoss: 1,
      incumbentPrefixAxisCount: 12,
      incumbentPrefixAxisSse: 1,
    })).toMatchObject({ dominated: true, prune: true, abort: false });
    controller.finishAttempt({
      totalSpentFrames: 1_100,
      terminalNode: null,
      terminalGapIndex: null,
      terminalReached: false,
      acceptedAlternative: false,
      terminalAxisSse: null,
    });
    expect(controller.snapshot().attempts[0]).toMatchObject({
      pruned_subtrees: 1,
      opportunities: [{
        spent_frames_in_subtree: 0,
        outcome: "episode_end",
      }],
    });
  });

  test("attempt-bound mode requests one clean abort instead of subtree churn", () => {
    const controller = new RepairAxisBranchBoundController<Node>("abort", isPrefix);
    controller.beginAttempt({
      iterationIndex: 0,
      anchorGapIndex: 2,
      totalSpentFrames: 10,
      incumbentAxisQuality: 0.95,
      incumbentAxisSse: 10,
      totalAuthoredAxisCount: 10,
    });
    expect(controller.observeSelection({
      node: { path: "a" },
      totalSpentFrames: 20,
      gapIndex: 3,
      contactOrdinal: 3,
      frontierNodes: 7,
      eligibleCheckpoint: true,
      prunable: true,
      prefixAxisCount: 3,
      prefixAxisSse: 100,
      prefixAxisLoss: 1,
      incumbentPrefixAxisCount: 3,
      incumbentPrefixAxisSse: 1,
    })).toMatchObject({ dominated: true, prune: false, abort: true });
    controller.finishAttempt({
      totalSpentFrames: 20,
      terminalNode: null,
      terminalGapIndex: null,
      terminalReached: false,
      acceptedAlternative: false,
      terminalAxisSse: null,
    });
    expect(controller.snapshot().attempts[0]).toMatchObject({
      aborted_by_bound: true,
      pruned_subtrees: 0,
      terminal_reached: false,
    });
  });

  test("keeps recovery pressure observational and attributes later acceptance", () => {
    const controller = new RepairAxisBranchBoundController<Node>("audit", isPrefix);
    controller.beginAttempt({
      iterationIndex: 0,
      anchorGapIndex: 2,
      totalSpentFrames: 100,
      incumbentAxisQuality: 0,
      incumbentAxisSse: 10,
      totalAuthoredAxisCount: 100,
    });
    controller.observeSelection({
      node: { path: "a" },
      totalSpentFrames: 120,
      gapIndex: 3,
      contactOrdinal: 3,
      frontierNodes: 4,
      eligibleCheckpoint: true,
      prunable: true,
      prefixAxisCount: 3,
      prefixAxisSse: 6,
      prefixAxisLoss: 1,
      incumbentPrefixAxisCount: 3,
      incumbentPrefixAxisSse: 2,
    });
    controller.observeSelection({
      node: { path: "a/recovered" },
      totalSpentFrames: 150,
      gapIndex: 4,
      contactOrdinal: 4,
      frontierNodes: 3,
      eligibleCheckpoint: true,
      prunable: true,
      prefixAxisCount: 4,
      prefixAxisSse: 3,
      prefixAxisLoss: 0.5,
      incumbentPrefixAxisCount: 4,
      incumbentPrefixAxisSse: 2.5,
    });
    controller.finishAttempt({
      totalSpentFrames: 180,
      terminalNode: { path: "a/recovered/terminal" },
      terminalGapIndex: 5,
      terminalReached: true,
      acceptedAlternative: true,
      terminalAxisSse: 8,
    });
    expect(controller.snapshot().attempts[0]?.recovery_pressure_opportunities)
      .toEqual([
        expect.objectContaining({
          threshold: 0.25,
          recovery_pressure: 0.5,
          selected_nodes_in_subtree: 2,
          spent_frames_in_subtree: 60,
          outcome: "terminal_descendant",
          accepted_terminal_descended: true,
          terminal_axis_sse_delta_from_incumbent: -2,
        }),
        expect.objectContaining({
          threshold: 0.5,
          recovery_pressure: 0.5,
          accepted_terminal_descended: true,
        }),
      ]);
  });

  test("fails loudly if an accepted terminal violates the dominance proof", () => {
    const controller = new RepairAxisBranchBoundController<Node>("audit", isPrefix);
    controller.beginAttempt({
      iterationIndex: 0,
      anchorGapIndex: 0,
      totalSpentFrames: 0,
      incumbentAxisQuality: 0.99,
      incumbentAxisSse: 10,
      totalAuthoredAxisCount: 2,
    });
    controller.observeSelection({
      node: { path: "a" },
      totalSpentFrames: 1,
      gapIndex: 1,
      contactOrdinal: 1,
      frontierNodes: 1,
      eligibleCheckpoint: true,
      prunable: true,
      prefixAxisCount: 1,
      prefixAxisSse: 100,
      prefixAxisLoss: 1,
      incumbentPrefixAxisCount: 1,
      incumbentPrefixAxisSse: 1,
    });
    expect(() => controller.finishAttempt({
      totalSpentFrames: 2,
      terminalNode: { path: "a/terminal" },
      terminalGapIndex: 2,
      terminalReached: true,
      acceptedAlternative: true,
      terminalAxisSse: 9,
    })).toThrow(/mathematically dominated prefix/);
  });
});
