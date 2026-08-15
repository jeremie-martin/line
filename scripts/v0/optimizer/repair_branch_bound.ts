/**
 * Repair-only authored-axis branch-and-bound.
 *
 * A repair starts with a complete, contract-passing incumbent. At any prefix,
 * the SSE already committed cannot be repaired by later gaps. Giving every
 * remaining authored axis zero error therefore produces a strict upper bound
 * on the axis quality of every descendant. When that upper bound is below the
 * incumbent by more than the register comparison epsilon, the whole subtree
 * is incapable of changing the register.
 *
 * The controller is deliberately ignorant of search policy. In audit mode it
 * observes whole dominated regions without changing traversal. In prune mode
 * it returns a disposition only at the first selected node of such a region.
 */

import { AXIS_QUALITY_TOLERANCE } from "../score.ts";
import { LEAF_KEY_FLOAT_EPSILON } from "./register.ts";

export const REPAIR_AXIS_BRANCH_BOUND_SCHEMA =
  "line.repair-axis-branch-bound.v4" as const;

export const REPAIR_SUFFIX_RECOVERY_PRESSURE_THRESHOLDS = [
  0.25,
  0.5,
  0.75,
  1,
] as const;

export type RepairAxisBranchBoundMode = "off" | "audit" | "prune" | "abort";

export type RepairAxisBranchBoundOpportunity = {
  opportunity_index: number;
  root_gap_index: number;
  root_contact_ordinal: number;
  root_terminal: boolean;
  root_total_spent_frames: number;
  frontier_nodes_at_entry: number;
  prefix_axis_count: number;
  prefix_axis_sse: number;
  prefix_axis_loss: number;
  optimistic_axis_quality_upper: number;
  incumbent_axis_quality: number;
  incumbent_quality_margin: number;
  selected_nodes_in_subtree: number;
  end_total_spent_frames: number;
  spent_frames_in_subtree: number;
  outcome: "frontier_return" | "terminal_descendant" | "episode_end";
  terminal_descended: boolean;
  accepted_terminal_descended: boolean;
};

export type RepairSuffixRecoveryOpportunity = {
  threshold: number;
  opportunity_index: number;
  root_gap_index: number;
  root_contact_ordinal: number;
  root_terminal: boolean;
  root_total_spent_frames: number;
  frontier_nodes_at_entry: number;
  current_prefix_axis_count: number;
  incumbent_prefix_axis_count: number;
  current_prefix_axis_sse: number;
  incumbent_prefix_axis_sse: number;
  incumbent_remaining_axis_sse: number;
  prefix_excess_axis_sse: number;
  /** Null means positive excess with zero incumbent suffix SSE: unbounded. */
  recovery_pressure: number | null;
  selected_nodes_in_subtree: number;
  end_total_spent_frames: number;
  spent_frames_in_subtree: number;
  outcome: "frontier_return" | "terminal_descendant" | "episode_end";
  terminal_descended: boolean;
  accepted_terminal_descended: boolean;
  terminal_axis_sse: number | null;
  terminal_axis_sse_delta_from_incumbent: number | null;
};

export type RepairIncompletePrefixOpportunity = {
  opportunity_index: number;
  root_gap_index: number;
  root_contact_ordinal: number;
  root_terminal: boolean;
  root_total_spent_frames: number;
  frontier_nodes_at_entry: number;
  current_prefix_axis_count: number;
  incumbent_prefix_axis_count: number;
  missing_current_axis_observations: number;
  selected_nodes_in_subtree: number;
  end_total_spent_frames: number;
  spent_frames_in_subtree: number;
  outcome: "frontier_return" | "terminal_descendant" | "episode_end";
  terminal_descended: boolean;
  accepted_terminal_descended: boolean;
  terminal_axis_sse: number | null;
  terminal_axis_sse_delta_from_incumbent: number | null;
};

