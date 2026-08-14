export type FrontierTraversalPolicy = "depth_first" | "selective_axis_regret";

export type FrontierTraversalLane = "initial" | "snapshot" | "repair" | "resumed";

export const SELECTIVE_AXIS_REGRET_MIN_CONTACT_ADVANCE = 2;
export const SELECTIVE_AXIS_REGRET_MIN_LOSS_DELTA = 0.20;

export function parseFrontierTraversalPolicy(raw: string | undefined): FrontierTraversalPolicy {
  if (raw === undefined || raw === "" || raw === "0" || raw === "off" || raw === "dfs") {
    return "depth_first";
  }
  if (raw === "selective-axis-regret") return "selective_axis_regret";
  throw new Error(
    `LR_FRONTIER_POLICY must be dfs or selective-axis-regret; got ${raw}`,
  );
}

type AxisRegretWatch<Node extends object> = {
  alternative: Node;
  branchContactOrdinal: number;
  branchGapIndex: number;
  baselineAxisLoss: number;
  used: boolean;
  signalCrossed: boolean;
  deadlineSuppressionRecorded: boolean;
};

type WatchLink<Node extends object> = {
  watch: AxisRegretWatch<Node>;
  parent: WatchLink<Node> | null;
};

export type SelectiveBacktrackDecision<Node extends object> = {
  alternative: Node;
  branchGapIndex: number;
  fromGapIndex: number;
  contactAdvance: number;
  gapRewind: number;
  axisLossDelta: number;
};

export type SelectiveBacktrackingStats = {
  policy: "selective_axis_regret";
  min_contact_advance: number;
  min_axis_loss_delta: number;
  contact_expansions_observed: number;
  branch_watches_armed: number;
  mature_watch_checks: number;
  loss_threshold_crossings: number;
  deadline_suppressed_crossings: number;
  execution_ceiling_suppressed_crossings: number;
  unavailable_alternatives: number;
  selective_backtracks: number;
  suspended_continuations_resumed: number;
  axis_loss_delta_sum: number;
  axis_loss_delta_max: number;
  contact_advance_sum: number;
  contact_advance_max: number;
  gap_rewind_sum: number;
  gap_rewind_max: number;
  selective_backtracks_by_lane: Record<FrontierTraversalLane, number>;
};

function emptyLaneCounter(): Record<FrontierTraversalLane, number> {
  return { initial: 0, snapshot: 0, repair: 0, resumed: 0 };
}

/**
 * Compile-local policy state for the first selective-backtracking strategy.
 *
 * The controller knows no frontier representation and performs no mutation.
 * It only carries causal branch-watch lineage, evaluates the frozen V1 signal,
 * and returns the exact queued sibling that the frontier scheduler should
 * promote. This keeps trigger policy independent from suspension/promotion.
 */
export class SelectiveAxisRegretController<Node extends object> {
  readonly policy = "selective_axis_regret" as const;

  private readonly lineage = new WeakMap<Node, WatchLink<Node> | null>();
  private readonly suspended = new WeakSet<Node>();
  private readonly stats: SelectiveBacktrackingStats = {
    policy: "selective_axis_regret",
    min_contact_advance: SELECTIVE_AXIS_REGRET_MIN_CONTACT_ADVANCE,
    min_axis_loss_delta: SELECTIVE_AXIS_REGRET_MIN_LOSS_DELTA,
    contact_expansions_observed: 0,
    branch_watches_armed: 0,
    mature_watch_checks: 0,
    loss_threshold_crossings: 0,
    deadline_suppressed_crossings: 0,
    execution_ceiling_suppressed_crossings: 0,
    unavailable_alternatives: 0,
    selective_backtracks: 0,
    suspended_continuations_resumed: 0,
    axis_loss_delta_sum: 0,
    axis_loss_delta_max: 0,
    contact_advance_sum: 0,
    contact_advance_max: 0,
    gap_rewind_sum: 0,
    gap_rewind_max: 0,
    selective_backtracks_by_lane: emptyLaneCounter(),
  };

  constructor(private readonly gapIndexOf: (node: Node) => number) {}

  observeRoot(node: Node): void {
    if (!this.lineage.has(node)) this.lineage.set(node, null);
  }

