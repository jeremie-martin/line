export type SelectiveCatchupPolicy =
  | "selective_axis_regret_catchup"
  | "selective_axis_regret_catchup_reserve_225";

export type FrontierTraversalPolicy = "depth_first" | SelectiveCatchupPolicy;

export type FrontierTraversalLane = "initial" | "snapshot" | "repair" | "resumed";

export const SELECTIVE_AXIS_REGRET_MIN_CONTACT_ADVANCE = 2;
export const SELECTIVE_AXIS_REGRET_MIN_LOSS_DELTA = 0.20;
export const SELECTIVE_AXIS_REGRET_RESERVE_MIN_CONSERVATIVE_MARGIN = 2.25;
export const SELECTIVE_AXIS_REGRET_OPPORTUNITY_THRESHOLDS = [0.05, 0.10, 0.15, 0.20] as const;

export function parseFrontierTraversalPolicy(raw: string | undefined): FrontierTraversalPolicy {
  if (raw === undefined || raw === "" || raw === "selective-axis-regret-catchup") {
    return "selective_axis_regret_catchup";
  }
  if (raw === "selective-axis-regret-catchup-reserve-225") {
    return "selective_axis_regret_catchup_reserve_225";
  }
  if (raw === "0" || raw === "off" || raw === "dfs") return "depth_first";
  throw new Error(
    `LR_FRONTIER_POLICY must be dfs, selective-axis-regret-catchup, or ` +
      `selective-axis-regret-catchup-reserve-225; got ${raw}`,
  );
}

export function catchupAlternativeHasSufficientGain(
  currentAxisLoss: number,
  alternativeAxisLoss: number,
): boolean {
  return currentAxisLoss > alternativeAxisLoss;
}

type AxisRegretWatch<Node extends object> = {
  alternative: Node;
  branchContactOrdinal: number;
  branchGapIndex: number;
  baselineAxisLoss: number;
  used: boolean;
  signalCrossed: boolean;
  deadlineSuppressionRecorded: boolean;
  opportunityCrossedMask: number;
  opportunityAdmissibleMask: number;
  reserveMarginSuppressionRecorded: boolean;
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
  policy: SelectiveCatchupPolicy;
  min_contact_advance: number;
  min_axis_loss_delta: number;
  catchup_axis_loss_gain_threshold: number;
  min_conservative_deadline_margin: number | null;
  reserve_margin_suppressed_crossings: number;
  mature_axis_loss_delta_max: number;
  regret_opportunities_by_min_axis_loss_delta: Record<
    string,
    { crossed_watches: number; admissible_watches: number }
  >;
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
  catchup_checkpoints: SelectiveCatchupCheckpoint[];
};

export type SelectiveCatchupCheckpoint = {
  gap_index: number;
  contact_advance: number;
  probe_nodes_processed: number;
  probe_frames: number;
  current_axis_loss: number;
  alternative_axis_loss: number;
  alternative_axis_loss_gain: number;
};

function emptyLaneCounter(): Record<FrontierTraversalLane, number> {
  return { initial: 0, snapshot: 0, repair: 0, resumed: 0 };
}