export type RepairAxisBranchBoundAttempt = {
  iteration_index: number;
  anchor_gap_index: number;
  start_total_spent_frames: number;
  end_total_spent_frames: number;
  incumbent_axis_quality: number;
  incumbent_axis_sse: number;
  total_authored_axis_count: number;
  selected_nodes: number;
  eligible_checkpoint_nodes: number;
  recovery_pressure_comparable_checkpoint_nodes: number;
  recovery_pressure_incomparable_checkpoint_nodes: number;
  recovery_pressure_missing_current_axis_observations: number;
  dominated_selected_nodes: number;
  pruned_subtrees: number;
  aborted_by_bound: boolean;
  terminal_reached: boolean;
  accepted_alternative: boolean;
  terminal_gap_index: number | null;
  opportunities: RepairAxisBranchBoundOpportunity[];
  recovery_pressure_opportunities: RepairSuffixRecoveryOpportunity[];
  incomplete_prefix_opportunities: RepairIncompletePrefixOpportunity[];
};

export type RepairAxisBranchBoundStats = {
  schema: typeof REPAIR_AXIS_BRANCH_BOUND_SCHEMA;
  mode: Exclude<RepairAxisBranchBoundMode, "off">;
  comparison_epsilon: number;
  recovery_pressure_thresholds: number[];
  attempts: RepairAxisBranchBoundAttempt[];
};

type InternalOpportunity<Node> = {
  root: Node;
  record: RepairAxisBranchBoundOpportunity;
};

type InternalAttempt<Node> = {
  record: RepairAxisBranchBoundAttempt;
  openOpportunity: InternalOpportunity<Node> | null;
  openRecoveryOpportunities: Map<number, {
    root: Node;
    record: RepairSuffixRecoveryOpportunity;
  }>;
  openIncompleteOpportunity: {
    root: Node;
    record: RepairIncompletePrefixOpportunity;
  } | null;
};

export type RepairAxisBranchBoundAssessment = {
  dominated: boolean;
  prune: boolean;
  abort: boolean;
  optimisticAxisQualityUpper: number;
  incumbentQualityMargin: number;
};

export function parseRepairAxisBranchBoundMode(
  env: NodeJS.ProcessEnv = process.env,
): RepairAxisBranchBoundMode {
  const audit = env.LR_REPAIR_AXIS_BRANCH_BOUND_AUDIT;
  const prune = env.LR_REPAIR_AXIS_BRANCH_BOUND;
  const abort = env.LR_REPAIR_AXIS_ATTEMPT_BOUND;
  for (const [name, value] of [
    ["LR_REPAIR_AXIS_BRANCH_BOUND_AUDIT", audit],
    ["LR_REPAIR_AXIS_BRANCH_BOUND", prune],
    ["LR_REPAIR_AXIS_ATTEMPT_BOUND", abort],
  ] as const) {
    if (value !== undefined && value !== "" && value !== "0" && value !== "1") {
      throw new Error(`${name} must be 0 or 1; got ${JSON.stringify(value)}`);
    }
  }
  if (prune === "1" && abort === "1") {
    throw new Error(
      "LR_REPAIR_AXIS_BRANCH_BOUND and LR_REPAIR_AXIS_ATTEMPT_BOUND are mutually exclusive",
    );
  }
  if (abort === "1") return "abort";
  if (prune === "1") return "prune";
  if (audit === "1") return "audit";
  return "off";
}

/** Exact scorer upper bound after padding every not-yet-observed axis with 0. */
export function optimisticAxisQualityUpper(
  prefixAxisSse: number,
  totalAuthoredAxisCount: number,
): number {
  if (!Number.isFinite(prefixAxisSse) || prefixAxisSse < 0) {
    throw new Error(`prefix axis SSE must be finite and non-negative; got ${prefixAxisSse}`);
  }
  if (!Number.isSafeInteger(totalAuthoredAxisCount) || totalAuthoredAxisCount < 0) {
    throw new Error(
      `total authored axis count must be a non-negative integer; got ${totalAuthoredAxisCount}`,
    );
  }
  if (totalAuthoredAxisCount === 0) return 1;
  const optimisticRms = Math.sqrt(prefixAxisSse / totalAuthoredAxisCount);
  return Math.exp(-(optimisticRms / AXIS_QUALITY_TOLERANCE));
}