  replaceNode(previous: Node, replacement: Node): void {
    this.lineage.set(replacement, this.lineage.get(previous) ?? null);
    if (!this.suspended.has(previous)) return;
    this.suspended.delete(previous);
    this.suspended.add(replacement);
  }

  /** Propagate all ancestor watches to every child and arm one new watch only
   * on the ranker's preferred child. The concrete runner-up object is the
   * rewind target; no candidate is regenerated later. */
  observeExpansion(input: {
    parent: Node;
    children: readonly Node[];
    contactExpansion: boolean;
    contactOrdinal: number;
    axisLoss: number;
  }): void {
    const inherited = this.lineage.get(input.parent) ?? null;
    for (const child of input.children) this.lineage.set(child, inherited);
    if (!input.contactExpansion) return;
    this.stats.contact_expansions_observed++;
    if (input.children.length < 2) return;

    const watch: AxisRegretWatch<Node> = {
      alternative: input.children[1]!,
      branchContactOrdinal: input.contactOrdinal,
      branchGapIndex: this.gapIndexOf(input.parent),
      baselineAxisLoss: input.axisLoss,
      used: false,
      signalCrossed: false,
      deadlineSuppressionRecorded: false,
    };
    this.lineage.set(input.children[0]!, { watch, parent: inherited });
    this.stats.branch_watches_armed++;
  }

  consider(input: {
    node: Node;
    contactOrdinal: number;
    axisLoss: number;
    deadlinePressured: boolean;
    executionCeilingReached: boolean;
    lane: FrontierTraversalLane;
    alternativeAvailable: (node: Node) => boolean;
  }): SelectiveBacktrackDecision<Node> | null {
    let link = this.lineage.get(input.node) ?? null;
    while (link !== null) {
      const watch = link.watch;
      link = link.parent;
      if (watch.used) continue;

      const contactAdvance = input.contactOrdinal - watch.branchContactOrdinal;
      if (contactAdvance < SELECTIVE_AXIS_REGRET_MIN_CONTACT_ADVANCE) continue;
      this.stats.mature_watch_checks++;
      const axisLossDelta = input.axisLoss - watch.baselineAxisLoss;
      if (axisLossDelta < SELECTIVE_AXIS_REGRET_MIN_LOSS_DELTA) continue;

      if (!watch.signalCrossed) {
        watch.signalCrossed = true;
        this.stats.loss_threshold_crossings++;
      }
      if (input.deadlinePressured) {
        if (!watch.deadlineSuppressionRecorded) {
          watch.deadlineSuppressionRecorded = true;
          this.stats.deadline_suppressed_crossings++;
        }
        continue;
      }
      if (input.executionCeilingReached) {
        this.stats.execution_ceiling_suppressed_crossings++;
        continue;
      }
      if (!input.alternativeAvailable(watch.alternative)) {
        watch.used = true;
        this.stats.unavailable_alternatives++;
        continue;
      }

      watch.used = true;
      const fromGapIndex = this.gapIndexOf(input.node);
      const targetGapIndex = this.gapIndexOf(watch.alternative);
      const gapRewind = Math.max(0, fromGapIndex - targetGapIndex);
      this.stats.selective_backtracks++;
      this.stats.selective_backtracks_by_lane[input.lane]++;
      this.stats.axis_loss_delta_sum += axisLossDelta;
      this.stats.axis_loss_delta_max = Math.max(this.stats.axis_loss_delta_max, axisLossDelta);
      this.stats.contact_advance_sum += contactAdvance;
      this.stats.contact_advance_max = Math.max(this.stats.contact_advance_max, contactAdvance);
      this.stats.gap_rewind_sum += gapRewind;
      this.stats.gap_rewind_max = Math.max(this.stats.gap_rewind_max, gapRewind);
      return {
        alternative: watch.alternative,
        branchGapIndex: watch.branchGapIndex,
        fromGapIndex,
        contactAdvance,
        gapRewind,
        axisLossDelta,
      };
    }
    return null;
  }

  markSuspended(node: Node): void {
    this.suspended.add(node);
  }

  observeSelected(node: Node): boolean {
    if (!this.suspended.has(node)) return false;
    this.suspended.delete(node);
    this.stats.suspended_continuations_resumed++;
    return true;
  }

  snapshot(): SelectiveBacktrackingStats {
    return {
      ...this.stats,
      selective_backtracks_by_lane: { ...this.stats.selective_backtracks_by_lane },
    };
  }
}