function emptyRegretOpportunityCounter(): SelectiveBacktrackingStats[
  "regret_opportunities_by_min_axis_loss_delta"
] {
  return Object.fromEntries(SELECTIVE_AXIS_REGRET_OPPORTUNITY_THRESHOLDS.map((threshold) => [
    threshold.toFixed(2),
    { crossed_watches: 0, admissible_watches: 0 },
  ]));
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
  readonly policy: SelectiveCatchupPolicy;

  private readonly gapIndexOf: (node: Node) => number;
  private readonly minConservativeDeadlineMargin: number | null;
  private readonly lineage = new WeakMap<Node, WatchLink<Node> | null>();
  private readonly suspended = new WeakMap<Node, number>();
  private readonly stats: SelectiveBacktrackingStats;

  constructor(
    gapIndexOf: (node: Node) => number,
    options: {
      policy?: SelectiveCatchupPolicy;
    } = {},
  ) {
    this.gapIndexOf = gapIndexOf;
    this.policy = options.policy ?? "selective_axis_regret_catchup";
    this.minConservativeDeadlineMargin =
      this.policy === "selective_axis_regret_catchup_reserve_225"
        ? SELECTIVE_AXIS_REGRET_RESERVE_MIN_CONSERVATIVE_MARGIN
        : null;
    this.stats = {
      policy: this.policy,
      min_contact_advance: SELECTIVE_AXIS_REGRET_MIN_CONTACT_ADVANCE,
      min_axis_loss_delta: SELECTIVE_AXIS_REGRET_MIN_LOSS_DELTA,
      catchup_axis_loss_gain_threshold: 0,
      min_conservative_deadline_margin: this.minConservativeDeadlineMargin,
      reserve_margin_suppressed_crossings: 0,
      mature_axis_loss_delta_max: 0,
      regret_opportunities_by_min_axis_loss_delta: emptyRegretOpportunityCounter(),
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
      opportunityCrossedMask: 0,
      opportunityAdmissibleMask: 0,
      reserveMarginSuppressionRecorded: false,
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
      this.stats.mature_axis_loss_delta_max = Math.max(
        this.stats.mature_axis_loss_delta_max,
        axisLossDelta,
      );

      let alternativeAvailable: boolean | undefined;
      let alternativeDeadline: { margin: number; pressured: boolean } | undefined;
      const readAlternativeAvailable = (): boolean => {
        alternativeAvailable ??= input.alternativeAvailable(watch.alternative);
        return alternativeAvailable;
      };
      const readAlternativeDeadline = (): { margin: number; pressured: boolean } => {
        alternativeDeadline ??= input.alternativeDeadline(watch.alternative);
        return alternativeDeadline;
      };

      let newlyEligibleMask = 0;
      for (let i = 0; i < SELECTIVE_AXIS_REGRET_OPPORTUNITY_THRESHOLDS.length; i++) {
        const threshold = SELECTIVE_AXIS_REGRET_OPPORTUNITY_THRESHOLDS[i]!;
        if (axisLossDelta < threshold) continue;
        const bit = 1 << i;
        const counter = this.stats.regret_opportunities_by_min_axis_loss_delta[
          threshold.toFixed(2)
        ]!;
        if ((watch.opportunityCrossedMask & bit) === 0) {
          watch.opportunityCrossedMask |= bit;
          counter.crossed_watches++;
        }
        if ((watch.opportunityAdmissibleMask & bit) === 0) newlyEligibleMask |= bit;
      }
      if (
        newlyEligibleMask !== 0 &&
        !input.executionCeilingReached &&
        readAlternativeAvailable() &&
        !readAlternativeDeadline().pressured
      ) {
        for (let i = 0; i < SELECTIVE_AXIS_REGRET_OPPORTUNITY_THRESHOLDS.length; i++) {
          const bit = 1 << i;
          if ((newlyEligibleMask & bit) === 0) continue;
          watch.opportunityAdmissibleMask |= bit;
          const threshold = SELECTIVE_AXIS_REGRET_OPPORTUNITY_THRESHOLDS[i]!;
          this.stats.regret_opportunities_by_min_axis_loss_delta[
            threshold.toFixed(2)
          ]!.admissible_watches++;
        }
      }
      if (axisLossDelta < SELECTIVE_AXIS_REGRET_MIN_LOSS_DELTA) continue;

      if (!watch.signalCrossed) {
        watch.signalCrossed = true;
        this.stats.loss_threshold_crossings++;
      }

      const fromGapIndex = this.gapIndexOf(input.node);
      const targetGapIndex = this.gapIndexOf(watch.alternative);
      const gapRewind = Math.max(0, fromGapIndex - targetGapIndex);
      if (!readAlternativeAvailable()) {
        watch.used = true;
        this.stats.unavailable_alternatives++;
        continue;
      }
      if (input.executionCeilingReached) {
        this.stats.execution_ceiling_suppressed_crossings++;
        continue;
      }
      const admittedAlternativeDeadline = readAlternativeDeadline();
      if (admittedAlternativeDeadline.pressured) {
        if (!watch.deadlineSuppressionRecorded) {
          watch.deadlineSuppressionRecorded = true;
          this.stats.deadline_suppressed_crossings++;
        }
        continue;
      }
      if (
        this.minConservativeDeadlineMargin !== null &&
        admittedAlternativeDeadline.margin < this.minConservativeDeadlineMargin
      ) {
        if (!watch.reserveMarginSuppressionRecorded) {
          watch.reserveMarginSuppressionRecorded = true;
          this.stats.reserve_margin_suppressed_crossings++;
        }
        continue;
      }

      watch.used = true;
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
        alternative_conservative_deadline_margin: admittedAlternativeDeadline.margin,
        trigger_total_spent_frames: input.totalSpentFrames,
        resumed_total_spent_frames: null,
        catchup_outcome: null,
        catchup_end_gap_index: null,
        catchup_probe_nodes_processed: 0,
        catchup_probe_frames: 0,
        catchup_axis_loss: null,
        catchup_axis_loss_gain: null,
        catchup_checkpoints: [],
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

  /** Record a pure, like-for-like observation while the alternative catches
   * up. This does not decide or mutate traversal. It lets offline studies ask
   * which bounded stopping rules would have saved work before we put any such
   * rule into the compiler. */
  recordCatchupCheckpoint(
    decision: SelectiveBacktrackDecision<Node>,
    checkpoint: SelectiveCatchupCheckpoint,
  ): void {
    const event = this.stats.events[decision.eventIndex];
    if (event === undefined || event.catchup_outcome !== null) {
      throw new Error("selective catch-up checkpoint has no live causal event");
    }
    const previous = event.catchup_checkpoints.at(-1);
    if (
      checkpoint.gap_index <= (previous?.gap_index ?? decision.branchGapIndex) ||
      checkpoint.gap_index > decision.fromGapIndex ||
      checkpoint.probe_nodes_processed < (previous?.probe_nodes_processed ?? 0) ||
      checkpoint.probe_frames < (previous?.probe_frames ?? 0)
    ) {
      throw new Error("selective catch-up checkpoints must advance monotonically to the target");
    }
    event.catchup_checkpoints.push({ ...checkpoint });
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
      regret_opportunities_by_min_axis_loss_delta: Object.fromEntries(
        Object.entries(this.stats.regret_opportunities_by_min_axis_loss_delta).map(
          ([threshold, counts]) => [threshold, { ...counts }],
        ),
      ),
      events: this.stats.events.map((event) => ({
        ...event,
        catchup_checkpoints: event.catchup_checkpoints.map((checkpoint) => ({ ...checkpoint })),
      })),
    };
  }
}