export function assessRepairAxisDominance(input: {
  prefixAxisSse: number;
  prefixAxisCount: number;
  totalAuthoredAxisCount: number;
  incumbentAxisQuality: number;
}): Omit<RepairAxisBranchBoundAssessment, "prune" | "abort"> {
  if (
    !Number.isSafeInteger(input.prefixAxisCount) || input.prefixAxisCount < 0 ||
    input.prefixAxisCount > input.totalAuthoredAxisCount
  ) {
    throw new Error(
      `prefix axis count ${input.prefixAxisCount} is outside 0..${input.totalAuthoredAxisCount}`,
    );
  }
  if (!Number.isFinite(input.incumbentAxisQuality)) {
    throw new Error(`incumbent axis quality must be finite; got ${input.incumbentAxisQuality}`);
  }
  const upper = optimisticAxisQualityUpper(
    input.prefixAxisSse,
    input.totalAuthoredAxisCount,
  );
  const margin = input.incumbentAxisQuality - upper;
  return {
    optimisticAxisQualityUpper: upper,
    incumbentQualityMargin: margin,
    dominated: margin > LEAF_KEY_FLOAT_EPSILON,
  };
}

export class RepairAxisBranchBoundController<Node> {
  private readonly attempts: RepairAxisBranchBoundAttempt[] = [];
  private active: InternalAttempt<Node> | null = null;
  readonly mode: Exclude<RepairAxisBranchBoundMode, "off">;
  private readonly isPrefix: (prefix: Node, descendant: Node) => boolean;

  constructor(
    mode: Exclude<RepairAxisBranchBoundMode, "off">,
    isPrefix: (prefix: Node, descendant: Node) => boolean,
  ) {
    this.mode = mode;
    this.isPrefix = isPrefix;
  }

  beginAttempt(input: {
    iterationIndex: number;
    anchorGapIndex: number;
    totalSpentFrames: number;
    incumbentAxisQuality: number;
    incumbentAxisSse: number;
    totalAuthoredAxisCount: number;
  }): void {
    if (this.active !== null) throw new Error("repair axis-bound attempt already active");
    if (!Number.isFinite(input.incumbentAxisSse) || input.incumbentAxisSse < 0) {
      throw new Error(
        `incumbent axis SSE must be finite and non-negative; got ${input.incumbentAxisSse}`,
      );
    }
    const record: RepairAxisBranchBoundAttempt = {
      iteration_index: input.iterationIndex,
      anchor_gap_index: input.anchorGapIndex,
      start_total_spent_frames: input.totalSpentFrames,
      end_total_spent_frames: input.totalSpentFrames,
      incumbent_axis_quality: input.incumbentAxisQuality,
      incumbent_axis_sse: input.incumbentAxisSse,
      total_authored_axis_count: input.totalAuthoredAxisCount,
      selected_nodes: 0,
      eligible_checkpoint_nodes: 0,
      recovery_pressure_comparable_checkpoint_nodes: 0,
      recovery_pressure_incomparable_checkpoint_nodes: 0,
      recovery_pressure_missing_current_axis_observations: 0,
      dominated_selected_nodes: 0,
      pruned_subtrees: 0,
      aborted_by_bound: false,
      terminal_reached: false,
      accepted_alternative: false,
      terminal_gap_index: null,
      opportunities: [],
      recovery_pressure_opportunities: [],
      incomplete_prefix_opportunities: [],
    };
    this.attempts.push(record);
    this.active = {
      record,
      openOpportunity: null,
      openRecoveryOpportunities: new Map(),
      openIncompleteOpportunity: null,
    };
  }

