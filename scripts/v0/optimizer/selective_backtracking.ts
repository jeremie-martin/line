export type FrontierTraversalPolicy = "depth_first" | "selective_axis_regret_catchup";

export type FrontierTraversalLane = "initial" | "snapshot" | "repair" | "resumed";

export const SELECTIVE_AXIS_REGRET_MIN_CONTACT_ADVANCE = 2;
export const SELECTIVE_AXIS_REGRET_MIN_LOSS_DELTA = 0.20;

export function parseFrontierTraversalPolicy(raw: string | undefined): FrontierTraversalPolicy {
  if (raw === undefined || raw === "" || raw === "selective-axis-regret-catchup") {
    return "selective_axis_regret_catchup";
  }
  if (raw === "0" || raw === "off" || raw === "dfs") return "depth_first";
  throw new Error(
    `LR_FRONTIER_POLICY must be dfs or selective-axis-regret-catchup; got ${raw}`,
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
  eventIndex: number;
  branchGapIndex: number;
  fromGapIndex: number;
  contactAdvance: number;
  gapRewind: number;
  axisLossDelta: number;
  triggerAxisLoss: number;
};

export type SelectiveCatchupOutcome =
  | "alternative_selected"
  | "current_selected"
  | "probe_dead_end"
  | "probe_deferred"
  | "execution_ceiling";

export type SelectiveBacktrackingStats = {
  policy: "selective_axis_regret_catchup";
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
  catchup_completed: number;
  catchup_alternative_selected: number;
  catchup_current_selected: number;
  catchup_probe_dead_ends: number;
  catchup_probe_deferred: number;
  catchup_execution_ceiling_stops: number;
  catchup_probe_nodes_processed: number;
  catchup_probe_frames: number;
  axis_loss_delta_sum: number;
  axis_loss_delta_max: number;
  contact_advance_sum: number;
  contact_advance_max: number;
  gap_rewind_sum: number;
  gap_rewind_max: number;
  selective_backtracks_by_lane: Record<FrontierTraversalLane, number>;
  events: SelectiveBacktrackingEvent[];
};

export type SelectiveBacktrackingEvent = {
  lane: FrontierTraversalLane;
  branch_gap_index: number;
  from_gap_index: number;
  alternative_gap_index: number;
  contact_advance: number;
  gap_rewind: number;
  baseline_axis_loss: number;
  trigger_axis_loss: number;
  axis_loss_delta: number;
  alternative_conservative_deadline_margin: number;
  trigger_total_spent_frames: number;
  resumed_total_spent_frames: number | null;
  catchup_outcome: SelectiveCatchupOutcome | null;
  catchup_end_gap_index: number | null;
  catchup_probe_nodes_processed: number;
  catchup_probe_frames: number;
  catchup_axis_loss: number | null;
  catchup_axis_loss_gain: number | null;
};

function emptyLaneCounter(): Record<FrontierTraversalLane, number> {
  return { initial: 0, snapshot: 0, repair: 0, resumed: 0 };
}

/**
 * Compile-local signal and attribution state for the bounded-catch-up strategy.
 *
 * The controller knows no frontier representation and performs no mutation.
 * It only carries causal branch-watch lineage, evaluates the regret signal,
 * and returns the exact queued sibling that the frontier scheduler should
 * probe. This keeps trigger policy independent from catch-up scheduling and
 * equal-depth selection.
 */
export class SelectiveAxisRegretController<Node extends object> {
  readonly policy = "selective_axis_regret_catchup" as const;

  private readonly gapIndexOf: (node: Node) => number;
  private readonly lineage = new WeakMap<Node, WatchLink<Node> | null>();
  private readonly suspended = new WeakMap<Node, number>();
  private readonly stats: SelectiveBacktrackingStats = {
    policy: "selective_axis_regret_catchup",
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
    catchup_completed: 0,
    catchup_alternative_selected: 0,
    catchup_current_selected: 0,
    catchup_probe_dead_ends: 0,
    catchup_probe_deferred: 0,
    catchup_execution_ceiling_stops: 0,
    catchup_probe_nodes_processed: 0,
    catchup_probe_frames: 0,
    axis_loss_delta_sum: 0,
    axis_loss_delta_max: 0,
    contact_advance_sum: 0,
    contact_advance_max: 0,
    gap_rewind_sum: 0,
    gap_rewind_max: 0,
    selective_backtracks_by_lane: emptyLaneCounter(),
    events: [],
  };

  constructor(gapIndexOf: (node: Node) => number) {
    this.gapIndexOf = gapIndexOf;
  }

  observeRoot(node: Node): void {
    if (!this.lineage.has(node)) this.lineage.set(node, null);
  }

  replaceNode(previous: Node, replacement: Node): void {
    this.lineage.set(replacement, this.lineage.get(previous) ?? null);
    const eventIndex = this.suspended.get(previous);
    if (eventIndex === undefined) return;
    this.suspended.delete(previous);
    this.suspended.set(replacement, eventIndex);
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
    executionCeilingReached: boolean;
    totalSpentFrames: number;
    lane: FrontierTraversalLane;
    alternativeAvailable: (node: Node) => boolean;
    alternativeDeadline: (node: Node) => { margin: number; pressured: boolean };
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
      if (!input.alternativeAvailable(watch.alternative)) {
        watch.used = true;
        this.stats.unavailable_alternatives++;
        continue;
      }
      if (input.executionCeilingReached) {
        this.stats.execution_ceiling_suppressed_crossings++;
        continue;
      }
      const alternativeDeadline = input.alternativeDeadline(watch.alternative);
      if (alternativeDeadline.pressured) {
        if (!watch.deadlineSuppressionRecorded) {
          watch.deadlineSuppressionRecorded = true;
          this.stats.deadline_suppressed_crossings++;
        }
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
      const eventIndex = this.stats.events.length;
      this.stats.events.push({
        lane: input.lane,
        branch_gap_index: watch.branchGapIndex,
        from_gap_index: fromGapIndex,
        alternative_gap_index: targetGapIndex,
        contact_advance: contactAdvance,
        gap_rewind: gapRewind,
        baseline_axis_loss: watch.baselineAxisLoss,
        trigger_axis_loss: input.axisLoss,
        axis_loss_delta: axisLossDelta,
        alternative_conservative_deadline_margin: alternativeDeadline.margin,
        trigger_total_spent_frames: input.totalSpentFrames,
        resumed_total_spent_frames: null,
        catchup_outcome: null,
        catchup_end_gap_index: null,
        catchup_probe_nodes_processed: 0,
        catchup_probe_frames: 0,
        catchup_axis_loss: null,
        catchup_axis_loss_gain: null,
      });
      this.suspended.set(input.node, eventIndex);
      return {
        alternative: watch.alternative,
        eventIndex,
        branchGapIndex: watch.branchGapIndex,
        fromGapIndex,
        contactAdvance,
        gapRewind,
        axisLossDelta,
        triggerAxisLoss: input.axisLoss,
      };
    }
    return null;
  }

  markSuspended(node: Node): void {
    if (!this.suspended.has(node)) {
      throw new Error("selective backtrack suspended a node without a causal event");
    }
  }

  finishCatchup(
    decision: SelectiveBacktrackDecision<Node>,
    input: {
      outcome: SelectiveCatchupOutcome;
      endGapIndex: number;
      probeNodesProcessed: number;
      probeFrames: number;
      catchupAxisLoss: number | null;
    },
  ): void {
    const event = this.stats.events[decision.eventIndex];
    if (event === undefined || event.catchup_outcome !== null) {
      throw new Error("selective catch-up completion has no live causal event");
    }
    event.catchup_outcome = input.outcome;
    event.catchup_end_gap_index = input.endGapIndex;
    event.catchup_probe_nodes_processed = input.probeNodesProcessed;
    event.catchup_probe_frames = input.probeFrames;
    event.catchup_axis_loss = input.catchupAxisLoss;
    event.catchup_axis_loss_gain = input.catchupAxisLoss === null
      ? null
      : decision.triggerAxisLoss - input.catchupAxisLoss;
    this.stats.catchup_probe_nodes_processed += input.probeNodesProcessed;
    this.stats.catchup_probe_frames += input.probeFrames;
    if (input.outcome === "alternative_selected") {
      this.stats.catchup_completed++;
      this.stats.catchup_alternative_selected++;
    } else if (input.outcome === "current_selected") {
      this.stats.catchup_completed++;
      this.stats.catchup_current_selected++;
    } else if (input.outcome === "probe_dead_end") {
      this.stats.catchup_probe_dead_ends++;
    } else if (input.outcome === "probe_deferred") {
      this.stats.catchup_probe_deferred++;
    } else {
      this.stats.catchup_execution_ceiling_stops++;
    }
  }

  observeSelected(node: Node, totalSpentFrames: number): boolean {
    const eventIndex = this.suspended.get(node);
    if (eventIndex === undefined) return false;
    this.suspended.delete(node);
    this.stats.events[eventIndex]!.resumed_total_spent_frames = totalSpentFrames;
    this.stats.suspended_continuations_resumed++;
    return true;
  }

  snapshot(): SelectiveBacktrackingStats {
    return {
      ...this.stats,
      selective_backtracks_by_lane: { ...this.stats.selective_backtracks_by_lane },
      events: this.stats.events.map((event) => ({ ...event })),
    };
  }
}