  observeSelection(input: {
    node: Node;
    totalSpentFrames: number;
    gapIndex: number;
    contactOrdinal: number;
    frontierNodes: number;
    eligibleCheckpoint: boolean;
    prunable: boolean;
    prefixAxisCount: number;
    prefixAxisSse: number;
    prefixAxisLoss: number;
    incumbentPrefixAxisCount: number;
    incumbentPrefixAxisSse: number;
  }): RepairAxisBranchBoundAssessment | null {
    const active = this.active;
    if (active === null) return null;
    const record = active.record;
    record.selected_nodes++;

    if (
      active.openOpportunity !== null &&
      !this.isPrefix(active.openOpportunity.root, input.node)
    ) {
      this.closeOpportunity(input.totalSpentFrames, "frontier_return", null, false);
    }
    if (active.openOpportunity !== null) {
      active.openOpportunity.record.selected_nodes_in_subtree++;
    }
    for (const [threshold, open] of active.openRecoveryOpportunities) {
      if (!this.isPrefix(open.root, input.node)) {
        this.closeRecoveryOpportunity(
          threshold,
          input.totalSpentFrames,
          "frontier_return",
          null,
          false,
        );
      } else {
        open.record.selected_nodes_in_subtree++;
      }
    }
    if (
      active.openIncompleteOpportunity !== null &&
      !this.isPrefix(active.openIncompleteOpportunity.root, input.node)
    ) {
      this.closeIncompleteOpportunity(
        input.totalSpentFrames,
        "frontier_return",
        null,
        false,
      );
    }
    if (active.openIncompleteOpportunity !== null) {
      active.openIncompleteOpportunity.record.selected_nodes_in_subtree++;
    }
    if (!input.eligibleCheckpoint) return null;
    record.eligible_checkpoint_nodes++;
    if (input.prefixAxisCount > input.incumbentPrefixAxisCount) {
      throw new Error(
        `repair recovery-pressure current prefix population exceeds incumbent: ` +
        `${input.prefixAxisCount} current versus ${input.incumbentPrefixAxisCount} incumbent`,
      );
    }
    if (
      !Number.isFinite(input.incumbentPrefixAxisSse) ||
      input.incumbentPrefixAxisSse < 0 ||
      input.incumbentPrefixAxisSse > record.incumbent_axis_sse + 1e-12
    ) {
      throw new Error(
        `repair incumbent prefix SSE ${input.incumbentPrefixAxisSse} is outside ` +
        `0..${record.incumbent_axis_sse}`,
      );
    }
    if (input.prefixAxisCount !== input.incumbentPrefixAxisCount) {
      record.recovery_pressure_incomparable_checkpoint_nodes++;
      record.recovery_pressure_missing_current_axis_observations +=
        input.incumbentPrefixAxisCount - input.prefixAxisCount;
      if (active.openIncompleteOpportunity === null) {
        const opportunity: RepairIncompletePrefixOpportunity = {
          opportunity_index: record.incomplete_prefix_opportunities.length,
          root_gap_index: input.gapIndex,
          root_contact_ordinal: input.contactOrdinal,
          root_terminal: !input.prunable,
          root_total_spent_frames: input.totalSpentFrames,
          frontier_nodes_at_entry: input.frontierNodes,
          current_prefix_axis_count: input.prefixAxisCount,
          incumbent_prefix_axis_count: input.incumbentPrefixAxisCount,
          missing_current_axis_observations:
            input.incumbentPrefixAxisCount - input.prefixAxisCount,
          selected_nodes_in_subtree: 1,
          end_total_spent_frames: input.totalSpentFrames,
          spent_frames_in_subtree: 0,
          outcome: "episode_end",
          terminal_descended: false,
          accepted_terminal_descended: false,
          terminal_axis_sse: null,
          terminal_axis_sse_delta_from_incumbent: null,
        };
        record.incomplete_prefix_opportunities.push(opportunity);
        active.openIncompleteOpportunity = { root: input.node, record: opportunity };
      }
    } else {
      record.recovery_pressure_comparable_checkpoint_nodes++;
      const incumbentRemainingAxisSse = Math.max(
        0,
        record.incumbent_axis_sse - input.incumbentPrefixAxisSse,
      );
      const prefixExcessAxisSse = Math.max(
        0,
        input.prefixAxisSse - input.incumbentPrefixAxisSse,
      );
      const recoveryPressure = incumbentRemainingAxisSse > 1e-15
        ? prefixExcessAxisSse / incumbentRemainingAxisSse
        : prefixExcessAxisSse > 1e-15 ? null : 0;
      for (const threshold of REPAIR_SUFFIX_RECOVERY_PRESSURE_THRESHOLDS) {
        const crossesThreshold = recoveryPressure === null || recoveryPressure >= threshold;
        if (!crossesThreshold || active.openRecoveryOpportunities.has(threshold)) continue;
        const thresholdOpportunityCount = record.recovery_pressure_opportunities.filter(
          (opportunity) => opportunity.threshold === threshold,
        ).length;
        const opportunity: RepairSuffixRecoveryOpportunity = {
          threshold,
          opportunity_index: thresholdOpportunityCount,
          root_gap_index: input.gapIndex,
          root_contact_ordinal: input.contactOrdinal,
          root_terminal: !input.prunable,
          root_total_spent_frames: input.totalSpentFrames,
          frontier_nodes_at_entry: input.frontierNodes,
          current_prefix_axis_count: input.prefixAxisCount,
          incumbent_prefix_axis_count: input.incumbentPrefixAxisCount,
          current_prefix_axis_sse: input.prefixAxisSse,
          incumbent_prefix_axis_sse: input.incumbentPrefixAxisSse,
          incumbent_remaining_axis_sse: incumbentRemainingAxisSse,
          prefix_excess_axis_sse: prefixExcessAxisSse,
          recovery_pressure: recoveryPressure,
          selected_nodes_in_subtree: 1,
          end_total_spent_frames: input.totalSpentFrames,
          spent_frames_in_subtree: 0,
          outcome: "episode_end",
          terminal_descended: false,
          accepted_terminal_descended: false,
          terminal_axis_sse: null,
          terminal_axis_sse_delta_from_incumbent: null,
        };
        record.recovery_pressure_opportunities.push(opportunity);
        active.openRecoveryOpportunities.set(threshold, {
          root: input.node,
          record: opportunity,
        });
      }
    }
    const assessment = assessRepairAxisDominance({
      prefixAxisSse: input.prefixAxisSse,
      prefixAxisCount: input.prefixAxisCount,
      totalAuthoredAxisCount: record.total_authored_axis_count,
      incumbentAxisQuality: record.incumbent_axis_quality,
    });
    if (assessment.dominated) {
      record.dominated_selected_nodes++;
      if (active.openOpportunity === null) {
        const opportunity: RepairAxisBranchBoundOpportunity = {
          opportunity_index: record.opportunities.length,
          root_gap_index: input.gapIndex,
          root_contact_ordinal: input.contactOrdinal,
          root_terminal: !input.prunable,
          root_total_spent_frames: input.totalSpentFrames,
          frontier_nodes_at_entry: input.frontierNodes,
          prefix_axis_count: input.prefixAxisCount,
          prefix_axis_sse: input.prefixAxisSse,
          prefix_axis_loss: input.prefixAxisLoss,
          optimistic_axis_quality_upper: assessment.optimisticAxisQualityUpper,
          incumbent_axis_quality: record.incumbent_axis_quality,
          incumbent_quality_margin: assessment.incumbentQualityMargin,
          selected_nodes_in_subtree: 1,
          end_total_spent_frames: input.totalSpentFrames,
          spent_frames_in_subtree: 0,
          outcome: "episode_end",
          terminal_descended: false,
          accepted_terminal_descended: false,
        };
        record.opportunities.push(opportunity);
        active.openOpportunity = { root: input.node, record: opportunity };
      }
    }
    const prune = this.mode === "prune" && assessment.dominated && input.prunable;
    const abort = this.mode === "abort" && assessment.dominated && input.prunable;
    if (prune) record.pruned_subtrees++;
    if (abort) record.aborted_by_bound = true;
    return { ...assessment, prune, abort };
  }

  finishAttempt(input: {
    totalSpentFrames: number;
    terminalNode: Node | null;
    terminalGapIndex: number | null;
    terminalReached: boolean;
    acceptedAlternative: boolean;
    terminalAxisSse: number | null;
  }): void {
    const active = this.active;
    if (active === null) throw new Error("repair axis-bound attempt is not active");
    if (
      (input.terminalNode === null) !== (input.terminalAxisSse === null) ||
      input.terminalAxisSse !== null &&
        (!Number.isFinite(input.terminalAxisSse) || input.terminalAxisSse < 0)
    ) {
      throw new Error("repair terminal node and finite non-negative axis SSE must agree");
    }
    const record = active.record;
    record.end_total_spent_frames = input.totalSpentFrames;
    record.terminal_reached = input.terminalReached;
    record.accepted_alternative = input.acceptedAlternative;
    record.terminal_gap_index = input.terminalGapIndex;
    if (active.openOpportunity !== null) {
      const descended = input.terminalNode !== null &&
        this.isPrefix(active.openOpportunity.root, input.terminalNode);
      this.closeOpportunity(
        input.totalSpentFrames,
        descended ? "terminal_descendant" : "episode_end",
        input.terminalNode,
        input.acceptedAlternative,
      );
    }
    for (const threshold of [...active.openRecoveryOpportunities.keys()]) {
      const open = active.openRecoveryOpportunities.get(threshold)!;
      const descended = input.terminalNode !== null &&
        this.isPrefix(open.root, input.terminalNode);
      this.closeRecoveryOpportunity(
        threshold,
        input.totalSpentFrames,
        descended ? "terminal_descendant" : "episode_end",
        input.terminalNode,
        input.acceptedAlternative,
        input.terminalAxisSse,
      );
    }
    if (active.openIncompleteOpportunity !== null) {
      const descended = input.terminalNode !== null &&
        this.isPrefix(active.openIncompleteOpportunity.root, input.terminalNode);
      this.closeIncompleteOpportunity(
        input.totalSpentFrames,
        descended ? "terminal_descendant" : "episode_end",
        input.terminalNode,
        input.acceptedAlternative,
        input.terminalAxisSse,
      );
    }
    this.active = null;
  }

  snapshot(activeTotalSpentFrames?: number): RepairAxisBranchBoundStats {
    const attempts = structuredClone(this.attempts);
    if (this.active !== null) {
      if (activeTotalSpentFrames === undefined) {
        throw new Error(
          "active repair axis-bound telemetry requires the snapshot frame",
        );
      }
      const activeRecord = attempts.at(-1)!;
      activeRecord.end_total_spent_frames = activeTotalSpentFrames;
      const open = activeRecord.opportunities.at(-1);
      if (this.active.openOpportunity !== null && open !== undefined) {
        open.end_total_spent_frames = activeTotalSpentFrames;
        open.spent_frames_in_subtree = Math.max(
          0,
          activeTotalSpentFrames - open.root_total_spent_frames,
        );
        open.outcome = "episode_end";
      }
      for (const [threshold, liveOpen] of this.active.openRecoveryOpportunities) {
        const snapshotOpen = [...activeRecord.recovery_pressure_opportunities]
          .reverse()
          .find((opportunity) =>
            opportunity.threshold === threshold &&
            opportunity.opportunity_index === liveOpen.record.opportunity_index
          );
        if (snapshotOpen === undefined) {
          throw new Error(
            `active repair recovery-pressure opportunity ${threshold} is missing`,
          );
        }
        snapshotOpen.end_total_spent_frames = activeTotalSpentFrames;
        snapshotOpen.spent_frames_in_subtree = Math.max(
          0,
          activeTotalSpentFrames - snapshotOpen.root_total_spent_frames,
        );
        snapshotOpen.outcome = "episode_end";
      }
      if (this.active.openIncompleteOpportunity !== null) {
        const snapshotOpen = activeRecord.incomplete_prefix_opportunities.at(-1);
        if (
          snapshotOpen === undefined ||
          snapshotOpen.opportunity_index !==
            this.active.openIncompleteOpportunity.record.opportunity_index
        ) throw new Error("active repair incomplete-prefix opportunity is missing");
        snapshotOpen.end_total_spent_frames = activeTotalSpentFrames;
        snapshotOpen.spent_frames_in_subtree = Math.max(
          0,
          activeTotalSpentFrames - snapshotOpen.root_total_spent_frames,
        );
        snapshotOpen.outcome = "episode_end";
      }
    }
    return {
      schema: REPAIR_AXIS_BRANCH_BOUND_SCHEMA,
      mode: this.mode,
      comparison_epsilon: LEAF_KEY_FLOAT_EPSILON,
      recovery_pressure_thresholds: [...REPAIR_SUFFIX_RECOVERY_PRESSURE_THRESHOLDS],
      attempts,
    };
  }

  private closeOpportunity(
    totalSpentFrames: number,
    outcome: RepairAxisBranchBoundOpportunity["outcome"],
    terminalNode: Node | null,
    acceptedAlternative: boolean,
  ): void {
    const active = this.active;
    const open = active?.openOpportunity ?? null;
    if (active === null || open === null) {
      throw new Error("repair axis-bound opportunity is not active");
    }
    const terminalDescended = terminalNode !== null && this.isPrefix(open.root, terminalNode);
    open.record.end_total_spent_frames = totalSpentFrames;
    open.record.spent_frames_in_subtree = Math.max(
      0,
      totalSpentFrames - open.record.root_total_spent_frames,
    );
    open.record.outcome = outcome;
    open.record.terminal_descended = terminalDescended;
    open.record.accepted_terminal_descended = terminalDescended && acceptedAlternative;
    if (open.record.accepted_terminal_descended) {
      throw new Error(
        "an accepted repair terminal descended from a mathematically dominated prefix",
      );
    }
    active.openOpportunity = null;
  }

  private closeRecoveryOpportunity(
    threshold: number,
    totalSpentFrames: number,
    outcome: RepairSuffixRecoveryOpportunity["outcome"],
    terminalNode: Node | null,
    acceptedAlternative: boolean,
    terminalAxisSse: number | null = null,
  ): void {
    const active = this.active;
    const open = active?.openRecoveryOpportunities.get(threshold) ?? null;
    if (active === null || open === null) {
      throw new Error(`repair recovery-pressure opportunity ${threshold} is not active`);
    }
    const terminalDescended = terminalNode !== null && this.isPrefix(open.root, terminalNode);
    open.record.end_total_spent_frames = totalSpentFrames;
    open.record.spent_frames_in_subtree = Math.max(
      0,
      totalSpentFrames - open.record.root_total_spent_frames,
    );
    open.record.outcome = outcome;
    open.record.terminal_descended = terminalDescended;
    open.record.accepted_terminal_descended = terminalDescended && acceptedAlternative;
    open.record.terminal_axis_sse = terminalDescended ? terminalAxisSse : null;
    open.record.terminal_axis_sse_delta_from_incumbent = terminalDescended &&
        terminalAxisSse !== null
      ? terminalAxisSse - active.record.incumbent_axis_sse
      : null;
    active.openRecoveryOpportunities.delete(threshold);
  }

  private closeIncompleteOpportunity(
    totalSpentFrames: number,
    outcome: RepairIncompletePrefixOpportunity["outcome"],
    terminalNode: Node | null,
    acceptedAlternative: boolean,
    terminalAxisSse: number | null = null,
  ): void {
    const active = this.active;
    const open = active?.openIncompleteOpportunity ?? null;
    if (active === null || open === null) {
      throw new Error("repair incomplete-prefix opportunity is not active");
    }
    const terminalDescended = terminalNode !== null && this.isPrefix(open.root, terminalNode);
    open.record.end_total_spent_frames = totalSpentFrames;
    open.record.spent_frames_in_subtree = Math.max(
      0,
      totalSpentFrames - open.record.root_total_spent_frames,
    );
    open.record.outcome = outcome;
    open.record.terminal_descended = terminalDescended;
    open.record.accepted_terminal_descended = terminalDescended && acceptedAlternative;
    open.record.terminal_axis_sse = terminalDescended ? terminalAxisSse : null;
    open.record.terminal_axis_sse_delta_from_incumbent = terminalDescended &&
        terminalAxisSse !== null
      ? terminalAxisSse - active.record.incumbent_axis_sse
      : null;
    active.openIncompleteOpportunity = null;
  }
}
